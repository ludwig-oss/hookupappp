import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { getUserById } from './user.js';
import { maskUserForViewer } from '../lib/celebMask.js';

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
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
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
  const countryLower = (country || '').toLowerCase().trim();
  return events.filter((e) => {
    const eCity = (e.city || '').toLowerCase().trim();
    const eCountry = (e.country || '').toLowerCase().trim();
    if (countryLower && eCountry !== countryLower) return false;
    return eCity.includes(cityLower) || cityLower.includes(eCity);
  });
}

export async function getAllEvents(): Promise<Event[]> {
  return readEvents();
}

export async function createEventRequest(eventId: string, userId: string): Promise<EventRequest> {
  const requests = await readRequests();
  const existing = requests.find((r) => r.eventId === eventId && r.userId === userId);
  if (existing) return existing;
  const req: EventRequest = {
    id: Date.now().toString(),
    eventId,
    userId,
    status: 'pending',
    createdAt: new Date().toISOString(),
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
  const acceptedEventIds = new Set(
    requests.filter((r) => r.userId === userId && r.status === 'accepted').map((r) => r.eventId)
  );
  const events = await readEvents();
  const created = events.filter((e) => e.creatorUserId === userId);
  const joined = events.filter((e) => acceptedEventIds.has(e.id));
  const all = [...created];
  joined.forEach((e) => {
    if (!all.find((x) => x.id === e.id)) all.push(e);
  });
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
