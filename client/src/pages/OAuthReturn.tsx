import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { warmBackend } from '../lib/warmBackend';
import type { OAuthProvider } from '../lib/oauth';
import './Auth.css';

const VALID: OAuthProvider[] = ['google', 'facebook', 'apple'];

/** Google/Apple/Facebook redirect here first — we wake the API, then finish on /api/auth/.../callback */
const OAuthReturn = () => {
  const { provider = '' } = useParams<{ provider: string }>();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!VALID.includes(provider as OAuthProvider)) {
      setError('Unknown sign-in provider.');
      return;
    }
    let cancelled = false;
    (async () => {
      const ok = await warmBackend(75000);
      if (cancelled) return;
      if (!ok) {
        setError('Could not reach the server. Wait a few seconds and try signing in again.');
        return;
      }
      const qs = searchParams.toString();
      window.location.replace(
        `${window.location.origin}/api/auth/${provider}/callback${qs ? `?${qs}` : ''}`
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, searchParams]);

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
        <h1 className="auth-title">Finishing sign-in…</h1>
        <p className="auth-subtitle">Connecting to your account — this only takes a moment.</p>
        <div className="oauth-spinner" aria-hidden />
      </div>
    </div>
  );
};

export default OAuthReturn;
