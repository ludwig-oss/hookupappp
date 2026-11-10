import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getProfessions,
  getState,
  postAccept,
  postAvailability,
  postBlue,
  postCycle,
  postExpense,
  postGoal,
  postHouse,
  postInterest,
  postJoin,
  postMediate,
  postReject,
  postSign,
  postTerminate,
  putProfile,
} from '../controllers/scoutController.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/professions', getProfessions);
router.get('/state', getState);
router.put('/profile', putProfile);
router.post('/cycle', postCycle);
router.post('/interest', postInterest);
router.post('/interest/:id/accept', postAccept);
router.post('/interest/:id/reject', postReject);
router.post('/partnerships/:id/sign', postSign);
router.post('/partnerships/:id/speed-date/join', postJoin);
router.post('/partnerships/:id/speed-date/confirm', postBlue);
router.post('/partnerships/:id/availability', postAvailability);
router.post('/partnerships/:id/expenses', postExpense);
router.post('/partnerships/:id/house', postHouse);
router.post('/partnerships/:id/goals', postGoal);
router.post('/partnerships/:id/mediate', postMediate);
router.post('/partnerships/:id/terminate', postTerminate);

export default router;
