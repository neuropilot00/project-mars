// server/services/battleEngine.js
// ═══════════════════════════════════════════════════════════════
// Battle Engine — v11 프로토타입 로직을 Node.js로 이식
// 
// 작동 원리:
//   1. simulateBattle() 호출 → 전투 전체를 한번에 시뮬레이션
//   2. tick마다 함대/함선 상태 갱신
//   3. 결과를 타임라인 JSON으로 저장
//   4. 클라이언트는 JSON 재생 (영화처럼)
//
// 주요 함수:
//   - loadBattleData()      : DB에서 참가 함대/함선 로드
//   - simulateBattle()      : 전투 시뮬레이션 1회 실행
//   - computeRewards()      : 보상 분배 계산
// ═══════════════════════════════════════════════════════════════

const { pool, getSetting } = require('../db');
const tacticsAI = require('./tacticsAI');
let commanderActions;
try { commanderActions = require('./commanderActions'); } catch (_) { commanderActions = null; }
let jobService;
try { jobService = require('./job'); } catch (_) { jobService = null; }

// ─── 상수 ───

const TICK_MS = 200;                    // 5 tick/sec
const MAX_TICKS = 54000;                // 3시간 한도 — 실질적으로 HP 소진 전에 끝남
const FIELD_W = 1000;
const FIELD_H = 440;
const HIJACK_PHASE1_SIZE_CLASSES = ['frigate', 'destroyer'];

// 시뮬레이션 최적화: 함선을 클러스터로 묶기
// 1000척 개별 처리는 무리. 같은 type의 함선 N척을 1개 단위로 처리.
const CLUSTER_SIZE = 5;  // 5척씩 묶어서 시뮬레이션 (렌더 시 분리)

// ─── Entry Point: 전투 시뮬레이션 ───

/**
 * 특정 battle을 시뮬레이션해서 타임라인 생성
 * @param {number} battleId
 * @returns {Object} { winner_side, timeline, events, stats }
 */
async function simulateBattle(battleId) {
  console.log(`[battleEngine] simulating battle ${battleId}...`);
  const startTime = Date.now();
  
  // 1. 데이터 로드
  const battleData = await loadBattleData(battleId);
  if (!battleData) throw new Error('BATTLE_NOT_FOUND');

  const state = initBattleState(battleData);

  // Commander focus-fire 데미지 보너스 로드 (초기 state.focusFireDmgBonus=0)
  try {
    state.focusFireDmgBonus = parseFloat(await getSetting('focus_fire_dmg_bonus_pct', '15')) || 0;
  } catch (_) { state.focusFireDmgBonus = 15; }
  
  // 2. 시뮬레이션 루프
  const timeline = {
    tick_ms: TICK_MS,
    field_w: FIELD_W,
    field_h: FIELD_H,
    battle_id: battleId,
    fleets_meta: state.fleets.map(f => ({
      id: f.id, 
      name: f.name,
      side: f.side, 
      faction_code: f.faction_code,
      owner_wallet: f.owner_wallet,
      ships_total: f.ships.length,
    })),
    frames: [],    // 각 프레임: { t, fleets, ships, events }
  };
  
  const events = [];
  let winnerSide = null;
  
  // 시뮬레이션 (fullTicks)
  for (let tick = 0; tick < MAX_TICKS; tick++) {
    state.tick = tick;
    
    // 전술 AI 평가
    for (const fleet of state.fleets) {
      if (fleet.ships.some(s => s.isAlive)) tacticsAI.evaluate(fleet, state, events);
    }

    // 함대 이동
    for (const fleet of state.fleets) {
      if (fleet.ships.some(s => s.isAlive)) updateFleetPosition(fleet, state);
    }

    // 함선 위치 갱신 (진형 적용)
    for (const fleet of state.fleets) {
      if (fleet.ships.some(s => s.isAlive)) updateShipPositions(fleet);
    }
    
    // 전투 처리 (발사 + 데미지)
    processCombat(state, events);
    
    // 프레임 저장 (매 5tick = 1초마다 저장. 렌더 시 보간)
    if (tick % 5 === 0) {
      timeline.frames.push(captureFrame(state, tick));
    }
    
    // 자동 퇴각 — HP 임계 이하 함대 후퇴(함선 보존)
    processAutoRetreat(state, events);
    // 승패 체크 — 살아있고 후퇴하지 않은 함선이 1척도 없는 사이드를 패배로 판정
    const atkAlive = state.fleets.filter(f => f.side === 'atk' && !f.retreated && f.ships.some(s => s.isAlive && !s.withdrawn)).length;
    const defAlive = state.fleets.filter(f => f.side === 'def' && !f.retreated && f.ships.some(s => s.isAlive && !s.withdrawn)).length;
    if (atkAlive === 0 || defAlive === 0) {
      winnerSide = atkAlive > 0 ? 'atk' : defAlive > 0 ? 'def' : 'draw';
      events.push({
        tick, type: 'battle_ended',
        payload: { winner_side: winnerSide, duration_ticks: tick }
      });
      // 마지막 프레임 저장
      timeline.frames.push(captureFrame(state, tick));
      break;
    }
  }
  
  // 시간 초과 — HP 비교 없이 무승부 (실제 전투는 함선 전멸로만 끝남)
  if (!winnerSide) {
    winnerSide = 'draw';
    events.push({
      tick: state.tick, type: 'battle_timeout',
      payload: { winner_side: 'draw' }
    });
  }
  
  // 통계 계산
  const stats = computeBattleStats(state);
  
  const elapsed = Date.now() - startTime;
  console.log(`[battleEngine] battle ${battleId} simulated in ${elapsed}ms. Winner: ${winnerSide}. Ticks: ${state.tick}. Frames: ${timeline.frames.length}`);
  
  return {
    winner_side: winnerSide,
    duration_ticks: state.tick,
    duration_seconds: Math.round(state.tick * TICK_MS / 1000),
    timeline,
    events,
    stats,
  };
}

function _sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

// [Phase 3 실시간] 라이브 명령 적용 — 참가자가 자기 함대에 보낸 명령을 진행 중 state 에 반영.
//   cmd: { fleetId, wallet, action('formation'|'maneuver'|'focus'), params }. 권한: 명령 wallet == 함대 owner (이중검증).
function applyLiveCommand(state, cmd) {
  if (!cmd || !cmd.fleetId) return false;
  const fleet = state.fleets.find(f => String(f.id) === String(cmd.fleetId));
  if (!fleet) return false;
  // 권위 레이어 이중검증 — 남의 함대 명령 차단
  if (cmd.wallet && String(fleet.owner_wallet || '').toLowerCase() !== String(cmd.wallet).toLowerCase()) return false;
  const p = cmd.params || {};
  if (cmd.action === 'formation' && p.formation) { fleet.formation = String(p.formation); return true; }
  if (cmd.action === 'maneuver'  && p.movement)  { fleet.movement = String(p.movement); fleet.maneuver = String(p.movement); return true; }
  if (cmd.action === 'focus') { fleet.focusFireTargetId = p.targetFleetId || p.targetShipId || null; return true; }
  // [Phase 3 실시간] 수동 스킬 — 서버 권위 충전/쿨다운(레드팀: 클라 게이지 신뢰 금지). 충전 100% 일 때만 발동, 발동 후 0 리셋.
  if (cmd.action === 'beam') {
    if ((fleet.beamCharge || 0) < 100) return false;
    if (_applySkill(state, fleet, 'beam')) { fleet.beamCharge = 0; return true; }
    return false;
  }
  if (cmd.action === 'missile') {
    if ((fleet.missileCharge || 0) < 100) return false;
    if (_applySkill(state, fleet, 'missile')) { fleet.missileCharge = 0; return true; }
    return false;
  }
  // 합체 필살기 — 충전 100% + 살아있는 합체체 보유 시에만 발동(서버 권위)
  if (cmd.action === 'overdrive') {
    if ((fleet.overdriveCharge || 0) < 100) return false;
    if (!fleet.ships.some(s => s.isAlive && s.size_class === 'assembled')) return false;
    if (_applySkill(state, fleet, 'overdrive')) { fleet.overdriveCharge = 0; return true; }
    return false;
  }
  return false;
}

