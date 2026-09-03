import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/improvement';

export type GuideProgramGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface GuideProgramStatus {
  isGuide: boolean;
  needsOnboarding: boolean;
  needsGuidePick: boolean;
  waitingOnEval: boolean;
  needsCoupleGuide?: boolean;
  canUseApp: boolean;
  categoryIds: string[];
  startedAt: string | null;
  evalDueAt: string | null;
  evaluatedAt: string | null;
  grade: string | null;
  progressed: boolean | null;
  guideId: string | null;
  message: string;
}

export interface PendingClientEval {
  userId: string;
  userName: string;
  categoryIds: string[];
  startedAt: string;
  evalDueAt: string;
}

export const guideProgramAPI = {
  getStatus: async (): Promise<GuideProgramStatus> => {
    const response = await axios.get(`${API_URL}/guide-program`);
    return response.data;
  },

  saveAreas: async (categoryIds: string[]): Promise<GuideProgramStatus> => {
    const response = await axios.post(`${API_URL}/guide-program/areas`, { categoryIds });
    return response.data;
  },

  saveCoupleAreas: async (categoryIds: string[]): Promise<GuideProgramStatus> => {
    const response = await axios.post(`${API_URL}/guide-program/couple-areas`, { categoryIds });
    return response.data;
  },

  getPendingEvals: async (): Promise<{ pending: PendingClientEval[] }> => {
    const response = await axios.get(`${API_URL}/guide-program/pending-evals`);
    return response.data;
  },

  evaluateClient: async (
    clientUserId: string,
    progressed: boolean,
    grade: GuideProgramGrade
  ): Promise<{ message: string; status: GuideProgramStatus }> => {
    const response = await axios.post(`${API_URL}/guide-program/evaluate`, {
      clientUserId,
      progressed,
      grade,
    });
    return response.data;
  },
};
