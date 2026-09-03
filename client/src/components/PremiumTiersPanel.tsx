import { useState } from 'react';
import { premiumAPI, PremiumPlan, PremiumSubscription } from '../api/premium';

const THEME: Record<string, { border: string; btn: string; accent: string; badge: string }> = {
  plus: {
    border: '#ff4d6d',
    btn: 'linear-gradient(90deg,#ff4d6d,#ff8c42)',
    accent: '#ff4d6d',
    badge: 'PLUS',
  },
  gold: {
    border: '#e0b429',
    btn: 'linear-gradient(90deg,#c9a227,#f5d76e)',
    accent: '#e0b429',
    badge: 'GOLD',
  },
  platinum: {
    border: '#d1d5db',
    btn: 'linear-gradient(90deg,#9aa4b2,#e8eef7)',
    accent: '#e5e7eb',
    badge: 'PLATINUM',
  },
};

export default function PremiumTiersPanel({
  plans,
  status,
  onChanged,
}: {
  plans: PremiumPlan[];
  status: PremiumSubscription | null;
  onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const display = plans.filter((p) => p.theme === 'plus' || p.theme === 'gold' || p.theme === 'platinum');
  const list = display.length ? display : plans;

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Premium</h3>
      <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>
        Plus €68 / month: unlimited Date Arena searches, pitch after someone passes, unlimited other-country interest.
        Gold: a guide hand-picks and pitches like your lawyer. Platinum: pitch directly without showing interest first.
      </p>
      {status && (
        <div style={{ marginBottom: 18, padding: 14, borderRadius: 12, border: '1px solid #10b981', background: 'rgba(16,185,129,0.1)' }}>
          Active: <strong>{status.planId}</strong>
          {status.endDate && <> · renews {new Date(status.endDate).toLocaleDateString()}</>}
          <div>
            <button
              type="button"
              className="back-btn"
              style={{ marginTop: 8 }}
              onClick={async () => {
                if (!window.confirm('Cancel subscription?')) return;
                await premiumAPI.cancel();
                await onChanged();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {list.map((plan) => {
          const theme = THEME[plan.theme || 'plus'];
          return (
            <div
              key={plan.id}
              style={{
                background: '#111318',
                color: '#fff',
                borderRadius: 16,
                padding: 18,
                border: `2px solid ${plan.popular ? theme.border : 'rgba(255,255,255,0.12)'}`,
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ letterSpacing: 2, fontSize: 12, opacity: 0.8 }}>ASWP</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: plan.theme === 'plus' ? theme.accent : 'transparent',
                    border: `1px solid ${theme.border}`,
                    color: plan.theme === 'platinum' ? '#111' : '#fff',
                  }}
                >
                  {theme.badge}
                </span>
              </div>
              <h4 style={{ margin: '0 0 8px', fontSize: 20 }}>{plan.headline || plan.name}</h4>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>Select a plan</div>
              <div
                style={{
                  border: `2px solid ${theme.border}`,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.8 }}>1 Month</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  {plan.weeklyPrice ? `€${plan.weeklyPrice.toFixed(2)}/wk` : `€${plan.price}`}
                </div>
                {plan.savePercent ? <div style={{ fontSize: 12, color: '#86efac' }}>Save {plan.savePercent}%</div> : null}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', fontSize: 13 }}>
                {plan.features.map((f: string) => (
                  <li key={f} style={{ marginBottom: 6 }}>✓ {f}</li>
                ))}
              </ul>
              {error && busy === plan.id && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 8 }}>{error}</div>}
              {success && busy === plan.id && <div style={{ color: '#86efac', fontSize: 12, marginBottom: 8 }}>{success}</div>}
              <button
                type="button"
                disabled={!!busy}
                onClick={async () => {
                  const paymentMethod = prompt('Enter payment method ID (Stripe):');
                  if (!paymentMethod) return;
                  setBusy(plan.id);
                  setError('');
                  try {
                    await premiumAPI.subscribe(plan.id, paymentMethod);
                    setSuccess('Subscribed');
                    await onChanged();
                  } catch (e: any) {
                    setError(e.response?.data?.error || 'Subscription failed');
                  } finally {
                    setBusy(null);
                  }
                }}
                style={{
                  width: '100%',
                  border: 'none',
                  borderRadius: 999,
                  padding: '12px 14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: theme.btn,
                  color: plan.theme === 'platinum' ? '#111' : '#fff',
                }}
              >
                Continue — €{plan.price} total
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
