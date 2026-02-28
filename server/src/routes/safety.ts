import express from 'express';
import {
  getMyEmergencyContacts,
  addMyEmergencyContact,
  removeEmergencyContact,
  shareDateWithContacts,
  createMeetupPlanHandler,
  getMyMeetupPlans,
  markMeetupPlanNotified,
  getAllTextingCoaches,
  registerAsTextingCoach,
  startCoachingSession,
  endCoachingSession,
  getMyActiveCoachingSession,
  getBlockedUsers,
  unblockUser,
} from '../controllers/safetyController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Emergency Contacts
router.get('/emergency-contacts', getMyEmergencyContacts);
router.post('/emergency-contacts', addMyEmergencyContact);
router.delete('/emergency-contacts/:contactId', removeEmergencyContact);

// Meetup plans (safety check-in)
router.post('/meetup-plan', createMeetupPlanHandler);
router.get('/meetup-plans', getMyMeetupPlans);
router.post('/meetup-plan/:planId/notified', markMeetupPlanNotified);

// Date Sharing
router.post('/share-date', shareDateWithContacts);

// Texting Coaches
router.get('/texting-coaches', getAllTextingCoaches);
router.post('/texting-coaches/register', registerAsTextingCoach);
router.post('/texting-coaches/session/start', startCoachingSession);
router.post('/texting-coaches/session/end', endCoachingSession);
router.get('/texting-coaches/session/active', getMyActiveCoachingSession);

// Blocked Users
router.get('/blocked-users', getBlockedUsers);
router.post('/unblock', unblockUser);

export default router;


