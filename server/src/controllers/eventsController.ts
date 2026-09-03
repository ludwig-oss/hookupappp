import { Request, Response } from 'express';
import {
  createEvent,
  getEventById,
  getEventsByCity,
  getAllEvents,
  createEventRequest,
  getEventRequests,
  getEventRequest,
  respondToEventRequest,
  replyToEventRequest,
  cancelEventRequest,
  getAcceptedGuestPhotos,
  canAccessEventChat,
  getEventMessages,
  addEventMessage,
  updateEventMeetupDetails,
  getEventsForUser,
  isEventEnded,
} from '../models/events.js';
import { getUserById } from '../models/user.js';
import { maskUserForViewer } from '../lib/celebMask.js';
import { checkContent } from '../utils/moderation.js';
import { sanitizeForStorage, sanitizeMessageContent, parseEventType, LIMITS } from '../utils/sanitize.js';
import { filterAndRankEvents } from '../utils/eventSearch.js';

const SAFETY_NOTE =
  'Be careful: meet at a public place first. Get details of where you\'re going and who you\'re with. Share your plans with an emergency contact.';

function creatorBase(u: any) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    profilePicture: u.profilePicture ?? null,
    publicFigureVerified: !!(u.publicFigureVerified),
    revealToUserIds: u.revealToUserIds || [],
  };
}

