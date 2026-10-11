const { pool, getSetting, getPPToGPRate } = require('../db');

// POI type definitions
const POI_TYPES = {
  ancient_ruins:  { icon: '🏛️', label: 'Ancient Ruins',   color: '#FFD700' },
  ore_deposit:    { icon: '⛏️', label: 'Ore Deposit',     color: '#FF8C00' },
  crashed_probe:  { icon: '🛸', label: 'Crashed Probe',   color: '#00FF88' },
  water_ice:      { icon: '💧', label: 'Water Ice',       color: '#00BFFF' },
  alien_artifact: { icon: '👽', label: 'Alien Artifact',  color: '#FF00FF' }
};

// Starlink satellite config (3 satellites)
const SATELLITES = [
  { id: 1, amp: 40, speed: 0.0003, offset: 0 },
  { id: 2, amp: 30, speed: 0.00025, offset: 2.09 },
  { id: 3, amp: 50, speed: 0.00035, offset: 4.19 }
];

// ═══════════════════════════════════════
//  POI SPAWNING
// ═══════════════════════════════════════

async function spawnPOIs() {
  // Retired click-reward supply; existing POIs keep their original expiry/claim rights.
  return [];
}

// Weighted random pick from drop table
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

// ═══════════════════════════════════════
//  GET ACTIVE POIs
// ═══════════════════════════════════════

async function getActivePOIs() {
  const res = await pool.query(
    `SELECT p.id, p.lat, p.lng, p.sector_id, p.poi_type, p.expires_at,
            p.discovered_by, p.discovered_at,
            s.name AS sector_name
     FROM exploration_pois p
     LEFT JOIN sectors s ON s.id = p.sector_id
     WHERE p.active = true AND p.expires_at > NOW()
     ORDER BY p.created_at DESC`
  );
  return res.rows.map(r => ({
    id: r.id,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lng),
    sectorId: r.sector_id,
    sectorName: r.sector_name,
    poiType: r.poi_type,
    expiresAt: r.expires_at,
    discovered: !!r.discovered_by,
    discoveredBy: r.discovered_by,
    icon: POI_TYPES[r.poi_type]?.icon || '📍',
    label: POI_TYPES[r.poi_type]?.label || r.poi_type,
    color: POI_TYPES[r.poi_type]?.color || '#FFFFFF'
  }));
}

// ═══════════════════════════════════════
//  DISCOVER POI
// ═══════════════════════════════════════

