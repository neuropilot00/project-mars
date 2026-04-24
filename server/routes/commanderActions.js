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

// ── wallet 추출 (JWT Bearer 혹은 x-wallet 헤더) ──
const jwt = require('jsonwebtoken');
function getWallet(req) {
  // JWT 우선
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token && process.env.JWT_SECRET) {
    try {
      const p = jwt.verify(token, process.env.JWT_SECRET);
      return (p.wallet_address || p.wallet || p.walletAddress || '').toLowerCase().trim();
    } catch (_) {}
  }
  // fallback: x-wallet 헤더/body
  return String(req.body?.wallet || req.headers['x-wallet'] || req.query?.wallet || '')
    .toLowerCase().trim();
}

// ─── POST /api/battles/:id/commander-action ───
router.post('/battles/:id/commander-action', async (req, res) => {
  const battleId = parseInt(req.params.id);
  if (!battleId) return res.status(400).json({ error: 'invalid_battle_id' });

  const wallet = getWallet(req);
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });

  const { action_type, actionType, params } = req.body || {};
  const type = action_type || actionType;
  if (!type) return res.status(400).json({ error: 'action_type_required' });

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
