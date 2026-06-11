const express = require('express');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool } = require('../db');

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

router.get('/leaderboard', readLimiter, async (req, res) => {
  try {
    const allowedSorts = ['claims', 'volume', 'pixels'];
    const sort = allowedSorts.includes(req.query.sort) ? req.query.sort : 'claims';
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));

    let orderBy;
    switch (sort) {
      case 'volume': orderBy = 'total_volume DESC'; break;
      case 'pixels': orderBy = 'pixel_count DESC'; break;
      case 'claims':
      default: orderBy = 'claim_count DESC'; break;
    }

    const result = await pool.query(
      `SELECT
         u.wallet_address,
         u.nickname,
         COUNT(DISTINCT c.id) AS claim_count,
         COALESCE(SUM(c.total_paid), 0) AS total_volume,
         COALESCE(p.pxs, 0) AS pixel_count
       FROM users u
       LEFT JOIN claims c ON c.owner = u.wallet_address AND c.deleted_at IS NULL
       LEFT JOIN (SELECT owner, COUNT(*) AS pxs FROM pixels WHERE owner IS NOT NULL GROUP BY owner) p
              ON p.owner = u.wallet_address
       GROUP BY u.wallet_address, u.nickname, p.pxs
       HAVING COUNT(DISTINCT c.id) > 0 OR COALESCE(p.pxs, 0) > 0
       ORDER BY ${orderBy}
       LIMIT $1`,
      [limit]
    );

    res.json(result.rows.map((row, index) => ({
      rank: index + 1,
      nickname: row.nickname || null,
      wallet: `${row.wallet_address.slice(0, 6)}...${row.wallet_address.slice(-4)}`,
      claimCount: parseInt(row.claim_count),
      totalVolume: parseFloat(row.total_volume),
      pixelCount: parseInt(row.pixel_count),
    })));
  } catch (err) {
    console.error('[API] leaderboard error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/stats', async (_req, res) => {
  try {
    const [usersRes, claimsRes, volumeRes, pixelsRes, activeRes, hijacksRes] = await Promise.all([
      pool.query('SELECT COUNT(*) AS cnt FROM users'),
      pool.query('SELECT COUNT(*) AS cnt FROM claims WHERE deleted_at IS NULL'),
      pool.query('SELECT COALESCE(SUM(total_paid), 0) AS total FROM claims WHERE deleted_at IS NULL'),
      pool.query('SELECT COUNT(*) AS cnt FROM pixels WHERE owner IS NOT NULL'),
      pool.query(
        `SELECT COUNT(DISTINCT owner) AS cnt FROM claims
         WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL '24 hours'`
      ),
      pool.query(
        `SELECT COUNT(*) AS cnt FROM transactions
         WHERE type = 'hijack' AND created_at >= NOW() - INTERVAL '1 hour'`
      ),
    ]);

    let totalPixelsCapacity = 0;
    try {
      const capRes = await pool.query('SELECT COALESCE(SUM(total_pixels),0) AS cap FROM sectors');
      totalPixelsCapacity = parseInt(capRes.rows[0].cap) || 0;
    } catch (_err) {}

    res.json({
      totalUsers: parseInt(usersRes.rows[0].cnt),
      totalClaims: parseInt(claimsRes.rows[0].cnt),
      totalVolume: parseFloat(volumeRes.rows[0].total),
      totalPixels: totalPixelsCapacity,
      totalPixelsSold: parseInt(pixelsRes.rows[0].cnt),
      activeUsers24h: parseInt(activeRes.rows[0].cnt),
      hijacksPerHour: parseInt(hijacksRes.rows[0].cnt),
    });
  } catch (err) {
    console.error('[API] stats error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/error-report', writeLimiter, async (req, res) => {
  try {
    const { message, source, line, stack, userAgent, url } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    const trunc = (val, max = 1000) => {
      if (!val || typeof val !== 'string') return null;
      return val.slice(0, max);
    };

    const safeMessage = trunc(message, 1000);
    const safeSource = trunc(source, 1000);
    const safeLine = Number.isInteger(line) ? line : null;
    const safeStack = trunc(stack, 2000);
    const safeUserAgent = trunc(userAgent, 500);
    const safeUrl = trunc(url, 1000);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    console.error(`[CLIENT_ERROR] ${safeMessage} | source=${safeSource || 'N/A'} line=${safeLine || 'N/A'} | url=${safeUrl || 'N/A'}`);

    await pool.query(
      `INSERT INTO client_errors (message, source, line, stack, user_agent, url, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [safeMessage, safeSource, safeLine, safeStack, safeUserAgent, safeUrl, ip]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[API] error-report save failed:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/ranks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rank_definitions ORDER BY level');
    const wallet = req.query.wallet ? req.query.wallet.toLowerCase() : null;

    let userBreakthroughs = [];
    if (wallet) {
      const btRes = await pool.query('SELECT level FROM user_breakthroughs WHERE wallet_address = $1', [wallet]);
      userBreakthroughs = btRes.rows.map((row) => row.level);
    }

    res.json(result.rows.map((row) => {
      const item = {
        level: row.level,
        name: row.name,
        requiredXp: row.required_xp,
        rewardPp: parseFloat(row.reward_pp),
      };
      if (row.breakthrough) {
        item.breakthrough = true;
        item.breakthroughLabel = row.breakthrough_condition?.label || '';
        item.breakthroughDesc = row.breakthrough_condition?.desc || '';
        if (wallet) item.breakthroughUnlocked = userBreakthroughs.includes(row.level);
      }
      return item;
    }));
  } catch (err) {
    console.error('[API] ranks error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/breakthrough/:wallet', readLimiter, async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const userRes = await pool.query('SELECT rank_level, xp, created_at FROM users WHERE wallet_address = $1', [wallet]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });

    const user = userRes.rows[0];
    const gateRes = await pool.query(
      'SELECT level, name, required_xp, breakthrough_condition FROM rank_definitions WHERE breakthrough = true AND level > $1 ORDER BY level ASC LIMIT 1',
      [user.rank_level]
    );

    if (!gateRes.rows.length) return res.json({ nextGate: null, message: 'All breakthroughs cleared!' });

    const gate = gateRes.rows[0];
    const cond = gate.breakthrough_condition;
    const conditions = cond.conditions || [cond];

    const progress = [];
    for (const condition of conditions) {
      let current = 0;
      const target = condition.min || 0;
      let label = condition.type;

      if (condition.type === 'pixels') {
        const result = await pool.query('SELECT COUNT(*) AS cnt FROM pixels WHERE owner = $1', [wallet]);
        current = parseInt(result.rows[0].cnt);
        label = 'Pixels owned';
      } else if (condition.type === 'sectors') {
        const result = await pool.query('SELECT COUNT(DISTINCT sector_id) AS cnt FROM pixels WHERE owner = $1', [wallet]);
        current = parseInt(result.rows[0].cnt);
        label = 'Sectors';
      } else if (condition.type === 'quests') {
        const result = await pool.query("SELECT COUNT(*) AS cnt FROM user_quests WHERE wallet = $1 AND status = 'claimed'", [wallet]);
        current = parseInt(result.rows[0].cnt);
        label = 'Quests completed';
      } else if (condition.type === 'deposit') {
        const result = await pool.query('SELECT COALESCE(SUM(amount),0) AS total FROM deposits WHERE wallet_address = $1', [wallet]);
        current = parseFloat(result.rows[0].total);
        label = 'USDT deposited';
      } else if (condition.type === 'play_days') {
        current = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));
        label = 'Days played';
      } else if (condition.type === 'hijacks') {
        const result = await pool.query("SELECT COUNT(*) AS cnt FROM transactions WHERE from_wallet = $1 AND type = 'hijack'", [wallet]);
        current = parseInt(result.rows[0].cnt);
        label = 'Hijacks';
      } else if (condition.type === 'games_played') {
        const result = await pool.query("SELECT (SELECT COUNT(*) FROM crash_bets WHERE wallet = $1) + (SELECT COUNT(*) FROM mines_games WHERE wallet = $1) AS cnt", [wallet]);
        current = parseInt(result.rows[0].cnt);
        label = 'Games played';
      } else if (condition.type === 'referrals') {
        const result = await pool.query('SELECT COUNT(*) AS cnt FROM users WHERE referred_by = (SELECT referral_code FROM users WHERE wallet_address = $1)', [wallet]);
        current = parseInt(result.rows[0].cnt);
        label = 'Referrals';
      }

      progress.push({ type: condition.type, label, current, target, done: current >= target });
    }

    res.json({
      nextGate: { level: gate.level, name: gate.name, title: cond.label, requiredXp: gate.required_xp },
      progress,
      allMet: progress.every((item) => item.done),
    });
  } catch (err) {
    console.error('[API] breakthrough error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
