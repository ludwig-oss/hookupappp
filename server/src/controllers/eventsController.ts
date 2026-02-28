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
  canAccessEventChat,
  getEventMessages,
  addEventMessage,
  updateEventMeetupDetails,
  getEventsForUser,
  isEventEnded,
} from '../models/events.js';
import { getUserById } from '../models/user.js';
import { maskUserForViewer } from '../lib/celebMask.js';

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
    const city = (req.query.city as string)?.trim();
    const country = (req.query.country as string)?.trim();
    const events = city ? await getEventsByCity(city, country || undefined) : await getAllEvents();
    const now = new Date();
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
    res.json({ events: active, safetyNote: SAFETY_NOTE });
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
    const { type, title, description, city, country, startDate, startTime, endTime } = body;
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
    const myRequest = await getEventRequest(eventId, userId || '');
    const canChat = event.creatorUserId === userId || (myRequest?.status === 'accepted');
    res.json({
      event: { ...event, creator: creatorSafe, ended, myRequest, canChat, safetyNote: SAFETY_NOTE },
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
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });
    const event = await getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.creatorUserId === userId) return res.status(400).json({ error: 'You are the creator' });
    const request = await createEventRequest(eventId, userId);
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
    const content = req.body.content;
    if (!eventId || !(typeof content === 'string' && content.trim())) {
      return res.status(400).json({ error: 'eventId and content are required' });
    }
    const msg = await addEventMessage(eventId, userId, content.trim());
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
    const event = await updateEventMeetupDetails(eventId, userId, typeof meetupDetails === 'string' ? meetupDetails : '');
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
        return { ...e, creator: creatorSafe, ended, safetyNote: SAFETY_NOTE };
      })
    );
    res.json({ events: withCreator });
  } catch (e: any) {
    console.error('My events error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}
