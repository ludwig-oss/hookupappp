import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { detectSeriousClaim } from '../utils/seriousClaim.js';

export const REVIEW_ATTRIBUTES = [
  'personality',
  'fashion',
  'cooking',
  'communication',
  'angerManagement',
  'dancing',
  'humor',
  'kindness',
  'listening',
  'romance',
  'reliability',
  'conflictResolution',
  'decisionMaking',
  'relationshipHandling',
  'stressHandling',
  'protection',
  'goodInBed',
] as const;

export type ReviewAttributeKey = typeof REVIEW_ATTRIBUTES[number];

export interface ReviewAttributes {
  personality: number;
  fashion: number;
  cooking: number;
  communication: number;
  angerManagement: number;
  dancing: number;
  humor: number;
  kindness: number;
  listening: number;
  romance: number;
  reliability: number;
  conflictResolution: number;
  decisionMaking: number;
  relationshipHandling: number;
  stressHandling: number;
  protection: number;
  goodInBed: number;
}

export type ReviewClaimStatus = 'none' | 'pending_innocent' | 'proven';

export interface ReviewCourtEvidence {
  summary: string;
  documentNote?: string | null;
  submittedAt: string;
}

export interface Review {
  id: string;
  fromUserId: string;
  toUserId: string;
  attributes: ReviewAttributes;
  /** Overall experience 1–5 (Google Play style aggregate). */
  overallStars: number;
  reviewText: string;
  replyText?: string | null;
  repliedAt?: string | null;
  createdAt: string;
  source?: 'unmatch' | 'manual';
  isSeriousClaim?: boolean;
  claimStatus?: ReviewClaimStatus;
  courtEvidence?: ReviewCourtEvidence | null;
  disclaimerAcceptedAt?: string | null;
}

const REVIEWS_PATH = join(process.cwd(), 'server', 'data', 'reviews.json');

const defaultAttributes: ReviewAttributes = {
  personality: 5,
  fashion: 5,
  cooking: 5,
  communication: 5,
  angerManagement: 5,
  dancing: 5,
  humor: 5,
  kindness: 5,
  listening: 5,
  romance: 5,
  reliability: 5,
  conflictResolution: 5,
  decisionMaking: 5,
  relationshipHandling: 5,
  stressHandling: 5,
  protection: 5,
  goodInBed: 5,
};

function clamp(n: number): number {
  return Math.max(1, Math.min(10, Math.round(n)));
}

