import axios from 'axios';
import { API_BASE } from './config';
import { getAuthHeaders } from './authHeaders';

const API_URL = `${API_BASE}/api/stripe`;

export type StripeCheckoutKind =
  | 'ai_guide_help'
  | 'confession'
  | 'texting_help'
  | 'guide_request'
  | 'generic';

export const stripeAPI = {
  status: async () => {
    const res = await axios.get(`${API_URL}/status`);
    return res.data as { stripeConfigured: boolean };
  },

  /** Hosted Checkout — redirects via returned url */
  createCheckoutSession: async (body: {
    kind: StripeCheckoutKind;
    amountEur?: number;
    productName?: string;
    sessionId?: string;
    requestId?: string;
    successPath?: string;
    cancelPath?: string;
    metadata?: Record<string, string>;
  }): Promise<{ url: string; sessionId: string }> => {
    const res = await axios.post(`${API_URL}/create-checkout-session`, body, {
      headers: getAuthHeaders(),
    });
    const url = res.data?.url || res.data?.session?.url;
    if (!url) throw new Error('Stripe did not return a checkout URL');
    return { url, sessionId: res.data.sessionId || res.data.session?.id };
  },

  confirmSession: async (sessionId: string) => {
    const res = await axios.post(
      `${API_URL}/confirm-session`,
      { sessionId },
      { headers: getAuthHeaders() }
    );
    return res.data;
  },
};
