import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getCatalog,
  postStartSearch,
  postCancelSearch,
  getPoll,
  getMine,
  postAvailability,
  postRespond,
  postSpin,
  postCancelDate,
  postHowGoing,
  getPitches,
  postDirectPitch,
  postPitchText,
  postPitchRespond,
  getDirectCandidates,
  getLawyerGuides,
  postSummonLawyer,
  getLawyerCandidates,
  postLawyerPick,
  getLawyerSessions,
  postLawyerMessage,
  postLawyerRespond,
} from '../controllers/dateMatchController.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/catalog', getCatalog);
router.get('/poll', getPoll);
router.get('/mine', getMine);
router.post('/search', postStartSearch);
router.post('/search/cancel', postCancelSearch);
router.post('/availability', postAvailability);
router.post('/respond', postRespond);
router.post('/spin', postSpin);
router.post('/cancel', postCancelDate);
router.post('/how-going', postHowGoing);

router.get('/pitches', getPitches);
router.get('/pitch/candidates', getDirectCandidates);
router.post('/pitch/direct', postDirectPitch);
router.post('/pitch/text', postPitchText);
router.post('/pitch/respond', postPitchRespond);

router.get('/lawyer/guides', getLawyerGuides);
router.get('/lawyer/sessions', getLawyerSessions);
router.get('/lawyer/candidates', getLawyerCandidates);
router.post('/lawyer/summon', postSummonLawyer);
router.post('/lawyer/pick', postLawyerPick);
router.post('/lawyer/message', postLawyerMessage);
router.post('/lawyer/respond', postLawyerRespond);

export default router;