// [Phase 3] 수동 스킬 데미지 적용 — beam: 우선순위 적함(기함/최대HP) 단일 강타, missile: 다수 분산.
//   데미지 = 발동 함대 살아있는 ATK 합 × 배율(state.skillMult). 서버 권위 — 클라가 데미지를 정하지 않음.
function _applySkill(state, fleet, kind) {
  const myAtk = fleet.ships.filter(s => s.isAlive && (s.atk || 0) > 0).reduce((a, s) => a + (s.atk || 0), 0);
  if (myAtk <= 0) return false;
  const enemies = state.fleets.filter(e => e.side !== fleet.side).flatMap(e => e.ships.filter(s => s.isAlive));
  if (!enemies.length) return false;
  const beamMult = (state.skillMult && state.skillMult.beam) || 8;
  const missileMult = (state.skillMult && state.skillMult.missile) || 4;
  if (kind === 'overdrive') {
    // 합체 필살기 — 광역 강타(미사일보다 강하고 더 많은 표적). assembled의 atk 비중이 클수록 강함.
    const odMult = (state.skillMult && state.skillMult.overdrive) || 5;
    const dmgEach = Math.round(myAtk * odMult);
    for (const t of enemies.slice(0, Math.min(10, enemies.length))) {
      t.hp -= dmgEach;
      if (t.hp <= 0) { t.hp = 0; t.isAlive = false; }
    }
    return true;
  }
  if (kind === 'beam') {
    enemies.sort((a, b) => ((b.isFlagship ? 1 : 0) - (a.isFlagship ? 1 : 0)) || ((b.maxHp || 0) - (a.maxHp || 0)));
    const t = enemies[0];
    t.hp -= Math.round(myAtk * beamMult);
    if (t.hp <= 0) { t.hp = 0; t.isAlive = false; }
    return true;
  }
  // missile — 최대 6척 분산
  const dmgEach = Math.round(myAtk * missileMult);
  for (const t of enemies.slice(0, Math.min(6, enemies.length))) {
    t.hp -= dmgEach;
    if (t.hp <= 0) { t.hp = 0; t.isAlive = false; }
  }
  return true;
}

// [Phase 3 실시간] 권위적 라이브 틱 루프 — simulateBattle 과 동일 헬퍼/결과 형태를 쓰되,
//   ① 틱 사이 await 로 양보 ② 매 틱 명령 큐 드레인·적용 ③ 프레임마다 즉시 broadcast(onFrame)
//   ④ wall-clock 타임아웃 ⑤ 권위 lock 상실 시 abort. 결과는 simulateBattle 과 같은 shape → applyBattleResults 동일 경로.
//   hooks: { drainCommands:()=>cmd[], onFrame:async(frame)=>{}, shouldAbort:()=>bool, wallClockMs, tickMs }
async function simulateBattleLive(battleId, hooks) {
  hooks = hooks || {};
  console.log(`[battleEngine] LIVE simulating battle ${battleId}...`);
  const battleData = await loadBattleData(battleId);
  if (!battleData) throw new Error('BATTLE_NOT_FOUND');
  const state = initBattleState(battleData);
  try { state.focusFireDmgBonus = parseFloat(await getSetting('focus_fire_dmg_bonus_pct', '15')) || 0; } catch (_) { state.focusFireDmgBonus = 15; }
  // [Phase 3] 수동 스킬 배율/충전율 — 서버 권위(클라 게이지 신뢰 금지)
  try {
    state.skillMult = { beam: parseFloat(await getSetting('siege_beam_dmg_mult', '8')) || 8, missile: parseFloat(await getSetting('siege_missile_dmg_mult', '4')) || 4, overdrive: parseFloat(await getSetting('assembly_overdrive_dmg_mult', '5')) || 5 };
    state.beamChargePerShipTick = parseFloat(await getSetting('siege_beam_charge_per_ship', '0.4')) || 0.4;
    state.missileChargePerShipTick = parseFloat(await getSetting('siege_missile_charge_per_ship', '0.6')) || 0.6;
    state.overdriveChargePerShipTick = parseFloat(await getSetting('assembly_overdrive_charge_per_ship', '0.5')) || 0.5;
  } catch (_) { state.skillMult = { beam: 8, missile: 4, overdrive: 5 }; state.beamChargePerShipTick = 0.4; state.missileChargePerShipTick = 0.6; state.overdriveChargePerShipTick = 0.5; }

  const timeline = {
    tick_ms: TICK_MS, field_w: FIELD_W, field_h: FIELD_H, battle_id: battleId, live: true,
    fleets_meta: state.fleets.map(f => ({ id: f.id, name: f.name, side: f.side, faction_code: f.faction_code, owner_wallet: f.owner_wallet, ships_total: f.ships.length })),
    frames: [],
  };
  const events = [];
  let winnerSide = null;
  const started = Date.now();
  const wallClockMs = hooks.wallClockMs || (10 * 60 * 1000);
  const tickMs = hooks.tickMs || TICK_MS;

  for (let tick = 0; tick < MAX_TICKS; tick++) {
    state.tick = tick;
    // ① 명령 큐 드레인·적용
    if (typeof hooks.drainCommands === 'function') {
      let cmds; try { cmds = hooks.drainCommands() || []; } catch (_) { cmds = []; }
      for (const c of cmds) { try { applyLiveCommand(state, c); } catch (_) {} }
    }
    for (const fleet of state.fleets) if (fleet.ships.some(s => s.isAlive)) tacticsAI.evaluate(fleet, state, events);
    for (const fleet of state.fleets) if (fleet.ships.some(s => s.isAlive)) updateFleetPosition(fleet, state);
    for (const fleet of state.fleets) if (fleet.ships.some(s => s.isAlive)) updateShipPositions(fleet);
    processCombat(state, events);

    // [Phase 3] 수동 스킬 충전 — 살아있는 ATK 함선 수 비례(서버 권위). 100% 에서 beam/missile 발동 가능.
    for (const fleet of state.fleets) {
      const atkN = fleet.ships.filter(s => s.isAlive && (s.atk || 0) > 0).length;
      if (atkN <= 0) continue;
      fleet.beamCharge = Math.min(100, (fleet.beamCharge || 0) + atkN * (state.beamChargePerShipTick || 0.4));
      fleet.missileCharge = Math.min(100, (fleet.missileCharge || 0) + atkN * (state.missileChargePerShipTick || 0.6));
      // 합체 필살기(overdrive): 살아있는 합체체(assembled)가 함대에 있을 때만 충전
      if (fleet.ships.some(s => s.isAlive && s.size_class === 'assembled')) {
        fleet.overdriveCharge = Math.min(100, (fleet.overdriveCharge || 0) + atkN * (state.overdriveChargePerShipTick || 0.5));
      }
    }

    if (tick % 5 === 0) {
      const fr = captureFrame(state, tick);
      timeline.frames.push(fr);
      if (typeof hooks.onFrame === 'function') { try { await hooks.onFrame(fr); } catch (_) {} }
    }

    processAutoRetreat(state, events);
    const atkAlive = state.fleets.filter(f => f.side === 'atk' && !f.retreated && f.ships.some(s => s.isAlive && !s.withdrawn)).length;
    const defAlive = state.fleets.filter(f => f.side === 'def' && !f.retreated && f.ships.some(s => s.isAlive && !s.withdrawn)).length;
    if (atkAlive === 0 || defAlive === 0) {
      winnerSide = atkAlive > 0 ? 'atk' : defAlive > 0 ? 'def' : 'draw';
      const fr = captureFrame(state, tick); timeline.frames.push(fr);
      if (typeof hooks.onFrame === 'function') { try { await hooks.onFrame(fr); } catch (_) {} }
      events.push({ tick, type: 'battle_ended', payload: { winner_side: winnerSide, duration_ticks: tick } });
      break;
    }
    if (Date.now() - started > wallClockMs) {
      winnerSide = 'draw';
      events.push({ tick, type: 'battle_timeout', payload: { winner_side: 'draw', reason: 'wall_clock' } });
      break;
    }
    // 권위 lock 상실 — 이중 권위 방지 위해 결과 미기록 중단
    if (typeof hooks.shouldAbort === 'function' && hooks.shouldAbort()) {
      throw new Error('AUTHORITY_LOST');
    }
    await _sleep(tickMs);
  }
  if (!winnerSide) { winnerSide = 'draw'; events.push({ tick: state.tick, type: 'battle_timeout', payload: { winner_side: 'draw' } }); }
  const stats = computeBattleStats(state);
  console.log(`[battleEngine] LIVE battle ${battleId} ended. Winner: ${winnerSide}. Ticks: ${state.tick}.`);
  return { winner_side: winnerSide, duration_ticks: state.tick, duration_seconds: Math.round(state.tick * TICK_MS / 1000), timeline, events, stats };
}

// ─── 자동 퇴각 처리 ───
// 함대 HP가 autoRetreatPct% 이하로 떨어지면 그 함대 전원 후퇴(함선 보존, 격침 아님).
// 후퇴 함선은 withdrawn 표시 → 승패판정/타겟팅에서 제외되지만 isAlive 유지 → applyBattleResults가 현재 HP로 보존.
function processAutoRetreat(state, events) {
  for (const fleet of state.fleets) {
    if (fleet.retreated || !fleet.autoRetreatPct || fleet.autoRetreatPct <= 0) continue;
    const alive = fleet.ships.filter(s => s.isAlive && !s.withdrawn);
    if (!alive.length) continue;
    const ratio = fleet.maxHp > 0 ? (fleet.hp / fleet.maxHp) * 100 : 100;
    if (ratio <= fleet.autoRetreatPct) {
      fleet.retreated = true;
      alive.forEach(s => { s.withdrawn = true; });
      events.push({ tick: state.tick, type: 'fleet_retreated',
        payload: { fleet_id: fleet.id, side: fleet.side, hp_pct: Math.round(ratio), saved_ships: alive.length } });
    }
  }
}

