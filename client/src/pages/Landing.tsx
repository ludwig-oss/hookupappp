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
  { url: 'https://images.unsplash.com/photo-1727760042419-efefc73ee311?w=600&auto=format&fit=crop&q=80', alt: 'Couple walking' },
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
