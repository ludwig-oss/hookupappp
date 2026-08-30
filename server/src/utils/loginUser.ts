import bcrypt from 'bcryptjs';
import { getUserByEmail, getUserById, getUserByPhone, getUserByUsername, updateUserPassword, type User } from '../models/user.js';
import { getRegisteredUserId, normalizeUsernameKey } from '../models/usernameRegistry.js';
import { sanitizeUsername } from './sanitize.js';
import { isValidPinFormat, normalizePinDigits, secretCandidates } from './pin.js';

const BCRYPT_ROUNDS = process.env.NODE_ENV === 'production' ? 12 : 10;

function isBcryptHash(stored: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(stored);
}

async function compareStoredSecret(stored: string, secret: string): Promise<boolean> {
  if (!stored) return false;
  if (isBcryptHash(stored)) {
    try {
      return await bcrypt.compare(secret, stored);
    } catch {
      return false;
    }
  }
  // Legacy accounts may have plaintext stored before bcrypt was enforced.
  return stored === secret;
}

export async function resolveUserByIdentifier(rawId: string): Promise<User | null> {
  const trimmed = String(rawId || '').trim();
  if (!trimmed) return null;

  const tried = new Set<string>();
  const tryUsername = async (key: string): Promise<User | null> => {
    const k = key.trim().toLowerCase();
    if (!k || tried.has(k)) return null;
    tried.add(k);
    return getUserByUsername(k);
  };

  const sanitized = sanitizeUsername(trimmed);
  if (sanitized) {
    const hit = await tryUsername(sanitized);
    if (hit) return hit;
  }

  const normalized = normalizeUsernameKey(trimmed);
  if (normalized) {
    const hit = await tryUsername(normalized);
    if (hit) return hit;
  }

  // Legacy accounts created before underscores were allowed in usernames.
  if (normalized.includes('_')) {
    const compact = normalized.replace(/_/g, '');
    if (compact.length >= 3) {
      const hit = await tryUsername(compact);
      if (hit) return hit;
    }
  }

  // Username registry — account exists even if username column drifted.
  for (const key of [sanitized, normalized].filter(Boolean)) {
    const userId = await getRegisteredUserId(key);
    if (userId) {
      const byId = await getUserById(userId);
      if (byId) return byId;
    }
  }

  if (trimmed.includes('@')) {
    const byEmail = await getUserByEmail(trimmed.toLowerCase());
    if (byEmail) return byEmail;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 10) {
    return getUserByPhone(digits);
  }

  return null;
}

export function isPinAccount(user: User): boolean {
  if (user.pinAuth === true) return true;
  if (user.pinAuth === false) return false;
  return Boolean(user.passwordHint1 && user.passwordHint2 && user.passwordHint3);
}

export function usesPasswordSignIn(user: User): boolean {
  if (user.pinAuth === false) return true;
  if (user.pinAuth === true) return false;
  return false;
}

async function compareAnySecret(stored: string, secrets: string[]): Promise<boolean> {
  for (const secret of secrets) {
    if (await compareStoredSecret(stored, secret)) return true;
  }
  return false;
}

export async function verifyLoginSecret(user: User, secret: string): Promise<boolean> {
  const candidates = secretCandidates(secret);
  if (!candidates.length) return false;

  if (user.backupPasswordHash && (await compareAnySecret(user.backupPasswordHash, candidates))) {
    return true;
  }
  if (user.password && (await compareAnySecret(user.password, candidates))) {
    return true;
  }
  return false;
}

/** Re-hash legacy plaintext passwords after a successful login. */
export async function upgradeLegacyPasswordHashes(user: User, secret: string): Promise<void> {
  const candidates = secretCandidates(secret);
  if (!candidates.length) return;

  const { updateUserProfile } = await import('../models/user.js');

  for (const value of candidates) {
    if (user.password && !isBcryptHash(user.password) && user.password === value) {
      await updateUserPassword(user.id, await bcrypt.hash(value, BCRYPT_ROUNDS));
      break;
    }
  }
  for (const value of candidates) {
    if (user.backupPasswordHash && !isBcryptHash(user.backupPasswordHash) && user.backupPasswordHash === value) {
      await updateUserProfile(user.id, {
        backupPasswordHash: await bcrypt.hash(value, BCRYPT_ROUNDS),
      });
      break;
    }
  }
}

export function loginFailureMessage(
  user: User | null,
  options?: { pinLogin?: boolean; attemptedSecret?: string }
): string {
  if (!user) return 'Wrong username or sign-in code';

  const pinAttempt = options?.pinLogin || isValidPinFormat(normalizePinDigits(options?.attemptedSecret || ''));

  if (pinAttempt && usesPasswordSignIn(user)) {
    return 'This account uses a password, not a 6-digit PIN. Switch to the Password tab and enter your full password.';
  }

  if (pinAttempt && isPinAccount(user) && !user.password?.trim()) {
    return 'PIN sign-in is unavailable for this account. Use Forgot PIN to set a new one.';
  }

  if (pinAttempt && isPinAccount(user)) {
    return 'Wrong username or PIN. Double-check all 6 digits, or use Forgot PIN.';
  }

  if (isPinAccount(user) && !user.backupPasswordHash) {
    return 'Wrong username or PIN';
  }
  return 'Wrong username or password';
}
