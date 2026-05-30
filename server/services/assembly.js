// server/services/assembly.js
// ═══════════════════════════════════════════════════════════════
// 합체/수집형 한정 유닛 프레임워크 (로봇·함선·우주인 등 데이터로 확장)
// 기획서: docs/MECHA_ASSEMBLY_GACHA_PLAN_2026-05-30.md
//
// 유닛 정의는 전부 DB(assembly_units + assembly_parts)에 있고, 코드는 unit-agnostic.
// 새 한정 유닛 추가 = ship_types + assembly_units + assembly_parts 행 INSERT 만으로 끝.
//
// listUnits(wallet)               — 활성 유닛 목록 + 유닛별 요약
// getState(wallet, unitCode)      — 단일 유닛 상세(파츠/조각/천장/합체가능)
// pull(wallet, unitCode, count)   — 박스가챠(균등 + 하드천장 + 중복→조각)
// assemble(wallet, unitCode)      — 파츠 전부 소모 + GP → 합체체 ships 인스턴스
// disassemble(shipId, wallet)     — 해체 → 파츠 환원
// exchangeShards(wallet, unitCode, part) — 조각 소프트천장 교환
// grantParts(wallet, part, qty)   — 어드민/테스트 파츠 지급
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');

// ── 유닛 카탈로그 조회 ──
async function getUnit(unitCode) {
  if (unitCode) {
    const { rows } = await pool.query(`SELECT * FROM assembly_units WHERE unit_code = $1 AND active = true`, [unitCode]);
    return rows[0] || null;
  }
  // unitCode 미지정 → 첫 활성 유닛(정렬순)
  const { rows } = await pool.query(`SELECT * FROM assembly_units WHERE active = true ORDER BY sort_order ASC, unit_code ASC LIMIT 1`);
  return rows[0] || null;
}

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

async function loadParts(unitCode) {
  const { rows } = await pool.query(
    `SELECT part_code, slot, name_en, name_ko, name_ja, name_zh, icon_emoji, sort_order
     FROM assembly_parts WHERE unit_code = $1 AND is_active = true ORDER BY slot ASC`, [unitCode]
  );
  return rows;
}

function unitNames(u) {
  return { name_en: u.name_en, name_ko: u.name_ko, name_ja: u.name_ja, name_zh: u.name_zh, icon: u.icon_emoji, kind: u.kind, season: u.season_code };
}

// ── 활성 유닛 목록 + 유닛별 보유 요약 ──
async function listUnits(wallet) {
  const w = (wallet || '').toLowerCase().trim();
  if (!w) return { error: 'INVALID_WALLET' };
  const { rows: units } = await pool.query(`SELECT * FROM assembly_units WHERE active = true ORDER BY sort_order ASC, unit_code ASC`);
  const out = [];
  for (const u of units) {
    const parts = await loadParts(u.unit_code);
    const { rows: owned } = await pool.query(
      `SELECT COUNT(*)::int AS distinct FROM user_assembly_parts up
       JOIN assembly_parts ap ON ap.part_code = up.part_code AND ap.unit_code = $2
       WHERE up.wallet = $1 AND up.qty >= 1`, [w, u.unit_code]
    );
    const { rows: built } = await pool.query(
      `SELECT COUNT(*)::int AS c FROM ships WHERE LOWER(owner_wallet) = $1 AND ship_type_code = $2 AND is_alive = true`,
      [w, u.ship_type_code]
    );
    out.push(Object.assign(unitNames(u), {
      unit_code: u.unit_code,
      faction_code: u.faction_code,
      total_parts: parts.length || u.part_count,
      distinct_owned: owned[0]?.distinct || 0,
      built_count: built[0]?.c || 0,
      max_per_player: u.max_per_player,
      gacha_price_gp: u.gacha_price_gp,
    }));
  }
  return { units: out };
}

