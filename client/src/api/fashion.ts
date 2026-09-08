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
  mode?: 'fresh' | 'shuffle' | 'mix';
}

export type WardrobeKind = 'look' | 'piece' | 'draft';
export type PieceSlot = 'top' | 'bottom' | 'shoes' | 'outer' | 'full' | 'other';

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
  kind?: WardrobeKind;
  pieceSlot?: PieceSlot;
  worn?: boolean;
  vibe?: string;
  notes?: string;
}

export const fashionAPI = {
  style: async (
    prompt: string,
    guideId?: string,
    opts?: { excludeLookIds?: string[]; shuffle?: boolean; mixWardrobe?: boolean }
  ): Promise<FashionStyleResponse> => {
    const response = await axios.post(`${API_URL}/style`, {
      prompt,
      guideId,
      excludeLookIds: opts?.excludeLookIds || [],
      shuffle: Boolean(opts?.shuffle),
      mixWardrobe: Boolean(opts?.mixWardrobe),
    });
    return response.data;
  },
  tryOn: async (
    look: FashionLookCard,
    personUrl?: string | null
  ): Promise<{ tryOnUrl: string | null; engine: string; status: string; detail?: string }> => {
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
  wardrobe: async (): Promise<{
    items: WardrobeItem[];
    groups: string[];
    drafts: WardrobeItem[];
    pieces: WardrobeItem[];
    looks: WardrobeItem[];
  }> => {
    const response = await axios.get(`${API_URL}/wardrobe`);
    return response.data;
  },
  save: async (
    look: FashionLookCard,
    group: string,
    winner?: boolean,
    kind: WardrobeKind = 'look'
  ): Promise<{ item: WardrobeItem }> => {
    const response = await axios.post(`${API_URL}/wardrobe`, { look, group, winner, kind });
    return response.data;
  },
  saveUpload: async (payload: {
    title: string;
    imageUrl: string;
    kind?: WardrobeKind;
    pieceSlot?: PieceSlot;
    worn?: boolean;
    group?: string;
    event?: string;
    pieces?: string[];
    notes?: string;
  }): Promise<{ item: WardrobeItem }> => {
    const response = await axios.post(`${API_URL}/wardrobe`, payload);
    return response.data;
  },
  remove: async (id: string): Promise<void> => {
    await axios.delete(`${API_URL}/wardrobe/${id}`);
  },
};
