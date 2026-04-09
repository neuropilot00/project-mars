const { pool, getSetting } = require('../db');

// ═══════════════════════════════════════
//  SCHEDULE ROCKET EVENT
// ═══════════════════════════════════════

async function scheduleRocketEvent(triggeredBy) {
  const enabled = await getSetting('rocket_enabled');
  if (enabled === 'false') return null;

  const advanceHours = parseFloat(await getSetting('rocket_advance_notice_hours') || '2');
  const lootingHours = parseFloat(await getSetting('rocket_looting_hours') || '1');
  const rudChance = parseInt(await getSetting('rocket_rud_chance') || '5');
  const normalLoot = parseInt(await getSetting('rocket_loot_count_normal') || '15');
  const rudLoot = parseInt(await getSetting('rocket_loot_count_rud') || '30');
  const minPP = parseFloat(await getSetting('rocket_loot_min_pp') || '0.1');
  const maxPP = parseFloat(await getSetting('rocket_loot_max_pp') || '1.0');
  const normalRadius = parseFloat(await getSetting('rocket_loot_radius') || '5');
  const rudRadius = parseFloat(await getSetting('rocket_rud_radius') || '10');

  // Check for existing incoming/landed events
  const existing = await pool.query(
    "SELECT id FROM rocket_events WHERE status IN ('incoming','landed','looting') LIMIT 1"
  );
  if (existing.rows.length > 0) return { error: 'A rocket event is already active' };

  // Random landing coords (avoid extreme poles)
  const lat = -60 + Math.random() * 120; // -60 to 60
  const lng = -180 + Math.random() * 360;

  // Determine event type
  const isRUD = Math.random() * 100 < rudChance;
  const eventType = isRUD ? 'rud_explosion' : 'supply_drop';
  const lootCount = isRUD ? rudLoot : normalLoot;
  const radius = isRUD ? rudRadius : normalRadius;

  // Find sector
  let sectorId = null;
  try {
    const sectors = await pool.query('SELECT id, polygon FROM sectors');
    for (const s of sectors.rows) {
      const polygon = typeof s.polygon === 'string' ? JSON.parse(s.polygon) : s.polygon;
      if (polygon && pointInPolygon([lng, lat], polygon)) {
        sectorId = s.id;
        break;
      }
    }
  } catch (_e) { /* sector lookup failed */ }

  // Generate loot positions
  const rewards = [];
  for (let i = 0; i < lootCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    const lootLat = lat + Math.cos(angle) * dist;
    const lootLng = lng + Math.sin(angle) * dist;
    const amount = Math.round((minPP + Math.random() * (maxPP - minPP)) * 100) / 100;

    // Small chance of starship_border cosmetic (2% per loot)
    const isCosmetic = Math.random() < 0.02;
    rewards.push({
      index: i,
      lat: Math.round(lootLat * 100) / 100,
      lng: Math.round(lootLng * 100) / 100,
      type: isCosmetic ? 'item' : 'pp',
      amount: isCosmetic ? 1 : amount,
      itemCode: isCosmetic ? 'starship_border' : null,
      claimedBy: null
    });
  }

  const landingAt = new Date(Date.now() + advanceHours * 60 * 60 * 1000);
  const lootingEndsAt = new Date(landingAt.getTime() + lootingHours * 60 * 60 * 1000);

  const res = await pool.query(
    `INSERT INTO rocket_events (landing_lat, landing_lng, sector_id, event_type, status, landing_at, looting_ends_at, rewards_json, total_rewards, triggered_by)
     VALUES ($1, $2, $3, $4, 'incoming', $5, $6, $7, $8, $9) RETURNING id`,
    [lat, lng, sectorId, eventType, landingAt, lootingEndsAt, JSON.stringify(rewards), lootCount, triggeredBy || null]
  );

  console.log(`[ROCKET] Scheduled ${eventType} at (${lat.toFixed(1)}, ${lng.toFixed(1)}) — landing in ${advanceHours}h, ${lootCount} loot items`);
  return {
    id: res.rows[0].id,
    eventType,
    lat, lng,
    sectorId,
    landingAt,
    lootingEndsAt,
    lootCount
  };
}

// ═══════════════════════════════════════
//  PROCESS ROCKET LANDING (incoming → looting)
// ═══════════════════════════════════════

async function processRocketLanding() {
  const res = await pool.query(
    "UPDATE rocket_events SET status = 'looting' WHERE status = 'incoming' AND landing_at <= NOW() RETURNING id, event_type, landing_lat, landing_lng"
  );
  for (const r of res.rows) {
    console.log(`[ROCKET] ${r.event_type} #${r.id} has landed at (${r.landing_lat.toFixed(1)}, ${r.landing_lng.toFixed(1)}) — looting open!`);
  }
  return res.rows;
}

// ═══════════════════════════════════════
//  PROCESS ROCKET COMPLETION (looting → completed)
// ═══════════════════════════════════════

async function processRocketCompletion() {
  const res = await pool.query(
    "UPDATE rocket_events SET status = 'completed' WHERE status = 'looting' AND looting_ends_at <= NOW() RETURNING id"
  );
  for (const r of res.rows) {
    console.log(`[ROCKET] Event #${r.id} looting period ended — completed`);
  }
  return res.rows;
}