// ── 단일 유닛 상세 상태 ──
async function getState(wallet, unitCode) {
  const w = (wallet || '').toLowerCase().trim();
  if (!w) return { error: 'INVALID_WALLET' };
  const u = await getUnit(unitCode);
  if (!u) return { error: 'UNIT_NOT_FOUND' };

  const parts = await loadParts(u.unit_code);
  const { rows: owned } = await pool.query(`SELECT part_code, qty FROM user_assembly_parts WHERE wallet = $1`, [w]);
  const ownMap = {};
  owned.forEach(r => { ownMap[r.part_code] = parseInt(r.qty, 10) || 0; });

  const { rows: shardRows } = await pool.query(`SELECT shards FROM user_assembly_shards WHERE wallet = $1`, [w]);
  const shards = parseInt(shardRows[0]?.shards, 10) || 0;

  const { rows: unitInfo } = await pool.query(
    `SELECT name_en, name_ko, name_ja, name_zh, class_label, base_hp, base_atk, base_def, base_speed
     FROM ship_types WHERE code = $1`, [u.ship_type_code]
  );

  const partState = parts.map(p => ({
    part_code: p.part_code, slot: p.slot, icon: p.icon_emoji,
    name_en: p.name_en, name_ko: p.name_ko, name_ja: p.name_ja, name_zh: p.name_zh,
    owned: ownMap[p.part_code] || 0,
  }));
  const distinct = partState.filter(p => p.owned >= 1).length;

  const { rows: builtRows } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM ships WHERE LOWER(owner_wallet) = $1 AND ship_type_code = $2 AND is_alive = true`,
    [w, u.ship_type_code]
  );
  const builtCount = builtRows[0]?.c || 0;

  const { rows: pityRows } = await pool.query(
    `SELECT pulls_since_new FROM user_assembly_gacha WHERE wallet = $1 AND unit_code = $2`, [w, u.unit_code]
  );
  const pulls = parseInt(pityRows[0]?.pulls_since_new, 10) || 0;

  return Object.assign(unitNames(u), {
    unit_code: u.unit_code,
    ship_type_code: u.ship_type_code,
    faction_code: u.faction_code,
    unit: unitInfo[0] || null,
    parts: partState,
    distinct_owned: distinct,
    total_parts: parts.length,
    can_assemble: distinct >= parts.length && builtCount < u.max_per_player,
    built_count: builtCount,
    max_per_player: u.max_per_player,
    shards,
    shard_exchange_cost: u.shard_exchange_cost,
    assemble_gp_cost: u.assemble_gp_cost,
    disassemble_enabled: u.disassemble_enabled,
    gacha_enabled: u.gacha_enabled,
    gacha_price_gp: u.gacha_price_gp,
    pulls_since_new: pulls,
    hard_pity: u.hard_pity_pulls,
    pity_remaining: Math.max(0, u.hard_pity_pulls - pulls),
  });
}

// ── 가챠 ──
async function pull(wallet, unitCode, count) {
  const w = (wallet || '').toLowerCase().trim();
  if (!w) return { error: 'INVALID_WALLET' };
  const u = await getUnit(unitCode);
  if (!u) return { error: 'UNIT_NOT_FOUND' };
  if (!u.gacha_enabled) return { error: 'GACHA_DISABLED' };

  const price = u.gacha_price_gp || 0;
  const hardPity = u.hard_pity_pulls || 30;
  const dupYield = u.dup_shard_yield || 15;
  const maxMulti = 10;
  const n = Math.max(1, Math.min(maxMulti, parseInt(count, 10) || 1));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: partRows } = await client.query(
      `SELECT part_code FROM assembly_parts WHERE unit_code = $1 AND is_active = true ORDER BY slot ASC`, [u.unit_code]
    );
    if (!partRows.length) { await client.query('ROLLBACK'); return { error: 'NO_PARTS_DEFINED' }; }
    const allParts = partRows.map(p => p.part_code);

    const total = price * n;
    if (total > 0) {
      const { rows: uu } = await client.query(`SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`, [w]);
      if (!uu[0]) { await client.query('ROLLBACK'); return { error: 'USER_NOT_FOUND' }; }
      if (Number(uu[0].gp_balance) < total) { await client.query('ROLLBACK'); return { error: 'INSUFFICIENT_GP', required: total, current: Number(uu[0].gp_balance) }; }
      await client.query(`UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2)`, [total, w]);
    }

    const { rows: owned } = await client.query(`SELECT part_code, qty FROM user_assembly_parts WHERE wallet = $1 FOR UPDATE`, [w]);
    const ownMap = {};
    owned.forEach(r => { ownMap[r.part_code] = parseInt(r.qty, 10) || 0; });

    const { rows: pityRows } = await client.query(
      `SELECT pulls_since_new FROM user_assembly_gacha WHERE wallet = $1 AND unit_code = $2 FOR UPDATE`, [w, u.unit_code]
    );
    let pullsSinceNew = pityRows[0]?.pulls_since_new || 0;

    let shardGain = 0;
    const results = [];
    for (let i = 0; i < n; i++) {
      const missing = allParts.filter(pc => (ownMap[pc] || 0) < 1);
      const pityHit = hardPity > 0 && (pullsSinceNew + 1) >= hardPity && missing.length > 0;
      const picked = pityHit ? missing[Math.floor(Math.random() * missing.length)] : allParts[Math.floor(Math.random() * allParts.length)];
      const wasNew = (ownMap[picked] || 0) < 1;
      ownMap[picked] = (ownMap[picked] || 0) + 1;
      let gain = 0;
      if (!wasNew) { gain = dupYield; shardGain += gain; }
      if (wasNew) pullsSinceNew = 0; else pullsSinceNew += 1;
      await client.query(
        `INSERT INTO assembly_gacha_pulls (wallet, part_code, was_pity, was_dup, shards_gain, price_gp, unit_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [w, picked, pityHit, !wasNew, gain, price, u.unit_code]
      );
      results.push({ part_code: picked, is_new: wasNew, is_dup: !wasNew, is_pity: pityHit, shards_gain: gain });
    }

    const tally = {};
    results.forEach(r => { tally[r.part_code] = (tally[r.part_code] || 0) + 1; });
    for (const pc of Object.keys(tally)) {
      await client.query(
        `INSERT INTO user_assembly_parts (wallet, part_code, qty) VALUES ($1, $2, $3)
         ON CONFLICT (wallet, part_code) DO UPDATE SET qty = user_assembly_parts.qty + $3, updated_at = NOW()`,
        [w, pc, tally[pc]]
      );
    }
    if (shardGain > 0) {
      await client.query(
        `INSERT INTO user_assembly_shards (wallet, shards) VALUES ($1, $2)
         ON CONFLICT (wallet) DO UPDATE SET shards = user_assembly_shards.shards + $2, updated_at = NOW()`,
        [w, shardGain]
      );
    }
    await client.query(
      `INSERT INTO user_assembly_gacha (wallet, unit_code, pulls_since_new, total_pulls) VALUES ($1, $2, $3, $4)
       ON CONFLICT (wallet, unit_code) DO UPDATE SET pulls_since_new = $3, total_pulls = user_assembly_gacha.total_pulls + $4, updated_at = NOW()`,
      [w, u.unit_code, pullsSinceNew, n]
    );

    await client.query('COMMIT');
    try {
      const { logGPActivity } = require('../db');
      if (total > 0) logGPActivity(w, -total, 'assembly_gacha', `${u.name_ko} 파츠 가챠 x${n}`).catch(() => {});
    } catch (_) {}
    return { success: true, unit_code: u.unit_code, count: n, price_gp: price, total_gp: total, results, shards_gained: shardGain, pulls_since_new: pullsSinceNew, hard_pity: hardPity };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ASSEMBLY] pull error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally { client.release(); }
}

