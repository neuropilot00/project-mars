const { pool, getSetting } = require('../db');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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

  // Check if a week has passed since last run
  const lastRunRaw = await getSetting('maintenance_last_run', '1970-01-01T00:00:00.000Z');
  const lastRun = new Date(lastRunRaw);
  const now = new Date();

  if (now.getTime() - lastRun.getTime() < WEEK_MS) {
    return { skipped: true, reason: 'not_due', nextRun: new Date(lastRun.getTime() + WEEK_MS) };
  }

  const threshold = parseInt(await getSetting('maintenance_fee_threshold', 100));
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
        'SELECT pp_balance FROM users WHERE wallet_address = $1',
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
        await client.query(
          'UPDATE users SET pp_balance = pp_balance - $1 WHERE wallet_address = $2',
          [fee, wallet]
        );

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
            'UPDATE users SET pp_balance = 0 WHERE wallet_address = $1',
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

          // Soft-delete the claim
          await client.query(
            'UPDATE claims SET deleted_at = NOW(), owner = $1 WHERE id = $2',
            ['abandoned', claim.id]
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
}

module.exports = { processMaintenanceFees };
