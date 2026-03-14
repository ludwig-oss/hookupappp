import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/auth';

export interface SignupData {
  name: string;
  password: string;
  username: string;
  email?: string;
  improvementCategories?: string[];
  passwordHint1?: string;
  passwordHint2?: string;
  passwordHint3?: string;
  phoneNumber?: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  token?: string;
  user: {
    id: string;
    email: string;
    name: string;
    username: string;
    profilePicture: string | null;
    profileSetupComplete: boolean;
    emailVerified?: boolean;
  };
  requiresVerification?: boolean;
}

export const authAPI = {
  signup: async (data: SignupData): Promise<AuthResponse> => {
    const response = await axios.post(`${API_URL}/signup`, data);
    return response.data;
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await axios.post(`${API_URL}/login`, data);
    return response.data;
  },

  forgotPassword: async (username?: string, phoneNumber?: string): Promise<{ message: string; resetLink?: string; hint1?: string; hint2?: string; hint3?: string }> => {
    const response = await axios.post(`${API_URL}/forgot-password`, { username, phoneNumber });
    return response.data;
  },

  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/reset-password`, { token, newPassword });
    return response.data;
  },

  verifyEmail: async (token?: string, code?: string): Promise<AuthResponse> => {
    const response = await axios.post(`${API_URL}/verify-email`, { token, code });
    return response.data;
  },

  resendVerificationEmail: async (email?: string, phoneNumber?: string, method?: 'email' | 'phone'): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/resend-verification`, { email, phoneNumber, method });
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/change-password`, { currentPassword, newPassword });
    return response.data;
  },
};

