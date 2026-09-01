import { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, Link, useLocation, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { AuthContext } from '../context/AuthContext';
import { profileAPI, ProfileData } from '../api/profile';
import PhotoVerificationModal from '../components/PhotoVerificationModal';
import { activityAPI } from '../api/activity';
import { improvementAPI } from '../api/improvement';
import { reviewsAPI, Review, OverallStarRating, REVIEW_ATTRIBUTE_LABELS } from '../api/reviews';
import HealthProofSection from '../components/HealthProofSection';
import { healthAPI, HealthTest } from '../api/health';
import { postsAPI, DatingPost } from '../api/posts';
import ProfileMedia from '../components/ProfileMedia';
import { getCountryFlagCode } from '../constants/countryFlags';
import { useTranslation } from '../context/LanguageContext';
import { chatAPI } from '../api/chat';
import { isVideoMediaUrl } from '../lib/media';
import { prepareAndUploadFile } from '../lib/uploadMedia';
import { formatAxiosError } from '../lib/apiError';
import { connectionsAPI } from '../api/connections';
import { requestGpsFromUserTap, markLocationGranted } from '../lib/locationSession';
import './Dashboard.css';

function buildSessionProfile(user: {
  id: string;
  email?: string;
  name?: string;
  username?: string;
  profilePicture?: string | null;
  profileSetupComplete?: boolean;
  gender?: string;
  photoVerifiedAt?: string | null;
  highlights?: ProfileData['highlights'];
  stories?: ProfileData['stories'];
}): ProfileData {
  return {
    id: user.id,
    email: user.email || '',
    name: user.name || '',
    username: user.username || '',
    profilePicture: user.profilePicture ?? null,
    profileSetupComplete: Boolean(user.profileSetupComplete),
    highlights: user.highlights || [],
    stories: user.stories || [],
    disappearingPhotos: [],
    gender: user.gender,
    photoVerifiedAt: user.photoVerifiedAt ?? null,
  };
}

const Profile = () => {
  const { user, logout, updateUser } = useContext(AuthContext);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { userId: paramUserId } = useParams<{ userId?: string }>();
  const fromHelp = !!(location.state as { fromHelp?: boolean } | null)?.fromHelp;
  const fromChat = !!(location.state as { fromChat?: boolean } | null)?.fromChat;
  const returnChatUserId = (location.state as { chatUserId?: string } | null)?.chatUserId;
  const pathUserId = location.pathname.match(/^\/profile\/([^/]+)$/)?.[1];
  const routeUserId = paramUserId || pathUserId;
  const viewingUserId = routeUserId && routeUserId !== 'me' ? routeUserId : user?.id;
  const isOwnProfile = Boolean(user?.id && viewingUserId && String(viewingUserId) === String(user.id));
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [matchScore, setMatchScore] = useState(0);
  const [age, setAge] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [viewingHighlight, setViewingHighlight] = useState<any>(null);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  const [pendingStoryFile, setPendingStoryFile] = useState<File | null>(null);
  const [showStoryAudiencePicker, setShowStoryAudiencePicker] = useState(false);
  const [storyAudienceBusy, setStoryAudienceBusy] = useState<'all' | 'closeFriends' | null>(null);
  const [viewingStories, setViewingStories] = useState<{ items: any[]; index: number } | null>(null);
  const [closeFriendCandidates, setCloseFriendCandidates] = useState<Array<{ id: string; name: string }>>([]);
  const [highlightPickForStory, setHighlightPickForStory] = useState<string>('__new__');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [overallRating, setOverallRating] = useState<OverallStarRating | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [courtDraft, setCourtDraft] = useState<Record<string, { summary: string; note: string; confirm: boolean }>>({});
  const [courtSubmittingId, setCourtSubmittingId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [locationDetecting, setLocationDetecting] = useState(false);
  const [publicFigureLevel, setPublicFigureLevel] = useState<string>('');
  const [publicFigureProof, setPublicFigureProof] = useState('');
  const [publicFigureIdImage, setPublicFigureIdImage] = useState<string>('');
  const [publicFigureUniqueImage, setPublicFigureUniqueImage] = useState<string>('');
  const [publicFigureProofType, setPublicFigureProofType] = useState<'social' | 'unique'>('social');
  const [publicFigureAgreedToLegal, setPublicFigureAgreedToLegal] = useState(false);
  const [showPublicFigureApplyForm, setShowPublicFigureApplyForm] = useState(false);
  const [celebChatDisappearMode, setCelebChatDisappearMode] = useState<string>('none');
  const [celebChatDisappearSeconds, setCelebChatDisappearSeconds] = useState(60);
  const [celebMessagesOnlyWhenOpened, setCelebMessagesOnlyWhenOpened] = useState(false);
  const [celebSaving, setCelebSaving] = useState(false);
  const [celebConnections, setCelebConnections] = useState<Array<{ id: string; name: string }>>([]);
  const [inRelationship, setInRelationship] = useState(false);
  const [showPhotoVerification, setShowPhotoVerification] = useState(false);
  const [syncWarning, setSyncWarning] = useState('');
  const [profilePosts, setProfilePosts] = useState<DatingPost[]>([]);
  const [expandedPostComments, setExpandedPostComments] = useState<string | null>(null);
  const [postCommentDraft, setPostCommentDraft] = useState<Record<string, string>>({});
  const [healthViewStatus, setHealthViewStatus] = useState<{
    request: { status: string } | null;
    canView: boolean;
    canRequest?: boolean;
    results: { tests: HealthTest[]; lastUpdated: string } | null;
  } | null>(null);
  const [healthViewLoading, setHealthViewLoading] = useState(false);
  const [healthRequesting, setHealthRequesting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const highlightInputRef = useRef<HTMLInputElement>(null);
  const storyInputRef = useRef<HTMLInputElement>(null);
  const storyVideoRef = useRef<HTMLVideoElement>(null);
  const publicFigureIdInputRef = useRef<HTMLInputElement>(null);
  const publicFigureUniqueInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingProfileRef = useRef<{ age: string; country: string; city: string }>({ age: '', country: '', city: '' });
  const uploadingMediaRef = useRef(false);
  const userIdRef = useRef(user?.id);
  const isOwnProfileRef = useRef(isOwnProfile);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setError('');
    setSyncWarning('');
    setHealthViewStatus(null);
    setExpandedPostComments(null);
    if (!isOwnProfile) {
      setProfile(null);
      setReviews([]);
      setOverallRating(null);
      setProfilePosts([]);
      setLoading(true);
      loadProfileFromServer();
      return;
    }
    setAge(String(user.age ?? ''));
    setCountry(String(user.country ?? ''));
    setCity(String(user.city ?? ''));
    setProfile((prev) => {
      if (prev && prev.id === user.id && ((prev.highlights?.length || 0) > 0 || (prev.stories?.length || 0) > 0)) {
        return prev;
      }
      return buildSessionProfile(user);
    });
    setLoading(false);
    loadProfileFromServer();
  }, [user?.id, viewingUserId, location.pathname]);

  useEffect(() => {
    if (!user?.id || !isOwnProfile) return;
    chatAPI.getAvailableUsers(user.id).then(({ users }) => setCloseFriendCandidates(users)).catch(() => setCloseFriendCandidates([]));
  }, [user?.id, isOwnProfile]);

  useEffect(() => {
    if (!viewingStories) return;
    const item = viewingStories.items[viewingStories.index];
    if (!item) return;
    const isVid = item.mediaType === 'video' || isVideoMediaUrl(item.mediaUrl);
    if (isVid) {
      const v = storyVideoRef.current;
      if (v) {
        v.currentTime = 0;
        v.play().catch(() => {});
      }
      return;
    }
    const tid = window.setTimeout(() => {
      setViewingStories((vs) => {
        if (!vs) return null;
        if (vs.index + 1 < vs.items.length) return { ...vs, index: vs.index + 1 };
        return null;
      });
    }, 6000);
    return () => clearTimeout(tid);
  }, [viewingStories]);

  const applyProfileFields = (profileData: ProfileData & Record<string, unknown>) => {
    setAge(String(profileData.age ?? ''));
    setCountry(String(profileData.country ?? ''));
    setCity(String(profileData.city ?? ''));
    setPublicFigureLevel(String(profileData.publicFigureLevel ?? ''));
    setPublicFigureProof(String(profileData.publicFigureProof ?? ''));
    setPublicFigureIdImage(String(profileData.publicFigureIdImage ?? ''));
    setPublicFigureUniqueImage(String(profileData.publicFigureUniqueImage ?? ''));
    setCelebChatDisappearMode(String(profileData.celebChatDisappearMode ?? 'none'));
    setCelebChatDisappearSeconds(Number(profileData.celebChatDisappearSeconds ?? 60));
    setCelebMessagesOnlyWhenOpened(!!profileData.celebMessagesOnlyWhenOpened);
  };

  const loadProfileFromServer = async () => {
    const pathId = typeof window !== 'undefined'
      ? window.location.pathname.match(/^\/profile\/([^/]+)$/)?.[1]
      : undefined;
    const targetId = (pathId && pathId !== 'me') ? pathId : (viewingUserId || user?.id);
    if (!user?.id || !targetId) {
      setLoading(false);
      return;
    }
    const own = String(targetId) === String(user.id);
    try {
      const profileData = own
        ? await profileAPI.getCurrentUser()
        : await profileAPI.getUserProfile(String(targetId));
      if (!profileData?.id) throw new Error('Invalid profile response');
      setProfile(profileData);
      applyProfileFields(profileData as ProfileData & Record<string, unknown>);
      setInRelationship(!!(profileData as any).inRelationship);
      setSyncWarning('');
      setLoading(false);
      if (own) {
        updateUser({
          name: profileData.name,
          username: profileData.username,
          profilePicture: profileData.profilePicture,
          profileSetupComplete: profileData.profileSetupComplete,
          photoVerifiedAt: (profileData as any).photoVerifiedAt ?? null,
          age: (profileData as any).age,
          country: (profileData as any).country,
          city: (profileData as any).city,
        });
        if ((profileData as any).publicFigureVerified) {
          activityAPI.getMyInterests().then(({ sent, received }) => {
            const accepted = [...sent, ...received].filter((i: any) => i.status === 'accepted');
            const others = accepted.map((i: any) => {
              const otherId = i.fromUserId === user.id ? i.toUserId : i.fromUserId;
              return { id: otherId, name: (i as any).otherUser?.name || 'User' };
            });
            const byId = new Map(others.map((o) => [o.id, o]));
            setCelebConnections(Array.from(byId.values()));
          }).catch(() => setCelebConnections([]));
        } else {
          setCelebConnections([]);
        }
      }
      const [improvement, revData, postsResult] = await Promise.all([
        improvementAPI.getUserImprovement(String(targetId)).catch(() => ({ improvementPercentage: 0 })),
        reviewsAPI.getReviews(String(targetId)).catch(() => ({ reviews: [] as Review[], overall: null })),
        postsAPI.getPostsByUser(String(targetId)).catch(() => ({ posts: [] as DatingPost[] })),
      ]);
      setMatchScore(improvement.improvementPercentage ?? 0);
      setReviews(revData.reviews);
      setOverallRating(revData.overall ?? null);
      setProfilePosts(postsResult.posts);
      if (!own) {
        setHealthViewLoading(true);
        try {
          const status = await healthAPI.getViewStatus(String(targetId));
          setHealthViewStatus(status);
        } catch {
          setHealthViewStatus(null);
        } finally {
          setHealthViewLoading(false);
        }
      }
    } catch (err: any) {
      console.warn('Profile sync failed (showing saved session):', err?.response?.status || err?.message);
      if (!own) {
        setProfile(null);
        setError('Could not load this profile.');
        setLoading(false);
        return;
      }
      if (!localStorage.getItem('token')) {
        setProfile(null);
        setError('Session expired. Please sign in again.');
        setLoading(false);
        return;
      }
      setProfile((prev) => prev ?? buildSessionProfile(user));
      setSyncWarning('Could not refresh from server. Showing your saved profile — tap Retry to sync.');
    } finally {
      setLoading(false);
    }
  };

  /** Backwards-compatible alias used by save/upload handlers. */
  const loadProfile = loadProfileFromServer;

  useEffect(() => {
    pendingProfileRef.current = { age, country, city };
  }, [age, country, city]);

  const buildUpdates = (p: { age: string; country: string; city: string }) => {
    const updates: { age?: number; country?: string; city?: string } = {};
    if (p.age !== '' && !isNaN(Number(p.age))) updates.age = parseInt(p.age, 10);
    updates.country = typeof p.country === 'string' ? p.country.trim() : '';
    updates.city = typeof p.city === 'string' ? p.city.trim() : '';
    return updates;
  };

  const saveWithUpdates = async (updates: { age?: number; country?: string; city?: string }) => {
    if (!isOwnProfileRef.current) return;
    const uid = userIdRef.current;
    if (!uid || Object.keys(updates).length === 0) return;
    setSaveStatus('saving');
    setError('');
    try {
      const { user: updated } = await profileAPI.updateProfile(updates);
      if (updated) {
        updateUser({
          name: updated.name,
          username: updated.username,
          age: updated.age,
          country: updated.country,
          city: updated.city,
          profilePicture: updated.profilePicture,
        });
      }
      await loadProfile();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e: any) {
      console.error(e);
      setSaveStatus('error');
      const status = e?.response?.status;
      const msg = e?.response?.data?.error || e?.message || 'Failed to save. Try again.';
      if (status === 401) {
        setError('Could not save right now. Check your connection and try Save again.');
      } else {
        setError(msg);
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    }
  };

  const flushSave = async () => {
    const uid = userIdRef.current;
    if (!uid || !localStorage.getItem('token')) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const p = pendingProfileRef.current;
    const updates = buildUpdates(p);
    await saveWithUpdates(updates);
  };

  const handleSaveClick = async () => {
    if (!user?.id || !isOwnProfile) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = null;
    const updates = buildUpdates({ age, country, city });
    await saveWithUpdates(updates);
  };

  const handleUseMyLocation = async () => {
    if (!user?.id) return;
    setError('');
    setLocationDetecting(true);
    try {
      const { coords, error: gpsError } = await requestGpsFromUserTap();
      if (!coords) {
        setError(gpsError || 'Could not get GPS. Type your city and country, then Save — that works on phones and computers.');
        return;
      }
      markLocationGranted(coords);
      await connectionsAPI.updateLocation({
        lat: coords.lat,
        lon: coords.lon,
        accuracy: coords.accuracy,
        userId: user.id,
        connectionsVisible: true,
      }).catch(() => {});
      try {
        const geo = await connectionsAPI.reverseGeocode(coords.lat, coords.lon);
        const c = geo.country || '';
        const ct = geo.city || '';
        if (c) setCountry(c);
        if (ct) setCity(ct);
        pendingProfileRef.current = {
          ...pendingProfileRef.current,
          country: c || pendingProfileRef.current.country,
          city: ct || pendingProfileRef.current.city,
        };
      } catch {
        /* coords are saved even if the address lookup fails */
      }
    } finally {
      setLocationDetecting(false);
    }
  };

  const saveProfileFields = () => {
    if (!user?.id || !isOwnProfileRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(flushSave, 600);
  };

  useEffect(() => {
    userIdRef.current = user?.id;
    isOwnProfileRef.current = isOwnProfile;
  }, [user?.id, isOwnProfile]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (uploadingMediaRef.current) return;
      if (!isOwnProfileRef.current) return;
      if (!localStorage.getItem('token') || !userIdRef.current) return;
      flushSave();
    };
  }, []);

  const handleProfilePictureClick = () => fileInputRef.current?.click();
  const handleHighlightClick = (highlightId?: string) => {
    setSelectedHighlightId(highlightId || null);
    highlightInputRef.current?.click();
  };

  const handleAddStoryClick = () => storyInputRef.current?.click();

  const handleStoryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError('Please choose a photo or video.');
      return;
    }
    setPendingStoryFile(file);
    setShowStoryAudiencePicker(true);
  };

  const submitStoryWithAudience = async (audience: 'all' | 'closeFriends') => {
    if (!pendingStoryFile || !user?.id || storyAudienceBusy) return;
    setStoryAudienceBusy(audience);
    setError('');
    uploadingMediaRef.current = true;
    try {
      await new Promise((r) => setTimeout(r, 30));
      const mediaUrl = await prepareAndUploadFile(pendingStoryFile, 'stories');
      const { story } = await profileAPI.addStory(mediaUrl, audience);
      if (story) {
        setProfile((prev) => prev ? { ...prev, stories: [story, ...(prev.stories || []).filter((s: { id: string }) => s.id !== story.id)] } : prev);
      }
      setShowStoryAudiencePicker(false);
      setPendingStoryFile(null);
      await loadProfile();
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Story upload failed. Try a smaller photo or a shorter video.'));
    } finally {
      uploadingMediaRef.current = false;
      setStoryAudienceBusy(null);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!isOwnProfile) return;
    if (!confirm(t('deleteStory') + '?')) return;
    try {
      await profileAPI.deleteStory(storyId);
      await loadProfile();
      setViewingStories(null);
    } catch {
      setError('Failed to delete story');
    }
  };

  const openTheirChat = () => {
    const id = returnChatUserId || viewingUserId;
    if (!id) {
      navigate('/home');
      return;
    }
    navigate('/home', { state: { openWidget: 'chat', openChatWithUserId: id } });
  };

  const handleLikeProfilePost = async (postId: string) => {
    try {
      await postsAPI.likePost(postId);
      const { posts } = await postsAPI.getPostsByUser(viewingUserId || '');
      setProfilePosts(posts);
    } catch {
      /* ignore */
    }
  };

  const handleCommentProfilePost = async (postId: string) => {
    const text = postCommentDraft[postId]?.trim();
    if (!text) return;
    try {
      await postsAPI.commentOnPost(postId, text);
      setPostCommentDraft((prev) => ({ ...prev, [postId]: '' }));
      const { posts } = await postsAPI.getPostsByUser(viewingUserId || '');
      setProfilePosts(posts);
    } catch {
      setError('Could not comment');
    }
  };

  const moveHighlight = async (highlightId: string, dir: 'left' | 'right') => {
    const ids = (profile?.highlights || []).map((h: any) => h.id);
    const i = ids.indexOf(highlightId);
    const j = dir === 'left' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    try {
      await profileAPI.reorderHighlights(next);
      await loadProfile();
    } catch {
      setError('Could not reorder highlights');
    }
  };

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user?.id) return;
    setUploading(true);
    setError('');
    uploadingMediaRef.current = true;
    try {
      await new Promise((r) => setTimeout(r, 30));
      const mediaUrl = await prepareAndUploadFile(file, 'profile');
      await profileAPI.uploadProfilePicture(mediaUrl, user.id);
      await loadProfile();
      if (!file.type.startsWith('video/')) {
        setShowPhotoVerification(true);
      }
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Upload failed. Try a smaller photo.'));
    } finally {
      uploadingMediaRef.current = false;
      setUploading(false);
    }
  };

  const handleHighlightChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const highlightId = selectedHighlightId;
    e.target.value = '';
    if (!file || !user?.id) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError('Please choose a photo or video.');
      return;
    }
    setUploading(true);
    setError('');
    uploadingMediaRef.current = true;
    try {
      await new Promise((r) => setTimeout(r, 30));
      const mediaUrl = await prepareAndUploadFile(file, 'highlights');
      const { highlight } = await profileAPI.addHighlight(mediaUrl, user.id, highlightId || undefined);
      if (highlight) {
        setProfile((prev) => {
          if (!prev) return prev;
          const rest = (prev.highlights || []).filter((h: { id: string }) => h.id !== highlight.id);
          return { ...prev, highlights: [...rest, highlight] };
        });
      }
      await loadProfile();
      setSelectedHighlightId(null);
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Highlight upload failed. Try a smaller photo or a shorter video.'));
    } finally {
      uploadingMediaRef.current = false;
      setUploading(false);
    }
  };

  const handleDeleteHighlight = async (highlightId: string, itemId?: string) => {
    if (!user?.id) return;
    if (!confirm(itemId ? 'Delete this item?' : 'Delete this highlight?')) return;
    try {
      await profileAPI.deleteHighlight(highlightId, user.id, itemId);
      await loadProfile();
      if (viewingHighlight?.id === highlightId) setViewingHighlight(null);
    } catch (e) {
      setError('Failed to delete');
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="stars-background" aria-hidden>
          <div className="love-bg-hearts" />
          <div className="love-bg-float">
            <span className="love-float-1">👼</span>
            <span className="love-float-2">💘</span>
            <span className="love-float-3">💑</span>
            <span className="love-float-4">💏</span>
            <span className="love-float-5">💘</span>
            <span className="love-float-6">👫</span>
            <span className="love-float-7">❤️</span>
            <span className="love-float-8">💕</span>
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '60px', color: '#ff8fab' }}>Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="dashboard-container">
        <div className="stars-background" aria-hidden>
          <div className="love-bg-hearts" />
        </div>
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '60px 24px', color: '#ffb3c6' }}>
          <p style={{ marginBottom: 24 }}>{error || 'You need to sign in to view your profile.'}</p>
          <Link to="/login" className="profile-save-btn" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const highlights = profile.highlights || [];
  const storiesSorted = [...(profile.stories || [])].sort(
    (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const closeFriendIds = (profile as any).closeFriendIds || [];

  return (
    <div className="dashboard-container">
      <div className="stars-background" aria-hidden>
        <div className="love-bg-hearts" />
        <div className="love-bg-float">
          <span className="love-float-1">👼</span>
          <span className="love-float-2">💘</span>
          <span className="love-float-3">💑</span>
          <span className="love-float-4">💏</span>
          <span className="love-float-5">💘</span>
          <span className="love-float-6">👫</span>
          <span className="love-float-7">❤️</span>
          <span className="love-float-8">💕</span>
        </div>
      </div>
      <div className="dashboard-top-nav">
        {fromHelp && (
          <Link to="/home" state={{ openWidget: 'help' }} className="dashboard-back-link">← {t('backToHelp')}</Link>
        )}
        {fromChat ? (
          <button type="button" className="dashboard-back-link" onClick={openTheirChat}>← Back to chat</button>
        ) : (
          <Link to="/home" className="dashboard-back-link">← {t('backToHome')}</Link>
        )}
        {isOwnProfile && (
          <Link to="/settings" className="dashboard-back-link">⚙️ {t('settings')}</Link>
        )}
      </div>

      {syncWarning && (
        <div style={{ maxWidth: 520, margin: '0 auto 12px', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,143,171,0.15)', border: '1px solid rgba(255,143,171,0.4)', color: '#ffb3c6', fontSize: 13, textAlign: 'center' }}>
          {syncWarning}{' '}
          <button type="button" className="profile-location-btn" style={{ marginLeft: 8, padding: '4px 10px', fontSize: 12 }} onClick={() => { setSyncWarning(''); loadProfileFromServer(); }}>
            Retry
          </button>
        </div>
      )}

      {error && (
        <div style={{ maxWidth: 520, margin: '0 auto 12px', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.35)', color: '#ffb3c6', fontSize: 13, textAlign: 'center' }}>
          {error}
        </div>
      )}

      <div className="dashboard-panels" style={{ gridTemplateColumns: '1fr', maxWidth: '520px', margin: '0 auto' }}>
        <div className="holographic-panel left-panel" style={{ maxHeight: 'none' }}>
          <div className="widget profile-match-widget">
            <div className="profile-avatar">
              <div
                className={`avatar-circle ${isOwnProfile ? '' : 'avatar-circle-readonly'}`}
                onClick={isOwnProfile ? handleProfilePictureClick : undefined}
                style={{ cursor: isOwnProfile ? 'pointer' : 'default', position: 'relative' }}
              >
                {profile.profilePicture ? (
                  <div className="avatar-image-wrapper">
                    <ProfileMedia src={profile.profilePicture} className="avatar-image" alt="Profile" />
                  </div>
                ) : (
                  <div className="avatar-icon">👤</div>
                )}
                {isOwnProfile && <div className="avatar-overlay"><span className="upload-icon">📷</span></div>}
              </div>
              {isOwnProfile && (
                <>
                  <div className="avatar-actions">
                    <button className="avatar-btn" onClick={handleProfilePictureClick} disabled={uploading}>
                      {uploading ? `${t('loading')}` : t('change')}
                    </button>
                    {profile.profilePicture && (
                      <button className="avatar-btn remove" onClick={async () => {
                        if (!user?.id || !confirm('Remove photo?')) return;
                        await profileAPI.uploadProfilePicture('', user.id);
                        await loadProfile();
                      }}>Remove</button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleProfilePictureChange} />
                </>
              )}
            </div>
            <div className="profile-info">
              <div className="profile-name">
                {profile.name || (isOwnProfile ? user?.name : '') || 'Zorp'}
                {(profile as any).photoVerifiedAt && (
                  <span className="profile-photo-verified-badge" title="Photo verified — not catfishing">
                    ✓ Photo verified
                  </span>
                )}
                {(profile as any).publicFigureVerified && (
                  <span className="profile-photo-verified-badge" title="Public figure">⭐</span>
                )}
              </div>
              {isOwnProfile ? (
              <div className="profile-details-editable">
                <input
                  type="number"
                  placeholder={t('age')}
                  value={age}
                  onChange={(e) => {
                    const v = e.target.value;
                    setAge(v);
                    pendingProfileRef.current = { ...pendingProfileRef.current, age: v };
                    saveProfileFields();
                  }}
                  onBlur={flushSave}
                  className="profile-input"
                />
                <div className="country-flag-input-wrap">
                  <div className="country-flag-image-wrap" title={country || 'Country'}>
                    {getCountryFlagCode(country) ? (
                      <img src={`https://flagcdn.com/w40/${getCountryFlagCode(country)}.png`} alt="" className="country-flag-img" />
                    ) : (
                      <span className="country-flag-placeholder">🌍</span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder={t('country')}
                    value={country}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCountry(v);
                      pendingProfileRef.current = { ...pendingProfileRef.current, country: v };
                      saveProfileFields();
                    }}
                    onBlur={flushSave}
                    className="profile-input profile-input-country"
                  />
                </div>
                <input
                  type="text"
                  placeholder={t('city')}
                  value={city}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCity(v);
                    pendingProfileRef.current = { ...pendingProfileRef.current, city: v };
                    saveProfileFields();
                  }}
                  onBlur={flushSave}
                  className="profile-input"
                />
                <button type="button" className="profile-location-btn" onClick={handleUseMyLocation} disabled={locationDetecting}>
                  {locationDetecting ? 'Detecting…' : '📍 Use my location'}
                </button>
                <button type="button" className="profile-save-btn" onClick={handleSaveClick} disabled={saveStatus === 'saving'}>
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Retry' : t('save')}
              </button>
              {error && <p className="profile-save-error" style={{ marginTop: 8, color: '#ff6b6b', fontSize: 14 }}>{error}</p>}
              </div>
              ) : (
              <div className="profile-visitor-details">
                {profile.username && <div className="profile-detail">@{profile.username}</div>}
                {age && <div className="profile-detail">Age {age}</div>}
                {(country || city) && (
                  <div className="profile-detail">
                    {getCountryFlagCode(country) ? (
                      <img src={`https://flagcdn.com/w40/${getCountryFlagCode(country)}.png`} alt="" className="country-flag-img" style={{ width: 18, height: 12, marginRight: 6, verticalAlign: 'middle' }} />
                    ) : null}
                    {country}{city ? `, ${city}` : ''}
                  </div>
                )}
                {inRelationship && <div className="profile-detail" style={{ color: '#ff00ff', fontWeight: 'bold' }}>💑 In a relationship</div>}
                <button type="button" className="profile-save-btn profile-message-btn" onClick={openTheirChat}>
                  Message
                </button>
              </div>
              )}
              {isOwnProfile && city && <div className="profile-detail">📍 {city}</div>}
            </div>

            <div className="stories-section" style={{ marginTop: 16 }}>
              <div className="highlights-header">
                <span className="highlights-title">{t('stories').toUpperCase()}</span>
                {isOwnProfile && (
                  <button type="button" className="add-highlight-btn" onClick={handleAddStoryClick} disabled={uploading || !!storyAudienceBusy} title={t('addStory')}>+</button>
                )}
              </div>
              {isOwnProfile && <p className="stories-expires-note">{t('storyExpiresNote')}</p>}
              {isOwnProfile && <input ref={storyInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleStoryFileChange} />}
              <div className="stories-rings-scroll">
                {isOwnProfile && (
                <button type="button" className="story-ring story-ring-add" onClick={handleAddStoryClick} disabled={uploading || !!storyAudienceBusy}>
                  <span className="story-ring-inner">+</span>
                  <span className="story-ring-label">{t('addStory')}</span>
                </button>
                )}
                {storiesSorted.map((story: any, idx: number) => {
                  const thumbIsVideo = story.mediaType === 'video' || isVideoMediaUrl(story.mediaUrl);
                  return (
                    <button
                      type="button"
                      key={story.id}
                      className={`story-ring ${story.audience === 'closeFriends' ? 'story-ring-close' : ''}`}
                      onClick={() => setViewingStories({ items: storiesSorted, index: idx })}
                    >
                      <span className="story-ring-inner">
                        {thumbIsVideo ? (
                          <video src={story.mediaUrl} className="story-ring-media" muted playsInline autoPlay loop />
                        ) : (
                          <img src={story.mediaUrl} alt="" className="story-ring-media" />
                        )}
                      </span>
                      <span className="story-ring-label">{story.audience === 'closeFriends' ? '🔒' : '○'}</span>
                    </button>
                  );
                })}
                {!isOwnProfile && storiesSorted.length === 0 && (
                  <p className="chat-empty" style={{ margin: '8px 0 0' }}>No stories right now.</p>
                )}
              </div>
              {isOwnProfile && (
              <details className="close-friends-details">
                <summary className="close-friends-summary">{t('manageCloseFriends')}</summary>
                <p className="close-friends-hint">{t('storyAudienceCloseFriends')} — {t('closeFriends').toLowerCase()}.</p>
                <div className="close-friends-checklist">
                  {closeFriendCandidates.map((c) => {
                    const checked = closeFriendIds.includes(c.id);
                    return (
                      <label key={c.id} className="close-friends-row">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={async (e) => {
                            const next = e.target.checked
                              ? [...closeFriendIds, c.id]
                              : closeFriendIds.filter((id: string) => id !== c.id);
                            try {
                              await profileAPI.updateProfile({ closeFriendIds: next });
                              await loadProfile();
                            } catch {
                              setError('Could not update close friends');
                            }
                          }}
                        />
                        <span>{c.name}</span>
                      </label>
                    );
                  })}
                  {closeFriendCandidates.length === 0 && (
                    <p className="close-friends-empty">Chat with people first — they will appear here.</p>
                  )}
                </div>
              </details>
              )}
            </div>

            <div className="highlights-section" style={{ marginTop: 16 }}>
              <div className="highlights-header">
                <span className="highlights-title">{t('highlights').toUpperCase()}</span>
                {isOwnProfile && (
                  <button type="button" className="add-highlight-btn" onClick={() => handleHighlightClick()} disabled={uploading || !!storyAudienceBusy}>+</button>
                )}
              </div>
              {isOwnProfile && <input ref={highlightInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleHighlightChange} />}
              <div className="highlights-scrollable">
                {highlights.map((highlight: any) => {
                  const items = highlight.items || (highlight.imageUrl ? [{ id: highlight.id + '_item', imageUrl: highlight.imageUrl }] : []);
                  const coverImage = highlight.coverImage || items[0]?.imageUrl || highlight.imageUrl;
                  const itemCount = items.length;
                  const coverIsVideo = items[0]?.mediaType === 'video' || isVideoMediaUrl(coverImage || '');
                  return (
                    <div key={highlight.id} className="highlight-card">
                      {isOwnProfile && (
                      <div className="highlight-reorder">
                        <button type="button" className="highlight-move-btn" title={t('highlightMoveLeft')} onClick={(e) => { e.stopPropagation(); moveHighlight(highlight.id, 'left'); }}>‹</button>
                        <button type="button" className="highlight-move-btn" title={t('highlightMoveRight')} onClick={(e) => { e.stopPropagation(); moveHighlight(highlight.id, 'right'); }}>›</button>
                      </div>
                      )}
                      <div className="highlight-media-wrapper" onClick={() => setViewingHighlight({ ...highlight, items })}>
                        {coverImage && (
                          coverIsVideo ? (
                            <video src={coverImage} className="highlight-media" muted playsInline loop autoPlay />
                          ) : (
                            <img src={coverImage} alt="Highlight" className="highlight-media" />
                          )
                        )}
                        {itemCount > 1 && <div className="highlight-count-badge">{itemCount}</div>}
                        {isOwnProfile && (
                        <div className="highlight-add-overlay">
                          <button type="button" className="add-to-highlight-btn" onClick={(e) => { e.stopPropagation(); handleHighlightClick(highlight.id); }} title="Add more">+</button>
                        </div>
                        )}
                      </div>
                      {isOwnProfile && (
                        <button type="button" className="highlight-delete" onClick={() => handleDeleteHighlight(highlight.id)} title="Delete">×</button>
                      )}
                    </div>
                  );
                })}
                {highlights.length === 0 && isOwnProfile && (
                  <div className="highlight-placeholder" onClick={() => handleHighlightClick()}>
                    <div className="placeholder-icon">+</div>
                    <div className="placeholder-text">{t('addHighlight')}</div>
                  </div>
                )}
                {highlights.length === 0 && !isOwnProfile && (
                  <p className="chat-empty">No highlights yet.</p>
                )}
              </div>
            </div>

            {isOwnProfile && (
            <div className="profile-public-figure-section" style={{ marginTop: 20, padding: 16, border: '1px solid rgba(0,212,255,0.3)', borderRadius: 12, background: 'rgba(0,0,0,0.2)' }}>
              <div className="highlights-title" style={{ marginBottom: 8 }}>⭐ PUBLIC FIGURE / CELEBRITY</div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 12 }}>
                For celebrities, politicians, musicians, athletes and other public figures. Your profile and name will be blurred to others until they connect with you and sign an NDA. You get a gold star ✓ and control who can see your identity.
              </p>

              {!(profile as any).publicFigureVerified ? (
                !showPublicFigureApplyForm ? (
                  <button type="button" className="profile-location-btn" onClick={() => setShowPublicFigureApplyForm(true)}>Apply for verification</button>
                ) : (
                <>
                  <div className="highlights-title" style={{ marginBottom: 10, fontSize: 14 }}>Apply for verification</div>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 12 }}>
                    Provide your level and proof so we can verify it&apos;s you. After approval you can use blurred profile, NDA, and gold star.
                  </p>

                  <label style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
                    Level
                    <select value={publicFigureLevel} onChange={(e) => setPublicFigureLevel(e.target.value)} className="profile-input" style={{ marginTop: 4, width: '100%' }}>
                      <option value="">Select level</option>
                      <option value="country">In my country</option>
                      <option value="community">In my community / industry</option>
                      <option value="world">Worldwide</option>
                    </select>
                  </label>

                  <div style={{ marginBottom: 12 }}>
                    <div className="highlights-title" style={{ fontSize: 13, marginBottom: 6 }}>1. Selfie verification (look all sides)</div>
                    {(profile as any).photoVerifiedAt ? (
                      <p style={{ fontSize: 12, color: '#00d4ff' }}>✓ Selfie verification done</p>
                    ) : (
                      <>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 8 }}>Complete selfie verification first: take photos looking left, center, and right.</p>
                        <button type="button" className="profile-location-btn" onClick={() => setShowPhotoVerification(true)}>Open selfie verification</button>
                      </>
                    )}
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <div className="highlights-title" style={{ fontSize: 13, marginBottom: 6 }}>2. ID photo (required)</div>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>Upload a photo of your ID. Hide sensitive info (address, ID number, etc.). Only your name and other non-sensitive details may be visible.</p>
                    <input ref={publicFigureIdInputRef} type="file" accept="image/*" className="profile-input" style={{ display: 'none' }} onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const r = new FileReader();
                      r.onload = () => setPublicFigureIdImage((r.result as string) ?? '');
                      r.readAsDataURL(f);
                    }} />
                    <button type="button" className="profile-location-btn" style={{ marginRight: 8 }} onClick={() => publicFigureIdInputRef.current?.click()}>{publicFigureIdImage ? 'Change ID photo' : 'Upload ID photo'}</button>
                    {publicFigureIdImage && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}> ✓ ID photo added</span>}
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <div className="highlights-title" style={{ fontSize: 13, marginBottom: 6 }}>3. Social links OR unique photo</div>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <input type="radio" checked={publicFigureProofType === 'social'} onChange={() => setPublicFigureProofType('social')} /> Social (public profile links)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <input type="radio" checked={publicFigureProofType === 'unique'} onChange={() => setPublicFigureProofType('unique')} /> Unique verification photo
                      </label>
                    </div>
                    {publicFigureProofType === 'social' ? (
                      <textarea value={publicFigureProof} onChange={(e) => setPublicFigureProof(e.target.value)} placeholder="Paste your public social profile URL (one or more)." rows={2} className="profile-input" style={{ width: '100%', resize: 'vertical' }} />
                    ) : (
                      <>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>A photo only you can provide: e.g. holding a spoon, with a dog, or doing something specific.</p>
                        <input ref={publicFigureUniqueInputRef} type="file" accept="image/*" className="profile-input" style={{ display: 'none' }} onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const r = new FileReader();
                          r.onload = () => setPublicFigureUniqueImage((r.result as string) ?? '');
                          r.readAsDataURL(f);
                        }} />
                        <button type="button" className="profile-location-btn" onClick={() => publicFigureUniqueInputRef.current?.click()}>{publicFigureUniqueImage ? 'Change photo' : 'Upload unique photo'}</button>
                        {publicFigureUniqueImage && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginLeft: 8 }}> ✓ Photo added</span>}
                      </>
                    )}
                  </div>

                  <div style={{ marginBottom: 12, padding: 12, border: '1px solid rgba(255,180,0,0.5)', borderRadius: 8, background: 'rgba(0,0,0,0.3)' }}>
                    <div className="highlights-title" style={{ fontSize: 13, marginBottom: 8 }}>Terms and conditions</div>
                    <ul style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', margin: 0, paddingLeft: 18 }}>
                      <li>Faking or using someone else&apos;s identity may result in legal action and a fine of <strong>2,500 €</strong>.</li>
                      <li>Using AI to fake your identity may result in a fine of <strong>2,500 €</strong>.</li>
                      <li>Using AI on this app to spread fake information may result in a fine of <strong>1,000 €</strong>.</li>
                    </ul>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13 }}>
                      <input type="checkbox" checked={publicFigureAgreedToLegal} onChange={(e) => setPublicFigureAgreedToLegal(e.target.checked)} />
                      I agree to the terms above and confirm that my submission is truthful.
                    </label>
                  </div>

                  <button type="button" className="profile-location-btn" style={{ marginBottom: 0 }} onClick={async () => {
                    if (!user?.id) return;
                    const hasSelfie = !!(profile as any).photoVerifiedAt;
                    const hasId = !!publicFigureIdImage;
                    const hasSocial = publicFigureProofType === 'social' && !!publicFigureProof?.trim();
                    const hasUnique = publicFigureProofType === 'unique' && !!publicFigureUniqueImage;
                    if (!publicFigureLevel) {
                      setError('Please select a level.');
                      return;
                    }
                    if (!hasSelfie) {
                      setError('Complete selfie verification first.');
                      return;
                    }
                    if (!hasId) {
                      setError('Please upload your ID photo (with sensitive info hidden).');
                      return;
                    }
                    if (!hasSocial && !hasUnique) {
                      setError('Provide either social profile links or a unique verification photo.');
                      return;
                    }
                    if (!publicFigureAgreedToLegal) {
                      setError('You must agree to the terms and conditions before submitting.');
                      return;
                    }
                    if (!confirm('Submit your application for public figure verification? We will review your proof and notify you once verified.')) return;
                    setCelebSaving(true);
                    setError('');
                    try {
                      await profileAPI.updateProfile({
                        publicFigureLevel: (publicFigureLevel === 'world' || publicFigureLevel === 'community' || publicFigureLevel === 'country' ? publicFigureLevel : null),
                        publicFigureProof: publicFigureProofType === 'social' ? publicFigureProof.trim() : null,
                        publicFigureIdImage: publicFigureIdImage || null,
                        publicFigureUniqueImage: publicFigureProofType === 'unique' ? publicFigureUniqueImage : null,
                        publicFigureVerified: true
                      });
                      await loadProfile();
                    } catch (e) {
                      setError('Failed to submit application.');
                    } finally {
                      setCelebSaving(false);
                    }
                  }} disabled={celebSaving}>
                    {celebSaving ? 'Submitting...' : 'Submit application'}
                  </button>
                </>
                )
              ) : (
                <>
                  <p style={{ color: '#00d4ff', fontSize: 13, marginBottom: 12 }}>✓ Verified public figure. Your profile is blurred to others.</p>
                  <div className="highlights-title" style={{ marginTop: 16, marginBottom: 8 }}>Reveal identity to</div>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 8 }}>Choose who can see your real name and photo (after they sign the NDA).</p>
                  {celebConnections.map((conn) => {
                    const revealToUserIds = (profile as any).revealToUserIds || [];
                    const revealed = revealToUserIds.includes(conn.id);
                    return (
                      <label key={conn.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
                        <input type="checkbox" checked={revealed} onChange={async (e) => {
                          const next = e.target.checked ? [...revealToUserIds, conn.id] : revealToUserIds.filter((id: string) => id !== conn.id);
                          try {
                            await profileAPI.updateProfile({ revealToUserIds: next });
                            await loadProfile();
                          } catch (_) {}
                        }} />
                        {conn.name}
                      </label>
                    );
                  })}
                  {celebConnections.length === 0 && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>No connections yet. When someone accepts your request and signs the NDA, they&apos;ll appear here.</p>}
                  <div className="highlights-title" style={{ marginTop: 16, marginBottom: 8 }}>Chat settings</div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
                    Disappearing messages
                    <select value={celebChatDisappearMode} onChange={(e) => setCelebChatDisappearMode(e.target.value)} className="profile-input" style={{ marginTop: 4, width: '100%' }}>
                      <option value="none">Keep messages</option>
                      <option value="after_read">Disappear after read</option>
                      <option value="after_read_seconds">Disappear X seconds after read</option>
                    </select>
                  </label>
                  {celebChatDisappearMode === 'after_read_seconds' && (
                    <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
                      Seconds after read
                      <input type="number" min={10} max={86400} value={celebChatDisappearSeconds} onChange={(e) => setCelebChatDisappearSeconds(Number(e.target.value) || 60)} className="profile-input" style={{ marginTop: 4, width: '100%' }} />
                    </label>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13 }}>
                    <input type="checkbox" checked={celebMessagesOnlyWhenOpened} onChange={(e) => setCelebMessagesOnlyWhenOpened(e.target.checked)} />
                    Messages only visible when opened (no preview)
                  </label>
                  <button type="button" className="profile-save-btn" disabled={celebSaving} onClick={async () => {
                    if (!user?.id) return;
                    setCelebSaving(true);
                    try {
                      await profileAPI.updateProfile({
                        celebChatDisappearMode: celebChatDisappearMode as any,
                        celebChatDisappearSeconds: celebChatDisappearMode === 'after_read_seconds' ? celebChatDisappearSeconds : undefined,
                        celebMessagesOnlyWhenOpened: celebMessagesOnlyWhenOpened,
                      });
                      await loadProfile();
                    } catch (e) {
                      setError('Failed to save');
                    } finally {
                      setCelebSaving(false);
                    }
                  }}>
                    {celebSaving ? 'Saving...' : 'Save public figure settings'}
                  </button>
                </>
              )}
            </div>
            )}

            {isOwnProfile ? (
              <HealthProofSection inRelationship={inRelationship} />
            ) : (
              <div className="chat-profile-health-block" style={{ marginTop: 16 }}>
                {healthViewLoading && <div className="chat-loading">Loading...</div>}
                {!healthViewLoading && healthViewStatus && !healthViewStatus.canView && viewingUserId && (
                  <HealthProofSection
                    mode="visitor"
                    visitorTests={[]}
                    visitorGate={(
                      <>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 10 }}>
                          Plan a meetup first, then request their doctor/hospital stamped STI proofs before you meet. They approve who can view.
                        </p>
                        {healthViewStatus.request?.status === 'pending' && <p style={{ fontSize: 13, color: '#eab308' }}>Request sent. Waiting for approval.</p>}
                        {healthViewStatus.request?.status === 'rejected' && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>They declined to share lab reports.</p>}
                        {!healthViewStatus.request && healthViewStatus.canRequest === false && (
                          <p style={{ fontSize: 12, color: '#fca5a5' }}>Create a meetup plan in Date safety first, then you can request their stamped reports.</p>
                        )}
                        {!healthViewStatus.request && healthViewStatus.canRequest !== false && (
                          <button type="button" className="profile-save-btn" style={{ padding: '8px 16px', fontSize: 13 }} disabled={healthRequesting} onClick={async () => {
                            if (!viewingUserId) return;
                            setHealthRequesting(true);
                            try {
                              await healthAPI.requestToView(viewingUserId);
                              const status = await healthAPI.getViewStatus(viewingUserId);
                              setHealthViewStatus(status);
                            } catch (err: unknown) {
                              const ax = err as { response?: { data?: { error?: string } } };
                              window.alert(ax.response?.data?.error || 'Could not send request');
                            } finally {
                              setHealthRequesting(false);
                            }
                          }}>{healthRequesting ? 'Sending...' : 'Request stamped lab reports'}</button>
                        )}
                      </>
                    )}
                  />
                )}
                {!healthViewLoading && healthViewStatus?.canView && healthViewStatus.results && (
                  <HealthProofSection
                    mode="visitor"
                    visitorTests={healthViewStatus.results.tests}
                    visitorLastUpdated={healthViewStatus.results.lastUpdated}
                  />
                )}
              </div>
            )}

            {isOwnProfile && <div className="match-score">{Math.round(matchScore)}% MATCH</div>}
          </div>

          <div className="profile-posts-section">
            <div className="highlights-title">POSTS</div>
            {profilePosts.length === 0 ? (
              <p className="chat-empty">{isOwnProfile ? 'You have not posted yet.' : 'No posts yet.'}</p>
            ) : (
              <div className="profile-posts-grid">
                {profilePosts.map((post) => (
                  <div key={post.id} className="love-feed-card">
                    <div className="love-feed-card-media">
                      {post.contentType === 'video' ? (
                        <video src={post.content} controls playsInline preload="metadata" />
                      ) : post.contentType === 'image' ? (
                        <img src={post.content} alt="" />
                      ) : (
                        <div className="love-feed-card-media-text">{post.content}</div>
                      )}
                    </div>
                    <div className="love-feed-card-meta">
                      {post.title && <p className="love-feed-card-headline">"{post.title}"</p>}
                      {post.contentType !== 'text' && post.content && !post.title && (
                        <p className="love-feed-card-headline">{post.contentType === 'video' ? 'Shared a video' : 'Shared a post'}</p>
                      )}
                    </div>
                    <div className="love-feed-card-actions">
                      <div className="love-feed-actions-primary">
                        <button type="button" className="love-feed-action" onClick={() => handleLikeProfilePost(post.id)}>
                          <span className="love-feed-icon">♥</span>
                          <span>{post.likes || 0}</span>
                        </button>
                        <button
                          type="button"
                          className="love-feed-action"
                          onClick={() => setExpandedPostComments(expandedPostComments === post.id ? null : post.id)}
                        >
                          <span className="love-feed-icon">💬</span>
                          <span>{post.comments?.length || 0}</span>
                        </button>
                      </div>
                    </div>
                    {expandedPostComments === post.id && (
                      <div className="love-feed-comments">
                        {(post.comments || []).map((c) => (
                          <div key={c.id} className="love-feed-comment">
                            <strong>{c.userName}</strong>: {c.content}
                          </div>
                        ))}
                        <div className="love-feed-comment-form">
                          <input
                            type="text"
                            placeholder="Write a comment..."
                            value={postCommentDraft[post.id] ?? ''}
                            onChange={(e) => setPostCommentDraft((prev) => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCommentProfilePost(post.id); }}
                          />
                          <button type="button" onClick={() => handleCommentProfilePost(post.id)}>Reply</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="profile-reviews-section">
            <div className="highlights-title">{t('reviews').toUpperCase()}</div>
            <p className="profile-reviews-note">
              {isOwnProfile
                ? 'Reviews cannot be deleted. You can reply once. False or malicious claims may lead to ban or suspension.'
                : 'Reviews other people left for them. You can like and comment on their posts above.'}
            </p>
            {overallRating && overallRating.totalReviews > 0 && (
              <div className="profile-overall-rating">
                <span className="profile-overall-stars" aria-label={`${overallRating.averageStars} out of 5`}>
                  {'★'.repeat(Math.round(overallRating.averageStars))}
                  {'☆'.repeat(5 - Math.round(overallRating.averageStars))}
                </span>
                <span className="profile-overall-value">{overallRating.averageStars.toFixed(1)}</span>
                <span className="profile-overall-count">({overallRating.totalReviews} reviews)</span>
              </div>
            )}
            {reviews.length === 0 ? (
              <p className="chat-empty">{t('noReviewsYet')}</p>
            ) : (
              <div className="profile-reviews-list">
                {reviews.map((r) => {
                  const stars = r.overallStars ?? 3;
                  const court = courtDraft[r.id] ?? { summary: '', note: '', confirm: false };
                  return (
                  <div key={r.id} className={`profile-review-card ${r.isSeriousClaim ? 'profile-review-serious' : ''}`}>
                    <div className="profile-review-header">
                      <strong>{r.fromUserName || 'Someone'}</strong>
                      <span className="profile-review-stars-inline">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
                      <span className="profile-review-date">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    {r.isSeriousClaim && r.claimStatus === 'pending_innocent' && (
                      <div className="profile-claim-badge profile-claim-pending">
                        <strong>Serious allegation — innocent until proven guilty</strong>
                        <p>
                          This claim is unproven and highlighted as pending. The accused may reply but cannot delete
                          this comment. We encourage pursuing legal action through proper authorities if appropriate.
                        </p>
                      </div>
                    )}
                    {r.claimStatus === 'proven' && (
                      <div className="profile-claim-badge profile-claim-proven">
                        <strong>Proven — court evidence on record</strong>
                      </div>
                    )}
                    <p className="profile-review-text">{r.reviewText}</p>
                    {r.courtEvidence && (
                      <div className="profile-court-evidence-pinned">
                        <strong>Official court evidence (pinned)</strong>
                        <p>{r.courtEvidence.summary}</p>
                        {r.courtEvidence.documentNote && (
                          <p className="profile-court-note">{r.courtEvidence.documentNote}</p>
                        )}
                        <span className="profile-court-date">
                          Submitted {new Date(r.courtEvidence.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {r.replyText && <p className="profile-review-reply"><em>{isOwnProfile ? 'Your reply:' : 'Reply:'}</em> {r.replyText}</p>}
                    {!r.replyText && isOwnProfile && user?.id && (
                      <div className="profile-review-reply-form">
                        <input
                          type="text"
                          placeholder="Reply to this review..."
                          value={replyDraft[r.id] ?? ''}
                          onChange={(e) => setReplyDraft((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          className="profile-input"
                        />
                        <button
                          type="button"
                          className="avatar-btn"
                          disabled={replyingId === r.id || !(replyDraft[r.id]?.trim())}
                          onClick={async () => {
                            if (!replyDraft[r.id]?.trim()) return;
                            setReplyingId(r.id);
                            try {
                              await reviewsAPI.replyToReview(r.id, replyDraft[r.id].trim());
                              const text = replyDraft[r.id].trim();
                              setReplyDraft((prev) => { const n = { ...prev }; delete n[r.id]; return n; });
                              setReviews((prev) => prev.map((rev) => rev.id === r.id ? { ...rev, replyText: text, repliedAt: new Date().toISOString() } : rev));
                            } finally {
                              setReplyingId(null);
                            }
                          }}
                        >
                          {replyingId === r.id ? 'Sending…' : 'Reply'}
                        </button>
                      </div>
                    )}
                    {user?.id === r.fromUserId && r.claimStatus === 'pending_innocent' && (
                      <div className="profile-court-submit">
                        <p className="profile-court-submit-title">Add official court evidence (review author only)</p>
                        <textarea
                          className="profile-input"
                          rows={2}
                          placeholder="Court outcome summary…"
                          value={court.summary}
                          onChange={(e) => setCourtDraft((prev) => ({
                            ...prev,
                            [r.id]: { ...court, summary: e.target.value },
                          }))}
                        />
                        <input
                          className="profile-input"
                          placeholder="Docket / court reference (optional)"
                          value={court.note}
                          onChange={(e) => setCourtDraft((prev) => ({
                            ...prev,
                            [r.id]: { ...court, note: e.target.value },
                          }))}
                        />
                        <label className="profile-court-check">
                          <input
                            type="checkbox"
                            checked={court.confirm}
                            onChange={(e) => setCourtDraft((prev) => ({
                              ...prev,
                              [r.id]: { ...court, confirm: e.target.checked },
                            }))}
                          />
                          I confirm this is official court documentation
                        </label>
                        <button
                          type="button"
                          className="avatar-btn"
                          disabled={courtSubmittingId === r.id || !court.summary.trim() || !court.confirm}
                          onClick={async () => {
                            setCourtSubmittingId(r.id);
                            try {
                              const { review } = await reviewsAPI.submitCourtEvidence(r.id, {
                                summary: court.summary.trim(),
                                documentNote: court.note.trim() || undefined,
                                confirmOfficial: true,
                              });
                              setReviews((prev) => prev.map((rev) => (rev.id === r.id ? review : rev)));
                            } finally {
                              setCourtSubmittingId(null);
                            }
                          }}
                        >
                          {courtSubmittingId === r.id ? 'Submitting…' : 'Submit court evidence'}
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {viewingHighlight && (
            <div className="highlight-viewer" onClick={() => setViewingHighlight(null)}>
              <div className="highlight-viewer-content" onClick={(e) => e.stopPropagation()}>
                <div className="viewer-header">
                  <h3>Highlight ({(viewingHighlight.items || []).length} items)</h3>
                  <button className="close-viewer" onClick={() => setViewingHighlight(null)}>×</button>
                </div>
                <div className="viewer-items">
                  {(viewingHighlight.items || []).map((item: any, idx: number) => (
                    <div key={item.id || idx} className="viewer-item">
                      {item.mediaType === 'video' || isVideoMediaUrl(item.imageUrl) ? (
                        <video src={item.imageUrl} className="viewer-media" controls playsInline />
                      ) : (
                        <img src={item.imageUrl} alt="" className="viewer-media" />
                      )}
                      {isOwnProfile && (
                      <button className="viewer-item-delete" onClick={() => {
                        if (viewingHighlight.items.length > 1) handleDeleteHighlight(viewingHighlight.id, item.id);
                        else { handleDeleteHighlight(viewingHighlight.id); setViewingHighlight(null); }
                      }}>Delete</button>
                      )}
                    </div>
                  ))}
                </div>
                {isOwnProfile && (
                <button className="add-more-to-highlight-btn" onClick={() => { setViewingHighlight(null); handleHighlightClick(viewingHighlight.id); }}>+ Add More</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="console-controls">
        <button className="console-btn" onClick={() => navigate('/home')}>{t('home').toUpperCase()}</button>
        <button className="console-btn logout" onClick={handleLogout}>{t('logout').toUpperCase()}</button>
      </div>

      {showStoryAudiencePicker && pendingStoryFile && createPortal(
        <div className="story-audience-overlay" role="dialog" aria-modal onClick={() => { if (!storyAudienceBusy) { setShowStoryAudiencePicker(false); setPendingStoryFile(null); } }}>
          <div className="story-audience-panel" onClick={(e) => e.stopPropagation()}>
            <h3 className="story-audience-title">{t('addStory')}</h3>
            <p className="story-audience-question">Who can see this story?</p>
            {error && <p className="profile-save-error" style={{ color: '#ff6b6b', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}
            <div className="story-audience-actions">
              <button type="button" className="story-audience-btn story-audience-everyone" disabled={!!storyAudienceBusy} onClick={() => submitStoryWithAudience('all')}>
                {storyAudienceBusy === 'all' ? 'Uploading…' : t('storyAudienceEveryone')}
              </button>
              <button type="button" className="story-audience-btn story-audience-close" disabled={!!storyAudienceBusy} onClick={() => submitStoryWithAudience('closeFriends')}>
                {storyAudienceBusy === 'closeFriends' ? 'Uploading…' : t('storyAudienceCloseFriends')}
              </button>
              <button type="button" className="story-audience-cancel" disabled={!!storyAudienceBusy} onClick={() => { setShowStoryAudiencePicker(false); setPendingStoryFile(null); }}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {viewingStories && viewingStories.items.length > 0 && createPortal(
        <div
          className="story-fullscreen-viewer"
          role="presentation"
          onClick={() => setViewingStories(null)}
        >
          <div className="story-progress-row" aria-hidden>
            {viewingStories.items.map((_, i) => (
              <div key={i} className={`story-progress-seg ${i <= viewingStories.index ? 'story-progress-on' : ''}`} />
            ))}
          </div>
          <button type="button" className="story-tap-left" aria-label="Previous" onClick={(e) => { e.stopPropagation(); setViewingStories((vs) => vs && vs.index > 0 ? { ...vs, index: vs.index - 1 } : vs); }} />
          <button type="button" className="story-tap-right" aria-label="Next" onClick={(e) => { e.stopPropagation(); setViewingStories((vs) => vs && vs.index + 1 < vs.items.length ? { ...vs, index: vs.index + 1 } : null); }} />
          <div className="story-fullscreen-inner" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const cur = viewingStories.items[viewingStories.index];
              if (!cur) return null;
              const vid = cur.mediaType === 'video' || isVideoMediaUrl(cur.mediaUrl);
              return vid ? (
                <video
                  ref={storyVideoRef}
                  src={cur.mediaUrl}
                  className="story-full-bleed-media"
                  playsInline
                  controls
                  onEnded={() => {
                    setViewingStories((vs) => {
                      if (!vs) return null;
                      if (vs.index + 1 < vs.items.length) return { ...vs, index: vs.index + 1 };
                      return null;
                    });
                  }}
                />
              ) : (
                <img src={cur.mediaUrl} alt="" className="story-full-bleed-media" />
              );
            })()}
          </div>
          <div className="story-viewer-toolbar" onClick={(e) => e.stopPropagation()}>
            {isOwnProfile && (
              <>
                <button type="button" className="story-toolbar-btn" onClick={() => {
                  const cur = viewingStories.items[viewingStories.index];
                  if (cur) handleDeleteStory(cur.id);
                }}>{t('deleteStory')}</button>
                <select
                  className="story-highlight-select"
                  value={highlightPickForStory}
                  onChange={(e) => setHighlightPickForStory(e.target.value)}
                  aria-label="Add to highlight"
                >
                  <option value="__new__">{t('addHighlight')}</option>
                  {highlights.map((h: any) => (
                    <option key={h.id} value={h.id}>{h.title || 'Highlight'}</option>
                  ))}
                </select>
                <button type="button" className="story-toolbar-btn" onClick={async () => {
                  const cur = viewingStories.items[viewingStories.index];
                  if (!cur || !user?.id) return;
                  try {
                    await profileAPI.addHighlightFromStory(cur.id, highlightPickForStory === '__new__' ? undefined : highlightPickForStory);
                    await loadProfile();
                    setViewingStories(null);
                  } catch {
                    setError('Could not add to highlight');
                  }
                }}>{t('addToHighlight')}</button>
              </>
            )}
            <button type="button" className="story-toolbar-close" onClick={() => setViewingStories(null)}>×</button>
          </div>
        </div>,
        document.body
      )}

      {showPhotoVerification && user?.id && createPortal(
        <PhotoVerificationModal
          onClose={() => setShowPhotoVerification(false)}
          onVerified={async () => {
            await loadProfile();
            const p = await profileAPI.getCurrentUser();
            updateUser(p);
            setShowPhotoVerification(false);
          }}
          onSubmit={async (selfieImages) => {
            await profileAPI.submitPhotoVerification(user.id, selfieImages);
          }}
        />,
        document.body
      )}
    </div>
  );
};

export default Profile;
