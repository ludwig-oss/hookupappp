import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { profileAPI, ProfileData } from '../../api/profile';
import ProfileWidgetFull from './ProfileWidgetFull';
import WidgetModal from './WidgetModal';
import './Widget.css';

const ProfileWidgetPreview = () => {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const profileData = await profileAPI.getUserProfile(user!.id);
      setProfile(profileData);
    } catch (err: any) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      {!isOpen && (
        <div className="widget-preview widget-preview-profile" onClick={handleOpen}>
          <div className="widget-preview-background"></div>
          <div className="widget-preview-content">
            <div className="widget-preview-icon">👤</div>
            <div className="widget-preview-name">My Profile</div>
          </div>
        </div>
      )}

      <WidgetModal
        isOpen={isOpen}
        onClose={handleClose}
        title="My Profile"
        icon="👤"
      >
        <ProfileWidgetFull />
      </WidgetModal>
    </>
  );
};

export default ProfileWidgetPreview;

