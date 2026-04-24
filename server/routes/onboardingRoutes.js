// server/routes/onboardingRoutes.js
// ═══════════════════════════════════════════════════════════════
// Onboarding API Routes
//
// GET  /api/onboarding          — 내 온보딩 상태
// POST /api/onboarding/step     — 스텝 완료 처리
// POST /api/onboarding/skip     — 온보딩 스킵
// GET  /api/onboarding/guilds   — 추천 길드 (STEP 4)
// GET  /api/onboarding/sector   — 추천 섹터 (STEP 2)
// GET  /api/onboarding/mission  — 첫 미션 (STEP 5)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const onboardingService = require('../services/onboarding');

// ── 인증 ──
const jwt = require('jsonwebtoken');
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};

function getWallet(req) {
  return req.user.wallet_address || req.user.wallet || req.user.walletAddress;
}

const ERROR_STATUS = {
  'ALREADY_DONE':      409,
  'SKIP_NOT_ALLOWED':  403,
  'INVALID_STEP':      400,
};

function handleErr(res, err, context) {
  const status = ERROR_STATUS[err.message];
  if (status) return res.status(status).json({ error: err.message });
  console.error(`[onboarding] ${context} error:`, err);
  res.status(500).json({ error: 'SERVER_ERROR' });
}

// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/onboarding
 * 내 온보딩 상태 조회 (없으면 자동 생성)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const status = await onboardingService.getOnboardingStatus(wallet);
    res.json({ onboarding: status });
  } catch (err) { handleErr(res, err, 'status'); }
});

/**
 * POST /api/onboarding/step
 * 스텝 완료 처리
 * Body: { step: 0~5, data: { job_code?, claim_id? } }
 */
router.post('/step', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const { step, data } = req.body || {};
    if (step === undefined || step === null) {
      return res.status(400).json({ error: 'STEP_REQUIRED' });
    }
    if (typeof step !== 'number' || step < 0 || step > 5) {
      return res.status(400).json({ error: 'INVALID_STEP' });
    }

    const result = await onboardingService.completeStep(wallet, step, data || {});
    res.json(result);
  } catch (err) { handleErr(res, err, 'step'); }
});

/**
 * POST /api/onboarding/skip
 * 온보딩 스킵 (settings에서 허용된 경우)
 */
router.post('/skip', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const result = await onboardingService.skipOnboarding(wallet);
    res.json(result);
  } catch (err) { handleErr(res, err, 'skip'); }
});

/**
 * GET /api/onboarding/guilds
 * 추천 길드 목록 (STEP 4용)
 */
router.get('/guilds', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const guilds = await onboardingService.getRecommendedGuilds(wallet);
    res.json({ guilds });
  } catch (err) { handleErr(res, err, 'guilds'); }
});

/**
 * GET /api/onboarding/sector
 * 직업별 추천 섹터 (STEP 2용)
 * Query: ?job_code=miner
 */
router.get('/sector', async (req, res) => {
  try {
    const jobCode = req.query.job_code || 'miner';
    const sector = onboardingService.getRecommendedSector(jobCode);
    res.json({ sector });
  } catch (err) { handleErr(res, err, 'sector'); }
});

/**
 * GET /api/onboarding/mission
 * 직업별 첫 미션 (STEP 5용)
 * Query: ?job_code=miner
 */
router.get('/mission', async (req, res) => {
  try {
    const jobCode = req.query.job_code || 'miner';
    const mission = onboardingService.getFirstMission(jobCode);
    res.json({ mission });
  } catch (err) { handleErr(res, err, 'mission'); }
});

module.exports = router;
