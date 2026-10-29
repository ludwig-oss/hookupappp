import { getUserById, updateUserProfile } from './user.js';

/** How long someone can use the app before a missing live selfie locks chat, matching, and posts. */
export const PHOTO_VERIFY_GRACE_MS = 2 * 24 * 60 * 60 * 1000;

export interface PhotoLockStatus {
  photoVerifiedAt: string | null;
  createdAt: string;
  deadlineAt: string;
  locked: boolean;
  daysUntilDeadline: number;
  hasProfilePicture: boolean;
  message: string;
}

export function inferAccountCreatedAt(user: { id: string; createdAt?: string | Date | null }): Date {
  if (user.createdAt) {
    const d = new Date(user.createdAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const n = Number(user.id);
  if (Number.isFinite(n) && n > 1e12 && n < 3e13) return new Date(n);
  return new Date();
}

export function photoLockDeadline(user: {
  id: string;
  createdAt?: string | Date | null;
  photoLockNotBefore?: string | null;
}): Date {
  const created = inferAccountCreatedAt(user);
  const fromSignup = created.getTime() + PHOTO_VERIFY_GRACE_MS;
  const granted = user.photoLockNotBefore ? new Date(user.photoLockNotBefore).getTime() : NaN;
  const deadlineMs = Number.isFinite(granted) ? Math.max(fromSignup, granted) : fromSignup;
  return new Date(deadlineMs);
}

export function photoLockStatusForUser(user: {
  id: string;
  createdAt?: string | Date | null;
  photoVerifiedAt?: string | null;
  profilePicture?: string | null;
  photoLockNotBefore?: string | null;
}): PhotoLockStatus {
  const created = inferAccountCreatedAt(user);
  const deadline = photoLockDeadline(user);
  const verified = Boolean(user.photoVerifiedAt);
  const remainingMs = deadline.getTime() - Date.now();
  const locked = !verified && remainingMs <= 0;
  const daysUntilDeadline = verified ? 0 : Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  let message =
    'Verify your face against your visible profile photo. This is required for safety and to prevent catfishing.';
  if (locked) {
    message =
      'Your account is limited until you prove the person in your profile photo is you. Take a live selfie so we can match it to your visible photo — this is for safety and catfishing prevention.';
  } else if (!verified) {
    message = `You have ${daysUntilDeadline} day${daysUntilDeadline === 1 ? '' : 's'} to match a live selfie to your profile photo. You can keep using the app until then. After that, chat, matching, and posts lock until you do. This is for safety and catfishing prevention.`;
  }
  return {
    photoVerifiedAt: user.photoVerifiedAt || null,
    createdAt: created.toISOString(),
    deadlineAt: deadline.toISOString(),
    locked,
    daysUntilDeadline,
    hasProfilePicture: Boolean(user.profilePicture),
    message,
  };
}

export async function getPhotoLockStatus(userId: string): Promise<PhotoLockStatus | null> {
  let user = await getUserById(userId);
  if (!user) return null;
  const patch: { createdAt?: string; photoLockNotBefore?: string } = {};
  if (!user.createdAt) {
    patch.createdAt = inferAccountCreatedAt(user).toISOString();
    user = { ...user, createdAt: patch.createdAt };
  }
  // Accounts already older than two days would lock the moment this window starts.
  // Give them the same two days, once, then the lock can turn on.
  if (!user.photoVerifiedAt && !user.photoLockNotBefore) {
    const fromSignup = inferAccountCreatedAt(user).getTime() + PHOTO_VERIFY_GRACE_MS;
    if (fromSignup <= Date.now()) {
      patch.photoLockNotBefore = new Date(Date.now() + PHOTO_VERIFY_GRACE_MS).toISOString();
      user = { ...user, photoLockNotBefore: patch.photoLockNotBefore };
    }
  }
  if (patch.createdAt || patch.photoLockNotBefore) {
    await updateUserProfile(userId, patch);
  }
  return photoLockStatusForUser(user);
}
