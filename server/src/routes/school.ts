import express from 'express';
import {
  getToday,
  getCurriculum,
  postSchedule,
  postDismiss,
  postComplete,
  postQuiz,
  postJumpTopic,
} from '../controllers/schoolController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/curriculum', authenticateToken, getCurriculum);
router.get('/today', authenticateToken, getToday);
router.post('/schedule', authenticateToken, postSchedule);
router.post('/dismiss', authenticateToken, postDismiss);
router.post('/complete', authenticateToken, postComplete);
router.post('/quiz', authenticateToken, postQuiz);
router.post('/jump-topic', authenticateToken, postJumpTopic);

export default router;
