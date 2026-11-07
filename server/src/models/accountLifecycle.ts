import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { query, usePostgres } from '../db/index.js';
import { deletePostsByUser } from './posts.js';
import { deleteUserSettings } from './settings.js';
import { deleteUserRecord, getUserById, updateUserProfile, type User } from './user.js';
import { releaseUsername } from './usernameRegistry.js';
import { useCloudinary } from '../utils/storage.js';

const DATA_DIR = join(process.cwd(), 'server', 'data');

const JSON_STORES = [
  'settings.json',
  'messages.json',
  'activity-interests.json',
  'activity-precomm.json',
  'buzzes.json',
  'interests.json',
  'preferences.json',
  'date-match-queue.json',
  'date-matches.json',
  'date-match-pitches.json',
  'walk-interests.json',
  'walk-proximity-dismissals.json',
  'guide-wallets.json',
  'guide-wallet-transactions.json',
  'guide-withdrawals.json',
  'gamification.json',
  'premium.json',
];

function mentionsUser(row: unknown, userId: string): boolean {
  if (!row || typeof row !== 'object') return false;
  const record = row as Record<string, unknown>;
  const keys = ['userId', 'fromUserId', 'toUserId', 'userId1', 'userId2', 'ownerId', 'payerUserId'];
  return keys.some((key) => record[key] != null && String(record[key]) === userId);
}

async function stripJsonStore(fileName: string, userId: string): Promise<void> {
  const path = join(DATA_DIR, fileName);
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
    if (Array.isArray(parsed)) {
      const next = parsed.filter((row) => !mentionsUser(row, userId));
      if (next.length !== parsed.length) await writeFile(path, JSON.stringify(next, null, 2));
      return;
    }
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      if (record[userId] !== undefined) {
        delete record[userId];
        await writeFile(path, JSON.stringify(record, null, 2));
      }
    }
  } catch {
    /* Store is absent or not JSON. Account deletion still continues. */
  }
}

function mediaUrls(user: User): string[] {
  const urls = [
    user.profilePicture,
    ...(user.stories || []).map((story) => story.mediaUrl),
    ...(user.disappearingPhotos || []).map((photo) => photo.imageUrl),
    ...(user.highlights || []).flatMap((highlight) => [
      highlight.coverImage,
      ...(highlight.items || []).map((item) => item.imageUrl),
    ]),
  ];
  return urls.filter((url): url is string => typeof url === 'string' && url.startsWith('http'));
}

async function destroyRemoteMedia(urls: string[]): Promise<void> {
  if (!useCloudinary()) return;
  const { v2: cloudinary } = await import('cloudinary');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  const seen = new Set<string>();
  for (const url of urls) {
    const match = url.match(/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+(?:\?.*)?$/i);
    if (!match) continue;
    const key = `${match[1]}:${match[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await cloudinary.uploader.destroy(match[2], { resource_type: match[1] }).catch(() => undefined);
  }
}

async function deletePostgresRows(userId: string): Promise<void> {
  if (!usePostgres()) return;
  const statements = [
    'DELETE FROM dating_posts WHERE user_id = $1',
    'DELETE FROM messages WHERE from_user_id = $1 OR to_user_id = $1',
    'DELETE FROM activity_interests WHERE from_user_id = $1 OR to_user_id = $1',
    'DELETE FROM connection_buzzes WHERE from_user_id = $1 OR to_user_id = $1',
    'DELETE FROM profile_stories WHERE user_id = $1',
    'DELETE FROM profile_highlights WHERE user_id = $1',
    'DELETE FROM guide_applications WHERE user_id = $1',
    'DELETE FROM wallet_transactions WHERE user_id = $1',
    'DELETE FROM wallet_withdrawals WHERE user_id = $1',
    'DELETE FROM paypal_authorizations WHERE user_id = $1 OR payer_user_id = $1',
    'DELETE FROM guide_wallets WHERE user_id = $1',
    'DELETE FROM reserved_usernames WHERE user_id = $1',
  ];
  for (const sql of statements) {
    await query(sql, [userId]).catch((err) => {
      console.error('Account purge step failed:', err);
    });
  }
}

export async function setAccountPaused(userId: string, paused: boolean): Promise<User | null> {
  const user = await updateUserProfile(userId, { isPaused: paused });
  if (paused && user) await stripJsonStore('date-match-queue.json', String(user.id));
  return user;
}

export async function purgeAccount(userId: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) {
    const err = new Error('Account not found');
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
  const id = String(user.id);
  const postUrls = await deletePostsByUser(id);
  await destroyRemoteMedia([...mediaUrls(user), ...postUrls]);
  await deletePostgresRows(id);
  await deleteUserSettings(id).catch(() => undefined);
  if (user.username) await releaseUsername(user.username, id).catch(() => undefined);
  for (const fileName of JSON_STORES) {
    await stripJsonStore(fileName, id);
  }
  await deleteUserRecord(id);
}
