// server/services/alliance.js
// ═══════════════════════════════════════════════════════════════
// Alliance System — 동맹 생성/관리/동맹전
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');

const ROLE_LEADER = 'leader';
const ROLE_OFFICER = 'officer';
const ROLE_MEMBER = 'member';

// ─── 동맹 생성 ───

async function createAlliance(walletAddress, params) {
  const { name, tag, description, faction_code } = params;
  
  if (!name || name.trim().length === 0) throw new Error('NAME_REQUIRED');
  if (name.length > 60) throw new Error('NAME_TOO_LONG');
  if (tag && (tag.length < 2 || tag.length > 6)) throw new Error('INVALID_TAG');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 이미 동맹 소속?
    const { rows: existing } = await client.query(
      `SELECT 1 FROM alliance_members WHERE wallet_address = $1 AND left_at IS NULL`,
      [walletAddress]
    );
    if (existing[0]) throw new Error('ALREADY_IN_ALLIANCE');
    
    // 창설 비용
    const { rows: settingRows } = await client.query(
      `SELECT value FROM settings WHERE key = 'alliance_creation_fee_gp'`
    );
    const fee = parseInt(String(settingRows[0]?.value || '5000').replace(/"/g,'')) || 5000;
    
    const { rows: userRows } = await client.query(
      `SELECT gp_balance, faction_code FROM users WHERE wallet_address = $1 FOR UPDATE`,
      [walletAddress]
    );
    if (!userRows[0]) throw new Error('USER_NOT_FOUND');
    if (parseInt(userRows[0].gp_balance) < fee) {
      const err = new Error('INSUFFICIENT_GP');
      err.meta = { required: fee, balance: userRows[0].gp_balance };
      throw err;
    }
    
    // 파벌 확정 (유저 파벌 기본 사용)
    const allianceFaction = faction_code || userRows[0].faction_code;
    
    // GP 차감
    await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address = $2`,
      [fee, walletAddress]
    );
    
    // 파벌 색상 로드
    let colorPrimary = '#4fc3f7';
    if (allianceFaction) {
      const { rows: facRows } = await client.query(
        `SELECT color_primary FROM factions WHERE code = $1`, [allianceFaction]
      );
      if (facRows[0]) colorPrimary = facRows[0].color_primary;
    }
    
    // 동맹 생성
    const { rows: aRows } = await client.query(`
      INSERT INTO alliances (
        name, tag, description, leader_wallet, faction_code, color_primary
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, tag
    `, [name.trim(), tag ? tag.trim().toUpperCase() : null, description, 
        walletAddress, allianceFaction, colorPrimary]);
    
    const allianceId = aRows[0].id;
    
    // 리더 등록
    await client.query(`
      INSERT INTO alliance_members (alliance_id, wallet_address, role)
      VALUES ($1, $2, 'leader')
    `, [allianceId, walletAddress]);
    
    await client.query('COMMIT');
    return aRows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      // unique violation
      if (err.constraint?.includes('name')) throw new Error('NAME_TAKEN');
      if (err.constraint?.includes('tag')) throw new Error('TAG_TAKEN');
    }
    throw err;
  } finally {
    client.release();
  }
}

// ─── 가입 ───

async function joinAlliance(walletAddress, allianceId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { rows: existing } = await client.query(
      `SELECT 1 FROM alliance_members WHERE wallet_address = $1 AND left_at IS NULL`,
      [walletAddress]
    );
    if (existing[0]) throw new Error('ALREADY_IN_ALLIANCE');
    
    const { rows: aRows } = await client.query(
      `SELECT id, member_count, max_members FROM alliances 
       WHERE id = $1 AND disbanded_at IS NULL FOR UPDATE`, [allianceId]
    );
    if (!aRows[0]) throw new Error('ALLIANCE_NOT_FOUND');
    if (aRows[0].member_count >= aRows[0].max_members) throw new Error('ALLIANCE_FULL');
    
    await client.query(`
      INSERT INTO alliance_members (alliance_id, wallet_address, role)
      VALUES ($1, $2, 'member')
      ON CONFLICT (alliance_id, wallet_address) 
      DO UPDATE SET left_at = NULL, joined_at = NOW(), role = 'member'
    `, [allianceId, walletAddress]);
    
    await client.query(
      `UPDATE alliances SET member_count = member_count + 1 WHERE id = $1`,
      [allianceId]
    );
    
    await client.query('COMMIT');
    return { success: true, alliance_id: allianceId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── 탈퇴 ───

async function leaveAlliance(walletAddress) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { rows: memberRows } = await client.query(`
      SELECT am.alliance_id, am.role, a.member_count
      FROM alliance_members am
      JOIN alliances a ON a.id = am.alliance_id
      WHERE am.wallet_address = $1 AND am.left_at IS NULL
      FOR UPDATE OF am, a
    `, [walletAddress]);
    
    if (!memberRows[0]) throw new Error('NOT_IN_ALLIANCE');
    const { alliance_id, role, member_count } = memberRows[0];
    
    // 리더이면 동맹 해체 or 이양 필요
    if (role === 'leader') {
      if (member_count > 1) {
        throw new Error('LEADER_MUST_TRANSFER'); // 리더 이양 먼저
      }
      // 혼자면 해체
      await client.query(
        `UPDATE alliances SET disbanded_at = NOW() WHERE id = $1`,
        [alliance_id]
      );
    }
    
    await client.query(
      `UPDATE alliance_members SET left_at = NOW() 
       WHERE alliance_id = $1 AND wallet_address = $2`,
      [alliance_id, walletAddress]
    );
    
    await client.query(
      `UPDATE alliances SET member_count = member_count - 1 WHERE id = $1`,
      [alliance_id]
    );
    
    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── 조회 ───

async function getMyAlliance(walletAddress) {
  const { rows } = await pool.query(`
    SELECT 
      a.*, am.role, am.joined_at, am.contribution,
      fa.name_ko AS faction_name
    FROM alliance_members am
    JOIN alliances a ON a.id = am.alliance_id
    LEFT JOIN factions fa ON fa.code = a.faction_code
    WHERE am.wallet_address = $1 AND am.left_at IS NULL AND a.disbanded_at IS NULL
  `, [walletAddress]);
  
  if (!rows[0]) return null;
  
  // 멤버 목록
  const { rows: members } = await pool.query(`
    SELECT am.wallet_address, am.role, am.joined_at, am.contribution,
           u.nickname, 
           (SELECT COUNT(*) FROM ships WHERE owner_wallet = am.wallet_address AND is_alive) AS ships_count
    FROM alliance_members am
    LEFT JOIN users u ON u.wallet_address = am.wallet_address
    WHERE am.alliance_id = $1 AND am.left_at IS NULL
    ORDER BY 
      CASE am.role WHEN 'leader' THEN 1 WHEN 'officer' THEN 2 ELSE 3 END,
      am.contribution DESC
  `, [rows[0].id]);
  
  return {
    ...rows[0],
    members,
  };
}

async function listAlliances() {
  const { rows } = await pool.query(`
    SELECT * FROM v_alliance_summary 
    ORDER BY battles_won DESC, member_count DESC 
    LIMIT 50
  `);
  return rows;
}

async function getAlliance(allianceId) {
  const { rows } = await pool.query(
    `SELECT * FROM v_alliance_summary WHERE id = $1`, [allianceId]
  );
  if (!rows[0]) return null;
  
  const { rows: members } = await pool.query(`
    SELECT am.wallet_address, am.role, am.joined_at, u.nickname
    FROM alliance_members am
    LEFT JOIN users u ON u.wallet_address = am.wallet_address
    WHERE am.alliance_id = $1 AND am.left_at IS NULL
    ORDER BY CASE am.role WHEN 'leader' THEN 1 WHEN 'officer' THEN 2 ELSE 3 END
  `, [allianceId]);
  
  return { ...rows[0], members };
}

// ─── 팀전 생성 ───

/**
 * 동맹전/팀전 전투 생성
 * participants = [{ wallet, fleet_id, team_id, alliance_id? }]
 */
async function createTeamBattle(params) {
  const { participants, battle_type = 'event' } = params;
  
  if (!Array.isArray(participants) || participants.length < 4) {
    throw new Error('NOT_ENOUGH_PARTICIPANTS');
  }
  
  const teams = new Set(participants.map(p => p.team_id));
  if (teams.size < 2) throw new Error('NEED_AT_LEAST_2_TEAMS');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 전투 생성
    const { rows: bRows } = await client.query(`
      INSERT INTO fleet_battles (
        battle_type, status, phase, is_team_battle, team_count,
        prepare_started_at, scheduled_start_at
      ) VALUES ($1, 'preparing', 'main', true, $2, NOW(), NOW())
      RETURNING id
    `, [battle_type, teams.size]);
    const battleId = bRows[0].id;
    
    // 참가자 등록
    for (const p of participants) {
      // side: team_id 1 = atk, 나머지 = def로 간단 매핑
      // (engine이 side 기준으로 처리하므로 팀이 많아도 2팀으로 집계됨)
      // 완전한 4팀 지원하려면 battleEngine 수정 필요, 여기서는 2팀 확장 먼저
      const side = p.team_id === 1 ? 'atk' : 'def';
      
      await client.query(`
        INSERT INTO fleet_battle_participants (
          battle_id, fleet_id, wallet_address, side, team_id, alliance_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [battleId, p.fleet_id, p.wallet, side, p.team_id, p.alliance_id || null]);
    }
    
    await client.query('COMMIT');
    return { battle_id: battleId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  createAlliance,
  joinAlliance,
  leaveAlliance,
  getMyAlliance,
  listAlliances,
  getAlliance,
  createTeamBattle,
};
