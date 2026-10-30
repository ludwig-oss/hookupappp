import { useState, useContext, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { authAPI } from '../api/auth';
import { formatAxiosError } from '../lib/apiError';
import { normalizePinDigits } from '../lib/pin';
import { normalizeLoginIdentifier } from '../lib/username';
import PasswordInput from '../components/PasswordInput';
import GoogleContinueButton from '../components/GoogleContinueButton';
import './Auth.css';

function coerceUserId(u: unknown): string | null {
  if (typeof u === 'string' && u.length > 0) return u;
  if (typeof u === 'number' && Number.isFinite(u)) return String(Math.trunc(u));
  return null;
}

type AuthMode = 'signup' | 'login';
type LoginMethod = 'pin' | 'password';

type Props = { initialMode?: AuthMode };

const AuthEntry = ({ initialMode = 'signup' }: Props) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode: AuthMode =
    searchParams.get('mode') === 'login' || searchParams.get('mode') === 'signup'
      ? (searchParams.get('mode') as AuthMode)
      : initialMode;
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('pin');
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [failedTries, setFailedTries] = useState(0);
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginSecret, setLoginSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const setMode = (next: AuthMode) => {
    const params = new URLSearchParams(searchParams);
    params.set('mode', next);
    params.delete('oauth_error');
    setSearchParams(params, { replace: true });
    setError('');
  };

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

  const finishAuth = useCallback((user: { profileSetupComplete?: boolean }, token: string) => {
    const id = coerceUserId((user as { id?: unknown }).id);
    if (!id) throw new Error('Invalid user');
    login({ ...user, id }, token, { stayLoggedIn });
    navigate(user.profileSetupComplete ? '/home' : '/profile-setup', { replace: true });
  }, [login, navigate, stayLoggedIn]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const id = normalizeLoginIdentifier(loginIdentifier);
      const secret = loginSecret.trim();
      if (!id) throw new Error('Enter your username or Gmail');
      if (!secret) throw new Error(loginMethod === 'pin' ? 'Enter your 6-digit PIN' : 'Enter your password');

      let response;
      if (loginMethod === 'pin') {
        const pinDigits = normalizePinDigits(secret);
        if (pinDigits.length !== 6) {
          throw new Error('PIN must be exactly 6 digits');
        }
        response = await authAPI.loginWithPin(id, pinDigits, stayLoggedIn);
      } else {
        response = await authAPI.login({ identifier: id, username: id, password: secret, stayLoggedIn });
      }

      if (!response.token || !response.user) throw new Error('Invalid login response');
      finishAuth(response.user, response.token);
    } catch (err: unknown) {
      setFailedTries((n) => n + 1);
      setError(formatAxiosError(err, loginMethod === 'pin' ? 'Wrong username or PIN' : 'Wrong username or password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <Link to="/" className="back-link">← Back</Link>
        <h1 className="auth-title">{mode === 'signup' ? 'Join Hook Up' : 'Welcome Back'}</h1>
        <p className="auth-subtitle">
          {mode === 'signup'
            ? 'Sign up with Google. Gender and what you want are asked once, after Google — not again when you come back.'
            : 'Sign in with the same Google account, or with your username and PIN. This does not create a new account.'}
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
            label={mode === 'signup' ? 'Continue with Google' : 'Sign in with Google'}
            intent={mode === 'login' ? 'login' : 'signup'}
            disabled={loading || oauthBusy}
            onBusy={setOauthBusy}
            onError={setError}
          />
          <p className="google-continue-hint">
            {mode === 'signup'
              ? 'Uses your Gmail to create the account. If this Gmail is already joined, you go straight in.'
              : 'Uses the Gmail you already joined with. A new account is not created from this button.'}
          </p>
        </div>

        <div className="auth-or-divider">or</div>

        <div className="auth-method-tabs">
          <button type="button" className={`auth-button auth-tab ${mode === 'signup' ? 'is-active' : ''}`} onClick={() => setMode('signup')}>
            Sign up
          </button>
          <button type="button" className={`auth-button auth-tab ${mode === 'login' ? 'is-active' : ''}`} onClick={() => setMode('login')}>
            Sign in
          </button>
        </div>

        {mode === 'signup' ? (
          <p className="auth-later-note">
            Next you’ll choose gender, orientation, what you’re looking for, and agree to Terms and Privacy. That step is skipped once the account is finished.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <button type="button" className="auth-button" style={{ flex: 1, minWidth: 100, opacity: loginMethod === 'pin' ? 1 : 0.65 }} onClick={() => { setLoginMethod('pin'); setLoginSecret(''); }}>Username + PIN</button>
              <button type="button" className="auth-button" style={{ flex: 1, minWidth: 80, opacity: loginMethod === 'password' ? 1 : 0.65 }} onClick={() => { setLoginMethod('password'); setLoginSecret(''); }}>Password</button>
            </div>
            <form onSubmit={handleLogin} className="auth-form" autoComplete="off">
              <div className="form-group">
                <label>Username or Gmail</label>
                <input
                  name="aswp-login-username"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(normalizeLoginIdentifier(e.target.value))}
                  placeholder="username or you@gmail.com"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="login-secret">{loginMethod === 'pin' ? '6-digit PIN' : 'Password'}</label>
                <PasswordInput
                  id="login-secret"
                  value={loginSecret}
                  onChange={setLoginSecret}
                  autoComplete={loginMethod === 'pin' ? 'one-time-code' : 'current-password'}
                  placeholder={loginMethod === 'pin' ? '6-digit PIN' : 'Your password'}
                  inputMode={loginMethod === 'pin' ? 'numeric' : 'text'}
                  maxLength={loginMethod === 'pin' ? 6 : undefined}
                  digitsOnly={loginMethod === 'pin'}
                  required
                />
              </div>
              {loginMethod === 'pin' ? (
                <Link to="/forgot-pin" className="forgot-link">Forgot PIN?</Link>
              ) : (
                <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
              )}
              <label className="stay-logged-in">
                <input type="checkbox" checked={stayLoggedIn} onChange={(e) => setStayLoggedIn(e.target.checked)} />
                Stay logged in on this device.
              </label>
              <button type="submit" className="auth-button face-id-primary" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              {failedTries >= 3 && (
                <div className="recovery-helper">
                  <p>Having trouble? This helper only works for your username. We show hints — never the real PIN or password.</p>
                  <Link to="/forgot-pin">Recover PIN</Link>
                  {' · '}
                  <Link to="/forgot-password">Recover password</Link>
                </div>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthEntry;
