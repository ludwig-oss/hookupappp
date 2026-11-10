import axios from 'axios';
import { API_BASE } from './config';

const API_URL = `${API_BASE}/api/scout`;

export interface Profession {
  id: string;
  label: string;
  group: string;
}

export interface ScoutCard {
  userId: string;
  name: string;
  username: string;
  professionId: string;
  professionLabel: string;
  city: string | null;
  years: number;
  quality: number;
  experienceScore: number;
}

export interface PartnershipView {
  id: string;
  mode: 'talk' | 'building';
  status: 'talking' | 'awaiting_contract' | 'speed_date' | 'active' | 'ended';
  partner: { id: string; name: string; username: string; professionLabel: string };
  contractText: string | null;
  iSigned: boolean;
  theySigned: boolean;
  speedDate: {
    iJoined: boolean;
    theyJoined: boolean;
    iConfirmed: boolean;
    theyConfirmed: boolean;
    live: boolean;
  } | null;
  slots: Array<{ id: string; start: string; end: string; label: string }>;
  events: Array<{ id: string; title: string; city: string; startsAt: string; why: string }>;
  tips: string[];
  goals: Array<{ id: string; label: string; done: boolean }>;
  expenses: Array<{ id: string; title: string; amountCents: number; paidBy: string }>;
  house: { label: string; priceCents: number; downCents: number; monthlyCents: number; iterationsPaid: number } | null;
  trackedCents: number;
  eachShareCents: number;
  mediation: Array<{ id: string; userId: string; text: string; reply: string; at: string }>;
  settlement: { endedAt: string; reason: string; trackedCents: number; eachShareCents: number } | null;
}

export interface ScoutState {
  onboarded: boolean;
  professionId: string | null;
  professionLabel: string | null;
  years: number;
  judgment: number;
  experienceScore: number;
  listSize: number;
  qualityFloor: number;
  board: ScoutCard[];
  incoming: Array<{
    id: string;
    mode: 'talk' | 'building';
    from: { id: string; name: string; username: string; professionLabel: string };
    createdAt: string;
  }>;
  partnerships: PartnershipView[];
}

export const scoutAPI = {
  professions: async (q = ''): Promise<Profession[]> => {
    const res = await axios.get(`${API_URL}/professions`, { params: { q } });
    return res.data.professions;
  },
  state: async (): Promise<ScoutState> => (await axios.get(`${API_URL}/state`)).data,
  saveProfile: async (body: { professionId: string; years: number; judgment: number }): Promise<ScoutState> =>
    (await axios.put(`${API_URL}/profile`, body)).data,
  cycle: async (professionId?: string): Promise<ScoutState> =>
    (await axios.post(`${API_URL}/cycle`, { professionId })).data,
  interest: async (targetUserId: string, mode: 'talk' | 'building'): Promise<ScoutState> =>
    (await axios.post(`${API_URL}/interest`, { targetUserId, mode })).data,
  accept: async (id: string): Promise<ScoutState> => (await axios.post(`${API_URL}/interest/${id}/accept`)).data,
  reject: async (id: string): Promise<ScoutState> => (await axios.post(`${API_URL}/interest/${id}/reject`)).data,
  sign: async (id: string): Promise<ScoutState> => (await axios.post(`${API_URL}/partnerships/${id}/sign`)).data,
  joinLive: async (id: string): Promise<ScoutState> => (await axios.post(`${API_URL}/partnerships/${id}/speed-date/join`)).data,
  confirmBlue: async (id: string): Promise<ScoutState> => (await axios.post(`${API_URL}/partnerships/${id}/speed-date/confirm`)).data,
  availability: async (id: string, body: { start: string; end: string; label: string }): Promise<ScoutState> =>
    (await axios.post(`${API_URL}/partnerships/${id}/availability`, body)).data,
  expense: async (id: string, body: { title: string; amount: number }): Promise<ScoutState> =>
    (await axios.post(`${API_URL}/partnerships/${id}/expenses`, body)).data,
  house: async (id: string, body: { label: string; price: number; down: number; monthly: number; iterations: number }): Promise<ScoutState> =>
    (await axios.post(`${API_URL}/partnerships/${id}/house`, body)).data,
  goal: async (id: string, label: string): Promise<ScoutState> =>
    (await axios.post(`${API_URL}/partnerships/${id}/goals`, { label })).data,
  mediate: async (id: string, text: string): Promise<ScoutState> =>
    (await axios.post(`${API_URL}/partnerships/${id}/mediate`, { text })).data,
  terminate: async (id: string, reason: string): Promise<ScoutState> =>
    (await axios.post(`${API_URL}/partnerships/${id}/terminate`, { reason })).data,
};
