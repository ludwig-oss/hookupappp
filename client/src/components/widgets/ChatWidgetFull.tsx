import { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { chatAPI, Message, Conversation, User } from '../../api/chat';
import { safetyAPI, EmergencyContact, TextingCoach, CoachingSession } from '../../api/safety';
import { ratingsAPI, AverageRatings, UnmatchReason } from '../../api/ratings';
import { chatEngagementAPI, ProofOfLove, ConnectionPrompt, ChatChallenge } from '../../api/chatEngagement';
import './Widget.css';

// Date detection keywords
const DATE_KEYWORDS = [
  'date', 'meet', 'meeting', 'coffee', 'dinner', 'lunch', 'drinks', 'movie',
  'cinema', 'park', 'restaurant', 'bar', 'club', 'party', 'hang out', 'hangout',
  'see you', 'pick you', 'pickup', 'together', 'tonight', 'tomorrow', 'this weekend',
  'next week', 'friday', 'saturday', 'sunday', 'when are you free', 'when can we meet'
];

const detectDateMention = (text: string): boolean => {
  const lowerText = text.toLowerCase();
  return DATE_KEYWORDS.some(keyword => lowerText.includes(keyword));
};

// Attribute Row Component for Comparison
const AttributeRow = ({ label, value, compareValue }: { label: string; value: number; compareValue?: number | null }) => {
  const isHigher = compareValue !== undefined && compareValue !== null && value > compareValue;
  const isLower = compareValue !== undefined && compareValue !== null && value < compareValue;
  
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      padding: '6px 0',
      borderBottom: '1px solid rgba(0, 212, 255, 0.1)'
    }}>
      <span style={{ fontSize: '12px', color: '#9ca3af', flex: 1 }}>{label}</span>
      {compareValue !== undefined && compareValue !== null && (
        <span style={{ 
          fontSize: '11px', 
          color: isLower ? '#ef4444' : isHigher ? '#10b981' : '#9ca3af',
          marginRight: '8px',
          minWidth: '35px',
          textAlign: 'right'
        }}>
          {compareValue}
        </span>
      )}
      <span style={{ 
        fontSize: '12px', 
        color: isHigher ? '#10b981' : isLower ? '#ef4444' : '#00d4ff',
        fontWeight: 'bold',
        minWidth: '35px',
        textAlign: 'right'
      }}>
        {value}
      </span>
    </div>
  );
};

