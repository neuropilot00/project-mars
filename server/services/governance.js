// ═══════════════════════════════════════════════════════
//  Governance Service — Governor, Commander, GP logic
// ═══════════════════════════════════════════════════════
const { pool, getSettings } = require('../db');

// ── Cache ──
let _govSettings = null;
let _govSettingsAt = 0;
async function govCfg() {
  if (!_govSettings || Date.now() - _govSettingsAt > 30000) {
    _govSettings = await getSettings();
    _govSettingsAt = Date.now();
  }
  return _govSettings;
}

// ═══════════════════════════════════════════════════════
//  RECALCULATE GOVERNOR (sector-level)
//  Called after claim/hijack changes pixel ownership
// ═══════════════════════════════════════════════════════
async function recalculateGovernor(client, sectorId) {
  // Top 2 pixel holders in this sector
  const res = await client.query(
    `SELECT owner, COUNT(*)::int AS cnt FROM pixels
     WHERE sector_id = $1 AND owner IS NOT NULL
     GROUP BY owner ORDER BY cnt DESC LIMIT 2`,
    [sectorId]
  );

  const top1 = res.rows[0] || null;
  const top2 = res.rows[1] || null;
  const newGov = top1 ? top1.owner : null;
  const newVice = top2 ? top2.owner : null;

  // Current governor/vice
  const sectorRes = await client.query(
    'SELECT governor_wallet, vice_governor_wallet FROM sectors WHERE id = $1',
    [sectorId]
  );
  const sector = sectorRes.rows[0];
  if (!sector) return { changed: false };

  const oldGov = sector.governor_wallet;
  const oldVice = sector.vice_governor_wallet;
  let changed = false;

  // ── Governor change ──
  if (newGov !== oldGov) {
    changed = true;
    // Close old governor's history record + transfer GP
    if (oldGov) {
      await client.query(
        `UPDATE governance_history SET ended_at = NOW(),
           tenure_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::int
         WHERE wallet = $1 AND role = 'governor' AND sector_id = $2 AND ended_at IS NULL`,
        [oldGov, sectorId]
      );
      const oldPos = await client.query(
        `SELECT gp_balance FROM governance_positions WHERE role = 'governor' AND sector_id = $1`,
        [sectorId]
      );
      const oldGP = oldPos.rows[0] ? parseFloat(oldPos.rows[0].gp_balance) : 0;
      // Record tax earned in history
      if (oldGP > 0) {
        await client.query(
          `UPDATE governance_history SET total_tax_earned = $1
           WHERE id = (
             SELECT id FROM governance_history
             WHERE wallet = $2 AND role = 'governor' AND sector_id = $3 AND ended_at IS NOT NULL
             ORDER BY ended_at DESC LIMIT 1
           )`,
          [oldGP, oldGov, sectorId]
        );
        await client.query(
          'UPDATE sectors SET sector_pool_gp = sector_pool_gp + $1 WHERE id = $2',
          [oldGP, sectorId]
        );
        await logGovTx(client, 'position_transfer', 'governor', 'sector_pool', sectorId, oldGov, oldGP,
          { reason: 'governor_replaced', newGovernor: newGov });
      }
      // Remove old position
      await client.query(
        `DELETE FROM governance_positions WHERE role = 'governor' AND sector_id = $1`,
        [sectorId]
      );
    }
    // Create new governor position + history record
    if (newGov) {
      await client.query(
        `INSERT INTO governance_positions (wallet, role, sector_id, gp_balance, appointed_at)
         VALUES ($1, 'governor', $2, 0, NOW())
         ON CONFLICT (role, sector_id) DO UPDATE SET wallet = $1, gp_balance = 0, appointed_at = NOW()`,
        [newGov, sectorId]
      );
      await client.query(
        `INSERT INTO governance_history (wallet, role, sector_id, started_at) VALUES ($1, 'governor', $2, NOW())`,
        [newGov, sectorId]
      );
    }
    // Update sector
    await client.query(
      'UPDATE sectors SET governor_wallet = $1, governor_since = NOW() WHERE id = $2',
      [newGov, sectorId]
    );
  }

  // ── Vice governor change ──
  if (newVice !== oldVice) {
    changed = true;
    if (oldVice) {
      await client.query(
        `UPDATE governance_history SET ended_at = NOW(),
           tenure_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::int
         WHERE wallet = $1 AND role = 'vice_governor' AND sector_id = $2 AND ended_at IS NULL`,
        [oldVice, sectorId]
      );
      const oldPos = await client.query(
        `SELECT gp_balance FROM governance_positions WHERE role = 'vice_governor' AND sector_id = $1`,
        [sectorId]
      );
      const oldGP = oldPos.rows[0] ? parseFloat(oldPos.rows[0].gp_balance) : 0;
      if (oldGP > 0) {
        await client.query(
          'UPDATE sectors SET sector_pool_gp = sector_pool_gp + $1 WHERE id = $2',
          [oldGP, sectorId]
        );
        await logGovTx(client, 'position_transfer', 'vice_governor', 'sector_pool', sectorId, oldVice, oldGP,
          { reason: 'vice_replaced', newVice: newVice });
      }
      await client.query(
        `DELETE FROM governance_positions WHERE role = 'vice_governor' AND sector_id = $1`,
        [sectorId]
      );
    }
    if (newVice) {
      await client.query(
        `INSERT INTO governance_positions (wallet, role, sector_id, gp_balance, appointed_at)
         VALUES ($1, 'vice_governor', $2, 0, NOW())
         ON CONFLICT (role, sector_id) DO UPDATE SET wallet = $1, gp_balance = 0, appointed_at = NOW()`,
        [newVice, sectorId]
      );
      await client.query(
        `INSERT INTO governance_history (wallet, role, sector_id, started_at) VALUES ($1, 'vice_governor', $2, NOW())`,
        [newVice, sectorId]
      );
    }
    await client.query(
      'UPDATE sectors SET vice_governor_wallet = $1, vice_governor_since = NOW() WHERE id = $2',
      [newVice, sectorId]
    );
  }

  return { changed, governor: newGov, vice: newVice };
}

