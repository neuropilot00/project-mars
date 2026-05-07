'use strict';
const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const svc     = require('../services/spells');

// ✅ [v7.47] JWT 인증 미들웨어
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function getAuthWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

// GET /api/spells/info — all spell types + costs
router.get('/spells/info', async (req, res) => {
  try {
    const [info, cfg] = await Promise.all([svc.getSpellInfo(), svc.getCfg()]);
    res.json({ spells: info, cfg });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/spells/claim/:claimId — active spells on a territory
router.get('/spells/claim/:claimId', async (req, res) => {
  try { res.json(await svc.getClaimSpells(req.params.claimId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/spells/my?wallet= — my cast history
router.get('/spells/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMySpells(wallet)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/spells/cast — { claimId, spellType }
router.post('/spells/cast', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { claimId, spellType } = req.body || {};
  if (!wallet || !claimId || !spellType) return res.status(400).json({ error: 'wallet, claimId, spellType required' });
  try { res.json(await svc.castSpell(wallet, claimId, spellType)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
