import { useEffect, useContext, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { profileAPI } from '../api/profile';
import { getStayLoggedIn } from '../lib/authStorage';
import { handleGoogleAuthSessionFix } from '../lib/googleAuthSession';
import './Auth.css';

/** Lands here after Google/Facebook OAuth: /auth/callback?token=... */
const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [error, setError] = useState('');
  const [attemptKey, setAttemptKey] = useState(0);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Missing sign-in token. Try again from the login page.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        let full: Awaited<ReturnType<typeof profileAPI.getCurrentUser>> | null = null;
        let lastError: unknown;
        for (let attempt = 0; attempt < 3 && !full; attempt += 1) {
          try {
            full = await profileAPI.getCurrentUser();
          } catch (err) {
            lastError = err;
            await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
          }
        }
        if (cancelled) return;
        if (!full) throw lastError;
        const gender = String(full.gender || '').toLowerCase();
        const alreadySetUp = Boolean(
          full.profileSetupComplete ||
          searchParams.get('setup') === '1' ||
          (full.profilePicture && (gender === 'female' || gender === 'male'))
        );
        if (full.hasGoogleAuth && full.email) {
          const saved = await handleGoogleAuthSessionFix.syncGoogleAccountOnSignIn(full.email, {
            welcomeIfEmpty: !alreadySetUp,
          });
          if (saved == null) {
            await handleGoogleAuthSessionFix.linkGoogleAccountOnSignUp({
              email: full.email,
              uid: full.id,
              displayName: full.name,
              photoURL: full.profilePicture,
            });
            await handleGoogleAuthSessionFix.archiveLiveRecords(full.email);
          }
        }
        login(full as any, token, { stayLoggedIn: getStayLoggedIn() });
        navigate(alreadySetUp ? '/home' : '/profile-setup', { replace: true });
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.response?.data?.error || e?.message || 'Could not load your account yet. It is still there — tap Try again.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, login, navigate, attemptKey]);

  if (error) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">Sign-in issue</h1>
          <div className="error-message">{error}</div>
          <button type="button" className="auth-button" onClick={() => { setError(''); setAttemptKey((n) => n + 1); }}>
            Try again
          </button>
          <Link to="/login" className="auth-button" style={{ display: 'inline-block', textDecoration: 'none', marginTop: 12 }}>
            Back to Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Signing you in…</h1>
        <p className="auth-subtitle">One moment while we finish sign-in.</p>
      </div>
    </div>
  );
};

export default AuthCallback;
