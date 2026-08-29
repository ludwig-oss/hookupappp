import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/advice';

export interface AdviceAnswer {
  id: string;
  userId: string;
  userName: string;
  content: string;
  likeUserIds: string[];
  createdAt: string;
}

export interface AdviceQuestion {
  id: string;
  userId: string;
  query: string;
  answerCohort: string;
  orientation: string;
  askerGender: string;
  lookingFor: string[];
  answers: AdviceAnswer[];
  monthKey: string;
  createdAt: string;
  cohortLabel?: string;
  user?: {
    id: string;
    name: string;
    username?: string;
    profilePicture: string | null;
  } | null;
}

export interface AdviceFeedResponse {
  questions: AdviceQuestion[];
  yourCohort: string;
  cohortLabel: string;
  prizeEur: number;
}

export const adviceAPI = {
  search: async (query: string) => {
    const res = await axios.post(`${API_URL}/search`, { query });
    return res.data as {
      question: AdviceQuestion;
      message: string;
      notifiedCount: number;
    };
  },

  getFeed: async (q?: string): Promise<AdviceFeedResponse> => {
    const res = await axios.get(`${API_URL}/feed`, { params: q ? { q } : {} });
    return res.data;
  },

  getQuestion: async (questionId: string) => {
    const res = await axios.get(`${API_URL}/${questionId}`);
    return res.data as { question: AdviceQuestion };
  },

  postAnswer: async (questionId: string, content: string) => {
    const res = await axios.post(`${API_URL}/${questionId}/answer`, { content });
    return res.data as { answer: AdviceAnswer; firstTimeMessage?: string };
  },

  likeAnswer: async (questionId: string, answerId: string) => {
    const res = await axios.post(`${API_URL}/${questionId}/answers/${answerId}/like`);
    return res.data as { likes: number };
  },
};
