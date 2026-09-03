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
import { sendPushToUser } from '../realtime/push.js';
import { runWithSystem } from '../db/context.js';
import { checkContent } from '../utils/moderation.js';
import { sanitizeMessageContent, sanitizeForStorage, sanitizeTags, LIMITS } from '../utils/sanitize.js';
import { uploadMedia, uploadMediaBuffer } from '../utils/storage.js';
import { inferMediaTypeFromUrl } from '../utils/mediaType.js';
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

export const uploadPostMedia = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    const raw = req.body?.data;
    if (!raw || typeof raw !== 'string') {
      return res.status(400).json({ error: 'Media data required' });
    }
    const folder = typeof req.body?.folder === 'string' ? req.body.folder.slice(0, 40) : 'posts';
    const url = await uploadMedia(raw, folder);
    const contentType = inferMediaTypeFromUrl(url) === 'video' ? 'video' : 'image';
    res.json({ url, contentType });
  } catch (error) {
    console.error('Upload post media error:', error);
    res.status(500).json({ error: 'Could not upload media' });
  }
};

/** Raw file bytes (not JSON/base64) — used by profile highlights and stories. */
export const uploadPostFile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length === 0) {
      return res.status(400).json({ error: 'File is required' });
    }
    const mimeHeader = String(req.headers['x-upload-content-type'] || req.headers['content-type'] || '');
    const mime = sniffUploadMime(buf, mimeHeader);
    if (!mime.startsWith('image/') && !mime.startsWith('video/')) {
      return res.status(400).json({ error: 'Please upload a photo or video' });
    }
    const folderRaw = req.headers['x-upload-folder'];
    const folder = (typeof folderRaw === 'string' ? folderRaw : 'posts').slice(0, 40);
    const url = await uploadMediaBuffer(buf, mime, folder);
    const contentType = inferMediaTypeFromUrl(url) === 'video' ? 'video' : 'image';
    res.json({ url, contentType });
  } catch (error) {
    console.error('Upload post file error:', error);
    const msg = error instanceof Error ? error.message : '';
    res.status(500).json({ error: msg.includes('too large') ? msg : 'Could not upload media' });
  }
};

function sniffUploadMime(buf: Buffer, header: string): string {
  const declared = header.split(';')[0].trim().toLowerCase();
  if (declared.startsWith('image/') || declared.startsWith('video/')) return declared;
  if (buf.length >= 12) {
    const ftyp = buf.subarray(4, 8).toString('ascii');
    if (ftyp === 'ftyp') return 'video/mp4';
    if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video/webm';
    if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
    if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
      return 'image/webp';
    }
  }
  return declared || 'application/octet-stream';
}

export const createDatingPost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { type, contentType } = req.body;
    let content = sanitizeMessageContent(req.body.content, LIMITS.POST_CONTENT);
    const title = req.body.title != null ? sanitizeForStorage(req.body.title, LIMITS.POST_TITLE) : undefined;
    const tags = sanitizeTags(req.body.tags);

    if (!type || !contentType || !content) {
      return res.status(400).json({ error: 'Type, content type, and content are required' });
    }

    if (content.startsWith('data:') && content.length > 400_000) {
      content = await uploadMedia(content, 'posts');
    }

    if (type !== 'warning' && type !== 'positive') {
      return res.status(400).json({ error: 'Type must be "warning" or "positive"' });
    }

    const textToCheck = [title, !/^https?:\/\//i.test(content) ? content : '']
      .filter(Boolean)
      .join(' ');
    if (textToCheck) {
      const moderation = checkContent(textToCheck);
      if (!moderation.allowed) {
        return res.status(400).json({ error: moderation.reason || 'Post contains content that violates our guidelines.' });
      }
    }

    const post = await runWithSystem(() => createPost({
      userId,
      type,
      contentType,
      content,
      title,
      tags,
    }));

    const user = await runWithSystem(() => getUserById(userId));
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
    const userId = (req as any).userId || null;
    const { attachToPosts } = await import('../models/singleAgain.js');
    const withSingle = await attachToPosts(posts, userId);
    const enrichedPosts = await enrichPostsWithUser(withSingle);
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
    const { attachToPosts, drawAllDue } = await import('../models/singleAgain.js');
    await drawAllDue();
    const withSingle = await attachToPosts(posts, userId);
    const enrichedPosts = await enrichPostsWithUser(withSingle);
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
    const { attachToPosts } = await import('../models/singleAgain.js');
    const withSingle = await attachToPosts(picks, userId);
    const enriched = await enrichPostsWithUser(withSingle);
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
  return posts.map((post) => {
    if ((post as any).singleAgain && !(post as any).singleAgain.isOwner) {
      return {
        ...post,
        userId: '',
        user: {
          id: '',
          name: `Someone in ${(post as any).singleAgain.city || 'their city'}`,
          username: '',
          profilePicture: null,
        },
      };
    }
    return {
      ...post,
      user: byId.get(post.userId) ?? (post as any).user ?? null,
    };
  });
}

export const likeDatingPost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { postId } = req.params;
    await likePost(postId);
    const post = await getPostById(postId);
    if (post && userId) await recordFeedLike(userId, post);
    if (post && userId && post.userId && String(post.userId) !== String(userId)) {
      const liker = await getUserById(userId);
      sendPushToUser(post.userId, {
        title: 'New like',
        body: liker ? `${liker.name} liked your post` : 'Someone liked your post',
        data: { type: 'new_like', postId, fromUserId: userId },
      }, 'likes').catch(() => {});
    }
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
    const userName = user?.name?.trim() || 'Someone';

    const replyToId = typeof req.body.replyToId === 'string' ? req.body.replyToId.trim() : '';
    const replyToUserNameRaw =
      typeof req.body.replyToUserName === 'string' ? sanitizeForStorage(req.body.replyToUserName, 80) : '';
    const existing = await getPostById(postId);
    if (!existing) {
      return res.status(404).json({ error: 'Post not found' });
    }
    const parent = replyToId ? (existing.comments || []).find((c) => c.id === replyToId) : null;

    await addComment(postId, {
      userId,
      userName,
      content,
      replyToId: parent ? parent.id : null,
      replyToUserName: parent ? parent.userName : replyToUserNameRaw || null,
    });

    const post = await getPostById(postId);
    if (post) await recordFeedComment(userId, post);
    if (post && post.userId && String(post.userId) !== String(userId)) {
      sendPushToUser(post.userId, {
        title: 'New comment',
        body: `${userName} commented on your post`,
        data: { type: 'new_comment', postId, fromUserId: userId },
      }, 'likes').catch(() => {});
    }

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
