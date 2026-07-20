import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../api/auth';
import './Auth.css';

/** Allow full international numbers: + and digits, up to 30 digits. */
function normalizePhoneInput(value: string): string {
  const cleaned = value.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    return '+' + cleaned.slice(1).replace(/\D/g, '').slice(0, 18);
  }
  return cleaned.replace(/\D/g, '').slice(0, 18);
}

const ForgotPassword = () => {
  const [method, setMethod] = useState<'username' | 'phone'>('username');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [hint1, setHint1] = useState('');
  const [hint2, setHint2] = useState('');
  const [hint3, setHint3] = useState('');
  const [hintsVisible, setHintsVisible] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setResetLink('');
    setHint1('');
    setHint2('');
    setHint3('');
    setHintsVisible(1);
    setSubmitted(false);
    setLoading(true);

    try {
      const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');
      if (method === 'phone' && cleanPhoneNumber.length < 10) {
        setError('Enter your full phone number (at least 10 digits, include country code if you signed up with one).');
        setLoading(false);
        return;
      }
      const response = await authAPI.forgotPassword(
        method === 'username' ? username.trim() : undefined,
        method === 'phone' ? cleanPhoneNumber : undefined
      );
      setMessage(response.message);
      setResetLink(response.resetLink || '');
      setHint1(response.hint1 || '');
      setHint2(response.hint2 || '');
      setHint3(response.hint3 || '');
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <Link to="/login" className="back-link">← Back to Sign in</Link>
        <h1 className="auth-title">Forgot Password</h1>
        <p className="auth-subtitle">Enter your username or full phone number to get hints and a reset link</p>

        {error && <div className="error-message">{error}</div>}
        {message && (
          <div className="success-message">
            {message}
            {resetLink && (
              <p style={{ marginTop: '12px', fontSize: '13px' }}>
                <a href={resetLink} style={{ color: '#4F46E5', fontWeight: 600 }}>Click here to reset your password</a> (expires in 1 hour).
              </p>
            )}
            {submitted && (hint1 || hint2 || hint3) && (
              <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)' }}>
                <p style={{ fontWeight: 600, marginBottom: '12px' }}>Your password hints (to help you remember):</p>
                {hintsVisible >= 1 && hint1 && <p style={{ marginBottom: '8px' }}><strong>Hint 1:</strong> {hint1}</p>}
                {hintsVisible >= 2 && hint2 && <p style={{ marginBottom: '8px' }}><strong>Hint 2:</strong> {hint2}</p>}
                {hintsVisible >= 3 && hint3 && <p style={{ marginBottom: '8px' }}><strong>Hint 3:</strong> {hint3}</p>}
                {hintsVisible < 2 && (hint2 || hint3) && (
                  <button type="button" onClick={() => setHintsVisible(2)} style={{ marginTop: '8px', padding: '8px 16px', background: '#ff6b9d', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '14px' }}>
                    Show next hint
                  </button>
                )}
                {hintsVisible === 2 && hint3 && (
                  <button type="button" onClick={() => setHintsVisible(3)} style={{ marginTop: '8px', padding: '8px 16px', background: '#ff6b9d', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '14px' }}>
                    Show last hint
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: '20px', display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={() => { setMethod('username'); setPhoneNumber(''); }}
            style={{
              flex: 1,
              padding: '10px',
              border: `2px solid ${method === 'username' ? '#ff6b9d' : '#e5e7eb'}`,
              borderRadius: '8px',
              background: method === 'username' ? '#fff5f8' : 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: method === 'username' ? 600 : 400,
            }}
          >
            👤 Username
          </button>
          <button
            type="button"
            onClick={() => { setMethod('phone'); setUsername(''); }}
            style={{
              flex: 1,
              padding: '10px',
              border: `2px solid ${method === 'phone' ? '#ff6b9d' : '#e5e7eb'}`,
              borderRadius: '8px',
              background: method === 'phone' ? '#fff5f8' : 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: method === 'phone' ? 600 : 400,
            }}
          >
            📱 Phone
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {method === 'username' ? (
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Enter your username"
              />
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="phone">Full phone number</label>
              <input
                type="tel"
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(normalizePhoneInput(e.target.value))}
                required
                placeholder="+1 234 567 8901 or 2345678901"
                autoComplete="tel"
                inputMode="tel"
              />
              <small style={{ color: '#6b7280', fontSize: '12px' }}>
                Use the same full number from your profile (country code + number). Digits only or with +.
              </small>
            </div>
          )}

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="auth-switch">
          Remember your password? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
