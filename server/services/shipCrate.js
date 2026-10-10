// server/services/shipCrate.js
// 함선 가챠(Ship Crate) — 서버 권위 RNG + 천장(pity) + 타이탄 서버 캡 존중.
// 상자를 GP로 구매·개봉하면 size_class 가중치에 따라 함선 1척을 획득해 함대에 편입한다.
const crypto = require('crypto');
const { pool, getSetting, logGPActivity } = require('../db');
const { assertFleetsNotMining } = require('./fleetOccupancy');

const RARE_CLASSES = ['cruiser', 'battleship', 'titan']; // 천장 대상(희귀 이상)

// 보안 RNG: [0, max) 정수
function randInt(max) {
  if (max <= 0) return 0;
  return crypto.randomInt(0, max);
}

// 가중치 객체에서 size_class 하나를 뽑는다. allow 가 주어지면 그 클래스들만 후보.
function rollRarity(weights, allow) {
  const entries = Object.entries(weights)
    .filter(([cls, w]) => Number(w) > 0 && (!allow || allow.includes(cls)));
  const total = entries.reduce((s, [, w]) => s + Number(w), 0);
  if (total <= 0) return null;
  let r = randFloat() * total;
  for (const [cls, w] of entries) {
    r -= Number(w);
    if (r < 0) return cls;
  }
  return entries[entries.length - 1][0];
}

// ── 각인 품질(quality) — 개봉 함선의 랜덤 보너스 스탯 등급 ──
// 보너스는 base 스탯의 일정 비율(범위) 만큼 bonus_atk/def/hp/speed 에 가산된다.
const QUALITY_GRADES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const QUALITY_BONUS_RANGE = {        // base 스탯 대비 보너스 비율 [min, max]
  common:    [0,    0],
  uncommon:  [0.05, 0.13],
  rare:      [0.14, 0.27],
  epic:      [0.28, 0.48],
  legendary: [0.50, 0.85],
};
// 상자별 품질 가중치 — 고가 상자일수록 강화 개체 확률↑ (admin 조정 가능: settings crate_quality_weights)
const CRATE_QUALITY_WEIGHTS = {
  recruit_crate:   { common: 80, uncommon: 18, rare: 2,  epic: 0,  legendary: 0 },
  standard_crate:  { common: 62, uncommon: 26, rare: 9,  epic: 2.5, legendary: 0.5 },
  premium_crate:   { common: 45, uncommon: 32, rare: 16, epic: 6,  legendary: 1 },
  elite_crate:     { common: 30, uncommon: 34, rare: 24, epic: 9,  legendary: 3 },
  legendary_crate: { common: 18, uncommon: 32, rare: 30, epic: 14, legendary: 6 },
};
const QUALITY_WEIGHTS_DEFAULT = { common: 60, uncommon: 27, rare: 10, epic: 2.5, legendary: 0.5 };

// 보안 RNG 실수 [0,1)
function randFloat() { return crypto.randomInt(0, 1e9) / 1e9; }

function rollQuality(crateCode) {
  const w = CRATE_QUALITY_WEIGHTS[crateCode] || QUALITY_WEIGHTS_DEFAULT;
  const entries = QUALITY_GRADES.map(g => [g, Number(w[g]) || 0]).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return 'common';
  let r = randFloat() * total;
  for (const [g, v] of entries) { r -= v; if (r < 0) return g; }
  return entries[entries.length - 1][0];
}

// quality 등급 + base 스탯 → 각 스탯 보너스(정수/소수) 계산. 스탯별 ±30% 분산으로 굴림이 다양해짐.
function rollBonusStats(quality, base) {
  const range = QUALITY_BONUS_RANGE[quality] || [0, 0];
  if (range[1] <= 0) return { atk: 0, def: 0, hp: 0, speed: 0 };
  function pct() {
    const p = range[0] + randFloat() * (range[1] - range[0]);
    const variance = 0.7 + randFloat() * 0.6; // 0.7~1.3
    return p * variance;
  }
  return {
    atk:   Math.round((base.atk   || 0) * pct()),
    def:   Math.round((base.def   || 0) * pct()),
    hp:    Math.round((base.hp    || 0) * pct()),
    speed: Math.round((base.speed || 0) * pct() * 100) / 100,
  };
}

