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
import { createPaymentIntent, confirmPaymentWebhook } from '../controllers/paymentController.js';
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

// Payments (Stripe for other flows)
router.post('/payments/create-intent', createPaymentIntent);
router.post('/payments/webhook', express.raw({ type: 'application/json' }), confirmPaymentWebhook);

export default router;

