// server/services/worldEvents.js
// ═══════════════════════════════════════════════════════════════════════
// World Events — Void Raider 외계함선 NPC 이벤트
//
// 핵심 흐름:
//   1) spawnVoidRaider()      — 어드민/스케줄러가 호출. NPC 함대 생성 + 이벤트 시작
//   2) listActiveEvents()     — 활성 이벤트 조회 (UI, 어드민)
//   3) getEventDetail(id)     — 단일 이벤트 상세 (참여자 랭킹 포함)
//   4) engageEvent(...)       — 유저가 자기 함대로 NPC 함대에 교전 신청
//                                → fleet_battles 생성 후 battleEngine.simulateBattle()
//                                → 결과를 world_events.hp_current에 반영
//   5) settleExpiredEvents()  — 만료된 이벤트를 결산 (스케줄러)
//                                → HP 0이면 'defeated' (보상 분배)
//                                → 시간 종료면 'expired' (디버프 부여)
//
// NPC 시드 wallet: 0xnpc0000000000000000000000000000000000000
// ═══════════════════════════════════════════════════════════════════════

const { pool, getSetting } = require('../db');

const NPC_WALLET = '0xnpc0000000000000000000000000000000000000';

let battleEngine;
try { battleEngine = require('./battleEngine'); } catch (_) { battleEngine = null; }

// ── 유틸 ───────────────────────────────────────────────────────────
function generateEventCode(prefix) {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${ymd}-${rand}`;
}

async function getSetN(key, fallback) {
  const v = await getSetting(key, fallback);
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : parseFloat(fallback);
}

async function getSetS(key, fallback) {
  const v = await getSetting(key, fallback);
  // settings.value가 JSONB이므로 문자열일 경우 그대로, 숫자는 변환
  if (typeof v === 'string') return v.replace(/^"|"$/g, '');
  return String(v ?? fallback);
}

async function getSetB(key, fallback) {
  const v = await getSetting(key, fallback);
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '"true"';
  return Boolean(v);
}

// ═══════════════════════════════════════════════════════════════════
// 1) 스폰 — Void Raider
// ═══════════════════════════════════════════════════════════════════
/**
 * Void Raider NPC 함대를 생성하고 이벤트 시작.
 * @param {Object} opts
 *   - sectorId (옵션): 지정 안 하면 settings에 따라 랜덤
 *   - createdBy (옵션): 'system' | 어드민 wallet
 *   - shipTypeCode (옵션): 함선 타입 (기본 settings에서)
 *   - shipCount (옵션): 함선 수
 *   - durationHours (옵션): 지속 시간
 * @returns 생성된 world_events row + fleet info
 */
async function spawnVoidRaider(opts = {}) {
  const enabled = await getSetB('void_raider_enabled', false);
  if (!enabled) throw new Error('VOID_RAIDER_DISABLED');

  const maxConcurrent = await getSetN('void_raider_max_concurrent', 1);
  const { rows: activeRows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM world_events
      WHERE event_type = 'void_raider' AND status IN ('active','engaged')`
  );
  if (activeRows[0].n >= maxConcurrent) {
    const err = new Error('MAX_CONCURRENT_REACHED');
    err.meta = { active: activeRows[0].n, max: maxConcurrent };
    throw err;
  }

  const shipTypeCode = opts.shipTypeCode || await getSetS('void_raider_ship_type', 'cv_titan');
  const shipCount    = parseInt(opts.shipCount) || await getSetN('void_raider_ship_count', 15);
  const duration     = parseInt(opts.durationHours) || await getSetN('void_raider_duration_hours', 48);
  const targetTier   = await getSetS('void_raider_target_tier', 'frontier');
  const createdBy    = opts.createdBy || 'system';

  // 1) 타겟 섹터 선택
  let sectorId = opts.sectorId;
  if (!sectorId) {
    const { rows: secRows } = await pool.query(
      `SELECT id FROM sectors WHERE tier = $1 ORDER BY random() LIMIT 1`,
      [targetTier]
    );
    if (!secRows.length) throw new Error('NO_TARGET_SECTOR');
    sectorId = secRows[0].id;
  }

  // 2) 함선 타입 검증 + base 스탯 로드
  const { rows: stRows } = await pool.query(
    `SELECT code, name_ko, base_hp, base_atk, base_def, faction_code, size_class
       FROM ship_types WHERE code = $1 AND is_active = true`,
    [shipTypeCode]
  );
  if (!stRows.length) throw new Error('SHIP_TYPE_NOT_FOUND');
  const st = stRows[0];

  const totalHp = st.base_hp * shipCount;

  // 3) 트랜잭션 — NPC fleet + ships + world_event 생성
  const client = await pool.connect();
  let event;
  try {
    await client.query('BEGIN');

    // NPC fleet 생성
    const { rows: fleetRows } = await client.query(
      `INSERT INTO fleets (owner_wallet, name, sector_id, formation, movement, is_npc, created_at)
       VALUES ($1, $2, $3, 'sphere', 'advance', true, NOW())
       RETURNING id, name`,
      [NPC_WALLET, `Void Raider · ${st.name_ko}`, sectorId]
    );
    const fleet = fleetRows[0];

    // NPC ships 생성 (개별 행)
    const insertVals = [];
    const insertPlaceholders = [];
    for (let i = 0; i < shipCount; i++) {
      insertPlaceholders.push(`($${insertVals.length+1}, $${insertVals.length+2}, $${insertVals.length+3}, $${insertVals.length+4}, NOW())`);
      insertVals.push(fleet.id, shipTypeCode, st.base_hp, st.base_hp);
    }
    await client.query(
      `INSERT INTO ships (fleet_id, ship_type_code, current_hp, max_hp, created_at)
       VALUES ${insertPlaceholders.join(', ')}`,
      insertVals
    );

    // world_events 생성
    const code = generateEventCode('VR');
    const { rows: evRows } = await client.query(
      `INSERT INTO world_events
        (event_type, event_code, sector_id, fleet_id, hp_max, hp_current, ends_at, status, meta, created_by)
       VALUES ('void_raider', $1, $2, $3, $4, $4,
               NOW() + ($5::int || ' hours')::interval, 'active',
               $6::jsonb, $7)
       RETURNING *`,
      [code, sectorId, fleet.id, totalHp, duration,
        JSON.stringify({ ship_type_code: shipTypeCode, ship_count: shipCount, ship_name_ko: st.name_ko }),
        createdBy]
    );
    event = evRows[0];

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[worldEvents] spawnVoidRaider error:', err);
    throw err;
  } finally {
    client.release();
  }

  console.log(`[worldEvents] Spawned Void Raider event ${event.event_code} in sector ${sectorId} (${shipCount}× ${shipTypeCode}, ${duration}h)`);
  return event;
}

