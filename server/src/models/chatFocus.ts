import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const FOCUS_DAYS = 5;

export interface FocusRecord {
  userId: string;
  focusedUserId: string;
  startedAt: string;
  endsAt: string;
}

const FOCUS_PATH = join(process.cwd(), 'server', 'data', 'chatFocus.json');

async function readFocus(): Promise<FocusRecord[]> {
  try {
    const data = await readFile(FOCUS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeFocus(records: FocusRecord[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(FOCUS_PATH, JSON.stringify(records, null, 2));
}

function isExpired(endsAt: string): boolean {
  return new Date(endsAt) <= new Date();
}

/** Get current active focus for a user (who they are committed to for 5 days). */
export async function getActiveFocus(userId: string): Promise<FocusRecord | null> {
  const records = await readFocus();
  const r = records.find(
    x => x.userId === userId && !isExpired(x.endsAt)
  );
  return r || null;
}

/** Start or switch focus to partnerUserId. Mutual: both users get focused on each other until endsAt. */
export async function setFocus(userId: string, partnerUserId: string): Promise<FocusRecord> {
  const records = await readFocus();
  const now = new Date();
  const endsAt = new Date(now.getTime() + FOCUS_DAYS * 24 * 60 * 60 * 1000);

  const newRecord: FocusRecord = {
    userId,
    focusedUserId: partnerUserId,
    startedAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
  };

  const mutualRecord: FocusRecord = {
    userId: partnerUserId,
    focusedUserId: userId,
    startedAt: newRecord.startedAt,
    endsAt: newRecord.endsAt,
  };

  // Remove any existing active focus for this user and for partner (so partner's focus on us is cleared if we're switching)
  const filtered = records.filter(
    x => (x.userId !== userId && x.userId !== partnerUserId) || isExpired(x.endsAt)
  );
  filtered.push(newRecord, mutualRecord);
  await writeFocus(filtered);
  return newRecord;
}

/** Clear focus when user explicitly ends it (after the 5 days they can "unlock"). */
export async function clearFocus(userId: string): Promise<void> {
  const records = await readFocus();
  const partner = records.find(x => x.userId === userId && !isExpired(x.endsAt));
  const filtered = records.filter(
    x => (x.userId !== userId && x.userId !== partner?.focusedUserId) || isExpired(x.endsAt)
  );
  await writeFocus(filtered);
}
