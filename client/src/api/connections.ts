import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/connections';

export type BuzzStatus = 'pending' | 'accepted' | 'rejected' | 'talk_later';

export interface Buzz {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: BuzzStatus;
  createdAt: string;
  respondedAt?: string | null;
  location?: {
    lat: number;
    lon: number;
    venue?: string;
    venueType?: string;
  };
  fromUserProfilePicture?: string | null;
  /** When this is a sent buzz with status rejected, server may include an uplifting message for the sender */
  comfortingMessageForSender?: string;
}

export interface NearbyUser {
  id: string;
  name: string;
  profilePicture: string | null;
  isOnline: boolean;
}

export interface VenueCount {
  venue: string;
  venueType: string;
  location: { lat: number; lon: number };
  count: number;
  users: Array<{
    id: string;
    profilePicture: string | null;
    name: string;
  }>;
}

export const connectionsAPI = {
  sendBuzz: async (data: {
    toUserId: string;
    location?: { lat: number; lon: number; venue?: string; venueType?: string };
    userId: string;
  }): Promise<{ message: string; buzz: Buzz; openChat?: boolean; chatUserId?: string }> => {
    const response = await axios.post(`${API_URL}/buzz`, data);
    return response.data;
  },

  getMyBuzzes: async (userId: string): Promise<{ received: Buzz[]; sent: Buzz[] }> => {
    const response = await axios.get(`${API_URL}/buzzes`, { params: { userId } });
    return response.data;
  },

  respondBuzz: async (data: {
    buzzId: string;
    response: 'accepted' | 'rejected' | 'talk_later';
  }): Promise<{ buzz: Buzz; comfortingMessage?: string; openChat?: boolean; chatUserId?: string }> => {
    const res = await axios.post(`${API_URL}/buzz/respond`, data);
    return res.data;
  },

  updateLocation: async (data: {
    lat: number;
    lon: number;
    accuracy?: number;
    venue?: string;
    venueType?: string;
    userId: string;
    connectionsVisible?: boolean;
  }): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/location`, data);
    return response.data;
  },

  getPrefs: async (): Promise<{ connectionsVisible: boolean }> => {
    const response = await axios.get(`${API_URL}/prefs`);
    return response.data;
  },

  setVisibility: async (connectionsVisible: boolean): Promise<{ connectionsVisible: boolean }> => {
    const response = await axios.patch(`${API_URL}/visibility`, { connectionsVisible });
    return response.data;
  },

  getNearby: async (data: {
    lat: number;
    lon: number;
    radius?: number;
    userId: string;
  }): Promise<{ users: NearbyUser[] }> => {
    const response = await axios.get(`${API_URL}/nearby`, { params: data });
    return response.data;
  },

  getVenues: async (data: {
    lat: number;
    lon: number;
    radius?: number;
    userId: string;
  }): Promise<{ venues: VenueCount[] }> => {
    const response = await axios.get(`${API_URL}/venues`, { params: { ...data, radius: data.radius ?? 1000 } });
    return response.data;
  },

  getComfortingMessage: async (): Promise<{ message: string }> => {
    const response = await axios.get(`${API_URL}/comforting-message`);
    return response.data;
  },

  reverseGeocode: async (lat: number, lon: number): Promise<{ city: string; country: string; displayName: string }> => {
    const response = await axios.get(`${API_URL}/reverse-geocode`, { params: { lat, lon } });
    return response.data;
  },

  /** Search real places (bar, mall, cinema, club, etc.) in a location; returns counts and most concentrated spot */
  searchPlaces: async (params: { q: string; type?: string }): Promise<{
    places: Array<{ venue: string; venueType: string; location: { lat: number; lon: number }; count: number }>;
    locationName?: string;
    mostConcentrated?: { venue: string; venueType: string; location: { lat: number; lon: number }; count: number } | null;
    message?: string;
  }> => {
    const response = await axios.get(`${API_URL}/search-places`, { params: { q: params.q.trim(), type: params.type || 'bar' } });
    return response.data;
  },
};