// ─── DB에서 전투 데이터 로드 ───

async function loadBattleData(battleId) {
  // battle 메타
  const { rows: battleRows } = await pool.query(
    `SELECT * FROM fleet_battles WHERE id = $1`, [battleId]
  );
  if (!battleRows[0]) return null;
  const battle = battleRows[0];
  
  // participants + fleets
  const { rows: fleetRows } = await pool.query(`
    SELECT 
      p.side, p.spawn_x, p.spawn_y,
      f.id AS fleet_id, f.name AS fleet_name, f.owner_wallet,
      f.formation, f.movement, f.auto_retreat_pct,
      u.faction_code, fa.color_primary AS faction_color
    FROM fleet_battle_participants p
    JOIN fleets f ON f.id = p.fleet_id
    LEFT JOIN users u ON u.wallet_address = f.owner_wallet
    LEFT JOIN factions fa ON fa.code = u.faction_code
    WHERE p.battle_id = $1
    ORDER BY p.side, f.id
  `, [battleId]);
  
  if (fleetRows.length === 0) return null;

  // 각 함대의 함선들 로드
  const fleets = [];
  for (const fr of fleetRows) {
    const { rows: shipRows } = await pool.query(`
      SELECT s.id, s.ship_type_code, s.current_hp, s.max_hp, s.is_flagship,
             s.bonus_atk, s.bonus_def, s.bonus_hp,
             COALESCE(s.bonus_speed, 0) AS bonus_speed,
             s.shield_hp, s.shield_max,
             st.name_ko, st.size_class, st.role,
             st.base_atk, st.base_def, st.base_speed,
             st.fire_interval, st.fire_type, st.shots, st.render_radius
      FROM ships s
      JOIN ship_types st ON st.code = s.ship_type_code
      WHERE s.fleet_id = $1 AND s.is_alive = true
        AND ($2::text <> 'hijack_phase1' OR st.size_class = ANY($3::text[]))
      ORDER BY s.is_flagship DESC, st.sort_order DESC
    `, [fr.fleet_id, battle.phase || '', HIJACK_PHASE1_SIZE_CLASSES]);

    // ✅ [Job] 직업별 전투력 배율 (warrior +30%, miner -30%, crafter -20%, merchant -20%)
    let combatPowerMult = 1.0;
    try {
      if (jobService && fr.owner_wallet) {
        const w = await jobService.getJobBuff(fr.owner_wallet, 'warrior_combat_power', 1.0);
        const m = await jobService.getJobBuff(fr.owner_wallet, 'miner_combat_power', 1.0);
        const c = await jobService.getJobBuff(fr.owner_wallet, 'crafter_combat_power', 1.0);
        const mc = await jobService.getJobBuff(fr.owner_wallet, 'merchant_combat_power', 1.0);
        combatPowerMult = w * m * c * mc;
      }
    } catch (_je) {}

    fleets.push({
      ...fr,
      ships: shipRows,
      combatPowerMult,
    });
  }

  // Commander Actions (M-151) — 선언된 pre-battle 전술 로드
  let cmdActions = null;
  if (commanderActions) {
    try { cmdActions = await commanderActions.loadForBattle(battleId); }
    catch (e) { console.warn('[battleEngine] commanderActions load failed:', e.message); }
  }

  // reinforce 적용 — 선언자의 함대에 synthetic 함선 추가 (DB에는 저장 안 함)
  if (cmdActions?.reinforcements?.length) {
    let synthId = -1;
    // 상한값은 settings에서 (하드코딩 금지)
    const reinforceMax = parseInt(await getSetting('commander_action_reinforce_max_count', '20')) || 20;
    for (const r of cmdActions.reinforcements) {
      const targetFleet = fleets.find(f => f.owner_wallet === r.wallet && f.side === r.side);
      if (!targetFleet) continue;
      try {
        const { rows: stRows } = await pool.query(
          `SELECT code AS ship_type_code, name_ko, size_class, role,
                  base_atk, base_def, base_speed,
                  fire_interval, fire_type, shots, render_radius,
                  max_hp
           FROM ship_types WHERE code = $1 AND is_active = true`,
          [r.shipTypeCode]
        );
        if (!stRows[0]) continue;
        const st = stRows[0];
        const n = Math.max(1, Math.min(reinforceMax, parseInt(r.count) || 0));
        for (let i = 0; i < n; i++) {
          targetFleet.ships.push({
            id: synthId--,                 // 음수 ID — DB 비지속, 이벤트 로그용
            ship_type_code: st.ship_type_code,
            current_hp: st.max_hp,
            max_hp: st.max_hp,
            is_flagship: false,
            bonus_atk: 0, bonus_def: 0, bonus_hp: 0, bonus_speed: 0,
            name_ko: st.name_ko,
            size_class: st.size_class,
            role: st.role,
            base_atk: st.base_atk,
            base_def: st.base_def,
            base_speed: st.base_speed,
            fire_interval: st.fire_interval,
            fire_type: st.fire_type,
            shots: st.shots,
            render_radius: st.render_radius,
            _synthetic_reinforce: true,
          });
        }
      } catch (e) { console.warn('[battleEngine] reinforce load failed:', e.message); }
    }
  }

  return { battle, fleets, commanderActions: cmdActions };
}

// ─── 전투 상태 초기화 ───

function initBattleState(battleData) {
  const { battle, fleets, commanderActions: cmdActions } = battleData;
  
  const atkPositions = [
    { cx: FIELD_W * 0.11, cy: FIELD_H * 0.15 },
    { cx: FIELD_W * 0.09, cy: FIELD_H * 0.38 },
    { cx: FIELD_W * 0.14, cy: FIELD_H * 0.60 },
    { cx: FIELD_W * 0.20, cy: FIELD_H * 0.82 },
    { cx: FIELD_W * 0.18, cy: FIELD_H * 0.28 },
  ];
  const defPositions = [
    { cx: FIELD_W * 0.89, cy: FIELD_H * 0.15 },
    { cx: FIELD_W * 0.91, cy: FIELD_H * 0.38 },
    { cx: FIELD_W * 0.86, cy: FIELD_H * 0.60 },
    { cx: FIELD_W * 0.80, cy: FIELD_H * 0.82 },
    { cx: FIELD_W * 0.82, cy: FIELD_H * 0.28 },
  ];
  
  let atkIdx = 0, defIdx = 0;
  const stateFleets = fleets.map(f => {
    const positions = f.side === 'atk' ? atkPositions : defPositions;
    const pos = positions[f.side === 'atk' ? atkIdx++ : defIdx++] || { cx: FIELD_W/2, cy: FIELD_H/2 };
    
    const maxHp = f.ships.reduce((sum, s) => sum + parseInt(s.max_hp) + parseInt(s.bonus_hp || 0), 0);
    const radius = Math.max(50, Math.sqrt(f.ships.length) * 4.8 + 25);
    
    return {
      id: f.fleet_id,
      name: f.fleet_name,
      side: f.side,
      owner_wallet: f.owner_wallet,
      faction_code: f.faction_code,
      faction_color: f.faction_color,
      
      cx: pos.cx, cy: pos.cy,
      vcx: 0, vcy: 0,
      radius,
      facingAngle: f.side === 'atk' ? 0 : Math.PI,
      
      formation: f.formation || 'sphere',
      movement: f.movement || 'advance',
      autoRetreatPct: parseInt(f.auto_retreat_pct, 10) || 0,
      retreated: false,

      hp: maxHp, maxHp,
      dead: false,

      // AI 상태
      laserHits: 0,
      laserHitDecay: 0,
      recentReinforce: false,
      tacticCooldown: 0,

      // Commander Actions (M-151) 적용 여부
      focusFireTargetId: null,
      wedgeForced: false,

      ships: f.ships.map((s, idx) => initShip(s, pos, idx, f.ships.length, radius, f.combatPowerMult || 1.0)),
    };
  });

  // Commander Actions 적용 — focus_fire, wedge (reinforce/emp 는 사이드 효과로 추후)
  if (cmdActions) {
    // focus_fire: owner_wallet 별 target 설정
    for (const f of stateFleets) {
      const tgt = cmdActions.focusFireByWallet?.[f.owner_wallet];
      if (tgt) f.focusFireTargetId = tgt;
    }
    // wedge: 지정된 side 모든 함대 formation='wedge' 강제 (movement 아님)
    if (cmdActions.wedgeSides && cmdActions.wedgeSides.size > 0) {
      for (const f of stateFleets) {
        if (cmdActions.wedgeSides.has(f.side)) {
          f.formation = 'wedge';
          f.wedgeForced = true;
        }
      }
    }
    // formation_change / maneuver_change — tactical-lab 컨트롤 → 시뮬 진형/기동 적용
    const formBySide = cmdActions.formationsBySide || {};
    const mvBySide = cmdActions.maneuversBySide || {};
    for (const f of stateFleets) {
      if (formBySide[f.side]) f.formation = formBySide[f.side];
      if (mvBySide[f.side])  { f.maneuver = mvBySide[f.side]; f.movement = mvBySide[f.side]; }
    }
  }

  return {
    battle_id: battle.id,
    battle_type: battle.battle_type,
    tick: 0,
    fleets: stateFleets,
    // EMP 일정 (engine 이 tick 마다 체크)
    empSchedule: cmdActions?.empSchedule || [],
    empActive: null, // { untilTick, mult, targetSide }
    focusFireDmgBonus: 0, // getSetting 으로 아래에서 채움
  };
}

