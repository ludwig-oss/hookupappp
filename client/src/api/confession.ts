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
  guideDisplayLabel?: string | null;
  guideScope?: 'local' | 'international' | null;
  appointmentAt?: string | null;
  appointmentStatus?: 'pending' | 'accepted' | 'declined' | null;
  amountEur: 5 | 10;
  paymentStatus: 'pending' | 'paid';
  status: string;
  messages: ConfessionMessage[];
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  voiceCall?: {
    callerRole: 'seeker' | 'guide' | null;
    incoming: boolean;
    active: boolean;
  };
}

export interface BlurredConfessionGuide {
  id: string;
  label: string;
  rating: number;
  totalSessions: number;
  experienceSnippet: string;
  scope: 'local' | 'international';
}

export interface ConfessionCallState {
  callerRole: 'seeker' | 'guide' | null;
  offer: { type: 'offer' | 'answer'; sdp: string } | null;
  answer: { type: 'offer' | 'answer'; sdp: string } | null;
  ice: Array<{ id: string; fromRole: 'seeker' | 'guide'; candidate: string }>;
  incoming: boolean;
  active: boolean;
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

  listGuides: async (scope: 'local' | 'international') => {
    const res = await axios.get(`${API_URL}/guides`, { params: { scope } });
    return res.data as { guides: BlurredConfessionGuide[]; scope: 'local' | 'international' };
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

  createSession: async (data: {
    amountEur: 5 | 10;
    safetySignature: string;
    guideId: string;
    appointmentAt: string;
    guideScope: 'local' | 'international';
  }) => {
    const res = await axios.post(`${API_URL}/sessions`, data);
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

  respondAppointment: async (sessionId: string, accept: boolean) => {
    const res = await axios.post(`${API_URL}/sessions/${sessionId}/respond-appointment`, { accept });
    return res.data as { session: ConfessionSessionView };
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

  getCall: async (sessionId: string) => {
    const res = await axios.get(`${API_URL}/sessions/${sessionId}/call`);
    return res.data as { call: ConfessionCallState };
  },

  sendCallOffer: async (sessionId: string, sdp: string) => {
    const res = await axios.post(`${API_URL}/sessions/${sessionId}/call/offer`, { sdp });
    return res.data as { call: ConfessionCallState };
  },

  sendCallAnswer: async (sessionId: string, sdp: string) => {
    const res = await axios.post(`${API_URL}/sessions/${sessionId}/call/answer`, { sdp });
    return res.data as { call: ConfessionCallState };
  },

  sendCallIce: async (sessionId: string, candidate: string) => {
    const res = await axios.post(`${API_URL}/sessions/${sessionId}/call/ice`, { candidate });
    return res.data as { call: ConfessionCallState };
  },

  hangupCall: async (sessionId: string) => {
    const res = await axios.post(`${API_URL}/sessions/${sessionId}/call/hangup`);
    return res.data as { call: ConfessionCallState };
  },
};
