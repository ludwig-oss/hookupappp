import { Request, Response } from 'express';
import {
  getTodayLesson,
  saveSchedule,
  dismissNotification,
  completeToday,
  submitSkipQuiz,
  jumpToTopic,
  getCurriculumForUser,
} from '../models/school.js';

export const getToday = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const lesson = await getTodayLesson(userId);
    res.json(lesson);
  } catch (e) {
    console.error('School today error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCurriculum = async (_req: Request, res: Response) => {
  try {
    res.json({ topics: getCurriculumForUser() });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const postSchedule = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { homeHour, homeMinute, notifyEnabled } = req.body;
    if (homeHour == null || homeMinute == null) {
      return res.status(400).json({ error: 'homeHour and homeMinute required' });
    }
    const state = await saveSchedule(userId, Number(homeHour), Number(homeMinute), notifyEnabled !== false);
    res.json({ message: 'Schedule saved', state });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const postDismiss = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    await dismissNotification(userId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const postComplete = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await completeToday(userId);
    res.json({ message: 'Class completed for today!', ...result });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Could not complete' });
  }
};

export const postQuiz = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { topicId, answers } = req.body;
    if (!topicId || !answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'topicId and answers required' });
    }
    const result = await submitSkipQuiz(userId, topicId, answers);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Quiz failed' });
  }
};

export const postJumpTopic = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { topicId } = req.body;
    if (!userId || !topicId) return res.status(400).json({ error: 'topicId required' });
    const topic = await jumpToTopic(userId, topicId);
    res.json({ topic });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Not found' });
  }
};
