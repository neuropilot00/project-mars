// server/services/transport.js
// ═══════════════════════════════════════════════════════════════
// Phase C — Sector-to-Sector Transport + Raid service
//
// Exports:
//   startTransport(wallet, originSectorId, destSectorId, cargoGp)
//   settleArrivedTransports()               — scheduler (60s)
//   getMyTransports(wallet, limit=20)
//   getActiveRaidTargets(excludeWallet, limit=30)
//   attemptRaid(raiderWallet, transportId)
//   cancelTransport(wallet, transportId)    — only if <progress threshold
//   getAdminStats()
//   getSettings()
//
// 모든 수치는 settings에서 (하드코딩 금지).
// ═══════════════════════════════════════════════════════════════
'use strict';

const crypto = require('crypto');
const { pool, getSetting, logGPActivity } = require('../db');

// ── helpers ─────────────────────────────────────────────────────
async function getCfg() {
  const [
    enabled, baseDur, distMul, rewardPct, distBonusPct,
    minCargo, maxCargo, maxConcurrent, entryLvCheck,
    raidEnabled, raidSuccessBase, raidLootPct, raidCooldown,
    raidMinProg, raidMaxProg, raidSelfExempt, raidGuildExempt
  ] = await Promise.all([
    getSetting('transport_enabled', 'true'),
    getSetting('transport_base_duration_minutes', '15'),
    getSetting('transport_distance_multiplier', '0.25'),
    getSetting('transport_reward_pct_of_cargo', '10'),
    getSetting('transport_reward_distance_bonus_pct', '5'),
    getSetting('transport_min_cargo_gp', '50'),
    getSetting('transport_max_cargo_gp', '5000'),
    getSetting('transport_max_concurrent_per_user', '3'),
    getSetting('transport_entry_level_check', 'true'),
    getSetting('transport_raid_enabled', 'true'),
    getSetting('transport_raid_success_base_pct', '35'),
    getSetting('transport_raid_loot_pct', '30'),
    getSetting('transport_raid_cooldown_minutes', '10'),
    getSetting('transport_raid_min_progress_pct', '20'),
    getSetting('transport_raid_max_progress_pct', '90'),
    getSetting('transport_raid_self_exempt', 'true'),
    getSetting('transport_raid_guild_exempt', 'true')
  ]);
  return {
    enabled: String(enabled) !== 'false',
    baseDur: parseInt(baseDur) || 15,
    distMul: parseFloat(distMul) || 0.25,
    rewardPct: parseFloat(rewardPct) || 10,
    distBonusPct: parseFloat(distBonusPct) || 5,
    minCargo: parseInt(minCargo) || 50,
    maxCargo: parseInt(maxCargo) || 5000,
    maxConcurrent: parseInt(maxConcurrent) || 3,
    entryLvCheck: String(entryLvCheck) !== 'false',
    raidEnabled: String(raidEnabled) !== 'false',
    raidSuccessBase: parseFloat(raidSuccessBase) || 35,
    raidLootPct: parseFloat(raidLootPct) || 30,
    raidCooldown: parseInt(raidCooldown) || 10,
    raidMinProg: parseInt(raidMinProg) || 20,
    raidMaxProg: parseInt(raidMaxProg) || 90,
    raidSelfExempt: String(raidSelfExempt) !== 'false',
    raidGuildExempt: String(raidGuildExempt) !== 'false'
  };
}

