import { readFile } from 'fs/promises';
import { join } from 'path';
import { ensureMatchConversation } from '../models/chat.js';
import { getUserAverageRatings } from '../models/ratings.js';
import { getAllUsers, getUserById } from '../models/user.js';
import { haversineKm, resolveUserCoords } from '../data/dateMatchLocalize.js';
import { writeJsonFile } from '../utils/writeJsonFile.js';
import {
  DEFAULT_DISTANCE_KM,
  EJECT_GRACE_MS,
  FREE_ROUNDS,
  MATCH_OPENER,
  MAX_DISTANCE_KM,
  MIN_DISTANCE_KM,
  PACK_PRICE_EUR,
  PACK_ROUNDS,
  REJECTION_LIMIT,
  REJECTION_WINDOW_MS,
  WINGMAN_MS,
} from './constants.js';
import { nextPrompt } from './icebreakers.js';
import {
  agesAlign,
  datingSide,
  isRarelyRejected,
  isTopTierAccount,
  isWorkingOnSelf,
  pairAllowed,
} from './matchMatrix.js';
import { polishFuture, polishQuality } from './polish.js';
import type { BattleState, BattleView, CoachStep, PersonCard, ProfileInput, Prompt, SpotlightCard } from './types.js';

const DB_PATH = join(process.cwd(), 'server', 'data', 'dating-battles.json');

export const COACH_STEPS: CoachStep[] = [
  {
    id: 'see',
    title: 'The pattern',
    body: 'Three battles ended in a rejection inside half an hour. That is a vibe problem, not a verdict on you. The next screens make the profile specific enough to earn the five minutes.',
  },
  {
    id: 'quality',
    title: 'Rewrite the quality you lead with',
    body: 'Vague warmth gets skipped. Name one concrete trait someone could catch in a minute.',
    field: 'quality',
  },
  {
    id: 'plans',
    title: 'Make the future plan specific',
    body: 'A plan needs a verb and a cadence. "Starting a channel" becomes "one video a week while I learn the edit."',
    field: 'plans',
  },
  {
    id: 'opener',
    title: 'Pick the opener you will actually use',
    body: 'Choose one. It stays on your next battle until you change it.',
    field: 'opener',
    options: [
      'Ask one follow-up before you talk about yourself.',
      'Name their plan and ask what the hard part is.',
      'Admit one unflattering truth in the first minute.',
    ],
  },
];

export const COACH_TIPS = [
  'Say the quality you just wrote in the first 30 seconds. Out loud.',
  'Future plans need a verb and a cadence: weekly, this month, the next job.',
  'Use the opener you picked before you pitch yourself.',
  'If you are still building, say that. Grounded honesty beats a borrowed highlight reel.',
  'One real story beats three adjectives.',
];

const OPENER_SET = new Set(COACH_STEPS.find((step) => step.field === 'opener')?.options || []);

interface StoredProfile extends ProfileInput {
  userId: string;
  updatedAt: string;
}

interface Wallet {
  userId: string;
  freeRemaining: number;
  paidRemaining: number;
  roundsStarted: number;
  roundsJoined: number;
  rejectionCount: number;
  rejections: Array<{ at: string; battleId: string }>;
  coachLocked: boolean;
  coachClearedAt: string | null;
  coachCompletedAt: string | null;
  coachOpener: string | null;
  seenPromptIds: string[];
  recentPartnerIds: string[];
  paymentIds: string[];
}

interface StoredBattle {
  id: string;
  user1Id: string;
  user2Id: string;
  startedAt: string;
  status: 'live' | 'matched' | 'ejected';
  user1Confirmed: boolean;
  user2Confirmed: boolean;
  ejectedBy: string | null;
  ejectReason: string | null;
  resolvedAt: string | null;
  currentPrompt: Prompt;
  prompts: Prompt[];
}

interface QueuedLive {
  userId: string;
  joinedAt: string;
}

interface Db {
  profiles: StoredProfile[];
  wallets: Wallet[];
  battles: StoredBattle[];
  queue: QueuedLive[];
}

type PublicUser = Awaited<ReturnType<typeof getAllUsers>>[number];

export class BattleError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.body = { error: message, ...extra };
  }
}

let chain: Promise<unknown> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function clip(value: unknown, max: number): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function clampDistance(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_DISTANCE_KM;
  return Math.min(MAX_DISTANCE_KM, Math.max(MIN_DISTANCE_KM, Math.round(n)));
}

