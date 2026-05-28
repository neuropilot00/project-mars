// server/services/shipCrate.js
// 함선 가챠(Ship Crate) — 서버 권위 RNG + 천장(pity) + 타이탄 서버 캡 존중.
// 상자를 GP로 구매·개봉하면 size_class 가중치에 따라 함선 1척을 획득해 함대에 편입한다.
const crypto = require('crypto');
const { pool, getSetting, logGPActivity } = require('../db');

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
  let r = randInt(total);
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

async function listCrates() {
  const enabled = String(await getSetting('ship_crate_enabled', 'true'));
  if (enabled === 'false') return { enabled: false, crates: [] };
  const { rows } = await pool.query(
    `SELECT code, label_ko, label_en, price_gp, price_usdt, rarity_weights, pity_pulls, daily_limit
     FROM ship_crate_types WHERE active = true ORDER BY sort_order ASC, price_gp ASC`
  );
  // 확률 공개(odds disclosure): 가중치를 % 로 환산해 함께 내려준다(법적 대응).
  const crates = rows.map(r => {
    const w = r.rarity_weights || {};
    const total = Object.values(w).reduce((s, v) => s + Number(v), 0) || 1;
    const odds = {};
    for (const [cls, val] of Object.entries(w)) odds[cls] = Math.round((Number(val) / total) * 1000) / 10; // 0.1% 단위
    return {
      code: r.code, label_ko: r.label_ko, label_en: r.label_en,
      price_gp: r.price_gp, price_usdt: Number(r.price_usdt) || 0,
      pity_pulls: r.pity_pulls, daily_limit: parseInt(r.daily_limit, 10) || 0, odds
    };
  });
  return { enabled: true, crates };
}

// 함선을 넣을 함대 확보(없으면 생성) — campaign 의 getOrCreateCampaignFleet 과 동일 규칙
async function getOrCreateFleet(client, wallet) {
  const { rows: existing } = await client.query(
    `SELECT id FROM fleets WHERE owner_wallet = $1 ORDER BY id ASC LIMIT 1`, [wallet]
  );
  if (existing[0]) return existing[0].id;
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

    // 유저 락 + GP/파벌 확인
    const { rows: userRows } = await client.query(
      `SELECT gp_balance, faction_code FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`, [w]
    );
    const user = userRows[0];
    if (!user) { await client.query('ROLLBACK'); return { error: 'USER_NOT_FOUND' }; }
    if (!user.faction_code) { await client.query('ROLLBACK'); return { error: 'NO_FACTION' }; }
    const price = parseInt(crate.price_gp, 10) || 0;
    if (Number(user.gp_balance) < price) { await client.query('ROLLBACK'); return { error: 'INSUFFICIENT_GP', required: price, current: Number(user.gp_balance) }; }

    // 천장 확인
    const { rows: pityRows } = await client.query(
      `SELECT pulls_since_rare FROM ship_crate_pity WHERE wallet = $1 AND crate_code = $2 FOR UPDATE`, [w, crateCode]
    );
    const pullsSince = pityRows[0]?.pulls_since_rare || 0;
    const pity = parseInt(crate.pity_pulls, 10) || 0;
    const pityHit = pity > 0 && (pullsSince + 1) >= pity;

    // 등급 롤 (천장 발동 시 희귀 이상만 후보)
    const weights = crate.rarity_weights || {};
    let rarity = rollRarity(weights, pityHit ? RARE_CLASSES : null);
    if (!rarity) rarity = rollRarity(weights, null); // 천장 후보가 없으면 일반 롤로 폴백
    if (!rarity) { await client.query('ROLLBACK'); return { error: 'CRATE_MISCONFIGURED' }; }

    // Cross-faction 롤 — 다른 진영 함선이 나올 확률(settings 조정 가능, 기본 18%).
    // 사용은 불가하지만 마켓에 팔 수 있어 cross-faction 시장 유동성을 생성한다.
    const crossPct = parseFloat(await getSetting('crate_cross_faction_pct', '18')) || 0;
    const isCrossFaction = crossPct > 0 && (randFloat() * 100) < crossPct;
    let targetFaction = user.faction_code;
    if (isCrossFaction) {
      const { rows: factionRows } = await client.query(
        `SELECT code FROM factions WHERE code <> $1 AND is_active = true`, [user.faction_code]
      );
      if (factionRows.length > 0) {
        targetFaction = factionRows[randInt(factionRows.length)].code;
      }
    }

    // 타이탄 서버 캡 존중: 캡 가득이면 battleship 으로 강등 (target faction 기준)
    if (rarity === 'titan') {
      const { rows: tRows } = await client.query(
        `SELECT st.code, st.max_per_server,
                (SELECT COUNT(*) FROM ships s WHERE s.ship_type_code = st.code AND s.is_alive = true) AS alive
         FROM ship_types st WHERE st.faction_code = $1 AND st.size_class = 'titan' AND st.is_active = true LIMIT 1`,
        [targetFaction]
      );
      const t = tRows[0];
      if (!t || (t.max_per_server && parseInt(t.alive, 10) >= parseInt(t.max_per_server, 10))) {
        rarity = 'battleship';
      }
    }

    // target faction·등급의 함선 중 랜덤 선택 (base 스탯 포함)
    const { rows: shipTypeRows } = await client.query(
      `SELECT code, faction_code, base_hp, base_atk, base_def, base_speed, is_flagship_capable FROM ship_types
       WHERE faction_code = $1 AND size_class = $2 AND is_active = true`,
      [targetFaction, rarity]
    );
    if (!shipTypeRows.length) {
      // 해당 등급 함선이 없으면(이론상 드묾) 한 단계 낮춰 재시도
      await client.query('ROLLBACK');
      return { error: 'NO_SHIP_FOR_RARITY', rarity };
    }
    const picked = shipTypeRows[randInt(shipTypeRows.length)];

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
      gp_spent: price
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[shipCrate] openCrate error:', err.message);
    // 함급당 보유 한도(서버 트리거)에 걸리면 GP는 롤백되어 차감 없음 — 명확한 코드로 반환.
    if (err && /SHIP_PLAYER_TYPE_LIMIT|per player/i.test(err.message || '')) {
      return { error: 'SHIP_TYPE_LIMIT' };
    }
    return { error: 'SERVER_ERROR' };
  } finally {
    client.release();
  }
}

module.exports = { listCrates, openCrate };
