'use strict';
const { pool } = require('../db');

async function getSetting(key, fallback) {
  try {
    const { rows } = await pool.query('SELECT value FROM game_settings WHERE key=$1', [key]);
    if (rows.length) return String(rows[0].value);
  } catch (_) {}
  return String(fallback);
}

async function getSettings() {
  const keys = [
    'rental_enabled','rental_min_gp','rental_max_gp',
    'rental_min_periods','rental_max_periods','rental_period_options',
    'rental_fee_pct','rental_boost_pct','rental_max_per_owner'
  ];
  const { rows } = await pool.query(
    `SELECT key, value FROM game_settings WHERE key = ANY($1)`, [keys]);
  const m = {};
  rows.forEach(r => { m[r.key] = String(r.value); });
  return {
    enabled:       (m.rental_enabled || 'true') === 'true',
    minGp:         parseFloat(m.rental_min_gp          || '5'),
    maxGp:         parseFloat(m.rental_max_gp          || '10000'),
    minPeriods:    parseInt(m.rental_min_periods        || '1',  10),
    maxPeriods:    parseInt(m.rental_max_periods        || '30', 10),
    periodOptions: (m.rental_period_options || '6,12,24,48,72').split(',').map(Number),
    feePct:        parseFloat(m.rental_fee_pct          || '10'),
    boostPct:      parseInt(m.rental_boost_pct          || '10', 10),
    maxPerOwner:   parseInt(m.rental_max_per_owner      || '5',  10)
  };
}

