import { Request, Response } from 'express';
import {
  createReview,
  getReviewsForUser,
  addReply,
  getAggregateAttributes,
  getOverallStarRating,
  submitCourtEvidence,
  getReviewBetween,
  REVIEW_ATTRIBUTES,
} from '../models/reviews.js';
import { getUserById } from '../models/user.js';
import { checkContent } from '../utils/moderation.js';
import { sanitizeForStorage, LIMITS } from '../utils/sanitize.js';
import { REVIEW_DISCLAIMER_TEXT } from '../utils/seriousClaim.js';

export const submitReview = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { toUserId, attributes, overallStars, disclaimerAccepted, source } = req.body;
    const reviewText = sanitizeForStorage(req.body.reviewText, LIMITS.REVIEW);
    if (!toUserId || !reviewText) {
      return res.status(400).json({ error: 'toUserId and reviewText are required' });
    }
    if (!disclaimerAccepted) {
      return res.status(400).json({
        error: 'You must acknowledge the review policy before submitting.',
        disclaimer: REVIEW_DISCLAIMER_TEXT,
      });
    }
    const stars = Number(overallStars);
    if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({ error: 'overallStars must be between 1 and 5' });
    }
    if (toUserId === userId) {
      return res.status(400).json({ error: 'You cannot review yourself' });
    }
    const moderation = checkContent(reviewText);
    if (!moderation.allowed) {
      return res.status(400).json({ error: moderation.reason || 'Review not allowed.' });
    }
    const review = await createReview({
      fromUserId: userId,
      toUserId,
      attributes: attributes || {},
      overallStars: stars,
      reviewText,
      source: source === 'unmatch' ? 'unmatch' : 'manual',
      disclaimerAccepted: true,
    });
    res.json({
      review,
      disclaimer: REVIEW_DISCLAIMER_TEXT,
      seriousClaimNotice: review.isSeriousClaim
        ? 'This review contains a serious allegation. It is shown as unproven (innocent until proven guilty) until official court evidence is submitted. We encourage pursuing legal action through proper authorities.'
        : null,
    });
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
    const overall = await getOverallStarRating(userId);
    const withRaterNames = await Promise.all(
      reviews.map(async (r) => {
        const u = await getUserById(r.fromUserId);
        return { ...r, fromUserName: u?.name ?? 'Anonymous' };
      })
    );
    res.json({ reviews: withRaterNames, overall });
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
    const replyText = sanitizeForStorage(req.body.replyText, LIMITS.REPLY);
    if (!reviewId || !replyText) {
      return res.status(400).json({ error: 'reviewId and replyText required' });
    }
    const moderation = checkContent(replyText);
    if (!moderation.allowed) {
      return res.status(400).json({ error: moderation.reason || 'Reply not allowed.' });
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
    const overall = await getOverallStarRating(userId);
    res.json({ ...result, overall });
  } catch (e: any) {
    console.error('Get attributes error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getOverallRating = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ error: 'User ID required' });
    const overall = await getOverallStarRating(userId);
    res.json(overall);
  } catch (e: any) {
    console.error('Get overall rating error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const submitCourtEvidenceHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { reviewId } = req.params;
    const summary = sanitizeForStorage(req.body.summary, 2000);
    const documentNote = req.body.documentNote != null ? sanitizeForStorage(req.body.documentNote, 1000) : undefined;
    const confirmOfficial = !!req.body.confirmOfficial;
    if (!summary) {
      return res.status(400).json({ error: 'summary is required' });
    }
    const review = await submitCourtEvidence(reviewId, userId, {
      summary,
      documentNote,
      confirmOfficial,
    });
    if (!review) {
      return res.status(400).json({
        error: 'Could not attach evidence. Only the reviewer can submit official court proof for their serious claim.',
      });
    }
    res.json({
      review,
      message: 'Court evidence recorded. This review is now marked as proven and pinned below the comment.',
    });
  } catch (e: any) {
    console.error('Court evidence error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getReviewPolicy = (_req: Request, res: Response) => {
  res.json({ disclaimer: REVIEW_DISCLAIMER_TEXT });
};

export const getMyReviewForUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { otherUserId } = req.params;
    const review = await getReviewBetween(userId, otherUserId);
    res.json({ review });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAttributeKeys = (_req: Request, res: Response) => {
  res.json({ attributes: REVIEW_ATTRIBUTES });
};
