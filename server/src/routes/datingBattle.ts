import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getState,
  postCheckout,
  postCoach,
  postConfirm,
  postConfirmPayment,
  postEject,
  postPrompt,
  postResolve,
  postSpotlight,
  postStart,
  putProfile,
} from '../controllers/datingBattleController.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/state', getState);
router.put('/profile', putProfile);
router.post('/start', postStart);
router.post('/spotlight', postSpotlight);
router.post('/coach/complete', postCoach);
router.post('/checkout', postCheckout);
router.post('/confirm-payment', postConfirmPayment);
router.post('/:battleId/confirm', postConfirm);
router.post('/:battleId/eject', postEject);
router.post('/:battleId/prompt', postPrompt);
router.post('/:battleId/resolve', postResolve);

export default router;