function nid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function defaultProfile(userId: string): StoredProfile {
  return {
    userId,
    searchText: '',
    maxDistanceKm: DEFAULT_DISTANCE_KM,
    bestQuality: '',
    futurePlans: '',
    workingOnSelf: false,
    updatedAt: new Date().toISOString(),
  };
}

function defaultWallet(userId: string): Wallet {
  return {
    userId,
    freeRemaining: FREE_ROUNDS,
    paidRemaining: 0,
    roundsStarted: 0,
    roundsJoined: 0,
    rejectionCount: 0,
    rejections: [],
    coachLocked: false,
    coachClearedAt: null,
    coachCompletedAt: null,
    coachOpener: null,
    seenPromptIds: [],
    recentPartnerIds: [],
    paymentIds: [],
  };
}

function peekWallet(db: Db, userId: string): Wallet {
  return db.wallets.find((wallet) => wallet.userId === userId) || defaultWallet(userId);
}

function ensureWallet(db: Db, userId: string): Wallet {
  const found = db.wallets.find((wallet) => wallet.userId === userId);
  if (found) return found;
  const created = defaultWallet(userId);
  db.wallets.push(created);
  return created;
}

function ensureProfile(db: Db, userId: string): StoredProfile {
  const found = db.profiles.find((profile) => profile.userId === userId);
  if (found) return found;
  const created = defaultProfile(userId);
  db.profiles.push(created);
  return created;
}

async function readDb(): Promise<Db> {
  try {
    const raw = await readFile(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<Db>;
    return {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      wallets: Array.isArray(parsed.wallets) ? parsed.wallets : [],
      battles: Array.isArray(parsed.battles) ? parsed.battles : [],
      queue: Array.isArray(parsed.queue) ? parsed.queue : [],
    };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { profiles: [], wallets: [], battles: [], queue: [] };
    throw err;
  }
}

function prune(db: Db) {
  const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
  db.battles = db.battles.filter((battle) => {
    if (battle.status === 'live') return true;
    const at = new Date(battle.resolvedAt || battle.startedAt).getTime();
    return at > cutoff;
  });
}

async function writeDb(db: Db): Promise<void> {
  prune(db);
  await writeJsonFile(DB_PATH, db);
}

function liveFor(db: Db, userId: string): StoredBattle | null {
  return db.battles.find(
    (battle) => battle.status === 'live' && (battle.user1Id === userId || battle.user2Id === userId)
  ) || null;
}

function latestFor(db: Db, userId: string): StoredBattle | null {
  const mine = db.battles.filter((battle) => battle.user1Id === userId || battle.user2Id === userId);
  mine.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  return mine[0] || null;
}

function viewerBlock(user: PublicUser): BattleState['blocked'] {
  const age = Number(user.age);
  if (!Number.isFinite(age) || age <= 0) {
    return { code: 'need_age', message: 'Add your age on your profile so the match matrix can run.' };
  }
  if (age < 18) {
    return { code: 'underage', message: 'Dating battles are for adults 18 and over.' };
  }
  if (!datingSide(user.gender)) {
    return {
      code: 'need_gender',
      message: 'Set your gender to Male or Female so the age matrix knows which pool to open.',
    };
  }
  return null;
}

function rejectionsInWindow(wallet: Wallet): number {
  const cleared = wallet.coachClearedAt ? new Date(wallet.coachClearedAt).getTime() : 0;
  const floor = Math.max(Date.now() - REJECTION_WINDOW_MS, cleared);
  return wallet.rejections.filter((item) => new Date(item.at).getTime() >= floor).length;
}

function rememberPrompt(wallet: Wallet, id: string) {
  if (!wallet.seenPromptIds.includes(id)) wallet.seenPromptIds.push(id);
  if (wallet.seenPromptIds.length > 8000) {
    wallet.seenPromptIds.splice(0, wallet.seenPromptIds.length - 6000);
  }
}

function pushRecent(wallet: Wallet, partnerId: string) {
  wallet.recentPartnerIds = [partnerId, ...wallet.recentPartnerIds.filter((id) => id !== partnerId)].slice(0, 12);
}

function recordRejection(wallet: Wallet, battleId: string) {
  wallet.rejectionCount += 1;
  wallet.rejections.push({ at: new Date().toISOString(), battleId });
  if (wallet.rejections.length > 40) wallet.rejections.splice(0, wallet.rejections.length - 40);
  if (rejectionsInWindow(wallet) >= REJECTION_LIMIT) wallet.coachLocked = true;
}

async function markMatched(battle: StoredBattle): Promise<void> {
  if (battle.status !== 'live') return;
  await ensureMatchConversation(battle.user1Id, battle.user2Id, MATCH_OPENER);
  battle.status = 'matched';
  battle.resolvedAt = new Date().toISOString();
}

async function settle(db: Db): Promise<boolean> {
  let changed = false;
  const now = Date.now();
  for (const battle of db.battles) {
    if (battle.status !== 'live') continue;
    const elapsed = now - new Date(battle.startedAt).getTime();
    if (elapsed >= WINGMAN_MS + EJECT_GRACE_MS) {
      await markMatched(battle);
      changed = true;
    }
  }
  return changed;
}

function blockedPair(a: PublicUser, b: PublicUser): boolean {
  const aBlocked = a.blockedUsers || [];
  const bBlocked = b.blockedUsers || [];
  const aUn = a.unmatchedUsers || [];
  const bUn = b.unmatchedUsers || [];
  return aBlocked.includes(b.id) || bBlocked.includes(a.id) || aUn.includes(b.id) || bUn.includes(a.id);
}

function distanceBetween(a: PublicUser, b: PublicUser): number | null {
  const left = resolveUserCoords(a);
  const right = resolveUserCoords(b);
  if (!left || !right) return null;
  return haversineKm(left.lat, left.lon, right.lat, right.lon);
}

function matchesSearch(query: string, user: PublicUser, profile: StoredProfile): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    user.name,
    user.username,
    user.bio,
    user.occupation,
    user.city,
    user.education,
    ...(user.interests || []),
    profile.bestQuality,
    profile.futurePlans,
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}

