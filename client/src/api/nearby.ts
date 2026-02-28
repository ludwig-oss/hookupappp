import axios from 'axios';

const API_URL = '/api/nearby';

export interface NearbyUser {
  id: string;
  name: string;
  username: string;
  profilePicture: string | null;
  distanceMeters: number;
  accuracy?: number;
  lastSeenAt?: string;
}

export interface BuzzRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'later' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  responseMessage?: string | null;
}

export const nearbyAPI = {
  updateLocation: async (
    userId: string,
    lat: number,
    lon: number,
    accuracy?: number
  ): Promise<void> => {
    await axios.post(`${API_URL}/location`, { userId, lat, lon, accuracy });
  },

  getNearbyUsers: async (
    userId: string,
    lat: number,
    lon: number
  ): Promise<{ nearby: NearbyUser[]; radiusMeters: number; activeWindowMs: number }> => {
    const response = await axios.get(`${API_URL}/users`, { params: { userId, lat, lon } });
    return response.data;
  },

  sendBuzz: async (fromUserId: string, toUserId: string): Promise<{ buzz: BuzzRequest }> => {
    const response = await axios.post(`${API_URL}/buzz`, { fromUserId, toUserId });
    return response.data;
  },

  getBuzz: async (userId: string): Promise<{ incoming: BuzzRequest[]; outgoing: BuzzRequest[] }> => {
    const response = await axios.get(`${API_URL}/buzz`, { params: { userId } });
    return response.data;
  },

  respondBuzz: async (
    userId: string,
    buzzId: string,
    responseValue: 'yes' | 'no' | 'later'
  ): Promise<{ buzz: BuzzRequest }> => {
    const response = await axios.post(`${API_URL}/buzz/respond`, {
      userId,
      buzzId,
      response: responseValue,
    });
    return response.data;
  },
};







