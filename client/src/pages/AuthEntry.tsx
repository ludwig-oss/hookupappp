import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { prefetchOAuth, redirectToOAuth, type OAuthIntent } from '../lib/oauth';
import './Auth.css';

type Props = { initialMode?: 'signup' | 'login' };

const AuthEntry = (_props: Props) => {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<OAuthIntent | null>(null);

  useEffect(() => {
    prefetchOAuth('google', 'signup');
    prefetchOAuth('google', 'login');
  }, []);

  useEffect(() => {
    const oauthErr = searchParams.get('oauth_error');
    if (oauthErr && /not configured|GOOGLE_CLIENT/i.test(oauthErr)) setError('');
    else if (oauthErr) setError(oauthErr);
    if (!oauthErr || typeof window === 'undefined') return;
    const next = new URL(window.location.href);
    if (!next.searchParams.has('oauth_error')) return;
    next.searchParams.delete('oauth_error');
    const qs = next.searchParams.toString();
    window.history.replaceState({}, '', `${next.pathname}${qs ? `?${qs}` : ''}${next.hash}`);
  }, [searchParams]);

  const start = async (intent: OAuthIntent) => {
    setError('');
    setBusy(intent);
    try {
      await redirectToOAuth('google', intent);
    } catch (e: unknown) {
      setBusy(null);
      setError(e instanceof Error ? e.message : 'Could not start. Try again.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <Link to="/" className="back-link">← Back</Link>
        {error && <div className="error-message">{error}</div>}
        <div className="auth-method-tabs">
          <button type="button" className="auth-button auth-tab" disabled={busy !== null} onClick={() => void start('signup')}>
            {busy === 'signup' ? 'Signing up…' : 'Sign up'}
          </button>
          <button type="button" className="auth-button auth-tab" disabled={busy !== null} onClick={() => void start('login')}>
            {busy === 'login' ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthEntry;
