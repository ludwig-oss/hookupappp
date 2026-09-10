import axios from 'axios';
import { API_BASE } from './config';
import type { GuideProgramStatus } from './guideProgram';

const API_URL = API_BASE + '/api/ai-guides';

export interface AiGuideRatings {
  directness: number;
  warmth: number;
  datingIq: number;
  texting: number;
  style: number;
  boundaries: number;
  healing: number;
  attraction: number;
}

export interface AiGuideCharacter {
  id: string;
  name: string;
  specialty: string;
  tagline: string;
  personality: string;
  thinking: string;
  portrait: string;
  voice: { hint: 'female' | 'male'; pitch: number; rate: number };
  ratings: AiGuideRatings;
  expertise: string[];
  categoryIds: string[];
}

export interface AiLesson {
  id: string;
  title: string;
  aliases: string[];
  categoryIds: string[];
  bestGuideIds: string[];
  cause: string;
  solution: string;
  prevention: string;
  unknown: string;
  demo: string;
}

export const aiGuidesAPI = {
  list: async (): Promise<{ guides: AiGuideCharacter[] }> => {
    const response = await axios.get(`${API_URL}/`);
    return response.data;
  },
  me: async (): Promise<{ guide: AiGuideCharacter | null }> => {
    const response = await axios.get(`${API_URL}/me`);
    return response.data;
  },
  interpret: async (query: string): Promise<{
    query: string;
    guess: { id: string; title: string; confidence: number } | null;
    alternates: { id: string; title: string }[];
  }> => {
    const response = await axios.post(`${API_URL}/interpret`, { query });
    return response.data;
  },
  lesson: async (topicId: string, guideId?: string): Promise<{ lesson: AiLesson; guides: AiGuideCharacter[] }> => {
    const response = await axios.get(`${API_URL}/lesson/${topicId}`, {
      params: guideId ? { guideId } : undefined,
    });
    return response.data;
  },
  assign: async (
    guideId: string,
    topicId?: string
  ): Promise<{ guide: AiGuideCharacter; lesson: AiLesson | null; status: GuideProgramStatus }> => {
    const response = await axios.post(`${API_URL}/assign`, { guideId, topicId });
    return response.data;
  },
  coachTexting: async (body: {
    otherUserId: string;
    guideId?: string;
    question?: string;
    messages?: Array<{ from: 'me' | 'them'; text: string }>;
  }): Promise<{
    advice: {
      guideId: string;
      guideName: string;
      specialty: string;
      situation: string;
      opinion: string;
      whyItWorks: string;
      replies: string[];
      nextMove: string;
      watchFor: string;
    };
    guide: AiGuideCharacter | null;
    help: { freeRemaining: number; allowed: boolean; isPremium: boolean };
  }> => {
    const response = await axios.post(`${API_URL}/coach-texting`, body);
    return response.data;
  },
};
