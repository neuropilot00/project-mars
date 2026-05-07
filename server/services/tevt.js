'use strict';
const { pool, getSetting } = require('../db');

const EVENT_TYPES = {
  mining_rush:      { icon: '⛏️',  label: 'Mining Rush',      desc: 'Bonus mining yield on this territory', color: '#a0e8a0' },
  harvest_festival: { icon: '🌾',  label: 'Harvest Festival', desc: 'Reduced energy costs + bonus PP', color: '#ffcc02' },
  beacon_pulse:     { icon: '📡',  label: 'Beacon Pulse',     desc: 'Territory highlighted on map — attract visitors', color: '#80deea' },
  fortify_surge:    { icon: '🛡️',  label: 'Fortify Surge',   desc: 'Enhanced shield regeneration', color: '#ef9a9a' },
  tax_holiday:      { icon: '💸',  label: 'Tax Holiday',      desc: 'No GP tax on territory actions', color: '#ce93d8' },
};

async function getCfg() {
  const [enabled, maxConc, cooldownH, ...vals] = await Promise.all([
    getSetting('tevt_enabled', 'true'),
    getSetting('tevt_max_concurrent', '1'),
    getSetting('tevt_cooldown_h', '1'),
    getSetting('tevt_mining_rush_gp', '80'),
    getSetting('tevt_mining_rush_h', '2'),
    getSetting('tevt_mining_rush_bonus_pct', '75'),
    getSetting('tevt_harvest_festival_gp', '60'),
    getSetting('tevt_harvest_festival_h', '3'),
    getSetting('tevt_beacon_pulse_gp', '40'),
    getSetting('tevt_beacon_pulse_h', '4'),
    getSetting('tevt_fortify_surge_gp', '100'),
    getSetting('tevt_fortify_surge_h', '2'),
    getSetting('tevt_tax_holiday_gp', '50'),
    getSetting('tevt_tax_holiday_h', '6'),
  ]);
  const [mrGp,mrH,mrB, hfGp,hfH, bpGp,bpH, fsGp,fsH, thGp,thH] = vals.map(Number);
  return {
    enabled: enabled === 'true',
    maxConcurrent: parseInt(maxConc)||1,
    cooldownH: parseInt(cooldownH)||1,
    events: {
      mining_rush:      { ...EVENT_TYPES.mining_rush,      gpCost: mrGp, durationH: mrH, bonusPct: mrB },
      harvest_festival: { ...EVENT_TYPES.harvest_festival, gpCost: hfGp, durationH: hfH },
      beacon_pulse:     { ...EVENT_TYPES.beacon_pulse,     gpCost: bpGp, durationH: bpH },
      fortify_surge:    { ...EVENT_TYPES.fortify_surge,    gpCost: fsGp, durationH: fsH },
      tax_holiday:      { ...EVENT_TYPES.tax_holiday,      gpCost: thGp, durationH: thH },
    },
  };
}

async function getClaimEvents(claimId) {
  const r = await pool.query(
    `SELECT * FROM territory_events
      WHERE claim_id=$1 AND is_active=true AND expires_at > NOW()
      ORDER BY created_at DESC`,
    [claimId]
  );
  return r.rows;
}

async function getMyEvents(wallet) {
  const r = await pool.query(
    `SELECT * FROM territory_events
      WHERE LOWER(wallet)=LOWER($1)
      ORDER BY created_at DESC LIMIT 30`,
    [wallet]
  );
  return r.rows;
}

async function getActiveEvents() {
  const r = await pool.query(
    `SELECT te.*, c.sector_code AS sector_id, u.nickname
       FROM territory_events te
       JOIN claims c ON c.id = te.claim_id
       LEFT JOIN users u ON LOWER(te.wallet)=LOWER(u.wallet_address)
       WHERE te.is_active=true AND te.expires_at > NOW()
       ORDER BY te.created_at DESC`
  );
  return r.rows;
}

