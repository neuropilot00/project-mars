const express = require('express');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool } = require('../db');
const { requireAuth, getAuthWallet } = require('../utils/apiHelpers');

let achievementService;
try { achievementService = require('../services/achievements'); } catch (_e) { /* achievements service not available */ }
let newsService;
try { newsService = require('../services/news'); } catch (_e) { /* news service not available */ }

const router = express.Router();
const FEED_CACHE_TTL_MS = 5000;

const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests. Please slow down.' }
});

let feedCache = null;
let feedCacheAt = 0;

router.get('/achievements', requireAuth, readLimiter, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet required' });

  try {
    if (!achievementService) return res.status(503).json({ error: 'Achievement service unavailable' });
    const list = await achievementService.getUserAchievements(wallet);
    res.json({ achievements: list });
  } catch (err) {
    console.error('[Achievements] list error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/news', readLimiter, async (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit) || 30);
  const offset = Math.max(0, parseInt(req.query.offset) || 0);
  const type = req.query.type || null;

  try {
    if (!newsService) return res.json({ news: [] });
    const news = await newsService.getNews({ limit, offset, eventType: type });
    res.json({ news });
  } catch (err) {
    console.error('[NEWS] get error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/onboarding/status', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet) return res.json({ step: 0, completed: false });

  try {
    const [claimRes, miningRes, shipRes] = await Promise.all([
      pool.query(
        'SELECT COUNT(*)::int AS cnt FROM claims WHERE LOWER(owner) = LOWER($1) AND deleted_at IS NULL',
        [wallet]
      ),
      pool.query(
        "SELECT COUNT(*)::int AS cnt FROM transactions WHERE type = 'mining' AND LOWER(from_wallet) = LOWER($1)",
        [wallet]
      ),
      pool.query(
        'SELECT COUNT(*)::int AS cnt FROM ships WHERE LOWER(owner_wallet) = LOWER($1)',
        [wallet]
      )
    ]);

    const territoryCount = claimRes.rows[0]?.cnt || 0;
    const miningCount = miningRes.rows[0]?.cnt || 0;
    const shipCount = shipRes.rows[0]?.cnt || 0;

    if (territoryCount <= 0) return res.json({ step: 0, completed: false });
    if (miningCount <= 0) return res.json({ step: 1, completed: false });
    if (shipCount <= 0) return res.json({ step: 2, completed: false });
    return res.json({ step: 3, completed: true });
  } catch (err) {
    console.error('[onboarding] status error:', err.message);
    return res.json({ step: 0, completed: false });
  }
});

router.post('/onboarding/dismiss', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (wallet) {
    try {
      await pool.query(
        "UPDATE users SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('onboarding_dismissed', true) WHERE LOWER(wallet_address) = LOWER($1)",
        [wallet]
      );
    } catch (_) {
      // users.settings may be absent in older environments; frontend local state handles dismissal.
    }
  }
  return res.json({ success: true });
});

router.get('/activity/feed', async (req, res) => {
  const sinceParam = req.query.since ? String(req.query.since) : '';
  const sinceDate = sinceParam ? new Date(sinceParam) : null;
  const since = sinceDate && !Number.isNaN(sinceDate.getTime())
    ? sinceDate.toISOString()
    : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 15));

  if (!sinceParam && feedCache && Date.now() - feedCacheAt < FEED_CACHE_TTL_MS) {
    return res.json({ events: feedCache.slice(0, limit) });
  }

  const safeQuery = async (sql, params) => {
    try {
      const result = await pool.query(sql, params);
      return result.rows || [];
    } catch (err) {
      console.warn('[activity/feed] source query failed:', err.message);
      return [];
    }
  };

  try {
    const [claims, harvests, battles, builds] = await Promise.all([
      safeQuery(
        `SELECT 'claim' AS type,
            COALESCE(u.nickname, LEFT(c.owner, 8)) AS actor,
            COALESCE(c.custom_name, 'territory') AS target,
            NULL AS meta,
            c.created_at
         FROM claims c
         LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(c.owner)
         WHERE c.created_at > $1
         ORDER BY c.created_at DESC
         LIMIT 5`,
        [since]
      ),
      safeQuery(
        `SELECT 'harvest' AS type,
            LEFT(from_wallet, 8) AS actor,
            NULL AS target,
            pp_amount::text || ' PP' AS meta,
            created_at
         FROM transactions
         WHERE type = 'mining' AND created_at > $1
         ORDER BY created_at DESC
         LIMIT 5`,
        [since]
      ),
      safeQuery(
        `SELECT DISTINCT ON (fb.id)
            'battle' AS type,
            COALESCE(u.nickname, LEFT(fbp.wallet_address, 8)) AS actor,
            NULL AS target,
            NULL AS meta,
            COALESCE(fb.ended_at, fb.created_at) AS created_at
         FROM fleet_battles fb
         JOIN fleet_battle_participants fbp
           ON fbp.battle_id = fb.id AND fbp.side = fb.winner_side
         LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(fbp.wallet_address)
         WHERE fb.status = 'ended'
           AND fb.winner_side IS NOT NULL
           AND fb.winner_side != 'draw'
           AND COALESCE(fb.ended_at, fb.created_at) > $1
         ORDER BY fb.id, COALESCE(fb.ended_at, fb.created_at) DESC
         LIMIT 5`,
        [since]
      ),
      safeQuery(
        `SELECT 'build' AS type,
            COALESCE(u.nickname, LEFT(s.owner_wallet, 8)) AS actor,
            COALESCE(st.name_ko, s.ship_type_code) AS target,
            NULL AS meta,
            s.built_at AS created_at
         FROM ships s
         LEFT JOIN ship_types st ON s.ship_type_code = st.code
         LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(s.owner_wallet)
         WHERE s.built_at > $1
         ORDER BY s.built_at DESC
         LIMIT 5`,
        [since]
      )
    ]);

    const events = []
      .concat(claims, harvests, battles, builds)
      .filter(event => event && event.created_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    if (!sinceParam) {
      feedCache = events;
      feedCacheAt = Date.now();
    }

    return res.json({ events });
  } catch (err) {
    console.error('[activity/feed] error:', err.message);
    return res.json({ events: [] });
  }
});

module.exports = router;
