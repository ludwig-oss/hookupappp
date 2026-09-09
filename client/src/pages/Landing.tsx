import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Landing.css';

/** Interleaved young women, dating couples, young men — local color photos only. */
const ROMANCE_IMAGES = [
  { url: '/landing/landing-w1.png', alt: 'Woman' },
  { url: '/landing/landing-c1.png', alt: 'Happy couple on a date' },
  { url: '/landing/landing-m1.png', alt: 'Man' },
  { url: '/landing/landing-c2.png', alt: 'Couple hugging' },
  { url: '/landing/landing-w2.png', alt: 'Woman' },
  { url: '/landing/landing-c3.png', alt: 'Sweet couple moment' },
  { url: '/landing/landing-m2.png', alt: 'Man' },
  { url: '/landing/landing-c4.png', alt: 'Couple walking together' },
  { url: '/landing/landing-w3.png', alt: 'Woman' },
  { url: '/landing/landing-m3.png', alt: 'Man' },
];

const Landing = () => {
  const { user, logout } = useContext(AuthContext);

  return (
    <div className="landing-page">
      <div className="landing-bg-carousel">
        <div className="landing-bg-ring">
          {ROMANCE_IMAGES.map((img, i) => (
            <div
              key={`${img.url}-${i}`}
              className="landing-bg-frame"
              style={{ '--angle': `${i * (360 / ROMANCE_IMAGES.length)}deg` } as React.CSSProperties}
            >
              <img src={img.url} alt={img.alt} decoding="async" />
            </div>
          ))}
        </div>
      </div>
      <div className="landing-bg-overlay" />

      <nav className="landing-nav">
        <Link to="/" className="landing-logo">
          Hook Up
        </Link>
        <div className="landing-nav-links">
          <Link to="/terms">Safety</Link>
          <Link to="/privacy">Privacy</Link>
          <a href="#support">Support</a>
          <Link to="/terms">Terms</Link>
        </div>
        <div className="landing-nav-right">
          {user ? (
            <>
              {user.profileSetupComplete ? (
                <Link to="/home" className="landing-btn landing-btn-ghost">Continue</Link>
              ) : (
                <Link to="/profile-setup" className="landing-btn landing-btn-ghost">Finish profile</Link>
              )}
              <button type="button" className="landing-btn landing-btn-ghost" onClick={() => logout()}>
                Log out
              </button>
            </>
          ) : (
            <Link to="/login" className="landing-btn landing-btn-ghost">Log in</Link>
          )}
        </div>
      </nav>

      <main className="landing-hero">
        <h1 className="landing-tagline">Find Your Match</h1>
        <p className="landing-sub">Real connections. Real moments.</p>
        <Link to="/signup" className="landing-cta">
          Create Account
        </Link>
      </main>

      <div className="landing-legal">
        <Link to="/terms">Terms of Service</Link>
        <span className="landing-legal-sep">·</span>
        <Link to="/privacy">Privacy Policy</Link>
      </div>
    </div>
  );
};

export default Landing;
