// server/services/shipScheduler.js
// ═══════════════════════════════════════════════════════════════
// Ship Build Job Scheduler
// 
// 완료 시간이 지난 ship_build_jobs 를 자동으로 완료 처리
// server/index.js 에서 앱 시작 시 호출:
//   require('./services/shipScheduler').start();
// ═══════════════════════════════════════════════════════════════

const shipService = require('./ship');

let intervalHandle = null;
const CHECK_INTERVAL_MS = 30 * 1000; // 30초마다 체크

/**
 * 스케줄러 시작
 */
function start() {
  if (intervalHandle) {
    console.log('[shipScheduler] already running');
    return;
  }
  
  console.log(`[shipScheduler] starting (every ${CHECK_INTERVAL_MS/1000}s)`);
  
  // 즉시 1회 실행
  runOnce();
  
  // 주기 실행
  intervalHandle = setInterval(runOnce, CHECK_INTERVAL_MS);
  if (intervalHandle.unref) intervalHandle.unref();
}

/**
 * 스케줄러 중지
 */
function stop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[shipScheduler] stopped');
  }
}

/**
 * 완료 작업 1회 처리
 */
async function runOnce() {
  try {
    const result = await shipService.processCompletedJobs();
    if (result.success > 0 || result.failed > 0) {
      console.log(`[shipScheduler] processed: ${result.success} success, ${result.failed} failed`);
      if (result.errors.length > 0) {
        console.warn('[shipScheduler] errors:', result.errors.slice(0, 5));
      }
    }
  } catch (err) {
    console.error('[shipScheduler] run error:', err);
  }
}

module.exports = { start, stop, runOnce };
