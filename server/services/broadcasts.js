'use strict';
/**
 * GP Broadcast Service — Migration 126
 * Players pay GP to show featured messages to all players for a time window.
 */
const { pool, getSetting, logGPActivity } = require('../db');

let seasonService, weeklySvc;
try { seasonService = require('./season'); }           catch (_) {}
try { weeklySvc     = require('./weeklyChallenges'); } catch (_) {}

async function getCfg() {
  const [enabled, minGp, costPerH, maxH, maxLen, maxActive, cooldownH] = await Promise.all([
    getSetting('broadcast_enabled',        'true'),
    getSetting('broadcast_min_gp',         '50'),
    getSetting('broadcast_cost_per_h_gp',  '25'),
    getSetting('broadcast_max_duration_h', '24'),
    getSetting('broadcast_max_length',     '120'),
    getSetting('broadcast_max_active',     '5'),
    getSetting('broadcast_cooldown_h',     '1'),
  ]);
  return {
    enabled:    enabled === 'true',
    minGp:      parseInt(minGp,      10),
    costPerH:   parseInt(costPerH,   10),
    maxH:       parseInt(maxH,       10),
    maxLen:     parseInt(maxLen,     10),
    maxActive:  parseInt(maxActive,  10),
    cooldownH:  parseInt(cooldownH,  10),
  };
}

// GET active broadcasts (for display)
async function getActiveBroadcasts() {
  const r = await pool.query(
    "SELECT b.*, u.nickname FROM gp_broadcasts b LEFT JOIN users u ON u.wallet_address=b.wallet WHERE b.is_active=true AND b.show_until>NOW() ORDER BY b.gp_paid DESC, b.created_at ASC LIMIT 10"
  ).catch(() => pool.query(
    "SELECT b.* FROM gp_broadcasts b WHERE b.is_active=true AND b.show_until>NOW() ORDER BY b.gp_paid DESC, b.created_at ASC LIMIT 10"
  ));
  return r.rows;
}

// GET my broadcasts
async function getMyBroadcasts(wallet, limit = 20) {
  const r = await pool.query(
    "SELECT * FROM gp_broadcasts WHERE wallet=$1 ORDER BY created_at DESC LIMIT $2",
    [wallet.toLowerCase(), Math.min(limit, 50)]
  );
  return r.rows;
}

// CREATE broadcast
async function createBroadcast(wallet, message, durationH) {
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Broadcasts are disabled');
  wallet = wallet.toLowerCase();
  message = (message || '').trim();
  durationH = Math.max(1, Math.min(parseInt(durationH, 10) || 1, cfg.maxH));

  if (!message) throw new Error('Message cannot be empty');
  if (message.length > cfg.maxLen) throw new Error(`Message too long (max ${cfg.maxLen} chars)`);

  // Basic profanity check (admin can add more)
  if (/http:\/\/|https:\/\//.test(message)) throw new Error('URLs are not allowed in broadcasts');

  const gpCost = Math.max(cfg.minGp, durationH * cfg.costPerH);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check cooldown
    if (cfg.cooldownH > 0) {
      const recent = await client.query(
        "SELECT id FROM gp_broadcasts WHERE wallet=$1 AND created_at>NOW()-($2 * INTERVAL '1 hour') LIMIT 1",
        [wallet, cfg.cooldownH]
      );
      if (recent.rows.length) throw new Error(`Please wait ${cfg.cooldownH}h between broadcasts`);
    }

    // Check max active global broadcasts
    const activeCount = await client.query(
      "SELECT COUNT(*) AS n FROM gp_broadcasts WHERE is_active=true AND show_until>NOW()"
    );
    if (parseInt(activeCount.rows[0].n, 10) >= cfg.maxActive) {
      throw new Error('Maximum active broadcasts reached. Try again later.');
    }

    // Check balance
    const bal = await client.query('SELECT gp_balance AS balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE', [wallet]);
    const balance = bal.rows.length ? parseInt(bal.rows[0].balance, 10) : 0;
    if (balance < gpCost) throw new Error(`Insufficient GP. Need ${gpCost}, have ${balance}`);

    // Deduct GP
    await client.query('UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND gp_balance >= $1', [gpCost, wallet]);
    await client.query(
      "INSERT INTO gp_transactions(wallet,amount,type,note) VALUES($1,$2,'broadcast',$3)",
      [wallet, -gpCost, `Broadcast ${durationH}h: "${message.slice(0,40)}…"`]
    );

    const showUntil = new Date(Date.now() + durationH * 3600 * 1000);
    const ins = await client.query(
      'INSERT INTO gp_broadcasts(wallet,message,gp_paid,duration_h,show_until) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [wallet, message, gpCost, durationH, showUntil]
    );

    await client.query('COMMIT');

    // Side effects
    if (logGPActivity) logGPActivity(wallet, -gpCost, 'broadcast', `${durationH}h broadcast`).catch(() => {});
    if (seasonService && seasonService.trackGPSpend) seasonService.trackGPSpend(wallet, gpCost).catch(() => {});
    if (weeklySvc && weeklySvc.trackProgress) weeklySvc.trackProgress(wallet, 'gp_burn', gpCost).catch(() => {});

    return { broadcastId: ins.rows[0].id, gpSpent: gpCost, durationH, showUntil };
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

// Expire old broadcasts (scheduler)
async function expireBroadcasts() {
  const r = await pool.query(
    "UPDATE gp_broadcasts SET is_active=false WHERE is_active=true AND show_until<=NOW() RETURNING id"
  );
  if (r.rowCount > 0) console.log(`[BROADCASTS] Expired ${r.rowCount} broadcast(s)`);
  return r.rowCount;
}

// Admin moderate (remove)
async function adminRemoveBroadcast(id) {
  await pool.query("UPDATE gp_broadcasts SET is_active=false WHERE id=$1", [parseInt(id, 10)]);
  return { ok: true };
}

async function getAdminStats() {
  const [totals, active, recent, settings] = await Promise.all([
    pool.query("SELECT COUNT(*) AS total, COALESCE(SUM(gp_paid),0) AS total_gp FROM gp_broadcasts"),
    pool.query("SELECT b.* FROM gp_broadcasts b WHERE b.is_active=true AND b.show_until>NOW() ORDER BY b.gp_paid DESC"),
    pool.query("SELECT b.* FROM gp_broadcasts b ORDER BY b.created_at DESC LIMIT 20"),
    pool.query("SELECT key, value FROM game_settings WHERE category='broadcast' ORDER BY key"),
  ]);
  return {
    totalBroadcasts: parseInt(totals.rows[0].total, 10),
    totalGP: parseInt(totals.rows[0].total_gp, 10),
    active: active.rows,
    recent: recent.rows,
    settings: Object.fromEntries(settings.rows.map(r => [r.key, r.value])),
  };
}

module.exports = { createBroadcast, getActiveBroadcasts, getMyBroadcasts, expireBroadcasts, adminRemoveBroadcast, getAdminStats, getCfg };
