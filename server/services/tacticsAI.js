// server/services/tacticsAI.js
// ═══════════════════════════════════════════════════════════════
// Tactics AI — 함대의 상황에 따라 자동으로 전술 전환
//
// v11 프로토타입의 7가지 자동 전환 룰:
//   1. HP 70% 이하 + 적이 laser 집중 → retreat
//   2. HP 35% 이하 + laser 많이 맞음 → scatter
//   3. 증원 도착 → rally
//   4. 적 함선 절반 이하 → flank
//   5. 적이 retreat 중 → advance + wedge
//   6. 다수 적에게 포위 → pincer
//   7. 기본 상태 → advance + sphere
// ═══════════════════════════════════════════════════════════════

const COOLDOWN_TICKS = 25;   // 5초 (200ms × 25) 연속 변경 방지

/**
 * 함대의 전술을 평가하고 필요하면 변경
 * 전투 시작 시 유저가 설정한 진형/기동이 기본. AI는 위급 상황에서만 개입.
 * @param {Object} fleet - 함대 상태
 * @param {Object} state - 전체 전투 상태
 * @param {Array}  events - 이벤트 로그 (기록용)
 */
function evaluate(fleet, state, events) {
  // 쿨다운 중이면 변경 금지
  if (fleet.tacticCooldown > 0) {
    fleet.tacticCooldown--;
    return;
  }
  
  // laser hit decay (시간 지나면 자연스럽게 감소)
  if (fleet.laserHitDecay > 0) {
    fleet.laserHitDecay -= 200; // 1 tick = 200ms
    if (fleet.laserHitDecay <= 0) {
      fleet.laserHits = Math.max(0, fleet.laserHits - 1);
      fleet.laserHitDecay = fleet.laserHits > 0 ? 500 : 0;
    }
  }
  
  const hpRatio = fleet.maxHp > 0 ? fleet.hp / fleet.maxHp : 0;
  const enemies = state.fleets.filter(e => e.side !== fleet.side && !e.dead);
  
  if (!enemies.length) {
    // 적 없음 → 대기
    if (fleet.movement !== 'rally') {
      changeTactic(fleet, null, 'rally', 'no_enemies', events, state);
    }
    return;
  }
  
  // 적 상태 분석
  const totalEnemies = enemies.length;
  const enemyShipsAlive = enemies.reduce((sum, e) => 
    sum + e.ships.filter(s => s.isAlive).length, 0);
  const myShipsAlive = fleet.ships.filter(s => s.isAlive).length;
  const enemyRetreating = enemies.filter(e => e.movement === 'retreat').length;
  
  // ─── 룰 1: 중상 + 레이저 집중 → 즉시 retreat ───
  if (hpRatio < 0.35 && fleet.laserHits >= 5) {
    if (fleet.movement !== 'scatter') {
      changeTactic(fleet, 'sphere', 'scatter', 'critical_laser_focus', events, state);
      return;
    }
  }
  
  // ─── 룰 2: 위험 수준 HP → retreat ───
  if (hpRatio < 0.30) {
    if (fleet.movement !== 'retreat' && fleet.movement !== 'scatter') {
      changeTactic(fleet, null, 'retreat', 'critical_hp', events, state);
      return;
    }
  }
  
  // ─── 룰 3: 레이저 많이 맞고 HP 중간 → scatter로 산개 ───
  if (hpRatio < 0.70 && fleet.laserHits >= 3 && fleet.movement !== 'scatter') {
    changeTactic(fleet, null, 'scatter', 'laser_detected', events, state);
    return;
  }
  
  // ─── 룰 4: 적이 적음 + 내가 우세 → wedge + flank ───
  if (myShipsAlive >= enemyShipsAlive * 1.5 && hpRatio > 0.60) {
    if (fleet.formation !== 'wedge' || fleet.movement !== 'flank') {
      changeTactic(fleet, 'wedge', 'flank', 'numerical_advantage', events, state);
      return;
    }
  }
  
  // ─── 룰 5: 적이 전부 후퇴 중 → 공격 전진 ───
  if (enemyRetreating === totalEnemies && fleet.movement !== 'advance') {
    changeTactic(fleet, 'wedge', 'advance', 'pursue_retreating', events, state);
    return;
  }
  
  // ─── 룰 6: 여러 적에게 포위 + HP 여유 → pincer ───
  if (totalEnemies >= 2 && hpRatio > 0.70) {
    if (fleet.formation !== 'pincer') {
      changeTactic(fleet, 'pincer', null, 'multiple_enemies', events, state);
      return;
    }
  }
  
  // ─── 룰 7: HP 회복됨 + scatter 중이었음 → rally로 재집결 ───
  if (hpRatio > 0.80 && fleet.movement === 'scatter') {
    changeTactic(fleet, 'sphere', 'rally', 'regrouping', events, state);
    return;
  }
  
  // ─── 룰 8: rally 후 안정화 → advance ───
  if (fleet.movement === 'rally' && hpRatio > 0.65) {
    // 주변에 적이 가까우면 진형 유지, 아니면 전진
    const nearestEnemyDist = Math.min(...enemies.map(e => 
      Math.hypot(e.cx - fleet.cx, e.cy - fleet.cy)
    ));
    if (nearestEnemyDist > fleet.radius + 150) {
      changeTactic(fleet, null, 'advance', 'rally_complete', events, state);
      return;
    }
  }
}

/**
 * 전술 변경 (쿨다운 적용)
 * @param {Object} fleet
 * @param {string|null} newFormation - null이면 현재 유지
 * @param {string|null} newMovement  - null이면 현재 유지
 * @param {string} reason
 * @param {Array} events
 * @param {Object} state
 */
function changeTactic(fleet, newFormation, newMovement, reason, events, state) {
  const changes = {};
  
  if (newFormation && newFormation !== fleet.formation) {
    changes.formation = { from: fleet.formation, to: newFormation };
    fleet.formation = newFormation;
    // slot 재할당 필요
    for (const s of fleet.ships) s.slotAssigned = false;
  }
  
  if (newMovement && newMovement !== fleet.movement) {
    changes.movement = { from: fleet.movement, to: newMovement };
    fleet.movement = newMovement;
  }
  
  if (Object.keys(changes).length === 0) return;  // 변경 없음
  
  fleet.tacticCooldown = COOLDOWN_TICKS;
  
  events.push({
    tick: state.tick,
    type: 'tactic_changed',
    fleet_id: fleet.id,
    payload: {
      reason,
      hp_ratio: Math.round((fleet.hp / fleet.maxHp) * 100) / 100,
      laser_hits: fleet.laserHits,
      ...changes,
    }
  });
}

module.exports = { evaluate };
