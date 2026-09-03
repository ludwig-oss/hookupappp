/**
 * Encrypted at-rest storage for ID images and safety check-in videos.
 * Files live under server/data/vault/ — never returned to non-admin API clients.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto';
import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';

const VAULT_DIR = join(process.cwd(), 'server', 'data', 'vault');
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

export type VaultKind = 'id_front' | 'id_back' | 'safety_video' | 'ok360' | 'date_voice' | 'police_doc';

function vaultKey(): Buffer {
  const raw = process.env.ID_VAULT_KEY?.trim();
  if (raw) {
    const buf = Buffer.from(raw, raw.length === 64 ? 'hex' : 'base64');
    if (buf.length === 32) return buf;
    return createHash('sha256').update(raw).digest();
  }
  const fallback = process.env.JWT_SECRET || 'dev-only-vault-key-change-in-production';
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠ ID_VAULT_KEY not set — deriving key from JWT_SECRET. Set ID_VAULT_KEY (32-byte hex) in production.');
  }
  return scryptSync(fallback, 'aswp-sensitive-vault', 32);
}

function encrypt(plain: Buffer): Buffer {
  const key = vaultKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

function decrypt(blob: Buffer): Buffer {
  const key = vaultKey();
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = blob.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

export function vaultRef(planId: string, kind: VaultKind): string {
  return `${planId}/${kind}.vault`;
}

async function vaultPath(ref: string): Promise<string> {
  const safe = ref.replace(/\.\./g, '').replace(/\\/g, '/');
  return join(VAULT_DIR, safe);
}

/** Store base64/data-URL payload encrypted; returns opaque ref for DB/JSON. */
export async function storeSensitive(ref: string, dataUriOrBase64: string): Promise<string> {
  await mkdir(VAULT_DIR, { recursive: true });
  let payload: Buffer;
  const s = dataUriOrBase64.trim();
  if (s.startsWith('data:')) {
    const comma = s.indexOf(',');
    const b64 = comma >= 0 ? s.slice(comma + 1) : s;
    payload = Buffer.from(b64, 'base64');
  } else {
    payload = Buffer.from(s, 'base64');
  }
  const encrypted = encrypt(payload);
  const path = await vaultPath(ref);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, encrypted);
  return ref;
}

export async function readSensitive(ref: string | null | undefined): Promise<Buffer | null> {
  if (!ref) return null;
  try {
    const path = await vaultPath(ref);
    const blob = await readFile(path);
    return decrypt(blob);
  } catch {
    return null;
  }
}

/** MIME guess for admin preview */
export function mimeFromVaultKind(kind: VaultKind): string {
  if (kind === 'safety_video' || kind === 'ok360') return 'video/webm';
  if (kind === 'date_voice') return 'audio/webm';
  if (kind === 'police_doc') return 'application/pdf';
  return 'image/jpeg';
}

export async function readSensitiveAsDataUrl(
  ref: string | null | undefined,
  mime: string
): Promise<string | null> {
  const buf = await readSensitive(ref);
  if (!buf) return null;
  return `data:${mime};base64,${buf.toString('base64')}`;
}

/** Permanently remove a vault file (e.g. ID after they confirm they arrived home safe). */
export async function deleteSensitive(ref: string | null | undefined): Promise<void> {
  if (!ref) return;
  try {
    const path = await vaultPath(ref);
    await unlink(path);
  } catch {
    /* already gone */
  }
}
