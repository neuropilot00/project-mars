'use strict';
// ════════════════════════════════════════════════════════════════
// 함선 채굴 런 (경제 v2 P5) — EVE식 함선 채굴. 땅 없는 F2P 유저의 노가다 수급.
//   launchMining: 함대를 채굴 런에 보낸다(시간 점유). collectMining: 복귀 시 재료 + GP 수급.
//   땅 불필요. PP는 안 줌(무료 PP 폐지 정책). 격리 테이블(ship_mining_jobs) — 기존 흐름 무영향.
// ════════════════════════════════════════════════════════════════
const { pool } = require('../db');
let seasonService;
try { seasonService = require('./season'); } catch (_) { /* optional season service */ }
let dailyOps;
try { dailyOps = require('../routes/dailyOps'); } catch (_) { /* optional daily ops route helper */ }

const MINING_INFO_CACHE_MS = 15 * 1000;
const MINING_INFO_CACHE_MAX = 500;
const miningInfoCache = new Map();
const miningInfoInFlight = new Map();

async function getSetting(key, fb) {
  try { const r = await pool.query('SELECT value FROM settings WHERE key=$1', [key]); return r.rows.length ? r.rows[0].value : fb; }
  catch (_) { return fb; }
}
function _num(v, fb) { const n = parseFloat(typeof v === 'string' ? v.replace(/^"|"$/g, '') : v); return isFinite(n) ? n : fb; }
const DEFAULT_MINING_DESTINATIONS = [
  { key: 'frontier', yieldMult: 1.0, resourceMult: 1.0, rareMult: 1.0, wearMult: 1.0, raidPct: 0.0 },
  { key: 'mid', yieldMult: 1.5, resourceMult: 1.5, rareMult: 1.15, wearMult: 1.5, raidPct: 0.05 },
  { key: 'core', yieldMult: 2.2, resourceMult: 2.2, rareMult: 1.35, wearMult: 2.5, raidPct: 0.15 },
];

const MINING_ROUTE_PROFILES = {
  frontier: {
    difficulty: 1,
    rareMult: 1.0,
    riskLabel: 'SAFE BELT',
    lootProfile: 'common ore and baseline parts',
    routeRole: 'starter industry',
    targetUse: 'repair stockpile and low-risk ship parts',
    recommendedFor: 'new fleets and damaged fleets',
    pressure: 'low',
  },
  mid: {
    difficulty: 3,
    rareMult: 1.15,
    riskLabel: 'CONTESTED BELT',
    lootProfile: 'improved minerals and rare part pressure',
    routeRole: 'growth route',
    targetUse: 'ship upgrades and balanced GP/material gain',
    recommendedFor: 'combat-ready patrol fleets',
    pressure: 'contested',
  },
  core: {
    difficulty: 5,
    rareMult: 1.35,
    riskLabel: 'WARZONE CORE',
    lootProfile: 'highest rare-material pressure',
    routeRole: 'high-risk war industry',
    targetUse: 'rare parts for capital preparation',
    recommendedFor: 'escorted fleets and alliance-backed miners',
    pressure: 'warzone',
  },
};

function _defaultDestinations() {
  return DEFAULT_MINING_DESTINATIONS.map(function (d) { return Object.assign({}, d); });
}
function _clamp(n, min, max, fb) {
  n = Number(n);
  if (!isFinite(n)) return fb;
  return Math.min(max, Math.max(min, n));
}
function _normalizeDestination(d) {
  const key = String(d && d.key || '').trim();
  if (!key) return null;
  const yieldMult = _clamp(d.yieldMult, 0.1, 10, 1);
  const profile = MINING_ROUTE_PROFILES[key] || {};
  return {
    key: key,
    yieldMult: yieldMult,
    resourceMult: _clamp(d.resourceMult == null ? yieldMult : d.resourceMult, 0.1, 10, yieldMult),
    rareMult: _clamp(d.rareMult == null ? profile.rareMult : d.rareMult, 0.1, 5, profile.rareMult || 1),
    wearMult: _clamp(d.wearMult, 0, 10, 1),
    raidPct: _clamp(d.raidPct, 0, 0.95, 0),
    difficulty: _clamp(d.difficulty == null ? profile.difficulty : d.difficulty, 1, 5, profile.difficulty || 1),
    riskLabel: String(d.riskLabel || profile.riskLabel || 'UNKNOWN ROUTE'),
    lootProfile: String(d.lootProfile || profile.lootProfile || 'mixed resources'),
    routeRole: String(d.routeRole || profile.routeRole || 'general resource run'),
    targetUse: String(d.targetUse || profile.targetUse || 'mixed economy supply'),
    recommendedFor: String(d.recommendedFor || profile.recommendedFor || 'available fleets'),
    pressure: String(d.pressure || profile.pressure || 'unknown'),
  };
}
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
  try {
    var v = await getSetting('ship_mining_destinations', JSON.stringify(DEFAULT_MINING_DESTINATIONS));
    var a = typeof v === 'string' ? JSON.parse(v) : v;
    if (!Array.isArray(a)) return _defaultDestinations();
    var normalized = a.map(_normalizeDestination).filter(Boolean);
    return normalized.length ? normalized : _defaultDestinations();
  }
  catch (_) { return _defaultDestinations(); }
}

