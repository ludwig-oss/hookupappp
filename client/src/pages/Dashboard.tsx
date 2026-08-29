import { useContext, useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { AuthContext } from '../context/AuthContext';
import { profileAPI } from '../api/profile';
import PhotoVerificationModal from '../components/PhotoVerificationModal';
import { improvementAPI } from '../api/improvement';
import ConnectionsWidget from '../components/widgets/ConnectionsWidget';
import ChatWidget from '../components/widgets/ChatWidget';
import CompatibilityWidget from '../components/widgets/CompatibilityWidget';
import ActivityStreamWidget from '../components/widgets/ActivityStreamWidget';
import HighlightSpinWheel from '../components/widgets/HighlightSpinWheel';
import WheelOutcomeFlow from '../components/widgets/WheelOutcomeFlow.tsx';
import LoveFeedWidget from '../components/widgets/LoveFeedWidget';
import EventsWidget from '../components/widgets/EventsWidget';
import HelpWidget from '../components/widgets/HelpWidget';
import DatingAdviceWidget from '../components/widgets/DatingAdviceWidget';
import ConfessionBoothWidget from '../components/widgets/ConfessionBoothWidget';
import type { HelpNavTarget } from '../data/helpFaq';
import WalkingPartnerPopup from '../components/WalkingPartnerPopup';
import CoachVoteSwipePopup from '../components/CoachVoteSwipePopup';
import DateSafetyMonitor from '../components/DateSafetyMonitor';
import SchoolDailyNotification from '../components/SchoolDailyNotification';
import PersonalSafetyShield from '../components/PersonalSafetyShield';
import MensDatingTipPopup from '../components/MensDatingTipPopup';
import WomensDatingTipPopup from '../components/WomensDatingTipPopup';
import MensRespectSafetyPopup from '../components/MensRespectSafetyPopup';
import { useTranslation } from '../context/LanguageContext';
import { postsAPI } from '../api/posts';
import { relationshipAPI } from '../api/relationship';
import './Dashboard.css';

const Dashboard = () => {
  const { user, logout, updateUser } = useContext(AuthContext);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const highlightInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingProfileRef = useRef<{ age: string; country: string; city: string }>({ age: '', country: '', city: '' });
  const [matchScore, setMatchScore] = useState(0);
  const [happiness, setHappiness] = useState(25);
  const [profilePicture, setProfilePicture] = useState(user?.profilePicture || null);
  const [age, setAge] = useState(user?.age || '');
  const [country, setCountry] = useState(user?.country || '');
  const [city, setCity] = useState(user?.city || '');
  const [highlights, setHighlights] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  const [viewingHighlight, setViewingHighlight] = useState<any | null>(null);
  type WidgetId = 'activity' | 'compatibility' | 'connections' | 'highlights' | 'lovefeed' | 'advice' | 'confession' | 'chat' | 'events' | 'help' | null;
  const [openWidget, setOpenWidget] = useState<WidgetId>(null);
  const [openChatWithUserId, setOpenChatWithUserId] = useState<string | null>(null);
  const [loveFeedBlowingUpCount, setLoveFeedBlowingUpCount] = useState(0);
  const [wheelOutcomeSegment, setWheelOutcomeSegment] = useState<number | null>(null);
  const [showPhotoVerification, setShowPhotoVerification] = useState(false);
  const [inRelationship, setInRelationship] = useState(false);

  useEffect(() => {
    if (user?.id) {
      relationshipAPI.getMyRelationship().then((r) => setInRelationship(r.relationship?.status === 'active')).catch(() => setInRelationship(false));
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      setProfilePicture(user.profilePicture || null);
      setAge(user.age || '');
      setCountry(user.country || '');
      setCity(user.city || '');
      loadHighlights();
      loadImprovementPercentage();
      postsAPI.getBlowingUpCount().then((r) => setLoveFeedBlowingUpCount(r.count)).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (openWidget === 'lovefeed') {
      postsAPI.getBlowingUpCount().then((r) => setLoveFeedBlowingUpCount(r.count)).catch(() => {});
    }
  }, [openWidget]);

  useEffect(() => {
    // Simulate dynamic data updates for happiness only
    const interval = setInterval(() => {
      setHappiness(prev => Math.max(0, Math.min(100, prev + Math.random() * 2 - 1)));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadImprovementPercentage = async () => {
    if (!user?.id) return;
    try {
      const data = await improvementAPI.getUserImprovement(user.id);
      setMatchScore(data.improvementPercentage);
    } catch (error) {
      console.error('Failed to load improvement percentage:', error);
      // Keep default 0 if API fails
    }
  };

  const loadHighlights = async () => {
    if (!user?.id) return;
    try {
      const profile = await profileAPI.getCurrentUser();
      setHighlights(profile.highlights || []);
    } catch (error: unknown) {
      const ax = error as { response?: { status?: number; data?: { error?: string } }; message?: string };
      const status = ax.response?.status;
      const msg = ax.response?.data?.error || ax.message || 'Unknown error';
      console.error('Failed to load highlights:', status ? `HTTP ${status} — ${msg}` : msg);
      if (status === 401) {
        console.warn('Session expired or invalid. Log out and log in again.');
      }
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleProfilePictureClick = () => {
    fileInputRef.current?.click();
  };

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];
        const res = await profileAPI.uploadProfilePicture(base64Data, user.id);
        setProfilePicture(base64);
        updateUser({ profilePicture: base64, photoVerifiedAt: res.photoVerifiedAt ?? null });
        setShowPhotoVerification(true);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Failed to upload profile picture:', error);
      alert('Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveProfilePicture = async () => {
    if (!user?.id || !confirm('Remove profile picture?')) return;
    try {
      await profileAPI.uploadProfilePicture('', user.id);
      setProfilePicture(null);
      const updatedUser = { ...user, profilePicture: null };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      window.location.reload();
    } catch (error) {
      console.error('Failed to remove profile picture:', error);
    }
  };

  const handleHighlightClick = (highlightId?: string) => {
    setSelectedHighlightId(highlightId || null);
    highlightInputRef.current?.click();
  };

  const handleHighlightChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      alert('Please select an image or video file');
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];
        await profileAPI.addHighlight(base64Data, user.id, selectedHighlightId || undefined);
        await loadHighlights();
        setSelectedHighlightId(null);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Failed to upload highlight:', error);
      alert('Failed to upload highlight');
    } finally {
      setUploading(false);
      setSelectedHighlightId(null);
      if (highlightInputRef.current) {
        highlightInputRef.current.value = '';
      }
    }
  };

  const handleDeleteHighlight = async (highlightId: string, itemId?: string) => {
    if (!user?.id) return;
    const message = itemId 
      ? 'Delete this item from the highlight?' 
      : 'Delete this entire highlight?';
    if (!confirm(message)) return;
    try {
      await profileAPI.deleteHighlight(highlightId, user.id, itemId);
      await loadHighlights();
      if (viewingHighlight?.id === highlightId) {
        setViewingHighlight(null);
      }
    } catch (error) {
      console.error('Failed to delete highlight:', error);
    }
  };

  const handleViewHighlight = (highlight: any) => {
    setViewingHighlight(highlight);
  };

  useEffect(() => {
    pendingProfileRef.current = { age: String(age ?? ''), country: country ?? '', city: city ?? '' };
  }, [age, country, city]);

  const saveProfileFields = () => {
    if (!user?.id) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      saveTimeoutRef.current = null;
      const p = pendingProfileRef.current;
      try {
        const updates: { age?: number; country?: string; city?: string } = {};
        if (p.age !== '' && !isNaN(Number(p.age))) updates.age = parseInt(p.age, 10);
        if (p.country.trim()) updates.country = p.country.trim();
        if (p.city.trim()) updates.city = p.city.trim();
        if (Object.keys(updates).length > 0) {
          await profileAPI.updateProfile(updates);
        }
      } catch (error) {
        console.error('Failed to save profile:', error);
      }
    }, 600);
  };

  useEffect(() => {
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as { userId?: string } | undefined;
      const uid = detail?.userId;
      if (!uid) return;
      setOpenChatWithUserId(uid);
      setOpenWidget('chat');
    };
    window.addEventListener('chat:open', onOpen);
    return () => window.removeEventListener('chat:open', onOpen);
  }, []);

  return (
    <div className="dashboard-container">
      <SchoolDailyNotification
        onOpenGuides={(categoryId) => {
          setOpenWidget('compatibility');
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent('school:open-guides', { detail: { categoryId } }));
          }, 400);
        }}
      />
      <WalkingPartnerPopup
        onOpenChat={(userId) => {
          setOpenChatWithUserId(userId);
          setOpenWidget('chat');
        }}
      />
      <CoachVoteSwipePopup />
      <DateSafetyMonitor />
      <MensDatingTipPopup />
      <WomensDatingTipPopup />
      <MensRespectSafetyPopup />
      {!openWidget && <PersonalSafetyShield />}
      <div className="stars-background" aria-hidden>
        <div className="love-bg-hearts" />
        <div className="love-bg-float">
          <span className="love-float-1" title="Cupid">👼</span>
          <span className="love-float-2" title="Love">💘</span>
          <span className="love-float-3" title="Couple">💑</span>
          <span className="love-float-4" title="Kiss">💏</span>
          <span className="love-float-5" title="Heart arrow">💘</span>
          <span className="love-float-6" title="Holding hands">👫</span>
          <span className="love-float-7" title="Hearts">❤️</span>
          <span className="love-float-8" title="Love">💕</span>
        </div>
      </div>
      {openWidget && (
        <div className="dashboard-back-link-wrap">
          <button type="button" className="dashboard-back-link" onClick={() => setOpenWidget(null)}>
            ← {t('backToHome')}
          </button>
        </div>
      )}
      {!openWidget ? (
        <div className="widget-grid">
          <div className="widget-card" onClick={() => navigate('/profile')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/profile')}>
            <div className="widget-card-icon">👤</div>
            <div className="widget-card-title">{t('profile')}</div>
          </div>
          <div className={`widget-card ${inRelationship ? 'widget-card-blurred' : ''}`} onClick={() => !inRelationship && setOpenWidget('activity')} role="button" tabIndex={inRelationship ? -1 : 0} onKeyDown={(e) => !inRelationship && e.key === 'Enter' && setOpenWidget('activity')} title={inRelationship ? 'In a relationship – focus on your partner' : undefined}>
            <div className="widget-card-icon">◇</div>
            <div className="widget-card-title">{t('activityStream')}</div>
          </div>
          <div className="widget-card" onClick={() => setOpenWidget('compatibility')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpenWidget('compatibility')}>
            <div className="widget-card-icon">⚡</div>
            <div className="widget-card-title">{t('compatibility')}</div>
          </div>
          <div className={`widget-card ${inRelationship ? 'widget-card-blurred' : ''}`} onClick={() => !inRelationship && setOpenWidget('connections')} role="button" tabIndex={inRelationship ? -1 : 0} onKeyDown={(e) => !inRelationship && e.key === 'Enter' && setOpenWidget('connections')} title={inRelationship ? 'In a relationship – focus on your partner' : undefined}>
            <div className="widget-card-icon">▣</div>
            <div className="widget-card-title">{t('connections')}</div>
          </div>
          <div className={`widget-card ${inRelationship ? 'widget-card-blurred' : ''}`} onClick={() => !inRelationship && setOpenWidget('highlights')} role="button" tabIndex={inRelationship ? -1 : 0} onKeyDown={(e) => !inRelationship && e.key === 'Enter' && setOpenWidget('highlights')} title={inRelationship ? 'In a relationship – focus on your partner' : undefined}>
            <div className="widget-card-icon">✦</div>
            <div className="widget-card-title">{t('highlights')}</div>
          </div>
          <div className="widget-card" style={{ position: 'relative' }} onClick={() => setOpenWidget('lovefeed')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpenWidget('lovefeed')}>
            <div className="widget-card-icon">♥</div>
            <div className="widget-card-title">Love Life Feed</div>
            {loveFeedBlowingUpCount > 0 && (
              <span className="widget-card-badge" title="Breaking / blowing up posts">{loveFeedBlowingUpCount}</span>
            )}
          </div>
          <div className="widget-card" onClick={() => setOpenWidget('advice')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpenWidget('advice')}>
            <div className="widget-card-icon">💬</div>
            <div className="widget-card-title">Dating Advice</div>
          </div>
          <div className="widget-card" onClick={() => setOpenWidget('confession')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpenWidget('confession')}>
            <div className="widget-card-icon">⛪</div>
            <div className="widget-card-title">Confession Booth</div>
          </div>
          <div className="widget-card" onClick={() => setOpenWidget('chat')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpenWidget('chat')}>
            <div className="widget-card-icon">◉</div>
            <div className="widget-card-title">{t('communication')}</div>
          </div>
          <div className="widget-card" onClick={() => setOpenWidget('events')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpenWidget('events')}>
            <div className="widget-card-icon">📅</div>
            <div className="widget-card-title">Events</div>
          </div>
          <div className="widget-card" onClick={() => setOpenWidget('help')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpenWidget('help')}>
            <div className="widget-card-icon">?</div>
            <div className="widget-card-title">Help</div>
          </div>
        </div>
      ) : (
        <div className="widget-open-panel">
          <div className="holographic-panel left-panel">
            {openWidget === 'activity' && (
              <ActivityStreamWidget onOpenChat={(userId) => { setOpenChatWithUserId(userId); setOpenWidget('chat'); }} />
            )}
            {openWidget === 'compatibility' && (
              <div className="widget compatibility-widget">
                <CompatibilityWidget />
              </div>
            )}
            {openWidget === 'connections' && <ConnectionsWidget />}
            {openWidget === 'highlights' && (
              <>
                <HighlightSpinWheel onOutcome={(segment) => setWheelOutcomeSegment(segment)} />
                {wheelOutcomeSegment != null && (
                  <WheelOutcomeFlow
                    segment={wheelOutcomeSegment}
                    country={country}
                    city={city}
                    onClose={() => setWheelOutcomeSegment(null)}
                    onOpenChat={(userId) => {
                      setWheelOutcomeSegment(null);
                      setOpenChatWithUserId(userId);
                      setOpenWidget('chat');
                    }}
                    onLocationDetected={(c, cityVal) => {
                      updateUser({ country: c, city: cityVal });
                      setCountry(c);
                      setCity(cityVal);
                      profileAPI.updateProfile({ country: c, city: cityVal }).catch(() => {});
                    }}
                  />
                )}
              </>
            )}
            {openWidget === 'lovefeed' && (
              <LoveFeedWidget onShareToFriends={() => setOpenWidget('chat')} />
            )}
            {openWidget === 'advice' && <DatingAdviceWidget />}
            {openWidget === 'confession' && <ConfessionBoothWidget />}
            {openWidget === 'events' && <EventsWidget />}
            {openWidget === 'help' && (
              <HelpWidget
                onOpenChat={() => setOpenWidget('chat')}
                onOpenLoveFeed={() => setOpenWidget('lovefeed')}
                onNavigate={(target: HelpNavTarget) => {
                  if (target === 'profile') {
                    navigate('/profile');
                    return;
                  }
                  if (target === 'settings') {
                    navigate('/settings');
                    return;
                  }
                  setOpenWidget(target);
                }}
              />
            )}
            {openWidget === 'chat' && (
              <ChatWidget
                initialOtherUserId={openChatWithUserId}
                onOpenedWithUserId={() => setOpenChatWithUserId(null)}
                onOpenGuides={() => setOpenWidget('compatibility')}
              />
            )}
          </div>
        </div>
      )}

      {/* Console Controls */}
      <div className="console-controls">
        <button className="console-btn" onClick={() => navigate('/profile')}>
          {t('profile').toUpperCase()}
        </button>
        <button className="console-btn" onClick={() => navigate('/home')}>
          {t('home').toUpperCase()}
        </button>
        <button className="console-btn logout" onClick={handleLogout}>
          {t('logout').toUpperCase()}
        </button>
      </div>

      <div className="dashboard-legal-footer">
        <Link to="/terms">Terms</Link>
        <span className="dashboard-legal-sep">·</span>
        <Link to="/privacy">Privacy</Link>
      </div>

      {showPhotoVerification && user?.id && createPortal(
        <PhotoVerificationModal
          onClose={() => setShowPhotoVerification(false)}
          onVerified={async () => {
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

export default Dashboard;
