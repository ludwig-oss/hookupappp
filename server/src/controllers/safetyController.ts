import { Request, Response } from 'express';
import {
  getEmergencyContacts,
  addEmergencyContact,
  deleteEmergencyContact,
  getEmergencyContactById,
  shareDateInfo,
  createMeetupPlan,
  getMeetupPlansForUser,
  setMeetupPlanNotified,
  setMeetupPlanEmergencyVideoNotified,
  submitMeetupSafetyCheck,
  getDueMeetupPlansForEmergencyVideo,
  getTextingCoaches,
  createTextingCoach,
  getActiveCoachingSession,
  createCoachingSession,
  completeCoachingSession,
  addCoachReview,
} from '../models/safety.js';
import { getUserById, getAllUsers, unblockUser as unblockUserFunc } from '../models/user.js';
import { sanitizeName, sanitizeBio, sanitizeForStorage, LIMITS } from '../utils/sanitize.js';
import {
  getOrCreateProposal,
  voteVenue,
  refreshVenueOptions,
} from '../models/dateVenueProposal.js';
import { markMetInPerson, getMeetupWeekStatus } from '../models/matchMeetupDeadline.js';
import {
  createWomenSafetyAlert,
  getActiveAlertsNear,
  resolveWomenSafetyAlert,
} from '../models/womenSafetyAlert.js';
import { sendPushToUser } from '../realtime/push.js';
import { storeSensitive, vaultRef } from '../utils/sensitiveVault.js';
import { sanitizeMeetupPlanForClient } from '../models/safety.js';

