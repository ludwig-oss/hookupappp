import express from 'express';
import {
  getGamification,
  getBadges,
  getAchievements,
  getLeaderboard,
  awardPointsToUser,
  updateUserStats,
} from '../controllers/gamificationController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/badges', getBadges);
router.get('/achievements', getAchievements);

router.use(authenticateToken);

router.get('/', getGamification);
router.get('/leaderboard', getLeaderboard);
router.post('/award-points', awardPointsToUser);
router.put('/stats', updateUserStats);

export default router;



