// server/routes/commanderActions.js
// ═══════════════════════════════════════════════════════════════
// Commander Actions API
//
// POST /api/battles/:id/commander-action  — declare an action
// GET  /api/battles/:id/commander-actions — list declared actions (public-ish)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const cmdSvc = require('../services/commanderActions');

// [Phase 3 레드팀] 비-라이브(pre-battle) declareAction 도 per-wallet rate limit — 풀 고갈/락 경합 방지.
//   (라이브 경로는 liveBattle.enqueueCommand 에서 5/s 별도 제한.)
const _cmdRate = new Map(); // wallet -> timestamps[]
function _rateOk(wallet, perSec = 5) {
  const now = Date.now();
  const ts = (_cmdRate.get(wallet) || []).filter((t) => now - t < 1000);
  if (ts.length >= perSec) { _cmdRate.set(wallet, ts); return false; }
  ts.push(now); _cmdRate.set(wallet, ts);
  return true;
}

// ── JWT 인증 미들웨어 — body/header wallet fallback 없음 ──
const jwt = require('jsonwebtoken');
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};

// ─── POST /api/battles/:id/commander-action ───
router.post('/battles/:id/commander-action', requireAuth, async (req, res) => {
  const battleId = parseInt(req.params.id);
  if (!battleId) return res.status(400).json({ error: 'invalid_battle_id' });

  const wallet = (req.user.wallet_address || req.user.wallet || req.user.walletAddress || '').toLowerCase().trim();
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });

  const { action_type, actionType, params } = req.body || {};
  const type = action_type || actionType;
  if (!type) return res.status(400).json({ error: 'action_type_required' });

  // per-wallet rate limit (라이브/pre-battle 공통 1차 방어 — 플러딩/매크로 차단)
  if (!_rateOk(wallet)) return res.status(429).json({ error: 'RATE_LIMITED' });

  // [Phase 3 실시간] 라이브 전투 진행 중이면 인메모리 큐로 즉시 반영 (pre-battle declareAction 우회).
  //   클라 postMessage 핸들러는 변경 없음 — 동일 라우트가 라이브/pre-battle 자동 분기.
  try {
    const liveBattle = require('../services/liveBattle');
    if (liveBattle.isActive(battleId)) {
      const { pool } = require('../db');
      const pr = await pool.query(
        'SELECT fleet_id FROM fleet_battle_participants WHERE battle_id = $1 AND LOWER(wallet_address) = LOWER($2) LIMIT 1',
        [battleId, wallet]
      );
      if (!pr.rows.length) return res.status(403).json({ error: 'NOT_A_PARTICIPANT' });
      const fleetId = pr.rows[0].fleet_id;
      const p = params || {};
      const liveAction = type === 'formation_change' ? 'formation'
        : type === 'maneuver_change' ? 'maneuver'
        : type === 'focus_fire' ? 'focus'
        : (type === 'beam' || type === 'beam_cannon') ? 'beam'
        : (type === 'missile' || type === 'missile_barrage') ? 'missile' : null;
      if (!liveAction) return res.status(400).json({ error: 'UNSUPPORTED_LIVE_ACTION' });
      const ok = liveBattle.enqueueCommand(battleId, {
        fleetId, wallet, action: liveAction,
        params: { formation: p.formation, movement: p.maneuver || p.movement, targetFleetId: p.targetFleetId },
      });
      return res.json({ success: true, live: true, queued: ok, ...(ok ? {} : { error: 'RATE_LIMITED' }) });
    }
  } catch (_) { /* liveBattle 미가용 — pre-battle 경로 */ }

  try {
    const result = await cmdSvc.declareAction(battleId, wallet, type, params || {});
    res.json({ success: true, action: result });
  } catch (err) {
    const code = err.message || 'server_error';
    const meta = err.meta || null;
    const status = ({
      BATTLE_NOT_FOUND: 404,
      NOT_A_PARTICIPANT: 403,
      BATTLE_NOT_ACCEPTING_ACTIONS: 409,
      ACTION_QUOTA_EXCEEDED: 429,
      ACTION_ALREADY_DECLARED: 409,
      COMMANDER_ACTIONS_DISABLED: 403,
      INVALID_ACTION_TYPE: 400,
      INSUFFICIENT_GP: 402,
      TARGET_FLEET_REQUIRED: 400,
      TARGET_FLEET_NOT_IN_BATTLE: 400,
      TARGET_FLEET_ALLY: 400,
      SHIP_TYPE_REQUIRED: 400,
      INVALID_REINFORCE_COUNT: 400,
      SHIP_TYPE_NOT_FOUND: 404,
    })[code] || 500;
    if (status >= 500) console.error('[commanderActions] declare error:', err);
    res.status(status).json({ error: code, ...(meta ? { meta } : {}) });
  }
});

// ─── GET /api/battles/:id/commander-actions ───
router.get('/battles/:id/commander-actions', async (req, res) => {
  const battleId = parseInt(req.params.id);
  if (!battleId) return res.status(400).json({ error: 'invalid_battle_id' });
  try {
    const actions = await cmdSvc.listActions(battleId);
    res.json({ actions });
  } catch (err) {
    console.error('[commanderActions] list error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
