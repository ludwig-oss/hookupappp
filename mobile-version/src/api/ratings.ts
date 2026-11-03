import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/ratings';

export interface UserRating {
  id: string;
  ratedUserId: string;
  raterUserId: string;
  overallRating: number;
  characteristics: {
    communication: number;
    personality: number;
    compatibility: number;
    bedroom?: number;
    kissing?: number;
    humor: number;
    intelligence: number;
    kindness: number;
    confidence: number;
    attractiveness: number;
  };
  createdAt: string;
}

export interface AverageRatings {
  overallRating: number;
  characteristics: {
    communication: number;
    personality: number;
    compatibility: number;
    bedroom: number | null;
    kissing: number | null;
    humor: number;
    intelligence: number;
    kindness: number;
    confidence: number;
    attractiveness: number;
  };
  totalRatings: number;
}

export interface UnmatchReason {
  id: string;
  fromUserId: string;
  toUserId: string;
  reason: string;
  createdAt: string;
  viewed: boolean;
}

export const ratingsAPI = {
  submitRating: async (data: {
    ratedUserId: string;
    overallRating: number;
    characteristics: {
      communication: number;
      personality: number;
      compatibility: number;
      bedroom?: number;
      kissing?: number;
      humor: number;
      intelligence: number;
      kindness: number;
      confidence: number;
      attractiveness: number;
    };
    userId: string;
  }): Promise<{ message: string; rating: UserRating }> => {
    const response = await axios.post(`${API_URL}/submit`, data);
    return response.data;
  },

  getUserRatings: async (userId: string): Promise<{ ratings: UserRating[]; averages: AverageRatings }> => {
    const response = await axios.get(`${API_URL}/user/${userId}`);
    return response.data;
  },

  getAverageRatings: async (userId: string): Promise<AverageRatings> => {
    const response = await axios.get(`${API_URL}/user/${userId}/averages`);
    return response.data;
  },

  unmatchWithReason: async (data: {
    unmatchedUserId: string;
    reason: string;
    userId: string;
  }): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/unmatch`, data);
    return response.data;
  },

  getMyUnmatchReasons: async (userId: string): Promise<{ reasons: UnmatchReason[] }> => {
    const response = await axios.get(`${API_URL}/unmatch-reasons`, { params: { userId } });
    return response.data;
  },

  viewUnmatchReason: async (reasonId: string): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/unmatch-reasons/view`, { reasonId });
    return response.data;
  },
};
