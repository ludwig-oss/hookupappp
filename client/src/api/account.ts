import axios from 'axios';
import { API_BASE } from './config';
import { getAuthToken } from '../lib/authStorage';

const API_URL = `${API_BASE}/api/account`;

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const accountAPI = {
  setPaused: async (paused: boolean): Promise<{ isPaused: boolean }> => {
    const response = await axios.post(`${API_URL}/pause`, { paused }, { headers: authHeaders() });
    return response.data;
  },
  deleteAccount: async (): Promise<{ ok: boolean }> => {
    const response = await axios.delete(API_URL, { headers: authHeaders() });
    return response.data;
  },
};
