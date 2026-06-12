// server/services/battleReport.js
// ═══════════════════════════════════════════════════════════════
// 전투 결과 리포트 생성 서비스
// - generateBattleReport(battleId) → BattleReport JSON
// - getPlayerBattleStats(wallet) → 전투 통계 집계
// - calcPerformanceRating(damage, shipsLost, won) → S/A/B/C/D
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');

// ── 퍼포먼스 레이팅 계산 ──────────────────────────────────────
function calcPerformanceRating(damageDealt, shipsLost, totalShips, won) {
  const efficiency = damageDealt / ((shipsLost || 0) + 1) / 1000;
  const survivalRate = totalShips > 0 ? (totalShips - (shipsLost || 0)) / totalShips : 0;

  if (won && efficiency > 15 && survivalRate > 0.7) return 'S';
  if (won && efficiency > 8)  return 'A';
  if (won)                    return 'B';
  if (!won && efficiency > 6) return 'C';
  return 'D';
}

// ── CPI 계산 (Combat Power Index) ─────────────────────────────
function calcFleetCPI(ships) {
  if (!ships || ships.length === 0) return 0;
  const base = ships.reduce((sum, s) => {
    const atk   = (s.atk   || 0) + (s.bonus_atk   || 0);
    const def   = (s.def   || 0) + (s.bonus_def   || 0);
    const hp    = (s.hp    || s.max_hp || 0) + (s.bonus_hp    || 0);
    const spd   = (s.speed || 0) + (s.bonus_speed || 0);
    return sum + (atk * 2) + (def * 1.5) + (hp * 0.01) + (spd * 0.5);
  }, 0);

  const sizeBonus = ships.length >= 10 ? 1.3
                  : ships.length >= 5  ? 1.2
                  : ships.length >= 3  ? 1.1
                  : 1.0;
  return Math.round(base * sizeBonus * 10) / 10;
}

// ── 하이라이트 생성 ───────────────────────────────────────────
function generateHighlights(events, winner) {
  const highlights = [];
  if (!events || events.length === 0) return highlights;

  // 첫 격침
  const firstKill = events.find(e => e.event_type === 'ship_destroyed');
  if (firstKill) {
    highlights.push({
      tick: firstKill.tick || 0,
      type: 'first_kill',
      text: `First ship destroyed at tick ${firstKill.tick || 0}`
    });
  }

  // 기함 위기 (HP 30% 이하)
  const flagshipCrisis = events.find(e =>
    e.event_type === 'flagship_hp_low' || (e.data && e.data.flagship_hp_pct && e.data.flagship_hp_pct < 30)
  );
  if (flagshipCrisis) {
    highlights.push({
      tick: flagshipCrisis.tick || 0,
      type: 'flagship_threatened',
      text: 'Flagship HP dropped below 30%'
    });
  }

  // 전세 역전 (함선 수 역전)
  const turningPoint = events.find(e => e.event_type === 'turning_point');
  if (turningPoint) {
    highlights.push({
      tick: turningPoint.tick || 0,
      type: 'turning_point',
      text: 'Fleet gained decisive advantage'
    });
  }

  // 전투 종료
  if (winner) {
    highlights.push({
      tick: events.length > 0 ? (events[events.length - 1].tick || 0) : 0,
      type: 'battle_end',
      text: winner === 'draw' ? 'Battle ended in a draw' : `${winner.toUpperCase()} fleet victorious`
    });
  }

  return highlights;
}

// ── 함선 클래스 판별 ──────────────────────────────────────────
function getShipClass(ship) {
  const size = String(ship.size_class || '').toLowerCase();
  const code = String(ship.type_code || ship.ship_type_code || ship.code || '').toLowerCase();
  for (const cls of ['frigate', 'destroyer', 'cruiser', 'battleship', 'titan']) {
    if (size === cls || code.includes(cls)) return cls;
  }
  if (code.includes('_ff') || code.includes('-ff')) return 'frigate';
  if (code.includes('_dd') || code.includes('-dd')) return 'destroyer';
  if (code.includes('_ca') || code.includes('-ca')) return 'cruiser';
  if (code.includes('_bs') || code.includes('-bs')) return 'battleship';
  return size || (code.split('_')[1] || code.split('-')[1]) || 'unknown';
}

function getShipRole(ship) {
  const role = String(ship.role || ship.ship_role || '').toLowerCase();
  const code = String(ship.type_code || ship.ship_type_code || ship.code || '').toLowerCase();
  if (role) return role;
  if (code.includes('ewar') || code.includes('jam')) return 'ewar';
  if (code.includes('logi') || code.includes('repair')) return 'logi';
  if (code.includes('snp') || code.includes('sniper')) return 'sniper';
  if (code.includes('bomb')) return 'bomb';
  if (code.includes('int')) return 'tackle';
  return 'dps';
}

function inc(map, key, by = 1) {
  const k = key || 'unknown';
  map[k] = (map[k] || 0) + by;
  return map[k];
}

function countShipsBy(ships, getter) {
  const out = {};
  for (const s of ships || []) inc(out, getter(s));
  return out;
}

function sumCounts(counts, keys) {
  return keys.reduce((sum, key) => sum + (counts[key] || 0), 0);
}

