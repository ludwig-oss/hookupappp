import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { getAllUsers, getUserById, updateUserProfile, type User } from './user.js';

type WalkUser = Omit<User, 'password' | 'resetToken' | 'resetTokenExpiry'>;
import { getUserPreference } from './discover.js';
import { usersMatchPreferences } from '../utils/preferenceMatch.js';
import { calculateDistance, HOME_RADIUS_M } from './walkMatchUtils.js';
import { runWithSystem } from '../db/context.js';

export type FinancialTier = 'building' | 'stable' | 'wealthy';
export type WalkInterestStatus = 'pending' | 'mutual' | 'declined';

export interface WalkInterest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: WalkInterestStatus;
  createdAt: string;
  respondedAt?: string | null;
}

export interface WalkSuggestion {
  id: string;
  name: string;
  profilePicture: string | null;
  age?: number;
  distance: number;
  matchReason: string;
  matchScore: number;
  tags: string[];
  isOnline: boolean;
}

const INTERESTS_PATH = join(process.cwd(), 'server', 'data', 'walk-interests.json');
const DISMISSALS_PATH = join(process.cwd(), 'server', 'data', 'walk-proximity-dismissals.json');
const WALK_RADIUS_M = 500;

function isAtHome(user: WalkUser): boolean {
  const home = user.homeLocation;
  const loc = user.location;
  if (!home || !loc) return false;
  return calculateDistance(loc.lat, loc.lon, home.lat, home.lon) <= HOME_RADIUS_M;
}

/** Visible nearby when the user has not turned visibility off. */
export function isNearbyVisible(user: WalkUser): boolean {
  return user.nearbyDiscoverable !== false;
}

export function userIsAtHome(user: WalkUser): boolean {
  return isAtHome(user);
}

export function syncNearbyOnLocation(userId: string, lat: number, lon: number): Promise<User | null> {
  return getUserById(userId).then(async (user) => {
    if (!user) return null;
    const updates: Partial<User> = {
      location: { lat, lon, updatedAt: new Date() },
    };
    if (user.nearbyDiscoverable === undefined && user.outdoorWalkEnabled !== false) {
      updates.nearbyDiscoverable = true;
    }
    return updateUserProfile(userId, updates);
  });
}

export interface WalkProximityDismissal {
  userId: string;
  otherUserId: string;
  createdAt: string;
}

