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
} from '../controllers/connectionsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/buzz', sendBuzz);
router.get('/buzzes', getMyBuzzes);
router.post('/buzz/respond', respondBuzz);
router.post('/location', updateLocation);
router.get('/prefs', getConnectionPrefs);
router.patch('/visibility', patchConnectionVisibility);
router.get('/nearby', getNearby);
router.get('/venues', getVenues);
router.get('/comforting-message', getComfortingMsg);
router.get('/reverse-geocode', reverseGeocode);
router.get('/search-places', searchPlaces);

export default router;
