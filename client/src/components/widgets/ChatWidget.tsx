import { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { chatAPI, Conversation, Message, ReplyDeadlineStatus, User, ChatIntent } from '../../api/chat';
import { relationshipAPI, RelationshipState } from '../../api/relationship';
import { profileAPI } from '../../api/profile';
import { activityAPI } from '../../api/activity';
import { safetyAPI, MeetupPlan, EmergencyContact, MeetupWeekStatus } from '../../api/safety';
import DateVenuePicker from '../DateVenuePicker';
import IdCameraScan from '../IdCameraScan';
import { reviewsAPI, ReviewAttributes, REVIEW_ATTRIBUTE_LABELS } from '../../api/reviews';
import ExperienceReviewModal from '../ExperienceReviewModal';
import BreakupReasonModal from '../BreakupReasonModal';
import { singleAgainAPI } from '../../api/singleAgain';
import { speedDateAPI, SpeedDate } from '../../api/speedDate';
import { connectionJourneyAPI, ConnectionJourneyResponse } from '../../api/connectionJourney';
import RelationshipCouplePanel from './RelationshipCouplePanel';
import VoiceSafetyPanel from '../VoiceSafetyPanel';
import { askWhatYouAreWearing } from '../AppearanceSafetyPrompt';
import TranslateButton from '../TranslateButton';
import GifEmojiPicker from '../GifEmojiPicker';
import { messageTranslateText, renderMessageContent } from '../ChatGifBubble';
import { parseChatGif, previewChatContent } from '../../lib/chatGif';
import { voiceRecordingAPI } from '../../api/voiceRecording';
import CommunicationsTutorial, { commsTutorialSeen } from '../CommunicationsTutorial';
import DisinterestAnalyzer from '../DisinterestAnalyzer';
import TextingHelpWheel from '../TextingHelpWheel';
import { disinterestAPI, type DisinterestReport } from '../../api/disinterest';
import '../../pages/Dashboard.css';

const formatMessageTime = (createdAt: string | Date) => {
  const d = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const now = new Date();
  const today = now.toDateString();
  const msgDate = d.toDateString();
  if (msgDate === today) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (msgDate === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const MEETUP_KEYWORDS = /\b(meet|meeting|date|meet up|meetup|see you|coffee|dinner|movie|tonight|tomorrow|get together|hang out|pick me up|drop by|meet me|meeting up|meetup|catch up|grab a drink|go out)\b/i;

const CHAT_LANES: { id: 'all' | ChatIntent; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'serious', label: 'Serious relationship' },
  { id: 'casual', label: 'Casual' },
  { id: 'friends', label: 'Friends' },
];

const INTENT_LABEL: Record<ChatIntent, string> = {
  serious: 'Serious',
  casual: 'Casual',
  friends: 'Friends',
};

export interface EnrichedMeetupPlan extends MeetupPlan {
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactAppName?: string;
}

interface ChatWidgetProps {
  initialOtherUserId?: string | null;
  onOpenedWithUserId?: () => void;
  onOpenGuides?: () => void;
  openDisinterestForUserId?: string | null;
  onDisinterestOpened?: () => void;
  resumeTextingHelpSessionId?: string | null;
  onTextingHelpResumed?: () => void;
}

const ChatWidget = ({
  initialOtherUserId,
  onOpenedWithUserId,
  onOpenGuides,
  openDisinterestForUserId,
  onDisinterestOpened,
  resumeTextingHelpSessionId,
  onTextingHelpResumed,
}: ChatWidgetProps) => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [view, setView] = useState<'list' | 'thread' | 'new' | 'search' | 'compare'>('list');
  const [chatLane, setChatLane] = useState<'all' | ChatIntent>('all');
  const [showCommsTutorial, setShowCommsTutorial] = useState(() => !commsTutorialSeen());
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [replyDeadline, setReplyDeadline] = useState<ReplyDeadlineStatus | null>(null);
  const [deadlineNow, setDeadlineNow] = useState(() => Date.now());
  const [menuOpen, setMenuOpen] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Meetup safety popup
  const [showMeetupPopup, setShowMeetupPopup] = useState(false);
  const [meetupDismissedForChat, setMeetupDismissedForChat] = useState<string | null>(null);

  // Boundaries / Safety & Consent (shown when date/meetup detected, before meetup plan)
  const [showBoundariesModal, setShowBoundariesModal] = useState(false);
  const [boundariesDismissedForChat, setBoundariesDismissedForChat] = useState<string | null>(null);
  const [boundariesChecklist, setBoundariesChecklist] = useState({ over18: false, withdraw: false, publicPlace: false, respect: false });
  const [boundariesConsent, setBoundariesConsent] = useState<boolean | null>(null);
  const [boundariesSending, setBoundariesSending] = useState(false);
  const [meetAt, setMeetAt] = useState('');
  const [meetupLocation, setMeetupLocation] = useState('');
  const [expectedBackAt, setExpectedBackAt] = useState('');
  const [emergencyType, setEmergencyType] = useState<'app' | 'phone'>('app');
  const [emergencyContactUserId, setEmergencyContactUserId] = useState<string | null>(null);
  const [emergencyContactId, setEmergencyContactId] = useState<string | null>(null);
  const [emergencySearchQuery, setEmergencySearchQuery] = useState('');
  const [emergencySearchResults, setEmergencySearchResults] = useState<User[]>([]);
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [savedContacts, setSavedContacts] = useState<EmergencyContact[]>([]);
  const [meetupSubmitting, setMeetupSubmitting] = useState(false);
  const [meetupWeek, setMeetupWeek] = useState<MeetupWeekStatus | null>(null);
  const [dateLock, setDateLock] = useState<Conversation['dateLock'] | null>(null);
  const [idVerificationConsent, setIdVerificationConsent] = useState(false);
  const [disinterestOpen, setDisinterestOpen] = useState(false);
  const [disinterestReport, setDisinterestReport] = useState<DisinterestReport | null>(null);
  const [textingHelpOpen, setTextingHelpOpen] = useState(false);
  const [helpSessionId, setHelpSessionId] = useState<string | null>(null);
  const [trackingConsent, setTrackingConsent] = useState(false);
  const [idFrontImage, setIdFrontImage] = useState<string | null>(null);
  const [idBackImage, setIdBackImage] = useState<string | null>(null);
  const [agreedVenueName, setAgreedVenueName] = useState('');
  const [showSafetyVideoModal, setShowSafetyVideoModal] = useState<MeetupPlan | null>(null);
  const [safetyVideoSubmitting, setSafetyVideoSubmitting] = useState(false);
  const safetyVideoRecorderRef = useRef<MediaRecorder | null>(null);
  const safetyVideoChunksRef = useRef<Blob[]>([]);

  // Check-in reminder (when expectedBackAt is reached)
  const [checkInPlan, setCheckInPlan] = useState<EnrichedMeetupPlan | null>(null);
  const [meetupPlans, setMeetupPlans] = useState<EnrichedMeetupPlan[]>([]);
  const [showVoiceGuardPanel, setShowVoiceGuardPanel] = useState(false);

  // Search friends
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compare (select exactly 2 users – FIFA-style)
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [compareData, setCompareData] = useState<Array<{ user: User; attrs: ReviewAttributes }> | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareFromView, setCompareFromView] = useState<'list' | 'new'>('list');

  // Focus (5-day commitment): during focus, other chats are blurred
  const [focus, setFocus] = useState<{ partnerUserId: string; partnerName: string | null; startedAt: string; endsAt: string; daysLeft: number } | null>(null);
  const [focusLoading, setFocusLoading] = useState(false);
  const [showFocusConfirm, setShowFocusConfirm] = useState<{ userId: string; name: string } | null>(null);

  // Relationship: when in a relationship, only partner chat is clear; other chats blurred until both confirm end
  const [relationship, setRelationship] = useState<RelationshipState | null>(null);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [showDatingPrompt, setShowDatingPrompt] = useState(false);
  const [showEndPrompt, setShowEndPrompt] = useState(false);
  const [breakupModal, setBreakupModal] = useState<null | { kind: 'end' | 'unmatch' }>(null);
  const [rouletteHold, setRouletteHold] = useState(false);
  const [rouletteChat, setRouletteChat] = useState(false);
  const [rouletteHealNote, setRouletteHealNote] = useState<string | null>(null);
  const [rouletteOwner, setRouletteOwner] = useState(false);
  const [roulettePostId, setRoulettePostId] = useState<string | null>(null);
  const [healDraft, setHealDraft] = useState('');
  const [relationshipTip, setRelationshipTip] = useState<string | null>(null);
  const [relationshipTopic, setRelationshipTopic] = useState<string | null>(null);
  const [relationshipDateIdea, setRelationshipDateIdea] = useState<string | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState<{ relationshipId: string } | null>(null);
  const [checkInGoingWell, setCheckInGoingWell] = useState<boolean | null>(null);
  const [checkInProblem, setCheckInProblem] = useState('');
  const [checkInSolutions, setCheckInSolutions] = useState<string[]>([]);
  const [showConflictSolutions, setShowConflictSolutions] = useState<string[]>([]);
  const [cheatWarning, setCheatWarning] = useState<{
    userId: string;
    name: string;
    profilePicture: string | null;
    title?: string;
    body?: string;
    risks?: string[];
    selfControl?: string;
  } | null>(null);

  // NDA (celebrity / public figure): must sign before chatting
  const [ndaModal, setNdaModal] = useState<{ otherUserId: string; otherName: string; otherAvatar: string | null; interestId: string; agreementText: string } | null>(null);
  const [ndaSignature, setNdaSignature] = useState('');
  const [ndaSigning, setNdaSigning] = useState(false);

  // Experience review (before unmatch / end chat)
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewModalSource, setReviewModalSource] = useState<'unmatch' | 'manual'>('manual');
  const [pendingUnmatchAfterReview, setPendingUnmatchAfterReview] = useState(false);

  // Speed date
  const [speedDate, setSpeedDate] = useState<SpeedDate | null>(null);
  const [speedDatePartner, setSpeedDatePartner] = useState<{ id: string; name: string; profilePicture: string | null } | null>(null);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [continueAnswered, setContinueAnswered] = useState(false);
  const [upliftingMessage, setUpliftingMessage] = useState<string | null>(null);

  // Connection Journey (7-day challenges, games, quizzes, gifts, surprises before "like each other")
  const [connectionJourney, setConnectionJourney] = useState<ConnectionJourneyResponse | null>(null);
  const [connectionJourneyLoading, setConnectionJourneyLoading] = useState(false);
  const [connectionJourneyActionLoading, setConnectionJourneyActionLoading] = useState(false);

  const CONVO_PROMPTS = [
    "What's something you're really proud of?",
    "If you could have dinner with anyone, who and why?",
    "What's your go-to karaoke song?",
    "Best trip you've ever taken?",
    "What's a skill you'd love to learn?",
    "Coffee or tea? How do you take it?",
    "What's the last thing that made you laugh really hard?",
    "Morning person or night owl?",
    "What's your hidden talent?",
    "If you could live anywhere, where?",
  ];
  const [convoPrompt, setConvoPrompt] = useState<string | null>(null);
  const convoPromptRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifPickerTab, setGifPickerTab] = useState<'gifs' | 'emojis'>('gifs');
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordingVideo, setRecordingVideo] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadConversations();
      chatAPI.getFocus().then((r) => setFocus(r.focus)).catch(() => setFocus(null));
      relationshipAPI.getMyRelationship().then((r) => setRelationship(r.relationship)).catch(() => setRelationship(null));
      speedDateAPI.getActive().then((r) => {
        setSpeedDate(r.speedDate);
        setSpeedDatePartner(r.partner);
        if (r.speedDate && new Date(r.speedDate.endAt) <= new Date()) {
          setShowContinuePrompt(true);
        }
      });
    }
  }, [user?.id]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as { userId?: string } | undefined;
      const otherId = detail?.userId || localStorage.getItem('chatSelectedUserId');
      if (!otherId || !user?.id) return;
      localStorage.removeItem('chatSelectedUserId');
      profileAPI.getUserProfile(otherId)
        .then((profile) => {
          loadMessages(otherId, profile.name || 'User', profile.profilePicture || null);
          loadConversations();
        })
        .catch(() => {
          loadMessages(otherId, 'User', null);
          loadConversations();
        });
    };
    const onRefresh = () => {
      loadConversations();
    };
    window.addEventListener('chat:open', onOpen);
    window.addEventListener('chat:refresh', onRefresh);
    const pending = localStorage.getItem('chatSelectedUserId');
    if (pending && user?.id) {
      window.dispatchEvent(new CustomEvent('chat:open', { detail: { userId: pending } }));
    }
    return () => {
      window.removeEventListener('chat:open', onOpen);
      window.removeEventListener('chat:refresh', onRefresh);
    };
  }, [user?.id]);

  const fetchMeetupPlansAndCheckDue = async () => {
    if (!user?.id) return;
    try {
      const poll = await safetyAPI.pollMeetupSafetyReminders().catch(() => null);
      if (poll?.needsSafetyVideo?.length) {
        setShowSafetyVideoModal(poll.needsSafetyVideo[0] as MeetupPlan);
      }
      const { plans } = await safetyAPI.getMeetupPlans();
      setMeetupPlans(plans as EnrichedMeetupPlan[]);
      const now = new Date();
      const due = plans.find((p: EnrichedMeetupPlan) => {
        const back = new Date(p.expectedBackAt);
        return !p.notifiedAt && back.getTime() <= now.getTime();
      }) as EnrichedMeetupPlan | undefined;
      if (due) {
        setCheckInPlan(due);
        await safetyAPI.markMeetupPlanNotified(due.id);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchMeetupPlansAndCheckDue();
    const t = setInterval(fetchMeetupPlansAndCheckDue, 60000);
    return () => clearInterval(t);
  }, [user?.id]);

  useEffect(() => {
    if (showMeetupPopup && emergencyType === 'phone') {
      safetyAPI.getEmergencyContacts().then((r) => setSavedContacts(r.contacts));
    }
  }, [showMeetupPopup, emergencyType]);

  const handleReplyDeadlineUnmatched = (reason?: string) => {
    setError(reason || 'This match ended — someone did not reply within 24 hours.');
    setReplyDeadline(null);
    setMessages([]);
    setSelectedUserId(null);
    setSelectedName(null);
    setSelectedAvatar(null);
    setView('list');
    loadConversations();
  };

  const loadConversations = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const { conversations: list } = await chatAPI.getConversations(user.id);
      setConversations(list);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const setConversationIntent = async (otherUserId: string, intent: ChatIntent) => {
    try {
      await chatAPI.setChatIntent(otherUserId, intent);
      setConversations((prev) => prev.map((c) => (c.userId === otherUserId ? { ...c, intent } : c)));
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not save how you organize this chat');
    }
  };

  useEffect(() => {
    if (!initialOtherUserId || !user?.id) return;
    let cancelled = false;
    profileAPI.getUserProfile(initialOtherUserId)
      .then(async (profile) => {
        if (cancelled) return;
        const name = profile.name || 'User';
        const avatar = profile.profilePicture || null;
        const ndaStatus = await activityAPI.getNDAStatusByUser(initialOtherUserId).catch(() => ({ required: false, signed: true }));
        if (cancelled) return;
        if (ndaStatus.required && !ndaStatus.signed && 'interestId' in ndaStatus && ndaStatus.interestId) {
          setNdaModal({
            otherUserId: initialOtherUserId,
            otherName: name,
            otherAvatar: avatar,
            interestId: ndaStatus.interestId,
            agreementText: ('agreementText' in ndaStatus ? ndaStatus.agreementText : '') || '',
          });
          onOpenedWithUserId?.();
          return;
        }
        loadMessages(initialOtherUserId, name, avatar);
        onOpenedWithUserId?.();
      })
      .catch(() => {
        if (!cancelled) {
          loadMessages(initialOtherUserId!, 'User', null);
          onOpenedWithUserId?.();
        }
      });
    return () => { cancelled = true; };
  }, [initialOtherUserId]);

  useEffect(() => {
    if (!selectedUserId || !user?.id) {
      setDisinterestReport(null);
      return;
    }
    let cancelled = false;
    disinterestAPI
      .getReport(selectedUserId)
      .then((report) => {
        if (!cancelled) setDisinterestReport(report);
      })
      .catch(() => {
        if (!cancelled) setDisinterestReport(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedUserId, user?.id, messages.length]);

  useEffect(() => {
    if (!openDisinterestForUserId || !selectedUserId) return;
    if (openDisinterestForUserId !== selectedUserId) return;
    if (!disinterestReport) return;
    setDisinterestOpen(true);
    onDisinterestOpened?.();
  }, [openDisinterestForUserId, selectedUserId, disinterestReport, onDisinterestOpened]);

  useEffect(() => {
    if (!resumeTextingHelpSessionId) return;
    setHelpSessionId(resumeTextingHelpSessionId);
    setTextingHelpOpen(true);
    onTextingHelpResumed?.();
  }, [resumeTextingHelpSessionId, onTextingHelpResumed]);

  useEffect(() => {
    const onShow = (e: Event) => {
      const other = (e as CustomEvent<{ otherUserId?: string }>).detail?.otherUserId;
      if (other && other === selectedUserId) setDisinterestOpen(true);
    };
    window.addEventListener('chat:show-disinterest', onShow);
    return () => window.removeEventListener('chat:show-disinterest', onShow);
  }, [selectedUserId]);

  const handleNDASign = async () => {
    if (!ndaModal || !ndaSignature.trim()) return;
    setNdaSigning(true);
    try {
      await activityAPI.signNDA(ndaModal.interestId, ndaSignature.trim(), ndaModal.agreementText);
      setNdaModal(null);
      setNdaSignature('');
      loadMessages(ndaModal.otherUserId, ndaModal.otherName, ndaModal.otherAvatar);
      onOpenedWithUserId?.();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to sign NDA');
    } finally {
      setNdaSigning(false);
    }
  };

  const loadMessages = async (otherUserId: string, name: string, profilePicture: string | null) => {
    if (!user?.id) return;
    setSelectedUserId(otherUserId);
    setSelectedName(name);
    setSelectedAvatar(profilePicture);
    setView('thread');
    setLoading(true);
    setError('');
    setRouletteHold(false);
    setRouletteChat(false);
    setRouletteOwner(false);
    setRoulettePostId(null);
    setRouletteHealNote(null);
    try {
      const data = await chatAPI.getConversation(otherUserId, user.id);
      if (data.unmatched) {
        handleReplyDeadlineUnmatched(data.unmatchedReason);
        return;
      }
      setReplyDeadline(data.replyDeadline ?? null);
      setMeetupWeek(data.meetupWeek ?? null);
      setDateLock(data.dateLock ?? null);
      setRouletteHold(Boolean(data.rouletteHold));
      setRouletteChat(Boolean(data.rouletteChat || data.rouletteOwner || data.rouletteHold));
      setRouletteHealNote(data.rouletteHealNote || null);
      setRouletteOwner(Boolean(data.rouletteOwner));
      setRoulettePostId(data.roulettePostId || null);
      setMessages(data.messages);
      await chatAPI.markAsRead(otherUserId, user.id);
      await loadConversations();
      if (!meetupDismissedForChat && data.messages.some((m: Message) => MEETUP_KEYWORDS.test(m.content))) {
        if (!boundariesDismissedForChat) setShowBoundariesModal(true);
        else setShowMeetupPopup(true);
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (view !== 'thread' || messages.length === 0) {
      setConvoPrompt(null);
      if (convoPromptRef.current) clearInterval(convoPromptRef.current);
      return;
    }
    const lastMsg = messages[messages.length - 1];
    const lastTime = typeof lastMsg?.createdAt === 'string' ? new Date(lastMsg.createdAt).getTime() : 0;
    convoPromptRef.current = setInterval(() => {
      if (Date.now() - lastTime > 90 * 1000) {
        setConvoPrompt(CONVO_PROMPTS[Math.floor(Math.random() * CONVO_PROMPTS.length)]);
      } else {
        setConvoPrompt(null);
      }
    }, 30000);
    return () => { if (convoPromptRef.current) clearInterval(convoPromptRef.current); };
  }, [view, messages]);

  // Relationship: load tip of day and topic when in relationship thread with partner
  const isRelationshipThread = relationship?.status === 'active' && selectedUserId === relationship?.partnerUserId;
  const isPendingPartnerThread = relationship?.status === 'pending' && selectedUserId === relationship?.partnerUserId && !relationship?.userConfirmedDating;
  useEffect(() => {
    if (!isRelationshipThread || !user?.id) return;
    relationshipAPI.getTipOfDay().then((r) => setRelationshipTip(r.tip)).catch(() => setRelationshipTip(null));
    relationshipAPI.getTopicSuggestion().then((r) => setRelationshipTopic(r.topic)).catch(() => setRelationshipTopic(null));
    relationshipAPI.getDateIdea().then((r) => setRelationshipDateIdea(r.idea)).catch(() => setRelationshipDateIdea(null));
  }, [isRelationshipThread, user?.id]);

  // Relationship: check for "Are you dating?" when not yet in relationship; "No longer dating?" when in relationship with this partner
  useEffect(() => {
    if (view !== 'thread' || !selectedUserId || !user?.id) return;
    const t = setTimeout(() => {
      relationshipAPI.getDetectionPrompt(selectedUserId).then((r) => {
        if (r.shouldAskIfDating && !relationship) setShowDatingPrompt(true);
        if (r.shouldAskIfEnded && relationship?.status === 'active' && relationship.partnerUserId === selectedUserId) setShowEndPrompt(true);
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [view, selectedUserId, user?.id, messages.length, relationship?.status, relationship?.partnerUserId]);

  // Relationship: nightly check-in prompt (when in relationship and viewing list or partner thread)
  useEffect(() => {
    if (!user?.id || relationship?.status !== 'active') return;
    relationshipAPI.getCheckInPrompt().then((r) => {
      if (r.shouldShow && r.relationshipId) setShowCheckInModal({ relationshipId: r.relationshipId });
    }).catch(() => {});
  }, [user?.id, relationship?.status]);

  // Connection Journey: load when in thread with someone we're not in an active relationship with
  const showConnectionJourney =
    view === 'thread' &&
    !!selectedUserId &&
    !!user?.id &&
    relationship?.status !== 'active';
  useEffect(() => {
    if (!showConnectionJourney || !selectedUserId) {
      setConnectionJourney(null);
      return;
    }
    setConnectionJourneyLoading(true);
    connectionJourneyAPI
      .getJourney(selectedUserId)
      .then((r) => setConnectionJourney(r))
      .catch(() => setConnectionJourney(null))
      .finally(() => setConnectionJourneyLoading(false));
  }, [showConnectionJourney, selectedUserId]);

  const sendContent = async (content: string) => {
    if (!selectedUserId || !user?.id) return;
    try {
      const { message, replyDeadline: nextDeadline } = await chatAPI.sendMessage(selectedUserId, content, user.id);
      setMessages((prev) => [...prev, message]);
      if (nextDeadline) setReplyDeadline(nextDeadline);
      await loadConversations();
      if (!content.startsWith('data:') && !parseChatGif(content) && !meetupDismissedForChat && MEETUP_KEYWORDS.test(content)) {
        if (!boundariesDismissedForChat) setShowBoundariesModal(true);
        else setShowMeetupPopup(true);
      }
      if (relationship?.status === 'active' && selectedUserId === relationship.partnerUserId && !content.startsWith('data:') && !parseChatGif(content)) {
        voiceRecordingAPI.detectGathering(selectedUserId, content).catch(() => {});
      }
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Failed to send';
      setError(msg);
      if (e.response?.data?.unmatched) {
        handleReplyDeadlineUnmatched(msg);
      }
    }
  };

  useEffect(() => {
    if (view !== 'thread' || !selectedUserId || !user?.id) return;
    const tick = () => {
      chatAPI
        .getConversation(selectedUserId, user.id)
        .then((data) => {
          if (data.unmatched) {
            handleReplyDeadlineUnmatched(data.unmatchedReason);
            return;
          }
          setReplyDeadline(data.replyDeadline ?? null);
        })
        .catch(() => {});
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [view, selectedUserId, user?.id]);

  const iOweReply = Boolean(
    replyDeadline?.active &&
    replyDeadline.owesReplyUserId &&
    String(replyDeadline.owesReplyUserId) === String(user?.id)
  );
  const deadlineMs = replyDeadline?.deadlineAt ? new Date(replyDeadline.deadlineAt).getTime() : 0;
  const remainingMs = deadlineMs ? deadlineMs - deadlineNow : null;
  const replyWindowExpired =
    iOweReply && (Boolean(replyDeadline?.expired) || (remainingMs != null && remainingMs <= 0));

  useEffect(() => {
    if (!iOweReply || !replyDeadline?.deadlineAt) return;
    setDeadlineNow(Date.now());
    const id = setInterval(() => setDeadlineNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [iOweReply, replyDeadline?.deadlineAt]);

  useEffect(() => {
    if (!replyWindowExpired || view !== 'thread' || !selectedUserId || !user?.id) return;
    chatAPI
      .getConversation(selectedUserId, user.id)
      .then((data) => {
        if (data.unmatched) handleReplyDeadlineUnmatched(data.unmatchedReason);
      })
      .catch(() => {});
  }, [replyWindowExpired, view, selectedUserId, user?.id]);

  useEffect(() => {
    if (view !== 'list' || !user?.id) return;
    const id = setInterval(() => {
      chatAPI
        .getConversations(user.id)
        .then(({ conversations: list }) => setConversations(list))
        .catch(() => {});
    }, 45_000);
    return () => clearInterval(id);
  }, [view, user?.id]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !selectedUserId || !user?.id || replyWindowExpired || dateLock?.locked) return;
    setInputText('');
    await sendContent(text);
  };

  const startAudioRecording = async () => {
    if (replyWindowExpired) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => { sendContent(reader.result as string); };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingAudio(true);
    } catch (err: any) {
      setError(err?.message || 'Microphone access needed');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && recordingAudio) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setRecordingAudio(false);
    }
  };

  const startVideoRecording = async () => {
    if (replyWindowExpired) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const recorder = new MediaRecorder(stream);
      videoChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size) videoChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => { sendContent(reader.result as string); };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingVideo(true);
      setTimeout(() => {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current = null;
          setRecordingVideo(false);
        }
      }, 6000);
    } catch (err: any) {
      setError(err?.message || 'Camera access needed');
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && recordingVideo) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setRecordingVideo(false);
    }
  };

  const handleVideoCall = () => {
    if (!selectedUserId || !user?.id) return;
    const room = `aswp-${[user.id, selectedUserId].sort().join('-')}`;
    window.open(`https://meet.jit.si/${room}`, '_blank', 'width=800,height=600');
  };

  const handleStartNewChat = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    setSelectedForCompare(new Set());
    try {
      const { users } = await chatAPI.getAvailableUsers(user.id);
      setAvailableUsers(users);
      setView('new');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const openThreadWithUser = (u: User, skipFocusConfirm?: boolean) => {
    if (!skipFocusConfirm && u.id !== focus?.partnerUserId) {
      setShowFocusConfirm({ userId: u.id, name: u.name });
      return;
    }
    setShowFocusConfirm(null);
    setView('thread');
    setSelectedUserId(u.id);
    setSelectedName(u.name);
    setSelectedAvatar(u.profilePicture);
    setMessages([]);
    loadMessages(u.id, u.name, u.profilePicture);
  };

  const tryOpenChatFromList = async (c: Conversation) => {
    if (focus && focus.daysLeft > 0 && c.userId !== focus.partnerUserId) return;
    if (relationship?.status === 'active' && c.userId !== relationship.partnerUserId) {
      try {
        const w = await relationshipAPI.getCheatWarning(c.userId);
        if (w.shouldWarn) {
          setCheatWarning({
            userId: c.userId,
            name: c.name,
            profilePicture: c.profilePicture,
            title: w.title,
            body: w.body,
            risks: w.risks,
            selfControl: w.selfControl,
          });
          return;
        }
      } catch {
        /* open anyway if check fails */
      }
    }
    openThreadWithUser({ id: c.userId, name: c.name, username: '', profilePicture: c.profilePicture }, true);
  };

  const confirmStartFocus = async () => {
    if (!showFocusConfirm || !user?.id) return;
    setFocusLoading(true);
    setError('');
    try {
      const { focus: f } = await chatAPI.startFocus(showFocusConfirm.userId);
      setFocus(f);
      openThreadWithUser(
        { id: showFocusConfirm.userId, name: showFocusConfirm.name, username: '', profilePicture: null },
        true
      );
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to start focus');
    } finally {
      setFocusLoading(false);
      setShowFocusConfirm(null);
    }
  };

  const endFocusPeriod = async () => {
    if (!user?.id) return;
    setFocusLoading(true);
    try {
      await chatAPI.endFocus();
      setFocus(null);
    } catch (_) {}
    finally {
      setFocusLoading(false);
    }
  };

  const handleConfirmDating = async (yes: boolean) => {
    setShowDatingPrompt(false);
    if (!yes || !selectedUserId || !user?.id) return;
    setRelationshipLoading(true);
    try {
      const r = await relationshipAPI.confirmDating(selectedUserId);
      setRelationship(r.relationship);
      window.dispatchEvent(new Event('guide-program:updated'));
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to confirm');
    } finally {
      setRelationshipLoading(false);
    }
  };

  const handleConfirmEnd = async (yes: boolean) => {
    setShowEndPrompt(false);
    if (!yes || !selectedUserId || !user?.id) return;
    setBreakupModal({ kind: 'end' });
  };

  const submitBreakup = async (payload: { reason: string; reasonPrivate: boolean }) => {
    if (!selectedUserId || !user?.id) return;
    setRelationshipLoading(true);
    try {
      if (breakupModal?.kind === 'unmatch') {
        await chatAPI.unmatchUser(selectedUserId, payload);
        setBreakupModal(null);
        setMenuOpen(false);
        setSelectedUserId(null);
        setView('list');
        await loadConversations();
        const r = await relationshipAPI.getMyRelationship();
        setRelationship(r.relationship);
        return;
      }
      await relationshipAPI.confirmEnd(selectedUserId, payload);
      const r = await relationshipAPI.getMyRelationship();
      setRelationship(r.relationship);
      setBreakupModal(null);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to confirm end');
    } finally {
      setRelationshipLoading(false);
    }
  };

  const handleCheckInSubmit = async () => {
    if (!showCheckInModal?.relationshipId) return;
    try {
      const r = await relationshipAPI.submitCheckIn(
        showCheckInModal.relationshipId,
        checkInGoingWell ?? false,
        checkInGoingWell ? undefined : checkInProblem
      );
      setShowCheckInModal(null);
      setCheckInGoingWell(null);
      setCheckInProblem('');
      if (r.solutions?.length) setCheckInSolutions(r.solutions);
    } catch (_) {}
  };

  const handleStartConnectionJourney = async () => {
    if (!selectedUserId || !user?.id) return;
    setConnectionJourneyActionLoading(true);
    try {
      const r = await connectionJourneyAPI.startJourney(selectedUserId);
      setConnectionJourney(r);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to start journey');
    } finally {
      setConnectionJourneyActionLoading(false);
    }
  };

  const handleCompleteConnectionStep = async (stepId: string) => {
    if (!selectedUserId || !user?.id) return;
    setConnectionJourneyActionLoading(true);
    try {
      const r = await connectionJourneyAPI.completeStep(selectedUserId, stepId);
      setConnectionJourney(r);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to complete step');
    } finally {
      setConnectionJourneyActionLoading(false);
    }
  };

  const handleSuggestSolutions = async () => {
    if (!inputText.trim()) return;
    try {
      const r = await relationshipAPI.getSolutions(inputText);
      if (r.solutions?.length) setShowConflictSolutions(r.solutions);
    } catch (_) {}
  };

  const SAFETY_BOUNDARIES_MESSAGE = '⚠️ [Safety] I\'d prefer we stay in public and respect my boundaries. No intimate activity—please keep distance. Let\'s meet somewhere public with people around.';
  const allBoundariesChecked = boundariesChecklist.over18 && boundariesChecklist.withdraw && boundariesChecklist.publicPlace && boundariesChecklist.respect;

  const handleBoundariesContinue = () => {
    if (!allBoundariesChecked || boundariesConsent === null) return;
    setBoundariesDismissedForChat(selectedUserId ?? null);
    setShowBoundariesModal(false);
    setBoundariesConsent(null);
    setBoundariesChecklist({ over18: false, withdraw: false, publicPlace: false, respect: false });
    setShowMeetupPopup(true);
  };

  const handleBoundariesNoConsent = async () => {
    if (!selectedUserId || !user?.id) return;
    setBoundariesConsent(false);
    setBoundariesSending(true);
    try {
      await sendContent(SAFETY_BOUNDARIES_MESSAGE);
      setSuccess(`${selectedName} will see your boundaries. We suggest staying in public and adding an emergency contact below.`);
      setTimeout(() => setSuccess(''), 6000);
    } catch (_) {
      setError('Failed to send safety message');
    } finally {
      setBoundariesSending(false);
    }
    setBoundariesDismissedForChat(selectedUserId);
    setShowBoundariesModal(false);
    setBoundariesChecklist({ over18: false, withdraw: false, publicPlace: false, respect: false });
    setShowMeetupPopup(true);
  };

  const handleBoundariesYesConsent = () => {
    setBoundariesConsent(true);
  };

  const toggleCompare = (userId: string) => {
    setSelectedForCompare((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else if (next.size < 2) next.add(userId);
      return next;
    });
  };

  const resolveUser = (userId: string): User | null => {
    const conv = conversations.find((c) => c.userId === userId);
    if (conv) return { id: conv.userId, name: conv.name, username: '', profilePicture: conv.profilePicture };
    const avail = availableUsers.find((u) => u.id === userId);
    return avail || null;
  };

  const defaultAttrs = (): ReviewAttributes => ({
    personality: 5, fashion: 5, cooking: 5, communication: 5, angerManagement: 5, dancing: 5,
    humor: 5, kindness: 5, listening: 5, romance: 5, reliability: 5, conflictResolution: 5,
    decisionMaking: 5, relationshipHandling: 5, stressHandling: 5, protection: 5, goodInBed: 5,
  });

  const runCompare = async () => {
    const arr = Array.from(selectedForCompare);
    if (arr.length !== 2 || !user?.id) return;
    setCompareLoading(true);
    setError('');
    try {
      const users = arr.map((id) => resolveUser(id)).filter(Boolean) as User[];
      if (users.length !== arr.length) {
        setError('Could not find both users. Try again.');
        return;
      }
      const attrsList = await Promise.all(
        arr.map((id) =>
          reviewsAPI.getAttributes(id).then((r) => r.attributes).catch(() => defaultAttrs())
        )
      );
      setCompareData(users.map((u, i) => ({ user: u, attrs: attrsList[i] || defaultAttrs() })));
      setCompareFromView(view === 'new' ? 'new' : 'list');
      setView('compare');
    } catch (e: any) {
      setError(e?.message || e?.response?.data?.error || 'Failed to load compare');
    } finally {
      setCompareLoading(false);
    }
  };

  const handleEndChatAndRate = () => {
    setMenuOpen(false);
    setReviewModalSource('manual');
    setPendingUnmatchAfterReview(false);
    setShowReviewModal(true);
  };

  const handleReviewModalComplete = async () => {
    if (pendingUnmatchAfterReview) {
      await performUnmatch();
    } else {
      setShowReviewModal(false);
    }
  };

  const handleReviewModalClose = async () => {
    if (pendingUnmatchAfterReview) {
      await performUnmatch();
    } else {
      setShowReviewModal(false);
    }
  };

  const handleStartSpeedDate = async () => {
    if (!selectedUserId || !user?.id) return;
    setMenuOpen(false);
    setError('');
    try {
      const { speedDate: sd } = await speedDateAPI.start(selectedUserId);
      setSpeedDate(sd);
      const partner = conversations.find((c) => c.userId === selectedUserId);
      setSpeedDatePartner(partner ? { id: partner.userId, name: partner.name, profilePicture: partner.profilePicture } : null);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to start speed date');
    }
  };

  const handleContinueAnswer = async (continueTalking: boolean) => {
    if (!speedDate?.id) return;
    try {
      const result = await speedDateAPI.answerContinue(speedDate.id, continueTalking);
      setSpeedDate(result.speedDate);
      setContinueAnswered(true);
      if (result.upliftingMessage) setUpliftingMessage(result.upliftingMessage);
      else if (continueTalking && result.otherAnswered && result.otherWantsContinue === false) {
        setUpliftingMessage("They chose not to continue. It's okay — there's always next time.");
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed');
    }
  };

  const handleBlock = async () => {
    if (!selectedUserId) return;
    try {
      await chatAPI.blockUser(selectedUserId);
      setMenuOpen(false);
      setSelectedUserId(null);
      setView('list');
      await loadConversations();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to block');
    }
  };

  const handleMute = async () => {
    if (!selectedUserId) return;
    try {
      await chatAPI.muteUser(selectedUserId);
      setMenuOpen(false);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to mute');
    }
  };

  const performUnmatch = async () => {
    if (!selectedUserId) return;
    try {
      await chatAPI.unmatchUser(selectedUserId);
      setMenuOpen(false);
      setSelectedUserId(null);
      setView('list');
      await loadConversations();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to unmatch');
    } finally {
      setPendingUnmatchAfterReview(false);
      setShowReviewModal(false);
    }
  };

  const handleUnmatch = () => {
    if (!selectedUserId) return;
    setMenuOpen(false);
    if (relationship?.status === 'active' && selectedUserId === relationship.partnerUserId) {
      setBreakupModal({ kind: 'unmatch' });
      return;
    }
    setReviewModalSource('unmatch');
    setPendingUnmatchAfterReview(true);
    setShowReviewModal(true);
  };

  const handleOpenProfile = () => {
    if (!selectedUserId) return;
    if (selectedUserId === user?.id) {
      navigate('/profile');
      return;
    }
    navigate(`/profile/${selectedUserId}`, {
      state: { fromChat: true, chatUserId: selectedUserId },
    });
  };

  const handleSearchFriends = () => {
    setView('search');
    setSearchQuery('');
    setSearchResults([]);
  };

  useEffect(() => {
    if (!user?.id || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { users } = await chatAPI.searchUsers(user.id, searchQuery);
        setSearchResults(users);
      } catch (_) {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery, user?.id]);

  const handleMeetupSubmit = async () => {
    if (!user?.id || !selectedUserId) return;
    if (!meetAt.trim() || !meetupLocation.trim() || !expectedBackAt.trim()) {
      setError('Please fill meet-up time, location, and expected back time.');
      return;
    }
    if (emergencyType === 'app' && !emergencyContactUserId) {
      setError('Please select an app user as emergency contact.');
      return;
    }
    if (emergencyType === 'phone' && !emergencyContactId && (!emergencyName.trim() || !emergencyPhone.trim())) {
      setError('Please enter emergency contact name and phone, or select a saved contact.');
      return;
    }
    if (!idVerificationConsent) {
      setError('You must consent to ID verification for safety before meeting.');
      return;
    }
    if (!idFrontImage || !idBackImage) {
      setError('Hold your ID to the camera and scan front and back before meeting.');
      return;
    }
    if (!trackingConsent) {
      setError('You must consent to safety tracking during the date (only while active).');
      return;
    }
    if (!agreedVenueName.trim()) {
      setError('You and your match must agree on a public date spot below first.');
      return;
    }
    setMeetupSubmitting(true);
    setError('');
    try {
      await askWhatYouAreWearing();
      let contactId: string | null = emergencyType === 'phone' ? emergencyContactId : null;
      if (emergencyType === 'phone' && !contactId) {
        const { contact } = await safetyAPI.addEmergencyContact({ name: emergencyName, phone: emergencyPhone });
        contactId = contact.id;
      }
      await safetyAPI.createMeetupPlan({
        meetAt: new Date(meetAt).toISOString(),
        location: meetupLocation || agreedVenueName,
        expectedBackAt: new Date(expectedBackAt).toISOString(),
        emergencyContactUserId: emergencyType === 'app' ? emergencyContactUserId || undefined : undefined,
        emergencyContactId: contactId || undefined,
        chatPartnerUserId: selectedUserId,
        idVerificationConsent: true,
        trackingConsent: true,
        idFrontImage,
        idBackImage,
        agreedVenueName,
      });
      setShowMeetupPopup(false);
      setMeetupDismissedForChat(selectedUserId);
      setMeetAt('');
      setMeetupLocation('');
      setExpectedBackAt('');
      setEmergencyContactUserId(null);
      setEmergencyContactId(null);
      setEmergencyName('');
      setEmergencyPhone('');
      setIdFrontImage(null);
      setIdBackImage(null);
      setIdVerificationConsent(false);
      setTrackingConsent(false);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save plan');
    } finally {
      setMeetupSubmitting(false);
    }
  };

  useEffect(() => {
    if (!emergencySearchQuery.trim() || !user?.id) {
      setEmergencySearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { users } = await chatAPI.searchUsers(user.id, emergencySearchQuery);
        setEmergencySearchResults(users);
      } catch (_) {
        setEmergencySearchResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [emergencySearchQuery, user?.id]);

  return (
    <div className="widget communication-widget chat-widget">
      {showCommsTutorial && <CommunicationsTutorial onDone={() => setShowCommsTutorial(false)} />}
      <div className="comm-header chat-header">
        <div className="comm-title">Communication</div>
        {view === 'thread' && selectedName && (
          <div className="chat-header-right">
            <div className="chat-header-avatar-wrap" onClick={handleOpenProfile} title="View profile" role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleOpenProfile()}>
              <div className="chat-header-avatar">
                {selectedAvatar ? <img src={selectedAvatar} alt="" /> : <span>{selectedName[0]}</span>}
              </div>
            </div>
            <button type="button" className="chat-header-name-link" onClick={handleOpenProfile} title="View profile">
              {selectedName}
            </button>
            <div className="chat-intent-pills" title="How you organize this chat">
              {(['serious', 'casual', 'friends'] as ChatIntent[]).map((intent) => (
                <button
                  key={intent}
                  type="button"
                  className={`chat-intent-pill ${conversations.find((c) => c.userId === selectedUserId)?.intent === intent ? 'on' : ''}`}
                  onClick={() => selectedUserId && setConversationIntent(selectedUserId, intent)}
                >
                  {INTENT_LABEL[intent]}
                </button>
              ))}
            </div>
            {disinterestReport && disinterestReport.score >= disinterestReport.threshold && (
              <button
                type="button"
                className="chat-menu-btn"
                title="Hey, watch out — open analyzer"
                onClick={() => setDisinterestOpen(true)}
              >
                🛡
              </button>
            )}
            <button
              type="button"
              className="chat-menu-btn"
              onClick={() => setMenuOpen(!menuOpen)}
              title="Options"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="chat-dropdown">
                {relationship?.status === 'active' && selectedUserId === relationship.partnerUserId && (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        setMenuOpen(false);
                        const next = !showVoiceGuardPanel;
                        setShowVoiceGuardPanel(next);
                        if (next) {
                          await voiceRecordingAPI.toggleGuard(selectedUserId, true).catch(() => {});
                        } else {
                          await voiceRecordingAPI.toggleGuard(selectedUserId, false).catch(() => {});
                        }
                      }}
                    >
                      {showVoiceGuardPanel ? 'Disable gathering voice guard' : 'Enable gathering voice guard'}
                    </button>
                    <button type="button" onClick={() => { setMenuOpen(false); setShowEndPrompt(true); }}>We&apos;re no longer dating</button>
                  </>
                )}
                <button type="button" onClick={handleEndChatAndRate}>End chat &amp; Rate</button>
                <button type="button" onClick={handleStartSpeedDate}>Start speed date (5 days)</button>
                <button type="button" onClick={handleMute}>Mute</button>
                <button type="button" onClick={handleUnmatch}>Unmatch</button>
                <button type="button" onClick={handleBlock} className="chat-dropdown-danger">Block</button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="chat-error">{error}</div>
      )}

      {showDatingPrompt && selectedUserId && (
        <div className="chat-focus-confirm-overlay">
          <div className="chat-focus-confirm-modal">
            <h3>Are you two dating?</h3>
            <p>It sounds like you and <strong>{selectedName}</strong> might be in a relationship. When you both confirm, you&apos;ll get a dedicated Relationship space and the app will help you with tips and check-ins.</p>
            <div className="chat-focus-confirm-actions">
              <button type="button" className="chat-back-btn" onClick={() => setShowDatingPrompt(false)}>Not really</button>
              <button type="button" className="chat-compare-fifa-btn" onClick={() => handleConfirmDating(true)} disabled={relationshipLoading}>
                {relationshipLoading ? 'Confirming…' : 'Yes, we&apos;re dating'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isPendingPartnerThread && selectedName && (
        <div className="chat-focus-confirm-overlay">
          <div className="chat-focus-confirm-modal">
            <h3>Your partner said you&apos;re dating</h3>
            <p><strong>{selectedName}</strong> confirmed you&apos;re in a relationship. Do you agree? When you both confirm, you&apos;ll get Relationship space and daily tips.</p>
            <div className="chat-focus-confirm-actions">
              <button type="button" className="chat-back-btn" onClick={() => setRelationship(null)}>No</button>
              <button type="button" className="chat-compare-fifa-btn" onClick={() => handleConfirmDating(true)} disabled={relationshipLoading}>
                {relationshipLoading ? 'Confirming…' : 'Yes, we&apos;re dating'}
              </button>
            </div>
          </div>
        </div>
      )}

      {breakupModal && (
        <BreakupReasonModal
          title={breakupModal.kind === 'unmatch' ? 'Unmatch — why are you leaving?' : 'Why are you breaking up?'}
          loading={relationshipLoading}
          onCancel={() => setBreakupModal(null)}
          onSubmit={submitBreakup}
        />
      )}

      {showEndPrompt && selectedUserId && (
        <div className="chat-focus-confirm-overlay">
          <div className="chat-focus-confirm-modal">
            <h3>No longer dating?</h3>
            <p>It sounds like you and <strong>{selectedName}</strong> may have ended the relationship. When you both confirm, the Relationship space will end and other chats will no longer be blurred.</p>
            <div className="chat-focus-confirm-actions">
              <button type="button" className="chat-back-btn" onClick={() => setShowEndPrompt(false)}>No, still together</button>
              <button type="button" className="chat-compare-fifa-btn" onClick={() => handleConfirmEnd(true)} disabled={relationshipLoading}>
                {relationshipLoading ? 'Confirming…' : 'Yes, we&apos;re no longer dating'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFocusConfirm && (
        <div className="chat-focus-confirm-overlay">
          <div className="chat-focus-confirm-modal">
            <h3>Start 5-day focus?</h3>
            <p>You&apos;ll chat only with <strong>{showFocusConfirm.name}</strong> for 5 days. Other chats will be blurred for you, and you&apos;ll be blurred for them until the period ends.</p>
            <div className="chat-focus-confirm-actions">
              <button type="button" className="chat-back-btn" onClick={() => setShowFocusConfirm(null)}>Cancel</button>
              <button type="button" className="chat-compare-fifa-btn" onClick={confirmStartFocus} disabled={focusLoading}>
                {focusLoading ? 'Starting…' : 'Start 5-day chat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cheatWarning && (
        <div className="chat-meetup-overlay" onClick={() => setCheatWarning(null)}>
          <div className="chat-meetup-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3>{cheatWarning.title || 'You are in a relationship'}</h3>
            <p style={{ fontSize: 13 }}>{cheatWarning.body}</p>
            <ul style={{ fontSize: 12, paddingLeft: 18, margin: '12px 0' }}>
              {(cheatWarning.risks || []).map((r, i) => (
                <li key={i} style={{ marginBottom: 6 }}>{r}</li>
              ))}
            </ul>
            {cheatWarning.selfControl && (
              <p style={{ fontSize: 12, color: '#fbbf24', marginBottom: 12 }}>🛡️ {cheatWarning.selfControl}</p>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="chat-compare-fifa-btn" onClick={() => setCheatWarning(null)}>
                Stay faithful — go back
              </button>
              <button
                type="button"
                className="chat-back-btn"
                onClick={() => {
                  const u = { id: cheatWarning.userId, name: cheatWarning.name, username: '', profilePicture: cheatWarning.profilePicture };
                  setCheatWarning(null);
                  openThreadWithUser(u, true);
                }}
              >
                I understand the risk — open anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {ndaModal && (
        <div className="chat-focus-confirm-overlay">
          <div className="chat-focus-confirm-modal" style={{ maxWidth: 480 }}>
            <h3>Confidentiality agreement (NDA)</h3>
            <p>You are about to chat with <strong>a verified public figure</strong>. You must sign below to continue. You agree to keep their identity and your conversations confidential. You may be sued and required to pay damages if you expose that you are talking to this person or share any chats.</p>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13, maxHeight: 120, overflowY: 'auto' }}>
              {ndaModal.agreementText}
            </div>
            <label style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
              Type your full legal name to sign (you are eligible to be held legally responsible):
              <input type="text" value={ndaSignature} onChange={(e) => setNdaSignature(e.target.value)} placeholder="Full name" className="profile-input" style={{ width: '100%', marginTop: 6 }} />
            </label>
            <div className="chat-focus-confirm-actions">
              <button type="button" className="chat-back-btn" onClick={() => { setNdaModal(null); setNdaSignature(''); onOpenedWithUserId?.(); }}>Cancel</button>
              <button type="button" className="chat-compare-fifa-btn" onClick={handleNDASign} disabled={ndaSigning || !ndaSignature.trim()}>
                {ndaSigning ? 'Signing…' : 'I agree — Sign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCheckInModal && (
        <div className="chat-focus-confirm-overlay">
          <div className="chat-focus-confirm-modal" style={{ maxWidth: 420 }}>
            <h3>How&apos;s the relationship going?</h3>
            <p>Quick check-in: is everything going well with you two?</p>
            {checkInGoingWell === null ? (
              <div className="chat-focus-confirm-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
                <button type="button" className="chat-compare-fifa-btn" onClick={() => setCheckInGoingWell(true)}>Yes, all good</button>
                <button type="button" className="chat-back-btn" onClick={() => setCheckInGoingWell(false)}>Not really</button>
              </div>
            ) : checkInGoingWell ? (
              <div className="chat-focus-confirm-actions">
                <button type="button" className="chat-compare-fifa-btn" onClick={handleCheckInSubmit}>Done</button>
              </div>
            ) : (
              <>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>What&apos;s going on? (optional – we&apos;ll suggest proven solutions)</label>
                <textarea
                  className="chat-input"
                  value={checkInProblem}
                  onChange={(e) => setCheckInProblem(e.target.value)}
                  placeholder="e.g. communication, arguing, trust..."
                  rows={3}
                  style={{ width: '100%', marginBottom: 12, resize: 'vertical' }}
                />
                <div className="chat-focus-confirm-actions">
                  <button type="button" className="chat-back-btn" onClick={() => { setShowCheckInModal(null); setCheckInGoingWell(null); setCheckInProblem(''); }}>Skip</button>
                  <button type="button" className="chat-compare-fifa-btn" onClick={handleCheckInSubmit}>Submit &amp; get suggestions</button>
                </div>
              </>
            )}
            {checkInSolutions.length > 0 && (
              <div style={{ marginTop: 16, padding: 12, background: 'rgba(0,212,255,0.1)', borderRadius: 8, textAlign: 'left' }}>
                <strong style={{ color: '#00d4ff' }}>Proven relationship solutions:</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13 }}>
                  {checkInSolutions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
                <button type="button" className="chat-back-btn" style={{ marginTop: 12 }} onClick={() => { setCheckInSolutions([]); setShowCheckInModal(null); setCheckInGoingWell(null); setCheckInProblem(''); }}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {checkInPlan && (
        <div className="chat-checkin-reminder">
          <strong>Time to check in with your emergency contact!</strong>
          <p>Report that you&apos;re okay.</p>
          <div className="chat-checkin-actions">
            {checkInPlan.emergencyContactUserId && (
              <button
                type="button"
                className="chat-checkin-btn"
                onClick={() => {
                  setCheckInPlan(null);
                  openThreadWithUser({
                    id: checkInPlan.emergencyContactUserId!,
                    name: checkInPlan.emergencyContactAppName || 'Contact',
                    username: '',
                    profilePicture: null,
                  });
                }}
              >
                Open chat with {checkInPlan.emergencyContactAppName || 'contact'}
              </button>
            )}
            {checkInPlan.emergencyContactPhone && (
              <a
                href={`tel:${checkInPlan.emergencyContactPhone}`}
                className="chat-checkin-btn chat-checkin-call"
              >
                Call {checkInPlan.emergencyContactName || 'contact'}
              </a>
            )}
            <button
              type="button"
              className="chat-checkin-btn"
              onClick={async () => {
                try {
                  await safetyAPI.endDateSession(checkInPlan.id);
                  setCheckInPlan(null);
                } catch {
                  setError('Could not confirm you arrived home. Try again.');
                }
              }}
            >
              I arrived home safe — delete my ID scan
            </button>
            <button type="button" className="chat-checkin-dismiss" onClick={() => setCheckInPlan(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {view === 'list' && (
        <div className="chat-list-wrap" ref={listRef}>
          {relationship?.status === 'active' && (
            <div className="chat-focus-banner chat-relationship-banner">
              <span className="chat-focus-text">In a relationship with {relationship.partnerName ?? 'partner'}. Other chats below are blurred until you both confirm you&apos;re no longer dating.</span>
            </div>
          )}
          <div className="chat-reply-policy-banner">
            <span>
              Reply within <strong>24 hours</strong> to every message you receive after a match or mutual interest — or the match ends. Same rule for all ongoing chats.
            </span>
          </div>
          {focus && (
            <div className="chat-focus-banner">
              <span className="chat-focus-text">
                {focus.daysLeft > 0
                  ? `Focus: ${focus.daysLeft} day${focus.daysLeft === 1 ? '' : 's'} left with ${focus.partnerName ?? 'partner'}`
                  : 'Focus ended'}
              </span>
              {focus.daysLeft === 0 && (
                <button type="button" className="chat-focus-end-btn" onClick={endFocusPeriod} disabled={focusLoading}>
                  Unlock & chat with others
                </button>
              )}
            </div>
          )}
          <div className="chat-intent-lanes" role="tablist" aria-label="Organize chats">
            {CHAT_LANES.map((lane) => {
              const count =
                lane.id === 'all'
                  ? conversations.length
                  : conversations.filter((c) => c.intent === lane.id).length;
              return (
                <button
                  key={lane.id}
                  type="button"
                  role="tab"
                  aria-selected={chatLane === lane.id}
                  className={`chat-intent-lane ${chatLane === lane.id ? 'on' : ''}`}
                  onClick={() => setChatLane(lane.id)}
                >
                  {lane.label}
                  <span className="chat-intent-count">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="chat-select-header">
            <span className="chat-select-title">Select 2 people to compare, then choose who to chat with</span>
            <div className="chat-list-actions">
              <button type="button" className="chat-new-btn" onClick={handleStartNewChat} disabled={loading}>
                + New chat
              </button>
              <button type="button" className="chat-search-friends-btn" onClick={handleSearchFriends}>
                Search friends
              </button>
              {selectedForCompare.size === 2 ? (
                <button type="button" className="chat-compare-btn chat-compare-btn-primary" onClick={runCompare} disabled={compareLoading}>
                  {compareLoading ? 'Loading…' : 'Compare (show attributes)'}
                </button>
              ) : (
                <span className="chat-compare-hint">Select 2 people below to enable Compare</span>
              )}
            </div>
          </div>
          {loading && conversations.length === 0 ? (
            <div className="chat-loading">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="chat-empty chat-empty-cta">
              <p>No conversations yet.</p>
              <p><strong>Click &quot;+ New chat&quot;</strong> above to see people. Select 2, then click <strong>Compare</strong> to see their attributes and choose who to chat with.</p>
            </div>
          ) : conversations.filter((c) => chatLane === 'all' || c.intent === chatLane).length === 0 &&
            !(chatLane === 'all' || chatLane === 'serious') ? (
            <div className="chat-empty">
              No chats in {INTENT_LABEL[chatLane]}. Open a conversation and tap Serious, Casual, or Friends under their name.
            </div>
          ) : (
            <div className="chat-list">
              {relationship?.status === 'active' && relationship.partnerUserId && (chatLane === 'all' || chatLane === 'serious') && (() => {
                const partnerConv = conversations.find((c) => c.userId === relationship.partnerUserId);
                const name = partnerConv?.name ?? relationship.partnerName ?? 'Partner';
                const avatar = partnerConv?.profilePicture ?? relationship.partnerProfilePicture ?? null;
                return (
                  <div key={`rel-${relationship.partnerUserId}`} className="chat-list-row chat-list-row-relationship">
                    <input type="checkbox" className="chat-compare-check" disabled title="Relationship" />
                    <button
                      type="button"
                      className="chat-list-item chat-list-item-flex"
                      onClick={() => openThreadWithUser({ id: relationship.partnerUserId, name, username: '', profilePicture: avatar }, true)}
                    >
                      <div className="chat-list-avatar">
                        {avatar ? <img src={avatar} alt="" /> : <span>{name[0]}</span>}
                        {partnerConv && partnerConv.unreadCount > 0 && <span className="chat-unread">{partnerConv.unreadCount}</span>}
                        <span className="chat-list-badge-relationship" title="In a relationship">💑</span>
                      </div>
                      <div className="chat-list-body">
                        <span className="chat-list-name">{name} — Relationship</span>
                        <span className="chat-list-preview">
                          {partnerConv
                            ? (partnerConv.lastMessage.fromUserId === user?.id ? 'You: ' : '') +
                              (partnerConv.lastMessage.content.startsWith('data:') ? '📷 Media' : partnerConv.lastMessage.content.slice(0, 40)) +
                              (partnerConv.lastMessage.content.length > 40 ? '…' : '')
                            : 'Your relationship space — tap to chat'}
                        </span>
                      </div>
                      <span className="chat-list-time">{partnerConv ? formatMessageTime(partnerConv.lastMessage.createdAt) : ''}</span>
                    </button>
                  </div>
                );
              })()}
              {conversations
                .filter((c) => !(relationship?.status === 'active' && c.userId === relationship.partnerUserId))
                .filter((c) => chatLane === 'all' || c.intent === chatLane)
                .map((c) => {
                const isBlurredFocus = focus && focus.daysLeft > 0 && c.userId !== focus.partnerUserId;
                const isBlurredRelationship =
                  relationship?.status === 'active' &&
                  !relationship.userConfirmedEnd &&
                  c.userId !== relationship.partnerUserId &&
                  !c.rouletteChat &&
                  !c.rouletteOwner;
                const isBlurred = isBlurredFocus || isBlurredRelationship;
                return (
                <div
                  key={c.userId}
                  className={`chat-list-row ${isBlurred ? 'chat-list-row-blurred' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedForCompare.has(c.userId)}
                    onChange={() => toggleCompare(c.userId)}
                    className="chat-compare-check"
                    title="Select 2 to compare"
                    disabled={!!(focus && focus.daysLeft > 0)}
                  />
                  <button
                    type="button"
                    className="chat-list-item chat-list-item-flex"
                    onClick={() => {
                      if (focus && focus.daysLeft > 0 && c.userId === focus.partnerUserId) {
                        openThreadWithUser({ id: c.userId, name: c.name, username: '', profilePicture: c.profilePicture }, true);
                      } else if (focus && focus.daysLeft > 0) {
                        return;
                      } else {
                        tryOpenChatFromList(c);
                      }
                    }}
                  >
                    <div className="chat-list-avatar">
                      {c.profilePicture ? <img src={c.profilePicture} alt="" /> : <span>{c.name[0]}</span>}
                      {c.unreadCount > 0 && <span className="chat-unread">{c.unreadCount}</span>}
                    </div>
                    <div className="chat-list-body">
                      <span className="chat-list-name">
                        {c.name}
                        {(c.rouletteChat || c.rouletteOwner) && (
                          <span className="chat-intent-badge">🎰 Roulette</span>
                        )}
                        {c.intent && <span className="chat-intent-badge">{INTENT_LABEL[c.intent]}</span>}
                        {c.replyDeadline?.active &&
                          c.replyDeadline.owesReplyUserId === user?.id &&
                          !c.replyDeadline.expired && (
                            <span className="chat-reply-urgent-badge">Reply · {c.replyDeadline.hoursRemaining}h{c.replyDeadline.minutesRemaining != null ? ` ${c.replyDeadline.minutesRemaining}m` : ''}</span>
                          )}
                      </span>
                    <span className="chat-list-preview">
                      {c.lastMessage.fromUserId === user?.id ? 'You: ' : ''}
                      {previewChatContent(c.lastMessage.content)}
                    </span>
                    </div>
                    <span className="chat-list-time">{formatMessageTime(c.lastMessage.createdAt)}</span>
                  </button>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === 'compare' && compareData && compareData.length === 2 && (() => {
        const RADAR_KEYS: (keyof ReviewAttributes)[] = ['personality', 'communication', 'humor', 'romance', 'fashion', 'cooking'];
        const ALL_ATTR_KEYS = (Object.keys(REVIEW_ATTRIBUTE_LABELS) as (keyof ReviewAttributes)[]);
        const getVal = (attrs: ReviewAttributes, key: keyof ReviewAttributes) => Math.max(0, Math.min(10, (attrs as unknown as Record<string, number>)[key] ?? 5));
        const overall = (attrs: ReviewAttributes) => {
          const keys = ALL_ATTR_KEYS;
          if (!keys.length) return 0;
          const sum = keys.reduce((s, k) => s + getVal(attrs, k), 0);
          return Math.round((sum / keys.length) * 10) / 10;
        };
        const [a, b] = compareData;
        return (
        <div className="chat-compare-wrap chat-compare-fifa">
          <button type="button" className="chat-back-btn" onClick={() => { setView(compareFromView); setCompareData(null); }}>← Back</button>
          <h2 className="chat-compare-title">CONNECTION COMPARISON</h2>
          <div className="chat-compare-fifa-grid">
            <div className="chat-compare-fifa-card">
              <div className="chat-compare-fifa-avatar">
                {a.user.profilePicture ? <img src={a.user.profilePicture} alt="" /> : <span>{a.user.name[0]}</span>}
              </div>
              <div className="chat-compare-fifa-name">{a.user.name}</div>
              <div className="chat-compare-fifa-rating">{overall(a.attrs)}</div>
              <div className="chat-compare-fifa-radar-wrap">
                <svg viewBox="0 0 200 200" className="chat-compare-radar">
                  {RADAR_KEYS.map((key, i) => {
                    const angle = (i / RADAR_KEYS.length) * 2 * Math.PI - Math.PI / 2;
                    const r1 = 80 * (getVal(a.attrs, key) / 10);
                    const r2 = 80 * (getVal(b.attrs, key) / 10);
                    const x1 = 100 + r1 * Math.cos(angle);
                    const y1 = 100 + r1 * Math.sin(angle);
                    const x2 = 100 + 80 * Math.cos(angle);
                    const y2 = 100 + 80 * Math.sin(angle);
                    return (
                      <g key={key}>
                        <line x1="100" y1="100" x2={x2} y2={y2} className="chat-radar-axis" />
                        <text x={100 + 95 * Math.cos(angle)} y={100 + 95 * Math.sin(angle)} className="chat-radar-label">{REVIEW_ATTRIBUTE_LABELS[key] || key}</text>
                      </g>
                    );
                  })}
                  <polygon
                    points={RADAR_KEYS.map((key, i) => {
                      const angle = (i / RADAR_KEYS.length) * 2 * Math.PI - Math.PI / 2;
                      const r = 80 * (getVal(a.attrs, key) / 10);
                      return `${100 + r * Math.cos(angle)},${100 + r * Math.sin(angle)}`;
                    }).join(' ')}
                    className="chat-radar-fill chat-radar-fill-a"
                  />
                  <polygon
                    points={RADAR_KEYS.map((key, i) => {
                      const angle = (i / RADAR_KEYS.length) * 2 * Math.PI - Math.PI / 2;
                      const r = 80 * (getVal(b.attrs, key) / 10);
                      return `${100 + r * Math.cos(angle)},${100 + r * Math.sin(angle)}`;
                    }).join(' ')}
                    className="chat-radar-fill chat-radar-fill-b"
                  />
                </svg>
              </div>
            </div>
            <div className="chat-compare-fifa-vs">VS</div>
            <div className="chat-compare-fifa-card">
              <div className="chat-compare-fifa-avatar">
                {b.user.profilePicture ? <img src={b.user.profilePicture} alt="" /> : <span>{b.user.name[0]}</span>}
              </div>
              <div className="chat-compare-fifa-name">{b.user.name}</div>
              <div className="chat-compare-fifa-rating">{overall(b.attrs)}</div>
            </div>
          </div>
          <div className="chat-compare-fifa-table">
            {ALL_ATTR_KEYS.map((key) => (
              <div key={key} className="chat-compare-fifa-row">
                <div className="chat-compare-fifa-cell chat-compare-fifa-left">
                  <span className="chat-compare-fifa-val">{getVal(a.attrs, key)}</span>
                  <div className="chat-compare-fifa-bar"><div className="chat-compare-fifa-fill" style={{ width: `${(getVal(a.attrs, key) / 10) * 100}%` }} /></div>
                </div>
                <div className="chat-compare-fifa-label">{REVIEW_ATTRIBUTE_LABELS[key] || key}</div>
                <div className="chat-compare-fifa-cell chat-compare-fifa-right">
                  <div className="chat-compare-fifa-bar"><div className="chat-compare-fifa-fill chat-compare-fifa-fill-b" style={{ width: `${(getVal(b.attrs, key) / 10) * 100}%` }} /></div>
                  <span className="chat-compare-fifa-val">{getVal(b.attrs, key)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="chat-compare-fifa-actions">
            <button type="button" className="chat-compare-fifa-btn" onClick={() => openThreadWithUser(a.user)}>Start 5-day chat with {a.user.name}</button>
            <button type="button" className="chat-compare-fifa-btn" onClick={() => openThreadWithUser(b.user)}>Start 5-day chat with {b.user.name}</button>
          </div>
        </div>
        );
      })()}

      {view === 'search' && (
        <div className="chat-list-wrap">
          <button type="button" className="chat-back-btn" onClick={() => setView('list')}>← Back</button>
          <p className="chat-search-label">Search by username. Then go back and select 2 people to compare.</p>
          <input
            type="text"
            className="chat-input chat-search-input"
            placeholder="Enter username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searching && <div className="chat-loading">Searching...</div>}
          <div className="chat-list">
            {searchResults.map((u) => (
              <button key={u.id} type="button" className="chat-list-item" onClick={() => setView('list')}>
                <div className="chat-list-avatar">
                  {u.profilePicture ? <img src={u.profilePicture} alt="" /> : <span>{u.name[0]}</span>}
                </div>
                <div className="chat-list-body">
                  <span className="chat-list-name">{u.name}</span>
                  <span className="chat-list-preview">@{u.username} — go to list, select 2, then Compare</span>
                </div>
              </button>
            ))}
          </div>
          {!searching && searchQuery.trim() && searchResults.length === 0 && (
            <div className="chat-empty">No users found for &quot;{searchQuery}&quot;</div>
          )}
        </div>
      )}

      {view === 'new' && (
        <div className="chat-list-wrap">
          <div className="chat-select-header">
            <span className="chat-select-title">Select 2 to compare, then choose who to chat with</span>
            <div className="chat-list-actions">
              {selectedForCompare.size === 2 ? (
                <button type="button" className="chat-compare-btn chat-compare-btn-primary" onClick={runCompare} disabled={compareLoading}>
                  {compareLoading ? 'Loading…' : 'Compare (show attributes)'}
                </button>
              ) : (
                <span className="chat-compare-hint">Select 2 people below to enable Compare</span>
              )}
              <button type="button" className="chat-back-btn" onClick={() => setView('list')}>← Back</button>
            </div>
          </div>
          {loading && availableUsers.length === 0 ? (
            <div className="chat-loading">Loading...</div>
          ) : availableUsers.length === 0 ? (
            <div className="chat-empty">No users available. Try &quot;Search friends&quot; by username.</div>
          ) : (
            <div className="chat-list">
              {availableUsers.map((u) => (
                <div key={u.id} className="chat-list-row">
                  <input
                    type="checkbox"
                    checked={selectedForCompare.has(u.id)}
                    onChange={() => toggleCompare(u.id)}
                    className="chat-compare-check"
                    title="Select 2 to compare"
                  />
                  <button type="button" className="chat-list-item chat-list-item-flex" onClick={() => toggleCompare(u.id)}>
                    <div className="chat-list-avatar">
                      {u.profilePicture ? <img src={u.profilePicture} alt="" /> : <span>{u.name[0]}</span>}
                    </div>
                    <div className="chat-list-body">
                      <span className="chat-list-name">{u.name}</span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'thread' && (
        <>
          {(rouletteChat || rouletteHold || rouletteOwner) && (
            <div
              className="chat-focus-banner"
              style={{ background: 'rgba(220,38,38,0.16)', border: '1px solid rgba(248,113,113,0.45)', marginBottom: 8, padding: '10px 12px', borderRadius: 8 }}
            >
              <strong>🎰 Russian roulette — moving on</strong>
              <p style={{ fontSize: 12, margin: '6px 0' }}>
                {rouletteOwner
                  ? 'These chats are lucky people from your Single Again post, here to help you move on.'
                  : rouletteHealNote
                    ? `They asked for time to heal. They said: “${rouletteHealNote}”`
                    : 'You were one of 7 lucky people sent to help them move on.'}
              </p>
              {rouletteOwner && roulettePostId && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {!rouletteHold ? (
                    <>
                      <input
                        value={healDraft}
                        onChange={(e) => setHealDraft(e.target.value)}
                        placeholder="I need time to heal. I might text around…"
                        style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
                      />
                      <button
                        type="button"
                        className="chat-back-btn"
                        onClick={async () => {
                          await singleAgainAPI.setHealHold(roulettePostId, healDraft);
                          setRouletteHold(true);
                          setRouletteHealNote(healDraft || 'I need some time to heal.');
                        }}
                      >
                        I need time to heal — put them on hold
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="chat-compare-fifa-btn"
                      onClick={async () => {
                        await singleAgainAPI.setReady(roulettePostId);
                        setRouletteHold(false);
                        setRouletteHealNote(null);
                      }}
                    >
                      I&apos;m ready — they can chat
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {dateLock?.locked && (
            <div
              className="chat-reply-deadline-banner"
              style={{ borderColor: 'rgba(250,204,21,0.5)', background: 'rgba(250,204,21,0.12)' }}
            >
              <span>{dateLock.reason || 'Chat unlocks on the day of your Date Arena date.'}</span>
            </div>
          )}
          {meetupWeek?.active && !meetupWeek.metInPerson && (
            <div
              className={`chat-reply-deadline-banner ${meetupWeek.expired ? 'chat-reply-deadline-banner-expired' : ''}`}
              style={meetupWeek.expired ? undefined : { borderColor: 'rgba(168,85,247,0.5)', background: 'rgba(168,85,247,0.12)' }}
            >
              <span>{meetupWeek.ruleText}</span>
            </div>
          )}
          {iOweReply && !replyWindowExpired && (
            <div className="chat-reply-deadline-banner chat-reply-deadline-banner-urgent">
              <span>
                {remainingMs != null && remainingMs > 0
                  ? `You must reply within ${Math.floor(remainingMs / 3_600_000)}h ${Math.floor((remainingMs % 3_600_000) / 60_000)}m or you'll be unmatched.`
                  : (replyDeadline?.ruleText || 'You must reply within 24 hours or you\'ll be unmatched.')}
              </span>
            </div>
          )}
          {(() => {
            const plan = meetupPlans.find(
              (p) => p.chatPartnerUserId === selectedUserId && p.dateSessionStatus !== 'completed'
            );
            if (!plan) return null;
            return (
              <div className="chat-focus-banner" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.5)', marginBottom: 8, padding: '10px 12px', borderRadius: 8 }}>
                <strong>Date safety</strong>
                <p style={{ fontSize: 12, margin: '6px 0' }}>
                  ID: {plan.idVerificationStatus === 'verified' ? '✓ verified' : plan.idVerificationStatus === 'pending_review' ? 'Scanning…' : 'Required before meetup'}
                  {plan.dateSessionStatus === 'active' ? ' · Tracking active' : ''}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {plan.idVerificationStatus === 'verified' && plan.dateSessionStatus === 'scheduled' && (
                    <button
                      type="button"
                      className="chat-checkin-btn"
                      onClick={async () => {
                        await askWhatYouAreWearing();
                        await safetyAPI.startDateTracking(plan.id);
                        const { plans } = await safetyAPI.getMeetupPlans();
                        setMeetupPlans(plans as EnrichedMeetupPlan[]);
                      }}
                    >
                      We&apos;ve met — start safety tracking
                    </button>
                  )}
                  {plan.dateSessionStatus === 'active' && (
                    <button
                      type="button"
                      className="chat-checkin-btn"
                      style={{ borderColor: '#ef4444', color: '#fca5a5' }}
                      onClick={async () => {
                        const word = prompt('Type your safe word or leave blank for danger button:') || undefined;
                        await safetyAPI.triggerDanger(plan.id, word);
                        alert('Emergency contact notified (safety signal).');
                      }}
                    >
                      I&apos;m in danger
                    </button>
                  )}
                </div>
                {plan.dateSessionStatus === 'active' && (
                  <VoiceSafetyPanel mode="date" planId={plan.id} compact />
                )}
              </div>
            );
          })()}
          {messages.some((m) => m.fromUserId === selectedUserId && m.content.includes('[Safety]')) && (
            <div className="chat-focus-banner" style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', marginBottom: 8, padding: '10px 12px', borderRadius: 8 }}>
              <strong>Your date has asked to keep distance and stay in public.</strong> Please respect their boundaries. Stay in a public place with people around and do not assume they are comfortable with anything beyond that.
            </div>
          )}
          <div className="comm-scrollable chat-thread">
            {messages.length === 0 && !loading && (
              <div className="chat-thread-empty">No messages yet. Say hi!</div>
            )}
            {messages.map((msg) => {
              const isMe = msg.fromUserId === user?.id;
              const isSafetyMessage = msg.content.includes('[Safety]');
              return (
                <div
                  key={msg.id}
                  className={`chat-bubble ${isMe ? 'chat-bubble-sent' : 'chat-bubble-received'} ${isSafetyMessage ? 'chat-bubble-safety' : ''}`}
                >
                  {renderMessageContent(msg.content)}
                  <TranslateButton text={messageTranslateText(msg.content)} />
                  <div className="chat-bubble-time">{formatMessageTime(msg.createdAt)}</div>
                </div>
              );
            })}
            <div ref={threadEndRef} />
          </div>
          {showConnectionJourney && (
            <div className="chat-connection-journey-wrap">
              {connectionJourneyLoading ? (
                <div className="chat-connection-journey-loading">Loading connection journey…</div>
              ) : !connectionJourney?.journey ? (
                <div className="chat-connection-journey-cta">
                  <div className="chat-connection-journey-cta-icon">✨</div>
                  <h4 className="chat-connection-journey-cta-title">Win them over in 7 days</h4>
                  <p className="chat-connection-journey-cta-desc">
                    Before you decide if you like each other, prove it. You get 7 random activities — challenges, games, quizzes, gifts, surprises & deep convos. Every chat gets a different mix so it never feels the same. Do each step in the chat, then see if you&apos;re both feeling the same way.
                  </p>
                  <button
                    type="button"
                    className="chat-connection-journey-btn chat-connection-journey-btn-primary"
                    onClick={handleStartConnectionJourney}
                    disabled={connectionJourneyActionLoading}
                  >
                    {connectionJourneyActionLoading ? 'Starting…' : 'Start connection journey'}
                  </button>
                </div>
              ) : connectionJourney.nextStep ? (
                <div className={`chat-connection-journey-step chat-connection-journey-step-${connectionJourney.nextStep.type}`}>
                  <div className="chat-connection-journey-step-header">
                    <span className="chat-connection-journey-step-day">Day {connectionJourney.nextStep.day}</span>
                    <span className="chat-connection-journey-step-type">
                      {connectionJourney.nextStep.type === 'challenge' && '🎯'}
                      {connectionJourney.nextStep.type === 'game' && '🎮'}
                      {connectionJourney.nextStep.type === 'quiz' && '❓'}
                      {connectionJourney.nextStep.type === 'gift' && '🎁'}
                      {connectionJourney.nextStep.type === 'surprise' && '💝'}
                      {connectionJourney.nextStep.type === 'deep' && '💬'}
                      {' '}{connectionJourney.nextStep.type}
                    </span>
                  </div>
                  <h4 className="chat-connection-journey-step-title">{connectionJourney.nextStep.title}</h4>
                  <p className="chat-connection-journey-step-subtitle">{connectionJourney.nextStep.subtitle}</p>
                  <p className="chat-connection-journey-step-instructions">{connectionJourney.nextStep.instructions}</p>
                  <div className="chat-connection-journey-step-actions">
                    {connectionJourney.nextStep.chatPrompt && (
                      <button
                        type="button"
                        className="chat-connection-journey-btn chat-connection-journey-btn-outline"
                        onClick={() => setInputText(connectionJourney.nextStep!.chatPrompt || '')}
                      >
                        Share in chat
                      </button>
                    )}
                    <button
                      type="button"
                      className="chat-connection-journey-btn chat-connection-journey-btn-primary"
                      onClick={() => handleCompleteConnectionStep(connectionJourney.nextStep!.id)}
                      disabled={connectionJourneyActionLoading}
                    >
                      {connectionJourneyActionLoading ? '…' : "I did it"}
                    </button>
                  </div>
                  <div className="chat-connection-journey-progress">
                    Day {connectionJourney.currentDay} of {connectionJourney.totalDays}
                    {connectionJourney.allSteps && (
                      <span className="chat-connection-journey-dots">
                        {connectionJourney.allSteps.map((s) => (
                          <span
                            key={s.id}
                            className={`chat-connection-journey-dot ${s.completed ? 'completed' : s.id === connectionJourney.nextStep?.id ? 'current' : ''}`}
                            title={s.title}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="chat-connection-journey-complete">
                  <div className="chat-connection-journey-complete-icon">🏆</div>
                  <h4>You&apos;ve completed the connection journey</h4>
                  <p>You&apos;ve had challenges, games, and surprises. Ready to see if you&apos;re both feeling the same way? Keep chatting — we&apos;ll ask when it feels right.</p>
                </div>
              )}
            </div>
          )}
          {convoPrompt && (
            <div className="chat-convo-prompt">
              <span className="chat-convo-prompt-label">Conversation idea:</span> {convoPrompt}
              <button type="button" className="chat-convo-use" onClick={() => setInputText(convoPrompt || '')}>Use this</button>
            </div>
          )}
          {isRelationshipThread && showVoiceGuardPanel && user?.id && selectedUserId && (
            <VoiceSafetyPanel mode="relationship" partnerUserId={selectedUserId} partnerName={selectedName || 'partner'} />
          )}
          {isRelationshipThread && user?.id && selectedUserId && (
            <RelationshipCouplePanel
              partnerUserId={selectedUserId}
              partnerName={selectedName || 'partner'}
              userId={user.id}
              onSendMessage={(text) => { sendContent(text); }}
              onOpenGuides={onOpenGuides}
            />
          )}
          {isRelationshipThread && relationshipTip && (
            <div className="chat-convo-prompt chat-relationship-tip">
              <span className="chat-convo-prompt-label">💑 Relationship tip of the day:</span> {relationshipTip}
            </div>
          )}
          {isRelationshipThread && relationshipTopic && (
            <div className="chat-convo-prompt">
              <span className="chat-convo-prompt-label">Topic to talk about:</span> {relationshipTopic}
              <button type="button" className="chat-convo-use" onClick={() => setInputText(relationshipTopic || '')}>Use this</button>
            </div>
          )}
          {isRelationshipThread && relationshipDateIdea && (
            <div className="chat-convo-prompt">
              <span className="chat-convo-prompt-label">📅 Date idea:</span> {relationshipDateIdea}
              <button type="button" className="chat-convo-use" onClick={() => setInputText(`Want to do this sometime? ${relationshipDateIdea}`)}>Suggest to partner</button>
            </div>
          )}
          {showConflictSolutions.length > 0 && (
            <div className="chat-convo-prompt" style={{ background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)' }}>
              <span className="chat-convo-prompt-label">Proven solutions when things get tough:</span>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 12 }}>
                {showConflictSolutions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
              <button type="button" className="chat-back-btn" style={{ marginTop: 8 }} onClick={() => setShowConflictSolutions([])}>Dismiss</button>
            </div>
          )}
          {showGifPicker && user?.id && (
            <GifEmojiPicker
              userId={user.id}
              startTab={gifPickerTab}
              onSend={(encoded) => {
                setShowGifPicker(false);
                sendContent(encoded);
              }}
              onInsertEmoji={(emoji) => setInputText((prev) => `${prev}${emoji}`)}
              onClose={() => setShowGifPicker(false)}
            />
          )}
          <div className="chat-toolbar">
            {isRelationshipThread && (
              <button type="button" className="chat-toolbar-btn" onClick={handleSuggestSolutions} title="Get relationship solutions for a problem">
                💡 Solutions
              </button>
            )}
            <button
              type="button"
              className="chat-toolbar-btn"
              onClick={() => {
                setGifPickerTab('gifs');
                setShowGifPicker((v) => !(v && gifPickerTab === 'gifs'));
              }}
              title="GIFs"
            >
              GIF
            </button>
            <button
              type="button"
              className="chat-toolbar-btn"
              onClick={() => {
                setGifPickerTab('emojis');
                setShowGifPicker((v) => !(v && gifPickerTab === 'emojis'));
              }}
              title="Emojis"
            >
              😊
            </button>
            <button
              type="button"
              className={`chat-toolbar-btn ${recordingAudio ? 'recording' : ''}`}
              onClick={recordingAudio ? stopAudioRecording : startAudioRecording}
              disabled={replyWindowExpired}
              title={recordingAudio ? 'Stop recording' : 'Voice message'}
            >
              {recordingAudio ? '⏹ Stop' : '🎤'}
            </button>
            <button
              type="button"
              className={`chat-toolbar-btn ${recordingVideo ? 'recording' : ''}`}
              onClick={recordingVideo ? stopVideoRecording : startVideoRecording}
              disabled={replyWindowExpired}
              title={recordingVideo ? 'Stop recording' : 'Record short clip (GIF-like)'}
            >
              {recordingVideo ? '⏹ Stop' : '📹'}
            </button>
            <button type="button" className="chat-toolbar-btn" onClick={handleVideoCall} title="Video call">
              📞
            </button>
          </div>
          <button
            type="button"
            className="chat-texting-help-fab"
            title="Having trouble texting? Get a live guide"
            onClick={() => {
              setHelpSessionId(null);
              setTextingHelpOpen(true);
            }}
          >
            SOS
          </button>
          <div className="chat-input-wrap">
            <input
              type="text"
              className="chat-input"
              placeholder={
                dateLock?.locked
                  ? 'Chat unlocks on the day of the date'
                  : rouletteHold && !rouletteOwner
                    ? 'On hold until they are ready to chat'
                    : 'Type a message...'
              }
              value={inputText}
              disabled={Boolean(dateLock?.locked) || (rouletteHold && !rouletteOwner)}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            />
            <button
              type="button"
              className="chat-send-btn"
              onClick={handleSend}
              disabled={
                !inputText.trim() ||
                replyWindowExpired ||
                Boolean(dateLock?.locked) ||
                (rouletteHold && !rouletteOwner)
              }
            >
              Send
            </button>
          </div>
          <button
            type="button"
            className="chat-back-btn chat-back-inline"
            onClick={() => {
              setView('list');
              setSelectedUserId(null);
              setReplyDeadline(null);
            }}
          >
            ← Back to chats
          </button>
        </>
      )}

      {showReviewModal && selectedUserId && (
        <ExperienceReviewModal
          open={showReviewModal}
          partnerUserId={selectedUserId}
          partnerName={selectedName || 'this person'}
          source={reviewModalSource}
          onClose={handleReviewModalClose}
          onComplete={handleReviewModalComplete}
        />
      )}

      {showContinuePrompt && speedDate && (
        <div className="chat-meetup-overlay">
          <div className="chat-meetup-modal chat-continue-modal">
            {!continueAnswered ? (
              <>
                <h3>Speed date period is over</h3>
                <p>Do you want to continue talking with {speedDatePartner?.name || 'your match'}?</p>
                <div className="chat-continue-btns">
                  <button type="button" className="chat-send-btn" onClick={() => handleContinueAnswer(true)}>Yes, continue</button>
                  <button type="button" className="chat-back-btn" onClick={() => handleContinueAnswer(false)}>No thanks</button>
                </div>
              </>
            ) : (
              <>
                <h3>{upliftingMessage ? "Here's something for you" : 'Thanks!'}</h3>
                {upliftingMessage && <p className="chat-uplifting">{upliftingMessage}</p>}
                <button type="button" className="chat-send-btn" onClick={() => { setShowContinuePrompt(false); setUpliftingMessage(null); }}>OK</button>
              </>
            )}
          </div>
        </div>
      )}

      {showBoundariesModal && selectedUserId && (
        <div className="chat-meetup-overlay" onClick={() => setShowBoundariesModal(false)}>
          <div className="chat-meetup-modal chat-boundaries-modal" onClick={(e) => e.stopPropagation()}>
            <div className="chat-boundaries-banner">Boundaries</div>
            <div className="chat-boundaries-body">
              <h3>Safety &amp; Consent Checklist</h3>
              <div className="chat-boundaries-check">
                <label>
                  <input type="checkbox" checked={boundariesChecklist.over18} onChange={(e) => setBoundariesChecklist((c) => ({ ...c, over18: e.target.checked }))} />
                  <span>I am over 18 years old and legally able to consent</span>
                </label>
                <label>
                  <input type="checkbox" checked={boundariesChecklist.withdraw} onChange={(e) => setBoundariesChecklist((c) => ({ ...c, withdraw: e.target.checked }))} />
                  <span>I understand that consent can be withdrawn at any time</span>
                </label>
                <label>
                  <input type="checkbox" checked={boundariesChecklist.publicPlace} onChange={(e) => setBoundariesChecklist((c) => ({ ...c, publicPlace: e.target.checked }))} />
                  <span>I agree to meet in a public place for the first meeting</span>
                </label>
                <label>
                  <input type="checkbox" checked={boundariesChecklist.respect} onChange={(e) => setBoundariesChecklist((c) => ({ ...c, respect: e.target.checked }))} />
                  <span>I will respect the other person&apos;s boundaries and decisions</span>
                </label>
              </div>
              <h4>Consent verification</h4>
              <p className="chat-boundaries-q">Do you explicitly consent to potentially intimate or sexual activity during or after the meetup?</p>
              <div className="chat-boundaries-yesno">
                <button type="button" className="chat-send-btn" style={{ flex: 1, background: boundariesConsent === true ? 'rgba(34,197,94,0.4)' : 'rgba(34,197,94,0.2)', border: '2px solid #22c55e' }} onClick={handleBoundariesYesConsent}>
                  Yes, I consent
                </button>
                <button type="button" className="chat-back-btn" style={{ flex: 1, background: boundariesConsent === false ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.15)', border: '2px solid #ef4444', color: '#fecaca' }} onClick={handleBoundariesNoConsent} disabled={boundariesSending || !allBoundariesChecked}>
                  {boundariesSending ? 'Sending…' : "No, I don't consent"}
                </button>
              </div>
              <div className="chat-boundaries-remember">
                <strong>Remember:</strong>
                <ul>
                  <li>Consent must be freely given by both parties</li>
                  <li>Consent can be withdrawn at any time</li>
                  <li>Being under the influence affects ability to consent</li>
                  <li>Respect each other&apos;s boundaries and decisions</li>
                </ul>
              </div>
              <div className="chat-boundaries-foot">
                <span>📞 Emergency contacts</span>
                <span>🛡️ Add them in the next step</span>
              </div>
              <div className="chat-meetup-actions">
                <button type="button" className="chat-send-btn" onClick={handleBoundariesContinue} disabled={!allBoundariesChecked || boundariesConsent === null}>
                  Continue to plan meetup
                </button>
                <button type="button" className="chat-back-btn" onClick={() => { setShowBoundariesModal(false); setBoundariesDismissedForChat(selectedUserId); }}>
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSafetyVideoModal && (
        <div className="chat-meetup-overlay">
          <div className="chat-meetup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="chat-meetup-header">
              <h3>Check in — you should be back by now</h3>
            </div>
            <p style={{ fontSize: 13, marginBottom: 12 }}>
              Record a short 360° video saying you are safe. It will be reviewed. Your emergency contact was notified to video call you.
            </p>
            <div className="chat-meetup-actions">
              <button
                type="button"
                className="chat-send-btn"
                disabled={safetyVideoSubmitting}
                onClick={async () => {
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    const recorder = new MediaRecorder(stream);
                    safetyVideoChunksRef.current = [];
                    recorder.ondataavailable = (ev) => {
                      if (ev.data.size) safetyVideoChunksRef.current.push(ev.data);
                    };
                    recorder.onstop = async () => {
                      stream.getTracks().forEach((t) => t.stop());
                      const blob = new Blob(safetyVideoChunksRef.current, { type: 'video/webm' });
                      const reader = new FileReader();
                      reader.onload = async () => {
                        setSafetyVideoSubmitting(true);
                        try {
                          await safetyAPI.submitMeetupSafetyCheck(showSafetyVideoModal.id, String(reader.result));
                          setShowSafetyVideoModal(null);
                          setSuccess('Safety check-in submitted for review.');
                        } catch (err: any) {
                          setError(err.response?.data?.error || 'Failed to submit video');
                        } finally {
                          setSafetyVideoSubmitting(false);
                        }
                      };
                      reader.readAsDataURL(blob);
                    };
                    safetyVideoRecorderRef.current = recorder;
                    recorder.start();
                    setTimeout(() => {
                      if (recorder.state === 'recording') recorder.stop();
                    }, 8000);
                  } catch {
                    setError('Camera access required for safety check-in.');
                  }
                }}
              >
                {safetyVideoSubmitting ? 'Uploading…' : 'Record 8s safety video'}
              </button>
              <button type="button" className="chat-back-btn" onClick={() => setShowSafetyVideoModal(null)}>
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {showMeetupPopup && selectedUserId && (
        <div className="chat-meetup-overlay" onClick={() => setShowMeetupPopup(false)}>
          <div className="chat-meetup-modal chat-meetup-plan-modal" onClick={(e) => e.stopPropagation()}>
            <div className="chat-meetup-header">
              <h3>Planning a meet-up? Add safety details</h3>
              <button type="button" className="chat-profile-close" onClick={() => { setShowMeetupPopup(false); setMeetupDismissedForChat(selectedUserId); }}>×</button>
            </div>
            <div className="chat-meetup-form">
              {error && <p className="id-camera-error">{error}</p>}
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginBottom: 12, padding: 8, background: 'rgba(168,85,247,0.15)', borderRadius: 8 }}>
                <strong>7-day rule (serious users only):</strong> Meet in person within a week of matching or this match ends. Repeatedly stalling meetups can lead to suspension over time. Pick a public talk-friendly spot below — parks, coffee to-go, plazas only (no sit-down restaurants, cinemas, or movies). Each pays your own.
              </p>
              {selectedUserId && user?.id && (
                <DateVenuePicker
                  otherUserId={selectedUserId}
                  userId={user.id}
                  onAgreed={(name) => {
                    setAgreedVenueName(name);
                    setMeetupLocation(name);
                  }}
                />
              )}
              <p className="chat-meetup-health-note">
                💡 Before you meet, check your date&apos;s health results (tap their name in the chat header → Request to see health results).
              </p>
              <div className="chat-meetup-safety-box">
                <strong>Safety:</strong> Hold your ID on camera so it can be scanned. We save it only until you confirm you arrived home safe — then it is deleted. Location is tracked only during the date (red-dot trail if something goes wrong). Check-ins every 2 hours.
              </div>
              <label className="chat-meetup-checkbox">
                <input
                  type="checkbox"
                  checked={idVerificationConsent}
                  onChange={(e) => setIdVerificationConsent(e.target.checked)}
                />
                I consent: I will hold my ID to the camera to be scanned. It is saved only until I confirm I arrived home safe, then it is deleted.
              </label>
              <label className="chat-meetup-checkbox">
                <input
                  type="checkbox"
                  checked={trackingConsent}
                  onChange={(e) => setTrackingConsent(e.target.checked)}
                />
                I consent: my location is tracked only during the date until it ends — for safety if something goes wrong. Emergency contact can view trail only if I alert danger.
              </label>
              <label>ID scan (hold to camera)</label>
              <IdCameraScan
                front={idFrontImage}
                back={idBackImage}
                onFront={setIdFrontImage}
                onBack={setIdBackImage}
              />
              <label>Meet-up time</label>
              <input type="datetime-local" value={meetAt} onChange={(e) => setMeetAt(e.target.value)} className="chat-meetup-input" />
              <label>Location (auto-filled when you agree on a spot)</label>
              <input type="text" placeholder="Agreed public spot" value={meetupLocation} onChange={(e) => setMeetupLocation(e.target.value)} className="chat-meetup-input" />
              <label>Expected back time</label>
              <input type="datetime-local" value={expectedBackAt} onChange={(e) => setExpectedBackAt(e.target.value)} className="chat-meetup-input" />
              <label>Emergency contact (required)</label>
              <div className="chat-meetup-emergency-tabs">
                <button type="button" className={emergencyType === 'app' ? 'active' : ''} onClick={() => setEmergencyType('app')}>App user</button>
                <button type="button" className={emergencyType === 'phone' ? 'active' : ''} onClick={() => setEmergencyType('phone')}>Phone contact</button>
              </div>
              {emergencyType === 'app' && (
                <>
                  <input
                    type="text"
                    placeholder="Search by username..."
                    value={emergencySearchQuery}
                    onChange={(e) => setEmergencySearchQuery(e.target.value)}
                    className="chat-meetup-input"
                  />
                  <div className="chat-meetup-search-results">
                    {emergencySearchResults.slice(0, 5).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className={`chat-meetup-contact-item ${emergencyContactUserId === u.id ? 'selected' : ''}`}
                        onClick={() => setEmergencyContactUserId(u.id)}
                      >
                        {u.name} @{u.username}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {emergencyType === 'phone' && (
                <>
                  <input type="text" placeholder="Name" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className="chat-meetup-input" />
                  <input type="tel" placeholder="Phone" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className="chat-meetup-input" />
                  {savedContacts.length > 0 && (
                    <div className="chat-meetup-saved">
                      Or select saved: {savedContacts.map((c) => (
                        <button key={c.id} type="button" className={`chat-meetup-contact-item ${emergencyContactId === c.id ? 'selected' : ''}`} onClick={() => { setEmergencyContactId(c.id); setEmergencyName(c.name); setEmergencyPhone(c.phone); }}>{c.name}</button>
                      ))}
                    </div>
                  )}
                </>
              )}
              <div className="chat-meetup-actions">
                <button type="button" className="chat-send-btn" onClick={handleMeetupSubmit} disabled={meetupSubmitting}>
                  {meetupSubmitting ? 'Saving...' : 'Save plan'}
                </button>
                <button type="button" className="chat-back-btn" onClick={() => { setShowMeetupPopup(false); setMeetupDismissedForChat(selectedUserId); }}>Skip</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {disinterestOpen && disinterestReport && selectedUserId && (
        <DisinterestAnalyzer
          report={disinterestReport}
          partnerName={selectedName || 'this person'}
          onClose={() => setDisinterestOpen(false)}
        />
      )}
      {textingHelpOpen && selectedUserId && (
        <TextingHelpWheel
          otherUserId={selectedUserId}
          partnerName={selectedName || 'them'}
          resumeSessionId={helpSessionId}
          onClose={() => setTextingHelpOpen(false)}
        />
      )}
    </div>
  );
};

export default ChatWidget;
