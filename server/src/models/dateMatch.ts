import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { DATE_IDEAS, LOOKING_FOR_OPTIONS, getIdeaById, type DateIdea } from '../data/dateMatchCatalog.js';
import { getAllUsers, getUserById, unmatchUser } from './user.js';
import { isSseConnected } from '../realtime/notifications.js';
import { userHasFeature } from './premium.js';
import { ensureMatchConversation } from './chat.js';

export const FREE_SEARCHES_PER_MONTH = 3;
export const CANCELLATION_FINE_EUR = 10;
export const GUIDE_LAWYER_CUT_PERCENT = 80;
export const GOLD_PLAN_PRICE_EUR = 114;

export type DateMatchStatus =
  | 'searching'
  | 'pending'
  | 'proposed'
  | 'awaiting_accept'
  | 'picking_idea'
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'declined'
  | 'expired';

export interface PublicUserCard {
  id: string;
  name: string;
  username: string;
  profilePicture: string | null;
  interestLevel: number;
  online: boolean;
  city?: string;
  country?: string;
}

export interface DateMatch {
  id: string;
  userId1: string;
  userId2: string;
  lookingFor: string[];
  status: DateMatchStatus;
  interest1: number;
  interest2: number;
  user1Accepted: boolean;
  user2Accepted: boolean;
  user1FreeSlots: string[];
  user2FreeSlots: string[];
  agreedSlot: string | null;
  ideaId: string | null;
  ideaTitle: string | null;
  ideaDetail: string | null;
  ideaCategory: DateIdea['category'] | null;
  scheduledAt: string | null;
  chatUnlocked: boolean;
  user1Continue: boolean | null;
  user2Continue: boolean | null;
  user1GoingWell: boolean | null;
  user2GoingWell: boolean | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  cancelProofUrl: string | null;
  finePaidTo: string | null;
  fineEur: number;
  createdAt: string;
  updatedAt: string;
}

export interface SearchQueueEntry {
  userId: string;
  lookingFor: string[];
  startedAt: string;
}

export interface UsedIdea {
  userId: string;
  ideaId: string;
  usedAt: string;
}

export interface SearchUsage {
  userId: string;
  monthKey: string;
  count: number;
}

export interface PitchOffer {
  id: string;
  fromUserId: string;
  toUserId: string;
  source: 'reject' | 'direct';
  interestId?: string;
  text: string;
  status: 'awaiting_pitch' | 'pending_review' | 'accepted' | 'rejected';
  createdAt: string;
  respondedAt?: string | null;
}

export interface LawyerMessage {
  id: string;
  fromUserId: string;
  content: string;
  createdAt: string;
}

export interface LawyerSession {
  id: string;
  clientUserId: string;
  targetUserId: string | null;
  guideUserId: string;
  status: 'picking' | 'pitching' | 'accepted' | 'rejected' | 'closed';
  lastMessageUntil: string | null;
  monthKey: string;
  payoutCredited: boolean;
  messages: LawyerMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface DateChatLock {
  locked: boolean;
  unlockAt: string | null;
  matchId: string | null;
  reason: string;
  scheduledAt: string | null;
  ideaTitle: string | null;
}

const DATA_DIR = join(process.cwd(), 'server', 'data');
const MATCHES_PATH = join(DATA_DIR, 'date-matches.json');
const QUEUE_PATH = join(DATA_DIR, 'date-match-queue.json');
const USED_PATH = join(DATA_DIR, 'date-match-used-ideas.json');
const USAGE_PATH = join(DATA_DIR, 'date-match-search-usage.json');
const PITCH_PATH = join(DATA_DIR, 'date-match-pitches.json');
const LAWYER_PATH = join(DATA_DIR, 'date-match-lawyer.json');

function nid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function sameCalendarDay(iso: string | null, now = new Date()): boolean {
  if (!iso) return false;
  const a = new Date(iso);
  return a.getFullYear() === now.getFullYear() && a.getMonth() === now.getMonth() && a.getDate() === now.getDate();
}

function dayReached(iso: string | null, now = new Date()): boolean {
  if (!iso) return false;
  const a = new Date(iso);
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return today >= start;
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2));
}

