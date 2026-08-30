import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { translateHandler } from '../controllers/translateController.js';

const router = express.Router();

router.post('/', authenticateToken, translateHandler);

export default router;
