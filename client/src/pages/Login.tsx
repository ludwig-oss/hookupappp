import { useMemo, useState, useContext, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { authAPI } from '../api/auth';
import { API_BASE } from '../api/config';
import { formatAxiosError } from '../lib/apiError';
import { redirectToOAuth, type OAuthProvider } from '../lib/oauth';
import './Auth.css';
import './Legal.css';

type SignMethod = 'account' | 'pattern' | 'passkey';

const PATTERN_CELLS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const Login = () => {
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<SignMethod>('account');
  const [pattern, setPattern] = useState<number[]>([]);
  const [showQr, setShowQr] = useState(false);
  const [oauth, setOauth] = useState<{ google: boolean; facebook: boolean }>({ google: false, facebook: false });
  const [oauthLoading, setOauthLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    const oauthErr = searchParams.get('oauth_error');
    if (oauthErr) setError(oauthErr);
    fetch(`${API_BASE}/api/auth/oauth/status`)
      .then((r) => r.json())
      .then((d) => setOauth({ google: !!d.google, facebook: !!d.facebook }))
      .catch(() => {});
  }, [searchParams]);

  const signupUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'https://hookupappp.vercel.app/signup';
    return `${window.location.origin}/signup`;
  }, []);

  const qrSrc = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(signupUrl)}`,
    [signupUrl]
  );

  const doLogin = async (id: string, pwd: string) => {
    const response = await authAPI.login({ identifier: id, username: id, password: pwd });
    if (!response.token || !response.user) throw new Error('Invalid login response');
    login(response.user, response.token);
    const target = response.user.profileSetupComplete ? '/home' : '/profile-setup';
    navigate(target, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const id = identifier.trim();
      if (!id) throw new Error('Enter your username, email, or phone number');
      if (!password) throw new Error('Enter your password');
      await doLogin(id, password);
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Invalid credentials. Password must match this account.'));
    } finally {
      setLoading(false);
    }
  };

  const handlePatternLogin = async () => {
    setError('');
    if (pattern.length < 4) {
      setError('Draw a pattern of at least 4 dots (same pattern you use as your password).');
      return;
    }
    if (!identifier.trim()) {
      setError('Enter your username, email, or phone first.');
      return;
    }
    setLoading(true);
    try {
      const patternPassword = 'p' + pattern.join('-');
      await doLogin(identifier.trim(), patternPassword);
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Pattern did not match. Use the pattern you set as your password, or sign in with password.'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasskey = async () => {
    setError('');
    if (!window.PublicKeyCredential) {
      setError('Face ID / fingerprint (passkeys) are not supported on this browser. Use password, phone, or email.');
      return;
    }
    setError('Passkeys (Face ID / Touch ID) need to be registered in Settings after you sign in with password once. Use password for now.');
  };

  const startOAuth = async (provider: OAuthProvider) => {
    setError('');
    setOauthLoading(true);
    try {
      await redirectToOAuth(provider);
    } catch (e: unknown) {
      setOauthLoading(false);
      setError(e instanceof Error ? e.message : 'Could not start sign-in. Try again.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <Link to="/" className="back-link">← Back</Link>
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">Sign in with username, email, phone, Google, or Facebook</p>

        {error && <div className="error-message">{error}</div>}
        {oauthLoading && (
          <div className="oauth-wait-banner">
            <div className="oauth-spinner" aria-hidden />
            <span>Connecting to server…</span>
          </div>
        )}

        <div className="auth-method-tabs" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button type="button" className="auth-button" style={{ flex: 1, padding: '8px', fontSize: 12, opacity: method === 'account' ? 1 : 0.7 }} onClick={() => setMethod('account')}>Password</button>
          <button type="button" className="auth-button" style={{ flex: 1, padding: '8px', fontSize: 12, opacity: method === 'pattern' ? 1 : 0.7 }} onClick={() => { setMethod('pattern'); setPattern([]); }}>Pattern</button>
          <button type="button" className="auth-button" style={{ flex: 1, padding: '8px', fontSize: 12, opacity: method === 'passkey' ? 1 : 0.7 }} onClick={() => setMethod('passkey')}>Face / Touch</button>
        </div>

        {(method === 'account' || method === 'pattern') && (
          <div className="form-group">
            <label htmlFor="identifier">Username, email, or phone</label>
            <input
              type="text"
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              placeholder="jane / jane@email.com / +1234567890"
              autoComplete="username"
            />
          </div>
        )}

        {method === 'account' && (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
            <div className="form-footer">
              <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
            </div>
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {method === 'pattern' && (
          <div className="auth-form">
            <p style={{ fontSize: 12, opacity: 0.85, marginBottom: 10 }}>
              Tap dots in order (min 4). Your account password must be set to this pattern string (p1-2-3-…) in Settings, or use Password tab.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 56px)', gap: 12, justifyContent: 'center', margin: '12px auto 16px' }}>
              {PATTERN_CELLS.map((n) => {
                const idx = pattern.indexOf(n);
                const active = idx >= 0;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPattern((p) => (p.includes(n) ? p : [...p, n]))}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      border: active ? '2px solid #ff6b9d' : '2px solid rgba(255,255,255,0.35)',
                      background: active ? 'rgba(255,107,157,0.35)' : 'rgba(255,255,255,0.08)',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {active ? idx + 1 : ''}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="auth-button" style={{ flex: 1 }} onClick={() => setPattern([])}>Clear</button>
              <button type="button" className="auth-button" style={{ flex: 1 }} disabled={loading} onClick={handlePatternLogin}>
                {loading ? '…' : 'Unlock'}
              </button>
            </div>
          </div>
        )}

        {method === 'passkey' && (
          <div className="auth-form">
            <p style={{ fontSize: 13, marginBottom: 12, opacity: 0.9 }}>
              Use Face ID / Touch ID / Windows Hello when your device supports passkeys.
            </p>
            <button type="button" className="auth-button" onClick={handlePasskey}>Continue with Face / Fingerprint</button>
          </div>
        )}

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            className="auth-button"
            disabled={oauthLoading}
            style={{ background: 'rgba(66,133,244,0.25)', border: '1px solid #4285f4' }}
            onClick={() => startOAuth('google')}
          >
            Continue with Google
          </button>
          <button
            type="button"
            className="auth-button"
            disabled={oauthLoading}
            style={{ background: 'rgba(24,119,242,0.25)', border: '1px solid #1877f2' }}
            onClick={() => startOAuth('facebook')}
          >
            Continue with Facebook
          </button>
          <button type="button" className="auth-button" style={{ background: 'rgba(255,107,157,0.2)' }} onClick={() => setShowQr(true)}>
            📱 Show QR code → Sign up
          </button>
        </div>

        {showQr && (
          <div className="love-feed-modal-overlay" style={{ zIndex: 50 }} onClick={() => setShowQr(false)}>
            <div className="auth-card" style={{ maxWidth: 320, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
              <h2 className="auth-title" style={{ fontSize: 20 }}>Scan to Sign Up</h2>
              <p className="auth-subtitle" style={{ fontSize: 13 }}>Friends scan this QR → open Hook Up sign-up and enter their details.</p>
              <img src={qrSrc} alt="Sign up QR code" width={220} height={220} style={{ margin: '12px auto', display: 'block', borderRadius: 8, background: '#fff', padding: 8 }} />
              <p style={{ fontSize: 11, wordBreak: 'break-all', opacity: 0.8 }}>{signupUrl}</p>
              <button type="button" className="auth-button" onClick={() => setShowQr(false)}>Close</button>
            </div>
          </div>
        )}

        <p className="auth-switch">
          Don&apos;t have an account? <Link to="/signup">Sign up</Link>
        </p>

        <div className="auth-legal-footer">
          <Link to="/terms">Terms of Service</Link>
          <span className="legal-sep">|</span>
          <Link to="/privacy">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
