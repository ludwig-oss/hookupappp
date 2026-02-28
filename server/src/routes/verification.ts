import express from 'express';
import {
  getVerificationStatus,
  sendEmailVerification,
  verifyEmail,
  sendPhoneVerification,
  verifyPhone,
  connectSocial,
  disconnectSocial,
  uploadId,
} from '../controllers/verificationController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getVerificationStatus);
router.post('/email/send', sendEmailVerification);
router.post('/email/verify', verifyEmail);
router.post('/phone/send', sendPhoneVerification);
router.post('/phone/verify', verifyPhone);
router.post('/social/connect', connectSocial);
router.post('/social/disconnect', disconnectSocial);
router.post('/id/upload', uploadId);

export default router;



