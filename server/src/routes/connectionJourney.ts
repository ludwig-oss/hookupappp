import express from 'express';
import {
  getJourneyHandler,
  startJourneyHandler,
  completeStepHandler,
  saidHiHandler,
  hostChoiceHandler,
  muteHostHandler,
} from '../controllers/connectionJourneyController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/start', authenticateToken, startJourneyHandler);
router.post('/complete', authenticateToken, completeStepHandler);
router.post('/said-hi', authenticateToken, saidHiHandler);
router.post('/host-choice', authenticateToken, hostChoiceHandler);
router.post('/mute', authenticateToken, muteHostHandler);
router.get('/:partnerUserId', authenticateToken, getJourneyHandler);

export default router;
