import express from 'express';
import {
  uploadProfilePicture,
  submitPhotoVerification,
  getUserProfile,
  addUserHighlight,
  deleteUserHighlight,
  addDisappearingPhotoUser,
  viewDisappearingPhotoUser,
  completeProfileSetup,
  updateUserProfileInfo,
} from '../controllers/profileController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get current user's profile (no userId needed)
router.get('/me', getUserProfile);
router.get('/:userId', getUserProfile);
// Update current user (use /me so auth user is always targeted)
router.put('/me', updateUserProfileInfo);
router.put('/:userId', updateUserProfileInfo);
router.post('/picture', uploadProfilePicture);
router.post('/verify-photo', submitPhotoVerification);
router.post('/highlights', addUserHighlight);
router.delete('/highlights/:highlightId', deleteUserHighlight);
router.post('/disappearing-photos', addDisappearingPhotoUser);
router.post('/disappearing-photos/view', viewDisappearingPhotoUser);
router.post('/setup', completeProfileSetup);

export default router;

