import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import bcrypt from 'bcryptjs';
import { storeSensitive, readSensitiveAsDataUrl } from '../utils/sensitiveVault.js';
import type { MeetupPlan } from './safety.js';
import { readMeetupPlansFromDisk, updateMeetupPlanFields } from './safety.js';
import { getActiveRelationship, getPartnerId } from './relationship.js';
import { getUserById } from './user.js';
import { sendPushToUser } from '../realtime/push.js';

export type VoiceRecordingMode = 'date_safety' | 'relationship_gathering';
export type VoiceRecordingStatus =
  | 'pending_consent'
  | 'recording'
  | 'muted_sensitive'
  | 'completed'
  | 'expired'
  | 'partner_deleted';

export interface VoiceRecordingChunk {
  id: string;
  vaultRef: string;
  recordedAt: string;
  durationSec?: number;
  muted?: boolean;
}

export interface PoliceAccessRequest {
  id: string;
  recordingId: string;
  contactUserId: string;
  documentVaultRef: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string | null;
}

export interface VoiceRecordingSession {
  id: string;
  userId: string;
  partnerUserId?: string | null;
  meetupPlanId?: string | null;
  relationshipId?: string | null;
  mode: VoiceRecordingMode;
  status: VoiceRecordingStatus;
  /** User consent taps (need 3 before recording). */
  consentSteps: number;
  partnerConsentSteps?: number;
  userSignedAt?: string | null;
  partnerSignedAt?: string | null;
  emergencyContactUserId?: string | null;
  emergencyContactId?: string | null;
  chunks: VoiceRecordingChunk[];
  mutedSince?: string | null;
  lastSensitiveReminderAt?: string | null;
  sensitiveMoments?: number;
  homeReviewPending?: boolean;
  partnerApprovedDelete?: boolean;
  expiresAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  gatheringReason?: string | null;
  partnerNotifiedAt?: string | null;
  createdAt: string;
}

export interface RelationshipVoiceGuardSettings {
  relationshipId: string;
  enabled: boolean;
  user1ConsentSteps: number;
  user2ConsentSteps: number;
  user1SignedAt?: string | null;
  user2SignedAt?: string | null;
  updatedAt: string;
}

const SESSIONS_PATH = join(process.cwd(), 'server', 'data', 'voice-recording-sessions.json');
const POLICE_PATH = join(process.cwd(), 'server', 'data', 'voice-recording-police-requests.json');
const GUARD_PATH = join(process.cwd(), 'server', 'data', 'relationship-voice-guard.json');

/** Twitch-style VOD retention — auto-expire after 7 days. */
export const VOD_RETENTION_DAYS = 7;
const REQUIRED_CONSENT_STEPS = 3;

const GATHERING_PATTERN =
  /\b(party|parties|gathering|get[\s-]?together|club|nightlife|bar hopping|festival|concert|wedding reception|event tonight|going out tonight|house party)\b/i;

