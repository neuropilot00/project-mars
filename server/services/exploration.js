const { pool, getSetting } = require('../db');

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
  const enabled = await getSetting('poi_enabled');
  if (enabled === 'false') return [];

  const count = parseInt(await getSetting('poi_count_per_cycle') || '6');
  const maxActive = parseInt(await getSetting('poi_max_active') || '12');

  // Skip spawning if enough active POIs exist
  const activeRes = await pool.query('SELECT COUNT(*)::int AS cnt FROM exploration_pois WHERE active = true AND expires_at > NOW()');
  const currentActive = activeRes.rows[0]?.cnt || 0;
  if (currentActive >= maxActive) {
    console.log(`[EXPLORE] Skip spawn: ${currentActive} active POIs (max ${maxActive})`);
    return [];
  }
  const expireHours = parseInt(await getSetting('poi_expire_hours') || '12');
  const minPP = parseFloat(await getSetting('poi_reward_min_pp') || '0.05');
  const maxPP = parseFloat(await getSetting('poi_reward_max_pp') || '0.3');
  const minGP = parseFloat(await getSetting('poi_reward_min_gp') || '10');
  const maxGP = parseFloat(await getSetting('poi_reward_max_gp') || '50');

  // Reward distribution weights (admin configurable)
  const gpWeight = parseInt(await getSetting('poi_drop_gp_weight') || '70');
  const itemWeight = parseInt(await getSetting('poi_drop_item_weight') || '20');
  const ppWeight = parseInt(await getSetting('poi_drop_pp_weight') || '10');
  const totalWeight = gpWeight + itemWeight + ppWeight;

  // Load item drop table
  let dropTable = [];
  try {
    const dtRes = await pool.query('SELECT * FROM poi_drop_table WHERE active = true ORDER BY weight DESC');
    dropTable = dtRes.rows;
  } catch (_e) { /* table may not exist yet */ }

  // Scale rewards based on active user count
  const userCountRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM users WHERE created_at > NOW() - INTERVAL '30 days'");
  const activeUsers = userCountRes.rows[0]?.cnt || 1;
  const scaleFactor = Math.min(1 + Math.floor(activeUsers / 10) * 0.1, 3.0); // +10% per 10 users, max 3x

  // Get all sectors for random placement
  const sectors = await pool.query('SELECT id, bounds_polygon FROM sectors');
  if (!sectors.rows.length) return [];

  const types = Object.keys(POI_TYPES);
  const results = [];

  for (let i = 0; i < count; i++) {
    // Pick random sector
    const sector = sectors.rows[Math.floor(Math.random() * sectors.rows.length)];
    const polygon = typeof sector.bounds_polygon === 'string' ? JSON.parse(sector.bounds_polygon) : sector.bounds_polygon;
    if (!polygon || polygon.length < 3) continue;

    // Random point inside sector polygon
    const lngs = polygon.map(p => p[0]);
    const lats = polygon.map(p => p[1]);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);

    let lat, lng, inside = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      lng = minLng + Math.random() * (maxLng - minLng);
      lat = minLat + Math.random() * (maxLat - minLat);
      if (pointInPolygon([lng, lat], polygon)) { inside = true; break; }
    }
    if (!inside) { lat = (minLat + maxLat) / 2; lng = (minLng + maxLng) / 2; }

    const poiType = types[Math.floor(Math.random() * types.length)];

    // Weighted random: GP (70%) > Item (20%) > PP (10%)
    const roll = Math.random() * totalWeight;
    let rewardType, rewardAmount, rewardItemCode = null;

    if (roll < gpWeight) {
      // GP reward (most common)
      rewardType = 'gp';
      rewardAmount = Math.round((minGP + Math.random() * (maxGP - minGP)) * scaleFactor);
    } else if (roll < gpWeight + itemWeight && dropTable.length > 0) {
      // Item reward — weighted random from drop table
      rewardType = 'item';
      const picked = weightedPickItem(dropTable);
      rewardItemCode = picked.item_code;
      rewardAmount = randInt(picked.min_qty, picked.max_qty);
    } else {
      // PP reward (rare)
      rewardType = 'pp';
      rewardAmount = Math.round((minPP + Math.random() * (maxPP - minPP)) * scaleFactor * 100) / 100;
    }

    try {
      const res = await pool.query(
        `INSERT INTO exploration_pois (lat, lng, sector_id, poi_type, reward_type, reward_amount, reward_item_code, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '1 hour' * $8) RETURNING id`,
        [lat, lng, sector.id, poiType, rewardType, rewardAmount, rewardItemCode, expireHours]
      );
      results.push({ id: res.rows[0].id, sectorId: sector.id, poiType, lat, lng, rewardType, rewardAmount, rewardItemCode });
    } catch (insertErr) {
      console.warn('[EXPLORE] POI insert failed (reward_type=' + rewardType + '):', insertErr.message);
      // Fallback: try as 'xp' if constraint rejects 'gp'
      try {
        const fbRes = await pool.query(
          `INSERT INTO exploration_pois (lat, lng, sector_id, poi_type, reward_type, reward_amount, reward_item_code, expires_at)
           VALUES ($1, $2, $3, $4, 'xp', $5, NULL, NOW() + INTERVAL '1 hour' * $6) RETURNING id`,
          [lat, lng, sector.id, poiType, Math.max(5, Math.round(rewardAmount / 3)), expireHours]
        );
        results.push({ id: fbRes.rows[0].id, sectorId: sector.id, poiType, lat, lng, rewardType: 'xp', rewardAmount: Math.max(5, Math.round(rewardAmount / 3)), rewardItemCode: null });
      } catch (_e2) { /* skip this POI */ }
    }
  }

  if (results.length > 0) {
    console.log('[EXPLORE] Spawned POIs:', results.map(r => {
      const label = r.rewardType === 'item' ? `${r.rewardItemCode} x${r.rewardAmount}` : `${r.rewardAmount} ${r.rewardType.toUpperCase()}`;
      return `#${r.id} ${r.poiType} (${label}) scale:${scaleFactor}`;
    }).join(', '));
  }
  return results;
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

    // Check user has pixels in same sector
    const pixelCheck = await client.query(
      'SELECT COUNT(*)::int AS cnt FROM pixels WHERE owner = $1 AND sector_id = $2',
      [wallet, poi.sector_id]
    );
    if (!pixelCheck.rows[0].cnt) {
      await client.query('ROLLBACK');
      return { error: 'You need territory in this sector to discover POIs' };
    }

    // PP fee for exploration
    const explorationFee = parseFloat(await getSetting('exploration_fee_pp') || 0);
    if (explorationFee > 0) {
      const balRes = await client.query('SELECT pp_balance FROM users WHERE wallet_address = $1 FOR UPDATE', [wallet]);
      const ppBal = parseFloat(balRes.rows[0]?.pp_balance || 0);
      if (ppBal < explorationFee) {
        await client.query('ROLLBACK');
        return { error: `Insufficient PP. Need ${explorationFee} PP to discover POIs.` };
      }
      await client.query('UPDATE users SET pp_balance = pp_balance - $1 WHERE wallet_address = $2', [explorationFee, wallet]);
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
      await client.query('UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE wallet_address = $2', [rewardGiven.amount, wallet]);
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
        await client.query('UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE wallet_address = $2', [15, wallet]);
      }
    } else if (poi.reward_type === 'pp') {
      // PP reward — fund from quest_reward_pool (rare)
      const poolRes = await client.query('SELECT quest_reward_pool FROM platform_stats LIMIT 1');
      const poolBal = poolRes.rows[0] ? parseFloat(poolRes.rows[0].quest_reward_pool) : 0;
      const reward = Math.min(rewardGiven.amount, poolBal);
      if (reward > 0) {
        await client.query('UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2', [reward, wallet]);
        await client.query('UPDATE platform_stats SET quest_reward_pool = quest_reward_pool - $1', [reward]);
        rewardGiven.amount = reward;
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
