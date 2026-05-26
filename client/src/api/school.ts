import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/school';

export interface SchoolTopic {
  id: string;
  day: number;
  title: string;
  lessonTitle: string;
  description: string;
  icon: string;
  guideCategoryId: string;
  dailyWorkout: string;
  quiz: Array<{
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
  }>;
}

export interface TodayLesson {
  setupComplete: boolean;
  homeTime: { hour: number; minute: number };
  today: string;
  alreadyCompletedToday: boolean;
  showNotification: boolean;
  showOnLogin: boolean;
  currentTopic: SchoolTopic;
  topicIndex: number;
  dayNumber: number;
  totalClasses: number;
  alternateSuggestion: SchoolTopic | null;
  progressPercent: number;
  completedCount: number;
}

export const schoolAPI = {
  getToday: async (): Promise<TodayLesson> => {
    const res = await axios.get(`${API_URL}/today`);
    return res.data;
  },

  getCurriculum: async () => {
    const res = await axios.get(`${API_URL}/curriculum`);
    return res.data as { topics: SchoolTopic[] };
  },

  saveSchedule: async (homeHour: number, homeMinute: number, notifyEnabled = true) => {
    const res = await axios.post(`${API_URL}/schedule`, { homeHour, homeMinute, notifyEnabled });
    return res.data;
  },

  dismiss: async () => {
    await axios.post(`${API_URL}/dismiss`);
  },

  completeToday: async () => {
    const res = await axios.post(`${API_URL}/complete`);
    return res.data;
  },

  submitQuiz: async (topicId: string, answers: Record<string, number>) => {
    const res = await axios.post(`${API_URL}/quiz`, { topicId, answers });
    return res.data as {
      pass: boolean;
      score: number;
      total: number;
      message: string;
      nextTopic?: SchoolTopic;
    };
  },

  jumpTopic: async (topicId: string) => {
    const res = await axios.post(`${API_URL}/jump-topic`, { topicId });
    return res.data;
  },
};
