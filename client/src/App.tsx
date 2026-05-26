import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Login from './pages/Login';
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

  useEffect(() => {
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
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          delete axios.defaults.headers.common['Authorization'];
        }
      }
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    setLoading(false);
  }, []);

  // After load: refresh full profile from server so pictures, highlights, etc. are always current
  useEffect(() => {
    if (loading || !user?.id || hasRefreshedProfile.current) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    hasRefreshedProfile.current = true;
    Promise.all([
      profileAPI.getCurrentUser(),
      settingsAPI.getSettings().catch(() => null),
    ])
      .then(([fullProfile, settingsRes]) => {
        if (!isValidUserShape(fullProfile)) {
          // If the API returned HTML/string/invalid data, avoid crashing the app.
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          delete axios.defaults.headers.common['Authorization'];
          setUser(null);
          hasRefreshedProfile.current = false;
          return;
        }
        const id = normalizeUserId((fullProfile as { id: unknown }).id);
        const normalized = id
          ? { ...userForStorage(fullProfile as Record<string, unknown>), id }
          : userForStorage(fullProfile as Record<string, unknown>);
        setUser(normalized);
        localStorage.setItem('user', JSON.stringify(normalized));
        const lang = settingsRes?.settings?.localization?.language;
        if (typeof lang === 'string' && lang.trim()) {
          setStoredLanguage(lang.trim());
        }
      })
      .catch(() => { hasRefreshedProfile.current = false; });
  }, [loading, user?.id]);

  const login = (userData: any, token: string) => {
    const id = normalizeUserId(userData?.id);
    if (!isPlainObject(userData) || !id || typeof token !== 'string' || !token) {
      return;
    }
    const normalized = { ...userForStorage(userData as Record<string, unknown>), id };
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
          <Route path="/login" element={user ? <Navigate to={user.profileSetupComplete ? "/home" : "/profile-setup"} /> : <Login />} />
          <Route path="/signup" element={user ? <Navigate to={user.profileSetupComplete ? "/home" : "/profile-setup"} /> : <SignupWithImprovement />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/verify-email-pending" element={<VerifyEmailPending />} />
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" />} />
          <Route path="/settings" element={user ? <Settings /> : <Navigate to="/login" />} />
          <Route path="/profile-setup" element={user ? <ProfileSetup /> : <Navigate to="/login" />} />
          <Route path="/home" element={user ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/checkout" element={user ? <Checkout /> : <Navigate to="/login" />} />
          <Route path="/admin/safety" element={user ? <AdminSafetyReview /> : <Navigate to="/login" />} />
          <Route path="/" element={user ? <Navigate to={user.profileSetupComplete ? "/home" : "/profile-setup"} /> : <Landing />} />
        </Routes>
      </AuthContext.Provider>
    </LanguageProvider>
  );
}

export default App;

