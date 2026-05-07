/**
 * routes/resource.js
 * 광물 & 자원 시스템 API — MASTER_PLAN Phase 2
 *
 * GET  /api/resources               → 전체 자원 목록
 * GET  /api/user/resources          → 유저 자원 인벤토리
 * GET  /api/admin/resources         → 어드민: 자원 통계
 * PUT  /api/admin/resource-rate     → 어드민: 섹터 드롭율 수정
 */

const express = require('express');
const router = express.Router();
const resourceService = require('../services/resource');
const { pool } = require('../db');

function getWallet(req) {
  return (req.query.wallet || req.body.wallet || req.headers['x-wallet'] || '').toLowerCase();
}

function requireAdmin(req, res) {
  const s = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  if (!s || s !== process.env.ADMIN_SECRET) { res.status(403).json({ error: 'FORBIDDEN' }); return false; }
  return true;
}

// ─────────────────────────────────────────
// GET /api/resources
// 전체 자원 목록 (마켓 등록 / UI용)
// ─────────────────────────────────────────
router.get('/resources', async (req, res) => {
  try {
    const lang = ['en','ko','ja','zh'].includes(req.query.lang) ? req.query.lang : 'en';
    const resources = await resourceService.getAllResources(lang);
    res.json({ resources });
  } catch (err) {
    console.error('[RESOURCE] GET /resources error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/user/resources
// 유저 자원 인벤토리 (보유 수량 포함)
// ─────────────────────────────────────────
router.get('/user/resources', async (req, res) => {
  const wallet = getWallet(req);
  if (!wallet) return res.status(400).json({ error: 'Wallet required' });
  try {
    const lang = ['en','ko','ja','zh'].includes(req.query.lang) ? req.query.lang : 'en';
    const inventory = await resourceService.getUserInventory(wallet, lang);
    res.json({ inventory });
  } catch (err) {
    console.error('[RESOURCE] GET /user/resources error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/admin/resources
// 어드민: 자원 통계 + 최근 거래
// ─────────────────────────────────────────
router.get('/admin/resources', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const stats = await resourceService.getResourceStats();
    // 섹터별 드롭율 테이블도 반환
    const rateRes = await pool.query(`
      SELECT srr.sector_type, srr.resource_code, srr.base_rate, srr.miner_bonus, srr.is_active,
             r.name_en, r.rarity, r.icon_emoji
      FROM sector_resource_rates srr
      JOIN resources r ON r.code = srr.resource_code
      ORDER BY srr.sector_type, r.id
    `);
    res.json({ ...stats, dropRates: rateRes.rows });
  } catch (err) {
    console.error('[RESOURCE] GET /admin/resources error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// PUT /api/admin/resource-rate
// 어드민: 섹터별 드롭율 수정
// { sectorType, resourceCode, baseRate, minerBonus }
// ─────────────────────────────────────────
router.put('/admin/resource-rate', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { sectorType, resourceCode, baseRate, minerBonus } = req.body;
  if (!sectorType || !resourceCode || baseRate === undefined) {
    return res.status(400).json({ error: 'sectorType, resourceCode, baseRate required' });
  }
  const rate = parseFloat(baseRate);
  const bonus = parseFloat(minerBonus || 0);
  if (isNaN(rate) || rate < 0 || rate > 1) {
    return res.status(400).json({ error: 'baseRate must be 0~1' });
  }
  try {
    const result = await pool.query(`
      UPDATE sector_resource_rates
      SET base_rate = $1, miner_bonus = $2
      WHERE sector_type = $3 AND resource_code = $4
      RETURNING *
    `, [rate, bonus, sectorType, resourceCode]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rate record not found' });
    }
    resourceService.invalidateRateCache();
    res.json({ success: true, rate: result.rows[0] });
  } catch (err) {
    console.error('[RESOURCE] PUT /admin/resource-rate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
