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

async function _capacityWeights() {
  try { var v = await getSetting('ship_mining_capacity_weights', '{}'); var o = typeof v === 'string' ? JSON.parse(v) : v; return o && typeof o === 'object' ? o : {}; }
  catch (_) { return {}; }
}
async function _destinations() {
  try { var v = await getSetting('ship_mining_destinations', '[]'); var a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) && a.length ? a : [{ key: 'frontier', yieldMult: 1, wearMult: 1, raidPct: 0 }]; }
  catch (_) { return [{ key: 'frontier', yieldMult: 1, wearMult: 1, raidPct: 0 }]; }
}

async function getMiningInfo() {
  var weights = await _capacityWeights();
  return {
    enabled: await _enabled(),
    durationsH: await _durations(),
    gpPerCapacityHour: _num(await getSetting('ship_mining_gp_per_capacity_h', '5'), 5),
    maxPerWallet: _num(await getSetting('ship_mining_max_per_wallet', '3'), 3),
    launchCostGp: _num(await getSetting('ship_mining_launch_cost_gp', '0'), 0),
    capacityWeights: weights,
    destinations: await _destinations(),
  };
}

// 채굴 출항 가능 최소 내구도 비율(이하면 수리 필요 — repair sink 게이트).
async function _minHpPct() { return _num(await getSetting('ship_mining_min_hp_pct', '0.15'), 0.15); }

// 함대의 채굴 가능한 함선 수(살아있고, 판매중 아니고, 내구도 ≥ min%×maxHP).
async function _aliveShipCount(client, fleetId) {
  const minPct = await _minHpPct();
  const r = await client.query(
    `SELECT COUNT(*)::int AS c FROM ships
     WHERE fleet_id = $1 AND is_alive = TRUE AND COALESCE(is_market_listed, FALSE) = FALSE
       AND COALESCE(current_hp, 0) >= GREATEST(1, (COALESCE(max_hp, 100) + COALESCE(bonus_hp, 0)) * $2::numeric)`,
    [fleetId, minPct]
  );
  return r.rows[0]?.c || 0;
}

// 함대의 채굴 적재량(capacity) = Σ(함급 weight × (1 + tierBonus×(tier-1))) — 함종/등급이 수율 결정.
async function _fleetCapacity(client, fleetId) {
  const weights = await _capacityWeights();
  const tierBonus = _num(await getSetting('ship_mining_tier_bonus_per_level', '0.1'), 0.1);
  const minPct = await _minHpPct();
  const r = await client.query(
    `SELECT st.size_class, COALESCE(st.tier, 1) AS tier, COUNT(*)::int AS n
       FROM ships s JOIN ship_types st ON st.code = s.ship_type_code
      WHERE s.fleet_id = $1 AND s.is_alive = TRUE AND COALESCE(s.is_market_listed, FALSE) = FALSE
        AND COALESCE(s.current_hp, 0) >= GREATEST(1, (COALESCE(s.max_hp, 100) + COALESCE(s.bonus_hp, 0)) * $2::numeric)
      GROUP BY st.size_class, st.tier`,
    [fleetId, minPct]
  );
  let cap = 0;
  for (const row of r.rows) {
    const w = Number(weights[row.size_class]) || 1;
    cap += w * (1 + tierBonus * (Number(row.tier) - 1)) * Number(row.n);
  }
  return Math.round(cap * 100) / 100;
}

