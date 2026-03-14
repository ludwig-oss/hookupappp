import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/reviews';

export const REVIEW_ATTRIBUTE_LABELS: Record<string, string> = {
  personality: 'Personality',
  fashion: 'Fashion',
  cooking: 'Cooking',
  communication: 'Communication',
  angerManagement: 'Anger management',
  dancing: 'Dancing',
  humor: 'Humor',
  kindness: 'Kindness',
  listening: 'Listening',
  romance: 'Romance',
  reliability: 'Reliability',
  conflictResolution: 'Conflict resolution',
  decisionMaking: 'Decision making',
  relationshipHandling: 'Relationship',
  stressHandling: 'Stress handling',
  protection: 'Protection',
  goodInBed: 'Intimacy',
};

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
  fromUserName?: string;
}

export const reviewsAPI = {
  getAttributeKeys: async (): Promise<{ attributes: string[] }> => {
    const res = await axios.get(`${API_URL}/attributes/keys`);
    return res.data;
  },

  getAttributes: async (userId: string): Promise<{ attributes: ReviewAttributes; totalReviews: number }> => {
    const res = await axios.get(`${API_URL}/user/${userId}/attributes`);
    return res.data;
  },

  getReviews: async (userId: string): Promise<{ reviews: Review[] }> => {
    const res = await axios.get(`${API_URL}/user/${userId}`);
    return res.data;
  },

  submitReview: async (toUserId: string, attributes: Partial<ReviewAttributes>, reviewText: string): Promise<{ review: Review }> => {
    const res = await axios.post(`${API_URL}/submit`, { toUserId, attributes, reviewText });
    return res.data;
  },

  replyToReview: async (reviewId: string, replyText: string): Promise<{ review: Review }> => {
    const res = await axios.post(`${API_URL}/${reviewId}/reply`, { replyText });
    return res.data;
  },
};
