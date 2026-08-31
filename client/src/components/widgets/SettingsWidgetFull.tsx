import { useState, useEffect, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AuthContext } from '../../context/AuthContext';
import { profileAPI } from '../../api/profile';
import { prepareAndUploadFile } from '../../lib/uploadMedia';
import { formatAxiosError } from '../../lib/apiError';
import PhotoVerificationModal from '../PhotoVerificationModal';
import { discoverAPI, UserPreference } from '../../api/discover';
import { settingsAPI, UserSettings } from '../../api/settings';
import { gamificationAPI } from '../../api/gamification';
import { reportsAPI } from '../../api/reports';
import { verificationAPI, Verification } from '../../api/verification';
import { premiumAPI, PremiumPlan, PremiumSubscription } from '../../api/premium';
import { compatibilityAPI, CompatibilityResult } from '../../api/compatibility';
import CompatibilityQuiz from './CompatibilityQuiz';
import BadgeGallery from './BadgeGallery';
import ReportModal from './ReportModal';
import { safetyAPI } from '../../api/safety';
import { personalSafetyAPI } from '../../api/personalSafety';
import { authAPI } from '../../api/auth';
import { normalizeUsernameInput, USERNAME_HINT } from '../../lib/username';
import { walletAPI, GuideWalletSummary } from '../../api/improvement';
import { LANGUAGES } from '../../constants/languages';
import { setStoredLanguage } from '../../i18n/languageStorage';
import './Widget.css';

type TabType = 'profile' | 'preferences' | 'privacy' | 'notifications' | 'filters' | 'verification' | 'gamification' | 'premium' | 'social' | 'compatibility' | 'reports' | 'accessibility' | 'account' | 'profiles';

