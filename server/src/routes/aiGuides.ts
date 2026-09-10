import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  listAiGuidesHandler,
  interpretAiQueryHandler,
  getAiLessonHandler,
  assignAiGuideHandler,
  meAiGuideHandler,
  coachTextingHandler,
} from '../controllers/aiGuideController.js';

const router = express.Router();

router.use(authenticateToken);
router.get('/', listAiGuidesHandler);
router.get('/me', meAiGuideHandler);
router.post('/interpret', interpretAiQueryHandler);
router.get('/lesson/:topicId', getAiLessonHandler);
router.post('/assign', assignAiGuideHandler);
router.post('/coach-texting', coachTextingHandler);

export default router;
