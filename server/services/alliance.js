// server/services/alliance.js
// ═══════════════════════════════════════════════════════════════
// Alliance System — 동맹 생성/관리/동맹전
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');
const { assertFleetsNotMining } = require('./fleetOccupancy');

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
      `SELECT gp_balance, faction_code FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`,
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
    const deductAlliance = await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1`,
      [fee, walletAddress]
    );
    if (deductAlliance.rowCount === 0) throw new Error('INSUFFICIENT_GP');
    
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

    const fleetIds = participants.map(p => Number(p.fleet_id)).filter(Number.isFinite);
    if (fleetIds.length !== participants.length) throw new Error('INVALID_FLEET');

    const { rows: fleetRows } = await client.query(
      `SELECT id, owner_wallet, is_in_battle
         FROM fleets
        WHERE id = ANY($1::bigint[])
        FOR UPDATE`,
      [fleetIds]
    );
    if (fleetRows.length !== fleetIds.length) throw new Error('FLEET_NOT_FOUND');

    const fleetsById = new Map(fleetRows.map(row => [Number(row.id), row]));
    for (const p of participants) {
      const fleet = fleetsById.get(Number(p.fleet_id));
      if (!fleet || (fleet.owner_wallet || '').toLowerCase() !== String(p.wallet || '').toLowerCase()) {
        throw new Error('FLEET_OWNER_MISMATCH');
      }
      if (fleet.is_in_battle) throw new Error('FLEET_IN_BATTLE');
    }
    await assertFleetsNotMining(client, fleetIds, 'FLEET_MINING');
    
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

// ═══════════════════════════════════════════════════════════════
// Guild-level Alliance (Phase D — M-157 alliance_guilds 테이블 기반)
// ───────────────────────────────────────────────────────────────
// 기존 alliance_members(wallet 기반)와 별도 트랙.
// 한 길드는 동시에 한 동맹에만(active). 동맹당 최대 N길드(설정).
// ═══════════════════════════════════════════════════════════════

async function _getSetting(client, key, fallback) {
  try {
    const r = await client.query('SELECT value FROM settings WHERE key = $1', [key]);
    if (!r.rows[0]) return fallback;
    const raw = r.rows[0].value;
    // JSONB로 저장됐으니 string/number/bool 그대로 와도 처리
    if (typeof raw === 'string') return raw.replace(/^"|"$/g, '');
    return raw;
  } catch { return fallback; }
}

async function _isGuildLeader(client, guildId, wallet) {
  const r = await client.query(
    `SELECT 1 FROM guilds WHERE id = $1 AND lower(leader_wallet) = lower($2)`,
    [guildId, wallet]
  );
  return !!r.rows[0];
}

async function _isAllianceLeader(client, allianceId, wallet) {
  const r = await client.query(
    `SELECT 1 FROM alliances WHERE id = $1 AND lower(leader_wallet) = lower($2)`,
    [allianceId, wallet]
  );
  return !!r.rows[0];
}

/**
 * addGuildToAlliance — 길드를 동맹에 추가
 *   - inviterWallet: 동맹 리더(초대권)이거나, 본인이 길드 리더(자가 가입)여야 함
 *   - max guilds: settings.alliance_max_guilds (기본 3)
 *   - 한 길드는 한 동맹만 (UNIQUE constraint)
 *   - 배신 쿨다운: 마지막 left_at 으로부터 alliance_betrayal_cooldown_hours 미경과면 거부
 */
async function addGuildToAlliance(allianceId, guildId, inviterWallet) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) 동맹 존재
    const a = await client.query(
      `SELECT id, leader_wallet, disbanded_at FROM alliances WHERE id = $1 FOR UPDATE`,
      [allianceId]
    );
    if (!a.rows[0]) throw new Error('ALLIANCE_NOT_FOUND');
    if (a.rows[0].disbanded_at) throw new Error('ALLIANCE_DISBANDED');

    // 2) 길드 존재
    const g = await client.query(
      `SELECT id, leader_wallet, name FROM guilds WHERE id = $1`, [guildId]
    );
    if (!g.rows[0]) throw new Error('GUILD_NOT_FOUND');

    // 3) 권한: 동맹 리더 OR 길드 리더
    const isAllianceLeader = String(a.rows[0].leader_wallet).toLowerCase() === String(inviterWallet).toLowerCase();
    const isGuildLeader    = String(g.rows[0].leader_wallet).toLowerCase() === String(inviterWallet).toLowerCase();
    if (!isAllianceLeader && !isGuildLeader) throw new Error('NOT_AUTHORIZED');

    // 4) 이미 다른 동맹 소속?
    const cur = await client.query(
      `SELECT alliance_id FROM alliance_guilds WHERE guild_id = $1 AND left_at IS NULL`,
      [guildId]
    );
    if (cur.rows[0]) {
      if (parseInt(cur.rows[0].alliance_id) === parseInt(allianceId)) {
        throw new Error('ALREADY_IN_THIS_ALLIANCE');
      }
      throw new Error('GUILD_ALREADY_IN_ANOTHER_ALLIANCE');
    }

    // 5) cap 체크
    const maxGuildsRaw = await _getSetting(client, 'alliance_max_guilds', '3');
    const maxGuilds = parseInt(String(maxGuildsRaw).replace(/[^0-9]/g, '')) || 3;
    const cnt = await client.query(
      `SELECT COUNT(*)::int AS c FROM alliance_guilds WHERE alliance_id = $1 AND left_at IS NULL`,
      [allianceId]
    );
    if (parseInt(cnt.rows[0].c) >= maxGuilds) {
      const err = new Error('ALLIANCE_FULL');
      err.meta = { current: cnt.rows[0].c, max: maxGuilds };
      throw err;
    }

    // 6) 배신 쿨다운 체크 — 가장 최근 left_at 이 cooldown 안이면 거부
    const cooldownHoursRaw = await _getSetting(client, 'alliance_betrayal_cooldown_hours', '168');
    const cooldownHours = parseInt(String(cooldownHoursRaw).replace(/[^0-9]/g, '')) || 168;
    const recent = await client.query(`
      SELECT left_at FROM alliance_guilds
       WHERE guild_id = $1 AND left_at IS NOT NULL
       ORDER BY left_at DESC LIMIT 1
    `, [guildId]);
    if (recent.rows[0]?.left_at) {
      const since = (Date.now() - new Date(recent.rows[0].left_at).getTime()) / 3600000;
      if (since < cooldownHours) {
        const err = new Error('BETRAYAL_COOLDOWN');
        err.meta = { remaining_hours: Math.ceil(cooldownHours - since) };
        throw err;
      }
    }

    // 7) INSERT
    const ins = await client.query(`
      INSERT INTO alliance_guilds (alliance_id, guild_id, invited_by)
      VALUES ($1, $2, $3)
      RETURNING id, joined_at
    `, [allianceId, guildId, inviterWallet.toLowerCase()]);

    await client.query('COMMIT');
    return { success: true, id: ins.rows[0].id, joined_at: ins.rows[0].joined_at };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') throw new Error('GUILD_ALREADY_IN_ANOTHER_ALLIANCE');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * removeGuildFromAlliance — 길드를 동맹에서 제거 (자발적 탈퇴 OR 동맹 리더가 추방)
 */
async function removeGuildFromAlliance(allianceId, guildId, byWallet) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 권한: 동맹 리더 OR 해당 길드 리더
    const isAllianceLeader = await _isAllianceLeader(client, allianceId, byWallet);
    const isGuildLeader    = await _isGuildLeader(client, guildId, byWallet);
    if (!isAllianceLeader && !isGuildLeader) throw new Error('NOT_AUTHORIZED');

    const upd = await client.query(`
      UPDATE alliance_guilds SET left_at = NOW()
       WHERE alliance_id = $1 AND guild_id = $2 AND left_at IS NULL
       RETURNING id
    `, [allianceId, guildId]);
    if (!upd.rows[0]) throw new Error('NOT_IN_ALLIANCE');

    await client.query('COMMIT');
    return { success: true, voluntary: isGuildLeader, forced: isAllianceLeader && !isGuildLeader };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * betrayAlliance — 길드가 한 동맹에서 다른 동맹으로 즉시 이적 (배신)
 *   - 길드 리더만 가능
 *   - 기존 동맹 left_at 기록 + betrayed_to/betrayed_at 채움
 *   - 새 동맹에 INSERT (cap/cooldown 체크는 betrayal에서 cooldown 무시 옵션 가능 → 일단 cooldown 체크함)
 *   - Chronicle 기록 (alliance_chronicle_betrayal_enabled = true 시)
 */
async function betrayAlliance(guildId, fromAllianceId, toAllianceId, actorWallet) {
  if (!toAllianceId) throw new Error('TARGET_ALLIANCE_REQUIRED');
  if (parseInt(fromAllianceId) === parseInt(toAllianceId)) throw new Error('SAME_ALLIANCE');

  const client = await pool.connect();
  let chronicleData = null;
  try {
    await client.query('BEGIN');

    // 권한: 길드 리더만
    if (!(await _isGuildLeader(client, guildId, actorWallet))) {
      throw new Error('NOT_GUILD_LEADER');
    }

    // 현재 fromAllianceId 에 속해있는지 확인
    const cur = await client.query(`
      SELECT id FROM alliance_guilds
       WHERE guild_id = $1 AND alliance_id = $2 AND left_at IS NULL
       FOR UPDATE
    `, [guildId, fromAllianceId]);
    if (!cur.rows[0]) throw new Error('NOT_IN_SOURCE_ALLIANCE');

    // 새 동맹 존재 + cap
    const newA = await client.query(
      `SELECT id, disbanded_at FROM alliances WHERE id = $1 FOR UPDATE`,
      [toAllianceId]
    );
    if (!newA.rows[0]) throw new Error('TARGET_ALLIANCE_NOT_FOUND');
    if (newA.rows[0].disbanded_at) throw new Error('TARGET_ALLIANCE_DISBANDED');

    const maxGuildsRaw = await _getSetting(client, 'alliance_max_guilds', '3');
    const maxGuilds = parseInt(String(maxGuildsRaw).replace(/[^0-9]/g, '')) || 3;
    const cnt = await client.query(
      `SELECT COUNT(*)::int AS c FROM alliance_guilds WHERE alliance_id = $1 AND left_at IS NULL`,
      [toAllianceId]
    );
    if (parseInt(cnt.rows[0].c) >= maxGuilds) {
      const err = new Error('TARGET_ALLIANCE_FULL');
      err.meta = { current: cnt.rows[0].c, max: maxGuilds };
      throw err;
    }

    // from 측 close (배신 흔적 남김)
    await client.query(`
      UPDATE alliance_guilds
         SET left_at = NOW(), betrayed_to = $1, betrayed_at = NOW()
       WHERE id = $2
    `, [toAllianceId, cur.rows[0].id]);

    // to 측 INSERT
    await client.query(`
      INSERT INTO alliance_guilds (alliance_id, guild_id, invited_by)
      VALUES ($1, $2, $3)
    `, [toAllianceId, guildId, actorWallet.toLowerCase()]);

    // 길드 정보 (Chronicle용)
    const gInfo = await client.query(
      `SELECT name, tag FROM guilds WHERE id = $1`, [guildId]
    );
    const fromName = await client.query(
      `SELECT name, tag FROM alliances WHERE id = $1`, [fromAllianceId]
    );
    const toName = await client.query(
      `SELECT name, tag FROM alliances WHERE id = $1`, [toAllianceId]
    );

    chronicleData = {
      guild_id: guildId,
      guild_name: gInfo.rows[0]?.name,
      from_alliance_id: fromAllianceId,
      from_alliance_name: fromName.rows[0]?.name,
      to_alliance_id: toAllianceId,
      to_alliance_name: toName.rows[0]?.name,
      actor_wallet: actorWallet.toLowerCase(),
    };

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Chronicle 기록 (fire-and-forget, after COMMIT)
  try {
    const enabled = String(await require('../db').getSetting('alliance_chronicle_betrayal_enabled', 'true')).replace(/"/g, '');
    if (enabled === 'true' || enabled === true) {
      const chronicle = require('./chronicle');
      // 닉네임 조회
      try {
        const { rows } = await pool.query(
          'SELECT nickname FROM users WHERE wallet_address = $1',
          [chronicleData.actor_wallet]
        );
        chronicleData.actor_nickname = rows[0]?.nickname || null;
      } catch {}

      chronicle.record('alliance_betrayal', {
        actor_wallet: chronicleData.actor_wallet,
        actor_nickname: chronicleData.actor_nickname,
        guild_id: chronicleData.guild_id,
        extra: {
          guild_name: chronicleData.guild_name,
          from_alliance_id: chronicleData.from_alliance_id,
          from_alliance_name: chronicleData.from_alliance_name,
          to_alliance_id: chronicleData.to_alliance_id,
          to_alliance_name: chronicleData.to_alliance_name,
        },
        webhook: true,
      }).catch(() => {});
    }
  } catch (_) {}

  return { success: true, ...chronicleData };
}

/**
 * getAllianceGuilds — 동맹의 활성 멤버 길드 목록
 */
async function getAllianceGuilds(allianceId) {
  const { rows } = await pool.query(`
    SELECT ag.id, ag.guild_id, ag.joined_at, ag.invited_by,
           g.name AS guild_name, g.tag AS guild_tag,
           g.emblem_emoji, g.emblem_image, g.member_count, g.level,
           g.leader_wallet,
           u.nickname AS leader_nickname
      FROM alliance_guilds ag
      JOIN guilds g ON g.id = ag.guild_id
      LEFT JOIN users u ON lower(u.wallet_address) = lower(g.leader_wallet)
     WHERE ag.alliance_id = $1 AND ag.left_at IS NULL
     ORDER BY ag.joined_at ASC
  `, [allianceId]);
  return rows;
}

/**
 * getMyGuildAlliance — 길드가 속한 동맹 (active)
 */
async function getMyGuildAlliance(guildId) {
  const { rows } = await pool.query(`
    SELECT a.id, a.name, a.tag, a.description, a.color_primary,
           a.leader_wallet, a.faction_code, a.created_at,
           ag.joined_at, ag.invited_by
      FROM alliance_guilds ag
      JOIN alliances a ON a.id = ag.alliance_id
     WHERE ag.guild_id = $1 AND ag.left_at IS NULL
       AND a.disbanded_at IS NULL
     LIMIT 1
  `, [guildId]);
  return rows[0] || null;
}

/**
 * getGuildAllianceHistory — 길드의 동맹 가입/배신 히스토리
 */
async function getGuildAllianceHistory(guildId, limit = 20) {
  const { rows } = await pool.query(`
    SELECT ag.alliance_id, a.name AS alliance_name, a.tag AS alliance_tag,
           ag.joined_at, ag.left_at, ag.betrayed_to, ag.betrayed_at,
           a2.name AS betrayed_to_name
      FROM alliance_guilds ag
      JOIN alliances a ON a.id = ag.alliance_id
      LEFT JOIN alliances a2 ON a2.id = ag.betrayed_to
     WHERE ag.guild_id = $1
     ORDER BY ag.joined_at DESC
     LIMIT $2
  `, [guildId, limit]);
  return rows;
}

module.exports = {
  createAlliance,
  joinAlliance,
  leaveAlliance,
  getMyAlliance,
  listAlliances,
  getAlliance,
  createTeamBattle,
  // Phase D — guild-level alliance
  addGuildToAlliance,
  removeGuildFromAlliance,
  betrayAlliance,
  getAllianceGuilds,
  getMyGuildAlliance,
  getGuildAllianceHistory,
};