async function _allianceSectorBonuses(client, wallet) {
  const w = String(wallet || '').toLowerCase().trim();
  const empty = { frontier: 1, mid: 1, core: 1 };
  if (!w) return empty;

  const pct = _clamp(_num(await getSetting('ship_mining_alliance_sector_bonus_pct', '5'), 5), 0, 50, 5);
  const capPct = _clamp(_num(await getSetting('ship_mining_alliance_sector_bonus_cap_pct', '25'), 25), 0, 200, 25);
  if (pct <= 0 || capPct <= 0) return empty;

  try {
    const r = await client.query(
      `SELECT s.tier, COUNT(*)::int AS governed_count
         FROM alliance_members me
         JOIN alliance_members gov
           ON gov.alliance_id = me.alliance_id
          AND gov.left_at IS NULL
         JOIN sectors s
           ON LOWER(s.governor_wallet) = LOWER(gov.wallet_address)
        WHERE LOWER(me.wallet_address) = LOWER($1)
          AND me.left_at IS NULL
          AND s.governor_wallet IS NOT NULL
        GROUP BY s.tier`,
      [w]
    );
    const out = Object.assign({}, empty);
    r.rows.forEach(function (row) {
      const tier = String(row.tier || '');
      const count = Math.max(0, parseInt(row.governed_count, 10) || 0);
      if (out[tier] != null) out[tier] = Math.round((1 + Math.min(capPct, count * pct) / 100) * 10000) / 10000;
    });
    return out;
  } catch (_) {
    return empty;
  }
}

async function _territorySectorBonuses(client, wallet) {
  const w = String(wallet || '').toLowerCase().trim();
  const empty = { frontier: 1, mid: 1, core: 1 };
  if (!w) return empty;

  const pct = _clamp(_num(await getSetting('ship_mining_owned_sector_bonus_pct', '2'), 2), 0, 25, 2);
  const capPct = _clamp(_num(await getSetting('ship_mining_owned_sector_bonus_cap_pct', '20'), 20), 0, 100, 20);
  if (pct <= 0 || capPct <= 0) return empty;

  try {
    const r = await client.query(
      `SELECT s.tier, COUNT(DISTINCT p.sector_id)::int AS owned_sector_count
         FROM pixels p
         JOIN sectors s ON s.id = p.sector_id
        WHERE LOWER(p.owner) = LOWER($1)
          AND p.sector_id IS NOT NULL
        GROUP BY s.tier`,
      [w]
    );
    const out = Object.assign({}, empty);
    r.rows.forEach(function (row) {
      const tier = String(row.tier || '');
      const count = Math.max(0, parseInt(row.owned_sector_count, 10) || 0);
      if (out[tier] != null) out[tier] = Math.round((1 + Math.min(capPct, count * pct) / 100) * 10000) / 10000;
    });
    return out;
  } catch (_) {
    return empty;
  }
}

function _miningInfoCacheKey(wallet) {
  const w = String(wallet || '').toLowerCase().trim();
  return w ? `wallet:${w}` : 'public';
}

function _pruneMiningInfoCache(now = Date.now()) {
  for (const [key, entry] of miningInfoCache) {
    if (!entry || now - entry.at >= MINING_INFO_CACHE_MS) miningInfoCache.delete(key);
  }
  while (miningInfoCache.size > MINING_INFO_CACHE_MAX) {
    const oldestKey = miningInfoCache.keys().next().value;
    if (oldestKey == null) break;
    miningInfoCache.delete(oldestKey);
  }
}

async function _buildMiningInfo(wallet) {
  var weights = await _capacityWeights();
  const client = await pool.connect();
  try {
    var allianceSectorBonuses = await _allianceSectorBonuses(client, wallet);
    var territorySectorBonuses = await _territorySectorBonuses(client, wallet);
  } finally {
    client.release();
  }
  return {
    enabled: await _enabled(),
    durationsH: await _durations(),
    gpPerCapacityHour: _num(await getSetting('ship_mining_gp_per_capacity_h', '5'), 5),
    gpCapPerDay: _num(await getSetting('ship_mining_gp_cap_per_day', '0'), 0),
    maxPerWallet: _num(await getSetting('ship_mining_max_per_wallet', '3'), 3),
    launchCostGp: _num(await getSetting('ship_mining_launch_cost_gp', '0'), 0),
    minHpPct: _num(await getSetting('ship_mining_min_hp_pct', '0.15'), 0.15),
    hullWearPctPerHour: _num(await getSetting('ship_mining_hull_wear_pct_per_hour', '0.02'), 0.02),
    resourceRollsPer4h: _num(await getSetting('ship_mining_resource_rolls_per_4h', '1'), 1),
    capacityWeights: weights,
    destinations: await _destinations(),
    allianceSectorBonuses: allianceSectorBonuses,
    territorySectorBonuses: territorySectorBonuses,
  };
}

