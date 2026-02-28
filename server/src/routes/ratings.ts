import express from 'express';
import {
  submitRating,
  getUserRatings,
  getAverageRatings,
  unmatchWithReason,
  getMyUnmatchReasons,
  viewUnmatchReason,
} from '../controllers/ratingsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/submit', submitRating);
router.get('/user/:userId', getUserRatings);
router.get('/user/:userId/averages', getAverageRatings);
router.post('/unmatch', unmatchWithReason);
router.get('/unmatch-reasons', getMyUnmatchReasons);
router.post('/unmatch-reasons/view', viewUnmatchReason);

export default router;
