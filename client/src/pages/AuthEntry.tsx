import { useState, useContext, useMemo, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { authAPI } from '../api/auth';
import { discoverAPI } from '../api/discover';
import { walkMatchAPI } from '../api/walkMatch';
import { formatAxiosError } from '../lib/apiError';
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
type LoginMethod = 'pin' | 'password' | 'phone';

type Props = { initialMode?: AuthMode };

const AuthEntry = ({ initialMode = 'signup' }: Props) => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('pin');
  const [pin, setPin] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [usernameCheck, setUsernameCheck] = useState('');

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
  }, [searchParams]);

  useEffect(() => {
    if (mode !== 'signup' || username.length < 3) {
      setUsernameCheck('');
      return;
    }
    const t = window.setTimeout(() => {
      authAPI.checkUsernameAvailable(username).then((r) => {
        setUsernameCheck(r.available ? '✓ Available forever' : r.reason || 'Taken');
      }).catch(() => setUsernameCheck(''));
    }, 400);
    return () => clearTimeout(t);
  }, [username, mode]);

  const signupShareUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'https://hookupappp.vercel.app/signup';
    return `${window.location.origin}/signup`;
  }, []);

  const qrSrc = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(signupShareUrl)}`,
    [signupShareUrl]
  );

  const finishAuth = useCallback((user: { profileSetupComplete?: boolean }, token: string) => {
    const id = coerceUserId((user as { id?: unknown }).id);
    if (!id) throw new Error('Invalid user');
    login({ ...user, id }, token);
    navigate(user.profileSetupComplete ? '/home' : '/profile-setup', { replace: true });
  }, [login, navigate]);

  const handlePinSignup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim() || !username.trim()) {
      setError('Name and username are required');
      return;
    }
    if (pin.length !== 6) {
      setError('Choose a 6-digit PIN');
      return;
    }
    if (!passwordHint1.trim() || !passwordHint2.trim() || !passwordHint3.trim()) {
      setError('Add 3 PIN hints so you can recover if you forget');
      return;
    }
    if (!agreedToTerms) {
      setError('Agree to Terms and Privacy to continue');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await authAPI.signupWithPin({
        name: name.trim(),
        username: username.trim(),
        pin,
        pinHint1: passwordHint1.trim(),
        pinHint2: passwordHint2.trim(),
        pinHint3: passwordHint3.trim(),
        email: email.trim() || undefined,
        phoneNumber: phoneNumber.replace(/\D/g, '') || undefined,
        improvementCategories: [DEFAULT_SIGNUP_CATEGORY],
        password: password.trim() || undefined,
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
      setError(formatAxiosError(err, 'Sign-up failed'));
    } finally {
      setLoading(false);
    }
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!loginIdentifier.trim() || loginPin.length !== 6) {
        throw new Error('Enter username and 6-digit PIN');
      }
      const response = await authAPI.loginWithPin(loginIdentifier.trim(), loginPin);
      if (!response.token || !response.user) throw new Error('Invalid login response');
      finishAuth(response.user, response.token);
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Wrong username or PIN'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const id = loginIdentifier.trim();
      if (!id || !loginPassword) throw new Error('Enter username and password');
      const response = await authAPI.login({ username: id, password: loginPassword });
      if (!response.token || !response.user) throw new Error('Invalid login response');
      finishAuth(response.user, response.token);
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Invalid username or password'));
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

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: 720 }}>
        <Link to="/" className="back-link">← Back</Link>
        <h1 className="auth-title">{mode === 'signup' ? 'Join Hook Up' : 'Welcome Back'}</h1>
        <p className="auth-subtitle">
          {mode === 'signup'
            ? 'Pick a username forever, a 6-digit PIN, and 3 hints — add an optional password for sign-in too.'
            : 'Username + PIN is fastest. Password and phone code also work.'}
        </p>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        <div className="auth-method-tabs" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button type="button" className="auth-button" style={{ flex: 1, opacity: mode === 'signup' ? 1 : 0.65 }} onClick={() => setMode('signup')}>Sign up</button>
          <button type="button" className="auth-button" style={{ flex: 1, opacity: mode === 'login' ? 1 : 0.65 }} onClick={() => setMode('login')}>Sign in</button>
        </div>

        {mode === 'signup' ? (
          <form noValidate onSubmit={handlePinSignup} className="auth-form">
            <div className="form-group">
              <label htmlFor="name">Full name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </div>
            <div className="form-group">
              <label htmlFor="username">Username (yours forever)</label>
              <input id="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} autoComplete="username" required />
              {usernameCheck && (
                <p style={{ fontSize: 12, marginTop: 6, color: usernameCheck.startsWith('✓') ? '#10b981' : '#f59e0b' }}>{usernameCheck}</p>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="pin">6-digit PIN</label>
              <input id="pin" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} autoComplete="new-password" required />
            </div>
            <div className="form-group">
              <label>PIN hints (if you forget — only you see these on recovery)</label>
              <input type="text" value={passwordHint1} onChange={(e) => setPasswordHint1(e.target.value)} placeholder="Hint 1 — e.g. pet name" maxLength={200} style={{ marginBottom: 6 }} required />
              <input type="text" value={passwordHint2} onChange={(e) => setPasswordHint2(e.target.value)} placeholder="Hint 2" maxLength={200} style={{ marginBottom: 6 }} required />
              <input type="text" value={passwordHint3} onChange={(e) => setPasswordHint3(e.target.value)} placeholder="Hint 3" maxLength={200} required />
            </div>
            <div className="form-group">
              <label htmlFor="backup-password">Password (optional — sign in with username + password)</label>
              <input
                id="backup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="8+ chars, upper, lower, number, symbol"
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email (optional)</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@email.com" />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone (optional)</label>
              <input id="phone" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(normalizePhoneInput(e.target.value))} autoComplete="tel" />
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
            <button type="submit" className="auth-button face-id-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create account'}
            </button>
          </form>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <button type="button" className="auth-button" style={{ flex: 1, minWidth: 80, opacity: loginMethod === 'pin' ? 1 : 0.65 }} onClick={() => setLoginMethod('pin')}>Username + PIN</button>
              <button type="button" className="auth-button" style={{ flex: 1, minWidth: 80, opacity: loginMethod === 'password' ? 1 : 0.65 }} onClick={() => setLoginMethod('password')}>Password</button>
              <button type="button" className="auth-button" style={{ flex: 1, minWidth: 80, opacity: loginMethod === 'phone' ? 1 : 0.65 }} onClick={() => setLoginMethod('phone')}>Phone</button>
            </div>
            {loginMethod === 'pin' ? (
              <form onSubmit={handlePinLogin} className="auth-form">
                <div className="form-group">
                  <label>Username</label>
                  <input value={loginIdentifier} onChange={(e) => setLoginIdentifier(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} autoComplete="username" required />
                </div>
                <div className="form-group">
                  <label>6-digit PIN</label>
                  <input type="password" inputMode="numeric" maxLength={6} value={loginPin} onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
                </div>
                <Link to="/forgot-pin" className="forgot-link">Forgot PIN?</Link>
                <button type="submit" className="auth-button face-id-primary" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            ) : loginMethod === 'password' ? (
              <form onSubmit={handlePasswordLogin} className="auth-form">
                <div className="form-group">
                  <label>Username</label>
                  <input value={loginIdentifier} onChange={(e) => setLoginIdentifier(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} autoComplete="username" required />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} autoComplete="current-password" required />
                </div>
                <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
                <button type="submit" className="auth-button face-id-primary" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
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
            ) : null}
          </>
        )}

        <div className="signup-qr-card signup-qr-desktop">
          <p className="signup-qr-label">Sign up on your phone</p>
          <p className="signup-qr-hint">
            On a computer? Scan with your phone camera to open the sign-up page on mobile.
          </p>
          <img src={qrSrc} alt="Sign-up QR code" width={200} height={200} />
          <p className="signup-qr-link">{signupShareUrl.replace(/^https?:\/\//, '')}</p>
        </div>

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