// ═══════════════════════════════════════════════════════
//  RECALCULATE COMMANDER (global)
// ═══════════════════════════════════════════════════════
async function recalculateCommander(client) {
  const res = await client.query(
    `SELECT owner, COUNT(*)::int AS cnt FROM pixels
     WHERE owner IS NOT NULL GROUP BY owner ORDER BY cnt DESC LIMIT 2`
  );

  const top1 = res.rows[0] || null;
  const top2 = res.rows[1] || null;
  const newCmd = top1 ? top1.owner : null;
  const newVice = top2 ? top2.owner : null;

  const cmdRes = await client.query('SELECT * FROM commander WHERE id = 1');
  const cmd = cmdRes.rows[0];
  if (!cmd) return { changed: false };

  const oldCmd = cmd.commander_wallet;
  const oldVice = cmd.vice_commander_wallet;
  let changed = false;

  // ── Commander change ──
  if (newCmd !== oldCmd) {
    changed = true;
    if (oldCmd) {
      await client.query(
        `UPDATE governance_history SET ended_at = NOW(),
           tenure_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::int
         WHERE wallet = $1 AND role = 'commander' AND sector_id IS NULL AND ended_at IS NULL`,
        [oldCmd]
      );
      const oldPos = await client.query(
        `SELECT gp_balance FROM governance_positions WHERE role = 'commander' AND sector_id IS NULL`
      );
      const oldGP = oldPos.rows[0] ? parseFloat(oldPos.rows[0].gp_balance) : 0;
      if (oldGP > 0) {
        await client.query(
          'UPDATE commander SET commander_pool_gp = commander_pool_gp + $1 WHERE id = 1',
          [oldGP]
        );
        await logGovTx(client, 'position_transfer', 'commander', 'commander_pool', null, oldCmd, oldGP,
          { reason: 'commander_replaced', newCommander: newCmd });
      }
      await client.query(
        `DELETE FROM governance_positions WHERE role = 'commander' AND sector_id IS NULL`
      );
    }
    if (newCmd) {
      await client.query(
        `INSERT INTO governance_positions (wallet, role, sector_id, gp_balance, appointed_at)
         VALUES ($1, 'commander', NULL, 0, NOW())
         ON CONFLICT (role, sector_id) DO UPDATE SET wallet = $1, gp_balance = 0, appointed_at = NOW()`,
        [newCmd]
      );
      await client.query(
        `INSERT INTO governance_history (wallet, role, sector_id, started_at) VALUES ($1, 'commander', NULL, NOW())`,
        [newCmd]
      );
    }
    await client.query(
      'UPDATE commander SET commander_wallet = $1, commander_since = NOW() WHERE id = 1',
      [newCmd]
    );
  }

  // ── Vice commander change ──
  if (newVice !== oldVice) {
    changed = true;
    if (oldVice) {
      await client.query(
        `UPDATE governance_history SET ended_at = NOW(),
           tenure_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::int
         WHERE wallet = $1 AND role = 'vice_commander' AND sector_id IS NULL AND ended_at IS NULL`,
        [oldVice]
      );
      const oldPos = await client.query(
        `SELECT gp_balance FROM governance_positions WHERE role = 'vice_commander' AND sector_id IS NULL`
      );
      const oldGP = oldPos.rows[0] ? parseFloat(oldPos.rows[0].gp_balance) : 0;
      if (oldGP > 0) {
        await client.query(
          'UPDATE commander SET commander_pool_gp = commander_pool_gp + $1 WHERE id = 1',
          [oldGP]
        );
        await logGovTx(client, 'position_transfer', 'vice_commander', 'commander_pool', null, oldVice, oldGP,
          { reason: 'vice_replaced', newVice: newVice });
      }
      await client.query(
        `DELETE FROM governance_positions WHERE role = 'vice_commander' AND sector_id IS NULL`
      );
    }
    if (newVice) {
      await client.query(
        `INSERT INTO governance_positions (wallet, role, sector_id, gp_balance, appointed_at)
         VALUES ($1, 'vice_commander', NULL, 0, NOW())
         ON CONFLICT (role, sector_id) DO UPDATE SET wallet = $1, gp_balance = 0, appointed_at = NOW()`,
        [newVice]
      );
      await client.query(
        `INSERT INTO governance_history (wallet, role, sector_id, started_at) VALUES ($1, 'vice_commander', NULL, NOW())`,
        [newVice]
      );
    }
    await client.query(
      'UPDATE commander SET vice_commander_wallet = $1, vice_commander_since = NOW() WHERE id = 1',
      [newVice]
    );
  }

  return { changed, commander: newCmd, vice: newVice };
}

