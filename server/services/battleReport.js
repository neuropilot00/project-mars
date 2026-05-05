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
  const code = (ship.type_code || ship.ship_type_code || ship.code || '').toLowerCase();
  if (code.includes('titan'))                              return '타이탄';
  if (code.includes('battleship') || code.includes('_bs')) return '배틀십';
  if (code.includes('cruiser'))                            return '순양함';
  if (code.includes('destroyer'))                          return '구축함';
  if (code.includes('frigate'))                            return '프리깃';
  return ship.class_label || ship.size_class || '기타';
}

// ── 클래스별 성과 집계 ────────────────────────────────────────
function buildClassBreakdown(ships, shipsLost) {
  if (!ships || ships.length === 0) return [];
  const classMap = {};
  ships.forEach(s => {
    const cls = getShipClass(s);
    if (!classMap[cls]) classMap[cls] = { class_label: cls, total: 0 };
    classMap[cls].total++;
  });
  const classes = Object.values(classMap).sort((a, b) => b.total - a.total);
  const survivalRate = ships.length > 0 ? Math.max(0, (ships.length - (shipsLost || 0)) / ships.length) : 0;
  classes.forEach(c => {
    c.survived      = Math.round(c.total * survivalRate);
    c.survival_pct  = c.total > 0 ? Math.round((c.survived / c.total) * 100) : 0;
    c.perf_label    = c.survival_pct >= 80 ? '핵심 기여'
                    : c.survival_pct >= 40 ? '데미지 높음'
                    : '데미지 낮음';
  });
  return classes;
}

