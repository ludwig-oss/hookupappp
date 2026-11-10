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
}

export interface SpotlightCard {
  userId: string;
  bestQuality: string;
  futurePlans: string;
  polishedQuality: string;
  polishedFuture: string;
}

export const datingBattleAPI = {
  getState: async (): Promise<BattleState> => (await axios.get(`${API_URL}/state`)).data,
  saveProfile: async (profile: Partial<BattleProfile>): Promise<BattleState> =>
    (await axios.put(`${API_URL}/profile`, profile)).data,
  start: async (): Promise<BattleState> => (await axios.post(`${API_URL}/start`)).data,
  confirm: async (battleId: string): Promise<BattleState> =>
    (await axios.post(`${API_URL}/${battleId}/confirm`)).data,
  eject: async (battleId: string, reason: string): Promise<BattleState> =>
    (await axios.post(`${API_URL}/${battleId}/eject`, { reason })).data,
  prompt: async (battleId: string): Promise<BattleState> =>
    (await axios.post(`${API_URL}/${battleId}/prompt`)).data,
  resolve: async (battleId: string): Promise<BattleState> =>
    (await axios.post(`${API_URL}/${battleId}/resolve`)).data,
  completeCoach: async (body: { quality: string; plans: string; opener: string }): Promise<BattleState> =>
    (await axios.post(`${API_URL}/coach/complete`, body)).data,
  spotlight: async (userIds: string[]): Promise<{ cards: SpotlightCard[] }> =>
    (await axios.post(`${API_URL}/spotlight`, { userIds })).data,
  checkout: async (): Promise<{ url: string; sessionId: string; priceEur: number }> =>
    (await axios.post(`${API_URL}/checkout`)).data,
  confirmPayment: async (sessionId: string) =>
    (await axios.post(`${API_URL}/confirm-payment`, { sessionId })).data as {
      paid: boolean;
      triesLeft: number;
      alreadyCredited: boolean;
    },
};
