import express from 'express';
import {
  listEvents,
  createEventHandler,
  getEventByIdHandler,
  requestToJoin,
  getEventRequestsHandler,
  respondToRequest,
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
router.get('/:eventId/requests', authenticateToken, getEventRequestsHandler);
router.post('/request/respond', authenticateToken, respondToRequest);
router.get('/:eventId/messages', authenticateToken, getEventMessagesHandler);
router.post('/:eventId/messages', authenticateToken, postEventMessage);
router.put('/:eventId/meetup-details', authenticateToken, updateMeetupDetails);

export default router;