// ── 클래스별 성과 집계 ────────────────────────────────────────
function buildClassBreakdown(ships, shipsLost, damageByClass = {}) {
  if (!ships || ships.length === 0) return [];
  const classMap = {};
  ships.forEach(s => {
    const cls = getShipClass(s);
    if (!classMap[cls]) classMap[cls] = { class: cls, class_label: cls, deployed: 0, survived: 0, damage: 0 };
    classMap[cls].deployed++;
    if (s.is_alive !== false) classMap[cls].survived++;
  });
  const classes = Object.values(classMap).sort((a, b) => b.deployed - a.deployed);
  const survivalRate = ships.length > 0 ? Math.max(0, (ships.length - (shipsLost || 0)) / ships.length) : 0;
  classes.forEach(c => {
    if (shipsLost && c.survived === c.deployed) c.survived = Math.round(c.deployed * survivalRate);
    c.damage        = Math.round(damageByClass[c.class] || 0);
    c.total         = c.deployed;
    c.survival_pct  = c.deployed > 0 ? Math.round((c.survived / c.deployed) * 100) : 0;
    c.perf_label    = c.survival_pct >= 80 ? '핵심 기여'
                    : c.survival_pct >= 40 ? '데미지 높음'
                    : '데미지 낮음';
  });
  return classes;
}

function buildEventStats(events, participants) {
  const stats = {
    ewarHitsTaken: { atk: 0, def: 0 },
    flagshipDestroyed: { atk: false, def: false },
    destroyedBySide: { atk: 0, def: 0 },
    skillsUsed: {
      atk: { beam: 0, missile: 0, overdrive: 0, emp: 0 },
      def: { beam: 0, missile: 0, overdrive: 0, emp: 0 }
    },
    repairDone: { atk: 0, def: 0 },
    manualSkillDamage: { atk: 0, def: 0 }
  };
  for (const ev of events || []) {
    const payload = ev.payload || ev.data || {};
    const targetSide = getSideByFleetId(participants, ev.fleet_id || payload.target_fleet_id);
    if (ev.event_type === 'electronic_warfare' && (targetSide === 'atk' || targetSide === 'def')) {
      stats.ewarHitsTaken[targetSide] += 1;
    }
    if (ev.event_type === 'flagship_destroyed' && (targetSide === 'atk' || targetSide === 'def')) {
      stats.flagshipDestroyed[targetSide] = true;
    }
    if (ev.event_type === 'ship_destroyed' && (targetSide === 'atk' || targetSide === 'def')) {
      stats.destroyedBySide[targetSide] += 1;
    }
    if (ev.event_type === 'manual_skill') {
      const side = payload.side || getSideByFleetId(participants, ev.fleet_id);
      const skill = String(payload.skill || '').toLowerCase();
      if ((side === 'atk' || side === 'def') && stats.skillsUsed[side][skill] !== undefined) {
        stats.skillsUsed[side][skill] += 1;
        stats.manualSkillDamage[side] += toInt(payload.total_damage);
      }
    }
    if (ev.event_type === 'commander_emp_activated') {
      const side = payload.actor_side || (payload.target_side === 'atk' ? 'def' : payload.target_side === 'def' ? 'atk' : null);
      if (side === 'atk' || side === 'def') stats.skillsUsed[side].emp += 1;
    }
    if (ev.event_type === 'repair_pulse') {
      const side = payload.side || getSideByFleetId(participants, ev.fleet_id);
      if (side === 'atk' || side === 'def') stats.repairDone[side] += toInt(payload.amount);
    }
  }
  return stats;
}

function addAnalysis(list, code, severity, text, recs = []) {
  list.push({ code, severity, text, recs });
}