const ChatWidgetFull = () => {
  const { user } = useContext(AuthContext);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUser1, setSelectedUser1] = useState<User | null>(null);
  const [selectedUser2, setSelectedUser2] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [ratings1, setRatings1] = useState<AverageRatings | null>(null);
  const [ratings2, setRatings2] = useState<AverageRatings | null>(null);
  const [unmatchReasons, setUnmatchReasons] = useState<UnmatchReason[]>([]);
  const [showUnmatchModal, setShowUnmatchModal] = useState(false);
  const [unmatchReason, setUnmatchReason] = useState('');
  const [unmatchingUserId, setUnmatchingUserId] = useState<string | null>(null);
  
  // Engagement features
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofPrompt, setProofPrompt] = useState<string>('');
  const [proofMedia, setProofMedia] = useState<string>('');
  const [pendingProofs, setPendingProofs] = useState<ProofOfLove[]>([]);
  const [showConnectionPrompt, setShowConnectionPrompt] = useState(false);
  const [connectionPrompt, setConnectionPrompt] = useState<ConnectionPrompt | null>(null);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState<ChatChallenge | null>(null);
  const [challengeGameState, setChallengeGameState] = useState<any>(null);
  const proofFileInputRef = useRef<HTMLInputElement>(null);
  const lastMessageTimeRef = useRef<number>(0);
  
  // New states
  const [showMenu, setShowMenu] = useState(false);
  const [showEmergencyShare, setShowEmergencyShare] = useState(false);
  const [showTextingCoach, setShowTextingCoach] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [textingCoaches, setTextingCoaches] = useState<TextingCoach[]>([]);
  const [selectedCoach, setSelectedCoach] = useState<TextingCoach | null>(null);
  const [activeCoachingSession, setActiveCoachingSession] = useState<CoachingSession | null>(null);
  const [dateDetected, setDateDetected] = useState(false);
  const [showDateAlert, setShowDateAlert] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadConversations();
      loadAvailableUsers();
      loadEmergencyContacts();
      loadTextingCoaches();
      checkActiveCoachingSession();
      loadUnmatchReasons();
    }
  }, [user]);

  useEffect(() => {
    if (selectedUser1 && user?.id) {
      loadMessages(selectedUser1.id);
      loadRatings(selectedUser1.id, 1);
      loadPendingProofs();
      checkEngagementFeatures();
      const interval = setInterval(() => {
        loadMessages(selectedUser1.id);
        checkEngagementFeatures();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [selectedUser1, user]);

  useEffect(() => {
    // Track message activity for engagement triggers
    if (messages.length > 0) {
      lastMessageTimeRef.current = Date.now();
    }
  }, [messages]);

  useEffect(() => {
    if (selectedUser2 && user?.id) {
      loadRatings(selectedUser2.id, 2);
    }
  }, [selectedUser2, user]);

  // Date detection
  useEffect(() => {
    if (messageContent && selectedUser1) {
      const detected = detectDateMention(messageContent);
      setDateDetected(detected);
      if (detected && !showDateAlert) {
        setShowDateAlert(true);
      }
    } else {
      setDateDetected(false);
    }
  }, [messageContent, selectedUser1]);

  useEffect(() => {
    if (!user?.id) return;
    const handler = (evt: Event) => {
      const ce = evt as CustomEvent<{ userId: string }>;
      const targetId = ce.detail?.userId;
      if (!targetId) return;
      const target = availableUsers.find(u => u.id === targetId);
      if (target) {
        handleSelectUser(target, 1);
      } else {
        localStorage.setItem('chatSelectedUserId', targetId);
      }
    };
    window.addEventListener('chat:open', handler as any);
    return () => window.removeEventListener('chat:open', handler as any);
  }, [user, availableUsers]);

  useEffect(() => {
    const storedUserId = localStorage.getItem('chatSelectedUserId');
    if (storedUserId && availableUsers.length > 0) {
      const target = availableUsers.find(u => u.id === storedUserId);
      if (target) {
        handleSelectUser(target, 1);
        localStorage.removeItem('chatSelectedUserId');
      }
    }
  }, [availableUsers]);

  const loadConversations = async () => {
    try {
      const response = await chatAPI.getConversations(user!.id);
      setConversations(response.conversations);
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const response = await chatAPI.getAvailableUsers(user!.id);
      setAvailableUsers(response.users);
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  const loadMessages = async (otherUserId: string) => {
    try {
      const response = await chatAPI.getConversation(otherUserId, user!.id);
      if (response.unmatched) {
        alert(response.unmatchedReason || 'This match ended — no reply within 24 hours.');
        setSelectedUser1(null);
        setMessages([]);
        await loadConversations();
        return;
      }
      setMessages(response.messages);
      await chatAPI.markAsRead(otherUserId, user!.id);
    } catch (err: any) {
      const msg = err.response?.data?.error;
      if (err.response?.data?.unmatched) {
        alert(msg || 'This match ended — no reply within 24 hours.');
        setSelectedUser1(null);
        setMessages([]);
        await loadConversations();
        return;
      }
      console.error('Failed to load messages', err);
    }
  };

  const loadEmergencyContacts = async () => {
    try {
      const response = await safetyAPI.getEmergencyContacts();
      setEmergencyContacts(response.contacts);
    } catch (err) {
      console.error('Failed to load emergency contacts', err);
    }
  };

  const loadTextingCoaches = async () => {
    try {
      const response = await safetyAPI.getTextingCoaches();
      setTextingCoaches(response.coaches);
    } catch (err) {
      console.error('Failed to load texting coaches', err);
    }
  };

  const checkActiveCoachingSession = async () => {
    try {
      const response = await safetyAPI.getActiveCoachingSession();
      setActiveCoachingSession(response.session);
    } catch (err) {
      console.error('Failed to check coaching session', err);
    }
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim() || !selectedUser1 || !user?.id) return;

    // Check if user has pending proof that needs verification
    const myPendingProof = pendingProofs.find(p => p.fromUserId === user.id && p.toUserId === selectedUser1.id && p.status === 'pending');
    if (myPendingProof) {
      alert('You have a pending proof of love that needs to be verified before you can continue chatting.');
      return;
    }

    try {
      await chatAPI.sendMessage(selectedUser1.id, messageContent, user.id);
      setMessageContent('');
      await loadMessages(selectedUser1.id);
      await loadConversations();
      setShowDateAlert(false);
    } catch (err: any) {
      const msg = err.response?.data?.error;
      if (err.response?.data?.unmatched) {
        alert(msg || 'This match ended — no reply within 24 hours.');
        setSelectedUser1(null);
        setMessages([]);
        await loadConversations();
        return;
      }
      console.error('Failed to send message', err);
    }
  };

  const loadRatings = async (userId: string, position: 1 | 2) => {
    try {
      const response = await ratingsAPI.getAverageRatings(userId);
      if (position === 1) {
        setRatings1(response);
      } else {
        setRatings2(response);
      }
    } catch (err) {
      console.error('Failed to load ratings:', err);
    }
  };

  const loadUnmatchReasons = async () => {
    if (!user?.id) return;
    try {
      const response = await ratingsAPI.getMyUnmatchReasons(user.id);
      setUnmatchReasons(response.reasons);
    } catch (err) {
      console.error('Failed to load unmatch reasons:', err);
    }
  };

  const handleSelectUser = (selected: User, position: 1 | 2) => {
    if (position === 1) {
      if (selectedUser1?.id === selected.id) {
        setSelectedUser1(null);
        setRatings1(null);
      } else {
        setSelectedUser1(selected);
        loadMessages(selected.id);
        loadRatings(selected.id, 1);
      }
    } else {
      if (selectedUser2?.id === selected.id) {
        setSelectedUser2(null);
        setRatings2(null);
      } else {
        setSelectedUser2(selected);
        loadRatings(selected.id, 2);
      }
    }
  };

  const handleUnmatch = (userId: string) => {
    setUnmatchingUserId(userId);
    setShowUnmatchModal(true);
  };

  const handleSubmitUnmatch = async () => {
    if (!unmatchingUserId || !unmatchReason.trim() || !user?.id) return;
    try {
      await ratingsAPI.unmatchWithReason({
        unmatchedUserId: unmatchingUserId,
        reason: unmatchReason,
        userId: user.id,
      });
      await chatAPI.unmatchUser(unmatchingUserId);
      
      // Clear selections if unmatching one of them
      if (selectedUser1?.id === unmatchingUserId) {
        setSelectedUser1(null);
        setRatings1(null);
      }
      if (selectedUser2?.id === unmatchingUserId) {
        setSelectedUser2(null);
        setRatings2(null);
      }
      
      setShowUnmatchModal(false);
      setUnmatchReason('');
      setUnmatchingUserId(null);
      await loadAvailableUsers();
      await loadConversations();
      await loadUnmatchReasons();
      alert('Unmatched successfully');
    } catch (err: any) {
      console.error('Failed to unmatch:', err);
      alert(err.response?.data?.error || 'Failed to unmatch');
    }
  };

  const handleViewUnmatchReason = async (reasonId: string) => {
    try {
      await ratingsAPI.viewUnmatchReason(reasonId);
      await loadUnmatchReasons();
    } catch (err) {
      console.error('Failed to mark reason as viewed:', err);
    }
  };

  // Engagement Features
  const loadPendingProofs = async () => {
    if (!user?.id) return;
    try {
      const response = await chatEngagementAPI.getPendingProofs(user.id);
      setPendingProofs(response.proofs);
    } catch (err) {
      console.error('Failed to load pending proofs:', err);
    }
  };

  const checkEngagementFeatures = async () => {
    if (!selectedUser1 || !user?.id) return;

    try {
      // Check proof of love status
      const proofStatus = await chatEngagementAPI.checkProofStatus({
        userId: user.id,
        otherUserId: selectedUser1.id,
      });
      if (proofStatus.shouldShow && !proofStatus.hasPendingProof && !showProofModal) {
        const promptResponse = await chatEngagementAPI.getProofPrompt();
        setProofPrompt(promptResponse.prompt);
        setShowProofModal(true);
      }

      // Check connection prompt
      const promptStatus = await chatEngagementAPI.checkConnectionPrompt({
        userId: user.id,
        otherUserId: selectedUser1.id,
      });
      if (promptStatus.shouldShow && !showConnectionPrompt && Math.random() > 0.7) {
        const promptResponse = await chatEngagementAPI.getConnectionPrompt({
          userId: user.id,
          otherUserId: selectedUser1.id,
        });
        setConnectionPrompt(promptResponse.prompt);
        setShowConnectionPrompt(true);
      }

      // Check challenge status
      const challengeStatus = await chatEngagementAPI.checkChallengeStatus({
        userId: user.id,
        otherUserId: selectedUser1.id,
      });
      if (challengeStatus.shouldShow && !currentChallenge && Math.random() > 0.8) {
        const challengeResponse = await chatEngagementAPI.getRandomChallenge();
        setShowChallengeModal(true);
      }
    } catch (err) {
      console.error('Failed to check engagement features:', err);
    }
  };

  const handleProofMediaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUser1 || !user?.id) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      alert('Please select an image or video file');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setProofMedia(base64);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  };

  const handleSubmitProof = async () => {
    if (!proofMedia || !proofPrompt || !selectedUser1 || !user?.id) return;

    try {
      await chatEngagementAPI.submitProofOfLove({
        toUserId: selectedUser1.id,
        prompt: proofPrompt,
        mediaUrl: proofMedia,
        userId: user.id,
      });
      
      // Send as message
      await chatAPI.sendMessage(selectedUser1.id, `[Proof of Love Submitted] ${proofPrompt}`, user.id);
      
      setShowProofModal(false);
      setProofPrompt('');
      setProofMedia('');
      await loadPendingProofs();
      await loadMessages(selectedUser1.id);
      alert('Proof submitted! Waiting for verification.');
    } catch (err: any) {
      console.error('Failed to submit proof:', err);
      alert(err.response?.data?.error || 'Failed to submit proof');
    }
  };

  const handleVerifyProof = async (proofId: string, verified: boolean) => {
    if (!user?.id) return;
    try {
      await chatEngagementAPI.verifyProof({
        proofId,
        verified,
        userId: user.id,
      });
      await loadPendingProofs();
      if (verified) {
        alert('Proof verified! You can continue chatting.');
      } else {
        alert('Proof rejected. They need to submit a new one.');
      }
    } catch (err: any) {
      console.error('Failed to verify proof:', err);
      alert(err.response?.data?.error || 'Failed to verify proof');
    }
  };

  const handleStartChallenge = async (challengeType: string) => {
    if (!selectedUser1 || !user?.id) return;
    try {
      const response = await chatEngagementAPI.createChallenge({
        otherUserId: selectedUser1.id,
        challengeType,
        userId: user.id,
      });
      setCurrentChallenge(response.challenge);
      setShowChallengeModal(false);
      
      // Initialize game state based on type
      if (challengeType === 'xo') {
        setChallengeGameState({ board: Array(9).fill(null), currentPlayer: 'X', moves: 0 });
      }
    } catch (err: any) {
      console.error('Failed to create challenge:', err);
      alert(err.response?.data?.error || 'Failed to start challenge');
    }
  };

  const handleChallengeMove = async (move: any) => {
    if (!currentChallenge || !user?.id) return;
    try {
      const updatedState = { ...challengeGameState, ...move };
      setChallengeGameState(updatedState);
      
      await chatEngagementAPI.updateChallenge({
        challengeId: currentChallenge.id,
        gameState: updatedState,
      });
    } catch (err) {
      console.error('Failed to update challenge:', err);
    }
  };

  const handleBlock = async (userId: string) => {
    const userToBlock = availableUsers.find(u => u.id === userId);
    if (!userToBlock) return;
    if (window.confirm(`Are you sure you want to block ${userToBlock.name}?`)) {
      try {
        await chatAPI.blockUser(userId);
        if (selectedUser1?.id === userId) {
          setSelectedUser1(null);
          setRatings1(null);
        }
        if (selectedUser2?.id === userId) {
          setSelectedUser2(null);
          setRatings2(null);
        }
        await loadAvailableUsers();
        await loadConversations();
      } catch (err) {
        console.error('Failed to block user', err);
        alert('Failed to block user');
      }
    }
  };

  const handleMute = async (userId: string) => {
    const userToMute = availableUsers.find(u => u.id === userId);
    if (!userToMute) return;
    try {
      await chatAPI.muteUser(userId);
      alert(`${userToMute.name} has been muted`);
    } catch (err) {
      console.error('Failed to mute user', err);
      alert('Failed to mute user');
    }
  };

  const handleShareDateInfo = async (contactIds: string[]) => {
    if (!selectedUser1) return;
    
    const location = prompt('Enter the date location:');
    if (!location) return;
    
    const date = prompt('Enter the date and time (e.g., "Friday 7pm"):');
    if (!date) return;
    
    const notes = prompt('Any additional notes? (optional):') || '';

    try {
      await safetyAPI.shareDateInfo({
        dateUserId: selectedUser1.id,
        location,
        date,
        notes,
        contactIds,
      });
      alert('Date information shared with emergency contacts!');
      setShowEmergencyShare(false);
    } catch (err) {
      console.error('Failed to share date info', err);
      alert('Failed to share date information');
    }
  };

  const handleStartCoachingSession = async (coachId: string) => {
    if (!selectedUser1) return;
    
    // Find conversation ID - we'll use a combination of user IDs
    const conversationId = `${user!.id}_${selectedUser1.id}`;
    
    try {
      const response = await safetyAPI.startCoachingSession({
        coachId,
        conversationId,
      });
      setActiveCoachingSession(response.session);
      setSelectedCoach(textingCoaches.find(c => c.id === coachId) || null);
      setShowTextingCoach(false);
      alert('Coaching session started! Your coach can now help you with your conversation.');
    } catch (err: any) {
      console.error('Failed to start coaching session', err);
      alert(err.response?.data?.error || 'Failed to start coaching session');
    }
  };

  const handleEndCoachingSession = async () => {
    if (!activeCoachingSession) return;
    
    const amount = prompt('Enter the amount you want to pay (e.g., 25):');
    if (!amount || isNaN(parseFloat(amount))) {
      alert('Please enter a valid amount');
      return;
    }

    const rating = prompt('Rate your coach (1-5):');
    const comment = prompt('Leave a comment (optional):') || '';

    try {
      await safetyAPI.endCoachingSession({
        sessionId: activeCoachingSession.id,
        amount: parseFloat(amount),
        coachId: activeCoachingSession.coachId,
        rating: rating ? parseInt(rating) : undefined,
        comment: comment || undefined,
      });
      setActiveCoachingSession(null);
      setSelectedCoach(null);
      alert('Coaching session completed! Thank you for your payment.');
      await loadTextingCoaches(); // Refresh to update ratings
    } catch (err) {
      console.error('Failed to end coaching session', err);
      alert('Failed to end coaching session');
    }
  };

  const isSelected = (userId: string) => {
    return selectedUser1?.id === userId || selectedUser2?.id === userId;
  };

  const getOverallRating = (ratings: AverageRatings | null) => {
    return ratings?.overallRating || 0;
  };

  return (
    <div className="widget-full-content" style={{ display: 'flex', height: '100%', gap: '20px' }}>
      {/* Left Panel: User List (FIFA Squad Style) */}
      <div style={{ 
        width: '300px', 
        background: 'rgba(0, 0, 0, 0.3)', 
        border: '1px solid rgba(0, 212, 255, 0.5)',
        borderRadius: '8px',
        padding: '16px',
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 200px)'
      }}>
        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
          <h3 style={{ color: '#00d4ff', margin: '0 0 8px 0', fontSize: '18px', fontFamily: 'Orbitron, monospace' }}>
            CONVERSATIONS
          </h3>
        </div>
        {availableUsers.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>No conversations</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {availableUsers.map((u) => {
              const selected = isSelected(u.id);
              const overall = selected 
                ? (selectedUser1?.id === u.id ? getOverallRating(ratings1) : getOverallRating(ratings2))
                : 0;
              
              return (
                <div
                  key={u.id}
                  onClick={() => {
                    if (!selectedUser1) {
                      handleSelectUser(u, 1);
                    } else if (!selectedUser2 && selectedUser1.id !== u.id) {
                      handleSelectUser(u, 2);
                    } else if (selected) {
                      // Deselect
                      if (selectedUser1?.id === u.id) {
                        setSelectedUser1(null);
                        setRatings1(null);
                      } else if (selectedUser2?.id === u.id) {
                        setSelectedUser2(null);
                        setRatings2(null);
                      }
                    }
                  }}
                  style={{
                    padding: '12px',
                    background: selected ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: selected ? '2px solid #00d4ff' : '1px solid rgba(0, 212, 255, 0.3)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    filter: selected ? 'none' : (selectedUser1 && selectedUser2 ? 'blur(3px)' : 'none'),
                    opacity: selected ? 1 : (selectedUser1 && selectedUser2 ? 0.5 : 1),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (!selected && (!selectedUser1 || !selectedUser2)) {
                      e.currentTarget.style.background = 'rgba(0, 212, 255, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selected) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }
                  }}
                >
                  <div className="user-avatar" style={{ width: '40px', height: '40px', flexShrink: 0 }}>
                    {u.profilePicture ? (
                      <img src={u.profilePicture} alt={u.name} />
                    ) : (
                      <div className="avatar-placeholder">{u.name[0]}</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', color: selected ? '#00d4ff' : '#fff', fontWeight: selected ? 'bold' : 'normal' }}>
                        {u.name}
                      </h4>
                      {selected && overall > 0 && (
                        <span style={{ 
                          fontSize: '12px', 
                          color: '#ff00ff', 
                          fontWeight: 'bold',
                          fontFamily: 'Orbitron, monospace'
                        }}>
                          {overall} OVR
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>@{u.username}</p>
                  </div>
                  {selected && (
                    <div style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      width: '8px',
                      height: '8px',
                      background: '#00d4ff',
                      borderRadius: '50%',
                      boxShadow: '0 0 8px #00d4ff'
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Panel: Comparison View (FIFA Style) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!selectedUser1 ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            color: '#6b7280',
            textAlign: 'center'
          }}>
            <div>
              <p style={{ fontSize: '18px', marginBottom: '8px' }}>Select users to compare</p>
              <p style={{ fontSize: '14px' }}>Click on users from the list to start comparing</p>
            </div>
          </div>
        ) : (
          <div style={{ 
            display: 'flex', 
            gap: '20px', 
            height: '100%',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(0, 212, 255, 0.5)',
            borderRadius: '8px',
            padding: '20px'
          }}>
            {/* User 1 Panel */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div className="user-avatar" style={{ 
                  width: '80px', 
                  height: '80px', 
                  margin: '0 auto 12px',
                  border: '3px solid #00d4ff',
                  borderRadius: '50%',
                  boxShadow: '0 0 20px rgba(0, 212, 255, 0.5)'
                }}>
                  {selectedUser1.profilePicture ? (
                    <img src={selectedUser1.profilePicture} alt={selectedUser1.name} />
                  ) : (
                    <div className="avatar-placeholder">{selectedUser1.name[0]}</div>
                  )}
                </div>
                <h3 style={{ color: '#00d4ff', margin: '0 0 8px 0', fontSize: '20px', fontFamily: 'Orbitron, monospace' }}>
                  {selectedUser1.name}
                </h3>
                {ratings1 && (
                  <div style={{ fontSize: '24px', color: '#ff00ff', fontWeight: 'bold', fontFamily: 'Orbitron, monospace' }}>
                    {ratings1.overallRating} OVR
                  </div>
                )}
              </div>

              {/* Comparison Attributes */}
              {ratings1 && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <div style={{ 
                    background: 'rgba(0, 0, 0, 0.4)', 
                    borderRadius: '8px', 
                    padding: '12px',
                    marginBottom: '12px'
                  }}>
                    <h4 style={{ color: '#00d4ff', margin: '0 0 12px 0', fontSize: '14px', fontFamily: 'Orbitron, monospace' }}>
                      DATING CHARACTERISTICS
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <AttributeRow label="Communication" value={ratings1.characteristics.communication} />
                      <AttributeRow label="Personality" value={ratings1.characteristics.personality} />
                      <AttributeRow label="Compatibility" value={ratings1.characteristics.compatibility} />
                      <AttributeRow label="Humor" value={ratings1.characteristics.humor} />
                      <AttributeRow label="Intelligence" value={ratings1.characteristics.intelligence} />
                      <AttributeRow label="Kindness" value={ratings1.characteristics.kindness} />
                      <AttributeRow label="Confidence" value={ratings1.characteristics.confidence} />
                      <AttributeRow label="Attractiveness" value={ratings1.characteristics.attractiveness} />
                      {ratings1.characteristics.bedroom !== null && (
                        <AttributeRow label="Bedroom" value={ratings1.characteristics.bedroom} />
                      )}
                      {ratings1.characteristics.kissing !== null && (
                        <AttributeRow label="Kissing" value={ratings1.characteristics.kissing} />
                      )}
                    </div>
                    <div style={{ marginTop: '12px', fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
                      Based on {ratings1.totalRatings} {ratings1.totalRatings === 1 ? 'rating' : 'ratings'} from past encounters
                    </div>
                  </div>
                </div>
              )}

              {/* Chat Section for User 1 */}
              <div style={{ 
                borderTop: '1px solid rgba(0, 212, 255, 0.3)', 
                paddingTop: '12px',
                marginTop: '12px'
              }}>
                <div style={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto', 
                  marginBottom: '12px',
                  padding: '8px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '6px'
                }}>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      style={{
                        marginBottom: '8px',
                        padding: '6px 10px',
                        background: msg.fromUserId === user?.id ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 0, 255, 0.2)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        textAlign: msg.fromUserId === user?.id ? 'right' : 'left',
                      }}
                    >
                      <p style={{ margin: 0, color: '#fff' }}>{msg.content}</p>
                      <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
                {(() => {
                  const myPendingProof = pendingProofs.find(p => p.fromUserId === user?.id && p.toUserId === selectedUser1.id && p.status === 'pending');
                  const isBlocked = !!myPendingProof;
                  
                  return (
                    <>
                      {isBlocked && (
                        <div style={{
                          padding: '8px',
                          background: 'rgba(255, 0, 255, 0.2)',
                          border: '1px solid #ff00ff',
                          borderRadius: '6px',
                          marginBottom: '8px',
                          fontSize: '11px',
                          color: '#ff00ff',
                          textAlign: 'center'
                        }}>
                          ⚠️ Chat blocked: Your proof of love is pending verification
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          value={messageContent}
                          onChange={(e) => setMessageContent(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder={isBlocked ? "Waiting for proof verification..." : "Type a message..."}
                          disabled={isBlocked}
                          style={{
                            flex: 1,
                            padding: '8px',
                            background: isBlocked ? 'rgba(107, 114, 128, 0.2)' : 'rgba(0, 0, 0, 0.4)',
                            border: `1px solid ${isBlocked ? 'rgba(107, 114, 128, 0.3)' : 'rgba(0, 212, 255, 0.3)'}`,
                            borderRadius: '6px',
                            color: isBlocked ? '#6b7280' : '#fff',
                            fontSize: '12px',
                            cursor: isBlocked ? 'not-allowed' : 'text'
                          }}
                        />
                        <button 
                          onClick={handleSendMessage}
                          disabled={isBlocked}
                          className="send-btn"
                          style={{ 
                            padding: '8px 16px', 
                            fontSize: '12px',
                            opacity: isBlocked ? 0.5 : 1,
                            cursor: isBlocked ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Send
                        </button>
                      </div>
                    </>
                  );
                })()}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    onClick={() => handleUnmatch(selectedUser1.id)}
                    style={{
                      flex: 1,
                      padding: '6px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid #ef4444',
                      borderRadius: '6px',
                      color: '#ef4444',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    Unmatch
                  </button>
                  <button
                    onClick={() => handleBlock(selectedUser1.id)}
                    style={{
                      flex: 1,
                      padding: '6px',
                      background: 'rgba(107, 114, 128, 0.2)',
                      border: '1px solid #6b7280',
                      borderRadius: '6px',
                      color: '#6b7280',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    Block
                  </button>
                </div>
              </div>
            </div>

            {/* User 2 Panel (if selected) */}
            {selectedUser2 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(0, 212, 255, 0.3)', paddingLeft: '20px' }}>
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <div className="user-avatar" style={{ 
                    width: '80px', 
                    height: '80px', 
                    margin: '0 auto 12px',
                    border: '3px solid #ff00ff',
                    borderRadius: '50%',
                    boxShadow: '0 0 20px rgba(255, 0, 255, 0.5)'
                  }}>
                    {selectedUser2.profilePicture ? (
                      <img src={selectedUser2.profilePicture} alt={selectedUser2.name} />
                    ) : (
                      <div className="avatar-placeholder">{selectedUser2.name[0]}</div>
                    )}
                  </div>
                  <h3 style={{ color: '#ff00ff', margin: '0 0 8px 0', fontSize: '20px', fontFamily: 'Orbitron, monospace' }}>
                    {selectedUser2.name}
                  </h3>
                  {ratings2 && (
                    <div style={{ fontSize: '24px', color: '#ff00ff', fontWeight: 'bold', fontFamily: 'Orbitron, monospace' }}>
                      {ratings2.overallRating} OVR
                    </div>
                  )}
                </div>

                {/* Comparison Attributes */}
                {ratings2 && (
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <div style={{ 
                      background: 'rgba(0, 0, 0, 0.4)', 
                      borderRadius: '8px', 
                      padding: '12px',
                      marginBottom: '12px'
                    }}>
                      <h4 style={{ color: '#ff00ff', margin: '0 0 12px 0', fontSize: '14px', fontFamily: 'Orbitron, monospace' }}>
                        DATING CHARACTERISTICS
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <AttributeRow label="Communication" value={ratings2.characteristics.communication} compareValue={ratings1?.characteristics.communication} />
                        <AttributeRow label="Personality" value={ratings2.characteristics.personality} compareValue={ratings1?.characteristics.personality} />
                        <AttributeRow label="Compatibility" value={ratings2.characteristics.compatibility} compareValue={ratings1?.characteristics.compatibility} />
                        <AttributeRow label="Humor" value={ratings2.characteristics.humor} compareValue={ratings1?.characteristics.humor} />
                        <AttributeRow label="Intelligence" value={ratings2.characteristics.intelligence} compareValue={ratings1?.characteristics.intelligence} />
                        <AttributeRow label="Kindness" value={ratings2.characteristics.kindness} compareValue={ratings1?.characteristics.kindness} />
                        <AttributeRow label="Confidence" value={ratings2.characteristics.confidence} compareValue={ratings1?.characteristics.confidence} />
                        <AttributeRow label="Attractiveness" value={ratings2.characteristics.attractiveness} compareValue={ratings1?.characteristics.attractiveness} />
                        {ratings2.characteristics.bedroom !== null && (
                          <AttributeRow label="Bedroom" value={ratings2.characteristics.bedroom} compareValue={ratings1?.characteristics.bedroom || undefined} />
                        )}
                        {ratings2.characteristics.kissing !== null && (
                          <AttributeRow label="Kissing" value={ratings2.characteristics.kissing} compareValue={ratings1?.characteristics.kissing || undefined} />
                        )}
                      </div>
                      <div style={{ marginTop: '12px', fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
                        Based on {ratings2.totalRatings} {ratings2.totalRatings === 1 ? 'rating' : 'ratings'} from past encounters
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    onClick={() => handleUnmatch(selectedUser2.id)}
                    style={{
                      flex: 1,
                      padding: '6px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid #ef4444',
                      borderRadius: '6px',
                      color: '#ef4444',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    Unmatch
                  </button>
                  <button
                    onClick={() => handleBlock(selectedUser2.id)}
                    style={{
                      flex: 1,
                      padding: '6px',
                      background: 'rgba(107, 114, 128, 0.2)',
                      border: '1px solid #6b7280',
                      borderRadius: '6px',
                      color: '#6b7280',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    Block
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                borderLeft: '1px solid rgba(0, 212, 255, 0.3)',
                paddingLeft: '20px',
                color: '#6b7280',
                textAlign: 'center'
              }}>
                <div>
                  <p style={{ fontSize: '16px', marginBottom: '8px' }}>Select second user</p>
                  <p style={{ fontSize: '12px' }}>Click another user to compare</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unmatch Reason Modal */}
      {showUnmatchModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'rgba(10, 10, 30, 0.95)',
            border: '2px solid #00d4ff',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 0 30px rgba(0, 212, 255, 0.5)'
          }}>
            <h3 style={{ color: '#00d4ff', marginTop: 0, fontFamily: 'Orbitron, monospace' }}>
              Unmatch Reason
            </h3>
            <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '16px' }}>
              Please provide a reason for unmatching. The other person will see this reason.
            </p>
            <textarea
              value={unmatchReason}
              onChange={(e) => setUnmatchReason(e.target.value)}
              placeholder="Enter reason (e.g., 'Not compatible', 'Not interested', 'Found someone else', etc.)"
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '12px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                marginBottom: '16px'
              }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleSubmitUnmatch}
                disabled={!unmatchReason.trim()}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: unmatchReason.trim() ? 'rgba(239, 68, 68, 0.3)' : 'rgba(107, 114, 128, 0.2)',
                  border: `1px solid ${unmatchReason.trim() ? '#ef4444' : '#6b7280'}`,
                  borderRadius: '8px',
                  color: unmatchReason.trim() ? '#ef4444' : '#6b7280',
                  fontSize: '14px',
                  cursor: unmatchReason.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'Orbitron, monospace',
                  fontWeight: 'bold'
                }}
              >
                Unmatch
              </button>
              <button
                onClick={() => {
                  setShowUnmatchModal(false);
                  setUnmatchReason('');
                  setUnmatchingUserId(null);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'rgba(107, 114, 128, 0.2)',
                  border: '1px solid #6b7280',
                  borderRadius: '8px',
                  color: '#6b7280',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontFamily: 'Orbitron, monospace'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unmatch Reasons Notification */}
      {unmatchReasons.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: 'rgba(255, 0, 255, 0.2)',
          border: '2px solid #ff00ff',
          borderRadius: '12px',
          padding: '16px',
          maxWidth: '400px',
          boxShadow: '0 0 20px rgba(255, 0, 255, 0.5)',
          zIndex: 1500
        }}>
          <h4 style={{ color: '#ff00ff', margin: '0 0 8px 0', fontSize: '14px', fontFamily: 'Orbitron, monospace' }}>
            Unmatch Reasons ({unmatchReasons.length})
          </h4>
          {unmatchReasons.slice(0, 3).map((reason) => {
            const fromUser = availableUsers.find(u => u.id === reason.fromUserId);
            return (
              <div key={reason.id} style={{ marginBottom: '8px', padding: '8px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '6px' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#fff' }}>
                  <strong>{fromUser?.name || 'Someone'}</strong> unmatched you:
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>
                  "{reason.reason}"
                </p>
                <button
                  onClick={() => handleViewUnmatchReason(reason.id)}
                  style={{
                    marginTop: '6px',
                    padding: '4px 8px',
                    background: 'rgba(0, 212, 255, 0.2)',
                    border: '1px solid #00d4ff',
                    borderRadius: '4px',
                    color: '#00d4ff',
                    fontSize: '10px',
                    cursor: 'pointer'
                  }}
                >
                  Mark as Read
                </button>
              </div>
            );
          })}
          {unmatchReasons.length > 3 && (
            <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
              +{unmatchReasons.length - 3} more
            </p>
          )}
        </div>
      )}

      {/* Emergency Share Modal */}
      {showEmergencyShare && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ marginTop: 0 }}>Share Date Information</h3>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
              Select emergency contacts to share your date information with:
            </p>
            {emergencyContacts.length === 0 ? (
              <div>
                <p>No emergency contacts added yet.</p>
                <button 
                  onClick={() => {
                    setShowEmergencyShare(false);
                    alert('Go to Settings to add emergency contacts');
                  }}
                  className="select-user-btn"
                >
                  Add Emergency Contacts
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {emergencyContacts.map(contact => (
                  <label key={contact.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" value={contact.id} />
                    <div>
                      <strong>{contact.name}</strong>
                      <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                        {contact.phone} {contact.relationship && `• ${contact.relationship}`}
                      </p>
                    </div>
                  </label>
                ))}
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button
                    onClick={() => {
                      const selected = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
                        .map(cb => (cb as HTMLInputElement).value);
                      if (selected.length === 0) {
                        alert('Please select at least one emergency contact');
                        return;
                      }
                      handleShareDateInfo(selected);
                    }}
                    className="select-user-btn"
                    style={{ flex: 1 }}
                  >
                    Share
                  </button>
                  <button
                    onClick={() => setShowEmergencyShare(false)}
                    style={{ flex: 1, padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Texting Coach Selection Modal */}
      {showTextingCoach && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ marginTop: 0 }}>Choose a Texting Coach</h3>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
              Select an expert to help you with your conversation:
            </p>
            {textingCoaches.length === 0 ? (
              <p>No texting coaches available at the moment.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {textingCoaches
                  .filter(coach => coach.isActive)
                  .map(coach => (
                    <div
                      key={coach.id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#ff6b9d';
                        e.currentTarget.style.background = '#fff5f8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.background = 'white';
                      }}
                      onClick={() => handleStartCoachingSession(coach.id)}
                    >
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div className="user-avatar" style={{ width: '50px', height: '50px' }}>
                          {coach.profilePicture ? (
                            <img src={coach.profilePicture} alt={coach.name} />
                          ) : (
                            <div className="avatar-placeholder">{coach.name[0]}</div>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <h4 style={{ margin: 0, fontSize: '16px' }}>{coach.name}</h4>
                            <span style={{ fontSize: '12px', color: '#10b981' }}>● Active</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                            ⭐ {coach.rating.toFixed(1)} • {coach.totalHelps} helps • ${coach.hourlyRate}/hr
                          </p>
                          {coach.bio && (
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>
                              {coach.bio}
                            </p>
                          )}
                          {coach.reviews.length > 0 && (
                            <div style={{ marginTop: '8px' }}>
                              <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
                                "{coach.reviews[coach.reviews.length - 1].comment}"
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            <button
              onClick={() => setShowTextingCoach(false)}
              style={{ 
                marginTop: '16px', 
                width: '100%', 
                padding: '10px', 
                border: '1px solid #e5e7eb', 
                borderRadius: '8px', 
                background: 'white',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Proof of Love Modal */}
      {showProofModal && selectedUser1 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3000
        }}>
          <div style={{
            background: 'rgba(10, 10, 30, 0.95)',
            border: '3px solid #ff00ff',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '600px',
            width: '90%',
            boxShadow: '0 0 40px rgba(255, 0, 255, 0.6)',
            textAlign: 'center'
          }}>
            <h2 style={{ color: '#ff00ff', marginTop: 0, fontFamily: 'Orbitron, monospace', fontSize: '24px' }}>
              💖 PROOF OF LOVE REQUIRED
            </h2>
            <p style={{ color: '#fff', fontSize: '16px', marginBottom: '24px', lineHeight: '1.6' }}>
              {proofPrompt}
            </p>
            <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '20px' }}>
              Submit a video or picture showing you completed this task. {selectedUser1.name} will verify it before you can continue chatting.
            </p>
            
            {proofMedia ? (
              <div style={{ marginBottom: '20px' }}>
                {proofMedia.startsWith('data:video') ? (
                  <video src={proofMedia} controls style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' }} />
                ) : (
                  <img src={proofMedia} alt="Proof" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' }} />
                )}
                <button
                  onClick={() => setProofMedia('')}
                  style={{
                    marginTop: '8px',
                    padding: '6px 12px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid #ef4444',
                    borderRadius: '6px',
                    color: '#ef4444',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => proofFileInputRef.current?.click()}
                style={{
                  padding: '12px 24px',
                  background: 'rgba(255, 0, 255, 0.2)',
                  border: '2px solid #ff00ff',
                  borderRadius: '8px',
                  color: '#ff00ff',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontFamily: 'Orbitron, monospace',
                  fontWeight: 'bold',
                  marginBottom: '20px'
                }}
              >
                📷 Upload Photo/Video
              </button>
            )}
            
            <input
              ref={proofFileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleProofMediaChange}
              style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                onClick={handleSubmitProof}
                disabled={!proofMedia}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: proofMedia ? 'rgba(255, 0, 255, 0.3)' : 'rgba(107, 114, 128, 0.2)',
                  border: `2px solid ${proofMedia ? '#ff00ff' : '#6b7280'}`,
                  borderRadius: '8px',
                  color: proofMedia ? '#ff00ff' : '#6b7280',
                  fontSize: '14px',
                  cursor: proofMedia ? 'pointer' : 'not-allowed',
                  fontFamily: 'Orbitron, monospace',
                  fontWeight: 'bold'
                }}
              >
                Submit Proof
              </button>
              <button
                onClick={() => {
                  setShowProofModal(false);
                  setProofPrompt('');
                  setProofMedia('');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'rgba(107, 114, 128, 0.2)',
                  border: '2px solid #6b7280',
                  borderRadius: '8px',
                  color: '#6b7280',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontFamily: 'Orbitron, monospace'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Proof Verification */}
      {pendingProofs.length > 0 && selectedUser1 && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          right: '20px',
          background: 'rgba(255, 0, 255, 0.2)',
          border: '2px solid #ff00ff',
          borderRadius: '12px',
          padding: '16px',
          maxWidth: '400px',
          boxShadow: '0 0 20px rgba(255, 0, 255, 0.5)',
          zIndex: 1500
        }}>
          <h4 style={{ color: '#ff00ff', margin: '0 0 12px 0', fontSize: '14px', fontFamily: 'Orbitron, monospace' }}>
            ⚠️ Pending Proof Verification
          </h4>
          {pendingProofs.map((proof) => {
            const fromUser = availableUsers.find(u => u.id === proof.fromUserId);
            return (
              <div key={proof.id} style={{ marginBottom: '12px', padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#fff' }}>
                  <strong>{fromUser?.name || 'Someone'}</strong> submitted:
                </p>
                <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>
                  "{proof.prompt}"
                </p>
                {proof.mediaUrl.startsWith('data:video') ? (
                  <video src={proof.mediaUrl} controls style={{ width: '100%', maxHeight: '200px', borderRadius: '6px', marginBottom: '8px' }} />
                ) : (
                  <img src={proof.mediaUrl} alt="Proof" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} />
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleVerifyProof(proof.id, true)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid #10b981',
                      borderRadius: '6px',
                      color: '#10b981',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontFamily: 'Orbitron, monospace'
                    }}
                  >
                    ✓ Verify
                  </button>
                  <button
                    onClick={() => handleVerifyProof(proof.id, false)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid #ef4444',
                      borderRadius: '6px',
                      color: '#ef4444',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontFamily: 'Orbitron, monospace'
                    }}
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connection Prompt Modal */}
      {showConnectionPrompt && connectionPrompt && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(10, 10, 30, 0.95)',
          border: '2px solid #00d4ff',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 0 30px rgba(0, 212, 255, 0.5)',
          zIndex: 2500,
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#00d4ff', marginTop: 0, fontFamily: 'Orbitron, monospace' }}>
            💬 Connection Prompt
          </h3>
          <p style={{ color: '#fff', fontSize: '16px', marginBottom: '20px', lineHeight: '1.6' }}>
            {connectionPrompt.prompt}
          </p>
          <button
            onClick={async () => {
              await chatEngagementAPI.markPromptResponded(connectionPrompt.id);
              setShowConnectionPrompt(false);
              setConnectionPrompt(null);
            }}
            style={{
              padding: '12px 24px',
              background: 'rgba(0, 212, 255, 0.3)',
              border: '2px solid #00d4ff',
              borderRadius: '8px',
              color: '#00d4ff',
              fontSize: '14px',
              cursor: 'pointer',
              fontFamily: 'Orbitron, monospace',
              fontWeight: 'bold'
            }}
          >
            Got It!
          </button>
        </div>
      )}

      {/* Challenge Modal */}
      {showChallengeModal && selectedUser1 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3000
        }}>
          <div style={{
            background: 'rgba(10, 10, 30, 0.95)',
            border: '3px solid #00d4ff',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 0 40px rgba(0, 212, 255, 0.6)',
            textAlign: 'center'
          }}>
            <h2 style={{ color: '#00d4ff', marginTop: 0, fontFamily: 'Orbitron, monospace', fontSize: '24px' }}>
              🎮 Challenge Time!
            </h2>
            <p style={{ color: '#fff', fontSize: '16px', marginBottom: '24px' }}>
              Start a fun challenge with {selectedUser1.name}!
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <button
                onClick={() => handleStartChallenge('xo')}
                style={{
                  padding: '12px',
                  background: 'rgba(0, 212, 255, 0.2)',
                  border: '2px solid #00d4ff',
                  borderRadius: '8px',
                  color: '#00d4ff',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontFamily: 'Orbitron, monospace'
                }}
              >
                ⭕ Tic-Tac-Toe (XO)
              </button>
              <button
                onClick={() => handleStartChallenge('would-you-rather')}
                style={{
                  padding: '12px',
                  background: 'rgba(0, 212, 255, 0.2)',
                  border: '2px solid #00d4ff',
                  borderRadius: '8px',
                  color: '#00d4ff',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontFamily: 'Orbitron, monospace'
                }}
              >
                🤔 Would You Rather
              </button>
              <button
                onClick={() => handleStartChallenge('truth-or-dare')}
                style={{
                  padding: '12px',
                  background: 'rgba(0, 212, 255, 0.2)',
                  border: '2px solid #00d4ff',
                  borderRadius: '8px',
                  color: '#00d4ff',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontFamily: 'Orbitron, monospace'
                }}
              >
                🎲 Truth or Dare
              </button>
            </div>
            <button
              onClick={() => setShowChallengeModal(false)}
              style={{
                padding: '10px 20px',
                background: 'rgba(107, 114, 128, 0.2)',
                border: '2px solid #6b7280',
                borderRadius: '8px',
                color: '#6b7280',
                fontSize: '14px',
                cursor: 'pointer',
                fontFamily: 'Orbitron, monospace'
              }}
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}

      {/* Active Challenge Display */}
      {currentChallenge && challengeGameState && currentChallenge.challengeType === 'xo' && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          background: 'rgba(0, 0, 0, 0.8)',
          border: '2px solid #00d4ff',
          borderRadius: '12px',
          padding: '16px',
          maxWidth: '300px',
          boxShadow: '0 0 20px rgba(0, 212, 255, 0.5)',
          zIndex: 1500
        }}>
          <h4 style={{ color: '#00d4ff', margin: '0 0 12px 0', fontSize: '14px', fontFamily: 'Orbitron, monospace' }}>
            🎮 Active Challenge - Tic-Tac-Toe
          </h4>
          <p style={{ color: '#fff', fontSize: '12px', marginBottom: '8px' }}>
            Current Player: <strong style={{ color: '#00d4ff' }}>{challengeGameState.currentPlayer}</strong>
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '4px',
            marginBottom: '8px'
          }}>
            {Array(9).fill(null).map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (!challengeGameState.board[idx]) {
                    const newBoard = [...challengeGameState.board];
                    newBoard[idx] = challengeGameState.currentPlayer;
                    const nextPlayer = challengeGameState.currentPlayer === 'X' ? 'O' : 'X';
                    handleChallengeMove({
                      board: newBoard,
                      currentPlayer: nextPlayer,
                      moves: challengeGameState.moves + 1
                    });
                  }
                }}
                disabled={!!challengeGameState.board[idx]}
                style={{
                  width: '60px',
                  height: '60px',
                  background: challengeGameState.board[idx] ? 'rgba(0, 212, 255, 0.3)' : 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid #00d4ff',
                  borderRadius: '6px',
                  color: '#00d4ff',
                  fontSize: '24px',
                  fontFamily: 'Orbitron, monospace',
                  fontWeight: 'bold',
                  cursor: challengeGameState.board[idx] ? 'not-allowed' : 'pointer',
                }}
              >
                {challengeGameState.board[idx] || ''}
              </button>
            ))}
          </div>
          <button
            onClick={async () => {
              await chatEngagementAPI.updateChallenge({
                challengeId: currentChallenge.id,
                status: 'completed'
              });
              setCurrentChallenge(null);
              setChallengeGameState(null);
            }}
            style={{
              padding: '6px 12px',
              background: 'rgba(107, 114, 128, 0.2)',
              border: '1px solid #6b7280',
              borderRadius: '6px',
              color: '#6b7280',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            End Game
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatWidgetFull;
