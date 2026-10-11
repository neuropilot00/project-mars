// server/services/rocket.js
// ═══════════════════════════════════════════════════════════════
// Rocket Supply Drop System — existing event settlement only
//
// 화성 표면에 보급/RUD 로켓이 떨어지면 일정 반경에 loot 마커가 생기고
// 유저가 맵에서 클릭해 선착순으로 수령. GP / item / XP / PP / cosmetic 드롭.
//
// ─── Flow ─────────────────────────────────────────────────
// 1. New timed click drops and priority sales are retired; no new supply is minted.
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

const { pool, getSetting, getPPToGPRate } = require('../db');
const { sendTelegramNotification } = require('./telegram');

// ═══════════════════════════════════════
//  SCHEDULE ROCKET EVENT
// ═══════════════════════════════════════

async function scheduleRocketEvent() {
  return { error: 'Rocket click rewards are retired. Outstanding loot remains claimable until expiry.' };
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
     WHERE re.looting_ends_at > NOW() AND re.claimed_rewards < re.total_rewards
       AND (re.status = 'looting' OR (re.status = 'incoming' AND re.landing_at > NOW()))
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
    "SELECT rewards_json, status FROM rocket_events WHERE id = $1 AND status = 'looting' AND looting_ends_at > NOW()", [eventId]
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
      "SELECT * FROM rocket_events WHERE id = $1 AND status = 'looting' AND looting_ends_at > NOW() FOR UPDATE",
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
      // [v7.354] quest_reward_pool 폐지 — 로켓 룻은 GP로 전액 지급(풀 차감/throttle 없음).
      let reward = loot.amount;
      if (reward > 0) {
        const rewardGP = Math.round(reward * await getPPToGPRate(client) * 1000000) / 1000000;
        // [경제v2 P2] 로켓 PP 룻은 PP 발행 대신 가치 보존 GP로 지급.
        await client.query('UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE LOWER(wallet_address) = LOWER($2)', [rewardGP, wallet]);
        rewardGiven.type = 'gp';
        rewardGiven.amount = rewardGP;
        rewardGiven.currency = 'gp';
        rewardGiven.gpAmount = rewardGP;
      } else {
        rewardGiven.amount = 0;
      }
    }

    // Persist the actual granted currency, including PP-to-GP and retired item fallbacks.
    await client.query(
      'INSERT INTO rocket_loot_claims (rocket_event_id, wallet, loot_index, reward_type, reward_amount, reward_item_code) VALUES ($1,$2,$3,$4,$5,$6)',
      [eventId, wallet, lootIndex, rewardGiven.type, rewardGiven.amount, rewardGiven.itemCode]
    );

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
  // New timed click drops are retired. Landing/completion still settle existing events.
  return;
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
