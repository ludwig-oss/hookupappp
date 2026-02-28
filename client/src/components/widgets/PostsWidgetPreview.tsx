import { useState } from 'react';
import WidgetModal from './WidgetModal';
import PostsWidgetFull from './PostsWidgetFull';
import './Widget.css';

const PostsWidgetPreview = () => {
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
        <div className="widget-preview widget-preview-posts" onClick={handleOpen}>
          <div className="widget-preview-background"></div>
          <div className="widget-preview-content">
            <div className="widget-preview-icon">📖</div>
            <div className="widget-preview-name">Stories</div>
          </div>
        </div>
      )}

      <WidgetModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Dating Stories"
        icon="📱"
      >
        <PostsWidgetFull />
      </WidgetModal>
    </>
  );
};

export default PostsWidgetPreview;


