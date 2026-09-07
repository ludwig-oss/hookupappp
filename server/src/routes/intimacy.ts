import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  intimacyRoutineHandler,
  intimacyStepHandler,
  termActListHandler,
  termActStepHandler,
} from '../controllers/intimacyController.js';

const router = express.Router();
router.use(authenticateToken);
router.get('/routine', intimacyRoutineHandler);
router.get('/step/:id', intimacyStepHandler);
router.get('/termact', termActListHandler);
router.get('/termact/:id', termActStepHandler);

export default router;
