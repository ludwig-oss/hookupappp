import { useState } from 'react';
import { schoolAPI } from '../api/school';
import { formatAxiosError } from '../lib/apiError';
import './SchoolNotification.css';

type Props = {
  onDone: () => void;
  onDismiss?: () => void;
};

export default function SchoolScheduleModal({ onDone, onDismiss }: Props) {
  const [hour, setHour] = useState('19');
  const [minute, setMinute] = useState('00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      const h = parseInt(hour, 10);
      const m = parseInt(minute, 10);
      if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
        setError('Enter a valid time');
        return;
      }
      await schoolAPI.saveSchedule(h, m, true);
      onDone();
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Could not save schedule'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="school-overlay" role="dialog" aria-modal="true">
      <div className="school-card school-setup-card">
        <p className="school-badge">Hook Up School</p>
        <h2>When are you usually home?</h2>
        <p className="school-sub">
          We&apos;ll send a daily class reminder around this time. One topic per day until you level up.
        </p>
        {error && <div className="school-error">{error}</div>}
        <div className="school-time-row">
          <label>
            Hour (0–23)
            <input type="number" min={0} max={23} value={hour} onChange={(e) => setHour(e.target.value)} />
          </label>
          <label>
            Minute
            <input type="number" min={0} max={59} value={minute} onChange={(e) => setMinute(e.target.value)} />
          </label>
        </div>
        <button type="button" className="school-btn-primary" onClick={handleSave} disabled={loading}>
          {loading ? 'Saving…' : 'Start my classes'}
        </button>
        <button type="button" className="school-btn-ghost" onClick={onDismiss} disabled={loading}>
          Not now
        </button>
      </div>
    </div>
  );
}
