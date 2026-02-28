import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { authAPI } from '../api/auth';
import './Auth.css';

const VerifyEmailPending = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>(location.state?.email || localStorage.getItem('pendingVerificationEmail') || '');
  const [phoneNumber, setPhoneNumber] = useState<string>(location.state?.phoneNumber || localStorage.getItem('pendingVerificationPhone') || '');
  const [verificationMethod, setVerificationMethod] = useState<'email' | 'phone'>(
    (location.state?.method || localStorage.getItem('pendingVerificationMethod') || 'email') as 'email' | 'phone'
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!email && !phoneNumber) {
      navigate('/signup');
    }
  }, [email, phoneNumber, navigate]);

  const handleResend = async () => {
    setLoading(true);
    setMessage('');
    try {
      await authAPI.resendVerificationEmail(
        verificationMethod === 'email' ? email : undefined,
        verificationMethod === 'phone' ? phoneNumber : undefined,
        verificationMethod
      );
      if (verificationMethod === 'phone') {
        setMessage('Verification code sent to your phone! Check your messages.');
      } else {
        setMessage('Verification email sent! Please check your inbox (and spam folder).');
      }
      setVerificationCode(''); // Clear code input
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Failed to resend verification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setMessage('Please enter a valid 6-digit verification code');
      return;
    }

    setVerifying(true);
    setMessage('');
    try {
      const response = await authAPI.verifyEmail(undefined, verificationCode);
      setMessage('Email verified successfully! Redirecting...');
      
      // Auto-login
      if (response.token && response.user) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.removeItem('pendingVerificationEmail');
        setTimeout(() => {
          navigate(response.user.profileSetupComplete ? '/home' : '/profile-setup');
        }, 1500);
      }
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Invalid verification code. Please try again.');
      setVerificationCode('');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: '500px' }}>
        <Link to="/signup" className="back-link">← Back to Sign up</Link>
        <h1 className="auth-title">Verify Your Account</h1>
        <p className="auth-subtitle">
          We've sent a verification code to{' '}
          <strong>{verificationMethod === 'phone' ? phoneNumber : email}</strong>
        </p>

        <div style={{
          padding: '24px',
          background: '#f0f9ff',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '1px solid #bae6fd',
        }}>
          <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '16px' }}>
            {verificationMethod === 'phone' ? '📱' : '📧'}
          </div>
          <p style={{ color: '#1e40af', textAlign: 'center', marginBottom: '12px', fontWeight: 600 }}>
            {verificationMethod === 'phone' ? 'Check Your Messages' : 'Check Your Inbox'}
          </p>
          <p style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', marginBottom: '20px' }}>
            Enter the 6-digit verification code {verificationMethod === 'phone' ? 'from your SMS' : 'from your email'} to activate your account.
          </p>
          
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (verificationCode.length === 6 && !verifying) {
                handleVerifyCode();
              }
            }}
            style={{ marginBottom: '0' }}
          >
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label htmlFor="verificationCode" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
                Verification Code
              </label>
              <input
                type="text"
                id="verificationCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={verificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setVerificationCode(value);
                  setMessage('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && verificationCode.length === 6 && !verifying) {
                    e.preventDefault();
                    handleVerifyCode();
                  }
                }}
                placeholder="Enter 6-digit code"
                maxLength={6}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '24px',
                  textAlign: 'center',
                  letterSpacing: '8px',
                  fontFamily: 'monospace',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
              />
              <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '8px', textAlign: 'center' }}>
                The code expires in 1 hour — press Enter to verify
              </small>
            </div>

            <button
              type="submit"
              disabled={verifying || verificationCode.length !== 6}
              className="auth-button"
              style={{
                width: '100%',
                opacity: verificationCode.length === 6 ? 1 : 0.5,
                cursor: verificationCode.length === 6 ? 'pointer' : 'not-allowed',
              }}
            >
              {verifying ? 'Verifying...' : 'Verify Code'}
            </button>
          </form>
        </div>

        <div style={{
          padding: '16px',
          background: '#fef3c7',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #fcd34d',
        }}>
          <p style={{ color: '#92400e', fontSize: '12px', margin: 0, textAlign: 'center' }}>
            <strong>Alternative:</strong> You can also click the verification link in the email, or enter the code above.
          </p>
        </div>

        {message && (
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            background: message.includes('sent') ? '#d1fae5' : '#fee2e2',
            color: message.includes('sent') ? '#065f46' : '#991b1b',
            fontSize: '14px',
            textAlign: 'center',
          }}>
            {message}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={handleResend}
            className="auth-button"
            disabled={loading}
            style={{ background: '#ff6b9d' }}
          >
            {loading ? 'Sending...' : verificationMethod === 'phone' ? 'Resend Verification Code' : 'Resend Verification Email'}
          </button>
          <Link 
            to="/login" 
            className="auth-button" 
            style={{ 
              background: '#f3f4f6', 
              color: '#374151', 
              textDecoration: 'none', 
              display: 'block', 
              textAlign: 'center' 
            }}
          >
            Back to Login
          </Link>
        </div>

        <div style={{ marginTop: '24px', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
            <strong>Didn't receive the email?</strong>
            <br />
            • Check your spam/junk folder
            <br />
            • Make sure you entered the correct email address
            <br />
            • Wait a few minutes and try resending
            <br />
            • The verification link expires in 24 hours
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPending;
