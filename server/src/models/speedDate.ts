import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export interface SpeedDateSchedule {
  day1Type: 'chat' | 'video';
  day2Type: 'chat' | 'video';
  day1Time?: string; // ISO or "18:00"
  day2Time?: string;
}

export interface SpeedDate {
  id: string;
  user1Id: string;
  user2Id: string;
  startAt: string;
  endAt: string; // start + 4 or 5 days
  schedule: SpeedDateSchedule;
  user1Continue?: boolean | null;
  user2Continue?: boolean | null;
  user1AnsweredAt?: string | null;
  user2AnsweredAt?: string | null;
  status: 'active' | 'continued' | 'ended_no';
  createdAt: string;
}

const SPEED_DATES_PATH = join(process.cwd(), 'server', 'data', 'speed-dates.json');
const SPEED_DAYS = 5;

async function readSpeedDates(): Promise<SpeedDate[]> {
  try {
    const data = await readFile(SPEED_DATES_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeSpeedDates(list: SpeedDate[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(SPEED_DATES_PATH, JSON.stringify(list, null, 2));
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function createSpeedDate(
  user1Id: string,
  user2Id: string,
  schedule: SpeedDateSchedule
): Promise<SpeedDate> {
  const list = await readSpeedDates();
  const startAt = new Date().toISOString();
  const endAt = addDays(startAt, SPEED_DAYS);
  const sd: SpeedDate = {
    id: Date.now().toString(),
    user1Id,
    user2Id,
    startAt,
    endAt,
    schedule,
    status: 'active',
    createdAt: startAt,
  };
  list.push(sd);
  await writeSpeedDates(list);
  return sd;
}

export async function getActiveSpeedDateForUser(userId: string): Promise<SpeedDate | null> {
  const list = await readSpeedDates();
  const now = new Date().toISOString();
  return list.find(
    s =>
      (s.user1Id === userId || s.user2Id === userId) &&
      s.status === 'active' &&
      s.endAt > now
  ) || null;
}

export async function getSpeedDateById(id: string): Promise<SpeedDate | null> {
  const list = await readSpeedDates();
  return list.find(s => s.id === id) || null;
}

export async function setContinueAnswer(
  speedDateId: string,
  userId: string,
  continueTalking: boolean
): Promise<{ speedDate: SpeedDate; otherAnswered?: boolean; otherWantsContinue?: boolean }> {
  const list = await readSpeedDates();
  const sd = list.find(s => s.id === speedDateId && (s.user1Id === userId || s.user2Id === userId));
  if (!sd) throw new Error('Speed date not found');
  const isUser1 = sd.user1Id === userId;
  const now = new Date().toISOString();
  if (isUser1) {
    sd.user1Continue = continueTalking;
    sd.user1AnsweredAt = now;
  } else {
    sd.user2Continue = continueTalking;
    sd.user2AnsweredAt = now;
  }
  const otherAnswered =
    (isUser1 && sd.user2AnsweredAt != null) || (!isUser1 && sd.user1AnsweredAt != null);
  const otherWantsContinue = isUser1 ? sd.user2Continue : sd.user1Continue;

  if (sd.user1AnsweredAt && sd.user2AnsweredAt) {
    if (sd.user1Continue && sd.user2Continue) {
      sd.status = 'continued';
    } else {
      sd.status = 'ended_no';
    }
  }
  await writeSpeedDates(list);
  return {
    speedDate: sd,
    otherAnswered,
    otherWantsContinue: otherWantsContinue ?? undefined,
  };
}

export const UPLIFTING_MESSAGES = [
  "It's okay — there's always next time.",
  "Your person is out there. Keep being you!",
  "Rejection is just redirection. Better things are coming.",
  "Not every connection is meant to last. That's okay.",
  "You're one step closer to the right match.",
  "Their loss! You're amazing.",
  "Stay positive. The right one will stick around.",
  "It's their journey too. Wishing them well.",
  "No worries — more fish in the sea!",
  "You deserve someone who chooses you back.",
  "Everything happens for a reason.",
  "On to the next chapter!",
  "Your vibe will attract your tribe.",
  "Keep your head up. Great things are ahead.",
  "Sometimes it's just not a fit. That's life.",
  "You're too good to stress over one no.",
  "The right person will say yes.",
  "Sending you good vibes. You've got this!",
  "One door closed, another will open.",
  "Take it in stride. You're doing great.",
  "Not meant to be — and that's fine.",
  "Stay confident. You're a catch!",
  "Better to know now than later.",
  "Your perfect match is still out there.",
  "Keep moving forward. You're doing awesome.",
  "It's okay to feel a little bummed. Then move on!",
  "Honesty is better than false hope.",
  "You'll find your person. Believe it.",
  "This wasn't your person. Next!",
  "Sending you a virtual hug. You're going to be okay.",
];
