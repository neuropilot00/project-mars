// ACE 명예 시스템 라우트 — 클라 ACE 미니게임 결과 기록(코스메틱 전용).
//   경제 무접촉: GP/PP/USDT/보상/솔벤시/전투 승패에 0 영향.
//   ace_runs/ace_pilot_stats 기록 + 누적 임계 충족 시 기존 user_titles 칭호 부여(멱등).
//   위조내성: 보고값은 settings 임계값으로 CLAMP, 칭호는 누적 기반(1회 위조 무의미).
'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool, getSetting } = require('../db');
const titleService = require('../services/title');

// ── 인증: JWT wallet만 신뢰 (body.wallet 무시) — killboard.js 패턴 복사 ──
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch (_) { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function authWallet(req) {
  return String(req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

async function settingInt(key, fallback) {
  const v = parseInt(await getSetting(key, String(fallback)), 10);
  return Number.isFinite(v) ? v : fallback;
}

// ── 리더보드 15초 in-memory 캐시 (killboard cachedKillboard 패턴) ──
const ACE_CACHE_MS = 15 * 1000;
const aceCache = new Map();
const aceInFlight = new Map();
function pruneAceCache(now = Date.now()) {
  for (const [k, e] of aceCache) { if (!e || now - e.at >= ACE_CACHE_MS) aceCache.delete(k); }
}
async function cachedAce(key, builder) {
  const now = Date.now();
  pruneAceCache(now);
  const c = aceCache.get(key);
  if (c && now - c.at < ACE_CACHE_MS) return c.data;
  if (!aceInFlight.has(key)) {
    aceInFlight.set(key, builder()
      .then(data => { aceCache.set(key, { data, at: Date.now() }); return data; })
      .finally(() => aceInFlight.delete(key)));
  }
  try { return await aceInFlight.get(key); }
  catch (err) { const s = aceCache.get(key); if (s) return s.data; throw err; }
}
function clearAceCache() { aceCache.clear(); }

// 누적 stats 기준 충족 칭호 코드 산출 (멱등 awardTitle은 호출측에서)
async function eligibleAceTitles(stats) {
  const out = [];
  const runsT  = await settingInt('ace_title_runs_threshold', 1);
  const killsT = await settingInt('ace_title_kills_threshold', 200);
  const winsT  = await settingInt('ace_title_wins_threshold', 25);
  const tgT    = await settingInt('ace_title_topgun_kills', 1000);
  const daT    = await settingInt('ace_title_doubleace_wins', 100);
  if ((stats.total_runs  || 0) >= runsT)  out.push('ace_recruit');
  if ((stats.total_kills || 0) >= killsT) out.push('ace_pilot');
  if ((stats.total_wins  || 0) >= winsT)  out.push('ace_veteran');
  if ((stats.total_kills || 0) >= tgT)    out.push('top_gun');
  if ((stats.total_wins  || 0) >= daT)    out.push('ace_ace');
  return out;
}

// ─────────────────────────────────────────────────────────────
// POST /api/ace/result — ACE 런 결과 기록 (코스메틱 전용, 경제 무접촉)
// ─────────────────────────────────────────────────────────────
router.post('/result', requireAuth, async (req, res) => {
  const wallet = authWallet(req);
  if (!wallet || wallet.length < 5) return res.status(401).json({ error: 'NO_WALLET' });

  // ── CLAMP (위조 보고값 sane 범위 강제) ──
  const maxKills = await settingInt('ace_max_kills_per_run', 100);
  const maxDur   = await settingInt('ace_max_duration_sec', 1800);
  const minDur   = await settingInt('ace_min_duration_sec', 3);

  const reportedKills = Number(req.body?.kills);
  const reportedDur   = Number(req.body?.durationSec);
  const repKillsInt = Number.isFinite(reportedKills) ? Math.round(reportedKills) : null;
  const repDurInt   = Number.isFinite(reportedDur)   ? Math.round(reportedDur)   : null;

  const kills = Math.max(0, Math.min(repKillsInt || 0, maxKills));
  const durationSec = Math.max(minDur, Math.min(repDurInt || 0, maxDur));
  const outcome = (req.body?.outcome === 'win') ? 'win' : 'loss';
  const mode = (req.body?.mode === 'battle') ? 'battle' : 'demo';
  let battleId = parseInt(req.body?.battleId, 10);
  if (!Number.isFinite(battleId) || battleId <= 0) battleId = null;

  const client = await pool.connect();
  let stats = null;
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO ace_runs (wallet, battle_id, mode, outcome, kills, duration_sec, reported_kills, reported_duration_sec)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [wallet, battleId, mode, outcome, kills, durationSec, repKillsInt, repDurInt]
    );
    const upd = await client.query(
      `INSERT INTO ace_pilot_stats (wallet, total_runs, total_wins, total_kills, best_kills, best_duration_sec, last_run_at, updated_at)
       VALUES ($1, 1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (wallet) DO UPDATE SET
         total_runs        = ace_pilot_stats.total_runs + 1,
         total_wins        = ace_pilot_stats.total_wins + $2,
         total_kills       = ace_pilot_stats.total_kills + $3,
         best_kills        = GREATEST(ace_pilot_stats.best_kills, $4),
         best_duration_sec = GREATEST(ace_pilot_stats.best_duration_sec, $5),
         last_run_at       = NOW(),
         updated_at        = NOW()
       RETURNING total_runs, total_wins, total_kills, best_kills, best_duration_sec`,
      [wallet, outcome === 'win' ? 1 : 0, kills, kills, durationSec]
    );
    stats = upd.rows[0];
    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[ace] result error:', e.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  } finally {
    client.release();
  }

  clearAceCache();

  // ── COMMIT 후 칭호 부여 (fire-and-forget로 격리 — 칭호 실패가 런 기록 오염 금지) ──
  let titlesAwarded = [];
  try {
    const codes = await eligibleAceTitles(stats || {});
    for (const code of codes) {
      try {
        const r = await titleService.awardTitle(wallet, code);
        if (r && r.success && !r.already_owned) titlesAwarded.push(code);
      } catch (te) { console.warn('[ace] awardTitle skip', code, te.message); }
    }
  } catch (te) { console.warn('[ace] title award block skipped:', te.message); }

  return res.json({
    success: true,
    clamped: { kills, durationSec },
    stats: {
      totalRuns: parseInt(stats?.total_runs) || 0,
      totalWins: parseInt(stats?.total_wins) || 0,
      totalKills: parseInt(stats?.total_kills) || 0,
      bestKills: parseInt(stats?.best_kills) || 0,
      bestDurationSec: parseInt(stats?.best_duration_sec) || 0,
    },
    titlesAwarded,
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/ace/leaderboard — 누적 리더보드 (비로그인 허용)
// ─────────────────────────────────────────────────────────────
router.get('/leaderboard', async (req, res) => {
  try {
    const metric = (req.query.metric === 'wins') ? 'wins' : 'kills';
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 50, 100));
    const orderCol = metric === 'wins' ? 'total_wins' : 'total_kills';
    const data = await cachedAce(`lb:${metric}:${limit}`, async () => {
      const { rows } = await pool.query(
        `SELECT s.wallet, s.total_runs, s.total_wins, s.total_kills, s.best_kills, s.best_duration_sec,
                u.nickname
           FROM ace_pilot_stats s
           LEFT JOIN users u ON LOWER(u.wallet_address) = s.wallet
          ORDER BY s.${orderCol} DESC, s.total_kills DESC, s.last_run_at DESC
          LIMIT $1`, [limit]);
      return {
        metric,
        leaderboard: rows.map((r, i) => ({
          rank: i + 1,
          wallet: r.wallet,
          nickname: r.nickname || null,
          totalRuns: parseInt(r.total_runs) || 0,
          totalWins: parseInt(r.total_wins) || 0,
          totalKills: parseInt(r.total_kills) || 0,
          bestKills: parseInt(r.best_kills) || 0,
          bestDurationSec: parseInt(r.best_duration_sec) || 0,
        })),
      };
    });
    res.json(data);
  } catch (e) {
    console.error('[ace] leaderboard error:', e.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/ace/me — 내 통계 + 최근 런 + 랭크 + 다음 칭호 진행도
// ─────────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const wallet = authWallet(req);
  if (!wallet || wallet.length < 5) return res.status(401).json({ error: 'NO_WALLET' });
  try {
    const [statRes, runsRes] = await Promise.all([
      pool.query(`SELECT * FROM ace_pilot_stats WHERE wallet = $1`, [wallet]),
      pool.query(
        `SELECT battle_id, mode, outcome, kills, duration_sec, created_at
           FROM ace_runs WHERE wallet = $1 ORDER BY created_at DESC LIMIT 5`, [wallet]),
    ]);
    const s = statRes.rows[0] || { total_runs: 0, total_wins: 0, total_kills: 0, best_kills: 0, best_duration_sec: 0 };

    // kills 기준 랭크: 나보다 total_kills 큰 지갑 수 + 1
    let rank = null;
    if (statRes.rows[0]) {
      const rk = await pool.query(
        `SELECT COUNT(*)::int AS ahead FROM ace_pilot_stats WHERE total_kills > $1`,
        [parseInt(s.total_kills) || 0]);
      rank = (parseInt(rk.rows[0]?.ahead) || 0) + 1;
    }

    // 다음 칭호 진행도 (보유하지 않은 가장 가까운 누적 임계)
    const killsT = await settingInt('ace_title_kills_threshold', 200);
    const winsT  = await settingInt('ace_title_wins_threshold', 25);
    const tgT    = await settingInt('ace_title_topgun_kills', 1000);
    const daT    = await settingInt('ace_title_doubleace_wins', 100);
    const tk = parseInt(s.total_kills) || 0;
    const tw = parseInt(s.total_wins) || 0;
    const ladder = [
      { code: 'ace_pilot',   metric: 'kills', current: tk, target: killsT },
      { code: 'ace_veteran', metric: 'wins',  current: tw, target: winsT },
      { code: 'top_gun',     metric: 'kills', current: tk, target: tgT },
      { code: 'ace_ace',     metric: 'wins',  current: tw, target: daT },
    ];
    const nextTitle = ladder.find(t => t.current < t.target) || null;

    res.json({
      success: true,
      wallet,
      stats: {
        totalRuns: parseInt(s.total_runs) || 0,
        totalWins: parseInt(s.total_wins) || 0,
        totalKills: tk,
        bestKills: parseInt(s.best_kills) || 0,
        bestDurationSec: parseInt(s.best_duration_sec) || 0,
      },
      rank,
      recentRuns: runsRes.rows,
      nextTitle,
    });
  } catch (e) {
    console.error('[ace] me error:', e.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
