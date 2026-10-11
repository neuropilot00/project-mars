const express = require('express');
const jwt = require('jsonwebtoken');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool, getSetting } = require('../db');
const { requireAuth, getAuthWallet } = require('../utils/apiHelpers');

let weatherService;
try { weatherService = require('../services/weather'); } catch (_e) { /* weather service not available */ }
let explorationService;
try { explorationService = require('../services/exploration'); } catch (_e) { /* exploration service not available */ }
let rocketService;
try { rocketService = require('../services/rocket'); } catch (_e) { /* rocket service not available */ }
let dailyService;
try { dailyService = require('../services/daily'); } catch (_e) { /* daily engagement service not available */ }
let seasonService;
try { seasonService = require('../services/season'); } catch (_e) { /* season service not available */ }

const router = express.Router();

const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000, max: 120,
  message: { error: 'Too many requests. Please slow down.' }
});
const writeLimiter = makeRateLimiter({
  windowMs: 60 * 1000, max: 30,
  message: { error: 'Too many write requests. Please wait.' }
});

function getOptionalAuthWallet(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return '';
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    return (user?.wallet_address || user?.wallet || user?.walletAddress || '').toLowerCase().trim();
  } catch (_) {
    return '';
  }
}

// ══════════════════════════════════════
// MARS WEATHER
// ══════════════════════════════════════

// GET /api/weather — active weather events
router.get('/weather', readLimiter, async (req, res) => {
  try {
    if (!weatherService) return res.json({ active: [] });
    const active = await weatherService.getActiveWeather();
    res.json({ active, serverTime: new Date().toISOString() });
  } catch (e) {
    console.error('[WEATHER] get error:', e.message);
    res.json({ active: [] });
  }
});

// ══════════════════════════════════════
// EXPLORATION (POIs + Starlink)
// ══════════════════════════════════════

// GET /api/exploration/pois — active POIs
// Uses optional auth to also return the user's owned sector IDs so the client
// can show whether a POI is discoverable without a round-trip.
router.get('/exploration/pois', readLimiter, async (req, res) => {
  try {
    if (!explorationService) return res.json({ pois: [], ownedSectorIds: [], explorationFee: 0, userPP: 0 });
    const pois = await explorationService.getActivePOIs();
    let ownedSectorIds = [];
    let userPP = 0;
    const w = getOptionalAuthWallet(req);
    if (w) {
      try {
        // Use LOWER(owner) to match the discovery check's case-insensitive
        // comparison — otherwise users with mixed-case wallet addresses in
        // pixels.owner see "No territory in this sector" despite owning land.
        const r = await pool.query(
          'SELECT DISTINCT sector_id FROM pixels WHERE LOWER(owner) = LOWER($1) AND sector_id IS NOT NULL',
          [w]
        );
        ownedSectorIds = r.rows.map(row => row.sector_id);
      } catch (_e) { /* non-critical */ }
      try {
        const u = await pool.query('SELECT pp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1)', [w]);
        userPP = parseFloat(u.rows[0]?.pp_balance || 0);
      } catch (_e) { /* non-critical */ }
    }
    const explorationFee = parseFloat(await getSetting('exploration_fee_pp') || 0);
    res.json({ pois, ownedSectorIds, explorationFee, userPP, serverTime: new Date().toISOString() });
  } catch (e) {
    console.error('[EXPLORE] pois error:', e.message);
    res.json({ pois: [], ownedSectorIds: [], explorationFee: 0, userPP: 0 });
  }
});

