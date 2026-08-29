import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/safety/shield';

export interface ShieldSettings {
  armed: boolean;
  autoArmWhenOutside: boolean;
  hasActivationSecret: boolean;
  hasCancelSecret: boolean;
  customActivationPhrase: string;
  enableHelpButton: boolean;
  enableScreenTaps: boolean;
  screenTapCount: number;
  enableVolumeTaps: boolean;
  enableSecretWord: boolean;
  appearanceDescription: string;
  emergencyContactUserId?: string | null;
  lastArmedAt?: string | null;
  lastLocation?: { lat: number; lon: number };
}

export type ShieldTriggerMethod = 'help_button' | 'secret_word' | 'screen_taps' | 'volume_taps' | 'custom_phrase';

export const personalSafetyAPI = {
  getSettings: async () => {
    const res = await axios.get(API_URL);
    return res.data as {
      settings: ShieldSettings;
      activeSignal: { id: string; lat: number; lon: number; notifyCount: number; createdAt: string } | null;
      ready: { ready: boolean; missing: string[] };
    };
  },

  updateSettings: async (patch: Partial<{
    activationSecret: string;
    cancelSecret: string;
    customActivationPhrase: string;
    appearanceDescription: string;
    autoArmWhenOutside: boolean;
    enableHelpButton: boolean;
    enableScreenTaps: boolean;
    enableVolumeTaps: boolean;
    enableSecretWord: boolean;
    screenTapCount: number;
    emergencyContactUserId: string | null;
  }>) => {
    const res = await axios.put(API_URL, patch);
    return res.data;
  },

  arm: async (lat?: number, lon?: number) => {
    const res = await axios.post(`${API_URL}/arm`, { lat, lon });
    return res.data as { message: string; settings: ShieldSettings };
  },

  disarm: async () => {
    const res = await axios.post(`${API_URL}/disarm`);
    return res.data;
  },

  trigger: async (lat: number, lon: number, via: ShieldTriggerMethod, phrase?: string) => {
    const res = await axios.post(`${API_URL}/trigger`, { lat, lon, via, phrase });
    return res.data as {
      alert: { id: string; lat: number; lon: number };
      nearbyNotified: number;
      policeNumber: string;
      message: string;
    };
  },

  cancelFalseAlarm: async (cancelPhrase: string) => {
    const res = await axios.post(`${API_URL}/cancel-false-alarm`, { cancelPhrase });
    return res.data as { message: string; notified: number };
  },

  resolve: async (alertId: string) => {
    await axios.post(`${API_URL}/resolve`, { alertId });
  },

  poll: async (lat?: number, lon?: number) => {
    const res = await axios.get(`${API_URL}/poll`, { params: lat != null ? { lat, lon } : {} });
    return res.data as {
      myActiveSignal: { id: string; userName: string; lat: number; lon: number; appearanceDescription?: string; notifyCount: number } | null;
      nearbySignals: Array<{ id: string; userName: string; lat: number; lon: number; appearanceDescription?: string; notifyCount: number }>;
    };
  },

  checkPhrase: async (phrase: string) => {
    const res = await axios.post(`${API_URL}/check-phrase`, { phrase });
    return res.data as { match: boolean };
  },
};
