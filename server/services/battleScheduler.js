// server/services/battleScheduler.js (Phase C 버전)
// ═══════════════════════════════════════════════════════════════
// Phase B의 battleScheduler를 확장.
// 추가: hijack Phase 1/2 완료 hook + AI respawn 예약
//
// ⚠️ Phase B의 battleScheduler.js를 이 파일로 교체하세요.
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');
const battleEngine = require('./battleEngine');
const battleTimeline = require('./battleTimeline');
const battleRewards = require('./battleRewards');         // Phase B
const hijackService = require('./hijack');                // Phase C
const aiFleetManager = require('./aiFleetManager');       // Phase C

let intervalHandle = null;
const CHECK_INTERVAL_MS = 30 * 1000;
const MAX_CONCURRENT = 2;
let currentlyRunning = 0;

function start() {
  if (intervalHandle) return;
  console.log(`[battleScheduler] starting (every ${CHECK_INTERVAL_MS/1000}s, max concurrent ${MAX_CONCURRENT})`);
  intervalHandle = setInterval(runOnce, CHECK_INTERVAL_MS);
}

function stop() {
  if (intervalHandle) { clearInterval(intervalHandle); intervalHandle = null; }
}

async function runOnce() {
  if (currentlyRunning >= MAX_CONCURRENT) return;
  
  try {
    const { rows } = await pool.query(`
      SELECT id FROM fleet_battles
      WHERE status = 'preparing' 
        AND scheduled_start_at IS NOT NULL
        AND scheduled_start_at <= NOW()
      ORDER BY scheduled_start_at ASC
      LIMIT $1
    `, [MAX_CONCURRENT - currentlyRunning]);
    
    for (const row of rows) {
      runBattle(row.id).catch(err => {
        console.error(`[battleScheduler] battle ${row.id} failed:`, err);
      });
    }
  } catch (err) {
    console.error('[battleScheduler] runOnce error:', err);
  }
}

async function runBattle(battleId) {
  currentlyRunning++;
  try {
    console.log(`[battleScheduler] running battle ${battleId}`);
    
    // 전투 타입 미리 확인 (hijack 체크용)
    const { rows: btype } = await pool.query(
      `SELECT battle_type, phase FROM fleet_battles WHERE id = $1`, [battleId]
    );
    const battleType = btype[0]?.battle_type;
    const battlePhase = btype[0]?.phase;
    
    // 1. preparing → active
    await pool.query(`
      UPDATE fleet_battles 
      SET status = 'active', battle_started_at = NOW()
      WHERE id = $1 AND status = 'preparing'
    `, [battleId]);
    
    await pool.query(`
      UPDATE fleets SET is_in_battle = true, current_battle_id = $1
      WHERE id IN (SELECT fleet_id FROM fleet_battle_participants WHERE battle_id = $1)
    `, [battleId]);
    
    await pool.query(`
      UPDATE fleet_battle_participants p SET
        ships_at_start = sub.ship_count, hp_at_start = sub.total_hp
      FROM (
        SELECT s.fleet_id, COUNT(*) AS ship_count, COALESCE(SUM(s.current_hp), 0) AS total_hp
        FROM ships s WHERE s.is_alive = true GROUP BY s.fleet_id
      ) sub
      WHERE p.fleet_id = sub.fleet_id AND p.battle_id = $1
    `, [battleId]);
    
    // 2. 시뮬레이션
    const result = await battleEngine.simulateBattle(battleId);
    
    // 3. 타임라인 저장
    const timelineSaved = await battleTimeline.saveTimeline(battleId, result.timeline);
    console.log(`[battleScheduler] battle ${battleId} timeline saved: ${timelineSaved.size_bytes} bytes`);
    
    // 4. DB 반영
    await battleEngine.applyBattleResults(battleId, result);
    
    // 5. 보상 분배 (Phase B)
    try {
      const rewards = await battleRewards.distributeRewards(battleId);
      console.log(`[battleScheduler] battle ${battleId} rewards distributed to ${rewards.length}`);
    } catch (rewardErr) {
      console.error(`[battleScheduler] reward failed:`, rewardErr);
    }
    
    // 6. Hijack Phase 1/2 연동 (Phase C)
    if (battleType === 'hijack') {
      try {
        if (battlePhase === 'hijack_phase1') {
          await hijackService.handlePhase1Complete(battleId);
        } else if (battlePhase === 'hijack_phase2') {
          await hijackService.handlePhase2Complete(battleId);
        }
      } catch (hjErr) {
        console.error(`[battleScheduler] hijack hook failed:`, hjErr);
      }
    }
    
    // 7. AI respawn 예약 (Phase C)
    try {
      await aiFleetManager.scheduleRespawnIfNeeded(battleId);
    } catch (aiErr) {
      console.error(`[battleScheduler] AI respawn failed:`, aiErr);
    }
    
    // 8. Chronicle
    try {
      await pool.query(`SELECT publish_fleet_battle_chronicle($1, 'concluded')`, [battleId]);
    } catch (e) {}
    
    console.log(`[battleScheduler] battle ${battleId} completed: ${result.winner_side} won after ${result.duration_seconds}s`);
    return result;
  } catch (err) {
    console.error(`[battleScheduler] battle ${battleId} error:`, err);
    await pool.query(`
      UPDATE fleet_battles SET status='cancelled', ended_at=NOW(),
        battle_summary = COALESCE(battle_summary,'{}'::jsonb) || jsonb_build_object('error', $1::text)
      WHERE id=$2
    `, [err.message, battleId]).catch(()=>{});
    await pool.query(`
      UPDATE fleets SET is_in_battle=false, current_battle_id=NULL WHERE current_battle_id=$1
    `, [battleId]).catch(()=>{});
    throw err;
  } finally {
    currentlyRunning--;
  }
}

module.exports = { start, stop, runOnce, runBattle };