const SettingsWidgetFull = () => {
  const { user, updateUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Profile
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [userPhoneNumber, setUserPhoneNumber] = useState('');
  const [bio, setBio] = useState('');
  
  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [education, setEducation] = useState('');
  const [occupation, setOccupation] = useState('');
  const [relationshipStatus, setRelationshipStatus] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);

  // Preferences
  const [preference, setPreference] = useState<UserPreference | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  // Verification
  const [verification, setVerification] = useState<Verification | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');

  // Premium
  const [premiumPlans, setPremiumPlans] = useState<PremiumPlan[]>([]);
  const [premiumStatus, setPremiumStatus] = useState<PremiumSubscription | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  // Compatibility
  const [compatibilityResult, setCompatibilityResult] = useState<CompatibilityResult | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);

  // Reports
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);
  const [reportQuery, setReportQuery] = useState('');
  const [reportLookupLoading, setReportLookupLoading] = useState(false);

  // Photo verification (anti-catfish)
  const [showPhotoVerification, setShowPhotoVerification] = useState(false);

  // Gamification
  const [gamification, setGamification] = useState<any>(null);

  const [walletSummary, setWalletSummary] = useState<GuideWalletSummary | null>(null);
  const [walletPaypal, setWalletPaypal] = useState('');
  const [walletBank, setWalletBank] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletMessage, setWalletMessage] = useState('');
  const [walletError, setWalletError] = useState('');

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) return '+' + cleaned.slice(1).replace(/\D/g, '').slice(0, 18);
    return cleaned.replace(/\D/g, '').slice(0, 18);
  };

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
      setUserPhoneNumber(formatPhoneNumber((user as any).phoneNumber || ''));
      setProfilePicture(user.profilePicture || null);
      loadAllData();
    }
  }, [user?.id]);

  useEffect(() => {
    if (activeTab !== 'account') return;
    setWalletLoading(true);
    walletAPI
      .getMyWallet()
      .then((s) => {
        setWalletSummary(s);
        setWalletPaypal(s.wallet.paypalEmail || '');
        setWalletBank(s.wallet.bankAccountLabel || '');
      })
      .catch(() => setWalletSummary(null))
      .finally(() => setWalletLoading(false));
  }, [activeTab]);

  const loadAllData = async () => {
    try {
      const [profileRes] = await Promise.all([
        profileAPI.getCurrentUser().catch(() => null),
        loadPreferences(),
        loadSettings(),
        loadVerification(),
        loadPremiumData(),
        loadCompatibility(),
        loadBlockedUsers(),
        loadGamification(),
      ]);
      if (profileRes) {
        setBio((profileRes as any).bio ?? '');
        setAge((profileRes as any).age ?? '');
        setGender((profileRes as any).gender ?? '');
        setHeight((profileRes as any).height ?? '');
        setEducation((profileRes as any).education ?? '');
        setOccupation((profileRes as any).occupation ?? '');
        setRelationshipStatus((profileRes as any).relationshipStatus ?? '');
      }
    } catch (err) {
      console.error('Failed to load data', err);
    }
  };

  const loadPreferences = async () => {
    try {
      const response = await discoverAPI.getMyPreference();
      setPreference(response.preference ?? (user ? { userId: user.id, orientation: 'straight', lookingFor: ['dating'], city: '', lastActiveAt: new Date().toISOString() } : null));
    } catch (err) {
      console.error('Failed to load preferences', err);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await settingsAPI.getSettings();
      setSettings(response.settings);
    } catch (err) {
      console.error('Failed to load settings', err);
    }
  };

  const loadVerification = async () => {
    try {
      const response = await verificationAPI.getStatus();
      setVerification(response.verification);
    } catch (err) {
      console.error('Failed to load verification', err);
    }
  };

  const loadPremiumData = async () => {
    try {
      const [plansRes, statusRes, historyRes] = await Promise.all([
        premiumAPI.getPlans(),
        premiumAPI.getStatus(),
        premiumAPI.getHistory(),
      ]);
      setPremiumPlans(plansRes.plans);
      setPremiumStatus(statusRes.subscription);
      setPaymentHistory(historyRes.history);
    } catch (err) {
      console.error('Failed to load premium data', err);
    }
  };

  const loadCompatibility = async () => {
    try {
      const response = await compatibilityAPI.getResult();
      setCompatibilityResult(response.result);
    } catch (err) {
      // No result yet is fine
    }
  };

  const loadBlockedUsers = async () => {
    try {
      const response = await safetyAPI.getBlockedUsers();
      setBlockedUsers(response.users || []);
    } catch (err) {
      console.error('Failed to load blocked users', err);
    }
  };

  const loadGamification = async () => {
    try {
      const response = await gamificationAPI.getGamification();
      setGamification(response.gamification);
    } catch (err) {
      console.error('Failed to load gamification', err);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const cleanPhoneNumber = userPhoneNumber.replace(/\D/g, '') || null;
      await profileAPI.updateProfile({
        name,
        username: normalizeUsernameInput(username),
        phoneNumber: cleanPhoneNumber ?? undefined,
        bio: bio || undefined,
        age: age === '' ? undefined : Number(age),
        gender: gender || undefined,
        height: height || undefined,
        education: education || undefined,
        occupation: occupation || undefined,
        relationshipStatus: relationshipStatus || undefined,
      });
      updateUser({ ...user, name, username, phoneNumber: cleanPhoneNumber });
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const mediaUrl = await prepareAndUploadFile(file, 'profile');
      const res = await profileAPI.uploadProfilePicture(mediaUrl, user!.id);
      setProfilePicture(mediaUrl);
      updateUser({ ...user!, profilePicture: mediaUrl, photoVerifiedAt: res.photoVerifiedAt ?? null });
      setSuccess('Profile picture updated! Verify it\'s you to get the green badge.');
      setTimeout(() => setSuccess(''), 4000);
      setShowPhotoVerification(true);
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Upload failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (section: string, data: any) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await settingsAPI.updateSettings({ [section]: data });
      await loadSettings();
      if (section === 'notifications' && data.push === true) {
        const { subscribeUserToWebPush } = await import('../../lib/pushNotifications');
        const ok = await subscribeUserToWebPush();
        if (!ok) {
          setSuccess('Settings saved. If you want phone notifications, allow notifications when the browser asks.');
        } else {
          setSuccess('Settings saved — this device is subscribed for push.');
        }
      } else {
        setSuccess('Settings saved successfully!');
      }
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    if (settings) {
      handleSaveSettings('accessibility', { ...settings.accessibility, theme });
      // Apply theme immediately
      if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark-mode');
      } else {
        document.documentElement.classList.remove('dark-mode');
      }
    }
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'preferences', label: 'Preferences', icon: '⚙️' },
    { id: 'privacy', label: 'Privacy', icon: '🔒' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'filters', label: 'Filters', icon: '🔍' },
    { id: 'verification', label: 'Verification', icon: '✅' },
    { id: 'gamification', label: 'Badges & Points', icon: '🏆' },
    { id: 'premium', label: 'Premium', icon: '👑' },
    { id: 'social', label: 'Social', icon: '🔗' },
    { id: 'compatibility', label: 'Compatibility', icon: '💕' },
    { id: 'reports', label: 'Reports & Blocking', icon: '🛡️' },
    { id: 'accessibility', label: 'Accessibility', icon: '♿' },
    { id: 'profiles', label: 'Multiple Profiles', icon: '📋' },
    { id: 'account', label: 'Account', icon: '⚙️' },
  ];

  return (
    <div className="widget-full-content" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '20px', 
        flexWrap: 'wrap', 
        borderBottom: '2px solid #f3f4f6', 
        paddingBottom: '16px',
        position: 'sticky',
        top: 0,
        background: 'white',
        zIndex: 10,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id ? 'select-user-btn' : 'back-btn'}
            style={{ fontSize: '12px', padding: '8px 12px' }}
          >
            <span style={{ marginRight: '4px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-toast">{success}</div>}

      {/* PROFILE TAB */}
      {activeTab === 'profile' && (
        <div className="settings-section">
          <h3 style={{ marginBottom: '20px', fontSize: '20px' }}>Profile Settings</h3>
          
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Profile Picture</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  border: '3px solid #e5e7eb',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: profilePicture ? 'transparent' : '#f3f4f6',
                }}
              >
                {profilePicture ? (
                  <img src={profilePicture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '36px', color: '#9ca3af' }}>+</span>
                )}
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="back-btn">Change Picture</button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
            }} />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }} />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(normalizeUsernameInput(e.target.value))} placeholder="e.g. cool_user" style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }} />
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{USERNAME_HINT}</p>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
              Phone Number <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: 400 }}>(Optional - for password reset)</span>
            </label>
            <input 
              type="tel" 
              value={userPhoneNumber} 
              onChange={(e) => setUserPhoneNumber(formatPhoneNumber(e.target.value))}
              placeholder="+1 234 567 8901"
              autoComplete="tel"
              style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }} 
            />
            <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '4px' }}>
              Full number with country code (for password reset). Example: +491701234567
            </small>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="Tell us about yourself..." style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px', resize: 'vertical' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Age</label>
              <input type="number" value={age} onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : '')} min="18" max="99" style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Gender</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)} style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-binary</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Height</label>
              <input 
                type="text" 
                value={height} 
                onChange={(e) => setHeight(e.target.value)} 
                placeholder="e.g., 5'10&quot;" 
                style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }} 
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Education</label>
              <input 
                type="text" 
                value={education} 
                onChange={(e) => setEducation(e.target.value)} 
                placeholder="e.g., Bachelor's Degree" 
                style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }} 
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Occupation</label>
            <input type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="Your job title" style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }} />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Relationship Status</label>
            <select value={relationshipStatus} onChange={(e) => setRelationshipStatus(e.target.value)} style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}>
              <option value="">Select</option>
              <option value="single">Single</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
              <option value="separated">Separated</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Additional Photos</label>
            <input ref={photosInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => {
              const files = Array.from(e.target.files || []);
              files.forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  setPhotos([...photos, reader.result as string]);
                };
                reader.readAsDataURL(file);
              });
            }} />
            <button onClick={() => photosInputRef.current?.click()} className="back-btn" style={{ marginBottom: '10px' }}>Add Photos</button>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px' }}>
              {photos.map((photo, idx) => (
                <div key={idx} style={{ position: 'relative' }}>
                  <img src={photo} alt={`Photo ${idx + 1}`} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
                  <button onClick={() => setPhotos(photos.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: '4px', right: '4px', background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer' }}>×</button>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleSaveProfile} className="select-user-btn" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </div>
      )}

      {/* PREFERENCES TAB - Enhanced with filters */}
      {activeTab === 'preferences' && (
        <div className="settings-section">
          <h3 style={{ marginBottom: '20px', fontSize: '20px' }}>Dating Preferences</h3>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Orientation</label>
            <select value={preference?.orientation || 'straight'} onChange={(e) => setPreference({ ...(preference ?? { userId: user?.id ?? '', orientation: 'straight', lookingFor: ['dating'], city: '', lastActiveAt: new Date().toISOString() }), orientation: e.target.value as any })} style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}>
              <option value="straight">Straight</option>
              <option value="gay">Gay</option>
              <option value="lesbian">Lesbian</option>
              <option value="bisexual">Bisexual</option>
              <option value="pansexual">Pansexual</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Looking For (select two or more if you like)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {[
                { value: 'dating' as const, label: 'Dating' },
                { value: 'casual' as const, label: 'Casual' },
                { value: 'friends' as const, label: 'Friends' },
                { value: 'serious' as const, label: 'Serious Relationship' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    border: `2px solid ${(preference?.lookingFor ?? []).includes(opt.value) ? '#00d4ff' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    background: (preference?.lookingFor ?? []).includes(opt.value) ? 'rgba(0, 212, 255, 0.1)' : '#f9fafb',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={(preference?.lookingFor ?? ['dating']).includes(opt.value)}
                    onChange={() => {
                      const current = preference?.lookingFor ?? ['dating'];
                      const next = current.includes(opt.value)
                        ? current.filter((v) => v !== opt.value)
                        : [...current, opt.value];
                      setPreference({ ...preference!, lookingFor: next.length ? next : ['dating'] });
                    }}
                    style={{ width: '18px', height: '18px', accentColor: '#00d4ff' }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Your City</label>
            <input type="text" value={preference?.city || ''} onChange={(e) => setPreference({ ...preference!, city: e.target.value })} placeholder="Enter your city..." style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }} />
          </div>

          {settings && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Daily Match Limit</label>
                  <input type="number" value={settings.matching.dailyMatchLimit} onChange={(e) => { const v = parseInt(e.target.value, 10); if (!Number.isNaN(v)) handleSaveSettings('matching', { ...settings.matching, dailyMatchLimit: Math.max(1, Math.min(100, v)) }); }} min="1" max="100" style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }} />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Swipe Reset</label>
                  <select value={settings.matching.swipeReset} onChange={(e) => handleSaveSettings('matching', { ...settings.matching, swipeReset: e.target.value as any })} style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="never">Never</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={settings.findFriends.enabled} onChange={(e) => handleSaveSettings('findFriends', { ...settings.findFriends, enabled: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                  <span style={{ fontWeight: 600 }}>Enable Find Friends Mode</span>
                </label>
                <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '4px' }}>Find activity partners (concert buddies, gym partners, etc.)</small>
              </div>
            </>
          )}

          <button onClick={async () => {
            if (preference) {
              setLoading(true);
              try {
                await discoverAPI.setPreference(preference);
                setSuccess('Preferences saved!');
                setTimeout(() => setSuccess(''), 3000);
              } catch (err: any) {
                setError(err.response?.data?.error || 'Failed to save');
              } finally {
                setLoading(false);
              }
          }}} className="select-user-btn" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      )}

      {/* PRIVACY TAB - Enhanced */}
      {activeTab === 'privacy' && (
        <div className="settings-section">
          <h3 style={{ marginBottom: '20px', fontSize: '20px' }}>Privacy Settings</h3>
          {!settings ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
              <p>Loading settings...</p>
              <button type="button" className="back-btn" onClick={() => loadSettings()}>Retry</button>
            </div>
          ) : (
        <>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.privacy.showProfilePicture ?? true} onChange={(e) => handleSaveSettings('privacy', { ...settings.privacy, showProfilePicture: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600 }}>Show Profile Picture</span>
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.privacy.showLocation} onChange={(e) => handleSaveSettings('privacy', { ...settings.privacy, showLocation: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600 }}>Show Location</span>
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Location Accuracy</label>
            <select value={settings.privacy.locationAccuracy} onChange={(e) => handleSaveSettings('privacy', { ...settings.privacy, locationAccuracy: e.target.value as any })} style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}>
              <option value="exact">Exact</option>
              <option value="approximate">Approximate</option>
              <option value="city">City Only</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.privacy.realTimeLocation} onChange={(e) => handleSaveSettings('privacy', { ...settings.privacy, realTimeLocation: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600 }}>Real-time Location Sharing</span>
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.privacy.showOnlineStatus} onChange={(e) => handleSaveSettings('privacy', { ...settings.privacy, showOnlineStatus: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600 }}>Show Online Status</span>
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.privacy.readReceipts} onChange={(e) => handleSaveSettings('privacy', { ...settings.privacy, readReceipts: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600 }}>Read Receipts</span>
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Profile Visibility</label>
            <select value={settings.privacy.profileVisibility} onChange={(e) => handleSaveSettings('privacy', { ...settings.privacy, profileVisibility: e.target.value as any })} style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}>
              <option value="public">Public</option>
              <option value="friends">Friends Only</option>
              <option value="private">Private</option>
            </select>
          </div>
        </>
          )}
        </div>
      )}

      {/* NOTIFICATIONS TAB */}
      {activeTab === 'notifications' && (
        <div className="settings-section">
          <h3 style={{ marginBottom: '20px', fontSize: '20px' }}>Notification Settings</h3>
          {!settings ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
              <p>Loading settings...</p>
              <button type="button" className="back-btn" onClick={() => loadSettings()}>Retry</button>
            </div>
          ) : (
        <>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.notifications.push} onChange={(e) => handleSaveSettings('notifications', { ...settings.notifications, push: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600 }}>Push Notifications</span>
            </label>
            <button
              type="button"
              className="back-btn"
              style={{ marginTop: '10px', marginLeft: '28px' }}
              onClick={async () => {
                setLoading(true);
                setError('');
                try {
                  const { subscribeUserToWebPush } = await import('../../lib/pushNotifications');
                  const ok = await subscribeUserToWebPush();
                  setSuccess(ok ? 'This device can receive phone-style notifications.' : 'Could not enable push — allow notifications in the browser and ensure the server has VAPID keys set.');
                  setTimeout(() => setSuccess(''), 5000);
                } finally {
                  setLoading(false);
                }
              }}
            >
              Register this phone / browser for alerts
            </button>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.notifications.email} onChange={(e) => handleSaveSettings('notifications', { ...settings.notifications, email: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600 }}>Email Notifications</span>
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.notifications.messages} onChange={(e) => handleSaveSettings('notifications', { ...settings.notifications, messages: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600 }}>New Messages</span>
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.notifications.matches} onChange={(e) => handleSaveSettings('notifications', { ...settings.notifications, matches: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600 }}>New Matches</span>
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.notifications.likes} onChange={(e) => handleSaveSettings('notifications', { ...settings.notifications, likes: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600 }}>Likes</span>
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.notifications.interestAlerts !== false}
                onChange={(e) => handleSaveSettings('notifications', { ...settings.notifications, interestAlerts: e.target.checked })}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 600 }}>Interest requests (Discover)</span>
            </label>
            <p style={{ margin: '6px 0 0 28px', fontSize: '12px', color: '#6b7280' }}>
              Notify when someone sends you an interest. They have 24 hours to wait for your reply before it expires.
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.notifications.interestVibrate !== false}
                onChange={(e) => handleSaveSettings('notifications', { ...settings.notifications, interestVibrate: e.target.checked })}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 600 }}>Vibrate for interest alerts</span>
            </label>
            <p style={{ margin: '6px 0 0 28px', fontSize: '12px', color: '#6b7280' }}>
              Short vibration pattern on supported phones when an interest push arrives (only if push notifications are on).
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.notifications.sound} onChange={(e) => handleSaveSettings('notifications', { ...settings.notifications, sound: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600 }}>Notification Sound</span>
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.notifications.quietHours.enabled} onChange={(e) => handleSaveSettings('notifications', { ...settings.notifications, quietHours: { ...settings.notifications.quietHours, enabled: e.target.checked } })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600 }}>Quiet Hours</span>
            </label>
            {settings.notifications.quietHours.enabled && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <input type="time" value={settings.notifications.quietHours.start} onChange={(e) => handleSaveSettings('notifications', { ...settings.notifications, quietHours: { ...settings.notifications.quietHours, start: e.target.value } })} style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                <span style={{ alignSelf: 'center' }}>to</span>
                <input type="time" value={settings.notifications.quietHours.end} onChange={(e) => handleSaveSettings('notifications', { ...settings.notifications, quietHours: { ...settings.notifications.quietHours, end: e.target.value } })} style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
              </div>
            )}
          </div>
        </>
          )}
        </div>
      )}

      {/* FILTERS TAB */}
      {activeTab === 'filters' && (
        <div className="settings-section">
          <h3 style={{ marginBottom: '20px', fontSize: '20px' }}>Search Filters</h3>
          {!settings ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
              <p>Loading settings...</p>
              <button type="button" className="back-btn" onClick={() => loadSettings()}>Retry</button>
            </div>
          ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Min Age</label>
              <input type="number" value={settings.filters.minAge} onChange={(e) => handleSaveSettings('filters', { ...settings.filters, minAge: parseInt(e.target.value) })} min="18" max="99" style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Max Age</label>
              <input type="number" value={settings.filters.maxAge} onChange={(e) => handleSaveSettings('filters', { ...settings.filters, maxAge: parseInt(e.target.value) })} min="18" max="99" style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Genders</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {['male', 'female', 'non-binary', 'other'].map(g => (
                <label key={g} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={settings.filters.genders.includes(g)} onChange={(e) => {
                    const newGenders = e.target.checked ? [...settings.filters.genders, g] : settings.filters.genders.filter(x => x !== g);
                    handleSaveSettings('filters', { ...settings.filters, genders: newGenders });
                  }} />
                  <span style={{ textTransform: 'capitalize' }}>{g}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Max Distance (km)</label>
            <input type="number" value={settings.filters.maxDistance} onChange={(e) => handleSaveSettings('filters', { ...settings.filters, maxDistance: parseInt(e.target.value) })} min="1" max="1000" style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }} />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.filters.verifiedOnly} onChange={(e) => handleSaveSettings('filters', { ...settings.filters, verifiedOnly: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600 }}>Verified Users Only</span>
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.filters.activeOnly} onChange={(e) => handleSaveSettings('filters', { ...settings.filters, activeOnly: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600 }}>Active Users Only</span>
            </label>
          </div>
        </>
          )}
        </div>
      )}

      {/* VERIFICATION TAB */}
      {activeTab === 'verification' && (
        <div className="settings-section">
          <h3 style={{ marginBottom: '20px', fontSize: '20px' }}>Account Verification</h3>
          {!verification ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
              <p>Loading verification status...</p>
              <button type="button" className="back-btn" onClick={() => loadVerification()}>Retry</button>
            </div>
          ) : (
        <>

          <div style={{ marginBottom: '30px', padding: '20px', background: '#f9fafb', borderRadius: '12px' }}>
            <h4 style={{ marginBottom: '15px' }}>Verification Status</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Email: {user?.email}</span>
                {verification.email.verified ? (
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>✅ Verified</span>
                ) : (
                  <span style={{ color: '#ef4444' }}>❌ Not Verified</span>
                )}
              </div>
              {verification.phone.phoneNumber && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Phone: {verification.phone.phoneNumber}</span>
                  {verification.phone.verified ? (
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>✅ Verified</span>
                  ) : (
                    <span style={{ color: '#ef4444' }}>❌ Not Verified</span>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>ID Verification</span>
                {verification.id.verified ? (
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>✅ Verified</span>
                ) : verification.id.status === 'pending' ? (
                  <span style={{ color: '#f59e0b' }}>⏳ Pending Review</span>
                ) : (
                  <span style={{ color: '#ef4444' }}>❌ Not Verified</span>
                )}
              </div>
            </div>
          </div>

          {!verification.email.verified && (
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '10px' }}>Verify Email</h4>
              <button onClick={async () => {
                try {
                  const res = await verificationAPI.sendEmailVerification();
                  alert(`Verification code sent! Code: ${res.code} (remove in production)`);
                } catch (err) {
                  alert('Failed to send verification code');
                }
              }} className="back-btn" style={{ marginBottom: '10px' }}>Send Verification Code</button>
              <input type="text" value={emailCode} onChange={(e) => setEmailCode(e.target.value)} placeholder="Enter code" style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', marginBottom: '10px' }} />
              <button onClick={async () => {
                try {
                  await verificationAPI.verifyEmail(emailCode);
                  setSuccess('Email verified!');
                  await loadVerification();
                  setTimeout(() => setSuccess(''), 3000);
                } catch (err) {
                  setError('Invalid code');
                }
              }} className="select-user-btn">Verify</button>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <h4 style={{ marginBottom: '10px' }}>Verify Phone</h4>
            <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Phone number" style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', marginBottom: '10px' }} />
            <button onClick={async () => {
              try {
                const res = await verificationAPI.sendPhoneVerification(phoneNumber);
                alert(`Verification code sent! Code: ${res.code} (remove in production)`);
              } catch (err) {
                alert('Failed to send verification code');
              }
            }} className="back-btn" style={{ marginBottom: '10px' }}>Send Code</button>
            <input type="text" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} placeholder="Enter code" style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', marginBottom: '10px' }} />
            <button onClick={async () => {
              try {
                await verificationAPI.verifyPhone(phoneCode);
                setSuccess('Phone verified!');
                await loadVerification();
                setTimeout(() => setSuccess(''), 3000);
              } catch (err) {
                setError('Invalid code');
              }
            }} className="select-user-btn">Verify</button>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <h4 style={{ marginBottom: '10px' }}>Social Accounts</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <span>Google: {verification.social.google.connected ? verification.social.google.email : 'Not connected'}</span>
                {verification.social.google.connected ? (
                  <button onClick={async () => {
                    await verificationAPI.disconnectSocial('google');
                    await loadVerification();
                  }} className="back-btn" style={{ fontSize: '12px' }}>Disconnect</button>
                ) : (
                  <button onClick={async () => {
                    const email = prompt('Enter Google email:');
                    if (email) {
                      await verificationAPI.connectSocial('google', email);
                      await loadVerification();
                    }
                  }} className="select-user-btn" style={{ fontSize: '12px' }}>Connect</button>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <span>Social profile: {verification.social.facebook.connected ? verification.social.facebook.email : 'Not connected'}</span>
                {verification.social.facebook.connected ? (
                  <button onClick={async () => {
                    await verificationAPI.disconnectSocial('facebook');
                    await loadVerification();
                  }} className="back-btn" style={{ fontSize: '12px' }}>Disconnect</button>
                ) : (
                  <button onClick={async () => {
                    const email = prompt('Enter your public profile email:');
                    if (email) {
                      await verificationAPI.connectSocial('facebook', email);
                      await loadVerification();
                    }
                  }} className="select-user-btn" style={{ fontSize: '12px' }}>Connect</button>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <span>Photo profile: {verification.social.instagram.connected ? verification.social.instagram.username : 'Not connected'}</span>
                {verification.social.instagram.connected ? (
                  <button onClick={async () => {
                    await verificationAPI.disconnectSocial('instagram');
                    await loadVerification();
                  }} className="back-btn" style={{ fontSize: '12px' }}>Disconnect</button>
                ) : (
                  <button onClick={async () => {
                    const username = prompt('Enter your public profile username:');
                    if (username) {
                      await verificationAPI.connectSocial('instagram', username);
                      await loadVerification();
                    }
                  }} className="select-user-btn" style={{ fontSize: '12px' }}>Connect</button>
                )}
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <h4 style={{ marginBottom: '10px' }}>ID Verification (for Guide Badge)</h4>
            <input type="file" accept="image/*" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onloadend = async () => {
                  try {
                    await verificationAPI.uploadId(reader.result as string);
                    setSuccess('ID uploaded! Pending review.');
                    await loadVerification();
                    setTimeout(() => setSuccess(''), 3000);
                  } catch (err) {
                    setError('Upload failed');
                  }
                };
                reader.readAsDataURL(file);
              }
            }} style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px' }} />
            <small style={{ color: '#6b7280', fontSize: '12px' }}>Upload a government-issued ID for guide verification</small>
          </div>
        </>
          )}
        </div>
      )}

      {/* GAMIFICATION TAB */}
      {activeTab === 'gamification' && (
        <div className="settings-section">
          <BadgeGallery />
        </div>
      )}

      {/* PREMIUM TAB */}
      {activeTab === 'premium' && (
        <div className="settings-section">
          <h3 style={{ marginBottom: '20px', fontSize: '20px' }}>Premium Subscription</h3>

          {premiumStatus ? (
            <div style={{ marginBottom: '30px', padding: '20px', background: '#f0fdf4', borderRadius: '12px', border: '2px solid #10b981' }}>
              <h4 style={{ marginBottom: '10px', color: '#10b981' }}>✅ Active Premium</h4>
              <p style={{ margin: '4px 0' }}>Plan: {premiumStatus.planId}</p>
              <p style={{ margin: '4px 0' }}>Status: {premiumStatus.status}</p>
              {premiumStatus.endDate && <p style={{ margin: '4px 0' }}>Renews: {new Date(premiumStatus.endDate).toLocaleDateString()}</p>}
              <button onClick={async () => {
                if (window.confirm('Cancel subscription?')) {
                  try {
                    await premiumAPI.cancel();
                    setSuccess('Subscription cancelled');
                    await loadPremiumData();
                    setTimeout(() => setSuccess(''), 3000);
                  } catch (err) {
                    setError('Failed to cancel');
                  }
                }
              }} className="back-btn" style={{ marginTop: '10px' }}>Cancel Subscription</button>
            </div>
          ) : (
            <div style={{ marginBottom: '30px' }}>
              <h4 style={{ marginBottom: '15px' }}>Choose a Plan</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                {premiumPlans.map(plan => (
                  <div key={plan.id} style={{ padding: '20px', border: plan.popular ? '2px solid #ff6b9d' : '1px solid #e5e7eb', borderRadius: '12px', background: plan.popular ? '#fef2f2' : 'white', position: 'relative' }}>
                    {plan.popular && <div style={{ position: 'absolute', top: '-10px', right: '10px', background: '#ff6b9d', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '12px' }}>POPULAR</div>}
                    <h4 style={{ marginBottom: '10px' }}>{plan.name}</h4>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>${plan.price}</div>
                    <ul style={{ listStyle: 'none', padding: 0, marginBottom: '15px' }}>
                      {plan.features.map((f, idx) => (
                        <li key={idx} style={{ marginBottom: '5px', fontSize: '14px' }}>✓ {f}</li>
                      ))}
                    </ul>
                    <button onClick={async () => {
                      const paymentMethod = prompt('Enter payment method ID (Stripe):');
                      if (paymentMethod) {
                        try {
                          await premiumAPI.subscribe(plan.id, paymentMethod);
                          setSuccess('Subscribed successfully!');
                          await loadPremiumData();
                          setTimeout(() => setSuccess(''), 3000);
                        } catch (err) {
                          setError('Subscription failed');
                        }
                      }
                    }} className={plan.popular ? 'select-user-btn' : 'back-btn'} style={{ width: '100%' }}>Subscribe</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {paymentHistory.length > 0 && (
            <div>
              <h4 style={{ marginBottom: '15px' }}>Payment History</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {paymentHistory.map(payment => (
                  <div key={payment.id} style={{ padding: '15px', border: '1px solid #e5e7eb', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{payment.planName}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{new Date(payment.paymentDate).toLocaleDateString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold' }}>${payment.amount}</div>
                      <div style={{ fontSize: '12px', color: payment.status === 'completed' ? '#10b981' : '#ef4444' }}>{payment.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SOCIAL TAB */}
      {activeTab === 'social' && verification && (
        <div className="settings-section">
          <h3 style={{ marginBottom: '20px', fontSize: '20px' }}>Social Media Integration</h3>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>Connect your social accounts to import photos and verify your identity</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ padding: '20px', border: '1px solid #e5e7eb', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Google</div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  {verification.social.google.connected ? `Connected: ${verification.social.google.email}` : 'Not connected'}
                </div>
              </div>
              {verification.social.google.connected ? (
                <button onClick={async () => {
                  await verificationAPI.disconnectSocial('google');
                  await loadVerification();
                }} className="back-btn">Disconnect</button>
              ) : (
                <button onClick={async () => {
                  const email = prompt('Enter Google email:');
                  if (email) {
                    await verificationAPI.connectSocial('google', email);
                    await loadVerification();
                  }
                }} className="select-user-btn">Connect</button>
              )}
            </div>

            <div style={{ padding: '20px', border: '1px solid #e5e7eb', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Social profile</div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  {verification.social.facebook.connected ? `Connected: ${verification.social.facebook.email}` : 'Not connected'}
                </div>
              </div>
              {verification.social.facebook.connected ? (
                <button onClick={async () => {
                  await verificationAPI.disconnectSocial('facebook');
                  await loadVerification();
                }} className="back-btn">Disconnect</button>
              ) : (
                <button onClick={async () => {
                  const email = prompt('Enter your public profile email:');
                  if (email) {
                    await verificationAPI.connectSocial('facebook', email);
                    await loadVerification();
                  }
                }} className="select-user-btn">Connect</button>
              )}
            </div>

            <div style={{ padding: '20px', border: '1px solid #e5e7eb', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Photo profile</div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  {verification.social.instagram.connected ? `Connected: @${verification.social.instagram.username}` : 'Not connected'}
                </div>
              </div>
              {verification.social.instagram.connected ? (
                <button onClick={async () => {
                  await verificationAPI.disconnectSocial('instagram');
                  await loadVerification();
                }} className="back-btn">Disconnect</button>
              ) : (
                <button onClick={async () => {
                  const username = prompt('Enter your public profile username:');
                  if (username) {
                    await verificationAPI.connectSocial('instagram', username);
                    await loadVerification();
                  }
                }} className="select-user-btn">Connect</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* COMPATIBILITY TAB */}
      {activeTab === 'compatibility' && (
        <div className="settings-section">
          <h3 style={{ marginBottom: '20px', fontSize: '20px' }}>Compatibility Quiz</h3>

          {showQuiz ? (
            <CompatibilityQuiz onComplete={async () => {
              setShowQuiz(false);
              await loadCompatibility();
            }} />
          ) : compatibilityResult ? (
            <div>
              <div style={{ marginBottom: '20px', padding: '20px', background: '#f9fafb', borderRadius: '12px' }}>
                <h4 style={{ marginBottom: '15px' }}>Your Personality Scores</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span>Openness</span>
                      <span>{compatibilityResult.scores.openness}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${compatibilityResult.scores.openness}%`, height: '100%', background: '#667eea' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span>Conscientiousness</span>
                      <span>{compatibilityResult.scores.conscientiousness}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${compatibilityResult.scores.conscientiousness}%`, height: '100%', background: '#667eea' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span>Extraversion</span>
                      <span>{compatibilityResult.scores.extraversion}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${compatibilityResult.scores.extraversion}%`, height: '100%', background: '#667eea' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span>Agreeableness</span>
                      <span>{compatibilityResult.scores.agreeableness}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${compatibilityResult.scores.agreeableness}%`, height: '100%', background: '#667eea' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span>Neuroticism</span>
                      <span>{compatibilityResult.scores.neuroticism}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${compatibilityResult.scores.neuroticism}%`, height: '100%', background: '#667eea' }} />
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowQuiz(true)} className="select-user-btn">Retake Quiz</button>
            </div>
          ) : (
            <div>
              <p style={{ marginBottom: '20px', color: '#6b7280' }}>Take our compatibility quiz to discover your personality type and find better matches!</p>
              <button onClick={() => setShowQuiz(true)} className="select-user-btn">Start Quiz</button>
            </div>
          )}
        </div>
      )}

      {/* REPORTS TAB */}
      {activeTab === 'reports' && (
        <div className="settings-section">
          <h3 style={{ marginBottom: '20px', fontSize: '20px' }}>Reports & Blocking</h3>

          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ marginBottom: '15px' }}>Blocked Users</h4>
            {blockedUsers.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No blocked users</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {blockedUsers.map(blocked => (
                  <div key={blocked.id} style={{ padding: '15px', border: '1px solid #e5e7eb', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{blocked.name}</span>
                    <button onClick={async () => {
                      try {
                        await safetyAPI.unblockUser(blocked.id);
                        await loadBlockedUsers();
                        setSuccess('User unblocked');
                        setTimeout(() => setSuccess(''), 3000);
                      } catch (err) {
                        setError('Failed to unblock');
                      }
                    }} className="back-btn" style={{ fontSize: '12px' }}>Unblock</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 style={{ marginBottom: '15px' }}>Report a User</h4>
            <p style={{ color: '#6b7280', marginBottom: '15px' }}>Report inappropriate behavior or content. Enter their username or user ID.</p>
            <input type="text" placeholder="Enter user ID or username" value={reportQuery} onChange={(e) => setReportQuery(e.target.value)} style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', marginBottom: '10px' }} />
            <button onClick={async () => {
              const q = reportQuery.trim();
              if (!q) {
                setError('Please enter a user ID or username');
                return;
              }
              setReportLookupLoading(true);
              setError('');
              try {
                const data = await reportsAPI.lookupUser(q);
                setReportTarget({ id: data.userId, name: data.name || data.username || data.userId });
                setShowReportModal(true);
              } catch (err: any) {
                setError(err.response?.status === 404 ? 'User not found' : 'Lookup failed');
              } finally {
                setReportLookupLoading(false);
              }
            }} className="select-user-btn" disabled={reportLookupLoading}>
              {reportLookupLoading ? 'Looking up...' : 'Report User'}
            </button>
          </div>

          {showReportModal && reportTarget && (
            <ReportModal
              reportedUserId={reportTarget.id}
              reportedUserName={reportTarget.name}
              onClose={() => {
                setShowReportModal(false);
                setReportTarget(null);
              }}
              onReported={async () => {
                await loadBlockedUsers();
              }}
            />
          )}
        </div>
      )}

      {/* ACCESSIBILITY TAB */}
      {activeTab === 'accessibility' && (
        <div className="settings-section">
          <h3 style={{ marginBottom: '20px', fontSize: '20px' }}>Accessibility & Appearance</h3>
          {!settings ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
              <p>Loading settings...</p>
              <button type="button" className="back-btn" onClick={() => loadSettings()}>Retry</button>
            </div>
          ) : (
        <>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Theme</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {(['light', 'dark', 'system'] as const).map(theme => (
                <button
                  key={theme}
                  onClick={() => handleThemeChange(theme)}
                  className={settings.accessibility.theme === theme ? 'select-user-btn' : 'back-btn'}
                  style={{ flex: 1, textTransform: 'capitalize' }}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Font Size</label>
            <select value={settings.accessibility.fontSize} onChange={(e) => handleSaveSettings('accessibility', { ...settings.accessibility, fontSize: e.target.value as any })} style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.accessibility.screenReader} onChange={(e) => handleSaveSettings('accessibility', { ...settings.accessibility, screenReader: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600 }}>Screen Reader Support</span>
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.accessibility.highContrast} onChange={(e) => handleSaveSettings('accessibility', { ...settings.accessibility, highContrast: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600 }}>High Contrast Mode</span>
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Language</label>
            <select
              value={settings.localization.language}
              onChange={(e) => {
                const code = e.target.value;
                setStoredLanguage(code);
                handleSaveSettings('localization', { ...settings.localization, language: code });
              }}
              style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Time Format</label>
            <select value={settings.localization.timeFormat} onChange={(e) => handleSaveSettings('localization', { ...settings.localization, timeFormat: e.target.value as any })} style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}>
              <option value="12h">12-hour</option>
              <option value="24h">24-hour</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.video.autoPlay} onChange={(e) => handleSaveSettings('video', { ...settings.video, autoPlay: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600 }}>Auto-play Videos</span>
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.video.muteByDefault} onChange={(e) => handleSaveSettings('video', { ...settings.video, muteByDefault: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600 }}>Mute Videos by Default</span>
            </label>
          </div>
        </>
          )}
        </div>
      )}

      {/* MULTIPLE PROFILES TAB */}
      {activeTab === 'profiles' && (
        <div className="settings-section">
          <h3 style={{ marginBottom: '20px', fontSize: '20px' }}>Multiple Dating Profiles</h3>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>Create separate profiles for different dating goals</p>
          <button className="select-user-btn" onClick={() => alert('Multiple profiles feature - coming soon!')}>Create New Profile</button>
          <p style={{ marginTop: '20px', fontSize: '14px', color: '#6b7280' }}>Switch between casual dating, serious relationships, and friend-seeking profiles</p>
        </div>
      )}

      {/* ACCOUNT TAB */}
      {activeTab === 'account' && (
        <div className="settings-section">
          <h3 style={{ marginBottom: '20px', fontSize: '20px' }}>Account Management</h3>

          <div style={{ marginBottom: '30px', padding: '20px', background: '#f9fafb', borderRadius: '12px' }}>
            <h4 style={{ marginBottom: '12px' }}>Account Information</h4>
            <p style={{ margin: '4px 0', color: '#6b7280' }}><strong>Email:</strong> {user?.email}</p>
            <p style={{ margin: '4px 0', color: '#6b7280' }}><strong>Phone:</strong> {userPhoneNumber || 'Not set'}</p>
            <p style={{ margin: '4px 0', color: '#6b7280' }}><strong>Member since:</strong> {user?.id ? new Date(parseInt(user.id)).toLocaleDateString() : 'N/A'}</p>
          </div>

          <div style={{ marginBottom: '30px', padding: '20px', background: 'linear-gradient(135deg, #fdf2f8, #f5f3ff)', borderRadius: '12px', border: '1px solid #fbcfe8' }}>
            <h4 style={{ marginBottom: '8px' }}>Account balance</h4>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              Earn from guide sessions (80% after platform fee), monthly dating advice prizes (€5), and more.
              Withdraw to PayPal or bank details at month end — min €{walletSummary?.split.minWithdrawalEur ?? 20}.
            </p>
            {walletError && <div className="error-message" style={{ marginBottom: 12 }}>{walletError}</div>}
            {walletMessage && (
              <div style={{ padding: 12, background: '#d1fae5', color: '#065f46', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>
                {walletMessage}
              </div>
            )}
            {walletLoading ? (
              <p style={{ color: '#6b7280' }}>Loading balance…</p>
            ) : walletSummary ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
                  <div style={{ padding: 12, background: '#fff', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Available</div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>€{walletSummary.wallet.availableBalanceEur.toFixed(2)}</div>
                  </div>
                  <div style={{ padding: 12, background: '#fff', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Pending withdrawal</div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>€{walletSummary.wallet.pendingBalanceEur.toFixed(2)}</div>
                  </div>
                  <div style={{ padding: 12, background: '#fff', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Total earned</div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>€{walletSummary.wallet.totalEarnedEur.toFixed(2)}</div>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>PayPal email (withdrawals)</label>
                  <input
                    type="email"
                    value={walletPaypal}
                    onChange={(e) => setWalletPaypal(e.target.value)}
                    placeholder="you@paypal.com"
                    style={{ width: '100%', padding: 12, border: '2px solid #e5e7eb', borderRadius: 8 }}
                  />
                </div>
                <button
                  type="button"
                  className="select-user-btn"
                  style={{ marginBottom: 16 }}
                  onClick={async () => {
                    setWalletError('');
                    setWalletMessage('');
                    try {
                      await walletAPI.setPaypalEmail(walletPaypal);
                      setWalletMessage('PayPal email saved.');
                      walletAPI.getMyWallet().then(setWalletSummary);
                    } catch (err: any) {
                      setWalletError(err.response?.data?.error || 'Failed to save PayPal');
                    }
                  }}
                >
                  Save PayPal
                </button>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Bank / payout details</label>
                  <input
                    type="text"
                    value={walletBank}
                    onChange={(e) => setWalletBank(e.target.value)}
                    placeholder="IBAN, account nickname, or payment method label"
                    style={{ width: '100%', padding: 12, border: '2px solid #e5e7eb', borderRadius: 8 }}
                  />
                </div>
                <button
                  type="button"
                  className="select-user-btn"
                  style={{ marginBottom: 16 }}
                  onClick={async () => {
                    setWalletError('');
                    setWalletMessage('');
                    try {
                      await walletAPI.setBankLabel(walletBank);
                      setWalletMessage('Bank / payout details saved.');
                      walletAPI.getMyWallet().then(setWalletSummary);
                    } catch (err: any) {
                      setWalletError(err.response?.data?.error || 'Failed to save bank details');
                    }
                  }}
                >
                  Save bank details
                </button>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Withdraw amount (€)</label>
                  <input
                    type="number"
                    min={walletSummary.split.minWithdrawalEur}
                    step="0.01"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder={`Min €${walletSummary.split.minWithdrawalEur}`}
                    style={{ width: '100%', padding: 12, border: '2px solid #e5e7eb', borderRadius: 8 }}
                  />
                </div>
                <button
                  type="button"
                  className="select-user-btn"
                  onClick={async () => {
                    setWalletError('');
                    setWalletMessage('');
                    const amt = parseFloat(withdrawAmount);
                    if (!amt || amt < walletSummary.split.minWithdrawalEur) {
                      setWalletError(`Minimum withdrawal is €${walletSummary.split.minWithdrawalEur}`);
                      return;
                    }
                    try {
                      await walletAPI.withdraw(amt, walletPaypal || walletSummary.wallet.paypalEmail || undefined);
                      setWalletMessage('Withdrawal requested. Payouts processed within a few business days.');
                      setWithdrawAmount('');
                      walletAPI.getMyWallet().then(setWalletSummary);
                    } catch (err: any) {
                      setWalletError(err.response?.data?.error || 'Withdrawal failed');
                    }
                  }}
                >
                  Request withdrawal
                </button>

                {walletSummary.recentTransactions.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <h5 style={{ marginBottom: 8, fontSize: 14 }}>Recent activity</h5>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13, color: '#4b5563' }}>
                      {walletSummary.recentTransactions.slice(0, 8).map((tx) => (
                        <li key={tx.id} style={{ padding: '6px 0', borderBottom: '1px solid #e5e7eb' }}>
                          {tx.note || tx.type}: €{tx.amountEur.toFixed(2)} · {new Date(tx.createdAt).toLocaleDateString()}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: '#6b7280' }}>Could not load balance. Try again later.</p>
            )}
          </div>

          <div style={{ marginBottom: '30px', padding: '20px', background: '#fff', border: '2px solid #e5e7eb', borderRadius: '12px' }}>
            <h4 style={{ marginBottom: '16px' }}>Change Password</h4>
            {passwordError && <div className="error-message" style={{ marginBottom: '12px' }}>{passwordError}</div>}
            {passwordSuccess && <div style={{ padding: '12px', background: '#d1fae5', color: '#065f46', borderRadius: '8px', marginBottom: '12px', fontSize: '14px' }}>{passwordSuccess}</div>}
            
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter a strong password"
                minLength={8}
                style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}
              />
              <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                Password must be at least 8 characters and include:
                <br />• One uppercase letter • One lowercase letter • One number • One special character
              </small>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Confirm New Password</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Confirm your new password"
                minLength={8}
                style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}
              />
            </div>

            <button
              onClick={async () => {
                setPasswordError('');
                setPasswordSuccess('');
                
                if (!currentPassword || !newPassword || !confirmNewPassword) {
                  setPasswordError('All fields are required');
                  return;
                }

                if (newPassword !== confirmNewPassword) {
                  setPasswordError('New passwords do not match');
                  return;
                }

                // Validate strong password
                if (newPassword.length < 8) {
                  setPasswordError('Password must be at least 8 characters long');
                  return;
                }
                if (!/[a-z]/.test(newPassword)) {
                  setPasswordError('Password must contain at least one lowercase letter');
                  return;
                }
                if (!/[A-Z]/.test(newPassword)) {
                  setPasswordError('Password must contain at least one uppercase letter');
                  return;
                }
                if (!/[0-9]/.test(newPassword)) {
                  setPasswordError('Password must contain at least one number');
                  return;
                }
                if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
                  setPasswordError('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
                  return;
                }

                setLoading(true);
                try {
                  await authAPI.changePassword(currentPassword, newPassword);
                  setPasswordSuccess('Password changed successfully!');
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                  setTimeout(() => setPasswordSuccess(''), 5000);
                } catch (err: any) {
                  setPasswordError(err.response?.data?.error || 'Failed to change password. Please check your current password.');
                } finally {
                  setLoading(false);
                }
              }}
              className="select-user-btn"
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Changing Password...' : 'Change Password'}
            </button>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ marginBottom: '12px' }}>Date safe word</h4>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
              During an active date, saying or typing this word sends a safety signal to your emergency contact.
            </p>
            <input
              type="text"
              placeholder="Your secret safe word"
              maxLength={64}
              style={{ width: '100%', padding: '10px', marginBottom: '8px' }}
              onBlur={async (e) => {
                const v = e.target.value.trim();
                if (v.length < 3) return;
                try {
                  await safetyAPI.setDateSafeWord(v);
                } catch {
                  /* ignore */
                }
              }}
            />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ marginBottom: '12px' }}>Personal safety shield</h4>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
              Configure secret activate/cancel phrases, what you are wearing, and triggers (help button, screen taps, volume ×3, secret word). Use the shield button on the home screen when going out.
            </p>
            <input
              type="text"
              placeholder="What you usually wear (e.g. red jacket, white sneakers)"
              maxLength={300}
              style={{ width: '100%', padding: '10px', marginBottom: '8px' }}
              onBlur={async (e) => {
                const v = e.target.value.trim();
                if (!v) return;
                try {
                  await personalSafetyAPI.updateSettings({ appearanceDescription: v });
                } catch {
                  /* ignore */
                }
              }}
            />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ marginBottom: '12px' }}>Danger Zone</h4>
            <button onClick={async () => {
              if (!window.confirm('Are you sure? This cannot be undone.')) return;
              alert('Account deletion feature coming soon');
            }} className="danger-btn" disabled={loading} style={{ width: '100%', padding: '12px' }}>
              Delete Account
            </button>
            <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '8px' }}>
              This will permanently delete your account and all associated data.
            </small>
          </div>
        </div>
      )}

      {showPhotoVerification && user?.id && createPortal(
        <PhotoVerificationModal
          onClose={() => setShowPhotoVerification(false)}
          onVerified={async () => {
            const p = await profileAPI.getCurrentUser();
            updateUser(p);
            setShowPhotoVerification(false);
            setSuccess('Photo verified! Your profile shows the green badge.');
            setTimeout(() => setSuccess(''), 3000);
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

export default SettingsWidgetFull;
