// server/services/replayShare.js
// ═══════════════════════════════════════════════════════════════
// Replay Sharing — 전투 리플레이 공유 URL 생성/관리
// ═══════════════════════════════════════════════════════════════

const crypto = require('crypto');
const { pool } = require('../db');

function generateShareToken() {
  return crypto.randomBytes(12).toString('base64url');  // 16자
}

// ─── 리플레이 공유 생성 ───

async function createShare(battleId, walletAddress, options = {}) {
  const { title, description, thumbnail_url, is_public = true, expires_days } = options;
  
  // 전투 확인 (참가자만 공유 가능)
  const { rows: bRows } = await pool.query(`
    SELECT fb.id, fb.status, fb.winner_side,
           p.wallet_address AS participant
    FROM fleet_battles fb
    LEFT JOIN fleet_battle_participants p ON p.battle_id = fb.id AND p.wallet_address = $2
    WHERE fb.id = $1
  `, [battleId, walletAddress]);
  
  if (!bRows[0]) throw new Error('BATTLE_NOT_FOUND');
  if (bRows[0].status !== 'ended') throw new Error('BATTLE_NOT_ENDED');
  if (!bRows[0].participant) {
    // 참가자가 아니면 공유 불가 (옵션으로 허용 가능)
    throw new Error('NOT_PARTICIPANT');
  }
  
  // [v7.68] pg_advisory_xact_lock으로 동일 wallet 직렬화 — 한도 체크 후 INSERT 사이 race 방지
  const { rows: setRows } = await pool.query(
    `SELECT value FROM settings WHERE key = 'max_replays_per_user'`
  );
  const maxReplays = parseInt(String(setRows[0]?.value || '50').replace(/"/g,'')) || 50;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [walletAddress.toLowerCase()]);

    // 공유 한도 체크
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*) AS c FROM battle_replays
       WHERE shared_by = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
      [walletAddress]
    );
    if (parseInt(countRows[0].c) >= maxReplays) {
      await client.query('ROLLBACK');
      throw new Error('REPLAY_LIMIT_REACHED');
    }

    // 이미 공유된 전투?
    const { rows: existing } = await client.query(
      `SELECT share_token FROM battle_replays
       WHERE battle_id = $1 AND shared_by = $2
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [battleId, walletAddress]
    );
    if (existing[0]) {
      await client.query('ROLLBACK');
      return { share_token: existing[0].share_token, already_shared: true };
    }

    // 만료일
    const { rows: defaultExpireRows } = await client.query(
      `SELECT value FROM settings WHERE key = 'default_expire_days'`
    );
    const defaultExpireDays = parseInt(String(defaultExpireRows[0]?.value || '30').replace(/"/g,'')) || 30;
    const actualExpireDays = expires_days !== undefined ? expires_days : defaultExpireDays;

    const token = generateShareToken();

    const { rows } = await client.query(`
      INSERT INTO battle_replays (
        battle_id, share_token, shared_by,
        title, description, thumbnail_url, is_public,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7,
        CASE WHEN $8::int > 0 THEN NOW() + ($8 || ' days')::INTERVAL ELSE NULL END
      )
      RETURNING id, share_token, created_at, expires_at
    `, [
      battleId, token, walletAddress,
      title || null, description || null, thumbnail_url || null, is_public,
      actualExpireDays
    ]);

    await client.query('COMMIT');
    return {
      ...rows[0],
      share_url: `/replay/${token}`,
    };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// ─── 리플레이 조회 (토큰으로) ───

async function getReplayByToken(token, viewerIp = null, viewerUa = null) {
  const { rows } = await pool.query(`
    SELECT 
      r.*, 
      u.nickname AS shared_by_nickname,
      fb.battle_type, fb.winner_side, fb.duration_seconds,
      fb.atk_ships_total, fb.atk_ships_lost,
      fb.def_ships_total, fb.def_ships_lost
    FROM battle_replays r
    JOIN fleet_battles fb ON fb.id = r.battle_id
    LEFT JOIN users u ON u.wallet_address = r.shared_by
    WHERE r.share_token = $1
      AND (r.expires_at IS NULL OR r.expires_at > NOW())
  `, [token]);
  
  if (!rows[0]) return null;
  const replay = rows[0];
  
  if (!replay.is_public) {
    // 비공개: 공유자만 볼 수 있음 (옵션으로 처리)
    // 여기서는 그냥 public인 것만 보여주게
  }
  
  // 조회수 증가 + 로그
  pool.query(
    `UPDATE battle_replays SET view_count = view_count + 1 WHERE id = $1`,
    [replay.id]
  ).catch(()=>{});
  
  if (viewerIp) {
    pool.query(`
      INSERT INTO replay_views (replay_id, viewer_ip, viewer_ua) 
      VALUES ($1, $2, $3)
    `, [replay.id, viewerIp, viewerUa || null]).catch(()=>{});
  }
  
  return replay;
}

// ─── 내 공유 리플레이 목록 ───

async function getMyReplays(walletAddress) {
  const { rows } = await pool.query(`
    SELECT r.*, 
           fb.battle_type, fb.winner_side
    FROM battle_replays r
    JOIN fleet_battles fb ON fb.id = r.battle_id
    WHERE r.shared_by = $1
      AND (r.expires_at IS NULL OR r.expires_at > NOW())
    ORDER BY r.created_at DESC
  `, [walletAddress]);
  return rows;
}

// ─── 공개/추천 리플레이 목록 ───

async function getFeaturedReplays(limit = 20) {
  const { rows } = await pool.query(`
    SELECT 
      r.id, r.share_token, r.title, r.description, r.thumbnail_url,
      r.view_count, r.is_featured, r.created_at,
      u.nickname AS shared_by_nickname,
      fb.battle_type, fb.winner_side, fb.duration_seconds,
      fb.atk_ships_total, fb.def_ships_total
    FROM battle_replays r
    JOIN fleet_battles fb ON fb.id = r.battle_id
    LEFT JOIN users u ON u.wallet_address = r.shared_by
    WHERE r.is_public = true
      AND (r.expires_at IS NULL OR r.expires_at > NOW())
    ORDER BY 
      r.is_featured DESC,
      r.view_count DESC,
      r.created_at DESC
    LIMIT $1
  `, [limit]);
  return rows;
}

// ─── 리플레이 삭제 ───

async function deleteReplay(replayId, walletAddress) {
  const { rows } = await pool.query(
    `DELETE FROM battle_replays WHERE id = $1 AND shared_by = $2 RETURNING id`,
    [replayId, walletAddress]
  );
  return { deleted: !!rows[0] };
}

module.exports = {
  createShare,
  getReplayByToken,
  getMyReplays,
  getFeaturedReplays,
  deleteReplay,
};
