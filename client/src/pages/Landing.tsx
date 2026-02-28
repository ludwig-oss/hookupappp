import { Link } from 'react-router-dom';
import './Landing.css';

const ROMANCE_IMAGES = [
  { url: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600', alt: 'Couple holding hands' },
  { url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600', alt: 'Couple in love' },
  { url: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=600', alt: 'Romantic moment' },
  { url: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=600', alt: 'Date night' },
  { url: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=600', alt: 'Couple hugging' },
  { url: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600', alt: 'Friends together' },
  { url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600', alt: 'Love and connection' },
  { url: 'https://images.unsplash.com/photo-1529634801-5a200c6f9c9e?w=600', alt: 'Couple walking' },
  { url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600', alt: 'Joy and love' },
  { url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600', alt: 'Romantic sunset' },
];

const Landing = () => {
  return (
    <div className="landing-page">
      {/* Revolving romance background */}
      <div className="landing-bg-carousel">
        <div className="landing-bg-ring">
          {ROMANCE_IMAGES.map((img, i) => (
            <div
              key={i}
              className="landing-bg-frame"
              style={{ '--angle': `${i * (360 / ROMANCE_IMAGES.length)}deg` } as React.CSSProperties}
            >
              <img src={img.url} alt={img.alt} />
            </div>
          ))}
        </div>
      </div>
      <div className="landing-bg-overlay" />

      {/* Cupid / flying angel baby with arrow */}
      <div className="landing-cupid" aria-hidden>
        <svg viewBox="0 0 120 140" className="cupid-svg">
          <defs>
            <linearGradient id="cupid-skin" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffe0cc" />
              <stop offset="100%" stopColor="#ffccb3" />
            </linearGradient>
            <linearGradient id="cupid-wing" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fff5f5" />
              <stop offset="100%" stopColor="#ffd6e0" />
            </linearGradient>
            <linearGradient id="arrow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff6b9d" />
              <stop offset="100%" stopColor="#c44569" />
            </linearGradient>
          </defs>
          {/* Wings */}
          <path fill="url(#cupid-wing)" opacity="0.95" d="M30 45 Q10 35 15 20 Q22 28 35 38 L38 42 Q25 50 30 45 Z" />
          <path fill="url(#cupid-wing)" opacity="0.95" d="M90 45 Q110 35 105 20 Q98 28 85 38 L82 42 Q95 50 90 45 Z" />
          {/* Baby body */}
          <ellipse cx="60" cy="75" rx="22" ry="28" fill="url(#cupid-skin)" />
          {/* Head */}
          <circle cx="60" cy="42" r="20" fill="url(#cupid-skin)" />
          {/* Bow */}
          <path fill="none" stroke="#c44569" strokeWidth="3" d="M45 25 Q60 15 75 25" />
          <path fill="#ff6b9d" d="M42 22 Q52 28 42 32 Z" />
          <path fill="#ff6b9d" d="M78 22 Q68 28 78 32 Z" />
          {/* Arrow */}
          <line x1="75" y1="28" x2="105" y2="55" stroke="url(#arrow-gradient)" strokeWidth="2.5" strokeLinecap="round" />
          <path fill="#c44569" d="M102 52 L108 56 L105 62 L99 58 Z" />
          {/* Heart */}
          <path fill="#ff6b9d" opacity="0.9" d="M98 62 Q92 55 85 62 Q92 72 98 62 Z" />
        </svg>
      </div>

      {/* Floating hearts */}
      <div className="landing-hearts" aria-hidden>
        {[...Array(12)].map((_, i) => (
          <span key={i} className="landing-heart" style={{ '--i': i } as React.CSSProperties}>♥</span>
        ))}
      </div>

      {/* Top nav */}
      <nav className="landing-nav">
        <Link to="/" className="landing-logo">
          <span className="landing-logo-icon">💕</span>
          Hook Up
        </Link>
        <div className="landing-nav-links">
          <Link to="/terms">Safety</Link>
          <Link to="/privacy">Privacy</Link>
          <a href="#support">Support</a>
          <Link to="/terms">Terms</Link>
        </div>
        <div className="landing-nav-right">
          <Link to="/login" className="landing-btn landing-btn-ghost">Log in</Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="landing-hero">
        <h1 className="landing-tagline">Find Your Match</h1>
        <p className="landing-sub">Real connections. Real moments.</p>
        <Link to="/signup" className="landing-cta">
          Create Account
        </Link>
      </main>

      {/* Bottom legal */}
      <div className="landing-legal">
        <Link to="/terms">Terms of Service</Link>
        <span className="landing-legal-sep">·</span>
        <Link to="/privacy">Privacy Policy</Link>
      </div>
    </div>
  );
};

export default Landing;
