import express from 'express';
import {
  getPlans,
  getStatus,
  subscribe,
  cancel,
  getHistory,
} from '../controllers/premiumController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/plans', getPlans);

router.use(authenticateToken);

router.get('/status', getStatus);
router.post('/subscribe', subscribe);
router.post('/cancel', cancel);
router.get('/history', getHistory);

export default router;



