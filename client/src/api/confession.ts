import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/confession';

export interface ConfessionMessage {
  id: string;
  fromRole: 'seeker' | 'guide';
  alias: string;
  content: string;
  createdAt: string;
}

export interface ConfessionSessionView {
  id: string;
  role: 'seeker' | 'guide' | null;
  seekerAlias: string;
  guideAlias: string | null;
  amountEur: 5 | 10;
  paymentStatus: 'pending' | 'paid';
  status: string;
  messages: ConfessionMessage[];
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export const confessionAPI = {
  getInfo: async () => {
    const res = await axios.get(`${API_URL}/info`);
    return res.data as {
      seekerSafetyAgreement: string;
      guideNdaAgreement: string;
      prices: number[];
      split: { guidePercent: number; platformPercent: number };
    };
  },

  getGuidePrefs: async () => {
    const res = await axios.get(`${API_URL}/guide/prefs`);
    return res.data as {
      isGuide: boolean;
      prefs: { enabled: boolean; ndaSignedAt: string | null };
      pendingSessions: ConfessionSessionView[];
      guideNdaAgreement: string;
    };
  },

  setGuidePrefs: async (enabled: boolean, ndaSignature?: string) => {
    const res = await axios.put(`${API_URL}/guide/prefs`, { enabled, ndaSignature });
    return res.data;
  },

  listSessions: async () => {
    const res = await axios.get(`${API_URL}/sessions`);
    return res.data as { sessions: ConfessionSessionView[] };
  },

  createSession: async (amountEur: 5 | 10, safetySignature: string) => {
    const res = await axios.post(`${API_URL}/sessions`, { amountEur, safetySignature });
    return res.data as { session: ConfessionSessionView };
  },

  getSession: async (sessionId: string) => {
    const res = await axios.get(`${API_URL}/sessions/${sessionId}`);
    return res.data as { session: ConfessionSessionView };
  },

  createPayPalOrder: async (sessionId: string) => {
    const res = await axios.post(`${API_URL}/sessions/${sessionId}/paypal/create-order`);
    return res.data as { orderId: string; approvalUrl?: string };
  },

  capturePayPalOrder: async (sessionId: string, orderId: string) => {
    const res = await axios.post(`${API_URL}/sessions/${sessionId}/paypal/capture`, { orderId, sessionId });
    return res.data as { session: ConfessionSessionView; message: string };
  },

  acceptSession: async (sessionId: string, ndaSignature: string) => {
    const res = await axios.post(`${API_URL}/sessions/${sessionId}/accept`, { ndaSignature });
    return res.data as { session: ConfessionSessionView };
  },

  sendMessage: async (sessionId: string, content: string) => {
    const res = await axios.post(`${API_URL}/sessions/${sessionId}/messages`, { content });
    return res.data as { session: ConfessionSessionView; message: ConfessionMessage };
  },

  endSession: async (sessionId: string) => {
    const res = await axios.post(`${API_URL}/sessions/${sessionId}/end`);
    return res.data as { session: ConfessionSessionView };
  },
};
