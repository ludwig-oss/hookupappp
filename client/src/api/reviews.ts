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

export type ReviewClaimStatus = 'none' | 'pending_innocent' | 'proven';

export interface ReviewCourtEvidence {
  summary: string;
  documentNote?: string | null;
  submittedAt: string;
}

export interface Review {
  id: string;
  fromUserId: string;
  toUserId: string;
  attributes: ReviewAttributes;
  overallStars: number;
  reviewText: string;
  replyText?: string | null;
  repliedAt?: string | null;
  createdAt: string;
  fromUserName?: string;
  isSeriousClaim?: boolean;
  claimStatus?: ReviewClaimStatus;
  courtEvidence?: ReviewCourtEvidence | null;
  source?: 'unmatch' | 'manual';
}

export interface OverallStarRating {
  averageStars: number;
  totalReviews: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export const reviewsAPI = {
  getPolicy: async (): Promise<{ disclaimer: string }> => {
    const res = await axios.get(`${API_URL}/policy`);
    return res.data;
  },

  getAttributeKeys: async (): Promise<{ attributes: string[] }> => {
    const res = await axios.get(`${API_URL}/attributes/keys`);
    return res.data;
  },

  getAttributes: async (
    userId: string
  ): Promise<{ attributes: ReviewAttributes; totalReviews: number; overall?: OverallStarRating }> => {
    const res = await axios.get(`${API_URL}/user/${userId}/attributes`);
    return res.data;
  },

  getOverallRating: async (userId: string): Promise<OverallStarRating> => {
    const res = await axios.get(`${API_URL}/user/${userId}/overall`);
    return res.data;
  },

  getReviews: async (userId: string): Promise<{ reviews: Review[]; overall: OverallStarRating }> => {
    const res = await axios.get(`${API_URL}/user/${userId}`);
    return res.data;
  },

  submitReview: async (data: {
    toUserId: string;
    overallStars: number;
    reviewText: string;
    disclaimerAccepted: boolean;
    source?: 'unmatch' | 'manual';
    attributes?: Partial<ReviewAttributes>;
  }): Promise<{ review: Review; seriousClaimNotice?: string | null }> => {
    const res = await axios.post(`${API_URL}/submit`, data);
    return res.data;
  },

  replyToReview: async (reviewId: string, replyText: string): Promise<{ review: Review }> => {
    const res = await axios.post(`${API_URL}/${reviewId}/reply`, { replyText });
    return res.data;
  },

  submitCourtEvidence: async (
    reviewId: string,
    data: { summary: string; documentNote?: string; confirmOfficial: boolean }
  ): Promise<{ review: Review }> => {
    const res = await axios.post(`${API_URL}/${reviewId}/court-evidence`, data);
    return res.data;
  },

  getMyReviewFor: async (otherUserId: string): Promise<{ review: Review | null }> => {
    const res = await axios.get(`${API_URL}/between/${otherUserId}`);
    return res.data;
  },
};
