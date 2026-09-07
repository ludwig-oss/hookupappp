import { Request, Response } from 'express';
import {
  listAiGuides,
  interpretAiQuery,
  lessonWithGuides,
  assignAiGuide,
  getAssignedAiGuide,
} from '../models/aiGuides.js';
import { getLesson } from '../data/aiGuideCatalog.js';

export const listAiGuidesHandler = async (_req: Request, res: Response) => {
  try {
    res.json({ guides: await listAiGuides() });
  } catch (error) {
    console.error('List AI guides error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const interpretAiQueryHandler = async (req: Request, res: Response) => {
  try {
    const query = String(req.body?.query || req.query.query || '');
    res.json(await interpretAiQuery(query));
  } catch (error) {
    console.error('Interpret AI query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAiLessonHandler = async (req: Request, res: Response) => {
  try {
    const data = await lessonWithGuides(String(req.params.topicId || ''));
    if (!data) return res.status(404).json({ error: 'Topic not found' });
    res.json(data);
  } catch (error) {
    console.error('Get AI lesson error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const assignAiGuideHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const guideId = String(req.body?.guideId || '');
    const topicId = req.body?.topicId ? String(req.body.topicId) : undefined;
    if (!guideId) return res.status(400).json({ error: 'guideId is required' });
    const result = await assignAiGuide(userId, guideId, topicId);
    res.json(result);
  } catch (error: any) {
    const msg = error?.message || 'Could not assign guide';
    if (/not found/i.test(msg)) return res.status(400).json({ error: msg });
    console.error('Assign AI guide error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const meAiGuideHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await getAssignedAiGuide(userId));
  } catch (error) {
    console.error('Get my AI guide error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const speakLineHandler = async (req: Request, res: Response) => {
  try {
    const lesson = getLesson(String(req.query.topicId || ''));
    if (!lesson) return res.status(404).json({ error: 'Topic not found' });
    const line = `${lesson.solution} ${lesson.unknown}`;
    res.json({ line });
  } catch (error) {
    console.error('Speak line error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
