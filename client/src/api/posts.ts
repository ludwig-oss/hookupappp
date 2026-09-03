import axios from 'axios';
import { API_BASE, MEDIA_API_BASE } from './config';

const API_URL = API_BASE + '/api/posts';
const WRITE_API_URL = `${MEDIA_API_BASE || API_BASE}/api/posts`;

/** Feed can wait on cold Render wake-up; avoid infinite "Loading feed…" */
const FEED_TIMEOUT_MS = 25_000;

function getAuthHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

export type FeedMode = 'for_you' | 'trending' | 'videos' | 'following';

export interface DatingPost {
  id: string;
  userId: string;
  type: 'warning' | 'positive';
  contentType: 'text' | 'video' | 'image';
  content: string;
  title?: string;
  tags?: string[];
  likes: number;
  shares?: number;
  views?: number;
  feedScore?: number;
  feedReason?: string;
  comments: Array<{
    id: string;
    userId: string;
    userName: string;
    content: string;
    createdAt: string;
    replyToId?: string | null;
    replyToUserName?: string | null;
  }>;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    username: string;
    profilePicture: string | null;
  };
  singleAgain?: {
    postId: string;
    city: string;
    reason: string;
    photoUrl: string | null;
    interestClosesAt: string;
    interestCount: number;
    hasEntered: boolean;
    drawn: boolean;
    luckyCount: number;
    isOwner: boolean;
    iAmLucky: boolean;
    healHold: boolean;
    healNote: string | null;
    hoursLeft: number;
  };
}

export const postsAPI = {
  getPosts: async (): Promise<{ posts: DatingPost[] }> => {
    const response = await axios.get(API_URL);
    return response.data;
  },

  getPostsByUser: async (userId: string): Promise<{ posts: DatingPost[] }> => {
    const { posts } = await postsAPI.getPosts();
    const uid = String(userId);
    return {
      posts: posts.filter((p) => String(p.userId) === uid || String(p.user?.id || '') === uid),
    };
  },

  getFeed: async (mode: FeedMode = 'for_you'): Promise<{
    posts: DatingPost[];
    feedMeta?: { mode: string; personalized: boolean; trendingTags: string[]; description?: string };
  }> => {
    const response = await axios.get(`${API_URL}/feed`, { params: { mode }, timeout: FEED_TIMEOUT_MS, headers: getAuthHeaders() });
    return response.data;
  },

  getRecommendations: async (): Promise<{ recommendations: DatingPost[]; trendingTags: string[] }> => {
    const response = await axios.get(`${API_URL}/recommendations`, { headers: getAuthHeaders() });
    return response.data;
  },

  recordView: async (postId: string): Promise<void> => {
    await axios.post(`${API_URL}/${postId}/view`, {}, { headers: getAuthHeaders() });
  },

  getBlowingUpCount: async (): Promise<{ count: number }> => {
    const response = await axios.get(`${API_URL}/blowing-up-count`);
    return response.data;
  },

  createPost: async (data: {
    type: 'warning' | 'positive';
    contentType: 'text' | 'video' | 'image';
    content: string;
    title?: string;
    tags?: string[];
  }): Promise<{ post: DatingPost }> => {
    const response = await axios.post(WRITE_API_URL, data, {
      headers: getAuthHeaders(),
      timeout: 60_000,
    });
    return response.data;
  },

  likePost: async (postId: string): Promise<void> => {
    await axios.post(`${WRITE_API_URL}/${postId}/like`, {}, { headers: getAuthHeaders() });
  },

  commentOnPost: async (
    postId: string,
    content: string,
    replyTo?: { id: string; userName: string } | null
  ): Promise<void> => {
    await axios.post(
      `${WRITE_API_URL}/${postId}/comment`,
      {
        content,
        replyToId: replyTo?.id || undefined,
        replyToUserName: replyTo?.userName || undefined,
      },
      { headers: getAuthHeaders() }
    );
  },

  sharePost: async (postId: string): Promise<void> => {
    await axios.post(`${WRITE_API_URL}/${postId}/share`, {}, { headers: getAuthHeaders() });
  },

  deletePost: async (postId: string): Promise<void> => {
    await axios.delete(`${WRITE_API_URL}/${postId}`, { headers: getAuthHeaders() });
  },
};