// ── 합체 ──
async function assemble(wallet, unitCode) {
  const w = (wallet || '').toLowerCase().trim();
  if (!w) return { error: 'INVALID_WALLET' };
  const u = await getUnit(unitCode);
  if (!u) return { error: 'UNIT_NOT_FOUND' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: partRows } = await client.query(
      `SELECT part_code FROM assembly_parts WHERE unit_code = $1 AND is_active = true ORDER BY slot ASC`, [u.unit_code]
    );
    if (!partRows.length) { await client.query('ROLLBACK'); return { error: 'NO_PARTS_DEFINED' }; }

    const { rows: builtRows } = await client.query(
      `SELECT COUNT(*)::int AS c FROM ships WHERE LOWER(owner_wallet) = $1 AND ship_type_code = $2 AND is_alive = true`,
      [w, u.ship_type_code]
    );
    if ((builtRows[0]?.c || 0) >= u.max_per_player) { await client.query('ROLLBACK'); return { error: 'MAX_ASSEMBLED_REACHED', max: u.max_per_player }; }

    const { rows: owned } = await client.query(`SELECT part_code, qty FROM user_assembly_parts WHERE wallet = $1 FOR UPDATE`, [w]);
    const ownMap = {};
    owned.forEach(r => { ownMap[r.part_code] = parseInt(r.qty, 10) || 0; });
    const missing = partRows.filter(p => (ownMap[p.part_code] || 0) < 1).map(p => p.part_code);
    if (missing.length) { await client.query('ROLLBACK'); return { error: 'MISSING_PARTS', missing }; }

    const gpCost = u.assemble_gp_cost || 0;
    if (gpCost > 0) {
      const { rows: uu } = await client.query(`SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`, [w]);
      if (!uu[0]) { await client.query('ROLLBACK'); return { error: 'USER_NOT_FOUND' }; }
      if (Number(uu[0].gp_balance) < gpCost) { await client.query('ROLLBACK'); return { error: 'INSUFFICIENT_GP', required: gpCost, current: Number(uu[0].gp_balance) }; }
      await client.query(`UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2)`, [gpCost, w]);
    }

    for (const p of partRows) {
      await client.query(`UPDATE user_assembly_parts SET qty = qty - 1, updated_at = NOW() WHERE wallet = $1 AND part_code = $2`, [w, p.part_code]);
    }

    const { rows: st } = await client.query(`SELECT base_hp, is_flagship_capable FROM ship_types WHERE code = $1`, [u.ship_type_code]);
    const baseHp = parseInt(st[0]?.base_hp, 10) || 1;
    const fleetId = await getOrCreateFleet(client, w);
    const { rows: flagRows } = await client.query(
      `SELECT COUNT(*) AS c FROM ships WHERE fleet_id = $1 AND is_flagship = true AND is_alive = true`, [fleetId]
    );
    const isFlagship = parseInt(flagRows[0]?.c || 0, 10) === 0 && !!st[0]?.is_flagship_capable;
    const { rows: shipRows } = await client.query(
      `INSERT INTO ships (fleet_id, ship_type_code, owner_wallet, current_hp, max_hp, is_flagship, is_alive, built_at, built_by_wallet)
       VALUES ($1, $2, $3, $4, $4, $5, true, NOW(), $3) RETURNING id`,
      [fleetId, u.ship_type_code, w, baseHp, isFlagship]
    );
    const shipId = shipRows[0].id;
    await client.query(
      `INSERT INTO assembly_events (wallet, unit_code, action, ship_id, detail) VALUES ($1, $2, 'assemble', $3, $4)`,
      [w, u.unit_code, shipId, JSON.stringify({ gpCost, parts: partRows.map(p => p.part_code) })]
    );
    await client.query('COMMIT');
    try {
      const { logGPActivity } = require('../db');
      if (gpCost > 0) logGPActivity(w, -gpCost, 'assembly_assemble', `${u.name_ko} 합체`).catch(() => {});
    } catch (_) {}
    return { success: true, unit_code: u.unit_code, ship_id: String(shipId), is_flagship: isFlagship };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ASSEMBLY] assemble error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally { client.release(); }
}

