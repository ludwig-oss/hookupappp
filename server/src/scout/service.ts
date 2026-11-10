import { readFile } from 'fs/promises';
import { join } from 'path';
import { ensureMatchConversation } from '../models/chat.js';
import { setChatIntent } from '../models/chatIntents.js';
import { getAllUsers, getUserById } from '../models/user.js';
import { writeJsonFile } from '../utils/writeJsonFile.js';
import { experienceScore, listSizeForExperience, profileQuality, qualityFloor, scoutCycle } from './algorithm.js';
import { CONTRACT_TEXT, buddyTips, mediate, overlapWindows, trendingEvents } from './planner.js';
import { professionById, searchProfessions } from './professions.js';
import type {
  ExpenseEntry,
  GoalEntry,
  HousePlan,
  InterestView,
  MediationEntry,
  PartnershipView,
  PlannedEvent,
  ScoutCard,
  ScoutMode,
  ScoutState,
  Settlement,
  TimeWindow,
} from './types.js';

const DB_PATH = join(process.cwd(), 'server', 'data', 'scout.json');

interface ScoutProfile {
  userId: string;
  professionId: string;
  professionLabel: string;
  years: number;
  judgment: number;
  verifiedAt: string;
  availability: TimeWindow[];
  board: ScoutCard[];
}

interface Interest {
  id: string;
  fromUserId: string;
  toUserId: string;
  mode: ScoutMode;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

interface SpeedDate {
  user1Joined: boolean;
  user2Joined: boolean;
  user1BlueAt: string | null;
  user2BlueAt: string | null;
}

interface Partnership {
  id: string;
  user1Id: string;
  user2Id: string;
  mode: ScoutMode;
  status: 'talking' | 'awaiting_contract' | 'speed_date' | 'active' | 'ended';
  contractText: string | null;
  user1SignedAt: string | null;
  user2SignedAt: string | null;
  speedDate: SpeedDate | null;
  goals: GoalEntry[];
  expenses: ExpenseEntry[];
  house: HousePlan | null;
  mediation: MediationEntry[];
  settlement: Settlement | null;
  createdAt: string;
}

interface Db {
  profiles: ScoutProfile[];
  interests: Interest[];
  partnerships: Partnership[];
}

type PublicUser = Awaited<ReturnType<typeof getAllUsers>>[number];

export class ScoutError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let chain: Promise<unknown> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(() => undefined, () => undefined);
  return run;
}

function nid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function clip(value: unknown, max: number): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function emptyDb(): Db {
  return { profiles: [], interests: [], partnerships: [] };
}

async function readDb(): Promise<Db> {
  try {
    const parsed = JSON.parse(await readFile(DB_PATH, 'utf-8')) as Partial<Db>;
    return {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      interests: Array.isArray(parsed.interests) ? parsed.interests : [],
      partnerships: Array.isArray(parsed.partnerships) ? parsed.partnerships : [],
    };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return emptyDb();
    throw err;
  }
}

async function writeDb(db: Db): Promise<void> {
  await writeJsonFile(DB_PATH, db);
}

function profileOf(db: Db, userId: string): ScoutProfile | null {
  return db.profiles.find((item) => item.userId === userId) || null;
}

function requireProfile(db: Db, userId: string): ScoutProfile {
  const profile = profileOf(db, userId);
  if (!profile) throw new ScoutError(403, 'Verify a profession before scouting.');
  return profile;
}

function pairOf(partnership: Partnership, userId: string): { mine: boolean; partnerId: string } {
  const mine = partnership.user1Id === userId;
  return { mine, partnerId: mine ? partnership.user2Id : partnership.user1Id };
}

function trackedCents(partnership: Partnership): number {
  const spent = partnership.expenses.reduce((sum, entry) => sum + entry.amountCents, 0);
  const house = partnership.house;
  const housePaid = house ? house.downCents + house.monthlyCents * house.iterationsPaid : 0;
  return spent + housePaid;
}

function blocked(viewer: PublicUser, other: PublicUser): boolean {
  const mine = viewer.blockedUsers || [];
  const theirs = other.blockedUsers || [];
  return mine.includes(other.id) || theirs.includes(viewer.id);
}

