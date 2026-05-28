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

const { pool } = require('../db');

// 광물 드랍 풀 (전투 타입별로 다름)
const MINERAL_DROP_POOL = {
  pvp_duel: ['iron_dust', 'red_sand', 'regolith_ore'],
  siege:    ['iron_dust', 'regolith_ore', 'basalt_chip', 'ice_crystal', 'volcanic_shard'],
  hijack:   ['iron_dust', 'plasma_dust', 'ancient_metal'],
  raid:     ['iron_dust', 'volcanic_shard', 'meteorite_fragment'],
};

/**
 * 전투 종료 후 보상 계산 & 지급
 * @param {number} battleId
 * @returns {Array<Object>} 각 참가자별 보상 내역
 */
async function distributeRewards(battleId) {
  // 전투 정보 + 참가자 데이터
  const { rows: battleRows } = await pool.query(`
    SELECT id, battle_type, winner_side, atk_ships_lost, def_ships_lost, battle_summary
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
    }
    
    await client.query('COMMIT');
    console.log(`[rewards] battle ${battleId} distributed to ${results.length} participants`);
    
    return results;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
  }

  // ✅ [주간 이벤트] 수요일 전투 GP +30%
  try {
    if (new Date().getUTCDay() === 3) { // WED
      totalGp = Math.floor(totalGp * 1.3);
      breakdown.weekly_event = 'battle_gp_boost';
    }
  } catch (_) {}
  
  return {
    gp_awarded: totalGp,
    minerals_awarded: minerals,
    breakdown,
  };
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
    }
    
    await client.query('COMMIT');
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
