import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/posts';

/** Feed can wait on cold Render wake-up; avoid infinite "Loading feed…" */
const FEED_TIMEOUT_MS = 25_000;

function getAuthHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

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
  comments: Array<{
    id: string;
    userId: string;
    userName: string;
    content: string;
    createdAt: string;
  }>;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    username: string;
    profilePicture: string | null;
  };
}

export const postsAPI = {
  getPosts: async (): Promise<{ posts: DatingPost[] }> => {
    const response = await axios.get(API_URL);
    return response.data;
  },

  getFeed: async (): Promise<{ posts: DatingPost[] }> => {
    const response = await axios.get(`${API_URL}/feed`, { timeout: FEED_TIMEOUT_MS });
    return response.data;
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
    const response = await axios.post(API_URL, data, { headers: getAuthHeaders() });
    return response.data;
  },

  likePost: async (postId: string): Promise<void> => {
    await axios.post(`${API_URL}/${postId}/like`, {}, { headers: getAuthHeaders() });
  },

  commentOnPost: async (postId: string, content: string): Promise<void> => {
    await axios.post(`${API_URL}/${postId}/comment`, { content }, { headers: getAuthHeaders() });
  },

  sharePost: async (postId: string): Promise<void> => {
    await axios.post(`${API_URL}/${postId}/share`, {}, { headers: getAuthHeaders() });
  },

  deletePost: async (postId: string): Promise<void> => {
    await axios.delete(`${API_URL}/${postId}`, { headers: getAuthHeaders() });
  },
};