function initShip(shipData, fleetPos, idx, total, fleetRadius, combatPowerMult = 1.0) {
  // 초기 배치: 랜덤 오비탈
  const orbitAngle = (idx / total) * Math.PI * 2 + Math.random() * 0.3;
  const orbitDist = 15 + Math.random() * (fleetRadius - 15);
  const bonusAtk = parseInt(shipData.bonus_atk || 0);
  const bonusDef = parseInt(shipData.bonus_def || 0);
  const bonusHp = parseInt(shipData.bonus_hp || 0);
  const bonusSpeed = parseFloat(shipData.bonus_speed || 0);
  
  return {
    id: shipData.id,
    ship_type_code: shipData.ship_type_code,
    name: shipData.name_ko,
    size_class: shipData.size_class,
    role: shipData.role,
    
    // 스탯 (전투력 배율 적용: warrior +30%, miner/crafter/merchant 패널티)
    atk: Math.max(1, Math.round((parseInt(shipData.base_atk) + bonusAtk) * combatPowerMult)),
    def: parseInt(shipData.base_def) + bonusDef,
    speed: Math.max(0.05, parseFloat(shipData.base_speed) + bonusSpeed),
    fireInterval: parseInt(shipData.fire_interval),
    fireType: shipData.fire_type,
    shots: parseInt(shipData.shots) || 1,
    renderRadius: parseFloat(shipData.render_radius) || 2,
    
    maxHp: parseInt(shipData.max_hp) + bonusHp,
    hp: parseInt(shipData.current_hp),
    bonus_atk: bonusAtk,
    bonus_def: bonusDef,
    bonus_hp: bonusHp,
    bonus_speed: bonusSpeed,
    shield_hp: parseInt(shipData.shield_hp || 0),
    shield_max: parseInt(shipData.shield_max || 0),

    isFlagship: shipData.is_flagship,
    isAlive: true,
    
    // 위치
    x: fleetPos.cx + Math.cos(orbitAngle) * orbitDist,
    y: fleetPos.cy + Math.sin(orbitAngle) * orbitDist,
    facing: 0,
    
    orbitAngle,
    orbitDist,
    orbitSpeed: shipData.is_flagship ? 0 : 0.002 + Math.random() * 0.003,
    
    // 진형 슬롯 (wedge/screen/pincer용)
    slotX: 0, slotY: 0, slotAssigned: false,
    
    // 통계
    killsDealt: 0,
    damageDealt: 0,
    
    // 발사 타이머
    shootT: Math.random() * parseInt(shipData.fire_interval),
  };
}

// ─── 함대 이동 로직 (v11 이식) ───

const MOVEMENT_SPEED_MULT = {
  advance: 1.0, retreat: 1.5, flank: 1.2, flank_left: 1.2, flank_right: 1.2, scatter: 1.8, rally: 0.6,
};

function updateFleetPosition(fleet, state) {
  const enemies = state.fleets.filter(e => e.side !== fleet.side && !e.dead);
  if (!enemies.length) return;
  
  // 가장 가까운 적 타겟
  let target = enemies[0];
  let minDist = distance(fleet, enemies[0]);
  for (const e of enemies) {
    const d = distance(fleet, e);
    if (d < minDist) { minDist = d; target = e; }
  }
  
  const dx = target.cx - fleet.cx;
  const dy = target.cy - fleet.cy;
  const dist = Math.hypot(dx, dy) || 1;
  const spdMult = MOVEMENT_SPEED_MULT[fleet.movement] || 1.0;
  
  // 기동별 이동
  if (fleet.movement === 'retreat') {
    fleet.vcx -= (dx/dist) * 0.04 * spdMult;
    fleet.vcy -= (dy/dist) * 0.04 * spdMult;
  } else if (fleet.movement === 'scatter') {
    fleet.vcx += (Math.random() - 0.5) * 0.1 * spdMult;
    fleet.vcy += (Math.random() - 0.5) * 0.1 * spdMult;
  } else if (fleet.movement === 'flank' || fleet.movement === 'flank_left' || fleet.movement === 'flank_right') {
    // 측면 기동 — target 방향 수직(perp)으로 우회 접근. 좌현/우현은 side 고정, 'flank'(legacy)는 자동.
    const perpX = -dy/dist, perpY = dx/dist;
    let side;
    if (fleet.movement === 'flank_left')  side = -1;   // 좌현(←)
    else if (fleet.movement === 'flank_right') side = 1; // 우현(→)
    else side = Math.sign(perpY * ((FIELD_H/2 - fleet.cy) > 0 ? 1 : -1)) || 1;
    fleet.vcx += (dx/dist) * 0.015 * spdMult + perpX * side * 0.02 * spdMult;
    fleet.vcy += (dy/dist) * 0.015 * spdMult + perpY * side * 0.02 * spdMult;
  } else if (fleet.movement === 'rally') {
    const minDistTarget = fleet.radius + target.radius + 15;
    if (dist > minDistTarget) {
      fleet.vcx += (dx/dist) * 0.012 * spdMult;
      fleet.vcy += (dy/dist) * 0.012 * spdMult;
    } else { fleet.vcx *= 0.75; fleet.vcy *= 0.75; }
  } else {
    // advance
    const minDistTarget = fleet.radius + target.radius + 15;
    if (dist > minDistTarget) {
      fleet.vcx += (dx/dist) * 0.025 * spdMult;
      fleet.vcy += (dy/dist) * 0.025 * spdMult;
    } else { fleet.vcx *= 0.8; fleet.vcy *= 0.8; }
  }
  
  fleet.vcx *= 0.90; fleet.vcy *= 0.90;
  
  const spd = Math.hypot(fleet.vcx, fleet.vcy);
  const maxSpd = 0.5 * spdMult;
  if (spd > maxSpd) {
    fleet.vcx = (fleet.vcx / spd) * maxSpd;
    fleet.vcy = (fleet.vcy / spd) * maxSpd;
  }
  
  fleet.cx += fleet.vcx;
  fleet.cy += fleet.vcy;
  
  // 경계
  fleet.cx = Math.max(fleet.radius + 8, Math.min(FIELD_W - fleet.radius - 8, fleet.cx));
  fleet.cy = Math.max(fleet.radius + 8, Math.min(FIELD_H - fleet.radius - 8, fleet.cy));
  
  // facing
  const vMag = Math.hypot(fleet.vcx, fleet.vcy);
  if (vMag > 0.03) fleet.facingAngle = Math.atan2(fleet.vcy, fleet.vcx);
  else fleet.facingAngle = Math.atan2(dy, dx);
  if (fleet.movement === 'retreat') {
    fleet.facingAngle = Math.atan2(dy, dx);
  }
}

// ─── 진형 슬롯 할당 ───