// ── 전투 리포트 생성 ──────────────────────────────────────────
async function generateBattleReport(battleId) {
  try {
    // 1. 전투 기본 정보
    const { rows: battles } = await pool.query(
      `SELECT fb.*,
        atk_p.wallet_address AS atk_wallet, atk_fl.name AS atk_fleet_name,
        def_p.wallet_address AS def_wallet, def_fl.name AS def_fleet_name
       FROM fleet_battles fb
       LEFT JOIN fleet_battle_participants atk_p ON atk_p.battle_id = fb.id AND atk_p.side = 'atk'
       LEFT JOIN fleets atk_fl ON atk_fl.id = atk_p.fleet_id
       LEFT JOIN fleet_battle_participants def_p ON def_p.battle_id = fb.id AND def_p.side = 'def'
       LEFT JOIN fleets def_fl ON def_fl.id = def_p.fleet_id
       WHERE fb.id = $1`,
      [battleId]
    );
    if (!battles[0]) return null;
    const battle = battles[0];

    // 2. 전투 이벤트
    let events = [];
    try {
      const { rows } = await pool.query(
        `SELECT tick, event_type, data FROM fleet_battle_events
         WHERE battle_id = $1 ORDER BY tick ASC, id ASC`,
        [battleId]
      );
      events = rows;
    } catch (_) {}

    // 3. 참여 함선 정보 (ships 테이블에서 fleet 기준으로 조회)
    let atkShips = [], defShips = [];
    try {
      const { rows: participants } = await pool.query(
        `SELECT fbp.side, fbp.fleet_id
         FROM fleet_battle_participants fbp
         WHERE fbp.battle_id = $1`,
        [battleId]
      );
      for (const p of participants) {
        try {
          const { rows: shipRows } = await pool.query(
            `SELECT s.id, s.name, st.code AS type_code, st.size_class, st.class_label,
                    s.atk, s.def, s.max_hp, s.speed,
                    s.bonus_atk, s.bonus_def, s.bonus_hp, s.bonus_speed,
                    s.is_flagship
             FROM ships s
             JOIN ship_types st ON st.id = s.ship_type_id
             WHERE s.fleet_id = $1`,
            [p.fleet_id]
          );
          if (p.side === 'atk') atkShips = shipRows;
          else defShips = shipRows;
        } catch (_) {}
      }
    } catch (_) {}

    // 4. 데미지 집계 (이벤트에서)
    let atkDmg = 0, defDmg = 0;
    for (const ev of events) {
      if (ev.event_type === 'damage' || ev.event_type === 'attack') {
        const d = ev.data || {};
        if (d.attacker_side === 'atk') atkDmg += d.damage || 0;
        else if (d.attacker_side === 'def') defDmg += d.damage || 0;
      }
    }
    // DB에 저장된 값 우선 사용
    atkDmg = battle.atk_damage_dealt || atkDmg;
    defDmg = battle.def_damage_dealt || defDmg;

    // 5. MVP 함선 (kills 기준)
    let atkMvp = null, defMvp = null;
    const killMap = {};
    for (const ev of events) {
      if (ev.event_type === 'ship_destroyed') {
        const d = ev.data || {};
        if (d.killer_id) {
          killMap[d.killer_id] = (killMap[d.killer_id] || 0) + 1;
        }
      }
    }
    const topKiller = Object.entries(killMap).sort((a,b) => b[1]-a[1])[0];
    if (topKiller) {
      const [killerId, kills] = topKiller;
      // atk MVP
      const atkKillerShip = atkShips.find(s => String(s.id) === String(killerId));
      if (atkKillerShip) atkMvp = { name: atkKillerShip.name || atkKillerShip.type_code || 'Unknown', kills };
      // def MVP
      const defKillerShip = defShips.find(s => String(s.id) === String(killerId));
      if (defKillerShip) defMvp = { name: defKillerShip.name || defKillerShip.type_code || 'Unknown', kills };
    }

    // 6. 기함 생존 여부
    const atkFlagship = atkShips.find(s => s.is_flagship);
    const defFlagship = defShips.find(s => s.is_flagship);

    // 7. 퍼포먼스 레이팅
    const atkWon = battle.winner_side === 'atk';
    const defWon = battle.winner_side === 'def';

    const atkRating = calcPerformanceRating(atkDmg, battle.atk_ships_lost || 0, atkShips.length, atkWon);
    const defRating = calcPerformanceRating(defDmg, battle.def_ships_lost || 0, defShips.length, defWon);

    // 8. efficiency score (0~100)
    const atkEff = Math.min(100, Math.round(
      (atkDmg / ((battle.atk_ships_lost || 0) + 1) / 100) + (atkWon ? 30 : 0)
    ));
    const defEff = Math.min(100, Math.round(
      (defDmg / ((battle.def_ships_lost || 0) + 1) / 100) + (defWon ? 30 : 0)
    ));

    // 9. 하이라이트
    const highlights = generateHighlights(events, battle.winner_side);

    // 10. 패인 분석 & 추천 (패배 측 기준)
    let analysis_ko = '';
    const recommendations_ko = [];
    if (battle.winner_side && battle.winner_side !== 'draw') {
      const loserDmg    = battle.winner_side === 'atk' ? defDmg  : atkDmg;
      const winnerDmgV  = battle.winner_side === 'atk' ? atkDmg  : defDmg;
      const loserLostN  = battle.winner_side === 'atk' ? (battle.def_ships_lost || 0) : (battle.atk_ships_lost || 0);
      const loserTotalN = battle.winner_side === 'atk' ? defShips.length : atkShips.length;
      const dmgRatio    = winnerDmgV > 0 ? loserDmg / winnerDmgV : 1;
      const lossRate    = loserTotalN > 0 ? loserLostN / loserTotalN : 0;

      if (dmgRatio < 0.5) {
        analysis_ko = '화력 차이가 결정적이었습니다. 상대 함대가 2배 이상의 데미지를 입혔습니다. 공격력 강화가 우선입니다.';
        recommendations_ko.push('공격형 함선 또는 상위 등급 함선 추가');
        recommendations_ko.push('함선 ATK 스탯 업그레이드 (조선소 → 강화)');
      } else if (lossRate > 0.6) {
        analysis_ko = '함선 집중 손실이 패인입니다. 전선이 무너지면서 연쇄 격침이 발생했습니다.';
        recommendations_ko.push('방어형(탱크) 함선을 전선에 배치하세요');
        recommendations_ko.push('진형 변경 고려 (핀서 또는 방어 대형)');
      } else {
        analysis_ko = '전략적 우위를 내줬습니다. 함선 구성과 진형이 상대 전술에 불리했습니다.';
        recommendations_ko.push('상대 파벌 상성 분석 후 함선 구성 조정');
        recommendations_ko.push('기동 방식 (Advance/Retreat/Hold) 재검토');
      }
    }

    // 11. 클래스별 성과
    const atkClassBreakdown = buildClassBreakdown(atkShips, battle.atk_ships_lost || 0);
    const defClassBreakdown = buildClassBreakdown(defShips, battle.def_ships_lost || 0);

    return {
      battle_id: battle.id,
      battle_type: battle.battle_type || 'pvp_duel',
      winner_side: battle.winner_side,
      ended_at: battle.ended_at,
      duration_ticks: battle.duration_ticks || events.length,
      analysis_ko,
      recommendations_ko,
      atk: {
        wallet: battle.atk_wallet,
        fleet_name: battle.atk_fleet_name || 'ATK Fleet',
        total_ships: atkShips.length,
        ships_lost: battle.atk_ships_lost || 0,
        ships_survived: atkShips.length - (battle.atk_ships_lost || 0),
        total_damage_dealt: atkDmg,
        total_damage_taken: defDmg,
        flagship_survived: battle.atk_flagship_survived,
        mvp_ship: atkMvp,
        performance_rating: battle.performance_rating_atk || atkRating,
        efficiency_score: atkEff,
        class_breakdown: atkClassBreakdown
      },
      def: {
        wallet: battle.def_wallet,
        fleet_name: battle.def_fleet_name || 'DEF Fleet',
        total_ships: defShips.length,
        ships_lost: battle.def_ships_lost || 0,
        ships_survived: defShips.length - (battle.def_ships_lost || 0),
        total_damage_dealt: defDmg,
        total_damage_taken: atkDmg,
        flagship_survived: battle.def_flagship_survived,
        mvp_ship: defMvp,
        performance_rating: battle.performance_rating_def || defRating,
        efficiency_score: defEff,
        class_breakdown: defClassBreakdown
      },
      highlights,
      summary: {
        total_ticks: battle.duration_ticks || events.length,
        total_ships_destroyed: (battle.atk_ships_lost || 0) + (battle.def_ships_lost || 0),
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
      `SELECT atk, def, max_hp, speed,
              bonus_atk, bonus_def, bonus_hp, bonus_speed
       FROM ships WHERE fleet_id = $1 AND is_alive = TRUE`,
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
async function getRecommendedOpponents(wallet, limit = 10) {
  const w = wallet.toLowerCase().trim();
  try {
    // 내 최강 함대 CPI
    const { rows: myFleets } = await pool.query(
      `SELECT id, cpi, name FROM fleets WHERE LOWER(owner_wallet) = $1
       ORDER BY cpi DESC LIMIT 1`,
      [w]
    );
    const myCPI = myFleets[0]?.cpi || 0;

    const { rows } = await pool.query(
      `SELECT
         f.id AS fleet_id, f.name AS fleet_name, f.cpi,
         f.owner_wallet AS wallet,
         u.faction_code,
         ABS(f.cpi - $2) AS cpi_diff,
         COUNT(s.id) FILTER (WHERE s.is_alive) AS ship_count,
         (SELECT COUNT(*) FROM fleet_battle_participants fbp2
          JOIN fleet_battles fb2 ON fb2.id = fbp2.battle_id
          WHERE LOWER(fbp2.wallet_address) = LOWER(f.owner_wallet)
            AND fb2.winner_side = fbp2.side AND fb2.status = 'ended') AS wins
       FROM fleets f
       JOIN users u ON LOWER(u.wallet_address) = LOWER(f.owner_wallet)
       LEFT JOIN ships s ON s.fleet_id = f.id
       WHERE LOWER(f.owner_wallet) != $1
         AND f.is_in_battle = FALSE
         AND f.cpi > 0
       GROUP BY f.id, f.name, f.cpi, f.owner_wallet, u.faction_code
       ORDER BY ABS(f.cpi - $2) ASC
       LIMIT $3`,
      [w, myCPI, limit]
    );

    return rows.map(r => ({
      fleet_id: r.fleet_id,
      fleet_name: r.fleet_name,
      wallet: r.wallet,
      faction_code: r.faction_code,
      cpi: parseFloat(r.cpi) || 0,
      my_cpi: parseFloat(myCPI) || 0,
      cpi_diff: parseFloat(r.cpi_diff) || 0,
      ship_count: parseInt(r.ship_count) || 0,
      wins: parseInt(r.wins) || 0
    }));
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
