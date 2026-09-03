import { Response, NextFunction } from 'express';
import { getPhotoLockStatus } from '../models/photoVerification.js';
import type { AuthRequest } from './auth.js';

export async function requirePhotoUnlocked(req: AuthRequest, res: Response, next: NextFunction) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const status = await getPhotoLockStatus(userId);
    if (status?.locked) {
      return res.status(403).json({
        error: status.message,
        code: 'PHOTO_VERIFICATION_REQUIRED',
        photoLock: status,
      });
    }
    next();
  } catch (err) {
    console.error('Photo lock check failed:', err);
    next();
  }
}