function sourceQuality(user: PublicUser, profile: StoredProfile): string {
  return profile.bestQuality || user.occupation || user.bio || '';
}

function sourcePlans(user: PublicUser, profile: StoredProfile): string {
  return profile.futurePlans || user.lifeQuizGoals || user.occupation || '';
}

function buildCard(user: PublicUser, profile: StoredProfile, distanceKm: number | null): PersonCard {
  const bestQuality = sourceQuality(user, profile);
  const futurePlans = sourcePlans(user, profile);
  const age = Number(user.age);
  return {
    id: user.id,
    name: user.name || user.username || 'Someone',
    username: user.username || '',
    age: Number.isFinite(age) && age > 0 ? age : null,
    profilePicture: user.profilePicture || null,
    city: user.city || null,
    distanceKm: distanceKm == null ? null : Math.round(distanceKm * 10) / 10,
    bestQuality: bestQuality || 'Not written yet',
    futurePlans: futurePlans || 'Not written yet',
    polishedQuality: polishQuality(bestQuality),
    polishedFuture: polishFuture(futurePlans),
    workingOnSelf: isWorkingOnSelf(profile),
  };
}

async function loadRating(userId: string): Promise<{ overall: number; attractiveness: number; total: number }> {
  const avg = await getUserAverageRatings(userId);
  return {
    overall: avg.overallRating,
    attractiveness: avg.characteristics.attractiveness,
    total: avg.totalRatings,
  };
}

interface Allocation {
  user: PublicUser | null;
  note: string | null;
  emptyReason: string | null;
}

const QUEUE_TTL_MS = 30 * 60 * 1000;

/** Drops people who left the app. An open client refreshes its place while it polls. */
function pruneQueue(db: Db): boolean {
  const floor = Date.now() - QUEUE_TTL_MS;
  const next = db.queue.filter((entry) => new Date(entry.joinedAt).getTime() > floor);
  const changed = next.length !== db.queue.length;
  db.queue = next;
  return changed;
}

function dropQueued(db: Db, ...ids: string[]) {
  const gone = new Set(ids);
  db.queue = db.queue.filter((entry) => !gone.has(entry.userId));
}

