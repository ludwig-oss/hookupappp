import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Landing.css';

/** Interleaved woman → dating couple → man so faces don’t clump. No flower/heart fillers. */
const ROMANCE_IMAGES = [
  { url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=700&h=900&fit=crop&crop=faces&q=80', alt: 'Woman' },
  { url: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=700&h=900&fit=crop&q=80', alt: 'Happy couple dating' },
  { url: 'https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?w=700&h=900&fit=crop&crop=faces&q=80', alt: 'Man' },
  { url: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=700&h=900&fit=crop&q=80', alt: 'Couple sweet moment' },
  { url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=700&h=900&fit=crop&crop=faces&q=80', alt: 'Woman' },
  { url: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=700&h=900&fit=crop&q=80', alt: 'Couple hugging' },
  { url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=700&h=900&fit=crop&crop=faces&q=80', alt: 'Man' },
  { url: 'https://images.unsplash.com/photo-1529636798458-92182e662485?w=700&h=900&fit=crop&q=80', alt: 'Couple walking together' },
  { url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=700&h=900&fit=crop&crop=faces&q=80', alt: 'Woman' },
  { url: 'https://images.unsplash.com/photo-1501901609772-df0848060b33?w=700&h=900&fit=crop&q=80', alt: 'Couple in love' },
  { url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=700&h=900&fit=crop&crop=faces&q=80', alt: 'Man' },
  { url: 'https://images.unsplash.com/photo-1516585427167-9f4af9627e6c?w=700&h=900&fit=crop&q=80', alt: 'Couple dating moment' },
  { url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=700&h=900&fit=crop&crop=faces&q=80', alt: 'Woman' },
  { url: 'https://images.unsplash.com/photo-1494774157369-9dff0432c6e0?w=700&h=900&fit=crop&q=80', alt: 'Couple laughing' },
  { url: 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=700&h=900&fit=crop&crop=faces&q=80', alt: 'Man' },
  { url: 'https://images.unsplash.com/photo-1583939003579-730e3918a60d?w=700&h=900&fit=crop&crop=faces&q=80', alt: 'Couple kiss' },
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
              key={`${img.url}-${i}`}
              className="landing-bg-frame"
              style={{ '--angle': `${i * (360 / ROMANCE_IMAGES.length)}deg` } as React.CSSProperties}
            >
              <img src={img.url} alt={img.alt} loading="lazy" decoding="async" />
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
