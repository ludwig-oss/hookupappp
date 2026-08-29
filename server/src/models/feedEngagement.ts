import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { DatingPost } from './posts.js';

export interface UserFeedProfile {
  userId: string;
  likedPostIds: string[];
  viewedPostIds: string[];
  commentedPostIds: string[];
  sharedPostIds: string[];
  preferredContentTypes: Record<string, number>;
  preferredTags: Record<string, number>;
  engagedAuthorIds: Record<string, number>;
  preferredPostTypes: Record<string, number>;
  updatedAt: string;
}

const PROFILES_PATH = join(process.cwd(), 'server', 'data', 'feed-profiles.json');
const VIEW_COUNTS_PATH = join(process.cwd(), 'server', 'data', 'post-view-counts.json');

async function readProfiles(): Promise<UserFeedProfile[]> {
  try {
    return JSON.parse(await readFile(PROFILES_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeProfiles(list: UserFeedProfile[]): Promise<void> {
  await mkdir(join(process.cwd(), 'server', 'data'), { recursive: true });
  await writeFile(PROFILES_PATH, JSON.stringify(list, null, 2));
}

async function readViewCounts(): Promise<Record<string, number>> {
  try {
    return JSON.parse(await readFile(VIEW_COUNTS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

async function writeViewCounts(counts: Record<string, number>): Promise<void> {
  await mkdir(join(process.cwd(), 'server', 'data'), { recursive: true });
  await writeFile(VIEW_COUNTS_PATH, JSON.stringify(counts, null, 2));
}

function emptyProfile(userId: string): UserFeedProfile {
  return {
    userId,
    likedPostIds: [],
    viewedPostIds: [],
    commentedPostIds: [],
    sharedPostIds: [],
    preferredContentTypes: {},
    preferredTags: {},
    engagedAuthorIds: {},
    preferredPostTypes: {},
    updatedAt: new Date().toISOString(),
  };
}

export async function getUserFeedProfile(userId: string): Promise<UserFeedProfile> {
  const list = await readProfiles();
  return list.find((p) => p.userId === userId) || emptyProfile(userId);
}

async function saveProfile(profile: UserFeedProfile): Promise<void> {
  const list = await readProfiles();
  const idx = list.findIndex((p) => p.userId === profile.userId);
  profile.updatedAt = new Date().toISOString();
  if (idx >= 0) list[idx] = profile;
  else list.push(profile);
  await writeProfiles(list);
}

function bump(map: Record<string, number>, key: string, amount = 1): void {
  map[key] = (map[key] || 0) + amount;
}

function trackPostSignals(profile: UserFeedProfile, post: DatingPost): void {
  bump(profile.preferredContentTypes, post.contentType, 2);
  bump(profile.preferredPostTypes, post.type, 1);
  bump(profile.engagedAuthorIds, post.userId, 2);
  for (const tag of post.tags || []) {
    bump(profile.preferredTags, tag.toLowerCase(), 2);
  }
}

export async function recordFeedLike(userId: string, post: DatingPost): Promise<void> {
  const profile = await getUserFeedProfile(userId);
  if (!profile.likedPostIds.includes(post.id)) profile.likedPostIds.push(post.id);
  trackPostSignals(profile, post);
  await saveProfile(profile);
}

export async function recordFeedComment(userId: string, post: DatingPost): Promise<void> {
  const profile = await getUserFeedProfile(userId);
  if (!profile.commentedPostIds.includes(post.id)) profile.commentedPostIds.push(post.id);
  trackPostSignals(profile, post);
  await saveProfile(profile);
}

export async function recordFeedShare(userId: string, post: DatingPost): Promise<void> {
  const profile = await getUserFeedProfile(userId);
  if (!profile.sharedPostIds.includes(post.id)) profile.sharedPostIds.push(post.id);
  trackPostSignals(profile, post);
  await saveProfile(profile);
}

export async function recordFeedView(userId: string, postId: string): Promise<number> {
  const profile = await getUserFeedProfile(userId);
  if (!profile.viewedPostIds.includes(postId)) {
    profile.viewedPostIds.push(postId);
    if (profile.viewedPostIds.length > 500) {
      profile.viewedPostIds = profile.viewedPostIds.slice(-400);
    }
    await saveProfile(profile);
  }

  const counts = await readViewCounts();
  counts[postId] = (counts[postId] || 0) + 1;
  await writeViewCounts(counts);
  return counts[postId];
}

export async function attachViewCounts(posts: DatingPost[]): Promise<(DatingPost & { views?: number })[]> {
  const counts = await readViewCounts();
  return posts.map((p) => ({ ...p, views: counts[p.id] || 0 }));
}
