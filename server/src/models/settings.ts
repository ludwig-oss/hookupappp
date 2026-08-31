import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export interface UserSettings {
  userId: string;
  notifications: {
    push: boolean;
    email: boolean;
    messages: boolean;
    matches: boolean;
    likes: boolean;
    /** Interest requests (someone tapped interest in Discover). */
    interestAlerts: boolean;
    /** Vibration pattern for interest push (user can turn off). */
    interestVibrate: boolean;
    sound: boolean;
    quietHours: { enabled: boolean; start: string; end: string };
  };
  privacy: {
    showProfilePicture: boolean;
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

const SETTINGS_PATH = join(process.cwd(), 'server', 'data', 'settings.json');

async function readSettings(): Promise<UserSettings[]> {
  try {
    const data = await readFile(SETTINGS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeSettings(settings: UserSettings[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

const defaultSettings: Omit<UserSettings, 'userId'> = {
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

function hydrateSettings(userSettings: Partial<UserSettings> & { userId: string }): UserSettings {
  return {
    userId: userSettings.userId,
    notifications: {
      ...defaultSettings.notifications,
      ...userSettings.notifications,
      quietHours: {
        ...defaultSettings.notifications.quietHours,
        ...userSettings.notifications?.quietHours,
      },
    },
    privacy: { ...defaultSettings.privacy, ...userSettings.privacy },
    filters: { ...defaultSettings.filters, ...userSettings.filters },
    accessibility: { ...defaultSettings.accessibility, ...userSettings.accessibility },
    localization: { ...defaultSettings.localization, ...userSettings.localization },
    video: { ...defaultSettings.video, ...userSettings.video },
    matching: { ...defaultSettings.matching, ...userSettings.matching },
    findFriends: { ...defaultSettings.findFriends, ...userSettings.findFriends },
  };
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const settings = await readSettings();
  const userSettings = settings.find(s => s.userId === userId);
  
  if (userSettings) {
    return hydrateSettings(userSettings);
  }
  
  // Create default settings
  const newSettings: UserSettings = {
    userId,
    ...defaultSettings,
  };
  settings.push(newSettings);
  await writeSettings(settings);
  return newSettings;
}

export async function updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings> {
  const settings = await readSettings();
  const index = settings.findIndex(s => s.userId === userId);
  
  if (index !== -1) {
    const current = settings[index];
    settings[index] = hydrateSettings({
      ...current,
      ...updates,
      userId,
      notifications: updates.notifications
        ? { ...current.notifications, ...updates.notifications }
        : current.notifications,
      privacy: updates.privacy ? { ...current.privacy, ...updates.privacy } : current.privacy,
      filters: updates.filters ? { ...current.filters, ...updates.filters } : current.filters,
      accessibility: updates.accessibility
        ? { ...current.accessibility, ...updates.accessibility }
        : current.accessibility,
      localization: updates.localization
        ? { ...current.localization, ...updates.localization }
        : current.localization,
      video: updates.video ? { ...current.video, ...updates.video } : current.video,
      matching: updates.matching ? { ...current.matching, ...updates.matching } : current.matching,
      findFriends: updates.findFriends
        ? { ...current.findFriends, ...updates.findFriends }
        : current.findFriends,
    });
  } else {
    settings.push(hydrateSettings({
      userId,
      ...defaultSettings,
      ...updates,
    }));
  }
  
  await writeSettings(settings);
  return hydrateSettings(settings.find(s => s.userId === userId) || { userId, ...defaultSettings });
}



