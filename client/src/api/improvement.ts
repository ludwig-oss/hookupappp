import axios from 'axios';
import { API_BASE } from './config';
import { DEFAULT_IMPROVEMENT_CATEGORIES } from '../constants/improvementCategories';

const API_URL = API_BASE + '/api/improvement';

export interface ImprovementCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface GuideApplication {
  id: string;
  userId: string;
  categories: string[];
  region: string;
  experience: string;
  qualifications: string;
  identificationUrl: string;
  proofPerCategory?: Record<string, { description: string; imageUrls?: string[] }>;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface Guide {
  id: string;
  userId: string;
  categories: string[];
  region: string;
  experience: string;
  qualifications: string;
  hourlyRate: number;
  sessionPriceEur?: number;
  paypalInfo?: string | null;
  rating: number;
  totalSessions: number;
  isActive: boolean;
  badge: boolean;
  user?: {
    id: string;
    name: string;
    username: string;
    profilePicture: string | null;
  };
}

export interface AvailabilitySlot {
  id: string;
  guideId: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
}

export interface Booking {
  id: string;
  userId: string;
  guideId: string;
  category: string;
  startTime: string;
  endTime: string;
  duration: number;
  amount: number;
  paymentStatus: string;
  status: string;
  completedAt?: string | null;
  guideRating?: 'success' | 'partial' | null;
  improvementPercentage?: number;
}

export interface GuideRequest {
  id: string;
  userId: string;
  guideId: string;
  category: string;
  status: 'pending' | 'accepted' | 'rejected';
  message?: string;
  createdAt: string;
  respondedAt?: string | null;
  paymentStatus?: 'pending' | 'sent_pending_confirmation' | 'confirmed';
  paymentProofText?: string | null;
  paymentProofImageUrl?: string | null;
  paymentSentAt?: string | null;
}

export const improvementAPI = {
  getCategories: async (): Promise<{ categories: ImprovementCategory[] }> => {
    try {
      const response = await axios.get(`${API_URL}/categories`, {
        timeout: 10000,
      });
      const list = response.data?.categories;
      if (Array.isArray(list) && list.length > 0) {
        return { categories: list };
      }
    } catch {
      // Vercel / missing VITE_API_URL / CORS / backend down — use bundled list (same ids as server)
    }
    return { categories: DEFAULT_IMPROVEMENT_CATEGORIES };
  },

  applyAsGuide: async (data: {
    categories: string[];
    region?: string;
    experience: string;
    qualifications: string;
    identificationUrl?: string;
    proofPerCategory?: Record<string, { description: string; imageUrls?: string[] }>;
    userId: string;
  }): Promise<{ message: string; application: GuideApplication }> => {
    const response = await axios.post(`${API_URL}/guides/apply`, data);
    return response.data;
  },

  getMyApplication: async (userId: string): Promise<{ application: GuideApplication | null }> => {
    const response = await axios.get(`${API_URL}/guides/my-application`, { params: { userId } });
    return response.data;
  },

  getMyGuideProfile: async (userId: string): Promise<{ guide: Guide; user: any } | { guide: null; user: null }> => {
    const response = await axios.get(`${API_URL}/guides/my-profile`, { params: { userId } });
    return response.data;
  },

  getGuidesForCategory: async (category: string, region?: string): Promise<{ guides: Guide[] }> => {
    const response = await axios.get(`${API_URL}/guides/category/${category}`, { params: region ? { region } : {} });
    return response.data;
  },

  getRecommendedGuides: async (userId: string, region?: string): Promise<{ guides: Guide[] }> => {
    const response = await axios.get(`${API_URL}/guides/recommended`, { params: { userId, ...(region ? { region } : {}) } });
    return response.data;
  },

  searchGuidesByProblem: async (q: string, region?: string): Promise<{ guides: Guide[] }> => {
    const response = await axios.get(`${API_URL}/guides/search`, { params: { q, ...(region ? { region } : {}) } });
    return response.data;
  },

  getAllGuides: async (): Promise<{ guides: Guide[] }> => {
    const response = await axios.get(`${API_URL}/guides`);
    return response.data;
  },

  setAvailability: async (data: {
    startTime: string;
    endTime: string;
    userId: string;
  }): Promise<{ message: string; slot: AvailabilitySlot }> => {
    const response = await axios.post(`${API_URL}/guides/availability`, data);
    return response.data;
  },

  getGuideAvailability: async (guideId: string): Promise<{ availability: AvailabilitySlot[] }> => {
    const response = await axios.get(`${API_URL}/guides/${guideId}/availability`);
    return response.data;
  },

  createBooking: async (data: {
    guideId: string;
    category: string;
    startTime: string;
    endTime: string;
    duration: number;
    userId: string;
    requestId?: string;
  }): Promise<{ booking: Booking }> => {
    const response = await axios.post(`${API_URL}/bookings`, data);
    return response.data;
  },

  getMyBookings: async (userId: string): Promise<{ bookings: Booking[] }> => {
    const response = await axios.get(`${API_URL}/bookings/my`, { params: { userId } });
    return response.data;
  },

  getGuideBookings: async (guideId: string): Promise<{ bookings: Booking[] }> => {
    const response = await axios.get(`${API_URL}/bookings/guide/${guideId}`);
    return response.data;
  },

  // Guide Requests
  sendGuideRequest: async (data: {
    guideId: string;
    category: string;
    message?: string;
    userId: string;
  }): Promise<{ message: string; request: GuideRequest }> => {
    const response = await axios.post(`${API_URL}/guides/request`, data);
    return response.data;
  },

  getMyGuideRequests: async (userId: string): Promise<{ requests: GuideRequest[] }> => {
    const response = await axios.get(`${API_URL}/guides/requests/my`, { params: { userId } });
    return response.data;
  },

  getGuideRequests: async (guideId: string): Promise<{ requests: GuideRequest[] }> => {
    const response = await axios.get(`${API_URL}/guides/${guideId}/requests`);
    return response.data;
  },

  acceptGuideRequest: async (requestId: string): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/guides/requests/accept`, { requestId });
    return response.data;
  },

  rejectGuideRequest: async (requestId: string): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/guides/requests/reject`, { requestId });
    return response.data;
  },

  // Course Completion
  rateCourseCompletion: async (data: {
    bookingId: string;
    rating: 'success' | 'partial';
    guideId: string;
  }): Promise<{ message: string; booking: Booking; improvementGained: number }> => {
    const response = await axios.post(`${API_URL}/courses/rate`, data);
    return response.data;
  },

  getUserImprovement: async (userId: string): Promise<{ 
    improvementPercentage: number;
    completedCourses: number;
    courses: Booking[];
  }> => {
    const response = await axios.get(`${API_URL}/improvement`, { params: { userId } });
    return response.data;
  },
};

export const SESSION_PRICE_EUR = 50;

export const paymentAPI = {
  createPaymentIntent: async (amount: number, bookingId: string): Promise<{ clientSecret: string; paymentIntentId: string }> => {
    const response = await axios.post(`${API_URL}/payments/create-intent`, { amount, bookingId });
    return response.data;
  },

  confirmPayment: async (bookingId: string, paymentIntentId: string): Promise<void> => {
    await axios.post(`${API_URL}/bookings/confirm-payment`, { bookingId, paymentIntentId });
  },

  submitPaymentProof: async (requestId: string, proofText: string, proofImageUrl?: string | null): Promise<void> => {
    await axios.post(`${API_URL}/guides/requests/${requestId}/submit-payment-proof`, { proofText, proofImageUrl });
  },

  setMyPaypalInfo: async (paypalInfo: string): Promise<void> => {
    await axios.put(`${API_URL}/guides/my-paypal`, { paypalInfo });
  },

  confirmPaymentReceived: async (requestId: string): Promise<void> => {
    await axios.post(`${API_URL}/guides/requests/confirm-payment`, { requestId });
  },
};