function percent(value) { return Math.round(value * 100000000) / 1000000; }
function normalizedWeights(weights, allow) {
  const entries = Object.entries(weights || {}).filter(([key, value]) => Number.isFinite(Number(value)) && Number(value) > 0 && (!allow || allow.includes(key)));
  const total = entries.reduce((sum, [, value]) => sum + Number(value), 0);
  return entries.map(([key, value]) => [key, Number(value) / total]);
}

// Shared with the draw: probabilities describe outcomes BEFORE payment, including unavailable types.
function buildDisclosure(crate, context) {
  const pityActive = Number(crate.pity_pulls) > 0 && context.pullsSince + 1 >= Number(crate.pity_pulls);
  const baseClasses = normalizedWeights(crate.rarity_weights);
  let classes = normalizedWeights(crate.rarity_weights, pityActive ? RARE_CLASSES : null);
  if (!classes.length) classes = baseClasses;
  const firstRecruit = crate.code === 'recruit_crate' && context.firstRecruit;
  const alternatives = context.factions.filter(f => f !== context.faction);
  const cross = firstRecruit || !alternatives.length ? 0 : Math.max(0, Math.min(100, context.crossPct)) / 100;
  const factions = context.faction ? [[context.faction, 1 - cross], ...alternatives.map(f => [f, cross / alternatives.length])].filter(([, p]) => p > 0) : [];
  const outcomes = [];
  for (const [requested, classP] of classes) {
    for (const [faction, factionP] of factions) {
      let rarity = requested;
      let substituted = false;
      if (rarity === 'titan') {
        const titan = context.types.find(t => t.faction_code === faction && t.size_class === 'titan');
        if (!titan || (Number(titan.max_per_server) > 0 && Number(titan.server_alive) >= Number(titan.max_per_server))) {
          rarity = 'battleship'; substituted = true;
        }
      }
      const types = context.types.filter(t => t.faction_code === faction && t.size_class === rarity);
      if (!types.length) {
        outcomes.push({ requested_class: requested, rarity, faction, ship_type_code: null, probability_pct: classP * factionP * 100, usable: false, titan_substituted: substituted, error: 'NO_SHIP_FOR_RARITY' });
      } else for (const type of types) {
        const error = context.maxShips > 0 && context.totalAlive >= context.maxShips ? 'PLAYER_FLEET_FULL'
          : Number(type.max_per_player) > 0 && Number(type.my_alive) >= Number(type.max_per_player) ? 'SHIP_TYPE_LIMIT'
          : Number(type.max_per_server) > 0 && Number(type.server_alive) >= Number(type.max_per_server) ? 'SERVER_LIMIT_REACHED' : null;
        outcomes.push({ requested_class: requested, rarity, faction, ship_type_code: type.code, probability_pct: classP * factionP * 100 / types.length, usable: faction === context.faction && !error, titan_substituted: substituted, error });
      }
    }
  }
  const effective = {};
  for (const outcome of outcomes) effective[outcome.rarity] = (effective[outcome.rarity] || 0) + outcome.probability_pct;
  for (const rarity of Object.keys(effective)) effective[rarity] = percent(effective[rarity] / 100);
  const quality = Object.fromEntries(normalizedWeights(CRATE_QUALITY_WEIGHTS[crate.code] || QUALITY_WEIGHTS_DEFAULT).map(([grade, p]) => [grade, percent(p)]));
  return {
    personalized: !!context.faction, snapshot_at: new Date().toISOString(),
    base_class_odds: Object.fromEntries(baseClasses.map(([cls, p]) => [cls, percent(p)])),
    effective_class_odds: effective, quality_odds: quality,
    quality_bonus_ranges: QUALITY_BONUS_RANGE, quality_variance: [0.7, 1.3],
    pity_active: pityActive, first_recruit_own_faction: !!firstRecruit,
    cross_faction_pct: percent(cross), usable_pct: percent(outcomes.filter(o => o.usable).reduce((sum, o) => sum + o.probability_pct, 0) / 100),
    unavailable_pct: percent(outcomes.filter(o => o.error).reduce((sum, o) => sum + o.probability_pct, 0) / 100),
    outcomes, cap_snapshot: context.types.filter(t => t.size_class === 'titan').map(t => ({ code: t.code, faction: t.faction_code, alive: Number(t.server_alive), max: Number(t.max_per_server) || null }))
  };
}

