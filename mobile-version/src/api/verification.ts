import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/verification';

export interface Verification {
  userId: string;
  email: {
    verified: boolean;
    verifiedAt: string | null;
    verificationCode: string | null;
    codeExpiry: string | null;
  };
  phone: {
    verified: boolean;
    phoneNumber: string | null;
    verifiedAt: string | null;
    verificationCode: string | null;
    codeExpiry: string | null;
  };
  social: {
    google: { connected: boolean; email: string | null; connectedAt: string | null };
    facebook: { connected: boolean; email: string | null; connectedAt: string | null };
    instagram: { connected: boolean; username: string | null; connectedAt: string | null };
  };
  id: {
    verified: boolean;
    verifiedAt: string | null;
    documentUrl: string | null;
    status: 'pending' | 'approved' | 'rejected' | null;
  };
}

export const verificationAPI = {
  getStatus: async (): Promise<{ verification: Verification }> => {
    const response = await axios.get(API_URL);
    return response.data;
  },

  sendEmailVerification: async (): Promise<{ message: string; code?: string }> => {
    const response = await axios.post(`${API_URL}/email/send`);
    return response.data;
  },

  verifyEmail: async (code: string): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/email/verify`, { code });
    return response.data;
  },

  sendPhoneVerification: async (phoneNumber: string): Promise<{ message: string; code?: string }> => {
    const response = await axios.post(`${API_URL}/phone/send`, { phoneNumber });
    return response.data;
  },

  verifyPhone: async (code: string): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/phone/verify`, { code });
    return response.data;
  },

  connectSocial: async (provider: 'google' | 'facebook' | 'instagram', emailOrUsername: string): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/social/connect`, { provider, emailOrUsername });
    return response.data;
  },

  disconnectSocial: async (provider: 'google' | 'facebook' | 'instagram'): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/social/disconnect`, { provider });
    return response.data;
  },

  uploadId: async (documentUrl: string): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/id/upload`, { documentUrl });
    return response.data;
  },
};



