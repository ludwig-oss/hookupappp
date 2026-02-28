import axios from 'axios';

const API_URL = '/api/health-results';

function getAuthHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

export type HealthTestResult = 'clear' | 'positive' | 'pending';

export interface HealthTest {
  id: string;
  condition: string;
  result: HealthTestResult;
  testedAt: string;
  doctorName: string;
  doctorClinic: string;
  verificationInfo: string;
  approvedByDoctor: boolean;
}

export interface HealthResults {
  userId: string;
  tests: HealthTest[];
  lastUpdated: string | null;
}

export interface HealthViewRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  respondedAt?: string | null;
  fromUser?: { id: string; name: string } | null;
  toUser?: { id: string; name: string } | null;
}

export const HEALTH_CONDITIONS = [
  'HIV',
  'Chlamydia',
  'Gonorrhea',
  'Syphilis',
  'Hepatitis B',
  'Hepatitis C',
  'Herpes (HSV)',
  'HPV',
  'Trichomoniasis',
  'Mycoplasma',
  'Flu (Influenza)',
  'COVID-19',
  'Other',
];

export const healthAPI = {
  getMyResults: async (): Promise<{ results: HealthResults }> => {
    const res = await axios.get(`${API_URL}/me`, { headers: getAuthHeaders() });
    return res.data;
  },

  updateMyResults: async (tests: HealthTest[]): Promise<{ results: HealthResults }> => {
    const res = await axios.put(`${API_URL}/me`, { tests }, { headers: getAuthHeaders() });
    return res.data;
  },

  addTest: async (test: Omit<HealthTest, 'id'> & { id?: string }): Promise<{ results: HealthResults }> => {
    const res = await axios.post(`${API_URL}/me/tests`, test, { headers: getAuthHeaders() });
    return res.data;
  },

  deleteTest: async (testId: string): Promise<{ results: HealthResults | null }> => {
    const res = await axios.delete(`${API_URL}/me/tests/${testId}`, { headers: getAuthHeaders() });
    return res.data;
  },

  getViewStatus: async (otherUserId: string): Promise<{
    request: HealthViewRequest | null;
    canView: boolean;
    results: { tests: HealthTest[]; lastUpdated: string } | null;
  }> => {
    const res = await axios.get(`${API_URL}/view-status/${otherUserId}`, { headers: getAuthHeaders() });
    return res.data;
  },

  requestToView: async (toUserId: string): Promise<{ request: HealthViewRequest }> => {
    const res = await axios.post(`${API_URL}/view-request`, { toUserId }, { headers: getAuthHeaders() });
    return res.data;
  },

  getMyRequests: async (): Promise<{ incoming: HealthViewRequest[]; outgoing: HealthViewRequest[] }> => {
    const res = await axios.get(`${API_URL}/requests`, { headers: getAuthHeaders() });
    return res.data;
  },

  respondToRequest: async (requestId: string, approve: boolean): Promise<{ request: HealthViewRequest }> => {
    const res = await axios.post(`${API_URL}/requests/respond`, { requestId, approve }, { headers: getAuthHeaders() });
    return res.data;
  },
};
