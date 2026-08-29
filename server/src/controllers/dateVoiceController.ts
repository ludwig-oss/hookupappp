import { Request, Response } from 'express';
import {
  createDateRecordingSession,
  advanceRecordingConsent,
  uploadRecordingChunk,
  muteSensitiveTalk,
  unmuteSensitiveTalk,
  endVoiceRecording,
  tryDeleteRecording,
  partnerDeleteRecording,
  submitHomeReview,
  accessRecordingAsEmergencyContact,
  submitPoliceAccessRequest,
  setEmergencyContactPin,
  setMeetupEmergencyPin,
  setVoiceGuardEnabled,
  advanceVoiceGuardConsent,
  startRelationshipGatheringRecording,
  detectGatheringAndNotify,
  getListenerChunks,
  pollVoiceRecordingReminders,
  getActiveDateRecording,
  getSessionById,
  getVoiceGuardSettings,
  guardFullyConsented,
  CONSENT_STEP_COUNT,
} from '../models/dateVoiceRecording.js';
import { getActiveRelationship, getPartnerId } from '../models/relationship.js';

function sanitizeSession(s: Awaited<ReturnType<typeof getSessionById>>) {
  if (!s) return null;
  return {
    id: s.id,
    mode: s.mode,
    status: s.status,
    consentSteps: s.consentSteps,
    consentRequired: CONSENT_STEP_COUNT,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    expiresAt: s.expiresAt,
    mutedSince: s.mutedSince,
    gatheringReason: s.gatheringReason,
    homeReviewPending: s.homeReviewPending,
    chunkCount: s.chunks.length,
    meetupPlanId: s.meetupPlanId,
    partnerUserId: s.partnerUserId,
  };
}

export const createDateRecordingHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { planId } = req.params;
    const session = await createDateRecordingSession(planId, userId);
    res.json({
      session: sanitizeSession(session),
      message: `Confirm ${CONSENT_STEP_COUNT} times before recording starts. You cannot delete this — only your emergency contact can access it in an emergency (with PIN). Auto-deletes in 7 days like Twitch VODs.`,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Could not create recording' });
  }
};

