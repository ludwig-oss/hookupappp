import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  deleteWardrobeHandler,
  tryOnHandler,
  listWardrobeHandler,
  saveWardrobeHandler,
  styleLooksHandler,
} from '../controllers/fashionController.js';

const router = express.Router();
router.use(authenticateToken);
router.post('/style', styleLooksHandler);
router.post('/try-on', tryOnHandler);
router.get('/wardrobe', listWardrobeHandler);
router.post('/wardrobe', saveWardrobeHandler);
router.delete('/wardrobe/:id', deleteWardrobeHandler);

export default router;
