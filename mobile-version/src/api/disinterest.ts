import axios from 'axios';
import { API_BASE } from './config';

export interface DisinterestSign {
  id: string;
  label: string;
  detail: string;
  score: number;
}

export interface DisinterestReport {
  otherUserId: string;
  score: number;
  statusLabel: 'Attentive' | 'Mild' | 'Detached' | 'Severe';
  channelMode: 'Text Logs';
  riskIndex: number;
  threshold: number;
  warningSent: boolean;
  signs: DisinterestSign[];
  sampleSize: number;
  analyzedAt: string;
}

export const disinterestAPI = {
  getReport: async (otherUserId: string): Promise<DisinterestReport> => {
    const response = await axios.get(`${API_BASE}/api/chat/disinterest/${otherUserId}`);
    return response.data.report;
  },
};
