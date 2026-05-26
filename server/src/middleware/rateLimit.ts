import rateLimit from 'express-rate-limit';
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

/** General API rate limit per IP (applied to /api/*) */
export const apiLimiter = rateLimit({
  windowMs: getWindowMs(1),
  max: isProd ? 180 : 600,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: isProd },
  keyGenerator: (req) => `api:${clientIp(req)}`,
});
