import express from 'express';
import {
  getQuestions,
  submitQuiz,
  getResult,
  getCompatibility,
} from '../controllers/compatibilityController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/questions', getQuestions);

router.use(authenticateToken);

router.post('/submit', submitQuiz);
router.get('/result', getResult);
router.get('/:otherUserId', getCompatibility);

export default router;



