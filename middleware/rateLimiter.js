const rateLimit = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_GENERAL = 300;          // per IP for general API
const MAX_AUTH = 20;              // per IP for login/register/forgot-password
const MAX_STRICT = 5;             // per IP for password reset / verify

/**
 * General API rate limit — apply to all /api routes.
 * Stricter limits can be applied per-route.
 */
const generalLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_GENERAL,
  message: { status: 'error', message: 'Too many requests; please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.originalUrl.startsWith('/api/health'),
});

/**
 * Auth routes (login, register, forgot-password) — prevent brute force.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: MAX_AUTH,
  message: { status: 'error', message: 'Too many auth attempts; try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict limit for sensitive one-time actions (reset password, verify email).
 */
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: MAX_STRICT,
  message: { status: 'error', message: 'Too many attempts; try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  authLimiter,
  strictLimiter,
};
