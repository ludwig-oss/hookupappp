import axios from 'axios';

const API_URL = '/api/connection-journey';

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
}

export interface ConnectionJourneyState {
  id: string;
  startedAt: string;
  assignedStepIds?: string[];
  completedStepIds: string[];
}

export interface ConnectionJourneyResponse {
  journey: ConnectionJourneyState | null;
  nextStep: ConnectionJourneyStepInfo | null;
  currentDay: number;
  totalDays: number;
  allSteps?: { id: string; day: number; type: string; title: string; completed: boolean }[];
  completedStepId?: string;
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
};
