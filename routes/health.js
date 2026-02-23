const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

/**
 * GET /api/health
 * Unified health check for load balancers and monitoring.
 * Returns 200 with { status, mongodb, timestamp }.
 */
router.get('/', async (req, res) => {
  const mongodb = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const ok = mongodb === 'connected';

  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    mongodb,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

/**
 * GET /api/health/live
 * Liveness probe — is the process up?
 */
router.get('/live', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * GET /api/health/ready
 * Readiness probe — can we accept traffic? (DB connected)
 */
router.get('/ready', async (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    ready,
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

module.exports = router;
