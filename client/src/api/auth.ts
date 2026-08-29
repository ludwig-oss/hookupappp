import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/auth';

export interface SignupData {
  name: string;
  password?: string;
  username: string;
  email?: string;
  improvementCategories?: string[];
  passwordHint1?: string;
  passwordHint2?: string;
  passwordHint3?: string;
  phoneNumber?: string;
  faceDescriptor?: number[];
}

export interface LoginData {
  username?: string;
  email?: string;
  phoneNumber?: string;
  identifier?: string;
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

  signupWithFace: async (data: SignupData & { faceDescriptor: number[] }): Promise<AuthResponse> => {
    const response = await axios.post(`${API_URL}/signup-face`, data);
    return response.data;
  },

  signupWithPin: async (data: {
    name: string;
    username: string;
    pin: string;
    pinHint1: string;
    pinHint2: string;
    pinHint3: string;
    email?: string;
    phoneNumber?: string;
    improvementCategories?: string[];
  }): Promise<AuthResponse> => {
    const response = await axios.post(`${API_URL}/signup-pin`, data);
    return response.data;
  },

  loginWithPin: async (username: string, pin: string): Promise<AuthResponse> => {
    const response = await axios.post(`${API_URL}/login-pin`, { username, pin });
    return response.data;
  },

  checkUsernameAvailable: async (username: string): Promise<{ available: boolean; reason?: string }> => {
    const response = await axios.get(`${API_URL}/username-available`, { params: { u: username } });
    return response.data;
  },

  forgotPinHints: async (username: string) => {
    const response = await axios.post(`${API_URL}/forgot-pin/hints`, { username });
    return response.data as {
      message: string;
      hint1: string;
      hint2: string;
      hint3: string;
      chatRecoveryAvailable: boolean;
    };
  },

  forgotPinLastChatChallenge: async (username: string) => {
    const response = await axios.post(`${API_URL}/forgot-pin/last-chat`, { username });
    return response.data as { question: string; options: string[]; challengeToken: string };
  },

  forgotPinVerifyLastChat: async (username: string, challengeToken: string, answer: string) => {
    const response = await axios.post(`${API_URL}/forgot-pin/verify-last-chat`, { username, challengeToken, answer });
    return response.data as { resetToken: string; message: string };
  },

  forgotPinVerifyChatNames: async (username: string, usernames: string[]) => {
    const response = await axios.post(`${API_URL}/forgot-pin/verify-chat-names`, { username, usernames });
    return response.data as { resetToken: string; message: string };
  },

  resetPin: async (resetToken: string, newPin: string) => {
    const response = await axios.post(`${API_URL}/reset-pin`, { resetToken, newPin });
    return response.data as { message: string };
  },

  identifyFace: async (faceDescriptor: number[], username?: string): Promise<{ userId: string; username: string; message: string }> => {
    const response = await axios.post(`${API_URL}/face/identify`, { faceDescriptor, username: username?.trim() || undefined });
    return response.data;
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await axios.post(`${API_URL}/login`, data);
    return response.data;
  },

  sendLoginCode: async (phoneNumber: string): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/send-login-code`, { phoneNumber });
    return response.data;
  },

  loginWithCode: async (phoneNumber: string, code: string): Promise<AuthResponse> => {
    const response = await axios.post(`${API_URL}/login-with-code`, { phoneNumber, code });
    return response.data;
  },

  forgotPassword: async (username?: string, phoneNumber?: string, email?: string): Promise<{ message: string; resetLink?: string; hint1?: string; hint2?: string; hint3?: string }> => {
    const response = await axios.post(`${API_URL}/forgot-password`, { username, phoneNumber, email });
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

  passkeyStatus: async (): Promise<{ registered: boolean; count: number }> => {
    const response = await axios.get(`${API_URL}/passkey/status`);
    return response.data;
  },
};