async function activateEvent(wallet, claimId, eventType) {
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Territory events disabled');
  const evtInfo = cfg.events[eventType];
  if (!evtInfo) throw new Error('Unknown event type: '+eventType);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify ownership
    const claimRes = await client.query(`SELECT id, owner FROM claims WHERE id=$1 FOR UPDATE`, [claimId]);
    if (!claimRes.rows.length) throw new Error('Claim not found');
    if (claimRes.rows[0].owner.toLowerCase() !== wallet.toLowerCase()) throw new Error('Not your territory');

    // Max concurrent check
    const concRes = await client.query(
      `SELECT COUNT(*) AS cnt FROM territory_events
        WHERE claim_id=$1 AND is_active=true AND expires_at > NOW()`,
      [claimId]
    );
    if (parseInt(concRes.rows[0].cnt) >= cfg.maxConcurrent) {
      throw new Error(`Max ${cfg.maxConcurrent} concurrent event(s) per territory`);
    }

    // Cooldown check on same event type
    const cdRes = await client.query(
      `SELECT expires_at FROM territory_events
        WHERE claim_id=$1 AND event_type=$2
        ORDER BY created_at DESC LIMIT 1`,
      [claimId, eventType]
    );
    if (cdRes.rows.length && cfg.cooldownH > 0) {
      const lastExpiry = new Date(cdRes.rows[0].expires_at);
      const cooldownEnd = new Date(lastExpiry.getTime() + cfg.cooldownH * 3600 * 1000);
      if (new Date() < cooldownEnd) {
        const remMin = Math.ceil((cooldownEnd - new Date()) / 60000);
        throw new Error(`Cooldown: ${remMin} min remaining`);
      }
    }

    // Balance check
    const userRes = await client.query(
      `SELECT gp_balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE`,
      [wallet]
    );
    if (!userRes.rows.length) throw new Error('User not found');
    if (userRes.rows[0].gp_balance < evtInfo.gpCost) throw new Error('Insufficient GP');

    const expiresAt = new Date(Date.now() + evtInfo.durationH * 3600 * 1000);

    // Deduct GP
    await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND gp_balance >= $1`,
      [evtInfo.gpCost, wallet]
    );
    await client.query(
      `INSERT INTO gp_transactions (wallet, amount, transaction_type, description)
       VALUES ($1, $2, 'territory_event', $3)`,
      [wallet, -evtInfo.gpCost, `Activated ${evtInfo.label} on claim #${claimId}`]
    );

    // Insert event
    const evtRes = await client.query(
      `INSERT INTO territory_events (claim_id, wallet, event_type, gp_cost, duration_h, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [claimId, wallet, eventType, evtInfo.gpCost, evtInfo.durationH, expiresAt]
    );

    await client.query('COMMIT');

    try { const { logGPActivity } = require('../db'); await logGPActivity(wallet, -evtInfo.gpCost, 'territory_event', `${evtInfo.label} claim ${claimId}`); } catch(_) {}
    try { const seasonService = require('./season'); await seasonService.trackGPSpend(wallet, evtInfo.gpCost); } catch(_) {}

    return { success: true, event: evtRes.rows[0], evtInfo, expiresAt };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function expireEvents() {
  const r = await pool.query(
    `UPDATE territory_events SET is_active=false
      WHERE is_active=true AND expires_at <= NOW()
      RETURNING id`
  );
  return r.rowCount;
}

async function getAdminStats() {
  const r = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE is_active AND expires_at > NOW()) AS active_events,
      COALESCE(SUM(gp_cost),0)                                AS total_gp_spent,
      COUNT(DISTINCT wallet)                                   AS unique_players,
      COUNT(*) FILTER (WHERE event_type='mining_rush')         AS mining_rush_count,
      COUNT(*) FILTER (WHERE event_type='harvest_festival')    AS harvest_festival_count,
      COUNT(*) FILTER (WHERE event_type='beacon_pulse')        AS beacon_pulse_count,
      COUNT(*) FILTER (WHERE event_type='fortify_surge')       AS fortify_surge_count,
      COUNT(*) FILTER (WHERE event_type='tax_holiday')         AS tax_holiday_count
    FROM territory_events
  `);
  return r.rows[0];
}

module.exports = { getCfg, getClaimEvents, getMyEvents, getActiveEvents, activateEvent, expireEvents, getAdminStats, EVENT_TYPES };
