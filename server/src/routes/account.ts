import express from 'express';
import { deleteAccount, pauseAccount } from '../controllers/accountController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.post('/pause', pauseAccount);
router.delete('/', deleteAccount);

export default router;
