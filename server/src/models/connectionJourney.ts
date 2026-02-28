import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { pickRandomStepIds } from '../data/connectionJourneySteps.js';

export interface ConnectionJourneyRecord {
  id: string;
  userId1: string;
  userId2: string;
  startedAt: string;
  /** 7 random step IDs assigned to this journey (different per pair) */
  assignedStepIds: string[];
  completedStepIds: string[];
  createdAt: string;
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

/** Get journey for a user with a specific partner (if any). Migrates old records to assignedStepIds. */
export async function getJourney(userId: string, partnerUserId: string): Promise<ConnectionJourneyRecord | null> {
  const [u1, u2] = normalizePair(userId, partnerUserId);
  const rows = await readJourneys();
  const journey = rows.find((j) => j.userId1 === u1 && j.userId2 === u2) ?? null;
  if (journey && (!journey.assignedStepIds || journey.assignedStepIds.length === 0)) {
    journey.assignedStepIds = pickRandomStepIds(7);
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
    await writeJourneys(rows);
  }
  return journey;
}
