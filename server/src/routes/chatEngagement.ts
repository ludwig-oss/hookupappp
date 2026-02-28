import express from 'express';
import {
  submitProofOfLove,
  getMyPendingProofs,
  verifyProofOfLove,
  requestProofPrompt,
  checkProofStatus,
  getConnectionPrompt,
  checkConnectionPrompt,
  markPromptResponded,
  createChallenge,
  getChallenges,
  updateChallengeState,
  getRandomChallengeType,
  checkChallengeStatus,
} from '../controllers/chatEngagementController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Proof of Love
router.post('/proof/submit', submitProofOfLove);
router.get('/proof/pending', getMyPendingProofs);
router.post('/proof/verify', verifyProofOfLove);
router.get('/proof/prompt', requestProofPrompt);
router.get('/proof/check', checkProofStatus);

// Connection Prompts
router.get('/prompt', getConnectionPrompt);
router.get('/prompt/check', checkConnectionPrompt);
router.post('/prompt/responded', markPromptResponded);

// Challenges/Games
router.post('/challenge/create', createChallenge);
router.get('/challenge/list', getChallenges);
router.post('/challenge/update', updateChallengeState);
router.get('/challenge/random', getRandomChallengeType);
router.get('/challenge/check', checkChallengeStatus);

export default router;
