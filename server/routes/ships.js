'use strict';
/**
 * routes/ships.js
 * Ship Construction API (Migration 092)
 *
 * GET  /api/ships/blueprints        → 건조 가능 함선 목록 + 비용 + 스탯
 * GET  /api/ships                   → 내 함대 (x-wallet 헤더)
 * GET  /api/ships/stats             → 함대 통계 요약
 * POST /api/ships/build             → 함선 건조 { wallet, shipType }
 * POST /api/ships/:id/repair        → 수리 { wallet }
 * GET  /api/admin/ships             → 어드민: 전체 함대 현황
 */

const express = require('express');
const router  = express.Router();
const shipService = require('../services/ship');

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

// ── GET /api/ships/blueprints ──
router.get('/ships/blueprints', async (req, res) => {
  try {
    const blueprints = await shipService.getBlueprints();
    res.json({ blueprints });
  } catch (err) {
    console.error('[SHIPS] blueprints error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /api/ships ──
router.get('/ships', async (req, res) => {
  const wallet = requireWallet(req, res);
  if (!wallet) return;
  try {
    const ships = await shipService.getUserShips(wallet);
    res.json({ ships });
  } catch (err) {
    console.error('[SHIPS] list error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /api/ships/stats ──
router.get('/ships/stats', async (req, res) => {
  const wallet = requireWallet(req, res);
  if (!wallet) return;
  try {
    const stats = await shipService.getFleetStats(wallet);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/ships/build ──
router.post('/ships/build', async (req, res) => {
  const wallet = requireWallet(req, res);
  if (!wallet) return;
  const { shipType } = req.body;
  if (!shipType) return res.status(400).json({ error: 'ship_type_required' });
  try {
    const result = await shipService.buildShip(wallet, shipType);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[SHIPS] build error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/ships/:id/repair ──
router.post('/ships/:id/repair', async (req, res) => {
  const wallet = requireWallet(req, res);
  if (!wallet) return;
  const shipId = parseInt(req.params.id);
  if (!shipId) return res.status(400).json({ error: 'invalid_ship_id' });
  try {
    const result = await shipService.repairShip(wallet, shipId);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[SHIPS] repair error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /api/ships/upgrade-costs ──
router.get('/ships/upgrade-costs', async (req, res) => {
  try {
    const data = await shipService.getUpgradeCosts();
    res.json(data);
  } catch (err) {
    console.error('[SHIPS] upgrade-costs error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/ships/:id/upgrade ──
router.post('/ships/:id/upgrade', async (req, res) => {
  const wallet = requireWallet(req, res);
  if (!wallet) return;
  const shipId = parseInt(req.params.id);
  if (!shipId) return res.status(400).json({ error: 'invalid_ship_id' });
  try {
    const result = await shipService.upgradeShip(wallet, shipId);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[SHIPS] upgrade error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── ADMIN: GET /api/admin/ships ──
router.get('/admin/ships', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const pool = require('../db');
    const result = await pool.query(
      `SELECT s.*, u.nickname
       FROM user_ships s
       LEFT JOIN users u ON u.wallet_address = s.wallet_address
       ORDER BY s.created_at DESC
       LIMIT 200`
    );
    const stats = await pool.query(
      `SELECT ship_type, status, COUNT(*) AS cnt
       FROM user_ships
       GROUP BY ship_type, status
       ORDER BY ship_type`
    );
    res.json({ ships: result.rows, stats: stats.rows });
  } catch (err) {
    console.error('[SHIPS] admin error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