// ═══════════════════════════════════════════════════════
//  COLLECT TAX on claim/hijack
//  Returns total tax amount deducted
// ═══════════════════════════════════════════════════════
async function collectTax(client, sectorId, totalAmount, txType) {
  if (!sectorId || totalAmount <= 0) return 0;

  const s = await govCfg();
  const sectorRes = await client.query('SELECT tax_rate FROM sectors WHERE id = $1', [sectorId]);
  if (!sectorRes.rows[0]) return 0;

  const taxRate = parseFloat(sectorRes.rows[0].tax_rate) || parseFloat(s.governance_tax_default) || 2;
  const taxAmount = Math.round(totalAmount * (taxRate / 100) * 1000000) / 1000000;
  if (taxAmount <= 0) return 0;

  const govShare = parseFloat(s.governor_tax_share) || 70;
  const viceShare = parseFloat(s.vice_governor_tax_share) || 20;
  const poolShare = parseFloat(s.sector_pool_share) || 10;
  const poolBuffSplit = parseFloat(s.sector_pool_buff_split) || 50;

  const govAmount = Math.round(taxAmount * (govShare / 100) * 1000000) / 1000000;
  const viceAmount = Math.round(taxAmount * (viceShare / 100) * 1000000) / 1000000;
  const poolAmount = taxAmount - govAmount - viceAmount;
  const buffFund = Math.round(poolAmount * (poolBuffSplit / 100) * 1000000) / 1000000;
  const cmdFund = poolAmount - buffFund;

  // Credit governor GP
  if (govAmount > 0) {
    await client.query(
      `UPDATE governance_positions SET gp_balance = gp_balance + $1
       WHERE role = 'governor' AND sector_id = $2`,
      [govAmount, sectorId]
    );
    await logGovTx(client, 'tax_income', txType, 'governor', sectorId, null, govAmount,
      { taxRate, totalAmount });
  }

  // Credit vice governor GP
  if (viceAmount > 0) {
    await client.query(
      `UPDATE governance_positions SET gp_balance = gp_balance + $1
       WHERE role = 'vice_governor' AND sector_id = $2`,
      [viceAmount, sectorId]
    );
    await logGovTx(client, 'tax_income', txType, 'vice_governor', sectorId, null, viceAmount, {});
  }

  // Sector buff fund
  if (buffFund > 0) {
    await client.query(
      'UPDATE sectors SET buff_fund_gp = buff_fund_gp + $1 WHERE id = $2',
      [buffFund, sectorId]
    );
  }

  // Commander pool
  if (cmdFund > 0) {
    await client.query(
      'UPDATE commander SET commander_pool_gp = commander_pool_gp + $1 WHERE id = 1',
      [cmdFund]
    );
  }

  return taxAmount;
}

