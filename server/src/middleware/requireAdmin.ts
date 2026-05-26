import { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';

export function isAdminUserId(userId: string | undefined): boolean {
  if (!userId) return false;
  const ids = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

/** Requires authenticateToken first. */
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.userId;
  const headerSecret = req.headers['x-admin-secret'];
  const envSecret = process.env.ADMIN_SECRET?.trim();

  if (envSecret && headerSecret === envSecret) {
    return next();
  }
  if (isAdminUserId(userId)) {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
};
