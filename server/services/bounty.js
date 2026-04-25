'use strict';
// ⚠ STATUS: 🔴 PHANTOM TABLES — 이 서비스가 의존하는 테이블이 DB에 없음.
// 호출 시 silent 실패 (catch에서 'internal_error' 반환). 살리려면 마이그레이션
// 추가 또는 services + route + 스케줄러 등록 일괄 삭제 결정 필요.
// 자세한 내용: CLAUDE.md §13.A 참조.
/**
 * GP Bounty Board Service — Migration 113
 * Players post GP bounties on other players' territories.
 * First hijacker who takes any pixel from the target claims the GP reward.
 */

const { pool } = require('../db');

let logGPActivity;
try { logGPActivity = require('../db').logGPActivity; } catch (_) {}
let notifyPlayer;
try { notifyPlayer = require('./notifications').notifyPlayer; } catch (_) {}
let newsService;
try { newsService = require('./news'); } catch (_) {}

// ── Settings ──────────────────────────────────────────────────────────────────

async function getSettings() {
  const keys = [
    'bounty_enabled', 'bounty_min_gp', 'bounty_max_gp',
    'bounty_max_active_poster', 'bounty_max_active_target',
    'bounty_expiry_days', 'bounty_cancel_fee_pct',
    'bounty_msg_max_len', 'bounty_self_allowed',
  ];
  const res = await pool.query(`SELECT key, value FROM settings WHERE key = ANY($1)`, [keys]);
  const map = {};
  res.rows.forEach(r => { map[r.key] = r.value; });
  return {
    enabled:         (map.bounty_enabled || 'true') !== 'false',
    minGP:           parseFloat(map.bounty_min_gp)            || 50,
    maxGP:           parseFloat(map.bounty_max_gp)            || 5000,
    maxPerPoster:    parseInt(map.bounty_max_active_poster)    || 3,
    maxPerTarget:    parseInt(map.bounty_max_active_target)    || 5,
    expiryDays:      parseInt(map.bounty_expiry_days)          || 7,
    cancelFeePct:    parseFloat(map.bounty_cancel_fee_pct)     || 10,
    msgMaxLen:       parseInt(map.bounty_msg_max_len)          || 150,
    selfAllowed:     (map.bounty_self_allowed || 'false') !== 'false',
  };
}

// ── Post a bounty ─────────────────────────────────────────────────────────────

