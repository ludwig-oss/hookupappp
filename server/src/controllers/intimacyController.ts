import { Request, Response } from 'express';
import {
  INTIMACY_POSITIONS,
  briefingTips,
  nextPosition,
  positionById,
  tipsForPosition,
} from '../data/intimacyCatalog.js';
import {
  defaultSideForGender,
  parseTermActSide,
  termActById,
  termActList,
} from '../data/termActCatalog.js';
import { getUserById } from '../models/user.js';

export const intimacyRoutineHandler = async (_req: Request, res: Response) => {
  try {
    res.json({
      count: INTIMACY_POSITIONS.length,
      briefing: briefingTips(),
      positions: INTIMACY_POSITIONS,
      disclaimer:
        'Adults only. Both people opt in. Pain, numbness, or “wait” stops the position. This is a pace guide, not a performance test.',
    });
  } catch (error) {
    console.error('Intimacy routine error:', error);
    res.status(500).json({ error: 'Could not load the bedroom flow.' });
  }
};

export const intimacyStepHandler = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id || req.query.id || 1);
    const pos = positionById(id) || INTIMACY_POSITIONS[0];
    const idx = Math.max(0, INTIMACY_POSITIONS.findIndex((p) => p.id === pos.id));
    const tips = tipsForPosition(pos, idx);
    const nxt = nextPosition(pos);
    res.json({
      position: pos,
      index: idx,
      total: INTIMACY_POSITIONS.length,
      next: { id: nxt.id, name: nxt.name },
      tips,
      speak: `${pos.name}. ${tips.now.line} ${tips.extra.kind === 'dont' ? tips.extra.line : ''}`.trim(),
    });
  } catch (error) {
    console.error('Intimacy step error:', error);
    res.status(500).json({ error: 'Could not open that position.' });
  }
};

export const termActListHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const user = userId ? await getUserById(userId) : null;
    const side = req.query.side
      ? parseTermActSide(req.query.side)
      : defaultSideForGender(user?.gender);
    const list = termActList(side);
    res.json({
      side,
      defaultSide: defaultSideForGender(user?.gender),
      gender: user?.gender || null,
      count: list.length,
      tactics: list,
      disclaimer:
        'Adults only. Both people opt in. Pain, numbness, or “wait” stops the tactic. Clinical pace guide — not a performance test. Use earphones if you want spoken cues; otherwise keep the screen dim and out of sight.',
    });
  } catch (error) {
    console.error('TermAct list error:', error);
    res.status(500).json({ error: 'Could not load TermAct.' });
  }
};

export const termActStepHandler = async (req: Request, res: Response) => {
  try {
    const side = parseTermActSide(req.query.side || req.params.side);
    const id = Number(req.params.id || req.query.id || 1);
    const tactic = termActById(side, id);
    const next = termActById(side, tactic.next_id);
    const prevId = tactic.id === 1 ? 80 : tactic.id - 1;
    const prev = termActById(side, prevId);
    res.json({
      side,
      tactic,
      next: { id: next.id, name: next.name },
      prev: { id: prev.id, name: prev.name },
      total: 80,
      speak: `${tactic.id}. ${tactic.name}. ${tactic.category}. ${tactic.description}`,
    });
  } catch (error) {
    console.error('TermAct step error:', error);
    res.status(500).json({ error: 'Could not open that tactic.' });
  }
};
