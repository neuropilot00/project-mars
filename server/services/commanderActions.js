// server/services/commanderActions.js
// ═══════════════════════════════════════════════════════════════
// Commander Actions — 함대전 선-선언 전술 액션
//
// 배틀은 battleScheduler 가 simulateBattle() 로 한번에 전체를 돌림.
// 따라서 액션은 "preparing" 또는 "pending" 단계에서 미리 선언.
// battleEngine 이 loadBattleData 시 함께 읽어와 effect 를 반영.
//
// 액션 4종:
//   - focus_fire : targetFleetId — 해당 적 함대에 집중 공격 (+보너스 데미지)
//   - emp        : startTick — 해당 tick 부터 N tick 동안 적 발사주기 ×M
//   - wedge      : (params 없음) — atk tactic 을 wedge 로 강제, speed/atk↑ def↓
//   - reinforce  : shipTypeCode, count — 시작 시 본인 함대에 해당 함선 N척 추가
// ═══════════════════════════════════════════════════════════════

const { pool, getSetting } = require('../db');

const VALID_ACTIONS = new Set(['focus_fire','emp','wedge','reinforce']);

async function listActions(battleId) {
  const { rows } = await pool.query(
    `SELECT id, battle_id, wallet_address, side, action_type, params,
            applied_at_tick, gp_cost, created_at
     FROM commander_actions WHERE battle_id = $1 ORDER BY created_at ASC`,
    [battleId]
  );
  return rows;
}