function assignFormationSlots(fleet) {
  const escorts = fleet.ships.filter(s => s.isAlive && !s.isFlagship);
  const R = fleet.radius;
  
  if (fleet.formation === 'sphere') {
    // 기본 - 이미 초기화됐으면 놔두기
    for (const s of escorts) {
      if (!s.slotAssigned) {
        s.orbitAngle = Math.random() * Math.PI * 2;
        s.orbitDist = 15 + Math.random() * (R - 15);
        s.slotAssigned = true;
      }
    }
  } else if (fleet.formation === 'wedge') {
    const sorted = [...escorts].sort((a,b) => a.renderRadius - b.renderRadius);
    const total = sorted.length;
    sorted.forEach((s, i) => {
      const depthRatio = i / Math.max(total, 1);
      const forward = R * (0.8 - depthRatio * 1.4);
      const spread = depthRatio * 0.8 + 0.2;
      const laneCount = Math.max(2, Math.round(5 + depthRatio * 10));
      const lane = i % laneCount;
      s.slotX = forward;
      s.slotY = (lane - (laneCount-1)/2) * R * spread / laneCount;
      s.slotAssigned = true;
    });
  } else if (fleet.formation === 'screen') {
    const sorted = [...escorts].sort((a,b) => a.renderRadius - b.renderRadius);
    const smallCount = Math.floor(sorted.length * 0.6);
    sorted.forEach((s, i) => {
      if (i < smallCount) {
        const sq = Math.ceil(Math.sqrt(smallCount));
        const col = i % sq, row = Math.floor(i / sq);
        s.slotX = R * 0.7 - row * 8;
        s.slotY = (col - sq/2) * 10;
      } else {
        const bi = i - smallCount;
        s.slotX = -R * 0.3 - Math.floor(bi/5) * 12;
        s.slotY = ((bi%5) - 2) * 15;
      }
      s.slotAssigned = true;
    });
  } else if (fleet.formation === 'pincer') {
    const sorted = [...escorts].sort((a,b) => a.renderRadius - b.renderRadius);
    sorted.forEach((s, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      const depth = Math.floor(i / 2);
      s.slotX = R * 0.3 - depth * 5;
      s.slotY = side * (R * 0.5 + depth * 3);
      s.slotAssigned = true;
    });
  } else if (fleet.formation === 'line') {
    // 전열 횡대 — 넓은 횡대(slotY 분산), 얕은 다열(slotX)
    const sorted = [...escorts].sort((a,b) => a.renderRadius - b.renderRadius);
    const tot = sorted.length, perRow = 12;
    sorted.forEach((s, i) => {
      const r = Math.floor(i / perRow), c = i % perRow;
      const cols = Math.min(perRow, tot - r * perRow);
      s.slotX = R * 0.55 - r * 12;
      s.slotY = (c - (cols - 1) / 2) * (R * 1.5 / Math.max(1, perRow - 1));
      s.slotAssigned = true;
    });
  } else if (fleet.formation === 'echelon') {
    // 사다리꼴 — 대각 계단(slotX/slotY 동반 증가)
    const sorted = [...escorts].sort((a,b) => a.renderRadius - b.renderRadius);
    sorted.forEach((s, i) => {
      s.slotX = R * 0.6 - i * 4.5;
      s.slotY = -R * 0.7 + i * 5.5;
      s.slotAssigned = true;
    });
  } else if (fleet.formation === 'vanguard') {
    // 호위 방진 — 대형함 안쪽, 사각 링으로 호위
    const sorted = [...escorts].sort((a,b) => b.renderRadius - a.renderRadius);
    sorted.forEach((s, i) => {
      let ring = 1, seen = 0, cap = 8;
      while (i >= seen + cap) { seen += cap; ring++; cap = ring * 8; }
      const vs = i - seen, per = cap / 4, sideI = Math.floor(vs / per), t = (vs % per) / per, e = -1 + 2 * t;
      const Rr = ring * (R * 0.32);
      if (sideI === 0) { s.slotX = Rr; s.slotY = e * Rr; }
      else if (sideI === 1) { s.slotX = e * Rr; s.slotY = Rr; }
      else if (sideI === 2) { s.slotX = -Rr; s.slotY = -e * Rr; }
      else { s.slotX = e * Rr; s.slotY = -Rr; }
      s.slotAssigned = true;
    });
  }
}

// ─── 함선 위치 갱신 ───

function updateShipPositions(fleet) {
  const cos = Math.cos(fleet.facingAngle);
  const sin = Math.sin(fleet.facingAngle);
  
  for (const ship of fleet.ships) {
    if (!ship.isAlive) continue;
    
    if (ship.isFlagship) {
      ship.x = fleet.cx;
      ship.y = fleet.cy;
      continue;
    }
    
    if (fleet.formation === 'sphere') {
      // 공전
      const spreadMult = fleet.movement === 'scatter' ? 2.0 : 
                        fleet.movement === 'retreat' ? 1.3 : 1.0;
      ship.orbitAngle += ship.orbitSpeed * (fleet.movement === 'scatter' ? 2.5 : 1);
      const dv = ship.orbitDist * spreadMult + Math.sin(ship.orbitAngle * 2.5) * 4;
      ship.x = fleet.cx + Math.cos(ship.orbitAngle) * dv;
      ship.y = fleet.cy + Math.sin(ship.orbitAngle) * dv;
    } else {
      // slot 기반
      if (!ship.slotAssigned) {
        assignFormationSlots(fleet);
      }
      let lx = ship.slotX, ly = ship.slotY;
      if (fleet.movement === 'scatter') {
        lx *= 2.0; ly *= 2.0;
        ship.orbitAngle += 0.05;
        lx += Math.cos(ship.orbitAngle) * 8;
        ly += Math.sin(ship.orbitAngle) * 8;
      } else if (fleet.movement === 'retreat') {
        lx *= 1.2; ly *= 1.2;
      }
      const worldX = fleet.cx + (lx * cos - ly * sin);
      const worldY = fleet.cy + (lx * sin + ly * cos);
      ship.x += (worldX - ship.x) * 0.12;
      ship.y += (worldY - ship.y) * 0.12;
    }
    
    // facing: 가장 가까운 적 방향
    // (계산 절약을 위해 함대 facing 기본 + 미세 조정)
    ship.facing = fleet.facingAngle;
  }
}

// ─── 전투 처리 (발사 + 데미지) ───

function processCombat(state, events) {
  // ── Commander Actions: EMP schedule 체크 ──
  if (state.empSchedule && state.empSchedule.length > 0) {
    for (let i = state.empSchedule.length - 1; i >= 0; i--) {
      const emp = state.empSchedule[i];
      if (state.tick >= emp.tick) {
        state.empActive = {
          untilTick: state.tick + (emp.durationTicks || 30),
          mult: emp.fireIntervalMult || 5,
          targetSide: emp.targetSide,
        };
        events.push({
          tick: state.tick,
          type: 'commander_emp_activated',
          payload: { target_side: emp.targetSide, until_tick: state.empActive.untilTick }
        });
        state.empSchedule.splice(i, 1);
      }
    }
  }
  if (state.empActive && state.tick > state.empActive.untilTick) {
    state.empActive = null;
  }

  for (const fleet of state.fleets) {
    if (fleet.retreated || !fleet.ships.some(s => s.isAlive && !s.withdrawn)) continue;

    // EMP 영향: targetSide 의 함선은 발사주기 × mult (더 느려짐)
    const empMult = (state.empActive && state.empActive.targetSide === fleet.side)
      ? state.empActive.mult : 1;

    for (const ship of fleet.ships) {
      if (!ship.isAlive) continue;

      ship.shootT += TICK_MS;
      const ewFireMult = (fleet.ewUntilTick && state.tick <= fleet.ewUntilTick)
        ? (fleet.ewFireIntervalMult || 1)
        : 1;
      const effectiveFireInterval = ship.fireInterval * empMult * ewFireMult;
      if (ship.shootT < effectiveFireInterval) continue;
      ship.shootT = 0;

      // Repair는 아군 체력 회복
      if (ship.fireType === 'repair') {
        processRepair(fleet, ship);
        continue;
      }

      // 공격 대상 찾기 (가장 가까운 적 함대의 랜덤 함선)
      const enemies = state.fleets.filter(e => e.side !== fleet.side && !e.retreated && e.ships.some(s => s.isAlive && !s.withdrawn));
      if (!enemies.length) continue;

      // ── Commander Action: focus_fire 대상 강제 ──
      let targetFleet = null;
      if (fleet.focusFireTargetId) {
        const forced = enemies.find(e => e.id === fleet.focusFireTargetId);
        if (forced) targetFleet = forced;
      }
      if (!targetFleet) {
        // 기본: 가장 가까운 적 함대
        targetFleet = enemies[0];
        let minDist = distanceFleet(ship, enemies[0]);
        for (const e of enemies) {
          const d = distanceFleet(ship, e);
          if (d < minDist) { minDist = d; targetFleet = e; }
        }
      }

      // 타겟 함대에서 살아있는 함선 랜덤 선택
      const aliveTargets = targetFleet.ships.filter(s => s.isAlive && !s.withdrawn);
      if (!aliveTargets.length) continue;

      const target = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];

      // EW ships are support picks: low direct damage, but they slow enemy fire
      // and soften enemy outgoing damage so buying them has a fleet-composition reason.
      if (ship.fireType === 'ew') {
        processElectronicWarfare(targetFleet, ship, fleet, state, events);
        continue;
      }

      // 데미지 계산 (focus_fire 보너스 포함)
      let damage = computeDamage(ship, target);
      if (fleet.ewUntilTick && state.tick <= fleet.ewUntilTick && fleet.ewAtkMult) {
        damage = Math.max(1, Math.floor(damage * fleet.ewAtkMult));
      }
      if (fleet.focusFireTargetId && fleet.focusFireTargetId === targetFleet.id && state.focusFireDmgBonus > 0) {
        damage = Math.floor(damage * (1 + state.focusFireDmgBonus / 100));
      }
      applyDamage(target, targetFleet, damage, ship, fleet, state, events);
      
      // 레이저/폭격은 명중 확정 → laserHits 증가
      if (ship.fireType === 'laser' || ship.fireType === 'stealth_bomb') {
        targetFleet.laserHits = (targetFleet.laserHits || 0) + 1;
        targetFleet.laserHitDecay = 2000;
      }
    }
  }
}

