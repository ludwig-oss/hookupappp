import { Link } from 'react-router-dom';
import './Legal.css';

const TermsOfService = () => {
  return (
    <div className="legal-page">
      <div className="legal-card">
        <Link to="/" className="legal-back">← Back</Link>
        <h1 className="legal-title">Terms of Service</h1>
        <p className="legal-updated">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="legal-content">
          <p className="legal-intro">
            These Terms of Service establish legal boundaries, ensure user safety, and protect our liability.
            By using this app you agree to the following.
          </p>

          <section>
            <h2>1. Age requirement</h2>
            <p>You must be <strong>18 years or older</strong> (or the age of majority in your jurisdiction) to use this service. By creating an account you confirm that you meet this requirement.</p>
          </section>

          <section>
            <h2>2. User conduct & community guidelines</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Harass, threaten, or bully other users</li>
              <li>Create fraudulent, fake, or misleading profiles</li>
              <li>Spam, solicit, or send unsolicited commercial messages</li>
              <li>Share inappropriate, offensive, or illegal content</li>
              <li>Impersonate others or misrepresent your identity</li>
              <li>Use the service for any illegal purpose</li>
            </ul>
            <p>We may remove content and suspend or ban accounts that violate these rules.</p>
          </section>

          <section>
            <h2>3. Safety disclaimer</h2>
            <p><strong>We do not conduct criminal background checks or identity verification on users.</strong> You interact with other users at your own risk. We encourage you to use the in-app safety features (e.g. sharing your plans with a contact, meeting in public) and to report concerning behavior.</p>
          </section>

          <section>
            <h2>4. Termination rights</h2>
            <p>We reserve the right to suspend or terminate your account, remove your content, or ban you from the service if you violate these Terms or our policies. You may delete your account at any time from Settings.</p>
          </section>

          <section>
            <h2>5. Intellectual property & your content</h2>
            <p>You own the content you post (photos, bio, messages). By posting, you grant us a non-exclusive, worldwide license to use, display, and store that content as needed to operate the service. You must not post content that infringes others’ intellectual property or rights.</p>
          </section>

          <section>
            <h2>6. Payment & subscription (if applicable)</h2>
            <p>If you subscribe to premium features: costs, billing cycle, and renewal terms will be shown at checkout. You may cancel before the next renewal. In certain jurisdictions you may have a right to cancel within 14 days; see the subscription screen for details.</p>
          </section>

          <section>
            <h2>7. Limitation of liability</h2>
            <p>To the fullest extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of the service or your interactions with other users. Our total liability is limited to the amount you paid us in the 12 months before the claim.</p>
          </section>

          <section>
            <h2>8. Data & privacy</h2>
            <p>We collect and use information as described in our <Link to="/privacy" className="legal-inline-link">Privacy Policy</Link>. By using the service you consent to that collection and use.</p>
          </section>

          <section>
            <h2>9. Changes to these terms</h2>
            <p>We may update these Terms from time to time. We will provide notice (e.g. in the app or by email) when we make material changes. Continued use after the change means you accept the updated Terms.</p>
          </section>

          <section>
            <h2>10. Contact</h2>
            <p>For questions about these Terms, contact us through the app (e.g. Help or Settings).</p>
          </section>
        </div>

        <div className="legal-footer-links">
          <Link to="/privacy">Privacy Policy</Link>
          <span className="legal-sep">·</span>
          <Link to="/login">Login</Link>
          <span className="legal-sep">·</span>
          <Link to="/signup">Sign up</Link>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