// Emergency Contacts
export const getMyEmergencyContacts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const contacts = await getEmergencyContacts(userId);
    res.json({ contacts });
  } catch (error) {
    console.error('Get emergency contacts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addMyEmergencyContact = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { name, phone, email, relationship } = req.body;
    
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    const safeName = sanitizeName(name);
    if (!safeName) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const contact = await addEmergencyContact({
      userId,
      name: safeName,
      phone: String(phone).replace(/\D/g, '').slice(0, LIMITS.PHONE),
      email: email != null ? sanitizeForStorage(email, 254) : undefined,
      relationship: relationship != null ? sanitizeForStorage(relationship, LIMITS.SHORT_LABEL) : undefined,
    });
    
    res.json({ contact });
  } catch (error) {
    console.error('Add emergency contact error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const removeEmergencyContact = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { contactId } = req.params;
    
    await deleteEmergencyContact(userId, contactId);
    res.json({ message: 'Emergency contact removed' });
  } catch (error) {
    console.error('Remove emergency contact error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Meetup plan (safety check-in reminder)
export const createMeetupPlanHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const {
      meetAt,
      location,
      expectedBackAt,
      emergencyContactUserId,
      emergencyContactId,
      chatPartnerUserId,
      idVerificationConsent,
      idFrontImage,
      idBackImage,
      agreedVenueName,
    } = req.body;
    if (!meetAt || !location || !expectedBackAt) {
      return res.status(400).json({ error: 'meetAt, location, and expectedBackAt are required' });
    }
    if (!emergencyContactUserId && !emergencyContactId) {
      return res.status(400).json({ error: 'Emergency contact required: add emergencyContactUserId (app user) or emergencyContactId (saved contact)' });
    }
    if (!idVerificationConsent) {
      return res.status(400).json({
        error:
          'You must consent to ID verification for safety. Your ID is stored securely and used only if your match does not check in with video evidence.',
      });
    }
    if (!idFrontImage || !idBackImage) {
      return res.status(400).json({ error: 'ID front and back images are required before meeting.' });
    }
    const planId = Date.now().toString();
    const idFrontVaultRef = vaultRef(planId, 'id_front');
    const idBackVaultRef = vaultRef(planId, 'id_back');
    await storeSensitive(idFrontVaultRef, String(idFrontImage));
    await storeSensitive(idBackVaultRef, String(idBackImage));

    const plan = await createMeetupPlan({
      id: planId,
      userId,
      meetAt,
      location: sanitizeForStorage(location, LIMITS.LOCATION),
      expectedBackAt,
      emergencyContactUserId: emergencyContactUserId || null,
      emergencyContactId: emergencyContactId || null,
      chatPartnerUserId: chatPartnerUserId || null,
      idVerificationConsent: true,
      idFrontImage: null,
      idBackImage: null,
      idFrontVaultRef,
      idBackVaultRef,
      safetyCheckStatus: 'none',
      agreedVenueName: agreedVenueName != null ? sanitizeForStorage(agreedVenueName, LIMITS.LOCATION) : null,
    });
    if (chatPartnerUserId) {
      await markMetInPerson(userId, chatPartnerUserId);
    }
    res.json({ plan });
  } catch (error) {
    console.error('Create meetup plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyMeetupPlans = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const plans = await getMeetupPlansForUser(userId);
    const enriched = await Promise.all(plans.map(async (p) => {
      const out: any = { ...sanitizeMeetupPlanForClient(p) };
      if (p.emergencyContactId) {
        const contact = await getEmergencyContactById(p.emergencyContactId);
        if (contact) {
          out.emergencyContactName = contact.name;
          out.emergencyContactPhone = contact.phone;
        }
      }
      if (p.emergencyContactUserId) {
        const u = await getUserById(p.emergencyContactUserId);
        if (u) out.emergencyContactAppName = u.name;
      }
      return out;
    }));
    res.json({ plans: enriched });
  } catch (error) {
    console.error('Get meetup plans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markMeetupPlanNotified = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { planId } = req.params;
    await setMeetupPlanNotified(planId, userId);
    res.json({ message: 'Marked as notified' });
  } catch (error) {
    console.error('Mark meetup notified error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const submitMeetupSafetyCheckHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { planId, safetyCheckVideo } = req.body;
    if (!planId || !safetyCheckVideo || typeof safetyCheckVideo !== 'string') {
      return res.status(400).json({ error: 'planId and safetyCheckVideo (360° check-in) are required' });
    }
    const videoRef = vaultRef(planId, 'safety_video');
    await storeSensitive(videoRef, safetyCheckVideo.slice(0, 15_000_000));
    const plan = await submitMeetupSafetyCheck(planId, userId, videoRef);
    if (!plan) return res.status(404).json({ error: 'Meetup plan not found' });
    res.json({
      plan,
      message:
        'Safety video submitted securely. Our team will review it. If your match does not return safely, your encrypted ID is available to admins only.',
    });
  } catch (error) {
    console.error('Submit safety check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMeetupWeekStatusHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { otherUserId } = req.params;
    if (!otherUserId) return res.status(400).json({ error: 'otherUserId required' });
    const status = await getMeetupWeekStatus(userId, otherUserId);
    res.json({ meetupWeek: status });
  } catch (error) {
    console.error('Meetup week status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getDateVenueProposalHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { otherUserId } = req.params;
    const refresh = req.query.refresh === 'true';
    const proposal = refresh
      ? await refreshVenueOptions(userId, otherUserId)
      : await getOrCreateProposal(userId, otherUserId);
    res.json({
      proposal,
      rules:
        'Pick a public talk-friendly spot (parks, coffee to-go, plazas). No sit-down restaurants, cinemas, or movies. Each pays your own.',
    });
  } catch (error) {
    console.error('Get venue proposal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const voteDateVenueHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { otherUserId, venueId } = req.body;
    if (!otherUserId || !venueId) {
      return res.status(400).json({ error: 'otherUserId and venueId are required' });
    }
    await getOrCreateProposal(userId, otherUserId);
    const proposal = await voteVenue(userId, otherUserId, venueId);
    if (!proposal) return res.status(404).json({ error: 'Venue not found' });
    res.json({ proposal });
  } catch (error) {
    console.error('Vote venue error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const triggerWomenSafetySOS = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { lat, lon, message } = req.body;
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const gender = (user.gender || '').toLowerCase();
    const allowed =
      gender === 'woman' ||
      gender === 'female' ||
      gender === 'women' ||
      gender.includes('woman') ||
      gender.includes('female');
    if (!allowed) {
      return res.status(403).json({
        error: 'This emergency alert is for women only. Update your profile gender or use your local emergency number.',
      });
    }

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return res.status(400).json({ error: 'lat and lon are required for your location' });
    }

    const { alert, nearbyWomenNotified } = await createWomenSafetyAlert({
      userId,
      userName: user.name,
      lat,
      lon,
      message: message != null ? sanitizeForStorage(message, 500) : undefined,
    });

    res.json({
      alert,
      nearbyWomenNotified,
      policeNumber: '911',
      mapsUrl: `https://www.google.com/maps?q=${lat},${lon}`,
      message:
        'Alert sent to the app and nearby women users. Call emergency services now if you are in immediate danger.',
    });
  } catch (error) {
    console.error('Women SOS error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNearbyWomenSafetyAlerts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'lat and lon query params required' });
    }
    const alerts = await getActiveAlertsNear(lat, lon);
    res.json({ alerts });
  } catch (error) {
    console.error('Get women alerts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resolveWomenSafetySOSHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { alertId } = req.body;
    if (!alertId) return res.status(400).json({ error: 'alertId required' });
    const ok = await resolveWomenSafetyAlert(alertId, userId);
    if (!ok) return res.status(404).json({ error: 'Alert not found' });
    res.json({ message: 'Alert resolved — stay safe.' });
  } catch (error) {
    console.error('Resolve women SOS error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const pollMeetupSafetyReminders = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const duePlans = await getDueMeetupPlansForEmergencyVideo();
    const mine = duePlans.filter((p) => p.userId === userId);
    const notifyTargets = duePlans.filter((p) => p.emergencyContactUserId === userId);

    for (const p of notifyTargets) {
      if (p.emergencyContactVideoNotifiedAt) continue;
      await setMeetupPlanEmergencyVideoNotified(p.id, p.userId);
      const dater = await getUserById(p.userId);
      sendPushToUser(userId, {
        title: 'Safety check-in: video call your friend',
        body: `${dater?.name || 'Your contact'} should be back by now. Video call them to confirm they are safe.`,
        data: { planId: p.id, type: 'meetup_emergency_video' },
      }).catch(() => {});
    }

    res.json({
      needsSafetyVideo: mine.filter((p) => !p.safetyCheckSubmittedAt),
      emergencyVideoCallPlans: notifyTargets,
    });
  } catch (error) {
    console.error('Poll meetup safety error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Date Sharing
export const shareDateWithContacts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { dateUserId, location, date, notes, contactIds } = req.body;
    
    if (!dateUserId || !location || !date || !contactIds || !Array.isArray(contactIds)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const share = await shareDateInfo({
      userId,
      dateUserId,
      location: sanitizeForStorage(location, LIMITS.LOCATION),
      date,
      notes: notes != null ? sanitizeForStorage(notes, LIMITS.NOTES) : undefined,
      sharedWith: contactIds,
    });
    
    res.json({ share, message: 'Date information shared with emergency contacts' });
  } catch (error) {
    console.error('Share date error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Texting Coaches
export const getAllTextingCoaches = async (req: Request, res: Response) => {
  try {
    const coaches = await getTextingCoaches();
    res.json({ coaches });
  } catch (error) {
    console.error('Get texting coaches error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const registerAsTextingCoach = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { specialties, hourlyRate, bio } = req.body;
    
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const coach = await createTextingCoach({
      userId,
      name: user.name,
      username: user.username,
      profilePicture: user.profilePicture,
      rating: 0,
      totalHelps: 0,
      specialties: specialties || [],
      isActive: true,
      hourlyRate: hourlyRate || 0,
      bio: bio != null ? sanitizeBio(bio) : undefined,
    });
    
    res.json({ coach });
  } catch (error) {
    console.error('Register as texting coach error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const startCoachingSession = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { coachId, conversationId } = req.body;
    
    if (!coachId || !conversationId) {
      return res.status(400).json({ error: 'Coach ID and conversation ID are required' });
    }

    // Check if there's already an active session
    const activeSession = await getActiveCoachingSession(userId);
    if (activeSession) {
      return res.status(400).json({ error: 'You already have an active coaching session' });
    }

    const session = await createCoachingSession({
      userId,
      coachId,
      conversationId,
    });
    
    res.json({ session });
  } catch (error) {
    console.error('Start coaching session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const endCoachingSession = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { sessionId, amount } = req.body;
    
    if (!sessionId || amount === undefined) {
      return res.status(400).json({ error: 'Session ID and amount are required' });
    }

    await completeCoachingSession(sessionId, amount);
    
    // Add review if provided
    if (req.body.rating && req.body.comment) {
      await addCoachReview(req.body.coachId, {
        userId,
        userName: (await getUserById(userId))?.name || 'Anonymous',
        rating: req.body.rating,
        comment: sanitizeForStorage(req.body.comment, LIMITS.COMMENT),
      });
    }
    
    res.json({ message: 'Coaching session completed' });
  } catch (error) {
    console.error('End coaching session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyActiveCoachingSession = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const session = await getActiveCoachingSession(userId);
    res.json({ session });
  } catch (error) {
    console.error('Get active coaching session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Blocked Users
export const getBlockedUsers = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const allUsers = await getAllUsers();
    const blockedUsers = allUsers
      .filter(u => user.blockedUsers?.includes(u.id))
      .map(u => ({ id: u.id, name: u.name, username: u.username, profilePicture: u.profilePicture }));

    res.json({ users: blockedUsers });
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const unblockUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { blockedUserId } = req.body;

    if (!blockedUserId) {
      return res.status(400).json({ error: 'Blocked user ID is required' });
    }

    await unblockUserFunc(userId, blockedUserId);
    res.json({ message: 'User unblocked' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