// ═══════════════════════════════════════════════════════════════════
// 2) 활성 이벤트 목록
// ═══════════════════════════════════════════════════════════════════
async function listActiveEvents() {
  const { rows } = await pool.query(`SELECT * FROM v_active_world_events ORDER BY ends_at ASC`);
  return rows;
}

// ═══════════════════════════════════════════════════════════════════
// 3) 이벤트 상세 + 참여자 랭킹
// ═══════════════════════════════════════════════════════════════════
async function getEventDetail(eventId) {
  const { rows: evRows } = await pool.query(
    `SELECT we.*, s.name AS sector_name, s.tier AS sector_tier,
            ROUND((we.hp_current::numeric / NULLIF(we.hp_max, 0) * 100), 1) AS hp_pct
       FROM world_events we
       LEFT JOIN sectors s ON s.id = we.sector_id
      WHERE we.id = $1`,
    [eventId]
  );
  if (!evRows.length) return null;
  const event = evRows[0];

  const { rows: participants } = await pool.query(
    `SELECT wep.wallet, COALESCE(u.nickname, '') AS nickname,
            wep.damage_dealt, wep.ships_lost, wep.battles_count,
            wep.joined_at, wep.last_battle_at
       FROM world_event_participants wep
       LEFT JOIN users u ON u.wallet_address = wep.wallet
      WHERE wep.event_id = $1
      ORDER BY wep.damage_dealt DESC
      LIMIT 50`,
    [eventId]
  );

  return { ...event, participants };
}

