import axios from 'axios';
import { API_BASE, MEDIA_API_BASE } from './config';
import { getAuthToken } from '../lib/authStorage';

const API_URL = `${API_BASE}/api/posts`;
const WRITE_URL = `${MEDIA_API_BASE || API_BASE}/api/posts`;

function headers(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface SingleAgainPublic {
  postId: string;
  city: string;
  reason: string;
  photoUrl: string | null;
  interestClosesAt: string;
  interestCount: number;
  hasEntered: boolean;
  drawn: boolean;
  luckyCount: number;
  isOwner: boolean;
  iAmLucky: boolean;
  healHold: boolean;
  healNote: string | null;
  hoursLeft: number;
}

export const singleAgainAPI = {
  showInterest: async (postId: string): Promise<{ singleAgain: SingleAgainPublic; message: string }> => {
    const res = await axios.post(`${WRITE_URL}/${postId}/interest`, {}, { headers: headers() });
    return res.data;
  },
  setHealHold: async (postId: string, healNote: string): Promise<{ singleAgain: SingleAgainPublic }> => {
    const res = await axios.post(`${WRITE_URL}/${postId}/heal-hold`, { healNote }, { headers: headers() });
    return res.data;
  },
  setReady: async (postId: string): Promise<{ singleAgain: SingleAgainPublic }> => {
    const res = await axios.post(`${WRITE_URL}/${postId}/heal-ready`, {}, { headers: headers() });
    return res.data;
  },
  getMine: async (): Promise<{ roulette: { postId: string; luckyCount: number; healHold: boolean; healNote: string | null } | null }> => {
    const res = await axios.get(`${API_URL}/single-again/mine`, { headers: headers() });
    return res.data;
  },
};
