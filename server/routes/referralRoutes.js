const express = require('express');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool, ensureUser, generateReferralCode } = require('../db');
const { requireAuth, getAuthWallet } = require('../utils/apiHelpers');

let seasonService;
try { seasonService = require('../services/season'); } catch (_e) { /* season service not available */ }
let achSvc;
try { achSvc = require('../services/achievements'); } catch (_e) { /* achievements service not available */ }

const router = express.Router();

const writeLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many write requests. Please wait.' },
});

router.post('/referral/register', requireAuth, writeLimiter, async (req, res) => {
  const { referralCode } = req.body;
  const wallet = getAuthWallet(req);
  if (!wallet || !referralCode) return res.status(400).json({ error: 'Missing wallet or referralCode' });

  try {
    const walletLower = wallet.toLowerCase();
    await ensureUser(pool, walletLower);

    const userRes = await pool.query('SELECT referred_by FROM users WHERE wallet_address = $1', [walletLower]);
    if (userRes.rows[0].referred_by) {
      return res.status(400).json({ error: 'Already has a referrer' });
    }

    const refRes = await pool.query('SELECT wallet_address FROM users WHERE referral_code = $1', [referralCode.toUpperCase()]);
    if (!refRes.rows.length) return res.status(404).json({ error: 'Invalid referral code' });

    const referrer = refRes.rows[0].wallet_address;
    if (referrer === walletLower) return res.status(400).json({ error: 'Cannot refer yourself' });

    await pool.query('UPDATE users SET referred_by = $1 WHERE wallet_address = $2', [referrer, walletLower]);

    res.json({ success: true, referrer: referrer.slice(0, 6) + '...' + referrer.slice(-4) });
    if (seasonService) seasonService.addSeasonScore(walletLower, 'referral', 1).catch(() => {});
    if (achSvc) achSvc.checkAndUnlock(referrer, 'referral_count').catch(() => {});
  } catch (err) {
    console.error('[API] referral register error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/referral/stats/:wallet', async (req, res) => {
  try {
    const wallet = String(req.params.wallet || '').toLowerCase().trim();
    if (!wallet) return res.status(400).json({ error: 'wallet_required' });

    const tier1Rows = await pool.query('SELECT wallet_address FROM users WHERE LOWER(referred_by)=LOWER($1)', [wallet]);
    const tier1Wallets = tier1Rows.rows.map((row) => row.wallet_address);
    let tier2 = 0;
    let tier3 = 0;
    let tier2Wallets = [];

    if (tier1Wallets.length) {
      const tier2Rows = await pool.query('SELECT wallet_address FROM users WHERE referred_by = ANY($1::text[])', [tier1Wallets]);
      tier2 = tier2Rows.rowCount;
      tier2Wallets = tier2Rows.rows.map((row) => row.wallet_address);
    }

    if (tier2Wallets.length) {
      const tier3Rows = await pool.query('SELECT COUNT(*)::int AS c FROM users WHERE referred_by = ANY($1::text[])', [tier2Wallets]);
      tier3 = tier3Rows.rows[0] ? tier3Rows.rows[0].c : 0;
    }

    const tier1 = tier1Rows.rowCount;
    res.json({ tier1, tier2, tier3, total: tier1 + tier2 + tier3 });
  } catch (err) {
    console.error('[referral/stats]', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/referral/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const userRes = await pool.query(
      `SELECT u.referral_code, u.referred_by, r.nickname AS referred_by_nickname
         FROM users u
         LEFT JOIN users r ON r.wallet_address = u.referred_by
        WHERE u.wallet_address = $1`,
      [wallet]
    );
    if (!userRes.rows.length) {
      return res.json({ code: null, referredBy: null, referredByNickname: null, referrals: 0, totalEarned: 0 });
    }

    let code = userRes.rows[0].referral_code;
    if (!code) {
      code = generateReferralCode();
      await pool.query('UPDATE users SET referral_code = $1 WHERE wallet_address = $2', [code, wallet]);
    }

    const refCount = await pool.query('SELECT COUNT(*) as cnt FROM users WHERE referred_by = $1', [wallet]);
    const earned = await pool.query(
      `SELECT
         COALESCE(SUM(pp_amount) FILTER (WHERE COALESCE(currency,'pp') != 'gp'), 0) AS total_pp,
         COALESCE(SUM(COALESCE(gp_amount, 0)) FILTER (WHERE currency = 'gp'), 0) AS total_gp
       FROM referral_rewards WHERE to_wallet = $1`,
      [wallet]
    );
    const tiers = await pool.query(
      `SELECT tier, COUNT(*) as cnt,
              COALESCE(SUM(pp_amount) FILTER (WHERE COALESCE(currency,'pp') != 'gp'), 0) as pp_total,
              COALESCE(SUM(COALESCE(gp_amount, 0)) FILTER (WHERE currency = 'gp'), 0) as gp_total
       FROM referral_rewards WHERE to_wallet = $1 GROUP BY tier ORDER BY tier`,
      [wallet]
    );

    res.json({
      code,
      referredBy: userRes.rows[0].referred_by,
      referredByNickname: userRes.rows[0].referred_by_nickname || null,
      referrals: parseInt(refCount.rows[0].cnt, 10),
      totalEarned: parseFloat(earned.rows[0].total_pp),
      totalEarnedGP: parseFloat(earned.rows[0].total_gp || 0),
      tiers: tiers.rows.map((tier) => ({
        tier: tier.tier,
        count: parseInt(tier.cnt, 10),
        earned: parseFloat(tier.pp_total),
        earnedGP: parseFloat(tier.gp_total),
      })),
    });
  } catch (err) {
    console.error('[API] referral info error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/referral/leaderboard/top', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const rows = await pool.query(
      `SELECT rr.to_wallet AS wallet,
              u.nickname,
              COALESCE(SUM(rr.pp_amount) FILTER (WHERE COALESCE(rr.currency,'pp') != 'gp'), 0) AS total_pp,
              COALESCE(SUM(COALESCE(rr.gp_amount, 0)) FILTER (WHERE rr.currency = 'gp'), 0) AS total_gp,
              COUNT(DISTINCT rr.from_wallet) AS downline_count,
              (SELECT COUNT(*) FROM users u2 WHERE u2.referred_by = rr.to_wallet) AS direct_count
       FROM referral_rewards rr
       LEFT JOIN users u ON u.wallet_address = rr.to_wallet
       WHERE rr.to_wallet NOT LIKE '0xnpc_%'
       GROUP BY rr.to_wallet, u.nickname
       ORDER BY total_pp DESC
       LIMIT $1`,
      [limit]
    );

    res.json({
      leaderboard: rows.rows.map((row, index) => ({
        rank: index + 1,
        wallet: row.wallet,
        nickname: row.nickname || null,
        totalEarned: parseFloat(row.total_pp),
        totalEarnedGP: parseFloat(row.total_gp || 0),
        downlineCount: parseInt(row.downline_count, 10),
        directCount: parseInt(row.direct_count, 10),
      })),
    });
  } catch (err) {
    console.error('[API] referral leaderboard error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/referral/tree/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const tier1Rows = await pool.query(
      `SELECT u.wallet_address AS wallet,
              u.nickname,
              COALESCE(SUM(rr.pp_amount) FILTER (WHERE rr.to_wallet = $1 AND rr.from_wallet = u.wallet_address), 0) AS earned_from,
              (SELECT COUNT(*) FROM users u2 WHERE u2.referred_by = u.wallet_address) AS sub_count
       FROM users u
       LEFT JOIN referral_rewards rr ON rr.from_wallet = u.wallet_address
       WHERE u.referred_by = $1
       GROUP BY u.wallet_address, u.nickname
       ORDER BY earned_from DESC
       LIMIT 100`,
      [wallet]
    );
    const byTrigger = await pool.query(
      `SELECT trigger_type, COALESCE(SUM(pp_amount), 0) AS total
       FROM referral_rewards WHERE to_wallet = $1
       GROUP BY trigger_type ORDER BY total DESC`,
      [wallet]
    );

    res.json({
      directReferrals: tier1Rows.rows.map((row) => ({
        wallet: row.wallet,
        nickname: row.nickname || null,
        earnedFrom: parseFloat(row.earned_from),
        subCount: parseInt(row.sub_count, 10),
      })),
      byTrigger: byTrigger.rows.map((row) => ({
        trigger: row.trigger_type,
        total: parseFloat(row.total),
      })),
    });
  } catch (err) {
    console.error('[API] referral tree error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
