import { useState, useContext, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { profileAPI } from '../api/profile';
import './ProfileSetup.css';

const ProfileSetup = () => {
  const { user, login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePicture(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleContinue = async () => {
    if (!profilePicture) {
      setError('Please upload a profile picture');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await profileAPI.completeProfileSetup(profilePicture, user!.id);
      // Update user context
      const updatedUser = { ...user!, profileSetupComplete: true, profilePicture: response.user.profilePicture };
      const token = localStorage.getItem('token') || '';
      login(updatedUser, token);
      navigate('/home');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to complete profile setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-setup-container">
      <div className="profile-setup-card">
        <Link to="/login" className="back-link">← Back to Login</Link>
        <h1 className="setup-title">Complete Your Profile</h1>
        <p className="setup-subtitle">Upload a profile picture to get started</p>

        {error && <div className="error-message">{error}</div>}

        <div className="profile-picture-upload">
          <div className="circle-frame">
            {profilePicture ? (
              <img src={profilePicture} alt="Profile" className="preview-image" />
            ) : (
              <div className="placeholder-circle">
                <span>+</span>
                <p>Upload Photo</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="upload-button"
          >
            {profilePicture ? 'Change Photo' : 'Choose Photo'}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageSelect}
        />

        <button
          onClick={handleContinue}
          className="continue-button"
          disabled={loading || !profilePicture}
        >
          {loading ? 'Setting up...' : 'Continue'}
        </button>
      </div>
    </div>
  );
};

export default ProfileSetup;

