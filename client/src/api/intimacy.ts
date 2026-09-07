import axios from 'axios';
import { API_BASE } from './config';

const API_URL = `${API_BASE}/api/intimacy`;

export type IntimacyDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface IntimacyPosition {
  id: number;
  name: string;
  description: string;
  difficulty: IntimacyDifficulty;
  durationMinutes: number;
  nextPositionId: number;
  vibe: string;
}

export interface IntimacyTip {
  id: string;
  kind: 'last-longer' | 'do' | 'dont';
  title: string;
  line: string;
}

export interface IntimacyRoutine {
  count: number;
  briefing: IntimacyTip[];
  positions: IntimacyPosition[];
  disclaimer: string;
}

export interface IntimacyStep {
  position: IntimacyPosition;
  index: number;
  total: number;
  next: { id: number; name: string };
  tips: { now: IntimacyTip; extra: IntimacyTip };
  speak: string;
}

export type TermActSide = 'him-to-her' | 'her-to-him';
export type TermActCategory =
  | 'Psychological'
  | 'Sensory'
  | 'Advanced Oral'
  | 'Core Tension'
  | 'Edging'
  | 'Transitions';

export interface TermActTactic {
  id: number;
  category: TermActCategory;
  name: string;
  description: string;
  duration_minutes: number;
  next_id: number;
}

export interface TermActList {
  side: TermActSide;
  defaultSide: TermActSide;
  gender: string | null;
  count: number;
  tactics: TermActTactic[];
  disclaimer: string;
}

export interface TermActStep {
  side: TermActSide;
  tactic: TermActTactic;
  next: { id: number; name: string };
  prev: { id: number; name: string };
  total: number;
  speak: string;
}

export const intimacyAPI = {
  routine: async (): Promise<IntimacyRoutine> => {
    const response = await axios.get(`${API_URL}/routine`);
    return response.data;
  },
  step: async (id: number): Promise<IntimacyStep> => {
    const response = await axios.get(`${API_URL}/step/${id}`);
    return response.data;
  },
  termAct: async (side?: TermActSide): Promise<TermActList> => {
    const response = await axios.get(`${API_URL}/termact`, { params: side ? { side } : {} });
    return response.data;
  },
  termActStep: async (id: number, side: TermActSide): Promise<TermActStep> => {
    const response = await axios.get(`${API_URL}/termact/${id}`, { params: { side } });
    return response.data;
  },
};
