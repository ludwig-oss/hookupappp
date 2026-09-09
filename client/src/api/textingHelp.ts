import axios from 'axios';
import { API_BASE } from './config';

export const TEXTING_HELP_PRICE_EUR = 5;

export interface TextingHelpSession {
  id: string;
  userId: string;
  otherUserId: string;
  status: 'pending_payment' | 'paid' | 'live' | 'ended';
  paidAt: string | null;
  paymentMethod: 'stripe' | 'demo' | null;
  offeredGuideUserIds: string[];
  firstAnsweredGuideUserId: string | null;
  chosenGuideUserId: string | null;
  liveRoomUrl: string | null;
  createdAt: string;
}

export interface TextingHelpGuideCard {
  guideId: string;
  userId: string;
  name: string;
  profilePicture: string | null;
  region: string;
  rating: number;
  reviewCount: number;
  helpedCount: number;
  online: boolean;
  answeredSos: boolean;
}

export interface TextingHelpIncoming {
  sessionId: string;
  fromUserId: string;
  fromName: string;
  otherUserId: string;
  createdAt: string;
  firstAnswered: boolean;
}

export const textingHelpAPI = {
  start: async (otherUserId: string) => {
    const response = await axios.post(`${API_BASE}/api/texting-help/start`, { otherUserId });
    return response.data as {
      session: TextingHelpSession;
      priceEur: number;
      stripeConfigured: boolean;
    };
  },
  getSession: async (sessionId: string) => {
    const response = await axios.get(`${API_BASE}/api/texting-help/session/${sessionId}`);
    return response.data as { session: TextingHelpSession; priceEur: number };
  },
  checkout: async (sessionId: string) => {
    const response = await axios.post(`${API_BASE}/api/texting-help/pay/checkout`, { sessionId });
    return response.data as { url?: string; sessionId?: string; alreadyPaid?: boolean; session?: TextingHelpSession };
  },
  createStripe: async (sessionId: string) => {
    const response = await axios.post(`${API_BASE}/api/texting-help/pay/stripe`, { sessionId });
    return response.data as { clientSecret?: string; paymentIntentId?: string; alreadyPaid?: boolean };
  },
  confirmStripe: async (sessionId: string, paymentIntentId: string) => {
    const response = await axios.post(`${API_BASE}/api/texting-help/pay/stripe/confirm`, { sessionId, paymentIntentId });
    return response.data as { paid: boolean; session: TextingHelpSession };
  },
  confirmCheckout: async (sessionId: string, checkoutSessionId: string) => {
    const response = await axios.post(`${API_BASE}/api/texting-help/pay/stripe/confirm`, {
      sessionId,
      checkoutSessionId,
    });
    return response.data as { paid: boolean; session: TextingHelpSession };
  },
  listGuides: async (sessionId: string, offset = 0) => {
    const response = await axios.get(`${API_BASE}/api/texting-help/guides`, { params: { sessionId, offset } });
    return response.data as { guides: TextingHelpGuideCard[]; nextOffset: number; total: number };
  },
  answer: async (sessionId: string) => {
    const response = await axios.post(`${API_BASE}/api/texting-help/answer`, { sessionId });
    return response.data as { session: TextingHelpSession; first: boolean };
  },
  choose: async (sessionId: string, guideUserId: string) => {
    const response = await axios.post(`${API_BASE}/api/texting-help/choose`, { sessionId, guideUserId });
    return response.data as { session: TextingHelpSession };
  },
  incoming: async () => {
    const response = await axios.get(`${API_BASE}/api/texting-help/incoming`);
    return response.data as { incoming: TextingHelpIncoming[] };
  },
  review: async (sessionId: string, stars: number, text: string) => {
    const response = await axios.post(`${API_BASE}/api/texting-help/review`, { sessionId, stars, text });
    return response.data as { review: { sessionId: string; stars: number; text: string } };
  },
};
