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
  getTextingCoaches,
  createTextingCoach,
  getActiveCoachingSession,
  createCoachingSession,
  completeCoachingSession,
  addCoachReview,
} from '../models/safety.js';
import { getUserById, getAllUsers, unblockUser as unblockUserFunc } from '../models/user.js';

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

    const contact = await addEmergencyContact({
      userId,
      name,
      phone,
      email,
      relationship,
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
    const { meetAt, location, expectedBackAt, emergencyContactUserId, emergencyContactId, chatPartnerUserId } = req.body;
    if (!meetAt || !location || !expectedBackAt) {
      return res.status(400).json({ error: 'meetAt, location, and expectedBackAt are required' });
    }
    if (!emergencyContactUserId && !emergencyContactId) {
      return res.status(400).json({ error: 'Emergency contact required: add emergencyContactUserId (app user) or emergencyContactId (saved contact)' });
    }
    const plan = await createMeetupPlan({
      userId,
      meetAt,
      location,
      expectedBackAt,
      emergencyContactUserId: emergencyContactUserId || null,
      emergencyContactId: emergencyContactId || null,
      chatPartnerUserId: chatPartnerUserId || null,
    });
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
      const out: any = { ...p };
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
      location,
      date,
      notes,
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
      bio,
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
        comment: req.body.comment,
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


