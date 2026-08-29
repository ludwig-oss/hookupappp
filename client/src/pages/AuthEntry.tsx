import { useState, useContext, useMemo, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { authAPI } from '../api/auth';
import { discoverAPI } from '../api/discover';
import { walkMatchAPI } from '../api/walkMatch';
import { API_BASE } from '../api/config';
import { formatAxiosError } from '../lib/apiError';
import { redirectToOAuth, type OAuthProvider } from '../lib/oauth';
import QrScannerPanel from '../components/QrScannerPanel';
import { loginWithPasskey, passkeysSupported } from '../lib/passkeyAuth';
import './Auth.css';
import './Legal.css';

const DEFAULT_SIGNUP_CATEGORY = 'dating-apps';

function coerceUserId(u: unknown): string | null {
  if (typeof u === 'string' && u.length > 0) return u;
  if (typeof u === 'number' && Number.isFinite(u)) return String(Math.trunc(u));
  return null;
}

function normalizePhoneInput(value: string): string {
  const cleaned = value.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return '+' + cleaned.slice(1).replace(/\D/g, '').slice(0, 15);
  return cleaned.replace(/\D/g, '').slice(0, 15);
}

type AuthMode = 'signup' | 'login';
type LoginMethod = 'email' | 'phone' | 'passkey';

type Props = { initialMode?: AuthMode };

const AuthEntry = ({ initialMode = 'signup' }: Props) => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [oauth, setOauth] = useState({ google: false, facebook: false, apple: false });
  const [oauthLoading, setOauthLoading] = useState(false);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordHint1, setPasswordHint1] = useState('');
  const [passwordHint2, setPasswordHint2] = useState('');
  const [passwordHint3, setPasswordHint3] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [orientation, setOrientation] = useState<'straight' | 'gay' | 'lesbian' | 'bisexual' | 'pansexual'>('straight');
  const [lookingFor, setLookingFor] = useState<string[]>(['dating']);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    const m = searchParams.get('mode');
    if (m === 'login') setMode('login');
    const oauthErr = searchParams.get('oauth_error');
    if (oauthErr) setError(oauthErr);
    fetch(`${API_BASE}/api/auth/oauth/status`)
      .then((r) => r.json())
      .then((d) => setOauth({ google: !!d.google, facebook: !!d.facebook, apple: !!d.apple }))
      .catch(() => {});
  }, [searchParams]);

  const signupShareUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'https://hookupappp.vercel.app/signup';
    return `${window.location.origin}/signup`;
  }, []);

  const qrSrc = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(signupShareUrl)}`,
    [signupShareUrl]
  );

  const finishAuth = (user: { profileSetupComplete?: boolean }, token: string) => {
    const id = coerceUserId((user as { id?: unknown }).id);
    if (!id) throw new Error('Invalid user');
    login({ ...user, id }, token);
    navigate(user.profileSetupComplete ? '/home' : '/profile-setup', { replace: true });
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password) {
      setError('Name, username, and password are required');
      return;
    }
    if (!agreedToTerms) {
      setError('Agree to Terms and Privacy to continue');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await authAPI.signup({
        name: name.trim(),
        username: username.trim(),
        password,
        email: email.trim() || undefined,
        improvementCategories: [DEFAULT_SIGNUP_CATEGORY],
        passwordHint1: passwordHint1.trim(),
        passwordHint2: passwordHint2.trim(),
        passwordHint3: passwordHint3.trim(),
        phoneNumber: phoneNumber.replace(/\D/g, '') || undefined,
      });
      const id = coerceUserId(response.user?.id);
      if (!response.token || !id) throw new Error('Invalid server response');
      login({ ...response.user, id }, response.token);
      const ageNum = parseInt(age, 10);
      if (!Number.isNaN(ageNum) && gender) {
        walkMatchAPI.updateSettings({ age: ageNum, gender }).catch(() => {});
      }
      discoverAPI.setPreference({
        orientation,
        lookingFor: lookingFor as ('dating' | 'casual' | 'friends' | 'serious')[],
        userId: id,
      }).catch(() => {});
      navigate('/profile-setup', { replace: true });
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Signup failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const id = loginIdentifier.trim();
      if (!id || !loginPassword) throw new Error('Enter email/username/phone and password');
      const response = await authAPI.login({ identifier: id, username: id, password: loginPassword });
      if (!response.token || !response.user) throw new Error('Invalid login response');
      finishAuth(response.user, response.token);
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Invalid credentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendLoginCode = async () => {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Enter your full phone number with country code');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.sendLoginCode(digits);
      setMessage(res.message);
      setCodeSent(true);
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Could not send code'));
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 10 || loginCode.length !== 6) {
      setError('Enter phone and 6-digit code');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await authAPI.loginWithCode(digits, loginCode);
      if (!response.token || !response.user) throw new Error('Invalid response');
      finishAuth(response.user, response.token);
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Invalid code'));
    } finally {
      setLoading(false);
    }
  };

  const [passkeyUsername, setPasskeyUsername] = useState('');

  const handlePasskeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passkeysSupported()) {
      setError('Face ID / Touch ID is not supported in this browser.');
      return;
    }
    if (!passkeyUsername.trim()) {
      setError('Enter your username to use Face ID / passkey');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await loginWithPasskey(passkeyUsername.trim());
      if (!res.token || !res.user) throw new Error('Invalid passkey response');
      finishAuth(res.user as { profileSetupComplete?: boolean; id?: unknown }, res.token);
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Passkey sign-in failed'));
    } finally {
      setLoading(false);
    }
  };

  const onQrScan = (url: string) => {
    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.pathname.includes('signup')) {
        window.location.href = parsed.toString();
      } else {
        setMessage('QR scanned — open the link in your browser if needed.');
      }
    } catch {
      setMessage(url);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: 720 }}>
        <Link to="/" className="back-link">← Back</Link>
        <h1 className="auth-title">{mode === 'signup' ? 'Join Hook Up' : 'Welcome Back'}</h1>
        <p className="auth-subtitle">Google · Apple · Email · Phone · QR — all on one screen</p>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}
        {oauthLoading && (
          <div className="oauth-wait-banner">
            <div className="oauth-spinner" aria-hidden />
            <span>Connecting to server…</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <button type="button" className="auth-button" disabled={oauthLoading} style={{ background: 'rgba(66,133,244,0.25)', border: '1px solid #4285f4' }} onClick={() => startOAuth('google')}>
            Continue with Google
          </button>
          <button type="button" className="auth-button" disabled={oauthLoading} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid #fff' }} onClick={() => startOAuth('apple')}>
            Continue with Apple ID
          </button>
          <button type="button" className="auth-button" disabled={oauthLoading} style={{ background: 'rgba(24,119,242,0.25)', border: '1px solid #1877f2' }} onClick={() => startOAuth('facebook')}>
            Continue with Facebook
          </button>
        </div>

        <div className="auth-method-tabs" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button type="button" className="auth-button" style={{ flex: 1, opacity: mode === 'signup' ? 1 : 0.65 }} onClick={() => setMode('signup')}>Sign up</button>
          <button type="button" className="auth-button" style={{ flex: 1, opacity: mode === 'login' ? 1 : 0.65 }} onClick={() => setMode('login')}>Sign in</button>
        </div>

        {mode === 'signup' ? (
          <form noValidate onSubmit={handleSignup} className="auth-form">
            <div className="form-group">
              <label htmlFor="name">Full name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </div>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input id="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} autoComplete="username" required />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email (optional)</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@email.com" />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone number</label>
              <input id="phone" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(normalizePhoneInput(e.target.value))} autoComplete="tel" placeholder="+1 234 567 8901" />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
            </div>
            <div className="form-group">
              <label>Password hints (for recovery)</label>
              <input type="text" value={passwordHint1} onChange={(e) => setPasswordHint1(e.target.value)} placeholder="Hint 1" maxLength={200} style={{ marginBottom: 6 }} />
              <input type="text" value={passwordHint2} onChange={(e) => setPasswordHint2(e.target.value)} placeholder="Hint 2" maxLength={200} style={{ marginBottom: 6 }} />
              <input type="text" value={passwordHint3} onChange={(e) => setPasswordHint3(e.target.value)} placeholder="Hint 3" maxLength={200} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label htmlFor="age">Age</label>
                <input id="age" type="number" min={18} max={99} value={age} onChange={(e) => setAge(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="gender">Gender</label>
                <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)} style={{ width: '100%', padding: 10 }}>
                  <option value="">Select…</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="legal-agree-wrap">
              <input type="checkbox" id="agree-terms" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
              <label htmlFor="agree-terms">I agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy</Link>. 18+.</label>
            </div>
            <button type="submit" className="auth-button" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
          </form>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <button type="button" className="auth-button" style={{ flex: 1, minWidth: 100, opacity: loginMethod === 'email' ? 1 : 0.65 }} onClick={() => setLoginMethod('email')}>Email / username</button>
              <button type="button" className="auth-button" style={{ flex: 1, minWidth: 100, opacity: loginMethod === 'phone' ? 1 : 0.65 }} onClick={() => setLoginMethod('phone')}>Phone + code</button>
              <button type="button" className="auth-button" style={{ flex: 1, minWidth: 100, opacity: loginMethod === 'passkey' ? 1 : 0.65 }} onClick={() => setLoginMethod('passkey')}>Face / Touch ID</button>
            </div>
            {loginMethod === 'email' ? (
              <form onSubmit={handleEmailLogin} className="auth-form">
                <div className="form-group">
                  <label>Email, username, or phone</label>
                  <input value={loginIdentifier} onChange={(e) => setLoginIdentifier(e.target.value)} autoComplete="username" required />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} autoComplete="current-password" required />
                </div>
                <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
                <button type="submit" className="auth-button" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
              </form>
            ) : loginMethod === 'phone' ? (
              <form onSubmit={handlePhoneCodeLogin} className="auth-form">
                <div className="form-group">
                  <label>Phone number</label>
                  <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(normalizePhoneInput(e.target.value))} autoComplete="tel" required />
                </div>
                {!codeSent ? (
                  <button type="button" className="auth-button" disabled={loading} onClick={handleSendLoginCode}>
                    Send verification code
                  </button>
                ) : (
                  <>
                    <div className="form-group">
                      <label>6-digit verification code</label>
                      <input value={loginCode} onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} required />
                    </div>
                    <button type="submit" className="auth-button" disabled={loading}>{loading ? 'Verifying…' : 'Sign in with code'}</button>
                  </>
                )}
              </form>
            ) : (
              <form onSubmit={handlePasskeyLogin} className="auth-form">
                <p className="auth-subtitle" style={{ fontSize: 13, marginBottom: 12 }}>
                  Register Face ID / Touch ID in Settings after your first password login.
                </p>
                <div className="form-group">
                  <label>Username</label>
                  <input value={passkeyUsername} onChange={(e) => setPasskeyUsername(e.target.value)} autoComplete="username" required />
                </div>
                <button type="submit" className="auth-button" disabled={loading || !passkeysSupported()}>
                  {loading ? 'Verifying…' : 'Continue with Face / Touch ID'}
                </button>
              </form>
            )}
          </>
        )}

        <section style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <h2 className="auth-title" style={{ fontSize: 18 }}>QR sign-up</h2>
          <p className="auth-subtitle" style={{ fontSize: 13 }}>Share or scan to open this sign-up page</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
            <img src={qrSrc} alt="Sign-up QR" width={180} height={180} style={{ background: '#fff', padding: 8, borderRadius: 8 }} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontSize: 11, wordBreak: 'break-all', opacity: 0.85 }}>{signupShareUrl}</p>
              <QrScannerPanel onScan={onQrScan} onError={setError} />
            </div>
          </div>
        </section>

        <p className="auth-switch" style={{ marginTop: 16 }}>
          {mode === 'signup' ? (
            <>Already have an account? <button type="button" style={{ background: 'none', border: 'none', color: '#ff6b9d', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setMode('login')}>Sign in</button></>
          ) : (
            <>New here? <button type="button" style={{ background: 'none', border: 'none', color: '#ff6b9d', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setMode('signup')}>Create account</button></>
          )}
        </p>
      </div>
    </div>
  );
};

export default AuthEntry;