async function allocate(db: Db, viewer: PublicUser, restrictTo?: Set<string>): Promise<Allocation> {
  const side = datingSide(viewer.gender);
  const age = Number(viewer.age);
  if (!side || !Number.isFinite(age)) {
    return { user: null, note: null, emptyReason: 'Profile is missing age or gender.' };
  }
  const profile = db.profiles.find((item) => item.userId === viewer.id) || defaultProfile(viewer.id);
  const wallet = peekWallet(db, viewer.id);
  const viewerWorking = side === 'male' && isWorkingOnSelf(profile);
  const users = await getAllUsers();
  const busy = new Set<string>();
  for (const battle of db.battles) {
    if (battle.status !== 'live') continue;
    busy.add(battle.user1Id);
    busy.add(battle.user2Id);
  }

  const viewerRating = side === 'female' ? await loadRating(viewer.id) : null;
  const viewerTop = viewerRating
    ? isTopTierAccount(viewerRating.overall, viewerRating.attractiveness, viewerRating.total)
    : false;
  const viewerRare =
    side === 'female' ? isRarelyRejected(wallet.roundsJoined, wallet.rejectionCount) : false;
  const ratingCache = new Map<string, { overall: number; attractiveness: number; total: number }>();

  let ageHits = 0;
  let poolHits = 0;
  const candidates: Array<{ user: PublicUser; score: number; distance: number | null }> = [];

  for (const candidate of users) {
    if (candidate.id === viewer.id || busy.has(candidate.id)) continue;
    if (restrictTo && !restrictTo.has(candidate.id)) continue;
    if (candidate.suspensionUntil && new Date(candidate.suspensionUntil).getTime() > Date.now()) continue;
    const otherSide = datingSide(candidate.gender);
    if (otherSide !== (side === 'male' ? 'female' : 'male')) continue;
    const otherAge = Number(candidate.age);
    if (!Number.isFinite(otherAge) || otherAge < 18) continue;
    if (blockedPair(viewer, candidate)) continue;
    const boyAge = side === 'male' ? age : otherAge;
    const girlAge = side === 'male' ? otherAge : age;
    if (!agesAlign(boyAge, girlAge)) continue;
    ageHits += 1;
    const candidateProfile = db.profiles.find((item) => item.userId === candidate.id) || defaultProfile(candidate.id);
    if (!matchesSearch(profile.searchText, candidate, candidateProfile)) continue;
    const distance = distanceBetween(viewer, candidate);
    if (distance != null && distance > profile.maxDistanceKm) continue;
    poolHits += 1;

    const boyUser = side === 'male' ? viewer : candidate;
    const girlUser = side === 'female' ? viewer : candidate;
    const boyProfile = db.profiles.find((item) => item.userId === boyUser.id) || defaultProfile(boyUser.id);
    const girlProfile = db.profiles.find((item) => item.userId === girlUser.id) || defaultProfile(girlUser.id);
    const boyWorking = isWorkingOnSelf(boyProfile);
    let girlTop = viewerTop;
    let girlRare = viewerRare;
    if (side === 'male') {
      let rated = ratingCache.get(candidate.id);
      if (!rated) {
        rated = await loadRating(candidate.id);
        ratingCache.set(candidate.id, rated);
      }
      girlTop = isTopTierAccount(rated.overall, rated.attractiveness, rated.total);
      const girlWallet = peekWallet(db, girlUser.id);
      girlRare = isRarelyRejected(girlWallet.roundsJoined, girlWallet.rejectionCount);
    }
    if (!pairAllowed({
      boyAge,
      girlAge,
      boyWorkingOnSelf: boyWorking,
      girlTopTier: girlTop,
      girlRarelyRejected: girlRare,
    })) continue;

    let score = 0;
    if (distance != null) score += Math.max(0, 30 - distance);
    const mine = new Set((viewer.interests || []).map((item) => String(item).toLowerCase()));
    for (const interest of candidate.interests || []) {
      if (mine.has(String(interest).toLowerCase())) score += 4;
    }
    const plans = sourcePlans(candidate, candidateProfile);
    if (profile.searchText && plans.toLowerCase().includes(profile.searchText.trim().toLowerCase())) score += 6;
    if (viewerWorking && !isWorkingOnSelf(girlProfile)) score += 2;
    candidates.push({ user: candidate, score, distance });
  }

  if (!candidates.length) {
    const lifeStageNote = side === 'female' && (viewerTop || viewerRare)
      ? 'Your profile rarely gets rejected, so people who are still working on themselves stay out of this round.'
      : 'The people in range are top-tier or rarely rejected. This chapter is paired with grounded profiles, and none are free right now.';
    const emptyReason = ageHits === 0
      ? 'Nobody in your age band is available right now.'
      : poolHits === 0
        ? 'Nobody in your age band is inside this distance and search. Widen the radius or clear the search.'
        : lifeStageNote;
    return { user: null, note: null, emptyReason };
  }

  candidates.sort((a, b) => b.score - a.score || a.user.id.localeCompare(b.user.id));
  const fresh = candidates.find((item) => !wallet.recentPartnerIds.includes(item.user.id));
  const pick = fresh || candidates[0];
  const note = viewerWorking
    ? 'You are still building. This match is a grounded profile — not a 10 who rarely gets told no.'
    : null;
  return { user: pick.user, note, emptyReason: null };
}