// ═══════════════════════════════════════════════════════════════════
// 4) 교전 — 유저 함대가 NPC 함대에 도전
// ═══════════════════════════════════════════════════════════════════
/**
 * @returns { battleId, eventId, hp_remaining, hp_pct, status }
 */
async function engageEvent(eventId, attackerWallet, attackerFleetId) {
  if (!battleEngine) throw new Error('BATTLE_ENGINE_NOT_AVAILABLE');

  const minShips = await getSetN('void_raider_engage_min_ships', 5);
  const cooldownMin = await getSetN('void_raider_engage_cooldown_min', 30);

  // 1) 이벤트 + NPC fleet 조회
  const { rows: evRows } = await pool.query(
    `SELECT * FROM world_events WHERE id = $1 FOR UPDATE`,
    [eventId]
  );
  if (!evRows.length) throw new Error('EVENT_NOT_FOUND');
  const event = evRows[0];
  if (!['active','engaged'].includes(event.status)) throw new Error('EVENT_NOT_ENGAGEABLE');
  if (new Date(event.ends_at) <= new Date()) throw new Error('EVENT_EXPIRED');
  if (!event.fleet_id) throw new Error('EVENT_HAS_NO_FLEET');

  // 2) 공격자 함대 검증
  const { rows: atkFleetRows } = await pool.query(
    `SELECT f.id, f.owner_wallet, f.is_in_battle, f.is_npc,
            (SELECT COUNT(*) FROM ships WHERE fleet_id = f.id AND current_hp > 0) AS alive_ships
       FROM fleets f WHERE f.id = $1`,
    [attackerFleetId]
  );
  if (!atkFleetRows.length) throw new Error('FLEET_NOT_FOUND');
  const atkFleet = atkFleetRows[0];
  if (atkFleet.owner_wallet !== attackerWallet) throw new Error('NOT_FLEET_OWNER');
  if (atkFleet.is_npc) throw new Error('NPC_CANNOT_ENGAGE');
  if (atkFleet.is_in_battle) throw new Error('FLEET_BUSY');
  if (parseInt(atkFleet.alive_ships) < minShips) {
    const err = new Error('INSUFFICIENT_SHIPS');
    err.meta = { required: minShips, have: parseInt(atkFleet.alive_ships) };
    throw err;
  }

  // 3) 쿨다운 체크
  const { rows: cdRows } = await pool.query(
    `SELECT last_battle_at FROM world_event_participants
      WHERE event_id = $1 AND wallet = $2`,
    [eventId, attackerWallet]
  );
  if (cdRows.length && cdRows[0].last_battle_at) {
    const since = (Date.now() - new Date(cdRows[0].last_battle_at).getTime()) / 60000;
    if (since < cooldownMin) {
      const err = new Error('ENGAGE_COOLDOWN');
      err.meta = { remaining_minutes: Math.ceil(cooldownMin - since) };
      throw err;
    }
  }

  // 4) fleet_battles 생성 (battle_type='world_event')
  const client = await pool.connect();
  let battleId;
  try {
    await client.query('BEGIN');

    const { rows: bRows } = await client.query(
      `INSERT INTO fleet_battles
         (battle_type, sector_id, status, phase, prepare_started_at, battle_started_at, atk_ships_total, def_ships_total)
       VALUES ('world_event', $1, 'simulating', 'live', NOW(), NOW(), 0, 0)
       RETURNING id`,
      [event.sector_id]
    );
    battleId = bRows[0].id;

    // 참가자 등록 (atk = 유저, def = NPC)
    await client.query(
      `INSERT INTO fleet_battle_participants (battle_id, fleet_id, wallet_address, side, joined_at)
       VALUES ($1, $2, $3, 'atk', NOW()), ($1, $4, $5, 'def', NOW())`,
      [battleId, attackerFleetId, attackerWallet, event.fleet_id, NPC_WALLET]
    );

    // 함대 상태 업데이트 — atk만 잠금 (NPC는 여러 교전 동시 가능하게 잠금 안함)
    await client.query(
      `UPDATE fleets SET is_in_battle = true, current_battle_id = $2 WHERE id = $1`,
      [attackerFleetId, battleId]
    );

    // event status → engaged
    await client.query(
      `UPDATE world_events SET status = 'engaged' WHERE id = $1 AND status = 'active'`,
      [eventId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    throw err;
  }
  client.release();

  // 5) 시뮬레이션 (battleEngine 호출)
  let result;
  try {
    result = await battleEngine.simulateBattle(battleId);
  } catch (err) {
    console.error('[worldEvents] simulateBattle error:', err);
    // fleet 잠금 해제
    await pool.query(`UPDATE fleets SET is_in_battle = false, current_battle_id = NULL WHERE id = $1`, [attackerFleetId]);
    await pool.query(`UPDATE fleet_battles SET status = 'failed' WHERE id = $1`, [battleId]);
    throw err;
  }

  // 6) 데미지 계산 — NPC 함대(def)가 잃은 HP가 곧 dealt 데미지
  const { rows: defStatRows } = await pool.query(
    `SELECT ships_at_start, hp_at_start, ships_alive, ships_lost, damage_dealt
       FROM fleet_battle_participants WHERE battle_id = $1 AND side = 'def'`,
    [battleId]
  );
  const defStat = defStatRows[0] || {};
  // damage_dealt가 atk 기준으로 기록됐다면 atk 행에서, 아니면 def의 hp 손실에서 추론
  const { rows: atkStatRows } = await pool.query(
    `SELECT damage_dealt, ships_lost FROM fleet_battle_participants WHERE battle_id = $1 AND side = 'atk'`,
    [battleId]
  );
  const atkDamage = parseInt(atkStatRows[0]?.damage_dealt || 0);
  const atkShipsLost = parseInt(atkStatRows[0]?.ships_lost || 0);

  // 7) world_events.hp_current 차감 + 참여자 누적
  const finalClient = await pool.connect();
  let finalState;
  try {
    await finalClient.query('BEGIN');

    const { rows: updRows } = await finalClient.query(
      `UPDATE world_events
          SET hp_current = GREATEST(0, hp_current - $2::bigint)
        WHERE id = $1
        RETURNING hp_current, hp_max, status`,
      [eventId, atkDamage]
    );
    finalState = updRows[0];

    // 참여자 upsert
    await finalClient.query(
      `INSERT INTO world_event_participants
         (event_id, wallet, damage_dealt, ships_lost, battles_count, joined_at, last_battle_at)
       VALUES ($1, $2, $3, $4, 1, NOW(), NOW())
       ON CONFLICT (event_id, wallet) DO UPDATE SET
         damage_dealt = world_event_participants.damage_dealt + EXCLUDED.damage_dealt,
         ships_lost   = world_event_participants.ships_lost + EXCLUDED.ships_lost,
         battles_count = world_event_participants.battles_count + 1,
         last_battle_at = NOW()`,
      [eventId, attackerWallet, atkDamage, atkShipsLost]
    );

    // HP 0 도달 시 즉시 결산
    if (finalState.hp_current === 0 || parseInt(finalState.hp_current) === 0) {
      await finalClient.query(
        `UPDATE world_events SET status = 'defeated', resolution = 'defeated', resolved_at = NOW() WHERE id = $1 AND status NOT IN ('defeated','expired')`,
        [eventId]
      );
    }

    // 공격자 함대 잠금 해제
    await finalClient.query(
      `UPDATE fleets SET is_in_battle = false, current_battle_id = NULL WHERE id = $1`,
      [attackerFleetId]
    );

    await finalClient.query('COMMIT');
  } catch (err) {
    await finalClient.query('ROLLBACK');
    console.error('[worldEvents] post-battle bookkeeping error:', err);
    throw err;
  } finally {
    finalClient.release();
  }

  // 8) HP 0 도달 → 보상 분배
  if (finalState.hp_current === 0 || parseInt(finalState.hp_current) === 0) {
    try { await distributeRewards(eventId, 'defeated'); } catch (e) { console.error('[worldEvents] reward error:', e); }
  }

  return {
    battleId,
    eventId,
    damage_dealt: atkDamage,
    ships_lost: atkShipsLost,
    hp_remaining: parseInt(finalState.hp_current),
    hp_pct: Math.round((parseInt(finalState.hp_current) / parseInt(finalState.hp_max)) * 1000) / 10,
    status: parseInt(finalState.hp_current) === 0 ? 'defeated' : 'engaged',
    winner_side: result?.winner_side || null,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 5) 보상 분배 (격퇴 성공 시)
// ═══════════════════════════════════════════════════════════════════
async function distributeRewards(eventId, resolution) {
  if (resolution !== 'defeated') return;

  const ironDust    = await getSetN('void_raider_reward_iron_dust', 100);
  const iceCrystal  = await getSetN('void_raider_reward_ice_crystal', 10);
  const xp          = await getSetN('void_raider_reward_xp', 500);
  const gp          = await getSetN('void_raider_reward_gp', 200);
  const topMetal    = await getSetN('void_raider_reward_top_metal', 5);
  const topTitle    = await getSetS('void_raider_reward_top_title', 'Void Hunter');

  const { rows: parts } = await pool.query(
    `SELECT wallet, damage_dealt FROM world_event_participants
      WHERE event_id = $1 AND damage_dealt > 0
      ORDER BY damage_dealt DESC`,
    [eventId]
  );
  if (!parts.length) return;

  const topWallet = parts[0].wallet;

  for (const p of parts) {
    const isTop = (p.wallet === topWallet);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // GP + XP 보상
      await client.query(
        `UPDATE users SET gp_balance = gp_balance + $2, xp = COALESCE(xp,0) + $3 WHERE wallet_address = $1`,
        [p.wallet, gp, xp]
      );

      // 광물 보상 — user_resource_inventory(wallet_address, resource_id, quantity) 사용
      // resource_id는 resources.code → id 매핑
      try {
        const grantMineral = async (code, qty) => {
          await client.query(
            `INSERT INTO user_resource_inventory (wallet_address, resource_id, quantity)
             VALUES ($1, (SELECT id FROM resources WHERE code = $2), $3)
             ON CONFLICT (wallet_address, resource_id)
             DO UPDATE SET quantity = user_resource_inventory.quantity + EXCLUDED.quantity`,
            [p.wallet, code, qty]
          );
        };
        await grantMineral('iron_dust',   ironDust);
        await grantMineral('ice_crystal', iceCrystal);
        if (isTop) await grantMineral('ancient_metal', topMetal);
      } catch (e) {
        // resources 테이블에 해당 code가 없을 수 있음 — 로그만
        console.warn('[worldEvents] minerals reward skipped:', e.message);
      }

      // 칭호 (있으면) — user_titles 테이블 시도
      if (isTop) {
        try {
          await client.query(
            `INSERT INTO user_titles (wallet, title_code, awarded_at, source)
             VALUES ($1, $2, NOW(), 'world_event')
             ON CONFLICT DO NOTHING`,
            [p.wallet, topTitle]
          );
        } catch (e) { /* user_titles 테이블 없을 수 있음 */ }
      }

      // 보상 표시
      await client.query(
        `UPDATE world_event_participants
            SET rewarded = true,
                reward_meta = $3::jsonb
          WHERE event_id = $1 AND wallet = $2`,
        [eventId, p.wallet, JSON.stringify({
          gp, xp, iron_dust: ironDust, ice_crystal: iceCrystal,
          ...(isTop ? { ancient_metal: topMetal, title: topTitle } : {})
        })]
      );

      await client.query('COMMIT');

      // GP 활동 로그 (fire-and-forget)
      try {
        const { logGPActivity } = require('../db');
        logGPActivity(p.wallet, gp, 'world_event_reward', `Void Raider 격퇴 보상 (event ${eventId})`).catch(()=>{});
      } catch (_) {}

    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[worldEvents] reward error for ${p.wallet}:`, err.message);
    } finally {
      client.release();
    }
  }

  console.log(`[worldEvents] Distributed rewards to ${parts.length} participants for event ${eventId} (top: ${topWallet})`);
}

// ═══════════════════════════════════════════════════════════════════
// 6) 만료 이벤트 결산 (스케줄러)
// ═══════════════════════════════════════════════════════════════════
async function settleExpiredEvents() {
  const { rows: expired } = await pool.query(
    `SELECT id, sector_id, hp_current, hp_max, status
       FROM world_events
      WHERE status IN ('active','engaged') AND ends_at <= NOW()
      ORDER BY ends_at ASC LIMIT 10`
  );

  let settled = 0;
  for (const ev of expired) {
    try {
      // HP 0 도달했는데 status가 안 바뀐 경우 → defeated
      if (parseInt(ev.hp_current) === 0) {
        await pool.query(
          `UPDATE world_events SET status='defeated', resolution='defeated', resolved_at=NOW() WHERE id=$1`,
          [ev.id]
        );
        await distributeRewards(ev.id, 'defeated');
      } else {
        // 시간 만료 → escaped (HP 일부 남음) — 디버프 부여
        await pool.query(
          `UPDATE world_events SET status='escaped', resolution='escaped', resolved_at=NOW() WHERE id=$1`,
          [ev.id]
        );
        await applyFailureDebuff(ev);
      }

      // NPC fleet 정리 (제거)
      await pool.query(
        `DELETE FROM fleets WHERE id = (SELECT fleet_id FROM world_events WHERE id = $1) AND is_npc = true`,
        [ev.id]
      );

      settled++;
    } catch (err) {
      console.error(`[worldEvents] settle error event ${ev.id}:`, err.message);
    }
  }

  if (settled > 0) console.log(`[worldEvents] Settled ${settled} expired event(s)`);
  return { settled };
}

async function applyFailureDebuff(event) {
  const debuffPct = await getSetN('void_raider_fail_mining_debuff_pct', 30);
  const debuffDays = await getSetN('void_raider_fail_debuff_days', 3);
  if (!event.sector_id || debuffPct <= 0) return;

  await pool.query(
    `INSERT INTO sector_debuffs (sector_id, debuff_type, magnitude_pct, source_event_id, ends_at)
     VALUES ($1, 'mining_penalty', $2, $3, NOW() + ($4 || ' days')::interval)`,
    [event.sector_id, -Math.abs(debuffPct), event.id, debuffDays]
  );
  console.log(`[worldEvents] Applied -${debuffPct}% mining debuff to sector ${event.sector_id} for ${debuffDays} days`);
}

// ═══════════════════════════════════════════════════════════════════
// 7) 자동 스폰 스케줄러 헬퍼
// ═══════════════════════════════════════════════════════════════════
async function maybeAutoSpawn() {
  const enabled = await getSetB('void_raider_enabled', false);
  const auto    = await getSetB('void_raider_auto_spawn', false);
  if (!enabled || !auto) return { spawned: false, reason: 'disabled' };

  const targetHour = await getSetN('void_raider_spawn_hour_utc', 19);
  const intervalDays = await getSetN('void_raider_spawn_interval_days', 3);

  const now = new Date();
  if (now.getUTCHours() !== Math.round(targetHour)) {
    return { spawned: false, reason: 'wrong_hour', target: targetHour, now: now.getUTCHours() };
  }

  // 마지막 스폰 시각 확인
  const { rows: lastRows } = await pool.query(
    `SELECT spawned_at FROM world_events
      WHERE event_type = 'void_raider' AND created_by = 'system'
      ORDER BY spawned_at DESC LIMIT 1`
  );
  if (lastRows.length) {
    const sinceDays = (now.getTime() - new Date(lastRows[0].spawned_at).getTime()) / (1000*60*60*24);
    if (sinceDays < intervalDays) {
      return { spawned: false, reason: 'too_soon', since_days: sinceDays.toFixed(2), interval: intervalDays };
    }
  }

  try {
    const ev = await spawnVoidRaider({ createdBy: 'system' });
    return { spawned: true, event_id: ev.id, event_code: ev.event_code };
  } catch (err) {
    if (err.message === 'MAX_CONCURRENT_REACHED') return { spawned: false, reason: 'max_concurrent' };
    throw err;
  }
}

module.exports = {
  spawnVoidRaider,
  listActiveEvents,
  getEventDetail,
  engageEvent,
  distributeRewards,
  settleExpiredEvents,
  maybeAutoSpawn,
  applyFailureDebuff,
  NPC_WALLET,
};
