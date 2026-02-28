import { Request, Response } from 'express';
import {
  getHealthResults,
  upsertHealthResults,
  addOrUpdateTest,
  removeTest,
  createViewRequest,
  getViewRequest,
  getViewRequestsForUser,
  respondToViewRequest,
  canViewHealth,
} from '../models/health.js';
import { getUserById } from '../models/user.js';

export async function getMyHealth(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const results = await getHealthResults(userId);
    res.json({ results: results || { userId, tests: [], lastUpdated: null } });
  } catch (e: any) {
    console.error('Get my health error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function updateMyHealth(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { tests } = req.body;
    if (!Array.isArray(tests)) return res.status(400).json({ error: 'tests array is required' });
    const validated = tests.map((t: any) => ({
      id: t.id || Date.now().toString() + Math.random(),
      condition: String(t.condition || ''),
      result: t.result === 'positive' || t.result === 'pending' ? t.result : 'clear',
      testedAt: t.testedAt || new Date().toISOString(),
      doctorName: String(t.doctorName || ''),
      doctorClinic: String(t.doctorClinic || ''),
      verificationInfo: String(t.verificationInfo || ''),
      approvedByDoctor: !!t.approvedByDoctor,
    }));
    const results = await upsertHealthResults(userId, validated);
    res.json({ results });
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
    const test = {
      id: body.id,
      condition: String(body.condition || ''),
      result: body.result === 'positive' || body.result === 'pending' ? body.result : 'clear',
      testedAt: body.testedAt || new Date().toISOString(),
      doctorName: String(body.doctorName || ''),
      doctorClinic: String(body.doctorClinic || ''),
      verificationInfo: String(body.verificationInfo || ''),
      approvedByDoctor: !!body.approvedByDoctor,
    };
    const results = await addOrUpdateTest(userId, test);
    res.json({ results });
  } catch (e: any) {
    console.error('Add test error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function deleteTest(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { testId } = req.params;
    if (!testId) return res.status(400).json({ error: 'testId is required' });
    const results = await removeTest(userId, testId);
    res.json({ results: results || { userId, tests: [], lastUpdated: null } });
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
    res.json({
      request: viewRequest,
      canView,
      results: targetResults ? { tests: targetResults.tests, lastUpdated: targetResults.lastUpdated } : null,
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
