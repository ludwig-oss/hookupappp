import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getUserById, getUserByUsername } from './user.js';
import { query, usePostgres } from '../db/index.js';
import { runWithSystem } from '../db/context.js';

export interface ReservedUsername {
  username: string;
  userId: string;
  reservedAt: string;
}

const REGISTRY_PATH = join(process.cwd(), 'server', 'data', 'username-registry.json');
const TAKEN_MSG = 'This username is already taken. Sign in instead.';

export function normalizeUsernameKey(username: string): string {
  return username.trim().toLowerCase();
}

function isRealUserId(userId: string | null | undefined): boolean {
  return Boolean(userId && userId !== 'pending');
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

/** Drop locks that never became a real account (failed signup left user_id = pending). */
async function releaseOrphanClaim(key: string): Promise<void> {
  if (usePostgres()) {
    await query(
      `DELETE FROM reserved_usernames r
       WHERE r.username = $1
         AND (
           r.user_id = 'pending'
           OR r.user_id IS NULL
           OR r.user_id = ''
           OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id)
         )`,
      [key]
    );
    return;
  }
  const list = (await readFileRegistry()).filter((r) => {
    if (r.username !== key) return true;
    return isRealUserId(r.userId);
  });
  await writeFileRegistry(list);
}

export async function purgeOrphanUsernameClaims(): Promise<void> {
  await runWithSystem(async () => {
    if (usePostgres()) {
      await query(
        `DELETE FROM reserved_usernames r
         WHERE r.user_id = 'pending'
            OR r.user_id IS NULL
            OR r.user_id = ''
            OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id)`
      );
      return;
    }
    const list = await readFileRegistry();
    const kept: ReservedUsername[] = [];
    for (const r of list) {
      if (!isRealUserId(r.userId)) continue;
      const u = await getUserById(r.userId);
      if (u) kept.push(r);
    }
    await writeFileRegistry(kept);
  });
}

async function getRegisteredUserIdDb(key: string): Promise<string | null> {
  const res = await query<{ user_id: string }>(
    'SELECT user_id FROM reserved_usernames WHERE username = $1 LIMIT 1',
    [key]
  );
  const id = res.rows[0]?.user_id ?? null;
  return isRealUserId(id) ? id : null;
}

async function reserveUsernameDb(key: string, userId: string): Promise<void> {
  await query(
    `INSERT INTO reserved_usernames (username, user_id) VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET user_id = EXCLUDED.user_id`,
    [key, userId]
  );
}

/** True only when a real account owns this username. */
export async function isUsernameReserved(username: string): Promise<boolean> {
  const key = normalizeUsernameKey(username);
  if (!key) return true;
  return runWithSystem(async () => {
    const active = await getUserByUsername(key);
    if (active) return true;
    const registeredId = usePostgres()
      ? await getRegisteredUserIdDb(key)
      : (await readFileRegistry()).find((r) => r.username === key && isRealUserId(r.userId))?.userId ?? null;
    if (!registeredId) return false;
    const owner = await getUserById(registeredId);
    return Boolean(owner);
  });
}

/** Resolve user id from reserved username (ignores leftover pending locks). */
export async function getRegisteredUserId(username: string): Promise<string | null> {
  const key = normalizeUsernameKey(username);
  if (!key) return null;
  if (usePostgres()) return getRegisteredUserIdDb(key);
  const list = await readFileRegistry();
  const id = list.find((r) => r.username === key)?.userId ?? null;
  return isRealUserId(id) ? id : null;
}

/** Block signup only if a real account already has this username. */
export async function assertUsernameAvailable(username: string): Promise<void> {
  const key = normalizeUsernameKey(username);
  if (!key) throw new Error('Invalid username');
  await runWithSystem(async () => {
    await releaseOrphanClaim(key);
    const active = await getUserByUsername(key);
    if (active) {
      await reserveUsername(key, active.id);
      throw new Error(TAKEN_MSG);
    }
  });
}

/** Same as assert — do not lock the name until createUser succeeds. */
export async function claimUsername(username: string): Promise<void> {
  await assertUsernameAvailable(username);
}

export async function reserveUsername(username: string, userId: string): Promise<void> {
  const key = normalizeUsernameKey(username);
  if (!key || !isRealUserId(userId)) return;
  if (usePostgres()) {
    await reserveUsernameDb(key, userId);
    return;
  }
  const list = await readFileRegistry();
  const rest = list.filter((r) => r.username !== key);
  rest.push({
    username: key,
    userId,
    reservedAt: new Date().toISOString(),
  });
  await writeFileRegistry(rest);
}

/** One-time backfill so existing accounts lock their usernames. */
export async function seedRegistryFromUsers(
  users: { id: string; username?: string | null }[]
): Promise<number> {
  await purgeOrphanUsernameClaims();
  let added = 0;
  for (const u of users) {
    if (!u.username || !isRealUserId(u.id)) continue;
    const key = normalizeUsernameKey(u.username);
    if (!key) continue;
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
    await releaseOrphanClaim(key);
    const active = await getUserByUsername(key);
    if (active) {
      await reserveUsername(key, active.id);
      return { available: false, reason: 'Already taken. Sign in instead.' };
    }
    return { available: true };
  });
}
