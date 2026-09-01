import axios from 'axios';
import { API_BASE, MEDIA_API_BASE } from './config';

const API_URL = `${API_BASE}/api/profile`;
const MEDIA_API_URL = `${MEDIA_API_BASE || API_BASE}/api/profile`;

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
  gender?: string;
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
      mediaType?: 'image' | 'video';
      createdAt: string;
    }>;
    imageUrl?: string; // Backward compatibility
    coverImage?: string;
    createdAt: string;
  }>;
  stories?: Array<{
    id: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    createdAt: string;
    expiresAt: string;
    audience: 'all' | 'closeFriends';
  }>;
  /** Only present on your own profile. */
  closeFriendIds?: string[];
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
    // Same origin as signup/login so a just-created session is not fetched from a
    // different host (Render) that can 404/CORS-fail and wipe the new account.
    const response = await axios.get(`${API_URL}/me`, { headers: getAuthHeaders() });
    return response.data;
  },

  getUserProfile: async (userId: string): Promise<ProfileData> => {
    try {
      const response = await axios.get(`${MEDIA_API_URL}/${userId}`, { headers: getAuthHeaders() });
      return response.data;
    } catch (err: any) {
      // If userId route fails, try /me route for current user
      if (err.response?.status === 404 || err.response?.status === 400) {
        try {
          const meResponse = await axios.get(`${MEDIA_API_URL}/me`, { headers: getAuthHeaders() });
          return meResponse.data;
        } catch (meErr) {
          throw err; // Throw original error
        }
      }
      throw err;
    }
  },

  uploadProfilePicture: async (imageBase64OrDataUrl: string, userId: string): Promise<{ profilePicture: string; photoVerifiedAt?: string | null }> => {
    const response = await axios.post(`${MEDIA_API_URL}/picture`, { image: imageBase64OrDataUrl, userId }, { headers: getAuthHeaders() });
    return response.data;
  },

  /** Submit selfie verification (look left / center / right) to get the green "verified" badge. */
  submitPhotoVerification: async (userId: string, selfieImages: string[]): Promise<{ photoVerifiedAt: string }> => {
    const response = await axios.post(`${API_URL}/verify-photo`, { userId, selfieImages }, { headers: getAuthHeaders() });
    return response.data;
  },

  addHighlight: async (mediaBase64OrDataUrl: string, userId: string, highlightId?: string): Promise<{ highlight: any }> => {
    const body: Record<string, string | undefined> = { userId, highlightId };
    if (mediaBase64OrDataUrl.startsWith('data:') || /^https?:\/\//i.test(mediaBase64OrDataUrl)) {
      (body as { media?: string }).media = mediaBase64OrDataUrl;
    } else {
      body.image = mediaBase64OrDataUrl;
    }
    const response = await axios.post(`${MEDIA_API_URL}/highlights`, body, { headers: getAuthHeaders(), timeout: 60_000 });
    return response.data;
  },

  addStory: async (
    mediaBase64OrDataUrl: string,
    audience: 'all' | 'closeFriends'
  ): Promise<{ story: any }> => {
    const body: Record<string, string> = { audience };
    if (mediaBase64OrDataUrl.startsWith('data:') || /^https?:\/\//i.test(mediaBase64OrDataUrl)) {
      body.media = mediaBase64OrDataUrl;
    } else {
      body.image = mediaBase64OrDataUrl;
    }
    const response = await axios.post(`${MEDIA_API_URL}/stories`, body, { headers: getAuthHeaders(), timeout: 60_000 });
    return response.data;
  },

  deleteStory: async (storyId: string): Promise<void> => {
    await axios.delete(`${API_URL}/stories/${storyId}`, { headers: getAuthHeaders() });
  },

  reorderHighlights: async (orderedIds: string[]): Promise<void> => {
    await axios.put(`${API_URL}/highlights/reorder`, { orderedIds }, { headers: getAuthHeaders() });
  },

  addHighlightFromStory: async (storyId: string, highlightId?: string): Promise<{ highlight: any }> => {
    const response = await axios.post(
      `${API_URL}/highlights/from-story`,
      { storyId, highlightId },
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  deleteHighlight: async (highlightId: string, userId: string, itemId?: string): Promise<void> => {
    await axios.delete(`${API_URL}/highlights/${highlightId}`, { data: { userId, itemId }, headers: getAuthHeaders() });
  },

  completeProfileSetup: async (profilePicture: string | null, userId: string): Promise<{ user: any }> => {
    const response = await axios.post(
      `${API_URL}/setup`,
      { profilePicture, userId },
      { headers: getAuthHeaders(), timeout: 45_000 }
    );
    return response.data;
  },

  addDisappearingPhoto: async (imageBase64: string, userId: string): Promise<{ photo: any }> => {
    const response = await axios.post(`${API_URL}/disappearing-photos`, { image: imageBase64, userId }, { headers: getAuthHeaders() });
    return response.data;
  },

  viewDisappearingPhoto: async (photoId: string, ownerId: string, viewerId: string): Promise<{ canView: boolean; imageUrl: string | null }> => {
    const response = await axios.post(`${API_URL}/disappearing-photos/view`, { photoId, ownerId, viewerId }, { headers: getAuthHeaders() });
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
    closeFriendIds?: string[];
  }): Promise<{ user: any }> => {
    const response = await axios.put(`${API_URL}/me`, updates, { headers: getAuthHeaders() });
    return response.data;
  },
};


