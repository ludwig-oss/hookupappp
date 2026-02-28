import { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { profileAPI, ProfileData } from '../../api/profile';
import './Widget.css';

const ProfileWidgetFull = () => {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [viewingPhoto, setViewingPhoto] = useState<{ photoId: string; ownerId: string; imageUrl: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const disappearingPhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.id) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const profileData = await profileAPI.getUserProfile(user!.id);
      setProfile(profileData);
      setError('');
    } catch (err: any) {
      console.error('Failed to load profile:', err);
      setError(err.response?.data?.error || 'Failed to load profile. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File, isDisappearing: boolean = false) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          if (isDisappearing) {
            await profileAPI.addDisappearingPhoto(base64, user!.id);
          } else {
            await profileAPI.uploadProfilePicture(base64, user!.id);
          }
          await loadProfile();
        } catch (err: any) {
          setError(err.response?.data?.error || 'Upload failed');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError('Failed to process image');
      setUploading(false);
    }
  };

  const handleViewDisappearingPhoto = async (photoId: string, ownerId: string) => {
    try {
      const result = await profileAPI.viewDisappearingPhoto(photoId, ownerId, user!.id);
      if (result.canView) {
        setViewingPhoto({ photoId, ownerId, imageUrl: result.imageUrl! });
      } else {
        alert('You have already viewed this photo twice!');
      }
    } catch (err: any) {
      setError('Failed to view photo');
    }
  };

  if (loading) {
    return <div className="loading" style={{ textAlign: 'center', padding: '40px' }}>Loading profile...</div>;
  }

  if (!profile) {
    return <div className="error" style={{ textAlign: 'center', padding: '40px' }}>Failed to load profile</div>;
  }

  return (
    <div className="widget-full-content">
      {error && <div className="error-message">{error}</div>}

      {/* Circle Frame Profile Picture */}
      <div className="circle-profile-container">
        <div className="circle-frame-profile" onClick={() => fileInputRef.current?.click()}>
          {profile.profilePicture ? (
            <img src={profile.profilePicture} alt="Profile" className="circle-profile-image" />
          ) : (
            <div className="circle-placeholder">
              <span>+</span>
            </div>
          )}
        </div>
        <div className="profile-info">
          <h3>{profile.name}</h3>
          <p>@{profile.username}</p>
        </div>
      </div>

      {/* Disappearing Photos Section */}
      <div className="disappearing-photos-section">
        <div className="section-header">
          <h4>Disappearing Photos</h4>
          <button
            onClick={() => disappearingPhotoInputRef.current?.click()}
            className="add-photo-btn"
            disabled={uploading}
          >
            + Add
          </button>
        </div>
        <div className="disappearing-photos-grid">
          {profile.disappearingPhotos && profile.disappearingPhotos.length > 0 ? (
            profile.disappearingPhotos.map((photo) => (
              <div
                key={photo.id}
                className="disappearing-photo-item"
                onClick={() => handleViewDisappearingPhoto(photo.id, profile.id)}
              >
                <div className="photo-thumbnail">
                  <img src={photo.imageUrl} alt="Disappearing" />
                  <div className="view-count">
                    Views: {photo.views?.length || 0}/2
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="no-photos">No disappearing photos yet</p>
          )}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageUpload(file, false);
        }}
      />
      <input
        ref={disappearingPhotoInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageUpload(file, true);
        }}
      />

      {/* Photo Viewer Modal */}
      {viewingPhoto && (
        <div className="photo-viewer-modal" onClick={() => setViewingPhoto(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setViewingPhoto(null)}>×</button>
            <img src={viewingPhoto.imageUrl} alt="Viewing" />
            <p className="view-warning">You can view this photo only twice!</p>
          </div>
        </div>
      )}

      {uploading && (
        <div className="uploading-overlay">
          <div className="uploading-spinner"></div>
          <p>Uploading...</p>
        </div>
      )}
    </div>
  );
};

export default ProfileWidgetFull;




