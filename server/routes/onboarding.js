/**
 * routes/onboarding.js
 * 온보딩 튜토리얼 API — MASTER_PLAN Phase 3 (Migration 083)
 *
 * GET  /api/user/onboarding           → 현재 온보딩 상태
 * POST /api/user/onboarding/step      → 단계 완료 처리
 * POST /api/user/onboarding/skip      → 온보딩 건너뛰기
 * POST /api/user/onboarding/reward    → 완료 보상 수령
 * GET  /api/admin/onboarding          → 어드민: 온보딩 통계
 */

'use strict';

const express = require('express');
const router = express.Router();
const onboardingService = require('../services/onboarding');

function getWallet(req) {
  return (req.query.wallet || req.body.wallet || req.headers['x-wallet'] || '').toLowerCase();
}

// ─────────────────────────────────────────────────────────────
// GET /api/user/onboarding  — 현재 온보딩 상태
// ─────────────────────────────────────────────────────────────
router.get('/user/onboarding', async (req, res) => {
  const wallet = getWallet(req);
  if (!wallet) return res.status(400).json({ error: 'wallet required' });

  try {
    const state = await onboardingService.getOnboardingState(wallet);
    res.json(state);
  } catch (err) {
    console.error('[ONBOARDING] getOnboardingState error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/user/onboarding/step  — 단계 완료
// body: { wallet, step }
// ─────────────────────────────────────────────────────────────
router.post('/user/onboarding/step', async (req, res) => {
  const wallet = getWallet(req);
  const step = parseInt(req.body.step);

  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  if (!step || step < 1 || step > 5) return res.status(400).json({ error: 'invalid step (1~5)' });

  try {
    const result = await onboardingService.completeStep(wallet, step);
    if (!result.ok) return res.status(400).json({ error: result.reason });
    res.json(result);
  } catch (err) {
    console.error('[ONBOARDING] completeStep error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/user/onboarding/skip  — 건너뛰기
// body: { wallet }
// ─────────────────────────────────────────────────────────────
router.post('/user/onboarding/skip', async (req, res) => {
  const wallet = getWallet(req);
  if (!wallet) return res.status(400).json({ error: 'wallet required' });

  try {
    const result = await onboardingService.skipOnboarding(wallet);
    if (!result.ok) return res.status(400).json({ error: result.reason });
    res.json(result);
  } catch (err) {
    console.error('[ONBOARDING] skipOnboarding error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/user/onboarding/reward  — 완료 보상 수령
// body: { wallet }
// ─────────────────────────────────────────────────────────────
router.post('/user/onboarding/reward', async (req, res) => {
  const wallet = getWallet(req);
  if (!wallet) return res.status(400).json({ error: 'wallet required' });

  try {
    const result = await onboardingService.claimCompletionReward(wallet);
    if (!result.ok) return res.status(400).json({ error: result.reason });
    res.json(result);
  } catch (err) {
    console.error('[ONBOARDING] claimReward error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/onboarding  — 어드민 통계
// ─────────────────────────────────────────────────────────────
router.get('/admin/onboarding', async (req, res) => {
  try {
    const { pool: db } = require('../db');
    const [funnel, daily] = await Promise.all([
      db.query(`SELECT * FROM admin_onboarding_funnel`).catch(() => ({ rows: [] })),
      db.query(`
        SELECT
          DATE(created_at) AS date,
          COUNT(*) AS started,
          COUNT(*) FILTER (WHERE completed = true) AS completed,
          COUNT(*) FILTER (WHERE skipped = true) AS skipped
        FROM user_onboarding
        WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `).catch(() => ({ rows: [] })),
    ]);
    res.json({ funnel: funnel.rows, daily: daily.rows });
  } catch (err) {
    console.error('[ONBOARDING] getStats error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;
