import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/admin';

export interface SafetyReviewSummary {
  id: string;
  userId: string;
  userName: string;
  partnerName: string | null;
  meetAt: string;
  location: string;
  expectedBackAt: string;
  safetyCheckSubmittedAt: string | null;
  safetyCheckStatus: string;
  hasIdOnFile: boolean;
  hasSafetyVideo: boolean;
}

export const adminAPI = {
  checkAccess: async (): Promise<{ admin: boolean }> => {
    const response = await axios.get(`${API_URL}/access`);
    return response.data;
  },

  listSafetyReviews: async (): Promise<{ reviews: SafetyReviewSummary[] }> => {
    const response = await axios.get(`${API_URL}/safety-reviews`);
    return response.data;
  },

  getSafetyReview: async (
    planId: string
  ): Promise<{
    plan: SafetyReviewSummary;
    userName: string;
    partnerName: string | null;
    idFront: string | null;
    idBack: string | null;
    safetyVideo: string | null;
  }> => {
    const response = await axios.get(`${API_URL}/safety-reviews/${planId}`);
    return response.data;
  },

  decideSafetyReview: async (
    planId: string,
    decision: 'approved' | 'rejected'
  ): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/safety-reviews/${planId}/decide`, { decision });
    return response.data;
  },

  listCoachApplications: async (): Promise<{ applications: Array<Record<string, unknown>> }> => {
    const response = await axios.get(`${API_URL}/coach-applications`);
    return response.data;
  },

  approveCoachApplication: async (applicationId: string, coachStarRating?: number): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/coach-applications/approve`, { applicationId, coachStarRating });
    return response.data;
  },

  rejectCoachApplication: async (applicationId: string): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/coach-applications/reject`, { applicationId });
    return response.data;
  },
};