function buildBattleAnalysis(atk, def, result, eventStats) {
  const analysis = [];
  const recs = [];
  const loserSide = result === 'attacker_win' ? 'def' : result === 'defender_win' ? 'atk' : null;
  const winnerSide = result === 'attacker_win' ? 'atk' : result === 'defender_win' ? 'def' : null;
  const loser = loserSide === 'atk' ? atk : loserSide === 'def' ? def : null;
  const winner = winnerSide === 'atk' ? atk : winnerSide === 'def' ? def : null;

  const addCompositionWarnings = (sideData, enemyData, sideLabel) => {
    if (!sideData || !enemyData) return;
    const roles = sideData.role_counts || {};
    const sizes = sideData.size_counts || {};
    const enemyRoles = enemyData.role_counts || {};
    const enemySizes = enemyData.size_counts || {};
    const total = sideData.shipsDeployed || 0;
    if (total <= 0) return;
    const support = sumCounts(roles, ['ewar', 'logi']);
    const capitals = sumCounts(sizes, ['battleship', 'titan', 'assembled']);
    const smalls = sumCounts(sizes, ['frigate']);
    const enemyBombSniper = sumCounts(enemyRoles, ['bomb', 'sniper']);
    const enemySmallRush = sumCounts(enemySizes, ['frigate']);
    if (capitals > 0 && enemyBombSniper >= Math.max(1, capitals) && sumCounts(roles, ['tackle']) < Math.max(1, capitals)) {
      addAnalysis(analysis, `${sideLabel}_counter_warning_capital`, 'warning', `${sideLabel === 'atk' ? '공격군' : '수비군'} 대형함이 상대 저격/폭격 조합에 노출되어 있습니다.`, [
        '대형함 주변에 태클/구축함 호위를 추가',
        '상대 폭격/저격 함선을 집중공격 1순위로 지정'
      ]);
    }
    if (enemySmallRush >= 4 && sumCounts(roles, ['tank']) + sumCounts(sizes, ['destroyer']) === 0) {
      addAnalysis(analysis, `${sideLabel}_counter_warning_small`, 'info', `${sideLabel === 'atk' ? '공격군' : '수비군'}은 소형 러시를 받아낼 구축함/탱커가 부족합니다.`, [
        '구축함 또는 탱커 역할 함선을 최소 1척 이상 배치',
        '스크린 진형으로 초반 소형함 손실을 줄이기'
      ]);
    }
    if (total >= 5 && support === 0) {
      addAnalysis(analysis, `${sideLabel}_support_missing`, 'info', `${sideLabel === 'atk' ? '공격군' : '수비군'}은 지원함 없이 순수 화력으로만 편성되어 장기전에 약합니다.`, [
        '로지/전자전 함선 중 하나를 섞어 지속 교전력 확보'
      ]);
    }
    if (smalls >= total * 0.65 && sumCounts(roles, ['dps', 'bomb', 'sniper']) <= 1) {
      addAnalysis(analysis, `${sideLabel}_low_finish_power`, 'info', `${sideLabel === 'atk' ? '공격군' : '수비군'}은 소형함 비율이 높아 대형함을 끝낼 결정력이 부족할 수 있습니다.`, [
        '순양함 이상 DPS 또는 폭격 함선 추가'
      ]);
    }
  };

  if (!loser || !winner) {
    addAnalysis(analysis, 'draw_attrition', 'info', '양쪽 모두 결정타를 만들지 못했습니다. 화력 집중 또는 기동 명령이 부족했습니다.', [
      '집중공격으로 먼저 녹일 목표를 지정',
      '장기전이면 로지/탱커 비율을 높이고, 단기전이면 폭격/저격 화력을 추가'
    ]);
  } else {
    const loserDamageRatio = winner.totalDamage > 0 ? loser.totalDamage / winner.totalDamage : 1;
    const loserLossRate = loser.shipsDeployed > 0 ? loser.shipsDestroyed / loser.shipsDeployed : 0;
    const winnerLossRate = winner.shipsDeployed > 0 ? winner.shipsDestroyed / winner.shipsDeployed : 0;
    const loserRoles = loser.role_counts || {};
    const winnerRoles = winner.role_counts || {};
    const loserSizes = loser.size_counts || {};
    const winnerSizes = winner.size_counts || {};
    const loserSupport = sumCounts(loserRoles, ['ewar', 'logi']);
    const winnerSupport = sumCounts(winnerRoles, ['ewar', 'logi']);
    const loserCapital = sumCounts(loserSizes, ['battleship', 'titan', 'assembled']);
    const winnerCapitalKillers = sumCounts(winnerRoles, ['sniper', 'bomb']);
    const loserSmall = sumCounts(loserSizes, ['frigate']);
    const winnerAntiSmall = sumCounts(winnerSizes, ['destroyer']) + sumCounts(winnerRoles, ['tank']);
    const loserEwHits = eventStats.ewarHitsTaken[loserSide] || 0;
    const loserSkillUses = Object.values(eventStats.skillsUsed?.[loserSide] || {}).reduce((a, n) => a + (n || 0), 0);
    const winnerSkillUses = Object.values(eventStats.skillsUsed?.[winnerSide] || {}).reduce((a, n) => a + (n || 0), 0);
    const loserManualDmg = eventStats.manualSkillDamage?.[loserSide] || 0;
    const winnerManualDmg = eventStats.manualSkillDamage?.[winnerSide] || 0;
    const loserRepair = eventStats.repairDone?.[loserSide] || 0;
    const winnerRepair = eventStats.repairDone?.[winnerSide] || 0;
    const loserLossValue = toInt(loser.loss_value_gp);
    const winnerLossValue = toInt(winner.loss_value_gp);

    if (loserDamageRatio < 0.55) {
      addAnalysis(analysis, 'damage_gap', 'critical', '화력 교환에서 크게 밀렸습니다. 상대가 훨씬 많은 유효 데미지를 만들었습니다.', [
        '주력 DPS 함선 추가 또는 ATK 강화',
        '집중공격으로 한 함대씩 끊어 데미지 분산을 줄이기'
      ]);
    }
    if (loserLossRate - winnerLossRate > 0.25) {
      addAnalysis(analysis, 'survival_gap', 'warning', '손실률 차이가 큽니다. 전선 유지력이나 방어 진형이 부족했습니다.', [
        '탱커/로지 함선을 섞어 전선 유지력 확보',
        '스크린/핀서 진형으로 소형함 손실을 줄이기'
      ]);
    }
    if (loserCapital > 0 && winnerCapitalKillers >= Math.max(1, loserCapital)) {
      addAnalysis(analysis, 'capital_countered', 'warning', '대형함이 저격/폭격 카운터에 노출됐습니다. 비싼 함선이 먼저 녹으면 전투가 급격히 기웁니다.', [
        '프리깃/디스트로이어 스크린으로 폭격기와 저격함을 먼저 제거',
        '대형함 단독 투입보다 호위 비율을 늘리기'
      ]);
    }
    if (loserSmall >= Math.max(4, loser.shipsDeployed * 0.5) && winnerAntiSmall > 0) {
      addAnalysis(analysis, 'small_screen_countered', 'warning', '소형함 비중이 높은데 상대가 구축함/탱커로 받아쳤습니다.', [
        '크루저 이상 중형 화력을 추가',
        '프리깃 러시는 CV식 폭딜 또는 전자전 지원과 함께 운용'
      ]);
    }
    if (loserEwHits > 0 && (loserRoles.tackle || 0) === 0) {
      addAnalysis(analysis, 'ewar_no_counter', 'warning', '전자전에 맞았지만 태클/소형 추격 전력이 부족해 교란 함선을 빨리 끊지 못했습니다.', [
        '태클 프리깃을 추가해 전자전/로지 함선을 먼저 물기',
        'EMP와 집중공격을 전자전 함대에 우선 사용'
      ]);
    }
    if (winnerSupport > loserSupport + 1) {
      addAnalysis(analysis, 'support_gap', 'info', '상대 지원함 비율이 더 높아 장기 교전에서 효율이 벌어졌습니다.', [
        '로지 또는 전자전 함선을 최소 1~2척 편성',
        '지원함을 보호하는 스크린 진형 사용'
      ]);
    }
    if (winnerSkillUses > 0 && loserSkillUses === 0) {
      addAnalysis(analysis, 'manual_skill_gap', 'warning', '상대는 전술 스킬을 사용했지만 내 함대는 결정타 스킬을 쓰지 못했습니다.', [
        '빔포/미사일 게이지가 100%가 되면 대형함 또는 밀집 함대에 바로 사용',
        'EMP는 상대 주력 화력이 발사 타이밍에 들어오기 직전에 사용'
      ]);
    } else if (winnerManualDmg > loserManualDmg * 1.8 && winnerManualDmg > 0) {
      addAnalysis(analysis, 'skill_damage_gap', 'info', '수동 스킬 데미지 차이가 컸습니다. 전투 중 게이지 운용에서 손해를 봤습니다.', [
        '빔포는 기함/타이탄, 미사일은 소형 다수 편성에 사용',
        '스킬을 아끼기보다 첫 교전 구간에 써서 수적 우위를 먼저 만들기'
      ]);
    }
    if (winnerRepair > loserRepair + 500) {
      addAnalysis(analysis, 'repair_sustain_gap', 'info', '상대 수리 지원이 누적 피해를 되돌리면서 장기전 효율이 벌어졌습니다.', [
        '로지 함선을 먼저 집중공격하거나 태클 프리깃으로 물기',
        '내 함대에도 수리/탱커 조합을 넣어 장기전 대비'
      ]);
    }
    if (loserLossValue > 0 && loserLossValue >= Math.max(500, winnerLossValue * 1.5)) {
      addAnalysis(analysis, 'loss_value_gap', 'warning', '손실 가치가 상대보다 크게 높습니다. 비싼 함선이 보호 없이 교환된 전투입니다.', [
        '고강화/대형함은 방어막·구형·선봉방어 진형으로 보호',
        '전투 전 상대 저격/폭격 비율을 확인하고 호위함을 추가',
        '풀로스 위험 전투에는 예비 함대와 재건 재료를 확보'
      ]);
    }
    if (eventStats.flagshipDestroyed[loserSide]) {
      addAnalysis(analysis, 'flagship_lost', 'critical', '기함이 격침되며 전투 통제력이 무너졌습니다.', [
        '기함은 후방 중심에 두고 방어막/로지 보호',
        '기함 지정 전 HP/DEF가 높은 함선을 우선 선택'
      ]);
    }
    if (!analysis.length) {
      addAnalysis(analysis, 'doctrine_gap', 'info', '전력 차이는 크지 않았지만 진형, 역할 조합, 타겟 지정에서 상대가 더 좋은 교환을 만들었습니다.', [
        '상대 대형함에는 저격/폭격, 상대 소형 러시에는 구축함/탱커를 준비',
        '전투 중 집중공격과 EMP를 게이지가 찼을 때 바로 사용'
      ]);
    }
  }

  addCompositionWarnings(atk, def, 'atk');
  addCompositionWarnings(def, atk, 'def');

  for (const item of analysis) {
    for (const rec of item.recs || []) {
      if (!recs.includes(rec)) recs.push(rec);
      if (recs.length >= 4) break;
    }
    if (recs.length >= 4) break;
  }

  const severityRank = { critical: 0, warning: 1, info: 2 };
  analysis.sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9));

  return {
    analysis_items: analysis.slice(0, 3).map(({ code, severity, text }) => ({ code, severity, text })),
    recommendation_items: recs.slice(0, 4).map((text, idx) => ({ code: `rec_${idx + 1}`, text })),
    analysis_ko: analysis[0] ? analysis[0].text : '',
    recommendations_ko: recs.slice(0, 4)
  };
}

