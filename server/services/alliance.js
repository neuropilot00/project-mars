'use strict';
const pool = require('../db');

async function getSetting(key, fallback) {
  try {
    const { rows } = await pool.query('SELECT value FROM game_settings WHERE key=$1', [key]);
    if (rows.length) return rows[0].value;
  } catch (_) {}
  return String(fallback);
}

async function getSettings() {
  const keys = [
    'alliance_enabled','alliance_create_cost_gp','alliance_weekly_dues_gp',
    'alliance_max_members','alliance_defense_bonus','alliance_income_share',
    'alliance_treasury_withdraw_min','alliance_treasury_fee_pct'
  ];
  const { rows } = await pool.query(
    `SELECT key, value FROM game_settings WHERE key = ANY($1)`, [keys]);
  const m = {};
  rows.forEach(r => { m[r.key] = r.value; });
  return {
    enabled:           (m.alliance_enabled || 'true') === 'true',
    createCost:        parseFloat(m.alliance_create_cost_gp     || '200'),
    weeklyDues:        parseFloat(m.alliance_weekly_dues_gp     || '20'),
    maxMembers:        parseInt(m.alliance_max_members           || '5', 10),
    defenseBonus:      parseInt(m.alliance_defense_bonus        || '5', 10),
    incomeShare:       parseInt(m.alliance_income_share         || '5', 10),
    withdrawMin:       parseFloat(m.alliance_treasury_withdraw_min || '10'),
    withdrawFeePct:    parseFloat(m.alliance_treasury_fee_pct   || '5')
  };
}

