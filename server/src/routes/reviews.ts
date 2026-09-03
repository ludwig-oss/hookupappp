import express from 'express';
import {
  submitReview,
  getReviews,
  replyToReview,
  getAttributes,
  getAttributeKeys,
  getOverallRating,
  submitCourtEvidenceHandler,
  getReviewPolicy,
  getMyReviewForUser,
} from '../controllers/reviewsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/policy', getReviewPolicy);
router.post('/submit', submitReview);
router.get('/user/:userId', getReviews);
router.get('/user/:userId/overall', getOverallRating);
router.get('/user/:userId/attributes', getAttributes);
router.get('/between/:otherUserId', getMyReviewForUser);
router.post('/:reviewId/reply', replyToReview);
router.post('/:reviewId/court-evidence', submitCourtEvidenceHandler);
router.get('/attributes/keys', getAttributeKeys);
router.delete('/:reviewId', (_req, res) => {
  res.status(403).json({ error: 'Reviews cannot be deleted. The profile owner may reply once.' });
});
router.delete('/:reviewId/reply', (_req, res) => {
  res.status(403).json({ error: 'Replies cannot be edited or deleted.' });
});

export default router;
