import { useEffect, useContext, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { profileAPI } from '../api/profile';
import './Auth.css';

/** Lands here after Google/Facebook OAuth: /auth/callback?token=... */
const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Missing sign-in token. Try again from the login page.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        localStorage.setItem('token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const full = await profileAPI.getCurrentUser();
        if (cancelled) return;
        login(full as any, token);
        navigate(full.profileSetupComplete ? '/home' : '/profile-setup', { replace: true });
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.response?.data?.error || e?.message || 'Sign-in failed after OAuth. Try again.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, login, navigate]);

  if (error) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">Sign-in issue</h1>
          <div className="error-message">{error}</div>
          <Link to="/login" className="auth-button" style={{ display: 'inline-block', textDecoration: 'none' }}>
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
        <p className="auth-subtitle">One moment while we finish Google / Facebook login.</p>
      </div>
    </div>
  );
};

export default AuthCallback;