// ── Create Alliance ───────────────────────────────────────────────────────────
async function createAlliance(leader, name, tag, description, emblem) {
  const lLower = leader.toLowerCase();
  const cfg = await getSettings();
  if (!cfg.enabled) throw new Error('Alliance system is disabled');
  if (!name || name.length < 2 || name.length > 50) throw new Error('Alliance name must be 2-50 characters');
  if (!tag  || tag.length  < 2 || tag.length  > 6)  throw new Error('Alliance tag must be 2-6 characters');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Already in an alliance?
    const { rows: memRows } = await client.query(
      `SELECT alliance_id FROM alliance_members WHERE wallet=$1`, [lLower]);
    if (memRows.length) throw new Error('You are already in an alliance');

    // GP cost
    const { rows: balRows } = await client.query(
      'SELECT balance FROM gp_balances WHERE wallet=$1 FOR UPDATE', [lLower]);
    const bal = balRows.length ? Number(balRows[0].balance) : 0;
    if (bal < cfg.createCost) throw new Error(`Insufficient GP (need ${cfg.createCost})`);
    await client.query(
      'UPDATE gp_balances SET balance = balance - $1 WHERE wallet=$2',
      [cfg.createCost, lLower]);

    // Create alliance
    const { rows: aRows } = await client.query(
      `INSERT INTO alliances (name, tag, leader, description, emblem, defense_bonus, income_share)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [name.trim(), tag.trim().toUpperCase(), lLower,
       description || null, emblem || '⚔️',
       cfg.defenseBonus, cfg.incomeShare]
    );
    const alliance = aRows[0];

    // Add leader as member
    await client.query(
      `INSERT INTO alliance_members (alliance_id, wallet, role)
       VALUES ($1,$2,'leader')`,
      [alliance.id, lLower]);

    // Log
    await client.query(
      `INSERT INTO alliance_log (alliance_id, wallet, event_type, amount_gp, note)
       VALUES ($1,$2,'created',$3,'Alliance created')`,
      [alliance.id, lLower, cfg.createCost]);

    await client.query('COMMIT');
    return alliance;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Join Alliance ─────────────────────────────────────────────────────────────
async function joinAlliance(wallet, allianceId) {
  const wLower = wallet.toLowerCase();
  const cfg = await getSettings();
  if (!cfg.enabled) throw new Error('Alliance system is disabled');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Already in an alliance?
    const { rows: memRows } = await client.query(
      `SELECT alliance_id FROM alliance_members WHERE wallet=$1`, [wLower]);
    if (memRows.length) throw new Error('You are already in an alliance. Leave first.');

    // Load alliance
    const { rows: aRows } = await client.query(
      `SELECT * FROM alliances WHERE id=$1 FOR UPDATE`, [allianceId]);
    if (!aRows.length) throw new Error('Alliance not found');
    const alliance = aRows[0];
    if (!alliance.is_recruiting) throw new Error('Alliance is not recruiting');
    if (alliance.member_count >= alliance.max_members) {
      throw new Error(`Alliance is full (${alliance.max_members} max)`);
    }
    if (alliance.leader === wLower) throw new Error('You are already the leader');

    await client.query(
      `INSERT INTO alliance_members (alliance_id, wallet, role) VALUES ($1,$2,'member')`,
      [allianceId, wLower]);
    await client.query(
      `UPDATE alliances SET member_count = member_count + 1 WHERE id=$1`, [allianceId]);
    await client.query(
      `INSERT INTO alliance_log (alliance_id, wallet, event_type, note)
       VALUES ($1,$2,'joined','Member joined')`,
      [allianceId, wLower]);

    await client.query('COMMIT');

    // Notify leader
    try {
      await pool.query(
        `INSERT INTO player_notifications (wallet, type, message, meta) VALUES ($1,'alliance_joined',$2,$3)`,
        [alliance.leader,
         `🤝 ${wLower.slice(0,10)}… joined alliance [${alliance.tag}]`,
         JSON.stringify({ alliance_id: allianceId })]
      );
    } catch (_) {}

    return { ok: true, allianceName: alliance.name };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Leave Alliance ────────────────────────────────────────────────────────────
async function leaveAlliance(wallet) {
  const wLower = wallet.toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: memRows } = await client.query(
      `SELECT am.*, a.name, a.tag, a.leader, a.member_count
       FROM alliance_members am
       JOIN alliances a ON a.id = am.alliance_id
       WHERE am.wallet=$1 FOR UPDATE`, [wLower]);
    if (!memRows.length) throw new Error('You are not in an alliance');
    const mem = memRows[0];
    if (mem.leader === wLower && mem.member_count > 1) {
      throw new Error('Transfer leadership before leaving (or kick all members first)');
    }

    await client.query(
      `DELETE FROM alliance_members WHERE wallet=$1`, [wLower]);
    await client.query(
      `UPDATE alliances SET member_count = member_count - 1 WHERE id=$1`,
      [mem.alliance_id]);
    await client.query(
      `INSERT INTO alliance_log (alliance_id, wallet, event_type, note)
       VALUES ($1,$2,'left','Member left')`,
      [mem.alliance_id, wLower]);

    // If leader was last member, dissolve
    if (mem.member_count <= 1) {
      await client.query(
        `DELETE FROM alliances WHERE id=$1`, [mem.alliance_id]);
    }

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Deposit to treasury ───────────────────────────────────────────────────────
async function depositTreasury(wallet, amount) {
  const wLower = wallet.toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: memRows } = await client.query(
      `SELECT am.alliance_id FROM alliance_members am WHERE am.wallet=$1`, [wLower]);
    if (!memRows.length) throw new Error('You are not in an alliance');
    const allianceId = memRows[0].alliance_id;

    const { rows: balRows } = await client.query(
      'SELECT balance FROM gp_balances WHERE wallet=$1 FOR UPDATE', [wLower]);
    const bal = balRows.length ? Number(balRows[0].balance) : 0;
    if (bal < amount) throw new Error(`Insufficient GP (have ${bal.toFixed(2)})`);

    await client.query(
      'UPDATE gp_balances SET balance = balance - $1 WHERE wallet=$2', [amount, wLower]);
    await client.query(
      `UPDATE alliances SET treasury_gp = treasury_gp + $1, total_gp_burned = total_gp_burned + $1
       WHERE id=$2`, [amount, allianceId]);
    await client.query(
      `INSERT INTO alliance_log (alliance_id, wallet, event_type, amount_gp, note)
       VALUES ($1,$2,'treasury_deposit',$3,'Deposit')`,
      [allianceId, wLower, amount]);

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Withdraw from treasury (leader only) ─────────────────────────────────────
async function withdrawTreasury(wallet, amount, note) {
  const wLower = wallet.toLowerCase();
  const cfg = await getSettings();
  if (amount < cfg.withdrawMin) throw new Error(`Minimum withdrawal is ${cfg.withdrawMin} GP`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: memRows } = await client.query(
      `SELECT am.role, am.alliance_id FROM alliance_members am WHERE am.wallet=$1`, [wLower]);
    if (!memRows.length) throw new Error('You are not in an alliance');
    if (memRows[0].role !== 'leader' && memRows[0].role !== 'officer') {
      throw new Error('Only the leader or officers can withdraw');
    }
    const allianceId = memRows[0].alliance_id;

    const { rows: aRows } = await client.query(
      `SELECT * FROM alliances WHERE id=$1 FOR UPDATE`, [allianceId]);
    if (!aRows.length) throw new Error('Alliance not found');
    const alliance = aRows[0];
    if (Number(alliance.treasury_gp) < amount) throw new Error('Insufficient treasury balance');

    const fee    = parseFloat((amount * cfg.withdrawFeePct / 100).toFixed(6));
    const payout = parseFloat((amount - fee).toFixed(6));

    await client.query(
      `UPDATE alliances SET treasury_gp = treasury_gp - $1 WHERE id=$2`, [amount, allianceId]);
    await client.query(
      `INSERT INTO gp_balances (wallet, balance) VALUES ($1, $2)
       ON CONFLICT (wallet) DO UPDATE SET balance = gp_balances.balance + EXCLUDED.balance`,
      [wLower, payout]);
    await client.query(
      `INSERT INTO alliance_log (alliance_id, wallet, event_type, amount_gp, note)
       VALUES ($1,$2,'treasury_withdraw',$3,$4)`,
      [allianceId, wLower, amount, note || 'Treasury withdrawal']);

    await client.query('COMMIT');
    return { ok: true, payout, fee };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────
async function getMyAlliance(wallet) {
  const wLower = wallet.toLowerCase();
  const { rows } = await pool.query(
    `SELECT a.*,
       array_agg(json_build_object(
         'wallet', am.wallet,
         'role', am.role,
         'joined_at', am.joined_at,
         'nick', up.nickname
       ) ORDER BY am.joined_at) AS members
     FROM alliances a
     JOIN alliance_members am ON am.alliance_id = a.id
     LEFT JOIN user_profiles up ON up.wallet = am.wallet
     WHERE a.id = (SELECT alliance_id FROM alliance_members WHERE wallet=$1)
     GROUP BY a.id`,
    [wLower]
  );
  return rows[0] || null;
}

async function getAlliances(search) {
  let q = `SELECT a.*,
     (SELECT nickname FROM user_profiles WHERE wallet = a.leader) AS leader_nick
   FROM alliances a WHERE a.is_recruiting=true`;
  const params = [];
  if (search) { params.push('%'+search+'%'); q += ` AND (a.name ILIKE $1 OR a.tag ILIKE $1)`; }
  q += ' ORDER BY a.member_count DESC, a.total_gp_burned DESC LIMIT 30';
  const { rows } = await pool.query(q, params);
  return rows;
}

async function getAllianceLog(allianceId, limit = 30) {
  const { rows } = await pool.query(
    `SELECT al.*, up.nickname FROM alliance_log al
     LEFT JOIN user_profiles up ON up.wallet = al.wallet
     WHERE al.alliance_id=$1 ORDER BY al.created_at DESC LIMIT $2`,
    [allianceId, limit]
  );
  return rows;
}

// ── Check if wallet is in an alliance (for defense bonus, income share) ───────
async function getMemberAlliance(wallet) {
  const { rows } = await pool.query(
    `SELECT a.*, am.role FROM alliances a
     JOIN alliance_members am ON am.alliance_id = a.id
     WHERE am.wallet=$1`, [wallet.toLowerCase()]
  );
  return rows[0] || null;
}

async function getAdminStats() {
  const [totals, alliances, settings] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) AS total_alliances,
         SUM(member_count) AS total_members,
         SUM(treasury_gp) AS total_treasury_gp,
         SUM(total_gp_burned) AS total_gp_burned
       FROM alliances`
    ),
    pool.query(
      `SELECT a.*, (SELECT nickname FROM user_profiles WHERE wallet = a.leader) AS leader_nick
       FROM alliances a ORDER BY a.total_gp_burned DESC LIMIT 30`
    ),
    pool.query(
      `SELECT key, value FROM game_settings WHERE category='alliance' ORDER BY key`
    )
  ]);
  return { totals: totals.rows[0], alliances: alliances.rows, settings: settings.rows };
}

module.exports = {
  createAlliance, joinAlliance, leaveAlliance,
  depositTreasury, withdrawTreasury,
  getMyAlliance, getAlliances, getAllianceLog, getMemberAlliance,
  getAdminStats, getSettings
};
