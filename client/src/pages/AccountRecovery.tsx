import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/auth';
import { formatAxiosError } from '../lib/apiError';
import { normalizeUsernameInput } from '../lib/username';
import RecoverySelfieCapture from '../components/RecoverySelfieCapture';
import FaceVerifyPanel from '../components/FaceVerifyPanel';
import PasswordInput from '../components/PasswordInput';
import './Auth.css';

type Step = 'username' | 'hints' | 'three-names' | 'last-chat' | 'describe' | 'selfie' | 'reset' | 'stolen';

type Props = { kind?: 'pin' | 'password' };

const AccountRecovery = ({ kind = 'pin' }: Props) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('username');
  const [username, setUsername] = useState('');
  const [pinHint1, setPinHint1] = useState('');
  const [pinHint2, setPinHint2] = useState('');
  const [pinHint3, setPinHint3] = useState('');
  const [passwordHint1, setPasswordHint1] = useState('');
  const [passwordHint2, setPasswordHint2] = useState('');
  const [passwordHint3, setPasswordHint3] = useState('');
  const [chatRecoveryAvailable, setChatRecoveryAvailable] = useState(false);
  const [faceRecoveryAvailable, setFaceRecoveryAvailable] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [challengeToken, setChallengeToken] = useState('');
  const [pickedName, setPickedName] = useState('');
  const [topic, setTopic] = useState('');
  const [name1, setName1] = useState('');
  const [name2, setName2] = useState('');
  const [name3, setName3] = useState('');
  const [description, setDescription] = useState('');
  const [identityToken, setIdentityToken] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [stolenDetails, setStolenDetails] = useState('');
  const [stolenContact, setStolenContact] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFaceScan, setShowFaceScan] = useState(false);

  const loadHints = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.forgotPinHints(normalizeUsernameInput(username.trim()));
      setPinHint1(res.pinHint1 || res.hint1);
      setPinHint2(res.pinHint2 || res.hint2);
      setPinHint3(res.pinHint3 || res.hint3);
      setPasswordHint1(res.passwordHint1 || '');
      setPasswordHint2(res.passwordHint2 || '');
      setPasswordHint3(res.passwordHint3 || '');
      setChatRecoveryAvailable(res.chatRecoveryAvailable);
      setFaceRecoveryAvailable(Boolean(res.faceRecoveryAvailable));
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
      const res = await authAPI.forgotPinLastChatChallenge(normalizeUsernameInput(username.trim()));
      setQuestion(res.question);
      setOptions(res.options);
      setChallengeToken(res.challengeToken);
      setPickedName('');
      setTopic('');
      setStep('last-chat');
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Could not start recovery'));
    } finally {
      setLoading(false);
    }
  };

  const afterIdentity = (token: string, msg: string) => {
    setIdentityToken(token);
    setMessage(msg);
    setStep('selfie');
  };

  const verifyLastChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickedName) {
      setError('Pick who you last talked to');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.forgotPinVerifyLastChat(
        normalizeUsernameInput(username.trim()),
        challengeToken,
        pickedName,
        topic.trim()
      );
      afterIdentity(res.identityToken, res.message);
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
      const res = await authAPI.forgotPinVerifyChatNames(
        normalizeUsernameInput(username.trim()),
        [name1, name2, name3].map((n) => normalizeUsernameInput(n.trim()))
      );
      afterIdentity(res.identityToken, res.message);
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Could not verify chat names'));
    } finally {
      setLoading(false);
    }
  };

  const verifyDescribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.forgotPinVerifyDescribe(normalizeUsernameInput(username.trim()), description.trim());
      afterIdentity(res.identityToken, res.message);
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'That did not match'));
    } finally {
      setLoading(false);
    }
  };

  const submitSelfie = async (selfie: string, descriptor?: number[]) => {
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.forgotPinSubmitSelfie(
        normalizeUsernameInput(username.trim()),
        identityToken,
        selfie,
        descriptor
      );
      setResetToken(res.resetToken);
      setMessage(res.message);
      setStep('reset');
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Selfie did not match this account'));
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin && newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!newPin && !newPassword) {
      setError('Set a new PIN, a new password, or both');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authAPI.resetPin(resetToken, newPin || undefined, newPassword || undefined);
      navigate('/login', { replace: true, state: { message: 'Sign-in details updated. Sign in with this username only.' } });
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Could not reset'));
    } finally {
      setLoading(false);
    }
  };

  const submitStolen = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.reportStolenAccount(
        normalizeUsernameInput(username.trim()),
        stolenDetails.trim(),
        stolenContact.trim()
      );
      setMessage(res.message);
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Could not send report'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <Link to="/login" className="back-link">← Back to Sign in</Link>
        <h1 className="auth-title">{kind === 'password' ? 'Forgot password' : 'Forgot PIN'}</h1>
        <p className="auth-subtitle">
          We never show your PIN or password. Hints first, then chats, then a selfie checked against this username only.
        </p>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        {step === 'username' && (
          <form onSubmit={loadHints} className="auth-form">
            <div className="form-group">
              <label>Username</label>
              <input value={username} onChange={(e) => setUsername(normalizeUsernameInput(e.target.value))} required autoComplete="username" />
            </div>
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? 'Loading…' : 'Show my hints'}
            </button>
            <button type="button" className="auth-button" onClick={() => setStep('stolen')}>
              Report hacked or stolen account
            </button>
          </form>
        )}

        {step === 'hints' && (
          <div className="auth-form">
            <p style={{ fontSize: 14, marginBottom: 12 }}>
              These are memory hints you wrote — not the real PIN or password.
            </p>
            {(pinHint1 || pinHint2 || pinHint3) && (
              <>
                <p style={{ fontWeight: 600 }}>PIN hints</p>
                {pinHint1 && <p className="pin-hint-line"><strong>1:</strong> {pinHint1}</p>}
                {pinHint2 && <p className="pin-hint-line"><strong>2:</strong> {pinHint2}</p>}
                {pinHint3 && <p className="pin-hint-line"><strong>3:</strong> {pinHint3}</p>}
              </>
            )}
            {(passwordHint1 || passwordHint2 || passwordHint3) && (
              <>
                <p style={{ fontWeight: 600, marginTop: 12 }}>Password hints</p>
                {passwordHint1 && <p className="pin-hint-line"><strong>1:</strong> {passwordHint1}</p>}
                {passwordHint2 && <p className="pin-hint-line"><strong>2:</strong> {passwordHint2}</p>}
                {passwordHint3 && <p className="pin-hint-line"><strong>3:</strong> {passwordHint3}</p>}
              </>
            )}
            {!pinHint1 && !passwordHint1 && (
              <p style={{ opacity: 0.85 }}>No hints on file — prove it is your account below.</p>
            )}
            <Link to="/login" className="auth-button" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 16 }}>
              I remembered — Sign in
            </Link>
            <p style={{ fontSize: 13, marginTop: 16, opacity: 0.9 }}>Still stuck after several wrong tries? Prove this username is yours:</p>
            {chatRecoveryAvailable && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button type="button" className="auth-button" disabled={loading} onClick={() => setStep('three-names')}>
                  Name 3 people from my chats
                </button>
                <button type="button" className="auth-button" disabled={loading} onClick={startLastChat}>
                  Who did I last talk to?
                </button>
                <button type="button" className="auth-button" disabled={loading} onClick={() => setStep('describe')}>
                  Describe who I talked to
                </button>
              </div>
            )}
            {faceRecoveryAvailable && (
              <button type="button" className="auth-button" disabled={loading} onClick={() => { setIdentityToken(''); setStep('selfie'); }}>
                Take a selfie
              </button>
            )}
            <button type="button" className="auth-button" onClick={() => setStep('stolen')}>
              Report hacked or stolen account
            </button>
          </div>
        )}

        {step === 'three-names' && (
          <form onSubmit={verifyThreeNames} className="auth-form">
            <p style={{ fontSize: 13, marginBottom: 12 }}>Enter 3 usernames you have chatted with on this account:</p>
            <div className="form-group">
              <label>Username 1</label>
              <input value={name1} onChange={(e) => setName1(normalizeUsernameInput(e.target.value))} required />
            </div>
            <div className="form-group">
              <label>Username 2</label>
              <input value={name2} onChange={(e) => setName2(normalizeUsernameInput(e.target.value))} required />
            </div>
            <div className="form-group">
              <label>Username 3</label>
              <input value={name3} onChange={(e) => setName3(normalizeUsernameInput(e.target.value))} required />
            </div>
            <button type="submit" className="auth-button" disabled={loading}>Verify</button>
            <button type="button" className="auth-button" onClick={() => setStep('describe')}>I don’t remember the names</button>
          </form>
        )}

        {step === 'last-chat' && (
          <form onSubmit={verifyLastChat} className="auth-form">
            <p style={{ fontWeight: 600, marginBottom: 12 }}>{question}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className="auth-button"
                  style={{ opacity: pickedName === opt ? 1 : 0.7 }}
                  onClick={() => setPickedName(opt)}
                >
                  @{opt}
                </button>
              ))}
            </div>
            <div className="form-group">
              <label>What did you last talk about?</label>
              <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} required placeholder="A few words about the last messages" />
            </div>
            <button type="submit" className="auth-button" disabled={loading || !pickedName}>Continue</button>
            <button type="button" className="auth-button" onClick={() => setStep('describe')}>Describe it instead</button>
          </form>
        )}

        {step === 'describe' && (
          <form onSubmit={verifyDescribe} className="auth-form">
            <p style={{ fontSize: 13, marginBottom: 12 }}>
              Describe who you talked to or what you last talked about. We check if it matches this account — we will not show you the real chat.
            </p>
            <div className="form-group">
              <label>Your description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required minLength={8} />
            </div>
            <button type="submit" className="auth-button" disabled={loading}>Check</button>
          </form>
        )}

        {step === 'selfie' && (
          <div className="auth-form">
            <p style={{ fontSize: 13, marginBottom: 12 }}>
              Take a selfie now. We check it against the photos on this username. After it matches, you can reset your PIN and password.
            </p>
            <RecoverySelfieCapture onCaptured={submitSelfie} busy={loading} />
            <button type="button" className="auth-button" onClick={() => setShowFaceScan(true)} disabled={loading}>
              Use live face scan instead
            </button>
            {showFaceScan && (
              <FaceVerifyPanel
                open={showFaceScan}
                title="Match this account"
                onClose={() => setShowFaceScan(false)}
                onCaptured={async (descriptor) => {
                  setShowFaceScan(false);
                  await submitSelfie('face-scan', descriptor);
                }}
              />
            )}
          </div>
        )}

        {step === 'reset' && (
          <form onSubmit={submitReset} className="auth-form">
            <p style={{ fontSize: 13 }}>This reset applies only to username <strong>@{normalizeUsernameInput(username)}</strong>.</p>
            <div className="form-group">
              <label>New 6-digit PIN (optional if you set a password)</label>
              <input type="password" inputMode="numeric" maxLength={6} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>
            <div className="form-group">
              <label>Confirm PIN</label>
              <input type="password" inputMode="numeric" maxLength={6} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>
            <div className="form-group">
              <label>New password (optional if you set a PIN)</label>
              <PasswordInput id="recover-password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
            </div>
            <div className="form-group">
              <label>Confirm password</label>
              <PasswordInput id="recover-password-2" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
            </div>
            <button type="submit" className="auth-button" disabled={loading}>Save new sign-in</button>
          </form>
        )}

        {step === 'stolen' && (
          <form onSubmit={submitStolen} className="auth-form">
            <p style={{ fontSize: 13, marginBottom: 12 }}>Report this username as hacked or stolen. We review it — we will not mix it with another account.</p>
            {!username && (
              <div className="form-group">
                <label>Username</label>
                <input value={username} onChange={(e) => setUsername(normalizeUsernameInput(e.target.value))} required />
              </div>
            )}
            <div className="form-group">
              <label>What happened?</label>
              <textarea value={stolenDetails} onChange={(e) => setStolenDetails(e.target.value)} rows={4} required minLength={10} />
            </div>
            <div className="form-group">
              <label>How we can reach you (optional)</label>
              <input value={stolenContact} onChange={(e) => setStolenContact(e.target.value)} placeholder="Email or phone" />
            </div>
            <button type="submit" className="auth-button" disabled={loading}>Send report</button>
            <button type="button" className="auth-button" onClick={() => setStep(username ? 'hints' : 'username')}>Back to recovery</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AccountRecovery;
