import { Request, Response } from 'express';
import {
  getUserGamification,
  getAllBadges,
  getAllAchievements,
  awardPoints,
  updateAchievementProgress,
  updateStats,
} from '../models/gamification.js';

export const getGamification = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const gamification = await getUserGamification(userId);
    res.json({ gamification });
  } catch (error) {
    console.error('Get gamification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getBadges = async (req: Request, res: Response) => {
  try {
    const badges = await getAllBadges();
    res.json({ badges });
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAchievements = async (req: Request, res: Response) => {
  try {
    const achievements = await getAllAchievements();
    res.json({ achievements });
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    // This would require reading all gamification data
    // For now, return empty array - can be implemented later
    res.json({ leaderboard: [] });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const awardPointsToUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { points, reason } = req.body;
    const gamification = await awardPoints(userId, points || 0, reason);
    res.json({ gamification });
  } catch (error) {
    console.error('Award points error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateUserStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const stats = req.body;
    const gamification = await updateStats(userId, stats);
    res.json({ gamification });
  } catch (error) {
    console.error('Update stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



