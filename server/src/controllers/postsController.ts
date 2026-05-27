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

    // Get user info for the post
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

/** Feed sorted by engagement + recency (TikTok/Instagram style) */
export const getFeed = async (req: Request, res: Response) => {
  try {
    const posts = await getFeedPosts();
    const enrichedPosts = await enrichPostsWithUser(posts);
    res.json({ posts: enrichedPosts });
  } catch (error) {
    console.error('Get feed error:', error);
    res.json({ posts: [] });
  }
};

/** Count of posts that have "blown up" (likes >= threshold) for badge */
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
    const { postId } = req.params;
    await sharePost(postId);
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
    const { postId } = req.params;
    await likePost(postId);
    res.json({ message: 'Post liked' });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const commentOnPost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
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

    res.json({ message: 'Comment added' });
  } catch (error) {
    console.error('Comment on post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteDatingPost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
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




