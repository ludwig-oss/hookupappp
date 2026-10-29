import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { closetMatchScoreHandler } from '../controllers/closetMatchController.js';
import { internetTrendClosetHandler, internetTrendsHandler } from '../controllers/internetTrendController.js';
import {
  clutchMatchHandler,
  deleteWardrobeHandler,
  tryOnHandler,
  listWardrobeHandler,
  monthlyCheckInHandler,
  saveWardrobeHandler,
  styleLooksHandler,
} from '../controllers/fashionController.js';

const router = express.Router();
router.use(authenticateToken);
router.post('/style', styleLooksHandler);
router.post('/clutch-match', clutchMatchHandler);
router.post('/match-score', closetMatchScoreHandler);
router.post('/internet-trends', internetTrendsHandler);
router.post('/internet-trends/closet', internetTrendClosetHandler);
router.post('/monthly-check-in', monthlyCheckInHandler);
router.post('/try-on', tryOnHandler);
router.get('/wardrobe', listWardrobeHandler);
router.post('/wardrobe', saveWardrobeHandler);
router.delete('/wardrobe/:id', deleteWardrobeHandler);

export default router;
