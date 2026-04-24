// server/services/battleScheduler.js (PATCH for Phase B)
// ═══════════════════════════════════════════════════════════════
// 기존 battleScheduler.js의 runBattle 함수에 보상 분배를 추가합니다.
//
// 변경사항:
//   - const battleRewards = require('./battleRewards') 추가
//   - applyBattleResults 다음에 distributeRewards 호출 추가
//
// 아래 전체 파일을 교체합니다.
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');
const battleEngine = require('./battleEngine');
const battleTimeline = require('./battleTimeline');
const battleRewards = require('./battleRewards');   // ★ Phase B 추가

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
        ships_at_start = sub.ship_count,
        hp_at_start = sub.total_hp
      FROM (
        SELECT s.fleet_id, 
               COUNT(*) AS ship_count, 
               COALESCE(SUM(s.current_hp), 0) AS total_hp
        FROM ships s WHERE s.is_alive = true
        GROUP BY s.fleet_id
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
    
    // 5. 보상 분배 (★ Phase B 추가)
    try {
      const rewards = await battleRewards.distributeRewards(battleId);
      console.log(`[battleScheduler] battle ${battleId} rewards distributed to ${rewards.length}`);
    } catch (rewardErr) {
      console.error(`[battleScheduler] reward distribution failed:`, rewardErr);
      // 보상 실패해도 전투 자체는 유효
    }
    
    // 6. Chronicle
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
