import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';
import {
  getConfessionInfoHandler,
  getGuideConfessionPrefsHandler,
  updateGuideConfessionPrefsHandler,
  createSessionHandler,
  listSessionsHandler,
  getSessionHandler,
  createPayPalOrderHandler,
  capturePayPalOrderHandler,
  guideAcceptHandler,
  postMessageHandler,
  endSessionHandler,
} from '../controllers/anonymousConfessionController.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireEmailVerified);

router.get('/info', getConfessionInfoHandler);
router.get('/guide/prefs', getGuideConfessionPrefsHandler);
router.put('/guide/prefs', updateGuideConfessionPrefsHandler);
router.get('/sessions', listSessionsHandler);
router.post('/sessions', createSessionHandler);
router.get('/sessions/:sessionId', getSessionHandler);
router.post('/sessions/:sessionId/paypal/create-order', createPayPalOrderHandler);
router.post('/sessions/:sessionId/paypal/capture', capturePayPalOrderHandler);
router.post('/sessions/:sessionId/accept', guideAcceptHandler);
router.post('/sessions/:sessionId/messages', postMessageHandler);
router.post('/sessions/:sessionId/end', endSessionHandler);

export default router;