function phaseOf(battle: StoredBattle, now = Date.now()): BattleView['phase'] {
  if (battle.status === 'matched') return 'matched';
  if (battle.status === 'ejected') return 'ejected';
  const elapsed = now - new Date(battle.startedAt).getTime();
  if (elapsed < WINGMAN_MS) return 'wingman';
  return 'ejection';
}

async function toView(db: Db, battle: StoredBattle, userId: string): Promise<BattleView> {
  const users = await getAllUsers();
  const byId = new Map(users.map((user) => [user.id, user]));
  const partnerId = battle.user1Id === userId ? battle.user2Id : battle.user1Id;
  const meUser = byId.get(userId);
  const partnerUser = byId.get(partnerId);
  const fallback = (id: string): PersonCard => ({
    id,
    name: 'Unavailable',
    username: '',
    age: null,
    profilePicture: null,
    city: null,
    distanceKm: null,
    bestQuality: 'Not written yet',
    futurePlans: 'Not written yet',
    polishedQuality: polishQuality(''),
    polishedFuture: polishFuture(''),
    workingOnSelf: false,
  });
  if (!meUser || !partnerUser) {
    const now = new Date();
    const started = new Date(battle.startedAt).getTime();
    const isUser1 = battle.user1Id === userId;
    return {
      id: battle.id,
      status: battle.status,
      phase: phaseOf(battle, now.getTime()),
      startedAt: battle.startedAt,
      wingmanEndsAt: new Date(started + WINGMAN_MS).toISOString(),
      ejectEndsAt: new Date(started + WINGMAN_MS + EJECT_GRACE_MS).toISOString(),
      serverNow: now.toISOString(),
      prompt: battle.currentPrompt,
      me: meUser ? buildCard(meUser, db.profiles.find((item) => item.userId === meUser.id) || defaultProfile(meUser.id), null) : fallback(userId),
      partner: partnerUser
        ? buildCard(partnerUser, db.profiles.find((item) => item.userId === partnerUser.id) || defaultProfile(partnerUser.id), null)
        : fallback(partnerId),
      myConfirmed: isUser1 ? battle.user1Confirmed : battle.user2Confirmed,
      partnerConfirmed: isUser1 ? battle.user2Confirmed : battle.user1Confirmed,
      ejectedByMe: battle.ejectedBy === userId,
      youWereRejected: battle.status === 'ejected' && battle.ejectedBy !== userId,
      ejectReason: battle.ejectReason,
      matchedUserId: battle.status === 'matched' ? partnerId : null,
    };
  }
  const now = new Date();
  const started = new Date(battle.startedAt).getTime();
  const isUser1 = battle.user1Id === userId;
  return {
    id: battle.id,
    status: battle.status,
    phase: phaseOf(battle, now.getTime()),
    startedAt: battle.startedAt,
    wingmanEndsAt: new Date(started + WINGMAN_MS).toISOString(),
    ejectEndsAt: new Date(started + WINGMAN_MS + EJECT_GRACE_MS).toISOString(),
    serverNow: now.toISOString(),
    prompt: battle.currentPrompt,
    me: buildCard(meUser, db.profiles.find((item) => item.userId === meUser.id) || defaultProfile(meUser.id), null),
    partner: buildCard(
      partnerUser,
      db.profiles.find((item) => item.userId === partnerUser.id) || defaultProfile(partnerUser.id),
      distanceBetween(meUser, partnerUser)
    ),
    myConfirmed: isUser1 ? battle.user1Confirmed : battle.user2Confirmed,
    partnerConfirmed: isUser1 ? battle.user2Confirmed : battle.user1Confirmed,
    ejectedByMe: battle.ejectedBy === userId,
    youWereRejected: battle.status === 'ejected' && battle.ejectedBy !== userId,
    ejectReason: battle.ejectReason,
    matchedUserId: battle.status === 'matched' ? partnerId : null,
  };
}

