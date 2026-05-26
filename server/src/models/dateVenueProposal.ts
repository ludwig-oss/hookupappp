import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { pickRandomVenues, type DateVenueOption } from '../constants/dateVenues.js';

export interface DateVenueProposal {
  id: string;
  userA: string;
  userB: string;
  venues: DateVenueOption[];
  userAChoiceId: string | null;
  userBChoiceId: string | null;
  agreedVenue: DateVenueOption | null;
  status: 'voting' | 'agreed';
  createdAt: string;
  updatedAt: string;
}

const PATH = join(process.cwd(), 'server', 'data', 'date-venue-proposals.json');

function pairKey(a: string, b: string): string {
  return [a, b].sort().join(':');
}

async function readAll(): Promise<DateVenueProposal[]> {
  try {
    const data = await readFile(PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeAll(items: DateVenueProposal[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(PATH, JSON.stringify(items, null, 2));
}

export async function getOrCreateProposal(userA: string, userB: string): Promise<DateVenueProposal> {
  const items = await readAll();
  const key = pairKey(userA, userB);
  const existing = items.find((p) => pairKey(p.userA, p.userB) === key);
  if (existing) return existing;

  const sorted = [userA, userB].sort();
  const now = new Date().toISOString();
  const proposal: DateVenueProposal = {
    id: Date.now().toString(),
    userA: sorted[0],
    userB: sorted[1],
    venues: pickRandomVenues(50),
    userAChoiceId: null,
    userBChoiceId: null,
    agreedVenue: null,
    status: 'voting',
    createdAt: now,
    updatedAt: now,
  };
  items.push(proposal);
  await writeAll(items);
  return proposal;
}

export async function getProposalForPair(userA: string, userB: string): Promise<DateVenueProposal | null> {
  const items = await readAll();
  const key = pairKey(userA, userB);
  return items.find((p) => pairKey(p.userA, p.userB) === key) ?? null;
}

export async function voteVenue(
  userId: string,
  otherUserId: string,
  venueId: string
): Promise<DateVenueProposal | null> {
  const items = await readAll();
  const key = pairKey(userId, otherUserId);
  const i = items.findIndex((p) => pairKey(p.userA, p.userB) === key);
  if (i === -1) return null;

  const proposal = items[i];
  const venue = proposal.venues.find((v) => v.id === venueId);
  if (!venue) return null;

  const isUserA = userId === proposal.userA;
  if (isUserA) proposal.userAChoiceId = venueId;
  else proposal.userBChoiceId = venueId;

  if (
    proposal.userAChoiceId &&
    proposal.userBChoiceId &&
    proposal.userAChoiceId === proposal.userBChoiceId
  ) {
    proposal.agreedVenue = venue;
    proposal.status = 'agreed';
  }

  proposal.updatedAt = new Date().toISOString();
  items[i] = proposal;
  await writeAll(items);
  return proposal;
}

export async function refreshVenueOptions(userA: string, userB: string): Promise<DateVenueProposal> {
  const items = await readAll();
  const key = pairKey(userA, userB);
  const i = items.findIndex((p) => pairKey(p.userA, p.userB) === key);
  const now = new Date().toISOString();
  if (i === -1) return getOrCreateProposal(userA, userB);

  items[i].venues = pickRandomVenues(50);
  items[i].userAChoiceId = null;
  items[i].userBChoiceId = null;
  items[i].agreedVenue = null;
  items[i].status = 'voting';
  items[i].updatedAt = now;
  await writeAll(items);
  return items[i];
}
