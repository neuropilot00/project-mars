const express = require('express');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool, getSetting } = require('../db');
const { requireAuth, getAuthWallet } = require('../utils/apiHelpers');

const router = express.Router();

const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000, max: 120,
  message: { error: 'Too many requests. Please slow down.' }
});
const writeLimiter = makeRateLimiter({
  windowMs: 60 * 1000, max: 30,
  message: { error: 'Too many write requests. Please wait.' }
});

router.post('/exchange/pp-to-gp', requireAuth, writeLimiter, async (req, res) => {
  const { amount } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || !amount) return res.status(400).json({ error: 'Missing wallet or amount' });

  const ppAmount = Number(amount);
  if (!Number.isFinite(ppAmount) || ppAmount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  const client = await pool.connect();
  try {
    const enabledVal = await getSetting('pp_to_gp_exchange_enabled');
    if (enabledVal !== true && enabledVal !== 'true') return res.status(400).json({ error: 'PP→GP exchange is currently disabled' });

    const minPP = parseFloat(await getSetting('pp_to_gp_exchange_min') || '0.1');
    const maxPP = parseFloat(await getSetting('pp_to_gp_exchange_max') || '5');
    const rate = parseFloat(await getSetting('pp_to_gp_exchange_rate') || '10');
    const feePct = parseFloat(await getSetting('pp_to_gp_exchange_fee_pct') || '5');
    const dailyLimit = parseFloat(await getSetting('pp_to_gp_exchange_daily_limit') || '50');
    if (!(rate > 0) || !isFinite(rate)) return res.status(500).json({ error: 'Exchange rate misconfigured' });
    if (!(feePct >= 0) || !isFinite(feePct) || feePct >= 100) return res.status(500).json({ error: 'Exchange fee misconfigured' });

    if (ppAmount < minPP) return res.status(400).json({ error: `Minimum ${minPP} PP` });
    if (ppAmount > maxPP) return res.status(400).json({ error: `Maximum ${maxPP} PP per transaction` });

    await client.query('BEGIN');

    const { rows: [dailyRow] } = await client.query(
      `SELECT COALESCE(SUM(pp_amount), 0) as total
       FROM transactions WHERE LOWER(from_wallet)=LOWER($1) AND type='pp_to_gp_exchange'
       AND created_at > NOW() - INTERVAL '24 hours'`, [w]
    );
    const dailyUsed = parseFloat(dailyRow.total || 0);
    if (dailyUsed + ppAmount > dailyLimit) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Daily limit: ${dailyLimit} PP (used: ${dailyUsed.toFixed(2)})` });
    }

    const { rows: [user] } = await client.query('SELECT pp_balance FROM users WHERE wallet_address=$1 FOR UPDATE', [w]);
    if (!user || parseFloat(user.pp_balance) < ppAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient PP' });
    }

    const fee = ppAmount * (feePct / 100);
    const netPP = ppAmount - fee;
    const gpReceived = Math.floor(netPP * rate);

    const deductExchange = await client.query(
      'UPDATE users SET pp_balance = pp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND pp_balance >= $1',
      [ppAmount, w]
    );
    if (deductExchange.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance (concurrent modification)' });
    }
    await client.query('UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address)=LOWER($2)', [gpReceived, w]);

    await client.query(
      `INSERT INTO transactions (from_wallet, type, pp_amount, meta) VALUES ($1, 'pp_to_gp_exchange', $2, $3)`,
      [w, ppAmount, JSON.stringify({ pp_amount: ppAmount, fee: fee, rate: rate, gp_received: gpReceived })]
    );

    await client.query('COMMIT');

    const { rows: [bal] } = await client.query('SELECT pp_balance, gp_balance FROM users WHERE wallet_address=$1', [w]);

    res.json({
      ok: true,
      ppSpent: ppAmount,
      fee: fee,
      gpReceived: gpReceived,
      ppBalance: parseFloat(bal.pp_balance),
      gpBalance: parseFloat(bal.gp_balance)
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.get('/exchange/pp-to-gp/info', readLimiter, async (req, res) => {
  try {
    const rate = parseFloat(await getSetting('pp_to_gp_exchange_rate') || '10');
    const min = parseFloat(await getSetting('pp_to_gp_exchange_min') || '0.1');
    const max = parseFloat(await getSetting('pp_to_gp_exchange_max') || '5');
    const fee = parseFloat(await getSetting('pp_to_gp_exchange_fee_pct') || '5');
    const daily = parseFloat(await getSetting('pp_to_gp_exchange_daily_limit') || '50');
    const enabledVal = await getSetting('pp_to_gp_exchange_enabled');
    const enabled = enabledVal === true || enabledVal === 'true';
    res.json({ rate, min, max, fee, dailyLimit: daily, enabled });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