async function getDrawContext(db, wallet, faction, pullsSince, crossPct) {
  const { rows: factions } = await db.query(`SELECT code FROM factions WHERE is_active = true ORDER BY code`);
  const { rows: types } = await db.query(`SELECT st.*,
    (SELECT COUNT(*) FROM ships s WHERE s.ship_type_code = st.code AND s.is_alive = true) AS server_alive,
    (SELECT COUNT(*) FROM ships s WHERE s.ship_type_code = st.code AND LOWER(s.owner_wallet) = LOWER($1) AND s.is_alive = true) AS my_alive
    FROM ship_types st WHERE st.is_active = true ORDER BY st.code`, [wallet || '']);
  const { rows: recruit } = await db.query(`SELECT EXISTS(SELECT 1 FROM ship_crate_pulls WHERE wallet = $1 AND crate_code = 'recruit_crate') AS used`, [wallet || '']);
  const { rows: limits } = await db.query(`SELECT
    (SELECT COUNT(*) FROM ships WHERE LOWER(owner_wallet)=LOWER($1) AND is_alive=true) AS total_alive,
    (SELECT value #>> '{}' FROM settings WHERE category='fleet' AND key='max_ships_per_player' LIMIT 1) AS max_ships`, [wallet || '']);
  return { faction, pullsSince, crossPct, factions: factions.map(f => f.code), types, firstRecruit: !!wallet && !recruit[0].used,
    totalAlive: Number(limits[0].total_alive), maxShips: Number(limits[0].max_ships) > 0 ? Number(limits[0].max_ships) : 200 };
}

async function listCrates(walletAddress) {
  if (String(await getSetting('ship_crate_enabled', 'true')) === 'false') return { enabled: false, crates: [] };
  const wallet = String(walletAddress || '').toLowerCase().trim();
  const { rows } = await pool.query(`SELECT code, label_ko, label_en, price_gp, price_usdt, rarity_weights, pity_pulls, daily_limit FROM ship_crate_types WHERE active = true ORDER BY sort_order ASC, price_gp ASC`);
  const userPity = {}, dailyUsed = {};
  let faction = null;
  if (wallet) {
    const [{ rows: users }, { rows: pity }, { rows: used }] = await Promise.all([
      pool.query(`SELECT faction_code FROM users WHERE LOWER(wallet_address) = LOWER($1)`, [wallet]),
      pool.query(`SELECT crate_code, pulls_since_rare FROM ship_crate_pity WHERE LOWER(wallet) = LOWER($1)`, [wallet]),
      pool.query(`SELECT crate_code, COUNT(*)::int AS count FROM ship_crate_pulls WHERE wallet = $1 AND created_at >= date_trunc('day', NOW()) GROUP BY crate_code`, [wallet])
    ]);
    faction = users[0]?.faction_code || null;
    for (const row of pity) userPity[row.crate_code] = Number(row.pulls_since_rare) || 0;
    for (const row of used) dailyUsed[row.crate_code] = row.count;
  }
  const crossPct = Number(await getSetting('crate_cross_faction_pct', '18')) || 0;
  const context = await getDrawContext(pool, wallet, faction, 0, crossPct);
  return { enabled: true, crates: rows.map(r => {
    const disclosure = buildDisclosure(r, { ...context, pullsSince: userPity[r.code] || 0 });
    return { code: r.code, label_ko: r.label_ko, label_en: r.label_en, price_gp: r.price_gp, price_usdt: Number(r.price_usdt) || 0,
      pity_pulls: r.pity_pulls, daily_limit: Number(r.daily_limit) || 0, odds: disclosure.base_class_odds, disclosure,
      daily_remaining: r.daily_limit > 0 ? Math.max(0, r.daily_limit - (dailyUsed[r.code] || 0)) : null,
      pulls_since_rare: userPity[r.code] || 0,
      pity_remaining: Number(r.pity_pulls) > 0 ? Math.max(0, Number(r.pity_pulls) - (userPity[r.code] || 0)) : null };
  }) };
}

// Put a draw into an idle fleet; reserved fleets must keep their registered hulls.
async function getOrCreateFleet(client, wallet) {
  const { rows: existing } = await client.query(
    `SELECT id FROM fleets WHERE owner_wallet = $1 ORDER BY id ASC FOR UPDATE`, [wallet]
  );
  for (const fleet of existing) {
    const reservation = await client.query('SELECT is_in_battle,current_battle_id FROM fleets WHERE id=$1 FOR UPDATE', [fleet.id]);
    if (reservation.rows[0]?.is_in_battle || reservation.rows[0]?.current_battle_id) continue;
    try { await assertFleetsNotMining(client, [fleet.id]); return fleet.id; }
    catch (error) { if (!['FLEET_MINING','FLEET_TRANSPORTING'].includes(error.message)) throw error; }
  }
  const { rows: nick } = await client.query('SELECT nickname FROM users WHERE LOWER(wallet_address) = LOWER($1)', [wallet]);
  const name = `${nick[0]?.nickname || 'Commander'} 제1함대`;
  const { rows } = await client.query(
    `INSERT INTO fleets (owner_wallet, name, formation, movement) VALUES ($1, $2, 'wedge', 'advance') RETURNING id`,
    [wallet, name]
  );
  return rows[0].id;
}