async function readReviews(): Promise<Review[]> {
  try {
    const data = await readFile(REVIEWS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeReviews(reviews: Review[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(REVIEWS_PATH, JSON.stringify(reviews, null, 2));
}

export function normalizeAttributes(attrs: Partial<ReviewAttributes>): ReviewAttributes {
  const out = { ...defaultAttributes };
  for (const key of REVIEW_ATTRIBUTES) {
    if (typeof attrs[key] === 'number') out[key] = clamp(attrs[key]!);
  }
  return out;
}

function clampStars(n: number): number {
  return Math.max(1, Math.min(5, Math.round(n)));
}

function migrateReview(r: Review): Review {
  return {
    ...r,
    overallStars: typeof r.overallStars === 'number' ? clampStars(r.overallStars) : 3,
    isSeriousClaim: r.isSeriousClaim ?? detectSeriousClaim(r.reviewText),
    claimStatus:
      r.claimStatus ??
      (detectSeriousClaim(r.reviewText) ? 'pending_innocent' : 'none'),
    courtEvidence: r.courtEvidence ?? null,
  };
}

export async function createReview(data: {
  fromUserId: string;
  toUserId: string;
  attributes: Partial<ReviewAttributes>;
  overallStars: number;
  reviewText: string;
  source?: 'unmatch' | 'manual';
  disclaimerAccepted?: boolean;
}): Promise<Review> {
  const reviews = await readReviews();
  const existing = reviews.find(
    r => r.fromUserId === data.fromUserId && r.toUserId === data.toUserId
  );
  const reviewText = data.reviewText?.trim() || '';
  const serious = detectSeriousClaim(reviewText);
  const review: Review = {
    id: existing?.id ?? Date.now().toString(),
    fromUserId: data.fromUserId,
    toUserId: data.toUserId,
    attributes: normalizeAttributes(data.attributes || {}),
    overallStars: clampStars(data.overallStars),
    reviewText,
    replyText: existing?.replyText ?? null,
    repliedAt: existing?.repliedAt ?? null,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    source: data.source ?? 'manual',
    isSeriousClaim: serious,
    claimStatus: serious ? (existing?.claimStatus === 'proven' ? 'proven' : 'pending_innocent') : 'none',
    courtEvidence: existing?.courtEvidence ?? null,
    disclaimerAcceptedAt: data.disclaimerAccepted ? new Date().toISOString() : existing?.disclaimerAcceptedAt ?? null,
  };
  if (existing) {
    const i = reviews.findIndex(r => r.id === existing.id);
    reviews[i] = review;
  } else {
    reviews.push(review);
  }
  await writeReviews(reviews);
  return review;
}

export async function getReviewsForUser(userId: string): Promise<Review[]> {
  const reviews = await readReviews();
  return reviews.filter((r) => r.toUserId === userId).map(migrateReview);
}

export async function addReply(reviewId: string, toUserId: string, replyText: string): Promise<Review | null> {
  const reviews = await readReviews();
  const r = reviews.find(rev => rev.id === reviewId && rev.toUserId === toUserId);
  if (!r) return null;
  r.replyText = replyText.trim();
  r.repliedAt = new Date().toISOString();
  await writeReviews(reviews);
  return migrateReview(r);
}

export async function getAggregateAttributes(userId: string): Promise<{
  attributes: ReviewAttributes;
  totalReviews: number;
}> {
  const reviews = await readReviews();
  const forUser = reviews.filter(r => r.toUserId === userId);
  if (forUser.length === 0) {
    return { attributes: { ...defaultAttributes }, totalReviews: 0 };
  }
  const sums: ReviewAttributes = { ...defaultAttributes };
  for (const key of REVIEW_ATTRIBUTES) {
    sums[key] = 0;
  }
  for (const r of forUser) {
    const attrs = r.attributes as unknown as Record<string, number>;
    for (const key of REVIEW_ATTRIBUTES) {
      sums[key] += (typeof attrs[key] === 'number' ? attrs[key] : defaultAttributes[key]) || 0;
    }
  }
  const attributes: ReviewAttributes = { ...defaultAttributes };
  for (const key of REVIEW_ATTRIBUTES) {
    attributes[key] = Math.round((sums[key] / forUser.length) * 10) / 10;
  }
  return { attributes, totalReviews: forUser.length };
}

export async function getReviewById(reviewId: string): Promise<Review | null> {
  const reviews = await readReviews();
  const r = reviews.find(rev => rev.id === reviewId);
  if (!r) return null;
  return migrateReview(r);
}

/** Google Play–style: average of all overall star ratings for this user. */
export async function getOverallStarRating(userId: string): Promise<{
  averageStars: number;
  totalReviews: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}> {
  const reviews = (await readReviews()).map(migrateReview).filter((r) => r.toUserId === userId);
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (reviews.length === 0) {
    return { averageStars: 0, totalReviews: 0, distribution };
  }
  let sum = 0;
  for (const r of reviews) {
    const s = clampStars(r.overallStars) as 1 | 2 | 3 | 4 | 5;
    distribution[s]++;
    sum += s;
  }
  const averageStars = Math.round((sum / reviews.length) * 10) / 10;
  return { averageStars, totalReviews: reviews.length, distribution };
}

export async function submitCourtEvidence(
  reviewId: string,
  fromUserId: string,
  evidence: { summary: string; documentNote?: string; confirmOfficial: boolean }
): Promise<Review | null> {
  if (!evidence.confirmOfficial) return null;
  const reviews = await readReviews();
  const i = reviews.findIndex((r) => r.id === reviewId && r.fromUserId === fromUserId);
  if (i === -1) return null;
  const r = migrateReview(reviews[i]);
  if (!r.isSeriousClaim) return null;
  r.courtEvidence = {
    summary: evidence.summary.trim(),
    documentNote: evidence.documentNote?.trim() || null,
    submittedAt: new Date().toISOString(),
  };
  r.claimStatus = 'proven';
  reviews[i] = r;
  await writeReviews(reviews);
  return r;
}

export async function getReviewBetween(fromUserId: string, toUserId: string): Promise<Review | null> {
  const reviews = await readReviews();
  const r = reviews.find((rev) => rev.fromUserId === fromUserId && rev.toUserId === toUserId);
  return r ? migrateReview(r) : null;
}
