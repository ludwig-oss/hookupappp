import express from 'express';
import {
  uploadProfilePicture,
  submitPhotoVerification,
  getPhotoLock,
  getUserProfile,
  addUserHighlight,
  deleteUserHighlight,
  addUserStory,
  deleteUserStory,
  reorderUserHighlights,
  addHighlightFromStory,
  addDisappearingPhotoUser,
  viewDisappearingPhotoUser,
  completeProfileSetup,
  updateUserProfileInfo,
} from '../controllers/profileController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePhotoUnlocked } from '../middleware/requirePhotoUnlocked.js';

const router = express.Router();

router.use(authenticateToken);

// Get current user's profile (no userId needed)
router.get('/me', getUserProfile);
router.get('/photo-lock', getPhotoLock);
router.get('/:userId', getUserProfile);
// Update current user (use /me so auth user is always targeted)
router.put('/me', updateUserProfileInfo);
router.put('/highlights/reorder', requirePhotoUnlocked, reorderUserHighlights);
router.put('/:userId', updateUserProfileInfo);
router.post('/picture', uploadProfilePicture);
router.post('/verify-photo', submitPhotoVerification);
router.post('/stories', requirePhotoUnlocked, addUserStory);
router.delete('/stories/:storyId', requirePhotoUnlocked, deleteUserStory);
router.post('/highlights/from-story', requirePhotoUnlocked, addHighlightFromStory);
router.post('/highlights', requirePhotoUnlocked, addUserHighlight);
router.delete('/highlights/:highlightId', requirePhotoUnlocked, deleteUserHighlight);
router.post('/disappearing-photos', requirePhotoUnlocked, addDisappearingPhotoUser);
router.post('/disappearing-photos/view', viewDisappearingPhotoUser);
router.post('/setup', completeProfileSetup);

export default router;