// ═══════════════════════════════════════════════════════
//  DISTRIBUTE COMMANDER POOL → Commander + Vice GP
// ═══════════════════════════════════════════════════════
async function distributeCommanderPool(client) {
  const s = await govCfg();
  const cmdRes = await (client || pool).query('SELECT * FROM commander WHERE id = 1');
  const cmd = cmdRes.rows[0];
  if (!cmd || parseFloat(cmd.commander_pool_gp) <= 0) return;

  const poolGP = parseFloat(cmd.commander_pool_gp);
  const cmdShare = parseFloat(s.commander_pool_commander_share) || 70;
  const viceSharePct = parseFloat(s.commander_pool_vice_share) || 30;

  const cmdAmount = Math.round(poolGP * (cmdShare / 100) * 1000000) / 1000000;
  const viceAmount = poolGP - cmdAmount;

  const db = client || pool;

  if (cmdAmount > 0 && cmd.commander_wallet) {
    await db.query(
      `UPDATE governance_positions SET gp_balance = gp_balance + $1
       WHERE role = 'commander' AND sector_id IS NULL`,
      [cmdAmount]
    );
  }
  if (viceAmount > 0 && cmd.vice_commander_wallet) {
    await db.query(
      `UPDATE governance_positions SET gp_balance = gp_balance + $1
       WHERE role = 'vice_commander' AND sector_id IS NULL`,
      [viceAmount]
    );
  }

  await db.query('UPDATE commander SET commander_pool_gp = 0 WHERE id = 1');
  await logGovTx(db, 'pool_distribute', 'commander_pool', 'commander', null, null, poolGP,
    { cmdAmount, viceAmount });
}

