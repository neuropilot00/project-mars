// server/services/battleRewards.js
// ═══════════════════════════════════════════════════════════════
// Battle Rewards — 전투 종료 시 보상 분배
// 
// 보상 계산:
//   승리자:
//     - 기본 GP (전투 타입별)
//     - 격침한 함선당 GP (데미지 기여도 비례)
//     - 전투 타입별 광물 드랍 (확률)
//   패배자:
//     - 완전 패배가 아닐 시 위로 GP
//     - 데미지 기여도 비례
// ═══════════════════════════════════════════════════════════════

const { pool, getSetting, notifyPlayer } = require('../db');
let dailyService;
try { dailyService = require('./daily'); } catch (_) { /* optional daily service */ }
let seasonService;
try { seasonService = require('./season'); } catch (_) { /* optional season service */ }
let dailyOps;
try { dailyOps = require('../routes/dailyOps'); } catch (_) { /* optional daily ops route helper */ }
let battleEnvironment;
try { battleEnvironment = require('./battleEnvironment'); } catch (_) { battleEnvironment = null; }

// 광물 드랍 풀 (전투 타입별로 다름)
const MINERAL_DROP_POOL = {
  pvp_duel: ['iron_dust', 'red_sand', 'regolith_ore'],
  siege:    ['iron_dust', 'regolith_ore', 'basalt_chip', 'ice_crystal', 'volcanic_shard'],
  hijack:   ['iron_dust', 'plasma_dust', 'ancient_metal'],
  raid:     ['iron_dust', 'volcanic_shard', 'meteorite_fragment'],
};
const BATTLEFIELD_SALVAGE_POOL = {
  mining_site: ['iron_dust', 'regolith_ore'],
  deep_mine: ['regolith_ore', 'basalt_chip'],
  excavation_grid: ['iron_dust', 'basalt_chip'],
  refinery_yard: ['basalt_chip', 'volcanic_shard'],
  polar_ice: ['ice_crystal'],
  lava_tube: ['volcanic_shard', 'basalt_chip'],
  crater_relay: ['iron_dust', 'plasma_dust'],
  orbital_blockade: ['plasma_dust', 'meteorite_fragment'],
  shipyard_drydock: ['iron_dust', 'basalt_chip'],
  convoy_route: ['red_sand', 'meteorite_fragment'],
  ancient_ruins: ['ancient_metal', 'plasma_dust'],
  garrison_rooftop: ['basalt_chip', 'iron_dust'],
  settlement_airspace: ['red_sand', 'iron_dust'],
  dust_storm: ['red_sand', 'regolith_ore'],
  canyon_outpost: ['basalt_chip', 'red_sand'],
  occupied_airspace: ['plasma_dust', 'iron_dust'],
  colony_dome: ['red_sand', 'ice_crystal'],
  orbit_territory: ['meteorite_fragment', 'iron_dust'],
  garrison: ['basalt_chip', 'iron_dust'],
  occupation_grid_airspace: ['plasma_dust', 'iron_dust'],
  minehead_trench: ['regolith_ore', 'iron_dust'],
  dome_defense_line: ['ice_crystal', 'basalt_chip'],
  orbital_minefield: ['meteorite_fragment', 'plasma_dust'],
};

