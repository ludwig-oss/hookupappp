import { Link } from 'react-router-dom';
import './Legal.css';

const PrivacyPolicy = () => {
  return (
    <div className="legal-page">
      <div className="legal-card">
        <Link to="/" className="legal-back">← Back</Link>
        <h1 className="legal-title">Privacy Policy for Hookup Mobile</h1>
        <p className="legal-updated">Last updated: November 7, 2026</p>

        <div className="legal-content">
          <section>
            <h2>1. Data Collection</h2>
            <p>
              We respect your privacy. When you log in using Google Sign-In, we only collect your basic public profile information (Name, Email address, and Profile Picture) to create and maintain your secure personal account.
            </p>
          </section>

          <section>
            <h2>2. Data Usage</h2>
            <p>
              Your information is strictly used to customize your in-app profile dashboard and sync your preferences between the web and mobile versions. We never sell, rent, or share your personal data with third-party advertising companies.
            </p>
          </section>

          <section>
            <h2>3. Subscriptions &amp; Payments</h2>
            <p>
              All app subscriptions and payments are securely handled directly through Apple&apos;s App Store billing system. We do not store or process your credit card or financial details on our servers.
            </p>
          </section>

          <section>
            <h2>4. Contact Us</h2>
            <p>
              If you have any questions or wish to delete your account data, please contact our support email directly.
            </p>
          </section>
        </div>

        <div className="legal-footer-links">
          <Link to="/terms">Terms of Service</Link>
          <span className="legal-sep">·</span>
          <Link to="/login">Login</Link>
          <span className="legal-sep">·</span>
          <Link to="/signup">Sign up</Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
