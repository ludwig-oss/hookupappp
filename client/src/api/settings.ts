import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/settings';

export interface UserSettings {
  userId: string;
  notifications: {
    push: boolean;
    email: boolean;
    messages: boolean;
    matches: boolean;
    likes: boolean;
    sound: boolean;
    quietHours: { enabled: boolean; start: string; end: string };
  };
  privacy: {
    showProfilePicture?: boolean;
    showLocation: boolean;
    locationAccuracy: 'exact' | 'approximate' | 'city';
    showOnlineStatus: boolean;
    readReceipts: boolean;
    profileVisibility: 'public' | 'friends' | 'private';
    realTimeLocation: boolean;
  };
  filters: {
    minAge: number;
    maxAge: number;
    genders: string[];
    maxDistance: number;
    verifiedOnly: boolean;
    activeOnly: boolean;
  };
  accessibility: {
    theme: 'light' | 'dark' | 'system';
    fontSize: 'small' | 'medium' | 'large';
    screenReader: boolean;
    highContrast: boolean;
  };
  localization: {
    language: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
  };
  video: {
    autoPlay: boolean;
    muteByDefault: boolean;
    quality: 'low' | 'medium' | 'high';
  };
  matching: {
    dailyMatchLimit: number;
    swipeReset: 'daily' | 'weekly' | 'never';
  };
  findFriends: {
    enabled: boolean;
    activities: string[];
  };
}

export const settingsAPI = {
  getSettings: async (): Promise<{ settings: UserSettings }> => {
    const response = await axios.get(API_URL);
    return response.data;
  },

  updateSettings: async (updates: Partial<UserSettings>): Promise<{ settings: UserSettings }> => {
    const response = await axios.put(API_URL, updates);
    return response.data;
  },

  updateNotifications: async (notifications: Partial<UserSettings['notifications']>): Promise<{ settings: UserSettings }> => {
    const response = await axios.put(`${API_URL}/notifications`, notifications);
    return response.data;
  },

  updatePrivacy: async (privacy: Partial<UserSettings['privacy']>): Promise<{ settings: UserSettings }> => {
    const response = await axios.put(`${API_URL}/privacy`, privacy);
    return response.data;
  },

  updateFilters: async (filters: Partial<UserSettings['filters']>): Promise<{ settings: UserSettings }> => {
    const response = await axios.put(`${API_URL}/filters`, filters);
    return response.data;
  },

  updateAccessibility: async (accessibility: Partial<UserSettings['accessibility']>): Promise<{ settings: UserSettings }> => {
    const response = await axios.put(`${API_URL}/accessibility`, accessibility);
    return response.data;
  },
};



