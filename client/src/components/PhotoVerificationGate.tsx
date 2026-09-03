import { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { profileAPI, type PhotoLockStatus } from '../api/profile';
import { prepareAndUploadFile } from '../lib/uploadMedia';
import PhotoVerificationModal from './PhotoVerificationModal';
import './PhotoVerificationGate.css';

const REMIND_KEY = (userId: string) => `aswp.photoVerify.remindedAt.${userId}`;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function shouldRemind(userId: string, daysLeft: number): boolean {
  if (daysLeft > 23) return false;
  try {
    const raw = localStorage.getItem(REMIND_KEY(userId));
    const last = raw ? Number(raw) : 0;
    const gap = daysLeft <= 7 ? ONE_DAY_MS : THREE_DAYS_MS;
    return !Number.isFinite(last) || Date.now() - last >= gap;
  } catch {
    return true;
  }
}

function markReminded(userId: string): void {
  try {
    localStorage.setItem(REMIND_KEY(userId), String(Date.now()));
  } catch {
    /* ignore */
  }
}

export default function PhotoVerificationGate() {
  const { user, updateUser } = useContext(AuthContext);
  const [status, setStatus] = useState<PhotoLockStatus | null>(null);
  const [showRemind, setShowRemind] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const applyStatus = (next: PhotoLockStatus | null) => {
    if (!next) return;
    setStatus(next);
    updateUser({
      photoVerifiedAt: next.photoVerifiedAt,
      createdAt: next.createdAt,
      photoLock: next,
    });
  };

  useEffect(() => {
    if (!user?.id) {
      setStatus(null);
      setShowRemind(false);
      setShowScan(false);
      return;
    }
    let cancelled = false;
    const cached = user.photoLock as PhotoLockStatus | undefined;
    if (cached) setStatus(cached);
    profileAPI
      .getPhotoLock()
      .then((s) => {
        if (cancelled) return;
        applyStatus(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when the signed-in user changes
  }, [user?.id]);

  useEffect(() => {
    const onRequired = (e: Event) => {
      const next = (e as CustomEvent<PhotoLockStatus>).detail;
      if (next) applyStatus(next);
      else setStatus((prev) => (prev ? { ...prev, locked: true } : prev));
    };
    window.addEventListener('photo-lock:required', onRequired);
    return () => window.removeEventListener('photo-lock:required', onRequired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user?.id || !status || status.photoVerifiedAt || status.locked) {
      setShowRemind(false);
      return;
    }
    if (shouldRemind(user.id, status.daysUntilDeadline)) {
      setShowRemind(true);
    }
  }, [user?.id, status]);

  if (!user?.id || !status) return null;
  if (status.photoVerifiedAt) return null;

  const locked = status.locked;
  const pictureUrl = (user.profilePicture as string | null) || null;

  const dismissRemind = () => {
    markReminded(user.id);
    setShowRemind(false);
  };

  const onVerified = async () => {
    try {
      const s = await profileAPI.getPhotoLock();
      applyStatus(s);
      const p = await profileAPI.getCurrentUser();
      updateUser(p);
    } catch {
      applyStatus({ ...status, photoVerifiedAt: new Date().toISOString(), locked: false, daysUntilDeadline: 0, message: 'Verified' });
    }
    setShowScan(false);
    setShowRemind(false);
  };

  const onUpload = async (file: File) => {
    setUploadError('');
    setUploading(true);
    try {
      const mediaUrl = await prepareAndUploadFile(file, 'profile');
      const res = await profileAPI.uploadProfilePicture(mediaUrl, user.id);
      updateUser({ profilePicture: res.profilePicture || mediaUrl, photoVerifiedAt: null });
      setShowScan(true);
    } catch {
      setUploadError('Could not upload. Try a smaller photo of your face.');
    } finally {
      setUploading(false);
    }
  };

  const scanModal = showScan ? (
    <PhotoVerificationModal
      blocking={locked}
      profilePictureUrl={pictureUrl}
      onClose={() => {
        if (!locked) setShowScan(false);
      }}
      onVerified={onVerified}
      onSubmit={async (selfieImages, extras) => {
        await profileAPI.submitPhotoVerification(user.id, selfieImages, extras);
      }}
    />
  ) : null;

  if (locked) {
    return (
      <>
        <div className="photo-lock-overlay" role="alertdialog" aria-labelledby="photo-lock-title">
          <div className="photo-lock-card">
            <h3 id="photo-lock-title">Verify it&apos;s you to keep using the app</h3>
            <p>
              Your account is limited until a live selfie matches the profile photo other people see. This is for safety and catfishing prevention — not email or phone.
            </p>
            {pictureUrl ? (
              <img className="photo-lock-preview" src={pictureUrl} alt="Your profile photo" />
            ) : (
              <p>Upload a clear photo of your face first, then take a live selfie so we can match them.</p>
            )}
            {uploadError && <p className="photo-lock-error">{uploadError}</p>}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void onUpload(f);
              }}
            />
            {!pictureUrl && (
              <button type="button" className="photo-lock-primary" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? 'Uploading…' : 'Upload profile photo'}
              </button>
            )}
            <button
              type="button"
              className="photo-lock-primary"
              disabled={!pictureUrl || uploading}
              onClick={() => setShowScan(true)}
            >
              Take live selfie &amp; prove it&apos;s you
            </button>
            <p className="photo-lock-note">You cannot chat, match, or post until this matches.</p>
          </div>
        </div>
        {scanModal}
      </>
    );
  }

  if (!showRemind) return scanModal;

  return (
    <>
      <div className="photo-lock-overlay photo-lock-remind" role="dialog" aria-labelledby="photo-remind-title">
        <div className="photo-lock-card">
          <h3 id="photo-remind-title">Safety reminder</h3>
          <p>{status.message}</p>
          <p>
            Take a live selfie in the app. We compare it to your visible profile photo. If you skip this, after one month you will not be able to interact until you prove it is you.
          </p>
          <button type="button" className="photo-lock-primary" onClick={() => setShowScan(true)}>
            Verify now
          </button>
          <button type="button" className="photo-lock-later" onClick={dismissRemind}>
            Remind me later
          </button>
        </div>
      </div>
      {scanModal}
    </>
  );
}