async function readDismissals(): Promise<WalkProximityDismissal[]> {
  try {
    return JSON.parse(await readFile(DISMISSALS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeDismissals(rows: WalkProximityDismissal[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then((fs) => fs.mkdir(dir, { recursive: true }));
  await writeFile(DISMISSALS_PATH, JSON.stringify(rows, null, 2));
}

/** Hide this nearby person from future popups for this user. */
export async function dismissWalkSuggestion(userId: string, otherUserId: string): Promise<void> {
  const rows = await readDismissals();
  if (rows.some((r) => r.userId === userId && r.otherUserId === otherUserId)) return;
  rows.push({ userId, otherUserId, createdAt: new Date().toISOString() });
  await writeDismissals(rows);
}

function shouldSkipNearbyCandidate(
  userId: string,
  otherId: string,
  interests: WalkInterest[],
  dismissals: WalkProximityDismissal[]
): boolean {
  if (dismissals.some((d) => d.userId === userId && d.otherUserId === otherId)) return true;
  const sent = interests.find(
    (r) => r.fromUserId === userId && r.toUserId === otherId && (r.status === 'pending' || r.status === 'mutual')
  );
  if (sent) return true;
  const declinedByMe = interests.find(
    (r) => r.fromUserId === otherId && r.toUserId === userId && r.status === 'declined'
  );
  if (declinedByMe) return true;
  const iDeclinedThem = interests.find(
    (r) => r.fromUserId === userId && r.toUserId === otherId && r.status === 'declined'
  );
  if (iDeclinedThem) return true;
  return false;
}
const DIVERSIFY_CHANCE = 0.22;

async function readInterests(): Promise<WalkInterest[]> {
  try {
    const raw = await readFile(INTERESTS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeInterests(rows: WalkInterest[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then((fs) => fs.mkdir(dir, { recursive: true }));
  await writeFile(INTERESTS_PATH, JSON.stringify(rows, null, 2));
}

export function getUserAge(user: WalkUser): number | null {
  if (typeof user.age === 'number' && user.age >= 18 && user.age <= 99) return user.age;
  return null;
}

export function getFinancialTier(user: WalkUser): FinancialTier {
  const t = user.financialTier;
  if (t === 'stable' || t === 'wealthy' || t === 'building') return t;
  return 'building';
}

export function isMale(user: WalkUser): boolean {
  const g = (user.gender || '').toLowerCase();
  return g === 'male' || g === 'm';
}

export function isFemale(user: WalkUser): boolean {
  const g = (user.gender || '').toLowerCase();
  return g === 'female' || g === 'f';
}

function attractivenessScore(user: WalkUser): number {
  const clicks = user.profileClickCount ?? 0;
  const impressions = Math.max(user.profileImpressionCount ?? 0, 1);
  const ctr = clicks / impressions;
  const style = user.styleScore ?? 50;
  const wealthy = getFinancialTier(user) === 'wealthy' ? 25 : 0;
  const famous = user.isFamousOrInfluencer || user.publicFigureVerified ? 20 : 0;
  return Math.min(100, Math.round(ctr * 120 + style * 0.4 + wealthy + famous));
}

function maleBuildingYoung(user: WalkUser): boolean {
  const age = getUserAge(user);
  return isMale(user) && age != null && age >= 20 && age <= 30 && getFinancialTier(user) === 'building';
}

function femaleOlder(user: WalkUser): boolean {
  const age = getUserAge(user);
  return isFemale(user) && age != null && age >= 30;
}

function femaleYoung(user: WalkUser): boolean {
  const age = getUserAge(user);
  return isFemale(user) && age != null && age >= 18 && age <= 29;
}

function malePremium(user: WalkUser): boolean {
  if (!isMale(user)) return false;
  return (
    getFinancialTier(user) === 'wealthy' ||
    Boolean(user.isFamousOrInfluencer) ||
    Boolean(user.publicFigureVerified) ||
    attractivenessScore(user) >= 72
  );
}

function scorePair(viewer: WalkUser, candidate: WalkUser): { score: number; reason: string; tags: string[] } {
  const vAge = getUserAge(viewer);
  const cAge = getUserAge(candidate);
  const tags: string[] = [];
  let score = 40;
  let reason = 'Nearby — open to connect';

  if (Math.random() < DIVERSIFY_CHANCE && vAge != null && cAge != null) {
    if (Math.abs(vAge - cAge) <= 5) {
      score += 35;
      reason = 'Around your age — good chemistry potential';
      tags.push('peer-match');
      return { score, reason, tags };
    }
  }

  if (maleBuildingYoung(viewer) && femaleOlder(candidate)) {
    score += 45;
    reason = 'Complementary match — experienced partner nearby';
    tags.push('young-m↔30+');
    return { score, reason, tags };
  }

  if (femaleOlder(viewer) && maleBuildingYoung(candidate)) {
    score += 45;
    reason = 'Complementary match — ambitious partner nearby';
    tags.push('30+↔young-m');
    return { score, reason, tags };
  }

  if (femaleYoung(viewer) && isMale(candidate)) {
    const attr = attractivenessScore(candidate);
    const tier = getFinancialTier(candidate);
    if (attr >= 65 || tier === 'wealthy' || malePremium(candidate)) {
      score += 38 + Math.min(22, Math.floor(attr / 5));
      reason =
        tier === 'wealthy' || malePremium(candidate)
          ? 'High-quality match — style, status & appeal'
          : 'Popular & stylish match nearby';
      tags.push('premium-male');
      return { score, reason, tags };
    }
    score += 20;
    reason = 'Potential match nearby';
    tags.push('young-f');
    return { score, reason, tags };
  }

  const hotFemale = isFemale(candidate) && (candidate.profileClickCount ?? 0) >= 8;
  if (malePremium(viewer) && hotFemale && femaleYoung(candidate)) {
    score += 42;
    reason = 'In-demand profile — strong mutual potential';
    tags.push('hot↔premium');
    return { score, reason, tags };
  }

  if (vAge != null && cAge != null) {
    if (vAge >= 30 && cAge >= 30) {
      score += 18;
      reason = 'Mature match nearby';
      tags.push('30+');
    } else if (vAge < 30 && cAge < 30) {
      score += 15;
      reason = 'Young energy match nearby';
      tags.push('young');
    }
  }

  return { score, reason, tags };
}

export async function getWalkSuggestions(
  userId: string,
  lat: number,
  lon: number,
  radiusM = WALK_RADIUS_M
): Promise<WalkSuggestion[]> {
  const viewerRaw = await getUserById(userId);
  if (!viewerRaw || viewerRaw.outdoorWalkEnabled === false) return [];
  const viewer = viewerRaw as WalkUser;
  if (!isNearbyVisible(viewer)) return [];

  const users = await getAllUsers();
  const viewerPref = await getUserPreference(userId);
  const interests = await readInterests();
  const dismissals = await readDismissals();
  const suggestions: WalkSuggestion[] = [];

  for (const other of users) {
    if (other.id === userId) continue;
    if (shouldSkipNearbyCandidate(userId, other.id, interests, dismissals)) continue;
    if (viewer.blockedUsers?.includes(other.id)) continue;
    if (viewer.unmatchedUsers?.includes(other.id)) continue;
    if (other.outdoorWalkEnabled === false) continue;
    if (!isNearbyVisible(other as WalkUser)) continue;
    if (!other.location) continue;

    const otherPref = await getUserPreference(other.id);
    if (!usersMatchPreferences(viewer, other, viewerPref, otherPref)) continue;

    const distance = calculateDistance(lat, lon, other.location.lat, other.location.lon);
    if (distance > radiusM) continue;

    const isOnline =
      other.location?.updatedAt != null &&
      Date.now() - new Date(other.location.updatedAt as string).getTime() < 8 * 60 * 1000;

    const { score, reason, tags } = scorePair(viewer, other);
    const proximityBoost = Math.max(0, 25 - Math.floor(distance / 5));
    const finalScore = score + proximityBoost + (isOnline ? 8 : 0);

    suggestions.push({
      id: other.id,
      name: other.name,
      profilePicture: other.profilePicture,
      age: getUserAge(other) ?? undefined,
      distance: Math.round(distance),
      matchReason: reason,
      matchScore: finalScore,
      tags,
      isOnline,
    });
  }

  return suggestions.sort((a, b) => b.matchScore - a.matchScore).slice(0, 8);
}

export async function recordProfileImpression(targetUserId: string): Promise<void> {
  await runWithSystem(async () => {
    const user = await getUserById(targetUserId);
    if (!user) return;
    await updateUserProfile(targetUserId, {
      profileImpressionCount: (user.profileImpressionCount ?? 0) + 1,
    });
  });
}

export async function recordProfileClick(targetUserId: string): Promise<{ clickCount: number }> {
  return runWithSystem(async () => {
    const user = await getUserById(targetUserId);
    if (!user) throw new Error('User not found');
    const clickCount = (user.profileClickCount ?? 0) + 1;
    await updateUserProfile(targetUserId, { profileClickCount: clickCount });
    return { clickCount };
  });
}

export async function submitLifeQuiz(
  userId: string,
  answers: {
    lifeStage: string;
    financialSituation: string;
    datingGoals: string;
    isFamousOrInfluencer: boolean;
    styleRating?: number;
  }
): Promise<User | null> {
  let financialTier: FinancialTier = 'building';
  const fs = answers.financialSituation.toLowerCase();
  if (fs.includes('wealth') || fs.includes('very comfortable') || fs.includes('rich')) {
    financialTier = 'wealthy';
  } else if (fs.includes('stable') || fs.includes('comfortable') || fs.includes('established')) {
    financialTier = 'stable';
  }

  const lifeStage = answers.lifeStage.toLowerCase();
  if (lifeStage.includes('established') || lifeStage.includes('wealth')) {
    if (financialTier === 'building') financialTier = 'stable';
  }

  return updateUserProfile(userId, {
    financialTier,
    lifeQuizCompleted: true,
    lifeQuizGoals: answers.datingGoals.slice(0, 500),
    isFamousOrInfluencer: answers.isFamousOrInfluencer,
    styleScore: answers.styleRating ?? 50,
  });
}

export async function sendWalkInterest(fromUserId: string, toUserId: string): Promise<{
  interest: WalkInterest;
  mutual: boolean;
  chatUserId?: string;
}> {
  const rows = await readInterests();
  const reverse = rows.find(
    (r) =>
      r.fromUserId === toUserId &&
      r.toUserId === fromUserId &&
      (r.status === 'pending' || r.status === 'mutual')
  );

  if (reverse && reverse.status === 'pending') {
    reverse.status = 'mutual';
    reverse.respondedAt = new Date().toISOString();
    await writeInterests(rows);
    return { interest: reverse, mutual: true, chatUserId: toUserId };
  }

  const dup = rows.find(
    (r) => r.fromUserId === fromUserId && r.toUserId === toUserId && r.status === 'pending'
  );
  if (dup) return { interest: dup, mutual: false };

  const interest: WalkInterest = {
    id: Date.now().toString(),
    fromUserId,
    toUserId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  rows.push(interest);
  await writeInterests(rows);
  return { interest, mutual: false };
}

export async function respondWalkInterest(
  userId: string,
  interestId: string,
  accept: boolean
): Promise<{ interest: WalkInterest; mutual: boolean; chatUserId?: string }> {
  const rows = await readInterests();
  const row = rows.find((r) => r.id === interestId && r.toUserId === userId);
  if (!row) throw new Error('Interest not found');

  if (!accept) {
    row.status = 'declined';
    row.respondedAt = new Date().toISOString();
    await writeInterests(rows);
    return { interest: row, mutual: false };
  }

  row.status = 'mutual';
  row.respondedAt = new Date().toISOString();
  await writeInterests(rows);
  return { interest: row, mutual: true, chatUserId: row.fromUserId };
}

export async function getIncomingWalkInterests(userId: string): Promise<
  Array<WalkInterest & { fromUser?: { id: string; name: string; profilePicture: string | null } }>
> {
  const rows = await readInterests();
  const pending = rows.filter((r) => r.toUserId === userId && r.status === 'pending');
  return Promise.all(
    pending.map(async (r) => {
      const fromUser = await getUserById(r.fromUserId);
      return {
        ...r,
        fromUser: fromUser
          ? { id: fromUser.id, name: fromUser.name, profilePicture: fromUser.profilePicture }
          : undefined,
      };
    })
  );
}