function processElectronicWarfare(targetFleet, ewShip, attackerFleet, state, events) {
  const active = targetFleet.ewUntilTick && state.tick <= targetFleet.ewUntilTick;
  const stacks = Math.min(3, active ? ((targetFleet.ewStacks || 1) + 1) : 1);
  targetFleet.ewStacks = stacks;
  targetFleet.ewUntilTick = state.tick + Math.round(8000 / TICK_MS);
  targetFleet.ewFireIntervalMult = 1 + stacks * 0.22;
  targetFleet.ewAtkMult = Math.max(0.76, 1 - stacks * 0.08);
  ewShip.damageDealt += Math.max(1, Math.round(ewShip.atk * 0.4));

  if (!targetFleet._lastEwEventTick || state.tick - targetFleet._lastEwEventTick > 20) {
    events.push({
      tick: state.tick,
      type: 'electronic_warfare',
      fleet_id: targetFleet.id,
      payload: {
        source_fleet_id: attackerFleet.id,
        source_ship_id: ewShip.id,
        stacks,
        fire_interval_mult: targetFleet.ewFireIntervalMult,
        atk_mult: targetFleet.ewAtkMult,
        until_tick: targetFleet.ewUntilTick,
      }
    });
    targetFleet._lastEwEventTick = state.tick;
  }
}

function processRepair(fleet, repairerShip) {
  // 가장 피해 입은 아군 찾기
  const hurtAllies = fleet.ships.filter(s => 
    s.isAlive && s !== repairerShip && s.hp < s.maxHp
  );
  if (!hurtAllies.length) return;
  
  hurtAllies.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
  const target = hurtAllies[0];
  
  const healAmount = repairerShip.atk * 15;
  target.hp = Math.min(target.maxHp, target.hp + healAmount);
  
  // 함대 총 HP 재계산
  fleet.hp = fleet.ships.reduce((sum, s) => sum + (s.isAlive ? s.hp : 0), 0);
}

function computeDamage(attacker, target) {
  // 기본 공식: (attack - defense*0.5) + random(0.8~1.2)
  const baseDamage = attacker.atk;
  const defenseReduction = target.def * 0.5;
  const raw = Math.max(baseDamage * 0.2, baseDamage - defenseReduction);
  const variance = 0.8 + Math.random() * 0.4;
  
  // fire_type별 배율
  let typeMult = 1.0;
  if (attacker.fireType === 'laser') typeMult = 1.2;
  else if (attacker.fireType === 'missile') typeMult = 1.1;
  else if (attacker.fireType === 'stealth_bomb') typeMult = 1.5; // 폭격 (ATK 너프로 2.5→1.5)
  else if (attacker.fireType === 'ew') typeMult = 0.3; // EW는 낮은 딜

  return Math.max(1, Math.floor(raw * variance * typeMult * getShipMatchupMult(attacker, target)));
}

function getShipMatchupMult(attacker, target) {
  const aRole = String(attacker.role || 'dps').toLowerCase();
  const tRole = String(target.role || 'dps').toLowerCase();
  const aSize = String(attacker.size_class || '').toLowerCase();
  const tSize = String(target.size_class || '').toLowerCase();
  const aCode = String(attacker.ship_type_code || '');
  const tCode = String(target.ship_type_code || '');
  const aFaction = aCode.split('_')[0] || '';
  const tFaction = tCode.split('_')[0] || '';
  let mult = 1.0;

  if (aRole === 'tackle') {
    if (tRole === 'ewar' || tRole === 'logi' || tSize === 'frigate') mult *= 1.22;
    if (tRole === 'tank' || tSize === 'battleship' || tSize === 'titan') mult *= 0.84;
  } else if (aRole === 'ewar') {
    if (tRole === 'dps' || tRole === 'sniper' || tSize === 'battleship' || tSize === 'titan' || tSize === 'assembled') mult *= 1.18;
    if (tRole === 'tackle' || tSize === 'frigate') mult *= 0.82;
  } else if (aRole === 'logi') {
    mult *= 0.72;
  } else if (aRole === 'tank') {
    if (tRole === 'tackle' || tSize === 'frigate') mult *= 1.12;
    if (tRole === 'sniper' || tRole === 'bomb') mult *= 0.90;
  } else if (aRole === 'sniper') {
    if (tRole === 'tank' || tSize === 'cruiser' || tSize === 'battleship' || tSize === 'titan' || tSize === 'assembled') mult *= 1.25;
    if (tRole === 'tackle' || tSize === 'frigate') mult *= 0.78;
  } else if (aRole === 'bomb' || attacker.fireType === 'stealth_bomb') {
    if (tSize === 'battleship' || tSize === 'titan' || tSize === 'assembled' || tRole === 'tank') mult *= 1.28;
    if (tSize === 'frigate' || tRole === 'tackle') mult *= 0.68;
  } else if (aRole === 'dps') {
    if (tRole === 'ewar' || tRole === 'logi') mult *= 1.10;
    if (tRole === 'tank') mult *= 0.92;
  }

  // ── Assembled super-unit (Pilgrim Arms Voltaris) ──
  // 중상위 generalist: 소형/스크린 정리에 강함(광역), 단 전자전에 교란됨. 카운터=저격/폭격/전자전(위 분기에서 처리).
  if (aSize === 'assembled') {
    if (tSize === 'frigate' || tRole === 'tackle') mult *= 1.14; // 광역으로 소형/스크린 처리
    if (tRole === 'ewar') mult *= 0.90;                          // 전자전에 교란
  }

  // Faction doctrine: MCC precision, FSP attrition, CV raiding.
  if (aFaction === 'mcc') {
    if (tSize === 'battleship' || tSize === 'titan') mult *= 1.08;
    if (tRole === 'tackle') mult *= 0.94;
  } else if (aFaction === 'fsp') {
    if (tRole === 'dps' || tFaction === 'cv') mult *= 1.06;
    if (tRole === 'sniper') mult *= 0.96;
  } else if (aFaction === 'cv') {
    if (tFaction === 'mcc' || tRole === 'sniper') mult *= 1.08;
    if (tRole === 'tank' || tFaction === 'fsp') mult *= 0.95;
  }

  return Math.max(0.62, Math.min(1.42, mult));
}

function applyDamage(target, targetFleet, damage, attacker, attackerFleet, state, events) {
  // 실드가 있으면 먼저 실드로 흡수
  let remainingDamage = damage;
  if (target.shield_hp > 0) {
    const shieldAbsorb = Math.min(target.shield_hp, remainingDamage);
    target.shield_hp -= shieldAbsorb;
    remainingDamage  -= shieldAbsorb;
  }

  target.hp -= remainingDamage;
  attacker.damageDealt += damage;
  targetFleet.hp = Math.max(0, targetFleet.hp - remainingDamage);
  
  if (target.hp <= 0) {
    target.hp = 0;
    target.isAlive = false;
    attacker.killsDealt++;
    
    // 대형함 격침은 이벤트 기록
    if (['cruiser','battleship','titan'].includes(target.size_class)) {
      events.push({
        tick: state.tick, type: 'ship_destroyed',
        fleet_id: targetFleet.id, ship_id: target.id,
        payload: {
          ship_type: target.ship_type_code,
          size_class: target.size_class,
          killer_fleet_id: attackerFleet.id,
          killer_wallet: attackerFleet.owner_wallet,
        }
      });
    }
    
    // 기함 격침 → 기함만 사망 처리 (나머지 함선은 계속 전투)
    // 전투는 HP(함선 전멸) 또는 항복으로만 끝남
    if (target.isFlagship) {
      targetFleet.flagshipDead = true; // 상태 표시용 (dead cascade 제거)
      events.push({
        tick: state.tick, type: 'flagship_destroyed',
        fleet_id: targetFleet.id,
        payload: {
          fleet_name: targetFleet.name,
          killer_fleet_id: attackerFleet.id,
        }
      });
      // 기함이 죽어도 나머지 함선은 계속 싸움 — 전멸할 때까지 전투 지속
    }
  }
}