// ── 해체 (ship_id로 유닛 자동 판별) ──
async function disassemble(shipId, wallet) {
  const w = (wallet || '').toLowerCase().trim();
  if (!w) return { error: 'INVALID_WALLET' };
  const sid = String(shipId || '').trim();
  if (!sid) return { error: 'SHIP_ID_REQUIRED' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: shipRows } = await client.query(
      `SELECT id, ship_type_code, owner_wallet, is_market_listed FROM ships WHERE id = $1 FOR UPDATE`, [sid]
    );
    const ship = shipRows[0];
    if (!ship) { await client.query('ROLLBACK'); return { error: 'SHIP_NOT_FOUND' }; }
    if (String(ship.owner_wallet).toLowerCase() !== w) { await client.query('ROLLBACK'); return { error: 'NOT_OWNER' }; }
    if (ship.is_market_listed) { await client.query('ROLLBACK'); return { error: 'SHIP_LISTED_FOR_SALE' }; }

    // 이 함선이 어떤 합체 유닛인지
    const { rows: unitRows } = await client.query(`SELECT unit_code, disassemble_enabled FROM assembly_units WHERE ship_type_code = $1`, [ship.ship_type_code]);
    if (!unitRows[0]) { await client.query('ROLLBACK'); return { error: 'NOT_ASSEMBLED_UNIT' }; }
    if (!unitRows[0].disassemble_enabled) { await client.query('ROLLBACK'); return { error: 'DISASSEMBLE_DISABLED' }; }
    const unitCode = unitRows[0].unit_code;

    const { rows: battle } = await client.query(
      `SELECT 1 FROM ships s JOIN fleets f ON s.fleet_id = f.id WHERE s.id = $1 AND f.is_in_battle = true LIMIT 1`, [sid]
    ).catch(() => ({ rows: [] }));
    if (battle && battle.length) { await client.query('ROLLBACK'); return { error: 'FLEET_IN_BATTLE' }; }

    const { rows: partRows } = await client.query(`SELECT part_code FROM assembly_parts WHERE unit_code = $1 AND is_active = true`, [unitCode]);
    for (const p of partRows) {
      await client.query(
        `INSERT INTO user_assembly_parts (wallet, part_code, qty) VALUES ($1, $2, 1)
         ON CONFLICT (wallet, part_code) DO UPDATE SET qty = user_assembly_parts.qty + 1, updated_at = NOW()`,
        [w, p.part_code]
      );
    }
    await client.query(`DELETE FROM ships WHERE id = $1`, [sid]);
    await client.query(
      `INSERT INTO assembly_events (wallet, unit_code, action, ship_id, detail) VALUES ($1, $2, 'disassemble', $3, $4)`,
      [w, unitCode, sid, JSON.stringify({ parts_returned: partRows.map(p => p.part_code) })]
    );
    await client.query('COMMIT');
    return { success: true, unit_code: unitCode, parts_returned: partRows.map(p => p.part_code) };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ASSEMBLY] disassemble error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally { client.release(); }
}

