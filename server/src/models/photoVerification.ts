import { getUserById, updateUserProfile } from './user.js';

export const PHOTO_VERIFY_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

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

export function photoLockStatusForUser(user: {
  id: string;
  createdAt?: string | Date | null;
  photoVerifiedAt?: string | null;
  profilePicture?: string | null;
}): PhotoLockStatus {
  const created = inferAccountCreatedAt(user);
  const deadline = new Date(created.getTime() + PHOTO_VERIFY_GRACE_MS);
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
    message = `Within ${daysUntilDeadline} day${daysUntilDeadline === 1 ? '' : 's'} you must verify your live selfie matches your profile photo, or you will not be able to chat, match, or post. This is for safety and catfishing prevention.`;
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
  const user = await getUserById(userId);
  if (!user) return null;
  if (!user.createdAt) {
    const inferred = inferAccountCreatedAt(user);
    const iso = inferred.toISOString();
    await updateUserProfile(userId, { createdAt: iso });
    return photoLockStatusForUser({ ...user, createdAt: iso });
  }
  return photoLockStatusForUser(user);
}