export const advanceConsentHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { sessionId } = req.params;
    const session = await advanceRecordingConsent(sessionId, userId);
    const remaining = Math.max(0, CONSENT_STEP_COUNT - session.consentSteps);
    res.json({
      session: sanitizeSession(session),
      remaining,
      message:
        remaining > 0
          ? `${remaining} more confirmation${remaining > 1 ? 's' : ''} before recording starts. Never record workplaces, private errands, or others' conversations without consent.`
          : 'Recording started for your safety.',
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const uploadChunkHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { sessionId } = req.params;
    const { audioData, durationSec } = req.body;
    if (!audioData) return res.status(400).json({ error: 'audioData required' });
    const session = await uploadRecordingChunk(sessionId, userId, String(audioData), durationSec);
    res.json({ session: sanitizeSession(session) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const muteSensitiveHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { sessionId } = req.params;
    const session = await muteSensitiveTalk(sessionId, userId);
    res.json({
      session: sanitizeSession(session),
      message: 'Sensitive talk — recording muted. Say when you are done and we will ask to unmute.',
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const unmuteSensitiveHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { sessionId } = req.params;
    const session = await unmuteSensitiveTalk(sessionId, userId);
    res.json({ session: sanitizeSession(session), message: 'Recording resumed.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const endRecordingHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { sessionId } = req.params;
    const session = await endVoiceRecording(sessionId, userId);
    res.json({
      session: sanitizeSession(session),
      message:
        session.mode === 'relationship_gathering'
          ? 'Recording ended. Did you talk about anything sensitive? You can review with your partner.'
          : 'Date recording saved. Expires in 7 days unless emergency access is needed.',
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteRecordingHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { sessionId } = req.params;
    const result = await tryDeleteRecording(sessionId, userId);
    res.status(result.ok ? 200 : 403).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const homeReviewHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { sessionId } = req.params;
    const { hadSensitiveTalk, consultPartner } = req.body;
    const session = await submitHomeReview(sessionId, userId, !!hadSensitiveTalk, !!consultPartner);
    res.json({ session: sanitizeSession(session) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const partnerDeleteHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { sessionId } = req.params;
    const { approve } = req.body;
    const session = await partnerDeleteRecording(sessionId, userId, !!approve);
    if (!session) return res.status(404).json({ error: 'Not found' });
    res.json({ session: sanitizeSession(session) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const emergencyAccessHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { planId } = req.params;
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: 'PIN required' });
    const data = await accessRecordingAsEmergencyContact(planId, userId, String(pin));
    if (!data) return res.status(404).json({ error: 'No recording found' });
    res.json({
      session: sanitizeSession(data.session),
      chunks: data.chunks,
      message: 'Emergency access granted. Recordings auto-expire after 7 days.',
    });
  } catch (error: any) {
    res.status(403).json({ error: error.message });
  }
};

export const policeRequestHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { recordingId } = req.params;
    const { documentData, reason } = req.body;
    if (!documentData || !reason) return res.status(400).json({ error: 'documentData and reason required' });
    const request = await submitPoliceAccessRequest({
      recordingId,
      contactUserId: userId,
      documentData: String(documentData),
      reason: String(reason),
    });
    res.json({
      request: { id: request.id, status: request.status },
      message: 'Police document submitted for admin review before recording access.',
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const setContactPinHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { contactId, pin } = req.body;
    if (!contactId || !pin) return res.status(400).json({ error: 'contactId and pin required' });
    await setEmergencyContactPin(userId, contactId, String(pin));
    res.json({ message: 'Emergency contact PIN set. Share it with them securely — needed to access date recordings in emergencies.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const setPlanPinHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { planId } = req.params;
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: 'pin required' });
    await setMeetupEmergencyPin(planId, userId, String(pin));
    res.json({ message: 'Date emergency PIN saved.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getDateRecordingHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { planId } = req.params;
    const session = await getActiveDateRecording(planId, userId);
    res.json({ session: sanitizeSession(session) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const voiceGuardSettingsHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { partnerUserId } = req.params;
    const rel = await getActiveRelationship(userId);
    if (!rel || getPartnerId(rel, userId) !== partnerUserId) {
      return res.status(403).json({ error: 'Active relationship required' });
    }
    const settings = await getVoiceGuardSettings(rel.id);
    res.json({
      settings: settings
        ? {
            enabled: settings.enabled,
            user1ConsentSteps: settings.user1ConsentSteps,
            user2ConsentSteps: settings.user2ConsentSteps,
            fullyConsented: guardFullyConsented(settings),
            consentRequired: CONSENT_STEP_COUNT,
            isUser1: rel.userId1 === userId,
            myConsentSteps: rel.userId1 === userId ? settings.user1ConsentSteps : settings.user2ConsentSteps,
          }
        : { enabled: false, myConsentSteps: 0, consentRequired: CONSENT_STEP_COUNT, fullyConsented: false },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const toggleVoiceGuardHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { partnerUserId, enabled } = req.body;
    if (!partnerUserId) return res.status(400).json({ error: 'partnerUserId required' });
    const settings = await setVoiceGuardEnabled(userId, partnerUserId, !!enabled);
    res.json({
      settings: {
        enabled: settings.enabled,
        user1ConsentSteps: settings.user1ConsentSteps,
        user2ConsentSteps: settings.user2ConsentSteps,
        fullyConsented: guardFullyConsented(settings),
      },
      message: enabled
        ? 'Gathering voice guard enabled. Both partners must confirm 3 times before any recording. Not for workplaces or daily errands.'
        : 'Gathering voice guard disabled.',
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const voiceGuardConsentHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { partnerUserId } = req.body;
    if (!partnerUserId) return res.status(400).json({ error: 'partnerUserId required' });
    const settings = await advanceVoiceGuardConsent(userId, partnerUserId);
    res.json({
      settings: {
        enabled: settings.enabled,
        user1ConsentSteps: settings.user1ConsentSteps,
        user2ConsentSteps: settings.user2ConsentSteps,
        fullyConsented: guardFullyConsented(settings),
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const startGatheringRecordingHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { partnerUserId, reason } = req.body;
    if (!partnerUserId) return res.status(400).json({ error: 'partnerUserId required' });
    const session = await startRelationshipGatheringRecording(userId, partnerUserId, reason || 'Gathering');
    res.json({
      session: sanitizeSession(session),
      message: `Confirm ${CONSENT_STEP_COUNT} times before live recording starts. Your partner will be notified.`,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const detectGatheringHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { partnerUserId, message } = req.body;
    if (!partnerUserId || !message) return res.status(400).json({ error: 'partnerUserId and message required' });
    const result = await detectGatheringAndNotify(userId, partnerUserId, String(message));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const listenChunksHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { sessionId } = req.params;
    const chunks = await getListenerChunks(sessionId, userId);
    res.json({ chunks });
  } catch (error: any) {
    res.status(403).json({ error: error.message });
  }
};

export const pollVoiceHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const data = await pollVoiceRecordingReminders(userId);
    res.json({
      needsSensitiveReminder: sanitizeSession(data.needsSensitiveReminder || null),
      homeReview: sanitizeSession(data.homeReview || null),
      partnerLive: sanitizeSession(data.partnerLive || null),
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
