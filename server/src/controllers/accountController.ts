import { Response } from 'express';
import { purgeAccount, setAccountPaused } from '../models/accountLifecycle.js';
import type { AuthRequest } from '../middleware/auth.js';

export async function pauseAccount(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    const paused = req.body?.paused === true || req.body?.isPaused === true;
    const user = await setAccountPaused(userId, paused);
    if (!user) return res.status(404).json({ error: 'Account not found' });
    return res.json({ isPaused: user.isPaused === true });
  } catch (err) {
    console.error('Pause account error:', err);
    return res.status(500).json({ error: 'Could not update pause. Try again.' });
  }
}

export async function deleteAccount(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    await purgeAccount(userId);
    return res.json({ ok: true });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 404) return res.status(404).json({ error: 'Account not found' });
    console.error('Delete account error:', err);
    return res.status(500).json({ error: 'Could not delete the account. Try again.' });
  }
}
