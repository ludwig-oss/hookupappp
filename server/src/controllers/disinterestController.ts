import { Request, Response } from 'express';
import { getConversation } from '../models/chat.js';
import {
  analyzeDisinterest,
  hasRecentDisinterestWarning,
} from '../models/disinterest.js';

export async function getDisinterestReport(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { otherUserId } = req.params;
    if (!userId || !otherUserId) return res.status(400).json({ error: 'User IDs are required' });
    const messages = await getConversation(userId, otherUserId);
    const report = analyzeDisinterest(userId, otherUserId, messages);
    report.warningSent = await hasRecentDisinterestWarning(userId, otherUserId);
    res.json({ report });
  } catch (error) {
    console.error('Disinterest report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
