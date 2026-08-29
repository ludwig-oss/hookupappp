import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getUserByUsername } from './user.js';

export interface ReservedUsername {
  username: string;
  userId: string;
  reservedAt: string;
}

const REGISTRY_PATH = join(process.cwd(), 'server', 'data', 'username-registry.json');

export function normalizeUsernameKey(username: string): string {
  return username.trim().toLowerCase();
}

async function readRegistry(): Promise<ReservedUsername[]> {
  try {
    const raw = await readFile(REGISTRY_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as ReservedUsername[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRegistry(list: ReservedUsername[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(REGISTRY_PATH, JSON.stringify(list, null, 2));
}

export async function isUsernameReserved(username: string): Promise<boolean> {
  const key = normalizeUsernameKey(username);
  if (!key) return true;
  const list = await readRegistry();
  return list.some((r) => r.username === key);
}

/** Instagram-style: once taken, never available again (even if account is removed). */
export async function assertUsernameAvailable(username: string): Promise<void> {
  const key = normalizeUsernameKey(username);
  if (!key) throw new Error('Invalid username');
  if (await isUsernameReserved(key)) {
    throw new Error('This username is taken forever — pick another one.');
  }
  const active = await getUserByUsername(key);
  if (active) {
    await reserveUsername(key, active.id);
    throw new Error('This username is taken forever — pick another one.');
  }
}

export async function reserveUsername(username: string, userId: string): Promise<void> {
  const key = normalizeUsernameKey(username);
  if (!key || !userId) return;
  const list = await readRegistry();
  if (list.some((r) => r.username === key)) return;
  list.push({
    username: key,
    userId,
    reservedAt: new Date().toISOString(),
  });
  await writeRegistry(list);
}

/** One-time backfill so existing accounts lock their usernames. */
export async function seedRegistryFromUsers(
  users: { id: string; username?: string | null }[]
): Promise<number> {
  let added = 0;
  for (const u of users) {
    if (!u.username) continue;
    const key = normalizeUsernameKey(u.username);
    if (!key) continue;
    const list = await readRegistry();
    if (list.some((r) => r.username === key)) continue;
    await reserveUsername(key, u.id);
    added++;
  }
  return added;
}

export async function checkUsernameAvailable(username: string): Promise<{ available: boolean; reason?: string }> {
  const key = normalizeUsernameKey(username);
  if (!key || key.length < 3) {
    return { available: false, reason: 'Username must be at least 3 characters' };
  }
  if (!/^[a-z0-9_]+$/.test(key)) {
    return { available: false, reason: 'Letters, numbers, and underscore only' };
  }
  if (await isUsernameReserved(key)) {
    return { available: false, reason: 'Taken forever — choose another' };
  }
  const active = await getUserByUsername(key);
  if (active) {
    return { available: false, reason: 'Taken forever — choose another' };
  }
  return { available: true };
}
