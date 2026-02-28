import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { chatAPI } from '../../api/chat';
import ChatWidgetFull from './ChatWidgetFull';
import WidgetModal from './WidgetModal';
import './Widget.css';

const ChatWidgetPreview = () => {
  const { user } = useContext(AuthContext);
  const [conversations, setConversations] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadConversations();
    }
  }, [user]);

  const loadConversations = async () => {
    try {
      const response = await chatAPI.getConversations(user!.id);
      setConversations(response.conversations);
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

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
        <div className="widget-preview widget-preview-chat" onClick={handleOpen}>
          <div className="widget-preview-background"></div>
          <div className="widget-preview-content">
            <div className="widget-preview-icon">💬</div>
            <div className="widget-preview-name">Chat</div>
            {unreadCount > 0 && (
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
              }}>{unreadCount > 9 ? '9+' : unreadCount}</div>
            )}
          </div>
        </div>
      )}

      <WidgetModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Dating Chat"
        icon="💬"
      >
        <ChatWidgetFull />
      </WidgetModal>
    </>
  );
};

export default ChatWidgetPreview;

