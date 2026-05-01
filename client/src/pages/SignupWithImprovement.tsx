import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { authAPI } from '../api/auth';
import { improvementAPI, ImprovementCategory } from '../api/improvement';
import { discoverAPI } from '../api/discover';
import './Auth.css';
import './Legal.css';

const SignupWithImprovement = () => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordHint1, setPasswordHint1] = useState('');
  const [passwordHint2, setPasswordHint2] = useState('');
  const [passwordHint3, setPasswordHint3] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categories, setCategories] = useState<ImprovementCategory[]>([]);
  const [orientation, setOrientation] = useState<'straight' | 'gay' | 'lesbian' | 'bisexual' | 'pansexual'>('straight');
  const [lookingFor, setLookingFor] = useState<string[]>(['dating']);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  // Only load categories when step 2 is reached
  useEffect(() => {
    if (step === 2 && categories.length === 0 && !loadingCategories) {
      loadCategories();
    }
  }, [step]);

  const loadCategories = async () => {
    setLoadingCategories(true);
    setCategoryError('');
    try {
      const response = await improvementAPI.getCategories();
      if (response.categories && response.categories.length > 0) {
        setCategories(response.categories);
        setCategoryError('');
      } else {
        setCategoryError('No improvement categories available. Please try again later.');
        setCategories([]);
      }
    } catch (err: any) {
      console.error('Failed to load categories:', err);
      let errorMessage = 'Failed to load categories. ';
      
      if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error') || err.message?.includes('Failed to fetch')) {
        errorMessage += 'Unable to connect. Please check your connection and try again.';
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage += err.message;
      } else {
        errorMessage += 'Please try again later.';
      }
      
      setCategoryError(errorMessage);
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || !password) {
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
    setError('');
    setCategoryError('');
    setStep(2);
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategories.length === 0) {
      setError('Please select at least one improvement area');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authAPI.signup({
        name,
        username,
        password,
        improvementCategories: selectedCategories,
        passwordHint1: passwordHint1.trim(),
        passwordHint2: passwordHint2.trim(),
        passwordHint3: passwordHint3.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
      });

      if (response.token && response.user) {
        login(response.user, response.token);
        setUserId(response.user.id);
        setStep(3);
      }
    } catch (err: any) {
      const d = err.response?.data;
      const msg =
        typeof d === 'string'
          ? d
          : d && typeof d === 'object'
            ? String(d.error || d.message || '')
            : String(err.message || '');
      setError(msg || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setError('User ID not found');
      return;
    }
    if (lookingFor.length === 0) {
      setError('Please select at least one option for Looking For');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await discoverAPI.setPreference({
        orientation,
        lookingFor: lookingFor as ('dating' | 'casual' | 'friends' | 'serious')[],
        userId,
      });
      navigate('/profile-setup');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: step === 2 ? '700px' : '420px' }}>
        <h1 className="auth-title">
          {step === 1 ? 'Create Account' : step === 2 ? 'Select Improvement Areas' : 'Set Your Preferences'}
        </h1>
        <p className="auth-subtitle">
          {step === 1 ? 'Sign up to get started' : step === 2 ? 'Choose areas you want to improve (required)' : 'Help us find your perfect connections'}
        </p>

        {/* Only show form errors on step 1, category errors on step 2 */}
        {step === 1 && error && <div className="error-message">{error}</div>}
        {step === 2 && categoryError && <div className="error-message">{categoryError}</div>}
        {(step === 2 || step === 3) && error && <div className="error-message">{error}</div>}

        {step === 1 && (
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
        )}

        {step === 2 && (
          <div style={{ marginBottom: '16px' }}>
            <button
              type="button"
              onClick={() => { setCategoryError(''); setStep(1); }}
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
        )}

        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="auth-form">
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
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
                required
                minLength={3}
                maxLength={20}
                pattern="[a-zA-Z0-9_]{3,20}"
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
                required
                minLength={8}
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

            <button type="submit" className="auth-button" disabled={!agreedToTerms}>
              Continue
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="auth-form">
            {loadingCategories ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#6b7280',
              }}>
                <div style={{ fontSize: '24px', marginBottom: '16px' }}>Loading categories...</div>
              </div>
            ) : categories.length === 0 ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#6b7280',
                background: '#f9fafb',
                borderRadius: '12px',
                marginBottom: '20px',
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                  No categories available
                </div>
                <div style={{ fontSize: '14px', marginBottom: '20px' }}>
                  {categoryError || 'Unable to load improvement categories. Please try refreshing the page.'}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    loadCategories();
                  }}
                  className="auth-button"
                  style={{ background: '#ff6b9d', cursor: loadingCategories ? 'not-allowed' : 'pointer' }}
                  disabled={loadingCategories}
                >
                  {loadingCategories ? 'Loading...' : 'Retry Loading Categories'}
                </button>
                {categoryError && (categoryError.includes('Unable to connect') || categoryError.includes('connection')) && (
                  <div style={{ marginTop: '12px', padding: '12px', background: '#fef2f2', borderRadius: '8px', fontSize: '12px', color: '#dc2626' }}>
                    <strong>Connection issue:</strong> We couldn&apos;t load this page. Check your internet connection and try again.
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '12px',
                maxHeight: '400px',
                overflowY: 'auto',
                padding: '10px',
                marginBottom: '20px',
              }}>
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => handleCategoryToggle(cat.id)}
                    style={{
                      padding: '16px',
                      border: `2px solid ${selectedCategories.includes(cat.id) ? '#00d4ff' : 'rgba(0, 212, 255, 0.3)'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      background: selectedCategories.includes(cat.id) ? 'rgba(0, 212, 255, 0.2)' : 'rgba(0, 0, 0, 0.4)',
                      transition: 'all 0.3s',
                      boxShadow: selectedCategories.includes(cat.id) ? '0 0 20px rgba(0, 212, 255, 0.4)' : '0 0 10px rgba(0, 212, 255, 0.1)',
                    }}
                    onMouseEnter={(e) => {
                      if (!selectedCategories.includes(cat.id)) {
                        e.currentTarget.style.borderColor = '#00d4ff';
                        e.currentTarget.style.background = 'rgba(0, 212, 255, 0.15)';
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 212, 255, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selectedCategories.includes(cat.id)) {
                        e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.3)';
                        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
                        e.currentTarget.style.boxShadow = '0 0 10px rgba(0, 212, 255, 0.1)';
                      }
                    }}
                  >
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>{cat.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', color: '#fff', fontFamily: 'Orbitron, monospace' }}>
                      {cat.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', fontFamily: 'Orbitron, monospace' }}>
                      {cat.description}
                    </div>
                    {selectedCategories.includes(cat.id) && (
                      <div style={{ marginTop: '8px', color: '#00d4ff', fontSize: '12px', fontWeight: 700, fontFamily: 'Orbitron, monospace', textShadow: '0 0 10px rgba(0, 212, 255, 0.6)' }}>
                        ✓ Selected
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setCategoryError(''); // Clear category errors when going back
                  setStep(1);
                }}
                className="auth-button"
                style={{ background: 'rgba(0, 0, 0, 0.4)', border: '2px solid rgba(107, 114, 128, 0.5)', color: '#9ca3af', fontFamily: 'Orbitron, monospace' }}
              >
                Back
              </button>
              <button type="submit" className="auth-button" disabled={loading || selectedCategories.length === 0}>
                {loading ? 'Creating account...' : `Sign Up (${selectedCategories.length} selected)`}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleStep3Submit} className="auth-form">
            <div className="form-group">
              <label htmlFor="orientation">Orientation</label>
              <select
                id="orientation"
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as any)}
                required
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
              <label style={{ display: 'block', marginBottom: '10px' }}>Looking For (select two or more if you like)</label>
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
              <small style={{ color: '#9ca3af', fontSize: '12px', display: 'block', marginTop: '6px', fontFamily: 'Orbitron, monospace' }}>
                Select at least one. You can choose multiple (e.g. Casual and Dating).
              </small>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="auth-button"
                style={{ background: 'rgba(0, 0, 0, 0.4)', border: '2px solid rgba(107, 114, 128, 0.5)', color: '#9ca3af', fontFamily: 'Orbitron, monospace' }}
              >
                Back
              </button>
              <button type="submit" className="auth-button" disabled={loading}>
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </form>
        )}

        {step === 1 && (
          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        )}

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