async function launchMining(wallet, fleetId, durationH, destination) {
  const w = String(wallet || '').toLowerCase().trim();
  if (!w || !fleetId) throw new Error('wallet and fleetId required');
  if (!(await _enabled())) throw new Error('ship_mining_disabled');

  const durs = await _durations();
  const dur = _num(durationH, durs[0]);
  if (!durs.includes(dur)) throw new Error('invalid_duration');

  // 목적지(거리) 검증 — 드롭테이블/수율/마모/위험을 결정.
  const dests = await _destinations();
  const destKey = String(destination || (dests[0] && dests[0].key) || 'frontier');
  if (!dests.some(function (d) { return d.key === destKey; })) throw new Error('invalid_destination');

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
    // [P0-1 fix] 활성 공성에 커밋된 함대는 채굴 출항 불가(전투↔채굴 이중 점유 방지).
    try {
      const sc = await client.query(
        `SELECT 1 FROM siege_fleet_commits c JOIN governor_sieges g ON g.id = c.siege_id
          WHERE c.fleet_id = $1 AND g.status NOT IN ('ended','cancelled','resolved') LIMIT 1`,
        [fleetId]
      );
      if (sc.rows.length) { await client.query('ROLLBACK'); throw new Error('fleet_in_siege'); }
    } catch (e) { if (e.message === 'fleet_in_siege') throw e; /* 테이블 미존재 등은 무시 */ }

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

    // 살아있는 함선 필요 + 적재량(capacity) 계산
    const ships = await _aliveShipCount(client, fleetId);
    if (ships < 1) { await client.query('ROLLBACK'); throw new Error('no_alive_ships'); }
    const capacity = await _fleetCapacity(client, fleetId);

    // 출항 비용(기본 0 = 무료)
    if (costGp > 0) {
      const ded = await client.query(
        `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1`,
        [costGp, w]
      );
      if (ded.rowCount === 0) { await client.query('ROLLBACK'); throw new Error('insufficient_gp'); }
    }

    const job = await client.query(
      `INSERT INTO ship_mining_jobs (wallet_address, fleet_id, ship_count, capacity, sector_type, duration_h, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW() + (($7 || ' hours')::interval))
       RETURNING *`,
      [w, fleetId, ships, capacity, destKey, dur, String(dur)]
    );

    await client.query('COMMIT');
    return { success: true, job: job.rows[0], shipCount: ships, capacity: capacity, destination: destKey };
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
  const gpPerCapH = _num(await getSetting('ship_mining_gp_per_capacity_h', '5'), 5);
  const rollsPer4h = _num(await getSetting('ship_mining_resource_rolls_per_4h', '1'), 1);
  const dests = await _destinations();

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

    // 목적지(거리) 설정 + 약탈 판정 — 멀수록 수율↑·마모↑·약탈위험↑.
    const destCfg = dests.find(function (d) { return d.key === (job.sector_type || 'frontier'); }) || { yieldMult: 1, wearMult: 1, raidPct: 0 };
    const yieldMult = Number(destCfg.yieldMult) || 1;
    const wearMult = Number(destCfg.wearMult) || 1;
    const raided = (Number(destCfg.raidPct) || 0) > 0 && Math.random() < Number(destCfg.raidPct);
    const raidYieldFactor = raided ? 0.5 : 1;

    // GP 보상 = 함대 capacity × 시간 × gpPerCapH × 거리배율 × (약탈 시 0.5). capacity가 함종/등급을 반영.
    const cap = Number(job.capacity) > 0 ? Number(job.capacity) : Number(job.ship_count) || 1;
    let rewardGp = Math.round(cap * Number(job.duration_h) * gpPerCapH * yieldMult * raidYieldFactor * 1e6) / 1e6;

    // [레드팀 #1] 지갑당 채굴 GP 일일 상한 — 무료 채굴 GP 무한 양산(멀티계정/대형함대) 차단.
    const gpCapDay = _num(await getSetting('ship_mining_gp_cap_per_day', '0'), 0);
    if (gpCapDay > 0) {
      const used = await client.query(
        `SELECT COALESCE(SUM(reward_gp), 0) AS s FROM ship_mining_jobs
         WHERE LOWER(wallet_address) = LOWER($1) AND status = 'collected' AND collected_at > NOW() - INTERVAL '24 hours'`,
        [w]
      );
      const usedGp = parseFloat(used.rows[0]?.s || 0) || 0;
      const headroom = Math.max(0, gpCapDay - usedGp);
      if (rewardGp > headroom) rewardGp = Math.round(headroom * 1e6) / 1e6;
    }

    // 재료 드롭 — capacity·시간 비례 roll, 목적지 드롭테이블(원거리=희귀). 약탈 시 roll 절반.
    let drops = [];
    if (resourceSvc && resourceSvc.rollResourceDrop && resourceSvc.addResourcesToInventory) {
      let rolls = Math.max(1, Math.round((cap / 2) * (Number(job.duration_h) / 4) * rollsPer4h));
      if (raided) rolls = Math.max(1, Math.floor(rolls / 2));
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
    const effWear = wearPct * wearMult * (raided ? 1.5 : 1); // 원거리·약탈 시 마모↑
    if (effWear > 0) {
      // [P0-2 fix] 하한 1 — HP0 좀비 함선(is_alive=true, hp=0)이 전투에 끌려가 즉사하는 것 방지.
      //   채굴 마모로는 절대 0이 되지 않음(전투 full-loss는 전투 데미지로만). 재채굴 게이트는 min_hp_pct가 담당.
      await client.query(
        `UPDATE ships
           SET current_hp = GREATEST(1, current_hp - ROUND((COALESCE(max_hp, 100) + COALESCE(bonus_hp, 0)) * $2::numeric * $3::numeric))::int
         WHERE fleet_id = $1 AND is_alive = TRUE`,
        [job.fleet_id, effWear, Number(job.duration_h)]
      );
    }

    await client.query(
      `UPDATE ship_mining_jobs SET status = 'collected', reward_gp = $2, reward_resources = $3, collected_at = NOW() WHERE id = $1`,
      [jobId, rewardGp, JSON.stringify(drops)]
    );

    await client.query('COMMIT');

    // 활동 로그(fire-and-forget)
    try { const { logGPActivity } = require('../db'); logGPActivity(w, rewardGp, 'ship_mining', `Ship mining run #${jobId} collected`).catch(() => {}); } catch (_) {}

    return { success: true, rewardGp, resources: drops, destination: job.sector_type, raided: raided };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { getMiningInfo, launchMining, getMyMining, collectMining };
