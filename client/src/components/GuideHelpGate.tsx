import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { guideHelpAPI, type GuideHelpStatus } from '../api/guideHelp';
import './GuideHelpGate.css';

export default function GuideHelpGate({
  status,
  onPaid,
  onClose,
}: {
  status: GuideHelpStatus;
  onPaid: (next: GuideHelpStatus) => void;
  onClose?: () => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const price = status.priceEur.toFixed(2);

  const payStripe = async () => {
    setBusy('stripe');
    setError('');
    try {
      const r = await guideHelpAPI.stripeCheckout();
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      setError('Stripe checkout did not start. Set STRIPE_SECRET_KEY on the server.');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Stripe pay failed.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="guide-help-gate">
      <div className="guide-help-card">
        <p className="guide-help-kicker">Crew help</p>
        <h3>First 5 crew helps are free</h3>
        <p>
          You used your free tries on outfit, face, bedroom/TermAct, and lessons. After that, pick a premium plan
          (unlimited on every AI guide) or pay €{price} once with Stripe. That one-time amount goes to the app
          account — same idea as paying for a human session, but 100% stays with the app, not a person.
        </p>
        {status.paidCredits > 0 && (
          <p>
            You still have {status.paidCredits} paid help{status.paidCredits === 1 ? '' : 's'} left.
          </p>
        )}
        {error && <p className="guide-help-error">{error}</p>}
        <div className="guide-help-actions">
          <button
            type="button"
            className="guide-help-primary"
            onClick={() => navigate('/settings', { state: { openTab: 'premium' } })}
          >
            Get Plus / Gold / Platinum
          </button>
          <button type="button" disabled={!!busy} onClick={() => void payStripe()}>
            {busy === 'stripe' ? 'Opening Stripe…' : `Pay €${price} once (Stripe)`}
          </button>
          {onClose && (
            <button type="button" className="guide-help-ghost" onClick={onClose}>
              Not now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
