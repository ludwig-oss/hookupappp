import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/events';

function getAuthHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

export type EventType =
  | 'house_party'
  | 'club'
  | 'picnic'
  | 'chilling'
  | 'watch_football'
  | 'drinks'
  | 'other';

export interface Event {
  id: string;
  creatorUserId: string;
  type: EventType;
  title: string;
  description?: string;
  city: string;
  country?: string;
  startDate: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  meetupDetails?: string;
  creator?: {
    id: string;
    name: string;
    username?: string;
    profilePicture?: string | null;
    blurred?: boolean;
    displayName?: string;
    goldStar?: boolean;
  } | null;
  ended?: boolean;
  safetyNote?: string;
  myRequest?: { id: string; status: string };
  canChat?: boolean;
}

export interface EventRequest {
  id: string;
  eventId: string;
  userId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  user?: { id: string; name: string; blurred?: boolean; goldStar?: boolean } | null;
}

export interface EventMessage {
  id: string;
  eventId: string;
  userId: string;
  content: string;
  createdAt: string;
  userName?: string;
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  house_party: 'House party',
  club: 'Club / going out',
  picnic: 'Picnic',
  chilling: 'Chilling & fun',
  watch_football: 'Watch football',
  drinks: 'Going for a drink',
  other: 'Other',
};

export const eventsAPI = {
  list: async (
    city?: string,
    country?: string,
    q?: string,
    describe?: string
  ): Promise<{ events: Event[]; safetyNote: string; locationUsed?: string | null }> => {
    const params: Record<string, string> = {};
    if (city) params.city = city;
    if (country) params.country = country;
    if (q?.trim()) params.q = q.trim();
    if (describe?.trim()) params.describe = describe.trim();
    const res = await axios.get(API_URL, { params, headers: getAuthHeaders() });
    return res.data;
  },

  myEvents: async (): Promise<{ events: Event[] }> => {
    const res = await axios.get(`${API_URL}/my`, { headers: getAuthHeaders() });
    return res.data;
  },

  getById: async (eventId: string): Promise<{ event: Event }> => {
    const res = await axios.get(`${API_URL}/${eventId}`, { headers: getAuthHeaders() });
    return res.data;
  },

  create: async (data: {
    type: EventType;
    title: string;
    description?: string;
    city: string;
    country?: string;
    startDate: string;
    startTime: string;
    endTime?: string;
  }): Promise<{ event: Event }> => {
    const res = await axios.post(API_URL, data, { headers: getAuthHeaders() });
    return res.data;
  },

  requestToJoin: async (eventId: string): Promise<{ request: EventRequest }> => {
    const res = await axios.post(`${API_URL}/request`, { eventId }, { headers: getAuthHeaders() });
    return res.data;
  },

  getRequests: async (eventId: string): Promise<{ requests: EventRequest[] }> => {
    const res = await axios.get(`${API_URL}/${eventId}/requests`, { headers: getAuthHeaders() });
    return res.data;
  },

  respondToRequest: async (requestId: string, eventId: string, accept: boolean): Promise<{ request: EventRequest }> => {
    const res = await axios.post(`${API_URL}/request/respond`, { requestId, eventId, accept }, { headers: getAuthHeaders() });
    return res.data;
  },

  getMessages: async (eventId: string): Promise<{ messages: EventMessage[] }> => {
    const res = await axios.get(`${API_URL}/${eventId}/messages`, { headers: getAuthHeaders() });
    return res.data;
  },

  postMessage: async (eventId: string, content: string): Promise<{ message: EventMessage }> => {
    const res = await axios.post(`${API_URL}/${eventId}/messages`, { content }, { headers: getAuthHeaders() });
    return res.data;
  },

  updateMeetupDetails: async (eventId: string, meetupDetails: string): Promise<{ event: Event }> => {
    const res = await axios.put(`${API_URL}/${eventId}/meetup-details`, { meetupDetails }, { headers: getAuthHeaders() });
    return res.data;
  },
};
