import express from 'express';
import {
  getCategories,
  applyAsGuide,
  getMyApplication,
  getAllApplicationsAdmin,
  approveGuideApplication,
  rejectGuideApplication,
  getMyGuideProfile,
  getGuidesForCategory,
  getGuidesRecommendedForUser,
  searchGuidesByProblem,
  getLocalQualifiedCoaches,
  getAllGuidesList,
  setAvailability,
  getGuideAvailability,
  createBookingRequest,
  getMyBookings,
  getGuideBookings,
  confirmPayment,
  sendGuideRequest,
  getMyGuideRequests,
  getGuideRequestsForMe,
  acceptRequest,
  rejectRequest,
  setMyPaypalInfo,
  submitPaymentProofHandler,
  confirmPaymentReceivedHandler,
  rateCourseCompletion,
  getUserImprovement,
} from '../controllers/improvementController.js';
import { createPaymentIntent, confirmPaymentWebhook, createGuideRequestStripePayment, confirmGuideRequestStripePayment } from '../controllers/paymentController.js';
import { createPayPalOrder, capturePayPalOrder } from '../controllers/paypalController.js';
import {
  getPendingVotes,
  submitVote,
  getMyVoteStatus,
  getCoachVotePopup,
  submitPopupSwipe,
} from '../controllers/coachVoteController.js';
import {
  getMyWallet,
  updateWalletPaypal,
  updateWalletBank,
  createWithdrawal,
  getPaymentSplitInfo,
} from '../controllers/guideWalletController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Categories - public endpoint
router.get('/categories', getCategories);

// All other routes require authentication
router.use(authenticateToken);

// Guide Applications
router.post('/guides/apply', applyAsGuide);
router.get('/guides/my-application', getMyApplication);
router.get('/guides/applications', getAllApplicationsAdmin); // Admin only
router.post('/guides/approve', approveGuideApplication); // Admin only
router.post('/guides/reject', rejectGuideApplication); // Admin only

// Guides
router.get('/guides/my-profile', getMyGuideProfile);
router.get('/guides/category/:category', getGuidesForCategory);
router.get('/guides/recommended', getGuidesRecommendedForUser);
router.get('/guides/search', searchGuidesByProblem);
router.get('/guides/local', getLocalQualifiedCoaches);
router.get('/guides', getAllGuidesList);

// Availability
router.post('/guides/availability', setAvailability);
router.get('/guides/:guideId/availability', getGuideAvailability);

// Guide Requests
router.post('/guides/request', sendGuideRequest);
router.get('/guides/requests/my', getMyGuideRequests);
router.get('/guides/:guideId/requests', getGuideRequestsForMe);
router.post('/guides/requests/accept', acceptRequest);
router.post('/guides/requests/reject', rejectRequest);
router.post('/guides/requests/:requestId/submit-payment-proof', submitPaymentProofHandler);
router.post('/guides/requests/confirm-payment', confirmPaymentReceivedHandler);

// Trainer: set PayPal info (email or PayPal.me link) so users can send €50
router.put('/guides/my-paypal', setMyPaypalInfo);

// Bookings
router.post('/bookings', createBookingRequest);
router.get('/bookings/my', getMyBookings);
router.get('/bookings/guide/:guideId', getGuideBookings);
router.post('/bookings/confirm-payment', confirmPayment);

// Course Completion
router.post('/courses/rate', rateCourseCompletion);
router.get('/improvement', getUserImprovement);

// Coach peer vote (opposite gender "baddie or not" — 48h, 80%)
router.get('/coach-votes/pending', getPendingVotes);
router.get('/coach-votes/popup', getCoachVotePopup);
router.get('/coach-votes/my-status', getMyVoteStatus);
router.post('/coach-votes/:campaignId/vote', submitVote);
router.post('/coach-votes/:campaignId/swipe', submitPopupSwipe);

// Guide wallet & OnlyFans-style payouts
router.get('/wallet', getMyWallet);
router.put('/wallet/paypal', updateWalletPaypal);
router.put('/wallet/bank', updateWalletBank);
router.post('/wallet/withdraw', createWithdrawal);
router.get('/payments/split-info', getPaymentSplitInfo);

// PayPal checkout (prepay before session)
router.post('/payments/paypal/create-order', createPayPalOrder);
router.post('/payments/paypal/capture', capturePayPalOrder);

// Stripe checkout for guide request
router.post('/payments/stripe/guide-request', createGuideRequestStripePayment);
router.post('/payments/stripe/guide-request/confirm', confirmGuideRequestStripePayment);

// Payments (Stripe for bookings)
router.post('/payments/create-intent', createPaymentIntent);
router.post('/payments/webhook', express.raw({ type: 'application/json' }), confirmPaymentWebhook);

export default router;