// ═══════════════════════════════════════════════════════════════
// [신규 유저 full-loss 유예 — combat grace]
//   full-loss(영구파괴)는 정체성이라 전역 제거하지 않는다(베테랑은 그대로 영구소멸).
//   다만 보호 대상(온보딩 미완료 OR 낮은 rank OR 신규 계정)의 격침함은 영구소멸 대신
//   "대파"(current_hp=1, 수리 가능)로 생존시켜 신규가 첫 전투에서 함대를 통째로 잃고
//   이탈하는 것을 막는다. 되돌릴 수 있는 개선(설정으로 OFF/조정 가능).
//
//   ⚠️ 아키텍처: 함선 영구파괴는 battleEngine.applyBattleResults(읽기 전용 파일)에서
//   이 함수보다 먼저 실행된다. 따라서 여기서는 "스킵"이 아니라 이번 전투에서 방금
//   파괴된 보호 대상 함선을 보상 트랜잭션 안에서 되살리는 보정(resurrection-compensation)을
//   수행한다. 동시에 battleEngine이 남긴 ship_wrecks 킬보드 행을 제거해 유령 킬을 막는다.
//   대상 범위는 이번 battleId의 참가 함대(fleet_battle_participants→fleet_id)로 한정한다.
async function isGraceProtectedWallet(client, wallet) {
  const w = String(wallet || '').toLowerCase().trim();
  if (!w) return false;
  try {
    // 기본 0(rank 게이트 비활성) — rank_level 기본값이 1이라 ≤5 면 전 유저가 보호돼 full-loss 정체성이
    // 무력화된다. 보호는 "온보딩 미완료" 또는 "계정 ≤ max_age_days" 같은 진짜 신규 신호로만 건다.
    const maxRank = parseInt(await getSetting('newplayer_combat_grace_max_rank', '0'), 10) || 0;
    const maxAgeDays = parseFloat(await getSetting('newplayer_combat_grace_max_age_days', '3')) || 0;
    const { rows } = await client.query(
      `SELECT u.created_at, COALESCE(u.rank_level, 1) AS rank_level,
              COALESCE(ob.completed, FALSE) AS onboarding_completed
         FROM users u
         LEFT JOIN user_onboarding ob ON LOWER(ob.wallet_address) = LOWER(u.wallet_address)
        WHERE LOWER(u.wallet_address) = LOWER($1)`,
      [w]
    );
    if (!rows[0]) return false;
    // 온보딩 미완료면 보호 (신규 가드 hijack.js와 일관 — 단 여기선 rank_level 사용)
    if (rows[0].onboarding_completed !== true) return true;
    const rank = parseInt(rows[0].rank_level, 10) || 1;
    if (maxRank > 0 && rank <= maxRank) return true;
    if (maxAgeDays > 0 && rows[0].created_at) {
      const ageDays = (Date.now() - new Date(rows[0].created_at).getTime()) / 86400000;
      if (ageDays <= maxAgeDays) return true;
    }
    return false;
  } catch (_) {
    return false; // 조회 실패는 비보호(기존 full-loss 유지) — fail-safe하게 정체성 보존 쪽
  }
}

/**
 * 이번 전투에서 방금 영구파괴된 함선 중 보호 대상 소유자의 함선을 "대파"로 되살린다.
 * - 보상 분배와 같은 client/트랜잭션 안에서 호출돼 원자적으로 처리된다.
 * - 이미 살아있는 함선은 건드리지 않으므로 재호출에도 안전(idempotent).
 * @returns {number} 되살린 함선 수
 */
