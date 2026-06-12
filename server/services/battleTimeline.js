// server/services/battleTimeline.js
// ═══════════════════════════════════════════════════════════════
// Battle Timeline Storage
//
// 전투 시뮬레이션 결과(타임라인 JSON)를 DB에 저장/조회.
// 클라이언트가 타임라인을 받아서 재생.
//
// 저장 방식:
//   - 작은 타임라인 (<1MB): fleet_battles.battle_summary JSONB
//   - 큰 타임라인: 별도 fleet_battle_timelines 테이블에 저장
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');

const INLINE_SIZE_LIMIT = 500 * 1024;   // 500KB 이하면 battle_summary에 inline
const MAX_SIZE_LIMIT = 10 * 1024 * 1024;// 10MB 이상은 거부

// ─── 타임라인 저장 ───

/**
 * 전투 타임라인을 DB에 저장
 * @param {number} battleId
 * @param {Object} timeline - battleEngine.simulateBattle()의 timeline 필드
 * @returns {Object} { storage_type, size_bytes }
 */
async function saveTimeline(battleId, timeline) {
  // 테이블 존재 확인 (없으면 생성)
  await ensureTimelineTable();
  
  const json = JSON.stringify(timeline);
  const sizeBytes = Buffer.byteLength(json, 'utf8');
  
  if (sizeBytes > MAX_SIZE_LIMIT) {
    throw new Error(`TIMELINE_TOO_LARGE: ${sizeBytes} bytes (max ${MAX_SIZE_LIMIT})`);
  }
  
  // 큰 타임라인은 별도 테이블
  if (sizeBytes > INLINE_SIZE_LIMIT) {
    await pool.query(`
      INSERT INTO fleet_battle_timelines (battle_id, timeline_json, size_bytes, frame_count)
      VALUES ($1, $2::jsonb, $3, $4)
      ON CONFLICT (battle_id) DO UPDATE SET
        timeline_json = EXCLUDED.timeline_json,
        size_bytes = EXCLUDED.size_bytes,
        frame_count = EXCLUDED.frame_count,
        created_at = NOW()
    `, [battleId, json, sizeBytes, timeline.frames?.length || 0]);
    
    return { storage_type: 'table', size_bytes: sizeBytes };
  }
  
  // 작으면 battle_summary에 추가
  await pool.query(`
    UPDATE fleet_battles 
    SET battle_summary = COALESCE(battle_summary, '{}'::jsonb) || jsonb_build_object('timeline', $1::jsonb)
    WHERE id = $2
  `, [json, battleId]);
  
  return { storage_type: 'inline', size_bytes: sizeBytes };
}

// ─── 타임라인 조회 ───

/**
 * 전투 타임라인 조회
 * @param {number} battleId
 * @returns {Object|null} timeline 또는 null
 */
async function getTimeline(battleId) {
  // 먼저 별도 테이블 확인
  const { rows: tableRows } = await pool.query(`
    SELECT timeline_json, size_bytes, frame_count, created_at
    FROM fleet_battle_timelines
    WHERE battle_id = $1
  `, [battleId]).catch(() => ({ rows: [] }));
  
  if (tableRows[0]) {
    return {
      timeline: tableRows[0].timeline_json,
      meta: {
        storage_type: 'table',
        size_bytes: tableRows[0].size_bytes,
        frame_count: tableRows[0].frame_count,
        created_at: tableRows[0].created_at,
      }
    };
  }
  
  // battle_summary에 inline 저장된 것 확인
  const { rows: inlineRows } = await pool.query(`
    SELECT battle_summary->'timeline' AS timeline, ended_at
    FROM fleet_battles
    WHERE id = $1
  `, [battleId]);
  
  if (inlineRows[0] && inlineRows[0].timeline) {
    return {
      timeline: inlineRows[0].timeline,
      meta: {
        storage_type: 'inline',
        created_at: inlineRows[0].ended_at,
      }
    };
  }
  
  return null;
}

