import axios from 'axios';
import { API_BASE } from './config';

const API_URL = `${API_BASE}/api/guide-help`;

export type GuideHelpKind = 'fashion' | 'appearance' | 'intimacy' | 'termact' | 'lesson' | 'date-tips' | 'texting';

export interface GuideHelpStatus {
  allowed: boolean;
  isPremium: boolean;
  freeUsed: number;
  freeRemaining: number;
  paidCredits: number;
  priceEur: number;
  code?: 'OK' | 'GUIDE_HELP_REQUIRED';
  stripeConfigured?: boolean;
  testingFree?: boolean;
  error?: string;
}

/** Local browser testing — never block on Stripe/paywall even if API is production. */
export function isClientTestingFree(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.endsWith('.local');
}

export const guideHelpAPI = {
  status: async (): Promise<GuideHelpStatus> => {
    if (isClientTestingFree()) {
      return {
        allowed: true,
        isPremium: true,
        freeUsed: 0,
        freeRemaining: 999,
        paidCredits: 0,
        priceEur: 9.9,
        code: 'OK',
        testingFree: true,
      };
    }
    const response = await axios.get(`${API_URL}/status`);
    return response.data;
  },
  consume: async (kind: GuideHelpKind): Promise<GuideHelpStatus> => {
    if (isClientTestingFree()) {
      return {
        allowed: true,
        isPremium: true,
        freeUsed: 0,
        freeRemaining: 999,
        paidCredits: 0,
        priceEur: 9.9,
        code: 'OK',
        testingFree: true,
      };
    }
    const response = await axios.post(`${API_URL}/consume`, { kind });
    return response.data;
  },
  stripeCheckout: async (): Promise<{ url: string; sessionId: string; priceEur: number }> => {
    const response = await axios.post(`${API_URL}/pay/stripe`);
    return response.data;
  },
  stripeConfirm: async (sessionId: string): Promise<{ paid: boolean; status: GuideHelpStatus }> => {
    const response = await axios.post(`${API_URL}/pay/stripe/confirm`, { sessionId });
    return response.data;
  },
};
