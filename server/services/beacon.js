'use strict';
const { pool, getSetting } = require('../db');
let seasonService; try { seasonService = require('./season'); } catch(_) {}

async function getCfg() {
  const [enabled, costGP, durH, maxLen, maxMap, maxWallet, cooldownH, iconsRaw] = await Promise.all([
    getSetting('beacon_enabled',         'true'),
    getSetting('beacon_cost_gp',         '30'),
    getSetting('beacon_duration_h',      '4'),
    getSetting('beacon_max_length',      '60'),
    getSetting('beacon_max_active_map',  '20'),
    getSetting('beacon_max_per_wallet',  '2'),
    getSetting('beacon_cooldown_h',      '1'),
    getSetting('beacon_icons',           '📡,🔥,⭐,🚀,💎,🌟,⚡,🏴,🎯,🛰️'),
  ]);
  return {
    enabled:    enabled === 'true',
    costGP:     parseInt(costGP, 10),
    durH:       parseInt(durH, 10),
    maxLen:     parseInt(maxLen, 10),
    maxMap:     parseInt(maxMap, 10),
    maxWallet:  parseInt(maxWallet, 10),
    cooldownH:  parseInt(cooldownH, 10),
    icons:      iconsRaw.split(',').map(s => s.trim()).filter(Boolean),
  };
}

async function getActiveBeacons() {
  const { rows } = await pool.query(
    `SELECT b.id, b.wallet, b.x, b.y, b.message, b.icon, b.gp_paid, b.expires_at,
            COALESCE(u.nickname, b.wallet) AS nickname
     FROM map_beacons b
     LEFT JOIN users u ON u.wallet_address = b.wallet
     WHERE b.is_active = true AND b.expires_at > NOW()
     ORDER BY b.created_at DESC`
  );
  return rows;
}

async function getMyBeacons(wallet) {
  const { rows } = await pool.query(
    `SELECT id, x, y, message, icon, gp_paid, expires_at, is_active, created_at
     FROM map_beacons WHERE wallet=$1
     ORDER BY created_at DESC LIMIT 20`, [wallet]
  );
  return rows;
}

async function placeBeacon(wallet, { x, y, message, icon }) {
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Beacon system disabled');
  if (typeof x !== 'number' || typeof y !== 'number') throw new Error('Invalid coordinates');
  if (!cfg.icons.includes(icon)) icon = cfg.icons[0];
  if (message && message.length > cfg.maxLen) throw new Error('Message too long');
  message = message || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Balance check
    const balRow = await client.query('SELECT gp_balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE', [wallet]);
    if (!balRow.rows.length) throw new Error('User not found');
    if (balRow.rows[0].gp_balance < cfg.costGP) throw new Error(`Need ${cfg.costGP} GP`);

    // Global map limit
    const { rows: mapCount } = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM map_beacons WHERE is_active=true AND expires_at > NOW()`
    );
    if (mapCount[0].cnt >= cfg.maxMap) throw new Error('Map beacon limit reached — wait for some to expire');

    // Per-wallet active limit
    const { rows: wCount } = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM map_beacons WHERE wallet=$1 AND is_active=true AND expires_at > NOW()`,
      [wallet]
    );
    if (wCount[0].cnt >= cfg.maxWallet) throw new Error(`You already have ${cfg.maxWallet} active beacon(s)`);

    // Cooldown: last beacon expires_at - now must be > cooldownH ago
    const { rows: lastRow } = await client.query(
      `SELECT created_at FROM map_beacons WHERE wallet=$1 ORDER BY created_at DESC LIMIT 1`, [wallet]
    );
    if (lastRow.length) {
      const lastMs = new Date(lastRow[0].created_at).getTime();
      const coolMs = cfg.cooldownH * 3600 * 1000;
      if (Date.now() - lastMs < coolMs) {
        const waitMin = Math.ceil((coolMs - (Date.now() - lastMs)) / 60000);
        throw new Error(`Cooldown: wait ${waitMin} more minute(s)`);
      }
    }

    // Deduct GP
    await client.query('UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1', [cfg.costGP, wallet]);

    // Insert beacon
    const expiresAt = new Date(Date.now() + cfg.durH * 3600 * 1000);
    const { rows: [beacon] } = await client.query(
      `INSERT INTO map_beacons(wallet, x, y, message, icon, gp_paid, duration_h, expires_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, expires_at`,
      [wallet, x, y, message, icon, cfg.costGP, cfg.durH, expiresAt]
    );

    await client.query(
      `INSERT INTO gp_transactions(wallet, amount, type, ref_id, note)
       VALUES($1,$2,'beacon',$3,'Map Beacon placement')`,
      [wallet, -cfg.costGP, beacon.id]
    );

    await client.query('COMMIT');
    try { const { logGPActivity } = require('../db'); await logGPActivity(wallet, -cfg.costGP, 'beacon', `Beacon at (${x},${y})`); } catch(_) {}
    seasonService?.trackGPSpend?.(wallet, cfg.costGP, 'beacon').catch(() => {});

    return { id: beacon.id, expiresAt: beacon.expires_at, costGP: cfg.costGP, durH: cfg.durH };
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function expireBeacons() {
  const { rowCount } = await pool.query(
    `UPDATE map_beacons SET is_active=false WHERE is_active=true AND expires_at <= NOW()`
  );
  return rowCount;
}

async function getAdminStats() {
  const { rows: [stats] } = await pool.query(
    `SELECT COUNT(*)::int AS total_beacons,
            COUNT(CASE WHEN is_active AND expires_at > NOW() THEN 1 END)::int AS active_beacons,
            COALESCE(SUM(gp_paid),0)::int AS total_gp_sunk
     FROM map_beacons`
  );
  const { rows: recent } = await pool.query(
    `SELECT b.id, b.wallet, COALESCE(u.nickname,b.wallet) AS nickname,
            b.x, b.y, b.icon, b.message, b.gp_paid, b.expires_at, b.is_active
     FROM map_beacons b LEFT JOIN users u ON u.wallet_address = b.wallet
     ORDER BY b.created_at DESC LIMIT 30`
  );
  return { stats, recent };
}

module.exports = { getCfg, getActiveBeacons, getMyBeacons, placeBeacon, expireBeacons, getAdminStats };
