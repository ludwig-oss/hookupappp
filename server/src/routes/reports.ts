import express from 'express';
import {
  createUserReport,
  getMyReports,
  getAllUserReports,
  updateReport,
  lookupUserForReport,
} from '../controllers/reportController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/lookup', lookupUserForReport);
router.post('/', createUserReport);
router.get('/', getMyReports);
router.get('/all', getAllUserReports);
router.put('/:reportId', updateReport);

export default router;



