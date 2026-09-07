import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/connection-journey';

export interface ConnectionJourneyStepInfo {
  id: string;
  day: number;
  type: 'challenge' | 'game' | 'quiz' | 'gift' | 'surprise' | 'deep';
  title: string;
  subtitle: string;
  instructions: string;
  chatPrompt?: string;
  quizQuestion?: string;
  options?: string[];
  playAction?: 'xo' | 'would-you-rather' | 'truth-or-dare';
}

export interface ConnectionJourneyState {
  id: string;
  startedAt: string;
  assignedStepIds?: string[];
  completedStepIds: string[];
  saidHiUserIds?: string[];
  hostMode?: 'offer' | 'their_turn' | 'host_asks' | 'quiet';
  hostMuted?: boolean;
}

export interface ConnectionHostScript {
  headline: string;
  body: string;
  actions: string[];
}

export interface ConnectionJourneyResponse {
  journey: ConnectionJourneyState | null;
  nextStep: ConnectionJourneyStepInfo | null;
  currentDay: number;
  totalDays: number;
  allSteps?: { id: string; day: number; type: string; title: string; completed: boolean }[];
  completedStepId?: string;
  phase?: 'say_hi' | 'connecting' | 'complete';
  hostMode?: 'offer' | 'their_turn' | 'host_asks' | 'quiet';
  hostMuted?: boolean;
  saidHiUserIds?: string[];
  host?: ConnectionHostScript;
  partnerName?: string;
}

export const connectionJourneyAPI = {
  getJourney: async (partnerUserId: string): Promise<ConnectionJourneyResponse> => {
    const response = await axios.get(`${API_URL}/${partnerUserId}`);
    return response.data;
  },

  startJourney: async (partnerUserId: string): Promise<ConnectionJourneyResponse> => {
    const response = await axios.post(`${API_URL}/start`, { partnerUserId });
    return response.data;
  },

  completeStep: async (partnerUserId: string, stepId: string): Promise<ConnectionJourneyResponse> => {
    const response = await axios.post(`${API_URL}/complete`, { partnerUserId, stepId });
    return response.data;
  },

  saidHi: async (partnerUserId: string): Promise<ConnectionJourneyResponse> => {
    const response = await axios.post(`${API_URL}/said-hi`, { partnerUserId });
    return response.data;
  },

  hostChoice: async (
    partnerUserId: string,
    choice: 'ask_them' | 'host_asks' | 'offer' | 'quiet'
  ): Promise<ConnectionJourneyResponse> => {
    const response = await axios.post(`${API_URL}/host-choice`, { partnerUserId, choice });
    return response.data;
  },

  mute: async (partnerUserId: string, muted: boolean): Promise<ConnectionJourneyResponse> => {
    const response = await axios.post(`${API_URL}/mute`, { partnerUserId, muted });
    return response.data;
  },
};
