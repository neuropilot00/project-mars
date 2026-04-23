'use strict';

/**
 * services/ship.js
 * Ship Construction System (Migration 092)
 *
 * buildShip(walletAddress, shipType)
 * getUserShips(walletAddress)
 * getFleetStats(walletAddress)
 * repairShip(walletAddress, shipId)
 * destroyShip(client, shipId)         ← called by battle engine
 * getBlueprints()
 */

const pool = require('../db');

// ── Ship type definitions ──
const SHIP_TYPES = {
  fishing:     { name: 'Fishing Boat',   icon: '🎣', hp: 60,  atk: 5,  def: 3,  spd: 6,  settingKey: 'ship_fishing_gp'     },
  container:   { name: 'Container Ship', icon: '📦', hp: 120, atk: 4,  def: 10, spd: 2,  settingKey: 'ship_container_gp'   },
  explorer:    { name: 'Explorer',       icon: '🔭', hp: 80,  atk: 8,  def: 6,  spd: 7,  settingKey: 'ship_explorer_gp'    },
  tugboat:     { name: 'Tugboat',        icon: '⚓', hp: 70,  atk: 4,  def: 8,  spd: 3,  settingKey: 'ship_tugboat_gp'     },
  dreadnought: { name: 'Dreadnought',    icon: '⚔️', hp: 300, atk: 40, def: 25, spd: 2,  settingKey: 'ship_dreadnought_gp' },
  drilling:    { name: 'Drilling Ship',  icon: '⛏️', hp: 100, atk: 6,  def: 12, spd: 3,  settingKey: 'ship_drilling_gp'    },
  speedboat:   { name: 'Speedboat',      icon: '🚤', hp: 40,  atk: 12, def: 2,  spd: 10, settingKey: 'ship_speedboat_gp'   },
  survey:      { name: 'Survey Ship',    icon: '📡', hp: 75,  atk: 5,  def: 8,  spd: 5,  settingKey: 'ship_survey_gp'      },
  galleon:     { name: 'Galleon',        icon: '⛵', hp: 180, atk: 22, def: 15, spd: 5,  settingKey: 'ship_galleon_gp'     },
  submarine:   { name: 'Submarine',      icon: '🤿', hp: 150, atk: 30, def: 18, spd: 4,  settingKey: 'ship_submarine_gp'   },
};

async function getSetting(key, fallback = null) {
  try {
    const r = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    return r.rows[0]?.value ?? fallback;
  } catch (_) { return fallback; }
}

// ── buildShip ──
async function buildShip(walletAddress, shipType) {
  const def = SHIP_TYPES[shipType];
  if (!def) return { success: false, error: 'invalid_ship_type' };

  const enabled = await getSetting('ship_enabled', 'true');
  if (enabled !== 'true') return { success: false, error: 'ship_system_disabled' };

  const maxFleet = parseInt(await getSetting('ship_max_fleet_size', '10')) || 10;
  const gpCost   = parseInt(await getSetting(def.settingKey, '100')) || 100;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check fleet size
    const fleetRes = await client.query(
      "SELECT COUNT(*) AS cnt FROM user_ships WHERE wallet_address = $1 AND status != 'destroyed'",
      [walletAddress]
    );
    const fleetSize = parseInt(fleetRes.rows[0].cnt) || 0;
    if (fleetSize >= maxFleet) {
      await client.query('ROLLBACK');
      return { success: false, error: 'fleet_full', max: maxFleet };
    }

    // Deduct GP
    const balRes = await client.query(
      'SELECT gp_balance FROM users WHERE wallet_address = $1 FOR UPDATE',
      [walletAddress]
    );
    if (!balRes.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, error: 'user_not_found' };
    }
    const currentGP = parseFloat(balRes.rows[0].gp_balance) || 0;
    if (currentGP < gpCost) {
      await client.query('ROLLBACK');
      return { success: false, error: 'insufficient_gp', required: gpCost, balance: currentGP };
    }
    await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address = $2',
      [gpCost, walletAddress]
    );

    // Create ship
    const shipRes = await client.query(
      `INSERT INTO user_ships (wallet_address, ship_type, hp, max_hp, attack, defense, speed, build_cost_gp)
       VALUES ($1, $2, $3, $3, $4, $5, $6, $7)
       RETURNING *`,
      [walletAddress, shipType, def.hp, def.atk, def.def, def.spd, gpCost]
    );
    const ship = shipRes.rows[0];

    // Log
    await client.query(
      `INSERT INTO ship_build_log (wallet_address, ship_type, gp_cost, result, ship_id)
       VALUES ($1, $2, $3, 'built', $4)`,
      [walletAddress, shipType, gpCost, ship.id]
    );

    await client.query('COMMIT');
    return {
      success: true,
      ship: { ...ship, name: def.name, icon: def.icon },
      gp_spent: gpCost
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SHIP] buildShip error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ── getUserShips ──
async function getUserShips(walletAddress) {
  const res = await pool.query(
    `SELECT * FROM user_ships WHERE wallet_address = $1 ORDER BY created_at DESC`,
    [walletAddress]
  );
  return res.rows.map(r => ({
    ...r,
    name: SHIP_TYPES[r.ship_type]?.name || r.ship_type,
    icon: SHIP_TYPES[r.ship_type]?.icon || '🚢'
  }));
}

