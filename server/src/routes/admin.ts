import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  listPendingSafetyReviews,
  getSafetyReviewDetail,
  decideSafetyReview,
  checkAdminAccess,
} from '../controllers/adminSafetyController.js';
import {
  listCoachApplications,
  approveCoachApplicationAdmin,
  rejectCoachApplicationAdmin,
} from '../controllers/adminCoachController.js';
import { listWithdrawalsAdmin, completeWithdrawalAdmin } from '../controllers/guideWalletController.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/access', checkAdminAccess);
router.get('/safety-reviews', listPendingSafetyReviews);
router.get('/safety-reviews/:planId', getSafetyReviewDetail);
router.post('/safety-reviews/:planId/decide', decideSafetyReview);

router.get('/coach-applications', listCoachApplications);
router.post('/coach-applications/approve', approveCoachApplicationAdmin);
router.post('/coach-applications/reject', rejectCoachApplicationAdmin);

router.get('/guide-withdrawals', listWithdrawalsAdmin);
router.post('/guide-withdrawals/complete', completeWithdrawalAdmin);

export default router;
