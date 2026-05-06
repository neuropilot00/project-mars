'use strict';
const { pool, getSetting } = require('../db');
let seasonService; try { seasonService = require('./season'); } catch(_) {}

async function getCfg() {
  const [enabled, minGP, maxGP, maxMsg, wallSize, topDonors] = await Promise.all([
    getSetting('donation_enabled',         'true'),
    getSetting('donation_min_gp',          '10'),
    getSetting('donation_max_gp',          '0'),
    getSetting('donation_max_msg_length',  '80'),
    getSetting('donation_wall_size',       '50'),
    getSetting('donation_top_donors',      '10'),
  ]);
  return {
    enabled:   enabled === 'true',
    minGP:     parseInt(minGP, 10),
    maxGP:     parseInt(maxGP, 10),       // 0 = no limit
    maxMsg:    parseInt(maxMsg, 10),
    wallSize:  parseInt(wallSize, 10),
    topDonors: parseInt(topDonors, 10),
  };
}

async function getWall() {
  const cfg = await getCfg();
  const { rows: recent } = await pool.query(
    `SELECT d.id, d.wallet, COALESCE(u.nickname, d.wallet) AS nickname,
            d.amount_gp, d.message, d.created_at
     FROM donation_wall d
     LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(d.wallet)
     ORDER BY d.created_at DESC LIMIT $1`,
    [cfg.wallSize]
  );
  const { rows: top } = await pool.query(
    `SELECT d.wallet, COALESCE(u.nickname, d.wallet) AS nickname,
            SUM(d.amount_gp)::int AS total_gp
     FROM donation_wall d
     LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(d.wallet)
     GROUP BY d.wallet, u.nickname
     ORDER BY total_gp DESC LIMIT $1`,
    [cfg.topDonors]
  );
  const { rows: [totals] } = await pool.query(
    `SELECT COALESCE(SUM(amount_gp),0)::int AS colony_fund_total,
            COUNT(DISTINCT wallet)::int AS donor_count,
            COUNT(*)::int AS donation_count
     FROM donation_wall`
  );
  return { recent, top, totals };
}

async function donate(wallet, amountGP, message) {
  wallet = wallet.toLowerCase();
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Donation wall disabled');
  amountGP = parseInt(amountGP, 10);
  if (isNaN(amountGP) || amountGP < cfg.minGP) throw new Error(`Minimum donation: ${cfg.minGP} GP`);
  if (cfg.maxGP > 0 && amountGP > cfg.maxGP) throw new Error(`Maximum donation: ${cfg.maxGP} GP`);
  if (message && message.length > cfg.maxMsg) throw new Error('Message too long');
  message = message || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const balRow = await client.query('SELECT gp_balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE', [wallet]);
    if (!balRow.rows.length) throw new Error('User not found');
    if (balRow.rows[0].gp_balance < amountGP) throw new Error(`Need ${amountGP} GP`);

    await client.query('UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2)', [amountGP, wallet]);

    const { rows: [entry] } = await client.query(
      `INSERT INTO donation_wall(wallet, amount_gp, message) VALUES($1,$2,$3) RETURNING id`,
      [wallet, amountGP, message]
    );

    await client.query(
      `INSERT INTO gp_transactions(wallet, amount, type, ref_id, note)
       VALUES($1,$2,'donation',$3,'Colony Fund donation')`,
      [wallet, -amountGP, entry.id]
    );

    await client.query('COMMIT');
    try { const { logGPActivity } = require('../db'); await logGPActivity(wallet, -amountGP, 'donation', message || 'Colony Fund'); } catch(_) {}
    seasonService?.trackGPSpend?.(wallet, amountGP, 'donation').catch(() => {});

    return { ok: true, id: entry.id, amountGP };
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function getMyDonations(wallet) {
  wallet = wallet.toLowerCase();
  const { rows } = await pool.query(
    `SELECT id, amount_gp, message, created_at FROM donation_wall WHERE LOWER(wallet)=LOWER($1)
     ORDER BY created_at DESC LIMIT 20`, [wallet]
  );
  const { rows: [totals] } = await pool.query(
    `SELECT COALESCE(SUM(amount_gp),0)::int AS total_donated,
            COUNT(*)::int AS donation_count
     FROM donation_wall WHERE LOWER(wallet)=LOWER($1)`, [wallet]
  );
  return { donations: rows, totals };
}

async function getAdminStats() {
  const { rows: [stats] } = await pool.query(
    `SELECT COALESCE(SUM(amount_gp),0)::int AS total_gp_burned,
            COUNT(DISTINCT wallet)::int AS unique_donors,
            COUNT(*)::int AS total_donations
     FROM donation_wall`
  );
  const { rows: top } = await pool.query(
    `SELECT d.wallet, COALESCE(u.nickname,d.wallet) AS nickname, SUM(d.amount_gp)::int AS total_gp
     FROM donation_wall d LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(d.wallet)
     GROUP BY d.wallet, u.nickname ORDER BY total_gp DESC LIMIT 10`
  );
  return { stats, top };
}

module.exports = { getCfg, getWall, donate, getMyDonations, getAdminStats };
