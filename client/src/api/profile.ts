import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/profile';

function getAuthHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

export interface ProfileData {
  id: string;
  email: string;
  name: string;
  username: string;
  profilePicture: string | null;
  profileSetupComplete: boolean;
  /** ISO date when user completed selfie verification (anti-catfish). Shown as green badge. */
  photoVerifiedAt?: string | null;
  /** When viewing another user's profile: true if they are in an active relationship. */
  inRelationship?: boolean;
  highlights: Array<{
    id: string;
    title?: string;
    items?: Array<{
      id: string;
      imageUrl: string;
      createdAt: string;
    }>;
    imageUrl?: string; // Backward compatibility
    coverImage?: string;
    createdAt: string;
  }>;
  disappearingPhotos: Array<{
    id: string;
    imageUrl: string;
    createdAt: string;
    views: Array<{
      userId: string;
      viewedAt: string;
    }>;
  }>;
}

export const profileAPI = {
  /** Get current user's full profile (requires Authorization header). Use after login to sync from server. */
  getCurrentUser: async (): Promise<ProfileData> => {
    const response = await axios.get(`${API_URL}/me`, { headers: getAuthHeaders() });
    return response.data;
  },

  getUserProfile: async (userId: string): Promise<ProfileData> => {
    try {
      const response = await axios.get(`${API_URL}/${userId}`);
      return response.data;
    } catch (err: any) {
      // If userId route fails, try /me route for current user
      if (err.response?.status === 404 || err.response?.status === 400) {
        try {
          const meResponse = await axios.get(`${API_URL}/me`);
          return meResponse.data;
        } catch (meErr) {
          throw err; // Throw original error
        }
      }
      throw err;
    }
  },

  uploadProfilePicture: async (imageBase64: string, userId: string): Promise<{ profilePicture: string; photoVerifiedAt?: string | null }> => {
    const response = await axios.post(`${API_URL}/picture`, { image: imageBase64, userId });
    return response.data;
  },

  /** Submit selfie verification (look left / center / right) to get the green "verified" badge. */
  submitPhotoVerification: async (userId: string, selfieImages: string[]): Promise<{ photoVerifiedAt: string }> => {
    const response = await axios.post(`${API_URL}/verify-photo`, { userId, selfieImages }, { headers: getAuthHeaders() });
    return response.data;
  },

  addHighlight: async (imageBase64: string, userId: string, highlightId?: string): Promise<{ highlight: any }> => {
    const response = await axios.post(`${API_URL}/highlights`, { image: imageBase64, userId, highlightId });
    return response.data;
  },

  deleteHighlight: async (highlightId: string, userId: string, itemId?: string): Promise<void> => {
    await axios.delete(`${API_URL}/highlights/${highlightId}`, { data: { userId, itemId } });
  },

  completeProfileSetup: async (profilePicture: string | null, userId: string): Promise<{ user: any }> => {
    const response = await axios.post(`${API_URL}/setup`, { profilePicture, userId });
    return response.data;
  },

  addDisappearingPhoto: async (imageBase64: string, userId: string): Promise<{ photo: any }> => {
    const response = await axios.post(`${API_URL}/disappearing-photos`, { image: imageBase64, userId });
    return response.data;
  },

  viewDisappearingPhoto: async (photoId: string, ownerId: string, viewerId: string): Promise<{ canView: boolean; imageUrl: string | null }> => {
    const response = await axios.post(`${API_URL}/disappearing-photos/view`, { photoId, ownerId, viewerId });
    return response.data;
  },

  /** Update current user's profile. Uses PUT /me so the backend always updates the authenticated user. */
  updateProfile: async (updates: {
    name?: string;
    username?: string;
    phoneNumber?: string;
    age?: number;
    bio?: string;
    gender?: string;
    height?: string;
    education?: string;
    occupation?: string;
    relationshipStatus?: string;
    country?: string;
    city?: string;
    publicFigureLevel?: 'world' | 'community' | 'country' | null;
    publicFigureProof?: string | null;
    publicFigureIdImage?: string | null;
    publicFigureUniqueImage?: string | null;
    publicFigureVerified?: boolean;
    revealToUserIds?: string[];
    celebChatDisappearMode?: 'none' | 'after_read' | 'after_read_seconds';
    celebChatDisappearSeconds?: number;
    celebMessagesOnlyWhenOpened?: boolean;
  }): Promise<{ user: any }> => {
    const response = await axios.put(`${API_URL}/me`, updates, { headers: getAuthHeaders() });
    return response.data;
  },
};


