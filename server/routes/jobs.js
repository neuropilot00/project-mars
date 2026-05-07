// server/routes/jobs.js
// ═══════════════════════════════════════════════════════════════
// Job API Routes
//
// GET  /api/jobs           — 직업 목록 (버프 포함)
// GET  /api/jobs/mine      — 내 현재 직업
// POST /api/jobs/select    — 직업 선택/변경
// GET  /api/jobs/buffs     — 내 버프 전체 (게임 로직용)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const jobService = require('../services/job');

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
  // [v7.62] toLowerCase/trim 추가
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

const ERROR_STATUS = {
  'JOB_SYSTEM_DISABLED': 503,
  'USER_NOT_FOUND': 404,
  'JOB_NOT_FOUND': 404,
  'SAME_JOB': 409,
  'JOB_CHANGE_COOLDOWN': 429,
  'INSUFFICIENT_GP': 402,
};

function handleErr(res, err, context) {
  const status = ERROR_STATUS[err.message];
  if (status) return res.status(status).json({ error: err.message, meta: err.meta });
  console.error(`[jobs] ${context} error:`, err);
  res.status(500).json({ error: 'SERVER_ERROR' });
}

// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/jobs
 * 전체 직업 목록 (버프 포함, 인증 불필요)
 */
router.get('/', async (req, res) => {
  try {
    const jobs = await jobService.listJobs();
    res.json({ jobs });
  } catch (err) { handleErr(res, err, 'list'); }
});

/**
 * GET /api/jobs/mine
 * 내 현재 직업 + 변경 가능 여부
 */
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const myJob = await jobService.getMyJob(wallet);
    if (!myJob) return res.status(404).json({ error: 'USER_NOT_FOUND' });

    res.json({ job: myJob });
  } catch (err) { handleErr(res, err, 'mine'); }
});

/**
 * POST /api/jobs/select
 * 직업 선택 또는 변경
 * Body: { job_code: 'miner' | 'warrior' | 'crafter' | 'merchant' }
 */
router.post('/select', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const { job_code } = req.body || {};
    if (!job_code) return res.status(400).json({ error: 'JOB_CODE_REQUIRED' });

    const result = await jobService.selectJob(wallet, job_code);
    res.json(result);
  } catch (err) { handleErr(res, err, 'select'); }
});

/**
 * GET /api/jobs/buffs
 * 내 버프 전체 조회 (게임 로직용, 프론트엔드 표시용)
 */
router.get('/buffs', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const buffs = await jobService.getAllJobBuffs(wallet);
    res.json({ buffs });
  } catch (err) { handleErr(res, err, 'buffs'); }
});

module.exports = router;
