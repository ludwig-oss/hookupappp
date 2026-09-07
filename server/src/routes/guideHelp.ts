import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  captureGuideHelpPayPal,
  confirmGuideHelpDemo,
  confirmGuideHelpStripe,
  consumeGuideHelpHandler,
  createGuideHelpPayPalOrder,
  createGuideHelpStripeCheckout,
  guideHelpStatusHandler,
} from '../controllers/guideHelpController.js';

const router = express.Router();
router.use(authenticateToken);
router.get('/status', guideHelpStatusHandler);
router.post('/consume', consumeGuideHelpHandler);
router.post('/pay/paypal', createGuideHelpPayPalOrder);
router.post('/pay/paypal/capture', captureGuideHelpPayPal);
router.post('/pay/stripe', createGuideHelpStripeCheckout);
router.post('/pay/stripe/confirm', confirmGuideHelpStripe);
router.post('/pay/demo', confirmGuideHelpDemo);

export default router;
