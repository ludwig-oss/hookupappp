import { Link } from 'react-router-dom';
import './Legal.css';

const PrivacyPolicy = () => {
  return (
    <div className="legal-page">
      <div className="legal-card">
        <Link to="/" className="legal-back">← Back</Link>
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-updated">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="legal-content">
          <p className="legal-intro">
            We care about your privacy. This policy describes what information we collect and how we use it.
          </p>

          <section>
            <h2>1. Information we collect</h2>
            <ul>
              <li><strong>Account data:</strong> name, username, email, password (hashed), and any profile details you provide (bio, photos, age, location, preferences).</li>
              <li><strong>Usage data:</strong> how you use the app (e.g. features used, matches, messages) to improve the service and safety.</li>
              <li><strong>Device & technical data:</strong> device type, IP address, and similar technical information necessary for security and operation.</li>
              <li><strong>Communications:</strong> messages and other content you send in the app; we store and process these to provide the service and for safety and moderation.</li>
            </ul>
          </section>

          <section>
            <h2>2. How we use your information</h2>
            <ul>
              <li>To provide, maintain, and improve the service</li>
              <li>To show your profile to other users according to your preferences and our matching logic</li>
              <li>To enforce our Terms, prevent abuse, and protect safety (including content moderation and responding to reports)</li>
              <li>To communicate with you (e.g. account and safety notices, product updates)</li>
              <li>To comply with applicable law and respond to valid legal requests</li>
            </ul>
          </section>

          <section>
            <h2>3. Sharing your information</h2>
            <p>We do not sell your personal information. We may share data with:</p>
            <ul>
              <li>Other users as needed for the service (e.g. profile visibility, messaging)</li>
              <li>Service providers who help us operate the app (hosting, analytics, support), under strict confidentiality</li>
              <li>Law enforcement or authorities when required by law or to protect safety</li>
            </ul>
          </section>

          <section>
            <h2>4. Your choices</h2>
            <p>You can update your profile and many preferences in Settings (e.g. privacy, visibility). You can delete your account at any time; we will delete or anonymize your data as described in our data retention practices.</p>
          </section>

          <section>
            <h2>5. Security</h2>
            <p>We use industry-standard measures to protect your data (encryption, access controls). No system is 100% secure; we encourage you to use a strong password and to be careful what you share.</p>
          </section>

          <section>
            <h2>6. Changes</h2>
            <p>We may update this Privacy Policy. We will notify you of material changes (e.g. in the app or by email). Continued use after the change means you accept the updated policy.</p>
          </section>

          <section>
            <h2>7. Contact</h2>
            <p>For privacy questions or requests, contact us through the app (Help or Settings).</p>
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
