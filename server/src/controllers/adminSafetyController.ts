import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { readMeetupPlansFromDisk, updateMeetupPlanFields } from '../models/safety.js';
import { readSensitiveAsDataUrl } from '../utils/sensitiveVault.js';
import { getUserById } from '../models/user.js';

function stripSensitive(plan: Record<string, unknown>) {
  const { idFrontImage, idBackImage, safetyCheckVideo, idFrontVaultRef, idBackVaultRef, safetyVideoVaultRef, ...rest } =
    plan;
  return {
    ...rest,
    hasIdOnFile: Boolean(idFrontVaultRef || idBackVaultRef || idFrontImage),
    hasSafetyVideo: Boolean(safetyVideoVaultRef || safetyCheckVideo),
  };
}

export const listPendingSafetyReviews = async (_req: AuthRequest, res: Response) => {
  try {
    const plans = await readMeetupPlansFromDisk();
    const pending = plans.filter((p) => p.safetyCheckStatus === 'pending_review');
    const enriched = await Promise.all(
      pending.map(async (p) => {
        const u = await getUserById(p.userId);
        const partner = p.chatPartnerUserId ? await getUserById(p.chatPartnerUserId) : null;
        return {
          ...stripSensitive(p as unknown as Record<string, unknown>),
          userName: u?.name ?? 'Unknown',
          partnerName: partner?.name ?? null,
        };
      })
    );
    res.json({ reviews: enriched });
  } catch (error) {
    console.error('Admin list safety reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSafetyReviewDetail = async (req: AuthRequest, res: Response) => {
  try {
    const { planId } = req.params;
    const plans = await readMeetupPlansFromDisk();
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const u = await getUserById(plan.userId);
    const partner = plan.chatPartnerUserId ? await getUserById(plan.chatPartnerUserId) : null;

    const idFront =
      (await readSensitiveAsDataUrl(plan.idFrontVaultRef, 'image/jpeg')) ||
      (typeof plan.idFrontImage === 'string' ? plan.idFrontImage : null);
    const idBack =
      (await readSensitiveAsDataUrl(plan.idBackVaultRef, 'image/jpeg')) ||
      (typeof plan.idBackImage === 'string' ? plan.idBackImage : null);
    const safetyVideo =
      (await readSensitiveAsDataUrl(plan.safetyVideoVaultRef, 'video/webm')) ||
      (typeof plan.safetyCheckVideo === 'string' ? plan.safetyCheckVideo : null);

    res.json({
      plan: stripSensitive(plan as unknown as Record<string, unknown>),
      userName: u?.name ?? 'Unknown',
      partnerName: partner?.name ?? null,
      idFront,
      idBack,
      safetyVideo,
    });
  } catch (error) {
    console.error('Admin safety detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const decideSafetyReview = async (req: AuthRequest, res: Response) => {
  try {
    const { planId } = req.params;
    const { decision } = req.body as { decision?: 'approved' | 'rejected' };
    if (decision !== 'approved' && decision !== 'rejected') {
      return res.status(400).json({ error: 'decision must be approved or rejected' });
    }
    const ok = await updateMeetupPlanFields(planId, {
      safetyCheckStatus: decision,
      safetyReviewedAt: new Date().toISOString(),
      safetyReviewedBy: req.userId || 'admin',
    });
    if (!ok) return res.status(404).json({ error: 'Plan not found' });
    res.json({ message: `Safety check-in ${decision}`, planId, decision });
  } catch (error) {
    console.error('Admin decide safety error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const checkAdminAccess = async (req: AuthRequest, res: Response) => {
  res.json({ admin: true, userId: req.userId });
};
