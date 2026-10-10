'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const { requireAdmin } = require('../middleware/adminAuth');
const { recordProductEvent, getProductAnalyticsSummary, UUID_RE } = require('../services/productAnalytics');

const router = express.Router();
const CLIENT_EVENTS = new Set(['session_start', 'ui_view']);

function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.user = jwt.verify(authorization.slice(7), process.env.JWT_SECRET);
    next();
  } catch (_) {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
}

function getWallet(user) {
  return (user?.wallet_address || user?.wallet || user?.walletAddress || '').toLowerCase().trim();
}

function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

function isoDay(date) { return date.toISOString().slice(0, 10); }

// Browser-originated events cannot claim gameplay, purchase, or completion events.
router.post('/client-event', requireAuth, async (req, res) => {
  const { eventName, sessionId, eventKey } = req.body || {};
  if (!CLIENT_EVENTS.has(eventName) || !UUID_RE.test(String(sessionId || '')) || !UUID_RE.test(String(eventKey || ''))) {
    return res.status(400).json({ error: 'INVALID_EVENT' });
  }
  const metadata = {};
  if (eventName === 'ui_view' && typeof req.body.view === 'string') {
    const view = req.body.view.trim().slice(0, 80);
    if (/^[a-zA-Z0-9/_#-]*$/.test(view)) metadata.view = view;
  }
  try {
    const result = await recordProductEvent({
      wallet: getWallet(req.user), sessionId, eventName, eventKey, metadata, source: 'client'
    });
    if (result.reason === 'user_not_found') return res.status(401).json({ error: 'USER_NOT_FOUND' });
    return res.status(202).json({ accepted: true, duplicate: Boolean(result.duplicate) });
  } catch (_) {
    return res.status(500).json({ error: 'ANALYTICS_UNAVAILABLE' });
  }
});

// Private operator report. It returns aggregates only; no wallet addresses or raw events.
router.get('/admin/summary', requireAdmin, async (req, res) => {
  const today = new Date();
  const to = parseDay(req.query.to) || isoDay(today);
  const from = parseDay(req.query.from) || isoDay(new Date(today.valueOf() - 29 * 86400000));
  const startMs = Date.parse(`${from}T00:00:00.000Z`);
  const endMs = Date.parse(`${to}T00:00:00.000Z`);
  const days = Math.floor((endMs - startMs) / 86400000) + 1;
  if (days < 1 || days > 90) return res.status(400).json({ error: 'DATE_RANGE_MUST_BE_1_TO_90_DAYS' });
  try {
    const summary = await getProductAnalyticsSummary({ from, to });
    return res.json({
      from, to,
      definitions: {
        dau: 'Distinct authenticated non-AI, non-test users with a non-session_start product event that day.',
        sessions: 'Distinct browser session UUIDs across all accepted product events that day.',
        funnel: 'Distinct users by first battle, ended battle, and second battle events in the selected window.'
      },
      ...summary
    });
  } catch (_) {
    return res.status(500).json({ error: 'ANALYTICS_UNAVAILABLE' });
  }
});

module.exports = router;
