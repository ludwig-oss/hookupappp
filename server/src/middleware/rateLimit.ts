import rateLimit from 'express-rate-limit';

const getWindowMs = (minutes: number) => minutes * 60 * 1000;

/** Strict limit on signup per IP to prevent spam accounts */
export const signupLimiter = rateLimit({
  windowMs: getWindowMs(15),
  max: 5,
  message: { error: 'Too many signup attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Limit login attempts per IP */
export const loginLimiter = rateLimit({
  windowMs: getWindowMs(15),
  max: 20,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** General API rate limit per IP (applied to /api/*) */
export const apiLimiter = rateLimit({
  windowMs: getWindowMs(1),
  max: 120,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
