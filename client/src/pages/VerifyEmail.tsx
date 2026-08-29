import { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authAPI } from '../api/auth';
import { AuthContext } from '../context/AuthContext';
import './Auth.css';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    } else {
      setStatus('error');
      setMessage('No verification token provided');
    }
  }, [token]);

  const verifyEmail = async (verificationToken: string) => {
    try {
      const response = await authAPI.verifyEmail(verificationToken);
      setStatus('success');
      setMessage('Email verified successfully! You can now log in.');
      
      // Auto-login if token is provided
      if (response.token && response.user) {
        login(response.user, response.token);
        localStorage.removeItem('pendingVerificationEmail');
        setTimeout(() => {
          navigate(response.user.profileSetupComplete ? '/home' : '/profile-setup');
        }, 2000);
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.response?.data?.error || 'Failed to verify email. The link may have expired.');
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      const email = localStorage.getItem('pendingVerificationEmail');
      if (!email) {
        setMessage('Please sign up again to receive a new verification email.');
        setLoading(false);
        return;
      }
      await authAPI.resendVerificationEmail(email);
      setMessage('Verification email sent! Please check your inbox.');
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Failed to resend verification email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: '500px' }}>
        <Link to="/signup" className="back-link">← Back to Sign up</Link>
        <h1 className="auth-title">Email Verification</h1>
        
        {status === 'verifying' && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
            <p style={{ color: '#6b7280' }}>Verifying your email address...</p>
          </div>
        )}

        {status === 'success' && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
            <p style={{ color: '#10b981', fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
              Email Verified Successfully!
            </p>
            <p style={{ color: '#6b7280', marginBottom: '24px' }}>{message}</p>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>Redirecting you...</p>
          </div>
        )}

        {status === 'error' && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
            <p style={{ color: '#ef4444', fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
              Verification Failed
            </p>
            <p style={{ color: '#6b7280', marginBottom: '24px' }}>{message}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={handleResend}
                className="auth-button"
                disabled={loading}
                style={{ background: '#ff6b9d' }}
              >
                {loading ? 'Sending...' : 'Resend Verification Email'}
              </button>
              <Link to="/signup" className="auth-button" style={{ background: '#f3f4f6', color: '#374151', textDecoration: 'none', display: 'block', textAlign: 'center' }}>
                Back to Sign Up
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
