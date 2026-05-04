import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { authAPI } from '../api/auth';
import { discoverAPI } from '../api/discover';
import './Auth.css';
import './Legal.css';

/** Same default as server when no categories sent — must match models/improvement.ts */
const DEFAULT_SIGNUP_CATEGORY = 'dating-apps';

function coerceUserId(u: unknown): string | null {
  if (typeof u === 'string' && u.length > 0) return u;
  if (typeof u === 'number' && Number.isFinite(u)) return String(Math.trunc(u));
  return null;
}

function signupErrorMessage(err: any): string {
  if (!err?.response) {
    const code = err?.code;
    const msg = String(err?.message || '');
    if (code === 'ECONNABORTED' || msg.includes('timeout')) {
      return 'Request timed out. Check your connection and try again.';
    }
    if (msg === 'Network Error' || code === 'ERR_NETWORK' || msg.includes('Failed to fetch')) {
      return "Can't reach the server. If you're on the live site, the host needs BACKEND_URL set to your API (e.g. Render).";
    }
    return msg || 'Signup failed. Please try again.';
  }
  const raw = err.response.data;
  if (typeof raw === 'string') {
    if (raw.trim().startsWith('<')) {
      return 'Server returned an error page instead of JSON — check API / proxy (BACKEND_URL on Vercel).';
    }
    return raw.slice(0, 200);
  }
  if (raw && typeof raw === 'object' && raw.error) {
    return String(raw.error);
  }
  const st = err.response.status;
  if (st === 503) return 'Service unavailable — API proxy may be missing BACKEND_URL.';
  if (st === 502) return 'Bad gateway — API server may be down or URL wrong.';
  if (st === 429) return 'Too many attempts. Wait a few minutes and try again.';
  return `Signup failed (HTTP ${st}). Please try again.`;
}

