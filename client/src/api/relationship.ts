import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/relationship';

export interface RelationshipState {
  id: string;
  status: 'pending' | 'active' | 'ended';
  partnerUserId: string;
  partnerName: string | null;
  partnerProfilePicture: string | null;
  confirmedAt?: string;
  userConfirmedDating?: boolean;
  partnerConfirmedDating?: boolean;
  userConfirmedEnd?: boolean;
  partnerConfirmedEnd?: boolean;
}

export const relationshipAPI = {
  getMyRelationship: async (): Promise<{ relationship: RelationshipState | null }> => {
    const response = await axios.get(API_URL);
    return response.data;
  },

  confirmDating: async (partnerUserId: string): Promise<{ relationship: RelationshipState }> => {
    const response = await axios.post(`${API_URL}/confirm-dating`, { partnerUserId });
    return response.data;
  },

  confirmEnd: async (partnerUserId: string): Promise<{ relationship: { id: string; status: string; endedAt?: string } }> => {
    const response = await axios.post(`${API_URL}/confirm-end`, { partnerUserId });
    return response.data;
  },

  getDetectionPrompt: async (partnerUserId: string): Promise<{ shouldAskIfDating: boolean; shouldAskIfEnded: boolean }> => {
    const response = await axios.get(`${API_URL}/detect-prompt/${partnerUserId}`);
    return response.data;
  },

  getTipOfDay: async (): Promise<{ tip: string }> => {
    const response = await axios.get(`${API_URL}/tip`);
    return response.data;
  },

  getTopicSuggestion: async (): Promise<{ topic: string }> => {
    const response = await axios.get(`${API_URL}/topic`);
    return response.data;
  },

  getDateIdea: async (): Promise<{ idea: string }> => {
    const response = await axios.get(`${API_URL}/date-idea`);
    return response.data;
  },

  getCheckInPrompt: async (): Promise<{ shouldShow: boolean; relationshipId?: string }> => {
    const response = await axios.get(`${API_URL}/check-in-prompt`);
    return response.data;
  },

  submitCheckIn: async (relationshipId: string, goingWell: boolean, problemText?: string): Promise<{ solutions?: string[] }> => {
    const response = await axios.post(`${API_URL}/check-in`, {
      relationshipId,
      goingWell,
      problemText: problemText || undefined,
    });
    return response.data;
  },

  getSolutions: async (problem: string): Promise<{ solutions: string[] }> => {
    const response = await axios.get(`${API_URL}/solutions`, { params: { problem } });
    return response.data;
  },

  getRelationshipStatus: async (userId: string): Promise<{ inRelationship: boolean }> => {
    const response = await axios.get(`${API_URL}/status/${userId}`);
    return response.data;
  },

  getCoupleHub: async (partnerUserId: string) => {
    const response = await axios.get(`${API_URL}/couple-hub/${partnerUserId}`);
    return response.data as {
      health: {
        score: number;
        baseScore?: number;
        boostPoints?: number;
        level: string;
        label: string;
        message: string;
        needsChargeUp: boolean;
        selfControlTip: string | null;
        recentBoosts?: Array<{ label: string; points: number; createdAt: string }>;
      };
      blindDate: string | null;
      surprises: { forYou: string; forPartner: string };
      suggestGuide: boolean;
      guideMessage: string;
      games: Array<{ type: string; name: string; description: string }>;
      coupleQuiz: Array<{ q: string; a: string; b: string }>;
      bondingActivities?: Array<{ id: string; emoji: string; title: string; prompt: string; messageTemplate: string }>;
      extraActivities?: Array<{ id: string; category: 'game' | 'bonding'; emoji: string; title: string; prompt: string; messageTemplate: string }>;
      relationshipId: string;
    };
  },

  acceptBlindDate: async (relationshipId: string, idea: string) => {
    const response = await axios.post(`${API_URL}/blind-date`, { relationshipId, idea });
    return response.data;
  },

  recordHealthBoost: async (relationshipId: string, activity: string) => {
    const response = await axios.post(`${API_URL}/health-boost`, { relationshipId, activity });
    return response.data as {
      message: string;
      boost: { points: number; label: string };
      health: { score: number; baseScore: number; boostPoints: number; level: string; label: string; message: string };
    };
  },

  getCheatWarning: async (otherUserId: string) => {
    const response = await axios.get(`${API_URL}/cheat-warning/${otherUserId}`);
    return response.data as {
      shouldWarn: boolean;
      title?: string;
      body?: string;
      risks?: string[];
      selfControl?: string;
    };
  },
};
