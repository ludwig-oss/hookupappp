import express from 'express';
import {
  sendBuzz,
  getMyBuzzes,
  respondBuzz,
  updateLocation,
  getNearby,
  getVenues,
  getComfortingMsg,
  reverseGeocode,
  searchPlaces,
  getConnectionPrefs,
  patchConnectionVisibility,
  getMyLocation,
  forwardGeocode,
} from '../controllers/connectionsController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePhotoUnlocked } from '../middleware/requirePhotoUnlocked.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/buzz', requirePhotoUnlocked, sendBuzz);
router.get('/buzzes', getMyBuzzes);
router.post('/buzz/respond', requirePhotoUnlocked, respondBuzz);
router.post('/location', updateLocation);
router.get('/location', getMyLocation);
router.get('/geocode', forwardGeocode);
router.get('/prefs', getConnectionPrefs);
router.patch('/visibility', patchConnectionVisibility);
router.get('/nearby', getNearby);
router.get('/venues', getVenues);
router.get('/comforting-message', getComfortingMsg);
router.get('/reverse-geocode', reverseGeocode);
router.get('/search-places', searchPlaces);

export default router;
