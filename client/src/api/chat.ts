import axios from 'axios';

const API_URL = '/api/chat';

export interface Message {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  createdAt: string;
  read: boolean;
}

export interface Conversation {
  userId: string;
  name: string;
  profilePicture: string | null;
  lastMessage: Message;
  unreadCount: number;
}

export interface User {
  id: string;
  name: string;
  username: string;
  profilePicture: string | null;
}

export const chatAPI = {
  sendMessage: async (toUserId: string, content: string, fromUserId: string): Promise<{ message: Message }> => {
    const response = await axios.post(`${API_URL}/send`, { toUserId, content, fromUserId });
    return response.data;
  },

  getConversation: async (otherUserId: string, userId: string): Promise<{ messages: Message[] }> => {
    const response = await axios.get(`${API_URL}/conversation/${otherUserId}`, { params: { userId } });
    return response.data;
  },

  getConversations: async (userId: string): Promise<{ conversations: Conversation[] }> => {
    const response = await axios.get(`${API_URL}/conversations`, { params: { userId } });
    return response.data;
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

  unmatchUser: async (unmatchedUserId: string): Promise<void> => {
    await axios.post(`${API_URL}/unmatch`, { unmatchedUserId });
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




