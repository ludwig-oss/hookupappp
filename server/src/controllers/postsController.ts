import { Request, Response } from 'express';
import {
  createPost,
  getAllPosts,
  getFeedPosts,
  getBlowingUpCount,
  getPostById,
  likePost,
  addComment,
  sharePost,
  deletePost,
} from '../models/posts.js';
import { getUserById } from '../models/user.js';
import { checkContent } from '../utils/moderation.js';
import { sanitizeMessageContent, sanitizeForStorage, sanitizeTags, LIMITS } from '../utils/sanitize.js';
import {
  recordFeedLike,
  recordFeedComment,
  recordFeedShare,
  recordFeedView,
  getUserFeedProfile,
} from '../models/feedEngagement.js';
import { rankFeedPosts, getRecommendedPosts, type FeedMode } from '../models/feedAlgorithm.js';
import { attachViewCounts } from '../models/feedEngagement.js';
import type { AuthRequest } from '../middleware/auth.js';

function parseFeedMode(raw: unknown): FeedMode {
  const m = typeof raw === 'string' ? raw : 'for_you';
  if (m === 'trending' || m === 'videos' || m === 'following' || m === 'for_you') return m;
  return 'for_you';
}

export const createDatingPost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { type, contentType } = req.body;
    const content = sanitizeMessageContent(req.body.content, LIMITS.POST_CONTENT);
    const title = req.body.title != null ? sanitizeForStorage(req.body.title, LIMITS.POST_TITLE) : undefined;
    const tags = sanitizeTags(req.body.tags);

    if (!type || !contentType || !content) {
      return res.status(400).json({ error: 'Type, content type, and content are required' });
    }

    if (type !== 'warning' && type !== 'positive') {
      return res.status(400).json({ error: 'Type must be "warning" or "positive"' });
    }

    const textToCheck = [content, title].filter(Boolean).join(' ');
    const moderation = checkContent(textToCheck);
    if (!moderation.allowed) {
      return res.status(400).json({ error: moderation.reason || 'Post contains content that violates our guidelines.' });
    }

    const post = await createPost({
      userId,
      type,
      contentType,
      content,
      title,
      tags,
    });

    const user = await getUserById(userId);
    if (user) {
      (post as any).user = {
        id: user.id,
        name: user.name,
        username: user.username,
        profilePicture: user.profilePicture,
      };
    }

    res.json({ post });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getDatingPosts = async (req: Request, res: Response) => {
  try {
    const posts = await getAllPosts();
    const enrichedPosts = await enrichPostsWithUser(posts);
    res.json({ posts: enrichedPosts });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Hybrid feed: YouTube recommendations + Twitter recency + TikTok viral velocity */
export const getFeed = async (req: AuthRequest, res: Response) => {
  try {
    const mode = parseFeedMode(req.query.mode);
    const userId = req.userId || null;
    const posts = await getFeedPosts({ userId, mode });
    const enrichedPosts = await enrichPostsWithUser(posts);
    const trendingTags = posts.length ? (await import('../models/feedAlgorithm.js')).extractTrendingTags(
      await getAllPosts()
    ) : [];

    res.json({
      posts: enrichedPosts,
      feedMeta: {
        mode,
        algorithm: 'youtube-twitter-tiktok-hybrid',
        personalized: !!userId,
        trendingTags,
        description:
          mode === 'for_you'
            ? 'Personalized mix of trending, fresh posts, and videos you might like'
            : mode === 'trending'
              ? 'Twitter-style — what is rising right now'
              : mode === 'videos'
                ? 'TikTok-style — short videos ranked by engagement velocity'
                : 'Creators you like, comment on, or share',
      },
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.json({ posts: [], feedMeta: { mode: 'for_you', personalized: false, trendingTags: [] } });
  }
};

/** Top recommended posts for carousel / sidebar */
export const getRecommendations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || null;
    const all = await attachViewCounts(await getAllPosts());
    const profile = userId ? await getUserFeedProfile(userId) : null;
    const { posts: ranked, trendingTags } = rankFeedPosts(all, { userId, profile, mode: 'for_you' });
    const picks = getRecommendedPosts(ranked, 8);
    const enriched = await enrichPostsWithUser(picks);
    res.json({ recommendations: enriched, trendingTags });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.json({ recommendations: [], trendingTags: [] });
  }
};

export const recordPostView = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { postId } = req.params;
    const views = await recordFeedView(userId, postId);
    res.json({ views });
  } catch (error) {
    console.error('Record view error:', error);
    res.status(500).json({ error: 'Failed to record view' });
  }
};

export const getBlowingUpCountHandler = async (_req: Request, res: Response) => {
  try {
    const count = await getBlowingUpCount();
    res.json({ count });
  } catch (error) {
    console.error('Blowing up count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const shareDatingPost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { postId } = req.params;
    await sharePost(postId);
    const post = await getPostById(postId);
    if (post && userId) await recordFeedShare(userId, post);
    res.json({ message: 'Post shared' });
  } catch (error) {
    console.error('Share post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function enrichPostsWithUser(posts: any[]) {
  const userIds = [...new Set(posts.map((p) => p.userId).filter(Boolean))];
  const byId = new Map<string, { id: string; name: string; username: string; profilePicture: string | null }>();
  await Promise.all(
    userIds.map(async (id) => {
      const user = await getUserById(id);
      if (user) {
        byId.set(id, {
          id: user.id,
          name: user.name,
          username: user.username,
          profilePicture: user.profilePicture ?? null,
        });
      }
    })
  );
  return posts.map((post) => ({
    ...post,
    user: byId.get(post.userId) ?? null,
  }));
}

export const likeDatingPost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { postId } = req.params;
    await likePost(postId);
    const post = await getPostById(postId);
    if (post && userId) await recordFeedLike(userId, post);
    res.json({ message: 'Post liked' });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const commentOnPost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { postId } = req.params;
    const content = sanitizeMessageContent(req.body.content, LIMITS.COMMENT);

    if (!content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const mod = checkContent(content);
    if (!mod.allowed) {
      return res.status(400).json({ error: mod.reason || 'Comment not allowed.' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await addComment(postId, {
      userId,
      userName: user.name,
      content,
    });

    const post = await getPostById(postId);
    if (post) await recordFeedComment(userId, post);

    res.json({ message: 'Comment added' });
  } catch (error) {
    console.error('Comment on post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteDatingPost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { postId } = req.params;

    const deleted = await deletePost(postId, userId);
    if (!deleted) {
      return res.status(403).json({ error: 'You can only delete your own posts.' });
    }
    res.json({ message: 'Post deleted' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
