import express from 'express';
import { signup, login, forgotPassword, resetPassword, verifyEmail, resendVerificationEmail, changePassword } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import { signupLimiter, loginLimiter } from '../middleware/rateLimit.js';
import { runWithSystem } from '../db/context.js';

const router = express.Router();

/** Signup/login/reset need full DB access (no JWT yet). */
router.use((req, res, next) => runWithSystem(() => next()));

router.post('/signup', signupLimiter, signup);
router.post('/login', loginLimiter, login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);
router.post('/change-password', authenticateToken, changePassword);

export default router;








