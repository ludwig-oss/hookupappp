import { Routes, Route } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { GuestOnly, RequireAuth, LandingOrRedirect } from './components/AuthRouteGuards';
import AuthEntry from './pages/AuthEntry';
import AuthCallback from './pages/AuthCallback';
import OAuthReturn from './pages/OAuthReturn';
import SignupWithImprovement from './pages/SignupWithImprovement';
import Landing from './pages/Landing';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import VerifyEmailPending from './pages/VerifyEmailPending';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import ProfileSetup from './pages/ProfileSetup';
import Settings from './pages/Settings';
import Home from './pages/Home';
import AdminSafetyReview from './pages/AdminSafetyReview';
import AdminCoachReview from './pages/AdminCoachReview';
import Checkout from './pages/Checkout';
import { AuthContext } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { profileAPI } from './api/profile';
import { settingsAPI } from './api/settings';
import { setStoredLanguage } from './i18n/languageStorage';
import { userForStorage } from './lib/userStorage';
import './api/http';

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** APIs / DB drivers sometimes return id as number; login() used to no-op silently. */
function normalizeUserId(v: unknown): string | null {
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v));
  return null;
}

function isValidUserShape(v: unknown): v is { id: string; profileSetupComplete?: boolean } {
  if (!isPlainObject(v)) return false;
  return normalizeUserId(v.id) !== null;
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const hasRefreshedProfile = useRef(false);
  const refreshGen = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const applyProfile = (fullProfile: unknown) => {
      if (cancelled || !isValidUserShape(fullProfile)) return false;
      const id = normalizeUserId((fullProfile as { id: unknown }).id);
      if (!id) return false;
      const normalized = { ...userForStorage(fullProfile as Record<string, unknown>), id };
      setUser(normalized);
      try {
        localStorage.setItem('user', JSON.stringify(normalized));
      } catch {
        /* quota — token session still valid */
      }
      return true;
    };

    const finishBoot = () => {
      if (!cancelled) setLoading(false);
    };

    try {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
      if (token && userData) {
        const parsed = JSON.parse(userData);
        if (isValidUserShape(parsed)) {
          const id = normalizeUserId(parsed.id);
          setUser(id ? { ...userForStorage(parsed as Record<string, unknown>), id } : parsed);
          finishBoot();
          return;
        }
        localStorage.removeItem('user');
      }
      if (token) {
        profileAPI
          .getCurrentUser()
          .then((fullProfile) => {
            applyProfile(fullProfile);
          })
          .catch(() => {
            /* keep token — user can sign in again without a phantom logout */
          })
          .finally(finishBoot);
        return;
      }
    } catch {
      localStorage.removeItem('user');
    }
    finishBoot();

    return () => {
      cancelled = true;
    };
  }, []);

  // Mid-session: token present but user cleared — rebuild once from /me
  useEffect(() => {
    if (loading || user?.id) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    let cancelled = false;
    profileAPI
      .getCurrentUser()
      .then((fullProfile) => {
        if (cancelled || !isValidUserShape(fullProfile)) return;
        const id = normalizeUserId((fullProfile as { id: unknown }).id);
        if (!id) return;
        const normalized = { ...userForStorage(fullProfile as unknown as Record<string, unknown>), id };
        setUser(normalized);
        try {
          localStorage.setItem('user', JSON.stringify(normalized));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loading, user?.id]);

  // After load: refresh full profile from server so pictures, highlights, etc. are always current
  useEffect(() => {
    if (loading || !user?.id || hasRefreshedProfile.current) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    hasRefreshedProfile.current = true;
    const gen = ++refreshGen.current;
    Promise.all([
      profileAPI.getCurrentUser(),
      settingsAPI.getSettings().catch(() => null),
    ])
      .then(([fullProfile, settingsRes]) => {
        if (gen !== refreshGen.current) return; // stale response after logout/re-login
        if (!isValidUserShape(fullProfile)) {
          // Keep current session — bad/HTML proxy responses must not wipe a valid login
          console.warn('Profile refresh returned invalid shape; keeping local session');
          return;
        }
        const id = normalizeUserId((fullProfile as { id: unknown }).id);
        const normalized = id
          ? { ...userForStorage(fullProfile as unknown as Record<string, unknown>), id }
          : userForStorage(fullProfile as unknown as Record<string, unknown>);
        setUser(normalized);
        localStorage.setItem('user', JSON.stringify(normalized));
        const lang = settingsRes?.settings?.localization?.language;
        if (typeof lang === 'string' && lang.trim()) {
          setStoredLanguage(lang.trim());
        }
      })
      .catch((err: any) => {
        if (gen !== refreshGen.current) return;
        console.warn('Profile refresh failed (session kept):', err?.response?.status || err?.message);
      });
  }, [loading, user?.id]);

  const login = (userData: any, token: string) => {
    const id = normalizeUserId(userData?.id);
    if (!isPlainObject(userData) || !id || typeof token !== 'string' || !token) {
      throw new Error('Invalid login payload');
    }
    const normalized = { ...userForStorage(userData as Record<string, unknown>), id };
    refreshGen.current += 1;
    hasRefreshedProfile.current = false;
    setUser(normalized);
    localStorage.setItem('token', token);
    try {
      localStorage.setItem('user', JSON.stringify(normalized));
    } catch {
      /* Quota exceeded — session still works via token + /me refresh */
    }
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  };

  const logout = () => {
    refreshGen.current += 1;
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    hasRefreshedProfile.current = false;
  };

  const updateUser = (updates: Partial<Record<string, any>>) => {
    setUser((prev: any) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem('user', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          fontSize: '18px',
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <LanguageProvider>
      <AuthContext.Provider value={{ user, login, logout, updateUser }}>
        <Routes>
          <Route path="/login" element={<GuestOnly><AuthEntry initialMode="login" /></GuestOnly>} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/oauth-return/:provider" element={<OAuthReturn />} />
          <Route path="/signup" element={<GuestOnly><AuthEntry initialMode="signup" /></GuestOnly>} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/verify-email-pending" element={<VerifyEmailPending />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
          <Route path="/profile-setup" element={<RequireAuth><ProfileSetup /></RequireAuth>} />
          <Route path="/home" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
          <Route path="/admin/safety" element={<RequireAuth><AdminSafetyReview /></RequireAuth>} />
          <Route path="/admin/coaches" element={<RequireAuth><AdminCoachReview /></RequireAuth>} />
          <Route path="/" element={user ? <LandingOrRedirect /> : <Landing />} />
        </Routes>
      </AuthContext.Provider>
    </LanguageProvider>
  );
}

export default App;

