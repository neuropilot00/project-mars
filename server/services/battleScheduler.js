// server/services/battleScheduler.js
// ═══════════════════════════════════════════════════════════════
// Battle Scheduler
//
// 예약된 전투(siege 등)를 자동으로 시작.
// scheduled_start_at <= NOW() 인 전투를 찾아 simulateBattle() 실행.
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');
const battleEngine = require('./battleEngine');
const battleTimeline = require('./battleTimeline');

let intervalHandle = null;
const CHECK_INTERVAL_MS = 30 * 1000;   // 30초마다
const MAX_CONCURRENT = 2;               // 동시 시뮬레이션 수 제한
let currentlyRunning = 0;

/**
 * 스케줄러 시작
 */
function start() {
  if (intervalHandle) {
    console.log('[battleScheduler] already running');
    return;
  }
  console.log(`[battleScheduler] starting (every ${CHECK_INTERVAL_MS/1000}s, max concurrent ${MAX_CONCURRENT})`);
  intervalHandle = setInterval(runOnce, CHECK_INTERVAL_MS);
}

function stop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[battleScheduler] stopped');
  }
}

/**
 * 준비 상태인 전투 스캔 & 시작
 */
async function runOnce() {
  // 동시 실행 제한
  if (currentlyRunning >= MAX_CONCURRENT) {
    return;
  }
  
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

/**
 * 단일 전투 실행 (시뮬레이션 → 타임라인 저장 → DB 반영)
 */
async function runBattle(battleId) {
  currentlyRunning++;
  try {
    console.log(`[battleScheduler] running battle ${battleId}`);
    
    // 1. 상태 업데이트: active
    await pool.query(`
      UPDATE fleet_battles 
      SET status = 'active', battle_started_at = NOW()
      WHERE id = $1 AND status = 'preparing'
    `, [battleId]);
    
    // 참여 함대들 상태 업데이트
    await pool.query(`
      UPDATE fleets SET is_in_battle = true, current_battle_id = $1
      WHERE id IN (SELECT fleet_id FROM fleet_battle_participants WHERE battle_id = $1)
    `, [battleId]);
    
    // 참여 함대 스냅샷 기록 (ships_at_start, hp_at_start)
    await pool.query(`
      UPDATE fleet_battle_participants p SET
        ships_at_start = sub.ship_count,
        hp_at_start = sub.total_hp
      FROM (
        SELECT s.fleet_id, 
               COUNT(*) AS ship_count, 
               COALESCE(SUM(s.current_hp), 0) AS total_hp
        FROM ships s
        WHERE s.is_alive = true
        GROUP BY s.fleet_id
      ) sub
      WHERE p.fleet_id = sub.fleet_id AND p.battle_id = $1
    `, [battleId]);
    
    // 2. 시뮬레이션
    const result = await battleEngine.simulateBattle(battleId);
    
    // 3. 타임라인 저장
    const timelineSaved = await battleTimeline.saveTimeline(battleId, result.timeline);
    console.log(`[battleScheduler] battle ${battleId} timeline saved: ${timelineSaved.size_bytes} bytes (${timelineSaved.storage_type})`);
    
    // 4. DB에 결과 반영
    await battleEngine.applyBattleResults(battleId, result);
    
    // 5. Chronicle 이벤트 발행 (publish_fleet_battle_chronicle 함수 있으면)
    try {
      await pool.query(`SELECT publish_fleet_battle_chronicle($1, 'concluded')`, [battleId]);
    } catch (e) {
      // 함수 없어도 무시
    }
    
    console.log(`[battleScheduler] battle ${battleId} completed: ${result.winner_side} won after ${result.duration_seconds}s`);
    
    return result;
  } catch (err) {
    console.error(`[battleScheduler] battle ${battleId} error:`, err);
    // 실패 시 cancelled 처리
    await pool.query(`
      UPDATE fleet_battles 
      SET status = 'cancelled', ended_at = NOW(),
          battle_summary = COALESCE(battle_summary, '{}'::jsonb) || jsonb_build_object('error', $1::text)
      WHERE id = $2
    `, [err.message, battleId]).catch(() => {});
    
    await pool.query(`
      UPDATE fleets SET is_in_battle = false, current_battle_id = NULL
      WHERE current_battle_id = $1
    `, [battleId]).catch(() => {});
    
    throw err;
  } finally {
    currentlyRunning--;
  }
}

module.exports = { start, stop, runOnce, runBattle };
