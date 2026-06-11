const express = require('express');
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

// ══════════════════════════════════════
// MARS WEATHER
// ══════════════════════════════════════

// GET /api/weather — active weather events
router.get('/weather', readLimiter, async (req, res) => {
  try {
    if (!weatherService) return res.json({ active: [] });
    const active = await weatherService.getActiveWeather();
    // Daily mission + Season tracking: weather check (non-blocking, needs wallet)
    const ww = (req.query.wallet || '').toLowerCase();
    if (ww) {
      if (dailyService) dailyService.updateMissionProgress(ww, 'view_weather', 1).catch(() => {});
      if (seasonService) seasonService.addSeasonScore(ww, 'weather', 1).catch(() => {});
    }
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
// Accepts ?wallet=... to also return the user's owned sector IDs so the client
// can show whether a POI is discoverable without a round-trip.
router.get('/exploration/pois', readLimiter, async (req, res) => {
  try {
    if (!explorationService) return res.json({ pois: [], ownedSectorIds: [], explorationFee: 0, userPP: 0 });
    const pois = await explorationService.getActivePOIs();
    let ownedSectorIds = [];
    let userPP = 0;
    const w = (req.query.wallet || '').toLowerCase();
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
router.post('/exploration/hint', requireAuth, writeLimiter, async (req, res) => {
  const { lat, lng } = req.body;
  const wallet = getAuthWallet(req);
  if (!wallet || lat == null || lng == null) return res.status(400).json({ error: 'Missing wallet or coordinates' });

  const client = await pool.connect();
  try {
    const w = wallet.toLowerCase();
    const hintCost = parseFloat(await getSetting('poi_hint_cost_pp', '0.2')) || 0.2;

    await client.query('BEGIN');

    // Check PP balance
    const balRes = await client.query('SELECT pp_balance FROM users WHERE wallet_address = $1 FOR UPDATE', [w]);
    const ppBal = parseFloat(balRes.rows[0]?.pp_balance || 0);
    if (ppBal < hintCost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient PP. Need ${hintCost} PP.`, cost: hintCost });
    }

    // Find nearest undiscovered POI
    const poiRes = await client.query(
      `SELECT id, lat, lng, poi_type FROM exploration_pois
       WHERE active = true AND expires_at > NOW() AND discovered_by IS NULL
       ORDER BY (lat - $1)*(lat - $1) + (lng - $2)*(lng - $2) ASC
       LIMIT 1`,
      [lat, lng]
    );

    if (!poiRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No undiscovered POIs available right now' });
    }

    const poi = poiRes.rows[0];
    const dlat = parseFloat(poi.lat) - lat;
    const dlng = parseFloat(poi.lng) - lng;
    const dist = Math.sqrt(dlat * dlat + dlng * dlng);

    // Calculate approximate direction (N/S/E/W/NE/NW/SE/SW)
    const angle = Math.atan2(dlng, dlat) * 180 / Math.PI; // degrees from north
    let direction;
    if (angle >= -22.5 && angle < 22.5) direction = 'NORTH';
    else if (angle >= 22.5 && angle < 67.5) direction = 'NORTHEAST';
    else if (angle >= 67.5 && angle < 112.5) direction = 'EAST';
    else if (angle >= 112.5 && angle < 157.5) direction = 'SOUTHEAST';
    else if (angle >= 157.5 || angle < -157.5) direction = 'SOUTH';
    else if (angle >= -157.5 && angle < -112.5) direction = 'SOUTHWEST';
    else if (angle >= -112.5 && angle < -67.5) direction = 'WEST';
    else direction = 'NORTHWEST';

    // Approximate distance category
    let distLabel;
    if (dist < 5) distLabel = 'very close';
    else if (dist < 15) distLabel = 'nearby';
    else if (dist < 40) distLabel = 'moderate distance';
    else distLabel = 'far away';

    // Deduct PP
    const deductHint = await client.query('UPDATE users SET pp_balance = pp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND pp_balance >= $1', [hintCost, w]);
    if (deductHint.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance (concurrent modification)' });
    }

    // Log transaction
    await client.query(
      `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta)
       VALUES ('poi_hint', $1, $2, 0, $3)`,
      [w, hintCost, JSON.stringify({ fromLat: lat, fromLng: lng, direction, distLabel })]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      cost: hintCost,
      hint: { direction, distance: distLabel, poiType: poi.poi_type }
    });
    // Season tracking: pp_spend (non-blocking)
    if (seasonService) { seasonService.addSeasonScore(w, 'pp_spend', 1).catch(() => {}); }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[MICRO] poi-hint error:', e.message);
    res.status(500).json({ error: 'Hint failed' });
  } finally {
    client.release();
  }
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
router.post('/rockets/priority', requireAuth, writeLimiter, async (req, res) => {
  const { rocketEventId } = req.body;
  const wallet = getAuthWallet(req);
  if (!wallet || rocketEventId == null) return res.status(400).json({ error: 'Missing wallet or rocketEventId' });

  const client = await pool.connect();
  try {
    const w = wallet.toLowerCase();
    const priorityCost = parseFloat(await getSetting('loot_priority_cost_pp', '0.3')) || 0.3;

    await client.query('BEGIN');

    // Check rocket event exists and is incoming/landed
    const evRes = await client.query(
      "SELECT id, status FROM rocket_events WHERE id = $1 AND status IN ('incoming','looting')", [rocketEventId]
    );
    if (!evRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active rocket event found' });
    }

    // Check if already purchased
    const existRes = await client.query(
      'SELECT id FROM loot_priority_claims WHERE wallet = $1 AND rocket_event_id = $2', [w, rocketEventId]
    );
    if (existRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Priority already purchased for this event' });
    }

    // Check PP balance
    const balRes = await client.query('SELECT pp_balance FROM users WHERE wallet_address = $1 FOR UPDATE', [w]);
    const ppBal = parseFloat(balRes.rows[0]?.pp_balance || 0);
    if (ppBal < priorityCost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient PP. Need ${priorityCost} PP.`, cost: priorityCost });
    }

    // Deduct PP
    const deductRocket = await client.query('UPDATE users SET pp_balance = pp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND pp_balance >= $1', [priorityCost, w]);
    if (deductRocket.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance (concurrent modification)' });
    }

    // Record priority claim
    await client.query(
      'INSERT INTO loot_priority_claims (wallet, rocket_event_id) VALUES ($1, $2)',
      [w, rocketEventId]
    );

    // Log transaction
    await client.query(
      `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta)
       VALUES ('loot_priority', $1, $2, 0, $3)`,
      [w, priorityCost, JSON.stringify({ rocketEventId })]
    );

    await client.query('COMMIT');

    res.json({ success: true, cost: priorityCost, message: 'Priority notification activated! You\'ll get a 5-second head start when loot drops.' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[MICRO] loot-priority error:', e.message);
    res.status(500).json({ error: 'Priority purchase failed' });
  } finally {
    client.release();
  }
});

// GET /api/rockets/priority?wallet=&rocketEventId= — check priority status
router.get('/rockets/priority', readLimiter, async (req, res) => {
  const w = (req.query.wallet || '').toLowerCase();
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
