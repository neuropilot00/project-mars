/**
 * routes/sectors.js
 * 섹터 정의 시스템 API (BIBLE Migration 081 — Migration 084)
 *
 * ⚠️  URL prefix: /api/sector-defs (old /api/sectors는 맵 렌더링용 old sectors 테이블 사용 중)
 *
 * GET /api/sector-defs                  → 전체 섹터 목록
 * GET /api/sector-defs/:code            → 섹터 상세
 * GET /api/sector-defs/:code/governance → 거버넌스 현황
 * GET /api/sector-defs/:code/entry-check→ 진입 요건 체크
 * GET /api/admin/sector-defs            → 어드민: 섹터 통계
 */

'use strict';

const express = require('express');
const router = express.Router();
const sectorService = require('../services/sector');
const { requireAuth, getAuthWallet } = require('../utils/apiHelpers');

function requireAdmin(req, res) {
  const s = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  if (!s || s !== process.env.ADMIN_SECRET) { res.status(403).json({ error: 'FORBIDDEN' }); return false; }
  return true;
}

// ─────────────────────────────────────────────────────────────
// GET /api/sector-defs  — 전체 섹터 목록
// ─────────────────────────────────────────────────────────────
router.get('/sector-defs', async (req, res) => {
  const lang = (req.query.lang || 'en').toLowerCase();
  try {
    const sectors = await sectorService.getAllSectors(lang);
    res.json({ sectors, total: sectors.length });
  } catch (err) {
    console.error('[SECTORS] getAllSectors error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// [Phase 3] GET /api/sector-defs/sov-map — SOV 지도 (어느 길드가 24섹터 지배) + leaderboard
//   ※ '/:code' 보다 먼저 등록해야 :code 로 안 먹힘
// ─────────────────────────────────────────────────────────────
router.get('/sector-defs/sov-map', async (req, res) => {
  try {
    const data = await sectorService.getSovMap();
    res.json(data);
  } catch (err) {
    console.error('[SECTORS] sov-map error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/sector-defs/:code  — 섹터 상세
// ─────────────────────────────────────────────────────────────
router.get('/sector-defs/:code', async (req, res) => {
  const lang = (req.query.lang || 'en').toLowerCase();
  const code = req.params.code.toLowerCase();
  // governance, entry-check, sov-map 서브라우트는 별도 처리
  if (code === 'governance' || code === 'entry-check' || code === 'sov-map') return res.status(404).json({ error: 'not found' });
  try {
    const sectors = await sectorService.getAllSectors(lang);
    const sector = sectors.find(s => s.code === code);
    if (!sector) return res.status(404).json({ error: 'sector not found' });
    res.json(sector);
  } catch (err) {
    console.error('[SECTORS] getSector error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/sector-defs/:code/governance  — 거버넌스 현황
// ─────────────────────────────────────────────────────────────
router.get('/sector-defs/:code/governance', async (req, res) => {
  const code = req.params.code.toLowerCase();
  try {
    const gov = await sectorService.getSectorGovernance(code);
    if (!gov) return res.status(404).json({ error: 'sector not found' });
    res.json(gov);
  } catch (err) {
    console.error('[SECTORS] governance error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/sector-defs/:code/entry-check  — 진입 요건 체크
// ─────────────────────────────────────────────────────────────
router.get('/sector-defs/:code/entry-check', requireAuth, async (req, res) => {
  const code   = req.params.code.toLowerCase();
  const wallet = getAuthWallet(req);
  if (!wallet) return res.status(401).json({ error: 'auth required' });
  try {
    const result = await sectorService.checkEntryRequirement(wallet, code);
    res.json(result);
  } catch (err) {
    console.error('[SECTORS] entry-check error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/sector-defs  — 어드민 섹터 통계
// ─────────────────────────────────────────────────────────────
router.get('/admin/sector-defs', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const stats = await sectorService.getSectorStats();
    res.json({ sectors: stats });
  } catch (err) {
    console.error('[SECTORS] admin stats error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;
