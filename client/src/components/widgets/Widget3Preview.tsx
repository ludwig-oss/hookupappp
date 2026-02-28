import { useState } from 'react';
import WidgetModal from './WidgetModal';
import DiscoverWidgetFull from './DiscoverWidgetFull';
import './Widget.css';

const Widget3Preview = () => {
  const [isOpen, setIsOpen] = useState(false);

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
        <div className="widget-preview widget-preview-discover" onClick={handleOpen}>
          <div className="widget-preview-background"></div>
          <div className="widget-preview-content">
            <div className="widget-preview-icon">⭐</div>
            <div className="widget-preview-name">Discover</div>
          </div>
        </div>
      )}

      <WidgetModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Discover"
        icon="⭐"
      >
        <DiscoverWidgetFull />
      </WidgetModal>
    </>
  );
};

export default Widget3Preview;

