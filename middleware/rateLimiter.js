const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redisClient = require('../utils/redis');

// Create a unified Redis store configuration
const createRedisStore = (prefix) => new RedisStore({
  sendCommand: (...args) => redisClient.sendCommand(args),
  prefix: `rtlimit_${prefix}:`
});

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
  store: createRedisStore('general'),
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
  store: createRedisStore('auth'),
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
  store: createRedisStore('strict'),
});

/**
 * Contact form — prevent spam submissions (5 per hour per IP).
 */
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { status: 'error', message: 'Too many contact submissions; please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('contact'),
});

/**
 * Setup routes — protect initial admin creation (3 per hour per IP).
 */
const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { status: 'error', message: 'Too many setup attempts; try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('setup'),
});

/**
 * Single email validation — per-user limit (30 per minute).
 * Falls back to IP if user is not authenticated.
 */
const validationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { status: 'error', message: 'Validation rate limit exceeded; please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('validation'),
});

/**
 * Bulk validation — per-user limit (10 per hour).
 */
const bulkValidationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { status: 'error', message: 'Bulk validation rate limit exceeded; try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('bulk_validation'),
});

/**
 * API key creation — per-user limit (10 per hour).
 */
const apiKeyCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { status: 'error', message: 'Too many API key creation requests; try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('apikey_creation'),
});

module.exports = {
  generalLimiter,
  authLimiter,
  strictLimiter,
  contactLimiter,
  setupLimiter,
  validationLimiter,
  bulkValidationLimiter,
  apiKeyCreationLimiter,
};
