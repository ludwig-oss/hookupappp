import express from 'express';
import {
  getSuggestions,
  updateWalkLocation,
  postInterest,
  postRespondInterest,
  getIncoming,
  postLifeQuiz,
  postProfileClick,
  postProfileImpression,
  patchWalkSettings,
} from '../controllers/walkMatchController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/suggestions', getSuggestions);
router.post('/location', updateWalkLocation);
router.post('/interest', postInterest);
router.post('/interest/respond', postRespondInterest);
router.get('/incoming', getIncoming);
router.post('/life-quiz', postLifeQuiz);
router.post('/profile-click', postProfileClick);
router.post('/profile-impression', postProfileImpression);
router.patch('/settings', patchWalkSettings);

export default router;
