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
                  st.size_class, st.class_label, st.faction_code AS ship_faction
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
      } else if (ev.event_type === 'ship_destroyed' || ev.event_type === 'flagship_destroyed') {
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
        class_breakdown: breakdown
      };
    };

    const atk = buildSide('atk');
    const def = buildSide('def');
    const result = resultFromWinner(battle.winner_side);
    const w = normalizeWallet(wallet);
    const perspective = w && w === normalizeWallet(atk.wallet) ? 'attacker'
      : w && w === normalizeWallet(def.wallet) ? 'defender'
      : 'observer';

    let analysis_ko = '';
    const recommendations_ko = [];
    const loser = battle.winner_side === 'atk' ? def : battle.winner_side === 'def' ? atk : null;
    const winner = battle.winner_side === 'atk' ? atk : battle.winner_side === 'def' ? def : null;
    if (loser && winner) {
      const dmgRatio = winner.totalDamage > 0 ? loser.totalDamage / winner.totalDamage : 1;
      const lossRate = loser.shipsDeployed > 0 ? loser.shipsDestroyed / loser.shipsDeployed : 0;
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
      battle_id: toInt(battle.id),
      battle_type: battle.battle_type || 'pvp_duel',
      winner_side: battle.winner_side,
      ended_at: battle.ended_at,
      duration_ticks: battle.duration_seconds || events.length,
      analysis_ko,
      recommendations_ko,
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
            AND fb2.winner_side = fbp2.side AND fb2.status = 'ended') AS wins,
         (SELECT sector_code FROM claims
          WHERE LOWER(owner) = LOWER(f.owner_wallet)
          ORDER BY (width*height) DESC LIMIT 1) AS sector_code,
         (SELECT MAX(fb3.ended_at) FROM fleet_battles fb3
          JOIN fleet_battle_participants fbp3 ON fbp3.battle_id = fb3.id
          WHERE LOWER(fbp3.wallet_address) = LOWER(f.owner_wallet)
            AND fb3.status = 'ended') AS last_battle_at
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
      const isOnline = lastBattleAt ? (now - lastBattleAt.getTime()) < 3600000 : false;
      return {
        fleet_id: r.fleet_id,
        fleet_name: r.fleet_name,
        wallet: r.wallet,
        faction_code: r.faction_code,
        cpi: parseFloat(r.cpi) || 0,
        my_cpi: parseFloat(myCPI) || 0,
        cpi_diff: parseFloat(r.cpi_diff) || 0,
        ship_count: parseInt(r.ship_count) || 0,
        wins: parseInt(r.wins) || 0,
        sector_code: r.sector_code || null,
        last_battle_ago: fmtAgo(r.last_battle_at),
        is_online: isOnline
      };
    });
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