async function declareAction(battleId, walletAddress, actionType, params = {}) {
  if (!VALID_ACTIONS.has(actionType)) {
    const err = new Error('INVALID_ACTION_TYPE');
    err.meta = { actionType, valid: [...VALID_ACTIONS] };
    throw err;
  }

  const enabled = await getSetting('commander_actions_enabled', 'true');
  if (String(enabled) !== 'true') throw new Error('COMMANDER_ACTIONS_DISABLED');

  const gpCost = parseInt(await getSetting('commander_action_gp_cost', '50')) || 0;
  const maxPerPlayer = parseInt(await getSetting('commander_action_max_per_player', '2')) || 2;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) battle 상태 체크 (preparing|pending 만 허용)
    const { rows: bRows } = await client.query(
      `SELECT id, status FROM fleet_battles WHERE id = $1 FOR UPDATE`,
      [battleId]
    );
    if (!bRows[0]) throw new Error('BATTLE_NOT_FOUND');
    const battle = bRows[0];
    if (!['preparing','pending'].includes(battle.status)) {
      const err = new Error('BATTLE_NOT_ACCEPTING_ACTIONS');
      err.meta = { status: battle.status };
      throw err;
    }

    // 2) 참가자 검증 — wallet 이 battle 참가자인지 + side 획득
    const { rows: partRows } = await client.query(
      `SELECT side FROM fleet_battle_participants
       WHERE battle_id = $1 AND fleet_id IN (
         SELECT id FROM fleets WHERE owner_wallet = $2
       )
       LIMIT 1`,
      [battleId, walletAddress]
    );
    if (!partRows[0]) throw new Error('NOT_A_PARTICIPANT');
    const side = partRows[0].side;

    // 3) 쿼터 체크
    const { rows: cntRows } = await client.query(
      `SELECT COUNT(*)::int AS c FROM commander_actions
       WHERE battle_id = $1 AND wallet_address = $2`,
      [battleId, walletAddress]
    );
    if ((cntRows[0]?.c || 0) >= maxPerPlayer) {
      const err = new Error('ACTION_QUOTA_EXCEEDED');
      err.meta = { max: maxPerPlayer };
      throw err;
    }

    // 4) 중복 action_type 방지 (UNIQUE INDEX 가 걸러주지만 명시적으로 체크)
    const { rows: dupRows } = await client.query(
      `SELECT id FROM commander_actions
       WHERE battle_id = $1 AND wallet_address = $2 AND action_type = $3`,
      [battleId, walletAddress, actionType]
    );
    if (dupRows[0]) throw new Error('ACTION_ALREADY_DECLARED');

    // 5) 액션별 파라미터 검증
    const cleanParams = {};
    let appliedAtTick = 0;
    if (actionType === 'focus_fire') {
      const tfid = parseInt(params.targetFleetId);
      if (!tfid || tfid <= 0) throw new Error('TARGET_FLEET_REQUIRED');
      // 상대 쪽 함대인지 확인
      const { rows: tgt } = await client.query(
        `SELECT p.side FROM fleet_battle_participants p
         WHERE p.battle_id = $1 AND p.fleet_id = $2`,
        [battleId, tfid]
      );
      if (!tgt[0]) throw new Error('TARGET_FLEET_NOT_IN_BATTLE');
      if (tgt[0].side === side) throw new Error('TARGET_FLEET_ALLY');
      cleanParams.targetFleetId = tfid;
    } else if (actionType === 'emp') {
      const defaultStart = parseInt(await getSetting('emp_default_start_tick', '1200')) || 1200;
      appliedAtTick = parseInt(params.startTick);
      if (!Number.isFinite(appliedAtTick) || appliedAtTick < 0) appliedAtTick = defaultStart;
      if (appliedAtTick > 8000) appliedAtTick = 8000;
    } else if (actionType === 'wedge') {
      // no params
    } else if (actionType === 'reinforce') {
      const code = String(params.shipTypeCode || '').trim();
      const count = parseInt(params.count);
      if (!code) throw new Error('SHIP_TYPE_REQUIRED');
      const reinforceMax = parseInt(await getSetting('commander_action_reinforce_max_count', '20')) || 20;
      if (!count || count < 1 || count > reinforceMax) {
        const err = new Error('INVALID_REINFORCE_COUNT');
        err.meta = { min: 1, max: reinforceMax };
        throw err;
      }
      // 함선 타입 존재 확인
      const { rows: stRows } = await client.query(
        `SELECT code, faction_code FROM ship_types WHERE code = $1 AND is_active = true`,
        [code]
      );
      if (!stRows[0]) throw new Error('SHIP_TYPE_NOT_FOUND');
      cleanParams.shipTypeCode = code;
      cleanParams.count = count;
    }

    // 6) GP 차감
    if (gpCost > 0) {
      const { rows: uRows } = await client.query(
        `UPDATE users SET gp_balance = gp_balance - $1
         WHERE wallet_address = $2 AND gp_balance >= $1
         RETURNING gp_balance`,
        [gpCost, walletAddress]
      );
      if (!uRows[0]) throw new Error('INSUFFICIENT_GP');
    }

    // 7) INSERT
    const { rows: aRows } = await client.query(
      `INSERT INTO commander_actions
        (battle_id, wallet_address, side, action_type, params, applied_at_tick, gp_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [battleId, walletAddress, side, actionType, JSON.stringify(cleanParams), appliedAtTick, gpCost]
    );

    await client.query('COMMIT');

    // fire-and-forget 로그 & 시즌 점수
    try {
      const { logGPActivity } = require('../db');
      logGPActivity(walletAddress, -gpCost, 'commander_action', `${actionType} on battle #${battleId}`).catch(() => {});
    } catch (_) {}
    try {
      const seasonSvc = require('./season');
      seasonSvc.addSeasonScore(walletAddress, 'fleet_action', 1).catch(() => {});
      if (gpCost > 0) seasonSvc.addSeasonScore(walletAddress, 'gp_spend', gpCost).catch(() => {});
    } catch (_) {}

    return {
      id: aRows[0].id,
      battle_id: battleId,
      side,
      action_type: actionType,
      params: cleanParams,
      applied_at_tick: appliedAtTick,
      gp_cost: gpCost,
      created_at: aRows[0].created_at,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

/**
 * battleEngine 이 호출: 배틀 시작 시 action 목록을 적용하기 쉬운 형태로 반환
 * @returns {Object} { focusFireByWallet, empSchedule, wedgeSides, reinforcements }
 */
async function loadForBattle(battleId) {
  const actions = await listActions(battleId);
  const result = {
    focusFireByWallet: {},   // walletAddress -> targetFleetId
    empSchedule: [],         // [{ tick, durationTicks, fireIntervalMult, targetSide }]
    wedgeSides: new Set(),   // 'atk' or 'def'
    reinforcements: [],      // [{ wallet, shipTypeCode, count, side }]
  };

  const empDuration = parseInt(await getSetting('emp_duration_ticks', '30')) || 30;
  const empMult = parseFloat(await getSetting('emp_fire_interval_mult', '5.0')) || 5.0;

  for (const a of actions) {
    const p = a.params || {};
    if (a.action_type === 'focus_fire' && p.targetFleetId) {
      result.focusFireByWallet[a.wallet_address] = p.targetFleetId;
    } else if (a.action_type === 'emp') {
      result.empSchedule.push({
        tick: a.applied_at_tick,
        durationTicks: empDuration,
        fireIntervalMult: empMult,
        targetSide: a.side === 'atk' ? 'def' : 'atk',
      });
    } else if (a.action_type === 'wedge') {
      result.wedgeSides.add(a.side);
    } else if (a.action_type === 'reinforce' && p.shipTypeCode && p.count) {
      result.reinforcements.push({
        wallet: a.wallet_address,
        shipTypeCode: p.shipTypeCode,
        count: parseInt(p.count) || 0,
        side: a.side,
      });
    }
  }
  return result;
}

module.exports = {
  declareAction,
  listActions,
  loadForBattle,
};
