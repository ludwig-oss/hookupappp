import express from 'express';
import {
  listEvents,
  createEventHandler,
  getEventByIdHandler,
  requestToJoin,
  getEventRequestsHandler,
  respondToRequest,
  replyToRequest,
  cancelJoinRequest,
  getEventMessagesHandler,
  postEventMessage,
  updateMeetupDetails,
  myEvents,
} from '../controllers/eventsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, listEvents);
router.get('/my', authenticateToken, myEvents);
router.get('/:eventId', authenticateToken, getEventByIdHandler);
router.post('/', authenticateToken, createEventHandler);
router.post('/request', authenticateToken, requestToJoin);
router.post('/request/respond', authenticateToken, respondToRequest);
router.post('/request/reply', authenticateToken, replyToRequest);
router.post('/request/cancel', authenticateToken, cancelJoinRequest);
router.get('/:eventId/requests', authenticateToken, getEventRequestsHandler);
router.get('/:eventId/messages', authenticateToken, getEventMessagesHandler);
router.post('/:eventId/messages', authenticateToken, postEventMessage);
router.put('/:eventId/meetup-details', authenticateToken, updateMeetupDetails);

export default router;
