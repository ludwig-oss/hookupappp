import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  listPendingSafetyReviews,
  getSafetyReviewDetail,
  decideSafetyReview,
  checkAdminAccess,
} from '../controllers/adminSafetyController.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/access', checkAdminAccess);
router.get('/safety-reviews', listPendingSafetyReviews);
router.get('/safety-reviews/:planId', getSafetyReviewDetail);
router.post('/safety-reviews/:planId/decide', decideSafetyReview);

export default router;
