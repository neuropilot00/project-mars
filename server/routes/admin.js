const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// ── Admin auth middleware ──
function adminAuth(req, res, next) {
  const secret = req.headers['x-admin-secret'] || req.query.secret;
  if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(adminAuth);

// ══════════════════════════════════════════════════
//  GET /admin/api/stats — Dashboard overview
// ══════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
  try {
    const [users, volume, revenue, active24h, totalClaims, totalPixels] = await Promise.all([
      pool.query('SELECT COUNT(*) as cnt FROM users'),
      pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM deposits'),
      pool.query("SELECT COALESCE(SUM(fee), 0) as total FROM transactions WHERE fee > 0"),
      pool.query("SELECT COUNT(*) as cnt FROM deposits WHERE created_at > NOW() - INTERVAL '24 hours'"),
      pool.query('SELECT COUNT(*) as cnt FROM claims WHERE deleted_at IS NULL'),
      pool.query('SELECT COUNT(*) as cnt FROM pixels WHERE owner IS NOT NULL'),
    ]);

    // Revenue breakdown
    const revBreakdown = await pool.query(`
      SELECT type,
        COALESCE(SUM(fee), 0) as fee_total,
        COALESCE(SUM(usdt_amount), 0) as volume_total,
        COUNT(*) as tx_count
      FROM transactions
      GROUP BY type
    `);

    // Contract balance (sum deposits - sum withdrawals)
    const balRes = await pool.query(`
      SELECT
        (SELECT COALESCE(SUM(amount),0) FROM deposits) -
        (SELECT COALESCE(SUM(usdt_amount),0) FROM transactions WHERE type IN ('withdraw','withdraw_all'))
        as contract_balance
    `);

    res.json({
      totalUsers: parseInt(users.rows[0].cnt),
      totalVolume: parseFloat(volume.rows[0].total),
      totalRevenue: parseFloat(revenue.rows[0].total),
      active24h: parseInt(active24h.rows[0].cnt),
      totalClaims: parseInt(totalClaims.rows[0].cnt),
      totalPixelsSold: parseInt(totalPixels.rows[0].cnt),
      contractBalance: parseFloat(balRes.rows[0].contract_balance),
      breakdown: revBreakdown.rows.map(r => ({
        type: r.type,
        feeTotal: parseFloat(r.fee_total),
        volumeTotal: parseFloat(r.volume_total),
        txCount: parseInt(r.tx_count)
      }))
    });
  } catch (e) {
    console.error('[Admin] stats error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/users — User list (paginated)
// ══════════════════════════════════════════════════
router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').toLowerCase();
    const sort = req.query.sort || 'created_at';
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

    const validSorts = ['created_at', 'usdt_balance', 'pp_balance', 'wallet_address'];
    const sortCol = validSorts.includes(sort) ? sort : 'created_at';

    let where = '';
    const params = [];
    if (search) {
      where = 'WHERE LOWER(wallet_address) LIKE $1';
      params.push(`%${search}%`);
    }

    const countRes = await pool.query(`SELECT COUNT(*) as cnt FROM users ${where}`, params);
    const total = parseInt(countRes.rows[0].cnt);

    const usersRes = await pool.query(
      `SELECT u.wallet_address, u.usdt_balance, u.pp_balance, u.created_at,
        (SELECT COUNT(*) FROM claims c WHERE c.owner = u.wallet_address AND c.deleted_at IS NULL) as claim_count,
        (SELECT COALESCE(SUM(amount),0) FROM deposits d WHERE d.wallet_address = u.wallet_address) as total_deposited
       FROM users u ${where}
       ORDER BY ${sortCol} ${order}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      users: usersRes.rows.map(r => ({
        wallet: r.wallet_address,
        usdtBalance: parseFloat(r.usdt_balance),
        ppBalance: parseFloat(r.pp_balance),
        claimCount: parseInt(r.claim_count),
        totalDeposited: parseFloat(r.total_deposited),
        createdAt: r.created_at
      })),
      total, page, limit,
      pages: Math.ceil(total / limit)
    });
  } catch (e) {
    console.error('[Admin] users error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/transactions — Transaction log
// ══════════════════════════════════════════════════
router.get('/transactions', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 30);
    const offset = (page - 1) * limit;
    const type = req.query.type;

    let where = '';
    const params = [];
    if (type && ['deposit', 'claim', 'hijack', 'swap', 'withdraw', 'withdraw_all'].includes(type)) {
      where = 'WHERE type = $1';
      params.push(type);
    }

    const countRes = await pool.query(`SELECT COUNT(*) as cnt FROM transactions ${where}`, params);
    const total = parseInt(countRes.rows[0].cnt);

    const txRes = await pool.query(
      `SELECT * FROM transactions ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      transactions: txRes.rows.map(r => ({
        id: r.id, type: r.type,
        fromWallet: r.from_wallet, toWallet: r.to_wallet,
        usdtAmount: parseFloat(r.usdt_amount),
        ppAmount: parseFloat(r.pp_amount),
        fee: parseFloat(r.fee),
        meta: r.meta,
        createdAt: r.created_at
      })),
      total, page, limit,
      pages: Math.ceil(total / limit)
    });
  } catch (e) {
    console.error('[Admin] transactions error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/revenue — Revenue over time
// ══════════════════════════════════════════════════
router.get('/revenue', async (req, res) => {
  try {
    const days = Math.min(90, parseInt(req.query.days) || 30);

    const daily = await pool.query(`
      SELECT DATE(created_at) as day,
        SUM(CASE WHEN type = 'claim' THEN fee ELSE 0 END) as claim_rev,
        SUM(CASE WHEN type = 'hijack' THEN fee ELSE 0 END) as hijack_rev,
        SUM(CASE WHEN type = 'swap' THEN fee ELSE 0 END) as swap_rev,
        SUM(CASE WHEN type IN ('withdraw','withdraw_all') THEN fee ELSE 0 END) as withdraw_rev,
        SUM(fee) as total_rev,
        COUNT(*) as tx_count
      FROM transactions
      WHERE created_at > NOW() - INTERVAL '1 day' * $1
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `, [days]);

    res.json({
      days: daily.rows.map(r => ({
        date: r.day,
        claimRevenue: parseFloat(r.claim_rev),
        hijackRevenue: parseFloat(r.hijack_rev),
        swapRevenue: parseFloat(r.swap_rev),
        withdrawRevenue: parseFloat(r.withdraw_rev),
        totalRevenue: parseFloat(r.total_rev),
        txCount: parseInt(r.tx_count)
      }))
    });
  } catch (e) {
    console.error('[Admin] revenue error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
