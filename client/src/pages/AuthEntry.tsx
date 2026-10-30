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
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(initialMode);
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

  useEffect(() => {
    const m = searchParams.get('mode');
    if (m === 'login') setMode('login');
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
            ? 'Sign up with Google. A password is optional — add one later in Settings if you want a stronger sign-in.'
            : 'Continue with Google, or sign in with the username, PIN, or password you already use.'}
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
            disabled={loading}
            onBusy={setOauthBusy}
            onError={setError}
          />
          <p className="google-continue-hint">
            Uses your Gmail. Same button to sign up and to log back in — pick that Google account again.
          </p>
        </div>
        {mode === 'login' && <div className="auth-or-divider">or</div>}

        <div className="auth-method-tabs">
          <button type="button" className={`auth-button auth-tab ${mode === 'signup' ? 'is-active' : ''}`} onClick={() => setMode('signup')}>Sign up</button>
          <button type="button" className={`auth-button auth-tab ${mode === 'login' ? 'is-active' : ''}`} onClick={() => setMode('login')}>Sign in</button>
        </div>

        {mode === 'signup' ? (
          <p className="auth-later-note">
            Google is the only sign-up on this page. Next you’ll choose gender, orientation, what you’re looking for, and agree to Terms and Privacy. A password can be added later in Settings.
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
                  Stay logged in — skip PIN/password on this device. Leave off to sign out when you close the tab.
                </label>
                <button type="submit" className="auth-button face-id-primary" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
                {failedTries >= 3 && (
                  <div className="recovery-helper">
                    <p>Having trouble? This helper only works for <strong>your</strong> username. We show hints to help you remember — never the real PIN or password.</p>
                    <Link to="/forgot-pin">Recover PIN</Link>
                    {' · '}
                    <Link to="/forgot-password">Recover password</Link>
                    {' · '}
                    <Link to="/forgot-pin">Report stolen account</Link>
                  </div>
                )}
              </form>
            <div className="recovery-helper" style={{ marginTop: 16 }}>
              <p style={{ marginBottom: 8 }}>Can’t sign in? This helper asks recovery questions for <strong>your username only</strong>.</p>
              <Link to="/forgot-pin">Forgot PIN</Link>
              {' · '}
              <Link to="/forgot-password">Forgot password</Link>
              {' · '}
              <Link to="/forgot-pin">Report stolen account</Link>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default AuthEntry;
