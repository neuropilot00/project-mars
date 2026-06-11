const express = require('express');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool } = require('../db');
const { requireAuth, getAuthWallet } = require('../utils/apiHelpers');

const router = express.Router();

const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests. Please slow down.' },
});

const writeLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many write requests. Please wait.' },
});

router.get('/notifications', readLimiter, async (req, res) => {
  const wallet = (req.headers['x-wallet'] || req.query.wallet || '').toLowerCase().trim();
  if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet_required' });

  try {
    const limit = Math.min(parseInt(req.query.limit || '30', 10), 100);
    const result = await pool.query(
      `SELECT * FROM player_notifications WHERE wallet = $1 ORDER BY created_at DESC LIMIT $2`,
      [wallet, limit]
    );
    const unreadCount = result.rows.filter((notification) => !notification.read).length;
    res.json({ notifications: result.rows, unread: unreadCount });
  } catch (err) {
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/notifications/read', requireAuth, writeLimiter, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet_required' });

  const { id } = req.body || {};
  try {
    if (id) {
      await pool.query('UPDATE player_notifications SET read = true WHERE id = $1 AND wallet = $2', [id, wallet]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/notifications/read-all', requireAuth, writeLimiter, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet_required' });

  try {
    await pool.query('UPDATE player_notifications SET read = true WHERE wallet = $1 AND read = false', [wallet]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/me/away-briefing', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet_required' });

  try {
    const [lossRows, bountyRows] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS ships_lost, COALESCE(SUM(ship_value_gp),0)::bigint AS lost_value,
                MAX(created_at) AS last_loss
           FROM ship_wrecks WHERE LOWER(original_owner) = LOWER($1) AND created_at > NOW() - INTERVAL '72 hours'`,
        [wallet]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS bounties, COALESCE(SUM(reward_gp),0)::bigint AS bounty_total
           FROM bounty_listings WHERE LOWER(target_wallet) = LOWER($1) AND status = 'active'`,
        [wallet]
      ).catch(() => ({ rows: [{ bounties: 0, bounty_total: 0 }] })),
    ]);

    const shipsLost = parseInt(lossRows.rows[0].ships_lost, 10) || 0;
    const lostValue = parseInt(lossRows.rows[0].lost_value, 10) || 0;
    const bounties = parseInt(bountyRows.rows[0].bounties, 10) || 0;
    const bountyTotal = parseInt(bountyRows.rows[0].bounty_total, 10) || 0;

    res.json({
      shipsLost,
      lostValue,
      bounties,
      bountyTotal,
      lastLoss: lossRows.rows[0].last_loss || null,
      hasNews: shipsLost > 0 || bounties > 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