async function buildState(db: Db, userId: string, withPreview: boolean): Promise<BattleState> {
  const viewer = await getUserById(userId);
  if (!viewer) throw new BattleError(401, 'Unauthorized');
  const publicViewer = viewer as PublicUser;
  const stored = db.profiles.find((item) => item.userId === userId) || defaultProfile(userId);
  const wallet = peekWallet(db, userId);
  const blocked = viewerBlock(publicViewer);
  const profile: ProfileInput = {
    searchText: stored.searchText,
    maxDistanceKm: stored.maxDistanceKm,
    bestQuality: stored.bestQuality,
    futurePlans: stored.futurePlans,
    workingOnSelf: stored.workingOnSelf,
  };
  const base: BattleState = {
    profile,
    triesLeft: wallet.freeRemaining + wallet.paidRemaining,
    freeRemaining: wallet.freeRemaining,
    paidRemaining: wallet.paidRemaining,
    priceEur: PACK_PRICE_EUR,
    packRounds: PACK_ROUNDS,
    coachLocked: wallet.coachLocked,
    coach: wallet.coachLocked
      ? { steps: COACH_STEPS, rejectionsInWindow: rejectionsInWindow(wallet) }
      : null,
    tips: wallet.coachCompletedAt ? COACH_TIPS : null,
    coachOpener: wallet.coachOpener,
    battle: null,
    outcome: null,
    preview: null,
    allocationNote: null,
    blocked,
    emptyReason: null,
    searching: false,
  };
  if (blocked?.code === 'underage') return base;
  const battle = liveFor(db, userId);
  if (battle) {
    base.battle = await toView(db, battle, userId);
    return base;
  }
  const latest = latestFor(db, userId);
  if (latest && latest.status !== 'live') {
    const at = new Date(latest.resolvedAt || latest.startedAt).getTime();
    if (Date.now() - at < 2 * 60 * 1000) {
      base.outcome = await toView(db, latest, userId);
    }
  }
  const queued = db.queue.some((entry) => entry.userId === userId);
  if (queued) {
    base.searching = true;
    base.emptyReason = null;
  }
  if (!withPreview || blocked || wallet.coachLocked) return base;
  const allocation = await allocate(db, publicViewer);
  base.allocationNote = allocation.note;
  base.emptyReason = allocation.emptyReason;
  if (allocation.user) {
    const theirs = db.profiles.find((item) => item.userId === allocation.user!.id) || defaultProfile(allocation.user.id);
    base.preview = buildCard(allocation.user, theirs, distanceBetween(publicViewer, allocation.user));
  }
  if (base.searching) base.emptyReason = null;
  return base;
}

function requireBattle(db: Db, userId: string, battleId: string): StoredBattle {
  const battle = db.battles.find((item) => item.id === battleId);
  if (!battle || (battle.user1Id !== userId && battle.user2Id !== userId)) {
    throw new BattleError(404, 'Battle not found.');
  }
  return battle;
}

export async function getBattleState(userId: string): Promise<BattleState> {
  return withLock(async () => {
    const db = await readDb();
    let changed = await settle(db);
    if (pruneQueue(db)) changed = true;
    const queued = db.queue.find((entry) => entry.userId === userId);
    if (queued && !liveFor(db, userId)) {
      if (Date.now() - new Date(queued.joinedAt).getTime() > 60_000) {
        queued.joinedAt = new Date().toISOString();
        changed = true;
      }
      const viewer = await getUserById(userId);
      if (viewer && await openQueuedBattle(db, userId, viewer as PublicUser)) changed = true;
    }
    if (liveFor(db, userId) && db.queue.some((entry) => entry.userId === userId)) {
      dropQueued(db, userId);
      changed = true;
    }
    if (changed) await writeDb(db);
    const battle = liveFor(db, userId);
    return buildState(db, userId, !battle);
  });
}

export async function saveBattleProfile(userId: string, input: Partial<ProfileInput>): Promise<BattleState> {
  return withLock(async () => {
    const db = await readDb();
    await settle(db);
    const viewer = await getUserById(userId);
    if (!viewer) throw new BattleError(401, 'Unauthorized');
    const profile = ensureProfile(db, userId);
    if (input.searchText !== undefined) profile.searchText = clip(input.searchText, 80);
    if (input.maxDistanceKm !== undefined) profile.maxDistanceKm = clampDistance(input.maxDistanceKm);
    if (input.bestQuality !== undefined) profile.bestQuality = clip(input.bestQuality, 120);
    if (input.futurePlans !== undefined) profile.futurePlans = clip(input.futurePlans, 160);
    if (input.workingOnSelf !== undefined) profile.workingOnSelf = Boolean(input.workingOnSelf);
    profile.updatedAt = new Date().toISOString();
    await writeDb(db);
    return buildState(db, userId, !liveFor(db, userId));
  });
}

