import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { getUserById } from './user.js';

export interface UserRating {
  id: string;
  ratedUserId: string; // User being rated
  raterUserId: string; // User who gave the rating
  overallRating: number; // Out of 100
  characteristics: {
    communication: number; // 0-100
    personality: number; // 0-100
    compatibility: number; // 0-100
    bedroom: number; // 0-100 (optional)
    kissing: number; // 0-100 (optional)
    humor: number; // 0-100
    intelligence: number; // 0-100
    kindness: number; // 0-100
    confidence: number; // 0-100
    attractiveness: number; // 0-100
  };
  createdAt: Date | string;
}

export interface UnmatchReason {
  id: string;
  fromUserId: string;
  toUserId: string;
  reason: string;
  createdAt: Date | string;
  viewed: boolean;
}

const RATINGS_PATH = join(process.cwd(), 'server', 'data', 'user-ratings.json');
const UNMATCH_REASONS_PATH = join(process.cwd(), 'server', 'data', 'unmatch-reasons.json');

async function readRatings(): Promise<UserRating[]> {
  try {
    const data = await readFile(RATINGS_PATH, 'utf-8');
    return JSON.parse(data).map((rating: UserRating) => ({
      ...rating,
      createdAt: new Date(rating.createdAt),
    }));
  } catch {
    return [];
  }
}

async function writeRatings(ratings: UserRating[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(RATINGS_PATH, JSON.stringify(ratings, null, 2));
}

async function readUnmatchReasons(): Promise<UnmatchReason[]> {
  try {
    const data = await readFile(UNMATCH_REASONS_PATH, 'utf-8');
    return JSON.parse(data).map((reason: UnmatchReason) => ({
      ...reason,
      createdAt: new Date(reason.createdAt),
    }));
  } catch {
    return [];
  }
}

async function writeUnmatchReasons(reasons: UnmatchReason[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(UNMATCH_REASONS_PATH, JSON.stringify(reasons, null, 2));
}

export async function createRating(ratingData: Omit<UserRating, 'id' | 'createdAt'>): Promise<UserRating> {
  const ratings = await readRatings();
  
  // Check if user already rated this person
  const existing = ratings.find(
    r => r.ratedUserId === ratingData.ratedUserId && 
    r.raterUserId === ratingData.raterUserId
  );
  if (existing) {
    // Update existing rating
    Object.assign(existing, ratingData);
    await writeRatings(ratings);
    return existing;
  }

  const rating: UserRating = {
    ...ratingData,
    id: Date.now().toString(),
    createdAt: new Date(),
  };
  ratings.push(rating);
  await writeRatings(ratings);
  return rating;
}

export async function getRatingsForUser(userId: string): Promise<UserRating[]> {
  const ratings = await readRatings();
  return ratings.filter(r => r.ratedUserId === userId);
}

export async function getUserAverageRatings(userId: string): Promise<{
  overallRating: number;
  characteristics: {
    communication: number;
    personality: number;
    compatibility: number;
    bedroom: number | null;
    kissing: number | null;
    humor: number;
    intelligence: number;
    kindness: number;
    confidence: number;
    attractiveness: number;
  };
  totalRatings: number;
}> {
  const ratings = await getRatingsForUser(userId);
  if (ratings.length === 0) {
    return {
      overallRating: 0,
      characteristics: {
        communication: 0,
        personality: 0,
        compatibility: 0,
        bedroom: null,
        kissing: null,
        humor: 0,
        intelligence: 0,
        kindness: 0,
        confidence: 0,
        attractiveness: 0,
      },
      totalRatings: 0,
    };
  }

  const totals = {
    overall: 0,
    communication: 0,
    personality: 0,
    compatibility: 0,
    bedroom: 0,
    kissing: 0,
    humor: 0,
    intelligence: 0,
    kindness: 0,
    confidence: 0,
    attractiveness: 0,
  };

  let bedroomCount = 0;
  let kissingCount = 0;

  for (const rating of ratings) {
    totals.overall += rating.overallRating;
    totals.communication += rating.characteristics.communication;
    totals.personality += rating.characteristics.personality;
    totals.compatibility += rating.characteristics.compatibility;
    totals.humor += rating.characteristics.humor;
    totals.intelligence += rating.characteristics.intelligence;
    totals.kindness += rating.characteristics.kindness;
    totals.confidence += rating.characteristics.confidence;
    totals.attractiveness += rating.characteristics.attractiveness;
    
    if (rating.characteristics.bedroom !== undefined && rating.characteristics.bedroom !== null) {
      totals.bedroom += rating.characteristics.bedroom;
      bedroomCount++;
    }
    if (rating.characteristics.kissing !== undefined && rating.characteristics.kissing !== null) {
      totals.kissing += rating.characteristics.kissing;
      kissingCount++;
    }
  }

  const count = ratings.length;
  return {
    overallRating: Math.round(totals.overall / count),
    characteristics: {
      communication: Math.round(totals.communication / count),
      personality: Math.round(totals.personality / count),
      compatibility: Math.round(totals.compatibility / count),
      bedroom: bedroomCount > 0 ? Math.round(totals.bedroom / bedroomCount) : null,
      kissing: kissingCount > 0 ? Math.round(totals.kissing / kissingCount) : null,
      humor: Math.round(totals.humor / count),
      intelligence: Math.round(totals.intelligence / count),
      kindness: Math.round(totals.kindness / count),
      confidence: Math.round(totals.confidence / count),
      attractiveness: Math.round(totals.attractiveness / count),
    },
    totalRatings: count,
  };
}

export async function createUnmatchReason(reasonData: Omit<UnmatchReason, 'id' | 'createdAt' | 'viewed'>): Promise<UnmatchReason> {
  const reasons = await readUnmatchReasons();
  const reason: UnmatchReason = {
    ...reasonData,
    id: Date.now().toString(),
    createdAt: new Date(),
    viewed: false,
  };
  reasons.push(reason);
  await writeUnmatchReasons(reasons);
  return reason;
}

export async function getUnmatchReasonsForUser(userId: string): Promise<UnmatchReason[]> {
  const reasons = await readUnmatchReasons();
  return reasons.filter(r => r.toUserId === userId && !r.viewed);
}

export async function markUnmatchReasonAsViewed(reasonId: string): Promise<void> {
  const reasons = await readUnmatchReasons();
  const reason = reasons.find(r => r.id === reasonId);
  if (reason) {
    reason.viewed = true;
    await writeUnmatchReasons(reasons);
  }
}
