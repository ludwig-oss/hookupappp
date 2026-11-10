import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import {
  ScoutError,
  acceptInterest,
  addAvailability,
  addExpense,
  addGoal,
  confirmBlue,
  findProfessions,
  getScoutState,
  joinSpeedDate,
  logMediation,
  rejectInterest,
  runCycle,
  saveHouse,
  saveScoutProfile,
  showInterest,
  signContract,
  terminatePartnership,
} from '../scout/service.js';

function userIdOf(req: Request): string | null {
  const id = (req as AuthRequest).userId;
  return id ? String(id) : null;
}

function sendError(res: Response, error: unknown) {
  if (error instanceof ScoutError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error('Scout error:', error);
  res.status(500).json({ error: 'Internal server error' });
}

export async function getState(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await getScoutState(userId));
  } catch (error) {
    sendError(res, error);
  }
}

export async function getProfessions(req: Request, res: Response) {
  res.json({ professions: findProfessions(String(req.query.q || '')) });
}

export async function putProfile(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await saveScoutProfile(userId, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
}

export async function postCycle(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await runCycle(userId, req.body?.professionId));
  } catch (error) {
    sendError(res, error);
  }
}

export async function postInterest(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await showInterest(userId, String(req.body?.targetUserId || ''), req.body?.mode));
  } catch (error) {
    sendError(res, error);
  }
}

export async function postAccept(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await acceptInterest(userId, String(req.params.id || '')));
  } catch (error) {
    sendError(res, error);
  }
}

export async function postReject(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await rejectInterest(userId, String(req.params.id || '')));
  } catch (error) {
    sendError(res, error);
  }
}

async function partnershipAction(req: Request, res: Response, run: (userId: string, id: string) => Promise<unknown>) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await run(userId, String(req.params.id || '')));
  } catch (error) {
    sendError(res, error);
  }
}

export function postSign(req: Request, res: Response) {
  return partnershipAction(req, res, signContract);
}

export function postJoin(req: Request, res: Response) {
  return partnershipAction(req, res, joinSpeedDate);
}

export function postBlue(req: Request, res: Response) {
  return partnershipAction(req, res, confirmBlue);
}

export function postTerminate(req: Request, res: Response) {
  return partnershipAction(req, res, (userId, id) => terminatePartnership(userId, id, String(req.body?.reason || '')));
}

export async function postAvailability(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await addAvailability(userId, String(req.params.id || ''), req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
}

export async function postExpense(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await addExpense(userId, String(req.params.id || ''), req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
}

export async function postHouse(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await saveHouse(userId, String(req.params.id || ''), req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
}

export async function postGoal(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await addGoal(userId, String(req.params.id || ''), String(req.body?.label || '')));
  } catch (error) {
    sendError(res, error);
  }
}

export async function postMediate(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await logMediation(userId, String(req.params.id || ''), String(req.body?.text || '')));
  } catch (error) {
    sendError(res, error);
  }
}
