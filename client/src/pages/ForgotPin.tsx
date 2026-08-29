import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/auth';
import { formatAxiosError } from '../lib/apiError';
import { normalizeUsernameInput } from '../lib/username';
import './Auth.css';

type Step = 'username' | 'hints' | 'last-chat' | 'three-names' | 'new-pin';

const ForgotPin = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('username');
  const [username, setUsername] = useState('');
  const [hint1, setHint1] = useState('');
  const [hint2, setHint2] = useState('');
  const [hint3, setHint3] = useState('');
  const [chatRecoveryAvailable, setChatRecoveryAvailable] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [challengeToken, setChallengeToken] = useState('');
  const [name1, setName1] = useState('');
  const [name2, setName2] = useState('');
  const [name3, setName3] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const loadHints = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.forgotPinHints(username.trim());
      setHint1(res.hint1);
      setHint2(res.hint2);
      setHint3(res.hint3);
      setChatRecoveryAvailable(res.chatRecoveryAvailable);
      setMessage(res.message);
      setStep('hints');
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Could not load hints'));
    } finally {
      setLoading(false);
    }
  };

  const startLastChat = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.forgotPinLastChatChallenge(username.trim());
      setQuestion(res.question);
      setOptions(res.options);
      setChallengeToken(res.challengeToken);
      setStep('last-chat');
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Could not start recovery'));
    } finally {
      setLoading(false);
    }
  };

  const verifyLastChat = async (answer: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.forgotPinVerifyLastChat(username.trim(), challengeToken, answer);
      setResetToken(res.resetToken);
      setMessage(res.message);
      setStep('new-pin');
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Wrong answer'));
    } finally {
      setLoading(false);
    }
  };

  const verifyThreeNames = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.forgotPinVerifyChatNames(username.trim(), [name1, name2, name3]);
      setResetToken(res.resetToken);
      setMessage(res.message);
      setStep('new-pin');
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Could not verify chat names'));
    } finally {
      setLoading(false);
    }
  };

  const submitNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authAPI.resetPin(resetToken, newPin);
      navigate('/login', { replace: true, state: { message: 'PIN updated — sign in with your new PIN.' } });
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Could not reset PIN'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <Link to="/login" className="back-link">← Back to Sign in</Link>
        <h1 className="auth-title">Forgot PIN</h1>
        <p className="auth-subtitle">Your hints first — then chat verification if you still need help</p>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        {step === 'username' && (
          <form onSubmit={loadHints} className="auth-form">
            <div className="form-group">
              <label>Username</label>
              <input value={username} onChange={(e) => setUsername(normalizeUsernameInput(e.target.value))} required autoComplete="username" />
            </div>
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? 'Loading…' : 'Show my PIN hints'}
            </button>
          </form>
        )}

        {step === 'hints' && (
          <div className="auth-form">
            <p style={{ fontSize: 14, marginBottom: 12 }}>These are the hints you wrote when you signed up:</p>
            {hint1 && <p className="pin-hint-line"><strong>Hint 1:</strong> {hint1}</p>}
            {hint2 && <p className="pin-hint-line"><strong>Hint 2:</strong> {hint2}</p>}
            {hint3 && <p className="pin-hint-line"><strong>Hint 3:</strong> {hint3}</p>}
            {!hint1 && !hint2 && !hint3 && <p style={{ opacity: 0.85 }}>No hints on file — use chat recovery below.</p>}
            <Link to="/login" className="auth-button" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 16 }}>
              I remembered — Sign in
            </Link>
            {chatRecoveryAvailable && (
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 13, opacity: 0.9 }}>Still stuck? Prove it&apos;s your account:</p>
                <button type="button" className="auth-button" disabled={loading} onClick={startLastChat}>
                  Who did I last talk to?
                </button>
                <button type="button" className="auth-button" disabled={loading} onClick={() => setStep('three-names')}>
                  Name 3 people from my chats
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'last-chat' && (
          <div className="auth-form">
            <p style={{ fontWeight: 600, marginBottom: 12 }}>{question}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {options.map((opt) => (
                <button key={opt} type="button" className="auth-button" disabled={loading} onClick={() => verifyLastChat(opt)}>
                  @{opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'three-names' && (
          <form onSubmit={verifyThreeNames} className="auth-form">
            <p style={{ fontSize: 13, marginBottom: 12 }}>Enter the usernames of 3 people you&apos;ve chatted with:</p>
            <div className="form-group">
              <label>Username 1</label>
              <input value={name1} onChange={(e) => setName1(e.target.value.toLowerCase())} required />
            </div>
            <div className="form-group">
              <label>Username 2</label>
              <input value={name2} onChange={(e) => setName2(e.target.value.toLowerCase())} required />
            </div>
            <div className="form-group">
              <label>Username 3</label>
              <input value={name3} onChange={(e) => setName3(e.target.value.toLowerCase())} required />
            </div>
            <button type="submit" className="auth-button" disabled={loading}>Verify</button>
          </form>
        )}

        {step === 'new-pin' && (
          <form onSubmit={submitNewPin} className="auth-form">
            <div className="form-group">
              <label>New 6-digit PIN</label>
              <input type="password" inputMode="numeric" maxLength={6} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
            </div>
            <div className="form-group">
              <label>Confirm PIN</label>
              <input type="password" inputMode="numeric" maxLength={6} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
            </div>
            <button type="submit" className="auth-button" disabled={loading}>Save new PIN</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPin;
