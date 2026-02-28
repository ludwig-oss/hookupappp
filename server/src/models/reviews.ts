import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

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

export interface Review {
  id: string;
  fromUserId: string;
  toUserId: string;
  attributes: ReviewAttributes;
  reviewText: string;
  replyText?: string | null;
  repliedAt?: string | null;
  createdAt: string;
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

export async function createReview(data: {
  fromUserId: string;
  toUserId: string;
  attributes: Partial<ReviewAttributes>;
  reviewText: string;
}): Promise<Review> {
  const reviews = await readReviews();
  const existing = reviews.find(
    r => r.fromUserId === data.fromUserId && r.toUserId === data.toUserId
  );
  const review: Review = {
    id: existing?.id ?? Date.now().toString(),
    fromUserId: data.fromUserId,
    toUserId: data.toUserId,
    attributes: normalizeAttributes(data.attributes || {}),
    reviewText: data.reviewText?.trim() || '',
    replyText: existing?.replyText ?? null,
    repliedAt: existing?.repliedAt ?? null,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
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
  return reviews.filter(r => r.toUserId === userId);
}

export async function addReply(reviewId: string, toUserId: string, replyText: string): Promise<Review | null> {
  const reviews = await readReviews();
  const r = reviews.find(rev => rev.id === reviewId && rev.toUserId === toUserId);
  if (!r) return null;
  r.replyText = replyText.trim();
  r.repliedAt = new Date().toISOString();
  await writeReviews(reviews);
  return r;
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
  return reviews.find(r => r.id === reviewId) || null;
}
