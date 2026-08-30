import { Request, Response } from 'express';
import {
  getHealthResults,
  getAllHealthResultsRecords,
  upsertHealthResults,
  addOrUpdateTest,
  removeTest,
  createViewRequest,
  getViewRequest,
  getViewRequestsForUser,
  respondToViewRequest,
  canViewHealth,
} from '../models/health.js';
import { getUserById, updateUserProfile } from '../models/user.js';
import { getActiveRelationship } from '../models/relationship.js';
import { uploadMedia } from '../utils/storage.js';
import {
  assessDocumentAuthenticity,
  computeHealthCompliance,
  hashDocument,
  HEALTH_LEGAL_TEXT,
  REQUIRED_STI_CONDITIONS,
} from '../utils/healthCompliance.js';
import { hasPlannedMeetupWith } from '../utils/healthMeetupGate.js';

async function relationshipExempt(userId: string): Promise<boolean> {
  const rel = await getActiveRelationship(userId);
  return !!rel && rel.status === 'active';
}

async function compliancePayload(userId: string) {
  const results = await getHealthResults(userId);
  const exempt = await relationshipExempt(userId);
  return computeHealthCompliance(results?.tests || [], exempt);
}

export async function getMyHealth(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const results = await getHealthResults(userId);
    const compliance = await compliancePayload(userId);
    res.json({
      results: results || { userId, tests: [], lastUpdated: null },
      compliance,
      legalText: HEALTH_LEGAL_TEXT,
      requiredConditions: REQUIRED_STI_CONDITIONS,
    });
  } catch (e: any) {
    console.error('Get my health error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function updateMyHealth(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    return res.status(400).json({
      error: 'Manual entry disabled. Upload a stamped lab photo for each condition instead.',
    });
  } catch (e: any) {
    console.error('Update my health error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function addTest(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const body = req.body || {};
    const condition = String(body.condition || '').trim();
    const result = body.result === 'positive' || body.result === 'pending' ? body.result : 'clear';
    const testedAt = body.testedAt || new Date().toISOString();
    const signatureName = String(body.signatureName || '').trim();
    const legalAccepted = !!body.legalAccepted;
    const rawDocument = String(body.documentImage || body.document || '');

    if (!condition || !REQUIRED_STI_CONDITIONS.includes(condition as (typeof REQUIRED_STI_CONDITIONS)[number])) {
      return res.status(400).json({ error: 'Pick a valid STI condition.' });
    }
    if (!signatureName || signatureName.length < 2) {
      return res.status(400).json({ error: 'Type your full name as your virtual signature.' });
    }
    if (!legalAccepted) {
      return res.status(400).json({ error: 'You must agree to the legal statement before uploading.' });
    }
    if (!rawDocument) {
      return res.status(400).json({ error: 'Upload a photo of your stamped lab report.' });
    }

    const allRecords = await getAllHealthResultsRecords();
    const authCheck = assessDocumentAuthenticity(rawDocument, userId, allRecords);
    if (!authCheck.ok) {
      if (authCheck.suspend) {
        await updateUserProfile(userId, {
          suspensionUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          suspensionReason:
            'Account suspended: suspected forged health document. Contact support if this was a mistake.',
        });
      }
      return res.status(400).json({ error: authCheck.reason });
    }

    const documentUrl = await uploadMedia(rawDocument, 'health-proofs');
    const documentHash = hashDocument(rawDocument);
    const now = new Date().toISOString();

    const test = {
      id: body.id,
      condition,
      result,
      testedAt,
      doctorName: String(body.doctorName || ''),
      doctorClinic: String(body.doctorClinic || ''),
      verificationInfo: String(body.verificationInfo || ''),
      approvedByDoctor: true,
      documentUrl,
      documentHash,
      signatureName,
      signedAt: now,
      legalAccepted: true,
    };

    const results = await addOrUpdateTest(userId, test);
    const compliance = await compliancePayload(userId);
    res.json({ results, compliance });
  } catch (e: any) {
    console.error('Add test error:', e);
    res.status(500).json({ error: e.message || 'Could not save health proof' });
  }
}

export async function deleteTest(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { testId } = req.params;
    if (!testId) return res.status(400).json({ error: 'testId is required' });
    const results = await removeTest(userId, testId);
    const compliance = await compliancePayload(userId);
    res.json({ results: results || { userId, tests: [], lastUpdated: null }, compliance });
  } catch (e: any) {
    console.error('Delete test error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function requestToViewHealth(req: Request, res: Response) {
  try {
    const fromUserId = (req as any).userId;
    if (!fromUserId) return res.status(401).json({ error: 'Unauthorized' });
    const { toUserId } = req.body;
    if (!toUserId) return res.status(400).json({ error: 'toUserId is required' });

    const planned = await hasPlannedMeetupWith(fromUserId, toUserId);
    if (!planned) {
      return res.status(400).json({
        error: 'Plan a meetup first (Date safety → meetup plan), then you can request to see their stamped lab reports before you meet.',
      });
    }

    const request = await createViewRequest(fromUserId, toUserId);
    res.json({ request });
  } catch (e: any) {
    console.error('Request to view health error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function getHealthViewStatus(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { otherUserId } = req.params;
    if (!otherUserId) return res.status(400).json({ error: 'otherUserId is required' });
    const viewRequest = await getViewRequest(userId, otherUserId);
    const canView = await canViewHealth(userId, otherUserId);
    const targetResults = canView ? await getHealthResults(otherUserId) : null;
    const compliance = canView && targetResults
      ? computeHealthCompliance(targetResults.tests, await relationshipExempt(otherUserId))
      : null;
    res.json({
      request: viewRequest,
      canView,
      results: targetResults
        ? { tests: targetResults.tests, lastUpdated: targetResults.lastUpdated, compliance }
        : null,
      canRequest: await hasPlannedMeetupWith(userId, otherUserId),
    });
  } catch (e: any) {
    console.error('Get health view status error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function getMyHealthRequests(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { incoming, outgoing } = await getViewRequestsForUser(userId);
    const incomingWithUser = await Promise.all(
      incoming.map(async (r) => {
        const u = await getUserById(r.fromUserId);
        return {
          ...r,
          fromUser: u ? { id: u.id, name: u.name } : null,
        };
      })
    );
    const outgoingWithUser = await Promise.all(
      outgoing.map(async (r) => {
        const u = await getUserById(r.toUserId);
        return {
          ...r,
          toUser: u ? { id: u.id, name: u.name } : null,
        };
      })
    );
    res.json({ incoming: incomingWithUser, outgoing: outgoingWithUser });
  } catch (e: any) {
    console.error('Get my health requests error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function respondToHealthRequest(req: Request, res: Response) {
  try {
    const toUserId = (req as any).userId;
    if (!toUserId) return res.status(401).json({ error: 'Unauthorized' });
    const { requestId, approve } = req.body;
    if (!requestId) return res.status(400).json({ error: 'requestId is required' });
    const request = await respondToViewRequest(requestId, toUserId, !!approve);
    if (!request) return res.status(404).json({ error: 'Request not found or already responded' });
    res.json({ request });
  } catch (e: any) {
    console.error('Respond to health request error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

/** Used by matching — skip users with stale/missing proofs (relationship exempt). */
export async function isHealthMatchingLimited(userId: string): Promise<boolean> {
  const results = await getHealthResults(userId);
  const compliance = await compliancePayload(userId);
  return compliance.limited && !compliance.exempt;
}
