import express from 'express';
import {
  getMyRelationship,
  confirmDatingHandler,
  confirmEndHandler,
  getDetectionPrompt,
  getTip,
  getTopic,
  getDateIdeaHandler,
  getCheckInPrompt,
  submitCheckIn,
  getSolutions,
  getRelationshipStatus,
} from '../controllers/relationshipController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getMyRelationship);
router.post('/confirm-dating', authenticateToken, confirmDatingHandler);
router.post('/confirm-end', authenticateToken, confirmEndHandler);
router.get('/detect-prompt/:partnerUserId', authenticateToken, getDetectionPrompt);
router.get('/tip', authenticateToken, getTip);
router.get('/topic', authenticateToken, getTopic);
router.get('/date-idea', authenticateToken, getDateIdeaHandler);
router.get('/check-in-prompt', authenticateToken, getCheckInPrompt);
router.post('/check-in', authenticateToken, submitCheckIn);
router.get('/solutions', authenticateToken, getSolutions);
router.get('/status/:userId', authenticateToken, getRelationshipStatus);

export default router;
