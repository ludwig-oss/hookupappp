import { useState } from 'react';
import WidgetModal from './WidgetModal';
import SettingsWidgetFull from './SettingsWidgetFull';
import './Widget.css';

const SettingsWidgetPreview = () => {
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
        <div className="widget-preview widget-preview-settings" onClick={handleOpen}>
          <div className="widget-preview-background"></div>
          <div className="widget-preview-content">
            <div className="widget-preview-icon">⚙️</div>
            <div className="widget-preview-name">Settings</div>
          </div>
        </div>
      )}

      <WidgetModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Settings"
        icon="⚙️"
      >
        <SettingsWidgetFull />
      </WidgetModal>
    </>
  );
};

export default SettingsWidgetPreview;


