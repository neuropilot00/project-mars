'use strict';
/**
 * routes/battle.js
 * Naval Battle Engine API (Migration 093)
 *
 * GET  /api/battles                     → 활성 전투 목록
 * GET  /api/battle/:id                  → 전투 상세 + 함선 목록
 * POST /api/battle/declare              → 전투 선포 { wallet, defenderWallet, shipIds[], gpStake }
 * POST /api/battle/:id/accept           → 수비 응전 { wallet, shipIds[] }
 * POST /api/battle/:id/cancel           → 취소 { wallet }
 * GET  /api/user/battles                → 내 전투 목록
 * POST /api/admin/battle/:id/resolve    → 어드민 강제 해결
 */

const express = require('express');
const router  = express.Router();
const battleService = require('../services/battle');

function getWallet(req) {
  return (req.body?.wallet || req.headers['x-wallet'] || req.query.wallet || '').toLowerCase().trim();
}
function requireWallet(req, res) {
  const w = getWallet(req);
  if (!w || w.length < 10) { res.status(400).json({ error: 'wallet_required' }); return null; }
  return w;
}
function requireAdmin(req, res) {
  const s = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  if (!s || s !== process.env.ADMIN_SECRET) { res.status(403).json({ error: 'forbidden' }); return false; }
  return true;
}

// ── GET /api/battles ──
router.get('/battles', async (req, res) => {
  try {
    const battles = await battleService.getActiveBattles(parseInt(req.query.limit || '20'));
    res.json({ battles });
  } catch (err) {
    console.error('[BATTLE] list error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /api/battle/:id ──
router.get('/battle/:id', async (req, res) => {
  try {
    const battle = await battleService.getBattle(parseInt(req.params.id));
    if (!battle) return res.status(404).json({ error: 'not_found' });
    res.json(battle);
  } catch (err) {
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/battle/declare ──
router.post('/battle/declare', async (req, res) => {
  const wallet = requireWallet(req, res);
  if (!wallet) return;
  const { defenderWallet, shipIds, gpStake } = req.body;
  if (!defenderWallet) return res.status(400).json({ error: 'defender_wallet_required' });
  if (!shipIds || !Array.isArray(shipIds) || !shipIds.length)
    return res.status(400).json({ error: 'ship_ids_required' });
  try {
    const result = await battleService.declareBattle(wallet, defenderWallet.toLowerCase().trim(), shipIds, gpStake);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[BATTLE] declare error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/battle/:id/accept ──
router.post('/battle/:id/accept', async (req, res) => {
  const wallet = requireWallet(req, res);
  if (!wallet) return;
  const { shipIds = [] } = req.body;
  try {
    const result = await battleService.acceptBattle(wallet, parseInt(req.params.id), shipIds);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[BATTLE] accept error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/battle/:id/cancel ──
router.post('/battle/:id/cancel', async (req, res) => {
  const wallet = requireWallet(req, res);
  if (!wallet) return;
  try {
    const result = await battleService.cancelBattle(wallet, parseInt(req.params.id));
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /api/user/battles ──
router.get('/user/battles', async (req, res) => {
  const wallet = requireWallet(req, res);
  if (!wallet) return;
  try {
    const battles = await battleService.getUserBattles(wallet);
    res.json({ battles });
  } catch (err) {
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── ADMIN: POST /api/admin/battle/:id/resolve ──
router.post('/admin/battle/:id/resolve', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await battleService.resolveBattle(parseInt(req.params.id));
    res.json(result);
  } catch (err) {
    console.error('[BATTLE] admin resolve error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
