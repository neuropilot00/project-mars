// server/services/rocket.js
// ═══════════════════════════════════════════════════════════════
// Rocket Supply Drop System  [STATUS: 🟢 LIVE]
//
// 화성 표면에 보급/RUD 로켓이 떨어지면 일정 반경에 loot 마커가 생기고
// 유저가 맵에서 클릭해 선착순으로 수령. GP / item / XP / PP / cosmetic 드롭.
//
// ─── Flow ─────────────────────────────────────────────────
// 1. autoScheduleRocket() — 12시간마다 자동 (server/index.js:725~)
//    또는 커맨더가 POST /api/rockets/trigger로 수동 발사
// 2. status: 'incoming' (advance_notice_hours = 2h 카운트다운)
// 3. processRocketLanding() — 1분 스케줄러: incoming → looting 전환
// 4. 유저는 맵 마커 클릭 → POST /api/rockets/claim-loot
// 5. processRocketCompletion() — looting_ends_at 도래 시 completed
//
// ─── Recent fix ───────────────────────────────────────────
// - 62fb37f: /api/rockets/trigger의 commander 검증을 game_settings → commander
//            테이블로 수정 (이전엔 항상 403 반환).
//
// ─── 관련 settings (admin 조정 가능) ──────────────────────
//   rocket_enabled, rocket_advance_notice_hours, rocket_looting_hours,
//   rocket_rud_chance, rocket_loot_count_normal/rud, rocket_loot_radius,
//   rocket_drop_{gp|item|xp|pp|cosmetic}_weight
// ═══════════════════════════════════════════════════════════════

