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

const { pool } = require('../db');
const tacticsAI = require('./tacticsAI');

// ─── 상수 ───

const TICK_MS = 200;                    // 5 tick/sec
const MAX_TICKS = 9000;                 // 30분 한도 (5tick × 60s × 30m)
const FIELD_W = 1000;
const FIELD_H = 440;

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
      if (!fleet.dead) tacticsAI.evaluate(fleet, state, events);
    }
    
    // 함대 이동
    for (const fleet of state.fleets) {
      if (!fleet.dead) updateFleetPosition(fleet, state);
    }
    
    // 함선 위치 갱신 (진형 적용)
    for (const fleet of state.fleets) {
      if (!fleet.dead) updateShipPositions(fleet);
    }
    
    // 전투 처리 (발사 + 데미지)
    processCombat(state, events);
    
    // 프레임 저장 (매 5tick = 1초마다 저장. 렌더 시 보간)
    if (tick % 5 === 0) {
      timeline.frames.push(captureFrame(state, tick));
    }
    
    // 승패 체크
    const atkAlive = state.fleets.filter(f => f.side === 'atk' && !f.dead).length;
    const defAlive = state.fleets.filter(f => f.side === 'def' && !f.dead).length;
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
  
  // 시간 초과
  if (!winnerSide) {
    const atkHp = state.fleets.filter(f => f.side === 'atk').reduce((a,f) => a + f.hp, 0);
    const defHp = state.fleets.filter(f => f.side === 'def').reduce((a,f) => a + f.hp, 0);
    winnerSide = atkHp > defHp ? 'atk' : defHp > atkHp ? 'def' : 'draw';
    events.push({
      tick: state.tick, type: 'battle_timeout',
      payload: { winner_side: winnerSide }
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
      f.formation, f.movement,
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
             st.name_ko, st.size_class, st.role,
             st.base_atk, st.base_def, st.base_speed,
             st.fire_interval, st.fire_type, st.shots, st.render_radius
      FROM ships s
      JOIN ship_types st ON st.code = s.ship_type_code
      WHERE s.fleet_id = $1 AND s.is_alive = true
      ORDER BY s.is_flagship DESC, st.sort_order DESC
    `, [fr.fleet_id]);
    
    fleets.push({
      ...fr,
      ships: shipRows,
    });
  }
  
  return { battle, fleets };
}

// ─── 전투 상태 초기화 ───

function initBattleState(battleData) {
  const { battle, fleets } = battleData;
  
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
      
      hp: maxHp, maxHp,
      dead: false,
      
      // AI 상태
      laserHits: 0,
      laserHitDecay: 0,
      recentReinforce: false,
      tacticCooldown: 0,
      
      ships: f.ships.map((s, idx) => initShip(s, pos, idx, f.ships.length, radius)),
    };
  });
  
  return {
    battle_id: battle.id,
    battle_type: battle.battle_type,
    tick: 0,
    fleets: stateFleets,
  };
}

function initShip(shipData, fleetPos, idx, total, fleetRadius) {
  // 초기 배치: 랜덤 오비탈
  const orbitAngle = (idx / total) * Math.PI * 2 + Math.random() * 0.3;
  const orbitDist = 15 + Math.random() * (fleetRadius - 15);
  
  return {
    id: shipData.id,
    ship_type_code: shipData.ship_type_code,
    name: shipData.name_ko,
    size_class: shipData.size_class,
    role: shipData.role,
    
    // 스탯
    atk: parseInt(shipData.base_atk) + parseInt(shipData.bonus_atk || 0),
    def: parseInt(shipData.base_def) + parseInt(shipData.bonus_def || 0),
    speed: parseFloat(shipData.base_speed),
    fireInterval: parseInt(shipData.fire_interval),
    fireType: shipData.fire_type,
    shots: parseInt(shipData.shots) || 1,
    renderRadius: parseFloat(shipData.render_radius) || 2,
    
    maxHp: parseInt(shipData.max_hp) + parseInt(shipData.bonus_hp || 0),
    hp: parseInt(shipData.current_hp),
    
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
  advance: 1.0, retreat: 1.5, flank: 1.2, scatter: 1.8, rally: 0.6,
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
  } else if (fleet.movement === 'flank') {
    const perpX = -dy/dist, perpY = dx/dist;
    const side = Math.sign(perpY * ((FIELD_H/2 - fleet.cy) > 0 ? 1 : -1)) || 1;
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
  for (const fleet of state.fleets) {
    if (fleet.dead) continue;
    
    for (const ship of fleet.ships) {
      if (!ship.isAlive) continue;
      
      ship.shootT += TICK_MS;
      if (ship.shootT < ship.fireInterval) continue;
      ship.shootT = 0;
      
      // Repair는 아군 체력 회복
      if (ship.fireType === 'repair') {
        processRepair(fleet, ship);
        continue;
      }
      
      // 공격 대상 찾기 (가장 가까운 적 함대의 랜덤 함선)
      const enemies = state.fleets.filter(e => e.side !== fleet.side && !e.dead);
      if (!enemies.length) continue;
      
      // 타겟 함대
      let targetFleet = enemies[0];
      let minDist = distanceFleet(ship, enemies[0]);
      for (const e of enemies) {
        const d = distanceFleet(ship, e);
        if (d < minDist) { minDist = d; targetFleet = e; }
      }
      
      // 타겟 함대에서 살아있는 함선 랜덤 선택
      const aliveTargets = targetFleet.ships.filter(s => s.isAlive);
      if (!aliveTargets.length) continue;
      
      const target = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
      
      // 데미지 계산
      const damage = computeDamage(ship, target);
      applyDamage(target, targetFleet, damage, ship, fleet, state, events);
      
      // 레이저/폭격은 명중 확정 → laserHits 증가
      if (ship.fireType === 'laser' || ship.fireType === 'stealth_bomb') {
        targetFleet.laserHits = (targetFleet.laserHits || 0) + 1;
        targetFleet.laserHitDecay = 2000;
      }
    }
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
  else if (attacker.fireType === 'stealth_bomb') typeMult = 2.5; // 폭격 큰 데미지
  else if (attacker.fireType === 'ew') typeMult = 0.3; // EW는 낮은 딜
  
  return Math.max(1, Math.floor(raw * variance * typeMult));
}

function applyDamage(target, targetFleet, damage, attacker, attackerFleet, state, events) {
  target.hp -= damage;
  attacker.damageDealt += damage;
  targetFleet.hp = Math.max(0, targetFleet.hp - damage);
  
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
    
    // 기함 격침 → 함대 괴멸
    if (target.isFlagship) {
      targetFleet.dead = true;
      events.push({
        tick: state.tick, type: 'flagship_destroyed',
        fleet_id: targetFleet.id,
        payload: { 
          fleet_name: targetFleet.name,
          killer_fleet_id: attackerFleet.id,
        }
      });
      // 함대 내 모든 함선 죽음 처리 (기함 잃으면 함대 해체)
      for (const s of targetFleet.ships) {
        if (s.isAlive) s.isAlive = false;
      }
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
      dead: f.dead,
    })),
    ships: state.fleets.flatMap(f => 
      f.ships.filter(s => s.isAlive).map(s => ({
        id: s.id,
        fid: f.id,
        x: Math.round(s.x * 10) / 10,
        y: Math.round(s.y * 10) / 10,
        hp: s.hp,
        ff: s.isFlagship ? 1 : 0,
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
    
    // 1. fleet_battles 업데이트
    await client.query(`
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
      WHERE id = $8
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
      }),
      battleId
    ]);
    
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
    
    // 3. 죽은 함선 상태 업데이트
    // timeline 마지막 프레임에서 isAlive=false인 애들 처리
    // 간단히: events 중 ship_destroyed / flagship_destroyed 로 처리
    for (const ev of result.events) {
      if (ev.type === 'ship_destroyed' || ev.type === 'flagship_destroyed') {
        if (ev.ship_id) {
          await client.query(`
            UPDATE ships SET is_alive = false, destroyed_at = NOW(), current_hp = 0
            WHERE id = $1
          `, [ev.ship_id]);
        }
        if (ev.type === 'flagship_destroyed' && ev.fleet_id) {
          // 함대의 모든 함선 사망 처리
          await client.query(`
            UPDATE ships SET is_alive = false, destroyed_at = NOW(), current_hp = 0
            WHERE fleet_id = $1 AND is_alive = true
          `, [ev.fleet_id]);
        }
      }
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
  applyBattleResults,
  TICK_MS,
  MAX_TICKS,
  FIELD_W,
  FIELD_H,
};
