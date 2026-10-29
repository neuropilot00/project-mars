'use strict';

const crypto = require('crypto');
const LEASE_MS = 60000;
const HEARTBEAT_MS = 10000;
const SLOT_LOCK = 177656071;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// A lease does not reserve a pool connection during a long battle.
async function acquireLiveAuthority(pool, battleId, maxConcurrent, onWaiting, existingToken = null) {
  const token = existingToken || crypto.randomUUID();
  const acquiredAt = Date.now();
  const claimed = await pool.query(`UPDATE fleet_battles SET live_lease_token=$2,
      live_lease_expires_at=clock_timestamp()+($3::int * INTERVAL '1 millisecond'), live_slot_acquired=false
    WHERE id=$1 AND status='active' AND (live_lease_token IS NULL OR (live_lease_token=$2 AND live_lease_expires_at>clock_timestamp())) RETURNING id`,
    [battleId, token, LEASE_MS]);
  if (!claimed.rowCount) throw new Error('BATTLE_AUTHORITY_LOST');
  let lost = false, lastRenewed = acquiredAt, renewing = false, stopped = false;
  const heartbeat = setInterval(async () => {
    if (renewing || stopped || lost) return;
    renewing = true;
    const renewalStarted = Date.now();
    try {
      const r = await pool.query(`UPDATE fleet_battles
        SET live_lease_expires_at=clock_timestamp()+($3::int * INTERVAL '1 millisecond')
        WHERE id=$1 AND status='active' AND live_lease_token=$2 AND live_lease_expires_at>clock_timestamp()
        RETURNING id`, [battleId, token, LEASE_MS]);
      if (!r.rowCount) lost = true;
      else lastRenewed = renewalStarted;
    } catch (_) { /* Retry until the last confirmed lease expires. */ }
    finally { renewing = false; }
  }, HEARTBEAT_MS);
  heartbeat.unref?.();
  const shouldAbort = () => lost || Date.now() - lastRenewed >= LEASE_MS;
  try {
    while (!shouldAbort()) {
      const client = await pool.connect();
      let acquired = false;
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [SLOT_LOCK]);
        const count = await client.query(`SELECT
            COUNT(*) FILTER (WHERE b.live_slot_acquired)::int AS n,
            COUNT(*) FILTER (WHERE NOT b.live_slot_acquired AND (b.battle_started_at,b.id)<(own.battle_started_at,own.id))::int AS ahead
          FROM fleet_battles b CROSS JOIN fleet_battles own
          WHERE own.id=$1 AND b.status='active' AND b.live_lease_expires_at>clock_timestamp()`, [battleId]);
        if (count.rows[0].ahead >= Math.min(20, maxConcurrent * 4)) throw new Error('BATTLE_QUEUE_FULL');
        if (count.rows[0].n < maxConcurrent && count.rows[0].ahead === 0) {
          const update = await client.query(`UPDATE fleet_battles SET live_slot_acquired=true, battle_started_at=clock_timestamp()
            WHERE id=$1 AND status='active' AND live_lease_token=$2 AND live_lease_expires_at>clock_timestamp()
            RETURNING id`, [battleId, token]);
          acquired = !!update.rowCount;
          if (!acquired) lost = true;
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { client.release(); }
      if (acquired) return { token, shouldAbort, stop() { stopped = true; clearInterval(heartbeat); } };
      onWaiting?.();
      await sleep(2000);
    }
    throw new Error('BATTLE_AUTHORITY_LOST');
  } catch (error) {
    stopped = true; clearInterval(heartbeat);
    await pool.query(`UPDATE fleet_battles SET live_lease_token=NULL, live_lease_expires_at=NULL, live_slot_acquired=false
      WHERE id=$1 AND status='active' AND live_lease_token=$2`, [battleId, token]).catch(() => {});
    throw error;
  }
}

async function cleanupExpiredBattles(pool) {
  // Legacy workers do not advertise leases; preserve a three-hour rolling-deploy grace.
  return pool.query(`WITH cancelled AS (
      UPDATE fleet_battles SET status='cancelled', ended_at=NOW(), live_slot_acquired=false,
        battle_summary=COALESCE(battle_summary,'{}'::jsonb)||'{"error":"scheduler_restart_cleanup"}'::jsonb
      WHERE status='active' AND (
        (live_lease_token IS NOT NULL AND live_lease_expires_at <= clock_timestamp()) OR
        (live_lease_token IS NULL AND battle_started_at < NOW()-INTERVAL '3 hours'))
      RETURNING id
    ), unlocked AS (
      UPDATE fleets SET is_in_battle=false, current_battle_id=NULL
      WHERE current_battle_id IN (SELECT id FROM cancelled) RETURNING id
    ) SELECT id FROM cancelled`);
}

module.exports = { acquireLiveAuthority, cleanupExpiredBattles };