// ── 조각 교환 ──
async function exchangeShards(wallet, unitCode, partCode) {
  const w = (wallet || '').toLowerCase().trim();
  if (!w) return { error: 'INVALID_WALLET' };
  const u = await getUnit(unitCode);
  if (!u) return { error: 'UNIT_NOT_FOUND' };
  const cost = u.shard_exchange_cost || 40;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: partRows } = await client.query(
      `SELECT part_code FROM assembly_parts WHERE part_code = $1 AND unit_code = $2 AND is_active = true`, [partCode, u.unit_code]
    );
    if (!partRows[0]) { await client.query('ROLLBACK'); return { error: 'INVALID_PART' }; }

    const { rows: shardRows } = await client.query(`SELECT shards FROM user_assembly_shards WHERE wallet = $1 FOR UPDATE`, [w]);
    const shards = parseInt(shardRows[0]?.shards, 10) || 0;
    if (shards < cost) { await client.query('ROLLBACK'); return { error: 'INSUFFICIENT_SHARDS', required: cost, current: shards }; }

    await client.query(`UPDATE user_assembly_shards SET shards = shards - $1, updated_at = NOW() WHERE wallet = $2`, [cost, w]);
    await client.query(
      `INSERT INTO user_assembly_parts (wallet, part_code, qty) VALUES ($1, $2, 1)
       ON CONFLICT (wallet, part_code) DO UPDATE SET qty = user_assembly_parts.qty + 1, updated_at = NOW()`,
      [w, partCode]
    );
    await client.query(
      `INSERT INTO assembly_events (wallet, unit_code, action, detail) VALUES ($1, $2, 'exchange', $3)`,
      [w, u.unit_code, JSON.stringify({ part_code: partCode, shards_spent: cost })]
    );
    await client.query('COMMIT');
    return { success: true, unit_code: u.unit_code, part_code: partCode, shards_left: shards - cost };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ASSEMBLY] exchangeShards error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally { client.release(); }
}