async function getMiningInfo(wallet) {
  const cacheKey = _miningInfoCacheKey(wallet);
  const now = Date.now();
  _pruneMiningInfoCache(now);
  const cached = miningInfoCache.get(cacheKey);
  if (cached && now - cached.at < MINING_INFO_CACHE_MS) return cached.info;

  if (!miningInfoInFlight.has(cacheKey)) {
    miningInfoInFlight.set(cacheKey, _buildMiningInfo(wallet)
      .then(info => {
        miningInfoCache.set(cacheKey, { info, at: Date.now() });
        _pruneMiningInfoCache();
        return info;
      })
      .finally(() => { miningInfoInFlight.delete(cacheKey); }));
  }

  try {
    return await miningInfoInFlight.get(cacheKey);
  } catch (err) {
    const stale = miningInfoCache.get(cacheKey);
    if (stale) return stale.info;
    throw err;
  }
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
    // [v7.274] 지갑 단위 advisory lock — 서로 다른 함대로 동시 launch 시 max_per_wallet 한도를 우회하던 레이스 차단.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, ['ship_mining:' + String(w).toLowerCase()]);

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
    // [v7.274 레드팀#1 보강] 지갑 단위 트랜잭션 advisory lock — 동시 collect가 같은 24h SUM을 읽어
    //   일일 GP 상한(gp_cap_per_day)을 N배 우회하던 레이스 차단. 같은 지갑 collect는 직렬화된다.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, ['ship_mining:' + String(w).toLowerCase()]);
    const jr = await client.query(
      `SELECT * FROM ship_mining_jobs WHERE id = $1 AND LOWER(wallet_address) = LOWER($2) FOR UPDATE`,
      [jobId, w]
    );
    if (!jr.rows.length) { await client.query('ROLLBACK'); throw new Error('job_not_found'); }
    const job = jr.rows[0];
    if (job.status !== 'mining') { await client.query('ROLLBACK'); throw new Error('already_collected'); }
    if (new Date(job.ends_at).getTime() > Date.now()) { await client.query('ROLLBACK'); throw new Error('not_ready'); }

    // 목적지(거리) 설정 + 약탈 판정 — 멀수록 수율↑·마모↑·약탈위험↑.
    const destCfg = dests.find(function (d) { return d.key === (job.sector_type || 'frontier'); }) || { yieldMult: 1, resourceMult: 1, wearMult: 1, raidPct: 0 };
    const allianceSectorBonuses = await _allianceSectorBonuses(client, w);
    const territorySectorBonuses = await _territorySectorBonuses(client, w);
    const allianceSectorBonus = Number(allianceSectorBonuses[job.sector_type || 'frontier']) || 1;
    const territorySectorBonus = Number(territorySectorBonuses[job.sector_type || 'frontier']) || 1;
    const baseYieldMult = Number(destCfg.yieldMult) || 1;
    const routeControlBonus = allianceSectorBonus * territorySectorBonus;
    const yieldMult = baseYieldMult * routeControlBonus;
    const resourceMult = (Number(destCfg.resourceMult) || baseYieldMult) * routeControlBonus;
    const rareMult = Number(destCfg.rareMult) || 1;
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
      let rolls = Math.max(1, Math.round((cap / 2) * (Number(job.duration_h) / 4) * rollsPer4h * resourceMult));
      if (raided) rolls = Math.max(1, Math.floor(rolls / 2));
      const merged = {};
      for (let i = 0; i < rolls; i++) {
        try {
          const d = await resourceSvc.rollResourceDrop(w, job.sector_type || 'frontier', { gradeRareMult: rareMult });
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
      `UPDATE ship_mining_jobs
          SET status = 'collected',
              reward_gp = $2,
              reward_resources = $3,
              raided = $4,
              collected_at = NOW()
        WHERE id = $1`,
      [jobId, rewardGp, JSON.stringify(drops), raided]
    );

    await client.query('COMMIT');

    // 활동 로그(fire-and-forget)
    try { const { logGPActivity } = require('../db'); logGPActivity(w, rewardGp, 'ship_mining', `Ship mining run #${jobId} collected`).catch(() => {}); } catch (_) {}
    recordMiningProgress(w, rewardGp);

    return { success: true, rewardGp, resources: drops, destination: job.sector_type, raided: raided, allianceSectorBonus, territorySectorBonus };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

function recordMiningProgress(wallet, rewardGp) {
  const w = String(wallet || '').toLowerCase();
  if (!w) return;
  if (dailyOps && typeof dailyOps.notifyMissionProgress === 'function') {
    dailyOps.notifyMissionProgress(w, 'resource_run').catch(() => {});
    dailyOps.notifyMissionProgress(w, 'resource_run_3').catch(() => {});
  }
  if (seasonService && typeof seasonService.addSeasonScore === 'function') {
    seasonService.addSeasonScore(w, 'harvest', 1).catch(() => {});
    if (rewardGp > 0) seasonService.addSeasonScore(w, 'gp_earn', Math.round(rewardGp)).catch(() => {});
  }
}

module.exports = { getMiningInfo, launchMining, getMyMining, collectMining };
