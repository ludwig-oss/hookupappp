import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/activity';

export interface Interest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  respondedAt?: string | null;
  otherUser?: { id: string; name: string; username: string; profilePicture: string | null; country?: string; city?: string } | null;
}

export interface PreCommProfile {
  id: string;
  interestId: string;
  userId: string;
  whatLookingFor: string;
  howWillMeet: string;
  canAffordTravelProof: string;
  willingToMoveWhere: string;
  whereWork: string;
  whereLive: string;
  whereChill: string;
  name: string;
  familyFriends: string;
  createdAt: string;
}

export const activityAPI = {
  getRegionUsers: async (country: string, city?: string): Promise<{ users: Array<{ id: string; name: string; username: string; profilePicture: string | null; country?: string; city?: string }> }> => {
    const params: { country: string; city?: string } = { country };
    if (city) params.city = city;
    const res = await axios.get(`${API_URL}/region`, { params });
    return res.data;
  },

  sendInterest: async (toUserId: string): Promise<{ interest: Interest; openChat?: boolean; chatUserId?: string }> => {
    const res = await axios.post(`${API_URL}/interest`, { toUserId });
    return res.data;
  },

  acceptInterest: async (interestId: string): Promise<{ message: string; openChat?: boolean; chatUserId?: string }> => {
    const res = await axios.post(`${API_URL}/interest/accept`, { interestId });
    return res.data;
  },

  rejectInterest: async (interestId: string): Promise<void> => {
    await axios.post(`${API_URL}/interest/reject`, { interestId });
  },

  getMyInterests: async (): Promise<{ sent: Interest[]; received: Interest[] }> => {
    const res = await axios.get(`${API_URL}/interests`);
    return res.data;
  },

  savePreComm: async (interestId: string, data: Omit<PreCommProfile, 'id' | 'interestId' | 'userId' | 'createdAt'>): Promise<{ profile: PreCommProfile }> => {
    const res = await axios.post(`${API_URL}/pre-comm`, { interestId, ...data });
    return res.data;
  },

  getPreComm: async (interestId: string): Promise<{ profiles: PreCommProfile[]; canChat: boolean }> => {
    const res = await axios.get(`${API_URL}/pre-comm/${interestId}`);
    return res.data;
  },

  getNDAStatus: async (interestId: string): Promise<{ required: boolean; signed: boolean; agreementText: string; celebrityUserId?: string; nda?: { id: string; signedAt: string } }> => {
    const res = await axios.get(`${API_URL}/nda/status/${interestId}`);
    return res.data;
  },

  getNDAStatusByUser: async (otherUserId: string): Promise<{ required: boolean; signed: boolean; interestId: string | null; agreementText: string; celebrityUserId?: string; nda?: { id: string; signedAt: string } }> => {
    const res = await axios.get(`${API_URL}/nda/status-by-user/${otherUserId}`);
    return res.data;
  },

  signNDA: async (interestId: string, signatureData: string, agreementText?: string): Promise<{ message: string; nda: { id: string; signedAt: string } }> => {
    const res = await axios.post(`${API_URL}/nda/sign`, { interestId, signatureData, agreementText });
    return res.data;
  },
};

const COUNTRIES_API = 'https://countriesnow.space/api/v0.1/countries';

export async function fetchCountries(): Promise<{ country: string }[]> {
  const res = await fetch(`${COUNTRIES_API}`);
  const data = await res.json();
  if (!data.data || !Array.isArray(data.data)) return [];
  return data.data.map((c: { name?: string }) => ({ country: (c as any).name || '' })).filter((c: { country: string }) => c.country);
}

export async function fetchCities(country: string): Promise<string[]> {
  const res = await fetch(`${COUNTRIES_API}/cities/q?country=${encodeURIComponent(country)}`);
  const data = await res.json();
  if (!data.data || !Array.isArray(data.data)) return [];
  return data.data;
}