export async function listEvents(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const cityQuery = (req.query.city as string)?.trim();
    const countryQuery = (req.query.country as string)?.trim();
    const searchQ = (req.query.q as string)?.trim();
    const describe = (req.query.describe as string)?.trim();

    let profileCity = '';
    let profileCountry = '';
    if (userId) {
      const viewer = await getUserById(userId);
      profileCity = (viewer?.city || '').trim();
      profileCountry = (viewer?.country || '').trim();
    }

    const city = cityQuery || profileCity;
    const country = countryQuery || profileCountry || undefined;

    let events = city ? await getEventsByCity(city, country) : await getAllEvents();
    if (!cityQuery && !searchQ && !describe && profileCity) {
      events = await getEventsByCity(profileCity, country);
    }

    if (searchQ || describe) {
      events = filterAndRankEvents(events, searchQ, describe);
    }

    const withCreator = await Promise.all(
      events.map(async (e) => {
        const ended = isEventEnded(e);
        const creator = await getUserById(e.creatorUserId);
        const creatorSafe = creator ? maskUserForViewer(creatorBase(creator), userId) : null;
        return {
          ...e,
          ended,
          creator: creatorSafe,
          safetyNote: SAFETY_NOTE,
        };
      })
    );
    const active = withCreator.filter((e) => !e.ended).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({
      events: active,
      safetyNote: SAFETY_NOTE,
      locationUsed: city || profileCity || null,
    });
  } catch (e: any) {
    console.error('List events error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function createEventHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const body = req.body || {};
    const type = parseEventType(body.type);
    const title = sanitizeForStorage(body.title, LIMITS.EVENT_TITLE);
    const description = body.description != null
      ? sanitizeForStorage(body.description, LIMITS.EVENT_DESCRIPTION)
      : undefined;
    const city = sanitizeForStorage(body.city, LIMITS.CITY);
    const country = body.country != null ? sanitizeForStorage(body.country, LIMITS.COUNTRY) : undefined;
    const startDate = sanitizeForStorage(body.startDate, 20);
    const startTime = sanitizeForStorage(body.startTime, 10);
    const endTime = sanitizeForStorage(body.endTime || '06:00', 10);
    if (!type || !title || !city || !startDate || !startTime) {
      return res.status(400).json({ error: 'type, title, city, startDate, startTime are required' });
    }
    const event = await createEvent(userId, {
      type,
      title,
      description,
      city,
      country,
      startDate,
      startTime,
      endTime: endTime || '06:00',
    });
    const creator = await getUserById(userId);
    const creatorSafe = creator ? maskUserForViewer(creatorBase(creator), userId) : null;
    res.status(201).json({
      event: { ...event, creator: creatorSafe, safetyNote: SAFETY_NOTE },
    });
  } catch (e: any) {
    console.error('Create event error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function getEventByIdHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { eventId } = req.params;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });
    const event = await getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const creator = await getUserById(event.creatorUserId);
    const creatorSafe = creator ? maskUserForViewer(creatorBase(creator), userId) : null;
    const ended = isEventEnded(event);
    const myRequest = userId ? await getEventRequest(eventId, userId) : null;
    const canChat = event.creatorUserId === userId || myRequest?.status === 'accepted';
    const isHost = event.creatorUserId === userId;
    const acceptedGuests =
      isHost || myRequest?.status === 'accepted' ? await getAcceptedGuestPhotos(eventId) : [];
    res.json({
      event: {
        ...event,
        creator: creatorSafe,
        ended,
        myRequest,
        canChat,
        acceptedGuests,
        safetyNote: SAFETY_NOTE,
      },
    });
  } catch (e: any) {
    console.error('Get event error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function requestToJoin(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { eventId, question } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });
    const event = await getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.creatorUserId === userId) return res.status(400).json({ error: 'You are the creator' });
    if (isEventEnded(event)) return res.status(400).json({ error: 'This event has ended' });
    const q = question != null ? sanitizeForStorage(String(question), LIMITS.PROMPT) : undefined;
    const request = await createEventRequest(eventId, userId, q);
    res.json({ request });
  } catch (e: any) {
    console.error('Request to join error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function getEventRequestsHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { eventId } = req.params;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });
    const event = await getEventById(eventId);
    if (!event || event.creatorUserId !== userId) return res.status(403).json({ error: 'Not the event creator' });
    const requests = await getEventRequests(eventId);
    const withUser = await Promise.all(
      requests.map(async (r) => {
        const u = await getUserById(r.userId);
        const base = u ? creatorBase(u) : null;
        const safe = base ? maskUserForViewer(base, userId) : null;
        if (r.status === 'accepted' || r.status === 'cancelled') {
          return {
            ...r,
            user: { profilePicture: safe?.profilePicture ?? null },
          };
        }
        return { ...r, user: safe };
      })
    );
    res.json({ requests: withUser });
  } catch (e: any) {
    console.error('Get event requests error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function respondToRequest(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { requestId, eventId, accept } = req.body;
    if (!requestId || !eventId) return res.status(400).json({ error: 'requestId and eventId are required' });
    const updated = await respondToEventRequest(requestId, eventId, userId, !!accept);
    if (!updated) return res.status(404).json({ error: 'Request not found' });
    res.json({ request: updated });
  } catch (e: any) {
    console.error('Respond to request error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function replyToRequest(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { requestId, eventId, reply } = req.body;
    if (!requestId || !eventId) return res.status(400).json({ error: 'requestId and eventId are required' });
    const text = sanitizeForStorage(String(reply || ''), LIMITS.REPLY);
    if (!text.trim()) return res.status(400).json({ error: 'Write a reply to their question' });
    const updated = await replyToEventRequest(requestId, eventId, userId, text);
    if (!updated) return res.status(404).json({ error: 'Request not found' });
    res.json({ request: updated });
  } catch (e: any) {
    console.error('Reply to request error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function cancelJoinRequest(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { eventId, reason } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });
    const text = sanitizeForStorage(String(reason || ''), LIMITS.REASON);
    if (text.trim().length < 4) {
      return res.status(400).json({ error: 'Add a reason why you cannot come (at least a few words).' });
    }
    const updated = await cancelEventRequest(eventId, userId, text);
    if (!updated) return res.status(404).json({ error: 'No active request to cancel' });
    res.json({ request: updated });
  } catch (e: any) {
    console.error('Cancel join request error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function getEventMessagesHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { eventId } = req.params;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });
    const can = await canAccessEventChat(eventId, userId);
    if (!can) return res.status(403).json({ error: 'Not a member of this event' });
    const messages = await getEventMessages(eventId);
    const withUser = await Promise.all(
      messages.map(async (m) => {
        const u = await getUserById(m.userId);
        const base = u ? creatorBase(u) : null;
        const safe = base ? maskUserForViewer(base, userId) : null;
        return { ...m, userName: safe?.name || 'User' };
      })
    );
    res.json({ messages: withUser });
  } catch (e: any) {
    console.error('Get event messages error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function postEventMessage(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const eventId = req.params.eventId || req.body.eventId;
    const content = sanitizeMessageContent(req.body.content);
    if (!eventId || !content) {
      return res.status(400).json({ error: 'eventId and content are required' });
    }
    const moderation = checkContent(content);
    if (!moderation.allowed) {
      return res.status(400).json({ error: moderation.reason || 'Message not allowed.' });
    }
    const msg = await addEventMessage(eventId, userId, content);
    if (!msg) return res.status(403).json({ error: 'Cannot post or event ended' });
    const u = await getUserById(userId);
    const base = u ? creatorBase(u) : null;
    const safe = base ? maskUserForViewer(base, userId) : null;
    res.status(201).json({ message: { ...msg, userName: safe?.name || 'You' } });
  } catch (e: any) {
    console.error('Post event message error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function updateMeetupDetails(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const eventId = req.params.eventId || req.body.eventId;
    const meetupDetails = req.body.meetupDetails;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });
    const details = sanitizeForStorage(meetupDetails, LIMITS.EVENT_DESCRIPTION);
    const event = await updateEventMeetupDetails(eventId, userId, details);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ event });
  } catch (e: any) {
    console.error('Update meetup details error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function myEvents(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const events = await getEventsForUser(userId);
    const withCreator = await Promise.all(
      events.map(async (e) => {
        const creator = await getUserById(e.creatorUserId);
        const creatorSafe = creator ? maskUserForViewer(creatorBase(creator), userId) : null;
        const ended = isEventEnded(e);
        const myRequest = await getEventRequest(e.id, userId);
        const acceptedGuests =
          e.creatorUserId === userId || myRequest?.status === 'accepted'
            ? await getAcceptedGuestPhotos(e.id)
            : [];
        return { ...e, creator: creatorSafe, ended, myRequest, acceptedGuests, safetyNote: SAFETY_NOTE };
      })
    );
    res.json({ events: withCreator });
  } catch (e: any) {
    console.error('My events error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}