async function people(): Promise<Map<string, PublicUser>> {
  const users = await getAllUsers();
  return new Map(users.map((user) => [user.id, user]));
}

function cardFor(user: PublicUser, profile: ScoutProfile): ScoutCard {
  return {
    userId: user.id,
    name: user.name || user.username || 'Scout',
    username: user.username || '',
    professionId: profile.professionId,
    professionLabel: profile.professionLabel,
    city: user.city || null,
    years: profile.years,
    quality: profileQuality(profile.years, Boolean(user.bio), Boolean(user.city)),
    experienceScore: experienceScore(profile.years),
  };
}

function personName(user: PublicUser | undefined, id: string): { id: string; name: string; username: string } {
  return {
    id,
    name: user?.name || user?.username || 'Scout',
    username: user?.username || '',
  };
}

function toPartnership(db: Db, partnership: Partnership, userId: string, users: Map<string, PublicUser>): PartnershipView {
  const { mine, partnerId } = pairOf(partnership, userId);
  const partnerProfile = profileOf(db, partnerId);
  const mineProfile = profileOf(db, userId);
  const speed = partnership.speedDate;
  const tracked = trackedCents(partnership);
  return {
    id: partnership.id,
    mode: partnership.mode,
    status: partnership.status,
    partner: {
      ...personName(users.get(partnerId), partnerId),
      professionLabel: partnerProfile?.professionLabel || 'Profession',
    },
    contractText: partnership.contractText,
    iSigned: Boolean(mine ? partnership.user1SignedAt : partnership.user2SignedAt),
    theySigned: Boolean(mine ? partnership.user2SignedAt : partnership.user1SignedAt),
    speedDate: speed
      ? {
          iJoined: mine ? speed.user1Joined : speed.user2Joined,
          theyJoined: mine ? speed.user2Joined : speed.user1Joined,
          iConfirmed: Boolean(mine ? speed.user1BlueAt : speed.user2BlueAt),
          theyConfirmed: Boolean(mine ? speed.user2BlueAt : speed.user1BlueAt),
          live: speed.user1Joined && speed.user2Joined,
        }
      : null,
    slots: overlapWindows(mineProfile?.availability || [], partnerProfile?.availability || []),
    events: partnership.mode === 'building' ? trendingEvents(mineProfile?.professionLabel || '') : [],
    tips: partnership.mode === 'building' ? buddyTips(mineProfile?.professionLabel || '') : [],
    goals: partnership.goals,
    expenses: partnership.expenses,
    house: partnership.house,
    trackedCents: tracked,
    eachShareCents: Math.floor(tracked / 2),
    mediation: partnership.mediation,
    settlement: partnership.settlement,
  };
}

async function buildState(db: Db, userId: string): Promise<ScoutState> {
  const profile = profileOf(db, userId);
  const users = await people();
  const experience = experienceScore(profile?.years || 0);
  const judgment = profile?.judgment ?? 50;
  const incoming: InterestView[] = db.interests
    .filter((item) => item.toUserId === userId && item.status === 'pending')
    .map((item) => ({
      id: item.id,
      mode: item.mode,
      from: {
        ...personName(users.get(item.fromUserId), item.fromUserId),
        professionLabel: profileOf(db, item.fromUserId)?.professionLabel || 'Profession',
      },
      createdAt: item.createdAt,
    }));
  const partnerships = db.partnerships
    .filter((item) => item.user1Id === userId || item.user2Id === userId)
    .map((item) => toPartnership(db, item, userId, users));
  return {
    onboarded: Boolean(profile),
    professionId: profile?.professionId || null,
    professionLabel: profile?.professionLabel || null,
    years: profile?.years || 0,
    judgment,
    experienceScore: experience,
    listSize: listSizeForExperience(experience),
    qualityFloor: qualityFloor(judgment),
    board: profile?.board || [],
    incoming,
    partnerships,
  };
}

function requirePartnership(db: Db, userId: string, id: string): Partnership {
  const found = db.partnerships.find((item) => item.id === id && (item.user1Id === userId || item.user2Id === userId));
  if (!found) throw new ScoutError(404, 'Partnership not found.');
  return found;
}