async function discoverPOI(wallet, poiId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock POI row
    const poiRes = await client.query(
      `SELECT * FROM exploration_pois WHERE id = $1 AND active = true AND expires_at > NOW() AND discovered_by IS NULL FOR UPDATE`,
      [poiId]
    );
    if (!poiRes.rows.length) {
      await client.query('ROLLBACK');
      return { error: 'POI not available or already discovered' };
    }
    const poi = poiRes.rows[0];

    // NOTE: POI discovery is open to all wallets (territory-agnostic).
    // Previously required pixels in the same sector; removed to boost activation.
    // Any connected wallet may discover any active POI, first-come first-served.

    // PP fee for exploration
    const explorationFee = parseFloat(String(await getSetting('exploration_fee_pp') || '0').replace(/^"|"$/g, '')) || 0;
    if (explorationFee > 0) {
      const balRes = await client.query('SELECT pp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE', [wallet]);
      const ppBal = parseFloat(balRes.rows[0]?.pp_balance || 0);
      if (ppBal < explorationFee) {
        await client.query('ROLLBACK');
        return { error: `Insufficient PP. Need ${explorationFee} PP to discover POIs.` };
      }
      const feeDeductRes = await client.query(
        'UPDATE users SET pp_balance = pp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND pp_balance >= $1',
        [explorationFee, wallet]
      );
      if (feeDeductRes.rowCount === 0) {
        // FOR UPDATE locked the row but the balance check failed (race or floating-point edge)
        await client.query('ROLLBACK');
        return { error: `Insufficient PP. Need ${explorationFee} PP to discover POIs.` };
      }
      await client.query(
        `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta)
         VALUES ('shop_purchase', $1, $2, 0, $3)`,
        [wallet, explorationFee, JSON.stringify({ action: 'exploration_fee', poiId })]
      );
    }

    // Mark as discovered
    await client.query(
      'UPDATE exploration_pois SET discovered_by = $1, discovered_at = NOW() WHERE id = $2',
      [wallet, poiId]
    );

    // Grant reward based on type: gp, pp, item, xp
    let rewardGiven = { type: poi.reward_type, amount: parseFloat(poi.reward_amount), itemCode: poi.reward_item_code, itemName: null, itemIcon: null };

    if (poi.reward_type === 'gp') {
      await client.query('UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE LOWER(wallet_address) = LOWER($2)', [rewardGiven.amount, wallet]);
    } else if (poi.reward_type === 'mineral' && poi.reward_item_code) {
      // Mineral reward — user_resource_inventory 적립 (resource_id 기반)
      const resRes = await client.query(
        'SELECT id, name_ko, icon_emoji FROM resources WHERE code = $1 AND is_active = true',
        [poi.reward_item_code]
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
          [wallet, r.id, Math.max(1, rewardGiven.amount)]
        );
      } else {
        // Fallback: mineral code missing → GP 환산
        rewardGiven.type = 'gp';
        rewardGiven.amount = 15;
        rewardGiven.itemCode = null;
        await client.query('UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE LOWER(wallet_address) = LOWER($2)', [15, wallet]);
      }
    } else if (poi.reward_type === 'item' && poi.reward_item_code) {
      // Item reward — add to user inventory
      const itemRes = await client.query('SELECT id, name, icon FROM item_types WHERE code = $1 AND active = true', [poi.reward_item_code]);
      if (itemRes.rows.length) {
        const item = itemRes.rows[0];
        rewardGiven.itemName = item.name;
        rewardGiven.itemIcon = item.icon;
        await client.query(
          `INSERT INTO user_items (wallet, item_type_id, quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (wallet, item_type_id) DO UPDATE SET quantity = user_items.quantity + $3`,
          [wallet, item.id, Math.max(1, rewardGiven.amount)]
        );
      } else {
        // Fallback: item not found, give GP instead
        rewardGiven.type = 'gp';
        rewardGiven.amount = 15;
        rewardGiven.itemCode = null;
        await client.query('UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE LOWER(wallet_address) = LOWER($2)', [15, wallet]);
      }
    } else if (poi.reward_type === 'pp') {
      // [v7.354] quest_reward_pool 폐지 — POI PP 보상은 GP로 전액 지급(풀 차감/throttle 없음).
      let reward = rewardGiven.amount;
      if (reward > 0) {
        const rewardGP = Math.round(reward * await getPPToGPRate(client) * 1000000) / 1000000;
        // [경제v2 P2] POI PP 보상은 PP 발행 대신 가치 보존 GP로 지급.
        await client.query('UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE LOWER(wallet_address) = LOWER($2)', [rewardGP, wallet]);
        rewardGiven.type = 'gp';
        rewardGiven.amount = rewardGP;
        rewardGiven.currency = 'gp';
        rewardGiven.gpAmount = rewardGP;
      } else {
        rewardGiven.amount = 0;
      }
    }

    // XP bonus for all discoveries
    const xpReward = parseInt(await getSetting('poi_discovery_xp', 5));
    try {
      const { awardXP } = require('../db');
      await awardXP(client, wallet, xpReward);
    } catch (_e) { /* XP award failed, non-critical */ }

    // Log discovery
    await client.query(
      'INSERT INTO poi_discoveries (poi_id, wallet, reward_type, reward_amount, reward_item_code) VALUES ($1, $2, $3, $4, $5)',
      [poiId, wallet, rewardGiven.type, rewardGiven.amount, rewardGiven.itemCode]
    );

    // Bonus cosmetic drop chance
    let bonusCosmetic = null;
    try {
      const cosmeticChance = parseInt(await getSetting('poi_cosmetic_chance', 5));
      if (Math.random() * 100 < cosmeticChance) {
        // Pick a random cosmetic item
        const cosRes = await client.query(
          "SELECT id, code, name, icon FROM item_types WHERE category = 'cosmetic' AND active = true ORDER BY RANDOM() LIMIT 1"
        );
        if (cosRes.rows.length) {
          const cos = cosRes.rows[0];
          await client.query(
            `INSERT INTO user_items (wallet, item_type_id, quantity)
             VALUES ($1, $2, 1)
             ON CONFLICT (wallet, item_type_id) DO UPDATE SET quantity = user_items.quantity + 1`,
            [wallet, cos.id]
          );
          bonusCosmetic = { code: cos.code, name: cos.name, icon: cos.icon };
        }
      }
    } catch (_e) { /* cosmetic bonus failed, non-critical */ }

    await client.query('COMMIT');
    return {
      success: true,
      poiType: poi.poi_type,
      reward: rewardGiven,
      xp: xpReward,
      bonusCosmetic: bonusCosmetic,
      icon: POI_TYPES[poi.poi_type]?.icon || '📍',
      label: POI_TYPES[poi.poi_type]?.label || poi.poi_type
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════
//  EXPIRE POIs
// ═══════════════════════════════════════

async function expirePOIs() {
  const res = await pool.query(
    "UPDATE exploration_pois SET active = false WHERE active = true AND expires_at < NOW() RETURNING id, poi_type"
  );
  if (res.rowCount > 0) {
    console.log('[EXPLORE] Expired:', res.rows.map(r => `#${r.id} ${r.poi_type}`).join(', '));
  }
}

// ═══════════════════════════════════════
//  STARLINK PASSES
// ═══════════════════════════════════════

function getSatellitePositions() {
  const t = Date.now();
  return SATELLITES.map(sat => {
    const lat = sat.amp * Math.sin(t * sat.speed + sat.offset);
    const lng = ((t * sat.speed * 360 / (2 * Math.PI) + sat.id * 120) % 360) - 180;
    return { id: sat.id, lat, lng };
  });
}

async function updateStarlinkPasses() {
  const enabled = await getSetting('starlink_enabled');
  if (enabled === 'false') return;

  const boostPercent = parseFloat(await getSetting('starlink_boost_percent') || '10');
  const durationHours = parseFloat(await getSetting('starlink_pass_duration_hours') || '1');
  const positions = getSatellitePositions();

  // Get sectors
  const sectors = await pool.query('SELECT id, bounds_polygon FROM sectors');

  for (const sat of positions) {
    // Find which sector the satellite is over
    for (const sector of sectors.rows) {
      const polygon = typeof sector.bounds_polygon === 'string' ? JSON.parse(sector.bounds_polygon) : sector.bounds_polygon;
      if (!polygon || polygon.length < 3) continue;

      if (pointInPolygon([sat.lng, sat.lat], polygon)) {
        // Check if there's already an active pass for this satellite in this sector
        const existing = await pool.query(
          'SELECT id FROM starlink_passes WHERE satellite_id = $1 AND sector_id = $2 AND active = true AND ends_at > NOW()',
          [sat.id, sector.id]
        );
        if (!existing.rows.length) {
          await pool.query(
            `INSERT INTO starlink_passes (satellite_id, sector_id, boost_value, started_at, ends_at)
             VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '1 hour' * $4)`,
            [sat.id, sector.id, boostPercent / 100, durationHours]
          );
          console.log(`[STARLINK] Satellite ${sat.id} passing over sector ${sector.id} — +${boostPercent}% mining boost`);
        }
        break; // Satellite can only be in one sector
      }
    }
  }
}

async function getStarlinkBoost(sectorId) {
  const res = await pool.query(
    'SELECT SUM(boost_value)::numeric AS total_boost FROM starlink_passes WHERE sector_id = $1 AND active = true AND ends_at > NOW()',
    [sectorId]
  );
  return parseFloat(res.rows[0]?.total_boost || 0);
}

async function getActiveStarlinkPasses() {
  const res = await pool.query(
    `SELECT sp.*, s.name AS sector_name FROM starlink_passes sp
     JOIN sectors s ON s.id = sp.sector_id
     WHERE sp.active = true AND sp.ends_at > NOW()
     ORDER BY sp.started_at DESC`
  );
  return res.rows.map(r => ({
    id: r.id,
    satelliteId: r.satellite_id,
    sectorId: r.sector_id,
    sectorName: r.sector_name,
    boostValue: parseFloat(r.boost_value),
    startsAt: r.started_at,
    endsAt: r.ends_at
  }));
}

async function expireStarlinkPasses() {
  await pool.query("UPDATE starlink_passes SET active = false WHERE active = true AND ends_at < NOW()");
}

// ═══════════════════════════════════════
//  HELPER: Point in polygon
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
  POI_TYPES,
  SATELLITES,
  spawnPOIs,
  getActivePOIs,
  discoverPOI,
  expirePOIs,
  getSatellitePositions,
  updateStarlinkPasses,
  getStarlinkBoost,
  getActiveStarlinkPasses,
  expireStarlinkPasses,
  pointInPolygon
};
