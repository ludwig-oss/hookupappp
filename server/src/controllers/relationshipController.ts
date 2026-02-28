import { Request, Response } from 'express';
import {
  getActiveRelationship,
  getPartnerId,
  confirmDating,
  confirmEndRelationship,
  shouldAskIfDating,
  shouldAskIfEnded,
  setLastCheckIn,
} from '../models/relationship.js';
import { getConversation } from '../models/chat.js';
import { getUserById } from '../models/user.js';
import {
  getTipOfDay,
  getTopicSuggestion,
  getDateIdea,
  getSolutionsForProblem,
} from '../data/relationshipTips.js';

export const getMyRelationship = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const rel = await getActiveRelationship(userId);
    if (!rel) return res.json({ relationship: null });
    const partnerId = getPartnerId(rel, userId);
    const partner = await getUserById(partnerId);
    res.json({
      relationship: {
        id: rel.id,
        status: rel.status,
        partnerUserId: partnerId,
        partnerName: partner?.name ?? null,
        partnerProfilePicture: partner?.profilePicture ?? null,
        confirmedAt: rel.confirmedAt,
        userConfirmedDating: rel.userId1 === userId ? rel.user1ConfirmedDating : rel.user2ConfirmedDating,
        partnerConfirmedDating: rel.userId1 === userId ? rel.user2ConfirmedDating : rel.user1ConfirmedDating,
        userConfirmedEnd: rel.userId1 === userId ? rel.user1ConfirmedEnd : rel.user2ConfirmedEnd,
        partnerConfirmedEnd: rel.userId1 === userId ? rel.user2ConfirmedEnd : rel.user1ConfirmedEnd,
      },
    });
  } catch (error) {
    console.error('Get relationship error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const confirmDatingHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { partnerUserId } = req.body;
    if (!userId || !partnerUserId) {
      return res.status(400).json({ error: 'partnerUserId is required' });
    }
    const rel = await confirmDating(userId, partnerUserId);
    const partnerId = getPartnerId(rel, userId);
    const partner = await getUserById(partnerId);
    res.json({
      relationship: {
        id: rel.id,
        status: rel.status,
        partnerUserId: partnerId,
        partnerName: partner?.name ?? null,
        partnerProfilePicture: partner?.profilePicture ?? null,
        confirmedAt: rel.confirmedAt,
      },
    });
  } catch (error) {
    console.error('Confirm dating error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const confirmEndHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { partnerUserId } = req.body;
    if (!userId || !partnerUserId) {
      return res.status(400).json({ error: 'partnerUserId is required' });
    }
    const rel = await confirmEndRelationship(userId, partnerUserId);
    res.json({
      relationship: {
        id: rel.id,
        status: rel.status,
        endedAt: rel.endedAt,
      },
    });
  } catch (error: any) {
    console.error('Confirm end error:', error);
    res.status(400).json({ error: error?.message || 'Internal server error' });
  }
};

/** Analyze conversation with partner; return whether to show "Are you two dating?" or "No longer dating?" */
export const getDetectionPrompt = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { partnerUserId } = req.params;
    if (!userId || !partnerUserId) {
      return res.status(400).json({ error: 'partnerUserId is required' });
    }
    const messages = await getConversation(userId, partnerUserId);
    const asContent = messages.map(m => ({ content: m.content }));
    const askDating = shouldAskIfDating(asContent);
    const askEnded = shouldAskIfEnded(asContent);
    res.json({
      shouldAskIfDating: askDating,
      shouldAskIfEnded: askEnded,
    });
  } catch (error) {
    console.error('Detection prompt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Relationship tip of the day. */
export const getTip = async (req: Request, res: Response) => {
  try {
    res.json({ tip: getTipOfDay() });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Topic suggestion when chat is quiet. */
export const getTopic = async (req: Request, res: Response) => {
  try {
    res.json({ topic: getTopicSuggestion() });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Date idea suggestion. */
export const getDateIdeaHandler = async (req: Request, res: Response) => {
  try {
    res.json({ idea: getDateIdea() });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Whether to show nightly check-in ("How's the relationship going?"). Once per day. */
export const getCheckInPrompt = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const rel = await getActiveRelationship(userId);
    if (!rel || rel.status !== 'active') {
      return res.json({ shouldShow: false });
    }
    const last = rel.lastCheckInAt ? new Date(rel.lastCheckInAt) : null;
    const now = new Date();
    const sameDay = last && last.toDateString() === now.toDateString();
    const isEvening = now.getHours() >= 18 || now.getHours() < 10;
    res.json({
      shouldShow: isEvening && !sameDay,
      relationshipId: rel.id,
    });
  } catch (error) {
    console.error('Check-in prompt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Submit check-in answer and optionally get solutions. */
export const submitCheckIn = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { relationshipId, goingWell, problemText } = req.body;
    if (!userId || !relationshipId) {
      return res.status(400).json({ error: 'relationshipId is required' });
    }
    await setLastCheckIn(relationshipId);
    const solutions = problemText && !goingWell
      ? getSolutionsForProblem(problemText)
      : [];
    res.json({
      message: 'Check-in recorded',
      solutions: solutions.length > 0 ? solutions : undefined,
    });
  } catch (error) {
    console.error('Submit check-in error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Get suggested solutions for a problem (e.g. "communication", "arguing"). */
export const getSolutions = async (req: Request, res: Response) => {
  try {
    const { problem } = req.query;
    const text = (problem as string) || '';
    const solutions = getSolutionsForProblem(text);
    res.json({ solutions });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Check if a user is in an active relationship (for profile/discover – show "In a relationship"). */
export const getRelationshipStatus = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const rel = await getActiveRelationship(userId);
    res.json({
      inRelationship: !!rel && rel.status === 'active',
    });
  } catch (error) {
    console.error('Relationship status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
