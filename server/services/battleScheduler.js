// server/services/battleScheduler.js (Phase C 버전)
// ═══════════════════════════════════════════════════════════════
// Phase B의 battleScheduler를 확장.
// 추가: hijack Phase 1/2 완료 hook + AI respawn 예약
//
// ⚠️ Phase B의 battleScheduler.js를 이 파일로 교체하세요.
// ═══════════════════════════════════════════════════════════════

const { pool, getSetting } = require('../db');
const battleEngine = require('./battleEngine');
const battleTimeline = require('./battleTimeline');
const battleRewards = require('./battleRewards');         // Phase B
const hijackService = require('./hijack');                // Phase C
const aiFleetManager = require('./aiFleetManager');       // Phase C

let intervalHandle = null;
const CHECK_INTERVAL_MS = 30 * 1000;
// [v7.188 fix] 이전엔 MAX_CONCURRENT 가 하드코딩 2 였음 — settings.battle_max_concurrent 무시. 이제 매 tick 마다 읽음.
let MAX_CONCURRENT_CACHE = 3; // settings 미존재 시 폴백
let currentlyRunning = 0;
let scanInProgress = false;
async function _readMaxConcurrent() {
  try {
    const { rows } = await pool.query(`SELECT value FROM settings WHERE key = 'battle_max_concurrent'`);
    const v = rows[0] && rows[0].value;
    const n = parseInt(typeof v === 'string' ? v.replace(/"/g,'') : v) || 0;
    if (n > 0 && n < 50) MAX_CONCURRENT_CACHE = n; // sane 범위 가드
  } catch (_) {}
  return MAX_CONCURRENT_CACHE;
}

async function cleanupStaleBattles() {
  // On startup: any battle still 'active' after 30+ minutes is stuck (process crash).
  // Mark them cancelled and free the fleet locks.
  try {
    const { rows } = await pool.query(`
      UPDATE fleet_battles
      SET status = 'cancelled', ended_at = NOW(),
          battle_summary = COALESCE(battle_summary,'{}')::jsonb
            || '{"error":"scheduler_restart_cleanup"}'::jsonb
      WHERE status = 'active'
        AND battle_started_at < NOW() - INTERVAL '30 minutes'
      RETURNING id
    `);
    for (const r of rows) {
      await pool.query(
        `UPDATE fleets SET is_in_battle=false, current_battle_id=NULL WHERE current_battle_id=$1`,
        [r.id]
      ).catch(() => {});
      console.log(`[battleScheduler] cleaned up stale battle ${r.id}`);
    }
    if (rows.length > 0) console.log(`[battleScheduler] cleaned ${rows.length} stale battles on startup`);
  } catch (err) {
    console.warn('[battleScheduler] cleanupStaleBattles error:', err.message);
  }
}

function start() {
  if (intervalHandle) return;
  // [v7.188 fix] 시작 시 1회 cache 워밍업.
  _readMaxConcurrent().then((n)=>{
    console.log(`[battleScheduler] starting (every ${CHECK_INTERVAL_MS/1000}s, max concurrent ${n})`);
  }).catch(()=>{});
  // Clean up any battles that were left active from a previous process run
  cleanupStaleBattles().catch(() => {});
  // [v7.188 fix] hijack Phase 2 orphans 복구 — setTimeout(3000) 중 프로세스 죽으면 stuck.
  try {
    const _hj = require('./hijack');
    if (typeof _hj.recoverOrphanedPhase2 === 'function') _hj.recoverOrphanedPhase2().catch(() => {});
  } catch (_) {}
  intervalHandle = setInterval(runOnce, CHECK_INTERVAL_MS);
  if (intervalHandle.unref) intervalHandle.unref();
}

function stop() {
  if (intervalHandle) { clearInterval(intervalHandle); intervalHandle = null; }
}

async function runOnce() {
  if (scanInProgress) {
    console.warn('[battleScheduler] scan skipped: previous scan still active');
    return { skipped: true };
  }
  scanInProgress = true;
  try {
  // [v7.188 fix] 매 tick 마다 settings 재조회 — admin 이 런타임에 바꿔도 반영.
  const maxC = await _readMaxConcurrent();
  if (currentlyRunning >= maxC) return { skipped: true, reason: 'concurrent_cap' };

    const { rows } = await pool.query(`
      SELECT id FROM fleet_battles
      WHERE status = 'preparing'
        AND scheduled_start_at IS NOT NULL
        AND scheduled_start_at <= NOW()
      ORDER BY scheduled_start_at ASC
      LIMIT $1
    `, [maxC - currentlyRunning]);
    
    for (const row of rows) {
      runBattle(row.id).catch(err => {
        console.error(`[battleScheduler] battle ${row.id} failed:`, err);
      });
    }
    return { dispatched: rows.length };
  } catch (err) {
    console.error('[battleScheduler] runOnce error:', err);
    return { error: err.message };
  } finally {
    scanInProgress = false;
  }
}

async function runBattle(battleId) {
  currentlyRunning++;
  try {
    console.log(`[battleScheduler] running battle ${battleId}`);
    
    // 전투 타입 미리 확인 (hijack 체크용)
    let battleType = null;
    let battlePhase = null;

    // 1. preparing → active + 참가 함대 lock을 한 트랜잭션에서 처리
    const startClient = await pool.connect();
    try {
      await startClient.query('BEGIN');

      const { rows: claimed } = await startClient.query(`
        UPDATE fleet_battles
        SET status = 'active', battle_started_at = COALESCE(battle_started_at, NOW())
        WHERE id = $1 AND status = 'preparing'
        RETURNING battle_type, phase
      `, [battleId]);
      if (!claimed[0]) {
        await startClient.query('ROLLBACK');
        console.log(`[battleScheduler] battle ${battleId} already claimed or not preparing`);
        return null;
      }
      battleType = claimed[0].battle_type;
      battlePhase = claimed[0].phase;

      const { rows: fleetLocks } = await startClient.query(`
        SELECT f.id, f.is_in_battle, f.current_battle_id
        FROM fleets f
        JOIN fleet_battle_participants p ON p.fleet_id = f.id
        WHERE p.battle_id = $1
        FOR UPDATE OF f
      `, [battleId]);

      const conflictingFleet = fleetLocks.find(f =>
        f.is_in_battle && String(f.current_battle_id || '') !== String(battleId)
      );
      if (conflictingFleet) {
        await startClient.query(`
          UPDATE fleet_battles
          SET status = 'cancelled', ended_at = NOW(),
              battle_summary = COALESCE(battle_summary,'{}'::jsonb)
                || jsonb_build_object('error', 'fleet_already_in_battle', 'fleet_id', $2::bigint)
          WHERE id = $1
        `, [battleId, conflictingFleet.id]);
        await startClient.query('COMMIT');
        console.warn(`[battleScheduler] battle ${battleId} cancelled: fleet ${conflictingFleet.id} already in battle`);
        return null;
      }

      await startClient.query(`
        UPDATE fleets SET is_in_battle = true, current_battle_id = $1
        WHERE id IN (SELECT fleet_id FROM fleet_battle_participants WHERE battle_id = $1)
      `, [battleId]);

      await startClient.query('COMMIT');
    } catch (claimErr) {
      try { await startClient.query('ROLLBACK'); } catch (_) {}
      throw claimErr;
    } finally {
      startClient.release();
    }
    
    await pool.query(`
      UPDATE fleet_battle_participants p SET
        ships_at_start = sub.ship_count, hp_at_start = sub.total_hp
      FROM (
        SELECT s.fleet_id, COUNT(*) AS ship_count, COALESCE(SUM(s.current_hp), 0) AS total_hp
        FROM ships s
        JOIN ship_types st ON st.code = s.ship_type_code
        WHERE s.is_alive = true
          AND ($2::text <> 'hijack_phase1' OR st.size_class = ANY($3::text[]))
        GROUP BY s.fleet_id
      ) sub
      WHERE p.fleet_id = sub.fleet_id AND p.battle_id = $1
    `, [battleId, battlePhase || '', ['frigate', 'destroyer']]);
    
    // 1-bis. AI 전략 — hijack 외 battle 에 자동 진형/기동 명령 (Phase 4)
    try {
      const ai = require('./aiStrategy');
      const aiResult = await ai.applyAIStrategy(battleId, battleType);
      if (aiResult && aiResult.applied) {
        console.log(`[battleScheduler] AI strategy applied to battle ${battleId}:`, aiResult.applied.length, 'sides');
      }
    } catch (aiErr) {
      console.warn(`[battleScheduler] AI strategy failed for battle ${battleId}:`, aiErr.message);
    }

    // 2. 시뮬레이션 — [Phase 3] siege + siege_realtime_enabled 면 실시간 권위 라이브 루프,
    //    아니면 기존 precompute → setTimeout stream(replay). 결과 shape 는 동일 → 이후 경로 공통.
    let result;
    let _liveEnabled = false;
    try { _liveEnabled = (battleType === 'siege') && (String(await getSetting('siege_realtime_enabled', 'false')) === 'true'); } catch (_) {}

    if (_liveEnabled) {
      // 라이브 틱 루프 — onFrame 으로 매 프레임 즉시 broadcast, 매 틱 명령 큐 드레인.
      //   권위: 이 워커(스케줄러 리더 = runBattle 실행자)가 단독 실행 + liveBattle.markActive 로 명령 수신 등록.
      const ws = require('../wsServer');
      const liveBattle = require('./liveBattle');
      let tickMs = 250, wallMin = 10;
      try { tickMs = parseInt(await getSetting('siege_realtime_tick_ms', '250')) || 250; } catch (_) {}
      try { wallMin = parseInt(await getSetting('siege_realtime_wallclock_min', '10')) || 10; } catch (_) {}
      liveBattle.markActive(battleId);
      try {
        result = await battleEngine.simulateBattleLive(battleId, {
          drainCommands: () => liveBattle.drainCommands(battleId),
          onFrame: (frame) => { try { ws.broadcastBattleFrame(battleId, frame); } catch (_) {} },
          tickMs, wallClockMs: wallMin * 60 * 1000,
        });
      } finally { liveBattle.clearActive(battleId); }
      try {
        ws.broadcastBattleEnd(battleId, { winner_side: result.winner_side, duration_seconds: result.duration_seconds, stats: result.stats });
      } catch (_) {}
      console.log(`[battleScheduler] LIVE siege ${battleId} done. Winner: ${result.winner_side}`);
    } else {
      result = await battleEngine.simulateBattle(battleId);

      // 2-bis. WebSocket 실시간 broadcast (precompute → setTimeout 체인 replay)
      //   [v7.192 F1] 멀티 인스턴스 frame stream 중복 차단 — _streamLock Redis SETNX 로 한 워커만 stream.
      try {
        const ws = require('../wsServer');
        const stats = ws.channelStats();
        let _streamOwnership = true;
        try {
          if (process.env.REDIS_URL) {
            const Redis = require('ioredis');
            if (!global.__streamLockRedis) {
              global.__streamLockRedis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2, family: 0 });
              global.__streamLockRedis.on('error', () => {});
            }
            const lockKey = 'om:battle_stream:' + battleId;
            const got = await global.__streamLockRedis.set(lockKey, process.pid, 'NX', 'PX', 60000).catch(() => null);
            _streamOwnership = (got === 'OK');
            if (!_streamOwnership) console.log(`[battleScheduler] battle ${battleId} frame stream lock held by another worker — skipping`);
          }
        } catch (_e) {}
        if (_streamOwnership && stats[battleId]) {
          const frames = result.timeline?.frames || [];
          const tickMs = result.timeline?.tick_ms || 200;
          let i = 0;
          const streamNext = () => {
            if (i >= frames.length) {
              ws.broadcastBattleEnd(battleId, { winner_side: result.winner_side, duration_seconds: result.duration_seconds, stats: result.stats });
              return;
            }
            ws.broadcastBattleFrame(battleId, frames[i]);
            i++;
            setTimeout(streamNext, Math.max(10, tickMs / 8));
          };
          streamNext();
          console.log(`[battleScheduler] WS streaming ${frames.length} frames to ${stats[battleId]} subscribers`);
        }
      } catch (wsErr) {
        console.warn(`[battleScheduler] ws broadcast failed:`, wsErr.message);
      }
    }

    // 3. 타임라인 저장
    const timelineSaved = await battleTimeline.saveTimeline(battleId, result.timeline);
    console.log(`[battleScheduler] battle ${battleId} timeline saved: ${timelineSaved.size_bytes} bytes`);
    
    // 4. DB 반영
    await battleEngine.applyBattleResults(battleId, result);

    // 4.5 CPI / Daily OPS 후속 처리
    try {
      await _postBattleHooks(battleId, result);
    } catch (hookErr) {
      console.error(`[battleScheduler] post battle hooks failed:`, hookErr);
    }
    
    // 5. 보상 분배 (Phase B)
    try {
      const rewards = await battleRewards.distributeRewards(battleId);
      console.log(`[battleScheduler] battle ${battleId} rewards distributed to ${rewards.length}`);
    } catch (rewardErr) {
      console.error(`[battleScheduler] reward failed:`, rewardErr);
    }
    
    // 5.5 길드전 포인트 적립 — 함대전 승리 시 진행 중인 길드전에 점수 추가
    try {
      await _guildWarHook(battleId, result);
    } catch (gwErr) {
      console.error(`[battleScheduler] guild war hook failed:`, gwErr);
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
    await pool.query(`
      UPDATE fleets
      SET is_in_battle=false, current_battle_id=NULL
      WHERE current_battle_id=$1
        AND NOT EXISTS (
          SELECT 1 FROM fleet_battles
          WHERE id=$1 AND status='active'
        )
    `, [battleId]).catch(()=>{});
    currentlyRunning--;
  }
}

// ─── 전투 종료 후 후속 Hook ───────────────────────────────────
async function _postBattleHooks(battleId, result) {
  const { rows: parts } = await pool.query(
    `SELECT p.wallet_address, p.side, p.fleet_id,
            fb.battle_type, fb.battle_summary
       FROM fleet_battle_participants p
       JOIN fleet_battles fb ON fb.id = p.battle_id
      WHERE p.battle_id = $1`,
    [battleId]
  );
  const atkPart = parts.find(p => p.side === 'atk');
  const defPart = parts.find(p => p.side === 'def');
  const atkFleetId = atkPart?.fleet_id;
  const defFleetId = defPart?.fleet_id;
  const atkWallet = atkPart?.wallet_address;
  const defWallet = defPart?.wallet_address;
  const winner = result?.winner_side;

  // ✅ [Phase1 길드공성] siege 전투 종료 → 거버너 이전 등 siege 해결 위임 (fire-and-forget)
  try {
    if (parts[0]?.battle_type === 'siege') {
      require('./siegeFleetBridge').applySiegeResult(battleId).catch((e) =>
        console.warn('[battleScheduler] applySiegeResult failed:', e.message));
    }
  } catch (_siege) {}

  // ✅ [CPI] 전투 종료 후 양 함대 CPI 재계산 (fire-and-forget)
  try {
    const battleReport = require('./battleReport');
    if (typeof battleReport.updateFleetCPI === 'function') {
      if (atkFleetId) battleReport.updateFleetCPI(atkFleetId).catch(() => {});
      if (defFleetId) battleReport.updateFleetCPI(defFleetId).catch(() => {});
    }
  } catch (_cpi) {}

  // ✅ [Daily OPS] 전투 참여/승리 미션 트래킹 (fire-and-forget)
  try {
    const dailyOps = require('../routes/dailyOps');
    if (typeof dailyOps.notifyMissionProgress === 'function') {
      if (atkWallet) { dailyOps.notifyMissionProgress(atkWallet, 'battle_participate').catch(() => {}); dailyOps.notifyMissionProgress(atkWallet, 'battle_participate_3').catch(() => {}); }
      if (defWallet) { dailyOps.notifyMissionProgress(defWallet, 'battle_participate').catch(() => {}); dailyOps.notifyMissionProgress(defWallet, 'battle_participate_3').catch(() => {}); }

      const winnerWallet = winner === 'atk' ? atkWallet : winner === 'def' ? defWallet : null;
      if (winnerWallet) { dailyOps.notifyMissionProgress(winnerWallet, 'battle_win').catch(() => {}); dailyOps.notifyMissionProgress(winnerWallet, 'battle_win_3').catch(() => {}); }

      const battleMeta = parts[0] || {};
      const summary = battleMeta.battle_summary || {};
      const isAiBattle = summary.is_ai_battle === true
        || summary.is_ai_battle === 'true'
        || String(battleMeta.battle_type || '').toLowerCase().includes('ai');
      if (isAiBattle) {
        if (atkWallet) { dailyOps.notifyMissionProgress(atkWallet, 'ai_battle').catch(() => {}); dailyOps.notifyMissionProgress(atkWallet, 'ai_battle_3').catch(() => {}); }
        if (defWallet) { dailyOps.notifyMissionProgress(defWallet, 'ai_battle').catch(() => {}); dailyOps.notifyMissionProgress(defWallet, 'ai_battle_3').catch(() => {}); }
      }
    }
  } catch (_do) {}
}

// ─── 길드전 Hook ───────────────────────────────────────────────
// 함대전 승리 시 진행 중인 길드전에 포인트 자동 적립 (fire-and-forget)
async function _guildWarHook(battleId, result) {
  const winnerSide = result.winner_side; // 'atk' | 'def'
  if (!winnerSide) return; // draw or no result

  // 참여자 wallet 조회
  const { rows: parts } = await pool.query(
    `SELECT wallet_address, side FROM fleet_battle_participants WHERE battle_id = $1`,
    [battleId]
  );
  const atkPart = parts.find(p => p.side === 'atk');
  const defPart = parts.find(p => p.side === 'def');
  if (!atkPart || !defPart) return;

  const atkWallet = atkPart.wallet_address;
  const defWallet = defPart.wallet_address;

  // 두 플레이어가 현재 전쟁 중인 길드에 속하는지 확인
  const { rows: warRows } = await pool.query(`
    SELECT gw.id, gm1.guild_id AS atk_guild, gm2.guild_id AS def_guild
    FROM guild_wars gw
    JOIN guild_members gm1 ON gm1.wallet = $1
    JOIN guild_members gm2 ON gm2.wallet = $2
    WHERE gw.status = 'active'
      AND (
        (gw.attacker_guild_id = gm1.guild_id AND gw.defender_guild_id = gm2.guild_id)
        OR
        (gw.attacker_guild_id = gm2.guild_id AND gw.defender_guild_id = gm1.guild_id)
      )
    LIMIT 1
  `, [atkWallet, defWallet]);

  if (!warRows.length) return; // 전쟁 중인 길드 아님

  // 승자 wallet에 포인트 적립
  const winnerWallet = winnerSide === 'atk' ? atkWallet : defWallet;
  try {
    const { getSetting } = require('../db');
    const guildService = require('./guild');
    const points = parseInt(await getSetting('guild_war_points_ship_battle', '10')) || 10;
    const pts = await guildService.recordWarAction(winnerWallet, 'fleet_battle_win', points, { battleId });
    if (pts && pts.warId) {
      console.log(`[guildWarHook] battle ${battleId}: +${pts.points} pts → guild #${pts.guildId} (war #${pts.warId})`);
    }
  } catch (e) {
    console.warn('[guildWarHook] recordWarAction failed:', e.message);
  }
}

module.exports = { start, stop, runOnce, runBattle };
