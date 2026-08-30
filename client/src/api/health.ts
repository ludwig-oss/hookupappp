import axios from 'axios';
import { API_BASE, MEDIA_API_BASE } from './config';

const API_URL = `${API_BASE}/api/health-results`;
const MEDIA_API_URL = `${MEDIA_API_BASE || API_BASE}/api/health-results`;

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
  documentUrl?: string;
  documentHash?: string;
  signatureName?: string;
  signedAt?: string;
  legalAccepted?: boolean;
}

export interface HealthResults {
  userId: string;
  tests: HealthTest[];
  lastUpdated: string | null;
}

export interface HealthComplianceStatus {
  exempt: boolean;
  complete: boolean;
  limited: boolean;
  expiringSoon: boolean;
  missingConditions: string[];
  staleConditions: string[];
  expiringConditions: string[];
  lastUpdated: string | null;
  warningMessage: string | null;
  byCondition: Record<
    string,
    { test: HealthTest; daysSinceTest: number; status: 'ok' | 'expiring' | 'stale' | 'missing' }
  >;
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

export const HEALTH_LEGAL_TEXT =
  'I certify this is an authentic lab report from a licensed doctor or hospital in my area, with a visible clinic/hospital stamp. Forging or uploading fake results may result in a €4,000 fine, civil liability if a partner is harmed, and permanent account removal. I agree to update my STI proofs at least monthly.';

export const REQUIRED_STI_CONDITIONS = [
  'HIV',
  'Chlamydia',
  'Gonorrhea',
  'Syphilis',
  'Hepatitis B',
  'Hepatitis C',
  'Herpes (HSV)',
  'HPV',
  'Trichomoniasis',
] as const;

export const healthAPI = {
  getMyResults: async (): Promise<{
    results: HealthResults;
    compliance: HealthComplianceStatus;
    legalText: string;
    requiredConditions: readonly string[];
  }> => {
    const res = await axios.get(`${API_URL}/me`, { headers: getAuthHeaders() });
    return res.data;
  },

  uploadProof: async (payload: {
    condition: string;
    result: HealthTestResult;
    testedAt: string;
    documentImage: string;
    signatureName: string;
    legalAccepted: boolean;
  }): Promise<{ results: HealthResults; compliance: HealthComplianceStatus }> => {
    const res = await axios.post(`${MEDIA_API_URL}/me/tests`, payload, { headers: getAuthHeaders() });
    return res.data;
  },

  deleteTest: async (testId: string): Promise<{ results: HealthResults | null; compliance: HealthComplianceStatus }> => {
    const res = await axios.delete(`${API_URL}/me/tests/${testId}`, { headers: getAuthHeaders() });
    return res.data;
  },

  getViewStatus: async (otherUserId: string): Promise<{
    request: HealthViewRequest | null;
    canView: boolean;
    canRequest: boolean;
    results: { tests: HealthTest[]; lastUpdated: string; compliance?: HealthComplianceStatus | null } | null;
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
