import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { createPost } from './posts.js';
import { getUserById, type User } from './user.js';
import { createMessage } from './chat.js';

const INTEREST_WINDOW_MS = 24 * 60 * 60 * 1000;
const LUCKY_COUNT = 7;
const PRIVATE_REASON = 'Reasons are private.';
const DB_PATH = join(process.cwd(), 'server', 'data', 'single-again.json');

export interface SingleAgainRecord {
  id: string;
  postId: string;
  ownerUserId: string;
  city: string;
  reason: string;
  photoUrl: string | null;
  interestUserIds: string[];
  interestClosesAt: string;
  luckyUserIds: string[];
  rouletteDrawnAt: string | null;
  healHold: boolean;
  healNote: string | null;
  createdAt: string;
}

export interface SingleAgainPublic {
  postId: string;
  city: string;
  reason: string;
  photoUrl: string | null;
  interestClosesAt: string;
  interestCount: number;
  hasEntered: boolean;
  drawn: boolean;
  luckyCount: number;
  isOwner: boolean;
  iAmLucky: boolean;
  healHold: boolean;
  healNote: string | null;
  hoursLeft: number;
}

async function readAll(): Promise<SingleAgainRecord[]> {
  try {
    const raw = await readFile(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeAll(rows: SingleAgainRecord[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then((fs) => fs.mkdir(dir, { recursive: true }));
  await writeFile(DB_PATH, JSON.stringify(rows, null, 2), 'utf-8');
}

export function pickBestBodyOrFacePhoto(user: User): string | null {
  if (user.profilePicture) return user.profilePicture;
  for (const h of user.highlights || []) {
    const fromItem = (h.items || []).find((i) => i.mediaType !== 'video' && i.imageUrl)?.imageUrl;
    if (h.coverImage) return h.coverImage;
    if (fromItem) return fromItem;
  }
  for (const p of user.profiles || []) {
    const photo = (p.photos || []).find(Boolean);
    if (photo) return photo;
  }
  return null;
}

function hoursLeft(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (60 * 60 * 1000)));
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function getByPostId(postId: string): Promise<SingleAgainRecord | null> {
  const rows = await readAll();
  return rows.find((r) => r.postId === postId) || null;
}

export async function getByOwner(ownerUserId: string): Promise<SingleAgainRecord[]> {
  const rows = await readAll();
  return rows.filter((r) => r.ownerUserId === ownerUserId);
}

export async function getHoldBetween(userA: string, userB: string): Promise<{
  isRoulette: boolean;
  held: boolean;
  ownerUserId: string | null;
  healNote: string | null;
  record: SingleAgainRecord | null;
}> {
  const rows = await readAll();
  for (const r of rows) {
    if (!r.luckyUserIds.length) continue;
    const lucky = r.luckyUserIds.includes(userA) || r.luckyUserIds.includes(userB);
    const owner = r.ownerUserId === userA || r.ownerUserId === userB;
    if (lucky && owner) {
      return {
        isRoulette: true,
        held: Boolean(r.healHold),
        ownerUserId: r.ownerUserId,
        healNote: r.healNote,
        record: r,
      };
    }
  }
  return { isRoulette: false, held: false, ownerUserId: null, healNote: null, record: null };
}

export async function drawAllDue(): Promise<void> {
  const rows = await readAll();
  for (const rec of rows) {
    if (!rec.rouletteDrawnAt && Date.now() >= new Date(rec.interestClosesAt).getTime()) {
      await drawIfDue(rec);
    }
  }
}

async function drawIfDue(rec: SingleAgainRecord): Promise<SingleAgainRecord> {
  if (rec.rouletteDrawnAt) return rec;
  if (Date.now() < new Date(rec.interestClosesAt).getTime()) return rec;
  const pool = rec.interestUserIds.filter((id) => id && id !== rec.ownerUserId);
  const lucky = shuffle(pool).slice(0, LUCKY_COUNT);
  rec.luckyUserIds = lucky;
  rec.rouletteDrawnAt = new Date().toISOString();
  const rows = await readAll();
  const i = rows.findIndex((r) => r.id === rec.id);
  if (i >= 0) {
    rows[i] = rec;
    await writeAll(rows);
  }
  const opener =
    '🎰 Russian roulette — you are one of 7 lucky people sent to help them move on after becoming single again. Be kind.';
  for (const luckyId of lucky) {
    try {
      await createMessage({ fromUserId: luckyId, toUserId: rec.ownerUserId, content: opener });
    } catch (err) {
      console.error('Roulette chat seed error:', err);
    }
  }
  return rec;
}

export function toPublic(rec: SingleAgainRecord, viewerId: string | null): SingleAgainPublic {
  const drawn = Boolean(rec.rouletteDrawnAt);
  return {
    postId: rec.postId,
    city: rec.city || 'their city',
    reason: rec.reason,
    photoUrl: rec.photoUrl,
    interestClosesAt: rec.interestClosesAt,
    interestCount: rec.interestUserIds.length,
    hasEntered: Boolean(viewerId && rec.interestUserIds.includes(viewerId)),
    drawn,
    luckyCount: rec.luckyUserIds.length,
    isOwner: Boolean(viewerId && viewerId === rec.ownerUserId),
    iAmLucky: Boolean(viewerId && rec.luckyUserIds.includes(viewerId)),
    healHold: rec.healHold,
    healNote:
      viewerId && (viewerId === rec.ownerUserId || rec.luckyUserIds.includes(viewerId)) ? rec.healNote : null,
    hoursLeft: hoursLeft(rec.interestClosesAt),
  };
}

export async function createSingleAgainAnnouncement(
  userId: string,
  opts: { reason?: string; reasonPrivate?: boolean }
): Promise<SingleAgainRecord | null> {
  const user = await getUserById(userId);
  if (!user) return null;
  const existing = (await readAll()).find(
    (r) => r.ownerUserId === userId && Date.now() - new Date(r.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000
  );
  if (existing) return existing;

  const reason = opts.reasonPrivate || !String(opts.reason || '').trim()
    ? PRIVATE_REASON
    : String(opts.reason).trim().slice(0, 400);
  const photoUrl = pickBestBodyOrFacePhoto(user);
  const city = (user.city || '').trim() || 'their city';
  const now = new Date();
  const post = await createPost({
    userId,
    type: 'positive',
    contentType: photoUrl ? 'image' : 'text',
    content: photoUrl || `HERE WE GO\nSINGLE AGAIN\nSomeone in ${city}`,
    title: 'HERE WE GO — SINGLE AGAIN',
    tags: ['single-again', city.replace(/\s+/g, '-').toLowerCase()],
  });
  const rec: SingleAgainRecord = {
    id: `sa-${post.id}`,
    postId: post.id,
    ownerUserId: userId,
    city,
    reason,
    photoUrl,
    interestUserIds: [],
    interestClosesAt: new Date(now.getTime() + INTEREST_WINDOW_MS).toISOString(),
    luckyUserIds: [],
    rouletteDrawnAt: null,
    healHold: false,
    healNote: null,
    createdAt: now.toISOString(),
  };
  const rows = await readAll();
  rows.unshift(rec);
  await writeAll(rows);
  return rec;
}

export async function showInterest(postId: string, fromUserId: string): Promise<SingleAgainPublic> {
  const rows = await readAll();
  let rec = rows.find((r) => r.postId === postId);
  if (!rec) throw new Error('This Single Again post was not found.');
  rec = await drawIfDue(rec);
  if (fromUserId === rec.ownerUserId) throw new Error('This is your announcement.');
  if (rec.rouletteDrawnAt) throw new Error('The 24 hours are over — lucky people were already picked.');
  if (rec.interestUserIds.includes(fromUserId)) {
    return toPublic(rec, fromUserId);
  }
  rec.interestUserIds.push(fromUserId);
  const i = rows.findIndex((r) => r.id === rec!.id);
  if (i >= 0) rows[i] = rec;
  await writeAll(rows);
  return toPublic(rec, fromUserId);
}

export async function setHealHold(ownerUserId: string, postId: string, healNote: string): Promise<SingleAgainRecord> {
  const rows = await readAll();
  const rec = rows.find((r) => r.postId === postId && r.ownerUserId === ownerUserId);
  if (!rec) throw new Error('Announcement not found.');
  rec.healHold = true;
  rec.healNote = String(healNote || '').trim().slice(0, 240) || 'I need some time to heal.';
  await writeAll(rows);
  return rec;
}

export async function clearHealHold(ownerUserId: string, postId: string): Promise<SingleAgainRecord> {
  const rows = await readAll();
  const rec = rows.find((r) => r.postId === postId && r.ownerUserId === ownerUserId);
  if (!rec) throw new Error('Announcement not found.');
  rec.healHold = false;
  rec.healNote = null;
  await writeAll(rows);
  return rec;
}

export async function attachToPosts<T extends { id: string; userId?: string; tags?: string[] }>(
  posts: T[],
  viewerId: string | null
): Promise<(T & { singleAgain?: SingleAgainPublic | null })[]> {
  const rows = await readAll();
  const byPost = new Map(rows.map((r) => [r.postId, r]));
  const out = [];
  for (const post of posts) {
    const tagged = (post.tags || []).includes('single-again');
    let rec = tagged ? byPost.get(post.id) || null : byPost.get(post.id) || null;
    if (!rec && !tagged) {
      out.push(post);
      continue;
    }
    if (rec) rec = await drawIfDue(rec);
    if (!rec) {
      out.push(post);
      continue;
    }
    const pub = toPublic(rec, viewerId);
    const isOwner = viewerId === rec.ownerUserId;
    out.push({
      ...post,
      userId: isOwner ? rec.ownerUserId : '',
      user: isOwner
        ? undefined
        : {
            id: '',
            name: `Someone in ${rec.city}`,
            username: '',
            profilePicture: null,
          },
      singleAgain: pub,
    });
  }
  return out;
}

export async function getRouletteBannerForOwner(ownerUserId: string): Promise<SingleAgainRecord | null> {
  await drawAllDue();
  const rows = await readAll();
  const rec = rows.find((r) => r.ownerUserId === ownerUserId && r.rouletteDrawnAt && r.luckyUserIds.length);
  if (!rec) return null;
  return rec;
}