// Great-circle-ish distance in "units" (degrees) between two sector centers
async function sectorDistance(client, aId, bId) {
  const { rows } = await client.query(
    'SELECT id, center_lat, center_lng FROM sectors WHERE id = ANY($1::int[])',
    [[aId, bId]]
  );
  if (rows.length < 2) return 0;
  const a = rows.find(r => r.id === aId);
  const b = rows.find(r => r.id === bId);
  if (!a || !b) return 0;
  const dLat = parseFloat(a.center_lat) - parseFloat(b.center_lat);
  const dLng = parseFloat(a.center_lng) - parseFloat(b.center_lng);
  // Distance unit = degrees (roughly 0-180 scale)
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

async function isMerchant(client, wallet) {
  const { rows } = await client.query(
    `SELECT j.code FROM users u
       LEFT JOIN jobs j ON j.id = u.current_job_id
      WHERE LOWER(u.wallet_address) = LOWER($1)`,
    [wallet]
  );
  return rows.length > 0 && rows[0].code === 'merchant';
}

async function getJobBuff(client, wallet, buffKey, fallback) {
  const { rows } = await client.query(
    `SELECT jb.buff_value FROM users u
       LEFT JOIN job_buffs jb ON jb.job_id = u.current_job_id AND jb.buff_key = $2
      WHERE LOWER(u.wallet_address) = LOWER($1)`,
    [wallet, buffKey]
  );
  if (rows.length > 0 && rows[0].buff_value !== null) return parseFloat(rows[0].buff_value);
  return fallback;
}

async function sameGuild(client, walletA, walletB) {
  const aLc = String(walletA || '').toLowerCase();
  const bLc = String(walletB || '').toLowerCase();
  if (!aLc || !bLc) return false;
  // guild_members.wallet column is the member identifier
  const r = await client.query(
    `SELECT LOWER(wallet) AS wallet_lc, guild_id
       FROM guild_members
      WHERE LOWER(wallet) = ANY($1::text[])`,
    [[aLc, bLc]]
  );
  const a = r.rows.find(x => x.wallet_lc === aLc);
  const b = r.rows.find(x => x.wallet_lc === bLc);
  return !!(a && b && a.guild_id && b.guild_id && a.guild_id === b.guild_id);
}

// ── main API ────────────────────────────────────────────────────

/**
 * startTransport — launch a cargo shipment from origin → dest sector
 */
async function startTransport(wallet, originSectorId, destSectorId, cargoGp) {
  const cfg = await getCfg();
  if (!cfg.enabled) return { success: false, error: 'transport_disabled' };
  if (!wallet || !originSectorId || !destSectorId) return { success: false, error: 'bad_params' };
  if (originSectorId === destSectorId) return { success: false, error: 'same_sector' };
  cargoGp = parseInt(cargoGp);
  if (!cargoGp || cargoGp < cfg.minCargo) return { success: false, error: 'cargo_too_small', min: cfg.minCargo };
  if (cargoGp > cfg.maxCargo) return { success: false, error: 'cargo_too_large', max: cfg.maxCargo };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Concurrent cap
    const activeCnt = await client.query(
      `SELECT COUNT(*)::int AS n FROM transport_jobs
        WHERE LOWER(carrier_wallet) = LOWER($1) AND status = 'in_transit'`,
      [wallet]
    );
    if (activeCnt.rows[0].n >= cfg.maxConcurrent) {
      await client.query('ROLLBACK');
      return { success: false, error: 'max_concurrent', limit: cfg.maxConcurrent };
    }

    // Balance check (case-insensitive user lookup)
    const u = await client.query(
      'SELECT wallet_address, gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE',
      [wallet]
    );
    if (!u.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'user_not_found' }; }
    const dbWallet = u.rows[0].wallet_address; // exact-case wallet for FK inserts
    const balance = parseFloat(u.rows[0].gp_balance) || 0;
    if (balance < cargoGp) {
      await client.query('ROLLBACK');
      return { success: false, error: 'insufficient_gp', balance, required: cargoGp };
    }

    // Entry level check on dest sector
    if (cfg.entryLvCheck) {
      const sec = await client.query(
        'SELECT entry_min_level, entry_check_active FROM sectors WHERE id = $1',
        [destSectorId]
      );
      if (sec.rows.length && sec.rows[0].entry_check_active) {
        const minLv = parseInt(sec.rows[0].entry_min_level) || 0;
        if (minLv > 0) {
          // user level column (users.level is the canonical rank)
          const lv = await client.query(
            'SELECT COALESCE((SELECT level FROM users WHERE LOWER(wallet_address) = LOWER($1)), 1)::int AS lv',
            [wallet]
          );
          if ((parseInt(lv.rows[0].lv) || 1) < minLv) {
            await client.query('ROLLBACK');
            return { success: false, error: 'destination_locked', requiredLevel: minLv };
          }
        }
      }
    }

    // Distance & duration
    const dist = await sectorDistance(client, originSectorId, destSectorId);
    const isMrc = await isMerchant(client, wallet);
    const speedBuff = isMrc ? await getJobBuff(client, wallet, 'merchant_transport_speed', 1.0) : 1.0;
    const rewardBuff = isMrc ? await getJobBuff(client, wallet, 'merchant_transport_reward', 1.0) : 1.0;

    // Duration (minutes) = (base + dist * distMul) * speedBuff
    const durationMin = Math.max(1, Math.round((cfg.baseDur + dist * cfg.distMul) * speedBuff));

    // Reward = cargo * (rewardPct% + distBonusPct% * dist_units) * rewardBuff
    const distBonusFactor = 1 + (cfg.distBonusPct * dist) / 100;
    const rewardBase = (cargoGp * cfg.rewardPct / 100) * distBonusFactor;
    const rewardGp = Math.max(0, Math.round(rewardBase * rewardBuff));

    // Deduct cargo from wallet (held in transit) — use DB's exact-case wallet for FK integrity
    await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2)',
      [cargoGp, wallet]
    );

    const ins = await client.query(
      `INSERT INTO transport_jobs
         (carrier_wallet, origin_sector_id, dest_sector_id, cargo_type, cargo_value,
          status, reward_gp, merchant_bonus, started_at, arrives_at)
       VALUES ($1, $2, $3, 'gp', $4, 'in_transit', $5, $6, NOW(), NOW() + ($7::text || ' minutes')::interval)
       RETURNING id, started_at, arrives_at, reward_gp`,
      [dbWallet, originSectorId, destSectorId, cargoGp, rewardGp, isMrc, String(durationMin)]
    );

    await client.query('COMMIT');

    // Fire-and-forget logging
    try { logGPActivity(wallet, -cargoGp, 'transport_hold', `Transport to sector ${destSectorId}`).catch(()=>{}); } catch(_){}
    try {
      const seasonSvc = require('./season');
      seasonSvc.addSeasonScore(wallet, 'transport_started', 1).catch(()=>{});
    } catch(_) {}

    const row = ins.rows[0];
    return {
      success: true,
      transport: {
        id: row.id,
        startedAt: row.started_at,
        arrivesAt: row.arrives_at,
        durationMin,
        distance: Math.round(dist * 100) / 100,
        rewardGp: row.reward_gp,
        merchantBonus: isMrc,
        cargoGp
      }
    };
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[transport] startTransport error:', e.message);
    return { success: false, error: 'internal_error', detail: e.message };
  } finally {
    client.release();
  }
}

