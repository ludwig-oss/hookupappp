import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getAllGuides, getGuideByUserId, getGuideById, matchesGeoFilter } from './improvement.js';
import { creditGuideSessionPayment } from './guideWallet.js';
import { getHoldByRequestId } from './paypalHolds.js';
import { createReport } from './reports.js';
import { checkConfessionContent, SEEKER_SAFETY_AGREEMENT, GUIDE_NDA_AGREEMENT, AI_SEEKER_TERMS } from '../utils/confessionSafety.js';
import { getGuide } from '../data/aiGuideCatalog.js';

export type ConfessionSessionStatus =
  | 'pending_appointment'
  | 'awaiting_payment'
  | 'seeking_guide'
  | 'pending_guide_nda'
  | 'active'
  | 'ended'
  | 'reported';

export type ConfessionGuideScope = 'local' | 'international';
export type ConfessionKind = 'human' | 'ai';

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
  kind: ConfessionKind;
  aiGuideId: string | null;
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
  voiceCall?: ConfessionVoiceCall | null;
}

export interface ConfessionVoiceCall {
  callerRole: 'seeker' | 'guide' | null;
  offer: { type: 'offer' | 'answer'; sdp: string } | null;
  answer: { type: 'offer' | 'answer'; sdp: string } | null;
  ice: Array<{ id: string; fromRole: 'seeker' | 'guide'; candidate: string }>;
  updatedAt: string | null;
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

export { SEEKER_SAFETY_AGREEMENT, GUIDE_NDA_AGREEMENT, AI_SEEKER_TERMS };

/** AI helpers offered first for private confession support. */
export const CONFESSION_AI_GUIDE_IDS = ['priya', 'amara', 'marcus', 'diego', 'sofia', 'elena', 'kenji', 'mei'] as const;

export function listConfessionAiGuides() {
  return CONFESSION_AI_GUIDE_IDS.map((id) => {
    const g = getGuide(id);
    if (!g) return null;
    return {
      id: g.id,
      name: g.name,
      specialty: g.specialty,
      tagline: g.tagline,
      portrait: g.portrait,
      personality: g.personality,
    };
  }).filter(Boolean);
}

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
    kind: 'human',
    aiGuideId: null,
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

export async function createAiConfessionSession(params: {
  seekerUserId: string;
  amountEur: 5 | 10;
  safetySignature: string;
  aiGuideId: string;
}): Promise<ConfessionSession> {
  const guide = getGuide(params.aiGuideId);
  if (!guide || !(CONFESSION_AI_GUIDE_IDS as readonly string[]).includes(params.aiGuideId)) {
    throw new Error('Choose an AI confession helper');
  }

  const sessions = await readSessions();
  const active = sessions.find(
    (s) =>
      s.seekerUserId === params.seekerUserId &&
      ['pending_appointment', 'awaiting_payment', 'seeking_guide', 'pending_guide_nda', 'active'].includes(s.status)
  );
  if (active) throw new Error('You already have an open confession session');

  const first = guide.name.split(' ')[0];
  const session: ConfessionSession = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
    kind: 'ai',
    aiGuideId: guide.id,
    seekerUserId: params.seekerUserId,
    guideUserId: null,
    selectedGuideId: null,
    guideScope: null,
    guideDisplayLabel: `${first} · AI helper`,
    appointmentAt: null,
    appointmentStatus: 'accepted',
    seekerAlias: randomAlias('Seeker'),
    guideAlias: `AI-${first}`,
    amountEur: params.amountEur,
    paymentStatus: 'pending',
    status: 'awaiting_payment',
    seekerSafetyAcceptedAt: new Date().toISOString(),
    seekerSignature: params.safetySignature.trim(),
    guideNdaSignedAt: new Date().toISOString(),
    guideNdaSignature: 'AI-SYSTEM',
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

  if (s.kind === 'ai' || s.aiGuideId) {
    s.kind = 'ai';
    s.status = 'active';
    s.startedAt = new Date().toISOString();
    const ai = s.aiGuideId ? getGuide(s.aiGuideId) : null;
    const first = ai?.name.split(' ')[0] || 'Helper';
    s.messages.push({
      id: Date.now().toString(),
      fromRole: 'guide',
      alias: s.guideAlias || `AI-${first}`,
      content: `Peace. I am ${first}, your private AI helper. This booth is anonymous — I will not ask who you are. Share what weighs on you. Crimes and intent to harm are forbidden here. I am here for private personal matters only.`,
      createdAt: new Date().toISOString(),
    });
    await writeSessions(sessions);
    return s;
  }

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
  if (session.kind === 'ai' || !session.guideUserId) return;
  const alreadyHeld = await getHoldByRequestId(session.id);
  if (alreadyHeld) return;
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

function participantRole(session: ConfessionSession, userId: string): 'seeker' | 'guide' {
  if (session.seekerUserId === userId) return 'seeker';
  if (session.guideUserId === userId) return 'guide';
  throw new Error('Not part of this session');
}

function emptyVoiceCall(): ConfessionVoiceCall {
  return { callerRole: null, offer: null, answer: null, ice: [], updatedAt: null };
}

export function getVoiceCallForClient(session: ConfessionSession, userId: string) {
  const role = participantRole(session, userId);
  const call = session.voiceCall || emptyVoiceCall();
  const incoming = Boolean(call.offer && call.callerRole && call.callerRole !== role && !call.answer);
  return {
    callerRole: call.callerRole,
    offer: call.offer,
    answer: call.answer,
    ice: call.ice,
    incoming,
    active: Boolean(call.offer),
  };
}

export async function setVoiceCallOffer(
  sessionId: string,
  userId: string,
  offer: { type: 'offer'; sdp: string }
): Promise<ConfessionSession> {
  const sessions = await readSessions();
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error('Session not found');
  if (s.status !== 'active') throw new Error('Session is not active');
  const role = participantRole(s, userId);
  s.voiceCall = {
    callerRole: role,
    offer,
    answer: null,
    ice: [],
    updatedAt: new Date().toISOString(),
  };
  await writeSessions(sessions);
  return s;
}

export async function setVoiceCallAnswer(
  sessionId: string,
  userId: string,
  answer: { type: 'answer'; sdp: string }
): Promise<ConfessionSession> {
  const sessions = await readSessions();
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error('Session not found');
  if (s.status !== 'active') throw new Error('Session is not active');
  const role = participantRole(s, userId);
  if (!s.voiceCall?.offer) throw new Error('No incoming call');
  if (s.voiceCall.callerRole === role) throw new Error('Caller cannot answer their own call');
  s.voiceCall.answer = answer;
  s.voiceCall.updatedAt = new Date().toISOString();
  await writeSessions(sessions);
  return s;
}

export async function addVoiceCallIce(
  sessionId: string,
  userId: string,
  candidate: string
): Promise<ConfessionSession> {
  const sessions = await readSessions();
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error('Session not found');
  if (s.status !== 'active') throw new Error('Session is not active');
  const role = participantRole(s, userId);
  if (!s.voiceCall) s.voiceCall = emptyVoiceCall();
  s.voiceCall.ice = [...(s.voiceCall.ice || []), {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
    fromRole: role,
    candidate,
  }].slice(-48);
  s.voiceCall.updatedAt = new Date().toISOString();
  await writeSessions(sessions);
  return s;
}

export async function hangupVoiceCall(sessionId: string, userId: string): Promise<ConfessionSession> {
  const sessions = await readSessions();
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error('Session not found');
  participantRole(s, userId);
  s.voiceCall = emptyVoiceCall();
  await writeSessions(sessions);
  return s;
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
  const isAiSession = s.kind === 'ai' || Boolean(s.aiGuideId);
  if (!isSeeker && !isGuide) throw new Error('Not part of this session');
  if (isAiSession && !isSeeker) throw new Error('AI booth is seeker-only');

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

  if (isAiSession && isSeeker) {
    const reply = await craftAiConfessionReply(s, content.trim());
    s.messages.push({
      id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
      fromRole: 'guide',
      alias: s.guideAlias || 'AI Helper',
      content: reply,
      createdAt: new Date().toISOString(),
    });
  }

  await writeSessions(sessions);
  return { session: s, message: msg };
}

async function craftAiConfessionReply(session: ConfessionSession, seekerText: string): Promise<string> {
  const ai = session.aiGuideId ? getGuide(session.aiGuideId) : null;
  const first = ai?.name.split(' ')[0] || 'Helper';
  const q = seekerText.toLowerCase();

  let line =
    `I hear you. Thank you for trusting this private booth. ${ai?.thinking || 'We will take this one step at a time.'} What feels heaviest right now — and what would "a little better" look like tonight?`;

  if (/\b(guilt|ashamed|shame)\b/.test(q)) {
    line = `Guilt is heavy, but it is not the same as being unforgivable. Name one thing you can repair today without punishing yourself. I am listening.`;
  } else if (/\b(lonely|alone|nobody)\b/.test(q)) {
    line = `Loneliness is real. You do not have to fix your whole life tonight. Who is one safe person or place you could reach this week — even with a short message?`;
  } else if (/\b(jealous|cheat|betray)\b/.test(q)) {
    line = `Betrayal and jealousy need clarity, not spiral. What do you know for sure, and what are you only afraid of? We can separate those.`;
  } else if (/\b(break.?up|left me|dumped)\b/.test(q)) {
    line = `Loss hurts. Grief is not weakness. What is one boundary that protects your healing for the next 48 hours?`;
  } else if (/\b(anxious|panic|overthink)\b/.test(q)) {
    line = `When the mind races, shrink the window: breathe, then one true sentence about what is happening — not what might happen. Say that sentence here.`;
  }

  const key = process.env.OPENAI_API_KEY;
  if (key) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_CONFESSION_MODEL || 'gpt-4o-mini',
          temperature: 0.5,
          messages: [
            {
              role: 'system',
              content: `You are ${first}, an anonymous AI confession helper in a dating app booth. Personality: ${ai?.personality || 'warm and direct'}. Rules: never ask for identity; never help with crimes or harm; redirect crisis to emergency services; keep replies under 90 words; private emotional support only.`,
            },
            { role: 'user', content: seekerText.slice(0, 1200) },
          ],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) line = text;
      }
    } catch {
      /* keep rule reply */
    }
  }
  return line;
}

export async function endConfessionSession(sessionId: string, userId: string): Promise<ConfessionSession> {
  const sessions = await readSessions();
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error('Session not found');
  if (s.seekerUserId !== userId && s.guideUserId !== userId) throw new Error('Not part of this session');
  s.status = 'ended';
  s.endedAt = new Date().toISOString();
  s.voiceCall = emptyVoiceCall();
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
    kind: session.kind || (session.aiGuideId ? 'ai' : 'human'),
    aiGuideId: session.aiGuideId || null,
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
    paymentDestination: session.kind === 'ai' || session.aiGuideId ? 'app' : 'guide_split',
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
    voiceCall: session.voiceCall
      ? {
          callerRole: session.voiceCall.callerRole,
          incoming: Boolean(
            session.voiceCall.offer &&
              session.voiceCall.callerRole &&
              session.voiceCall.callerRole !== role &&
              !session.voiceCall.answer
          ),
          active: Boolean(session.voiceCall.offer),
        }
      : { callerRole: null, incoming: false, active: false },
  };
}
