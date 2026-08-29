import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/walk-match';

export interface WalkSuggestion {
  id: string;
  name: string;
  profilePicture: string | null;
  age?: number;
  distance: number;
  matchReason: string;
  matchScore: number;
  tags: string[];
  /** True only when they are at home with nearby visibility turned on. */
  isOnline: boolean;
}

export interface WalkIncomingInterest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: string;
  createdAt: string;
  fromUser?: { id: string; name: string; profilePicture: string | null };
}

export interface WalkSuggestionsResponse {
  suggestions: WalkSuggestion[];
  needsLifeQuiz: boolean;
  outdoorWalkEnabled: boolean;
  nearbyDiscoverable: boolean;
  atHome: boolean;
  homeSet: boolean;
}

export const walkMatchAPI = {
  getSuggestions: async (lat: number, lon: number, radius = 120) => {
    const res = await axios.get(`${API_URL}/suggestions`, { params: { lat, lon, radius } });
    return res.data as WalkSuggestionsResponse;
  },

  updateLocation: async (lat: number, lon: number, accuracy?: number) => {
    await axios.post(`${API_URL}/location`, { lat, lon, accuracy });
  },

  sendInterest: async (toUserId: string) => {
    const res = await axios.post(`${API_URL}/interest`, { toUserId });
    return res.data as { mutual: boolean; chatUserId: string; message: string };
  },

  respondInterest: async (interestId: string, accept: boolean) => {
    const res = await axios.post(`${API_URL}/interest/respond`, { interestId, accept });
    return res.data as { mutual: boolean; chatUserId?: string };
  },

  getIncoming: async () => {
    const res = await axios.get(`${API_URL}/incoming`);
    return res.data as { incoming: WalkIncomingInterest[] };
  },

  submitLifeQuiz: async (data: {
    lifeStage: string;
    financialSituation: string;
    datingGoals: string;
    isFamousOrInfluencer: boolean;
    styleRating?: number;
  }) => {
    const res = await axios.post(`${API_URL}/life-quiz`, data);
    return res.data;
  },

  recordClick: async (targetUserId: string) => {
    await axios.post(`${API_URL}/profile-click`, { targetUserId });
  },

  recordImpression: async (targetUserId: string) => {
    await axios.post(`${API_URL}/profile-impression`, { targetUserId });
  },

  dismiss: async (toUserId: string) => {
    const res = await axios.post(`${API_URL}/dismiss`, { toUserId });
    return res.data as { message: string };
  },

  updateSettings: async (data: {
    outdoorWalkEnabled?: boolean;
    gender?: string;
    age?: number;
    nearbyDiscoverable?: boolean;
    setHome?: boolean;
    lat?: number;
    lon?: number;
  }) => {
    const res = await axios.patch(`${API_URL}/settings`, data);
    return res.data as { user: Record<string, unknown> };
  },
};