// ── 어드민/테스트 파츠 지급 ──
async function grantParts(wallet, partCode, qty) {
  const w = (wallet || '').toLowerCase().trim();
  const n = Math.max(1, parseInt(qty, 10) || 1);
  if (!w) return { error: 'INVALID_WALLET' };
  const { rows } = await pool.query(`SELECT part_code, unit_code FROM assembly_parts WHERE part_code = $1`, [partCode]);
  if (!rows[0]) return { error: 'INVALID_PART' };
  await pool.query(
    `INSERT INTO user_assembly_parts (wallet, part_code, qty) VALUES ($1, $2, $3)
     ON CONFLICT (wallet, part_code) DO UPDATE SET qty = user_assembly_parts.qty + $3, updated_at = NOW()`,
    [w, partCode, n]
  );
  await pool.query(
    `INSERT INTO assembly_events (wallet, unit_code, action, detail) VALUES ($1, $2, 'grant', $3)`,
    [w, rows[0].unit_code, JSON.stringify({ part_code: partCode, qty: n })]
  ).catch(() => {});
  return { success: true, part_code: partCode, granted: n };
}

// ── 퍼펙트 가챠 박스: 활성 유닛 전체 파츠 풀에서 드롭(여러 유닛 동시 수집) ──
async function getBoxInfo() {
  const { getSetting } = require('../db');
  return {
    enabled: String(await getSetting('assembly_box_enabled', 'true')) !== 'false',
    price: parseInt(await getSetting('assembly_box_price_gp', '700'), 10) || 700,
    hardPity: parseInt(await getSetting('assembly_box_hard_pity', '50'), 10) || 50,
    dupYield: parseInt(await getSetting('assembly_box_dup_shard_yield', '15'), 10) || 15,
  };
}

