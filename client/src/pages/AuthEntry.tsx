import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import GoogleContinueButton from '../components/GoogleContinueButton';
import './Auth.css';

type AuthMode = 'signup' | 'login';

type Props = { initialMode?: AuthMode };

const AuthEntry = ({ initialMode = 'signup' }: Props) => {
  const [searchParams] = useSearchParams();
  const mode: AuthMode = searchParams.get('mode') === 'login' || initialMode === 'login' ? 'login' : 'signup';
  const [error, setError] = useState('');
  const [oauthBusy, setOauthBusy] = useState(false);

  useEffect(() => {
    const oauthErr = searchParams.get('oauth_error');
    fetch('/api/auth/oauth/status', { cache: 'no-store', credentials: 'same-origin' })
      .then((r) => r.json())
      .then(() => {
        if (oauthErr && /not configured|GOOGLE_CLIENT/i.test(oauthErr)) {
          setError('');
        } else if (oauthErr) {
          setError(oauthErr);
        }
      })
      .catch(() => {
        if (oauthErr && /not configured|GOOGLE_CLIENT/i.test(oauthErr)) setError('');
        else if (oauthErr) setError(oauthErr);
      })
      .finally(() => {
        if (!oauthErr || typeof window === 'undefined') return;
        const next = new URL(window.location.href);
        if (!next.searchParams.has('oauth_error')) return;
        next.searchParams.delete('oauth_error');
        const qs = next.searchParams.toString();
        window.history.replaceState({}, '', `${next.pathname}${qs ? `?${qs}` : ''}${next.hash}`);
      });
  }, [searchParams]);

  useEffect(() => {
    try {
      localStorage.removeItem('hookup_last_username');
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <Link to="/" className="back-link">← Back</Link>
        <h1 className="auth-title">{mode === 'signup' ? 'Join Hook Up' : 'Welcome Back'}</h1>
        <p className="auth-subtitle">
          {mode === 'signup'
            ? 'Sign up with Google. A password is optional — add one later in Settings if you want a stronger sign-in.'
            : 'Sign in with the same Google account. A password is optional and can be added later in Settings.'}
        </p>

        {error && <div className="error-message">{error}</div>}
        {oauthBusy && (
          <div className="oauth-wait-banner">
            <div className="oauth-spinner" aria-hidden />
            <span>Connecting to Google…</span>
          </div>
        )}

        <div className="google-continue-wrap">
          <GoogleContinueButton
            label="Continue with Google"
            disabled={oauthBusy}
            onBusy={setOauthBusy}
            onError={setError}
          />
          <p className="google-continue-hint">
            Uses your Gmail. Same button to sign up and to log back in — pick that Google account again.
          </p>
        </div>

        {mode === 'signup' && (
          <p className="auth-later-note">
            Next you’ll choose gender, orientation, what you’re looking for, and agree to Terms and Privacy.
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthEntry;
