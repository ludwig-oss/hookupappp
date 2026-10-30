import { useState, useContext, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { authAPI } from '../api/auth';
import { discoverAPI } from '../api/discover';
import { walkMatchAPI } from '../api/walkMatch';
import { formatAxiosError } from '../lib/apiError';
import { normalizePinDigits } from '../lib/pin';
import { normalizeLoginIdentifier, normalizeUsernameInput, USERNAME_HINT, USERNAME_MAX, USERNAME_MIN } from '../lib/username';
import LookingForChips from '../components/LookingForChips';
import { DATING_GENDERS, datingGender, orientationFitsGender, orientationsForGender } from '../lib/genderOrientation';
import { dateMatchAPI } from '../api/dateMatch';
import PasswordInput from '../components/PasswordInput';
import GoogleContinueButton from '../components/GoogleContinueButton';
import './Auth.css';
import './Legal.css';

const DEFAULT_SIGNUP_CATEGORY = 'dating-apps';

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
  const [pin, setPin] = useState('');
  const [usernameCheck, setUsernameCheck] = useState('');

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordHint1, setPasswordHint1] = useState('');
  const [passwordHint2, setPasswordHint2] = useState('');
  const [passwordHint3, setPasswordHint3] = useState('');
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [failedTries, setFailedTries] = useState(0);
  const [pwHint1, setPwHint1] = useState('');
  const [pwHint2, setPwHint2] = useState('');
  const [pwHint3, setPwHint3] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginSecret, setLoginSecret] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [orientation, setOrientation] = useState<'' | 'straight' | 'gay' | 'lesbian' | 'bisexual' | 'pansexual'>('');
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
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

  const finishAuth = useCallback((user: { profileSetupComplete?: boolean }, token: string) => {
    const id = coerceUserId((user as { id?: unknown }).id);
    if (!id) throw new Error('Invalid user');
    login({ ...user, id }, token, { stayLoggedIn });
    navigate(user.profileSetupComplete ? '/home' : '/profile-setup', { replace: true });
  }, [login, navigate, stayLoggedIn]);

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
    const normalizedPin = normalizePinDigits(pin);
    if (normalizedPin.length !== 6) {
      setError('Choose a 6-digit PIN');
      return;
    }
    if (!passwordHint1.trim() || !passwordHint2.trim() || !passwordHint3.trim()) {
      setError('Add 3 PIN hints to help you remember — do not write the PIN itself');
      return;
    }
    if (password.trim()) {
      if (!pwHint1.trim() || !pwHint2.trim() || !pwHint3.trim()) {
        setError('If you set a password now, add 3 hints — or leave the password blank and we will ask later');
        return;
      }
    }
    if (!agreedToTerms) {
      setError('Agree to Terms and Privacy to continue');
      return;
    }
    if (!datingGender(gender)) {
      setError('Choose Female or Male. Orientation uses those genders.');
      return;
    }
    if (orientation && !orientationFitsGender(orientation, gender)) {
      setError('That orientation does not match the gender you chose.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await authAPI.signupWithPin({
        name: name.trim(),
        username: normalizeUsernameInput(username),
        pin: normalizedPin,
        pinHint1: passwordHint1.trim(),
        pinHint2: passwordHint2.trim(),
        pinHint3: passwordHint3.trim(),
        improvementCategories: [DEFAULT_SIGNUP_CATEGORY],
        password: password.trim() || undefined,
        passwordHint1: password.trim() ? pwHint1.trim() : undefined,
        passwordHint2: password.trim() ? pwHint2.trim() : undefined,
        passwordHint3: password.trim() ? pwHint3.trim() : undefined,
      });
      const id = coerceUserId(response.user?.id);
      if (!response.token || !id) throw new Error('Invalid server response');
      login(
        { ...response.user, id, dateLookingFor: lookingFor, hasBackupPassword: Boolean(password.trim()) },
        response.token,
        { stayLoggedIn }
      );
      const ageNum = parseInt(age, 10);
      if (!Number.isNaN(ageNum) && gender) {
        walkMatchAPI.updateSettings({ age: ageNum, gender }).catch(() => {});
      }
      if (lookingFor.length > 0) {
        dateMatchAPI.saveLookingFor(lookingFor).catch(() => {});
      }
      if (orientation) {
        discoverAPI.setPreference({
          orientation,
          userId: id,
        }).catch(() => {});
      }
      navigate('/profile-setup', { replace: true });
      return;
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Sign-up failed'));
    } finally {
      setLoading(false);
    }
  };

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
            ? 'Fastest way in: Continue with Google. We pull your Gmail and Google profile — no password or code. Or create an account with a username and PIN.'
            : 'Continue with Google (your Gmail), or sign in with username, Gmail, PIN, or password.'}
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
        <div className="auth-or-divider">or</div>

        <div className="auth-method-tabs">
          <button type="button" className={`auth-button auth-tab ${mode === 'signup' ? 'is-active' : ''}`} onClick={() => setMode('signup')}>Sign up</button>
          <button type="button" className={`auth-button auth-tab ${mode === 'login' ? 'is-active' : ''}`} onClick={() => setMode('login')}>Sign in</button>
        </div>

        {mode === 'signup' ? (
          <form noValidate onSubmit={handlePinSignup} className="auth-form">
            <div className="form-group">
              <label htmlFor="name">Full name</label>
              <input id="name" name="full-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </div>
            <div className="form-group">
              <label htmlFor="username">Username (yours forever)</label>
              <input
                id="username"
                name="new-username"
                value={username}
                onChange={(e) => setUsername(normalizeUsernameInput(e.target.value))}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                minLength={USERNAME_MIN}
                maxLength={USERNAME_MAX}
                pattern="[a-z0-9_]{3,20}"
                placeholder="e.g. cool_user"
              />
              <p style={{ fontSize: 12, marginTop: 6, color: '#9ca3af' }}>{USERNAME_HINT}</p>
              {usernameCheck && (
                <p style={{ fontSize: 12, marginTop: 6, color: usernameCheck.startsWith('✓') ? '#10b981' : '#f59e0b' }}>{usernameCheck}</p>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="pin">6-digit PIN</label>
              <PasswordInput
                id="pin"
                value={pin}
                onChange={setPin}
                autoComplete="new-password"
                inputMode="numeric"
                maxLength={6}
                digitsOnly
                required
              />
            </div>
            <div className="form-group">
              <label>PIN hints (help you remember — do not write the PIN)</label>
              <input type="text" value={passwordHint1} onChange={(e) => setPasswordHint1(e.target.value)} placeholder="Hint 1 — e.g. pet name" maxLength={200} style={{ marginBottom: 6 }} required />
              <input type="text" value={passwordHint2} onChange={(e) => setPasswordHint2(e.target.value)} placeholder="Hint 2" maxLength={200} style={{ marginBottom: 6 }} required />
              <input type="text" value={passwordHint3} onChange={(e) => setPasswordHint3(e.target.value)} placeholder="Hint 3" maxLength={200} required />
            </div>
            <p className="auth-later-note">
              Password and everything below can wait. Skip them now — we will remind you to add a password later, and you can fill age, gender, orientation, and what you are looking for in Settings.
            </p>
            <div className="form-group">
              <label htmlFor="backup-password">Password (optional — add later)</label>
              <PasswordInput
                id="backup-password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                placeholder="Leave blank to add later. If you set one: 8+ chars, upper, lower, number, symbol"
              />
            </div>
            <div className="form-group">
              <label>Password hints (only if you set a password now)</label>
              <input type="text" value={pwHint1} onChange={(e) => setPwHint1(e.target.value)} placeholder="Hint 1" maxLength={200} style={{ marginBottom: 6 }} />
              <input type="text" value={pwHint2} onChange={(e) => setPwHint2(e.target.value)} placeholder="Hint 2" maxLength={200} style={{ marginBottom: 6 }} />
              <input type="text" value={pwHint3} onChange={(e) => setPwHint3(e.target.value)} placeholder="Hint 3" maxLength={200} />
            </div>
            <div className="auth-age-gender">
              <div className="form-group">
                <label htmlFor="age">Age (optional)</label>
                <input id="age" type="number" min={18} max={99} value={age} onChange={(e) => setAge(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="gender">Gender</label>
                <select
                  id="gender"
                  value={datingGender(gender)}
                  onChange={(e) => {
                    const next = e.target.value;
                    setGender(next);
                    if (orientation && !orientationFitsGender(orientation, next)) setOrientation('');
                  }}
                  style={{ width: '100%', padding: 10 }}
                >
                  <option value="">Female or Male…</option>
                  {DATING_GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="orientation">Orientation (optional)</label>
              <select
                id="orientation"
                value={orientation}
                disabled={!datingGender(gender)}
                onChange={(e) => setOrientation(e.target.value as typeof orientation)}
                style={{ width: '100%', padding: 10 }}
              >
                <option value="">{datingGender(gender) ? 'Skip for now…' : 'Choose Female or Male first'}</option>
                {orientationsForGender(gender).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 6, marginBottom: 0 }}>
                Gay is for men, lesbian is for women. Straight, bi, and pan follow the gender you picked.
              </p>
            </div>
            <LookingForChips value={lookingFor} onChange={setLookingFor} />
            <div className="auth-info-note">
              <p><strong>Next step — your photo is required.</strong> You cannot skip it. Chest and above is enough, as long as your head is in the photo. Not a group shot or someone else.</p>
              <p>While you are in the app, location turns on automatically so people nearby can show up. You can show interest or pass. Location turns off when you leave the app, switch sites, or switch apps.</p>
            </div>
            <div className="legal-agree-wrap">
              <input type="checkbox" id="agree-terms" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
              <label htmlFor="agree-terms">I agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy</Link>. 18+.</label>
            </div>
            <label className="stay-logged-in">
              <input type="checkbox" checked={stayLoggedIn} onChange={(e) => setStayLoggedIn(e.target.checked)} />
              Stay logged in — skip PIN/password on this device. Leave off to sign out when you close the tab.
            </label>
            <button type="submit" className="auth-button face-id-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create account'}
            </button>
          </form>
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
