import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { authAPI } from '../api/auth';
import { profileAPI } from '../api/profile';
import { formatAxiosError } from '../lib/apiError';
import PasswordInput from './PasswordInput';
import './AddPasswordPrompt.css';

const DISMISS_KEY = 'hookup:addPasswordLater';

function dismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export default function AddPasswordPrompt() {
  const { user, updateUser } = useContext(AuthContext);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.id || dismissedThisSession()) {
      setOpen(false);
      return;
    }
    if (user.hasBackupPassword === true || user.hasGoogleAuth === true) {
      setOpen(false);
      return;
    }
    let cancelled = false;
    profileAPI
      .getCurrentUser()
      .then((p) => {
        if (cancelled) return;
        const hasPw = Boolean(p.hasBackupPassword);
        const hasGoogle = Boolean(p.hasGoogleAuth);
        updateUser({ hasBackupPassword: hasPw, hasGoogleAuth: hasGoogle });
        if (!hasPw && !hasGoogle && !dismissedThisSession()) setOpen(true);
        else setOpen(false);
      })
      .catch(() => {
        if (!cancelled) setOpen(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.hasBackupPassword, updateUser]);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open || !user?.id || user.hasBackupPassword || user.hasGoogleAuth) return null;

  const later = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const save = async () => {
    setError('');
    if (!password.trim()) {
      setError('Enter a password, or tap Later and we will ask again.');
      return;
    }
    setLoading(true);
    try {
      await authAPI.changePassword(null, password.trim());
      updateUser({ hasBackupPassword: true });
      setOpen(false);
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Could not save password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-pw-overlay" role="dialog" aria-modal="true" aria-labelledby="add-pw-title">
      <div className="add-pw-card">
        <h2 id="add-pw-title">Add a password</h2>
        <p>
          You skipped this at sign-up. Add a password now so you can sign in if you forget your PIN. You can still tap Later — we will ask again.
        </p>
        {error && <div className="add-pw-error">{error}</div>}
        <label htmlFor="add-pw-field">Password</label>
        <PasswordInput
          id="add-pw-field"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="8+ chars, upper, lower, number, symbol"
        />
        <div className="add-pw-actions">
          <button type="button" className="add-pw-save" disabled={loading} onClick={() => void save()}>
            {loading ? 'Saving…' : 'Save password'}
          </button>
          <button type="button" className="add-pw-later" disabled={loading} onClick={later}>
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
