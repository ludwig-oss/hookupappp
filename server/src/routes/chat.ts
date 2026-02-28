import express from 'express';
import {
  sendMessage,
  getConversationMessages,
  getConversationsList,
  getAvailableUsers,
  searchUsersByUsername,
  markAsRead,
  blockChatUser,
  muteChatUser,
  unmatchChatUser,
  getFocus,
  startFocus,
  endFocus,
} from '../controllers/chatController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireEmailVerified);

router.post('/send', sendMessage);
router.get('/conversations', getConversationsList);
router.get('/conversation/:otherUserId', getConversationMessages);
router.get('/users', getAvailableUsers);
router.get('/users/search', searchUsersByUsername);
router.post('/read', markAsRead);
router.post('/block', blockChatUser);
router.post('/mute', muteChatUser);
router.post('/unmatch', unmatchChatUser);
router.get('/focus', getFocus);
router.post('/focus', startFocus);
router.delete('/focus', endFocus);

export default router;




