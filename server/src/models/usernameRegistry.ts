import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getUserByUsername } from './user.js';
import { query, usePostgres } from '../db/index.js';
import { runWithSystem } from '../db/context.js';

export interface ReservedUsername {
  username: string;
  userId: string;
  reservedAt: string;
}

const REGISTRY_PATH = join(process.cwd(), 'server', 'data', 'username-registry.json');

export function normalizeUsernameKey(username: string): string {
  return username.trim().toLowerCase();
}

async function readFileRegistry(): Promise<ReservedUsername[]> {
  try {
    const raw = await readFile(REGISTRY_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as ReservedUsername[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeFileRegistry(list: ReservedUsername[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(REGISTRY_PATH, JSON.stringify(list, null, 2));
}

async function isUsernameReservedDb(key: string): Promise<boolean> {
  const res = await query<{ username: string }>(
    'SELECT username FROM reserved_usernames WHERE username = $1 LIMIT 1',
    [key]
  );
  return res.rows.length > 0;
}

async function getRegisteredUserIdDb(key: string): Promise<string | null> {
  const res = await query<{ user_id: string }>(
    'SELECT user_id FROM reserved_usernames WHERE username = $1 LIMIT 1',
    [key]
  );
  return res.rows[0]?.user_id ?? null;
}

async function reserveUsernameDb(key: string, userId: string): Promise<void> {
  await query(
    `INSERT INTO reserved_usernames (username, user_id) VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET user_id = EXCLUDED.user_id
     WHERE reserved_usernames.user_id = 'pending'`,
    [key, userId]
  );
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && String((err as { code: unknown }).code) === '23505';
}

const TAKEN_MSG = 'This username is already taken. Sign in instead.';

export async function isUsernameReserved(username: string): Promise<boolean> {
  const key = normalizeUsernameKey(username);
  if (!key) return true;
  if (usePostgres()) return isUsernameReservedDb(key);
  const list = await readFileRegistry();
  return list.some((r) => r.username === key);
}

/** Resolve user id from reserved username (handles username column drift). */
export async function getRegisteredUserId(username: string): Promise<string | null> {
  const key = normalizeUsernameKey(username);
  if (!key) return null;
  if (usePostgres()) return getRegisteredUserIdDb(key);
  const list = await readFileRegistry();
  return list.find((r) => r.username === key)?.userId ?? null;
}

/** Instagram-style: once taken, never available again (even if account is removed). */
export async function assertUsernameAvailable(username: string): Promise<void> {
  const key = normalizeUsernameKey(username);
  if (!key) throw new Error('Invalid username');
  await runWithSystem(async () => {
    if (await isUsernameReserved(key)) {
      throw new Error(TAKEN_MSG);
    }
    const active = await getUserByUsername(key);
    if (active) {
      await reserveUsername(key, active.id);
      throw new Error(TAKEN_MSG);
    }
  });
}

/**
 * Lock the username in Postgres before insert. Two parallel signups cannot both get the same name.
 * Call this before createUser; bind the real user id afterward with reserveUsername.
 */
export async function claimUsername(username: string): Promise<void> {
  const key = normalizeUsernameKey(username);
  if (!key) throw new Error('Invalid username');
  await runWithSystem(async () => {
    const active = await getUserByUsername(key);
    if (active) {
      await reserveUsername(key, active.id);
      throw new Error(TAKEN_MSG);
    }
    if (usePostgres()) {
      try {
        await query(
          'INSERT INTO reserved_usernames (username, user_id) VALUES ($1, $2)',
          [key, 'pending']
        );
      } catch (err: unknown) {
        if (isUniqueViolation(err) || (await isUsernameReserved(key))) {
          throw new Error(TAKEN_MSG);
        }
        throw err;
      }
      return;
    }
    if (await isUsernameReserved(key)) {
      throw new Error(TAKEN_MSG);
    }
    await reserveUsername(key, 'pending');
  });
}

export async function reserveUsername(username: string, userId: string): Promise<void> {
  const key = normalizeUsernameKey(username);
  if (!key || !userId) return;
  if (usePostgres()) {
    await reserveUsernameDb(key, userId);
    return;
  }
  const list = await readFileRegistry();
  if (list.some((r) => r.username === key)) return;
  list.push({
    username: key,
    userId,
    reservedAt: new Date().toISOString(),
  });
  await writeFileRegistry(list);
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
    if (await isUsernameReserved(key)) continue;
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
  return runWithSystem(async () => {
    if (await isUsernameReserved(key)) {
      return { available: false, reason: 'Already taken. Sign in instead.' };
    }
    const active = await getUserByUsername(key);
    if (active) {
      await reserveUsername(key, active.id);
      return { available: false, reason: 'Already taken. Sign in instead.' };
    }
    return { available: true };
  });
}
