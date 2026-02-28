import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { updateLocation, getNearbyUsers, sendBuzz, getBuzzInbox, respondBuzz } from '../controllers/nearbyController.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/location', updateLocation);
router.get('/users', getNearbyUsers);

router.post('/buzz', sendBuzz);
router.get('/buzz', getBuzzInbox);
router.post('/buzz/respond', respondBuzz);

export default router;