async function readMatches(): Promise<DateMatch[]> {
  return readJson(MATCHES_PATH, []);
}
async function writeMatches(list: DateMatch[]): Promise<void> {
  await writeJson(MATCHES_PATH, list);
}
async function readQueue(): Promise<SearchQueueEntry[]> {
  return readJson(QUEUE_PATH, []);
}
async function writeQueue(list: SearchQueueEntry[]): Promise<void> {
  await writeJson(QUEUE_PATH, list);
}
async function readUsed(): Promise<UsedIdea[]> {
  return readJson(USED_PATH, []);
}
async function writeUsed(list: UsedIdea[]): Promise<void> {
  await writeJson(USED_PATH, list);
}
async function readUsage(): Promise<SearchUsage[]> {
  return readJson(USAGE_PATH, []);
}
async function writeUsage(list: SearchUsage[]): Promise<void> {
  await writeJson(USAGE_PATH, list);
}
async function readPitches(): Promise<PitchOffer[]> {
  return readJson(PITCH_PATH, []);
}
async function writePitches(list: PitchOffer[]): Promise<void> {
  await writeJson(PITCH_PATH, list);
}
async function readLawyer(): Promise<LawyerSession[]> {
  return readJson(LAWYER_PATH, []);
}
async function writeLawyer(list: LawyerSession[]): Promise<void> {
  await writeJson(LAWYER_PATH, list);
}

export function catalog() {
  return {
    lookingFor: LOOKING_FOR_OPTIONS,
    ideas: DATE_IDEAS,
    hobbyCount: DATE_IDEAS.filter((d) => d.category === 'hobby').length,
    goodDeedCount: DATE_IDEAS.filter((d) => d.category === 'good_deed').length,
    dateCount: DATE_IDEAS.filter((d) => d.category === 'date').length,
    freeSearchesPerMonth: FREE_SEARCHES_PER_MONTH,
    cancellationFineEur: CANCELLATION_FINE_EUR,
  };
}

export async function computeInterestLevel(userId: string): Promise<number> {
  let score = 40;
  try {
    const { getInterestsForUser: act } = await import('./activity.js');
    const a = await act(userId);
    score += Math.min(30, a.received.length * 4);
  } catch {
    /* optional */
  }
  try {
    const { getInterestsForUser: disc } = await import('./discover.js');
    const d = await disc(userId);
    score += Math.min(20, d.received.length * 3);
  } catch {
    /* optional */
  }
  try {
    const { getBuzzesForUser } = await import('./connections.js');
    const buzz = await getBuzzesForUser(userId);
    score += Math.min(20, (buzz || []).length * 2);
  } catch {
    /* optional */
  }
  const matches = await readMatches();
  const done = matches.filter(
    (m) => (m.userId1 === userId || m.userId2 === userId) && (m.status === 'scheduled' || m.status === 'completed')
  );
  score += Math.min(20, done.length * 5);
  return Math.max(10, Math.min(99, Math.round(score)));
}

async function toCard(userId: string): Promise<PublicUserCard | null> {
  const u = await getUserById(userId);
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    profilePicture: u.profilePicture ?? null,
    interestLevel: await computeInterestLevel(userId),
    online: isSseConnected(userId),
    city: u.city,
    country: u.country,
  };
}

function overlapLooking(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return true;
  return a.some((x) => b.includes(x));
}

function otherId(m: DateMatch, userId: string): string {
  return m.userId1 === userId ? m.userId2 : m.userId1;
}

export async function getSearchQuota(userId: string): Promise<{
  used: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
  monthKey: string;
}> {
  const unlimited = await userHasFeature(userId, 'unlimited_searches');
  const key = monthKey();
  const usage = await readUsage();
  const row = usage.find((u) => u.userId === userId && u.monthKey === key);
  const used = row?.count || 0;
  if (unlimited) return { used, limit: null, remaining: null, unlimited: true, monthKey: key };
  return {
    used,
    limit: FREE_SEARCHES_PER_MONTH,
    remaining: Math.max(0, FREE_SEARCHES_PER_MONTH - used),
    unlimited: false,
    monthKey: key,
  };
}

async function bumpSearchUsage(userId: string): Promise<void> {
  const key = monthKey();
  const usage = await readUsage();
  const row = usage.find((u) => u.userId === userId && u.monthKey === key);
  if (row) row.count += 1;
  else usage.push({ userId, monthKey: key, count: 1 });
  await writeUsage(usage);
}

