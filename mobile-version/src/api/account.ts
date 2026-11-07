import { axios } from './http';
import { API_BASE } from './config';

const API_URL = `${API_BASE}/api/account`;

export const accountAPI = {
  setPaused: async (paused: boolean): Promise<{ isPaused: boolean }> => {
    const response = await axios.post(`${API_URL}/pause`, { paused });
    return response.data;
  },
  deleteAccount: async (): Promise<{ ok: boolean }> => {
    const response = await axios.delete(API_URL);
    return response.data;
  },
};
