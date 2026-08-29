import type { DatingPost } from './posts.js';
import type { UserFeedProfile } from './feedEngagement.js';

export type FeedMode = 'for_you' | 'trending' | 'videos' | 'following';

export interface RankedPost extends DatingPost {
  views?: number;
  feedScore?: number;
  feedReason?: string;
}

function twitterRecencyScore(ageHours: number): number {
  return Math.exp(-ageHours / 30) * 18;
}

function tiktokVelocityScore(post: DatingPost, views = 0): number {
  const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
  const engagement =
    (post.likes || 0) * 1.2 +
    (post.comments?.length || 0) * 2.8 +
    (post.shares || 0) * 4.5 +
    views * 0.08;
  return engagement / Math.pow(ageHours + 1.5, 1.35);
}

function youtubeAffinityScore(
  post: DatingPost,
  profile: UserFeedProfile | null,
  views: number
): { score: number; reason?: string } {
  let score = 0;
  let reason: string | undefined;

  if (post.contentType === 'video') {
    score += 6 + Math.min(views * 0.05, 12);
    reason = 'Popular video';
  }

  if (!profile) return { score, reason };

  const authorEng = profile.engagedAuthorIds[post.userId] || 0;
  if (authorEng >= 4) {
    score += 14;
    reason = 'Creators you engage with';
  } else if (authorEng >= 2) {
    score += 8;
    reason = 'Similar to posts you liked';
  }

  const typePref = profile.preferredContentTypes[post.contentType] || 0;
  score += Math.min(typePref * 1.5, 10);

  const postTypePref = profile.preferredPostTypes[post.type] || 0;
  score += Math.min(postTypePref, 6);

  return { score, reason };
}

export function extractTrendingTags(posts: DatingPost[], limit = 8): string[] {
  const now = Date.now();
  const tagCounts = new Map<string, number>();
  for (const p of posts) {
    const ageHours = (now - new Date(p.createdAt).getTime()) / (1000 * 60 * 60);
    if (ageHours > 72) continue;
    const heat = (p.likes || 0) + (p.comments?.length || 0) * 2 + (p.shares || 0) * 3;
    for (const tag of p.tags || []) {
      const t = tag.toLowerCase().replace(/^#/, '');
      if (!t) continue;
      tagCounts.set(t, (tagCounts.get(t) || 0) + heat + 1);
    }
  }
  return [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

function tagOverlapScore(
  post: DatingPost,
  profile: UserFeedProfile | null,
  trendingTags: string[]
): { score: number; reason?: string } {
  let score = 0;
  let reason: string | undefined;
  const tags = (post.tags || []).map((t) => t.toLowerCase().replace(/^#/, ''));

  for (const tag of tags) {
    if (trendingTags.includes(tag)) {
      score += 6;
      reason = `#${tag} is trending`;
    }
    if (profile?.preferredTags[tag]) {
      score += Math.min(profile.preferredTags[tag] * 2, 10);
      reason = reason || `Because you like #${tag}`;
    }
  }
  return { score, reason };
}

function scorePost(
  post: DatingPost,
  profile: UserFeedProfile | null,
  trendingTags: string[],
  views: number,
  mode: FeedMode
): { score: number; reason?: string } {
  const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
  const velocity = tiktokVelocityScore(post, views);
  const recency = twitterRecencyScore(ageHours);
  const yt = youtubeAffinityScore(post, profile, views);
  const tags = tagOverlapScore(post, profile, trendingTags);

  let unseenBoost = 0;
  if (profile) {
    unseenBoost = profile.viewedPostIds.includes(post.id) ? -3 : 4;
  }

  let score = 0;
  let reason = tags.reason || yt.reason;

  if (mode === 'trending') {
    score = velocity * 4 + (post.likes || 0) * 0.5;
    reason = velocity > 5 ? 'Trending now' : 'Rising post';
  } else if (mode === 'videos') {
    if (post.contentType !== 'video') return { score: -1, reason: undefined };
    score = velocity * 5 + recency * 0.8 + yt.score + unseenBoost;
    reason = reason || 'For You · video';
  } else if (mode === 'following') {
    const authorEng = profile?.engagedAuthorIds[post.userId] || 0;
    if (authorEng < 1) return { score: -1, reason: undefined };
    score = recency * 2 + velocity * 2 + authorEng * 3;
    reason = 'From creators you follow';
  } else {
    score = velocity * 3.2 + recency + yt.score + tags.score + unseenBoost;
    if ((post.likes || 0) >= 25) {
      score += 8;
      reason = reason || 'Blowing up';
    } else if (ageHours < 6 && (post.likes || 0) + (post.comments?.length || 0) > 0) {
      reason = reason || 'Fresh & engaging';
    } else if (!reason) {
      reason = 'Recommended for you';
    }
  }

  return { score, reason };
}

function diversifyFeed(ranked: RankedPost[]): RankedPost[] {
  const result: RankedPost[] = [];
  const pool = [...ranked];
  while (pool.length) {
    let pick = 0;
    if (result.length) {
      const lastAuthor = result[result.length - 1].userId;
      const alt = pool.findIndex((p) => p.userId !== lastAuthor);
      if (alt > 0 && alt < 4) pick = alt;
    }
    result.push(pool.splice(pick, 1)[0]);
  }
  return result;
}

export function rankFeedPosts(
  posts: (DatingPost & { views?: number })[],
  options: { userId?: string | null; profile?: UserFeedProfile | null; mode?: FeedMode }
): { posts: RankedPost[]; trendingTags: string[] } {
  const mode = options.mode || 'for_you';
  const profile = options.profile || null;
  const trendingTags = extractTrendingTags(posts);

  const scored = posts
    .map((post) => {
      const views = post.views || 0;
      const { score, reason } = scorePost(post, profile, trendingTags, views, mode);
      return { ...post, feedScore: score, feedReason: reason };
    })
    .filter((p) => (p.feedScore ?? 0) > 0)
    .sort((a, b) => (b.feedScore ?? 0) - (a.feedScore ?? 0));

  return { posts: diversifyFeed(scored), trendingTags };
}

export function getRecommendedPosts(ranked: RankedPost[], limit = 6): RankedPost[] {
  return ranked.slice(0, limit);
}
