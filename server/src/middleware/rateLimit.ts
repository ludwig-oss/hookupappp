import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';

const getWindowMs = (minutes: number) => minutes * 60 * 1000;

/** Prefer real client IP when behind Vercel / Render proxy. */
function clientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0].trim();
  }
  if (Array.isArray(xf) && xf[0]) {
    return String(xf[0]).trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  return req.ip || 'unknown';
}

const isProd = process.env.NODE_ENV === 'production';

/** Signup limit — was 5/15min which blocked real users (and all Vercel traffic sharing one IP). */
export const signupLimiter = rateLimit({
  windowMs: getWindowMs(15),
  max: isProd ? 40 : 200,
  message: { error: 'Too many signup attempts from your network. Wait 15 minutes or try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: isProd },
  keyGenerator: (req) => `signup:${clientIp(req)}`,
  handler: (req, res, _next, options) => {
    res.status(429).json(options.message);
  },
});

/** Limit login attempts per IP */
export const loginLimiter = rateLimit({
  windowMs: getWindowMs(15),
  max: isProd ? 40 : 200,
  message: { error: 'Too many login attempts. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: isProd },
  keyGenerator: (req) => `login:${clientIp(req)}`,
});

function authedUserId(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.decode(header.slice(7));
    if (decoded && typeof decoded === 'object' && decoded.userId != null) {
      return String(decoded.userId);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function isReadRequest(req: Request): boolean {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
  const path = `${req.originalUrl || ''} ${req.path || ''}`.toLowerCase();
  return path.includes('/health');
}

/** Location pings while Connections is open — not the user hammering the server. */
function isLocationHeartbeat(req: Request): boolean {
  const method = (req.method || '').toUpperCase();
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') return false;
  const path = `${req.originalUrl || ''} ${req.path || ''}`.toLowerCase();
  return (
    path.includes('/connections/location') ||
    path.includes('/nearby/location') ||
    /walk-match.*location|location.*walk-match/.test(path)
  );
}

/**
 * Writes only, keyed by the signed-in person (not a shared Vercel/Render IP).
 * Polling GET nearby/buzzes/profile must never trip this — that is not "too many requests".
 */
export const apiLimiter = rateLimit({
  windowMs: getWindowMs(1),
  max: isProd ? 180 : 800,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: isProd },
  skip: (req) => isReadRequest(req) || isLocationHeartbeat(req),
  keyGenerator: (req) => {
    const uid = authedUserId(req);
    if (uid) return `api:user:${uid}`;
    return `api:ip:${clientIp(req)}`;
  },
  handler: (req, res, _next, options) => {
    res.status(429).json(options.message);
  },
});