// ── 전투 리포트 생성 ──────────────────────────────────────────
function normalizeWallet(wallet) {
  return String(wallet || '').toLowerCase().trim();
}

function toInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function safeJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return {}; }
}

function resultFromWinner(winnerSide) {
  if (winnerSide === 'atk') return 'attacker_win';
  if (winnerSide === 'def') return 'defender_win';
  return 'draw';
}

function getSideByFleetId(participants, fleetId) {
  const p = participants.find(x => String(x.fleet_id) === String(fleetId));
  return p ? p.side : null;
}

function buildHints(atk, def, result) {
  const hints = [];
  const add = (type, severity, messageKey, fallbackText) => {
    hints.push({ type, severity, messageKey, fallbackText });
  };

  const maxDeployed = Math.max(atk.shipsDeployed, def.shipsDeployed);
  const minDeployed = Math.min(atk.shipsDeployed, def.shipsDeployed);
  if (minDeployed > 0 && maxDeployed > minDeployed * 2) {
    add('power', 'info', 'significant_power_gap', 'One side deployed more than twice as many ships.');
  }

  const loser = result === 'attacker_win' ? def : result === 'defender_win' ? atk : null;
  const winner = result === 'attacker_win' ? atk : result === 'defender_win' ? def : null;
  if (loser && winner && loser.class_breakdown.length < winner.class_breakdown.length) {
    add('composition', 'warning', 'flanked', 'The losing fleet fielded fewer ship classes and was easier to counter.');
  }

  const atkSurvival = atk.shipsDeployed > 0 ? atk.shipsSurvived / atk.shipsDeployed : 0;
  const defSurvival = def.shipsDeployed > 0 ? def.shipsSurvived / def.shipsDeployed : 0;
  if (Math.abs(atkSurvival - defSurvival) < 0.1) {
    add('outcome', 'info', 'close_battle', 'Survival rates were within 10%, making this a close battle.');
  }

  const severityRank = { critical: 0, warning: 1, info: 2 };
  return hints
    .sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9))
    .slice(0, 3);
}

