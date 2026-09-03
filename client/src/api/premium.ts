import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/premium';

export type PremiumPlanType = 'monthly' | 'yearly' | 'lifetime';
export type PremiumTier = 'free' | 'plus' | 'gold' | 'platinum';

export interface PremiumPlan {
  id: string;
  name: string;
  type: PremiumPlanType;
  price: number;
  currency: string;
  features: string[];
  popular?: boolean;
  tier?: PremiumTier;
  headline?: string;
  weeklyPrice?: number;
  savePercent?: number;
  theme?: 'plus' | 'gold' | 'platinum';
}

export interface PremiumSubscription {
  userId: string;
  planId: string;
  planType: PremiumPlanType;
  status: 'active' | 'cancelled' | 'expired';
  startDate: string;
  endDate: string | null;
  autoRenew: boolean;
  paymentMethod: string;
  lastPaymentDate: string | null;
  nextPaymentDate: string | null;
}

export interface PaymentHistory {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  planId: string;
  planName: string;
  paymentDate: string;
  status: 'completed' | 'pending' | 'failed';
  transactionId: string | null;
}

export const premiumAPI = {
  getPlans: async (): Promise<{ plans: PremiumPlan[] }> => {
    const response = await axios.get(`${API_URL}/plans`);
    return response.data;
  },

  getStatus: async (): Promise<{ subscription: PremiumSubscription | null; isPremium: boolean }> => {
    const response = await axios.get(`${API_URL}/status`);
    return response.data;
  },

  subscribe: async (planId: string, paymentMethodId: string): Promise<{ subscription: PremiumSubscription; success: boolean }> => {
    const response = await axios.post(`${API_URL}/subscribe`, { planId, paymentMethodId });
    return response.data;
  },

  cancel: async (): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/cancel`);
    return response.data;
  },

  getHistory: async (): Promise<{ history: PaymentHistory[] }> => {
    const response = await axios.get(`${API_URL}/history`);
    return response.data;
  },
};