async function openCrate(wallet, crateCode) {
  const w = (wallet || '').toLowerCase().trim();
  if (!w) return { error: 'INVALID_WALLET' };
  if (String(await getSetting('ship_crate_enabled', 'true')) === 'false') return { error: 'CRATE_DISABLED' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: crateRows } = await client.query(
      `SELECT code, price_gp, rarity_weights, pity_pulls, daily_limit FROM ship_crate_types WHERE code = $1 AND active = true`,
      [crateCode]
    );
    const crate = crateRows[0];
    if (!crate) { await client.query('ROLLBACK'); return { error: 'CRATE_NOT_FOUND' }; }

    // Serialize all crate draws for this user before checking the daily quota.
    // Checking the count before this lock allowed concurrent free draws through.
    const { rows: userRows } = await client.query(
      `SELECT gp_balance, faction_code FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`, [w]
    );
    const user = userRows[0];
    if (!user) { await client.query('ROLLBACK'); return { error: 'USER_NOT_FOUND' }; }
    if (!user.faction_code) { await client.query('ROLLBACK'); return { error: 'NO_FACTION' }; }

    // 일일 개봉 제한(무료/데일리 상자 함선 공급 통제). daily_limit=0 이면 무제한.
    const dailyLimit = parseInt(crate.daily_limit, 10) || 0;
    if (dailyLimit > 0) {
      const { rows: usedRows } = await client.query(
        `SELECT COUNT(*)::int AS c FROM ship_crate_pulls
         WHERE wallet = $1 AND crate_code = $2 AND created_at >= date_trunc('day', NOW())`,
        [w, crateCode]
      );
      if ((usedRows[0]?.c || 0) >= dailyLimit) {
        await client.query('ROLLBACK');
        return { error: 'DAILY_LIMIT_REACHED', daily_limit: dailyLimit };
      }
    }

    const price = parseInt(crate.price_gp, 10) || 0;
    if (Number(user.gp_balance) < price) { await client.query('ROLLBACK'); return { error: 'INSUFFICIENT_GP', required: price, current: Number(user.gp_balance) }; }

    // 천장 확인
    const { rows: pityRows } = await client.query(
      `SELECT pulls_since_rare FROM ship_crate_pity WHERE wallet = $1 AND crate_code = $2 FOR UPDATE`, [w, crateCode]
    );
    const pullsSince = pityRows[0]?.pulls_since_rare || 0;
    const pity = parseInt(crate.pity_pulls, 10) || 0;
    const pityHit = pity > 0 && (pullsSince + 1) >= pity;

    // Lock capped types in the same order and namespace as ordinary construction.
    // Different wallets cannot both consume the final Titan slot.
    const { rows: capped } = await client.query(`SELECT code FROM ship_types WHERE is_active = true AND max_per_server > 0 ORDER BY code`);
    for (const type of capped) await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, ['shipbuild:' + type.code]);
    const crossPct = Number(await getSetting('crate_cross_faction_pct', '18')) || 0;
    const context = await getDrawContext(client, w, user.faction_code, Number(pullsSince), crossPct);
    const disclosure = buildDisclosure(crate, context);
    if (!disclosure.outcomes.length) { await client.query('ROLLBACK'); return { error: 'CRATE_MISCONFIGURED' }; }
    let remaining = randFloat() * disclosure.outcomes.reduce((sum, o) => sum + o.probability_pct, 0);
    const outcome = disclosure.outcomes.find(o => { remaining -= o.probability_pct; return remaining < 0; }) || disclosure.outcomes.at(-1);
    if (outcome.error) { await client.query('ROLLBACK'); return { error: outcome.error, rarity: outcome.rarity }; }
    const rarity = outcome.rarity;
    const picked = context.types.find(t => t.code === outcome.ship_type_code);

    // 각인 품질 롤 → 보너스 스탯(강화된 개체 가능)
    const baseStats = {
      atk:   parseInt(picked.base_atk, 10) || 0,
      def:   parseInt(picked.base_def, 10) || 0,
      hp:    parseInt(picked.base_hp, 10) || 0,
      speed: Number(picked.base_speed) || 0,
    };
    const quality = rollQuality(crateCode);
    const bonus = rollBonusStats(quality, baseStats);

    // GP 차감
    await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2)`, [price, w]
    );

    // 함선 인스턴스 생성:
    // · own-faction → 함대에 편입 + 기함 후보 검사 (기존 로직)
    // · cross-faction → fleet_id=NULL (창고), 기함 아님 — 사용 불가, 마켓 판매만 가능
    const shipFactionMatches = (picked.faction_code === user.faction_code);
    let fleetId = null;
    let isFlagship = false;
    if (shipFactionMatches) {
      fleetId = await getOrCreateFleet(client, w);
      const { rows: flagRows } = await client.query(
        `SELECT COUNT(*) AS c FROM ships WHERE fleet_id = $1 AND is_flagship = true AND is_alive = true`, [fleetId]
      );
      isFlagship = parseInt(flagRows[0]?.c || 0, 10) === 0 && picked.is_flagship_capable;
    }
    const fullHp = baseStats.hp + (bonus.hp || 0); // 보너스 HP 포함 만피로 도착
    const { rows: shipRows } = await client.query(
      `INSERT INTO ships (fleet_id, ship_type_code, owner_wallet, current_hp, max_hp, is_flagship, is_alive, built_at, built_by_wallet,
                          bonus_atk, bonus_def, bonus_hp, bonus_speed, quality)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), $3, $7, $8, $9, $10, $11) RETURNING id`,
      [fleetId, picked.code, w, fullHp, baseStats.hp, isFlagship, bonus.atk, bonus.def, bonus.hp, bonus.speed, quality]
    );

    const isRare = RARE_CLASSES.includes(rarity);
    // 풀 로그 (품질 포함)
    await client.query(
      `INSERT INTO ship_crate_pulls (wallet, crate_code, ship_type_code, rarity, was_pity, price_gp, quality)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [w, crateCode, picked.code, rarity, pityHit && isRare, price, quality]
    );
    // 천장 카운터: 희귀 뽑으면 0, 아니면 +1
    await client.query(
      `INSERT INTO ship_crate_pity (wallet, crate_code, pulls_since_rare)
       VALUES ($1, $2, $3)
       ON CONFLICT (wallet, crate_code) DO UPDATE SET pulls_since_rare = $3`,
      [w, crateCode, isRare ? 0 : (pullsSince + 1)]
    );

    await client.query('COMMIT');

    try { logGPActivity(w, -price, 'ship_crate', `${crateCode} 개봉 → ${picked.code}(${rarity}/${quality})`).catch(() => {}); } catch (_) {}

    return {
      success: true,
      crate: crateCode,
      ship: {
        id: shipRows[0].id, code: picked.code, rarity, isFlagship, quality,
        faction: picked.faction_code,
        userFaction: user.faction_code,
        isCrossFaction: !shipFactionMatches,
        base: baseStats,
        bonus,
        stats: {
          atk:   baseStats.atk + (bonus.atk || 0),
          def:   baseStats.def + (bonus.def || 0),
          hp:    baseStats.hp + (bonus.hp || 0),
          speed: Math.round((baseStats.speed + (bonus.speed || 0)) * 100) / 100,
        }
      },
      was_pity: pityHit && isRare,
      gp_spent: price,
      disclosure
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[shipCrate] openCrate error:', err.message);
    // 함급당 보유 한도(서버 트리거)에 걸리면 GP는 롤백되어 차감 없음 — 명확한 코드로 반환.
    if (err && /SHIP_PLAYER_TOTAL_LIMIT/i.test(err.message || '')) return { error: 'PLAYER_FLEET_FULL' };
    if (err && /SHIP_SERVER_LIMIT_REACHED/i.test(err.message || '')) return { error: 'SERVER_LIMIT_REACHED' };
    if (err && /SHIP_PLAYER_TYPE_LIMIT|per player/i.test(err.message || '')) {
      return { error: 'SHIP_TYPE_LIMIT' };
    }
    return { error: 'SERVER_ERROR' };
  } finally {
    client.release();
  }
}

module.exports = { listCrates, openCrate, buildDisclosure, normalizedWeights };
