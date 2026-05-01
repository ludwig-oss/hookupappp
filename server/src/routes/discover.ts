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
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';

const router = express.Router();

// Public routes
router.get('/cities', getAllCities);
router.get('/city', searchByCity);
router.get('/places', searchPlaces);

// Authenticated routes (signup onboarding can set preferences before email/phone verification)
router.use(authenticateToken);
router.post('/preference', setPreference);
router.get('/preference', getMyPreference);

// Email verification required for matching, interests, and place-based discovery
router.use(requireEmailVerified);

router.get('/matches', getMatches);
router.post('/interest', showInterest);
router.get('/interests', getMyInterests);
router.post('/interest/respond', respondInterest);
router.get('/places/:placeId/users', getPlaceUsers);

export default router;