async function unlockFriends(a: string, b: string, mode: ScoutMode): Promise<void> {
  const opener = mode === 'building'
    ? 'Scout accepted a Building partnership. Chat is open. Sign the pre-agreement before the live session.'
    : 'Scout accepted. You are in Friends — say hello.';
  await ensureMatchConversation(a, b, opener);
  await setChatIntent(a, b, 'friends');
  await setChatIntent(b, a, 'friends');
}

export function findProfessions(query: string) {
  return searchProfessions(query);
}

export async function getScoutState(userId: string): Promise<ScoutState> {
  return withLock(async () => buildState(await readDb(), userId));
}

export async function saveScoutProfile(
  userId: string,
  input: { professionId?: string; years?: number; judgment?: number }
): Promise<ScoutState> {
  return withLock(async () => {
    const profession = professionById(String(input.professionId || ''));
    if (!profession) throw new ScoutError(400, 'Pick a profession from the list.');
    const years = Math.max(0, Math.min(60, Math.round(Number(input.years) || 0)));
    const judgment = Math.max(0, Math.min(100, Math.round(Number(input.judgment) || 50)));
    const db = await readDb();
    const existing = profileOf(db, userId);
    const next: ScoutProfile = {
      userId,
      professionId: profession.id,
      professionLabel: profession.label,
      years,
      judgment,
      verifiedAt: existing?.verifiedAt || new Date().toISOString(),
      availability: existing?.availability || [],
      board: existing?.board || [],
    };
    if (existing) Object.assign(existing, next);
    else db.profiles.push(next);
    await writeDb(db);
    return buildState(db, userId);
  });
}

export async function runCycle(userId: string, professionId?: string): Promise<ScoutState> {
  return withLock(async () => {
    const db = await readDb();
    const mine = requireProfile(db, userId);
    const filter = professionId ? professionById(professionId) : null;
    if (professionId && !filter) throw new ScoutError(400, 'Unknown profession filter.');
    const viewer = await getUserById(userId);
    if (!viewer) throw new ScoutError(401, 'Unauthorized');
    const users = await getAllUsers();
    const taken = new Set(
      db.partnerships
        .filter((item) => item.status !== 'ended' && (item.user1Id === userId || item.user2Id === userId))
        .map((item) => (item.user1Id === userId ? item.user2Id : item.user1Id))
    );
    const pending = new Set(
      db.interests
        .filter((item) => item.status === 'pending' && (item.fromUserId === userId || item.toUserId === userId))
        .map((item) => (item.fromUserId === userId ? item.toUserId : item.fromUserId))
    );
    const rejected = new Set(
      db.interests
        .filter((item) => item.status === 'rejected' && item.toUserId === userId)
        .map((item) => item.fromUserId)
    );
    const candidates = users.flatMap((user) => {
      if (user.id === userId || taken.has(user.id) || pending.has(user.id) || rejected.has(user.id)) return [];
      if (blocked(viewer, user)) return [];
      const profile = profileOf(db, user.id);
      if (!profile) return [];
      if (filter && profile.professionId !== filter.id) return [];
      const quality = profileQuality(profile.years, Boolean(user.bio), Boolean(user.city));
      return [{ item: cardFor(user, profile), quality }];
    });
    mine.board = scoutCycle(candidates, experienceScore(mine.years), mine.judgment);
    await writeDb(db);
    return buildState(db, userId);
  });
}

