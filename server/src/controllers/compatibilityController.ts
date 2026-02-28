import { Request, Response } from 'express';
import {
  getCompatibilityQuestions,
  saveCompatibilityResult,
  getCompatibilityResult,
  calculateCompatibility,
} from '../models/compatibility.js';

export const getQuestions = async (req: Request, res: Response) => {
  try {
    const questions = await getCompatibilityQuestions();
    res.json({ questions });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const submitQuiz = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers array is required' });
    }

    const result = await saveCompatibilityResult(userId, answers);
    res.json({ result });
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getResult = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const result = await getCompatibilityResult(userId);
    res.json({ result: result ?? null });
  } catch (error) {
    console.error('Get result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCompatibility = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { otherUserId } = req.params;

    if (!otherUserId) {
      return res.status(400).json({ error: 'Other user ID is required' });
    }

    const score = await calculateCompatibility(userId, otherUserId);
    res.json({ compatibility: score });
  } catch (error) {
    console.error('Get compatibility error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



