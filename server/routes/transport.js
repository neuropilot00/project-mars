// server/routes/transport.js
// ═══════════════════════════════════════════════════════════════
// Phase C — Transport + Raid API routes
// ═══════════════════════════════════════════════════════════════
'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const transportSvc = require('../services/transport');

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
function getWallet(req) {
  return (req.body?.wallet || req.headers['x-wallet'] || req.query.wallet || '').toLowerCase().trim();
}
function requireWallet(req, res) {
  const w = getWallet(req);
  if (!w || w.length < 10) { res.status(400).json({ error: 'wallet_required' }); return null; }
  return w;
}

// ── Public settings (UI consumes this for pricing preview) ──
router.get('/transport/settings', async (req, res) => {
  try {
    const s = await transportSvc.getSettings();
    res.json(s);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Start a shipment ──
router.post('/transport/start', requireAuth, async (req, res) => {
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
router.get('/transport/my', requireAuth, async (req, res) => {
  const wallet = getWalletFromToken(req);
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });
  const limit = parseInt(req.query.limit) || 20;
  try {
    const rows = await transportSvc.getMyTransports(wallet, limit);
    res.json({ transports: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── List raidable targets ──
router.get('/transport/raids/targets', async (req, res) => {
  const wallet = getWallet(req); // may be empty (anonymous preview)
  const limit = parseInt(req.query.limit) || 30;
  try {
    const rows = await transportSvc.getActiveRaidTargets(wallet || null, limit);
    res.json({ targets: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Attempt a raid ──
router.post('/transport/raid', requireAuth, async (req, res) => {
  const wallet = getWalletFromToken(req);
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });
  const transportId = parseInt(req.body?.transportId);
  if (!transportId) return res.status(400).json({ error: 'transport_id_required' });

  const r = await transportSvc.attemptRaid(wallet, transportId);
  if (!r.success) return res.status(400).json(r);
  res.json(r);
});

// ── Cancel shipment ──
router.post('/transport/cancel', requireAuth, async (req, res) => {
  const wallet = getWalletFromToken(req);
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });
  const transportId = parseInt(req.body?.transportId);
  if (!transportId) return res.status(400).json({ error: 'transport_id_required' });

  const r = await transportSvc.cancelTransport(wallet, transportId);
  if (!r.success) return res.status(400).json(r);
  res.json(r);
});

module.exports = router;
