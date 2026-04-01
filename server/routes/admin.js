const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

// ── Security checks ──
const isProduction = process.env.NODE_ENV === 'production';
if (!process.env.ADMIN_SECRET) {
  if (isProduction) {
    throw new Error('[FATAL] ADMIN_SECRET is not set. Cannot start admin module in production.');
  }
  console.warn('[SECURITY] ADMIN_SECRET is not set — using default. Set a strong secret in production!');
}
if (isProduction && process.env.ADMIN_SECRET === 'admin1234') {
  throw new Error('[FATAL] ADMIN_SECRET is set to the insecure default "admin1234". Cannot start in production.');
}

// ── Admin auth middleware ──
function adminAuth(req, res, next) {
  // Method 1: x-admin-secret header
  const secret = req.headers['x-admin-secret'];
  const adminSecret = process.env.ADMIN_SECRET || (isProduction ? '' : 'admin1234');
  if (secret && adminSecret && secret === adminSecret) {
    req.adminAuth = 'secret';
    return next();
  }
  // Method 2: JWT Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
      if (decoded.role === 'admin') { req.adminAuth = 'jwt'; return next(); }
    } catch(e) {}
  }
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Audit log helper ──
async function auditLog(req, action, target, details) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await pool.query(
      'INSERT INTO admin_audit_log (action, target, details, admin_auth, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [action, target, details ? JSON.stringify(details) : null, req.adminAuth || 'unknown', ip]
    );
  } catch(e) { console.error('[Audit] log error:', e.message); }
}

// ── Admin login (no auth required) ──
router.post('/login', async (req, res) => {
  const { password } = req.body;
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return res.status(500).json({ error: 'Admin not configured' });
  if (password !== adminSecret) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ role: 'admin', iat: Date.now() }, process.env.JWT_SECRET, { expiresIn: '4h' });
  res.json({ success: true, token });
});

