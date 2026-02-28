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

// Protected routes (email verification required for matching / interests)
router.use(authenticateToken);
router.use(requireEmailVerified);

router.get('/matches', getMatches);
router.post('/interest', showInterest);
router.get('/interests', getMyInterests);
router.post('/interest/respond', respondInterest);
router.post('/preference', setPreference);
router.get('/preference', getMyPreference);
router.get('/places/:placeId/users', getPlaceUsers);

export default router;

