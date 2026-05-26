import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { mutualUnmatch } from './chatReplyDeadline.js';
import { getConversation } from './chat.js';

export const MEETUP_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface MatchMeetupRecord {
  userA: string;
  userB: string;
  connectedAt: string;
  metInPersonAt: string | null;
  deadlineAt: string;
}

const PATH = join(process.cwd(), 'server', 'data', 'match-meetup-deadlines.json');

function pairKey(a: string, b: string): string {
  return [a, b].sort().join(':');
}

async function readAll(): Promise<MatchMeetupRecord[]> {
  try {
    const data = await readFile(PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeAll(records: MatchMeetupRecord[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(PATH, JSON.stringify(records, null, 2));
}

export async function ensureMatchMeetupRecord(userA: string, userB: string): Promise<MatchMeetupRecord> {
  const records = await readAll();
  const key = pairKey(userA, userB);
  let record = records.find((r) => pairKey(r.userA, r.userB) === key);
  if (!record) {
    const connectedAt = new Date().toISOString();
    const sorted = [userA, userB].sort();
    record = {
      userA: sorted[0],
      userB: sorted[1],
      connectedAt,
      metInPersonAt: null,
      deadlineAt: new Date(Date.now() + MEETUP_WEEK_MS).toISOString(),
    };
    records.push(record);
    await writeAll(records);
  }
  return record;
}

export async function markMetInPerson(userA: string, userB: string): Promise<void> {
  const records = await readAll();
  const key = pairKey(userA, userB);
  const i = records.findIndex((r) => pairKey(r.userA, r.userB) === key);
  if (i === -1) {
    await ensureMatchMeetupRecord(userA, userB);
    return markMetInPerson(userA, userB);
  }
  records[i].metInPersonAt = new Date().toISOString();
  await writeAll(records);
}

export interface MeetupWeekStatus {
  active: boolean;
  connectedAt: string | null;
  deadlineAt: string | null;
  metInPerson: boolean;
  expired: boolean;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  ruleText: string;
}

export function statusFromRecord(viewerUserId: string, record: MatchMeetupRecord | null): MeetupWeekStatus {
  if (!record) {
    return {
      active: false,
      connectedAt: null,
      deadlineAt: null,
      metInPerson: false,
      expired: false,
      daysRemaining: null,
      hoursRemaining: null,
      ruleText:
        'After you match, plan to meet in person within 7 days at a public talk-friendly spot (parks, coffee to-go, plazas — not restaurants or movies).',
    };
  }

  if (record.metInPersonAt) {
    return {
      active: false,
      connectedAt: record.connectedAt,
      deadlineAt: record.deadlineAt,
      metInPerson: true,
      expired: false,
      daysRemaining: null,
      hoursRemaining: null,
      ruleText: 'You met in person — great. Keep staying safe in public.',
    };
  }

  const remainingMs = new Date(record.deadlineAt).getTime() - Date.now();
  const expired = remainingMs <= 0;
  const daysRemaining = expired ? 0 : Math.floor(remainingMs / (24 * 60 * 60 * 1000));
  const hoursRemaining = expired ? 0 : Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  let ruleText: string;
  if (expired) {
    ruleText =
      'The 7-day window to meet in person has passed. This match is ending unless you already met and checked in.';
  } else {
    ruleText = `Meet in person within ${daysRemaining}d ${hoursRemaining}h at an agreed public place (park, coffee to-go, plaza — somewhere you can talk). Each pays your own.`;
  }

  return {
    active: true,
    connectedAt: record.connectedAt,
    deadlineAt: record.deadlineAt,
    metInPerson: false,
    expired,
    daysRemaining,
    hoursRemaining,
    ruleText,
  };
}

export async function getMeetupWeekStatus(
  viewerUserId: string,
  otherUserId: string
): Promise<MeetupWeekStatus> {
  const messages = await getConversation(viewerUserId, otherUserId);
  if (!messages.length) {
    return statusFromRecord(viewerUserId, null);
  }
  const records = await readAll();
  const key = pairKey(viewerUserId, otherUserId);
  const record = records.find((r) => pairKey(r.userA, r.userB) === key) ?? null;
  if (!record) {
    const created = await ensureMatchMeetupRecord(viewerUserId, otherUserId);
    return statusFromRecord(viewerUserId, created);
  }
  return statusFromRecord(viewerUserId, record);
}

export async function enforceMeetupWeek(
  viewerUserId: string,
  otherUserId: string
): Promise<{ unmatched: boolean; reason?: string; status: MeetupWeekStatus }> {
  const messages = await getConversation(viewerUserId, otherUserId);
  if (!messages.length) {
    return { unmatched: false, status: statusFromRecord(viewerUserId, null) };
  }

  const record = await ensureMatchMeetupRecord(viewerUserId, otherUserId);
  const status = statusFromRecord(viewerUserId, record);

  if (!status.expired || record.metInPersonAt) {
    return { unmatched: false, status };
  }

  await mutualUnmatch(viewerUserId, otherUserId);
  return {
    unmatched: true,
    reason:
      'You did not meet in person within 7 days. This match has ended — plan a public meetup early to keep things real.',
    status,
  };
}
