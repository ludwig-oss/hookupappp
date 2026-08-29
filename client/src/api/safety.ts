import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/safety';

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
  emergencyContactVideoNotifiedAt?: string | null;
  idVerificationConsent?: boolean;
  idVerificationStatus?: 'none' | 'pending_review' | 'verified' | 'rejected';
  dateSessionStatus?: 'scheduled' | 'active' | 'completed' | 'missing';
  trackingConsent?: boolean;
  okForRestOfDate?: boolean;
  dangerAlertAt?: string | null;
  nextSafetyCheckInAt?: string | null;
  hasIdOnFile?: boolean;
  hasSafetyVideo?: boolean;
  safetyCheckSubmittedAt?: string | null;
  agreedVenueName?: string | null;
  createdAt: string;
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

export interface DateVenueOption {
  id: string;
  name: string;
  type: string;
  description: string;
  estimatedCost: string;
  splitBillNote: string;
}

export interface DateVenueProposal {
  id: string;
  userA: string;
  userB: string;
  venues: DateVenueOption[];
  userAChoiceId: string | null;
  userBChoiceId: string | null;
  agreedVenue: DateVenueOption | null;
  status: 'voting' | 'agreed';
  createdAt: string;
  updatedAt: string;
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
    idVerificationConsent: boolean;
    trackingConsent: boolean;
    idFrontImage: string;
    idBackImage: string;
    agreedVenueName?: string;
  }): Promise<{ plan: MeetupPlan; message?: string }> => {
    const response = await axios.post(`${API_URL}/meetup-plan`, data);
    return response.data;
  },

  submitMeetupSafetyCheck: async (planId: string, safetyCheckVideo: string): Promise<{ plan: MeetupPlan; message: string }> => {
    const response = await axios.post(`${API_URL}/meetup-plan/safety-check`, { planId, safetyCheckVideo });
    return response.data;
  },

  getMeetupWeekStatus: async (otherUserId: string): Promise<{ meetupWeek: MeetupWeekStatus }> => {
    const response = await axios.get(`${API_URL}/meetup-week/${otherUserId}`);
    return response.data;
  },

  getDateVenueProposal: async (otherUserId: string, refresh = false): Promise<{ proposal: DateVenueProposal; rules: string }> => {
    const response = await axios.get(`${API_URL}/date-venues/${otherUserId}`, { params: { refresh: refresh ? 'true' : 'false' } });
    return response.data;
  },

  voteDateVenue: async (otherUserId: string, venueId: string): Promise<{ proposal: DateVenueProposal }> => {
    const response = await axios.post(`${API_URL}/date-venues/vote`, { otherUserId, venueId });
    return response.data;
  },

  pollMeetupSafetyReminders: async (): Promise<{
    needsSafetyVideo: MeetupPlan[];
    emergencyVideoCallPlans: MeetupPlan[];
  }> => {
    const response = await axios.get(`${API_URL}/meetup-safety/poll`);
    return response.data;
  },

  triggerWomenSOS: async (lat: number, lon: number, message?: string): Promise<{
    alert: { id: string };
    nearbyWomenNotified: number;
    policeNumber: string;
    mapsUrl: string;
    message: string;
  }> => {
    const response = await axios.post(`${API_URL}/women-sos`, { lat, lon, message });
    return response.data;
  },

  resolveWomenSOS: async (alertId: string): Promise<void> => {
    await axios.post(`${API_URL}/women-sos/resolve`, { alertId });
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

  isAdmin: async (): Promise<{ isAdmin: boolean }> => {
    const response = await axios.get(`${API_URL}/is-admin`);
    return response.data;
  },

  pollDateSafety: async (): Promise<{
    dueCheckIns: MeetupPlan[];
    activeSessions: MeetupPlan[];
    dangerAlerts: MeetupPlan[];
    checkInIntervalHours: number;
  }> => {
    const response = await axios.get(`${API_URL}/date-safety/poll`);
    return response.data;
  },

  startDateTracking: async (planId: string) => {
    const response = await axios.post(`${API_URL}/meetup-plan/${planId}/start-date`);
    return response.data;
  },

  postLocation: async (planId: string, lat: number, lon: number, accuracy?: number, isIndoor?: boolean) => {
    await axios.post(`${API_URL}/meetup-plan/${planId}/location`, { lat, lon, accuracy, isIndoor });
  },

  submitCheckIn: async (planId: string, isSafe: boolean, datePartnerOk?: boolean) => {
    const response = await axios.post(`${API_URL}/meetup-plan/${planId}/check-in`, { isSafe, datePartnerOk });
    return response.data;
  },

  triggerDanger: async (planId: string, safeWord?: string) => {
    const response = await axios.post(`${API_URL}/meetup-plan/${planId}/danger`, { safeWord, via: safeWord ? 'safe_word' : 'button' });
    return response.data;
  },

  submitOkRest: async (planId: string, ok360Video: string) => {
    const response = await axios.post(`${API_URL}/meetup-plan/${planId}/ok-rest`, { ok360Video });
    return response.data;
  },

  endDateSession: async (planId: string) => {
    const response = await axios.post(`${API_URL}/meetup-plan/${planId}/end-date`);
    return response.data;
  },

  getEmergencyTrail: async (planId: string) => {
    const response = await axios.get(`${API_URL}/emergency-trail/${planId}`);
    return response.data as { planId: string; daterName?: string; trail: Array<{ lat: number; lon: number; dwellMinutes?: number; label?: string }>; message: string };
  },

  setDateSafeWord: async (safeWord: string) => {
    const response = await axios.post(`${API_URL}/date-safe-word`, { safeWord });
    return response.data;
  },
};