// POST /api/exploration/discover — discover a POI
router.post('/exploration/discover', requireAuth, writeLimiter, async (req, res) => {
  try {
    if (!explorationService) return res.status(503).json({ error: 'Exploration system not available' });
    const { poiId } = req.body;
    const wallet = getAuthWallet(req);
    if (!wallet || !poiId) return res.status(400).json({ error: 'Missing wallet or poiId' });
    const result = await explorationService.discoverPOI(wallet.toLowerCase(), parseInt(poiId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
    // Daily mission progress hook (non-blocking)
    if (dailyService && !result.error) {
      try { await dailyService.updateMissionProgress(wallet.toLowerCase(), 'explore_poi', 1); } catch (_de) { /* non-critical */ }
    }
    // Season tracking: POI discovery (non-blocking)
    if (seasonService && result.success) {
      const sw = wallet.toLowerCase();
      seasonService.addSeasonScore(sw, 'poi', 1).catch(() => {}); // explorer
      if (result.reward) {
        if (result.reward.type === 'pp') seasonService.addSeasonScore(sw, 'pp_earn', 1).catch(() => {});
        if (result.reward.type === 'gp') seasonService.addSeasonScore(sw, 'gp_earn', Math.round(result.reward.amount)).catch(() => {});
      }
    }
  } catch (e) {
    console.error('[EXPLORE] discover error:', e.message);
    res.status(500).json({ error: 'Discovery failed' });
  }
});

// GET /api/exploration/starlink — satellite positions + active boosts
router.get('/exploration/starlink', readLimiter, async (req, res) => {
  try {
    if (!explorationService) return res.json({ satellites: [], passes: [] });
    const satellites = explorationService.getSatellitePositions();
    const passes = await explorationService.getActiveStarlinkPasses();
    res.json({ satellites, passes, serverTime: new Date().toISOString() });
  } catch (e) {
    console.error('[STARLINK] error:', e.message);
    res.json({ satellites: [], passes: [] });
  }
});

// POST /api/exploration/hint — get approximate direction to nearest undiscovered POI (0.2 PP)
router.post('/exploration/hint', requireAuth, writeLimiter, (_req, res) => {
  res.status(410).json({ error: 'POI hint sales are retired. Available sites are shown on the map.' });
});

// ══════════════════════════════════════
// ROCKET EVENTS
// ══════════════════════════════════════

// GET /api/rockets — active rocket events
router.get('/rockets', readLimiter, async (req, res) => {
  try {
    if (!rocketService) return res.json({ events: [] });
    const events = await rocketService.getActiveRocketEvents();
    res.json({ events, serverTime: new Date().toISOString() });
  } catch (e) {
    console.error('[ROCKET] list error:', e.message);
    res.json({ events: [] });
  }
});

// GET /api/rockets/:id/loot — unclaimed loot positions
router.get('/rockets/:id/loot', readLimiter, async (req, res) => {
  try {
    if (!rocketService) return res.json({ loot: [] });
    const loot = await rocketService.getRocketLoot(parseInt(req.params.id));
    res.json({ loot });
  } catch (e) {
    console.error('[ROCKET] loot error:', e.message);
    res.json({ loot: [] });
  }
});

// POST /api/rockets/trigger — commander triggers a rocket drop
router.post('/rockets/trigger', requireAuth, writeLimiter, async (req, res) => {
  try {
    if (!rocketService) return res.status(503).json({ error: 'Rocket system not available' });
    const wallet = getAuthWallet(req);
    if (!wallet) return res.status(400).json({ error: 'Missing wallet' });
    // Verify commander — commander_wallet lives in the `commander` table (id=1),
    // NOT in `game_settings`. Old code always 403'd.
    let cmdWallet = null;
    try {
      const cmdRes = await pool.query("SELECT commander_wallet FROM commander WHERE id = 1");
      cmdWallet = cmdRes.rows[0]?.commander_wallet || null;
    } catch (_e) { /* table missing — fall through */ }
    if (!cmdWallet || wallet.toLowerCase() !== String(cmdWallet).toLowerCase()) {
      return res.status(403).json({ error: 'Only the commander can trigger rocket drops' });
    }
    const result = await rocketService.scheduleRocketEvent(wallet.toLowerCase());
    if (result && result.error) return res.status(400).json(result);
    res.json({ success: true, event: result });
  } catch (e) {
    console.error('[ROCKET] trigger error:', e.message);
    res.status(500).json({ error: 'Trigger failed: ' + e.message });
  }
});

// POST /api/rockets/claim-loot — claim a loot item
router.post('/rockets/claim-loot', requireAuth, writeLimiter, async (req, res) => {
  try {
    if (!rocketService) return res.status(503).json({ error: 'Rocket system not available' });
    const { rocketEventId, lootIndex } = req.body;
    const wallet = getAuthWallet(req);
    if (!wallet || rocketEventId == null || lootIndex == null) return res.status(400).json({ error: 'Missing fields' });
    const result = await rocketService.claimRocketLoot(wallet.toLowerCase(), parseInt(rocketEventId), parseInt(lootIndex));
    if (result.error) return res.status(400).json(result);
    res.json(result);
    // Season tracking: rocket participation
    if (seasonService && result.success) { seasonService.addSeasonScore(wallet.toLowerCase(), 'rocket', 1).catch(() => {}); }
  } catch (e) {
    console.error('[ROCKET] claim error:', e.message);
    res.status(500).json({ error: 'Claim failed' });
  }
});

// POST /api/rockets/priority — purchase priority notification for rocket loot (0.3 PP)
router.post('/rockets/priority', requireAuth, writeLimiter, (_req, res) => {
  res.status(410).json({ error: 'Rocket priority sales are retired.' });
});

// GET /api/rockets/priority?rocketEventId= — check priority status
router.get('/rockets/priority', readLimiter, async (req, res) => {
  const w = getOptionalAuthWallet(req);
  const rocketEventId = req.query.rocketEventId;
  if (!w || !rocketEventId) return res.json({ hasPriority: false });
  try {
    const result = await pool.query(
      'SELECT id FROM loot_priority_claims WHERE wallet = $1 AND rocket_event_id = $2', [w, rocketEventId]
    );
    res.json({ hasPriority: result.rows.length > 0 });
  } catch (e) {
    res.json({ hasPriority: false });
  }
});

module.exports = router;