const SignupWithImprovement = () => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordHint1, setPasswordHint1] = useState('');
  const [passwordHint2, setPasswordHint2] = useState('');
  const [passwordHint3, setPasswordHint3] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [orientation, setOrientation] = useState<'straight' | 'gay' | 'lesbian' | 'bisexual' | 'pansexual'>('straight');
  const [lookingFor, setLookingFor] = useState<string[]>(['dating']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password) {
      setError('All fields are required');
      return;
    }
    if (!passwordHint1.trim() || !passwordHint2.trim() || !passwordHint3.trim()) {
      setError('All three password hints are required (to help you recover your account later)');
      return;
    }
    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy to continue');
      return;
    }
    if (username.length < 3 || username.length > 20) {
      setError('Username must be 3–20 characters');
      return;
    }
    if (lookingFor.length === 0) {
      setError('Please select at least one option for Looking For');
      return;
    }

    setError('');
    setLoading(true);
    const prevAuth = axios.defaults.headers.common['Authorization'];
    try {
      const response = await authAPI.signup({
        name: name.trim(),
        username: username.trim(),
        password,
        improvementCategories: [DEFAULT_SIGNUP_CATEGORY],
        passwordHint1: passwordHint1.trim(),
        passwordHint2: passwordHint2.trim(),
        passwordHint3: passwordHint3.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
      });

      const id = coerceUserId(response.user?.id);
      if (!response.token || !id) {
        setError('Invalid response from server. Please try again.');
        return;
      }

      const userForLogin = { ...response.user, id };

      axios.defaults.headers.common['Authorization'] = `Bearer ${response.token}`;
      try {
        await discoverAPI.setPreference({
          orientation,
          lookingFor: lookingFor as ('dating' | 'casual' | 'friends' | 'serious')[],
          userId: id,
        });
      } catch {
        /* Preferences are optional for onboarding; account + JWT are already created. */
      }

      login(userForLogin, response.token);
      navigate('/profile-setup', { replace: true });
    } catch (err: any) {
      setError(signupErrorMessage(err));
    } finally {
      if (prevAuth) axios.defaults.headers.common['Authorization'] = prevAuth;
      else delete axios.defaults.headers.common['Authorization'];
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: '700px' }}>
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">
          One step: account details and preferences. You can change these later in the app.
        </p>

        {error && <div className="error-message">{error}</div>}

        <div style={{ marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="auth-button"
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '2px solid rgba(107, 114, 128, 0.5)',
              color: '#9ca3af',
              fontFamily: 'Orbitron, monospace',
              padding: '10px 20px',
              fontSize: '14px',
            }}
          >
            ← Back
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Enter your full name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              autoComplete="username"
              placeholder="Choose a unique username (3-20 chars)"
            />
            <small style={{ color: '#9ca3af', fontSize: '12px', fontFamily: 'Orbitron, monospace' }}>
              Only letters, numbers, and underscores allowed
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Enter a strong password"
            />
            <small style={{ color: '#9ca3af', fontSize: '12px', display: 'block', marginTop: '4px', fontFamily: 'Orbitron, monospace' }}>
              Password must be at least 8 characters and include:
              <br />• One uppercase letter
              <br />• One lowercase letter
              <br />• One number
              <br />• One special character (!@#$%^&*()_+-=[]{}|;:,.&lt;&gt;?)
            </small>
          </div>

          <div className="form-group">
            <label style={{ marginBottom: '8px', display: 'block', fontWeight: 600 }}>Password hints (to help you remember if you forget)</label>
            <small style={{ color: '#9ca3af', fontSize: '12px', display: 'block', marginBottom: '12px', fontFamily: 'Orbitron, monospace' }}>
              Enter 3 short hints only you will understand. If you forget your password, we&apos;ll show these one at a time on the forgot-password page.
            </small>
            <input
              type="text"
              value={passwordHint1}
              onChange={(e) => setPasswordHint1(e.target.value)}
              placeholder="Hint 1 (e.g. pet name, street)"
              maxLength={200}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '2px solid rgba(0, 212, 255, 0.3)', background: 'rgba(0, 0, 0, 0.4)', color: '#fff', fontFamily: 'Orbitron, monospace', marginBottom: '8px' }}
            />
            <input
              type="text"
              value={passwordHint2}
              onChange={(e) => setPasswordHint2(e.target.value)}
              placeholder="Hint 2 (e.g. first school)"
              maxLength={200}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '2px solid rgba(0, 212, 255, 0.3)', background: 'rgba(0, 0, 0, 0.4)', color: '#fff', fontFamily: 'Orbitron, monospace', marginBottom: '8px' }}
            />
            <input
              type="text"
              value={passwordHint3}
              onChange={(e) => setPasswordHint3(e.target.value)}
              placeholder="Hint 3 (e.g. favorite food)"
              maxLength={200}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '2px solid rgba(0, 212, 255, 0.3)', background: 'rgba(0, 0, 0, 0.4)', color: '#fff', fontFamily: 'Orbitron, monospace' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone (optional)</label>
            <input
              type="tel"
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              autoComplete="tel"
              placeholder="For account recovery"
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '2px solid rgba(0, 212, 255, 0.3)', background: 'rgba(0, 0, 0, 0.4)', color: '#fff', fontFamily: 'Orbitron, monospace' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="orientation">Orientation</label>
            <select
              id="orientation"
              value={orientation}
              onChange={(e) => setOrientation(e.target.value as typeof orientation)}
              style={{ width: '100%', padding: '12px', border: '2px solid rgba(0, 212, 255, 0.3)', borderRadius: '8px', fontSize: '16px', background: 'rgba(0, 0, 0, 0.4)', color: '#fff', fontFamily: 'Orbitron, monospace' }}
            >
              <option value="straight" style={{ background: '#0a0a1a' }}>Straight</option>
              <option value="gay" style={{ background: '#0a0a1a' }}>Gay</option>
              <option value="lesbian" style={{ background: '#0a0a1a' }}>Lesbian</option>
              <option value="bisexual" style={{ background: '#0a0a1a' }}>Bisexual</option>
              <option value="pansexual" style={{ background: '#0a0a1a' }}>Pansexual</option>
            </select>
          </div>

          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '10px' }}>Looking For (select one or more)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {[
                { value: 'dating', label: 'Dating' },
                { value: 'casual', label: 'Casual' },
                { value: 'friends', label: 'Friends' },
                { value: 'serious', label: 'Serious Relationship' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    border: `2px solid ${lookingFor.includes(opt.value) ? 'rgba(0, 212, 255, 0.8)' : 'rgba(0, 212, 255, 0.3)'}`,
                    borderRadius: '8px',
                    background: lookingFor.includes(opt.value) ? 'rgba(0, 212, 255, 0.2)' : 'rgba(0, 0, 0, 0.4)',
                    color: '#fff',
                    fontFamily: 'Orbitron, monospace',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={lookingFor.includes(opt.value)}
                    onChange={() => {
                      setLookingFor((prev) =>
                        prev.includes(opt.value)
                          ? prev.filter((v) => v !== opt.value)
                          : [...prev, opt.value]
                      );
                    }}
                    style={{ width: '18px', height: '18px', accentColor: '#00d4ff' }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="legal-agree-wrap">
            <input
              type="checkbox"
              id="agree-terms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              aria-describedby="agree-terms-label"
            />
            <label id="agree-terms-label" htmlFor="agree-terms">
              I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>. I am 18 or older.
            </label>
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
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

export default SignupWithImprovement;
