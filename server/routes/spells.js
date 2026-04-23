'use strict';
const express = require('express');
const router  = express.Router();
const svc     = require('../services/spells');

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

// POST /api/spells/cast — { wallet, claimId, spellType }
router.post('/spells/cast', async (req, res) => {
  const { wallet, claimId, spellType } = req.body || {};
  if (!wallet || !claimId || !spellType) return res.status(400).json({ error: 'wallet, claimId, spellType required' });
  try { res.json(await svc.castSpell(wallet, claimId, spellType)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
