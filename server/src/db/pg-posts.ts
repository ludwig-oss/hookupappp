import { query } from './index.js';
import type { DatingPost } from '../models/posts.js';

const BLOWING_UP_LIKES_THRESHOLD = 25;

function rowToPost(row: {
  id: string;
  user_id: string;
  type: string;
  content_type: string;
  content: string;
  title: string | null;
  tags: unknown;
  likes: number;
  shares: number;
  comments: unknown;
  created_at: Date;
}): DatingPost {
  const comments = (row.comments as any[]) || [];
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as 'warning' | 'positive',
    contentType: row.content_type as 'text' | 'video' | 'image',
    content: row.content,
    title: row.title ?? undefined,
    tags: Array.isArray(row.tags) ? row.tags : [],
    likes: Number(row.likes) || 0,
    shares: Number(row.shares) || 0,
    comments: comments.map((c: any) => ({
      ...c,
      createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
    })),
    createdAt: row.created_at,
  };
}

export async function getFeedPosts(options?: {
  userId?: string | null;
  mode?: import('../models/feedAlgorithm.js').FeedMode;
}): Promise<import('../models/feedAlgorithm.js').RankedPost[]> {
  const res = await query<{
    id: string;
    user_id: string;
    type: string;
    content_type: string;
    content: string;
    title: string | null;
    tags: unknown;
    likes: number;
    shares: number;
    comments: unknown;
    created_at: Date;
  }>('SELECT * FROM dating_posts ORDER BY created_at DESC');
  const posts = res.rows.map(rowToPost);
  const { attachViewCounts } = await import('../models/feedEngagement.js');
  const { rankFeedPosts } = await import('../models/feedAlgorithm.js');
  const { getUserFeedProfile } = await import('../models/feedEngagement.js');
  const withViews = await attachViewCounts(posts);
  const profile = options?.userId ? await getUserFeedProfile(options.userId) : null;
  const { posts: ranked } = rankFeedPosts(withViews, {
    userId: options?.userId,
    profile,
    mode: options?.mode || 'for_you',
  });
  return ranked;
}

export async function getBlowingUpCount(): Promise<number> {
  const res = await query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM dating_posts WHERE likes >= $1',
    [BLOWING_UP_LIKES_THRESHOLD]
  );
  return parseInt(res.rows[0]?.count ?? '0', 10);
}

export async function sharePost(postId: string): Promise<boolean> {
  const res = await query('UPDATE dating_posts SET shares = shares + 1 WHERE id = $1', [postId]);
  return (res.rowCount ?? 0) > 0;
}

export async function createPost(post: Omit<DatingPost, 'id' | 'createdAt' | 'likes' | 'shares' | 'comments'>): Promise<DatingPost> {
  const id = Date.now().toString();
  await query(
    `INSERT INTO dating_posts (id, user_id, type, content_type, content, title, tags, likes, shares, comments)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, '[]')`,
    [id, post.userId, post.type, post.contentType, post.content, post.title ?? null, JSON.stringify(post.tags || [])]
  );
  const out = await getPostById(id);
  if (!out) throw new Error('Post not found after insert');
  return out;
}

export async function getAllPosts(): Promise<DatingPost[]> {
  const res = await query<{
    id: string;
    user_id: string;
    type: string;
    content_type: string;
    content: string;
    title: string | null;
    tags: unknown;
    likes: number;
    shares: number;
    comments: unknown;
    created_at: Date;
  }>('SELECT * FROM dating_posts ORDER BY created_at DESC');
  return res.rows.map(rowToPost);
}

export async function getPostById(postId: string): Promise<DatingPost | null> {
  const res = await query<{
    id: string;
    user_id: string;
    type: string;
    content_type: string;
    content: string;
    title: string | null;
    tags: unknown;
    likes: number;
    shares: number;
    comments: unknown;
    created_at: Date;
  }>('SELECT * FROM dating_posts WHERE id = $1', [postId]);
  return res.rows[0] ? rowToPost(res.rows[0]) : null;
}

export async function likePost(postId: string): Promise<boolean> {
  const res = await query('UPDATE dating_posts SET likes = likes + 1 WHERE id = $1', [postId]);
  return (res.rowCount ?? 0) > 0;
}

export async function addComment(postId: string, comment: Omit<DatingPost['comments'][0], 'id' | 'createdAt'>): Promise<boolean> {
  const post = await getPostById(postId);
  if (!post) return false;
  const newComment = {
    id: Date.now().toString(),
    ...comment,
    createdAt: new Date(),
  };
  const comments = [...(post.comments || []), newComment];
  await query('UPDATE dating_posts SET comments = $1 WHERE id = $2', [JSON.stringify(comments), postId]);
  return true;
}

export async function deletePost(postId: string, userId: string): Promise<boolean> {
  const res = await query('DELETE FROM dating_posts WHERE id = $1 AND user_id = $2', [postId, userId]);
  return (res.rowCount ?? 0) > 0;
}
