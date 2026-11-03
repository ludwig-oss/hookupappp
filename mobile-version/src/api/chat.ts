import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/chat';

export interface Message {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  createdAt: string;
  read: boolean;
}

export interface MeetupWeekStatus {
  active: boolean;
  connectedAt: string | null;
  deadlineAt: string | null;
  metInPerson: boolean;
  expired: boolean;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  ruleText: string;
}

export interface ReplyDeadlineStatus {
  active: boolean;
  owesReplyUserId: string | null;
  deadlineAt: string | null;
  expired: boolean;
  hoursRemaining: number | null;
  minutesRemaining: number | null;
  ruleText: string;
}

export interface Conversation {
  userId: string;
  name: string;
  profilePicture: string | null;
  lastMessage: Message;
  unreadCount: number;
  replyDeadline?: ReplyDeadlineStatus;
  meetupWeek?: MeetupWeekStatus;
  intent?: 'serious' | 'casual' | 'friends' | null;
  rouletteChat?: boolean;
  rouletteHold?: boolean;
  rouletteHealNote?: string | null;
  rouletteOwner?: boolean;
  roulettePostId?: string | null;
  dateLock?: {
    locked: boolean;
    unlockAt: string | null;
    matchId: string | null;
    reason: string;
    scheduledAt: string | null;
    ideaTitle: string | null;
  };
}

export type ChatIntent = 'serious' | 'casual' | 'friends';

export interface User {
  id: string;
  name: string;
  username: string;
  profilePicture: string | null;
}

export const chatAPI = {
  sendMessage: async (
    toUserId: string,
    content: string,
    fromUserId: string
  ): Promise<{ message: Message; replyDeadline?: ReplyDeadlineStatus }> => {
    const response = await axios.post(`${API_URL}/send`, { toUserId, content, fromUserId });
    return response.data;
  },

  getConversation: async (
    otherUserId: string,
    userId: string
  ): Promise<{
    messages: Message[];
    replyDeadline?: ReplyDeadlineStatus;
    meetupWeek?: MeetupWeekStatus;
    unmatched?: boolean;
    unmatchedReason?: string;
    rouletteChat?: boolean;
    rouletteHold?: boolean;
    rouletteHealNote?: string | null;
    rouletteOwner?: boolean;
    roulettePostId?: string | null;
    dateLock?: Conversation['dateLock'];
  }> => {
    const response = await axios.get(`${API_URL}/conversation/${otherUserId}`, { params: { userId } });
    return response.data;
  },

  getConversations: async (userId: string): Promise<{ conversations: Conversation[] }> => {
    const response = await axios.get(`${API_URL}/conversations`, { params: { userId } });
    return response.data;
  },

  setChatIntent: async (otherUserId: string, intent: ChatIntent | null) => {
    const response = await axios.put(`${API_URL}/intents/${otherUserId}`, { intent });
    return response.data as { intents: Record<string, ChatIntent>; intent: ChatIntent | null };
  },

  getAvailableUsers: async (userId: string): Promise<{ users: User[] }> => {
    const response = await axios.get(`${API_URL}/users`, { params: { userId } });
    return response.data;
  },

  searchUsers: async (userId: string, q: string): Promise<{ users: User[] }> => {
    const response = await axios.get(`${API_URL}/users/search`, { params: { userId, q: q.trim() } });
    return response.data;
  },

  markAsRead: async (otherUserId: string, userId: string): Promise<void> => {
    await axios.post(`${API_URL}/read`, { otherUserId, userId });
  },

  blockUser: async (blockedUserId: string): Promise<void> => {
    await axios.post(`${API_URL}/block`, { blockedUserId });
  },

  muteUser: async (mutedUserId: string): Promise<void> => {
    await axios.post(`${API_URL}/mute`, { mutedUserId });
  },

  unmatchUser: async (
    unmatchedUserId: string,
    opts?: { reason?: string; reasonPrivate?: boolean }
  ): Promise<void> => {
    await axios.post(`${API_URL}/unmatch`, {
      unmatchedUserId,
      reason: opts?.reason || '',
      reasonPrivate: Boolean(opts?.reasonPrivate),
    });
  },

  getFocus: async (): Promise<{ focus: { partnerUserId: string; partnerName: string | null; startedAt: string; endsAt: string; daysLeft: number } | null }> => {
    const response = await axios.get(`${API_URL}/focus`);
    return response.data;
  },

  startFocus: async (partnerUserId: string): Promise<{ focus: { partnerUserId: string; partnerName: string | null; startedAt: string; endsAt: string; daysLeft: number } }> => {
    const response = await axios.post(`${API_URL}/focus`, { partnerUserId });
    return response.data;
  },

  endFocus: async (): Promise<{ focus: null }> => {
    const response = await axios.delete(`${API_URL}/focus`);
    return response.data;
  },
};




