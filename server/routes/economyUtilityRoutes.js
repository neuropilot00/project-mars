const express = require('express');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool } = require('../db');
const { requireAuth, getAuthWallet } = require('../utils/apiHelpers');

let newsSvc;
try { newsSvc = require('../services/news'); } catch (_e) { /* news service not available */ }

const router = express.Router();

const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests. Please slow down.' }
});

const writeLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many write requests. Please wait.' }
});

router.get('/for-sale-territories', readLimiter, async (req, res) => {
  try {
    const rows = [];

    try {
      const mkt = await pool.query(
        `SELECT c.id AS claim_id, c.owner, c.center_lat AS lat, c.center_lng AS lng,
                c.width, c.height, ml.price, ml.currency, 'marketplace' AS sale_type,
                ml.expires_at AS ends_at, ml.id AS listing_id,
                u.nickname AS seller_nick
         FROM claims c
         JOIN marketplace_listings ml ON ml.claim_id = c.id AND ml.status = 'active'
         LEFT JOIN users u ON u.wallet_address = c.owner
         WHERE c.deleted_at IS NULL`
      );
      rows.push(...mkt.rows);
    } catch (_e) { /* marketplace_listings may not exist */ }

    try {
      const auc = await pool.query(
        `SELECT c.id AS claim_id, c.owner, c.center_lat AS lat, c.center_lng AS lng,
                c.width, c.height,
                COALESCE(a.current_price, a.start_price) AS price,
                a.currency, 'auction' AS sale_type, a.ends_at,
                a.id AS auction_id,
                u.nickname AS seller_nick
         FROM claims c
         JOIN auctions a ON a.claim_id = c.id AND a.status = 'active'
         LEFT JOIN users u ON u.wallet_address = c.owner
         WHERE c.deleted_at IS NULL`
      );
      rows.push(...auc.rows);
    } catch (_e) { /* auctions may not exist */ }

    res.json(rows);
  } catch (e) {
    console.error('[ForSale] territories error:', e.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/gp/activity', readLimiter, async (req, res) => {
  const wallet = (req.headers['x-wallet'] || req.query.wallet || '').toLowerCase().trim();
  if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet_required' });

  try {
    const limit = Math.min(parseInt(req.query.limit || '20'), 50);
    const rows = await pool.query(
      `SELECT id, delta, source, note, created_at
       FROM gp_activity_log
       WHERE wallet = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [wallet, limit]
    );
    res.json({ entries: rows.rows });
  } catch (err) {
    res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/user/my-territories', requireAuth, readLimiter, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet_required' });

  try {
    const enabled = await pool.query("SELECT value FROM settings WHERE key='territory_sell_enabled'");
    if (enabled.rows[0]?.value === 'false') return res.json({ territories: [], disabled: true });

    const result = await pool.query(
      `SELECT c.id, c.center_lat, c.center_lng, c.width, c.height,
              c.image_url, c.link_url, c.marketplace_locked,
              c.total_paid,
              COUNT(p.lat) AS pixel_count,
              u.nickname AS owner_nick
         FROM claims c
         LEFT JOIN pixels p ON p.claim_id = c.id
         LEFT JOIN users  u ON u.wallet_address = c.owner
        WHERE c.owner = $1 AND c.deleted_at IS NULL
        GROUP BY c.id, u.nickname
        ORDER BY c.created_at DESC
        LIMIT 50`,
      [wallet]
    );
    res.json({ territories: result.rows });
  } catch (err) {
    console.error('[API] my-territories error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/gp/transfer', requireAuth, writeLimiter, async (req, res) => {
  const fromWallet = getAuthWallet(req);
  if (!fromWallet || fromWallet.length < 10) {
    return res.status(400).json({ error: 'wallet_required' });
  }

  const { toWallet: rawTo, amount: rawAmount, note: rawNote } = req.body || {};
  const toWallet = (rawTo || '').toLowerCase().trim();
  const amount = Number(rawAmount);
  const note = (rawNote || '').slice(0, 200).trim();

  if (!toWallet || toWallet.length < 10) return res.status(400).json({ error: 'to_wallet_required' });
  if (toWallet === fromWallet) return res.status(400).json({ error: 'cannot_send_to_self' });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'invalid_amount' });

  try {
    const [enabledRow, minRow, maxRow, limitRow, feeRow] = await Promise.all([
      pool.query("SELECT value FROM settings WHERE key='gp_transfer_enabled'"),
      pool.query("SELECT value FROM settings WHERE key='gp_transfer_min_amount'"),
      pool.query("SELECT value FROM settings WHERE key='gp_transfer_max_amount'"),
      pool.query("SELECT value FROM settings WHERE key='gp_transfer_daily_limit'"),
      pool.query("SELECT value FROM settings WHERE key='gp_transfer_fee_pct'"),
    ]);
    if (enabledRow.rows[0]?.value === 'false') return res.status(400).json({ error: 'gp_transfer_disabled' });

    const minAmt = parseFloat(minRow.rows[0]?.value || '1');
    const maxAmt = parseFloat(maxRow.rows[0]?.value || '10000');
    const dayLimit = parseFloat(limitRow.rows[0]?.value || '50000');
    const feePct = parseFloat(feeRow.rows[0]?.value || '0');

    if (amount < minAmt) return res.status(400).json({ error: 'amount_too_small', min: minAmt });
    if (amount > maxAmt) return res.status(400).json({ error: 'amount_too_large', max: maxAmt });

    const recipRes = await pool.query(
      'SELECT wallet_address, nickname FROM users WHERE LOWER(wallet_address) = LOWER($1)',
      [toWallet]
    );
    if (!recipRes.rows.length) return res.status(400).json({ error: 'recipient_not_found' });
    const recipNick = recipRes.rows[0].nickname || toWallet.slice(0, 8) + '…';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const senderRes = await client.query(
        'SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE',
        [fromWallet]
      );
      if (!senderRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'sender_not_found' });
      }

      const dayRes = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS sent_today
           FROM gp_transfers
          WHERE LOWER(from_wallet) = LOWER($1) AND created_at >= CURRENT_DATE`,
        [fromWallet]
      );
      const sentToday = parseFloat(dayRes.rows[0].sent_today) || 0;
      if (sentToday + amount > dayLimit) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'daily_limit_exceeded',
          remaining: Math.max(0, dayLimit - sentToday),
          limit: dayLimit
        });
      }

      const senderGP = parseFloat(senderRes.rows[0].gp_balance) || 0;
      if (senderGP < amount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'insufficient_gp', balance: senderGP });
      }

      const fee = Math.floor(amount * feePct / 100 * 1000000) / 1000000;
      const received = amount - fee;

      const deductTransfer = await client.query(
        'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1',
        [amount, fromWallet]
      );
      if (deductTransfer.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient balance (concurrent modification)' });
      }

      await client.query(
        'UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)',
        [received, toWallet]
      );

      await client.query(
        'INSERT INTO gp_transfers (from_wallet, to_wallet, amount, note) VALUES ($1, $2, $3, $4)',
        [fromWallet, toWallet, amount, note || null]
      );

      await client.query('COMMIT');

      try {
        const { logGPActivity, notifyPlayer } = require('../db');
        logGPActivity(fromWallet, -amount, 'gp_transfer_out', `→ ${recipNick}`).catch(() => {});
        logGPActivity(toWallet, received, 'gp_transfer_in', `← ${fromWallet.slice(0, 8)}…`).catch(() => {});
        notifyPlayer(
          toWallet,
          'gp_received',
          `You received ${received} GP from ${fromWallet.slice(0, 8)}…`,
          { amount: received }
        ).catch(() => {});
      } catch (_le) {}

      res.json({
        success: true,
        sent: amount,
        fee,
        received,
        to: toWallet,
        toNick: recipNick,
      });

      if (newsSvc) newsSvc.onBigTransfer(fromWallet, toWallet, amount).catch(() => {});
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[GP TRANSFER] error:', err.message);
      res.status(500).json({ error: 'internal_error' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[GP TRANSFER] outer error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/gp/transfers', readLimiter, async (req, res) => {
  const wallet = (req.headers['x-wallet'] || req.query.wallet || '').toLowerCase().trim();
  if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet_required' });

  try {
    const result = await pool.query(
      `SELECT t.*,
              uf.nickname AS from_nick,
              ut.nickname AS to_nick
         FROM gp_transfers t
         LEFT JOIN users uf ON uf.wallet_address = t.from_wallet
         LEFT JOIN users ut ON ut.wallet_address = t.to_wallet
        WHERE t.from_wallet = $1 OR t.to_wallet = $1
        ORDER BY t.created_at DESC
        LIMIT 30`,
      [wallet]
    );
    res.json({ transfers: result.rows });
  } catch (err) {
    console.error('[GP TRANSFER] transfers list error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
