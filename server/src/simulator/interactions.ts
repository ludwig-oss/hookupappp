import { isSimulatorEnabled, isSimulatorUserId, getSimulatorUsers } from './runtime.js';
import { getAllUsers, getUserById } from '../models/user.js';
import { sendInterest } from '../models/activity.js';
import { createMessage, getConversation } from '../models/chat.js';
import { createBuzz } from '../models/connections.js';
import { getUserPreference } from '../models/discover.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const OPENERS = [
  'Hey! Simulator hello from {city} 👋',
  'Hi — testing Connections. How’s your week?',
  'Saw you on the app. Wanted to say hi from {city}.',
  'Random hello! What’s something fun in your city?',
  'Mock user checking in — hope you’re having a good day.',
  'Hey there. Coffee chat energy? (test message)',
  'Hi! Liked your vibe. What’s one hobby you’d try?',
];

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
const interactedPairs = new Set<string>();

function pairKey(a: string, b: string) {
  return `${a}->${b}`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function realTargets(): Promise<string[]> {
  const all = await getAllUsers();
  return all
    .filter((u) => !isSimulatorUserId(u.id) && u.profileSetupComplete !== false)
    .map((u) => u.id);
}

async function interactOnce(): Promise<void> {
  if (!isSimulatorEnabled() || running) return;
  running = true;
  try {
    const targets = await realTargets();
    if (!targets.length) return;
    const mocks = getSimulatorUsers().filter((m) => m.location);
    if (!mocks.length) return;

    const targetId = pick(targets);
    const target = await getUserById(targetId);
    if (!target) return;
    const targetPref = await getUserPreference(targetId);

    // Prefer mocks whose orientation is compatible-ish with the viewer
    let pool = mocks;
    if (targetPref?.orientation === 'straight' && (target.gender || '').toLowerCase().startsWith('m')) {
      pool = mocks.filter((m) => (m.gender || '').toLowerCase().startsWith('f'));
    } else if (targetPref?.orientation === 'straight' && (target.gender || '').toLowerCase().startsWith('f')) {
      pool = mocks.filter((m) => (m.gender || '').toLowerCase().startsWith('m'));
    }
    if (!pool.length) pool = mocks;

    const actors = [...pool].sort(() => Math.random() - 0.5).slice(0, 3 + Math.floor(Math.random() * 3));
    const { splitUsersForWrite } = await import('./runtime.js');

    for (const rawActor of actors) {
      const actor = { ...rawActor, location: rawActor.location ? { ...rawActor.location } : null };
      // Pull a few mocks near the real user so Nearby / buzz / venues feel alive
      if (target.location && actor.location && Math.random() < 0.7) {
        actor.location = {
          lat: target.location.lat + (Math.random() - 0.5) * 0.02,
          lon: target.location.lon + (Math.random() - 0.5) * 0.02,
          updatedAt: new Date(),
        };
        actor.city = target.city || actor.city;
        actor.country = target.country || actor.country;
        splitUsersForWrite([actor]);
      }

      const key = pairKey(actor.id, targetId);
      if (interactedPairs.has(key)) continue;
      interactedPairs.add(key);

      try {
        await sendInterest(actor.id, targetId);
      } catch {
        /* already sent / connected */
      }

      try {
        const existing = await getConversation(actor.id, targetId);
        if (existing.length === 0) {
          const line = pick(OPENERS).replace('{city}', actor.city || 'my city');
          await createMessage({ fromUserId: actor.id, toUserId: targetId, content: line });
        } else if (Math.random() < 0.45) {
          await createMessage({
            fromUserId: actor.id,
            toUserId: targetId,
            content: pick([
              'Just bumping this — still around if you want to chat.',
              'Hope the app’s treating you well today.',
              'Quick follow-up from the simulator crew 👋',
            ]),
          });
        }
      } catch {
        /* ignore */
      }

      if (actor.location && Math.random() < 0.55) {
        try {
          await createBuzz({
            fromUserId: actor.id,
            toUserId: targetId,
            location: {
              lat: actor.location.lat,
              lon: actor.location.lon,
              venue: `${actor.city || 'Nearby'} · simulator`,
              venueType: 'cafe',
            },
          });
        } catch {
          /* ignore */
        }
      }
    }
  } finally {
    running = false;
  }
}

/** Purge simulator-originated interests / messages / buzzes from JSON stores. */
export async function purgeSimulatorInteractions(): Promise<void> {
  const dataDir = join(process.cwd(), 'server', 'data');
  await mkdir(dataDir, { recursive: true });

  async function filterFile(name: string, keep: (row: any) => boolean) {
    const path = join(dataDir, name);
    try {
      const raw = JSON.parse(await readFile(path, 'utf-8'));
      if (!Array.isArray(raw)) return;
      const next = raw.filter(keep);
      if (next.length !== raw.length) {
        await writeFile(path, JSON.stringify(next, null, 2));
        console.log(`🧪 Purged ${raw.length - next.length} simulator rows from ${name}`);
      }
    } catch {
      /* missing file ok */
    }
  }

  const notFromSim = (row: any) =>
    !isSimulatorUserId(row.fromUserId) && !isSimulatorUserId(row.toUserId) && !isSimulatorUserId(row.userId);

  // Keep rows that involve only real users; drop any with a sim id
  await filterFile('interests.json', (row) => !isSimulatorUserId(row.fromUserId) && !isSimulatorUserId(row.toUserId));
  await filterFile('messages.json', (row) => !isSimulatorUserId(row.fromUserId) && !isSimulatorUserId(row.toUserId));
  await filterFile('buzzes.json', (row) => !isSimulatorUserId(row.fromUserId) && !isSimulatorUserId(row.toUserId));
  await filterFile('activity-interests.json', (row) => !isSimulatorUserId(row.fromUserId) && !isSimulatorUserId(row.toUserId));
  void notFromSim;
}

export function startSimulatorInteractions(): void {
  if (!isSimulatorEnabled()) return;
  if (timer) return;
  console.log('🧪 Simulator interactions ON — mocks will send interest, messages, buzzes to real accounts.');
  void interactOnce();
  timer = setInterval(() => {
    void interactOnce();
  }, 55_000);
}

export function stopSimulatorInteractions(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  interactedPairs.clear();
}