async function applyNewPlayerCombatGrace(client, battleId) {
  try {
    if (String(await getSetting('newplayer_combat_grace_enabled', 'true')) !== 'true') return 0;

    // 이번 전투 참가 함대 → 함대 소유자(보호 판정 기준은 함선 owner_wallet)
    const { rows: parts } = await client.query(
      `SELECT DISTINCT fleet_id FROM fleet_battle_participants WHERE battle_id = $1 AND fleet_id IS NOT NULL`,
      [battleId]
    );
    if (!parts.length) return 0;
    const fleetIds = parts.map(p => parseInt(p.fleet_id, 10)).filter(id => id > 0);
    if (!fleetIds.length) return 0;

    // 이번 전투에서 방금 파괴된(=ship_wrecks에 기록된) 함선만 대상 — 과거 전투 함선 오버리바이브 방지.
    const { rows: dead } = await client.query(
      `SELECT s.id, LOWER(s.owner_wallet) AS owner
         FROM ship_wrecks w
         JOIN ships s ON s.id = w.ship_instance_id
        WHERE w.battle_id = $1
          AND s.fleet_id = ANY($2::int[])
          AND s.is_alive = FALSE`,
      [battleId, fleetIds]
    );
    if (!dead.length) return 0;

    // 소유자별 보호 여부 캐시 (같은 owner 반복 조회 줄이기)
    const protCache = {};
    const reviveIds = [];
    for (const d of dead) {
      const owner = d.owner;
      if (!(owner in protCache)) protCache[owner] = await isGraceProtectedWallet(client, owner);
      if (protCache[owner]) reviveIds.push(d.id);
    }
    if (!reviveIds.length) return 0;

    // 대파 생존 처리 — current_hp=1(수리 가능), is_alive 복구, destroyed_at 해제.
    //   shield_hp는 0으로 둬서 "겨우 살아남은" 상태로 만든다. CHECK(current_hp<=max_hp+bonus_hp) 안전.
    await client.query(
      `UPDATE ships
          SET is_alive = TRUE,
              destroyed_at = NULL,
              current_hp = 1,
              shield_hp = 0
        WHERE id = ANY($1::int[])`,
      [reviveIds]
    );

    // battleEngine이 남긴 킬보드 wreck 제거 — 되살아난 함선은 격침된 적 없으므로 유령 킬 방지.
    await client.query(
      `DELETE FROM ship_wrecks WHERE battle_id = $1 AND ship_instance_id = ANY($2::int[])`,
      [battleId, reviveIds]
    );

    console.log(`[grace] battle ${battleId} — revived ${reviveIds.length} protected new-player ship(s) to 대파(crippled) state`);

    // 보호 대상 소유자에게 1회 통지 (best-effort) — "신규 보호로 함선이 대파로 생존" 안내.
    try {
      const notified = new Set();
      for (const d of dead) {
        if (!protCache[d.owner] || notified.has(d.owner)) continue;
        notified.add(d.owner);
        if (typeof notifyPlayer === 'function') {
          notifyPlayer(
            d.owner,
            'combat_grace',
            '🛡 신규 보호: 격침된 함선이 영구 소멸 대신 대파 상태로 생존했습니다. 조선소에서 수리하세요.',
            { battle_id: battleId }
          ).catch(() => {});
        }
      }
    } catch (_) {}

    return reviveIds.length;
  } catch (err) {
    console.warn(`[grace] battle ${battleId} combat grace failed:`, err.message);
    return 0; // 보호 보정 실패가 보상 분배를 막지 않게 — 최악의 경우 기존 full-loss 유지
  }
}

/**
 * 보상 트랜잭션이 없는 경로(AI전 등)에서 grace만 단독 트랜잭션으로 적용한다.
 */
async function runCombatGraceStandalone(battleId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await applyNewPlayerCombatGrace(client, battleId);
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.warn(`[grace] battle ${battleId} standalone grace failed:`, err.message);
  } finally {
    client.release();
  }
}

/**
 * 전투 종료 후 보상 계산 & 지급
 * @param {number} battleId
 * @returns {Array<Object>} 각 참가자별 보상 내역
 */
