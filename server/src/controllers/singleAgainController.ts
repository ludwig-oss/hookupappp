import { Request, Response } from 'express';
import {
  showInterest,
  setHealHold,
  clearHealHold,
  getByPostId,
  toPublic,
  getRouletteBannerForOwner,
} from '../models/singleAgain.js';

export const postInterest = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const postId = String(req.params.postId || '');
    const pub = await showInterest(postId, userId);
    res.json({ singleAgain: pub, message: 'Interest in. After 24 hours the app picks 7 lucky people for chat.' });
  } catch (error: any) {
    const msg = error?.message || 'Could not send interest';
    if (/not found|your announcement|already picked|24 hours/i.test(String(msg))) {
      return res.status(400).json({ error: msg });
    }
    console.error('Single-again interest error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const postHealHold = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const postId = String(req.params.postId || '');
    const healNote = String(req.body?.healNote || '');
    const rec = await setHealHold(userId, postId, healNote);
    res.json({
      singleAgain: toPublic(rec, userId),
      message: 'Lucky people are on hold until you tap I’m ready.',
    });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Could not save' });
  }
};

export const postHealReady = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const postId = String(req.params.postId || '');
    const rec = await clearHealHold(userId, postId);
    res.json({ singleAgain: toPublic(rec, userId), message: 'You are ready — they can chat now.' });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Could not save' });
  }
};

export const getSingleAgain = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    const postId = String(req.params.postId || '');
    const rec = await getByPostId(postId);
    if (!rec) return res.status(404).json({ error: 'Not found' });
    res.json({ singleAgain: toPublic(rec, userId || null) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyRoulette = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const rec = await getRouletteBannerForOwner(userId);
    if (!rec) return res.json({ roulette: null });
    res.json({
      roulette: {
        postId: rec.postId,
        luckyCount: rec.luckyUserIds.length,
        healHold: rec.healHold,
        healNote: rec.healNote,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
