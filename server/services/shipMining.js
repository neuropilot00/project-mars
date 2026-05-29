'use strict';
// ════════════════════════════════════════════════════════════════
// 함선 채굴 런 (경제 v2 P5) — EVE식 함선 채굴. 땅 없는 F2P 유저의 노가다 수급.
//   launchMining: 함대를 채굴 런에 보낸다(시간 점유). collectMining: 복귀 시 재료 + GP 수급.
//   땅 불필요. PP는 안 줌(무료 PP 폐지 정책). 격리 테이블(ship_mining_jobs) — 기존 흐름 무영향.
// ════════════════════════════════════════════════════════════════
const { pool } = require('../db');

async function getSetting(key, fb) {
  try { const r = await pool.query('SELECT value FROM settings WHERE key=$1', [key]); return r.rows.length ? r.rows[0].value : fb; }
  catch (_) { return fb; }
}
function _num(v, fb) { const n = parseFloat(typeof v === 'string' ? v.replace(/^"|"$/g, '') : v); return isFinite(n) ? n : fb; }
async function _enabled() { return String(await getSetting('ship_mining_enabled', 'true')).replace(/"/g, '') === 'true'; }
async function _durations() {
  try { const v = await getSetting('ship_mining_durations_h', '[1,4,8]'); const a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) && a.length ? a : [1, 4, 8]; }
  catch (_) { return [1, 4, 8]; }
}

async function getMiningInfo() {
  return {
    enabled: await _enabled(),
    durationsH: await _durations(),
    gpPerShipHour: _num(await getSetting('ship_mining_gp_per_ship_h', '5'), 5),
    maxPerWallet: _num(await getSetting('ship_mining_max_per_wallet', '3'), 3),
    launchCostGp: _num(await getSetting('ship_mining_launch_cost_gp', '0'), 0),
  };
}

// 함대의 채굴 가능한 함선 수(살아있고, 판매중 아니고, 내구도 > 0). 내구도 0 = 수리 필요.
async function _aliveShipCount(client, fleetId) {
  const r = await client.query(
    `SELECT COUNT(*)::int AS c FROM ships
     WHERE fleet_id = $1 AND is_alive = TRUE AND COALESCE(is_market_listed, FALSE) = FALSE AND COALESCE(current_hp, 1) > 0`,
    [fleetId]
  );
  return r.rows[0]?.c || 0;
}

async function launchMining(wallet, fleetId, durationH) {
  const w = String(wallet || '').toLowerCase().trim();
  if (!w || !fleetId) throw new Error('wallet and fleetId required');
  if (!(await _enabled())) throw new Error('ship_mining_disabled');

  const durs = await _durations();
  const dur = _num(durationH, durs[0]);
  if (!durs.includes(dur)) throw new Error('invalid_duration');

  const maxPer = _num(await getSetting('ship_mining_max_per_wallet', '3'), 3);
  const costGp = _num(await getSetting('ship_mining_launch_cost_gp', '0'), 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 함대 소유 + 전투중 아님 확인 (행 잠금)
    const fr = await client.query(
      `SELECT id, is_in_battle FROM fleets WHERE id = $1 AND LOWER(owner_wallet) = LOWER($2) FOR UPDATE`,
      [fleetId, w]
    );
    if (!fr.rows.length) { await client.query('ROLLBACK'); throw new Error('fleet_not_found'); }
    if (fr.rows[0].is_in_battle) { await client.query('ROLLBACK'); throw new Error('fleet_in_battle'); }

    // 이미 채굴중인 함대?
    const act = await client.query(
      `SELECT 1 FROM ship_mining_jobs WHERE fleet_id = $1 AND status = 'mining' LIMIT 1`, [fleetId]
    );
    if (act.rows.length) { await client.query('ROLLBACK'); throw new Error('fleet_already_mining'); }

    // 지갑 동시 채굴 한도
    const cnt = await client.query(
      `SELECT COUNT(*)::int AS c FROM ship_mining_jobs WHERE LOWER(wallet_address) = LOWER($1) AND status = 'mining'`, [w]
    );
    if ((cnt.rows[0]?.c || 0) >= maxPer) { await client.query('ROLLBACK'); throw new Error('mining_limit_reached'); }

    // 살아있는 함선 필요
    const ships = await _aliveShipCount(client, fleetId);
    if (ships < 1) { await client.query('ROLLBACK'); throw new Error('no_alive_ships'); }

    // 출항 비용(기본 0 = 무료)
    if (costGp > 0) {
      const ded = await client.query(
        `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1`,
        [costGp, w]
      );
      if (ded.rowCount === 0) { await client.query('ROLLBACK'); throw new Error('insufficient_gp'); }
    }

    const job = await client.query(
      `INSERT INTO ship_mining_jobs (wallet_address, fleet_id, ship_count, sector_type, duration_h, ends_at)
       VALUES ($1, $2, $3, 'frontier', $4, NOW() + (($5 || ' hours')::interval))
       RETURNING *`,
      [w, fleetId, ships, dur, String(dur)]
    );

    await client.query('COMMIT');
    return { success: true, job: job.rows[0], shipCount: ships };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function getMyMining(wallet) {
  const w = String(wallet || '').toLowerCase().trim();
  const r = await pool.query(
    `SELECT j.*, f.name AS fleet_name,
            GREATEST(0, CEIL(EXTRACT(EPOCH FROM (j.ends_at - NOW()))))::int AS seconds_remaining
     FROM ship_mining_jobs j
     LEFT JOIN fleets f ON f.id = j.fleet_id
     WHERE LOWER(j.wallet_address) = LOWER($1)
       AND (j.status = 'mining' OR j.collected_at > NOW() - INTERVAL '24 hours')
     ORDER BY j.id DESC LIMIT 30`,
    [w]
  );
  return { jobs: r.rows };
}

async function collectMining(wallet, jobId) {
  const w = String(wallet || '').toLowerCase().trim();
  if (!w || !jobId) throw new Error('wallet and jobId required');
  const resourceSvc = (() => { try { return require('./resource'); } catch (_) { return null; } })();
  const gpPerShipHour = _num(await getSetting('ship_mining_gp_per_ship_h', '5'), 5);
  const rollsPer4h = _num(await getSetting('ship_mining_resource_rolls_per_4h', '1'), 1);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const jr = await client.query(
      `SELECT * FROM ship_mining_jobs WHERE id = $1 AND LOWER(wallet_address) = LOWER($2) FOR UPDATE`,
      [jobId, w]
    );
    if (!jr.rows.length) { await client.query('ROLLBACK'); throw new Error('job_not_found'); }
    const job = jr.rows[0];
    if (job.status !== 'mining') { await client.query('ROLLBACK'); throw new Error('already_collected'); }
    if (new Date(job.ends_at).getTime() > Date.now()) { await client.query('ROLLBACK'); throw new Error('not_ready'); }

    // GP 보상 = 함선수 × 시간 × gpPerShipHour
    const rewardGp = Math.round(Number(job.ship_count) * Number(job.duration_h) * gpPerShipHour * 1e6) / 1e6;

    // 재료 드롭 — 시간 비례 roll (rollResourceDrop 은 SELECT-only 라 COMMIT 전 호출 안전)
    let drops = [];
    if (resourceSvc && resourceSvc.rollResourceDrop && resourceSvc.addResourcesToInventory) {
      const rolls = Math.max(1, Math.round((Number(job.duration_h) / 4) * rollsPer4h));
      const merged = {};
      for (let i = 0; i < rolls; i++) {
        try {
          const d = await resourceSvc.rollResourceDrop(w, job.sector_type || 'frontier');
          for (const x of (d || [])) merged[x.code] = (merged[x.code] || 0) + x.quantity;
        } catch (_) {}
      }
      drops = Object.keys(merged).map(code => ({ code, quantity: merged[code] }));
      if (drops.length) { try { await resourceSvc.addResourcesToInventory(client, w, drops); } catch (_) {} }
    }

    if (rewardGp > 0) {
      await client.query(
        `UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE LOWER(wallet_address) = LOWER($2)`,
        [rewardGp, w]
      );
    }

    // [경제v2 P5] 채굴은 함선 내구도를 마모시킨다 → 조선소 수리(GP+재료) sink 강제(EVE식).
    const wearPct = _num(await getSetting('ship_mining_hull_wear_pct_per_hour', '0.02'), 0.02);
    if (wearPct > 0) {
      await client.query(
        `UPDATE ships
           SET current_hp = GREATEST(0, current_hp - ROUND((COALESCE(max_hp, 100) + COALESCE(bonus_hp, 0)) * $2::numeric * $3::numeric))::int
         WHERE fleet_id = $1 AND is_alive = TRUE`,
        [job.fleet_id, wearPct, Number(job.duration_h)]
      );
    }

    await client.query(
      `UPDATE ship_mining_jobs SET status = 'collected', reward_gp = $2, reward_resources = $3, collected_at = NOW() WHERE id = $1`,
      [jobId, rewardGp, JSON.stringify(drops)]
    );

    await client.query('COMMIT');

    // 활동 로그(fire-and-forget)
    try { const { logGPActivity } = require('../db'); logGPActivity(w, rewardGp, 'ship_mining', `Ship mining run #${jobId} collected`).catch(() => {}); } catch (_) {}

    return { success: true, rewardGp, resources: drops };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { getMiningInfo, launchMining, getMyMining, collectMining };
