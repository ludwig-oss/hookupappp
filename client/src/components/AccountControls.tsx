import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { accountAPI } from '../api/account';
import { profileAPI } from '../api/profile';
import { formatAxiosError } from '../lib/apiError';

const DELETE_COPY = 'Are you sure you want to permanently delete your account? This action cannot be undone.';
const PAUSE_COPY = 'Pausing hides your profile from discovery and other users. Your photos, posts, and account stay saved so you can come back later.';

export default function AccountControls() {
  const { logout, updateUser } = useContext(AuthContext);
  const [paused, setPaused] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    profileAPI
      .getCurrentUser()
      .then((profile) => {
        if (!cancelled) setPaused(profile.isPaused === true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const open = () => setDeleteOpen(true);
    window.addEventListener('hookup:confirm-delete-account', open);
    return () => window.removeEventListener('hookup:confirm-delete-account', open);
  }, []);

  const savePause = async (next: boolean) => {
    setError('');
    setBusy(true);
    try {
      const result = await accountAPI.setPaused(next);
      setPaused(result.isPaused);
      updateUser({ isPaused: result.isPaused });
      setPauseOpen(false);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not update pause.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setError('');
    setBusy(true);
    try {
      await accountAPI.deleteAccount();
      setDeleteOpen(false);
      logout();
    } catch (err) {
      setBusy(false);
      setError(formatAxiosError(err, 'Could not delete the account.'));
    }
  };

  return (
    <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #e5e7eb' }}>
      <h3 style={{ marginBottom: 8, fontSize: 18 }}>Account</h3>
      {error ? <div className="error-message" style={{ marginBottom: 12 }}>{error}</div> : null}
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, cursor: 'pointer' }}>
        <span>
          <strong>Pause Account</strong>
          <span style={{ display: 'block', color: '#6b7280', fontSize: 13 }}>Go invisible. Your data stays until you turn this off.</span>
        </span>
        <input
          type="checkbox"
          checked={paused}
          disabled={busy}
          onChange={(event) => {
            if (event.target.checked) setPauseOpen(true);
            else void savePause(false);
          }}
          style={{ width: 22, height: 22 }}
        />
      </label>
      <button
        type="button"
        className="danger-btn"
        disabled={busy}
        onClick={() => setDeleteOpen(true)}
        style={{ width: '100%', padding: 12 }}
      >
        Delete Account
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => logout()}
        style={{ width: '100%', marginTop: 12, padding: 12, borderRadius: 8, border: '2px solid #111', background: '#111', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
      >
        Log out
      </button>

      {pauseOpen ? (
        <Confirm
          title="Pause Account"
          body={PAUSE_COPY}
          yesLabel="Pause account"
          busy={busy}
          onYes={() => void savePause(true)}
          onNo={() => setPauseOpen(false)}
        />
      ) : null}
      {deleteOpen ? (
        <Confirm
          title="Delete Account"
          body={DELETE_COPY}
          yesLabel="Yes"
          danger
          busy={busy}
          onYes={() => void confirmDelete()}
          onNo={() => setDeleteOpen(false)}
        />
      ) : null}
    </div>
  );
}

function Confirm({
  title,
  body,
  yesLabel,
  danger,
  busy,
  onYes,
  onNo,
}: {
  title: string;
  body: string;
  yesLabel: string;
  danger?: boolean;
  busy: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 80,
      }}
    >
      <div style={{ width: 'min(420px, 100%)', background: '#fff', borderRadius: 16, padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p style={{ color: '#374151', lineHeight: 1.45 }}>{body}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="back-btn" disabled={busy} onClick={onNo}>No</button>
          <button
            type="button"
            className={danger ? 'danger-btn' : 'select-user-btn'}
            disabled={busy}
            onClick={onYes}
          >
            {busy ? 'Working…' : yesLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
