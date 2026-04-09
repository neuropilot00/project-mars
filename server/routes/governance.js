// ═══════════════════════════════════════════════════════
//  Governance API — Governor, Commander, GP endpoints
// ═══════════════════════════════════════════════════════
const express = require('express');
const rateLimit = require('express-rate-limit');
const { pool, getSettings } = require('../db');
const {
  getSectorGovernance, getCommanderInfo, getPositionsForWallet,
  getActiveGovEvents, govCfg, getActiveSectorBuffs,
  getGovernorLeaderboard, getSectorGovernorHistory
} = require('../services/governance');

const router = express.Router();

const readLimiter = rateLimit({ windowMs: 60000, max: 120, message: { error: 'Too many requests' } });
const writeLimiter = rateLimit({ windowMs: 60000, max: 20, message: { error: 'Too many requests' } });

// ── Helper: verify wallet is governor/vice of sector ──
async function verifyRole(wallet, sectorId, role) {
  const res = await pool.query(
    'SELECT id FROM governance_positions WHERE wallet = $1 AND role = $2 AND sector_id = $3',
    [wallet.toLowerCase(), role, sectorId]
  );
  return res.rows.length > 0;
}
async function verifyCommander(wallet, role) {
  const res = await pool.query(
    'SELECT id FROM governance_positions WHERE wallet = $1 AND role = $2 AND sector_id IS NULL',
    [wallet.toLowerCase(), role]
  );
  return res.rows.length > 0;
}

