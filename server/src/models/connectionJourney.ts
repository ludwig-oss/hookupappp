import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { pickRandomStepIds, CONNECTION_JOURNEY_MIX_VERSION } from '../data/connectionJourneySteps.js';

export type ConnectionHostMode = 'offer' | 'their_turn' | 'host_asks' | 'quiet';

export interface ConnectionJourneyRecord {
  id: string;
  userId1: string;
  userId2: string;
  startedAt: string;
  assignedStepIds: string[];
  completedStepIds: string[];
  createdAt: string;
  saidHiUserIds?: string[];
  hostMode?: ConnectionHostMode;
  hostMuted?: boolean;
  mixVersion?: number;
}

const DB_PATH = join(process.cwd(), 'server', 'data', 'connectionJourneys.json');

function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function readJourneys(): Promise<ConnectionJourneyRecord[]> {
  try {
    const data = await readFile(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeJourneys(rows: ConnectionJourneyRecord[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then((fs) => fs.mkdir(dir, { recursive: true }));
  await writeFile(DB_PATH, JSON.stringify(rows, null, 2));
}

function migrateJourney(journey: ConnectionJourneyRecord): boolean {
  let changed = false;
  if (!journey.assignedStepIds || journey.assignedStepIds.length === 0) {
    journey.assignedStepIds = pickRandomStepIds(7);
    changed = true;
  }
  if (!journey.saidHiUserIds) {
    journey.saidHiUserIds = [];
    changed = true;
  }
  if (!journey.hostMode) {
    journey.hostMode = (journey.completedStepIds?.length || 0) > 0 ? 'quiet' : 'offer';
    changed = true;
  }
  if (journey.mixVersion !== CONNECTION_JOURNEY_MIX_VERSION) {
    const completed = (journey.completedStepIds || []).filter(Boolean);
    const need = Math.max(0, 7 - completed.length);
    const rest = pickRandomStepIds(Math.max(need, 7)).filter((id) => !completed.includes(id)).slice(0, need);
    journey.assignedStepIds = [...completed, ...rest];
    journey.mixVersion = CONNECTION_JOURNEY_MIX_VERSION;
    if (completed.length === 0 && (journey.hostMode === 'host_asks' || journey.hostMode === 'offer')) {
      journey.hostMode = 'quiet';
    }
    changed = true;
  }
  return changed;
}

/** Get journey for a user with a specific partner (if any). Migrates old records to assignedStepIds. */
export async function getJourney(userId: string, partnerUserId: string): Promise<ConnectionJourneyRecord | null> {
  const [u1, u2] = normalizePair(userId, partnerUserId);
  const rows = await readJourneys();
  const journey = rows.find((j) => j.userId1 === u1 && j.userId2 === u2) ?? null;
  if (journey && migrateJourney(journey)) {
    await writeJourneys(rows);
  }
  return journey;
}

/** Start a new journey with partner. Assigns 7 random steps so each pair gets a different mix. Idempotent. */
export async function startJourney(userId: string, partnerUserId: string): Promise<ConnectionJourneyRecord> {
  const [u1, u2] = normalizePair(userId, partnerUserId);
  const rows = await readJourneys();
  let journey = rows.find((j) => j.userId1 === u1 && j.userId2 === u2);
  if (journey) return journey;
  const now = new Date().toISOString();
  const assignedStepIds = pickRandomStepIds(7);
  journey = {
    id: `cj-${Date.now()}-${u1.slice(0, 4)}-${u2.slice(0, 4)}`,
    userId1: u1,
    userId2: u2,
    startedAt: now,
    assignedStepIds,
    completedStepIds: [],
    createdAt: now,
    saidHiUserIds: [],
    hostMode: 'offer',
    mixVersion: CONNECTION_JOURNEY_MIX_VERSION,
  };
  rows.push(journey);
  await writeJourneys(rows);
  return journey;
}

/** Mark a step as completed. Only steps in this journey's assignedStepIds count. */
export async function completeStep(
  userId: string,
  partnerUserId: string,
  stepId: string
): Promise<ConnectionJourneyRecord | null> {
  const [u1, u2] = normalizePair(userId, partnerUserId);
  const rows = await readJourneys();
  const journey = rows.find((j) => j.userId1 === u1 && j.userId2 === u2);
  if (!journey) return null;
  const assigned = journey.assignedStepIds ?? [];
  if (!assigned.includes(stepId)) return journey; // not in this journey's list, ignore
  if (!journey.completedStepIds.includes(stepId)) {
    journey.completedStepIds.push(stepId);
    journey.hostMode = 'quiet';
    await writeJourneys(rows);
  }
  return journey;
}

export async function recordSaidHi(userId: string, partnerUserId: string): Promise<ConnectionJourneyRecord | null> {
  const [u1, u2] = normalizePair(userId, partnerUserId);
  const rows = await readJourneys();
  const journey = rows.find((j) => j.userId1 === u1 && j.userId2 === u2);
  if (!journey) return null;
  migrateJourney(journey);
  const said = journey.saidHiUserIds ?? [];
  if (!said.includes(userId)) {
    said.push(userId);
    journey.saidHiUserIds = said;
  }
  if (said.length >= 2 && (journey.hostMode === 'offer' || !journey.hostMode)) {
    journey.hostMode = 'quiet';
  }
  await writeJourneys(rows);
  return journey;
}

export async function setHostMode(
  userId: string,
  partnerUserId: string,
  hostMode: ConnectionHostMode
): Promise<ConnectionJourneyRecord | null> {
  const [u1, u2] = normalizePair(userId, partnerUserId);
  const rows = await readJourneys();
  const journey = rows.find((j) => j.userId1 === u1 && j.userId2 === u2);
  if (!journey) return null;
  migrateJourney(journey);
  journey.hostMode = hostMode;
  await writeJourneys(rows);
  return journey;
}

export async function setHostMuted(
  userId: string,
  partnerUserId: string,
  muted: boolean
): Promise<ConnectionJourneyRecord | null> {
  const [u1, u2] = normalizePair(userId, partnerUserId);
  const rows = await readJourneys();
  const journey = rows.find((j) => j.userId1 === u1 && j.userId2 === u2);
  if (!journey) return null;
  migrateJourney(journey);
  journey.hostMuted = muted;
  if (muted) journey.hostMode = 'quiet';
  await writeJourneys(rows);
  return journey;
}

export async function syncSaidHiFromMessages(
  userId: string,
  partnerUserId: string,
  participantIds: string[]
): Promise<ConnectionJourneyRecord | null> {
  const [u1, u2] = normalizePair(userId, partnerUserId);
  const rows = await readJourneys();
  const journey = rows.find((j) => j.userId1 === u1 && j.userId2 === u2);
  if (!journey) return null;
  migrateJourney(journey);
  const said = new Set(journey.saidHiUserIds ?? []);
  let changed = false;
  for (const id of participantIds) {
    if ((id === u1 || id === u2) && !said.has(id)) {
      said.add(id);
      changed = true;
    }
  }
  if (changed) {
    journey.saidHiUserIds = Array.from(said);
    if (said.size >= 2 && (journey.hostMode === 'offer' || !journey.hostMode)) {
      journey.hostMode = 'quiet';
    }
    await writeJourneys(rows);
  }
  return journey;
}
