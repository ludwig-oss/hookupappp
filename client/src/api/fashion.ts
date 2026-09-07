import axios from 'axios';
import { API_BASE } from './config';

const API_URL = `${API_BASE}/api/fashion`;

export interface FashionLookCard {
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
  shopUrl: string;
  trendNotes: string;
  tryOnUrl?: string | null;
  tryOnEngine?: string;
}

export interface FashionCritic {
  winner: 'A' | 'B';
  scores: {
    A: { event: number; color: number; body: number; trend: number; total: number };
    B: { event: number; color: number; body: number; trend: number; total: number };
  };
  reasons: string[];
  skip: string;
  line: string;
}

export interface FashionStyleResponse {
  prompt: string;
  guideLine: string;
  intent: { event: string; formality: string; colors: string[]; vibe: string };
  optionA: FashionLookCard;
  optionB: FashionLookCard;
  critic: FashionCritic;
  personUrl: string | null;
  tryOnReady?: boolean;
}

export interface WardrobeItem {
  id: string;
  group: string;
  lookId: string;
  title: string;
  imageUrl: string;
  pieces: string[];
  event: string;
  savedAt: string;
  winner?: boolean;
}

export const fashionAPI = {
  style: async (prompt: string, guideId?: string): Promise<FashionStyleResponse> => {
    const response = await axios.post(`${API_URL}/style`, { prompt, guideId });
    return response.data;
  },
  tryOn: async (look: FashionLookCard, personUrl?: string | null): Promise<{ tryOnUrl: string | null; engine: string; status: string; detail?: string }> => {
    const response = await axios.post(
      `${API_URL}/try-on`,
      {
        garmentUrl: look.imageUrl,
        warp: look.warp,
        event: look.event,
        title: look.title,
        pieces: look.pieces,
        personUrl: personUrl || undefined,
      },
      { timeout: 70000 }
    );
    return response.data;
  },
  wardrobe: async (): Promise<{ items: WardrobeItem[]; groups: string[] }> => {
    const response = await axios.get(`${API_URL}/wardrobe`);
    return response.data;
  },
  save: async (look: FashionLookCard, group: string, winner?: boolean): Promise<{ item: WardrobeItem }> => {
    const response = await axios.post(`${API_URL}/wardrobe`, { look, group, winner });
    return response.data;
  },
  remove: async (id: string): Promise<void> => {
    await axios.delete(`${API_URL}/wardrobe/${id}`);
  },
};
