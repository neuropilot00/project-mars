// server/routes/transport.js
// ═══════════════════════════════════════════════════════════════
// Phase C — Transport + Raid API routes
// ═══════════════════════════════════════════════════════════════
'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { makeRateLimiter } = require('../utils/rateLimiters');
const transportSvc = require('../services/transport');

const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 90,
  message: { error: 'Too many transport requests. Please slow down.' }
});
const writeLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many transport actions. Please wait.' }
});

// JWT 인증 미들웨어 — wallet body 신뢰 없음
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};

function getWalletFromToken(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}
function getOptionalWalletFromToken(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return '';
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    return (user?.wallet_address || user?.wallet || user?.walletAddress || '').toLowerCase().trim();
  } catch (_) {
    return '';
  }
}

// ── Public settings (UI consumes this for pricing preview) ──
router.get('/transport/settings', readLimiter, async (req, res) => {
  try {
    const s = await transportSvc.getSettings();
    res.json(s);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Start a shipment ──
router.post('/transport/start', requireAuth, writeLimiter, async (req, res) => {
  const wallet = getWalletFromToken(req);
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });
  const { originSectorId, destSectorId, cargoGp } = req.body || {};
  const origin = parseInt(originSectorId);
  const dest = parseInt(destSectorId);
  const cargo = parseInt(cargoGp);
  if (!origin || !dest) return res.status(400).json({ error: 'sector_ids_required' });
  if (!cargo) return res.status(400).json({ error: 'cargo_gp_required' });

  const r = await transportSvc.startTransport(wallet, origin, dest, cargo);
  if (!r.success) return res.status(400).json(r);
  res.json(r);
});

// ── My shipments ──
router.get('/transport/my', requireAuth, readLimiter, async (req, res) => {
  const wallet = getWalletFromToken(req);
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });
  const limit = parseInt(req.query.limit) || 20;
  try {
    const rows = await transportSvc.getMyTransports(wallet, limit);
    res.json({ transports: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── List raidable targets ──
router.get('/transport/raids/targets', readLimiter, async (req, res) => {
  const wallet = getOptionalWalletFromToken(req); // may be empty (anonymous preview)
  const limit = parseInt(req.query.limit) || 30;
  try {
    const rows = await transportSvc.getActiveRaidTargets(wallet || null, limit);
    res.json({ targets: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Attempt a raid ──
router.post('/transport/raid', requireAuth, writeLimiter, async (req, res) => {
  const wallet = getWalletFromToken(req);
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });
  const transportId = parseInt(req.body?.transportId);
  if (!transportId) return res.status(400).json({ error: 'transport_id_required' });

  const r = await transportSvc.attemptRaid(wallet, transportId);
  if (!r.success) return res.status(400).json(r);
  res.json(r);
});

// ── Cancel shipment ──
router.post('/transport/cancel', requireAuth, writeLimiter, async (req, res) => {
  const wallet = getWalletFromToken(req);
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });
  const transportId = parseInt(req.body?.transportId);
  if (!transportId) return res.status(400).json({ error: 'transport_id_required' });

  const r = await transportSvc.cancelTransport(wallet, transportId);
  if (!r.success) return res.status(400).json(r);
  res.json(r);
});

module.exports = router;
