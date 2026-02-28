import axios from 'axios';

const API_URL = '/api/gamification';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'profile' | 'social' | 'premium' | 'achievement' | 'safety' | 'explorer';
  pointsRequired: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  target: number;
  pointsReward: number;
}

export interface UserGamification {
  userId: string;
  points: number;
  badges: string[];
  achievements: Array<{
    id: string;
    progress: number;
    completed: boolean;
    completedAt: string | null;
  }>;
  level: number;
  totalMatches: number;
  totalMessages: number;
  totalLikes: number;
  profileCompleteness: number;
}

export const gamificationAPI = {
  getGamification: async (): Promise<{ gamification: UserGamification }> => {
    const response = await axios.get(API_URL);
    return response.data;
  },

  getBadges: async (): Promise<{ badges: Badge[] }> => {
    const response = await axios.get(`${API_URL}/badges`);
    return response.data;
  },

  getAchievements: async (): Promise<{ achievements: Achievement[] }> => {
    const response = await axios.get(`${API_URL}/achievements`);
    return response.data;
  },

  getLeaderboard: async (): Promise<{ leaderboard: any[] }> => {
    const response = await axios.get(`${API_URL}/leaderboard`);
    return response.data;
  },

  awardPoints: async (points: number, reason?: string): Promise<{ gamification: UserGamification }> => {
    const response = await axios.post(`${API_URL}/award-points`, { points, reason });
    return response.data;
  },

  updateStats: async (stats: Partial<Pick<UserGamification, 'totalMatches' | 'totalMessages' | 'totalLikes' | 'profileCompleteness'>>): Promise<{ gamification: UserGamification }> => {
    const response = await axios.put(`${API_URL}/stats`, stats);
    return response.data;
  },
};



