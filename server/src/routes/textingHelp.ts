import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  answerTextingHelp,
  chooseTextingHelp,
  confirmTextingHelpStripePayment,
  createTextingHelpCheckout,
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
router.post('/pay/checkout', createTextingHelpCheckout);
router.post('/pay/stripe', createTextingHelpStripePayment);
router.post('/pay/stripe/confirm', confirmTextingHelpStripePayment);
router.post('/answer', answerTextingHelp);
router.post('/choose', chooseTextingHelp);
router.post('/review', reviewTextingHelp);

export default router;
