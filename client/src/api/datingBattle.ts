import axios from 'axios';
import { API_BASE } from './config';

const API_URL = `${API_BASE}/api/dating-battle`;

export interface PersonCard {
  id: string;
  name: string;
  username: string;
  age: number | null;
  profilePicture: string | null;
  city: string | null;
  distanceKm: number | null;
  bestQuality: string;
  futurePlans: string;
  polishedQuality: string;
  polishedFuture: string;
  workingOnSelf: boolean;
}

export interface BattleView {
  id: string;
  status: 'live' | 'matched' | 'ejected';
  phase: 'wingman' | 'ejection' | 'matched' | 'ejected';
  startedAt: string;
  wingmanEndsAt: string;
  ejectEndsAt: string;
  serverNow: string;
  prompt: { id: string; text: string };
  me: PersonCard;
  partner: PersonCard;
  myConfirmed: boolean;
  partnerConfirmed: boolean;
  ejectedByMe: boolean;
  youWereRejected: boolean;
  ejectReason: string | null;
  matchedUserId: string | null;
}

export interface BattleProfile {
  searchText: string;
  maxDistanceKm: number;
  bestQuality: string;
  futurePlans: string;
  workingOnSelf: boolean;
}

export interface CoachStep {
  id: string;
  title: string;
  body: string;
  field?: 'quality' | 'plans' | 'opener';
  options?: string[];
}

export interface BattleState {
  profile: BattleProfile;
  triesLeft: number;
  freeRemaining: number;
  paidRemaining: number;
  priceEur: number;
  packRounds: number;
  coachLocked: boolean;
  coach: { steps: CoachStep[]; rejectionsInWindow: number } | null;
  tips: string[] | null;
  coachOpener: string | null;
  battle: BattleView | null;
  outcome: BattleView | null;
  preview: PersonCard | null;
  allocationNote: string | null;
  blocked: { code: 'underage' | 'need_gender' | 'need_age'; message: string } | null;
  emptyReason: string | null;
  searching?: boolean;
  pairMode?: 'age' | 'hot' | 'random';
  searchingSince?: string | null;
}

export interface SpotlightCard {
  userId: string;
  bestQuality: string;
  futurePlans: string;
  polishedQuality: string;
  polishedFuture: string;
}

export const datingBattleAPI = {
  getState: async (): Promise<BattleState> => {
    const res = await axios.get(`${API_URL}/state`);
    return res.data;
  },
  saveProfile: async (profile: Partial<BattleProfile>): Promise<BattleState> => {
    const res = await axios.put(`${API_URL}/profile`, profile);
    return res.data;
  },
  start: async (mode?: 'age' | 'hot' | 'random'): Promise<BattleState> => {
    const res = await axios.post(`${API_URL}/start`, mode ? { mode } : {});
    return res.data;
  },
  shuffle: async (reason: string, mode: 'age' | 'hot' | 'random'): Promise<BattleState> => {
    const res = await axios.post(`${API_URL}/shuffle`, { reason, mode });
    return res.data;
  },
  confirm: async (battleId: string): Promise<BattleState> => {
    const res = await axios.post(`${API_URL}/${battleId}/confirm`);
    return res.data;
  },
  eject: async (battleId: string, reason: string): Promise<BattleState> => {
    const res = await axios.post(`${API_URL}/${battleId}/eject`, { reason });
    return res.data;
  },
  prompt: async (battleId: string): Promise<BattleState> => {
    const res = await axios.post(`${API_URL}/${battleId}/prompt`);
    return res.data;
  },
  resolve: async (battleId: string): Promise<BattleState> => {
    const res = await axios.post(`${API_URL}/${battleId}/resolve`);
    return res.data;
  },
  completeCoach: async (body: { quality: string; plans: string; opener: string }): Promise<BattleState> => {
    const res = await axios.post(`${API_URL}/coach/complete`, body);
    return res.data;
  },
  spotlight: async (userIds: string[]): Promise<{ cards: SpotlightCard[] }> => {
    const res = await axios.post(`${API_URL}/spotlight`, { userIds });
    return res.data;
  },
  checkout: async (): Promise<{ url: string; sessionId: string; priceEur: number }> => {
    const res = await axios.post(`${API_URL}/checkout`);
    return res.data;
  },
  confirmPayment: async (sessionId: string) => {
    const res = await axios.post(`${API_URL}/confirm-payment`, { sessionId });
    return res.data as { paid: boolean; triesLeft: number; alreadyCredited: boolean };
  },
};
