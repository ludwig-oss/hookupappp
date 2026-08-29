import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/safety/voice-recording';

export interface VoiceRecordingSession {
  id: string;
  mode: 'date_safety' | 'relationship_gathering';
  status: string;
  consentSteps: number;
  consentRequired: number;
  startedAt?: string | null;
  endedAt?: string | null;
  expiresAt?: string;
  mutedSince?: string | null;
  gatheringReason?: string | null;
  homeReviewPending?: boolean;
  chunkCount?: number;
  meetupPlanId?: string | null;
  partnerUserId?: string | null;
}

export interface VoiceGuardSettings {
  enabled: boolean;
  user1ConsentSteps?: number;
  user2ConsentSteps?: number;
  fullyConsented?: boolean;
  consentRequired?: number;
  myConsentSteps?: number;
  isUser1?: boolean;
}

export const voiceRecordingAPI = {
  poll: async () => {
    const res = await axios.get(`${API_URL}/poll`);
    return res.data as {
      needsSensitiveReminder: VoiceRecordingSession | null;
      homeReview: VoiceRecordingSession | null;
      partnerLive: VoiceRecordingSession | null;
    };
  },

  getDateSession: async (planId: string) => {
    const res = await axios.get(`${API_URL}/date/${planId}`);
    return res.data as { session: VoiceRecordingSession | null };
  },

  createDateSession: async (planId: string) => {
    const res = await axios.post(`${API_URL}/date/${planId}/create`);
    return res.data as { session: VoiceRecordingSession; message: string };
  },

  setPlanPin: async (planId: string, pin: string) => {
    const res = await axios.post(`${API_URL}/date/${planId}/pin`, { pin });
    return res.data;
  },

  setContactPin: async (contactId: string, pin: string) => {
    const res = await axios.post(`${API_URL}/emergency-contact-pin`, { contactId, pin });
    return res.data;
  },

  consent: async (sessionId: string) => {
    const res = await axios.post(`${API_URL}/${sessionId}/consent`);
    return res.data as { session: VoiceRecordingSession; remaining: number; message: string };
  },

  uploadChunk: async (sessionId: string, audioData: string, durationSec?: number) => {
    const res = await axios.post(`${API_URL}/${sessionId}/chunk`, { audioData, durationSec });
    return res.data as { session: VoiceRecordingSession };
  },

  muteSensitive: async (sessionId: string) => {
    const res = await axios.post(`${API_URL}/${sessionId}/mute-sensitive`);
    return res.data as { session: VoiceRecordingSession; message: string };
  },

  unmuteSensitive: async (sessionId: string) => {
    const res = await axios.post(`${API_URL}/${sessionId}/unmute-sensitive`);
    return res.data as { session: VoiceRecordingSession; message: string };
  },

  end: async (sessionId: string) => {
    const res = await axios.post(`${API_URL}/${sessionId}/end`);
    return res.data as { session: VoiceRecordingSession; message: string };
  },

  homeReview: async (sessionId: string, hadSensitiveTalk: boolean, consultPartner: boolean) => {
    const res = await axios.post(`${API_URL}/${sessionId}/home-review`, { hadSensitiveTalk, consultPartner });
    return res.data;
  },

  partnerDelete: async (sessionId: string, approve: boolean) => {
    const res = await axios.post(`${API_URL}/${sessionId}/partner-delete`, { approve });
    return res.data;
  },

  emergencyAccess: async (planId: string, pin: string) => {
    const res = await axios.post(`${API_URL}/emergency-access/${planId}`, { pin });
    return res.data as {
      session: VoiceRecordingSession;
      chunks: Array<{ id: string; recordedAt: string; muted?: boolean; audioDataUrl?: string | null }>;
      message: string;
    };
  },

  policeRequest: async (recordingId: string, documentData: string, reason: string) => {
    const res = await axios.post(`${API_URL}/police-request/${recordingId}`, { documentData, reason });
    return res.data;
  },

  getGuardSettings: async (partnerUserId: string) => {
    const res = await axios.get(`${API_URL}/guard/${partnerUserId}`);
    return res.data as { settings: VoiceGuardSettings };
  },

  toggleGuard: async (partnerUserId: string, enabled: boolean) => {
    const res = await axios.post(`${API_URL}/guard/toggle`, { partnerUserId, enabled });
    return res.data as { settings: VoiceGuardSettings; message: string };
  },

  guardConsent: async (partnerUserId: string) => {
    const res = await axios.post(`${API_URL}/guard/consent`, { partnerUserId });
    return res.data as { settings: VoiceGuardSettings };
  },

  startGathering: async (partnerUserId: string, reason: string) => {
    const res = await axios.post(`${API_URL}/guard/start`, { partnerUserId, reason });
    return res.data as { session: VoiceRecordingSession; message: string };
  },

  detectGathering: async (partnerUserId: string, message: string) => {
    const res = await axios.post(`${API_URL}/guard/detect-gathering`, { partnerUserId, message });
    return res.data as { detected: boolean };
  },

  listen: async (sessionId: string) => {
    const res = await axios.get(`${API_URL}/listen/${sessionId}`);
    return res.data as { chunks: Array<{ id: string; recordedAt: string; muted?: boolean; audioDataUrl?: string | null }> };
  },
};