async function openQueuedBattle(db: Db, userId: string, viewer: PublicUser): Promise<boolean> {
  const waiting = new Set(
    db.queue.filter((entry) => entry.userId !== userId).map((entry) => entry.userId)
  );
  if (!waiting.size) return false;
  const allocation = await allocate(db, viewer, waiting);
  if (!allocation.user) return false;
  const wallet = ensureWallet(db, userId);
  const partnerWallet = ensureWallet(db, allocation.user.id);
  wallet.roundsJoined += 1;
  partnerWallet.roundsJoined += 1;
  pushRecent(wallet, allocation.user.id);
  pushRecent(partnerWallet, userId);
  const seen = new Set([...wallet.seenPromptIds, ...partnerWallet.seenPromptIds]);
  const prompt = nextPrompt(seen);
  rememberPrompt(wallet, prompt.id);
  rememberPrompt(partnerWallet, prompt.id);
  db.battles.push({
    id: nid(),
    user1Id: userId,
    user2Id: allocation.user.id,
    startedAt: new Date().toISOString(),
    status: 'live',
    user1Confirmed: false,
    user2Confirmed: false,
    ejectedBy: null,
    ejectReason: null,
    resolvedAt: null,
    currentPrompt: prompt,
    prompts: [prompt],
  });
  dropQueued(db, userId, allocation.user.id);
  return true;
}

export async function startBattle(userId: string): Promise<BattleState> {
  return withLock(async () => {
    const db = await readDb();
    await settle(db);
    pruneQueue(db);
    if (liveFor(db, userId)) {
      dropQueued(db, userId);
      await writeDb(db);
      return buildState(db, userId, false);
    }
    const viewer = await getUserById(userId);
    if (!viewer) throw new BattleError(401, 'Unauthorized');
    // Open pool: follower count, photo verification, and account age are not gates.
    const blocked = viewerBlock(viewer as PublicUser);
    if (blocked) throw new BattleError(403, blocked.message, { blocked });
    const wallet = ensureWallet(db, userId);
    if (wallet.coachLocked) {
      throw new BattleError(423, 'Too many rejections. Finish the dating coach first.', { coachLocked: true });
    }
    const alreadyQueued = db.queue.some((entry) => entry.userId === userId);
    if (!alreadyQueued) {
      const triesLeft = wallet.freeRemaining + wallet.paidRemaining;
      if (triesLeft <= 0) {
        throw new BattleError(402, 'Free rounds are used up.', {
          paywall: true,
          priceEur: PACK_PRICE_EUR,
          triesLeft: 0,
        });
      }
      if (wallet.freeRemaining > 0) wallet.freeRemaining -= 1;
      else wallet.paidRemaining -= 1;
      wallet.roundsStarted += 1;
      db.queue.push({ userId, joinedAt: new Date().toISOString() });
    }
    await openQueuedBattle(db, userId, viewer as PublicUser);
    await writeDb(db);
    return buildState(db, userId, !liveFor(db, userId));
  });
}

export async function confirmBattle(userId: string, battleId: string): Promise<BattleState> {
  return withLock(async () => {
    const db = await readDb();
    await settle(db);
    const battle = requireBattle(db, userId, battleId);
    if (battle.status === 'live') {
      if (battle.user1Id === userId) battle.user1Confirmed = true;
      else battle.user2Confirmed = true;
      if (battle.user1Confirmed && battle.user2Confirmed) await markMatched(battle);
    }
    await writeDb(db);
    return buildState(db, userId, !liveFor(db, userId));
  });
}

export async function ejectBattle(userId: string, battleId: string, reason: string): Promise<BattleState> {
  return withLock(async () => {
    const db = await readDb();
    await settle(db);
    const battle = requireBattle(db, userId, battleId);
    const cleanReason = clip(reason, 280);
    if (cleanReason.length < 2) throw new BattleError(400, 'A rejection reason is required.');
    if (battle.status === 'live') {
      const elapsed = Date.now() - new Date(battle.startedAt).getTime();
      if (elapsed < WINGMAN_MS) {
        throw new BattleError(400, 'Eject opens when the 5 minutes are up.');
      }
      battle.status = 'ejected';
      battle.ejectedBy = userId;
      battle.ejectReason = cleanReason;
      battle.resolvedAt = new Date().toISOString();
      const otherId = battle.user1Id === userId ? battle.user2Id : battle.user1Id;
      recordRejection(ensureWallet(db, otherId), battle.id);
    }
    await writeDb(db);
    return buildState(db, userId, true);
  });
}