export async function showInterest(userId: string, targetUserId: string, mode: ScoutMode): Promise<ScoutState> {
  return withLock(async () => {
    if (!targetUserId || targetUserId === userId) throw new ScoutError(400, 'Pick someone else.');
    if (mode !== 'talk' && mode !== 'building') throw new ScoutError(400, 'Mode must be talk or building.');
    const db = await readDb();
    requireProfile(db, userId);
    if (!profileOf(db, targetUserId)) throw new ScoutError(404, 'That scout is not verified.');
    const duplicate = db.interests.some((item) =>
      item.status === 'pending' &&
      ((item.fromUserId === userId && item.toUserId === targetUserId) ||
        (item.fromUserId === targetUserId && item.toUserId === userId))
    );
    if (duplicate) throw new ScoutError(409, 'An interest is already waiting.');
    db.interests.push({
      id: nid(),
      fromUserId: userId,
      toUserId: targetUserId,
      mode,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    const mine = requireProfile(db, userId);
    mine.board = mine.board.filter((card) => card.userId !== targetUserId);
    await writeDb(db);
    return buildState(db, userId);
  });
}

export async function acceptInterest(userId: string, interestId: string): Promise<ScoutState> {
  return withLock(async () => {
    const db = await readDb();
    const interest = db.interests.find((item) => item.id === interestId && item.toUserId === userId && item.status === 'pending');
    if (!interest) throw new ScoutError(404, 'Interest not found.');
    interest.status = 'accepted';
    const partnership: Partnership = {
      id: nid(),
      user1Id: interest.fromUserId,
      user2Id: userId,
      mode: interest.mode,
      status: interest.mode === 'building' ? 'awaiting_contract' : 'talking',
      contractText: interest.mode === 'building' ? CONTRACT_TEXT : null,
      user1SignedAt: null,
      user2SignedAt: null,
      speedDate: null,
      goals: [],
      expenses: [],
      house: null,
      mediation: [],
      settlement: null,
      createdAt: new Date().toISOString(),
    };
    db.partnerships.push(partnership);
    await writeDb(db);
    await unlockFriends(interest.fromUserId, userId, interest.mode);
    return buildState(db, userId);
  });
}

export async function rejectInterest(userId: string, interestId: string): Promise<ScoutState> {
  return withLock(async () => {
    const db = await readDb();
    const interest = db.interests.find((item) => item.id === interestId && item.toUserId === userId && item.status === 'pending');
    if (!interest) throw new ScoutError(404, 'Interest not found.');
    interest.status = 'rejected';
    await writeDb(db);
    return buildState(db, userId);
  });
}

export async function signContract(userId: string, partnershipId: string): Promise<ScoutState> {
  return withLock(async () => {
    const db = await readDb();
    const partnership = requirePartnership(db, userId, partnershipId);
    if (partnership.mode !== 'building') throw new ScoutError(400, 'Just Talk does not use a contract.');
    if (partnership.status === 'ended') throw new ScoutError(400, 'This partnership has ended.');
    const now = new Date().toISOString();
    if (partnership.user1Id === userId) partnership.user1SignedAt = partnership.user1SignedAt || now;
    else partnership.user2SignedAt = partnership.user2SignedAt || now;
    if (partnership.user1SignedAt && partnership.user2SignedAt && partnership.status === 'awaiting_contract') {
      partnership.status = 'speed_date';
      partnership.speedDate = { user1Joined: false, user2Joined: false, user1BlueAt: null, user2BlueAt: null };
    }
    await writeDb(db);
    return buildState(db, userId);
  });
}

export async function joinSpeedDate(userId: string, partnershipId: string): Promise<ScoutState> {
  return withLock(async () => {
    const db = await readDb();
    const partnership = requirePartnership(db, userId, partnershipId);
    if (partnership.status !== 'speed_date' || !partnership.speedDate) {
      throw new ScoutError(400, 'Sign the pre-agreement before Speed Date Live.');
    }
    if (partnership.user1Id === userId) partnership.speedDate.user1Joined = true;
    else partnership.speedDate.user2Joined = true;
    await writeDb(db);
    return buildState(db, userId);
  });
}

export async function confirmBlue(userId: string, partnershipId: string): Promise<ScoutState> {
  return withLock(async () => {
    const db = await readDb();
    const partnership = requirePartnership(db, userId, partnershipId);
    const speed = partnership.speedDate;
    if (!speed || !speed.user1Joined || !speed.user2Joined) {
      throw new ScoutError(400, 'Both of you join Speed Date Live before the blue button.');
    }
    const now = new Date().toISOString();
    if (partnership.user1Id === userId) speed.user1BlueAt = speed.user1BlueAt || now;
    else speed.user2BlueAt = speed.user2BlueAt || now;
    if (speed.user1BlueAt && speed.user2BlueAt) partnership.status = 'active';
    await writeDb(db);
    return buildState(db, userId);
  });
}

export async function addAvailability(userId: string, partnershipId: string, input: { start?: string; end?: string; label?: string }): Promise<ScoutState> {
  return withLock(async () => {
    const db = await readDb();
    const partnership = requirePartnership(db, userId, partnershipId);
    if (partnership.mode !== 'building' || partnership.status === 'ended' || partnership.status === 'awaiting_contract') {
      throw new ScoutError(400, 'The shared calendar opens after both signatures.');
    }
    const start = new Date(String(input.start || ''));
    const end = new Date(String(input.end || ''));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new ScoutError(400, 'Give a start and an end.');
    }
    const profile = requireProfile(db, userId);
    profile.availability.push({
      id: nid(),
      start: start.toISOString(),
      end: end.toISOString(),
      label: clip(input.label, 80) || 'Free',
    });
    profile.availability = profile.availability.slice(-20);
    await writeDb(db);
    return buildState(db, userId);
  });
}

export async function addExpense(userId: string, partnershipId: string, input: { title?: string; amount?: number }): Promise<ScoutState> {
  return withLock(async () => {
    const db = await readDb();
    const partnership = requirePartnership(db, userId, partnershipId);
    if (partnership.status !== 'active') throw new ScoutError(400, 'The ledger opens when the blue button is mutual.');
    const title = clip(input.title, 80);
    const amountCents = cents(input.amount);
    if (!title || amountCents <= 0) throw new ScoutError(400, 'Name the expense and an amount.');
    partnership.expenses.push({ id: nid(), title, amountCents, paidBy: userId, createdAt: new Date().toISOString() });
    await writeDb(db);
    return buildState(db, userId);
  });
}

export async function saveHouse(userId: string, partnershipId: string, input: { label?: string; price?: number; down?: number; monthly?: number; iterations?: number }): Promise<ScoutState> {
  return withLock(async () => {
    const db = await readDb();
    const partnership = requirePartnership(db, userId, partnershipId);
    if (partnership.status !== 'active') throw new ScoutError(400, 'House tracking opens after the match is final.');
    const previous = partnership.house?.iterationsPaid || 0;
    partnership.house = {
      label: clip(input.label, 80) || 'Joint house',
      priceCents: cents(input.price),
      downCents: cents(input.down),
      monthlyCents: cents(input.monthly),
      iterationsPaid: Math.max(0, Math.min(600, Math.round(Number(input.iterations ?? previous) || 0))),
    };
    await writeDb(db);
    return buildState(db, userId);
  });
}

export async function addGoal(userId: string, partnershipId: string, label: string): Promise<ScoutState> {
  return withLock(async () => {
    const db = await readDb();
    const partnership = requirePartnership(db, userId, partnershipId);
    if (partnership.mode !== 'building' || partnership.status === 'ended') throw new ScoutError(400, 'Goals belong to an open Building partnership.');
    const clean = clip(label, 80);
    if (clean.length < 2) throw new ScoutError(400, 'Name the goal.');
    partnership.goals.push({ id: nid(), label: clean, done: false });
    await writeDb(db);
    return buildState(db, userId);
  });
}

export async function logMediation(userId: string, partnershipId: string, text: string): Promise<ScoutState> {
  return withLock(async () => {
    const db = await readDb();
    const partnership = requirePartnership(db, userId, partnershipId);
    if (partnership.mode !== 'building' || partnership.status === 'ended') throw new ScoutError(400, 'Mediation is for an open Building partnership.');
    const clean = clip(text, 500);
    if (clean.length < 4) throw new ScoutError(400, 'Write what happened.');
    partnership.mediation.push({ id: nid(), userId, text: clean, reply: mediate(clean), at: new Date().toISOString() });
    await writeDb(db);
    return buildState(db, userId);
  });
}

export async function terminatePartnership(userId: string, partnershipId: string, reason: string): Promise<ScoutState> {
  return withLock(async () => {
    const db = await readDb();
    const partnership = requirePartnership(db, userId, partnershipId);
    if (partnership.status === 'ended') return buildState(db, userId);
    if (partnership.mode !== 'building') throw new ScoutError(400, 'Just Talk ends by leaving the chat, not by a settlement.');
    const tracked = trackedCents(partnership);
    partnership.status = 'ended';
    partnership.settlement = {
      endedAt: new Date().toISOString(),
      reason: clip(reason, 200) || 'Unrepairable',
      trackedCents: tracked,
      eachShareCents: Math.floor(tracked / 2),
      remainderCents: tracked % 2,
    };
    await writeDb(db);
    return buildState(db, userId);
  });
}
