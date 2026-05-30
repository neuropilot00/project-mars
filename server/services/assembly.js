// server/services/assembly.js
// ═══════════════════════════════════════════════════════════════
// 합체 슈퍼유닛(볼트론형) — P1 수집·합체 코어
// 기획서: docs/MECHA_ASSEMBLY_GACHA_PLAN_2026-05-30.md
//
// getState(wallet)              — 5파츠 보유/조각/합체 가능 여부
// assemble(wallet)              — 5파츠 전부 소모 + GP → 합체체 ships 인스턴스 생성
// disassemble(shipId, wallet)   — 합체체 해체 → 5파츠 환원
// exchangeShards(wallet, part)  — 조각으로 파츠 1개 확정 교환(소프트 천장)
// grantParts(wallet, part, qty) — 어드민/테스트 파츠 지급
// ═══════════════════════════════════════════════════════════════

const { pool, getSetting } = require('../db');

async function setting(key, fb) { return await getSetting(key, fb); }

// 함선을 넣을 함대 확보(없으면 생성) — shipCrate.getOrCreateFleet 과 동일 규칙
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

async function getState(wallet) {
  const w = (wallet || '').toLowerCase().trim();
  if (!w) return { error: 'INVALID_WALLET' };
  if (String(await setting('assembly_enabled', 'true')) === 'false') return { error: 'ASSEMBLY_DISABLED' };

  const unitCode = String(await setting('assembly_unit_code', 'pilgrim_voltaris')).replace(/"/g, '');
  const parts = await loadParts(unitCode);

  const { rows: owned } = await pool.query(
    `SELECT part_code, qty FROM user_assembly_parts WHERE wallet = $1`, [w]
  );
  const ownMap = {};
  owned.forEach(r => { ownMap[r.part_code] = parseInt(r.qty, 10) || 0; });

  const { rows: shardRows } = await pool.query(
    `SELECT shards FROM user_assembly_shards WHERE wallet = $1`, [w]
  );
  const shards = parseInt(shardRows[0]?.shards, 10) || 0;

  const { rows: unitInfo } = await pool.query(
    `SELECT name_en, name_ko, name_ja, name_zh, class_label, base_hp, base_atk, base_def, base_speed
     FROM ship_types WHERE code = $1`, [unitCode]
  );

  const partState = parts.map(p => ({
    part_code: p.part_code, slot: p.slot, icon: p.icon_emoji,
    name_en: p.name_en, name_ko: p.name_ko, name_ja: p.name_ja, name_zh: p.name_zh,
    owned: ownMap[p.part_code] || 0,
  }));
  const distinct = partState.filter(p => p.owned >= 1).length;
  const exchangeCost = parseInt(await setting('assembly_shard_exchange_cost', '40'), 10) || 40;

  // 보유 합체체 수
  const { rows: builtRows } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM ships WHERE LOWER(owner_wallet) = $1 AND ship_type_code = $2 AND is_alive = true`,
    [w, unitCode]
  );
  const builtCount = builtRows[0]?.c || 0;
  const maxPer = parseInt(await setting('assembly_max_per_player', '1'), 10) || 1;

  const { rows: pityRows } = await pool.query(
    `SELECT pulls_since_new, total_pulls FROM user_assembly_gacha WHERE wallet = $1`, [w]
  );
  const hardPity = parseInt(await setting('assembly_hard_pity_pulls', '30'), 10) || 30;

  return {
    unit_code: unitCode,
    unit: unitInfo[0] || null,
    parts: partState,
    distinct_owned: distinct,
    total_parts: parts.length,
    can_assemble: distinct >= parts.length && builtCount < maxPer,
    built_count: builtCount,
    max_per_player: maxPer,
    shards,
    shard_exchange_cost: exchangeCost,
    assemble_gp_cost: parseInt(await setting('assembly_assemble_gp_cost', '0'), 10) || 0,
    gacha_enabled: String(await setting('assembly_gacha_enabled', 'true')) !== 'false',
    gacha_price_gp: parseInt(await setting('assembly_gacha_price_gp', '500'), 10) || 0,
    pulls_since_new: parseInt(pityRows[0]?.pulls_since_new, 10) || 0,
    hard_pity: hardPity,
    pity_remaining: Math.max(0, hardPity - (parseInt(pityRows[0]?.pulls_since_new, 10) || 0)),
  };
}

async function assemble(wallet) {
  const w = (wallet || '').toLowerCase().trim();
  if (!w) return { error: 'INVALID_WALLET' };
  if (String(await setting('assembly_enabled', 'true')) === 'false') return { error: 'ASSEMBLY_DISABLED' };

  const unitCode = String(await setting('assembly_unit_code', 'pilgrim_voltaris')).replace(/"/g, '');
  const gpCost = parseInt(await setting('assembly_assemble_gp_cost', '0'), 10) || 0;
  const maxPer = parseInt(await setting('assembly_max_per_player', '1'), 10) || 1;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: partRows } = await client.query(
      `SELECT part_code FROM assembly_parts WHERE unit_code = $1 AND is_active = true ORDER BY slot ASC`, [unitCode]
    );
    if (!partRows.length) { await client.query('ROLLBACK'); return { error: 'NO_PARTS_DEFINED' }; }

    // 보유 합체체 상한
    const { rows: builtRows } = await client.query(
      `SELECT COUNT(*)::int AS c FROM ships WHERE LOWER(owner_wallet) = $1 AND ship_type_code = $2 AND is_alive = true`,
      [w, unitCode]
    );
    if ((builtRows[0]?.c || 0) >= maxPer) { await client.query('ROLLBACK'); return { error: 'MAX_ASSEMBLED_REACHED', max: maxPer }; }

    // 파츠 락 + 보유 검증 (각 1개 이상)
    const { rows: owned } = await client.query(
      `SELECT part_code, qty FROM user_assembly_parts WHERE wallet = $1 FOR UPDATE`, [w]
    );
    const ownMap = {};
    owned.forEach(r => { ownMap[r.part_code] = parseInt(r.qty, 10) || 0; });
    const missing = partRows.filter(p => (ownMap[p.part_code] || 0) < 1).map(p => p.part_code);
    if (missing.length) { await client.query('ROLLBACK'); return { error: 'MISSING_PARTS', missing }; }

    // GP 확인/차감
    if (gpCost > 0) {
      const { rows: u } = await client.query(
        `SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`, [w]
      );
      if (!u[0]) { await client.query('ROLLBACK'); return { error: 'USER_NOT_FOUND' }; }
      if (Number(u[0].gp_balance) < gpCost) { await client.query('ROLLBACK'); return { error: 'INSUFFICIENT_GP', required: gpCost, current: Number(u[0].gp_balance) }; }
      await client.query(`UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2)`, [gpCost, w]);
    }

    // 파츠 1개씩 소모
    for (const p of partRows) {
      await client.query(
        `UPDATE user_assembly_parts SET qty = qty - 1, updated_at = NOW() WHERE wallet = $1 AND part_code = $2`,
        [w, p.part_code]
      );
    }

    // 합체체 스탯
    const { rows: st } = await client.query(
      `SELECT base_hp, is_flagship_capable FROM ship_types WHERE code = $1`, [unitCode]
    );
    const baseHp = parseInt(st[0]?.base_hp, 10) || 1;

    // 함대 확보 + 기함 후보
    const fleetId = await getOrCreateFleet(client, w);
    const { rows: flagRows } = await client.query(
      `SELECT COUNT(*) AS c FROM ships WHERE fleet_id = $1 AND is_flagship = true AND is_alive = true`, [fleetId]
    );
    const isFlagship = parseInt(flagRows[0]?.c || 0, 10) === 0 && !!st[0]?.is_flagship_capable;

    const { rows: shipRows } = await client.query(
      `INSERT INTO ships (fleet_id, ship_type_code, owner_wallet, current_hp, max_hp, is_flagship, is_alive, built_at, built_by_wallet)
       VALUES ($1, $2, $3, $4, $4, $5, true, NOW(), $3) RETURNING id`,
      [fleetId, unitCode, w, baseHp, isFlagship]
    );
    const shipId = shipRows[0].id;

    await client.query(
      `INSERT INTO assembly_events (wallet, unit_code, action, ship_id, detail)
       VALUES ($1, $2, 'assemble', $3, $4)`,
      [w, unitCode, shipId, JSON.stringify({ gpCost, parts: partRows.map(p => p.part_code) })]
    );

    await client.query('COMMIT');

    try {
      const { logGPActivity } = require('../db');
      if (gpCost > 0) logGPActivity(w, -gpCost, 'assembly_assemble', '합체체 합체').catch(() => {});
    } catch (_) {}

    return { success: true, ship_id: String(shipId), unit_code: unitCode, is_flagship: isFlagship };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ASSEMBLY] assemble error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

async function disassemble(shipId, wallet) {
  const w = (wallet || '').toLowerCase().trim();
  if (!w) return { error: 'INVALID_WALLET' };
  if (String(await setting('assembly_disassemble_enabled', 'true')) === 'false') return { error: 'DISASSEMBLE_DISABLED' };
  const sid = String(shipId || '').trim();
  if (!sid) return { error: 'SHIP_ID_REQUIRED' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: shipRows } = await client.query(
      `SELECT id, ship_type_code, owner_wallet, is_alive, is_market_listed
       FROM ships WHERE id = $1 FOR UPDATE`, [sid]
    );
    const ship = shipRows[0];
    if (!ship) { await client.query('ROLLBACK'); return { error: 'SHIP_NOT_FOUND' }; }
    if (String(ship.owner_wallet).toLowerCase() !== w) { await client.query('ROLLBACK'); return { error: 'NOT_OWNER' }; }
    if (ship.is_market_listed) { await client.query('ROLLBACK'); return { error: 'SHIP_LISTED_FOR_SALE' }; }

    const { rows: typeRows } = await client.query(
      `SELECT size_class FROM ship_types WHERE code = $1`, [ship.ship_type_code]
    );
    if (typeRows[0]?.size_class !== 'assembled') { await client.query('ROLLBACK'); return { error: 'NOT_ASSEMBLED_UNIT' }; }

    // 전투 중 함대 방어
    const { rows: battle } = await client.query(
      `SELECT 1 FROM ships s JOIN fleets f ON s.fleet_id = f.id
       WHERE s.id = $1 AND f.is_in_battle = true LIMIT 1`, [sid]
    ).catch(() => ({ rows: [] }));
    if (battle && battle.length) { await client.query('ROLLBACK'); return { error: 'FLEET_IN_BATTLE' }; }

    // 파츠 환원
    const { rows: partRows } = await client.query(
      `SELECT part_code FROM assembly_parts WHERE unit_code = $1 AND is_active = true`, [ship.ship_type_code]
    );
    for (const p of partRows) {
      await client.query(
        `INSERT INTO user_assembly_parts (wallet, part_code, qty) VALUES ($1, $2, 1)
         ON CONFLICT (wallet, part_code) DO UPDATE SET qty = user_assembly_parts.qty + 1, updated_at = NOW()`,
        [w, p.part_code]
      );
    }

    // 합체체 인스턴스 제거
    await client.query(`DELETE FROM ships WHERE id = $1`, [sid]);

    await client.query(
      `INSERT INTO assembly_events (wallet, unit_code, action, ship_id, detail)
       VALUES ($1, $2, 'disassemble', $3, $4)`,
      [w, ship.ship_type_code, sid, JSON.stringify({ parts_returned: partRows.map(p => p.part_code) })]
    );

    await client.query('COMMIT');
    return { success: true, parts_returned: partRows.map(p => p.part_code) };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ASSEMBLY] disassemble error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

async function exchangeShards(wallet, partCode) {
  const w = (wallet || '').toLowerCase().trim();
  if (!w) return { error: 'INVALID_WALLET' };
  const cost = parseInt(await setting('assembly_shard_exchange_cost', '40'), 10) || 40;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: partRows } = await client.query(
      `SELECT part_code FROM assembly_parts WHERE part_code = $1 AND is_active = true`, [partCode]
    );
    if (!partRows[0]) { await client.query('ROLLBACK'); return { error: 'INVALID_PART' }; }

    const { rows: shardRows } = await client.query(
      `SELECT shards FROM user_assembly_shards WHERE wallet = $1 FOR UPDATE`, [w]
    );
    const shards = parseInt(shardRows[0]?.shards, 10) || 0;
    if (shards < cost) { await client.query('ROLLBACK'); return { error: 'INSUFFICIENT_SHARDS', required: cost, current: shards }; }

    await client.query(
      `UPDATE user_assembly_shards SET shards = shards - $1, updated_at = NOW() WHERE wallet = $2`, [cost, w]
    );
    await client.query(
      `INSERT INTO user_assembly_parts (wallet, part_code, qty) VALUES ($1, $2, 1)
       ON CONFLICT (wallet, part_code) DO UPDATE SET qty = user_assembly_parts.qty + 1, updated_at = NOW()`,
      [w, partCode]
    );
    await client.query(
      `INSERT INTO assembly_events (wallet, unit_code, action, detail)
       VALUES ($1, (SELECT unit_code FROM assembly_parts WHERE part_code = $2), 'exchange', $3)`,
      [w, partCode, JSON.stringify({ part_code: partCode, shards_spent: cost })]
    );
    await client.query('COMMIT');
    return { success: true, part_code: partCode, shards_left: shards - cost };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ASSEMBLY] exchangeShards error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ── P2 가챠: 박스가챠 + 하드천장 + 중복→조각 ──
// 컴플리트가챠 회피: 합체체가 아니라 "파츠"만 공급, 합체는 결정론적(P1).
async function pull(wallet, count) {
  const w = (wallet || '').toLowerCase().trim();
  if (!w) return { error: 'INVALID_WALLET' };
  if (String(await setting('assembly_enabled', 'true')) === 'false') return { error: 'ASSEMBLY_DISABLED' };
  if (String(await setting('assembly_gacha_enabled', 'true')) === 'false') return { error: 'GACHA_DISABLED' };

  const unitCode = String(await setting('assembly_unit_code', 'pilgrim_voltaris')).replace(/"/g, '');
  const price = parseInt(await setting('assembly_gacha_price_gp', '500'), 10) || 0;
  const hardPity = parseInt(await setting('assembly_hard_pity_pulls', '30'), 10) || 30;
  const dupYield = parseInt(await setting('assembly_dup_shard_yield', '15'), 10) || 15;
  const maxMulti = parseInt(await setting('assembly_gacha_max_multi', '10'), 10) || 10;
  const n = Math.max(1, Math.min(maxMulti, parseInt(count, 10) || 1));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: partRows } = await client.query(
      `SELECT part_code FROM assembly_parts WHERE unit_code = $1 AND is_active = true ORDER BY slot ASC`, [unitCode]
    );
    if (!partRows.length) { await client.query('ROLLBACK'); return { error: 'NO_PARTS_DEFINED' }; }
    const allParts = partRows.map(p => p.part_code);

    // GP 락/검증/차감
    const total = price * n;
    if (total > 0) {
      const { rows: u } = await client.query(
        `SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`, [w]
      );
      if (!u[0]) { await client.query('ROLLBACK'); return { error: 'USER_NOT_FOUND' }; }
      if (Number(u[0].gp_balance) < total) { await client.query('ROLLBACK'); return { error: 'INSUFFICIENT_GP', required: total, current: Number(u[0].gp_balance) }; }
      await client.query(`UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2)`, [total, w]);
    }

    // 보유 파츠 셋 락
    const { rows: owned } = await client.query(
      `SELECT part_code, qty FROM user_assembly_parts WHERE wallet = $1 FOR UPDATE`, [w]
    );
    const ownMap = {};
    owned.forEach(r => { ownMap[r.part_code] = parseInt(r.qty, 10) || 0; });

    // 천장 카운터 락
    const { rows: pityRows } = await client.query(
      `SELECT pulls_since_new FROM user_assembly_gacha WHERE wallet = $1 FOR UPDATE`, [w]
    );
    let pullsSinceNew = pityRows[0]?.pulls_since_new || 0;

    let shardGain = 0;
    const results = [];
    for (let i = 0; i < n; i++) {
      const missing = allParts.filter(pc => (ownMap[pc] || 0) < 1);
      const pityHit = hardPity > 0 && (pullsSinceNew + 1) >= hardPity && missing.length > 0;

      let picked;
      if (pityHit) {
        picked = missing[Math.floor(Math.random() * missing.length)]; // 천장: 미보유 중 확정
      } else {
        picked = allParts[Math.floor(Math.random() * allParts.length)]; // 균등 20%
      }

      const wasNew = (ownMap[picked] || 0) < 1;
      const wasDup = !wasNew;
      ownMap[picked] = (ownMap[picked] || 0) + 1;

      let gain = 0;
      if (wasDup) { gain = dupYield; shardGain += gain; }

      if (wasNew) pullsSinceNew = 0; else pullsSinceNew += 1;

      await client.query(
        `INSERT INTO assembly_gacha_pulls (wallet, part_code, was_pity, was_dup, shards_gain, price_gp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [w, picked, pityHit, wasDup, gain, price]
      );
      results.push({ part_code: picked, is_new: wasNew, is_dup: wasDup, is_pity: pityHit, shards_gain: gain });
    }

    // 보유 파츠 반영 (count 누적)
    const tally = {};
    results.forEach(r => { tally[r.part_code] = (tally[r.part_code] || 0) + 1; });
    for (const pc of Object.keys(tally)) {
      await client.query(
        `INSERT INTO user_assembly_parts (wallet, part_code, qty) VALUES ($1, $2, $3)
         ON CONFLICT (wallet, part_code) DO UPDATE SET qty = user_assembly_parts.qty + $3, updated_at = NOW()`,
        [w, pc, tally[pc]]
      );
    }
    // 조각 반영
    if (shardGain > 0) {
      await client.query(
        `INSERT INTO user_assembly_shards (wallet, shards) VALUES ($1, $2)
         ON CONFLICT (wallet) DO UPDATE SET shards = user_assembly_shards.shards + $2, updated_at = NOW()`,
        [w, shardGain]
      );
    }
    // 천장 카운터 반영
    await client.query(
      `INSERT INTO user_assembly_gacha (wallet, pulls_since_new, total_pulls) VALUES ($1, $2, $3)
       ON CONFLICT (wallet) DO UPDATE SET pulls_since_new = $2, total_pulls = user_assembly_gacha.total_pulls + $3, updated_at = NOW()`,
      [w, pullsSinceNew, n]
    );

    await client.query('COMMIT');

    try {
      const { logGPActivity } = require('../db');
      if (total > 0) logGPActivity(w, -total, 'assembly_gacha', `합체 파츠 가챠 x${n}`).catch(() => {});
    } catch (_) {}

    return {
      success: true, count: n, price_gp: price, total_gp: total,
      results, shards_gained: shardGain, pulls_since_new: pullsSinceNew, hard_pity: hardPity,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ASSEMBLY] pull error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// 어드민/테스트 파츠 지급 (검증용)
async function grantParts(wallet, partCode, qty) {
  const w = (wallet || '').toLowerCase().trim();
  const n = Math.max(1, parseInt(qty, 10) || 1);
  if (!w) return { error: 'INVALID_WALLET' };
  const { rows } = await pool.query(`SELECT part_code FROM assembly_parts WHERE part_code = $1`, [partCode]);
  if (!rows[0]) return { error: 'INVALID_PART' };
  await pool.query(
    `INSERT INTO user_assembly_parts (wallet, part_code, qty) VALUES ($1, $2, $3)
     ON CONFLICT (wallet, part_code) DO UPDATE SET qty = user_assembly_parts.qty + $3, updated_at = NOW()`,
    [w, partCode, n]
  );
  await pool.query(
    `INSERT INTO assembly_events (wallet, unit_code, action, detail)
     VALUES ($1, (SELECT unit_code FROM assembly_parts WHERE part_code = $2), 'grant', $3)`,
    [w, partCode, JSON.stringify({ part_code: partCode, qty: n })]
  ).catch(() => {});
  return { success: true, part_code: partCode, granted: n };
}

module.exports = { getState, assemble, disassemble, exchangeShards, grantParts, pull };