export async function startSearch(
  userId: string,
  lookingFor: string[]
): Promise<{
  quota: Awaited<ReturnType<typeof getSearchQuota>>;
  searching: boolean;
  match: DateMatch | null;
  other: PublicUserCard | null;
  me: PublicUserCard | null;
  needUpgrade?: boolean;
}> {
  const valid = lookingFor.filter((id) => LOOKING_FOR_OPTIONS.some((o) => o.id === id));
  if (valid.length === 0) throw new Error('Pick what you are looking for');

  const quota = await getSearchQuota(userId);
  if (!quota.unlimited && (quota.remaining ?? 0) <= 0) {
    return { quota, searching: false, match: null, other: null, me: await toCard(userId), needUpgrade: true };
  }

  const meUser = await getUserById(userId);
  if (!meUser) throw new Error('User not found');
  const blocked = new Set([...(meUser.blockedUsers || []), ...(meUser.unmatchedUsers || [])]);

  await bumpSearchUsage(userId);

  const queue = (await readQueue()).filter((q) => q.userId !== userId);
  queue.push({ userId, lookingFor: valid, startedAt: new Date().toISOString() });
  await writeQueue(queue);

  const myScore = await computeInterestLevel(userId);
  const candidates = queue.filter((q) => q.userId !== userId && overlapLooking(valid, q.lookingFor));

  const scored: { entry: SearchQueueEntry; score: number; diff: number }[] = [];
  for (const entry of candidates) {
    const other = await getUserById(entry.userId);
    if (!other) continue;
    if (blocked.has(entry.userId) || (other.blockedUsers || []).includes(userId) || (other.unmatchedUsers || []).includes(userId)) continue;
    if (other.relationshipStatus === 'In a relationship') continue;
    const existing = (await readMatches()).find(
      (m) =>
        ((m.userId1 === userId && m.userId2 === entry.userId) || (m.userId1 === entry.userId && m.userId2 === userId)) &&
        ['searching', 'pending', 'proposed', 'awaiting_accept', 'picking_idea', 'scheduled'].includes(m.status)
    );
    if (existing) continue;
    const score = await computeInterestLevel(entry.userId);
    scored.push({ entry, score, diff: Math.abs(score - myScore) });
  }

  scored.sort((a, b) => a.diff - b.diff);
  let pick = scored[0];
  if (scored.length > 1 && Math.random() < 0.28) {
    const higher = scored.filter((s) => s.score > myScore);
    if (higher.length) pick = higher[0];
  }

  if (!pick) {
    return { quota: await getSearchQuota(userId), searching: true, match: null, other: null, me: await toCard(userId) };
  }

  const bothOnline = isSseConnected(userId) && isSseConnected(pick.entry.userId);
  const now = new Date().toISOString();
  const match: DateMatch = {
    id: nid(),
    userId1: userId,
    userId2: pick.entry.userId,
    lookingFor: valid,
    status: bothOnline ? 'awaiting_accept' : 'pending',
    interest1: myScore,
    interest2: pick.score,
    user1Accepted: false,
    user2Accepted: false,
    user1FreeSlots: [],
    user2FreeSlots: [],
    agreedSlot: null,
    ideaId: null,
    ideaTitle: null,
    ideaDetail: null,
    ideaCategory: null,
    scheduledAt: null,
    chatUnlocked: false,
    user1Continue: null,
    user2Continue: null,
    user1GoingWell: null,
    user2GoingWell: null,
    cancelledBy: null,
    cancelReason: null,
    cancelProofUrl: null,
    finePaidTo: null,
    fineEur: 0,
    createdAt: now,
    updatedAt: now,
  };
  const matches = await readMatches();
  matches.push(match);
  await writeMatches(matches);

  const nextQueue = (await readQueue()).filter((q) => q.userId !== userId && q.userId !== pick.entry.userId);
  await writeQueue(nextQueue);

  return {
    quota: await getSearchQuota(userId),
    searching: false,
    match,
    other: await toCard(pick.entry.userId),
    me: await toCard(userId),
  };
}

export async function cancelSearch(userId: string): Promise<void> {
  const queue = (await readQueue()).filter((q) => q.userId !== userId);
  await writeQueue(queue);
}

