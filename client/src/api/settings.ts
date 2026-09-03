import axios from 'axios';
import { API_BASE } from './config';
import { cacheNotifyPrefs } from '../lib/notifyPrefsCache';

const API_URL = API_BASE + '/api/settings';

export interface UserSettings {
  userId: string;
  notifications: {
    push: boolean;
    email: boolean;
    messages: boolean;
    matches: boolean;
    likes: boolean;
    interestAlerts?: boolean;
    interestVibrate?: boolean;
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

const DEFAULT_SETTINGS: Omit<UserSettings, 'userId'> = {
  notifications: {
    push: true,
    email: true,
    messages: true,
    matches: true,
    likes: true,
    interestAlerts: true,
    interestVibrate: true,
    sound: true,
    quietHours: { enabled: false, start: '22:00', end: '08:00' },
  },
  privacy: {
    showProfilePicture: true,
    showLocation: true,
    locationAccuracy: 'approximate',
    showOnlineStatus: true,
    readReceipts: true,
    profileVisibility: 'public',
    realTimeLocation: false,
  },
  filters: {
    minAge: 18,
    maxAge: 99,
    genders: [],
    maxDistance: 50,
    verifiedOnly: false,
    activeOnly: false,
  },
  accessibility: {
    theme: 'system',
    fontSize: 'medium',
    screenReader: false,
    highContrast: false,
  },
  localization: {
    language: 'en',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
  },
  video: {
    autoPlay: false,
    muteByDefault: true,
    quality: 'medium',
  },
  matching: {
    dailyMatchLimit: 50,
    swipeReset: 'daily',
  },
  findFriends: {
    enabled: false,
    activities: [],
  },
};

/** Old accounts may be missing nested objects (e.g. accessibility). Fill so Settings cannot crash. */
export function mergeUserSettings(raw?: Partial<UserSettings> | null): UserSettings {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    userId: typeof src.userId === 'string' ? src.userId : '',
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...(src.notifications || {}),
      quietHours: {
        ...DEFAULT_SETTINGS.notifications.quietHours,
        ...(src.notifications?.quietHours || {}),
      },
    },
    privacy: { ...DEFAULT_SETTINGS.privacy, ...(src.privacy || {}) },
    filters: { ...DEFAULT_SETTINGS.filters, ...(src.filters || {}) },
    accessibility: { ...DEFAULT_SETTINGS.accessibility, ...(src.accessibility || {}) },
    localization: { ...DEFAULT_SETTINGS.localization, ...(src.localization || {}) },
    video: { ...DEFAULT_SETTINGS.video, ...(src.video || {}) },
    matching: { ...DEFAULT_SETTINGS.matching, ...(src.matching || {}) },
    findFriends: { ...DEFAULT_SETTINGS.findFriends, ...(src.findFriends || {}) },
  };
}

function wrapSettings(data: { settings?: Partial<UserSettings> } | Partial<UserSettings> | null | undefined): {
  settings: UserSettings;
} {
  const settings = data && typeof data === 'object' && 'settings' in data ? data.settings : data;
  const merged = mergeUserSettings(settings as Partial<UserSettings> | undefined);
  cacheNotifyPrefs(merged);
  return { settings: merged };
}

export const settingsAPI = {
  getSettings: async (): Promise<{ settings: UserSettings }> => {
    const response = await axios.get(API_URL);
    return wrapSettings(response.data);
  },

  updateSettings: async (updates: Partial<UserSettings>): Promise<{ settings: UserSettings }> => {
    const response = await axios.put(API_URL, updates);
    return wrapSettings(response.data);
  },

  updateNotifications: async (notifications: Partial<UserSettings['notifications']>): Promise<{ settings: UserSettings }> => {
    const response = await axios.put(`${API_URL}/notifications`, notifications);
    return wrapSettings(response.data);
  },

  updatePrivacy: async (privacy: Partial<UserSettings['privacy']>): Promise<{ settings: UserSettings }> => {
    const response = await axios.put(`${API_URL}/privacy`, privacy);
    return wrapSettings(response.data);
  },

  updateFilters: async (filters: Partial<UserSettings['filters']>): Promise<{ settings: UserSettings }> => {
    const response = await axios.put(`${API_URL}/filters`, filters);
    return wrapSettings(response.data);
  },

  updateAccessibility: async (accessibility: Partial<UserSettings['accessibility']>): Promise<{ settings: UserSettings }> => {
    const response = await axios.put(`${API_URL}/accessibility`, accessibility);
    return wrapSettings(response.data);
  },
};