/**
 * settleArrivedTransports — scheduler: pay out completed shipments
 */
async function settleArrivedTransports() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, carrier_wallet, cargo_value, reward_gp, origin_sector_id, dest_sector_id
         FROM transport_jobs
        WHERE status = 'in_transit' AND arrives_at <= NOW()
        ORDER BY arrives_at ASC
        LIMIT 100 FOR UPDATE SKIP LOCKED`
    );
    if (!rows.length) { await client.query('COMMIT'); return { settled: 0 }; }

    for (const t of rows) {
      const payout = (parseInt(t.cargo_value) || 0) + (parseInt(t.reward_gp) || 0);
      await client.query(
        'UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)',
        [payout, t.carrier_wallet]
      );
      await client.query(
        `UPDATE transport_jobs SET status='completed', completed_at=NOW() WHERE id=$1`,
        [t.id]
      );
      // Fire-and-forget
      try { logGPActivity(t.carrier_wallet, payout, 'transport_arrived', `Transport #${t.id} arrived at sector ${t.dest_sector_id}`).catch(()=>{}); } catch(_){}
      try {
        const seasonSvc = require('./season');
        seasonSvc.addSeasonScore(t.carrier_wallet, 'transport_completed', 1).catch(()=>{});
        seasonSvc.addSeasonScore(t.carrier_wallet, 'gp_earned', parseInt(t.reward_gp) || 0).catch(()=>{});
      } catch(_) {}
    }
    await client.query('COMMIT');
    return { settled: rows.length };
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[transport] settleArrivedTransports error:', e.message);
    return { settled: 0, error: e.message };
  } finally {
    client.release();
  }
}

