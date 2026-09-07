/**
 * Appearance engine HTTP layer.
 * Returns a structured JSON document: verified angles, taxonomy, 50-step plan, after URLs.
 */

import { Request, Response } from 'express';
import { getGuide } from '../data/aiGuideCatalog.js';
import { WELLNESS_HABITS } from '../data/appearanceCatalog.js';
import { getUserById } from '../models/user.js';
import {
  deleteAppearanceLook,
  listAppearanceLooks,
  saveAppearanceLook,
} from '../models/appearanceLooks.js';
import { analyzeAppearance } from '../services/appearanceAnalysis.js';
import { generateAfterResults } from '../services/appearanceAfter.js';
import { critiqueCompleteLooks } from '../services/appearanceCritic.js';
import { validateThreeAngles, type AnglePayload } from '../services/appearanceScan.js';
import { autoChooseLooks, iterateLook, type CompleteLook } from '../services/appearanceStyling.js';

function asAngle(body: unknown): AnglePayload | null {
  const row = body as { dataUrl?: string; metrics?: AnglePayload['metrics'] } | null;
  if (!row?.dataUrl) return null;
  return { dataUrl: String(row.dataUrl), metrics: row.metrics as AnglePayload['metrics'] };
}

function asLook(body: unknown): CompleteLook | null {
  const row = body as CompleteLook | null;
  if (!row?.id || !row.outfit || !row.hair) return null;
  return row;
}

export const scanAppearanceHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const frontal = asAngle(req.body?.frontal);
    const leftProfile = asAngle(req.body?.leftProfile);
    const rightProfile = asAngle(req.body?.rightProfile);
    const gate = validateThreeAngles({ frontal, leftProfile, rightProfile });
    if (!gate.ok) {
      return res.status(400).json({
        error: 'Need three clear photos: frontal, left profile, and right profile.',
        errors: gate.errors,
        angles: {
          frontal: { verified: gate.angles.frontal.ok, errors: gate.angles.frontal.errors },
          leftProfile: { verified: gate.angles.leftProfile.ok, errors: gate.angles.leftProfile.errors },
          rightProfile: { verified: gate.angles.rightProfile.ok, errors: gate.angles.rightProfile.errors },
        },
      });
    }
    const analysis = analyzeAppearance(gate.angles);
    const after = await generateAfterResults({
      frontalUrl: frontal!.dataUrl,
      leftUrl: leftProfile!.dataUrl,
      rightUrl: rightProfile!.dataUrl,
      faults: analysis.faults,
    });
    const user = await getUserById(userId);
    const occasion = String(req.body?.occasion || 'first date');
    const session = await autoChooseLooks(occasion, user?.gender);
    const guideId = String(req.body?.guideId || (user as { aiGuideId?: string })?.aiGuideId || 'elena');
    const guide = getGuide(guideId) || getGuide('elena');
    const first = (guide?.name || 'Elena').split(' ')[0];
    const critic = await critiqueCompleteLooks(session.optionA, session.optionB, session.occasion, first);

    res.json({
      verifiedAngles: {
        frontal: { verified: true, metrics: gate.angles.frontal.metrics },
        leftProfile: { verified: true, metrics: gate.angles.leftProfile.metrics },
        rightProfile: { verified: true, metrics: gate.angles.rightProfile.metrics },
      },
      taxonomy: {
        skinType: analysis.skinType,
        skinConfidence: analysis.skinConfidence,
        blemishes: analysis.blemishes,
        faults: analysis.faults,
      },
      summary: analysis.summary,
      actionPlan: analysis.plan,
      actionPlanCount: analysis.plan.length,
      librarySize: WELLNESS_HABITS.length,
      afterResults: after,
      style: {
        ...session,
        critic,
        autoChosen: true,
        askLike: critic.askLike,
      },
      disclaimer:
        'Wellness simulation for dating photos — not a medical diagnosis. After images are a 6-month habit preview, not a guaranteed change.',
    });
  } catch (error) {
    console.error('Appearance scan error:', error);
    res.status(500).json({ error: 'Could not read those photos. Try clearer daylight shots.' });
  }
};

export const styleAppearanceHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await getUserById(userId);
    const occasion = String(req.body?.occasion || req.body?.prompt || 'first date');
    const session = await autoChooseLooks(occasion, user?.gender);
    const guideId = String(req.body?.guideId || 'elena');
    const first = ((getGuide(guideId) || getGuide('elena'))?.name || 'Elena').split(' ')[0];
    const critic = await critiqueCompleteLooks(session.optionA, session.optionB, session.occasion, first);
    res.json({ ...session, critic, autoChosen: true, askLike: critic.askLike });
  } catch (error) {
    console.error('Appearance style error:', error);
    res.status(500).json({ error: 'Could not pick a look yet.' });
  }
};

export const iterateAppearanceHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const current = asLook(req.body?.look);
    if (!current) return res.status(400).json({ error: 'look is required' });
    const message = String(req.body?.message || '');
    const next = iterateLook(current, message);
    res.json({ ...next, askLike: 'Do you like this look?' });
  } catch (error) {
    console.error('Appearance iterate error:', error);
    res.status(500).json({ error: 'Could not change that piece.' });
  }
};

export const approveAppearanceHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const liked = Boolean(req.body?.liked);
    if (!liked) {
      return res.json({ saved: false, askLike: 'Do you like this look?', hint: 'Say what to change. I will re-render that piece.' });
    }
    const look = asLook(req.body?.look);
    if (!look) return res.status(400).json({ error: 'look is required' });
    const item = await saveAppearanceLook({
      userId,
      group: String(req.body?.group || look.occasion || 'Saved looks').slice(0, 40),
      lookId: look.id,
      title: `${look.outfit.title} · ${look.hair.title}`,
      occasion: look.occasion,
      outfitTitle: look.outfit.title,
      hairTitle: look.hair.title,
      pieces: [...look.outfit.pieces, look.hair.title],
      imageUrl: String(req.body?.imageUrl || look.outfit.imageUrl || ''),
      approved: true,
    });
    res.json({ saved: true, item });
  } catch (error) {
    console.error('Appearance approve error:', error);
    res.status(500).json({ error: 'Could not save that look.' });
  }
};

export const listAppearanceLooksHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const items = await listAppearanceLooks(userId);
    const groups = [...new Set(items.map((i) => i.group))];
    res.json({ items, groups });
  } catch (error) {
    console.error('Appearance wardrobe list error:', error);
    res.status(500).json({ error: 'Could not load saved looks' });
  }
};

export const deleteAppearanceLookHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const ok = await deleteAppearanceLook(userId, String(req.params.id || ''));
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Appearance wardrobe delete error:', error);
    res.status(500).json({ error: 'Could not delete look' });
  }
};