const { pool, getSetting } = require('../db');
const { sendTelegramNotification } = require('./telegram');

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
  const minPP = parseFloat(await getSetting('rocket_loot_min_pp') || '0.02');
  const maxPP = parseFloat(await getSetting('rocket_loot_max_pp') || '0.1');
  const minGP = parseFloat(await getSetting('rocket_loot_min_gp') || '10');
  const maxGP = parseFloat(await getSetting('rocket_loot_max_gp') || '40');
  const minXP = parseInt(await getSetting('rocket_loot_min_xp') || '5');
  const maxXP = parseInt(await getSetting('rocket_loot_max_xp') || '25');
  const normalRadius = parseFloat(await getSetting('rocket_loot_radius') || '5');
  const rudRadius = parseFloat(await getSetting('rocket_rud_radius') || '10');

  // Weighted drop distribution (admin configurable) — rewards mix GP / Item / Mineral / XP / PP / Cosmetic.
  // PP 는 crypto real-value 라 가장 드물게.
  const wGP       = parseInt(await getSetting('rocket_drop_gp_weight')       || '30');
  const wItem     = parseInt(await getSetting('rocket_drop_item_weight')     || '25');
  const wMineral  = parseInt(await getSetting('rocket_drop_mineral_weight')  || '25');
  const wXP       = parseInt(await getSetting('rocket_drop_xp_weight')       || '12');
  const wPP       = parseInt(await getSetting('rocket_drop_pp_weight')       || '6');
  const wCosmetic = parseInt(await getSetting('rocket_drop_cosmetic_weight') || '2');
  const totalWeight = wGP + wItem + wMineral + wXP + wPP + wCosmetic || 1;

  // Load battle item drop table (shared with POI system — admin-managed).
  let dropTable = [];
  try {
    const dtRes = await pool.query('SELECT item_code, weight, min_qty, max_qty FROM poi_drop_table WHERE active = true');
    dropTable = dtRes.rows;
  } catch (_e) { /* table missing — handled below */ }

  // Load mineral pool (resources.code 쉼표 구분 from settings) — 광물 풀이 비면 mineral slot 은 GP 로 fallback.
  const mineralPoolRaw = String(await getSetting('rocket_drop_mineral_pool') || 'iron_ore,carbon_fiber,silicon_chip').replace(/^"|"$/g, '');
  const mineralCodes = mineralPoolRaw.split(',').map(s => s.trim()).filter(Boolean);
  const mineralMinQty = parseInt(await getSetting('rocket_drop_mineral_min_qty') || '1');
  const mineralMaxQty = parseInt(await getSetting('rocket_drop_mineral_max_qty') || '5');
  let mineralPool = [];
  if (mineralCodes.length) {
    try {
      const mpRes = await pool.query(
        `SELECT id, code, name_ko, icon_emoji FROM resources WHERE code = ANY($1::text[]) AND is_active = true`,
        [mineralCodes]
      );
      mineralPool = mpRes.rows;
    } catch (_e) { /* resources table missing — mineral slot will fall back */ }
  }

  // Check for existing incoming/landed events — [v7.65] advisory lock prevents concurrent duplicate insert
  const lockClient = await pool.connect();
  try {
    await lockClient.query('BEGIN');
    await lockClient.query('SELECT pg_advisory_xact_lock(75300)'); // 75300 = rocket scheduler lock key
    const existing = await lockClient.query(
      "SELECT id FROM rocket_events WHERE status IN ('incoming','landed','looting') LIMIT 1"
    );
    if (existing.rows.length > 0) {
      await lockClient.query('ROLLBACK');
      return { error: 'A rocket event is already active' };
    }
    // Also check recent creation
    const recentRow = await lockClient.query(
      "SELECT id FROM rocket_events WHERE created_at > NOW() - INTERVAL '6 hours' LIMIT 1"
    );
    if (recentRow.rows.length > 0) {
      await lockClient.query('ROLLBACK');
      return { error: 'Rocket event created too recently' };
    }
    await lockClient.query('COMMIT');
  } catch (e) {
    await lockClient.query('ROLLBACK');
    throw e;
  } finally {
    lockClient.release();
  }

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
    const sectors = await pool.query('SELECT id, bounds_polygon FROM sectors');
    for (const s of sectors.rows) {
      const polygon = typeof s.bounds_polygon === 'string' ? JSON.parse(s.bounds_polygon) : s.bounds_polygon;
      if (polygon && pointInPolygon([lng, lat], polygon)) {
        sectorId = s.id;
        break;
      }
    }
  } catch (_e) { /* sector lookup failed */ }

  // Generate loot positions with weighted reward types
  const rewards = [];
  for (let i = 0; i < lootCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    const lootLat = lat + Math.cos(angle) * dist;
    const lootLng = lng + Math.sin(angle) * dist;

    // Weighted pick: GP > Item > Mineral > XP > PP > Cosmetic
    let roll = Math.random() * totalWeight;
    let type, amount, itemCode = null;
    if (roll < wGP) {
      type = 'gp';
      amount = Math.round(minGP + Math.random() * (maxGP - minGP));
    } else if ((roll -= wGP) < wItem && dropTable.length > 0) {
      type = 'item';
      const picked = weightedPickItem(dropTable);
      itemCode = picked.item_code;
      amount = randInt(picked.min_qty || 1, picked.max_qty || 1);
    } else if ((roll -= wItem) < wMineral && mineralPool.length > 0) {
      type = 'mineral';
      const picked = mineralPool[Math.floor(Math.random() * mineralPool.length)];
      itemCode = picked.code;
      amount = randInt(mineralMinQty, mineralMaxQty);
    } else if ((roll -= wMineral) < wXP) {
      type = 'xp';
      amount = randInt(minXP, maxXP);
    } else if ((roll -= wXP) < wPP) {
      type = 'pp';
      amount = Math.round((minPP + Math.random() * (maxPP - minPP)) * 100) / 100;
    } else {
      // Cosmetic: starship_border (rocket signature)
      type = 'cosmetic';
      itemCode = 'starship_border';
      amount = 1;
    }

    rewards.push({
      index: i,
      lat: Math.round(lootLat * 100) / 100,
      lng: Math.round(lootLng * 100) / 100,
      type,
      amount,
      itemCode,
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
  // Telegram notification for rocket events
  const rocketEmoji = isRUD ? '💥' : '🚀';
  const typeLabel = isRUD ? 'RUD EXPLOSION' : 'SUPPLY DROP';
  sendTelegramNotification(
    `<b>${rocketEmoji} ROCKET EVENT: ${typeLabel}</b>\n\nLocation: (${lat.toFixed(1)}°, ${lng.toFixed(1)}°)\nLanding in: ${advanceHours}h\nLoot items: ${lootCount}\n\nGet ready to collect!`
  ).catch(() => {});
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
    const emoji = r.event_type === 'rud_explosion' ? '💥' : '🚀';
    sendTelegramNotification(
      `<b>${emoji} ROCKET HAS LANDED!</b>\n\n${r.event_type === 'rud_explosion' ? 'RUD Explosion' : 'Supply Drop'} #${r.id} at (${r.landing_lat.toFixed(1)}°, ${r.landing_lng.toFixed(1)}°)\n\nLooting is now OPEN! Go collect your rewards!`
    ).catch(() => {});
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

    // Grant reward — supports gp / item / xp / pp / cosmetic
    let rewardGiven = { type: loot.type, amount: loot.amount, itemCode: loot.itemCode, itemName: null, itemIcon: null };

    if (loot.type === 'gp') {
      await client.query(
        'UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE LOWER(wallet_address) = LOWER($2)',
        [loot.amount, wallet]
      );
    } else if (loot.type === 'xp') {
      try {
        const { awardXP } = require('../db');
        await awardXP(client, wallet, loot.amount);
      } catch (_e) { /* non-critical */ }
    } else if (loot.type === 'mineral' && loot.itemCode) {
      // Mineral: user_resource_inventory 적립 (resource_id 기반)
      const resRes = await client.query(
        'SELECT id, name_ko, icon_emoji FROM resources WHERE code = $1 AND is_active = true',
        [loot.itemCode]
      );
      if (resRes.rows.length) {
        const r = resRes.rows[0];
        rewardGiven.itemName = r.name_ko;
        rewardGiven.itemIcon = r.icon_emoji;
        await client.query(
          `INSERT INTO user_resource_inventory (wallet_address, resource_id, quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (wallet_address, resource_id)
           DO UPDATE SET quantity = user_resource_inventory.quantity + $3`,
          [wallet, r.id, Math.max(1, loot.amount || 1)]
        );
      } else {
        // Fallback: mineral code 가 resources 에 없으면 GP 로 환산
        const { getSetting } = require('../db');
        const fallbackGP = parseFloat(await getSetting('rocket_loot_min_gp') || '10');
        rewardGiven.type = 'gp';
        rewardGiven.amount = fallbackGP;
        rewardGiven.itemCode = null;
        await client.query(
          'UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE LOWER(wallet_address) = LOWER($2)',
          [fallbackGP, wallet]
        );
      }
    } else if ((loot.type === 'item' || loot.type === 'cosmetic') && loot.itemCode) {
      // Look up item_type_id by code (user_items uses item_type_id, NOT item_code).
      const itemRes = await client.query(
        'SELECT id, name, icon FROM item_types WHERE code = $1 AND active = true',
        [loot.itemCode]
      );
      if (itemRes.rows.length) {
        const item = itemRes.rows[0];
        rewardGiven.itemName = item.name;
        rewardGiven.itemIcon = item.icon;
        await client.query(
          `INSERT INTO user_items (wallet, item_type_id, quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (wallet, item_type_id) DO UPDATE SET quantity = user_items.quantity + $3`,
          [wallet, item.id, Math.max(1, loot.amount || 1)]
        );
      } else {
        // Fallback: item code no longer exists in item_types → give min GP
        // (uses admin-configurable rocket_loot_min_gp, not a hardcoded number).
        const { getSetting } = require('../db');
        const fallbackGP = parseFloat(await getSetting('rocket_loot_min_gp') || '10');
        rewardGiven.type = 'gp';
        rewardGiven.amount = fallbackGP;
        rewardGiven.itemCode = null;
        await client.query(
          'UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE LOWER(wallet_address) = LOWER($2)',
          [fallbackGP, wallet]
        );
      }
    } else if (loot.type === 'pp') {
      let reward = loot.amount;
      try {
        const poolRes = await client.query('SELECT balance FROM quest_reward_pool WHERE id = 1 FOR UPDATE');
        const poolBal = poolRes.rows[0] ? parseFloat(poolRes.rows[0].balance) : 0;
        const capped = Math.min(reward, poolBal);
        if (capped > 0) {
          const poolDeductRes = await client.query(
            'UPDATE quest_reward_pool SET balance = balance - $1, total_paid = total_paid + $1, today_paid = today_paid + $1, updated_at = NOW() WHERE id = 1 AND balance >= $1',
            [capped]
          );
          // rowCount===0 means balance was depleted concurrently after our FOR UPDATE SELECT.
          // Fall through to mint directly rather than crediting without deducting.
          if (poolDeductRes.rowCount > 0) {
            reward = capped;
          } else {
            console.warn('[ROCKET] quest_reward_pool depleted concurrently, minting PP directly');
            // reward remains at original loot.amount (direct mint)
          }
        } else {
          console.warn('[ROCKET] quest_reward_pool empty, minting PP directly');
        }
      } catch (_poolErr) {
        console.warn('[ROCKET] quest_reward_pool missing, minting PP directly:', _poolErr.message);
      }
      if (reward > 0) {
        await client.query('UPDATE users SET pp_balance = pp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)', [reward, wallet]);
        rewardGiven.amount = reward;
      } else {
        rewardGiven.amount = 0;
      }
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

function weightedPickItem(dropTable) {
  const totalW = dropTable.reduce((s, d) => s + d.weight, 0);
  let roll = Math.random() * totalW;
  for (const item of dropTable) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return dropTable[dropTable.length - 1];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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
