/**
 * routes/betting.js
 * War Betting API (BIBLE Migration 087)
 *
 * GET  /api/betting/events           → 활성 베팅 이벤트 목록
 * GET  /api/betting/events/:id/odds  → 이벤트 배당률
 * POST /api/betting/bet              → 베팅 등록 { eventId, option, amount }
 * GET  /api/user/bets                → 내 베팅 목록
 * GET  /api/admin/betting/events     → 어드민: 전체 이벤트 목록
 * POST /api/admin/betting/events/:id/settle  → 어드민: 강제 정산
 * POST /api/admin/betting/events/:id/cancel  → 어드민: 이벤트 취소
 */

'use strict';

const express = require('express');
const router  = express.Router();
const bettingService = require('../services/betting');

// ── Auth helpers ──
function getWallet(req) {
  return (req.headers['x-wallet'] || req.query.wallet || '').toLowerCase().trim();
}
function requireWallet(req, res) {
  const w = getWallet(req);
  if (!w || w.length < 10) {
    res.status(400).json({ error: 'wallet_required' });
    return null;
  }
  return w;
}
function requireAdmin(req, res) {
  const secret = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    res.status(403).json({ error: 'forbidden' });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────
// GET /api/betting/events — 활성 이벤트 목록
// ─────────────────────────────────────────────────────────────
router.get('/betting/events', async (req, res) => {
  try {
    const events = await bettingService.getActiveBettingEvents();
    res.json({ events });
  } catch (err) {
    console.error('[BETTING] GET /events error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/betting/events/:id/odds — 배당률 조회
// ─────────────────────────────────────────────────────────────
router.get('/betting/events/:id/odds', async (req, res) => {
  try {
    const odds = await bettingService.getBettingOdds(req.params.id);
    if (!odds) return res.status(404).json({ error: 'event_not_found' });
    res.json(odds);
  } catch (err) {
    console.error('[BETTING] GET odds error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/betting/bet — 베팅 등록
// body: { eventId, option, amount }
// ─────────────────────────────────────────────────────────────
router.post('/betting/bet', async (req, res) => {
  const wallet = requireWallet(req, res);
  if (!wallet) return;

  const { eventId, option, amount } = req.body;
  if (!eventId || !option || !amount) {
    return res.status(400).json({ error: 'missing_fields' });
  }

  try {
    const result = await bettingService.placeBet(wallet, eventId, option, amount);
    if (!result.success) {
      return res.status(400).json({ error: result.error, ...result });
    }
    res.json(result);
  } catch (err) {
    console.error('[BETTING] POST /bet error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/user/bets — 내 베팅 목록
// ─────────────────────────────────────────────────────────────
router.get('/user/bets', async (req, res) => {
  const wallet = requireWallet(req, res);
  if (!wallet) return;

  try {
    const bets = await bettingService.getUserBets(wallet);
    res.json({ bets });
  } catch (err) {
    console.error('[BETTING] GET /user/bets error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─────────────────────────────────────────────────────────────
// ADMIN: GET /api/admin/betting/events — 전체 이벤트 목록
// ─────────────────────────────────────────────────────────────
router.get('/admin/betting/events', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { pool } = require('../db');
    const status = req.query.status || null;
    const q = status
      ? 'SELECT * FROM war_bet_events WHERE status = $1 ORDER BY opens_at DESC LIMIT 100'
      : 'SELECT * FROM war_bet_events ORDER BY opens_at DESC LIMIT 100';
    const result = await pool.query(q, status ? [status] : []);
    res.json({ events: result.rows });
  } catch (err) {
    console.error('[BETTING] admin GET events error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─────────────────────────────────────────────────────────────
// ADMIN: POST /api/admin/betting/events/:id/settle — 강제 정산
// body: { winnerOption: 'a' | 'b' }
// ─────────────────────────────────────────────────────────────
router.post('/admin/betting/events/:id/settle', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { winnerOption } = req.body;
  if (!['a', 'b'].includes(winnerOption)) {
    return res.status(400).json({ error: 'invalid_option' });
  }

  try {
    const result = await bettingService.settleBettingEvent(req.params.id, winnerOption);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[BETTING] admin settle error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─────────────────────────────────────────────────────────────
// ADMIN: POST /api/admin/betting/events/:id/cancel — 이벤트 취소
// ─────────────────────────────────────────────────────────────
router.post('/admin/betting/events/:id/cancel', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const result = await bettingService.cancelBettingEvent(req.params.id);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[BETTING] admin cancel error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
