import { Request, Response } from 'express';
import {
  getGuideProgramStatus,
  saveProblemAreas,
  saveCoupleProblemAreas,
  getPendingEvalsForGuide,
  evaluateClient,
  type GuideProgramGrade,
} from '../models/guideProgram.js';

export const getMyGuideProgram = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const status = await getGuideProgramStatus(userId);
    res.json(status);
  } catch (error) {
    console.error('Guide program status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const postProblemAreas = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const categoryIds = Array.isArray(req.body?.categoryIds) ? req.body.categoryIds.map(String) : [];
    const status = await saveProblemAreas(userId, categoryIds);
    res.json(status);
  } catch (error: any) {
    const msg = error?.message || 'Could not save problem areas';
    if (String(msg).includes('Pick between') || /not found/i.test(String(msg))) {
      return res.status(400).json({ error: msg });
    }
    console.error('Save problem areas error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const postCoupleProblemAreas = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const categoryIds = Array.isArray(req.body?.categoryIds) ? req.body.categoryIds.map(String) : [];
    const status = await saveCoupleProblemAreas(userId, categoryIds);
    res.json(status);
  } catch (error: any) {
    const msg = error?.message || 'Could not save couple areas';
    if (String(msg).includes('Pick between') || /not found/i.test(String(msg))) {
      return res.status(400).json({ error: msg });
    }
    console.error('Save couple areas error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPendingGuideEvals = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const pending = await getPendingEvalsForGuide(userId);
    res.json({ pending });
  } catch (error) {
    console.error('Pending guide evals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const postClientEval = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const clientUserId = String(req.body?.clientUserId || '');
    const progressed = Boolean(req.body?.progressed);
    const grade = String(req.body?.grade || '').toUpperCase() as GuideProgramGrade;
    if (!clientUserId) return res.status(400).json({ error: 'clientUserId is required' });
    const status = await evaluateClient(userId, clientUserId, progressed, grade);
    res.json({ message: 'Evaluation saved. The client can continue using the app.', status });
  } catch (error: any) {
    const msg = error?.message || 'Could not save evaluation';
    if (
      /Only guides|not found|not your client|Grade must|not over yet/i.test(String(msg))
    ) {
      return res.status(400).json({ error: msg });
    }
    console.error('Evaluate client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
