import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export interface Relationship {
  id: string;
  userId1: string;
  userId2: string;
  status: 'pending' | 'active' | 'ended';
  /** When both confirmed dating → active */
  confirmedAt?: string;
  /** When both confirmed end → ended */
  endedAt?: string;
  user1ConfirmedDating?: boolean;
  user2ConfirmedDating?: boolean;
  user1ConfirmedEnd?: boolean;
  user2ConfirmedEnd?: boolean;
  lastCheckInAt?: string;
  createdAt: string;
}

const DB_PATH = join(process.cwd(), 'server', 'data', 'relationships.json');

function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function readRelationships(): Promise<Relationship[]> {
  try {
    const data = await readFile(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeRelationships(rows: Relationship[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(DB_PATH, JSON.stringify(rows, null, 2));
}

/** Get active or pending relationship for a user (if any). */
export async function getActiveRelationship(userId: string): Promise<Relationship | null> {
  const rows = await readRelationships();
  return rows.find(
    r =>
      (r.userId1 === userId || r.userId2 === userId) &&
      (r.status === 'active' || r.status === 'pending')
  ) || null;
}

/** Get partner user id for a user in an active relationship. */
export function getPartnerId(rel: Relationship, userId: string): string {
  return rel.userId1 === userId ? rel.userId2 : rel.userId1;
}

/** Confirm "we're dating" from one side. When both confirmed, status becomes active. */
export async function confirmDating(userId: string, partnerUserId: string): Promise<Relationship> {
  const [u1, u2] = normalizePair(userId, partnerUserId);
  const rows = await readRelationships();
  let rel = rows.find(r => r.userId1 === u1 && r.userId2 === u2 && (r.status === 'pending' || r.status === 'active'));
  const now = new Date().toISOString();

  if (!rel) {
    rel = {
      id: Date.now().toString(),
      userId1: u1,
      userId2: u2,
      status: 'pending',
      user1ConfirmedDating: u1 === userId,
      user2ConfirmedDating: u2 === userId,
      createdAt: now,
    };
    if (rel.user1ConfirmedDating && rel.user2ConfirmedDating) {
      rel.status = 'active';
      rel.confirmedAt = now;
    }
    rows.push(rel);
  } else {
    if (u1 === userId) rel.user1ConfirmedDating = true;
    else rel.user2ConfirmedDating = true;
    if (rel.user1ConfirmedDating && rel.user2ConfirmedDating) {
      rel.status = 'active';
      rel.confirmedAt = rel.confirmedAt || now;
    }
  }
  await writeRelationships(rows);
  return rel;
}

/** Confirm "we're no longer dating" from one side. When both confirmed, status becomes ended. */
export async function confirmEndRelationship(userId: string, partnerUserId: string): Promise<Relationship> {
  const [u1, u2] = normalizePair(userId, partnerUserId);
  const rows = await readRelationships();
  const rel = rows.find(r => r.userId1 === u1 && r.userId2 === u2 && r.status === 'active');
  if (!rel) throw new Error('No active relationship found');
  const now = new Date().toISOString();
  if (u1 === userId) rel.user1ConfirmedEnd = true;
  else rel.user2ConfirmedEnd = true;
  if (rel.user1ConfirmedEnd && rel.user2ConfirmedEnd) {
    rel.status = 'ended';
    rel.endedAt = now;
  }
  await writeRelationships(rows);
  return rel;
}

/** Check if the last N messages suggest "dating" so the app can ask. */
export function shouldAskIfDating(messages: { content: string }[]): boolean {
  const text = messages.slice(-20).map(m => m.content).join(' ').toLowerCase();
  const datingPhrases = [
    'we\'re dating', 'we are dating', 'we\'re together', 'we are together',
    'in a relationship', 'my boyfriend', 'my girlfriend', 'my partner',
    'want to be my', 'be my girlfriend', 'be my boyfriend', 'official',
    'exclusive', 'only you', 'only us', 'going out', 'seeing each other',
    'together now', 'start dating', 'date each other', 'in relationship'
  ];
  return datingPhrases.some(p => text.includes(p));
}

/** Check if the last N messages suggest "we're no longer dating". */
export function shouldAskIfEnded(messages: { content: string }[]): boolean {
  const text = messages.slice(-15).map(m => m.content).join(' ').toLowerCase();
  const endPhrases = [
    'we\'re done', 'we are done', 'break up', 'breaking up', 'no longer together',
    'not together', 'not dating', 'ended things', 'split up', 'we broke up',
    'not in a relationship', 'single again', 'back to single'
  ];
  return endPhrases.some(p => text.includes(p));
}

/** Set last check-in time (e.g. nightly). */
export async function setLastCheckIn(relationshipId: string): Promise<void> {
  const rows = await readRelationships();
  const r = rows.find(x => x.id === relationshipId);
  if (r) {
    r.lastCheckInAt = new Date().toISOString();
    await writeRelationships(rows);
  }
}