export async function pollSearch(userId: string): Promise<{
  searching: boolean;
  match: DateMatch | null;
  other: PublicUserCard | null;
  me: PublicUserCard | null;
}> {
  const matches = await readMatches();
  const open = matches
    .filter(
      (m) =>
        (m.userId1 === userId || m.userId2 === userId) &&
        ['pending', 'proposed', 'awaiting_accept', 'picking_idea', 'scheduled'].includes(m.status)
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  if (open) {
    if (open.status === 'pending') {
      const oid = otherId(open, userId);
      if (isSseConnected(userId) && isSseConnected(oid)) {
        open.status = 'awaiting_accept';
        open.updatedAt = new Date().toISOString();
        await writeMatches(matches);
      }
    }
    return {
      searching: false,
      match: open,
      other: await toCard(otherId(open, userId)),
      me: await toCard(userId),
    };
  }

  const inQueue = (await readQueue()).some((q) => q.userId === userId);
  return { searching: inQueue, match: null, other: null, me: await toCard(userId) };
}

export async function setAvailability(userId: string, matchId: string, slots: string[]): Promise<DateMatch> {
  const matches = await readMatches();
  const m = matches.find((x) => x.id === matchId);
  if (!m || (m.userId1 !== userId && m.userId2 !== userId)) throw new Error('Match not found');
  const clean = slots.map((s) => String(s).slice(0, 40)).filter(Boolean).slice(0, 8);
  if (m.userId1 === userId) m.user1FreeSlots = clean;
  else m.user2FreeSlots = clean;
  const shared = m.user1FreeSlots.filter((s) => m.user2FreeSlots.includes(s));
  m.agreedSlot = shared[0] || null;
  m.updatedAt = new Date().toISOString();
  await writeMatches(matches);
  return m;
}

export async function respondMatch(userId: string, matchId: string, accept: boolean): Promise<DateMatch> {
  const matches = await readMatches();
  const m = matches.find((x) => x.id === matchId);
  if (!m || (m.userId1 !== userId && m.userId2 !== userId)) throw new Error('Match not found');
  if (!['pending', 'awaiting_accept', 'proposed'].includes(m.status)) throw new Error('This match is no longer waiting');

  if (!accept) {
    m.status = 'declined';
    m.updatedAt = new Date().toISOString();
    await writeMatches(matches);
    return m;
  }

  if (m.userId1 === userId) m.user1Accepted = true;
  else m.user2Accepted = true;
  m.updatedAt = new Date().toISOString();

  if (m.user1Accepted && m.user2Accepted) {
    m.status = 'picking_idea';
  }
  await writeMatches(matches);
  return m;
}

function unusedIdeasForPair(used: UsedIdea[], userId1: string, userId2: string): DateIdea[] {
  const usedIds = new Set(
    used.filter((u) => u.userId === userId1 || u.userId === userId2).map((u) => u.ideaId)
  );
  const pool = DATE_IDEAS.filter((d) => !usedIds.has(d.id));
  return pool.length ? pool : DATE_IDEAS;
}

export async function spinDateIdea(userId: string, matchId: string): Promise<DateMatch> {
  const matches = await readMatches();
  const m = matches.find((x) => x.id === matchId);
  if (!m || (m.userId1 !== userId && m.userId2 !== userId)) throw new Error('Match not found');
  if (m.status !== 'picking_idea' && m.status !== 'scheduled') throw new Error('Accept the match first');
  if (m.ideaId) return m;

  const used = await readUsed();
  const pool = unusedIdeasForPair(used, m.userId1, m.userId2);
  const idea = pool[Math.floor(Math.random() * pool.length)];
  m.ideaId = idea.id;
  m.ideaTitle = idea.title;
  m.ideaDetail = idea.detail;
  m.ideaCategory = idea.category;
  m.status = 'scheduled';
  const slot = m.agreedSlot || m.user1FreeSlots[0] || m.user2FreeSlots[0];
  const when = slot ? new Date(slot) : new Date(Date.now() + 48 * 60 * 60 * 1000);
  if (Number.isNaN(when.getTime())) {
    m.scheduledAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  } else {
    m.scheduledAt = when.toISOString();
  }
  m.updatedAt = new Date().toISOString();
  used.push({ userId: m.userId1, ideaId: idea.id, usedAt: m.updatedAt });
  used.push({ userId: m.userId2, ideaId: idea.id, usedAt: m.updatedAt });
  await writeUsed(used);
  await writeMatches(matches);

  const dateLabel = new Date(m.scheduledAt).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  await ensureMatchConversation(
    m.userId1,
    m.userId2,
    `Date Arena: you're set up for “${idea.title}” on ${dateLabel}. Chat unlocks that day — show up.`
  );
  return m;
}

export async function getDateChatLock(userId: string, otherUserId: string): Promise<DateChatLock> {
  const matches = await readMatches();
  const m = matches
    .filter(
      (x) =>
        ((x.userId1 === userId && x.userId2 === otherUserId) || (x.userId1 === otherUserId && x.userId2 === userId)) &&
        (x.status === 'scheduled' || x.status === 'completed')
    )
    .sort((a, b) => (b.scheduledAt || '').localeCompare(a.scheduledAt || ''))[0];

  if (!m) return { locked: false, unlockAt: null, matchId: null, reason: '', scheduledAt: null, ideaTitle: null };

  if (m.status === 'completed') {
    const c1 = m.userId1 === userId ? m.user1Continue : m.user2Continue;
    const c2 = m.userId1 === userId ? m.user2Continue : m.user1Continue;
    if (c1 === false || c2 === false) {
      return {
        locked: true,
        unlockAt: null,
        matchId: m.id,
        reason: 'This date chat ended because one of you did not want to keep talking.',
        scheduledAt: m.scheduledAt,
        ideaTitle: m.ideaTitle,
      };
    }
    return { locked: false, unlockAt: null, matchId: m.id, reason: '', scheduledAt: m.scheduledAt, ideaTitle: m.ideaTitle };
  }

  if (m.scheduledAt && dayReached(m.scheduledAt)) {
    return { locked: false, unlockAt: m.scheduledAt, matchId: m.id, reason: '', scheduledAt: m.scheduledAt, ideaTitle: m.ideaTitle };
  }

  const unlock = m.scheduledAt;
  const label = unlock
    ? new Date(unlock).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    : 'the date day';
  return {
    locked: true,
    unlockAt: unlock,
    matchId: m.id,
    reason: `Chat unlocks on ${label}. Show up to the date — backing out without a valid reason is a €${CANCELLATION_FINE_EUR} fine.`,
    scheduledAt: m.scheduledAt,
    ideaTitle: m.ideaTitle,
  };
}

export async function cancelScheduledDate(
  userId: string,
  matchId: string,
  reason: string,
  proofUrl?: string
): Promise<DateMatch> {
  const matches = await readMatches();
  const m = matches.find((x) => x.id === matchId);
  if (!m || (m.userId1 !== userId && m.userId2 !== userId)) throw new Error('Match not found');
  if (m.status !== 'scheduled' && m.status !== 'picking_idea') throw new Error('Nothing to cancel');

  const excused = Boolean(proofUrl) && /sick|ill|emergenc|hospital|doctor|family/i.test(reason || '');
  m.status = 'cancelled';
  m.cancelledBy = userId;
  m.cancelReason = (reason || '').slice(0, 500);
  m.cancelProofUrl = proofUrl || null;
  m.updatedAt = new Date().toISOString();

  const other = otherId(m, userId);
  if (!excused) {
    m.fineEur = CANCELLATION_FINE_EUR;
    m.finePaidTo = other;
    const { creditUserBalance } = await import('./guideWallet.js');
    await creditUserBalance({
      userId: other,
      amountEur: CANCELLATION_FINE_EUR,
      type: 'date_fine',
      note: `No-show / cancellation fine from a Date Arena match`,
    });
  }

  await writeMatches(matches);
  await unmatchUser(userId, other);
  await unmatchUser(other, userId);
  return m;
}

export async function reportHowItsGoing(
  userId: string,
  matchId: string,
  goingWell: boolean,
  wantContinue: boolean
): Promise<{ match: DateMatch; recommendGuide: boolean; continueTalking: boolean | null; removed: boolean }> {
  const matches = await readMatches();
  const m = matches.find((x) => x.id === matchId);
  if (!m || (m.userId1 !== userId && m.userId2 !== userId)) throw new Error('Match not found');
  if (m.status !== 'scheduled' && m.status !== 'completed') throw new Error('Date is not ready to review');
  if (m.scheduledAt && !dayReached(m.scheduledAt)) throw new Error('You can review after the date day');

  if (m.userId1 === userId) {
    m.user1GoingWell = goingWell;
    m.user1Continue = wantContinue;
  } else {
    m.user2GoingWell = goingWell;
    m.user2Continue = wantContinue;
  }
  m.status = 'completed';
  m.updatedAt = new Date().toISOString();

  let removed = false;
  let continueTalking: boolean | null = null;
  if (m.user1Continue !== null && m.user2Continue !== null) {
    continueTalking = m.user1Continue && m.user2Continue;
    if (!continueTalking) {
      await unmatchUser(m.userId1, m.userId2);
      await unmatchUser(m.userId2, m.userId1);
      removed = true;
    } else {
      m.chatUnlocked = true;
    }
  }
  await writeMatches(matches);

  const mineGoing = m.userId1 === userId ? m.user1GoingWell : m.user2GoingWell;
  return { match: m, recommendGuide: mineGoing === false, continueTalking, removed };
}

export async function listMyMatches(userId: string): Promise<{
  active: Array<{ match: DateMatch; other: PublicUserCard | null }>;
  pending: Array<{ match: DateMatch; other: PublicUserCard | null }>;
  past: Array<{ match: DateMatch; other: PublicUserCard | null }>;
}> {
  const matches = await readMatches();
  const mine = matches.filter((m) => m.userId1 === userId || m.userId2 === userId);
  const wrap = async (m: DateMatch) => ({ match: m, other: await toCard(otherId(m, userId)) });
  const active = await Promise.all(
    mine.filter((m) => ['awaiting_accept', 'picking_idea', 'scheduled'].includes(m.status)).map(wrap)
  );
  const pending = await Promise.all(mine.filter((m) => m.status === 'pending').map(wrap));
  const past = await Promise.all(
    mine.filter((m) => ['completed', 'cancelled', 'declined'].includes(m.status)).slice(-20).map(wrap)
  );
  return { active, pending, past };
}

export async function createPitchOffer(params: {
  fromUserId: string;
  toUserId: string;
  source: 'reject' | 'direct';
  interestId?: string;
}): Promise<PitchOffer> {
  if (params.source === 'direct') {
    const ok = await userHasFeature(params.fromUserId, 'direct_pitch');
    if (!ok) throw new Error('Direct pitch is a Platinum feature');
  } else {
    const ok = await userHasFeature(params.fromUserId, 'pitch_on_reject');
    if (!ok) throw new Error('Pitch after a decline is a Plus feature');
  }
  const pitches = await readPitches();
  const existing = pitches.find(
    (p) =>
      p.fromUserId === params.fromUserId &&
      p.toUserId === params.toUserId &&
      (p.status === 'awaiting_pitch' || p.status === 'pending_review')
  );
  if (existing) return existing;
  const offer: PitchOffer = {
    id: nid(),
    fromUserId: params.fromUserId,
    toUserId: params.toUserId,
    source: params.source,
    interestId: params.interestId,
    text: '',
    status: 'awaiting_pitch',
    createdAt: new Date().toISOString(),
  };
  pitches.push(offer);
  await writePitches(pitches);
  return offer;
}

export async function submitPitchText(userId: string, pitchId: string, text: string): Promise<PitchOffer> {
  const pitches = await readPitches();
  const p = pitches.find((x) => x.id === pitchId);
  if (!p || p.fromUserId !== userId) throw new Error('Pitch not found');
  const body = text.trim().slice(0, 800);
  if (body.length < 12) throw new Error('Write a real pitch (at least a couple of sentences)');
  p.text = body;
  p.status = 'pending_review';
  await writePitches(pitches);
  return p;
}

export async function respondPitch(userId: string, pitchId: string, accept: boolean): Promise<PitchOffer> {
  const pitches = await readPitches();
  const p = pitches.find((x) => x.id === pitchId);
  if (!p || p.toUserId !== userId) throw new Error('Pitch not found');
  if (p.status !== 'pending_review') throw new Error('This pitch is already handled');
  p.status = accept ? 'accepted' : 'rejected';
  p.respondedAt = new Date().toISOString();
  await writePitches(pitches);
  if (accept) {
    await ensureMatchConversation(p.fromUserId, p.toUserId, `${(await getUserById(p.fromUserId))?.name || 'Someone'} pitched and you said yes. Say hi.`);
  }
  return p;
}

export async function pitchesForUser(userId: string): Promise<{
  toWrite: Array<PitchOffer & { other: PublicUserCard | null }>;
  incoming: Array<PitchOffer & { other: PublicUserCard | null }>;
}> {
  const pitches = await readPitches();
  const toWrite = await Promise.all(
    pitches
      .filter((p) => p.fromUserId === userId && p.status === 'awaiting_pitch')
      .map(async (p) => ({ ...p, other: await toCard(p.toUserId) }))
  );
  const incoming = await Promise.all(
    pitches
      .filter((p) => p.toUserId === userId && p.status === 'pending_review')
      .map(async (p) => ({ ...p, other: await toCard(p.fromUserId) }))
  );
  return { toWrite, incoming };
}

export async function summonLawyer(
  clientUserId: string,
  guideUserId: string
): Promise<LawyerSession> {
  const ok = await userHasFeature(clientUserId, 'guide_lawyer');
  if (!ok) throw new Error('Guide hand-pick is a Gold feature');
  const { getGuideByUserId } = await import('./improvement.js');
  const guide = await getGuideByUserId(guideUserId);
  if (!guide?.isActive) throw new Error('That guide is not available');

  const sessions = await readLawyer();
  const open = sessions.find(
    (s) =>
      s.clientUserId === clientUserId &&
      s.guideUserId === guideUserId &&
      (s.status === 'picking' || s.status === 'pitching' || (s.status === 'rejected' && s.lastMessageUntil && new Date(s.lastMessageUntil) > new Date()))
  );
  if (open) return open;

  const session: LawyerSession = {
    id: nid(),
    clientUserId,
    targetUserId: null,
    guideUserId,
    status: 'picking',
    lastMessageUntil: null,
    monthKey: monthKey(),
    payoutCredited: false,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  sessions.push(session);
  await writeLawyer(sessions);
  return session;
}

export async function lawyerPickTarget(guideUserId: string, sessionId: string, targetUserId: string): Promise<LawyerSession> {
  const sessions = await readLawyer();
  const s = sessions.find((x) => x.id === sessionId);
  if (!s || s.guideUserId !== guideUserId) throw new Error('Session not found');
  if (s.status !== 'picking') throw new Error('Already picked');
  if (!targetUserId || targetUserId === s.clientUserId || targetUserId === guideUserId) throw new Error('Pick someone else');
  s.targetUserId = targetUserId;
  s.status = 'pitching';
  s.updatedAt = new Date().toISOString();
  await writeLawyer(sessions);
  return s;
}

export async function lawyerMessage(userId: string, sessionId: string, content: string): Promise<LawyerSession> {
  const sessions = await readLawyer();
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error('Session not found');
  const allowed = [s.clientUserId, s.guideUserId, s.targetUserId].filter(Boolean) as string[];
  if (!allowed.includes(userId)) throw new Error('Not in this room');
  if (s.status === 'picking') throw new Error('Wait for the guide to pick someone');
  if (s.status === 'closed' || s.status === 'accepted') throw new Error('This room is closed');
  if (s.status === 'rejected') {
    if (!s.lastMessageUntil || new Date(s.lastMessageUntil) < new Date()) throw new Error('Last messages window closed');
  }
  const text = content.trim().slice(0, 1000);
  if (!text) throw new Error('Write something');
  s.messages.push({ id: nid(), fromUserId: userId, content: text, createdAt: new Date().toISOString() });
  s.updatedAt = new Date().toISOString();
  await writeLawyer(sessions);
  return s;
}

export async function respondLawyer(targetUserId: string, sessionId: string, accept: boolean): Promise<LawyerSession> {
  const sessions = await readLawyer();
  const s = sessions.find((x) => x.id === sessionId);
  if (!s || s.targetUserId !== targetUserId) throw new Error('Session not found');
  if (s.status !== 'pitching') throw new Error('Already decided');
  s.updatedAt = new Date().toISOString();
  if (accept) {
    s.status = 'accepted';
    if (!s.targetUserId) throw new Error('No date picked yet');
    await ensureMatchConversation(
      s.clientUserId,
      s.targetUserId,
      'A guide pitched this date and you both agreed. You are in Communications now.'
    );
  } else {
    s.status = 'rejected';
    s.lastMessageUntil = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  }
  await writeLawyer(sessions);
  return s;
}

export async function closeExpiredLawyerRooms(): Promise<void> {
  const sessions = await readLawyer();
  let changed = false;
  const now = Date.now();
  for (const s of sessions) {
    if (s.status === 'rejected' && s.lastMessageUntil && new Date(s.lastMessageUntil).getTime() < now) {
      s.status = 'closed';
      s.updatedAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) await writeLawyer(sessions);
}

export async function lawyerSessionsFor(userId: string): Promise<
  Array<LawyerSession & { client: PublicUserCard | null; target: PublicUserCard | null; guide: PublicUserCard | null }>
> {
  await closeExpiredLawyerRooms();
  const sessions = await readLawyer();
  const mine = sessions.filter(
    (s) =>
      (s.clientUserId === userId || s.targetUserId === userId || s.guideUserId === userId) &&
      (s.status === 'picking' || s.status === 'pitching' || (s.status === 'rejected' && s.lastMessageUntil && new Date(s.lastMessageUntil) > new Date()))
  );
  return Promise.all(
    mine.map(async (s) => ({
      ...s,
      client: await toCard(s.clientUserId),
      target: s.targetUserId ? await toCard(s.targetUserId) : null,
      guide: await toCard(s.guideUserId),
    }))
  );
}

export async function settleGuideLawyerCuts(): Promise<number> {
  const sessions = await readLawyer();
  const now = new Date();
  const thisMonth = monthKey(now);
  const { creditUserBalance } = await import('./guideWallet.js');
  let credited = 0;
  const byGuideMonth = new Map<string, LawyerSession[]>();
  for (const s of sessions) {
    if (s.payoutCredited) continue;
    if (s.monthKey >= thisMonth) continue;
    if (s.status === 'pitching' || s.status === 'picking') continue;
    const key = `${s.guideUserId}:${s.monthKey}`;
    const list = byGuideMonth.get(key) || [];
    list.push(s);
    byGuideMonth.set(key, list);
  }
  for (const [, list] of byGuideMonth) {
    const clients = new Set(list.map((s) => s.clientUserId));
    const cut = Math.round(GOLD_PLAN_PRICE_EUR * (GUIDE_LAWYER_CUT_PERCENT / 100) * clients.size * 100) / 100;
    const guideUserId = list[0].guideUserId;
    await creditUserBalance({
      userId: guideUserId,
      amountEur: cut,
      type: 'lawyer_cut',
      note: `Date Arena lawyer cut for ${list[0].monthKey} (${clients.size} Gold client${clients.size === 1 ? '' : 's'})`,
    });
    for (const s of list) s.payoutCredited = true;
    credited += cut;
  }
  await writeLawyer(sessions);
  return credited;
}

export async function canSearchOtherCountries(userId: string): Promise<boolean> {
  return userHasFeature(userId, 'unlimited_countries');
}

export async function assertCountrySearchAllowed(userId: string, requestedCountry: string): Promise<void> {
  const unlimited = await canSearchOtherCountries(userId);
  if (unlimited) return;
  const me = await getUserById(userId);
  const mine = (me?.country || '').trim().toLowerCase();
  const want = (requestedCountry || '').trim().toLowerCase();
  if (!want) return;
  if (mine && want && mine !== want) {
    const err: Error & { code?: string } = new Error(
      'Searching other countries is a Plus feature. Upgrade in Settings → Premium.'
    );
    err.code = 'PLUS_REQUIRED';
    throw err;
  }
}

export async function lawyerPickCandidates(guideUserId: string, clientUserId: string): Promise<PublicUserCard[]> {
  const me = await getUserById(clientUserId);
  if (!me) return [];
  const blocked = new Set([...(me.blockedUsers || []), ...(me.unmatchedUsers || []), clientUserId, guideUserId]);
  const users = await getAllUsers();
  const out: PublicUserCard[] = [];
  for (const u of users) {
    if (blocked.has(u.id)) continue;
    if ((u.blockedUsers || []).includes(clientUserId)) continue;
    if (u.relationshipStatus === 'In a relationship') continue;
    const card = await toCard(u.id);
    if (card) out.push(card);
    if (out.length >= 40) break;
  }
  return out;
}
export async function directPitchCandidates(userId: string): Promise<PublicUserCard[]> {
  const ok = await userHasFeature(userId, 'direct_pitch');
  if (!ok) throw new Error('Direct pitch is a Platinum feature');
  const me = await getUserById(userId);
  if (!me) return [];
  const blocked = new Set([...(me.blockedUsers || []), ...(me.unmatchedUsers || [])]);
  const users = await getAllUsers();
  const out: PublicUserCard[] = [];
  for (const u of users) {
    if (u.id === userId || blocked.has(u.id)) continue;
    if ((u.blockedUsers || []).includes(userId)) continue;
    if (u.relationshipStatus === 'In a relationship') continue;
    const card = await toCard(u.id);
    if (card) out.push(card);
    if (out.length >= 40) break;
  }
  return out;
}

export async function maybeOfferPitchOnReject(fromUserId: string, toUserId: string, interestId?: string): Promise<PitchOffer | null> {
  const ok = await userHasFeature(fromUserId, 'pitch_on_reject');
  if (!ok) return null;
  return createPitchOffer({ fromUserId, toUserId, source: 'reject', interestId });
}

export { sameCalendarDay, LOOKING_FOR_OPTIONS, DATE_IDEAS };
