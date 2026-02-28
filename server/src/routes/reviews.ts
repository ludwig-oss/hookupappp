import express from 'express';
import {
  submitReview,
  getReviews,
  replyToReview,
  getAttributes,
  getAttributeKeys,
} from '../controllers/reviewsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/submit', submitReview);
router.get('/user/:userId', getReviews);
router.post('/:reviewId/reply', replyToReview);
router.get('/user/:userId/attributes', getAttributes);
router.get('/attributes/keys', getAttributeKeys);

export default router;
