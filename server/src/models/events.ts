import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { getUserById } from './user.js';
import { cityMatches, countryMatches } from '../utils/eventSearch.js';

export type EventType =
  | 'house_party'
  | 'club'
  | 'picnic'
  | 'chilling'
  | 'watch_football'
  | 'drinks'
  | 'other';

export interface Event {
  id: string;
  creatorUserId: string;
  type: EventType;
  title: string;
  description?: string;
  city: string;
  country?: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm (event ends next day at 6am = "06:00")
  createdAt: string;
  meetupDetails?: string; // Requirements/details of meet up (creator can set)
}

export interface EventRequest {
  id: string;
  eventId: string;
  userId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: string;
  /** Optional question for the host (e.g. can I bring someone). */
  question?: string;
  /** Host reply to that question. */
  organizerReply?: string;
  organizerRepliedAt?: string;
  /** Required when the guest cancels / cannot come. */
  cancelReason?: string;
  cancelledAt?: string;
}

export interface EventMessage {
  id: string;
  eventId: string;
  userId: string;
  content: string;
  createdAt: string;
}

const EVENTS_PATH = join(process.cwd(), 'server', 'data', 'events.json');
const EVENT_REQUESTS_PATH = join(process.cwd(), 'server', 'data', 'event-requests.json');
const EVENT_MESSAGES_PATH = join(process.cwd(), 'server', 'data', 'event-messages.json');