async function pullBox(wallet, count) {
  const w = (wallet || '').toLowerCase().trim();
  if (!w) return { error: 'INVALID_WALLET' };
  const info = await getBoxInfo();
  if (!info.enabled) return { error: 'BOX_DISABLED' };
  const n = Math.max(1, Math.min(10, parseInt(count, 10) || 1));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 활성 유닛 전체 파츠 풀
    const { rows: pool0 } = await client.query(
      `SELECT ap.part_code FROM assembly_parts ap
       JOIN assembly_units au ON au.unit_code = ap.unit_code AND au.active = true
       WHERE ap.is_active = true ORDER BY ap.part_code`
    );
    if (!pool0.length) { await client.query('ROLLBACK'); return { error: 'NO_PARTS_DEFINED' }; }
    const allParts = pool0.map(r => r.part_code);

    const total = info.price * n;
    if (total > 0) {
      const { rows: uu } = await client.query(`SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`, [w]);
      if (!uu[0]) { await client.query('ROLLBACK'); return { error: 'USER_NOT_FOUND' }; }
      if (Number(uu[0].gp_balance) < total) { await client.query('ROLLBACK'); return { error: 'INSUFFICIENT_GP', required: total, current: Number(uu[0].gp_balance) }; }
      await client.query(`UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2)`, [total, w]);
    }

    const { rows: owned } = await client.query(`SELECT part_code, qty FROM user_assembly_parts WHERE wallet = $1 FOR UPDATE`, [w]);
    const ownMap = {};
    owned.forEach(r => { ownMap[r.part_code] = parseInt(r.qty, 10) || 0; });

    const { rows: pityRows } = await client.query(
      `SELECT pulls_since_new FROM user_assembly_gacha WHERE wallet = $1 AND unit_code = '__box__' FOR UPDATE`, [w]
    );
    let pulls = pityRows[0]?.pulls_since_new || 0;

    let shardGain = 0;
    const results = [];
    for (let i = 0; i < n; i++) {
      const missing = allParts.filter(pc => (ownMap[pc] || 0) < 1);
      const pityHit = info.hardPity > 0 && (pulls + 1) >= info.hardPity && missing.length > 0;
      const picked = pityHit ? missing[Math.floor(Math.random() * missing.length)] : allParts[Math.floor(Math.random() * allParts.length)];
      const wasNew = (ownMap[picked] || 0) < 1;
      ownMap[picked] = (ownMap[picked] || 0) + 1;
      let gain = 0;
      if (!wasNew) { gain = info.dupYield; shardGain += gain; }
      if (wasNew) pulls = 0; else pulls += 1;
      await client.query(
        `INSERT INTO assembly_gacha_pulls (wallet, part_code, was_pity, was_dup, shards_gain, price_gp, unit_code)
         VALUES ($1, $2, $3, $4, $5, $6, '__box__')`,
        [w, picked, pityHit, !wasNew, gain, info.price]
      );
      results.push({ part_code: picked, is_new: wasNew, is_dup: !wasNew, is_pity: pityHit, shards_gain: gain });
    }

    const tally = {};
    results.forEach(r => { tally[r.part_code] = (tally[r.part_code] || 0) + 1; });
    for (const pc of Object.keys(tally)) {
      await client.query(
        `INSERT INTO user_assembly_parts (wallet, part_code, qty) VALUES ($1, $2, $3)
         ON CONFLICT (wallet, part_code) DO UPDATE SET qty = user_assembly_parts.qty + $3, updated_at = NOW()`,
        [w, pc, tally[pc]]
      );
    }
    if (shardGain > 0) {
      await client.query(
        `INSERT INTO user_assembly_shards (wallet, shards) VALUES ($1, $2)
         ON CONFLICT (wallet) DO UPDATE SET shards = user_assembly_shards.shards + $2, updated_at = NOW()`,
        [w, shardGain]
      );
    }
    await client.query(
      `INSERT INTO user_assembly_gacha (wallet, unit_code, pulls_since_new, total_pulls) VALUES ($1, '__box__', $2, $3)
       ON CONFLICT (wallet, unit_code) DO UPDATE SET pulls_since_new = $2, total_pulls = user_assembly_gacha.total_pulls + $3, updated_at = NOW()`,
      [w, pulls, n]
    );
    await client.query('COMMIT');
    try {
      const { logGPActivity } = require('../db');
      if (total > 0) logGPActivity(w, -total, 'assembly_box', `퍼펙트 가챠 박스 x${n}`).catch(() => {});
    } catch (_) {}

    // 결과에 유닛/파츠 표시명 부착
    const { rows: meta } = await pool.query(
      `SELECT ap.part_code, ap.name_ko AS part_ko, ap.name_en AS part_en, ap.icon_emoji, au.unit_code, au.name_ko AS unit_ko, au.name_en AS unit_en
       FROM assembly_parts ap JOIN assembly_units au ON au.unit_code = ap.unit_code`
    );
    const metaMap = {};
    meta.forEach(m => { metaMap[m.part_code] = m; });
    const enriched = results.map(r => Object.assign({}, r, metaMap[r.part_code] || {}));
    return { success: true, count: n, price_gp: info.price, total_gp: total, results: enriched, shards_gained: shardGain, pulls_since_new: pulls, hard_pity: info.hardPity };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ASSEMBLY] pullBox error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally { client.release(); }
}

async function boxState(wallet) {
  const w = (wallet || '').toLowerCase().trim();
  if (!w) return { error: 'INVALID_WALLET' };
  const info = await getBoxInfo();
  const { rows: pity } = await pool.query(`SELECT pulls_since_new FROM user_assembly_gacha WHERE wallet = $1 AND unit_code = '__box__'`, [w]);
  const { rows: poolCnt } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM assembly_parts ap JOIN assembly_units au ON au.unit_code = ap.unit_code AND au.active = true WHERE ap.is_active = true`
  );
  const pulls = parseInt(pity[0]?.pulls_since_new, 10) || 0;
  return { enabled: info.enabled, price_gp: info.price, hard_pity: info.hardPity, pity_remaining: Math.max(0, info.hardPity - pulls), pool_size: poolCnt[0]?.c || 0 };
}

module.exports = { listUnits, getState, pull, assemble, disassemble, exchangeShards, grantParts, getUnit, pullBox, boxState };
