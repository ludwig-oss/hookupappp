import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getAllGuides, getGuideByUserId, getGuideById, matchesGeoFilter } from './improvement.js';
import { creditGuideSessionPayment } from './guideWallet.js';
import { createReport } from './reports.js';
import { checkConfessionContent, SEEKER_SAFETY_AGREEMENT, GUIDE_NDA_AGREEMENT } from '../utils/confessionSafety.js';

export type ConfessionSessionStatus =
  | 'pending_appointment'
  | 'awaiting_payment'
  | 'seeking_guide'
  | 'pending_guide_nda'
  | 'active'
  | 'ended'
  | 'reported';

export type ConfessionGuideScope = 'local' | 'international';

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
  selectedGuideId: string | null;
  guideScope: ConfessionGuideScope | null;
  guideDisplayLabel: string | null;
  appointmentAt: string | null;
  appointmentStatus: 'pending' | 'accepted' | 'declined' | null;
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

export interface BlurredConfessionGuide {
  id: string;
  label: string;
  rating: number;
  totalSessions: number;
  experienceSnippet: string;
  scope: ConfessionGuideScope;
}

function isGlobalGuideRegion(region: string | undefined | null): boolean {
  const g = (region || '').trim().toLowerCase();
  return !g || g === 'global' || g === 'international' || g === 'worldwide';
}

async function getConfessionEnabledGuideUserIds(): Promise<Set<string>> {
  const prefs = await readPrefs();
  return new Set(prefs.filter((p) => p.enabled && p.ndaSignedAt).map((p) => p.userId));
}

export async function listBlurredConfessionGuides(
  seekerUserId: string,
  scope: ConfessionGuideScope
): Promise<BlurredConfessionGuide[]> {
  const { getUserById } = await import('./user.js');
  const seeker = await getUserById(seekerUserId);
  const enabledIds = await getConfessionEnabledGuideUserIds();
  const guides = (await getAllGuides()).filter((g) => enabledIds.has(g.userId) && g.userId !== seekerUserId);

  const filtered = guides.filter((g) => {
    const localMatch = matchesGeoFilter(g.region, seeker?.country, seeker?.city);
    if (scope === 'local') return localMatch && !isGlobalGuideRegion(g.region);
    return isGlobalGuideRegion(g.region) || !localMatch;
  });

  const labels = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');
  return filtered.map((g, i) => ({
    id: g.id,
    label: `Anonymous Guide ${labels[i] || i + 1}`,
    rating: Math.round(g.rating * 10) / 10,
    totalSessions: g.totalSessions,
    experienceSnippet:
      (g.experience || 'Confidential listener').length > 72
        ? `${(g.experience || 'Confidential listener').slice(0, 72).trim()}…`
        : g.experience || 'Confidential listener',
    scope,
  }));
}

export async function createConfessionSession(params: {
  seekerUserId: string;
  amountEur: 5 | 10;
  safetySignature: string;
  guideId: string;
  appointmentAt: string;
  guideScope: ConfessionGuideScope;
}): Promise<ConfessionSession> {
  const sessions = await readSessions();
  const active = sessions.find(
    (s) =>
      s.seekerUserId === params.seekerUserId &&
      ['pending_appointment', 'awaiting_payment', 'seeking_guide', 'pending_guide_nda', 'active'].includes(s.status)
  );
  if (active) throw new Error('You already have an open confession session');

  const guide = await getGuideById(params.guideId);
  if (!guide?.isActive) throw new Error('Guide not available');

  const enabledIds = await getConfessionEnabledGuideUserIds();
  if (!enabledIds.has(guide.userId)) throw new Error('This guide is not taking confession sessions right now');

  const appointmentAt = new Date(params.appointmentAt);
  if (Number.isNaN(appointmentAt.getTime())) throw new Error('Choose a valid date and time');
  if (appointmentAt.getTime() < Date.now() - 5 * 60 * 1000) {
    throw new Error('Appointment must be in the future');
  }

  const blurred = await listBlurredConfessionGuides(params.seekerUserId, params.guideScope);
  const label = blurred.find((b) => b.id === params.guideId)?.label || 'Anonymous Guide';

  const session: ConfessionSession = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
    seekerUserId: params.seekerUserId,
    guideUserId: guide.userId,
    selectedGuideId: guide.id,
    guideScope: params.guideScope,
    guideDisplayLabel: label,
    appointmentAt: appointmentAt.toISOString(),
    appointmentStatus: 'pending',
    seekerAlias: randomAlias('Seeker'),
    guideAlias: randomAlias('Guide'),
    amountEur: params.amountEur,
    paymentStatus: 'pending',
    status: 'pending_appointment',
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

export async function guideRespondAppointment(
  sessionId: string,
  guideUserId: string,
  accept: boolean
): Promise<ConfessionSession> {
  const sessions = await readSessions();
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error('Session not found');
  if (s.guideUserId !== guideUserId) throw new Error('Not assigned to this session');
  if (s.status !== 'pending_appointment') throw new Error('Session is not awaiting your response');

  if (!accept) {
    s.appointmentStatus = 'declined';
    s.status = 'ended';
    s.endedAt = new Date().toISOString();
    await writeSessions(sessions);
    return s;
  }

  s.appointmentStatus = 'accepted';
  s.status = 'awaiting_payment';
  await writeSessions(sessions);
  return s;
}

export async function markSessionPaid(sessionId: string, paypalOrderId?: string): Promise<ConfessionSession> {
  const sessions = await readSessions();
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error('Session not found');
  if (s.paymentStatus === 'paid') return s;
  if (s.status !== 'awaiting_payment') {
    throw new Error('Guide must accept your appointment before payment');
  }

  s.paymentStatus = 'paid';
  s.paidAt = new Date().toISOString();
  s.paypalOrderId = paypalOrderId || null;

  const prefs = await getGuidePrefs(s.guideUserId!);
  if (prefs.ndaSignedAt) {
    s.guideNdaSignedAt = prefs.ndaSignedAt;
    s.guideNdaSignature = prefs.ndaSignature;
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
    await creditConfessionPayment(s);
  } else {
    s.status = 'pending_guide_nda';
  }

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
  return sessions.filter(
    (s) =>
      s.guideUserId === guideUserId &&
      (s.status === 'pending_guide_nda' || s.status === 'pending_appointment')
  );
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
    guideDisplayLabel: session.guideDisplayLabel,
    guideScope: session.guideScope,
    appointmentAt: session.appointmentAt,
    appointmentStatus: session.appointmentStatus,
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
