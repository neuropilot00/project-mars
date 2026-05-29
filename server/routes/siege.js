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
const jwt = require('jsonwebtoken');
const siegeService = require('../services/siege');

// JWT auth middleware — wallet extracted from verified token, body.wallet is ignored
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};

function requireAdmin(req, res) {
  const s = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  if (!s || s !== process.env.ADMIN_SECRET) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────
// POST /api/siege/declare — Siege 선언
// body: { wallet, sectorCode }
// ─────────────────────────────────────────────────────────────
router.post('/siege/declare', requireAuth, async (req, res) => {
  const wallet = req.user.wallet_address || req.user.wallet || req.user.walletAddress;
  const { sectorCode } = req.body || {};
  if (!wallet || !sectorCode) {
    return res.status(400).json({ error: 'sectorCode required' });
  }
  try {
    const result = await siegeService.declareSiege(wallet.toLowerCase().trim(), sectorCode);
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
// [Phase 3] POST /api/siege/commander/declare — 맹주 공성 선언 (맹주 sov1위 수비 vs 도전 sov2위 공격)
//   ※ '/siege/:sectorCode' 보다 먼저 등록
// ─────────────────────────────────────────────────────────────
router.post('/siege/commander/declare', requireAuth, async (req, res) => {
  try {
    const result = await siegeService.declareCommanderSiege();
    if (!result.success) return res.status(400).json({ error: result.error, detail: result });
    res.json(result);
  } catch (err) {
    console.error('[SIEGE] commander declare error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// [Phase 3] GET /api/siege/schedule — 주간 공성 결전 캘린더 (다가오는 슬롯)
//   ※ '/siege/:sectorCode' 보다 먼저 등록
// ─────────────────────────────────────────────────────────────
router.get('/siege/schedule', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count ?? '4'), 12);
    res.json(await siegeService.getSiegeSchedule(count));
  } catch (err) {
    console.error('[SIEGE] schedule error:', err.message);
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
// [Phase1] POST /api/siege/:siegeId/commit-fleet — 결전 함대 지정
// body: { fleetId }  (도전자/수비자만, 결전 전투 생성 전까지)
// ─────────────────────────────────────────────────────────────
router.post('/siege/:siegeId/commit-fleet', requireAuth, async (req, res) => {
  const wallet = req.user.wallet_address || req.user.wallet || req.user.walletAddress;
  const id = parseInt(req.params.siegeId);
  const fleetId = parseInt(req.body?.fleetId);
  if (isNaN(id) || isNaN(fleetId)) return res.status(400).json({ error: 'siegeId and fleetId required' });
  try {
    const result = await siegeService.commitSiegeFleet(id, wallet.toLowerCase().trim(), fleetId);
    if (!result.success) return res.status(400).json({ error: result.error, detail: result });
    res.json(result);
  } catch (err) {
    console.error('[SIEGE] commit-fleet error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// [Phase1] GET /api/siege/:siegeId/roster — 양측 함대 커밋/연결 전투 미리보기
// ─────────────────────────────────────────────────────────────
router.get('/siege/:siegeId/roster', async (req, res) => {
  const id = parseInt(req.params.siegeId);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid siege id' });
  try {
    const { pool } = require('../db');
    const { rows } = await pool.query(
      `SELECT gs.id, gs.status, gs.sector_code, gs.resolution_mode, gs.fleet_battle_id,
              gs.challenger_wallet, gs.defender_wallet,
              gs.challenger_fleet_id, gs.defender_fleet_id,
              cf.name AS challenger_fleet_name, df.name AS defender_fleet_name
         FROM governor_sieges gs
         LEFT JOIN fleets cf ON cf.id = gs.challenger_fleet_id
         LEFT JOIN fleets df ON df.id = gs.defender_fleet_id
        WHERE gs.id = $1`, [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'siege not found' });
    // [Phase 2] 다함대 — 양 진영 합류 함대 목록/카운트
    const commits = (await pool.query(
      `SELECT c.side, c.wallet, c.fleet_id, f.name AS fleet_name,
              (SELECT COUNT(*) FROM ships s WHERE s.fleet_id = c.fleet_id AND s.is_alive = true) AS ship_count
         FROM siege_fleet_commits c LEFT JOIN fleets f ON f.id = c.fleet_id
        WHERE c.siege_id = $1 ORDER BY c.side, c.committed_at`, [id]
    )).rows;
    const roster = rows[0];
    roster.commits = commits;
    roster.atk_count = commits.filter(c => c.side === 'atk').length;
    roster.def_count = commits.filter(c => c.side === 'def').length;
    res.json({ roster });
  } catch (err) {
    console.error('[SIEGE] roster error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/governor/declaration — 선언문 업데이트
// body: { wallet, sectorCode, text }
// ─────────────────────────────────────────────────────────────
router.post('/governor/declaration', requireAuth, async (req, res) => {
  const wallet = req.user.wallet_address || req.user.wallet || req.user.walletAddress;
  const { sectorCode, text } = req.body || {};
  if (!wallet || !sectorCode || !text) {
    return res.status(400).json({ error: 'sectorCode and text required' });
  }
  if (text.length > 1000) {
    return res.status(400).json({ error: 'text too long (max 1000 chars)' });
  }
  try {
    const result = await siegeService.updateGovernorDeclaration(wallet.toLowerCase().trim(), sectorCode, text);
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
router.put('/governor/tax-rate', requireAuth, async (req, res) => {
  const wallet = req.user.wallet_address || req.user.wallet || req.user.walletAddress;
  const { sectorCode, taxRate } = req.body || {};
  if (!wallet || !sectorCode || taxRate === undefined) {
    return res.status(400).json({ error: 'sectorCode and taxRate required' });
  }
  try {
    const result = await siegeService.updateTaxRate(wallet.toLowerCase().trim(), sectorCode, taxRate);
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
router.put('/governor/policy', requireAuth, async (req, res) => {
  const wallet = req.user.wallet_address || req.user.wallet || req.user.walletAddress;
  const { sectorCode, policy } = req.body || {};
  if (!wallet || !sectorCode || !policy) {
    return res.status(400).json({ error: 'sectorCode and policy required' });
  }
  try {
    const result = await siegeService.updateSectorPolicy(wallet.toLowerCase().trim(), sectorCode, policy);
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
  if (!requireAdmin(req, res)) return;
  const { status = 'all', limit = 50 } = req.query;
  const ALLOWED_STATUSES = ['all', 'pending', 'active', 'resolved', 'cancelled', 'expired'];
  const safeStatus = ALLOWED_STATUSES.includes(status) ? status : 'all';
  try {
    const { pool } = require('../db');
    const lim = Math.min(parseInt(limit) || 50, 200);
    const params = [lim];
    const whereClause = safeStatus === 'all' ? '' : `WHERE gs.status = $${params.push(safeStatus)}`;
    const result = await pool.query(
      `SELECT gs.*,
              uc.nickname AS challenger_nickname,
              ud.nickname AS defender_nickname,
              uw.nickname AS winner_nickname
       FROM governor_sieges gs
       LEFT JOIN users uc ON uc.wallet_address = gs.challenger_wallet
       LEFT JOIN users ud ON ud.wallet_address = gs.defender_wallet
       LEFT JOIN users uw ON uw.wallet_address = gs.winner_wallet
       ${whereClause}
       ORDER BY gs.declared_at DESC LIMIT $1`,
      params
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
  if (!requireAdmin(req, res)) return;
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
