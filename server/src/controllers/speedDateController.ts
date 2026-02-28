import { Request, Response } from 'express';
import {
  createSpeedDate,
  getActiveSpeedDateForUser,
  getSpeedDateById,
  setContinueAnswer,
  UPLIFTING_MESSAGES,
} from '../models/speedDate.js';
import { getUserById } from '../models/user.js';

export const startSpeedDate = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { partnerUserId, day1Type, day2Type, day1Time, day2Time } = req.body;
    if (!partnerUserId) return res.status(400).json({ error: 'partnerUserId required' });
    const existing = await getActiveSpeedDateForUser(userId);
    if (existing) {
      return res.status(400).json({ error: 'You already have an active speed date' });
    }
    const schedule = {
      day1Type: day1Type || 'chat',
      day2Type: day2Type || 'video',
      day1Time: day1Time || null,
      day2Time: day2Time || null,
    };
    const sd = await createSpeedDate(userId, partnerUserId, schedule);
    res.json({ speedDate: sd });
  } catch (e: any) {
    console.error('Start speed date error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

export const getMySpeedDate = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const sd = await getActiveSpeedDateForUser(userId);
    if (!sd) return res.json({ speedDate: null });
    const partnerId = sd.user1Id === userId ? sd.user2Id : sd.user1Id;
    const partner = await getUserById(partnerId);
    res.json({
      speedDate: sd,
      partner: partner ? { id: partner.id, name: partner.name, profilePicture: partner.profilePicture } : null,
    });
  } catch (e: any) {
    console.error('Get speed date error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const answerContinue = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { speedDateId } = req.params;
    const { continueTalking } = req.body;
    if (typeof continueTalking !== 'boolean') {
      return res.status(400).json({ error: 'continueTalking (boolean) required' });
    }
    const result = await setContinueAnswer(speedDateId, userId, continueTalking);
    let upliftingMessage: string | null = null;
    if (result.speedDate.status === 'ended_no' && result.otherAnswered && !result.otherWantsContinue) {
      upliftingMessage = UPLIFTING_MESSAGES[Math.floor(Math.random() * UPLIFTING_MESSAGES.length)];
    }
    res.json({
      speedDate: result.speedDate,
      otherAnswered: result.otherAnswered,
      otherWantsContinue: result.otherWantsContinue,
      upliftingMessage,
    });
  } catch (e: any) {
    console.error('Answer continue error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

export const getUpliftingMessage = (_req: Request, res: Response) => {
  const msg = UPLIFTING_MESSAGES[Math.floor(Math.random() * UPLIFTING_MESSAGES.length)];
  res.json({ message: msg });
};
