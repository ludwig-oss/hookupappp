import express from 'express';
import {
  getRegionUsers,
  sendInterestHandler,
  acceptInterestHandler,
  rejectInterestHandler,
  getMyInterests,
  savePreCommHandler,
  getPreCommForInterest,
  getNDAStatus,
  getNDAStatusByUser,
  signNDAHandler,
} from '../controllers/activityController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePhotoUnlocked } from '../middleware/requirePhotoUnlocked.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/region', getRegionUsers);
router.post('/interest', requirePhotoUnlocked, sendInterestHandler);
router.post('/interest/accept', requirePhotoUnlocked, acceptInterestHandler);
router.post('/interest/reject', requirePhotoUnlocked, rejectInterestHandler);
router.get('/interests', getMyInterests);
router.post('/pre-comm', savePreCommHandler);
router.get('/pre-comm/:interestId', getPreCommForInterest);
router.get('/nda/status/:interestId', getNDAStatus);
router.get('/nda/status-by-user/:otherUserId', getNDAStatusByUser);
router.post('/nda/sign', signNDAHandler);

export default router;
