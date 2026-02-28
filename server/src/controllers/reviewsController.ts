import { Request, Response } from 'express';
import {
  createReview,
  getReviewsForUser,
  addReply,
  getAggregateAttributes,
  normalizeAttributes,
  REVIEW_ATTRIBUTES,
} from '../models/reviews.js';
import { getUserById } from '../models/user.js';

export const submitReview = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { toUserId, attributes, reviewText } = req.body;
    if (!toUserId || !reviewText || typeof reviewText !== 'string') {
      return res.status(400).json({ error: 'toUserId and reviewText are required' });
    }
    const review = await createReview({
      fromUserId: userId,
      toUserId,
      attributes: attributes || {},
      reviewText,
    });
    res.json({ review });
  } catch (e: any) {
    console.error('Submit review error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

export const getReviews = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ error: 'User ID required' });
    const reviews = await getReviewsForUser(userId);
    const withRaterNames = await Promise.all(
      reviews.map(async (r) => {
        const u = await getUserById(r.fromUserId);
        return { ...r, fromUserName: u?.name ?? 'Anonymous' };
      })
    );
    res.json({ reviews: withRaterNames });
  } catch (e: any) {
    console.error('Get reviews error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const replyToReview = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { reviewId } = req.params;
    const { replyText } = req.body;
    if (!reviewId || !replyText || typeof replyText !== 'string') {
      return res.status(400).json({ error: 'reviewId and replyText required' });
    }
    const review = await addReply(reviewId, userId, replyText);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json({ review });
  } catch (e: any) {
    console.error('Reply to review error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAttributes = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ error: 'User ID required' });
    const result = await getAggregateAttributes(userId);
    res.json(result);
  } catch (e: any) {
    console.error('Get attributes error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAttributeKeys = (_req: Request, res: Response) => {
  res.json({ attributes: REVIEW_ATTRIBUTES });
};