// ── getFleetStats ──
async function getFleetStats(walletAddress) {
  const ships = await getUserShips(walletAddress);
  const active = ships.filter(s => s.status !== 'destroyed');
  return {
    total: active.length,
    docked: active.filter(s => s.status === 'docked').length,
    deployed: active.filter(s => s.status === 'deployed').length,
    totalAtk: active.reduce((s, r) => s + (r.attack || 0), 0),
    totalDef: active.reduce((s, r) => s + (r.defense || 0), 0),
  };
}

// ── repairShip ──
async function repairShip(walletAddress, shipId) {
  const repairPct = parseInt(await getSetting('ship_repair_pct', '30')) || 30;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const shipRes = await client.query(
      "SELECT * FROM user_ships WHERE id = $1 AND wallet_address = $2 AND status != 'destroyed' FOR UPDATE",
      [shipId, walletAddress]
    );
    if (!shipRes.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, error: 'ship_not_found' };
    }
    const ship = shipRes.rows[0];
    if (ship.hp >= ship.max_hp) {
      await client.query('ROLLBACK');
      return { success: false, error: 'ship_full_hp' };
    }

    const repairCost = Math.ceil(ship.build_cost_gp * (repairPct / 100));
    const balRes = await client.query(
      'SELECT gp_balance FROM users WHERE wallet_address = $1 FOR UPDATE',
      [walletAddress]
    );
    const gp = parseFloat(balRes.rows[0]?.gp_balance) || 0;
    if (gp < repairCost) {
      await client.query('ROLLBACK');
      return { success: false, error: 'insufficient_gp', required: repairCost };
    }

    await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address = $2',
      [repairCost, walletAddress]
    );
    await client.query(
      `UPDATE user_ships SET hp = max_hp, status = 'docked', last_repaired_at = NOW()
       WHERE id = $1`,
      [shipId]
    );

    await client.query('COMMIT');
    return { success: true, repairCost };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SHIP] repairShip error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ── destroyShip ── (called by battle engine with existing client)
async function destroyShip(client, shipId) {
  await client.query(
    "UPDATE user_ships SET status = 'destroyed', hp = 0, destroyed_at = NOW() WHERE id = $1",
    [shipId]
  );
}

// ── getBlueprints ── (public — no auth required)
async function getBlueprints() {
  const blueprints = [];
  for (const [type, def] of Object.entries(SHIP_TYPES)) {
    const gpCost = parseInt(await getSetting(def.settingKey, '100')) || 100;
    blueprints.push({
      type,
      name: def.name,
      icon: def.icon,
      hp: def.hp,
      attack: def.atk,
      defense: def.def,
      speed: def.spd,
      gp_cost: gpCost,
    });
  }
  return blueprints;
}

module.exports = {
  buildShip,
  getUserShips,
  getFleetStats,
  repairShip,
  destroyShip,
  getBlueprints,
  SHIP_TYPES,
};
