import express from 'express';
import { signup, login, forgotPassword, resetPassword, verifyEmail, resendVerificationEmail, changePassword } from '../controllers/authController.js';
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
import {
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  passkeyLoginOptions,
  passkeyLoginVerify,
  passkeyStatus,
  passkeySupported,
} from '../controllers/passkeyController.js';
import { signupWithFace, identifyFaceForLogin } from '../controllers/faceAuthController.js';
import {
  usernameAvailability,
  signupWithPin,
  loginWithPin,
  forgotPinHints,
  forgotPinLastChatChallenge,
  forgotPinVerifyLastChat,
  forgotPinVerifyChatNames,
  forgotPinVerifyDescribe,
  forgotPinSubmitSelfie,
  reportStolenAccount,
  resetPin,
} from '../controllers/pinAuthController.js';

const router = express.Router();

/** Signup/login/reset need full DB access (no JWT yet). */
router.use((req, res, next) => runWithSystem(() => next()));

router.post('/signup', signupLimiter, signup);
router.post('/signup-face', signupLimiter, signupWithFace);
router.post('/signup-pin', signupLimiter, signupWithPin);
router.post('/login-pin', loginLimiter, loginWithPin);
router.get('/username-available', usernameAvailability);
router.post('/forgot-pin/hints', loginLimiter, forgotPinHints);
router.post('/forgot-pin/last-chat', loginLimiter, forgotPinLastChatChallenge);
router.post('/forgot-pin/verify-last-chat', loginLimiter, forgotPinVerifyLastChat);
router.post('/forgot-pin/verify-chat-names', loginLimiter, forgotPinVerifyChatNames);
router.post('/forgot-pin/describe', loginLimiter, forgotPinVerifyDescribe);
router.post('/forgot-pin/selfie', loginLimiter, forgotPinSubmitSelfie);
router.post('/report-stolen', loginLimiter, reportStolenAccount);
router.post('/reset-pin', loginLimiter, resetPin);
router.post('/face/identify', loginLimiter, identifyFaceForLogin);
router.post('/login', loginLimiter, login);
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

router.get('/passkey/supported', passkeySupported);
router.post('/passkey/login/options', loginLimiter, passkeyLoginOptions);
router.post('/passkey/login/verify', loginLimiter, passkeyLoginVerify);
router.get('/passkey/status', authenticateToken, passkeyStatus);
router.post('/passkey/register/options', authenticateToken, passkeyRegisterOptions);
router.post('/passkey/register/verify', authenticateToken, passkeyRegisterVerify);

export default router;