// ─── 참여 유저의 전투 결과 요약 ───

/**
 * 특정 유저가 참여한 전투들의 요약 (관전 리플레이 목록용)
 */
async function getUserBattleHistory(walletAddress, limit = 20) {
  const { rows } = await pool.query(`
    SELECT 
      fb.id, fb.battle_type, fb.status, fb.winner_side,
      fb.battle_started_at, fb.ended_at, fb.duration_seconds,
      fb.atk_ships_total, fb.def_ships_total,
      fb.atk_ships_lost, fb.def_ships_lost,
      sd.code AS sector_code,
      COALESCE(sd.name_ko, sd.name_en) AS sector_name,
      p.side AS my_side,
      p.fleet_id AS my_fleet_id,
      p.ships_lost AS my_ships_lost,
      p.damage_dealt AS my_damage,
      COALESCE(r.gp_awarded, 0) AS my_reward_gp,
      r.minerals_awarded AS my_reward_minerals,
      r.breakdown AS my_reward_breakdown,
      f.name AS my_fleet_name,
      CASE WHEN p.side = fb.winner_side THEN 'win'
           WHEN fb.winner_side = 'draw' THEN 'draw'
           ELSE 'loss' END AS my_result
    FROM fleet_battle_participants p
    JOIN fleet_battles fb ON fb.id = p.battle_id
    LEFT JOIN fleets f ON f.id = p.fleet_id
    LEFT JOIN sector_definitions sd ON sd.id = fb.sector_id
    LEFT JOIN fleet_battle_rewards r
      ON r.battle_id = fb.id AND LOWER(r.wallet_address) = LOWER(p.wallet_address)
    WHERE LOWER(p.wallet_address) = LOWER($1) AND fb.status = 'ended'
    ORDER BY fb.ended_at DESC NULLS LAST
    LIMIT $2
  `, [walletAddress, limit]);
  
  return rows;
}

// ─── 전투 상세 정보 ───

async function getBattleInfo(battleId) {
  const { rows } = await pool.query(`
    SELECT 
      fb.*,
      sd.code AS sector_code,
      COALESCE(sd.name_ko, sd.name_en) AS sector_name,
      array_agg(json_build_object(
        'fleet_id', p.fleet_id,
        'wallet', p.wallet_address,
        'side', p.side,
        'ships_at_start', p.ships_at_start,
        'ships_alive', p.ships_alive,
        'ships_lost', p.ships_lost,
        'damage_dealt', p.damage_dealt,
        'fleet_name', f.name,
        'nickname', u.nickname
      )) FILTER (WHERE p.fleet_id IS NOT NULL) AS participants
    FROM fleet_battles fb
    LEFT JOIN fleet_battle_participants p ON p.battle_id = fb.id
    LEFT JOIN fleets f ON f.id = p.fleet_id
    LEFT JOIN users u ON u.wallet_address = p.wallet_address
    LEFT JOIN sector_definitions sd ON sd.id = fb.sector_id
    WHERE fb.id = $1
    GROUP BY fb.id, sd.code, sd.name_ko, sd.name_en
  `, [battleId]);
  
  return rows[0] || null;
}

// ─── 테이블 생성 (최초 1회) ───

let tableEnsured = false;
async function ensureTimelineTable() {
  if (tableEnsured) return;
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fleet_battle_timelines (
        battle_id     BIGINT PRIMARY KEY REFERENCES fleet_battles(id) ON DELETE CASCADE,
        timeline_json JSONB NOT NULL,
        size_bytes    INTEGER NOT NULL,
        frame_count   INTEGER NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    tableEnsured = true;
  } catch (err) {
    console.error('[battleTimeline] ensureTable error:', err);
  }
}

module.exports = {
  saveTimeline,
  getTimeline,
  getUserBattleHistory,
  getBattleInfo,
};
