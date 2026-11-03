import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/compatibility';

export interface CompatibilityQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'scale' | 'yes_no';
  options?: string[];
  category: 'personality' | 'values' | 'lifestyle' | 'relationship';
}

export interface CompatibilityAnswer {
  questionId: string;
  answer: string | number;
}

export interface CompatibilityResult {
  userId: string;
  answers: CompatibilityAnswer[];
  completedAt: string;
  personalityType?: string;
  scores: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
}

export const compatibilityAPI = {
  getQuestions: async (): Promise<{ questions: CompatibilityQuestion[] }> => {
    const response = await axios.get(`${API_URL}/questions`);
    return response.data;
  },

  submitQuiz: async (answers: CompatibilityAnswer[]): Promise<{ result: CompatibilityResult }> => {
    const response = await axios.post(`${API_URL}/submit`, { answers });
    return response.data;
  },

  getResult: async (): Promise<{ result: CompatibilityResult }> => {
    const response = await axios.get(`${API_URL}/result`);
    return response.data;
  },

  getCompatibility: async (otherUserId: string): Promise<{ compatibility: number }> => {
    const response = await axios.get(`${API_URL}/${otherUserId}`);
    return response.data;
  },
};



