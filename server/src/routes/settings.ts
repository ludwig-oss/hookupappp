import express from 'express';
import {
  getSettings,
  updateSettings,
  updateNotifications,
  updatePrivacy,
  updateFilters,
  updateAccessibility,
} from '../controllers/settingsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getSettings);
router.put('/', updateSettings);
router.put('/notifications', updateNotifications);
router.put('/privacy', updatePrivacy);
router.put('/filters', updateFilters);
router.put('/accessibility', updateAccessibility);

export default router;



