import axios from 'axios';

const API_URL = '/api/safety';

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email?: string;
  relationship?: string;
  createdAt: string;
}

export interface MeetupPlan {
  id: string;
  userId: string;
  meetAt: string;
  location: string;
  expectedBackAt: string;
  emergencyContactUserId?: string | null;
  emergencyContactId?: string | null;
  chatPartnerUserId?: string | null;
  notifiedAt?: string | null;
  createdAt: string;
}

export interface DateShare {
  id: string;
  userId: string;
  dateUserId: string;
  location: string;
  date: string;
  notes?: string;
  sharedAt: string;
  sharedWith: string[];
}

export interface TextingCoach {
  id: string;
  userId: string;
  name: string;
  username: string;
  profilePicture: string | null;
  rating: number;
  totalHelps: number;
  specialties: string[];
  isActive: boolean;
  hourlyRate: number;
  bio?: string;
  reviews: Array<{
    userId: string;
    userName: string;
    rating: number;
    comment: string;
    createdAt: string;
  }>;
}

export interface CoachingSession {
  id: string;
  userId: string;
  coachId: string;
  conversationId: string;
  status: 'active' | 'completed' | 'cancelled';
  startedAt: string;
  endedAt?: string;
  amount?: number;
  paymentStatus?: 'pending' | 'paid' | 'refunded';
}

export const safetyAPI = {
  // Emergency Contacts
  getEmergencyContacts: async (): Promise<{ contacts: EmergencyContact[] }> => {
    const response = await axios.get(`${API_URL}/emergency-contacts`);
    return response.data;
  },

  addEmergencyContact: async (contact: Omit<EmergencyContact, 'id' | 'userId' | 'createdAt'>): Promise<{ contact: EmergencyContact }> => {
    const response = await axios.post(`${API_URL}/emergency-contacts`, contact);
    return response.data;
  },

  deleteEmergencyContact: async (contactId: string): Promise<void> => {
    await axios.delete(`${API_URL}/emergency-contacts/${contactId}`);
  },

  // Meetup plans (safety check-in)
  createMeetupPlan: async (data: {
    meetAt: string;
    location: string;
    expectedBackAt: string;
    emergencyContactUserId?: string | null;
    emergencyContactId?: string | null;
    chatPartnerUserId?: string | null;
  }): Promise<{ plan: MeetupPlan }> => {
    const response = await axios.post(`${API_URL}/meetup-plan`, data);
    return response.data;
  },

  getMeetupPlans: async (): Promise<{ plans: MeetupPlan[] }> => {
    const response = await axios.get(`${API_URL}/meetup-plans`);
    return response.data;
  },

  markMeetupPlanNotified: async (planId: string): Promise<void> => {
    await axios.post(`${API_URL}/meetup-plan/${planId}/notified`);
  },

  // Date Sharing
  shareDateInfo: async (data: {
    dateUserId: string;
    location: string;
    date: string;
    notes?: string;
    contactIds: string[];
  }): Promise<{ share: DateShare; message: string }> => {
    const response = await axios.post(`${API_URL}/share-date`, data);
    return response.data;
  },

  // Texting Coaches
  getTextingCoaches: async (): Promise<{ coaches: TextingCoach[] }> => {
    const response = await axios.get(`${API_URL}/texting-coaches`);
    return response.data;
  },

  registerAsTextingCoach: async (data: {
    specialties: string[];
    hourlyRate: number;
    bio?: string;
  }): Promise<{ coach: TextingCoach }> => {
    const response = await axios.post(`${API_URL}/texting-coaches/register`, data);
    return response.data;
  },

  startCoachingSession: async (data: {
    coachId: string;
    conversationId: string;
  }): Promise<{ session: CoachingSession }> => {
    const response = await axios.post(`${API_URL}/texting-coaches/session/start`, data);
    return response.data;
  },

  endCoachingSession: async (data: {
    sessionId: string;
    amount: number;
    coachId: string;
    rating?: number;
    comment?: string;
  }): Promise<void> => {
    await axios.post(`${API_URL}/texting-coaches/session/end`, data);
  },

  getActiveCoachingSession: async (): Promise<{ session: CoachingSession | null }> => {
    const response = await axios.get(`${API_URL}/texting-coaches/session/active`);
    return response.data;
  },

  // Blocked Users
  getBlockedUsers: async (): Promise<{ users: Array<{ id: string; name: string; username: string; profilePicture: string | null }> }> => {
    const response = await axios.get(`${API_URL}/blocked-users`);
    return response.data;
  },

  unblockUser: async (blockedUserId: string): Promise<void> => {
    await axios.post(`${API_URL}/unblock`, { blockedUserId });
  },
};


