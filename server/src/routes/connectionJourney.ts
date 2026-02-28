import express from 'express';
import {
  getJourneyHandler,
  startJourneyHandler,
  completeStepHandler,
} from '../controllers/connectionJourneyController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/:partnerUserId', authenticateToken, getJourneyHandler);
router.post('/start', authenticateToken, startJourneyHandler);
router.post('/complete', authenticateToken, completeStepHandler);

export default router;
