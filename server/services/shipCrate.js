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

async function listCrates() {
  const enabled = String(await getSetting('ship_crate_enabled', 'true'));
  if (enabled === 'false') return { enabled: false, crates: [] };
  const { rows } = await pool.query(
    `SELECT code, label_ko, label_en, price_gp, price_usdt, rarity_weights, pity_pulls
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
      pity_pulls: r.pity_pulls, odds
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
      `SELECT code, price_gp, rarity_weights, pity_pulls FROM ship_crate_types WHERE code = $1 AND active = true`,
      [crateCode]
    );
    const crate = crateRows[0];
    if (!crate) { await client.query('ROLLBACK'); return { error: 'CRATE_NOT_FOUND' }; }

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

    // 타이탄 서버 캡 존중: 캡 가득이면 battleship 으로 강등
    if (rarity === 'titan') {
      const { rows: tRows } = await client.query(
        `SELECT st.code, st.max_per_server,
                (SELECT COUNT(*) FROM ships s WHERE s.ship_type_code = st.code AND s.is_alive = true) AS alive
         FROM ship_types st WHERE st.faction_code = $1 AND st.size_class = 'titan' AND st.is_active = true LIMIT 1`,
        [user.faction_code]
      );
      const t = tRows[0];
      if (!t || (t.max_per_server && parseInt(t.alive, 10) >= parseInt(t.max_per_server, 10))) {
        rarity = 'battleship';
      }
    }

    // 해당 파벌·등급의 함선 중 랜덤 선택
    const { rows: shipTypeRows } = await client.query(
      `SELECT code, base_hp, is_flagship_capable FROM ship_types
       WHERE faction_code = $1 AND size_class = $2 AND is_active = true`,
      [user.faction_code, rarity]
    );
    if (!shipTypeRows.length) {
      // 해당 등급 함선이 없으면(이론상 드묾) 한 단계 낮춰 재시도
      await client.query('ROLLBACK');
      return { error: 'NO_SHIP_FOR_RARITY', rarity };
    }
    const picked = shipTypeRows[randInt(shipTypeRows.length)];

    // GP 차감
    await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2)`, [price, w]
    );

    // 함대 확보 + 함선 인스턴스 생성 (grantCampaignShips 와 동일 규칙)
    const fleetId = await getOrCreateFleet(client, w);
    const { rows: flagRows } = await client.query(
      `SELECT COUNT(*) AS c FROM ships WHERE fleet_id = $1 AND is_flagship = true AND is_alive = true`, [fleetId]
    );
    const isFlagship = parseInt(flagRows[0]?.c || 0, 10) === 0 && picked.is_flagship_capable;
    const { rows: shipRows } = await client.query(
      `INSERT INTO ships (fleet_id, ship_type_code, owner_wallet, current_hp, max_hp, is_flagship, is_alive, built_at, built_by_wallet)
       VALUES ($1, $2, $3, $4, $4, $5, true, NOW(), $3) RETURNING id`,
      [fleetId, picked.code, w, picked.base_hp, isFlagship]
    );

    const isRare = RARE_CLASSES.includes(rarity);
    // 풀 로그
    await client.query(
      `INSERT INTO ship_crate_pulls (wallet, crate_code, ship_type_code, rarity, was_pity, price_gp)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [w, crateCode, picked.code, rarity, pityHit && isRare, price]
    );
    // 천장 카운터: 희귀 뽑으면 0, 아니면 +1
    await client.query(
      `INSERT INTO ship_crate_pity (wallet, crate_code, pulls_since_rare)
       VALUES ($1, $2, $3)
       ON CONFLICT (wallet, crate_code) DO UPDATE SET pulls_since_rare = $3`,
      [w, crateCode, isRare ? 0 : (pullsSince + 1)]
    );

    await client.query('COMMIT');

    try { logGPActivity(w, -price, 'ship_crate', `${crateCode} 개봉 → ${picked.code}(${rarity})`).catch(() => {}); } catch (_) {}

    return {
      success: true,
      crate: crateCode,
      ship: { id: shipRows[0].id, code: picked.code, rarity, isFlagship },
      was_pity: pityHit && isRare,
      gp_spent: price
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[shipCrate] openCrate error:', err.message);
    return { error: 'SERVER_ERROR' };
  } finally {
    client.release();
  }
}

module.exports = { listCrates, openCrate };