// ── List a claim for rent ─────────────────────────────────────────────────────
async function listForRent(owner, claimId, gpPerPeriod, periodHours, boostPct) {
  const oLower = owner.toLowerCase();
  const cfg = await getSettings();
  if (!cfg.enabled) throw new Error('Rental market is currently disabled');
  if (gpPerPeriod < cfg.minGp) throw new Error(`Minimum rent is ${cfg.minGp} GP/period`);
  if (gpPerPeriod > cfg.maxGp) throw new Error(`Maximum rent is ${cfg.maxGp} GP/period`);
  if (!cfg.periodOptions.includes(periodHours)) {
    throw new Error(`Period must be one of: ${cfg.periodOptions.join(', ')} hours`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify ownership
    const { rows: claimRows } = await client.query(
      `SELECT id, owner FROM claims WHERE id=$1 AND deleted_at IS NULL`, [claimId]);
    if (!claimRows.length) throw new Error('Claim not found');
    if (claimRows[0].owner.toLowerCase() !== oLower) throw new Error('You do not own this claim');

    // Max listing check
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*) AS cnt FROM territory_rentals
       WHERE owner=$1 AND status IN ('listed','rented')`, [oLower]);
    if (parseInt(countRows[0].cnt, 10) >= cfg.maxPerOwner) {
      throw new Error(`Max ${cfg.maxPerOwner} active rental listings allowed`);
    }

    // Check no existing active listing for this claim
    const { rows: existRows } = await client.query(
      `SELECT id FROM territory_rentals WHERE claim_id=$1 AND status IN ('listed','rented')
       LIMIT 1`, [claimId]);
    if (existRows.length) throw new Error('Claim already has an active listing');

    const actualBoost = Math.min(boostPct || cfg.boostPct, 50);
    const { rows } = await client.query(
      `INSERT INTO territory_rentals
         (claim_id, owner, gp_per_period, period_hours, boost_pct, fee_pct, status)
       VALUES ($1,$2,$3,$4,$5,$6,'listed')
       RETURNING *`,
      [claimId, oLower, gpPerPeriod, periodHours, actualBoost, cfg.feePct]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Rent a listing ────────────────────────────────────────────────────────────
async function rentClaim(tenant, rentalId, periods) {
  const tLower = tenant.toLowerCase();
  const cfg = await getSettings();
  if (!cfg.enabled) throw new Error('Rental market is currently disabled');
  if (periods < cfg.minPeriods) throw new Error(`Minimum rental is ${cfg.minPeriods} period(s)`);
  if (periods > cfg.maxPeriods) throw new Error(`Maximum prepayment is ${cfg.maxPeriods} periods`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: rentalRows } = await client.query(
      `SELECT * FROM territory_rentals WHERE id=$1 FOR UPDATE`, [rentalId]);
    if (!rentalRows.length) throw new Error('Rental listing not found');
    const rental = rentalRows[0];
    if (rental.status !== 'listed') throw new Error(`Listing is ${rental.status}`);
    if (rental.owner === tLower) throw new Error('Cannot rent your own claim');

    const totalGp = parseFloat((Number(rental.gp_per_period) * periods).toFixed(6));
    const feeGp   = parseFloat((totalGp * Number(rental.fee_pct) / 100).toFixed(6));
    const ownerGp = parseFloat((totalGp - feeGp).toFixed(6));

    // Check tenant balance
    const { rows: balRows } = await client.query(
      'SELECT gp_balance AS balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE', [tLower]);
    const bal = balRows.length ? Number(balRows[0].balance) : 0;
    if (bal < totalGp) throw new Error(`Insufficient GP (need ${totalGp}, have ${bal.toFixed(2)})`);

    // Deduct from tenant
    const deductRental = await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND gp_balance >= $1',
      [totalGp, tLower]
    );
    if (deductRental.rowCount === 0) throw new Error('INSUFFICIENT_GP');
    // Pay owner
    await client.query(
      `UPDATE users SET gp_balance = gp_balance + $2 WHERE LOWER(wallet_address) = LOWER($1)`,
      [rental.owner, ownerGp]
    );

    // Update rental
    const expiresAt = new Date(Date.now() + Number(rental.period_hours) * periods * 3600 * 1000);
    await client.query(
      `UPDATE territory_rentals
       SET status='rented', tenant=$1, periods_paid=$2, rented_at=NOW(), expires_at=$3
       WHERE id=$4`,
      [tLower, periods, expiresAt, rentalId]
    );

    // Log
    await client.query(
      `INSERT INTO rental_log (rental_id, claim_id, owner, tenant, gp_paid, gp_to_owner, gp_fee, periods)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [rentalId, rental.claim_id, rental.owner, tLower, totalGp, ownerGp, feeGp, periods]
    );

    await client.query('COMMIT');

    // Notifications
    try {
      await pool.query(
        `INSERT INTO player_notifications (wallet, type, message, meta) VALUES ($1,'rental_new',$2,$3)`,
        [rental.owner, `🏘️ Claim #${rental.claim_id} rented for ${periods} period(s) (+${ownerGp} GP)`,
         JSON.stringify({ rental_id: rentalId, claim_id: rental.claim_id, tenant: tLower, gp: ownerGp })]
      );
    } catch (_) {}

    return { rentalId, claimId: rental.claim_id, periods, totalGp, ownerGp, feeGp, expiresAt };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Cancel a listing (owner cancels unlisted) ─────────────────────────────────
async function cancelListing(owner, rentalId) {
  const oLower = owner.toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM territory_rentals WHERE id=$1 FOR UPDATE`, [rentalId]);
    if (!rows.length) throw new Error('Listing not found');
    const r = rows[0];
    if (r.owner !== oLower) throw new Error('Not your listing');
    if (r.status !== 'listed') throw new Error('Can only cancel unlisted listings');
    await client.query(
      `UPDATE territory_rentals SET status='cancelled' WHERE id=$1`, [rentalId]);
    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Expire rentals ────────────────────────────────────────────────────────────
async function expireRentals() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE territory_rentals SET status='expired'
       WHERE status='rented' AND expires_at < NOW()
       RETURNING *`
    );
    for (const r of rows) {
      try {
        await pool.query(
          `INSERT INTO player_notifications (wallet, type, message, meta) VALUES ($1,'rental_expired',$2,$3)`,
          [r.tenant, `🏘️ Your rental of claim #${r.claim_id} has expired`,
           JSON.stringify({ rental_id: r.id, claim_id: r.claim_id })]
        );
        await pool.query(
          `INSERT INTO player_notifications (wallet, type, message, meta) VALUES ($1,'rental_ended',$2,$3)`,
          [r.owner, `🏘️ Rental of claim #${r.claim_id} ended`,
           JSON.stringify({ rental_id: r.id, claim_id: r.claim_id })]
        );
      } catch (_) {}
    }
    await client.query('COMMIT');
    if (rows.length) console.log(`[Rental] Expired ${rows.length} rentals`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Rental] expireRentals error:', err.message);
  } finally {
    client.release();
  }
}

