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
  console.log(`[battleScheduler] starting (every ${CHECK_INTERVAL_MS/1000}s, max concurrent ${MAX_CONCURRENT})`);
  // Clean up any battles that were left active from a previous process run
  cleanupStaleBattles().catch(() => {});
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

    // 2. 시뮬레이션
    const result = await battleEngine.simulateBattle(battleId);

    // 2-bis. WebSocket 실시간 broadcast — Phase 2
    // 시뮬은 동기로 끝났지만, 클라가 ws 로 구독 중이면 frame 단위로 stream.
    // 1 frame = tick_ms (200ms) 간격으로 emit. 클라가 이미 timeline replay 모드면 ws 무시 가능.
    try {
      const ws = require('../wsServer');
      const stats = ws.channelStats();
      if (stats[battleId]) {
        const frames = result.timeline?.frames || [];
        const tickMs = result.timeline?.tick_ms || 200;
        // 별도 setTimeout 체인으로 frame stream — 시뮬 결과 저장은 즉시 진행
        let i = 0;
        const streamNext = () => {
          if (i >= frames.length) {
            ws.broadcastBattleEnd(battleId, {
              winner_side: result.winner_side,
              duration_seconds: result.duration_seconds,
              stats: result.stats
            });
            return;
          }
          ws.broadcastBattleFrame(battleId, frames[i]);
          i++;
          // 8x speed 로 stream (클라에서 속도 조절 가능, 기본 빠르게)
          setTimeout(streamNext, Math.max(10, tickMs / 8));
        };
        streamNext();
        console.log(`[battleScheduler] WS streaming ${frames.length} frames to ${stats[battleId]} subscribers`);
      }
    } catch (wsErr) {
      console.warn(`[battleScheduler] ws broadcast failed:`, wsErr.message);
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
      if (atkWallet) dailyOps.notifyMissionProgress(atkWallet, 'battle_participate').catch(() => {});
      if (defWallet) dailyOps.notifyMissionProgress(defWallet, 'battle_participate').catch(() => {});

      const winnerWallet = winner === 'atk' ? atkWallet : winner === 'def' ? defWallet : null;
      if (winnerWallet) dailyOps.notifyMissionProgress(winnerWallet, 'battle_win').catch(() => {});

      const battleMeta = parts[0] || {};
      const summary = battleMeta.battle_summary || {};
      const isAiBattle = summary.is_ai_battle === true
        || summary.is_ai_battle === 'true'
        || String(battleMeta.battle_type || '').toLowerCase().includes('ai');
      if (isAiBattle) {
        if (atkWallet) dailyOps.notifyMissionProgress(atkWallet, 'ai_battle').catch(() => {});
        if (defWallet) dailyOps.notifyMissionProgress(defWallet, 'ai_battle').catch(() => {});
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
