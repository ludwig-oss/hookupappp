import axios from 'axios';
import { API_BASE } from './config';
import type { FaceRegionStats } from '../lib/appearanceFaceMetrics';

const API_URL = `${API_BASE}/api/appearance`;

export type AppearanceAngle = 'frontal' | 'leftProfile' | 'rightProfile';

export interface AngleUpload {
  dataUrl: string;
  metrics: FaceRegionStats;
}

export interface WellnessHabit {
  id: string;
  step: number;
  pillar: 'debloat' | 'mewing' | 'skin' | 'eye-brow';
  title: string;
  action: string;
  why: string;
  weekly: string;
  targets: string[];
}

export interface FaultHit {
  id: string;
  label: string;
  family: string;
  score: number;
  evidence: string;
}

export interface BlemishScore {
  id: string;
  score: number;
  present: boolean;
}

export interface HairLook {
  id: string;
  title: string;
  vibe: string;
  family: string;
  density: string;
  prompt: string;
  notes: string;
}

export interface OutfitLook {
  id: string;
  title: string;
  event: string;
  vibe: string;
  formality: string;
  palette: string[];
  pieces: string[];
  imageUrl: string;
  fallback: string;
  warp: 'tailored' | 'drape' | 'layer';
  trendNotes: string;
}

export interface CompleteLook {
  id: string;
  occasion: string;
  autoChosen: boolean;
  outfit: OutfitLook;
  hair: HairLook;
  shopUrl: string;
}

export interface AppearanceCritic {
  winner: 'A' | 'B';
  scores: {
    A: { event: number; color: number; hairHarmony: number; trend: number; total: number };
    B: { event: number; color: number; hairHarmony: number; trend: number; total: number };
  };
  reasons: string[];
  skip: string;
  line: string;
  askLike: string;
}

export interface AfterAngle {
  angle: AppearanceAngle;
  beforeUrl: string;
  afterUrl: string | null;
  engine: string;
}

export interface ScanResponse {
  verifiedAngles: Record<AppearanceAngle, { verified: boolean; metrics: FaceRegionStats }>;
  taxonomy: {
    skinType: string;
    skinConfidence: number;
    blemishes: BlemishScore[];
    faults: FaultHit[];
  };
  summary: string;
  actionPlan: WellnessHabit[];
  actionPlanCount: number;
  librarySize: number;
  afterResults: {
    status: string;
    engine: string;
    detail: string;
    identityLock: { note: string };
    angles: Record<AppearanceAngle, AfterAngle>;
  };
  style: {
    occasion: string;
    optionA: CompleteLook;
    optionB: CompleteLook;
    critic: AppearanceCritic;
    autoChosen: boolean;
    askLike: string;
  };
  disclaimer: string;
}

export interface SavedAppearanceLook {
  id: string;
  group: string;
  lookId: string;
  title: string;
  occasion: string;
  outfitTitle: string;
  hairTitle: string;
  pieces: string[];
  imageUrl: string;
  approved: boolean;
  savedAt: string;
}

export const appearanceAPI = {
  scan: async (body: {
    frontal: AngleUpload;
    leftProfile: AngleUpload;
    rightProfile: AngleUpload;
    occasion?: string;
    guideId?: string;
  }): Promise<ScanResponse> => {
    const response = await axios.post(`${API_URL}/scan`, body, { timeout: 90000 });
    return response.data;
  },
  style: async (occasion: string, guideId?: string) => {
    const response = await axios.post(`${API_URL}/style`, { occasion, guideId });
    return response.data as ScanResponse['style'];
  },
  iterate: async (look: CompleteLook, message: string) => {
    const response = await axios.post(`${API_URL}/iterate`, { look, message });
    return response.data as { look: CompleteLook; changed: string; reply: string; askLike: string };
  },
  approve: async (look: CompleteLook, liked: boolean, group?: string, imageUrl?: string) => {
    const response = await axios.post(`${API_URL}/approve`, { look, liked, group, imageUrl });
    return response.data as { saved: boolean; item?: SavedAppearanceLook; hint?: string; askLike?: string };
  },
  looks: async () => {
    const response = await axios.get(`${API_URL}/looks`);
    return response.data as { items: SavedAppearanceLook[]; groups: string[] };
  },
  remove: async (id: string) => {
    await axios.delete(`${API_URL}/looks/${id}`);
  },
};
