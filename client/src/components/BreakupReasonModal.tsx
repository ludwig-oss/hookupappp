import { useState } from 'react';
import '../pages/Dashboard.css';

type Props = {
  title?: string;
  onCancel: () => void;
  onSubmit: (payload: { reason: string; reasonPrivate: boolean }) => Promise<void> | void;
  loading?: boolean;
};

export default function BreakupReasonModal({ title, onCancel, onSubmit, loading }: Props) {
  const [reason, setReason] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onSubmit({
        reason: isPrivate ? '' : reason.trim(),
        reasonPrivate: isPrivate || !reason.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || loading;

  return (
    <div className="chat-focus-confirm-overlay" role="dialog" aria-modal="true">
      <div className="chat-focus-confirm-modal" style={{ maxWidth: 440 }}>
        <h3>{title || 'Why are you breaking up?'}</h3>
        <p style={{ fontSize: 13, lineHeight: 1.45 }}>
          Before you unmatch or change the relationship, tell us why — or keep it private. This is used on the Love Life Feed as “HERE WE GO — SINGLE AGAIN”, without your name, in your city.
        </p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, margin: '12px 0' }}>
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
          Reasons are private
        </label>
        {!isPrivate && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={400}
            placeholder="e.g. We grew apart. I need to work on myself."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(0,0,0,0.35)',
              color: '#fff',
              fontSize: 13,
            }}
          />
        )}
        <div className="chat-focus-confirm-actions" style={{ marginTop: 14 }}>
          <button type="button" className="chat-back-btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="chat-compare-fifa-btn" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Saving…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
