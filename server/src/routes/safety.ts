import express from 'express';
import {
  getMyEmergencyContacts,
  addMyEmergencyContact,
  removeEmergencyContact,
  shareDateWithContacts,
  createMeetupPlanHandler,
  getMyMeetupPlans,
  markMeetupPlanNotified,
  submitMeetupSafetyCheckHandler,
  getMeetupWeekStatusHandler,
  getDateVenueProposalHandler,
  voteDateVenueHandler,
  triggerWomenSafetySOS,
  getNearbyWomenSafetyAlerts,
  resolveWomenSafetySOSHandler,
  pollMeetupSafetyReminders,
  pollDateSafetyHandler,
  startDateTrackingHandler,
  postLocationTrailHandler,
  safetyCheckInHandler,
  triggerDangerHandler,
  okRestOfDateHandler,
  endDateSessionHandler,
  getEmergencyTrailHandler,
  setDateSafeWordHandler,
  getAllTextingCoaches,
  registerAsTextingCoach,
  startCoachingSession,
  endCoachingSession,
  getMyActiveCoachingSession,
  getBlockedUsers,
  unblockUser,
} from '../controllers/safetyController.js';
import { authenticateToken } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { isAdminUserId } from '../middleware/requireAdmin.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/is-admin', (req: AuthRequest, res) => {
  res.json({ isAdmin: isAdminUserId(req.userId) });
});

// Emergency Contacts
router.get('/emergency-contacts', getMyEmergencyContacts);
router.post('/emergency-contacts', addMyEmergencyContact);
router.delete('/emergency-contacts/:contactId', removeEmergencyContact);

// Meetup plans (safety check-in)
router.post('/meetup-plan', createMeetupPlanHandler);
router.get('/meetup-plans', getMyMeetupPlans);
router.post('/meetup-plan/:planId/notified', markMeetupPlanNotified);
router.post('/meetup-plan/safety-check', submitMeetupSafetyCheckHandler);
router.get('/meetup-week/:otherUserId', getMeetupWeekStatusHandler);
router.get('/date-venues/:otherUserId', getDateVenueProposalHandler);
router.post('/date-venues/vote', voteDateVenueHandler);
router.post('/women-sos', triggerWomenSafetySOS);
router.get('/women-sos/nearby', getNearbyWomenSafetyAlerts);
router.post('/women-sos/resolve', resolveWomenSafetySOSHandler);
router.get('/meetup-safety/poll', pollMeetupSafetyReminders);
router.get('/date-safety/poll', pollDateSafetyHandler);
router.post('/meetup-plan/:planId/start-date', startDateTrackingHandler);
router.post('/meetup-plan/:planId/location', postLocationTrailHandler);
router.post('/meetup-plan/:planId/check-in', safetyCheckInHandler);
router.post('/meetup-plan/:planId/danger', triggerDangerHandler);
router.post('/meetup-plan/:planId/ok-rest', okRestOfDateHandler);
router.post('/meetup-plan/:planId/end-date', endDateSessionHandler);
router.get('/emergency-trail/:planId', getEmergencyTrailHandler);
router.post('/date-safe-word', setDateSafeWordHandler);

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


