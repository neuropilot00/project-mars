'use strict';

const crypto = require('node:crypto');
const { createService, TotpAuthError } = require('../services/totpAuth');

function sameOrigin(req) {
  try {
    const origin = req.get('origin');
    const url = new URL(origin);
    const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.get('host') || '');
    return origin === url.origin && url.origin === `${req.protocol}://${req.get('host')}` &&
      !url.username && !url.password && (url.protocol === 'https:' || (url.protocol === 'http:' && local)) &&
      !['cross-site', 'none'].includes(req.get('sec-fetch-site'));
  } catch (_) { return false; }
}

function createRouter(options = {}) {
  const express = options.express || require('express');
  const router = express.Router();
  const clock = options.clock || Date.now;
  const buckets = new Map();
  const service = options.service || createService({
    pool: options.pool || { connect: () => require('../db').pool.connect() },
    signToken: options.signToken || ((claims, jwtOptions) => {
      if (!process.env.JWT_SECRET) throw new Error('unconfigured');
      return require('jsonwebtoken').sign(claims, process.env.JWT_SECRET, jwtOptions);
    }),
    clock,
    ...Object.fromEntries(['randomBytes', 'enabled', 'encryptionKey', 'jwtConfigured', 'primitives']
      .filter(name => options[name]).map(name => [name, options[name]])),
  });
  const limits = { config: 60, start: 3, verify: 15, activate: 10, login: 20, recover: 10, ...options.limits };
  function limited(action, req, res) {
    const now = clock();
    for (const [id, bucket] of buckets) if (bucket.until <= now) buckets.delete(id);
    // Never persist an IP or user identifier. In-memory counters expire quickly.
    const source = crypto.createHash('sha256').update(String(req.ip || req.socket?.remoteAddress || 'unknown')).digest('hex');
    const id = action + ':' + source;
    const prior = buckets.get(id);
    if (!prior && buckets.size >= 5000) { res.status(429).json({ error: 'auth_rate_limited' }); return true; }
    const bucket = prior || { count: 0, until: now + (action === 'start' ? 300000 : 60000) };
    bucket.count++; buckets.set(id, bucket);
    if (bucket.count <= limits[action]) return false;
    res.set('Retry-After', String(Math.max(1, Math.ceil((bucket.until - now) / 1000))));
    res.status(429).json({ error: 'auth_rate_limited' }); return true;
  }
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store'); res.set('Pragma', 'no-cache'); res.set('Referrer-Policy', 'no-referrer');
    if (req.method === 'POST' && !sameOrigin(req)) return res.status(403).json({ error: 'auth_origin_required' });
    if (req.method === 'POST' && !/^application\/json(?:\s*;|$)/i.test(req.get('content-type') || '')) {
      return res.status(415).json({ error: 'auth_json_required' });
    }
    return next();
  });
  const handle = (action, operation) => async (req, res) => {
    if (limited(action, req, res)) return;
    try {
      if (action !== 'config' && !service.config().enabled) throw new TotpAuthError('auth_unavailable', 503);
      res.json(await operation(req.body || {}));
    } catch (error) {
      const expected = error instanceof TotpAuthError;
      res.status(expected ? error.status : 503).json({ error: expected ? error.code : 'auth_unavailable' });
    }
  };
  router.get('/config', handle('config', () => service.availableConfig ? service.availableConfig() : service.config()));
  router.post('/enroll/start', handle('start', service.start));
  router.post('/enroll/verify', handle('verify', service.verify));
  router.post('/enroll/activate', handle('activate', service.activate));
  router.post('/login', handle('login', service.login));
  router.post('/recover', handle('recover', service.recover));
  // Root integration must use this checker after JWT signature/expiry validation
  // on ALL HTTP/WS authorization paths, including body-token legacy endpoints.
  router.checkSession = service.checkSession;
  return router;
}

module.exports = { createRouter, sameOrigin };