// ── Check if tenant has active rental on claim (for mining boost) ─────────────
async function getActiveRental(claimId, tenantWallet) {
  const { rows } = await pool.query(
    `SELECT * FROM territory_rentals
     WHERE claim_id=$1 AND tenant=$2 AND status='rented' AND expires_at > NOW()
     LIMIT 1`,
    [claimId, tenantWallet.toLowerCase()]
  );
  return rows[0] || null;
}

// ── Queries ───────────────────────────────────────────────────────────────────
async function getListings(filter = {}) {
  let q = `SELECT r.*, (c.width * c.height) AS pixel_count, cn.nickname AS owner_nick
           FROM territory_rentals r
           LEFT JOIN claims c ON c.id = r.claim_id
           LEFT JOIN users cn ON cn.wallet_address = r.owner
           WHERE 1=1`;
  const params = [];
  if (filter.status) { params.push(filter.status); q += ` AND r.status=$${params.length}`; }
  else q += ` AND r.status='listed'`;
  q += ' ORDER BY r.created_at DESC LIMIT 50';
  const { rows } = await pool.query(q, params);
  return rows;
}

async function getMyRentals(wallet) {
  const w = wallet.toLowerCase();
  const { rows } = await pool.query(
    `SELECT r.*, (c.width * c.height) AS pixel_count, cn.nickname AS owner_nick, tn.nickname AS tenant_nick
     FROM territory_rentals r
     LEFT JOIN claims c ON c.id = r.claim_id
     LEFT JOIN users cn ON cn.wallet_address = r.owner
     LEFT JOIN users tn ON tn.wallet_address = r.tenant
     WHERE r.owner=$1 OR r.tenant=$1
     ORDER BY r.created_at DESC LIMIT 50`,
    [w]
  );
  return rows;
}

async function getAdminStats() {
  const [totals, recent, settings] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status='listed')  AS total_listed,
         COUNT(*) FILTER (WHERE status='rented')  AS total_rented,
         COUNT(*) FILTER (WHERE status='expired') AS total_expired,
         COALESCE(SUM(gp_paid),0)     AS total_gp_paid,
         COALESCE(SUM(gp_fee),0)      AS total_fees,
         COALESCE(SUM(gp_to_owner),0) AS total_to_owners
       FROM rental_log`
    ),
    pool.query(
      `SELECT r.*, (c.width * c.height) AS pixel_count, cn.nickname AS owner_nick, tn.nickname AS tenant_nick
       FROM territory_rentals r
       LEFT JOIN claims c ON c.id = r.claim_id
       LEFT JOIN users cn ON cn.wallet_address = r.owner
       LEFT JOIN users tn ON tn.wallet_address = r.tenant
       ORDER BY r.created_at DESC LIMIT 50`
    ),
    pool.query(
      `SELECT key, value FROM game_settings WHERE category='rental' ORDER BY key`
    )
  ]);
  return { totals: totals.rows[0], recent: recent.rows, settings: settings.rows };
}

module.exports = {
  listForRent, rentClaim, cancelListing, expireRentals,
  getActiveRental, getListings, getMyRentals, getAdminStats, getSettings
};
