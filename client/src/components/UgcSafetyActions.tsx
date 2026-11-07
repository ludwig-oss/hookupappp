import { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { chatAPI } from '../api/chat';
import { reportsAPI, type ReportCategory } from '../api/reports';
import { formatAxiosError } from '../lib/apiError';

const REASONS: Array<{ id: ReportCategory; label: string }> = [
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Harassment' },
];

const PRIVACY_POLICY_URL = 'https://deinewebsite.com';

export function UgcSafetyActions({
  userId,
  onBlocked,
}: {
  userId?: string | null;
  onBlocked?: (userId: string) => void;
}) {
  const { user } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const target = String(userId || '');
  if (!target || (user?.id && String(user.id) === target)) return null;

  const report = async (category: ReportCategory) => {
    setBusy(true);
    setError('');
    try {
      await reportsAPI.createReport(target, category, 'Reported from a post, photo, or video.');
      setSent(true);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not send the report.'));
    } finally {
      setBusy(false);
    }
  };

  const block = async () => {
    setBusy(true);
    setError('');
    try {
      await chatAPI.blockUser(target);
      onBlocked?.(target);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not block this person.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ugc-safety" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
      <button type="button" className="back-btn" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => { setOpen(true); setSent(false); setError(''); }}>
        Report (Melden)
      </button>
      <button type="button" className="danger-btn" style={{ fontSize: 12, padding: '6px 10px' }} disabled={busy} onClick={() => void block()}>
        Block (Blockieren)
      </button>
      {error ? <span style={{ color: '#b91c1c', fontSize: 12 }}>{error}</span> : null}
      {open ? (
        <div role="dialog" aria-modal="true" aria-label="Report" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 90 }}>
          <div style={{ width: 'min(420px, 100%)', background: '#fff', borderRadius: 16, padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>Report (Melden)</h3>
            {sent ? (
              <p>Our moderation team will review it within 24 hours.</p>
            ) : (
              <>
                <p style={{ color: '#374151' }}>Why are you reporting this?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {REASONS.map((reason) => (
                    <button key={reason.id} type="button" className="select-user-btn" disabled={busy} onClick={() => void report(reason.id)}>
                      {reason.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button type="button" className="back-btn" style={{ marginTop: 12 }} onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PrivacyPolicyLink() {
  return (
    <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer" className="select-user-btn" style={{ display: 'inline-block', marginTop: 12, textDecoration: 'none' }}>
      Privacy Policy (Datenschutzerklärung)
    </a>
  );
}
