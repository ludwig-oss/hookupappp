import express from 'express';
import {
  getAllCities,
  searchByCity,
  showInterest,
  getMyInterests,
  getMatches,
  respondInterest,
  setPreference,
  getMyPreference,
  searchPlaces,
  getPlaceUsers,
} from '../controllers/discoverController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePhotoUnlocked } from '../middleware/requirePhotoUnlocked.js';

const router = express.Router();

// Public routes
router.get('/cities', getAllCities);
router.get('/city', searchByCity);
router.get('/places', searchPlaces);

// Authenticated routes (signup onboarding can set preferences before email/phone verification)
router.use(authenticateToken);
router.post('/preference', setPreference);
router.get('/preference', getMyPreference);

router.get('/matches', getMatches);
router.post('/interest', requirePhotoUnlocked, showInterest);
router.get('/interests', getMyInterests);
router.post('/interest/respond', requirePhotoUnlocked, respondInterest);
router.get('/places/:placeId/users', getPlaceUsers);

export default router;

