import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/reports';

export type ReportCategory = 'harassment' | 'fake' | 'inappropriate' | 'spam' | 'scam' | 'underage' | 'violence' | 'other';

export interface Report {
  id: string;
  reporterId: string;
  reportedUserId: string;
  category: ReportCategory;
  description: string;
  createdAt: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewedBy?: string;
  reviewedAt?: string;
  resolution?: string;
}

export const reportsAPI = {
  lookupUser: async (q: string): Promise<{ userId: string; name: string; username: string }> => {
    const response = await axios.get(`${API_URL}/lookup`, { params: { q: q.trim() } });
    return response.data;
  },

  createReport: async (reportedUserId: string, category: ReportCategory, description?: string): Promise<{ report: Report }> => {
    const response = await axios.post(API_URL, { reportedUserId, category, description });
    return response.data;
  },

  getMyReports: async (): Promise<{ reports: Report[] }> => {
    const response = await axios.get(API_URL);
    return response.data;
  },

  getAllReports: async (): Promise<{ reports: Report[] }> => {
    const response = await axios.get(`${API_URL}/all`);
    return response.data;
  },

  updateReport: async (reportId: string, status: Report['status'], resolution?: string): Promise<{ report: Report }> => {
    const response = await axios.put(`${API_URL}/${reportId}`, { status, resolution });
    return response.data;
  },
};



