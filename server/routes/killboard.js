// 킬보드 — 함선 격침 귀속 조회 (ship_wrecks). 배신 시스템 Phase 2 / 시스템3.
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const shipSalvage = require('../services/shipSalvage');
let dailyOps;
try { dailyOps = require('./dailyOps'); } catch (_) { /* optional daily ops route helper */ }

const KILLBOARD_CACHE_MS = 15 * 1000;
const KILLBOARD_CACHE_MAX = 500;
const killboardCache = new Map();
const killboardInFlight = new Map();

const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch (_) { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function authWallet(req) {
  return String(req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

function pruneKillboardCache(now = Date.now()) {
  for (const [key, entry] of killboardCache) {
    if (!entry || now - entry.at >= KILLBOARD_CACHE_MS) killboardCache.delete(key);
  }
  while (killboardCache.size > KILLBOARD_CACHE_MAX) {
    const oldestKey = killboardCache.keys().next().value;
    if (oldestKey == null) break;
    killboardCache.delete(oldestKey);
  }
}

async function cachedKillboard(key, builder) {
  const now = Date.now();
  pruneKillboardCache(now);
  const cached = killboardCache.get(key);
  if (cached && now - cached.at < KILLBOARD_CACHE_MS) return cached.data;

  if (!killboardInFlight.has(key)) {
    killboardInFlight.set(key, builder()
      .then(data => {
        killboardCache.set(key, { data, at: Date.now() });
        pruneKillboardCache();
        return data;
      })
      .finally(() => { killboardInFlight.delete(key); }));
  }

  try {
    return await killboardInFlight.get(key);
  } catch (err) {
    const stale = killboardCache.get(key);
    if (stale) return stale.data;
    throw err;
  }
}

function clearKillboardCacheFor(wallet) {
  const w = String(wallet || '').toLowerCase();
  for (const key of killboardCache.keys()) {
    if (key.startsWith('global:') || (w && key.indexOf('wallet:' + w + ':') === 0)) killboardCache.delete(key);
  }
}
// GET /api/killboard — 최근 격침 (글로벌). 변절자(guild_betrayer) 피해자는 플래그.
router.get('/', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 30, 100));
    const data = await cachedKillboard('global:' + limit, async () => {
      const { rows } = await pool.query(
        `SELECT w.id, w.battle_id, w.ship_type, w.ship_name, w.ship_value_gp, w.mods,
                w.original_owner AS victim_wallet, w.killer_wallet,
                w.killer_side, w.victim_side, w.resources, w.salvaged_by, w.salvaged_at, w.expires_at, w.created_at,
                uk.nickname AS killer_nick, uv.nickname AS victim_nick,
                ak.id AS killer_alliance_id, ak.tag AS killer_alliance_tag, ak.name AS killer_alliance_name, ak.color_primary AS killer_alliance_color,
                av.id AS victim_alliance_id, av.tag AS victim_alliance_tag, av.name AS victim_alliance_name, av.color_primary AS victim_alliance_color,
                (SELECT COALESCE(SUM(bl.reward_gp), 0) FROM bounty_listings bl
                  WHERE LOWER(bl.target_wallet) = LOWER(w.original_owner)
                    AND bl.status = 'active'
                    AND (bl.expires_at IS NULL OR bl.expires_at > NOW())) AS active_bounty_gp,
                EXISTS(SELECT 1 FROM player_tags pt WHERE LOWER(pt.wallet) = LOWER(w.original_owner) AND pt.tag_id = 'guild_betrayer') AS victim_is_betrayer
           FROM ship_wrecks w
           LEFT JOIN users uk ON LOWER(uk.wallet_address) = w.killer_wallet
           LEFT JOIN users uv ON LOWER(uv.wallet_address) = w.original_owner
           LEFT JOIN alliance_members amk ON LOWER(amk.wallet_address) = w.killer_wallet AND amk.left_at IS NULL
           LEFT JOIN alliances ak ON ak.id = amk.alliance_id AND ak.disbanded_at IS NULL
           LEFT JOIN alliance_members amv ON LOWER(amv.wallet_address) = LOWER(w.original_owner) AND amv.left_at IS NULL
           LEFT JOIN alliances av ON av.id = amv.alliance_id AND av.disbanded_at IS NULL
          WHERE w.killer_wallet IS NOT NULL
          ORDER BY w.created_at DESC
          LIMIT $1`, [limit]);
      return { kills: rows };
    });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// A transparent pre-claim quote uses the same source validation and daily budget as settlement.
router.get('/salvage-policy',requireAuth,async(req,res)=>{
  try {res.json(await shipSalvage.budgetState(authWallet(req)));} catch(e){res.status(500).json({error:'SERVER_ERROR'});}
});
router.get('/:id/salvage-quote',requireAuth,async(req,res)=>{
  try {res.json(await shipSalvage.quoteSalvage(authWallet(req),req.params.id));} catch(e){res.status(500).json({error:'SERVER_ERROR'});}
});
router.post('/:id/salvage',requireAuth,async(req,res)=>{
  const wallet=authWallet(req);
  if (!wallet || wallet.length<5) return res.status(401).json({error:'NO_WALLET'});
  try {
    const result=await shipSalvage.claimSalvage(wallet,req.params.id);
    clearKillboardCacheFor(wallet);
    if(dailyOps && typeof dailyOps.notifyMissionProgress==='function') {
      dailyOps.notifyMissionProgress(wallet,'salvage_wreck').catch(()=>{});
      dailyOps.notifyMissionProgress(wallet,'salvage_wreck_3').catch(()=>{});
    }
    res.json(result);
  } catch(e) {
    const status={INVALID_ID:400,USER_NOT_FOUND:404,WRECK_NOT_FOUND:404,NOT_KILLER:403,ALREADY_SALVAGED:409,WRECK_EXPIRED:410,
      UNVERIFIED_LOSS:409,SELF_SALVAGE_FORBIDDEN:409,PRACTICE_SALVAGE_FORBIDDEN:409,STARTER_HULL_SALVAGE_FORBIDDEN:409,HULL_NOT_LOST:409,UNSETTLED_LOSS:409,HULL_ALREADY_SALVAGED:409,SALVAGE_DAILY_LIMIT:429,NO_RECOVERABLE_RESOURCES:409}[e.message];
    if(!status) console.error('[killboard] salvage error:',e.message);
    res.status(status||500).json({error:status?e.message:'SERVER_ERROR',meta:e.meta});
  }
});

// GET /api/killboard/:wallet — 특정 지갑 K/D 요약 + 최근 격침/피격
router.get('/:wallet', async (req, res) => {
  try {
    const w = (req.params.wallet || '').toLowerCase().trim();
    if (!w || w.length < 5) return res.status(400).json({ error: 'wallet_required' });
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const data = await cachedKillboard('wallet:' + w + ':' + limit, async () => {
      const [agg, kills, losses] = await Promise.all([
        pool.query(
          `SELECT (SELECT COUNT(*) FROM ship_wrecks WHERE killer_wallet = $1)  AS kills,
                  (SELECT COUNT(*) FROM ship_wrecks WHERE original_owner = $1) AS losses,
                  (SELECT COALESCE(SUM(ship_value_gp),0) FROM ship_wrecks WHERE killer_wallet = $1)  AS destroyed_value,
                  (SELECT COALESCE(SUM(ship_value_gp),0) FROM ship_wrecks WHERE original_owner = $1) AS lost_value,
                  (SELECT COALESCE(MAX(ship_value_gp),0) FROM ship_wrecks WHERE killer_wallet = $1)  AS best_kill_value`, [w]),
        pool.query(
          `SELECT battle_id, ship_type, ship_name, ship_value_gp, mods, original_owner AS victim_wallet, created_at
             FROM ship_wrecks WHERE killer_wallet = $1 ORDER BY created_at DESC LIMIT $2`, [w, limit]),
        pool.query(
          `SELECT battle_id, ship_type, ship_name, ship_value_gp, mods, killer_wallet, created_at
             FROM ship_wrecks WHERE original_owner = $1 ORDER BY created_at DESC LIMIT $2`, [w, limit]),
      ]);
      return {
        wallet: w,
        kills: parseInt(agg.rows[0].kills) || 0,
        losses: parseInt(agg.rows[0].losses) || 0,
        destroyedValue: parseInt(agg.rows[0].destroyed_value) || 0,
        lostValue: parseInt(agg.rows[0].lost_value) || 0,
        bestKillValue: parseInt(agg.rows[0].best_kill_value) || 0,
        recentKills: kills.rows,
        recentLosses: losses.rows,
      };
    });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
