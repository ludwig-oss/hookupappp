import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Landing.css';

/** Interleaved: woman → couple → man → couple… so the ring never stacks same-gender portraits. */
const ROMANCE_IMAGES = [
  { url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&auto=format&fit=crop&q=80', alt: 'Woman' },
  { url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&auto=format&fit=crop&q=80', alt: 'Wedding couple' },
  { url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&auto=format&fit=crop&q=80', alt: 'Man' },
  { url: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=600&auto=format&fit=crop&q=80', alt: 'Happy couple' },
  { url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80', alt: 'Woman portrait' },
  { url: 'https://images.unsplash.com/photo-1583939003579-730e3918a60d?w=600&auto=format&fit=crop&q=80', alt: 'Wedding kiss' },
  { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80', alt: 'Man smiling' },
  { url: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600&auto=format&fit=crop&q=80', alt: 'Couple together' },
  { url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&auto=format&fit=crop&q=80', alt: 'Woman' },
  { url: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=600&auto=format&fit=crop&q=80', alt: 'Couple hugging' },
  { url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80', alt: 'Man portrait' },
  { url: 'https://images.unsplash.com/photo-1606800052052-a08af952794b?w=600&auto=format&fit=crop&q=80', alt: 'Wedding couple happy' },
  { url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&auto=format&fit=crop&q=80', alt: 'Woman smiling' },
  { url: 'https://images.unsplash.com/photo-1529636798458-92182e662485?w=600&auto=format&fit=crop&q=80', alt: 'Couple walking' },
  { url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&auto=format&fit=crop&q=80', alt: 'Man outdoors' },
  { url: 'https://images.unsplash.com/photo-1501901609772-df0848060b33?w=600&auto=format&fit=crop&q=80', alt: 'Sweet couple moment' },
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
