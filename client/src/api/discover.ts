import axios from 'axios';

const API_URL = '/api/discover';

export interface User {
  id: string;
  name: string;
  username: string;
  profilePicture: string | null;
}

export interface Interest {
  id: string;
  fromUserId: string;
  toUserId: string;
  city?: string;
  placeId?: string;
  placeType?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: string;
  expiresAt: string;
  responseMessage?: string;
}

export interface Place {
  id: string;
  name: string;
  type: 'bar' | 'gym' | 'restaurant' | 'park' | 'cafe' | 'club' | 'other';
  lat: number;
  lon: number;
  city: string;
  country: string;
  address?: string;
}

export const LOOKING_FOR_OPTIONS = ['dating', 'casual', 'friends', 'serious'] as const;
export type LookingForOption = typeof LOOKING_FOR_OPTIONS[number];

export interface UserPreference {
  userId: string;
  orientation: 'straight' | 'gay' | 'lesbian' | 'bisexual' | 'pansexual';
  /** User can select two or more (e.g. casual and dating). */
  lookingFor: LookingForOption[];
  city?: string;
  lastActiveAt: string;
}

export interface CityInfo {
  city: string;
  userCount: number;
  hasActiveUsers: boolean;
}

export const discoverAPI = {
  getAllCities: async (): Promise<{ cities: CityInfo[] }> => {
    const response = await axios.get(`${API_URL}/cities`);
    return response.data;
  },

  searchByCity: async (city: string): Promise<{ users: User[]; city: string; hasUsers?: boolean; message?: string }> => {
    const response = await axios.get(`${API_URL}/city`, { params: { city } });
    return response.data;
  },

  showInterest: async (toUserId: string, city?: string, placeId?: string, placeType?: string): Promise<{ interest: Interest }> => {
    const response = await axios.post(`${API_URL}/interest`, {
      toUserId,
      city,
      placeId,
      placeType,
    });
    return response.data;
  },

  getMyInterests: async (): Promise<{ sent: Interest[]; received: Interest[] }> => {
    const response = await axios.get(`${API_URL}/interests`);
    return response.data;
  },

  respondInterest: async (interestId: string, response: 'accepted' | 'rejected', message?: string): Promise<{ interest: Interest; openChat?: boolean; chatUserId?: string }> => {
    const response_data = await axios.post(`${API_URL}/interest/respond`, {
      interestId,
      response,
      message,
    });
    return response_data.data;
  },

  setPreference: async (preference: Partial<UserPreference>): Promise<{ preference: UserPreference }> => {
    const response = await axios.post(`${API_URL}/preference`, preference);
    return response.data;
  },

  getMyPreference: async (): Promise<{ preference: UserPreference | null }> => {
    const response = await axios.get(`${API_URL}/preference`);
    return response.data;
  },

  searchPlaces: async (lat: number, lon: number, radius?: number, type?: Place['type']): Promise<{ places: Place[] }> => {
    const response = await axios.get(`${API_URL}/places`, {
      params: { lat, lon, radius, type },
    });
    return response.data;
  },

  getPlaceUsers: async (placeId: string, lat: number, lon: number): Promise<{ users: User[]; count: number }> => {
    const response = await axios.get(`${API_URL}/places/${placeId}/users`, {
      params: { lat, lon },
    });
    return response.data;
  },
};

