import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/auth';
const AUTH_TIMEOUT_MS = 45000;

function authPost<T = unknown>(path: string, data: unknown) {
  return axios.post<T>(`${API_URL}${path}`, data, { timeout: AUTH_TIMEOUT_MS });
}

function authGet<T = unknown>(path: string, params?: Record<string, string>) {
  return axios.get<T>(`${API_URL}${path}`, { params, timeout: AUTH_TIMEOUT_MS });
}

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
  pin?: string;
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
    const response = await authPost<AuthResponse>('/signup', data);
    return response.data;
  },

  signupWithFace: async (data: SignupData & { faceDescriptor: number[] }): Promise<AuthResponse> => {
    const response = await authPost<AuthResponse>('/signup-face', data);
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
    password?: string;
  }): Promise<AuthResponse> => {
    const response = await authPost<AuthResponse>('/signup-pin', data);
    return response.data;
  },

  loginWithPin: async (username: string, pin: string): Promise<AuthResponse> => {
    const response = await authPost<AuthResponse>('/login-pin', { username, pin });
    return response.data;
  },

  checkUsernameAvailable: async (username: string): Promise<{ available: boolean; reason?: string }> => {
    const response = await authGet<{ available: boolean; reason?: string }>('/username-available', { u: username });
    return response.data;
  },

  forgotPinHints: async (username: string) => {
    const response = await authPost('/forgot-pin/hints', { username });
    return response.data as {
      message: string;
      hint1: string;
      hint2: string;
      hint3: string;
      chatRecoveryAvailable: boolean;
    };
  },

  forgotPinLastChatChallenge: async (username: string) => {
    const response = await authPost('/forgot-pin/last-chat', { username });
    return response.data as { question: string; options: string[]; challengeToken: string };
  },

  forgotPinVerifyLastChat: async (username: string, challengeToken: string, answer: string) => {
    const response = await authPost('/forgot-pin/verify-last-chat', { username, challengeToken, answer });
    return response.data as { resetToken: string; message: string };
  },

  forgotPinVerifyChatNames: async (username: string, usernames: string[]) => {
    const response = await authPost('/forgot-pin/verify-chat-names', { username, usernames });
    return response.data as { resetToken: string; message: string };
  },

  resetPin: async (resetToken: string, newPin: string) => {
    const response = await authPost('/reset-pin', { resetToken, newPin });
    return response.data as { message: string };
  },

  identifyFace: async (faceDescriptor: number[], username?: string): Promise<{ userId: string; username: string; message: string }> => {
    const response = await authPost('/face/identify', { faceDescriptor, username: username?.trim() || undefined });
    return response.data;
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await authPost<AuthResponse>('/login', data);
    return response.data;
  },

  sendLoginCode: async (phoneNumber: string): Promise<{ message: string }> => {
    const response = await authPost<{ message: string }>('/send-login-code', { phoneNumber });
    return response.data;
  },

  loginWithCode: async (phoneNumber: string, code: string): Promise<AuthResponse> => {
    const response = await authPost<AuthResponse>('/login-with-code', { phoneNumber, code });
    return response.data;
  },

  forgotPassword: async (username?: string, phoneNumber?: string, email?: string): Promise<{ message: string; resetLink?: string; hint1?: string; hint2?: string; hint3?: string }> => {
    const response = await authPost('/forgot-password', { username, phoneNumber, email });
    return response.data;
  },

  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    const response = await authPost('/reset-password', { token, newPassword });
    return response.data;
  },

  verifyEmail: async (token?: string, code?: string): Promise<AuthResponse> => {
    const response = await authPost<AuthResponse>('/verify-email', { token, code });
    return response.data;
  },

  resendVerificationEmail: async (email?: string, phoneNumber?: string, method?: 'email' | 'phone'): Promise<{ message: string }> => {
    const response = await authPost('/resend-verification', { email, phoneNumber, method });
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const response = await authPost('/change-password', { currentPassword, newPassword });
    return response.data;
  },

  passkeyStatus: async (): Promise<{ registered: boolean; count: number }> => {
    const response = await authGet<{ registered: boolean; count: number }>('/passkey/status');
    return response.data;
  },
};