async function readSessions(): Promise<VoiceRecordingSession[]> {
  try {
    return JSON.parse(await readFile(SESSIONS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeSessions(list: VoiceRecordingSession[]): Promise<void> {
  await mkdir(join(process.cwd(), 'server', 'data'), { recursive: true });
  await writeFile(SESSIONS_PATH, JSON.stringify(list, null, 2));
}

async function readPoliceRequests(): Promise<PoliceAccessRequest[]> {
  try {
    return JSON.parse(await readFile(POLICE_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writePoliceRequests(list: PoliceAccessRequest[]): Promise<void> {
  await mkdir(join(process.cwd(), 'server', 'data'), { recursive: true });
  await writeFile(POLICE_PATH, JSON.stringify(list, null, 2));
}

async function readGuardSettings(): Promise<RelationshipVoiceGuardSettings[]> {
  try {
    return JSON.parse(await readFile(GUARD_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeGuardSettings(list: RelationshipVoiceGuardSettings[]): Promise<void> {
  await mkdir(join(process.cwd(), 'server', 'data'), { recursive: true });
  await writeFile(GUARD_PATH, JSON.stringify(list, null, 2));
}

export async function expireOldSessions(): Promise<void> {
  const list = await readSessions();
  const now = Date.now();
  let changed = false;
  for (const s of list) {
    if (s.status === 'expired' || s.status === 'partner_deleted') continue;
    if (new Date(s.expiresAt).getTime() <= now) {
      s.status = 'expired';
      changed = true;
    }
  }
  if (changed) await writeSessions(list);
}

function defaultExpiry(from = new Date()): string {
  return new Date(from.getTime() + VOD_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export async function getSessionById(id: string): Promise<VoiceRecordingSession | null> {
  await expireOldSessions();
  return (await readSessions()).find((s) => s.id === id) || null;
}

export async function getActiveDateRecording(planId: string, userId: string): Promise<VoiceRecordingSession | null> {
  await expireOldSessions();
  const list = await readSessions();
  return (
    list.find(
      (s) =>
        s.meetupPlanId === planId &&
        s.userId === userId &&
        s.mode === 'date_safety' &&
        (s.status === 'recording' || s.status === 'muted_sensitive' || s.status === 'pending_consent')
    ) || null
  );
}

export async function getActiveRelationshipRecording(userId: string): Promise<VoiceRecordingSession | null> {
  await expireOldSessions();
  const list = await readSessions();
  return (
    list.find(
      (s) =>
        s.userId === userId &&
        s.mode === 'relationship_gathering' &&
        (s.status === 'recording' || s.status === 'muted_sensitive' || s.status === 'pending_consent')
    ) || null
  );
}

export async function getPartnerLiveRecording(partnerUserId: string, listenerUserId: string): Promise<VoiceRecordingSession | null> {
  await expireOldSessions();
  const rel = await getActiveRelationship(listenerUserId);
  if (!rel || rel.status !== 'active' || getPartnerId(rel, listenerUserId) !== partnerUserId) return null;
  const guard = await getVoiceGuardSettings(rel.id);
  if (!guard?.enabled) return null;
  const list = await readSessions();
  return (
    list.find(
      (s) =>
        s.userId === partnerUserId &&
        s.partnerUserId === listenerUserId &&
        s.mode === 'relationship_gathering' &&
        (s.status === 'recording' || s.status === 'muted_sensitive')
    ) || null
  );
}

export async function createDateRecordingSession(planId: string, userId: string): Promise<VoiceRecordingSession> {
  const plans = await readMeetupPlansFromDisk();
  const plan = plans.find((p) => p.id === planId && p.userId === userId);
  if (!plan) throw new Error('Meetup plan not found');
  if (plan.dateSessionStatus !== 'active') throw new Error('Start date tracking before voice recording');

  const existing = await getActiveDateRecording(planId, userId);
  if (existing) return existing;

  const session: VoiceRecordingSession = {
    id: `vr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId,
    meetupPlanId: planId,
    mode: 'date_safety',
    status: 'pending_consent',
    consentSteps: 0,
    emergencyContactUserId: plan.emergencyContactUserId || null,
    emergencyContactId: plan.emergencyContactId || null,
    chunks: [],
    sensitiveMoments: 0,
    expiresAt: defaultExpiry(),
    createdAt: new Date().toISOString(),
  };

  const list = await readSessions();
  list.push(session);
  await writeSessions(list);
  return session;
}

export async function advanceRecordingConsent(sessionId: string, userId: string): Promise<VoiceRecordingSession> {
  const list = await readSessions();
  const s = list.find((x) => x.id === sessionId && x.userId === userId);
  if (!s) throw new Error('Session not found');
  if (s.status !== 'pending_consent' && s.status !== 'recording') throw new Error('Cannot advance consent now');

  s.consentSteps = Math.min(REQUIRED_CONSENT_STEPS, s.consentSteps + 1);
  if (s.consentSteps >= REQUIRED_CONSENT_STEPS) {
    s.userSignedAt = new Date().toISOString();
    if (s.mode === 'relationship_gathering') {
      const rel = await getActiveRelationship(userId);
      if (rel) {
        const guard = await ensureVoiceGuardSettings(rel.id);
        const isUser1 = rel.userId1 === userId;
        if (isUser1) guard.user1ConsentSteps = REQUIRED_CONSENT_STEPS;
        else guard.user2ConsentSteps = REQUIRED_CONSENT_STEPS;
        if (isUser1) guard.user1SignedAt = s.userSignedAt;
        else guard.user2SignedAt = s.userSignedAt;
        await saveVoiceGuardSettings(guard);
      }
    }
    s.status = 'recording';
    s.startedAt = s.startedAt || new Date().toISOString();
  }
  await writeSessions(list);
  return s;
}

export async function uploadRecordingChunk(
  sessionId: string,
  userId: string,
  audioData: string,
  durationSec?: number
): Promise<VoiceRecordingSession> {
  const list = await readSessions();
  const s = list.find((x) => x.id === sessionId && x.userId === userId);
  if (!s) throw new Error('Session not found');
  if (s.status !== 'recording' && s.status !== 'muted_sensitive') throw new Error('Not recording');
  if (s.consentSteps < REQUIRED_CONSENT_STEPS) throw new Error('Complete all consent steps first');

  const chunkId = `ch-${Date.now()}`;
  const vaultRef = `${s.id}/${chunkId}.vault`;
  await storeSensitive(vaultRef, audioData);

  const muted = s.status === 'muted_sensitive';
  s.chunks.push({
    id: chunkId,
    vaultRef,
    recordedAt: new Date().toISOString(),
    durationSec,
    muted,
  });
  if (s.chunks.length > 200) s.chunks.splice(0, s.chunks.length - 200);

  await writeSessions(list);
  return s;
}

export async function muteSensitiveTalk(sessionId: string, userId: string): Promise<VoiceRecordingSession> {
  const list = await readSessions();
  const s = list.find((x) => x.id === sessionId && x.userId === userId);
  if (!s) throw new Error('Session not found');
  s.status = 'muted_sensitive';
  s.mutedSince = new Date().toISOString();
  s.sensitiveMoments = (s.sensitiveMoments || 0) + 1;
  s.lastSensitiveReminderAt = new Date().toISOString();
  await writeSessions(list);
  return s;
}

export async function unmuteSensitiveTalk(sessionId: string, userId: string): Promise<VoiceRecordingSession> {
  const list = await readSessions();
  const s = list.find((x) => x.id === sessionId && x.userId === userId);
  if (!s) throw new Error('Session not found');
  s.status = 'recording';
  s.mutedSince = null;
  await writeSessions(list);
  return s;
}

export async function endVoiceRecording(sessionId: string, userId: string): Promise<VoiceRecordingSession> {
  const list = await readSessions();
  const s = list.find((x) => x.id === sessionId && x.userId === userId);
  if (!s) throw new Error('Session not found');

  s.status = 'completed';
  s.endedAt = new Date().toISOString();
  s.expiresAt = defaultExpiry(new Date());
  if (s.mode === 'relationship_gathering') {
    s.homeReviewPending = true;
    if (s.partnerUserId) {
      sendPushToUser(s.partnerUserId, {
        title: 'Partner home — review recording?',
        body: 'Your partner ended a gathering recording. Review sensitive parts together.',
        data: { type: 'voice_guard_home', sessionId: s.id },
      }).catch(() => {});
    }
  }
  if (s.meetupPlanId) {
    await updateMeetupPlanFields(s.meetupPlanId, { voiceRecordingSessionId: s.id } as Partial<MeetupPlan>);
  }
  await writeSessions(list);
  return s;
}

/** Daters cannot delete date safety recordings — only emergency contact after PIN + emergency. */
export async function tryDeleteRecording(sessionId: string, userId: string): Promise<{ ok: boolean; message: string }> {
  const s = await getSessionById(sessionId);
  if (!s) return { ok: false, message: 'Not found' };
  if (s.userId === userId && s.mode === 'date_safety') {
    return {
      ok: false,
      message: 'Date safety recordings cannot be deleted by you. Only your emergency contact can access them in an emergency (with PIN). They expire automatically like Twitch VODs.',
    };
  }
  return { ok: false, message: 'Use home review with your partner to request deletion.' };
}

export async function partnerDeleteRecording(sessionId: string, partnerUserId: string, approve: boolean): Promise<VoiceRecordingSession | null> {
  const list = await readSessions();
  const s = list.find((x) => x.id === sessionId && x.partnerUserId === partnerUserId);
  if (!s || s.mode !== 'relationship_gathering') return null;
  if (approve) {
    s.status = 'partner_deleted';
    s.partnerApprovedDelete = true;
    s.homeReviewPending = false;
  } else {
    s.homeReviewPending = false;
    s.partnerApprovedDelete = false;
  }
  await writeSessions(list);
  return s;
}

export async function submitHomeReview(
  sessionId: string,
  userId: string,
  hadSensitiveTalk: boolean,
  consultPartner: boolean
): Promise<VoiceRecordingSession> {
  const list = await readSessions();
  const s = list.find((x) => x.id === sessionId && x.userId === userId);
  if (!s) throw new Error('Session not found');
  s.homeReviewPending = false;
  if (hadSensitiveTalk && consultPartner && s.partnerUserId) {
    sendPushToUser(s.partnerUserId, {
      title: 'Sensitive talk on recording',
      body: 'Your partner wants to review/delete parts of the gathering recording. Open couple chat.',
      data: { type: 'voice_guard_review', sessionId: s.id },
    }).catch(() => {});
  }
  await writeSessions(list);
  return s;
}

function emergencyAccessAllowed(plan: MeetupPlan): boolean {
  if (plan.dangerAlertAt || plan.dateSessionStatus === 'missing' || plan.missingReportedAt) return true;
  if (plan.expectedBackAt && Date.now() > new Date(plan.expectedBackAt).getTime() + 30 * 60 * 1000) return true;
  return false;
}

async function verifyPinForPlan(plan: MeetupPlan, pin: string): Promise<boolean> {
  if (plan.emergencyRecordingPinHash) {
    return bcrypt.compare(pin, plan.emergencyRecordingPinHash);
  }
  if (plan.emergencyContactId) {
    const { getEmergencyContactById } = await import('./safety.js');
    const c = await getEmergencyContactById(plan.emergencyContactId);
    if (c?.recordingPinHash) return bcrypt.compare(pin, c.recordingPinHash);
  }
  return false;
}

export async function setEmergencyContactPin(ownerUserId: string, contactId: string, pin: string): Promise<void> {
  if (!pin || pin.length < 4) throw new Error('PIN must be at least 4 digits');
  const { readFile, writeFile } = await import('fs/promises');
  const path = join(process.cwd(), 'server', 'data', 'emergency-contacts.json');
  const contacts = JSON.parse(await readFile(path, 'utf-8')) as Array<{ id: string; userId: string; recordingPinHash?: string }>;
  const c = contacts.find((x) => x.id === contactId && x.userId === ownerUserId);
  if (!c) throw new Error('Contact not found');
  c.recordingPinHash = await bcrypt.hash(pin, 10);
  await writeFile(path, JSON.stringify(contacts, null, 2));
}

export async function setMeetupEmergencyPin(planId: string, userId: string, pin: string): Promise<void> {
  if (!pin || pin.length < 4) throw new Error('PIN must be at least 4 digits');
  const plans = await readMeetupPlansFromDisk();
  const plan = plans.find((p) => p.id === planId && p.userId === userId);
  if (!plan) throw new Error('Plan not found');
  await updateMeetupPlanFields(planId, {
    emergencyRecordingPinHash: await bcrypt.hash(pin, 10),
  } as Partial<MeetupPlan>);
}

export async function accessRecordingAsEmergencyContact(
  planId: string,
  contactUserId: string,
  pin: string
): Promise<{ session: VoiceRecordingSession; chunks: Array<{ id: string; recordedAt: string; muted?: boolean; audioDataUrl?: string | null }> } | null> {
  const plans = await readMeetupPlansFromDisk();
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return null;
  if (plan.emergencyContactUserId !== contactUserId) return null;
  if (!emergencyAccessAllowed(plan)) {
    throw new Error('Recording access is only available when your contact is missing, in danger, or overdue.');
  }
  const pinOk = await verifyPinForPlan(plan, pin);
  if (!pinOk) throw new Error('Invalid PIN');

  const list = await readSessions();
  const session =
    list.find((s) => s.meetupPlanId === planId && s.mode === 'date_safety' && s.status !== 'partner_deleted') ||
    list.filter((s) => s.meetupPlanId === planId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (!session) return null;

  const chunks = await Promise.all(
    session.chunks.slice(-20).map(async (ch) => ({
      id: ch.id,
      recordedAt: ch.recordedAt,
      muted: ch.muted,
      audioDataUrl: ch.muted ? null : await readSensitiveAsDataUrl(ch.vaultRef, 'audio/webm'),
    }))
  );
  return { session, chunks };
}

export async function submitPoliceAccessRequest(params: {
  recordingId: string;
  contactUserId: string;
  documentData: string;
  reason: string;
}): Promise<PoliceAccessRequest> {
  const session = await getSessionById(params.recordingId);
  if (!session || session.mode !== 'date_safety') throw new Error('Recording not found');
  const docRef = `${session.id}/police-${Date.now()}.vault`;
  await storeSensitive(docRef, params.documentData);
  const req: PoliceAccessRequest = {
    id: `pol-${Date.now()}`,
    recordingId: params.recordingId,
    contactUserId: params.contactUserId,
    documentVaultRef: docRef,
    reason: params.reason.slice(0, 500),
    status: 'pending',
    submittedAt: new Date().toISOString(),
  };
  const list = await readPoliceRequests();
  list.push(req);
  await writePoliceRequests(list);
  return req;
}

export async function getVoiceGuardSettings(relationshipId: string): Promise<RelationshipVoiceGuardSettings | null> {
  return (await readGuardSettings()).find((g) => g.relationshipId === relationshipId) || null;
}

async function ensureVoiceGuardSettings(relationshipId: string): Promise<RelationshipVoiceGuardSettings> {
  const list = await readGuardSettings();
  let g = list.find((x) => x.relationshipId === relationshipId);
  if (!g) {
    g = {
      relationshipId,
      enabled: false,
      user1ConsentSteps: 0,
      user2ConsentSteps: 0,
      updatedAt: new Date().toISOString(),
    };
    list.push(g);
    await writeGuardSettings(list);
  }
  return g;
}

async function saveVoiceGuardSettings(g: RelationshipVoiceGuardSettings): Promise<void> {
  const list = await readGuardSettings();
  const i = list.findIndex((x) => x.relationshipId === g.relationshipId);
  g.updatedAt = new Date().toISOString();
  if (i >= 0) list[i] = g;
  else list.push(g);
  await writeGuardSettings(list);
}

export async function setVoiceGuardEnabled(userId: string, partnerUserId: string, enabled: boolean): Promise<RelationshipVoiceGuardSettings> {
  const rel = await getActiveRelationship(userId);
  if (!rel || rel.status !== 'active' || getPartnerId(rel, userId) !== partnerUserId) {
    throw new Error('Active relationship required');
  }
  const g = await ensureVoiceGuardSettings(rel.id);
  g.enabled = enabled;
  if (!enabled) {
    g.user1ConsentSteps = 0;
    g.user2ConsentSteps = 0;
    g.user1SignedAt = null;
    g.user2SignedAt = null;
  }
  await saveVoiceGuardSettings(g);
  const partnerId = getPartnerId(rel, userId);
  sendPushToUser(partnerId, {
    title: enabled ? 'Faithfulness recording offered' : 'Recording guard turned off',
    body: enabled
      ? 'Your partner enabled gathering voice guard. You must agree before any recording starts.'
      : 'Your partner disabled gathering voice guard in chat settings.',
    data: { type: 'voice_guard_toggle', enabled: String(enabled) },
  }).catch(() => {});
  return g;
}

export async function advanceVoiceGuardConsent(userId: string, partnerUserId: string): Promise<RelationshipVoiceGuardSettings> {
  const rel = await getActiveRelationship(userId);
  if (!rel || rel.status !== 'active' || getPartnerId(rel, userId) !== partnerUserId) {
    throw new Error('Active relationship required');
  }
  const g = await ensureVoiceGuardSettings(rel.id);
  if (!g.enabled) throw new Error('Feature must be enabled first');
  const isUser1 = rel.userId1 === userId;
  if (isUser1) g.user1ConsentSteps = Math.min(REQUIRED_CONSENT_STEPS, g.user1ConsentSteps + 1);
  else g.user2ConsentSteps = Math.min(REQUIRED_CONSENT_STEPS, g.user2ConsentSteps + 1);
  if (g.user1ConsentSteps >= REQUIRED_CONSENT_STEPS) g.user1SignedAt = new Date().toISOString();
  if (g.user2ConsentSteps >= REQUIRED_CONSENT_STEPS) g.user2SignedAt = new Date().toISOString();
  await saveVoiceGuardSettings(g);
  return g;
}

export function guardFullyConsented(g: RelationshipVoiceGuardSettings): boolean {
  return g.enabled && g.user1ConsentSteps >= REQUIRED_CONSENT_STEPS && g.user2ConsentSteps >= REQUIRED_CONSENT_STEPS;
}

export async function startRelationshipGatheringRecording(
  userId: string,
  partnerUserId: string,
  reason: string
): Promise<VoiceRecordingSession> {
  const rel = await getActiveRelationship(userId);
  if (!rel || rel.status !== 'active' || getPartnerId(rel, userId) !== partnerUserId) {
    throw new Error('Active relationship required');
  }
  const g = await getVoiceGuardSettings(rel.id);
  if (!g || !guardFullyConsented(g)) {
    throw new Error('Both partners must agree 3 times before gathering recording can start');
  }

  const existing = await getActiveRelationshipRecording(userId);
  if (existing) return existing;

  const session: VoiceRecordingSession = {
    id: `vr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId,
    partnerUserId,
    relationshipId: rel.id,
    mode: 'relationship_gathering',
    status: 'pending_consent',
    consentSteps: 0,
    partnerConsentSteps: 0,
    chunks: [],
    sensitiveMoments: 0,
    gatheringReason: reason.slice(0, 200),
    expiresAt: defaultExpiry(),
    createdAt: new Date().toISOString(),
  };
  const list = await readSessions();
  list.push(session);
  await writeSessions(list);

  const user = await getUserById(userId);
  sendPushToUser(partnerUserId, {
    title: '🎙 Gathering recording starting',
    body: `${user?.name || 'Your partner'} is heading out (${reason.slice(0, 60)}). Live guard recording — you can listen in chat.`,
    data: { type: 'voice_guard_live', sessionId: session.id, partnerUserId: userId },
  }).catch(() => {});

  return session;
}

export async function detectGatheringAndNotify(userId: string, partnerUserId: string, message: string): Promise<{ detected: boolean; session?: VoiceRecordingSession }> {
  if (!GATHERING_PATTERN.test(message)) return { detected: false };
  const rel = await getActiveRelationship(userId);
  if (!rel || rel.status !== 'active' || getPartnerId(rel, userId) !== partnerUserId) return { detected: false };
  const g = await getVoiceGuardSettings(rel.id);
  if (!g?.enabled) return { detected: false };

  const partnerId = getPartnerId(rel, userId);
  const user = await getUserById(userId);
  sendPushToUser(partnerId, {
    title: 'Partner heading to a gathering',
    body: `${user?.name || 'Your partner'} mentioned: "${message.slice(0, 80)}" — faithfulness recording can start after triple consent.`,
    data: { type: 'voice_guard_gathering', partnerUserId: userId },
  }).catch(() => {});

  return { detected: true };
}

export async function getListenerChunks(sessionId: string, listenerUserId: string): Promise<Array<{ id: string; recordedAt: string; muted?: boolean; audioDataUrl?: string | null }>> {
  const s = await getSessionById(sessionId);
  if (!s || s.partnerUserId !== listenerUserId) throw new Error('Not allowed');
  if (s.mode !== 'relationship_gathering') throw new Error('Not a relationship recording');
  return Promise.all(
    s.chunks.slice(-10).map(async (ch) => ({
      id: ch.id,
      recordedAt: ch.recordedAt,
      muted: ch.muted,
      audioDataUrl: ch.muted ? null : await readSensitiveAsDataUrl(ch.vaultRef, 'audio/webm'),
    }))
  );
}

export async function pollVoiceRecordingReminders(userId: string): Promise<{
  needsSensitiveReminder?: VoiceRecordingSession | null;
  homeReview?: VoiceRecordingSession | null;
  partnerLive?: VoiceRecordingSession | null;
}> {
  await expireOldSessions();
  const active = await getActiveRelationshipRecording(userId);
  let needsSensitiveReminder: VoiceRecordingSession | null = null;
  if (active?.status === 'muted_sensitive' && active.lastSensitiveReminderAt) {
    const mins = (Date.now() - new Date(active.lastSensitiveReminderAt).getTime()) / 60000;
    if (mins >= 3) needsSensitiveReminder = active;
  } else if (active?.status === 'recording' && active.startedAt) {
    const mins = (Date.now() - new Date(active.startedAt).getTime()) / 60000;
    if (mins > 0 && mins % 15 < 0.5) {
      /* client handles periodic "not workplace/errands" reminders */
    }
  }

  const list = await readSessions();
  const homeReview = list.find((s) => s.userId === userId && s.homeReviewPending) || null;

  const rel = await getActiveRelationship(userId);
  let partnerLive: VoiceRecordingSession | null = null;
  if (rel?.status === 'active') {
    const partnerId = getPartnerId(rel, userId);
    partnerLive = await getPartnerLiveRecording(partnerId, userId);
  }

  return { needsSensitiveReminder, homeReview, partnerLive };
}

export const CONSENT_STEP_COUNT = REQUIRED_CONSENT_STEPS;
