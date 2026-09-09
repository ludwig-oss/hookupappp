import { useState, useEffect } from 'react';
import { SESSION_PRICE_EUR, walletAPI } from '../../api/improvement';
import { stripeAPI } from '../../api/stripe';

type Props = {
  requestId: string;
  guideName: string;
  onPaid: () => void;
  onBack: () => void;
};

export default function GuidePrepayPanel({ requestId, guideName, onBack }: Props) {
  const [splitInfo, setSplitInfo] = useState<{
    guidePercent: number;
    platformPercent: number;
    guideTipPolicy?: string;
    recordingForbidden?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    walletAPI.getSplitInfo().then(setSplitInfo).catch(() => {});
  }, [requestId]);

  const payWithStripe = async () => {
    setLoading(true);
    setError('');
    try {
      const { url } = await stripeAPI.createCheckoutSession({
        kind: 'guide_request',
        requestId,
      });
      window.location.href = url;
    } catch (e: unknown) {
      setError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          (e instanceof Error ? e.message : 'Stripe failed')
      );
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
          Pay <strong>before</strong> your meeting starts.{' '}
          {splitInfo
            ? `${splitInfo.guidePercent}% goes to your guide. The other ${splitInfo.platformPercent}% is the app fee.`
            : ''}
        </p>
        <ul style={{ fontSize: 11, color: '#fbbf24', margin: '0 0 12px', paddingLeft: 18 }}>
          <li>
            Video recording is <strong>forbidden</strong> during sessions.
          </li>
          <li>Guides share helpful tips — not every secret (like a great teacher).</li>
        </ul>

        {error && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 8 }}>{error}</div>}

        <button
          type="button"
          onClick={() => void payWithStripe()}
          disabled={loading}
          style={{
            width: '100%',
            padding: 14,
            background: 'rgba(99,102,241,0.45)',
            border: '2px solid #818cf8',
            borderRadius: 8,
            color: '#e0e7ff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {loading ? 'Opening Stripe…' : `Pay €${SESSION_PRICE_EUR} with Stripe`}
        </button>
      </div>
    </div>
  );
}
