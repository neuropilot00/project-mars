const { pool, getSetting } = require('../db');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// pg_advisory_lock key — unique constant for maintenance job (avoid collisions with other jobs)
const ADVISORY_LOCK_KEY = 987654321;

/**
 * Process weekly maintenance fees for users holding more than threshold pixels.
 * - Deducts PP proportional to pixels above threshold
 * - If user can't pay, abandons oldest territories until under threshold
 * - Logs every processed user to maintenance_log
 */
async function processMaintenanceFees() {
  // Check if feature is enabled
  const enabled = await getSetting('maintenance_fee_enabled');
  if (enabled === false || enabled === 'false') {
    return { skipped: true, reason: 'disabled' };
  }

  // ── Concurrency guard ────────────────────────────────────────────────────────
  // Acquire a session-level advisory lock so only one scheduler process runs at
  // a time. pg_try_advisory_lock returns false immediately (non-blocking) when
  // another connection already holds the lock.  The lock is released when the
  // connection is returned to the pool in the finally block.
  const lockClient = await pool.connect();
  let lockAcquired = false;
  try {
    const { rows: lockRows } = await lockClient.query(
      'SELECT pg_try_advisory_lock($1) AS ok', [ADVISORY_LOCK_KEY]
    );
    lockAcquired = lockRows[0]?.ok === true;
    if (!lockAcquired) {
      return { skipped: true, reason: 'concurrent_run' };
    }

    // Check if a week has passed since last run (re-read AFTER acquiring the lock
    // so two racing callers can't both pass the time check)
    const lastRunRaw = await getSetting('maintenance_last_run', '1970-01-01T00:00:00.000Z');
    const lastRun = new Date(lastRunRaw);
    const now = new Date();

    if (now.getTime() - lastRun.getTime() < WEEK_MS) {
      return { skipped: true, reason: 'not_due', nextRun: new Date(lastRun.getTime() + WEEK_MS) };
    }

    return await _runMaintenance(now);
  } finally {
    // Advisory lock is released when the connection is returned to the pool
    lockClient.release();
  }
}

async function _runMaintenance(now) {

  const threshold = parseInt(await getSetting('maintenance_fee_threshold', 100) || 100);
  const rate = parseFloat(await getSetting('maintenance_fee_rate', 0.5));

  // Find users with pixel count above threshold
  const usersRes = await pool.query(
    `SELECT owner AS wallet, COUNT(*) AS pixel_count
     FROM pixels
     WHERE owner IS NOT NULL
     GROUP BY owner
     HAVING COUNT(*) > $1
     ORDER BY COUNT(*) DESC`,
    [threshold]
  );

  const results = [];

  for (const user of usersRes.rows) {
    const wallet = user.wallet;
    const totalPixels = parseInt(user.pixel_count);
    const fee = (totalPixels - threshold) * rate;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current PP balance
      const balRes = await client.query(
        'SELECT pp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE',
        [wallet]
      );

      if (!balRes.rows.length) {
        await client.query('ROLLBACK');
        continue;
      }

      const ppBalance = parseFloat(balRes.rows[0].pp_balance);
      let pixelsAbandoned = 0;

      if (ppBalance >= fee) {
        // User can pay — deduct fee
        const deductMaintenance = await client.query(
          'UPDATE users SET pp_balance = pp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND pp_balance >= $1',
          [fee, wallet]
        );
        if (deductMaintenance.rowCount === 0) throw new Error('INSUFFICIENT_PP');

        // Log transaction
        await client.query(
          `INSERT INTO transactions (type, from_wallet, pp_amount, meta)
           VALUES ('maintenance_fee', $1, $2, $3)`,
          [wallet, fee, JSON.stringify({ total_pixels: totalPixels, threshold, rate })]
        );
      } else {
        // User can't pay full fee — deduct what they have, then abandon oldest territories
        if (ppBalance > 0) {
          await client.query(
            'UPDATE users SET pp_balance = 0 WHERE LOWER(wallet_address) = LOWER($1)',
            [wallet]
          );
        }

        const unpaidFee = fee - ppBalance;
        // Calculate how many pixels need to be abandoned to get under threshold
        // Each pixel above threshold costs `rate` PP, so pixels to remove = ceil(unpaidFee / rate)
        // But also ensure final count <= threshold
        const pixelsToRemove = Math.max(
          Math.ceil(unpaidFee / rate),
          totalPixels - threshold
        );

        // Get oldest claims for this user, ordered by creation date
        // We abandon entire claims at a time (oldest first)
        const claimsRes = await client.query(
          `SELECT c.id, COUNT(p.lat) AS px_count
           FROM claims c
           JOIN pixels p ON p.claim_id = c.id AND p.owner = $1
           WHERE c.owner = $1 AND c.deleted_at IS NULL
           GROUP BY c.id
           ORDER BY c.created_at ASC`,
          [wallet]
        );

        let removed = 0;
        for (const claim of claimsRes.rows) {
          if (removed >= pixelsToRemove) break;

          const claimPixels = parseInt(claim.px_count);

          // Set pixels to unowned
          await client.query(
            'UPDATE pixels SET owner = NULL, claim_id = NULL, updated_at = NOW() WHERE claim_id = $1 AND owner = $2',
            [claim.id, wallet]
          );

          // Soft-delete the claim — owner set to NULL (deleted_at carries the signal)
          await client.query(
            'UPDATE claims SET deleted_at = NOW(), owner = NULL WHERE id = $1',
            [claim.id]
          );

          removed += claimPixels;
        }

        pixelsAbandoned = removed;

        // Log transaction for partial payment + abandonment
        await client.query(
          `INSERT INTO transactions (type, from_wallet, pp_amount, meta)
           VALUES ('maintenance_fee', $1, $2, $3)`,
          [wallet, ppBalance, JSON.stringify({
            total_pixels: totalPixels,
            threshold,
            rate,
            could_not_pay: true,
            pixels_abandoned: pixelsAbandoned
          })]
        );
      }

      // Log to maintenance_log
      await client.query(
        `INSERT INTO maintenance_log (wallet, total_pixels, fee_amount, pixels_abandoned)
         VALUES ($1, $2, $3, $4)`,
        [wallet, totalPixels, ppBalance >= fee ? fee : ppBalance, pixelsAbandoned]
      );

      await client.query('COMMIT');

      results.push({
        wallet,
        totalPixels,
        fee: ppBalance >= fee ? fee : ppBalance,
        pixelsAbandoned
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[MAINTENANCE] Error processing ${wallet}:`, err.message);
    } finally {
      client.release();
    }
  }

  // Update last run timestamp
  await pool.query(
    `UPDATE settings SET value = $1, updated_at = NOW() WHERE key = 'maintenance_last_run'`,
    [JSON.stringify(now.toISOString())]
  );

  const totalFees = results.reduce((sum, r) => sum + r.fee, 0);
  const totalAbandoned = results.reduce((sum, r) => sum + r.pixelsAbandoned, 0);

  console.log(`[MAINTENANCE] Processed ${results.length} users. Fees collected: ${totalFees.toFixed(2)} PP. Pixels abandoned: ${totalAbandoned}`);

  return { processed: results.length, totalFees, totalAbandoned, results };
} // end _runMaintenance

module.exports = { processMaintenanceFees };
