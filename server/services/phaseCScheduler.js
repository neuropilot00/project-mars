// server/services/phaseCScheduler.js
// ═══════════════════════════════════════════════════════════════
// Phase C Scheduler — AI 함대 유지 + 토너먼트 진행 + Hijack 체크
// ═══════════════════════════════════════════════════════════════

const aiFleetManager = require('./aiFleetManager');
const tournament = require('./tournament');
const { pool } = require('../db');

let intervalHandle = null;
let initialTimeoutHandle = null;
const CHECK_INTERVAL_MS = 60 * 1000;  // 1분

function start() {
  if (intervalHandle) return;
  console.log(`[phaseCScheduler] starting (every ${CHECK_INTERVAL_MS/1000}s)`);
  
  // 즉시 실행 (AI 함대 확보)
  initialTimeoutHandle = setTimeout(() => {
    aiFleetManager.ensureAiFleets()
      .then(r => console.log(`[phaseCScheduler] initial AI fleets: ${r.created} created`))
      .catch(err => console.error('[phaseCScheduler] AI init error:', err));
  }, 5000);
  if (initialTimeoutHandle.unref) initialTimeoutHandle.unref();
  
  intervalHandle = setInterval(runOnce, CHECK_INTERVAL_MS);
  if (intervalHandle.unref) intervalHandle.unref();
}

function stop() {
  if (initialTimeoutHandle) { clearTimeout(initialTimeoutHandle); initialTimeoutHandle = null; }
  if (intervalHandle) { clearInterval(intervalHandle); intervalHandle = null; }
}

async function runOnce() {
  // 1. AI 함대 유지
  try {
    const r = await aiFleetManager.ensureAiFleets();
    if (r.created > 0) console.log(`[phaseCScheduler] respawned ${r.created} AI fleets`);
  } catch (err) {
    console.error('[phaseCScheduler] AI error:', err);
  }
  
  // 2. 준비 완료된 토너먼트 시작
  try {
    const { rows: readyTournaments } = await pool.query(`
      SELECT id FROM tournaments
      WHERE status = 'ready' 
        AND start_at <= NOW()
      LIMIT 3
    `);
    for (const t of readyTournaments) {
      try {
        await tournament.startTournament(t.id);
        console.log(`[phaseCScheduler] started tournament ${t.id}`);
      } catch (err) {
        console.error(`[phaseCScheduler] tournament ${t.id} start error:`, err.message);
      }
    }
  } catch (err) {
    console.error('[phaseCScheduler] tournament start scan error:', err);
  }
  
  // 3. 진행 중 토너먼트의 준비된 매치 실행
  try {
    const { rows: running } = await pool.query(`
      SELECT DISTINCT tournament_id FROM tournament_matches
      WHERE status = 'ready'
    `);
    for (const t of running) {
      await tournament.runReadyMatches(t.tournament_id).catch(err => 
        console.error(`[phaseCScheduler] match run error:`, err)
      );
    }
  } catch (err) {
    console.error('[phaseCScheduler] match scan error:', err);
  }
  
  // 4. 마감된 토너먼트 자동 시작 (최소 인원 도달 시)
  // CAS: 단일 UPDATE로 SELECT+UPDATE를 원자화 — 동시 스케줄러 이중 전환 방지
  try {
    const { rows: promoted } = await pool.query(`
      UPDATE tournaments SET status = 'ready'
      WHERE status = 'registering'
        AND registration_deadline <= NOW()
        AND current_participants >= min_participants
      RETURNING id
    `);
    if (promoted.length > 0) {
      console.log(`[phaseCScheduler] promoted tournaments to ready: ${promoted.map(r => r.id).join(', ')}`);
    }

    // 인원 미달은 취소 (이미 단일 UPDATE — 원자적)
    await pool.query(`
      UPDATE tournaments SET status = 'cancelled'
      WHERE status = 'registering'
        AND registration_deadline <= NOW()
        AND current_participants < min_participants
    `);
  } catch (err) {
    console.error('[phaseCScheduler] deadline scan error:', err);
  }
}

module.exports = { start, stop, runOnce };