async function postBounty(client, posterWallet, targetWallet, gpAmount, message, targetClaimId = null) {
  const poster = posterWallet.toLowerCase();
  const target = targetWallet.toLowerCase();
  const cfg = await getSettings();

  if (!cfg.enabled) throw new Error('Bounty board is currently disabled');
  if (!cfg.selfAllowed && poster === target) throw new Error('You cannot post a bounty on your own territory');
  if (gpAmount < cfg.minGP) throw new Error(`Minimum bounty is ${cfg.minGP} GP`);
  if (gpAmount > cfg.maxGP) throw new Error(`Maximum bounty is ${cfg.maxGP} GP`);

  const trimMsg = (message || '').trim().slice(0, cfg.msgMaxLen) || null;

  // Check target exists and has territories
  const targetRes = await client.query(
    `SELECT COUNT(*) AS n FROM claims WHERE owner = $1 AND deleted_at IS NULL`, [target]
  );
  if (parseInt(targetRes.rows[0]?.n) === 0) throw new Error('Target has no active territories');

  // Check poster's active bounty count
  const posterCount = await client.query(
    `SELECT COUNT(*) AS n FROM gp_bounties WHERE poster = $1 AND status = 'active'`, [poster]
  );
  if (parseInt(posterCount.rows[0]?.n) >= cfg.maxPerPoster) {
    throw new Error(`Maximum ${cfg.maxPerPoster} active bounties per poster`);
  }

  // Check target's bounty count
  const targetCount = await client.query(
    `SELECT COUNT(*) AS n FROM gp_bounties WHERE target_wallet = $1 AND status = 'active'`, [target]
  );
  if (parseInt(targetCount.rows[0]?.n) >= cfg.maxPerTarget) {
    throw new Error(`This player already has ${cfg.maxPerTarget} bounties on them`);
  }

  // Deduct GP (held in escrow in the table — GP is already deducted from wallet)
  const userRes = await client.query(
    `SELECT gp_balance FROM users WHERE wallet_address = $1 FOR UPDATE`, [poster]
  );
  if (!userRes.rows.length) throw new Error('User not found');
  const balance = parseFloat(userRes.rows[0].gp_balance) || 0;
  if (balance < gpAmount) throw new Error(`Insufficient GP: need ${gpAmount}, have ${balance.toFixed(2)}`);

  await client.query(`UPDATE users SET gp_balance = gp_balance - $2 WHERE wallet_address = $1`, [poster, gpAmount]);

  const expiresAt = new Date(Date.now() + cfg.expiryDays * 24 * 60 * 60 * 1000);
  const ins = await client.query(
    `INSERT INTO gp_bounties (poster, target_wallet, target_claim_id, gp_amount, message, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [poster, target, targetClaimId || null, gpAmount, trimMsg, expiresAt]
  );

  return ins.rows[0];
}

// ── Claim a bounty (called after successful hijack) ───────────────────────────

/**
 * Check if attacker is eligible for any bounty on defender's wallet, and pay out if so.
 * Called from api.js after a successful hijack. Uses the MAIN transaction client.
 * @returns {object|null} payout info if bounty claimed
 */
async function checkAndClaimBounty(client, attackerWallet, defenderWallet, battleId) {
  const attacker = attackerWallet.toLowerCase();
  const defender = defenderWallet.toLowerCase();
  if (attacker === defender) return null;

  // Find highest-value active bounty on defender
  const res = await client.query(
    `SELECT * FROM gp_bounties
      WHERE target_wallet = $1 AND status = 'active' AND expires_at > NOW()
      ORDER BY gp_amount DESC
      LIMIT 1
      FOR UPDATE SKIP LOCKED`,
    [defender]
  );
  if (!res.rows.length) return null;
  const bounty = res.rows[0];

  // Poster cannot claim their own bounty via alt-account... no good way to enforce without linking
  // Basic protection: attacker cannot be the poster
  if (bounty.poster === attacker) return null;

  // Pay out to attacker
  await client.query(
    `UPDATE gp_bounties SET status='claimed', claimed_by=$2, claimed_at=NOW(), claim_battle_id=$3
      WHERE id=$1`,
    [bounty.id, attacker, battleId || null]
  );
  await client.query(
    `UPDATE users SET gp_balance = gp_balance + $2 WHERE wallet_address = $1`,
    [attacker, bounty.gp_amount]
  );

  return {
    bountyId: bounty.id,
    gp: bounty.gp_amount,
    poster: bounty.poster,
    message: bounty.message,
  };
}

// ── Cancel a bounty ───────────────────────────────────────────────────────────

async function cancelBounty(client, posterWallet, bountyId) {
  const poster = posterWallet.toLowerCase();
  const cfg = await getSettings();

  const res = await client.query(
    `SELECT * FROM gp_bounties WHERE id = $1 AND poster = $2 AND status = 'active' FOR UPDATE`,
    [bountyId, poster]
  );
  if (!res.rows.length) throw new Error('Bounty not found or not cancellable');
  const bounty = res.rows[0];

  const fee    = +(bounty.gp_amount * cfg.cancelFeePct / 100).toFixed(6);
  const refund = +(bounty.gp_amount - fee).toFixed(6);

  await client.query(`UPDATE gp_bounties SET status='cancelled' WHERE id=$1`, [bountyId]);
  await client.query(`UPDATE users SET gp_balance = gp_balance + $2 WHERE wallet_address = $1`, [poster, refund]);

  return { refund, fee };
}

// ── Expire stale bounties (scheduler) ────────────────────────────────────────

async function expireBounties() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `UPDATE gp_bounties SET status='expired'
        WHERE status='active' AND expires_at < NOW()
        RETURNING *`
    );
    // Refund expired bounties (no fee)
    for (const b of res.rows) {
      await client.query(
        `UPDATE users SET gp_balance = gp_balance + $2 WHERE wallet_address = $1`,
        [b.poster, b.gp_amount]
      );
      if (notifyPlayer) {
        notifyPlayer(b.poster, `⏰ Your bounty of ${b.gp_amount} GP on ${b.target_wallet.slice(0,8)}... has expired and been refunded.`, 'bounty').catch(() => {});
      }
    }
    await client.query('COMMIT');
    if (res.rows.length) console.log(`[Bounty] Expired ${res.rows.length} bounties`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Bounty] expire error:', e.message);
  } finally {
    client.release();
  }
}

// ── Process bounty after successful hijack (standalone transaction) ───────────

/**
 * Called fire-and-forget after a hijack COMMIT.
 * Finds the highest-value active bounty on the defender and pays the attacker.
 */
async function processHijackBounty(attackerWallet, defenderWallet, battleId) {
  const attacker = attackerWallet.toLowerCase();
  const defender = defenderWallet.toLowerCase();
  if (attacker === defender) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `UPDATE gp_bounties
          SET status = 'claimed', claimed_by = $2, claimed_at = NOW(), claim_battle_id = $3
        WHERE id = (
          SELECT id FROM gp_bounties
           WHERE target_wallet = $1 AND status = 'active' AND expires_at > NOW()
             AND poster != $2
           ORDER BY gp_amount DESC LIMIT 1 FOR UPDATE SKIP LOCKED
        )
        RETURNING *`,
      [defender, attacker, battleId || null]
    );
    if (!res.rows.length) { await client.query('ROLLBACK'); return; }
    const bounty = res.rows[0];

    // Pay attacker
    await client.query(
      `UPDATE users SET gp_balance = gp_balance + $2 WHERE wallet_address = $1`,
      [attacker, bounty.gp_amount]
    );
    await client.query('COMMIT');

    // Notifications (fire-and-forget)
    if (notifyPlayer) {
      notifyPlayer(attacker,
        `💰 Bounty claimed! +${bounty.gp_amount} GP for capturing ${defender.slice(0,8)}...!`,
        'bounty'
      ).catch(() => {});
      notifyPlayer(bounty.poster,
        `🎯 Your bounty on ${defender.slice(0,8)}... was claimed by ${attacker.slice(0,8)}...!`,
        'bounty'
      ).catch(() => {});
    }
    if (logGPActivity) {
      logGPActivity(attacker, bounty.gp_amount, 'bounty_claimed', { bountyId: bounty.id, target: defender }).catch(() => {});
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.warn('[Bounty] processHijackBounty error:', e.message);
  } finally {
    client.release();
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

async function getActiveBounties(limit = 50, targetWallet = null) {
  const params = [limit];
  let whereClause = `WHERE b.status = 'active' AND b.expires_at > NOW()`;
  if (targetWallet) {
    whereClause += ` AND b.target_wallet = $2`;
    params.push(targetWallet.toLowerCase());
  }
  const res = await pool.query(
    `SELECT b.*,
            p.nickname AS poster_nick,
            t.nickname AS target_nick
       FROM gp_bounties b
       LEFT JOIN users p ON p.wallet_address = b.poster
       LEFT JOIN users t ON t.wallet_address = b.target_wallet
      ${whereClause}
      ORDER BY b.gp_amount DESC, b.created_at DESC
      LIMIT $1`,
    params
  );
  return res.rows;
}

async function getMyBounties(wallet) {
  const w = wallet.toLowerCase();
  const res = await pool.query(
    `SELECT b.*, t.nickname AS target_nick, c.nickname AS claimer_nick
       FROM gp_bounties b
       LEFT JOIN users t ON t.wallet_address = b.target_wallet
       LEFT JOIN users c ON c.wallet_address = b.claimed_by
      WHERE b.poster = $1
      ORDER BY b.created_at DESC
      LIMIT 50`,
    [w]
  );
  return res.rows;
}

async function getBountiesOnMe(wallet) {
  const w = wallet.toLowerCase();
  const res = await pool.query(
    `SELECT b.*, p.nickname AS poster_nick
       FROM gp_bounties b
       LEFT JOIN users p ON p.wallet_address = b.poster
      WHERE b.target_wallet = $1
      ORDER BY b.created_at DESC
      LIMIT 50`,
    [w]
  );
  return res.rows;
}

async function getAdminStats() {
  const [totalsRes, recentRes, settingsRes] = await Promise.all([
    pool.query(`
      SELECT COUNT(*)                                      AS total,
             COUNT(*) FILTER (WHERE status='active')      AS active,
             COUNT(*) FILTER (WHERE status='claimed')     AS claimed,
             COUNT(*) FILTER (WHERE status='expired')     AS expired,
             COUNT(*) FILTER (WHERE status='cancelled')   AS cancelled,
             COALESCE(SUM(gp_amount) FILTER (WHERE status='claimed'), 0) AS total_gp_paid
        FROM gp_bounties
    `).catch(() => ({ rows: [{}] })),
    pool.query(`
      SELECT b.*, p.nickname AS poster_nick, t.nickname AS target_nick
        FROM gp_bounties b
        LEFT JOIN users p ON p.wallet_address = b.poster
        LEFT JOIN users t ON t.wallet_address = b.target_wallet
       ORDER BY b.created_at DESC LIMIT 30
    `).catch(() => ({ rows: [] })),
    pool.query(`SELECT key, value FROM settings WHERE key LIKE 'bounty_%' ORDER BY key`).catch(() => ({ rows: [] })),
  ]);

  const t = totalsRes.rows[0] || {};
  const settingsMap = {};
  settingsRes.rows.forEach(r => { settingsMap[r.key] = r.value; });

  return {
    total:     parseInt(t.total)          || 0,
    active:    parseInt(t.active)         || 0,
    claimed:   parseInt(t.claimed)        || 0,
    expired:   parseInt(t.expired)        || 0,
    cancelled: parseInt(t.cancelled)      || 0,
    total_gp:  parseFloat(t.total_gp_paid)|| 0,
    recent:    recentRes.rows,
    settings:  settingsMap,
  };
}

module.exports = {
  postBounty,
  checkAndClaimBounty,
  processHijackBounty,
  cancelBounty,
  expireBounties,
  getActiveBounties,
  getMyBounties,
  getBountiesOnMe,
  getAdminStats,
};
