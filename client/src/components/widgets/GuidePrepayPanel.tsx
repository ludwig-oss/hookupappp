import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { paymentAPI, SESSION_PRICE_EUR, walletAPI } from '../../api/improvement';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '');

type Props = {
  requestId: string;
  guideName: string;
  onPaid: () => void;
  onBack: () => void;
};

function StripePayForm({ requestId, onPaid }: { requestId: string; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pay = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    setError('');
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) throw new Error(submitError.message);
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });
      if (confirmError) throw new Error(confirmError.message);
      const piId = paymentIntent?.id;
      if (!piId) throw new Error('Payment incomplete');
      await paymentAPI.confirmGuideStripePayment(requestId, piId);
      onPaid();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Card payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <PaymentElement />
      {error && <div style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{error}</div>}
      <button
        type="button"
        onClick={pay}
        disabled={loading || !stripe}
        style={{
          marginTop: 12,
          width: '100%',
          padding: 12,
          background: 'rgba(99, 102, 241, 0.35)',
          border: '2px solid #818cf8',
          borderRadius: 8,
          color: '#c7d2fe',
          cursor: 'pointer',
          fontFamily: 'Orbitron, monospace',
        }}
      >
        {loading ? 'Processing…' : `Pay €${SESSION_PRICE_EUR} with card / Apple Pay / Google Pay`}
      </button>
    </div>
  );
}

export default function GuidePrepayPanel({ requestId, guideName, onPaid, onBack }: Props) {
  const [splitInfo, setSplitInfo] = useState<{
    guidePercent: number;
    platformPercent: number;
    guideTipPolicy?: string;
    recordingForbidden?: boolean;
  } | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [method, setMethod] = useState<'paypal' | 'stripe'>('paypal');

  useEffect(() => {
    walletAPI.getSplitInfo().then(setSplitInfo).catch(() => {});
    paymentAPI
      .createGuideStripePayment(requestId)
      .then((r) => setClientSecret(r.clientSecret))
      .catch(() => {});
  }, [requestId]);

  const payWithPayPal = async () => {
    setLoading(true);
    setError('');
    try {
      const { approvalUrl } = await paymentAPI.createPayPalOrder(requestId);
      if (!approvalUrl) throw new Error('PayPal unavailable');
      window.location.href = approvalUrl;
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'PayPal failed');
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        style={{
          marginBottom: 12,
          background: 'transparent',
          border: '2px solid #00d4ff',
          color: '#00d4ff',
          padding: '8px 14px',
          borderRadius: 8,
          fontFamily: 'Orbitron, monospace',
          cursor: 'pointer',
        }}
      >
        ← Back
      </button>
      <div style={{ padding: 14, borderRadius: 10, border: '2px solid rgba(0, 212, 255, 0.4)', background: 'rgba(0,0,0,0.35)' }}>
        <div style={{ color: '#00d4ff', fontFamily: 'Orbitron, monospace', marginBottom: 8 }}>
          Prepay session with {guideName} — €{SESSION_PRICE_EUR}
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
          Pay <strong>before</strong> your meeting starts. {splitInfo ? `${splitInfo.guidePercent}% goes to your guide (like OnlyFans); ${splitInfo.platformPercent}% platform fee.` : ''}
        </p>
        <ul style={{ fontSize: 11, color: '#fbbf24', margin: '0 0 12px', paddingLeft: 18 }}>
          <li>Video recording is <strong>forbidden</strong> during sessions.</li>
          <li>Guides share helpful tips — not every secret (like a great teacher).</li>
        </ul>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setMethod('paypal')}
            style={{
              flex: 1,
              padding: 8,
              opacity: method === 'paypal' ? 1 : 0.6,
              border: '2px solid #0070ba',
              background: 'rgba(0,112,186,0.25)',
              color: '#fff',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            PayPal
          </button>
          <button
            type="button"
            onClick={() => setMethod('stripe')}
            style={{
              flex: 1,
              padding: 8,
              opacity: method === 'stripe' ? 1 : 0.6,
              border: '2px solid #818cf8',
              background: 'rgba(99,102,241,0.25)',
              color: '#c7d2fe',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Card / Apple Pay
          </button>
        </div>

        {error && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 8 }}>{error}</div>}

        {method === 'paypal' ? (
          <button
            type="button"
            onClick={payWithPayPal}
            disabled={loading}
            style={{
              width: '100%',
              padding: 14,
              background: '#0070ba',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Redirecting…' : `Pay €${SESSION_PRICE_EUR} with PayPal`}
          </button>
        ) : clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <StripePayForm requestId={requestId} onPaid={onPaid} />
          </Elements>
        ) : (
          <p style={{ color: '#9ca3af', fontSize: 12 }}>Card payments need STRIPE keys configured on the server.</p>
        )}
      </div>
    </div>
  );
}
