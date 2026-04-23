/**
 * routes/siege.js
 * Governor Siege API (BIBLE Migration 082)
 *
 * POST /api/siege/declare                → Siege 선언
 * GET  /api/siege/:sectorCode            → 활성 Siege 조회
 * GET  /api/siege/history/:sectorCode    → Siege 완료 목록
 * GET  /api/siege/status/:siegeId        → Siege 상세
 * POST /api/governor/declaration         → Governor 선언문 업데이트
 * PUT  /api/governor/tax-rate            → 세율 변경
 * PUT  /api/governor/policy              → 섹터 정책 변경
 */

'use strict';

const express = require('express');
const router = express.Router();
const siegeService = require('../services/siege');

// ─────────────────────────────────────────────────────────────
// POST /api/siege/declare — Siege 선언
// body: { wallet, sectorCode }
// ─────────────────────────────────────────────────────────────
router.post('/siege/declare', async (req, res) => {
  const { wallet, sectorCode } = req.body || {};
  if (!wallet || !sectorCode) {
    return res.status(400).json({ error: 'wallet and sectorCode required' });
  }
  try {
    const result = await siegeService.declareSiege(wallet, sectorCode);
    if (!result.success) {
      return res.status(400).json({ error: result.error, detail: result });
    }
    res.json(result);
  } catch (err) {
    console.error('[SIEGE] declare error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/siege/:sectorCode — 활성 Siege 조회
// ─────────────────────────────────────────────────────────────
router.get('/siege/:sectorCode', async (req, res) => {
  const code = req.params.sectorCode.toLowerCase();
  try {
    const siege = await siegeService.getActiveSiege(code);
    if (!siege) return res.json({ active: false });
    res.json({ active: true, siege });
  } catch (err) {
    console.error('[SIEGE] getActive error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/siege/history/:sectorCode — Siege 완료 목록
// query: limit (default 10)
// ─────────────────────────────────────────────────────────────
router.get('/siege/history/:sectorCode', async (req, res) => {
  const code  = req.params.sectorCode.toLowerCase();
  const limit = Math.min(parseInt(req.query.limit ?? '10'), 50);
  try {
    const history = await siegeService.getSiegeHistory(code, limit);
    res.json({ history });
  } catch (err) {
    console.error('[SIEGE] history error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/siege/status/:siegeId — Siege 상세
// ─────────────────────────────────────────────────────────────
router.get('/siege/status/:siegeId', async (req, res) => {
  const id = parseInt(req.params.siegeId);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid siege id' });
  try {
    const siege = await siegeService.getSiegeStatus(id);
    if (!siege) return res.status(404).json({ error: 'siege not found' });
    res.json(siege);
  } catch (err) {
    console.error('[SIEGE] status error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/governor/declaration — 선언문 업데이트
// body: { wallet, sectorCode, text }
// ─────────────────────────────────────────────────────────────
router.post('/governor/declaration', async (req, res) => {
  const { wallet, sectorCode, text } = req.body || {};
  if (!wallet || !sectorCode || !text) {
    return res.status(400).json({ error: 'wallet, sectorCode, text required' });
  }
  if (text.length > 1000) {
    return res.status(400).json({ error: 'text too long (max 1000 chars)' });
  }
  try {
    const result = await siegeService.updateGovernorDeclaration(wallet, sectorCode, text);
    if (!result.success) return res.status(400).json({ error: result.error, detail: result });
    res.json(result);
  } catch (err) {
    console.error('[SIEGE] declaration error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/governor/tax-rate — 세율 변경
// body: { wallet, sectorCode, taxRate }
// ─────────────────────────────────────────────────────────────
router.put('/governor/tax-rate', async (req, res) => {
  const { wallet, sectorCode, taxRate } = req.body || {};
  if (!wallet || !sectorCode || taxRate === undefined) {
    return res.status(400).json({ error: 'wallet, sectorCode, taxRate required' });
  }
  try {
    const result = await siegeService.updateTaxRate(wallet, sectorCode, taxRate);
    if (!result.success) return res.status(400).json({ error: result.error, detail: result });
    res.json(result);
  } catch (err) {
    console.error('[SIEGE] taxRate error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/governor/policy — 섹터 정책 변경
// body: { wallet, sectorCode, policy }
// ─────────────────────────────────────────────────────────────
router.put('/governor/policy', async (req, res) => {
  const { wallet, sectorCode, policy } = req.body || {};
  if (!wallet || !sectorCode || !policy) {
    return res.status(400).json({ error: 'wallet, sectorCode, policy required' });
  }
  try {
    const result = await siegeService.updateSectorPolicy(wallet, sectorCode, policy);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error('[SIEGE] policy error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/sieges — 어드민: 전체 Siege 목록
// ─────────────────────────────────────────────────────────────
router.get('/admin/sieges', async (req, res) => {
  const { status = 'all', limit = 50 } = req.query;
  try {
    const { pool } = require('../db');
    const lim = Math.min(parseInt(limit), 200);
    const where = status === 'all' ? '' : `WHERE gs.status = '${status}'`;
    const result = await pool.query(
      `SELECT gs.*,
              uc.nickname AS challenger_nickname,
              ud.nickname AS defender_nickname,
              uw.nickname AS winner_nickname
       FROM governor_sieges gs
       LEFT JOIN users uc ON uc.wallet_address = gs.challenger_wallet
       LEFT JOIN users ud ON ud.wallet_address = gs.defender_wallet
       LEFT JOIN users uw ON uw.wallet_address = gs.winner_wallet
       ${where}
       ORDER BY gs.declared_at DESC LIMIT $1`,
      [lim]
    );
    res.json({ sieges: result.rows });
  } catch (err) {
    console.error('[SIEGE] admin list error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/sieges/:siegeId/resolve — 어드민: 강제 Siege 종료
// ─────────────────────────────────────────────────────────────
router.post('/admin/sieges/:siegeId/resolve', async (req, res) => {
  const id = parseInt(req.params.siegeId);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid siege id' });
  try {
    const result = await siegeService.resolveSiege(id);
    res.json(result);
  } catch (err) {
    console.error('[SIEGE] admin resolve error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;
