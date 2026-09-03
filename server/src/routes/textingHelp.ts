import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  answerTextingHelp,
  captureTextingHelpPayPal,
  chooseTextingHelp,
  confirmTextingHelpDemoPay,
  confirmTextingHelpStripePayment,
  createTextingHelpPayPalOrder,
  createTextingHelpStripePayment,
  getTextingHelpSessionHandler,
  incomingTextingHelp,
  listTextingHelpGuides,
  reviewTextingHelp,
  startTextingHelp,
} from '../controllers/textingHelpController.js';

const router = express.Router();
router.use(authenticateToken);

router.post('/start', startTextingHelp);
router.get('/incoming', incomingTextingHelp);
router.get('/guides', listTextingHelpGuides);
router.get('/session/:sessionId', getTextingHelpSessionHandler);
router.post('/pay/paypal', createTextingHelpPayPalOrder);
router.post('/pay/paypal/capture', captureTextingHelpPayPal);
router.post('/pay/stripe', createTextingHelpStripePayment);
router.post('/pay/stripe/confirm', confirmTextingHelpStripePayment);
router.post('/pay/demo', confirmTextingHelpDemoPay);
router.post('/answer', answerTextingHelp);
router.post('/choose', chooseTextingHelp);
router.post('/review', reviewTextingHelp);

export default router;