/**
 * getMyTransports — list own transports
 */
async function getMyTransports(wallet, limit = 20) {
  const { rows } = await pool.query(
    `SELECT t.id, t.origin_sector_id, t.dest_sector_id, t.cargo_value, t.status,
            t.reward_gp, t.merchant_bonus, t.started_at, t.arrives_at, t.completed_at,
            t.raided_by, t.raided_at, t.raid_loot_gp,
            so.name AS origin_name, sd.name AS dest_name,
            ru.nickname AS raider_nick,
            CASE WHEN t.status='in_transit' THEN
              LEAST(100, GREATEST(0,
                ROUND(EXTRACT(EPOCH FROM (NOW() - t.started_at)) * 100.0
                    / NULLIF(EXTRACT(EPOCH FROM (t.arrives_at - t.started_at)), 0))))
              ELSE 100 END AS progress_pct
       FROM transport_jobs t
       LEFT JOIN sectors so ON so.id = t.origin_sector_id
       LEFT JOIN sectors sd ON sd.id = t.dest_sector_id
       LEFT JOIN users ru ON LOWER(ru.wallet_address) = LOWER(t.raided_by)
      WHERE LOWER(t.carrier_wallet) = LOWER($1)
      ORDER BY t.started_at DESC
      LIMIT $2`,
    [wallet, Math.min(100, Math.max(1, parseInt(limit) || 20))]
  );
  return rows;
}

/**
 * getActiveRaidTargets — list other users' in-transit shipments within raidable range
 */
async function getActiveRaidTargets(excludeWallet, limit = 30) {
  const cfg = await getCfg();
  if (!cfg.raidEnabled) return [];

  const { rows } = await pool.query(
    `SELECT t.id, t.carrier_wallet, t.origin_sector_id, t.dest_sector_id,
            t.cargo_value, t.started_at, t.arrives_at, t.merchant_bonus,
            uc.nickname AS carrier_nick,
            so.name AS origin_name, sd.name AS dest_name,
            GREATEST(0, LEAST(100,
              ROUND(EXTRACT(EPOCH FROM (NOW() - t.started_at)) * 100.0
                  / NULLIF(EXTRACT(EPOCH FROM (t.arrives_at - t.started_at)), 0))
            )) AS progress_pct
       FROM transport_jobs t
       LEFT JOIN users uc ON LOWER(uc.wallet_address) = LOWER(t.carrier_wallet)
       LEFT JOIN sectors so ON so.id = t.origin_sector_id
       LEFT JOIN sectors sd ON sd.id = t.dest_sector_id
      WHERE t.status = 'in_transit'
        AND ($1::text IS NULL OR LOWER(t.carrier_wallet) <> LOWER($1))
        AND t.arrives_at > NOW()
      ORDER BY t.cargo_value DESC, t.arrives_at ASC
      LIMIT $2`,
    [excludeWallet || null, Math.min(100, Math.max(1, parseInt(limit) || 30))]
  );

  // Filter by min/max progress + same-guild exemption
  const raidables = [];
  for (const r of rows) {
    const p = parseInt(r.progress_pct) || 0;
    if (p < cfg.raidMinProg || p > cfg.raidMaxProg) continue;
    if (cfg.raidGuildExempt && excludeWallet) {
      const client = await pool.connect();
      try {
        if (await sameGuild(client, excludeWallet, r.carrier_wallet)) { continue; }
      } finally { client.release(); }
    }
    raidables.push(r);
  }
  return raidables;
}

/**
 * attemptRaid — raider tries to steal a shipment
 * Returns { success, result, loot_gp, message, roll, threshold }
 */