async function readEvents(): Promise<Event[]> {
  try {
    const data = await readFile(EVENTS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeEvents(events: Event[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then((fs) => fs.mkdir(dir, { recursive: true }));
  await writeFile(EVENTS_PATH, JSON.stringify(events, null, 2), 'utf-8');
}

async function readRequests(): Promise<EventRequest[]> {
  try {
    const data = await readFile(EVENT_REQUESTS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeRequests(requests: EventRequest[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then((fs) => fs.mkdir(dir, { recursive: true }));
  await writeFile(EVENT_REQUESTS_PATH, JSON.stringify(requests, null, 2), 'utf-8');
}

async function readMessages(): Promise<EventMessage[]> {
  try {
    const data = await readFile(EVENT_MESSAGES_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeMessages(messages: EventMessage[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then((fs) => fs.mkdir(dir, { recursive: true }));
  await writeFile(EVENT_MESSAGES_PATH, JSON.stringify(messages, null, 2), 'utf-8');
}

/** Event ends the following day at 6:00 */
export function getEventEndTime(startDate: string, startTime: string, endTime: string): Date {
  const [year, month, day] = startDate.split('-').map(Number);
  const nextDay = new Date(year, month - 1, day + 1);
  const [eh, em] = (endTime || '06:00').split(':').map(Number);
  nextDay.setHours(eh, em, 0, 0);
  return nextDay;
}

export function isEventEnded(event: Event): boolean {
  const end = getEventEndTime(event.startDate, event.startTime, event.endTime);
  return new Date() >= end;
}

export async function createEvent(
  creatorUserId: string,
  data: {
    type: EventType;
    title: string;
    description?: string;
    city: string;
    country?: string;
    startDate: string;
    startTime: string;
    endTime?: string;
  }
): Promise<Event> {
  const events = await readEvents();
  const event: Event = {
    id: Date.now().toString(),
    creatorUserId,
    type: data.type,
    title: data.title,
    description: data.description,
    city: (data.city || '').trim(),
    country: data.country?.trim(),
    startDate: data.startDate,
    startTime: data.startTime,
    endTime: data.endTime || '06:00', // next day 6am
    createdAt: new Date().toISOString(),
  };
  events.push(event);
  await writeEvents(events);
  return event;
}

export async function getEventById(eventId: string): Promise<Event | null> {
  const events = await readEvents();
  return events.find((e) => e.id === eventId) || null;
}

export async function getEventsByCity(city: string, country?: string): Promise<Event[]> {
  const events = await readEvents();
  const cityLower = (city || '').toLowerCase().trim();
  return events.filter((e) => {
    if (cityLower && !cityMatches(e.city, cityLower)) return false;
    if (!countryMatches(country, e.country)) return false;
    return true;
  });
}

export async function getAllEvents(): Promise<Event[]> {
  return readEvents();
}

export async function createEventRequest(
  eventId: string,
  userId: string,
  question?: string
): Promise<EventRequest> {
  const requests = await readRequests();
  const existing = requests.find((r) => r.eventId === eventId && r.userId === userId);
  const q = (question || '').trim() || undefined;
  if (existing) {
    if (existing.status === 'pending' || existing.status === 'accepted') {
      if (q && !existing.question) {
        existing.question = q;
        await writeRequests(requests);
      }
      return existing;
    }
    existing.status = 'pending';
    existing.question = q;
    existing.organizerReply = undefined;
    existing.organizerRepliedAt = undefined;
    existing.cancelReason = undefined;
    existing.cancelledAt = undefined;
    existing.createdAt = new Date().toISOString();
    await writeRequests(requests);
    return existing;
  }
  const req: EventRequest = {
    id: Date.now().toString(),
    eventId,
    userId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    question: q,
  };
  requests.push(req);
  await writeRequests(requests);
  return req;
}

export async function getEventRequests(eventId: string): Promise<EventRequest[]> {
  const requests = await readRequests();
  return requests.filter((r) => r.eventId === eventId);
}

export async function getEventRequest(eventId: string, userId: string): Promise<EventRequest | null> {
  const requests = await readRequests();
  return requests.find((r) => r.eventId === eventId && r.userId === userId) || null;
}

export async function respondToEventRequest(
  requestId: string,
  eventId: string,
  creatorUserId: string,
  accept: boolean
): Promise<EventRequest | null> {
  const requests = await readRequests();
  const idx = requests.findIndex(
    (r) => r.id === requestId && r.eventId === eventId && r.status === 'pending'
  );
  if (idx === -1) return null;
  const event = await getEventById(eventId);
  if (!event || event.creatorUserId !== creatorUserId) return null;
  requests[idx].status = accept ? 'accepted' : 'rejected';
  await writeRequests(requests);
  return requests[idx];
}

export async function getAcceptedMemberIds(eventId: string): Promise<string[]> {
  const requests = await readRequests();
  return requests
    .filter((r) => r.eventId === eventId && r.status === 'accepted')
    .map((r) => r.userId);
}

/** Profile pictures only — no names — for the host and accepted guests. */
export async function getAcceptedGuestPhotos(
  eventId: string
): Promise<{ profilePicture: string | null }[]> {
  const ids = await getAcceptedMemberIds(eventId);
  const photos: { profilePicture: string | null }[] = [];
  for (const id of ids) {
    const u = await getUserById(id);
    photos.push({ profilePicture: u?.profilePicture ?? null });
  }
  return photos;
}

export async function replyToEventRequest(
  requestId: string,
  eventId: string,
  creatorUserId: string,
  reply: string
): Promise<EventRequest | null> {
  const event = await getEventById(eventId);
  if (!event || event.creatorUserId !== creatorUserId) return null;
  const text = reply.trim();
  if (!text) return null;
  const requests = await readRequests();
  const idx = requests.findIndex((r) => r.id === requestId && r.eventId === eventId);
  if (idx === -1) return null;
  if (requests[idx].status === 'cancelled') return null;
  requests[idx].organizerReply = text;
  requests[idx].organizerRepliedAt = new Date().toISOString();
  await writeRequests(requests);
  return requests[idx];
}

export async function cancelEventRequest(
  eventId: string,
  userId: string,
  reason: string
): Promise<EventRequest | null> {
  const text = reason.trim();
  if (text.length < 4) return null;
  const requests = await readRequests();
  const idx = requests.findIndex(
    (r) =>
      r.eventId === eventId &&
      r.userId === userId &&
      (r.status === 'pending' || r.status === 'accepted')
  );
  if (idx === -1) return null;
  requests[idx].status = 'cancelled';
  requests[idx].cancelReason = text;
  requests[idx].cancelledAt = new Date().toISOString();
  await writeRequests(requests);
  return requests[idx];
}

export async function canAccessEventChat(eventId: string, userId: string): Promise<boolean> {
  const event = await getEventById(eventId);
  if (!event) return false;
  if (event.creatorUserId === userId) return true;
  const members = await getAcceptedMemberIds(eventId);
  return members.includes(userId);
}

export async function getEventMessages(eventId: string): Promise<EventMessage[]> {
  const messages = await readMessages();
  return messages.filter((m) => m.eventId === eventId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function addEventMessage(
  eventId: string,
  userId: string,
  content: string
): Promise<EventMessage | null> {
  const can = await canAccessEventChat(eventId, userId);
  if (!can) return null;
  const event = await getEventById(eventId);
  if (!event || isEventEnded(event)) return null;
  const messages = await readMessages();
  const msg: EventMessage = {
    id: Date.now().toString(),
    eventId,
    userId,
    content: content.trim(),
    createdAt: new Date().toISOString(),
  };
  messages.push(msg);
  await writeMessages(messages);
  return msg;
}

export async function updateEventMeetupDetails(
  eventId: string,
  creatorUserId: string,
  meetupDetails: string
): Promise<Event | null> {
  const events = await readEvents();
  const idx = events.findIndex((e) => e.id === eventId && e.creatorUserId === creatorUserId);
  if (idx === -1) return null;
  events[idx].meetupDetails = meetupDetails;
  await writeEvents(events);
  return events[idx];
}

export async function getEventsForUser(userId: string): Promise<Event[]> {
  const requests = await readRequests();
  const relatedEventIds = new Set(
    requests
      .filter((r) => r.userId === userId && r.status !== 'rejected')
      .map((r) => r.eventId)
  );
  const events = await readEvents();
  const created = events.filter((e) => e.creatorUserId === userId);
  const related = events.filter((e) => relatedEventIds.has(e.id));
  const all = [...created];
  related.forEach((e) => {
    if (!all.find((x) => x.id === e.id)) all.push(e);
  });
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
