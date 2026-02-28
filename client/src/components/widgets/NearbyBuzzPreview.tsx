import { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { nearbyAPI } from '../../api/nearby';
import NearbyBuzzFull from './NearbyBuzzFull';
import WidgetModal from './WidgetModal';
import './Widget.css';

const NearbyBuzzPreview = () => {
  const { user } = useContext(AuthContext);
  const [isOpen, setIsOpen] = useState(false);
  const [buzzCount, setBuzzCount] = useState(0);

  useEffect(() => {
    if (user?.id) {
      loadPreviewData();
    }
  }, [user]);

  const loadPreviewData = async () => {
    try {
      const buzzData = await nearbyAPI.getBuzz(user!.id);
      setBuzzCount(buzzData.incoming.length);
    } catch (err) {
      // Ignore errors in preview
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
        <div className="widget-preview widget-preview-nearby" onClick={handleOpen}>
          <div className="widget-preview-background"></div>
          <div className="widget-preview-content">
            <div className="widget-preview-icon">📍</div>
            <div className="widget-preview-name">Nearby</div>
            {buzzCount > 0 && (
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: '#ef4444',
                color: 'white',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 'bold',
                zIndex: 4
              }}>{buzzCount > 9 ? '9+' : buzzCount}</div>
            )}
          </div>
        </div>
      )}

      <WidgetModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Nearby Buzz (50m)"
        icon="📍"
      >
        <NearbyBuzzFull />
      </WidgetModal>
    </>
  );
};

export default NearbyBuzzPreview;

