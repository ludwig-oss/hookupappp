import React, { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './WidgetModal.css';

interface WidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: string;
  children: ReactNode;
}

const WidgetModal = ({ isOpen, onClose, title, icon, children }: WidgetModalProps) => {
  useEffect(() => {
    // Notify parent about modal state
    window.dispatchEvent(new CustomEvent('modal-state-change', { detail: { isOpen } }));
    
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      if (!isOpen) {
        document.body.style.overflow = '';
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="widget-modal-overlay">
      <div className="widget-modal-content">
        <div className="widget-modal-header">
          <h2 className="widget-modal-title">
            <span>{icon}</span> {title}
          </h2>
          <button className="widget-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="widget-modal-body">
          {children}
        </div>
      </div>
    </div>
  );

  // Render modal in document.body using portal to ensure it's always on top
  return createPortal(modalContent, document.body);
};

export default WidgetModal;

