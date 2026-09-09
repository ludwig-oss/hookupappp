import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Landing.css';

const ROMANCE_IMAGES = [
  { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80', alt: 'Man smiling' },
  { url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&auto=format&fit=crop&q=80', alt: 'Woman smiling' },
  { url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80', alt: 'Man portrait' },
  { url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&auto=format&fit=crop&q=80', alt: 'Woman portrait' },
  { url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&auto=format&fit=crop&q=80', alt: 'Young man outdoors' },
  { url: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600&auto=format&fit=crop&q=80', alt: 'Couple holding hands' },
  { url: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=600&auto=format&fit=crop&q=80', alt: 'Man laughing' },
  { url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80', alt: 'Woman outdoors' },
  { url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=600&auto=format&fit=crop&q=80', alt: 'Man in city' },
  { url: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=600&auto=format&fit=crop&q=80', alt: 'Couple together' },
];

const Landing = () => {
  const { user, logout } = useContext(AuthContext);

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
