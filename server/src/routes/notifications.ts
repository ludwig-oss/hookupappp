import express from 'express';
import jwt from 'jsonwebtoken';
import { subscribe } from '../realtime/notifications.js';
import { addPushSubscription } from '../realtime/push.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') return '';
  return secret || 'dev-only-secret-do-not-use-in-production';
}

/**
 * GET /api/notifications/stream?token=<JWT>
 * Server-Sent Events stream for real-time notifications (new message, new match).
 * EventSource doesn't support headers, so token is passed in query. Prefer short-lived tokens in production.
 */
router.get('/stream', (req, res) => {
  const token = (req.query.token as string)?.trim();
  if (!token) {
    return res.status(401).json({ error: 'Token required. Use ?token=<JWT>.' });
  }

  let userId: string;
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
    userId = decoded.userId;
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx
  res.flushHeaders();

  subscribe(userId, res);

  // Keep-alive every 30s so proxies don't close the connection
  const interval = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(interval);
      return;
    }
    res.write(': keep-alive\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

/**
 * POST /api/notifications/push-subscribe
 * Register a Web Push subscription for the current user (from PushManager.subscribe() in the client).
 * Body: { subscription: { endpoint, keys: { p256dh, auth }, expirationTime? } }
 */
router.post('/push-subscribe', authenticateToken, async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { subscription } = req.body;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription. Send { subscription: { endpoint, keys: { p256dh, auth } } }.' });
  }
  await addPushSubscription(userId, {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    expirationTime: subscription.expirationTime ?? null,
  });
  res.json({ ok: true, message: 'Push subscription saved.' });
});

export default router;