async function distributeRewards(battleId) {
  // 전투 정보 + 참가자 데이터
  const { rows: battleRows } = await pool.query(`
    SELECT id, battle_type, sector_id, winner_side, atk_ships_lost, def_ships_lost, battle_summary
    FROM fleet_battles WHERE id = $1 AND status = 'ended'
  `, [battleId]);

  if (!battleRows[0]) throw new Error('BATTLE_NOT_ENDED');
  const battle = battleRows[0];

  // ⚠️ AI 연습전(/api/ai/fight, battle_summary.is_ai_battle)은 GP/광물 보상 미지급.
  // 비용·쿨다운·rate-limit 없는 AI전이 PvP와 동일 보상을 mint 하던 무한 GP 인플레/현금화
  // 익스플로잇 차단(경제 진단 최우선 발견). 데일리 OPS 미션 진행은 별도 경로로 그대로 추적됨.
  const _sum = battle.battle_summary || {};
  const _isAi = _sum.is_ai_battle === true || _sum.is_ai_battle === 'true'
    || String(battle.battle_type || '').toLowerCase().includes('ai');
  if (_isAi) {
    console.log(`[rewards] battle ${battleId} is AI practice — no currency/mineral reward (anti-mint)`);
    // AI전도 보호 대상 신규의 함선 대파 보정은 적용(보상은 없지만 함대 전멸 이탈은 막는다).
    await runCombatGraceStandalone(battleId);
    return [];
  }

  if (battle.winner_side === null || battle.winner_side === 'draw') {
    // 무승부면 참가 보상 최소치만
    return await distributeMinimalRewards(battleId);
  }
  
  // 참가자 + 데미지 공유율
  const { rows: participants } = await pool.query(`
    SELECT 
      p.wallet_address, p.side, p.fleet_id,
      p.damage_dealt, p.ships_lost, p.ships_at_start,
      v.damage_share_pct, v.side_total_damage
    FROM fleet_battle_participants p
    LEFT JOIN v_battle_participant_damage_share v
      ON v.battle_id = p.battle_id AND v.wallet_address = p.wallet_address
    WHERE p.battle_id = $1
  `, [battleId]);
  
  // 설정 로드
  const settings = await loadBattleSettings();
  
  const results = [];
  const progressEvents = [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 이미 보상 지급됐는지 확인 (중복 방지) — INSIDE transaction with row lock
    // Lock the battle row first to serialize concurrent distributeBattleRewards calls
    const { rows: lockedBattle } = await client.query(
      `SELECT id, winner_side FROM fleet_battles WHERE id = $1 AND status = 'ended' FOR UPDATE`,
      [battleId]
    );
    if (!lockedBattle[0]) {
      await client.query('ROLLBACK');
      console.log(`[rewards] battle ${battleId} not found or not ended, skipping`);
      return [];
    }
    const { rows: existingRewards } = await client.query(
      `SELECT 1 FROM fleet_battle_rewards WHERE battle_id = $1 LIMIT 1`,
      [battleId]
    );
    if (existingRewards[0]) {
      await client.query('ROLLBACK');
      console.log(`[rewards] battle ${battleId} already rewarded, skipping`);
      return [];
    }

    // [신규 유예] 보상 분배 전, 이번 전투에서 영구파괴된 보호 대상 신규 함선을 대파로 되살린다.
    //   보상 트랜잭션과 원자적으로 처리(중복 보상 가드 통과 후라 1회만 실행됨).
    await applyNewPlayerCombatGrace(client, battleId);

    // [코어행동 XP] 전투 참여/승리 XP (AI/연습전은 위 _isAi 가드로 이미 return[] 처리됨 → NPC mint 없음)
    const _db = require('../db');
    const _winXp = parseInt(await _db.getSetting('battle_win_xp', '15')) || 15;
    const _lossXp = parseInt(await _db.getSetting('battle_loss_xp', '5')) || 5;

    for (const p of participants) {
      const isWinner = p.side === battle.winner_side;
      const reward = await computeReward(p, battle, settings, isWinner);
      
      // GP 지급
      if (reward.gp_awarded > 0) {
        await client.query(`
          UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)
        `, [reward.gp_awarded, p.wallet_address]);
        
        // GP 활동 로그
        await client.query(`
          INSERT INTO fleet_gp_activity (wallet_address, activity_type, gp_delta, related_battle_id, meta)
          VALUES ($1, 'battle_reward', $2, $3, $4)
        `, [p.wallet_address, reward.gp_awarded, battleId, JSON.stringify({
          is_winner: isWinner,
          breakdown: reward.breakdown,
        })]).catch(() => {});
      }
      
      // 광물 지급 (resource_id 기반)
      for (const [code, qty] of Object.entries(reward.minerals_awarded || {})) {
        if (qty > 0) {
          const { rows: rRows } = await client.query(
            `SELECT id FROM resources WHERE code = $1`, [code]
          );
          if (!rRows[0]) continue; // 없는 코드면 스킵
          await client.query(`
            INSERT INTO user_resource_inventory (wallet_address, resource_id, quantity)
            VALUES ($1, $2, $3)
            ON CONFLICT (wallet_address, resource_id)
            DO UPDATE SET quantity = user_resource_inventory.quantity + EXCLUDED.quantity
          `, [p.wallet_address, rRows[0].id, qty]);
        }
      }

      // [코어행동 XP] 전투 결과로 XP 부여 → 레벨/진행감을 전투와 연결
      try { const xp = isWinner ? _winXp : _lossXp; if (xp > 0) await _db.awardXP(client, p.wallet_address, xp); } catch (_) {}

      if (isWinner && reward.gp_awarded > 0) {
        const allianceDividend = await awardAllianceBattleDividend(client, p.wallet_address, battleId, reward, settings);
        if (allianceDividend > 0) {
          reward.breakdown.alliance_treasury_bonus = allianceDividend;
          reward.breakdown.alliance_treasury_pct = settings.reward_alliance_treasury_pct;
        }
      }

      // 보상 로그
      await client.query(`
        INSERT INTO fleet_battle_rewards (
          battle_id, wallet_address, side, is_winner,
          gp_awarded, minerals_awarded, breakdown
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        battleId, p.wallet_address, p.side, isWinner,
        reward.gp_awarded, JSON.stringify(reward.minerals_awarded),
        JSON.stringify(reward.breakdown)
      ]);
      
      results.push({
        wallet_address: p.wallet_address,
        side: p.side,
        is_winner: isWinner,
        ...reward,
      });
      progressEvents.push({
        wallet: p.wallet_address,
        isWinner,
        gpAwarded: reward.gp_awarded,
      });
    }
    
    await client.query('COMMIT');
    recordBattleProgress(progressEvents);
    console.log(`[rewards] battle ${battleId} distributed to ${results.length} participants`);
    
    return results;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function recordBattleProgress(events) {
  for (const ev of events || []) {
    const w = String(ev.wallet || '').toLowerCase();
    if (!w) continue;
    if (dailyOps && typeof dailyOps.notifyMissionProgress === 'function') {
      dailyOps.notifyMissionProgress(w, 'battle_participate').catch(() => {});
      dailyOps.notifyMissionProgress(w, 'battle_participate_3').catch(() => {});
      if (ev.isWinner) {
        dailyOps.notifyMissionProgress(w, 'battle_win').catch(() => {});
        dailyOps.notifyMissionProgress(w, 'battle_win_3').catch(() => {});
      }
    }
    if (dailyService && typeof dailyService.updateMissionProgress === 'function' && ev.isWinner) {
      dailyService.updateMissionProgress(w, 'win_naval_battle', 1).catch(() => {});
    }
    if (seasonService && typeof seasonService.addSeasonScore === 'function') {
      if (ev.isWinner) seasonService.addSeasonScore(w, 'naval_win', 1).catch(() => {});
      if (ev.gpAwarded > 0) seasonService.addSeasonScore(w, 'gp_earn', Math.round(ev.gpAwarded)).catch(() => {});
    }
  }
}

async function awardAllianceBattleDividend(client, walletAddress, battleId, reward, settings) {
  const pct = Math.max(0, Math.min(25, parseInt(settings.reward_alliance_treasury_pct, 10) || 0));
  if (pct <= 0) return 0;

  const cap = Math.max(0, parseInt(settings.reward_alliance_treasury_cap_gp, 10) || 0);
  let amount = Math.floor((Number(reward.gp_awarded) || 0) * pct / 100);
  if (cap > 0) amount = Math.min(amount, cap);
  if (amount <= 0) return 0;

  const { rows } = await client.query(`
    SELECT am.alliance_id, u.wallet_address AS canonical_wallet
      FROM alliance_members am
      JOIN alliances a ON a.id = am.alliance_id
      JOIN users u ON LOWER(u.wallet_address) = LOWER(am.wallet_address)
     WHERE LOWER(am.wallet_address) = LOWER($1)
       AND am.left_at IS NULL
       AND a.disbanded_at IS NULL
     LIMIT 1
     FOR UPDATE OF am, a
  `, [walletAddress]);
  const member = rows[0];
  if (!member) return 0;

  await client.query(
    `UPDATE alliances
        SET alliance_gp = COALESCE(alliance_gp, 0) + $1
      WHERE id = $2`,
    [amount, member.alliance_id]
  );
  await client.query(
    `UPDATE alliance_members
        SET contribution = COALESCE(contribution, 0) + $1
      WHERE alliance_id = $2
        AND LOWER(wallet_address) = LOWER($3)`,
    [amount, member.alliance_id, walletAddress]
  );
  await client.query(`
    INSERT INTO alliance_log (alliance_id, wallet, event_type, amount_gp, note)
    VALUES ($1, $2, 'battle', $3, $4)
  `, [member.alliance_id, member.canonical_wallet || walletAddress, amount, `Battle #${battleId} war dividend`]);

  return amount;
}

/**
 * 개별 참가자의 보상 계산
 */
async function computeReward(participant, battle, settings, isWinner) {
  const breakdown = {};
  let totalGp = 0;
  const minerals = {};
  
  // 1. 기본 GP
  let baseGp = 0;
  if (isWinner) {
    if (battle.battle_type === 'siege')        baseGp = settings.reward_base_gp_siege;
    else if (battle.battle_type === 'hijack')  baseGp = Math.floor(settings.reward_base_gp_siege * 0.7);
    else                                        baseGp = settings.reward_base_gp_pvp;
  } else {
    // 패배자: 위로 GP (완전 패배 아닐 때)
    if (parseInt(participant.damage_dealt || 0) > 0) {
      baseGp = settings.reward_loser_consolation;
    }
  }
  
  // 2. 데미지 기여도 배율 (0.5~1.5배)
  const damageShare = parseFloat(participant.damage_share_pct || 0);
  // 아군 중에서의 기여도
  const damageMult = Math.max(0.5, Math.min(1.5, 0.5 + damageShare * 2));
  baseGp = Math.floor(baseGp * damageMult);
  breakdown.base = baseGp;
  breakdown.damage_share = Math.round(damageShare * 100) / 100;
  totalGp += baseGp;
  
  // 3. 격침당 GP (승리자만)
  if (isWinner) {
    const enemyShipsLost = battle.winner_side === 'atk' ? 
      battle.def_ships_lost : battle.atk_ships_lost;
    // 각 참가자는 자기 팀의 데미지 기여도만큼 킬 GP 배분
    const killGp = Math.floor(
      enemyShipsLost * settings.reward_per_ship_destroyed * damageShare
    );
    breakdown.per_kill = killGp;
    totalGp += killGp;
  }
  
  // 4. 광물 드랍 (확률 기반, 승리자만)
  if (isWinner) {
    const dropPool = MINERAL_DROP_POOL[battle.battle_type] || MINERAL_DROP_POOL.pvp_duel;
    const dropChance = settings.reward_mineral_drop_chance / 100;
    
    for (const mineralCode of dropPool) {
      if (Math.random() < dropChance * damageMult) {
        const qty = Math.floor(5 + Math.random() * 15);
        minerals[mineralCode] = (minerals[mineralCode] || 0) + qty;
      }
    }
    applyEnvironmentSalvage(minerals, breakdown, battle, damageMult);
  }

  // ✅ [주간 이벤트] 수요일 전투 GP +30%
  try {
    if (new Date().getUTCDay() === 3) { // WED
      totalGp = Math.floor(totalGp * 1.3);
      breakdown.weekly_event = 'battle_gp_boost';
    }
  } catch (_) {}

  if (isWinner && battle.sector_id && ['pvp_duel', 'hijack'].includes(battle.battle_type)) {
    const bonusPct = Math.max(0, Math.min(50, parseInt(settings.reward_sector_conflict_bonus_pct, 10) || 15));
    const bonusGp = Math.floor(totalGp * bonusPct / 100);
    if (bonusGp > 0) {
      totalGp += bonusGp;
      breakdown.sector_conflict_bonus = bonusGp;
      breakdown.sector_conflict_bonus_pct = bonusPct;
      if (battle.battle_summary && battle.battle_summary.sector_code) {
        breakdown.sector_code = battle.battle_summary.sector_code;
      }
    }
  }
  
  return {
    gp_awarded: totalGp,
    minerals_awarded: minerals,
    breakdown,
  };
}

function applyEnvironmentSalvage(minerals, breakdown, battle, damageMult) {
  if (!battleEnvironment || typeof battleEnvironment.decorateBattle !== 'function') return;
  const decorated = battleEnvironment.decorateBattle(battle);
  const key = decorated && decorated.battlefield_key;
  const pool = BATTLEFIELD_SALVAGE_POOL[key];
  if (!pool || !pool.length) return;
  const idxSeed = parseInt(battle.id, 10) || 0;
  const pick = pool[Math.abs(idxSeed) % pool.length];
  const qty = Math.max(1, Math.floor((2 + Math.random() * 5) * Math.max(0.5, Math.min(1.5, damageMult || 1))));
  minerals[pick] = (minerals[pick] || 0) + qty;
  breakdown.environment_salvage = { battlefield_key: key, resource_code: pick, quantity: qty };
  breakdown.battlefield_label = decorated.battlefield_label || key;
}

/**
 * 무승부 시 최소 참가 보상
 */
async function distributeMinimalRewards(battleId) {
  const { rows: participants } = await pool.query(`
    SELECT wallet_address, side, damage_dealt 
    FROM fleet_battle_participants WHERE battle_id = $1
  `, [battleId]);
  
  const settings = await loadBattleSettings();
  const results = [];
  const progressEvents = [];
  const _db = require('../db');
  const _drawXp = parseInt(await _db.getSetting('battle_loss_xp', '5')) || 5;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Serialize concurrent reward distribution by locking the battle row first.
    // Without this FOR UPDATE, two concurrent calls both pass the fleet_battle_rewards
    // check (both see 0 rows) before either inserts, causing double GP payout.
    await client.query(
      `SELECT id FROM fleet_battles WHERE id = $1 FOR UPDATE`,
      [battleId]
    );

    // 이미 지급된 경우 중복 방지 (idempotency guard)
    const { rows: existing } = await client.query(
      `SELECT 1 FROM fleet_battle_rewards WHERE battle_id = $1 LIMIT 1`,
      [battleId]
    );
    if (existing.length > 0) {
      await client.query('ROLLBACK');
      return results; // 이미 지급됨
    }

    // [신규 유예] 무승부 경로에서도 보호 대상 신규 함선을 대파로 되살린다.
    await applyNewPlayerCombatGrace(client, battleId);

    for (const p of participants) {
      // 참가만으로 약간의 GP
      let gp = Math.floor(settings.reward_loser_consolation * 0.5);
      const breakdown = { draw: true };

      // ✅ [주간 이벤트] 수요일 전투 GP +30%
      try {
        if (new Date().getUTCDay() === 3) { // WED
          gp = Math.floor(gp * 1.3);
          breakdown.weekly_event = 'battle_gp_boost';
        }
      } catch (_) {}
      
      if (gp > 0) {
        await client.query(
          `UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)`,
          [gp, p.wallet_address]
        );
      }

      try { if (_drawXp > 0) await _db.awardXP(client, p.wallet_address, _drawXp); } catch (_) {}
      
      await client.query(`
        INSERT INTO fleet_battle_rewards (
          battle_id, wallet_address, side, is_winner, gp_awarded, minerals_awarded, breakdown
        ) VALUES ($1, $2, $3, false, $4, '{}'::jsonb, $5)
      `, [battleId, p.wallet_address, p.side, gp, JSON.stringify(breakdown)]);
      
      results.push({
        wallet_address: p.wallet_address,
        side: p.side,
        is_winner: false,
        gp_awarded: gp,
        minerals_awarded: {},
      });
      progressEvents.push({
        wallet: p.wallet_address,
        isWinner: false,
        gpAwarded: gp,
      });
    }
    
    await client.query('COMMIT');
    recordBattleProgress(progressEvents);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  
  return results;
}

// ─── settings 로드 ───

async function loadBattleSettings() {
  const { rows } = await pool.query(`
    SELECT key, value FROM settings WHERE category = 'fleet' AND key LIKE 'reward_%'
  `);
  
  const settings = {
    reward_base_gp_pvp: 100,
    reward_base_gp_siege: 500,
    reward_per_ship_destroyed: 10,
    reward_loser_consolation: 20,
    reward_mineral_drop_chance: 40,
    reward_sector_conflict_bonus_pct: 15,
    reward_alliance_treasury_pct: 5,
    reward_alliance_treasury_cap_gp: 100,
  };
  
  for (const row of rows) {
    const val = row.value;
    let n;
    if (typeof val === 'number') n = val;
    else if (typeof val === 'string') {
      n = parseInt(val.replace(/^"|"$/g, ''), 10);
    }
    if (!isNaN(n)) settings[row.key] = n;
  }
  
  return settings;
}

/**
 * 유저의 전투 보상 이력
 */
async function getUserRewardHistory(walletAddress, limit = 20) {
  const { rows } = await pool.query(`
    SELECT 
      r.*, 
      fb.battle_type, fb.winner_side, fb.ended_at
    FROM fleet_battle_rewards r
    JOIN fleet_battles fb ON fb.id = r.battle_id
    WHERE LOWER(r.wallet_address) = LOWER($1)
    ORDER BY r.created_at DESC
    LIMIT $2
  `, [walletAddress, limit]);
  
  return rows;
}

module.exports = {
  distributeRewards,
  getUserRewardHistory,
};