async function attemptRaid(raiderWallet, transportId) {
  const cfg = await getCfg();
  if (!cfg.raidEnabled) return { success: false, error: 'raid_disabled' };
  if (!raiderWallet) return { success: false, error: 'wallet_required' };
  transportId = parseInt(transportId);
  if (!transportId) return { success: false, error: 'bad_transport_id' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve raider to DB exact-case wallet (for FK integrity)
    const rU = await client.query(
      'SELECT wallet_address FROM users WHERE LOWER(wallet_address) = LOWER($1)',
      [raiderWallet]
    );
    if (!rU.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'raider_not_found' }; }
    const raiderDbWallet = rU.rows[0].wallet_address;

    // Cooldown check — last raid by this user
    const last = await client.query(
      `SELECT created_at FROM transport_raids
        WHERE LOWER(raider_wallet) = LOWER($1)
        ORDER BY created_at DESC LIMIT 1`,
      [raiderWallet]
    );
    if (last.rows.length) {
      const lastAt = new Date(last.rows[0].created_at);
      const diffMin = (Date.now() - lastAt.getTime()) / 60000;
      if (diffMin < cfg.raidCooldown) {
        await client.query('ROLLBACK');
        return { success: false, error: 'raid_cooldown', waitMin: Math.ceil(cfg.raidCooldown - diffMin) };
      }
    }

    // Lock the transport
    const tr = await client.query(
      `SELECT * FROM transport_jobs WHERE id = $1 FOR UPDATE`,
      [transportId]
    );
    if (!tr.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'transport_not_found' }; }
    const t = tr.rows[0];

    if (t.status !== 'in_transit') { await client.query('ROLLBACK'); return { success: false, error: 'not_in_transit' }; }

    // Self-raid check
    if (cfg.raidSelfExempt && t.carrier_wallet.toLowerCase() === raiderWallet.toLowerCase()) {
      await client.query('ROLLBACK');
      return { success: false, error: 'cannot_raid_self' };
    }

    // Progress check
    const startedAt = new Date(t.started_at).getTime();
    const arrivesAt = new Date(t.arrives_at).getTime();
    const now = Date.now();
    const progressPct = Math.max(0, Math.min(100, Math.round((now - startedAt) * 100 / Math.max(1, arrivesAt - startedAt))));
    if (progressPct < cfg.raidMinProg) {
      await client.query('ROLLBACK');
      return { success: false, error: 'too_early', progressPct, minRequired: cfg.raidMinProg };
    }
    if (progressPct > cfg.raidMaxProg) {
      await client.query('ROLLBACK');
      return { success: false, error: 'too_late', progressPct, maxAllowed: cfg.raidMaxProg };
    }

    // Guild exemption
    if (cfg.raidGuildExempt && await sameGuild(client, raiderWallet, t.carrier_wallet)) {
      await client.query('ROLLBACK');
      return { success: false, error: 'same_guild' };
    }

    // Compute success chance
    let successPct = cfg.raidSuccessBase;
    // Merchant defender gets resistance buff (lowers raider's odds)
    if (t.merchant_bonus) {
      const resist = await getJobBuff(client, t.carrier_wallet, 'merchant_raid_resistance', 1.0);
      successPct *= resist;
    }
    successPct = Math.max(1, Math.min(95, successPct));

    // Deterministic roll
    const seed = crypto.randomBytes(16).toString('hex');
    const roll = parseInt(seed.slice(0, 6), 16) % 1000; // 0-999
    const threshold = Math.round(successPct * 10); // e.g. 35% → 350
    const succeeded = roll < threshold;

    let lootGp = 0;
    if (succeeded) {
      lootGp = Math.floor(parseInt(t.cargo_value) * cfg.raidLootPct / 100);
      // Raider gets loot
      await client.query(
        'UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)',
        [lootGp, raiderWallet]
      );
      // Transport marked as raided (cargo lost except loot; remainder is burned)
      await client.query(
        `UPDATE transport_jobs
            SET status='raided', raided_by=$1, raided_at=NOW(), raid_loot_gp=$2
          WHERE id=$3`,
        [raiderDbWallet, lootGp, transportId]
      );
    }

    await client.query(
      `INSERT INTO transport_raids
         (transport_id, raider_wallet, success, loot_gp, fight_seed, fight_roll, success_threshold)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [transportId, raiderDbWallet, succeeded, lootGp, seed, roll, threshold]
    );

    await client.query('COMMIT');

    // Fire-and-forget
    try {
      if (succeeded) {
        logGPActivity(raiderWallet, lootGp, 'raid_loot', `Raided transport #${transportId}`).catch(()=>{});
        const seasonSvc = require('./season');
        seasonSvc.addSeasonScore(raiderWallet, 'raid_success', 1).catch(()=>{});
        seasonSvc.addSeasonScore(raiderWallet, 'gp_earned', lootGp).catch(()=>{});
      } else {
        const seasonSvc = require('./season');
        seasonSvc.addSeasonScore(raiderWallet, 'raid_failed', 1).catch(()=>{});
      }
    } catch(_){}

    return {
      success: true,
      result: succeeded ? 'success' : 'failed',
      lootGp,
      roll,
      threshold,
      successPct: Math.round(successPct * 10) / 10
    };
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[transport] attemptRaid error:', e.message);
    return { success: false, error: 'internal_error', detail: e.message };
  } finally {
    client.release();
  }
}

