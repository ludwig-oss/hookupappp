import { Response, NextFunction } from 'express';
import { getUserById } from '../models/user.js';
import type { AuthRequest } from './auth.js';

/**
 * Use after authenticateToken. Returns 403 if the user is not email-verified.
 * Apply to routes that require a verified account (posting, matching, chat, etc.).
 */
export async function requireEmailVerified(req: AuthRequest, res: Response, next: NextFunction) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  const user = await getUserById(userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  if (!user.emailVerified) {
    return res.status(403).json({
      error: 'Email verification required',
      code: 'EMAIL_VERIFICATION_REQUIRED',
      message: 'Please verify your email or phone to use this feature.',
    });
  }
  next();
}
