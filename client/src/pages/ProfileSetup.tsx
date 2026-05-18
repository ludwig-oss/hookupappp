import { useState, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { profileAPI } from '../api/profile';
import { formatAxiosError } from '../lib/apiError';
import { compressImageDataUrl } from '../lib/compressImage';
import './ProfileSetup.css';

const ProfileSetup = () => {
  const { user, login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const finishSetup = async (picture: string | null) => {
    if (!user?.id) {
      setError('Session expired. Please log in again.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let payload = picture;
      if (payload) {
        payload = await compressImageDataUrl(payload);
      }
      const response = await profileAPI.completeProfileSetup(payload, user.id);
      const token = localStorage.getItem('token') || '';
      login(
        {
          ...user,
          profileSetupComplete: true,
          profilePicture: response.user?.profilePicture ?? payload,
        },
        token
      );
      navigate('/home', { replace: true });
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Failed to complete profile setup'));
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError('Image size must be less than 8MB');
      return;
    }

    setError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePicture(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="profile-setup-container">
      <div className="profile-setup-card">
        <h1 className="setup-title">Complete Your Profile</h1>
        <p className="setup-subtitle">Add a photo so people recognize you, or skip and add one later</p>

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
            disabled={loading}
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
          type="button"
          onClick={() => finishSetup(profilePicture)}
          className="continue-button"
          disabled={loading || !profilePicture}
        >
          {loading ? 'Setting up...' : 'Continue'}
        </button>

        <button
          type="button"
          onClick={() => finishSetup(null)}
          className="upload-button"
          disabled={loading}
          style={{ marginTop: 12, width: '100%' }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
};

export default ProfileSetup;