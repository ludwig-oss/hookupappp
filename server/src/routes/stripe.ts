import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  confirmCheckoutSessionHandler,
  createCheckoutSessionHandler,
  stripeStatusHandler,
} from '../controllers/stripeCheckoutController.js';

const router = express.Router();

router.get('/status', stripeStatusHandler);
router.post('/create-checkout-session', authenticateToken, createCheckoutSessionHandler);
router.post('/confirm-session', authenticateToken, confirmCheckoutSessionHandler);

export default router;
