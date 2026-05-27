import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { dbContext } from '../db/context.js';
import { getUserById } from '../models/user.js';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production (min 32 characters). Set it in server/.env');
  }
  return secret || 'dev-only-secret-do-not-use-in-production';
}

export interface AuthRequest extends Request {
  userId?: string;
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId?: string | number; email?: string };
    const uid = decoded.userId != null ? String(decoded.userId) : '';
    if (!uid) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Suspension gate (serious-users only enforcement)
    try {
      const u = await getUserById(uid);
      const until = u?.suspensionUntil ? new Date(u.suspensionUntil).getTime() : 0;
      if (until && until > Date.now()) {
        return res.status(403).json({
          error: u?.suspensionReason || 'Account suspended',
          suspensionUntil: u?.suspensionUntil,
        });
      }
    } catch {
      // If user lookup fails, continue; token auth still works for dev/offline
    }

    req.userId = uid;
    if (req.body && typeof req.body === 'object') {
      if ('userId' in req.body) req.body.userId = uid;
      if ('fromUserId' in req.body) req.body.fromUserId = uid;
    }
    dbContext.run({ mode: 'user', userId: uid }, () => next());
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};