// Apply auth middleware to all routes below
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
      where = 'WHERE LOWER(wallet_address) LIKE $1 OR LOWER(email) LIKE $1 OR LOWER(nickname) LIKE $1';
      params.push(`%${search}%`);
    }

    const countRes = await pool.query(`SELECT COUNT(*) as cnt FROM users ${where}`, params);
    const total = parseInt(countRes.rows[0].cnt);

    const usersRes = await pool.query(
      `SELECT u.wallet_address, u.email, u.nickname, u.usdt_balance, u.pp_balance, u.created_at,
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
        email: r.email || '',
        nickname: r.nickname || '',
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
//  GET /admin/api/users/:wallet — User detail
// ══════════════════════════════════════════════════
router.get('/users/:wallet', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT wallet_address, email, nickname, usdt_balance, pp_balance, referral_code, referred_by, created_at
       FROM users WHERE wallet_address = $1`,
      [req.params.wallet]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({
      wallet: u.wallet_address, email: u.email || '', nickname: u.nickname || '',
      usdtBalance: parseFloat(u.usdt_balance), ppBalance: parseFloat(u.pp_balance),
      referralCode: u.referral_code || '', referredBy: u.referred_by || '',
      createdAt: u.created_at
    });
  } catch (e) {
    console.error('[Admin] user detail error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  PUT /admin/api/users/:wallet — Update user info
// ══════════════════════════════════════════════════
router.put('/users/:wallet', async (req, res) => {
  const { email, nickname, newPassword, usdtBalance, ppBalance } = req.body;
  try {
    const updates = [];
    const params = [];
    let idx = 1;

    if (email !== undefined) { updates.push(`email = $${idx++}`); params.push(email.toLowerCase()); }
    if (nickname !== undefined) { updates.push(`nickname = $${idx++}`); params.push(nickname); }
    if (newPassword) {
      const hash = await bcrypt.hash(newPassword, 10);
      updates.push(`password_hash = $${idx++}`); params.push(hash);
    }
    if (usdtBalance !== undefined) { updates.push(`usdt_balance = $${idx++}`); params.push(usdtBalance); }
    if (ppBalance !== undefined) { updates.push(`pp_balance = $${idx++}`); params.push(ppBalance); }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

    params.push(req.params.wallet);
    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE wallet_address = $${idx}`,
      params
    );
    const fieldsUpdated = {};
    if (email !== undefined) fieldsUpdated.email = true;
    if (nickname !== undefined) fieldsUpdated.nickname = true;
    if (newPassword) fieldsUpdated.password = true;
    if (usdtBalance !== undefined) fieldsUpdated.usdtBalance = usdtBalance;
    if (ppBalance !== undefined) fieldsUpdated.ppBalance = ppBalance;

    await auditLog(req, 'user_update', req.params.wallet, { fieldsUpdated });
    console.log(`[Admin] Updated user ${req.params.wallet}: ${updates.join(', ')}`);
    res.json({ success: true });
  } catch (e) {
    console.error('[Admin] user update error:', e.message);
    res.status(500).json({ error: 'Update failed' });
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

// ══════════════════════════════════════════════════
//  GET /admin/api/settings — All game settings
// ══════════════════════════════════════════════════
router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings ORDER BY category, key');
    res.json(result.rows.map(r => ({
      key: r.key, value: r.value, description: r.description,
      category: r.category, updatedAt: r.updated_at
    })));
  } catch (e) {
    console.error('[Admin] settings error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  PUT /admin/api/settings/:key — Update setting
// ══════════════════════════════════════════════════
router.put('/settings/:key', async (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: 'Missing value' });

    const result = await pool.query(
      'UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *',
      [JSON.stringify(value), req.params.key]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Setting not found' });

    await auditLog(req, 'setting_update', req.params.key, { value });
    console.log(`[Admin] Setting updated: ${req.params.key} = ${JSON.stringify(value)}`);
    res.json({ success: true, key: req.params.key, value });
  } catch (e) {
    console.error('[Admin] setting update error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/events — All events
// ══════════════════════════════════════════════════
router.get('/events', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM events ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows.map(r => ({
      id: r.id, name: r.name, type: r.type, config: r.config,
      startsAt: r.starts_at, endsAt: r.ends_at, active: r.active,
      createdAt: r.created_at
    })));
  } catch (e) {
    console.error('[Admin] events error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  POST /admin/api/events — Create event
// ══════════════════════════════════════════════════
router.post('/events', async (req, res) => {
  try {
    const { name, type, config, startsAt, endsAt } = req.body;
    if (!name || !type || !startsAt || !endsAt) {
      return res.status(400).json({ error: 'Missing fields: name, type, startsAt, endsAt' });
    }

    const result = await pool.query(
      `INSERT INTO events (name, type, config, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, type, config || {}, startsAt, endsAt]
    );

    await auditLog(req, 'event_create', result.rows[0].id?.toString(), { name, type });
    console.log(`[Admin] Event created: ${name} (${type})`);
    res.json({ success: true, event: result.rows[0] });
  } catch (e) {
    console.error('[Admin] event create error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  PUT /admin/api/events/:id — Update event
// ══════════════════════════════════════════════════
router.put('/events/:id', async (req, res) => {
  try {
    const { name, type, config, startsAt, endsAt, active } = req.body;
    const result = await pool.query(
      `UPDATE events SET
        name = COALESCE($1, name), type = COALESCE($2, type),
        config = COALESCE($3, config),
        starts_at = COALESCE($4, starts_at), ends_at = COALESCE($5, ends_at),
        active = COALESCE($6, active)
       WHERE id = $7 RETURNING *`,
      [name, type, config ? JSON.stringify(config) : null, startsAt, endsAt, active, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true, event: result.rows[0] });
  } catch (e) {
    console.error('[Admin] event update error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  DELETE /admin/api/events/:id — Delete event
// ══════════════════════════════════════════════════
router.delete('/events/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM events WHERE id = $1', [req.params.id]);
    await auditLog(req, 'event_delete', req.params.id, null);
    res.json({ success: true });
  } catch (e) {
    console.error('[Admin] event delete error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/items — Game items
// ══════════════════════════════════════════════════
router.get('/items', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM game_items ORDER BY category, name');
    res.json(result.rows);
  } catch (e) {
    console.error('[Admin] items error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  POST /admin/api/items — Create game item
// ══════════════════════════════════════════════════
router.post('/items', async (req, res) => {
  try {
    const { slug, name, category, priceUsdt, pricePp, config } = req.body;
    if (!slug || !name || !category) return res.status(400).json({ error: 'Missing fields' });

    const result = await pool.query(
      `INSERT INTO game_items (slug, name, category, price_usdt, price_pp, config)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [slug, name, category, priceUsdt || 0, pricePp || 0, config || {}]
    );
    res.json({ success: true, item: result.rows[0] });
  } catch (e) {
    console.error('[Admin] item create error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════
//  PUT /admin/api/items/:id — Update game item
// ══════════════════════════════════════════════════
router.put('/items/:id', async (req, res) => {
  try {
    const { name, priceUsdt, pricePp, config, active } = req.body;
    const result = await pool.query(
      `UPDATE game_items SET
        name = COALESCE($1, name), price_usdt = COALESCE($2, price_usdt),
        price_pp = COALESCE($3, price_pp), config = COALESCE($4, config),
        active = COALESCE($5, active), updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [name, priceUsdt, pricePp, config ? JSON.stringify(config) : null, active, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true, item: result.rows[0] });
  } catch (e) {
    console.error('[Admin] item update error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/referrals — Referral stats
// ══════════════════════════════════════════════════
router.get('/referrals', async (req, res) => {
  try {
    const [totalRefs, totalRewards, topReferrers, recentRewards] = await Promise.all([
      pool.query('SELECT COUNT(*) as cnt FROM users WHERE referred_by IS NOT NULL'),
      pool.query('SELECT COALESCE(SUM(pp_amount), 0) as total, COUNT(*) as cnt FROM referral_rewards'),
      pool.query(`
        SELECT to_wallet, COUNT(*) as reward_count, SUM(pp_amount) as total_earned,
          (SELECT COUNT(*) FROM users WHERE referred_by = rr.to_wallet) as referral_count
        FROM referral_rewards rr
        GROUP BY to_wallet ORDER BY total_earned DESC LIMIT 10
      `),
      pool.query(`
        SELECT from_wallet, to_wallet, tier, pp_amount, trigger_type, created_at
        FROM referral_rewards ORDER BY created_at DESC LIMIT 20
      `)
    ]);

    // Tier breakdown
    const tierBreakdown = await pool.query(`
      SELECT tier, COUNT(*) as cnt, COALESCE(SUM(pp_amount), 0) as total
      FROM referral_rewards GROUP BY tier ORDER BY tier
    `);

    res.json({
      totalReferrals: parseInt(totalRefs.rows[0].cnt),
      totalRewardsDistributed: parseFloat(totalRewards.rows[0].total),
      totalRewardTxCount: parseInt(totalRewards.rows[0].cnt),
      tierBreakdown: tierBreakdown.rows.map(r => ({
        tier: r.tier, count: parseInt(r.cnt), total: parseFloat(r.total)
      })),
      topReferrers: topReferrers.rows.map(r => ({
        wallet: r.to_wallet,
        rewardCount: parseInt(r.reward_count),
        totalEarned: parseFloat(r.total_earned),
        referralCount: parseInt(r.referral_count)
      })),
      recentRewards: recentRewards.rows.map(r => ({
        from: r.from_wallet, to: r.to_wallet,
        tier: r.tier, ppAmount: parseFloat(r.pp_amount),
        triggerType: r.trigger_type,
        createdAt: r.created_at
      }))
    });
  } catch (e) {
    console.error('[Admin] referrals error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/errors — Client error log (paginated)
// ══════════════════════════════════════════════════
router.get('/errors', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = Math.max(0, parseInt(req.query.offset) || 0);

    const countRes = await pool.query('SELECT COUNT(*) as cnt FROM client_errors');
    const total = parseInt(countRes.rows[0].cnt);

    const result = await pool.query(
      `SELECT id, message, source, line, stack, user_agent, url, ip_address, created_at
       FROM client_errors
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      errors: result.rows.map(r => ({
        id: r.id,
        message: r.message,
        source: r.source,
        line: r.line,
        stack: r.stack,
        userAgent: r.user_agent,
        url: r.url,
        ip: r.ip_address,
        createdAt: r.created_at
      })),
      total, limit, offset
    });
  } catch (e) {
    console.error('[Admin] errors list error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  DELETE /admin/api/errors — Clear all client errors
// ══════════════════════════════════════════════════
router.delete('/errors', async (req, res) => {
  try {
    await pool.query('DELETE FROM client_errors');
    console.log('[Admin] All client errors cleared');
    res.json({ success: true });
  } catch (e) {
    console.error('[Admin] clear errors error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