// ─── 프레임 캡처 (렌더링용 스냅샷) ───

function captureFrame(state, tick) {
  return {
    t: tick,
    fleets: state.fleets.map(f => ({
      id: f.id,
      cx: Math.round(f.cx * 10) / 10,
      cy: Math.round(f.cy * 10) / 10,
      facing: Math.round(f.facingAngle * 100) / 100,
      formation: f.formation,
      movement: f.movement,
      hp: f.hp,
      maxHp: f.maxHp,
      side: f.side,
      dead: f.dead,
      // [Phase 3] 라이브 수동스킬 충전(0~100) — precompute 경로엔 undefined→0
      beamCharge: Math.round(f.beamCharge || 0),
      missileCharge: Math.round(f.missileCharge || 0),
      overdriveCharge: Math.round(f.overdriveCharge || 0),
      hasAssembled: f.ships.some(s => s.isAlive && s.size_class === 'assembled'),
    })),
    ships: state.fleets.flatMap(f =>
      f.ships.filter(s => s.isAlive).map(s => ({
        id: s.id,
        fid: f.id,
        x: Math.round(s.x * 10) / 10,
        y: Math.round(s.y * 10) / 10,
        hp: s.hp,
        ff: s.isFlagship ? 1 : 0,
        code: s.ship_type_code,
      }))
    ),
  };
}

// ─── 통계 ───

function computeBattleStats(state) {
  const stats = {
    atk: { ships_total: 0, ships_lost: 0, damage_dealt: 0, kills: 0 },
    def: { ships_total: 0, ships_lost: 0, damage_dealt: 0, kills: 0 },
    by_fleet: [],
    by_player: {},   // wallet → { damage, kills, ships_lost }
    by_ship: [],
  };
  
  for (const fleet of state.fleets) {
    const side = stats[fleet.side];
    const lostInFleet = fleet.ships.filter(s => !s.isAlive).length;
    
    side.ships_total += fleet.ships.length;
    side.ships_lost += lostInFleet;
    
    let fleetDamage = 0, fleetKills = 0;
    for (const s of fleet.ships) {
      fleetDamage += s.damageDealt;
      fleetKills += s.killsDealt;
      stats.by_ship.push({
        ship_id: s.id,
        fleet_id: fleet.id,
        owner_wallet: fleet.owner_wallet,
        side: fleet.side,
        is_alive: !!s.isAlive,
        current_hp: Math.max(0, Math.round(parseFloat(s.hp) || 0)),
        shield_hp: Math.max(0, Math.round(parseFloat(s.shield_hp) || 0)), // (v7.375) 전투 후 소모된 실드 영속용
        max_hp: s.maxHp,
        bonus_atk: s.bonus_atk || 0,
        bonus_def: s.bonus_def || 0,
        bonus_hp: s.bonus_hp || 0,
        bonus_speed: s.bonus_speed || 0,
        damage_dealt: Math.round(parseFloat(s.damageDealt) || 0),
        kills: s.killsDealt || 0,
      });
    }
    side.damage_dealt += fleetDamage;
    side.kills += fleetKills;
    
    stats.by_fleet.push({
      fleet_id: fleet.id,
      owner_wallet: fleet.owner_wallet,
      side: fleet.side,
      ships_total: fleet.ships.length,
      ships_lost: lostInFleet,
      damage_dealt: fleetDamage,
      kills: fleetKills,
    });
    
    // 유저별 집계
    if (fleet.owner_wallet) {
      if (!stats.by_player[fleet.owner_wallet]) {
        stats.by_player[fleet.owner_wallet] = {
          wallet: fleet.owner_wallet,
          side: fleet.side,
          damage: 0, kills: 0, ships_lost: 0,
        };
      }
      stats.by_player[fleet.owner_wallet].damage += fleetDamage;
      stats.by_player[fleet.owner_wallet].kills += fleetKills;
      stats.by_player[fleet.owner_wallet].ships_lost += lostInFleet;
    }
  }
  
  return stats;
}

// ─── 유틸 ───

function distance(a, b) {
  return Math.hypot((a.cx || a.x) - (b.cx || b.x), (a.cy || a.y) - (b.cy || b.y));
}
function distanceFleet(ship, fleet) {
  return Math.hypot(ship.x - fleet.cx, ship.y - fleet.cy);
}

// ─── 사후 처리: DB 반영 ───

/**
 * 시뮬레이션 결과를 DB에 반영
 *   - fleet_battles 상태 업데이트
 *   - ships 생존 상태 업데이트
 *   - fleets 전적 업데이트
 */
