import { useContext, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { AuthContext } from '../context/AuthContext';
import { profileAPI } from '../api/profile';
import { prepareAndUploadFile } from '../lib/uploadMedia';
import { formatAxiosError } from '../lib/apiError';
import PhotoVerificationModal from '../components/PhotoVerificationModal';
import { improvementAPI } from '../api/improvement';
import ConnectionsWidget from '../components/widgets/ConnectionsWidget';
import ChatWidget from '../components/widgets/ChatWidget';
import CompatibilityWidget from '../components/widgets/CompatibilityWidget';
import { AiGuideFab } from '../components/AiGuideStudio';
import ActivityStreamWidget from '../components/widgets/ActivityStreamWidget';
import HighlightSpinWheel from '../components/widgets/HighlightSpinWheel';
import WheelOutcomeFlow from '../components/widgets/WheelOutcomeFlow.tsx';
import LoveFeedWidget from '../components/widgets/LoveFeedWidget';
import EventsWidget from '../components/widgets/EventsWidget';
import HelpWidget from '../components/widgets/HelpWidget';
import DateMatchWidget from '../components/widgets/DateMatchWidget';
import InterestPitchPopup from '../components/InterestPitchPopup';
import DatingAdviceWidget from '../components/widgets/DatingAdviceWidget';
import ConfessionBoothWidget from '../components/widgets/ConfessionBoothWidget';
import type { HelpNavTarget } from '../data/helpFaq';
import WalkingPartnerPopup from '../components/WalkingPartnerPopup';
import ConnectionsBuzzPopup from '../components/ConnectionsBuzzPopup';
import BuzzResultPopup from '../components/BuzzResultPopup';
import NearbyMatchPopup from '../components/NearbyMatchPopup';
import { useDashboardLocation } from '../hooks/useDashboardLocation';
import AddPasswordPrompt from '../components/AddPasswordPrompt';
import Profile from './Profile';
import { askNotifyPermission } from '../lib/deviceNotify';
import { NEARBY_POPUP_VISIBLE_EVENT, requestNearbyCheckNow, setConnectionsStartView } from '../lib/proximitySession';
import { useGuideApplicationNotifications } from '../hooks/useGuideApplicationNotifications';
import { textingHelpAPI } from '../api/textingHelp';
import { guideHelpAPI } from '../api/guideHelp';
import TextingHelpSosPopup from '../components/TextingHelpSosPopup';
import type { DisinterestReport } from '../api/disinterest';
import '../components/DisinterestAnalyzer.css';
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

type WidgetId = 'activity' | 'compatibility' | 'connections' | 'highlights' | 'lovefeed' | 'advice' | 'confession' | 'chat' | 'events' | 'help' | 'safety' | 'datematch' | null;
type MainTab = 'Connections' | 'Feed' | 'Communications' | 'Profile';

function tabForWidget(id: Exclude<WidgetId, null>): MainTab {
  switch (id) {
    case 'lovefeed':
      return 'Feed';
    case 'chat':
    case 'advice':
    case 'confession':
    case 'activity':
      return 'Communications';
    case 'compatibility':
    case 'highlights':
    case 'safety':
    case 'help':
      return 'Profile';
    default:
      return 'Connections';
  }
}

function tabHomeWidget(tab: MainTab, inRelationship: boolean): WidgetId {
  if (tab === 'Feed') return 'lovefeed';
  if (tab === 'Communications') return 'chat';
  if (tab === 'Profile') return null;
  return inRelationship ? null : 'connections';
}

const RELATIONSHIP_LOCKED: Array<Exclude<WidgetId, null>> = ['activity', 'connections', 'highlights', 'datematch'];

const Dashboard = () => {
  const { user, logout, updateUser } = useContext(AuthContext);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
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
  const bootState = (location.state || {}) as { openWidget?: WidgetId; openChatWithUserId?: string } | null;
  const [openWidget, setOpenWidget] = useState<WidgetId>(bootState?.openWidget ?? 'connections');
  const [activeTab, setActiveTab] = useState<MainTab>(bootState?.openWidget ? tabForWidget(bootState.openWidget) : 'Connections');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [returnToWidget, setReturnToWidget] = useState<'help' | null>(null);
  const [openChatWithUserId, setOpenChatWithUserId] = useState<string | null>(bootState?.openChatWithUserId || null);

  const [mustPickGuide, setMustPickGuide] = useState(false);

  const openWidgetFromHome = (id: Exclude<WidgetId, null>) => {
    if (mustPickGuide && id !== 'compatibility') return;
    if (inRelationship && RELATIONSHIP_LOCKED.includes(id)) return;
    setReturnToWidget(null);
    setOpenWidget(id);
    setIsSidebarOpen(false);
  };

  const checkNearbyNow = () => {
    if (mustPickGuide || inRelationship) return;
    askNotifyPermission();
    setConnectionsStartView('nearby');
    let popupShown = false;
    const onShown = () => {
      popupShown = true;
    };
    window.addEventListener(NEARBY_POPUP_VISIBLE_EVENT, onShown);
    requestNearbyCheckNow();
    window.setTimeout(() => {
      window.removeEventListener(NEARBY_POPUP_VISIBLE_EVENT, onShown);
      if (!popupShown) openWidgetFromHome('connections');
    }, 1600);
  };

  const handleBackFromWidget = () => {
    if (mustPickGuide) {
      setActiveTab('Profile');
      setOpenWidget('compatibility');
      return;
    }
    if (returnToWidget) {
      setOpenWidget(returnToWidget);
      setReturnToWidget(null);
      return;
    }
    setOpenWidget(tabHomeWidget(activeTab, inRelationship));
  };

  const selectTab = (tab: MainTab) => {
    if (mustPickGuide && tab !== 'Profile') return;
    setIsSidebarOpen(false);
    setReturnToWidget(null);
    setActiveTab(tab);
    setOpenWidget(tab === 'Profile' && mustPickGuide ? 'compatibility' : tabHomeWidget(tab, inRelationship));
  };

  const openSidebarFeature = (id: Exclude<WidgetId, null>) => {
    openWidgetFromHome(id);
  };

  const navigateFromHelp = (target: HelpNavTarget) => {
    if (mustPickGuide) {
      setOpenWidget('compatibility');
      return;
    }
    if (target === 'profile') {
      navigate('/profile', { state: { fromHelp: true } });
      return;
    }
    if (target === 'settings') {
      navigate('/settings', { state: { fromHelp: true } });
      return;
    }
    setReturnToWidget('help');
    setOpenWidget(target);
  };
  const [openDisinterestUserId, setOpenDisinterestUserId] = useState<string | null>(null);
  const [resumeTextingHelpId, setResumeTextingHelpId] = useState<string | null>(null);
  const [watchOutToast, setWatchOutToast] = useState<{ otherUserId: string; score: number; report?: DisinterestReport | null } | null>(null);
  const [loveFeedBlowingUpCount, setLoveFeedBlowingUpCount] = useState(0);
  const [wheelOutcomeGameId, setWheelOutcomeGameId] = useState<string | null>(null);
  const [showPhotoVerification, setShowPhotoVerification] = useState(false);
  const [inRelationship, setInRelationship] = useState(false);

  useDashboardLocation(user?.id ? { id: user.id, city: user.city, country: user.country } : undefined);
  useGuideApplicationNotifications(user?.id);

  useEffect(() => {
    askNotifyPermission();
  }, []);

  useEffect(() => {
    if (user?.id) {
      relationshipAPI.getMyRelationship().then((r) => setInRelationship(r.relationship?.status === 'active')).catch(() => setInRelationship(false));
    }
  }, [user?.id]);

  useEffect(() => {
    if (openWidget) setActiveTab(tabForWidget(openWidget));
  }, [openWidget]);

  useEffect(() => {
    if (!inRelationship || !openWidget) return;
    if (!RELATIONSHIP_LOCKED.includes(openWidget)) return;
    setOpenWidget(tabHomeWidget(tabForWidget(openWidget), true));
  }, [inRelationship, openWidget]);

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
      if (typeof profile.hasBackupPassword === 'boolean' && profile.hasBackupPassword !== user.hasBackupPassword) {
        updateUser({ hasBackupPassword: profile.hasBackupPassword });
      }
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
      const mediaUrl = await prepareAndUploadFile(file, 'profile');
      const res = await profileAPI.uploadProfilePicture(mediaUrl, user.id);
      setProfilePicture(mediaUrl);
      updateUser({ profilePicture: mediaUrl, photoVerifiedAt: res.photoVerifiedAt ?? null });
      setShowPhotoVerification(true);
    } catch (error) {
      console.error('Failed to upload profile picture:', error);
      alert(formatAxiosError(error, 'Failed to upload profile picture'));
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
    const highlightId = selectedHighlightId;
    e.target.value = '';
    if (!file || !user?.id) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      alert('Please select an image or video file');
      return;
    }

    setUploading(true);
    try {
      await new Promise((r) => setTimeout(r, 30));
      const mediaUrl = await prepareAndUploadFile(file, 'highlights');
      await profileAPI.addHighlight(mediaUrl, user.id, highlightId || undefined);
      await loadHighlights();
      setSelectedHighlightId(null);
    } catch (error) {
      console.error('Failed to upload highlight:', error);
      alert(formatAxiosError(error, 'Failed to upload highlight. Try a smaller photo or a shorter video.'));
    } finally {
      setUploading(false);
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
    const state = location.state as { openWidget?: WidgetId; openChatWithUserId?: string } | null;
    if (!state?.openWidget) return;
    if (state.openWidget === 'help') {
      setOpenWidget('help');
      setReturnToWidget(null);
      return;
    }
    if (state.openWidget === 'chat') {
      if (state.openChatWithUserId) setOpenChatWithUserId(state.openChatWithUserId);
      setOpenWidget('chat');
    }
  }, [location.state]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      if (mustPickGuide) return;
      const detail = (e as CustomEvent).detail as { userId?: string } | undefined;
      const uid = detail?.userId;
      if (!uid) return;
      setOpenChatWithUserId(uid);
      setOpenWidget('chat');
    };
    window.addEventListener('chat:open', onOpen);
    return () => window.removeEventListener('chat:open', onOpen);
  }, [mustPickGuide]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('confession') === 'success' || params.get('open') === 'confession' || params.get('confession') === 'cancel') {
      setOpenWidget('confession');
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('aiHelp') !== 'success') return;
    const stripeSession = params.get('session_id');
    const finish = () => {
      window.history.replaceState({}, '', window.location.pathname);
      window.dispatchEvent(new CustomEvent('ai-guide:open', { detail: {} }));
    };
    if (stripeSession) {
      guideHelpAPI
        .stripeConfirm(stripeSession)
        .catch((err) => console.error('AI help Stripe confirm:', err))
        .finally(finish);
      return;
    }
    finish();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('open') === 'chat') {
      const other = params.get('other');
      if (other) setOpenChatWithUserId(other);
      if (params.get('disinterest') === '1' && other) setOpenDisinterestUserId(other);
      setOpenWidget('chat');
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('textingHelp') !== 'success') return;
    const sessionId = params.get('sessionId');
    const checkoutSessionId = params.get('session_id') || '';
    if (!sessionId || !checkoutSessionId) return;
    textingHelpAPI
      .confirmCheckout(sessionId, checkoutSessionId)
      .then(({ session }) => {
        setResumeTextingHelpId(session.id);
        setOpenChatWithUserId(session.otherUserId);
        setOpenWidget('chat');
      })
      .catch((err) => console.error('Texting help Stripe confirm:', err))
      .finally(() => {
        window.history.replaceState({}, '', window.location.pathname);
      });
  }, []);

  useEffect(() => {
    const onWarn = (e: Event) => {
      const d = (e as CustomEvent).detail as { otherUserId?: string; score?: number; report?: DisinterestReport | null };
      if (!d?.otherUserId) return;
      setWatchOutToast({ otherUserId: d.otherUserId, score: d.score || 0, report: d.report });
    };
    window.addEventListener('chat:disinterest-warning', onWarn);
    return () => window.removeEventListener('chat:disinterest-warning', onWarn);
  }, []);

  useEffect(() => {
    const onLock = (e: Event) => {
      const categoryId = (e as CustomEvent<{ categoryId?: string }>).detail?.categoryId;
      setMustPickGuide(true);
      setOpenWidget('compatibility');
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('school:open-guides', { detail: { categoryId } }));
      }, 400);
    };
    const onUnlock = () => setMustPickGuide(false);
    window.addEventListener('guide-program:lock-guides', onLock);
    window.addEventListener('guide-program:updated', onUnlock);
    return () => {
      window.removeEventListener('guide-program:lock-guides', onLock);
      window.removeEventListener('guide-program:updated', onUnlock);
    };
  }, []);

  const homeWidget = tabHomeWidget(activeTab, inRelationship);
  const showHeaderBack = Boolean(returnToWidget) || (openWidget != null && openWidget !== homeWidget);
  const relationshipLocked = (id: Exclude<WidgetId, null>) => inRelationship && RELATIONSHIP_LOCKED.includes(id);

  const sideItem = (id: Exclude<WidgetId, null>, icon: string, label: string) => {
    const locked = (mustPickGuide && id !== 'compatibility') || relationshipLocked(id);
    return (
      <button
        key={id}
        type="button"
        className={`app-side-item ${openWidget === id ? 'is-active' : ''}`}
        disabled={locked}
        title={relationshipLocked(id) ? 'In a relationship – focus on your partner' : undefined}
        onClick={() => openSidebarFeature(id)}
      >
        <span className="app-side-icon" aria-hidden>{icon}</span>
        {label}
      </button>
    );
  };

  return (
    <div className="dashboard-container app-shell">
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
      <ConnectionsBuzzPopup onOpenConnections={() => setOpenWidget('connections')} />
      <BuzzResultPopup />
      {!inRelationship && (
        <NearbyMatchPopup onOpenConnections={() => setOpenWidget('connections')} />
      )}
      <TextingHelpSosPopup />
      <InterestPitchPopup
        onOpenChat={(userId) => {
          setOpenChatWithUserId(userId);
          setOpenWidget('chat');
        }}
      />
      <DateSafetyMonitor />
      <MensDatingTipPopup />
      <WomensDatingTipPopup />
      <MensRespectSafetyPopup />
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
      <header className="app-topbar">
        <button
          type="button"
          className="app-menu-btn"
          onClick={() => setIsSidebarOpen((open) => !open)}
          aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isSidebarOpen}
        >
          ☰
        </button>
        <h1 className="app-header-title">{activeTab.toUpperCase()}</h1>
        <div className="app-header-actions">
          {!inRelationship && (
            <button type="button" className="app-header-nearby" onClick={checkNearbyNow}>
              50m
            </button>
          )}
          {showHeaderBack ? (
            <button
              type="button"
              className="app-header-back"
              onClick={handleBackFromWidget}
              aria-label={returnToWidget === 'help' ? t('backToHelp') : t('backToHome')}
            >
              ←
            </button>
          ) : (
            <span className="app-header-spacer" />
          )}
        </div>
      </header>

      <main className="app-stage">
      {openWidget ? (
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
                <HighlightSpinWheel onOutcome={(gameId) => setWheelOutcomeGameId(gameId)} />
                {wheelOutcomeGameId != null && (
                  <WheelOutcomeFlow
                    gameId={wheelOutcomeGameId}
                    country={country}
                    city={city}
                    onClose={() => setWheelOutcomeGameId(null)}
                    onOpenChat={(userId) => {
                      setWheelOutcomeGameId(null);
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
            {openWidget === 'safety' && <PersonalSafetyShield visible />}
            {openWidget === 'help' && (
              <HelpWidget
                onOpenChat={() => {
                  setReturnToWidget('help');
                  setOpenWidget('chat');
                }}
                onOpenLoveFeed={() => {
                  setReturnToWidget('help');
                  setOpenWidget('lovefeed');
                }}
                onNavigate={navigateFromHelp}
              />
            )}
            {openWidget === 'datematch' && (
              <DateMatchWidget
                onOpenChat={(userId) => { setOpenChatWithUserId(userId); setOpenWidget('chat'); }}
                onOpenGuides={() => setOpenWidget('compatibility')}
                onOpenPremium={() => navigate('/settings', { state: { openTab: 'premium' } })}
              />
            )}
            {openWidget === 'chat' && (
              <ChatWidget
                initialOtherUserId={openChatWithUserId}
                onOpenedWithUserId={() => setOpenChatWithUserId(null)}
                onOpenGuides={() => setOpenWidget('compatibility')}
                openDisinterestForUserId={openDisinterestUserId}
                onDisinterestOpened={() => setOpenDisinterestUserId(null)}
                resumeTextingHelpSessionId={resumeTextingHelpId}
                onTextingHelpResumed={() => setResumeTextingHelpId(null)}
              />
            )}
          </div>
        </div>
      ) : activeTab === 'Profile' ? (
        <div className="app-profile-embed">
          <Profile embedded />
        </div>
      ) : (
        <p className="app-stage-placeholder">
          {activeTab === 'Connections' && (inRelationship
            ? 'In a relationship — focus on your partner.'
            : 'Connections')}
          {activeTab === 'Feed' && '💖 Love Life Feed'}
          {activeTab === 'Communications' && '💬 Messages Inbox'}
        </p>
      )}
      </main>

      {isSidebarOpen && (
        <button type="button" className="app-sidebar-backdrop" aria-label="Close menu" onClick={() => setIsSidebarOpen(false)} />
      )}
      <aside className={`app-sidebar ${isSidebarOpen ? 'is-open' : ''}`} aria-hidden={!isSidebarOpen}>
        <div className="app-sidebar-inner">
          {activeTab === 'Profile' ? (
            <>
              <p className="app-side-label">Workspace</p>
              {sideItem('compatibility', '🧬', 'Compatibility')}
              {sideItem('highlights', '✨', 'Highlights')}
              <p className="app-side-label">Support</p>
              {sideItem('safety', '🛡️', 'Safety Shield')}
              {sideItem('help', '❓', 'Help Center')}
            </>
          ) : activeTab === 'Communications' ? (
            <>
              <p className="app-side-label">Integrations</p>
              {sideItem('advice', '💡', 'Dating Advice')}
              {sideItem('confession', '🤫', 'Confession Booth')}
              {sideItem('activity', '📈', 'Activity Stream')}
            </>
          ) : activeTab === 'Connections' ? (
            <>
              <p className="app-side-label">Meet</p>
              {sideItem('datematch', '⚔️', 'Date Arena')}
              {sideItem('events', '📅', 'Events')}
              <p className="app-side-label">International</p>
              {sideItem('activity', '🌍', 'Search a city')}
            </>
          ) : (
            <p className="app-side-hint">Select main panel feature</p>
          )}
          <button
            type="button"
            className="app-side-item app-side-logout"
            onClick={() => {
              setIsSidebarOpen(false);
              handleLogout();
            }}
          >
            <span className="app-side-icon" aria-hidden>↩</span>
            {t('logout')}
          </button>
        </div>
      </aside>

      <nav className="app-dock" aria-label="Main">
        <button type="button" className={`app-dock-tab ${activeTab === 'Connections' ? 'is-active' : ''}`} onClick={() => selectTab('Connections')}>
          <span className="app-dock-icon" aria-hidden>👥</span>
          <span className="app-dock-label">Connections</span>
        </button>
        <button type="button" className={`app-dock-tab ${activeTab === 'Feed' ? 'is-active' : ''}`} onClick={() => selectTab('Feed')}>
          <span className="app-dock-icon" aria-hidden>❤️</span>
          {loveFeedBlowingUpCount > 0 && <span className="app-dock-badge">{loveFeedBlowingUpCount}</span>}
          <span className="app-dock-label">Feed</span>
        </button>
        <button type="button" className={`app-dock-tab ${activeTab === 'Communications' ? 'is-active' : ''}`} onClick={() => selectTab('Communications')}>
          <span className="app-dock-icon" aria-hidden>💬</span>
          <span className="app-dock-label">Comms</span>
        </button>
        <button type="button" className={`app-dock-tab ${activeTab === 'Profile' ? 'is-active' : ''}`} onClick={() => selectTab('Profile')}>
          <span className="app-dock-icon" aria-hidden>👤</span>
          <span className="app-dock-label">Profile</span>
        </button>
      </nav>

      <AiGuideFab />

      {watchOutToast && (
        <button
          type="button"
          className="di-toast"
          onClick={() => {
            setOpenChatWithUserId(watchOutToast.otherUserId);
            setOpenDisinterestUserId(watchOutToast.otherUserId);
            setOpenWidget('chat');
            window.dispatchEvent(
              new CustomEvent('chat:show-disinterest', { detail: { otherUserId: watchOutToast.otherUserId } })
            );
            setWatchOutToast(null);
          }}
        >
          <strong>Hey, watch out</strong>
          <p>
            This is not a red flag. Slow down, gather your own evidence, then decide. Tap to open the analyzer.
          </p>
        </button>
      )}

      <AddPasswordPrompt />

      {showPhotoVerification && user?.id && createPortal(
        <PhotoVerificationModal
          profilePictureUrl={user.profilePicture}
          onClose={() => setShowPhotoVerification(false)}
          onVerified={async () => {
            const p = await profileAPI.getCurrentUser();
            updateUser(p);
            setShowPhotoVerification(false);
          }}
          onSubmit={async (selfieImages, extras) => {
            await profileAPI.submitPhotoVerification(user.id, selfieImages, extras);
          }}
        />,
        document.body
      )}
    </div>
  );
};

export default Dashboard;
