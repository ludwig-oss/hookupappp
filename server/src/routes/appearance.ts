import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  approveAppearanceHandler,
  deleteAppearanceLookHandler,
  designHairHandler,
  iterateAppearanceHandler,
  listAppearanceLooksHandler,
  listHairCatalogHandler,
  scanAppearanceHandler,
  styleAppearanceHandler,
} from '../controllers/appearanceController.js';

const router = express.Router();
router.use(authenticateToken);
router.post('/scan', scanAppearanceHandler);
router.post('/style', styleAppearanceHandler);
router.post('/iterate', iterateAppearanceHandler);
router.post('/approve', approveAppearanceHandler);
router.get('/looks', listAppearanceLooksHandler);
router.delete('/looks/:id', deleteAppearanceLookHandler);
router.get('/hair', listHairCatalogHandler);
router.post('/hair/design', designHairHandler);

export default router;