async function applyBattleResults(battleId, result) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // [v7.63] 이중 적용 방지: FOR UPDATE로 전투 행 잠금 후 status 재확인
    const { rows: btRows } = await client.query(
      `SELECT battle_type, status, governor_siege_id, battle_summary FROM fleet_battles WHERE id = $1 FOR UPDATE`, [battleId]
    );
    if (!btRows[0] || btRows[0].status === 'ended') {
      await client.query('ROLLBACK');
      console.warn(`[battleEngine] applyBattleResults: battle ${battleId} already ended, skipping`);
      return { skipped: true };
    }
    const isHijackBattle = (btRows[0].battle_type || '').startsWith('hijack');
    // [v7.127][EVE 수요엔진] 하이젝에서도 함선 영구파괴 옵션(기본 OFF=현행 HP 보존).
    // 켜면 격침(sim HP≤0) 함선은 is_alive=false 로 영구 파괴 → 재건조 수요 발생(EVE full-loss).
    // 일반 전투(AI/토너먼트 등)는 원래부터 영구파괴이므로 영향 없음.
    const hijackShipLoss = isHijackBattle &&
      String(await getSetting('hijack_ship_loss_enabled', 'false')) === 'true';
    // [v7.243][레드팀 수정] 공성(siege) 전투도 함선 영구전사를 siege_full_loss_enabled 플래그로 게이트.
    //   이전엔 siege 가 일반 전투 분기로 빠져 플래그(기본 false)를 무시하고 무조건 영구파괴 → 설계상
    //   '경제 재균형 전까지 전사 OFF' 계약 위반. 플래그 OFF 면 hijack 비전사와 동일하게 HP 15% 보존.
    const isSiegeBattle = (btRows[0].battle_type || '') === 'siege';
    // [v7.258][레드팀 수정] 커맨더 공성(siege_kind='commander')은 별도 commander_full_loss_enabled(기본 false)로 게이트.
    //   맹주전 함대 전손은 경제 충격이 커, 일반 섹터 공성의 siege_full_loss_enabled 와 분리.
    let _isCommanderSiege = false;
    if (isSiegeBattle && btRows[0].governor_siege_id) {
      try {
        const gk = await client.query('SELECT siege_kind FROM governor_sieges WHERE id = $1', [btRows[0].governor_siege_id]);
        _isCommanderSiege = gk.rows[0] && gk.rows[0].siege_kind === 'commander';
      } catch (_) { /* 컬럼 미존재 — 일반 siege 취급 */ }
    }
    const siegeShipLoss = isSiegeBattle &&
      String(await getSetting(_isCommanderSiege ? 'commander_full_loss_enabled' : 'siege_full_loss_enabled', 'false')) === 'true';

    // 1. fleet_battles 업데이트 — AND status != 'ended' 이중 UPDATE 방지 [v7.63]
    const { rowCount: battleRowCount } = await client.query(`
      UPDATE fleet_battles SET
        status = 'ended',
        winner_side = $1,
        duration_seconds = $2,
        atk_ships_total = $3,
        def_ships_total = $4,
        atk_ships_lost = $5,
        def_ships_lost = $6,
        ended_at = NOW(),
        battle_summary = COALESCE(battle_summary, '{}'::jsonb) || $7::jsonb
      WHERE id = $8 AND status != 'ended'
    `, [
      result.winner_side,
      result.duration_seconds,
      result.stats.atk.ships_total,
      result.stats.def.ships_total,
      result.stats.atk.ships_lost,
      result.stats.def.ships_lost,
      JSON.stringify({
        atk: result.stats.atk,
        def: result.stats.def,
        by_player: result.stats.by_player,
        final_ships: result.stats.by_ship,
      }),
      battleId
    ]);
    if (battleRowCount === 0) {
      await client.query('ROLLBACK');
      console.warn(`[battleEngine] applyBattleResults: battle ${battleId} row not updated (already ended?), aborting`);
      return { skipped: true };
    }

    // 2. 함대별 전적 업데이트 + 함선 사망 처리
    for (const fleetStat of result.stats.by_fleet) {
      const won = fleetStat.side === result.winner_side;
      await client.query(`
        UPDATE fleets SET
          is_in_battle = false,
          current_battle_id = NULL,
          total_kills = total_kills + $1,
          battles_won = battles_won + $2,
          battles_lost = battles_lost + $3,
          updated_at = NOW()
        WHERE id = $4
      `, [fleetStat.kills, won ? 1 : 0, won ? 0 : 1, fleetStat.fleet_id]);
      
      // fleet_battle_participants 통계 업데이트
      await client.query(`
        UPDATE fleet_battle_participants SET
          ships_alive = ships_at_start - $1,
          ships_lost = $1,
          damage_dealt = $2
        WHERE battle_id = $3 AND fleet_id = $4
      `, [fleetStat.ships_lost, fleetStat.damage_dealt, battleId, fleetStat.fleet_id]);
    }
    
    // 3. 함선 상태 업데이트
    const finalShips = Array.isArray(result.stats?.by_ship)
      ? result.stats.by_ship.filter(s => parseInt(s.ship_id) > 0)
      : [];
    // 하이젝 전투: 기본은 함선 파괴하지 않고 HP만 감소 (min 15% of max_hp, 최소 1).
    // hijack_ship_loss_enabled=true 면 격침 함선을 영구 파괴(EVE full-loss 수요엔진).
    if (isHijackBattle || (isSiegeBattle && !siegeShipLoss)) {
      // 하이젝 전투 + [v7.243] 전사 OFF 공성 — 시뮬레이션 HP 반영, 격침함은 영구파괴 대신 15% 보존.
      //   (siege full-loss ON 이면 이 분기를 타지 않고 아래 일반 분기에서 영구파괴.)
      for (const s of finalShips) {
        const sid = parseInt(s.ship_id);
        const simHp = Math.round(parseFloat(s.current_hp) || 0);
        if (simHp <= 0) {
          if (hijackShipLoss) {
            // [EVE full-loss] 영구 파괴
            await client.query(`
              UPDATE ships SET is_alive = false, destroyed_at = NOW(), current_hp = 0
              WHERE id = $1 AND is_alive = true
            `, [sid]);
          } else {
            await client.query(`
              UPDATE ships
              SET current_hp = GREATEST(1, ROUND((max_hp + COALESCE(bonus_hp, 0)) * 0.15)),
                  shield_hp = 0
              WHERE id = $1 AND is_alive = true
            `, [sid]);
          }
        } else {
          await client.query(`
            UPDATE ships
            SET current_hp = LEAST(current_hp, max_hp + COALESCE(bonus_hp, 0), $1),
                shield_hp = GREATEST(0, $3)
            WHERE id = $2 AND is_alive = true
          `, [simHp, sid, Math.round(parseFloat(s.shield_hp) || 0)]);
        }
      }
    } else {
      // 일반 전투 — 최종 함선 스냅샷 기준으로 생존/부분 HP를 모두 반영
      if (finalShips.length > 0) {
        for (const s of finalShips) {
          const sid = parseInt(s.ship_id);
          const hp = Math.max(0, Math.round(parseFloat(s.current_hp) || 0));
          if (!s.is_alive || hp <= 0) {
            await client.query(`
              UPDATE ships SET is_alive = false, destroyed_at = NOW(), current_hp = 0
              WHERE id = $1 AND is_alive = true
            `, [sid]);
          } else {
            await client.query(`
              UPDATE ships
              SET current_hp = LEAST(current_hp, max_hp + COALESCE(bonus_hp, 0), $1),
                  shield_hp = GREATEST(0, $3)
              WHERE id = $2 AND is_alive = true
            `, [hp, sid, Math.round(parseFloat(s.shield_hp) || 0)]);
          }
        }
      } else {
        // 구형 결과 객체 방어: 이벤트만 있더라도 격침 처리는 유지
        for (const ev of result.events) {
          if ((ev.type === 'ship_destroyed' || ev.type === 'flagship_destroyed') && ev.ship_id) {
            await client.query(`
              UPDATE ships SET is_alive = false, destroyed_at = NOW(), current_hp = 0
              WHERE id = $1
            `, [ev.ship_id]);
          }
        }
      }
    }
    
    // ─── [v7.358] 킬보드: 격침 함선 귀속 기록 (ship_wrecks) ───
    //   full-loss로 영구파괴된 함선마다 victim/killer를 fleet_battle_participants(fleet→side→wallet)로
    //   매핑해 기록. 보존 분기(hijack 비전사 등)는 파괴가 없으므로 wreck 없음.
    try {
      await client.query('SAVEPOINT _kb');  // 킬보드 로깅 실패가 전투 결과 트랜잭션을 오염시키지 않게 격리
      // [v7.365] AI 연습전투(ai/fight)는 킬보드 집계 제외 — 약한 NPC 상대로 킬 인플레 방지(리더보드 오염).
      const _isAiBattle = !!(btRows[0].battle_summary && btRows[0].battle_summary.is_ai_battle);
      const _lossBranch = isHijackBattle || (isSiegeBattle && !siegeShipLoss);
      const _fullLoss = (_lossBranch ? hijackShipLoss : true) && !_isAiBattle; // 일반전 영구파괴, 단 AI전은 wreck 미기록
      let _destroyedIds = [];
      if (_fullLoss && finalShips.length > 0) {
        _destroyedIds = finalShips
          .filter(s => Math.round(parseFloat(s.current_hp) || 0) <= 0 || (!_lossBranch && s.is_alive === false))
          .map(s => parseInt(s.ship_id)).filter(id => id > 0);
      } else if (_fullLoss) {
        _destroyedIds = (result.events || [])
          .filter(ev => (ev.type === 'ship_destroyed' || ev.type === 'flagship_destroyed') && ev.ship_id)
          .map(ev => parseInt(ev.ship_id)).filter(id => id > 0);
      }
      if (_destroyedIds.length > 0) {
        const salvageHours = parseInt(await getSetting('ship_wreck_salvage_hours', '24'), 10) || 24;
        const { rows: _parts } = await client.query(
          `SELECT fleet_id, side, LOWER(wallet_address) AS wallet FROM fleet_battle_participants WHERE battle_id = $1`,
          [battleId]
        );
        const _sideWallet = {}; const _fleetSide = {};
        for (const p of _parts) {
          _fleetSide[String(p.fleet_id)] = p.side;
          if (!_sideWallet[p.side]) _sideWallet[p.side] = p.wallet; // 상대측 대표(소형함 폴백)
        }
        // [Codex P2] 대형함 격침 이벤트는 정확한 killer_wallet 보유 → 멀티함대 귀속 정확화.
        //   소형함(이벤트 없음)은 상대측 대표로 폴백.
        const _killerByShip = {};
        for (const ev of (result.events || [])) {
          if ((ev.type === 'ship_destroyed' || ev.type === 'flagship_destroyed') && ev.ship_id && ev.payload && ev.payload.killer_wallet) {
            _killerByShip[String(parseInt(ev.ship_id))] = String(ev.payload.killer_wallet).toLowerCase();
          }
        }
        const _seen = new Set();
        for (const sid of _destroyedIds) {
          if (_seen.has(sid)) continue; _seen.add(sid);
          const { rows: sr } = await client.query(
            `SELECT LOWER(owner_wallet) AS owner, fleet_id, ship_type_code FROM ships WHERE id = $1`, [sid]
          );
          if (!sr[0]) continue;
          const vSide = _fleetSide[String(sr[0].fleet_id)] || null;
          const kSide = vSide === 'atk' ? 'def' : vSide === 'def' ? 'atk' : null;
          const kWallet = _killerByShip[String(sid)] || (kSide ? (_sideWallet[kSide] || null) : null);
          await client.query(
            `INSERT INTO ship_wrecks (battle_id, ship_instance_id, ship_type, original_owner, victim_side, killer_wallet, killer_side, expires_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7, NOW() + ($8 || ' hours')::INTERVAL)`,
            [battleId, sid, sr[0].ship_type_code, sr[0].owner, vSide, kWallet, kSide, String(salvageHours)]
          );
        }
      }
      await client.query('RELEASE SAVEPOINT _kb');
    } catch (_wreckErr) {
      try { await client.query('ROLLBACK TO SAVEPOINT _kb'); } catch (_) {}
      console.warn('[battleEngine] killboard/wreck log failed:', _wreckErr.message);
    }

    // 4. 전투 이벤트 로그
    for (const ev of result.events.slice(0, 1000)) {  // 최대 1000개
      await client.query(`
        INSERT INTO fleet_battle_events (battle_id, event_type, fleet_id, ship_id, payload, tick)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [battleId, ev.type, ev.fleet_id || null, ev.ship_id || null, 
          JSON.stringify(ev.payload || {}), ev.tick]);
    }
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  simulateBattle,
  simulateBattleLive,
  applyLiveCommand,
  applyBattleResults,
  getShipMatchupMult,
  TICK_MS,
  MAX_TICKS,
  FIELD_W,
  FIELD_H,
};
