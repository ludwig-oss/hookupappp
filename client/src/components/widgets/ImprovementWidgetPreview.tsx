import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { improvementAPI } from '../../api/improvement';
import ImprovementWidgetFull from './ImprovementWidgetFull';
import WidgetModal from './WidgetModal';
import './Widget.css';

const ImprovementWidgetPreview = () => {
  const { user } = useContext(AuthContext);
  const [isOpen, setIsOpen] = useState(false);
  const [categoriesCount, setCategoriesCount] = useState(0);

  useEffect(() => {
    loadCount();
  }, []);

  const loadCount = async () => {
    try {
      const response = await improvementAPI.getCategories();
      setCategoriesCount(response.categories.length);
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
        <div className="widget-preview widget-preview-improvement" onClick={handleOpen}>
          <div className="widget-preview-background"></div>
          <div className="widget-preview-content">
            <div className="widget-preview-icon">💪</div>
            <div className="widget-preview-name">Improve</div>
          </div>
        </div>
      )}

      <WidgetModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Self Improvement"
        icon="💪"
      >
        <ImprovementWidgetFull />
      </WidgetModal>
    </>
  );
};

export default ImprovementWidgetPreview;

