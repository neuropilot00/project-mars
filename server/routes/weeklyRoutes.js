// server/routes/weeklyRoutes.js
// ═══════════════════════════════════════════════════════════════
// Phase3 리텐션 훅 라우트 — 주간 누적 챌린지 + 정시 섹터 서지
//
//   GET  /api/weekly/status   — 이번 주 챌린지 현황(메트릭별 현재/목표/수령여부)
//   POST /api/weekly/claim    — 목표 달성 메트릭 보상 수령(멱등)
//   GET  /api/weekly/surge    — 현재 활성 섹터 서지(읽기 전용 안내 데이터)
//
//   진행도는 별도 카운터 없이 조회 시점 lazy 집계(weeklyChallenge 서비스).
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const weekly = require('../services/weeklyChallenge');

// ── JWT 인증 (dailyOps.js 패턴과 동일) ─────────────────────────
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function getAuthWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}
// 조회용 wallet (x-wallet / query 허용 — 읽기 전용 현황)
function getReadWallet(req) {
  return (req.headers['x-wallet'] || req.query.wallet || '').toLowerCase().trim();
}

// ── GET /api/weekly/status ─────────────────────────────────────
router.get('/weekly/status', async (req, res) => {
  try {
    const wallet = getReadWallet(req);
    if (!wallet || wallet.length < 5) return res.status(400).json({ error: 'WALLET_REQUIRED' });
    const status = await weekly.getStatus(wallet);
    res.json({ success: true, ...status });
  } catch (err) {
    console.error('[weeklyRoutes] status error:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ── POST /api/weekly/claim ─────────────────────────────────────
//   인증 wallet 만 신뢰(보상 지급 경로). body.metric 필수.
router.post('/weekly/claim', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    if (!wallet || wallet.length < 5) return res.status(400).json({ error: 'INVALID_WALLET' });
    const metric = (req.body?.metric || '').toString().trim();
    if (!metric) return res.status(400).json({ error: 'METRIC_REQUIRED' });

    const result = await weekly.claim(wallet, metric);
    if (!result.success) {
      const code = result.error === 'ALREADY_CLAIMED' ? 409
                 : result.error === 'TARGET_NOT_REACHED' ? 400
                 : result.error === 'USER_NOT_FOUND' ? 404
                 : result.error === 'INTERNAL_ERROR' ? 500
                 : 400;
      return res.status(code).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('[weeklyRoutes] claim error:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ── GET /api/weekly/surge ──────────────────────────────────────
//   현재 활성 서지 안내(읽기 전용). 인증 불필요(공개 정보).
router.get('/weekly/surge', async (req, res) => {
  try {
    const surge = await weekly.getActiveSurge();
    res.json({ success: true, ...surge });
  } catch (err) {
    console.error('[weeklyRoutes] surge error:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
