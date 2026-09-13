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

export interface FinanceLessonClient {
  id: string;
  day: number;
  title: string;
  minutes: number;
  guideId: string;
  guideName: string | null;
  summary: string;
  teach: string[];
  workout: string;
  quiz: Array<{
    id: string;
    question: string;
    options: string[];
  }>;
}

export interface FinanceTrack {
  required: boolean;
  optionalAvailable: boolean;
  optIn: boolean;
  alreadyCompletedToday: boolean;
  completedLessonIdToday: string | null;
  lesson: FinanceLessonClient;
  dayNumber: number;
  totalLessons: number;
  policyText: string | null;
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
  compliance?: {
    enabled: boolean;
    skipStreak: number;
    warning: string | null;
    visibilityReducedUntil: string | null;
    policyText?: string;
  } | null;
  finance?: FinanceTrack | null;
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
    const res = await axios.post(`${API_URL}/dismiss`);
    return res.data as { ok: true; message?: string | null; compliance?: TodayLesson['compliance'] };
  },

  exception: async (reason: 'work' | 'busy' | 'emergency') => {
    const res = await axios.post(`${API_URL}/exception`, { reason });
    return res.data as { ok: true; message: string; compliance?: TodayLesson['compliance'] };
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

  setFinanceOptIn: async (optIn: boolean) => {
    const res = await axios.post(`${API_URL}/finance/opt-in`, { optIn });
    return res.data as { finance: FinanceTrack };
  },

  submitFinanceQuiz: async (lessonId: string, answers: Record<string, number>) => {
    const res = await axios.post(`${API_URL}/finance/quiz`, { lessonId, answers });
    return res.data as {
      pass: boolean;
      score: number;
      total: number;
      message: string;
      finance: FinanceTrack;
    };
  },
};
