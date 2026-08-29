import express from 'express';
import { signup, login, forgotPassword, resetPassword, verifyEmail, resendVerificationEmail, changePassword, sendLoginCode, loginWithCode } from '../controllers/authController.js';
import {
  oauthStatus,
  startGoogle,
  googleCallback,
  startFacebook,
  facebookCallback,
  startApple,
  appleCallback,
} from '../controllers/oauthController.js';
import { authenticateToken } from '../middleware/auth.js';
import { signupLimiter, loginLimiter } from '../middleware/rateLimit.js';
import { runWithSystem } from '../db/context.js';

const router = express.Router();

/** Signup/login/reset need full DB access (no JWT yet). */
router.use((req, res, next) => runWithSystem(() => next()));

router.post('/signup', signupLimiter, signup);
router.post('/login', loginLimiter, login);
router.post('/send-login-code', loginLimiter, sendLoginCode);
router.post('/login-with-code', loginLimiter, loginWithCode);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);
router.post('/change-password', authenticateToken, changePassword);

router.get('/oauth/status', oauthStatus);
router.get('/google', startGoogle);
router.get('/google/callback', googleCallback);
router.get('/facebook', startFacebook);
router.get('/facebook/callback', facebookCallback);
router.get('/apple', startApple);
router.get('/apple/callback', appleCallback);

export default router;
