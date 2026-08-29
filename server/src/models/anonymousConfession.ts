import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getAllGuides, getGuideByUserId } from './improvement.js';
import { creditGuideSessionPayment } from './guideWallet.js';
import { createReport } from './reports.js';
import { checkConfessionContent, SEEKER_SAFETY_AGREEMENT, GUIDE_NDA_AGREEMENT } from '../utils/confessionSafety.js';

export type ConfessionSessionStatus =
  | 'awaiting_payment'
  | 'seeking_guide'
  | 'pending_guide_nda'
  | 'active'
  | 'ended'
  | 'reported';

export interface ConfessionMessage {
  id: string;
  fromRole: 'seeker' | 'guide';
  alias: string;
  content: string;
  createdAt: string;
  blocked?: boolean;
}

export interface ConfessionSession {
  id: string;
  seekerUserId: string;
  guideUserId: string | null;
  seekerAlias: string;
  guideAlias: string | null;
  amountEur: 5 | 10;
  paymentStatus: 'pending' | 'paid';
  paypalOrderId?: string | null;
  status: ConfessionSessionStatus;
  seekerSafetyAcceptedAt: string | null;
  seekerSignature: string | null;
  guideNdaSignedAt: string | null;
  guideNdaSignature: string | null;
  messages: ConfessionMessage[];
  createdAt: string;
  paidAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

export interface ConfessionGuidePrefs {
  userId: string;
  enabled: boolean;
  ndaSignedAt: string | null;
  ndaSignature: string | null;
  updatedAt: string;
}

const SESSIONS_PATH = join(process.cwd(), 'server', 'data', 'confession-sessions.json');
const PREFS_PATH = join(process.cwd(), 'server', 'data', 'confession-guide-prefs.json');

function randomAlias(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function readSessions(): Promise<ConfessionSession[]> {
  try {
    return JSON.parse(await readFile(SESSIONS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeSessions(list: ConfessionSession[]): Promise<void> {
  await mkdir(join(process.cwd(), 'server', 'data'), { recursive: true });
  await writeFile(SESSIONS_PATH, JSON.stringify(list, null, 2));
}

async function readPrefs(): Promise<ConfessionGuidePrefs[]> {
  try {
    return JSON.parse(await readFile(PREFS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writePrefs(list: ConfessionGuidePrefs[]): Promise<void> {
  await mkdir(join(process.cwd(), 'server', 'data'), { recursive: true });
  await writeFile(PREFS_PATH, JSON.stringify(list, null, 2));
}

export { SEEKER_SAFETY_AGREEMENT, GUIDE_NDA_AGREEMENT };

export async function getGuidePrefs(userId: string): Promise<ConfessionGuidePrefs> {
  const list = await readPrefs();
  let p = list.find((x) => x.userId === userId);
  if (!p) {
    p = { userId, enabled: false, ndaSignedAt: null, ndaSignature: null, updatedAt: new Date().toISOString() };
  }
  return p;
}

export async function setGuideConfessionAvailability(
  userId: string,
  enabled: boolean,
  ndaSignature?: string
): Promise<ConfessionGuidePrefs> {
  const guide = await getGuideByUserId(userId);
  if (!guide?.isActive) throw new Error('Only approved guides can offer anonymous confession support');

  const list = await readPrefs();
  let p = list.find((x) => x.userId === userId);
  if (!p) {
    p = { userId, enabled: false, ndaSignedAt: null, ndaSignature: null, updatedAt: new Date().toISOString() };
    list.push(p);
  }

  if (enabled) {
    if (!ndaSignature?.trim() && !p.ndaSignedAt) {
      throw new Error('Sign the guide NDA before enabling anonymous confession sessions');
    }
    if (ndaSignature?.trim()) {
      p.ndaSignature = ndaSignature.trim();
      p.ndaSignedAt = new Date().toISOString();
    }
    p.enabled = true;
  } else {
    p.enabled = false;
  }
  p.updatedAt = new Date().toISOString();
  await writePrefs(list);
  return p;
}

export async function createConfessionSession(params: {
  seekerUserId: string;
  amountEur: 5 | 10;
  safetySignature: string;
}): Promise<ConfessionSession> {
  const sessions = await readSessions();
  const active = sessions.find(
    (s) =>
      s.seekerUserId === params.seekerUserId &&
      ['awaiting_payment', 'seeking_guide', 'pending_guide_nda', 'active'].includes(s.status)
  );
  if (active) throw new Error('You already have an open confession session');

  const session: ConfessionSession = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
    seekerUserId: params.seekerUserId,
    guideUserId: null,
    seekerAlias: randomAlias('Seeker'),
    guideAlias: null,
    amountEur: params.amountEur,
    paymentStatus: 'pending',
    status: 'awaiting_payment',
    seekerSafetyAcceptedAt: new Date().toISOString(),
    seekerSignature: params.safetySignature.trim(),
    guideNdaSignedAt: null,
    guideNdaSignature: null,
    messages: [],
    createdAt: new Date().toISOString(),
    paidAt: null,
    startedAt: null,
    endedAt: null,
  };
  sessions.unshift(session);
  await writeSessions(sessions);
  return session;
}

async function pickAvailableGuide(excludeUserId: string): Promise<string | null> {
  const prefs = await readPrefs();
  const enabledIds = new Set(prefs.filter((p) => p.enabled && p.ndaSignedAt).map((p) => p.userId));
  const guides = await getAllGuides();
  const candidates = guides.filter((g) => g.isActive && g.userId !== excludeUserId && enabledIds.has(g.userId));
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)].userId;
}

export async function markSessionPaid(sessionId: string, paypalOrderId?: string): Promise<ConfessionSession> {
  const sessions = await readSessions();
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error('Session not found');
  if (s.paymentStatus === 'paid') return s;

  s.paymentStatus = 'paid';
  s.paidAt = new Date().toISOString();
  s.paypalOrderId = paypalOrderId || null;
  s.status = 'seeking_guide';

  const guideUserId = await pickAvailableGuide(s.seekerUserId);
  if (!guideUserId) {
    s.status = 'seeking_guide';
    await writeSessions(sessions);
    return s;
  }

  s.guideUserId = guideUserId;
  s.guideAlias = randomAlias('Guide');
  s.status = 'pending_guide_nda';
  await writeSessions(sessions);
  return s;
}

export async function creditConfessionPayment(session: ConfessionSession): Promise<void> {
  if (!session.guideUserId) return;
  await creditGuideSessionPayment({
    guideUserId: session.guideUserId,
    grossEur: session.amountEur,
    requestId: session.id,
    paymentMethod: 'paypal',
  });
}

export async function guideAcceptSession(
  sessionId: string,
  guideUserId: string,
  ndaSignature: string
): Promise<ConfessionSession> {
  const sessions = await readSessions();
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error('Session not found');
  if (s.guideUserId !== guideUserId) throw new Error('Not assigned to this session');
  if (s.status !== 'pending_guide_nda') throw new Error('Session is not awaiting guide acceptance');

  s.guideNdaSignedAt = new Date().toISOString();
  s.guideNdaSignature = ndaSignature.trim();
  s.status = 'active';
  s.startedAt = new Date().toISOString();

  s.messages.push({
    id: Date.now().toString(),
    fromRole: 'guide',
    alias: s.guideAlias || 'Guide',
    content:
      'Peace be with you. This is a safe, anonymous space. I cannot see who you are, and you cannot see me. Share what weighs on you — I am here to listen and help. Remember: crimes and plans to harm anyone are not permitted here.',
    createdAt: new Date().toISOString(),
  });

  await writeSessions(sessions);
  return s;
}

export async function getSessionById(sessionId: string): Promise<ConfessionSession | null> {
  const sessions = await readSessions();
  return sessions.find((x) => x.id === sessionId) || null;
}

export async function getSessionsForUser(userId: string): Promise<ConfessionSession[]> {
  const sessions = await readSessions();
  return sessions.filter((s) => s.seekerUserId === userId || s.guideUserId === userId);
}

export async function getPendingGuideSessions(guideUserId: string): Promise<ConfessionSession[]> {
  const sessions = await readSessions();
  return sessions.filter((s) => s.guideUserId === guideUserId && s.status === 'pending_guide_nda');
}

export async function addConfessionMessage(
  sessionId: string,
  userId: string,
  content: string
): Promise<{ session: ConfessionSession; message: ConfessionMessage | null; blocked?: boolean; blockReason?: string }> {
  const sessions = await readSessions();
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error('Session not found');
  if (s.status !== 'active') throw new Error('Session is not active');

  const isSeeker = s.seekerUserId === userId;
  const isGuide = s.guideUserId === userId;
  if (!isSeeker && !isGuide) throw new Error('Not part of this session');

  const safety = checkConfessionContent(content);
  if (!safety.allowed) {
    if (safety.reportable && isSeeker) {
      s.status = 'reported';
      s.endedAt = new Date().toISOString();
      await createReport({
        reporterId: 'system-confession',
        reportedUserId: userId,
        category: 'violence',
        description: `Confession booth safety violation in session ${sessionId}: blocked content`,
      });
      await writeSessions(sessions);
    }
    return { session: s, message: null, blocked: true, blockReason: safety.reason };
  }

  const msg: ConfessionMessage = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 4),
    fromRole: isSeeker ? 'seeker' : 'guide',
    alias: isSeeker ? s.seekerAlias : s.guideAlias || 'Guide',
    content: content.trim(),
    createdAt: new Date().toISOString(),
  };
  s.messages.push(msg);
  await writeSessions(sessions);
  return { session: s, message: msg };
}

export async function endConfessionSession(sessionId: string, userId: string): Promise<ConfessionSession> {
  const sessions = await readSessions();
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error('Session not found');
  if (s.seekerUserId !== userId && s.guideUserId !== userId) throw new Error('Not part of this session');
  s.status = 'ended';
  s.endedAt = new Date().toISOString();
  await writeSessions(sessions);
  return s;
}

/** Assign guide to sessions waiting after payment when no guide was available. */
export async function retryGuideMatching(sessionId: string): Promise<ConfessionSession | null> {
  const sessions = await readSessions();
  const s = sessions.find((x) => x.id === sessionId);
  if (!s || s.paymentStatus !== 'paid' || s.guideUserId) return s || null;
  const guideUserId = await pickAvailableGuide(s.seekerUserId);
  if (!guideUserId) return s;
  s.guideUserId = guideUserId;
  s.guideAlias = randomAlias('Guide');
  s.status = 'pending_guide_nda';
  await writeSessions(sessions);
  return s;
}

export function sanitizeSessionForClient(session: ConfessionSession, viewerUserId: string): Record<string, unknown> {
  const role =
    session.seekerUserId === viewerUserId ? 'seeker' : session.guideUserId === viewerUserId ? 'guide' : null;
  return {
    id: session.id,
    role,
    seekerAlias: session.seekerAlias,
    guideAlias: session.guideAlias,
    amountEur: session.amountEur,
    paymentStatus: session.paymentStatus,
    status: session.status,
    messages: session.messages.map((m) => ({
      id: m.id,
      fromRole: m.fromRole,
      alias: m.alias,
      content: m.content,
      createdAt: m.createdAt,
      blocked: m.blocked,
    })),
    createdAt: session.createdAt,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
  };
}
