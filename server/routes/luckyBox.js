'use strict';
const express  = require('express');
const router   = express.Router();
const boxSvc   = require('../services/luckyBox');

let logGPActivity, seasonService, weeklySvc;
try { ({ logGPActivity } = require('../services/gpService')); } catch (_) {}
try { seasonService = require('../services/seasonService'); } catch (_) {}
try { weeklySvc     = require('../services/weeklyChallenge'); } catch (_) {}

// GET /api/lucky-boxes — list active box types
router.get('/lucky-boxes', async (req, res) => {
  try { res.json(await boxSvc.getBoxTypes()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/lucky-boxes/recent — recent openings feed
router.get('/lucky-boxes/recent', async (req, res) => {
  try { res.json(await boxSvc.getRecentOpenings(req.query.limit || 20)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/lucky-boxes/my?wallet= — player's own opening history
router.get('/lucky-boxes/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await boxSvc.getMyOpenings(wallet, req.query.limit || 20)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/lucky-boxes/open — { wallet, boxTypeId }
router.post('/lucky-boxes/open', async (req, res) => {
  const { wallet, boxTypeId } = req.body || {};
  if (!wallet || !boxTypeId) return res.status(400).json({ error: 'wallet and boxTypeId required' });
  try {
    const result = await boxSvc.openBox(wallet, parseInt(boxTypeId, 10));

    // Side effects
    if (logGPActivity) {
      logGPActivity(wallet.toLowerCase(), -result.gpSpent, 'lucky_box',
        `Opened ${result.boxIcon} ${result.boxName}`).catch(() => {});
    }
    if (seasonService && seasonService.trackGPSpend) {
      seasonService.trackGPSpend(wallet.toLowerCase(), result.gpSpent).catch(() => {});
    }
    if (weeklySvc && weeklySvc.trackProgress) {
      weeklySvc.trackProgress(wallet.toLowerCase(), 'gp_burn', result.gpSpent).catch(() => {});
    }

    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
