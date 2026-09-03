import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { usePostgres } from '../db/index.js';
import * as pgPosts from '../db/pg-posts.js';

export interface DatingPost {
  id: string;
  userId: string;
  type: 'warning' | 'positive';
  contentType: 'text' | 'video' | 'image';
  content: string; // Text content or video/image URL
  title?: string;
  tags?: string[];
  likes: number;
  shares: number;
  comments: Array<{
    id: string;
    userId: string;
    userName: string;
    content: string;
    createdAt: Date | string;
    replyToId?: string | null;
    replyToUserName?: string | null;
  }>;
  createdAt: Date | string;
  user?: {
    id: string;
    name: string;
    username: string;
    profilePicture: string | null;
  };
}

const BLOWING_UP_LIKES_THRESHOLD = 25;

const POSTS_PATH = join(process.cwd(), 'server', 'data', 'dating-posts.json');

async function readPosts(): Promise<DatingPost[]> {
  try {
    const data = await readFile(POSTS_PATH, 'utf-8');
    const posts = JSON.parse(data);
    return posts.map((post: DatingPost) => ({
      ...post,
      likes: post.likes ?? 0,
      shares: post.shares ?? 0,
      createdAt: post.createdAt ? new Date(post.createdAt) : new Date(),
      comments: (post.comments || []).map((c: any) => ({
        ...c,
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
      })),
    }));
  } catch {
    return [];
  }
}

/** Hybrid YouTube + Twitter + TikTok feed ranking (personalized when userId provided). */
export async function getFeedPosts(options?: {
  userId?: string | null;
  mode?: import('./feedAlgorithm.js').FeedMode;
}): Promise<import('./feedAlgorithm.js').RankedPost[]> {
  if (usePostgres()) return pgPosts.getFeedPosts(options);
  const { attachViewCounts } = await import('./feedEngagement.js');
  const { rankFeedPosts } = await import('./feedAlgorithm.js');
  const { getUserFeedProfile } = await import('./feedEngagement.js');

  const posts = await readPosts();
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
  if (usePostgres()) return pgPosts.getBlowingUpCount();
  const posts = await readPosts();
  return posts.filter((p) => (p.likes || 0) >= BLOWING_UP_LIKES_THRESHOLD).length;
}

export async function sharePost(postId: string): Promise<boolean> {
  if (usePostgres()) return pgPosts.sharePost(postId);
  const posts = await readPosts();
  const i = posts.findIndex((p) => p.id === postId);
  if (i === -1) return false;
  posts[i].shares = (posts[i].shares || 0) + 1;
  await writePosts(posts);
  return true;
}

async function writePosts(posts: DatingPost[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(POSTS_PATH, JSON.stringify(posts, null, 2));
}

export async function createPost(post: Omit<DatingPost, 'id' | 'createdAt' | 'likes' | 'shares' | 'comments'>): Promise<DatingPost> {
  if (usePostgres()) return pgPosts.createPost(post);
  const posts = await readPosts();
  const newPost: DatingPost = {
    ...post,
    id: Date.now().toString(),
    likes: 0,
    shares: 0,
    comments: [],
    createdAt: new Date(),
  };
  posts.unshift(newPost); // Add to beginning for newest first
  await writePosts(posts);
  return newPost;
}

export async function getAllPosts(): Promise<DatingPost[]> {
  if (usePostgres()) return pgPosts.getAllPosts();
  return readPosts();
}

export async function getPostById(postId: string): Promise<DatingPost | null> {
  if (usePostgres()) return pgPosts.getPostById(postId);
  const posts = await readPosts();
  return posts.find(p => p.id === postId) || null;
}

export async function likePost(postId: string): Promise<boolean> {
  if (usePostgres()) return pgPosts.likePost(postId);
  const posts = await readPosts();
  const postIndex = posts.findIndex(p => p.id === postId);
  if (postIndex !== -1) {
    posts[postIndex].likes = (posts[postIndex].likes || 0) + 1;
    await writePosts(posts);
    return true;
  }
  return false;
}

export async function addComment(postId: string, comment: Omit<DatingPost['comments'][0], 'id' | 'createdAt'>): Promise<boolean> {
  if (usePostgres()) return pgPosts.addComment(postId, comment);
  const posts = await readPosts();
  const postIndex = posts.findIndex(p => p.id === postId);
  if (postIndex !== -1) {
    if (!posts[postIndex].comments) {
      posts[postIndex].comments = [];
    }
    posts[postIndex].comments.push({
      ...comment,
      id: Date.now().toString(),
      createdAt: new Date(),
    });
    await writePosts(posts);
    return true;
  }
  return false;
}

export async function deletePost(postId: string, userId: string): Promise<boolean> {
  if (usePostgres()) return pgPosts.deletePost(postId, userId);
  const posts = await readPosts();
  const filtered = posts.filter(p => !(p.id === postId && p.userId === userId));
  if (filtered.length < posts.length) {
    await writePosts(filtered);
    return true;
  }
  return false;
}




