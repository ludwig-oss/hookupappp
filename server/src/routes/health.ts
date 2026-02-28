import express from 'express';
import {
  getMyHealth,
  updateMyHealth,
  addTest,
  deleteTest,
  requestToViewHealth,
  getHealthViewStatus,
  getMyHealthRequests,
  respondToHealthRequest,
} from '../controllers/healthController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/me', getMyHealth);
router.put('/me', updateMyHealth);
router.post('/me/tests', addTest);
router.delete('/me/tests/:testId', deleteTest);
router.get('/view-status/:otherUserId', getHealthViewStatus);
router.post('/view-request', requestToViewHealth);
router.get('/requests', getMyHealthRequests);
router.post('/requests/respond', respondToHealthRequest);

export default router;
