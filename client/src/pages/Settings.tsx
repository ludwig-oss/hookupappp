import { Link } from 'react-router-dom';
import SettingsWidgetFull from '../components/widgets/SettingsWidgetFull';
import { useTranslation } from '../context/LanguageContext';
import './Dashboard.css';

const Settings = () => {
  const { t } = useTranslation();
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
        <Link to="/home" className="dashboard-back-link">← {t('backToHome')}</Link>
        <Link to="/profile" className="dashboard-back-link">👤 {t('profile')}</Link>
      </div>
      <div className="holographic-panel left-panel" style={{ maxWidth: '720px', margin: '0 auto' }}>
        <SettingsWidgetFull />
      </div>
    </div>
  );
};

export default Settings;