export async function advancePrompt(userId: string, battleId: string): Promise<BattleState> {
  return withLock(async () => {
    const db = await readDb();
    await settle(db);
    const battle = requireBattle(db, userId, battleId);
    if (battle.status === 'live') {
      const w1 = ensureWallet(db, battle.user1Id);
      const w2 = ensureWallet(db, battle.user2Id);
      const seen = new Set([
        ...w1.seenPromptIds,
        ...w2.seenPromptIds,
        ...battle.prompts.map((item) => item.id),
      ]);
      const prompt = nextPrompt(seen);
      rememberPrompt(w1, prompt.id);
      rememberPrompt(w2, prompt.id);
      battle.currentPrompt = prompt;
      battle.prompts.push(prompt);
    }
    await writeDb(db);
    return buildState(db, userId, false);
  });
}

export async function resolveBattle(userId: string, battleId: string): Promise<BattleState> {
  return withLock(async () => {
    const db = await readDb();
    const battle = requireBattle(db, userId, battleId);
    if (battle.status === 'live') {
      const elapsed = Date.now() - new Date(battle.startedAt).getTime();
      if (elapsed >= WINGMAN_MS + EJECT_GRACE_MS) await markMatched(battle);
    }
    await writeDb(db);
    return buildState(db, userId, !liveFor(db, userId));
  });
}

export async function completeCoach(
  userId: string,
  input: { quality?: string; plans?: string; opener?: string }
): Promise<BattleState> {
  return withLock(async () => {
    const db = await readDb();
    await settle(db);
    const wallet = ensureWallet(db, userId);
    const quality = clip(input.quality, 120);
    const plans = clip(input.plans, 160);
    const opener = clip(input.opener, 160);
    if (quality.length < 8) throw new BattleError(400, 'Write a specific best quality (at least 8 characters).');
    if (plans.length < 8) throw new BattleError(400, 'Write a specific future plan (at least 8 characters).');
    if (!OPENER_SET.has(opener)) throw new BattleError(400, 'Pick one of the openers.');
    const profile = ensureProfile(db, userId);
    profile.bestQuality = quality;
    profile.futurePlans = plans;
    profile.updatedAt = new Date().toISOString();
    wallet.coachOpener = opener;
    wallet.coachLocked = false;
    wallet.coachClearedAt = new Date().toISOString();
    wallet.coachCompletedAt = wallet.coachClearedAt;
    await writeDb(db);
    return buildState(db, userId, !liveFor(db, userId));
  });
}

export async function grantDatingBattlePack(
  userId: string,
  paymentId: string
): Promise<{ triesLeft: number; freeRemaining: number; paidRemaining: number; alreadyCredited: boolean }> {
  const id = clip(paymentId, 200);
  if (!id) throw new BattleError(400, 'paymentId is required.');
  return withLock(async () => {
    const db = await readDb();
    const wallet = ensureWallet(db, userId);
    if (wallet.paymentIds.includes(id)) {
      return {
        triesLeft: wallet.freeRemaining + wallet.paidRemaining,
        freeRemaining: wallet.freeRemaining,
        paidRemaining: wallet.paidRemaining,
        alreadyCredited: true,
      };
    }
    wallet.paymentIds.push(id);
    wallet.paidRemaining += PACK_ROUNDS;
    await writeDb(db);
    return {
      triesLeft: wallet.freeRemaining + wallet.paidRemaining,
      freeRemaining: wallet.freeRemaining,
      paidRemaining: wallet.paidRemaining,
      alreadyCredited: false,
    };
  });
}

export async function spotlightCards(userIds: string[]): Promise<SpotlightCard[]> {
  const ids = [...new Set(userIds.map((id) => String(id || '').trim()).filter(Boolean))].slice(0, 30);
  if (!ids.length) return [];
  return withLock(async () => {
    const db = await readDb();
    const users = await getAllUsers();
    const byId = new Map(users.map((user) => [user.id, user]));
    const cards: SpotlightCard[] = [];
    for (const id of ids) {
      const user = byId.get(id);
      if (!user) continue;
      const profile = db.profiles.find((item) => item.userId === id) || defaultProfile(id);
      const card = buildCard(user, profile, null);
      cards.push({
        userId: id,
        bestQuality: card.bestQuality,
        futurePlans: card.futurePlans,
        polishedQuality: card.polishedQuality,
        polishedFuture: card.polishedFuture,
      });
    }
    return cards;
  });
}
