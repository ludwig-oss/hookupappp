import express from 'express';
import {
  startSpeedDate,
  getMySpeedDate,
  answerContinue,
  getUpliftingMessage,
} from '../controllers/speedDateController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.post('/start', startSpeedDate);
router.get('/active', getMySpeedDate);
router.post('/:speedDateId/continue', answerContinue);
router.get('/uplifting', getUpliftingMessage);

export default router;
