import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  confirmGuideHelpStripe,
  consumeGuideHelpHandler,
  createGuideHelpStripeCheckout,
  guideHelpStatusHandler,
} from '../controllers/guideHelpController.js';

const router = express.Router();
router.use(authenticateToken);
router.get('/status', guideHelpStatusHandler);
router.post('/consume', consumeGuideHelpHandler);
router.post('/pay/stripe', createGuideHelpStripeCheckout);
router.post('/pay/stripe/confirm', confirmGuideHelpStripe);

export default router;
