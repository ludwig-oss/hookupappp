import { Request, Response } from 'express';
import {
  createRating,
  getRatingsForUser,
  getUserAverageRatings,
  createUnmatchReason,
  getUnmatchReasonsForUser,
  markUnmatchReasonAsViewed,
} from '../models/ratings.js';
import { unmatchUser } from '../models/user.js';

export const submitRating = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { ratedUserId, overallRating, characteristics } = req.body;
    if (!ratedUserId || overallRating === undefined || !characteristics) {
      return res.status(400).json({ error: 'All rating fields are required' });
    }

    if (overallRating < 0 || overallRating > 100) {
      return res.status(400).json({ error: 'Overall rating must be between 0 and 100' });
    }

    const rating = await createRating({
      ratedUserId,
      raterUserId: userId,
      overallRating,
      characteristics,
    });

    res.json({ message: 'Rating submitted successfully', rating });
  } catch (error: any) {
    console.error('Submit rating error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getUserRatings = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const ratings = await getRatingsForUser(userId);
    const averages = await getUserAverageRatings(userId);

    res.json({ ratings, averages });
  } catch (error) {
    console.error('Get user ratings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAverageRatings = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const averages = await getUserAverageRatings(userId);
    res.json(averages);
  } catch (error) {
    console.error('Get average ratings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const unmatchWithReason = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { unmatchedUserId, reason } = req.body;
    if (!unmatchedUserId || !reason) {
      return res.status(400).json({ error: 'User ID and reason are required' });
    }

    // Unmatch the users
    await unmatchUser(userId, unmatchedUserId);

    // Create unmatch reason
    await createUnmatchReason({
      fromUserId: userId,
      toUserId: unmatchedUserId,
      reason,
    });

    res.json({ message: 'Unmatched successfully' });
  } catch (error: any) {
    console.error('Unmatch with reason error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getMyUnmatchReasons = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const reasons = await getUnmatchReasonsForUser(userId);
    res.json({ reasons });
  } catch (error) {
    console.error('Get unmatch reasons error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const viewUnmatchReason = async (req: Request, res: Response) => {
  try {
    const { reasonId } = req.body;
    if (!reasonId) {
      return res.status(400).json({ error: 'Reason ID is required' });
    }

    await markUnmatchReasonAsViewed(reasonId);
    res.json({ message: 'Reason marked as viewed' });
  } catch (error) {
    console.error('View unmatch reason error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