async function generateBattleReport(battleId, wallet) {
  try {
    const id = toInt(battleId);
    if (!id) return null;

    const { rows: battles } = await pool.query(
      `SELECT id, status, winner_side, battle_type, ended_at,
              atk_ships_total, def_ships_total, atk_ships_lost, def_ships_lost,
              duration_seconds, battle_summary
         FROM fleet_battles
        WHERE id = $1`,
      [id]
    );
    if (!battles[0]) return null;
    const battle = battles[0];

    const { rows: participants } = await pool.query(
      `SELECT fbp.side, fbp.fleet_id, fbp.wallet_address,
              fbp.ships_at_start, fbp.ships_alive, fbp.ships_lost, fbp.damage_dealt,
              f.name AS fleet_name, f.owner_wallet,
              COALESCE(u.faction_code, 'unknown') AS faction
         FROM fleet_battle_participants fbp
         LEFT JOIN fleets f ON f.id = fbp.fleet_id
         LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(COALESCE(fbp.wallet_address, f.owner_wallet))
        WHERE fbp.battle_id = $1
        ORDER BY CASE WHEN fbp.side = 'atk' THEN 0 ELSE 1 END, fbp.fleet_id`,
      [id]
    );

    const shipsBySide = { atk: [], def: [] };
    for (const p of participants) {
      try {
        const { rows: shipRows } = await pool.query(
          `SELECT s.id, s.fleet_id, s.ship_type_code, s.is_alive, s.is_flagship,
                  s.current_hp, s.max_hp, s.bonus_atk, s.bonus_def, s.bonus_hp,
                  st.size_class, st.class_label, st.role, st.name_ko,
                  st.faction_code AS ship_faction
             FROM ships s
             LEFT JOIN ship_types st ON st.code = s.ship_type_code
            WHERE s.fleet_id = $1`,
          [p.fleet_id]
        );
        shipsBySide[p.side] = shipsBySide[p.side].concat(shipRows);
      } catch (_) {}
    }

    let events = [];
    try {
      const { rows } = await pool.query(
        `SELECT id, tick, event_type, fleet_id, ship_id, payload
           FROM fleet_battle_events
          WHERE battle_id = $1
          ORDER BY tick ASC NULLS LAST, id ASC`,
        [id]
      );
      events = rows.map(ev => ({ ...ev, payload: safeJson(ev.payload), data: safeJson(ev.payload) }));
    } catch (_) {
      events = [];
    }

    const wreckLossBySide = { atk: { ships: 0, value: 0 }, def: { ships: 0, value: 0 } };
    try {
      const { rows } = await pool.query(
        `SELECT victim_side,
                COUNT(*) AS ships_lost,
                COALESCE(SUM(ship_value_gp), 0) AS value_lost_gp
           FROM ship_wrecks
          WHERE battle_id = $1
          GROUP BY victim_side`,
        [id]
      );
      for (const row of rows || []) {
        const side = row.victim_side === 'atk' ? 'atk' : row.victim_side === 'def' ? 'def' : null;
        if (!side) continue;
        wreckLossBySide[side] = {
          ships: toInt(row.ships_lost),
          value: toInt(row.value_lost_gp)
        };
      }
    } catch (_) {}

    const participantBySide = {
      atk: participants.find(p => p.side === 'atk') || {},
      def: participants.find(p => p.side === 'def') || {}
    };
    const shipById = {};
    for (const ship of shipsBySide.atk.concat(shipsBySide.def)) shipById[String(ship.id)] = ship;

    const damage = { atk: 0, def: 0 };
    const damageByClass = { atk: {}, def: {} };
    for (const ev of events) {
      const p = ev.payload || {};
      if (ev.event_type === 'damage' || ev.event_type === 'attack') {
        const amount = toInt(p.damage || p.amount || p.damage_dealt);
        const side = p.attacker_side || p.actor_side || getSideByFleetId(participants, p.attacker_fleet_id || p.killer_fleet_id);
        if (side === 'atk' || side === 'def') {
          damage[side] += amount;
          const cls = getShipClass({ size_class: p.attacker_size_class, ship_type_code: p.attacker_ship_type });
          damageByClass[side][cls] = (damageByClass[side][cls] || 0) + amount;
        }
      } else if (ev.event_type === 'ship_destroyed') {
        const targetSide = getSideByFleetId(participants, ev.fleet_id || p.target_fleet_id);
        const attackerSide = p.attacker_side || p.killer_side || getSideByFleetId(participants, p.killer_fleet_id);
        const side = attackerSide || (targetSide === 'atk' ? 'def' : targetSide === 'def' ? 'atk' : null);
        const targetShip = shipById[String(ev.ship_id)] || {};
        const amount = toInt(p.damage || p.final_damage || targetShip.max_hp, 0);
        if (side === 'atk' || side === 'def') {
          damage[side] += amount;
          const cls = getShipClass({ size_class: p.killer_size_class, ship_type_code: p.killer_ship_type });
          damageByClass[side][cls] = (damageByClass[side][cls] || 0) + amount;
        }
      }
    }

    const estimateDamageToShips = ships => ships.reduce((sum, s) => {
      const maxHp = toInt(s.max_hp) + toInt(s.bonus_hp);
      return sum + Math.max(0, maxHp - toInt(s.current_hp));
    }, 0);
    if (damage.atk <= 0) damage.atk = toInt(participantBySide.atk.damage_dealt) || estimateDamageToShips(shipsBySide.def);
    if (damage.def <= 0) damage.def = toInt(participantBySide.def.damage_dealt) || estimateDamageToShips(shipsBySide.atk);

    const buildSide = (side) => {
      const p = participantBySide[side] || {};
      const ships = shipsBySide[side] || [];
      const deployed = toInt(p.ships_at_start) || toInt(battle[`${side}_ships_total`]) || ships.length;
      const destroyed = toInt(p.ships_lost) || toInt(battle[`${side}_ships_lost`]) || ships.filter(s => s.is_alive === false).length;
      const survived = Math.max(0, toInt(p.ships_alive) || (deployed - destroyed));
      const breakdown = buildClassBreakdown(ships, destroyed, damageByClass[side]);
      const shipFaction = ships.find(s => s.ship_faction)?.ship_faction;
      const roleCounts = countShipsBy(ships, getShipRole);
      const sizeCounts = countShipsBy(ships, getShipClass);
      return {
        wallet: p.wallet_address || p.owner_wallet || null,
        fleetName: p.fleet_name || (side === 'atk' ? 'ATK Fleet' : 'DEF Fleet'),
        fleet_name: p.fleet_name || (side === 'atk' ? 'ATK Fleet' : 'DEF Fleet'),
        faction: p.faction === 'unknown' && shipFaction ? shipFaction : (p.faction || shipFaction || 'unknown'),
        shipsDeployed: deployed,
        shipsDestroyed: Math.min(deployed, destroyed),
        shipsSurvived: survived,
        totalDamage: Math.round(damage[side] || 0),
        total_ships: deployed,
        ships_lost: Math.min(deployed, destroyed),
        ships_survived: survived,
        total_damage_dealt: Math.round(damage[side] || 0),
        class_breakdown: breakdown,
        role_counts: roleCounts,
        size_counts: sizeCounts,
        full_loss_ships: wreckLossBySide[side]?.ships || 0,
        loss_value_gp: wreckLossBySide[side]?.value || 0
      };
    };

    const atk = buildSide('atk');
    const def = buildSide('def');
    const result = resultFromWinner(battle.winner_side);
    const eventStats = buildEventStats(events, participants);
    const w = normalizeWallet(wallet);
    const perspective = w && w === normalizeWallet(atk.wallet) ? 'attacker'
      : w && w === normalizeWallet(def.wallet) ? 'defender'
      : 'observer';

    const battleAnalysis = buildBattleAnalysis(atk, def, result, eventStats);
    const highlights = generateHighlights(events, battle.winner_side);
    atk.rating = calcPerformanceRating(
      atk.totalDamage,
      atk.shipsDestroyed,
      atk.shipsDeployed,
      battle.winner_side === 'atk'
    );
    def.rating = calcPerformanceRating(
      def.totalDamage,
      def.shipsDestroyed,
      def.shipsDeployed,
      battle.winner_side === 'def'
    );

    // ✅ [퍼포먼스 레이팅] DB 저장
    try {
      await pool.query(
        `UPDATE fleet_battles
         SET performance_rating_atk = $1, performance_rating_def = $2
         WHERE id = $3`,
        [atk.rating || null, def.rating || null, id]
      );
    } catch (_pr) {}

    return {
      battleId: toInt(battle.id),
      perspective,
      result,
      atk,
      def,
      hints: buildHints(atk, def, result),
      event_stats: eventStats,
      battle_id: toInt(battle.id),
      battle_type: battle.battle_type || 'pvp_duel',
      winner_side: battle.winner_side,
      ended_at: battle.ended_at,
      duration_ticks: battle.duration_seconds || events.length,
      analysis_ko: battleAnalysis.analysis_ko,
      recommendations_ko: battleAnalysis.recommendations_ko,
      analysis_items: battleAnalysis.analysis_items,
      recommendation_items: battleAnalysis.recommendation_items,
      highlights,
      performance_rating: {
        atk: atk.rating || null,
        def: def.rating || null
      },
      summary: {
        total_ticks: battle.duration_seconds || events.length,
        total_ships_destroyed: atk.shipsDestroyed + def.shipsDestroyed,
        was_decisive: battle.winner_side !== 'draw' && battle.winner_side !== null
      }
    };
  } catch (err) {
    console.error('[battleReport] generateBattleReport error:', err.message);
    return null;
  }
}