// ═══════════════════════════════════════════════════════
//  DAILY MAINTENANCE — deduct GP from governors
// ═══════════════════════════════════════════════════════
async function applyDailyMaintenance() {
  const s = await govCfg();
  const rate = parseFloat(s.governor_maintenance_per_pixel) || 0.01;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get all governors with their sector pixel counts
    const govs = await client.query(
      `SELECT gp.id, gp.wallet, gp.sector_id, gp.gp_balance,
              (SELECT COUNT(*)::int FROM pixels WHERE sector_id = gp.sector_id AND owner IS NOT NULL) AS total_pixels
       FROM governance_positions gp WHERE gp.role = 'governor'`
    );

    for (const gov of govs.rows) {
      const cost = Math.round(gov.total_pixels * rate * 1000000) / 1000000;
      if (cost <= 0) continue;
      const deduct = Math.min(cost, parseFloat(gov.gp_balance));
      if (deduct > 0) {
        await client.query(
          'UPDATE governance_positions SET gp_balance = gp_balance - $1 WHERE id = $2',
          [deduct, gov.id]
        );
        await logGovTx(client, 'maintenance', 'governor', null, gov.sector_id, gov.wallet, deduct,
          { totalPixels: gov.total_pixels, rate });
      }
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[GOV] Maintenance error:', e.message);
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════════════════════
//  ACTIVE BUFFS & EVENTS
// ═══════════════════════════════════════════════════════
async function getActiveSectorBuffs(sectorId) {
  const res = await pool.query(
    `SELECT buff_type, effect_value, expires_at FROM sector_buffs
     WHERE sector_id = $1 AND active = true AND expires_at > NOW()`,
    [sectorId]
  );
  return res.rows;
}

async function getActiveGovEvents() {
  const res = await pool.query(
    `SELECT event_type, triggered_by, starts_at, ends_at FROM global_events_gov
     WHERE active = true AND ends_at > NOW()`
  );
  return res.rows;
}

async function hasActiveEvent(eventType) {
  const events = await getActiveGovEvents();
  return events.some(e => e.event_type === eventType);
}

// ═══════════════════════════════════════════════════════
//  EXPIRE old buffs/events/bounties
// ═══════════════════════════════════════════════════════
async function expireGovernanceItems() {
  await pool.query(`UPDATE sector_buffs SET active = false WHERE expires_at < NOW() AND active = true`);
  await pool.query(`UPDATE global_events_gov SET active = false WHERE ends_at < NOW() AND active = true`);
  await pool.query(`UPDATE bounties SET status = 'expired' WHERE expires_at < NOW() AND status = 'active'`);
}

// ═══════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════
async function logGovTx(db, type, fromRole, toRole, sectorId, wallet, gpAmount, meta) {
  await db.query(
    `INSERT INTO governance_transactions (type, from_role, to_role, sector_id, wallet, gp_amount, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [type, fromRole, toRole, sectorId, wallet, gpAmount, JSON.stringify(meta || {})]
  );
}

// Get all positions for a wallet
async function getPositionsForWallet(wallet) {
  const res = await pool.query(
    `SELECT gp.*, s.name AS sector_name FROM governance_positions gp
     LEFT JOIN sectors s ON s.id = gp.sector_id
     WHERE gp.wallet = $1`,
    [wallet.toLowerCase()]
  );
  return res.rows;
}

// Get sector governance info
async function getSectorGovernance(sectorId) {
  const [sectorRes, buffsRes, govRes, viceRes] = await Promise.all([
    pool.query('SELECT id, name, tier, tax_rate, governor_wallet, governor_since, vice_governor_wallet, vice_governor_since, announcement, sector_pool_gp, buff_fund_gp FROM sectors WHERE id = $1', [sectorId]),
    getActiveSectorBuffs(sectorId),
    pool.query(`SELECT gp_balance FROM governance_positions WHERE role = 'governor' AND sector_id = $1`, [sectorId]),
    pool.query(`SELECT gp_balance FROM governance_positions WHERE role = 'vice_governor' AND sector_id = $1`, [sectorId])
  ]);

  const sector = sectorRes.rows[0];
  if (!sector) return null;

  return {
    sectorId: sector.id,
    name: sector.name,
    tier: sector.tier,
    taxRate: parseFloat(sector.tax_rate),
    governor: sector.governor_wallet,
    governorSince: sector.governor_since,
    governorGP: govRes.rows[0] ? parseFloat(govRes.rows[0].gp_balance) : 0,
    vice: sector.vice_governor_wallet,
    viceSince: sector.vice_governor_since,
    viceGP: viceRes.rows[0] ? parseFloat(viceRes.rows[0].gp_balance) : 0,
    announcement: sector.announcement || '',
    sectorPoolGP: parseFloat(sector.sector_pool_gp),
    buffFundGP: parseFloat(sector.buff_fund_gp),
    activeBuffs: buffsRes
  };
}

// Get commander info (with nicknames)
async function getCommanderInfo() {
  const [cmdRes, eventsRes, bountiesRes, cmdPosRes, vicePosRes] = await Promise.all([
    pool.query('SELECT * FROM commander WHERE id = 1'),
    getActiveGovEvents(),
    pool.query(`SELECT id, target_wallet, gp_reward, pp_reward, reason, expires_at FROM bounties WHERE status = 'active' ORDER BY created_at DESC`),
    pool.query(`SELECT gp_balance FROM governance_positions WHERE role = 'commander' AND sector_id IS NULL`),
    pool.query(`SELECT gp_balance FROM governance_positions WHERE role = 'vice_commander' AND sector_id IS NULL`)
  ]);

  const cmd = cmdRes.rows[0] || {};
  // Fetch nicknames
  let commanderNickname = null, viceNickname = null;
  if (cmd.commander_wallet || cmd.vice_commander_wallet) {
    const wallets = [cmd.commander_wallet, cmd.vice_commander_wallet].filter(Boolean);
    const nickRes = await pool.query(
      `SELECT wallet_address, nickname FROM users WHERE wallet_address = ANY($1)`,
      [wallets]
    );
    const nickMap = {};
    nickRes.rows.forEach(r => { nickMap[r.wallet_address] = r.nickname; });
    commanderNickname = nickMap[cmd.commander_wallet] || null;
    viceNickname = nickMap[cmd.vice_commander_wallet] || null;
  }

  return {
    commander: cmd.commander_wallet,
    commanderNickname,
    commanderSince: cmd.commander_since,
    commanderGP: cmdPosRes.rows[0] ? parseFloat(cmdPosRes.rows[0].gp_balance) : 0,
    vice: cmd.vice_commander_wallet,
    viceNickname,
    viceSince: cmd.vice_commander_since,
    viceGP: vicePosRes.rows[0] ? parseFloat(vicePosRes.rows[0].gp_balance) : 0,
    announcement: cmd.announcement || '',
    poolGP: parseFloat(cmd.commander_pool_gp) || 0,
    activeEvents: eventsRes,
    activeBounties: bountiesRes.rows
  };
}

// Governor leaderboard: ranked by total tax earned across all tenures
async function getGovernorLeaderboard(sortBy = 'tax') {
  let orderClause;
  switch (sortBy) {
    case 'tenure': orderClause = 'total_tenure DESC'; break;
    case 'sectors': orderClause = 'sector_count DESC'; break;
    default: orderClause = 'total_tax DESC';
  }
  const res = await pool.query(`
    SELECT gh.wallet,
           u.nickname,
           SUM(gh.total_tax_earned)::numeric AS total_tax,
           SUM(gh.tenure_seconds)::int AS total_tenure,
           COUNT(DISTINCT gh.sector_id) AS sector_count,
           COUNT(*)::int AS reign_count,
           BOOL_OR(gh.ended_at IS NULL) AS currently_active
    FROM governance_history gh
    LEFT JOIN users u ON u.wallet_address = gh.wallet
    WHERE gh.role = 'governor'
    GROUP BY gh.wallet, u.nickname
    ORDER BY ${orderClause}
    LIMIT 50
  `);
  return res.rows;
}

// Sector history: all past governors for a sector
async function getSectorGovernorHistory(sectorId) {
  const res = await pool.query(`
    SELECT gh.wallet, u.nickname, gh.started_at, gh.ended_at,
           gh.total_tax_earned, gh.tenure_seconds
    FROM governance_history gh
    LEFT JOIN users u ON u.wallet_address = gh.wallet
    WHERE gh.sector_id = $1 AND gh.role = 'governor'
    ORDER BY gh.started_at DESC
    LIMIT 50
  `, [sectorId]);
  return res.rows;
}

module.exports = {
  recalculateGovernor,
  recalculateCommander,
  collectTax,
  distributeCommanderPool,
  applyDailyMaintenance,
  getActiveSectorBuffs,
  getActiveGovEvents,
  hasActiveEvent,
  expireGovernanceItems,
  getPositionsForWallet,
  getSectorGovernance,
  getCommanderInfo,
  getGovernorLeaderboard,
  getSectorGovernorHistory,
  govCfg
};
