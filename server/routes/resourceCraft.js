// server/routes/resourceCraft.js
// ═══════════════════════════════════════════════════════════════
// Resource Crafting API (Migration 091 · tier-3 자원 제작)
//
// GET    /api/resource-craft/recipes        — 제작 가능 레시피 목록
// GET    /api/resource-craft/jobs           — 내 진행 중 제작 작업
// POST   /api/resource-craft/start          — 제작 시작 (재료 차감 + 큐)
// POST   /api/resource-craft/:id/claim      — 완료 수령
// POST   /api/resource-craft/:id/cancel     — 취소 (50% 환불)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const craftSvc = require('../services/resourceCraft');

// ── wallet 추출 (JWT Bearer 또는 x-wallet 헤더) ──
const jwt = require('jsonwebtoken');
// ✅ [v7.44] JWT 인증 미들웨어 — fallback 제거
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function getAuthWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}
function getWallet(req) {
  return getAuthWallet(req);
}

const ERROR_STATUS = {
  USER_NOT_FOUND: 404,
  RESOURCE_NOT_FOUND: 404,
  NOT_CRAFTABLE: 400,
  RECIPE_EMPTY: 500,
  INVALID_QUANTITY: 400,
  INSUFFICIENT_MATERIALS: 402,
  JOB_NOT_FOUND: 404,
  NOT_YET_COMPLETE: 425,
  JOB_NOT_CANCELLABLE: 409,
};

function sendErr(res, err) {
  const code = err.message || 'server_error';
  const status = ERROR_STATUS[code] || 500;
  if (status >= 500) console.error('[resourceCraft]', err);
  const body = { error: code };
  if (err.meta) body.meta = err.meta;
  res.status(status).json(body);
}

// ─── GET /api/resource-craft/recipes ───
router.get('/recipes', async (_req, res) => {
  try {
    const recipes = await craftSvc.getRecipes();
    res.json({ recipes });
  } catch (err) { sendErr(res, err); }
});

// ─── GET /api/resource-craft/jobs ───
router.get('/jobs', requireAuth, async (req, res) => {
  const wallet = getWallet(req);
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });
  try {
    const jobs = await craftSvc.getMyJobs(wallet);
    res.json({ jobs });
  } catch (err) { sendErr(res, err); }
});

// ─── POST /api/resource-craft/start ───
router.post('/start', requireAuth, async (req, res) => {
  const wallet = getWallet(req);
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });
  const { resource_code, resourceCode, quantity } = req.body || {};
  const code = String(resource_code || resourceCode || '').trim();
  if (!code) return res.status(400).json({ error: 'resource_code_required' });
  const qty = parseInt(quantity) || 1;
  try {
    const job = await craftSvc.startCraft(wallet, code, qty);
    // Daily OPS mission progress (fire-and-forget)
    try {
      const _dOps = require('./dailyOps');
      _dOps.notifyMissionProgress(wallet, 'craft_resource').catch(() => {});
      _dOps.notifyMissionProgress(wallet, 'craft_resource_3').catch(() => {});
      _dOps.notifyMissionProgress(wallet, 'craft_resource_5').catch(() => {});
    } catch (_) {}
    res.json({ success: true, job });
  } catch (err) { sendErr(res, err); }
});

// ─── POST /api/resource-craft/:id/claim ───
router.post('/:id/claim', requireAuth, async (req, res) => {
  const wallet = getWallet(req);
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  try {
    const result = await craftSvc.claimJob(id, wallet);
    res.json(result);
  } catch (err) { sendErr(res, err); }
});

// ─── POST /api/resource-craft/:id/cancel ───
router.post('/:id/cancel', requireAuth, async (req, res) => {
  const wallet = getWallet(req);
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  try {
    const result = await craftSvc.cancelJob(id, wallet);
    res.json(result);
  } catch (err) { sendErr(res, err); }
});

module.exports = router;
