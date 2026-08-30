import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../api/config';
import SettingsWidgetFull from '../components/widgets/SettingsWidgetFull';
import { useTranslation } from '../context/LanguageContext';
import './Dashboard.css';

const Settings = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const fromHelp = !!(location.state as { fromHelp?: boolean } | null)?.fromHelp;
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_BASE}/api/safety/is-admin`)
      .then((r) => setIsAdmin(!!r.data.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  return (
    <div className="dashboard-container">
      <div className="stars-background" aria-hidden>
        <div className="love-bg-hearts" />
        <div className="love-bg-float">
          <span className="love-float-1">👼</span>
          <span className="love-float-2">💘</span>
          <span className="love-float-3">💑</span>
          <span className="love-float-4">💏</span>
          <span className="love-float-5">💘</span>
          <span className="love-float-6">👫</span>
          <span className="love-float-7">❤️</span>
          <span className="love-float-8">💕</span>
        </div>
      </div>
      <div className="dashboard-top-nav">
        {fromHelp && (
          <Link to="/home" state={{ openWidget: 'help' }} className="dashboard-back-link">← {t('backToHelp')}</Link>
        )}
        <Link to="/home" className="dashboard-back-link">← {t('backToHome')}</Link>
        <Link to="/profile" className="dashboard-back-link">👤 {t('profile')}</Link>
        {isAdmin && (
          <Link to="/admin/safety" className="dashboard-back-link" style={{ color: '#fbbf24' }}>
            🛡 Safety review
          </Link>
        )}
      </div>
      <div className="holographic-panel left-panel" style={{ maxWidth: '720px', margin: '0 auto' }}>
        <SettingsWidgetFull />
      </div>
    </div>
  );
};

export default Settings;
