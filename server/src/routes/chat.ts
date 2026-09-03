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
  getChatIntentsHandler,
  setChatIntentHandler,
} from '../controllers/chatController.js';
import { getDisinterestReport } from '../controllers/disinterestController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePhotoUnlocked } from '../middleware/requirePhotoUnlocked.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/send', requirePhotoUnlocked, sendMessage);
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
router.get('/intents', getChatIntentsHandler);
router.put('/intents/:otherUserId', setChatIntentHandler);
router.get('/disinterest/:otherUserId', getDisinterestReport);

export default router;