/**
 * cancelTransport — carrier cancels before raid-window (must be < raidMinProg)
 * Refunds cargo but not reward.
 */
async function cancelTransport(wallet, transportId) {
  const cfg = await getCfg();
  transportId = parseInt(transportId);
  if (!transportId) return { success: false, error: 'bad_id' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tr = await client.query(
      `SELECT * FROM transport_jobs WHERE id=$1 AND LOWER(carrier_wallet)=LOWER($2) FOR UPDATE`,
      [transportId, wallet]
    );
    if (!tr.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'not_found_or_not_yours' }; }
    const t = tr.rows[0];
    if (t.status !== 'in_transit') { await client.query('ROLLBACK'); return { success: false, error: 'not_in_transit' }; }

    const startedAt = new Date(t.started_at).getTime();
    const arrivesAt = new Date(t.arrives_at).getTime();
    const progressPct = Math.max(0, Math.min(100, Math.round((Date.now() - startedAt) * 100 / Math.max(1, arrivesAt - startedAt))));
    if (progressPct >= cfg.raidMinProg) {
      await client.query('ROLLBACK');
      return { success: false, error: 'too_late_to_cancel', progressPct };
    }

    // Refund cargo only
    await client.query(
      'UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)',
      [t.cargo_value, wallet]
    );
    await client.query(
      `UPDATE transport_jobs SET status='cancelled', completed_at=NOW() WHERE id=$1`,
      [transportId]
    );
    await client.query('COMMIT');

    try { logGPActivity(wallet, parseInt(t.cargo_value), 'transport_cancel_refund', `Transport #${transportId} cancelled`).catch(()=>{}); } catch(_){}

    return { success: true, refundedGp: parseInt(t.cargo_value) };
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[transport] cancelTransport error:', e.message);
    return { success: false, error: 'internal_error', detail: e.message };
  } finally {
    client.release();
  }
}

async function getAdminStats() {
  const r1 = await pool.query(
    `SELECT status, COUNT(*)::int AS n, COALESCE(SUM(cargo_value),0)::int AS total_cargo,
            COALESCE(SUM(reward_gp),0)::int AS total_reward,
            COALESCE(SUM(raid_loot_gp),0)::int AS total_looted
       FROM transport_jobs GROUP BY status`
  );
  const r2 = await pool.query(
    `SELECT COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE success)::int AS successful,
            COALESCE(SUM(loot_gp),0)::int AS total_loot
       FROM transport_raids`
  );
  const out = {
    transports: { total: 0, by_status: {}, total_cargo: 0, total_reward: 0, total_looted: 0 },
    raids: r2.rows[0] || { n: 0, successful: 0, total_loot: 0 }
  };
  for (const row of r1.rows) {
    out.transports.total += row.n;
    out.transports.total_cargo += row.total_cargo;
    out.transports.total_reward += row.total_reward;
    out.transports.total_looted += row.total_looted;
    out.transports.by_status[row.status] = { count: row.n, cargo: row.total_cargo, reward: row.total_reward };
  }
  return out;
}

async function getSettings() {
  const cfg = await getCfg();
  return cfg;
}

module.exports = {
  startTransport,
  settleArrivedTransports,
  getMyTransports,
  getActiveRaidTargets,
  attemptRaid,
  cancelTransport,
  getAdminStats,
  getSettings
};