// ═══════════════════════════════════════════════════════
//  GET /api/governance/sector/:id — sector governance info
// ═══════════════════════════════════════════════════════
router.get('/sector/:id', readLimiter, async (req, res) => {
  try {
    const info = await getSectorGovernance(parseInt(req.params.id));
    if (!info) return res.status(404).json({ error: 'Sector not found' });
    // Hide GP balances unless requester is governor/vice
    const w = (req.query.wallet || '').toLowerCase();
    if (w !== (info.governor || '').toLowerCase()) delete info.governorGP;
    if (w !== (info.vice || '').toLowerCase()) delete info.viceGP;
    res.json(info);
  } catch (e) {
    console.error('[GOV] sector info error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════
//  GET /api/governance/commander — global commander info
// ═══════════════════════════════════════════════════════
router.get('/commander', readLimiter, async (req, res) => {
  try {
    const info = await getCommanderInfo();
    const w = (req.query.wallet || '').toLowerCase();
    if (w !== (info.commander || '').toLowerCase()) delete info.commanderGP;
    if (w !== (info.vice || '').toLowerCase()) delete info.viceGP;
    if (w !== (info.commander || '').toLowerCase()) delete info.poolGP;
    res.json(info);
  } catch (e) {
    console.error('[GOV] commander info error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════
//  GET /api/governance/my-positions/:wallet
// ═══════════════════════════════════════════════════════
router.get('/my-positions/:wallet', readLimiter, async (req, res) => {
  try {
    const positions = await getPositionsForWallet(req.params.wallet);
    res.json(positions);
  } catch (e) {
    console.error('[GOV] my-positions error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════
//  POST /api/governance/sector/:id/tax-rate — set tax rate
// ═══════════════════════════════════════════════════════
router.post('/sector/:id/tax-rate', writeLimiter, async (req, res) => {
  const { wallet, rate } = req.body;
  const sectorId = parseInt(req.params.id);
  if (!wallet || rate == null) return res.status(400).json({ error: 'Missing wallet or rate' });

  try {
    const s = await govCfg();
    const minRate = parseFloat(s.governance_tax_min) || 1;
    const maxRate = parseFloat(s.governance_tax_max) || 5;
    const r = parseFloat(rate);
    if (r < minRate || r > maxRate) return res.status(400).json({ error: `Tax rate must be ${minRate}-${maxRate}%` });

    if (!(await verifyRole(wallet, sectorId, 'governor'))) {
      return res.status(403).json({ error: 'Only the governor can set tax rate' });
    }

    await pool.query('UPDATE sectors SET tax_rate = $1 WHERE id = $2', [r, sectorId]);
    res.json({ success: true, taxRate: r });
  } catch (e) {
    console.error('[GOV] set tax error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════
//  POST /api/governance/sector/:id/buff — purchase sector buff
// ═══════════════════════════════════════════════════════
router.post('/sector/:id/buff', writeLimiter, async (req, res) => {
  const { wallet, buffType } = req.body;
  const sectorId = parseInt(req.params.id);
  if (!wallet || !buffType) return res.status(400).json({ error: 'Missing fields' });

  const validBuffs = ['mining_boost', 'defense_bonus', 'claim_discount'];
  if (!validBuffs.includes(buffType)) return res.status(400).json({ error: 'Invalid buff type' });

  const client = await pool.connect();
  try {
    const s = await govCfg();
    if (!(await verifyRole(wallet, sectorId, 'governor'))) {
      return res.status(403).json({ error: 'Only the governor can purchase buffs' });
    }

    // Check if buff already active
    const existing = await client.query(
      `SELECT id FROM sector_buffs WHERE sector_id = $1 AND buff_type = $2 AND active = true AND expires_at > NOW()`,
      [sectorId, buffType]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'This buff is already active' });
    }

    const costKey = `buff_${buffType}_cost`;
    const valueKey = `buff_${buffType}_value`;
    const hoursKey = `buff_${buffType}_hours`;
    const gpCost = parseFloat(s[costKey]) || 100;
    const effectValue = parseFloat(s[valueKey]) || 10;
    const hours = parseFloat(s[hoursKey]) || 24;

    await client.query('BEGIN');

    // Check governor GP balance
    const posRes = await client.query(
      `SELECT id, gp_balance FROM governance_positions WHERE role = 'governor' AND sector_id = $1 FOR UPDATE`,
      [sectorId]
    );
    if (!posRes.rows[0] || parseFloat(posRes.rows[0].gp_balance) < gpCost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient GP. Need ${gpCost}, have ${posRes.rows[0] ? posRes.rows[0].gp_balance : 0}` });
    }

    // Deduct GP
    await client.query(
      'UPDATE governance_positions SET gp_balance = gp_balance - $1 WHERE id = $2',
      [gpCost, posRes.rows[0].id]
    );

    // Create buff
    await client.query(
      `INSERT INTO sector_buffs (sector_id, buff_type, effect_value, gp_cost, activated_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '1 hour' * $6)`,
      [sectorId, buffType, effectValue, gpCost, wallet.toLowerCase(), hours]
    );

    // Log
    await client.query(
      `INSERT INTO governance_transactions (type, from_role, to_role, sector_id, wallet, gp_amount, meta)
       VALUES ('buff_purchase', 'governor', $1, $2, $3, $4, $5)`,
      [buffType, sectorId, wallet.toLowerCase(), gpCost, JSON.stringify({ effectValue, hours })]
    );

    await client.query('COMMIT');
    res.json({ success: true, buffType, effectValue, hours, gpSpent: gpCost });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[GOV] buff purchase error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════
//  POST /api/governance/sector/:id/announcement
// ═══════════════════════════════════════════════════════
router.post('/sector/:id/announcement', writeLimiter, async (req, res) => {
  const { wallet, text } = req.body;
  const sectorId = parseInt(req.params.id);
  if (!wallet) return res.status(400).json({ error: 'Missing wallet' });

  try {
    if (!(await verifyRole(wallet, sectorId, 'governor'))) {
      return res.status(403).json({ error: 'Only the governor can set announcements' });
    }
    const safe = (text || '').slice(0, 100);
    await pool.query('UPDATE sectors SET announcement = $1 WHERE id = $2', [safe, sectorId]);
    res.json({ success: true, announcement: safe });
  } catch (e) {
    console.error('[GOV] announcement error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════
//  POST /api/governance/commander/event — trigger global event
// ═══════════════════════════════════════════════════════
router.post('/commander/event', writeLimiter, async (req, res) => {
  const { wallet, eventType } = req.body;
  if (!wallet || !eventType) return res.status(400).json({ error: 'Missing fields' });

  const validEvents = ['double_mining', 'war_time', 'peace_treaty'];
  if (!validEvents.includes(eventType)) return res.status(400).json({ error: 'Invalid event type' });

  const client = await pool.connect();
  try {
    const s = await govCfg();
    if (!(await verifyCommander(wallet, 'commander'))) {
      return res.status(403).json({ error: 'Only the Commander can trigger global events' });
    }

    // Check daily limit
    const dailyLimit = parseInt(s.commander_daily_event_limit) || 1;
    const todayCount = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM global_events_gov
       WHERE triggered_by = $1 AND created_at >= CURRENT_DATE`,
      [wallet.toLowerCase()]
    );
    if (parseInt(todayCount.rows[0].cnt) >= dailyLimit) {
      return res.status(400).json({ error: `Daily event limit reached (${dailyLimit}/day)` });
    }

    // Check if same event type already active
    const activeCheck = await client.query(
      `SELECT id FROM global_events_gov WHERE event_type = $1 AND active = true AND ends_at > NOW()`,
      [eventType]
    );
    if (activeCheck.rows.length > 0) {
      return res.status(400).json({ error: 'This event is already active' });
    }

    const costKey = `global_event_${eventType}_cost`;
    const hoursKey = `global_event_${eventType}_hours`;
    const gpCost = parseFloat(s[costKey]) || 300;
    const hours = parseFloat(s[hoursKey]) || 1;

    await client.query('BEGIN');

    // Check commander GP
    const posRes = await client.query(
      `SELECT id, gp_balance FROM governance_positions WHERE role = 'commander' AND sector_id IS NULL FOR UPDATE`
    );
    if (!posRes.rows[0] || parseFloat(posRes.rows[0].gp_balance) < gpCost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient GP. Need ${gpCost}, have ${posRes.rows[0] ? posRes.rows[0].gp_balance : 0}` });
    }

    // Deduct GP
    await client.query(
      'UPDATE governance_positions SET gp_balance = gp_balance - $1 WHERE id = $2',
      [gpCost, posRes.rows[0].id]
    );

    // Create event
    await client.query(
      `INSERT INTO global_events_gov (event_type, triggered_by, gp_cost, ends_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour' * $4)`,
      [eventType, wallet.toLowerCase(), gpCost, hours]
    );

    // Log
    await client.query(
      `INSERT INTO governance_transactions (type, from_role, to_role, sector_id, wallet, gp_amount, meta)
       VALUES ('event_spend', 'commander', $1, NULL, $2, $3, $4)`,
      [eventType, wallet.toLowerCase(), gpCost, JSON.stringify({ hours })]
    );

    await client.query('COMMIT');
    res.json({ success: true, eventType, hours, gpSpent: gpCost });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[GOV] event trigger error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════
//  POST /api/governance/commander/announcement
// ═══════════════════════════════════════════════════════
router.post('/commander/announcement', writeLimiter, async (req, res) => {
  const { wallet, text } = req.body;
  if (!wallet) return res.status(400).json({ error: 'Missing wallet' });

  try {
    if (!(await verifyCommander(wallet, 'commander'))) {
      return res.status(403).json({ error: 'Only the Commander can set global announcements' });
    }
    const safe = (text || '').slice(0, 200);
    await pool.query('UPDATE commander SET announcement = $1 WHERE id = 1', [safe]);
    res.json({ success: true, announcement: safe });
  } catch (e) {
    console.error('[GOV] commander announcement error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════
//  POST /api/governance/commander/bounty — place bounty
// ═══════════════════════════════════════════════════════
router.post('/commander/bounty', writeLimiter, async (req, res) => {
  const { wallet, targetWallet, targetNickname, gpAmount, reason } = req.body;
  if (!wallet || (!targetWallet && !targetNickname) || !gpAmount) return res.status(400).json({ error: 'Missing fields' });

  const client = await pool.connect();
  try {
    if (!(await verifyCommander(wallet, 'commander'))) {
      return res.status(403).json({ error: 'Only the Commander can place bounties' });
    }

    // Resolve nickname to wallet if needed
    let resolvedTarget = targetWallet;
    if (!resolvedTarget && targetNickname) {
      const nickRes = await pool.query(
        'SELECT wallet_address FROM users WHERE LOWER(nickname) = LOWER($1) LIMIT 1',
        [targetNickname.trim()]
      );
      if (!nickRes.rows[0]) return res.status(400).json({ error: 'Player "' + targetNickname + '" not found' });
      resolvedTarget = nickRes.rows[0].wallet_address;
    }

    const amount = parseFloat(gpAmount);
    if (amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    await client.query('BEGIN');

    // Check GP
    const posRes = await client.query(
      `SELECT id, gp_balance FROM governance_positions WHERE role = 'commander' AND sector_id IS NULL FOR UPDATE`
    );
    if (!posRes.rows[0] || parseFloat(posRes.rows[0].gp_balance) < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient GP' });
    }

    // Deduct GP
    await client.query(
      'UPDATE governance_positions SET gp_balance = gp_balance - $1 WHERE id = $2',
      [amount, posRes.rows[0].id]
    );

    // Convert GP to PP reward for the bounty hunter (1:1)
    await client.query(
      `INSERT INTO bounties (placed_by, target_wallet, gp_reward, pp_reward, reason, expires_at)
       VALUES ($1, $2, $3, $3, $4, NOW() + INTERVAL '7 days')`,
      [wallet.toLowerCase(), resolvedTarget.toLowerCase(), amount, (reason || '').slice(0, 200)]
    );

    await client.query(
      `INSERT INTO governance_transactions (type, from_role, to_role, sector_id, wallet, gp_amount, meta)
       VALUES ('bounty_spend', 'commander', 'bounty', NULL, $1, $2, $3)`,
      [wallet.toLowerCase(), amount, JSON.stringify({ target: resolvedTarget.toLowerCase(), nickname: targetNickname || null, reason })]
    );

    await client.query('COMMIT');
    res.json({ success: true, target: resolvedTarget, nickname: targetNickname || null, gpSpent: amount, ppReward: amount });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[GOV] bounty error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════
//  GET /api/governance/bounties — active bounties
// ═══════════════════════════════════════════════════════
router.get('/bounties', readLimiter, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, placed_by, target_wallet, pp_reward, reason, expires_at, created_at
       FROM bounties WHERE status = 'active' ORDER BY pp_reward DESC`
    );
    res.json(result.rows);
  } catch (e) {
    console.error('[GOV] bounties list error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════
//  GET /api/governance/events — active global events
// ═══════════════════════════════════════════════════════
router.get('/events', readLimiter, async (req, res) => {
  try {
    const events = await getActiveGovEvents();
    res.json(events);
  } catch (e) {
    console.error('[GOV] events list error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════
//  GET /api/governance/all-sectors — all sectors governance overview
// ═══════════════════════════════════════════════════════
router.get('/all-sectors', readLimiter, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.name, s.tier, s.tax_rate, s.governor_wallet, s.vice_governor_wallet,
              s.announcement, s.sector_pool_gp, s.buff_fund_gp,
              u1.nickname AS governor_name, u2.nickname AS vice_name
       FROM sectors s
       LEFT JOIN users u1 ON u1.wallet_address = s.governor_wallet
       LEFT JOIN users u2 ON u2.wallet_address = s.vice_governor_wallet
       ORDER BY s.tier, s.name`
    );
    // Attach active buffs per sector
    const sectors = [];
    for (const row of result.rows) {
      const buffs = await getActiveSectorBuffs(row.id);
      sectors.push({ ...row, activeBuffs: buffs });
    }
    res.json(sectors);
  } catch (e) {
    console.error('[GOV] all-sectors error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════
//  GET /api/governance/leaderboard — governor rankings
// ═══════════════════════════════════════════════════════
router.get('/leaderboard', readLimiter, async (req, res) => {
  try {
    const sortBy = req.query.sort || 'tax'; // tax | tenure | sectors
    const rows = await getGovernorLeaderboard(sortBy);
    res.json(rows);
  } catch (e) {
    console.error('[GOV] leaderboard error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════
//  GET /api/governance/history/:sectorId — sector governor history
// ═══════════════════════════════════════════════════════
router.get('/history/:sectorId', readLimiter, async (req, res) => {
  try {
    const sectorId = parseInt(req.params.sectorId);
    if (!sectorId) return res.status(400).json({ error: 'Invalid sector ID' });
    const rows = await getSectorGovernorHistory(sectorId);
    res.json(rows);
  } catch (e) {
    console.error('[GOV] history error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