// ═══════════════════════════════════════
//  GET ACTIVE ROCKET EVENTS
// ═══════════════════════════════════════

async function getActiveRocketEvents() {
  const res = await pool.query(
    `SELECT re.*, s.name AS sector_name FROM rocket_events re
     LEFT JOIN sectors s ON s.id = re.sector_id
     WHERE re.status != 'completed'
     ORDER BY re.created_at DESC`
  );
  return res.rows.map(r => ({
    id: r.id,
    lat: parseFloat(r.landing_lat),
    lng: parseFloat(r.landing_lng),
    sectorId: r.sector_id,
    sectorName: r.sector_name,
    eventType: r.event_type,
    status: r.status,
    landingAt: r.landing_at,
    lootingEndsAt: r.looting_ends_at,
    totalRewards: r.total_rewards,
    claimedRewards: r.claimed_rewards,
    triggeredBy: r.triggered_by
  }));
}

// ═══════════════════════════════════════
//  GET LOOT FOR EVENT
// ═══════════════════════════════════════

async function getRocketLoot(eventId) {
  const res = await pool.query(
    'SELECT rewards_json, status FROM rocket_events WHERE id = $1', [eventId]
  );
  if (!res.rows.length) return [];
  const rewards = res.rows[0].rewards_json || [];
  // Only show unclaimed loot
  return rewards.filter(r => !r.claimedBy).map(r => ({
    index: r.index,
    lat: r.lat,
    lng: r.lng,
    type: r.type,
    // Hide exact amount until claimed
    hasItem: r.type === 'item'
  }));
}

// ═══════════════════════════════════════
//  CLAIM ROCKET LOOT
// ═══════════════════════════════════════

async function claimRocketLoot(wallet, eventId, lootIndex) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock event row
    const evRes = await client.query(
      "SELECT * FROM rocket_events WHERE id = $1 AND status = 'looting' FOR UPDATE",
      [eventId]
    );
    if (!evRes.rows.length) {
      await client.query('ROLLBACK');
      return { error: 'Event not available for looting' };
    }

    const event = evRes.rows[0];
    const rewards = event.rewards_json || [];
    const loot = rewards.find(r => r.index === lootIndex);
    if (!loot) {
      await client.query('ROLLBACK');
      return { error: 'Invalid loot index' };
    }
    if (loot.claimedBy) {
      await client.query('ROLLBACK');
      return { error: 'Already claimed' };
    }

    // Mark loot as claimed
    loot.claimedBy = wallet;
    await client.query(
      'UPDATE rocket_events SET rewards_json = $1, claimed_rewards = claimed_rewards + 1 WHERE id = $2',
      [JSON.stringify(rewards), eventId]
    );

    // Record claim
    await client.query(
      'INSERT INTO rocket_loot_claims (rocket_event_id, wallet, loot_index, reward_type, reward_amount, reward_item_code) VALUES ($1,$2,$3,$4,$5,$6)',
      [eventId, wallet, lootIndex, loot.type, loot.amount, loot.itemCode]
    );

    // Grant reward
    let rewardGiven = { type: loot.type, amount: loot.amount, itemCode: loot.itemCode };
    if (loot.type === 'pp') {
      const poolRes = await client.query('SELECT quest_reward_pool FROM platform_stats LIMIT 1');
      const poolBal = poolRes.rows[0] ? parseFloat(poolRes.rows[0].quest_reward_pool) : 0;
      const reward = Math.min(loot.amount, poolBal);
      if (reward > 0) {
        await client.query('UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2', [reward, wallet]);
        await client.query('UPDATE platform_stats SET quest_reward_pool = quest_reward_pool - $1', [reward]);
        rewardGiven.amount = reward;
      }
    } else if (loot.type === 'item' && loot.itemCode) {
      // Grant item to inventory
      await client.query(
        `INSERT INTO user_items (wallet, item_code, quantity) VALUES ($1, $2, 1)
         ON CONFLICT (wallet, item_code) DO UPDATE SET quantity = user_items.quantity + 1`,
        [wallet, loot.itemCode]
      );
    }

    await client.query('COMMIT');
    return { success: true, reward: rewardGiven };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════
//  AUTO-SCHEDULE (12h interval)
// ═══════════════════════════════════════

async function autoScheduleRocket() {
  const enabled = await getSetting('rocket_enabled');
  if (enabled === 'false') return;

  // Check if there's any active or recently completed event
  const recent = await pool.query(
    "SELECT id FROM rocket_events WHERE created_at > NOW() - INTERVAL '6 hours' LIMIT 1"
  );
  if (recent.rows.length > 0) return; // Too recent

  await scheduleRocketEvent(null);
}

// ═══════════════════════════════════════
//  HELPER
// ═══════════════════════════════════════

function pointInPolygon(point, polygon) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

module.exports = {
  scheduleRocketEvent,
  processRocketLanding,
  processRocketCompletion,
  getActiveRocketEvents,
  getRocketLoot,
  claimRocketLoot,
  autoScheduleRocket
};