// ── 플레이어 전투 통계 ────────────────────────────────────────
async function getPlayerBattleStats(wallet) {
  const w = wallet.toLowerCase().trim();
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE fbp.side IS NOT NULL) AS total_battles,
         COUNT(*) FILTER (WHERE fb.winner_side = fbp.side) AS wins,
         COUNT(*) FILTER (WHERE fb.winner_side IS NOT NULL AND fb.winner_side != fbp.side AND fb.winner_side != 'draw') AS losses,
         COUNT(*) FILTER (WHERE fb.winner_side = 'draw' OR fb.winner_side IS NULL) AS draws,
         COALESCE(SUM(CASE WHEN fbp.side='atk' THEN fb.atk_ships_lost ELSE fb.def_ships_lost END), 0) AS total_ships_lost,
         COALESCE(SUM(CASE WHEN fbp.side='atk' THEN fb.def_ships_lost ELSE fb.atk_ships_lost END), 0) AS total_ships_destroyed,
         COALESCE(SUM(CASE WHEN fbp.side='atk' THEN fb.atk_damage_dealt ELSE fb.def_damage_dealt END), 0) AS total_damage_dealt,
         MAX(CASE WHEN fbp.side='atk' THEN fb.performance_rating_atk ELSE fb.performance_rating_def END) AS best_rating,
         MODE() WITHIN GROUP (ORDER BY fbp.formation) AS favorite_formation
       FROM fleet_battle_participants fbp
       JOIN fleet_battles fb ON fb.id = fbp.battle_id
       WHERE LOWER(fbp.wallet_address) = $1
         AND fb.status = 'ended'`,
      [w]
    );

    const stat = rows[0] || {};
    const total  = parseInt(stat.total_battles)   || 0;
    const wins   = parseInt(stat.wins)            || 0;
    const losses = parseInt(stat.losses)          || 0;
    const draws  = parseInt(stat.draws)           || 0;
    const destroyed = parseInt(stat.total_ships_destroyed) || 0;
    const lost      = parseInt(stat.total_ships_lost)      || 0;

    // 연승 기록 계산
    let streak = 0, maxStreak = 0;
    try {
      const { rows: history } = await pool.query(
        `SELECT fb.winner_side, fbp.side
         FROM fleet_battle_participants fbp
         JOIN fleet_battles fb ON fb.id = fbp.battle_id
         WHERE LOWER(fbp.wallet_address) = $1 AND fb.status = 'ended'
         ORDER BY fb.ended_at DESC
         LIMIT 50`,
        [w]
      );
      for (const h of history) {
        if (h.winner_side === h.side) { streak++; maxStreak = Math.max(maxStreak, streak); }
        else { streak = 0; }
      }
    } catch (_) {}

    // 파벌별 승률
    let factionRates = {};
    try {
      const { rows: factionRows } = await pool.query(
        `SELECT f.code,
           COUNT(*) FILTER (WHERE fb.winner_side = fbp.side) AS wins,
           COUNT(*) AS total
         FROM fleet_battle_participants fbp
         JOIN fleet_battles fb ON fb.id = fbp.battle_id
         JOIN fleets fl ON fl.id = fbp.fleet_id
         JOIN factions f ON f.id = fl.faction_id
         WHERE LOWER(fbp.wallet_address) = $1 AND fb.status = 'ended'
         GROUP BY f.code`,
        [w]
      );
      for (const r of factionRows) {
        factionRates[r.code] = r.total > 0 ? Math.round((r.wins / r.total) * 100) / 100 : 0;
      }
    } catch (_) {}

    return {
      total_battles: total,
      wins,
      losses,
      draws,
      win_rate: total > 0 ? Math.round((wins / total) * 1000) / 10 : 0,
      total_ships_destroyed: destroyed,
      total_ships_lost: lost,
      kill_death_ratio: lost > 0 ? Math.round((destroyed / lost) * 100) / 100 : destroyed,
      total_damage_dealt: parseInt(stat.total_damage_dealt) || 0,
      best_rating: stat.best_rating || null,
      longest_win_streak: maxStreak,
      favorite_formation: stat.favorite_formation || null,
      faction_win_rates: factionRates
    };
  } catch (err) {
    console.error('[battleReport] getPlayerBattleStats error:', err.message);
    return { total_battles: 0, wins: 0, losses: 0, draws: 0, win_rate: 0,
             total_ships_destroyed: 0, total_ships_lost: 0, kill_death_ratio: 0,
             total_damage_dealt: 0, best_rating: null, longest_win_streak: 0,
             favorite_formation: null, faction_win_rates: {} };
  }
}

// ── CPI 업데이트 (전투 후 호출) ──────────────────────────────
async function updateFleetCPI(fleetId) {
  try {
    const { rows: ships } = await pool.query(
      `SELECT st.base_atk AS atk, st.base_def AS def,
              s.max_hp, st.base_speed AS speed,
              s.bonus_atk, s.bonus_def, s.bonus_hp, s.bonus_speed
       FROM ships s
       JOIN ship_types st ON st.code = s.ship_type_code
       WHERE s.fleet_id = $1 AND s.is_alive = TRUE`,
      [fleetId]
    );
    const cpi = calcFleetCPI(ships.map(s => ({
      atk: s.atk, def: s.def, hp: s.max_hp, speed: s.speed,
      bonus_atk: s.bonus_atk, bonus_def: s.bonus_def,
      bonus_hp: s.bonus_hp, bonus_speed: s.bonus_speed
    })));
    await pool.query(`UPDATE fleets SET cpi = $1 WHERE id = $2`, [cpi, fleetId]);
    return cpi;
  } catch (err) {
    console.error('[battleReport] updateFleetCPI error:', err.message);
    return 0;
  }
}

// ── 추천 상대 목록 ─────────────────────────────────────────────
async function getRecommendedOpponents(wallet, limit = 10, opts = {}) {
  const w = wallet.toLowerCase().trim();
  const sectorFilter = String(opts.sector || '').trim();
  try {
    const { rows: myRows } = await pool.query(
      `SELECT
         COALESCE((SELECT cpi FROM fleets WHERE LOWER(owner_wallet) = $1 ORDER BY cpi DESC LIMIT 1), 0) AS my_cpi,
         (SELECT sector_code FROM claims WHERE LOWER(owner) = $1 ORDER BY (width * height) DESC LIMIT 1) AS my_sector_code`,
      [w]
    );
    const myCPI = parseFloat(myRows[0]?.my_cpi) || 0;
    const mySectorCode = myRows[0]?.my_sector_code || null;

    const { rows } = await pool.query(
      `SELECT
         f.id AS fleet_id,
         f.name AS fleet_name,
         f.cpi,
         f.owner_wallet AS wallet,
         u.nickname,
         u.faction_code,
         fa.color_primary AS faction_color,
         ABS(f.cpi - $2) AS cpi_diff,
         COUNT(s.id) FILTER (WHERE s.is_alive) AS ship_count,
         (SELECT COUNT(*) FROM fleet_battle_participants fbp2
          JOIN fleet_battles fb2 ON fb2.id = fbp2.battle_id
          WHERE LOWER(fbp2.wallet_address) = LOWER(f.owner_wallet)
            AND fb2.winner_side = fbp2.side AND fb2.status = 'ended') AS wins,
         (SELECT sector_code FROM claims
          WHERE LOWER(owner) = LOWER(f.owner_wallet)
          ORDER BY (width*height) DESC LIMIT 1) AS sector_code,
         (SELECT MAX(fb3.ended_at) FROM fleet_battles fb3
          JOIN fleet_battle_participants fbp3 ON fbp3.battle_id = fb3.id
          WHERE LOWER(fbp3.wallet_address) = LOWER(f.owner_wallet)
            AND fb3.status = 'ended') AS last_battle_at,
         (SELECT COUNT(*) FROM bounty_listings bl
          WHERE LOWER(bl.target_wallet) = LOWER(f.owner_wallet)
            AND bl.status = 'active'
            AND (bl.expires_at IS NULL OR bl.expires_at > NOW())) AS active_bounties,
         (SELECT COALESCE(SUM(bl.reward_gp), 0) FROM bounty_listings bl
          WHERE LOWER(bl.target_wallet) = LOWER(f.owner_wallet)
            AND bl.status = 'active'
            AND (bl.expires_at IS NULL OR bl.expires_at > NOW())) AS active_bounty_gp
       FROM fleets f
       JOIN users u ON LOWER(u.wallet_address) = LOWER(f.owner_wallet)
       LEFT JOIN factions fa ON fa.code = u.faction_code
       LEFT JOIN ships s ON s.fleet_id = f.id
       WHERE LOWER(f.owner_wallet) != $1
         AND f.is_in_battle = FALSE
         AND f.cpi > 0
         AND ($4::text = '' OR EXISTS (
           SELECT 1 FROM claims sc
            WHERE LOWER(sc.owner) = LOWER(f.owner_wallet)
              AND sc.sector_code = $4
         ))
       GROUP BY f.id, f.name, f.cpi, f.owner_wallet, u.nickname, u.faction_code, fa.color_primary
       ORDER BY ABS(f.cpi - $2) ASC
       LIMIT $3`,
      [w, myCPI, limit * 3, sectorFilter]
    );

    const now = Date.now();
    function fmtAgo(ts) {
      if (!ts) return null;
      const ms = now - new Date(ts).getTime();
      const min = Math.floor(ms / 60000);
      if (min < 60) return min + '분 전 전투';
      const hr = Math.floor(min / 60);
      if (hr < 24) return hr + '시간 전 전투';
      return Math.floor(hr / 24) + '일 전 전투';
    }

    return rows.map(r => {
      const lastBattleAt = r.last_battle_at ? new Date(r.last_battle_at) : null;
      const ageMs = lastBattleAt ? (now - lastBattleAt.getTime()) : null;
      const isOnline = ageMs !== null ? ageMs < 3600000 : false;
      const cpiDiff = parseFloat(r.cpi_diff) || 0;
      const cpiBase = Math.max(1, myCPI || parseFloat(r.cpi) || 1);
      const reasons = [];
      let score = 100 - Math.min(45, (cpiDiff / cpiBase) * 45);

      reasons.push('fair_match');

      if (ageMs !== null && ageMs < 6 * 3600000) {
        score += 18;
        reasons.push('active_recently');
      } else if (ageMs !== null && ageMs < 24 * 3600000) {
        score += 10;
        reasons.push('active_recently');
      }

      if (mySectorCode && r.sector_code && mySectorCode === r.sector_code) {
        score += 12;
        reasons.push('same_sector_pressure');
      }

      const activeBountyGp = parseInt(r.active_bounty_gp, 10) || 0;
      if ((parseInt(r.active_bounties, 10) || 0) > 0) {
        score += 14 + Math.min(16, Math.floor(activeBountyGp / 500));
        reasons.push('bounty_target');
      }

      return {
        fleet_id: r.fleet_id,
        fleet_name: r.fleet_name,
        wallet: r.wallet,
        nickname: r.nickname || null,
        faction_code: r.faction_code,
        faction_color: r.faction_color || null,
        cpi: parseFloat(r.cpi) || 0,
        my_cpi: myCPI,
        cpi_diff: cpiDiff,
        ship_count: parseInt(r.ship_count, 10) || 0,
        ships_alive: parseInt(r.ship_count, 10) || 0,
        wins: parseInt(r.wins, 10) || 0,
        sector_code: r.sector_code || null,
        active_bounties: parseInt(r.active_bounties, 10) || 0,
        active_bounty_gp: activeBountyGp,
        last_battle_ago: fmtAgo(r.last_battle_at),
        is_online: isOnline,
        recommendation_score: Math.round(score * 10) / 10,
        recommendation_reasons: reasons,
      };
    }).sort((a, b) => {
      if (b.recommendation_score !== a.recommendation_score) {
        return b.recommendation_score - a.recommendation_score;
      }
      return a.cpi_diff - b.cpi_diff;
    }).slice(0, limit);
  } catch (err) {
    console.error('[battleReport] getRecommendedOpponents error:', err.message);
    return [];
  }
}

module.exports = {
  generateBattleReport,
  getPlayerBattleStats,
  calcFleetCPI,
  updateFleetCPI,
  getRecommendedOpponents,
  calcPerformanceRating
};
