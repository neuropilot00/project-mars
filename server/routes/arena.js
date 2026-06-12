const express = require('express');
const crypto = require('crypto');
const jwt     = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { pool, getSettings, awardXP, creditReferralCommission, getSetting } = require('../db');

const router = express.Router();

// ✅ [v7.47] JWT 인증 미들웨어
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function getAuthWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

// ── Cantina 비활성화 미들웨어 (BIBLE Migration 080) ──
// cantina_enabled = false 이면 모든 /api/arena/* 요청에 503 반환
router.use(async (req, res, next) => {
  try {
    const enabled = (await getSetting('cantina_enabled') ?? 'true').toString();
    if (enabled === 'false') {
      return res.status(503).json({ error: 'Cantina is currently disabled', code: 'CANTINA_DISABLED' });
    }
  } catch (_e) { /* getSetting 실패 시 통과 (안전 우선) */ }
  next();
});

let seasonService;
try { seasonService = require('../services/season'); } catch (_e) { /* season service not available */ }
let dailyService;
try { dailyService = require('../services/daily'); } catch (_e) { /* daily service not available */ }

const isDev = process.env.NODE_ENV !== 'production';
const betLimiter = rateLimit({
  windowMs: 60 * 1000, max: isDev ? 300 : 60,
  message: { error: 'Too many requests' }
});

let _cfg = null, _cfgAt = 0;
async function cfg() {
  if (_cfg && Date.now() - _cfgAt < 30000) return _cfg;
  _cfg = await getSettings(); _cfgAt = Date.now();
  return _cfg;
}

function strictNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value !== 'string') return NaN;
  const trimmed = value.trim();
  if (!trimmed || !/^-?(?:\d+|\d*\.\d+)$/.test(trimmed)) return NaN;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function strictInteger(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : NaN;
  if (typeof value !== 'string') return NaN;
  const trimmed = value.trim();
  if (!trimmed || !/^-?\d+$/.test(trimmed)) return NaN;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : NaN;
}

// (v7.373) 카지노 공통 하우스 엣지. casino_house_edge_pct(기본 15%) 설정에서 읽어 배수에 곱한다.
// 0~90% clamp. _cfg는 각 게임 핸들러가 cfg()를 먼저 호출해 갱신된 상태로 사용한다.
function _houseEdgePct() {
  const e = parseFloat(_cfg && _cfg.casino_house_edge_pct);
  return Math.max(0, Math.min(90, isNaN(e) ? 15 : e));
}
function _houseFactor() { return 1 - _houseEdgePct() / 100; } // 당첨 배수에 곱하는 계수(예: 15%→0.85)

async function getCantinaReferralBase(betAmount) {
  const settings = await cfg();
  const houseEdgePct = Math.max(0, parseFloat(settings.arena_house_edge) || 0);
  const bet = Math.max(0, parseFloat(betAmount) || 0);
  if (bet <= 0 || houseEdgePct <= 0) return 0;
  return Math.round((bet * houseEdgePct / 100) * 1000000) / 1000000;
}

async function applyLuckyCharmPayout(client, wallet, payout, currency) {
  const basePayout = parseFloat(payout) || 0;
  if (basePayout <= 0 || currency !== 'PP') return { payout: basePayout, luckyCharmBonus: 0 };
  try {
    const charmRes = await client.query(
      `SELECT effect_value FROM user_active_effects
       WHERE LOWER(wallet) = LOWER($1)
         AND effect_type = 'lucky_charm'
         AND active = true
         AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [wallet]
    );
    if (!charmRes.rows.length) return { payout: basePayout, luckyCharmBonus: 0 };
    const bonusPct = Math.max(0, Math.min(50, parseFloat(charmRes.rows[0].effect_value) || 0));
    const boosted = Math.round(basePayout * (1 + bonusPct / 100) * 1000000) / 1000000;
    return { payout: boosted, luckyCharmBonus: Math.round((boosted - basePayout) * 1000000) / 1000000 };
  } catch (_e) {
    return { payout: basePayout, luckyCharmBonus: 0 };
  }
}

// ══════════════════════════════════
//  CRASH GAME
// ══════════════════════════════════

// Generate provably fair crash point
const CRASH_MAX_MULT = 100; // Maximum multiplier cap
const CRASH_MAX_MS = 60000;
function generateCrashPoint(seed) {
  const hash = crypto.createHmac('sha256', seed).update('crash').digest('hex');
  const h = parseInt(hash.slice(0, 13), 16);
  const e = Math.pow(2, 52);
  // (v7.373) 하우스 엣지 = instant crash(1.00x) 빈도 1/N. N=round(100/edge%) (기본 15%→약 1/7).
  const _N = Math.max(2, Math.round(100 / _houseEdgePct()));
  if (h % _N === 0) return 1.00;
  const raw = Math.max(1.00, Math.floor((100 * e - h) / (e - h)) / 100);
  return Math.min(raw, CRASH_MAX_MULT); // Cap at 100x
}

async function settleCrashBetsLost(client, roundId) {
  await client.query(
    "UPDATE crash_bets SET status = 'busted' WHERE round_id = $1 AND status = 'active'",
    [roundId]
  );
}

async function closeStaleCrashRounds(client) {
  const staleRunning = await client.query(
    `UPDATE crash_rounds
     SET status = 'crashed', crashed_at = NOW()
     WHERE status = 'running'
       AND started_at < NOW() - ($1 * interval '1 millisecond')
     RETURNING id`,
    [CRASH_MAX_MS]
  );

  for (const row of staleRunning.rows) {
    await settleCrashBetsLost(client, row.id);
  }

  await client.query(
    `UPDATE crash_rounds
     SET status = 'crashed', crashed_at = NOW()
     WHERE status = 'waiting'
       AND created_at < NOW() - ($1 * interval '1 millisecond')`,
    [CRASH_MAX_MS]
  );
}

// GET /arena/crash/current — Get current round
router.get('/crash/current', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await closeStaleCrashRounds(client);

    // Find active round or create one. Stale running rounds are never returned.
    let round = await client.query(
      `SELECT *
       FROM crash_rounds
       WHERE status = 'waiting'
          OR (status = 'running' AND started_at >= NOW() - ($1 * interval '1 millisecond'))
       ORDER BY id DESC
       LIMIT 1`,
      [CRASH_MAX_MS]
    );

    if (round.rows.length === 0) {
      // Create new round
      const seed = crypto.randomBytes(32).toString('hex');
      const crashPoint = generateCrashPoint(seed);
      const hash = crypto.createHash('sha256').update(seed).digest('hex');

      const r = await client.query(
        `INSERT INTO crash_rounds (crash_point, hash, status)
         VALUES ($1, $2, 'waiting') RETURNING *`,
        [crashPoint, hash]
      );
      round = { rows: [r.rows[0]] };
    }

    const r = round.rows[0];
    await client.query('COMMIT');

    // Get bets for this round
    const bets = await pool.query(
      'SELECT wallet, bet_amount, currency, cashout_at, status FROM crash_bets WHERE round_id = $1',
      [r.id]
    );

    res.json({
      roundId: r.id,
      hash: r.hash,
      status: r.status,
      crashPoint: r.status === 'crashed' ? parseFloat(r.crash_point) : null,
      startedAt: r.started_at,
      bets: bets.rows.map(b => ({
        wallet: b.wallet.slice(0, 6) + '...',
        bet: parseFloat(b.bet_amount),
        currency: b.currency,
        cashout: b.cashout_at ? parseFloat(b.cashout_at) : null,
        status: b.status
      }))
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[Arena] crash current:', e.message);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// POST /arena/crash/bet — Place a bet
router.post('/crash/bet', requireAuth, betLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    const { amount, currency } = req.body;
    const w = getAuthWallet(req);
    // (솔벤시 v7.370) 카지노는 PP 전용. USDT 당첨은 house 뱅크롤/담보 없이 usdt_balance를
    // 발행해 SUM(usdt_balance) <= collateral 불변식(USDT 페그)을 깬다. UI가 PP만 노출해도
    // 백엔드가 body.currency를 신뢰하면 악용 가능 → USDT 베팅 자체를 거부한다.
    if (currency === 'USDT') return res.status(400).json({ error: 'Casino accepts PP only' });
    const cur = 'PP';
    const bet = strictNumber(amount);
    const s = await cfg();

    if (!w) return res.status(400).json({ error: 'Wallet required' });
    const minBet = parseFloat(s.crash_min_bet) || 0.1;
    const maxBet = parseFloat(s.crash_max_bet) || 50;
    if (!Number.isFinite(bet) || bet <= 0 || bet < minBet || bet > maxBet) {
      return res.status(400).json({ error: `Bet must be ${minBet}-${maxBet} ${cur}` });
    }

    await client.query('BEGIN');

    // Check balance
    const balCol = cur === 'USDT' ? 'usdt_balance' : 'pp_balance';
    const userRes = await client.query(
      `SELECT ${balCol} as bal FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`, [w]
    );
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    if (parseFloat(userRes.rows[0].bal) < bet) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Find waiting round
    const roundRes = await client.query(
      "SELECT * FROM crash_rounds WHERE status = 'waiting' ORDER BY id DESC LIMIT 1 FOR UPDATE"
    );
    if (roundRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No round available. Wait for next round.' });
    }
    const roundId = roundRes.rows[0].id;

    // Check not already bet
    const existBet = await client.query(
      'SELECT id FROM crash_bets WHERE round_id = $1 AND LOWER(wallet) = LOWER($2)', [roundId, w]
    );
    if (existBet.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already bet this round' });
    }

    // Deduct balance (AND guard prevents negative on concurrent requests)
    const deductCrash = await client.query(
      `UPDATE users SET ${balCol} = ${balCol} - $1 WHERE LOWER(wallet_address) = LOWER($2) AND ${balCol} >= $1`, [bet, w]
    );
    if (deductCrash.rowCount === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient balance' }); }

    // Place bet
    await client.query(
      'INSERT INTO crash_bets (round_id, wallet, bet_amount, currency) VALUES ($1,$2,$3,$4)',
      [roundId, w, bet, cur]
    );

    // Transaction log
    await client.query(
      `INSERT INTO transactions (type, from_wallet, ${cur === 'USDT' ? 'usdt_amount' : 'pp_amount'}, fee, meta)
       VALUES ('crash_bet', $1, $2, 0, $3)`,
      [w, bet, JSON.stringify({ roundId, currency: cur })]
    );

    // Award 1 XP per game bet
    await awardXP(client, w, 1);

    // Referral commission — uplines get a small PP cut from cantina house edge, not gross wager
    if (cur === 'PP') {
      try {
        const referralBase = await getCantinaReferralBase(bet);
        if (referralBase > 0) {
          await creditReferralCommission(client, w, 'cantina', referralBase, 'pp');
        }
      } catch (_e) {}
    }

    await client.query('COMMIT');
    res.json({ success: true, roundId, bet, currency: cur });
    // Season tracking: cantina play + pp_spend (non-blocking)
    if (seasonService) {
      seasonService.addSeasonScore(w, 'cantina', 1).catch(() => {});
      if (cur === 'PP') seasonService.addSeasonScore(w, 'pp_spend', 1).catch(() => {});
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Arena] crash bet:', e.message);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// POST /arena/crash/cashout — Cash out during a round
router.post('/crash/cashout', requireAuth, betLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    const { multiplier } = req.body;
    const w = getAuthWallet(req);
    const cashoutAt = strictNumber(multiplier);

    if (!w || !Number.isFinite(cashoutAt) || cashoutAt < 1.01) {
      return res.status(400).json({ error: 'Invalid cashout' });
    }

    await client.query('BEGIN');

    // Find running round
    const roundRes = await client.query(
      "SELECT * FROM crash_rounds WHERE status = 'running' ORDER BY id DESC LIMIT 1"
    );
    if (roundRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active round' });
    }
    const round = roundRes.rows[0];

    // Verify cashout is before crash
    if (cashoutAt > parseFloat(round.crash_point)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Too late! Already crashed.' });
    }

    // (보안 v7.370) 경과시간 기준 현재 배수 이하만 허용. 이 검증이 없으면 베팅 직후
    // crash_point 직전 값을 임의로 보내 매 라운드 무위험 보장승으로 하우스 PP를 갈취할 수
    // 있다(red-team P0). live 배수에 소량 허용오차(+0.05)만 둔다.
    const _liveMult = calcMultiplier(Date.now() - new Date(round.started_at).getTime());
    if (cashoutAt > _liveMult + 0.05) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cashout exceeds current multiplier' });
    }

    // Find active bet
    const betRes = await client.query(
      "SELECT * FROM crash_bets WHERE round_id = $1 AND LOWER(wallet) = LOWER($2) AND status = 'active' FOR UPDATE",
      [round.id, w]
    );
    if (betRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active bet' });
    }

    const bet = betRes.rows[0];
    const basePayout = Math.round(parseFloat(bet.bet_amount) * cashoutAt * 10000) / 10000;
    const luckyPayout = await applyLuckyCharmPayout(client, w, basePayout, bet.currency);
    const payout = luckyPayout.payout;
    const balCol = bet.currency === 'USDT' ? 'usdt_balance' : 'pp_balance';

    // Update bet
    await client.query(
      "UPDATE crash_bets SET cashout_at = $1, payout = $2, status = 'cashed' WHERE id = $3",
      [cashoutAt, payout, bet.id]
    );

    // Credit winnings
    await client.query(
      `UPDATE users SET ${balCol} = ${balCol} + $1 WHERE LOWER(wallet_address) = LOWER($2)`, [payout, w]
    );

    // Transaction log
    await client.query(
      `INSERT INTO transactions (type, from_wallet, ${bet.currency === 'USDT' ? 'usdt_amount' : 'pp_amount'}, fee, meta)
       VALUES ('crash_win', $1, $2, 0, $3)`,
      [w, payout, JSON.stringify({ roundId: round.id, multiplier: cashoutAt, bet: parseFloat(bet.bet_amount), luckyCharmBonus: luckyPayout.luckyCharmBonus })]
    );

    await client.query('COMMIT');
    res.json({ success: true, cashoutAt, payout, luckyCharmBonus: luckyPayout.luckyCharmBonus, currency: bet.currency });
    if (dailyService) { try { await dailyService.updateMissionProgress(w, 'play_cantina', 1); } catch (_de) {} }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Arena] crash cashout:', e.message);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// Server-side multiplier calc (must match client)
function calcMultiplier(elapsedMs) {
  return Math.floor(Math.pow(Math.E, 0.00006 * elapsedMs) * 100) / 100;
}

// POST /arena/crash/start — Start a round (called by authenticated game loop)
router.post('/crash/start', requireAuth, betLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const waiting = await client.query(
      "SELECT id FROM crash_rounds WHERE status = 'waiting' ORDER BY id DESC LIMIT 1"
    );

    if (waiting.rows.length > 0) {
      const result = await client.query(
        "UPDATE crash_rounds SET status = 'running', started_at = NOW() WHERE id = $1 AND status = 'waiting' RETURNING *",
        [waiting.rows[0].id]
      );
      await client.query('COMMIT');
      if (result.rows.length === 0) return res.status(400).json({ error: 'No waiting round' });
      return res.json({ roundId: result.rows[0].id, started: true });
    }

    const running = await client.query(
      `SELECT *
       FROM crash_rounds
       WHERE status = 'running'
         AND started_at >= NOW() - ($1 * interval '1 millisecond')
       ORDER BY id DESC
       LIMIT 1`,
      [CRASH_MAX_MS]
    );
    await client.query('COMMIT');
    if (running.rows.length > 0) {
      return res.json({ roundId: running.rows[0].id, started: true });
    }

    return res.status(400).json({ error: 'No waiting round' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// In-memory crash round cache for fast ticks
let _crashCache = null, _crashCacheAt = 0;

// GET /arena/crash/tick — Poll current round state; auto-ends if crashed
router.get('/crash/tick', async (req, res) => {
  try {
    // Fast path: use cached round if fresh (< 500ms)
    let round;
    if (_crashCache && Date.now() - _crashCacheAt < 500) {
      round = _crashCache;
    } else {
      const roundRes = await pool.query(
        "SELECT * FROM crash_rounds WHERE status = 'running' ORDER BY id DESC LIMIT 1"
      );
      if (roundRes.rows.length === 0) {
        _crashCache = null;
        return res.json({ status: 'no_round' });
      }
      round = roundRes.rows[0];
      _crashCache = round;
      _crashCacheAt = Date.now();
    }

    const elapsed = Date.now() - new Date(round.started_at).getTime();
    if (elapsed > CRASH_MAX_MS) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const stale = await client.query(
          `UPDATE crash_rounds
           SET status = 'crashed', crashed_at = NOW()
           WHERE id = $1
             AND status = 'running'
             AND started_at < NOW() - ($2 * interval '1 millisecond')
           RETURNING id`,
          [round.id, CRASH_MAX_MS]
        );
        if (stale.rows.length > 0) {
          await settleCrashBetsLost(client, round.id);
        }
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK').catch(() => {});
        throw txErr;
      } finally {
        client.release();
      }
      _crashCache = null;
      return res.json({ status: 'no_round' });
    }

    const currentMult = calcMultiplier(elapsed);
    const crashPoint = parseFloat(round.crash_point);

    if (currentMult >= crashPoint) {
      // CRASH — end the round (use transaction only here)
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Double-check status (another tick may have crashed it)
        const check = await client.query(
          "SELECT status FROM crash_rounds WHERE id = $1 FOR UPDATE", [round.id]
        );
        if (check.rows[0]?.status !== 'running') {
          await client.query('ROLLBACK');
          client.release();
          _crashCache = null;
          return res.json({ status: 'crashed', crashPoint, roundId: round.id, elapsed, bets: [] });
        }

        await client.query(
          "UPDATE crash_rounds SET status = 'crashed', crashed_at = NOW() WHERE id = $1", [round.id]
        );
        await settleCrashBetsLost(client, round.id);

        // Create next round
        const seed = crypto.randomBytes(32).toString('hex');
        const cp = generateCrashPoint(seed);
        const hash = crypto.createHash('sha256').update(seed).digest('hex');
        await client.query(
          "INSERT INTO crash_rounds (crash_point, hash, status) VALUES ($1, $2, 'waiting')",
          [cp, hash]
        );
        await client.query('COMMIT');
        client.release();
      } catch (txErr) {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
        throw txErr;
      }

      _crashCache = null;

      const bets = await pool.query(
        'SELECT wallet, bet_amount, currency, cashout_at, status FROM crash_bets WHERE round_id = $1', [round.id]
      );

      return res.json({
        status: 'crashed',
        crashPoint,
        roundId: round.id,
        elapsed,
        bets: bets.rows.map(b => ({
          wallet: b.wallet.slice(0, 6) + '...',
          bet: parseFloat(b.bet_amount),
          currency: b.currency,
          cashout: b.cashout_at ? parseFloat(b.cashout_at) : null,
          status: b.status
        }))
      });
    }

    // Still running — read bets without lock
    const bets = await pool.query(
      'SELECT wallet, bet_amount, currency, cashout_at, status FROM crash_bets WHERE round_id = $1', [round.id]
    );

    res.json({
      status: 'running',
      roundId: round.id,
      elapsed,
      multiplier: currentMult,
      bets: bets.rows.map(b => ({
        wallet: b.wallet.slice(0, 6) + '...',
        bet: parseFloat(b.bet_amount),
        currency: b.currency,
        cashout: b.cashout_at ? parseFloat(b.cashout_at) : null,
        status: b.status
      }))
    });
  } catch (e) {
    console.error('[Arena] crash tick:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /arena/crash/history — Recent rounds
router.get('/crash/history', async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id, crash_point, hash, crashed_at FROM crash_rounds WHERE status = 'crashed' ORDER BY id DESC LIMIT 20"
    );
    res.json(r.rows.map(x => ({
      id: x.id, crashPoint: parseFloat(x.crash_point), hash: x.hash, time: x.crashed_at
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════
//  MINES GAME
// ══════════════════════════════════

function generateMinesGrid(mineCount) {
  const grid = Array(25).fill('gem');
  const positions = [];
  while (positions.length < mineCount) {
    const pos = Math.floor(Math.random() * 25);
    if (!positions.includes(pos)) { positions.push(pos); grid[pos] = 'mine'; }
  }
  return JSON.stringify(grid);
}

// Pre-computed multiplier cache for instant lookup
const _multCache = {};
function minesMultiplier(revealed, mineCount) {
  // (v7.373) 하우스 엣지 설정 적용. 엣지가 캐시 키에 포함되어 어드민이 바꿔도 stale 안 됨.
  const hf = _houseFactor();
  const key = revealed + '_' + mineCount + '_' + hf;
  if (_multCache[key]) return _multCache[key];
  const safeTotal = 25 - mineCount;
  let mult = 1;
  for (let i = 0; i < revealed; i++) {
    mult *= (25 - i) / (safeTotal - i);
  }
  const result = Math.round(mult * hf * 10000) / 10000;
  _multCache[key] = result;
  return result;
}

// POST /arena/mines/start — Start a new mines game
router.post('/mines/start', requireAuth, betLimiter, async (req, res) => {
  // Validate outside transaction
  const { amount, currency, mines } = req.body;
  const w = getAuthWallet(req);
  // (솔벤시 v7.370) 카지노는 PP 전용 — USDT 당첨은 담보 없이 usdt_balance를 발행해 페그를 깬다.
  if (currency === 'USDT') return res.status(400).json({ error: 'Casino accepts PP only' });
  const cur = 'PP';
  const bet = strictNumber(amount);
  const requestedMines = strictInteger(mines);
  const mineCount = Math.max(1, Math.min(24, Number.isInteger(requestedMines) ? requestedMines : 5));

  if (!w) return res.status(400).json({ error: 'Wallet required' });
  const s = await cfg();
  const minBet = parseFloat(s.mines_min_bet) || 0.1;
  const maxBet = parseFloat(s.mines_max_bet) || 1000;
  if (!Number.isFinite(bet) || bet <= 0 || bet < minBet || bet > maxBet) {
    return res.status(400).json({ error: `Bet must be ${minBet}-${maxBet} ${cur}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check no active game + balance in parallel
    const balCol = cur === 'USDT' ? 'usdt_balance' : 'pp_balance';
    const [activeGame, userRes] = await Promise.all([
      client.query("SELECT id FROM mines_games WHERE LOWER(wallet) = LOWER($1) AND status = 'active'", [w]),
      client.query(`SELECT ${balCol} as bal FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`, [w])
    ]);

    if (activeGame.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Finish your current game first', gameId: activeGame.rows[0].id });
    }
    if (userRes.rows.length === 0 || parseFloat(userRes.rows[0].bal) < bet) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct + Create game in parallel (AND guard prevents negative on concurrent requests)
    const grid = generateMinesGrid(mineCount);
    const [deductMines, gameRes] = await Promise.all([
      client.query(`UPDATE users SET ${balCol} = ${balCol} - $1 WHERE LOWER(wallet_address) = LOWER($2) AND ${balCol} >= $1`, [bet, w]),
      client.query(
        `INSERT INTO mines_games (wallet, bet_amount, currency, mine_count, grid, current_multiplier)
         VALUES ($1,$2,$3,$4,$5,1.0) RETURNING id`,
        [w, bet, cur, mineCount, grid]
      )
    ]);
    if (deductMines.rowCount === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient balance' }); }

    // Transaction log + XP in parallel
    await Promise.all([
      client.query(
        `INSERT INTO transactions (type, from_wallet, ${cur === 'USDT' ? 'usdt_amount' : 'pp_amount'}, fee, meta)
         VALUES ('mines_bet', $1, $2, 0, $3)`,
        [w, bet, JSON.stringify({ gameId: gameRes.rows[0].id, mines: mineCount })]
      ),
      awardXP(client, w, 1)
    ]);

    // Referral commission — uplines get a small PP cut from cantina house edge, not gross wager
    if (cur === 'PP') {
      try {
        const referralBase = await getCantinaReferralBase(bet);
        if (referralBase > 0) {
          await creditReferralCommission(client, w, 'cantina', referralBase, 'pp');
        }
      } catch (_e) {}
    }

    await client.query('COMMIT');
    res.json({
      gameId: gameRes.rows[0].id,
      bet, currency: cur,
      mines: mineCount,
      multiplier: 1.0,
      nextMultiplier: minesMultiplier(1, mineCount)
    });
    if (seasonService) {
      seasonService.addSeasonScore(w, 'cantina', 1).catch(() => {});
      if (cur === 'PP') seasonService.addSeasonScore(w, 'pp_spend', 1).catch(() => {});
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Arena] mines start:', e.message);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// POST /arena/mines/reveal — Reveal a tile
router.post('/mines/reveal', requireAuth, betLimiter, async (req, res) => {
  // Validate outside transaction
  const { gameId, position } = req.body;
  const w = getAuthWallet(req);
  const pos = strictInteger(position);
  if (!w || !gameId || !Number.isInteger(pos) || pos < 0 || pos > 24) {
    return res.status(400).json({ error: 'Invalid params' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gameRes = await client.query(
      "SELECT id, grid, revealed, mine_count, bet_amount FROM mines_games WHERE id = $1 AND LOWER(wallet) = LOWER($2) AND status = 'active' FOR UPDATE",
      [gameId, w]
    );
    if (gameRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Game not found or not active' });
    }

    const game = gameRes.rows[0];
    const grid = JSON.parse(game.grid);
    const revealed = JSON.parse(game.revealed);

    if (revealed.includes(pos)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already revealed' });
    }

    revealed.push(pos);
    const isMine = grid[pos] === 'mine';

    if (isMine) {
      await client.query(
        "UPDATE mines_games SET revealed = $1, status = 'busted', ended_at = NOW() WHERE id = $2",
        [JSON.stringify(revealed), gameId]
      );
      await client.query('COMMIT');
      return res.json({ result: 'mine', position: pos, grid, payout: 0, status: 'busted' });
    }

    // GEM
    const newMult = minesMultiplier(revealed.length, game.mine_count);
    await client.query(
      "UPDATE mines_games SET revealed = $1, current_multiplier = $2 WHERE id = $3",
      [JSON.stringify(revealed), newMult, gameId]
    );

    const safeRemaining = (25 - game.mine_count) - revealed.length;
    await client.query('COMMIT');

    res.json({
      result: 'gem', position: pos,
      multiplier: newMult,
      nextMultiplier: safeRemaining > 0 ? minesMultiplier(revealed.length + 1, game.mine_count) : null,
      revealed, safeRemaining,
      potentialPayout: Math.round(parseFloat(game.bet_amount) * newMult * 10000) / 10000,
      status: 'active'
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Arena] mines reveal:', e.message);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// POST /arena/mines/cashout — Cash out current mines game
router.post('/mines/cashout', requireAuth, betLimiter, async (req, res) => {
  const { gameId } = req.body;
  const w = getAuthWallet(req);
  if (!w || !gameId) return res.status(400).json({ error: 'Missing params' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gameRes = await client.query(
      "SELECT id, bet_amount, currency, current_multiplier, revealed, grid FROM mines_games WHERE id = $1 AND LOWER(wallet) = LOWER($2) AND status = 'active' FOR UPDATE",
      [gameId, w]
    );
    if (gameRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameRes.rows[0];
    const revealed = JSON.parse(game.revealed);
    if (revealed.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Reveal at least one tile first' });
    }

    const basePayout = Math.round(parseFloat(game.bet_amount) * parseFloat(game.current_multiplier) * 10000) / 10000;
    const luckyPayout = await applyLuckyCharmPayout(client, w, basePayout, game.currency);
    const payout = luckyPayout.payout;
    const balCol = game.currency === 'USDT' ? 'usdt_balance' : 'pp_balance';

    // Credit + Update game + Transaction log in parallel
    await Promise.all([
      client.query(`UPDATE users SET ${balCol} = ${balCol} + $1 WHERE LOWER(wallet_address) = LOWER($2)`, [payout, w]),
      client.query("UPDATE mines_games SET status = 'cashed', payout = $1, ended_at = NOW() WHERE id = $2", [payout, gameId]),
      client.query(
        `INSERT INTO transactions (type, from_wallet, ${game.currency === 'USDT' ? 'usdt_amount' : 'pp_amount'}, fee, meta)
         VALUES ('mines_win', $1, $2, 0, $3)`,
        [w, payout, JSON.stringify({ gameId, multiplier: parseFloat(game.current_multiplier), tilesRevealed: revealed.length, luckyCharmBonus: luckyPayout.luckyCharmBonus })]
      )
    ]);

    await client.query('COMMIT');
    if (dailyService) { try { await dailyService.updateMissionProgress(w, 'play_cantina', 1); } catch (_de) {} }
    res.json({
      success: true, payout, luckyCharmBonus: luckyPayout.luckyCharmBonus,
      multiplier: parseFloat(game.current_multiplier),
      currency: game.currency,
      grid: JSON.parse(game.grid)
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Arena] mines cashout:', e.message);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// GET /arena/mines/active — Get active game
router.get('/mines/active', requireAuth, async (req, res) => {
  try {
    const w = getAuthWallet(req);
    if (!w) return res.status(400).json({ error: 'Wallet required' });

    const r = await pool.query(
      "SELECT id, bet_amount, currency, mine_count, revealed, current_multiplier FROM mines_games WHERE LOWER(wallet) = LOWER($1) AND status = 'active' LIMIT 1",
      [w]
    );
    if (r.rows.length === 0) return res.json({ active: false });

    const g = r.rows[0];
    const revealed = JSON.parse(g.revealed);
    res.json({
      active: true,
      gameId: g.id,
      bet: parseFloat(g.bet_amount),
      currency: g.currency,
      mines: g.mine_count,
      revealed,
      multiplier: parseFloat(g.current_multiplier),
      nextMultiplier: minesMultiplier(revealed.length + 1, g.mine_count),
      potentialPayout: Math.round(parseFloat(g.bet_amount) * parseFloat(g.current_multiplier) * 10000) / 10000
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════
//  SANDSTORM SURVIVAL (Coin Flip)
// ══════════════════════════════════

router.post('/coinflip/play', requireAuth, betLimiter, async (req, res) => {
  const { amount, currency, choice } = req.body;
  const w = getAuthWallet(req);
  if (currency === 'USDT') return res.status(400).json({ error: 'Casino accepts PP only' }); // (솔벤시 v7.370) PP 전용
  const cur = 'PP';
  const bet = strictNumber(amount);
  const pick = choice === 'perish' ? 'perish' : 'survive';

  if (!w) return res.status(400).json({ error: 'Wallet required' });
  const s = await cfg();
  const minBet = parseFloat(s.coinflip_min_bet) || 0.1;
  const maxBet = parseFloat(s.coinflip_max_bet) || 500;
  if (!Number.isFinite(bet) || bet <= 0 || bet < minBet || bet > maxBet) {
    return res.status(400).json({ error: `Bet must be ${minBet}-${maxBet} ${cur}` });
  }

  const seed = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHmac('sha256', seed).update('coinflip').digest('hex');
  const result = parseInt(hash.slice(0, 8), 16) % 2 === 0 ? 'survive' : 'perish';
  const won = pick === result;
  // (v7.373) 공정 2배(50/50) × 하우스계수. 기본 15% 엣지 → 1.70배.
  const basePayout = won ? Math.round(bet * 2 * _houseFactor() * 1000000) / 1000000 : 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const luckyPayout = await applyLuckyCharmPayout(client, w, basePayout, cur);
    const payout = luckyPayout.payout;
    const balCol = cur === 'USDT' ? 'usdt_balance' : 'pp_balance';
    const uRes = await client.query(`SELECT ${balCol} as bal FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`, [w]);
    if (!uRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
    if (parseFloat(uRes.rows[0].bal) < bet) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient balance' }); }

    // Deduct bet (AND guard prevents negative on concurrent requests)
    const deductCf = await client.query(`UPDATE users SET ${balCol} = ${balCol} - $1 WHERE LOWER(wallet_address) = LOWER($2) AND ${balCol} >= $1`, [bet, w]);
    if (deductCf.rowCount === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient balance' }); }

    // Credit winnings
    if (won) {
      await client.query(`UPDATE users SET ${balCol} = ${balCol} + $1 WHERE LOWER(wallet_address) = LOWER($2)`, [payout, w]);
      await awardXP(client, w, Math.max(1, Math.floor(bet)));
    }

    // Record game
    await client.query(
      `INSERT INTO coinflip_games (wallet, bet_amount, currency, choice, result, payout, seed) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [w, bet, cur, pick, result, payout, seed]
    );

    // Referral commission — uplines get a small PP cut from cantina house edge, not gross wager
    if (cur === 'PP') {
      try {
        const referralBase = await getCantinaReferralBase(bet);
        if (referralBase > 0) {
          await creditReferralCommission(client, w, 'cantina', referralBase, 'pp');
        }
      } catch (_e) {}
    }

    const balRes = await client.query(`SELECT ${balCol} as bal FROM users WHERE LOWER(wallet_address) = LOWER($1)`, [w]);
    await client.query('COMMIT');

    res.json({ result, won, choice: pick, payout, luckyCharmBonus: luckyPayout.luckyCharmBonus, balance: parseFloat(balRes.rows[0].bal), hash: hash.slice(0, 16), seed });
    if (dailyService) { try { dailyService.updateMissionProgress(w, 'play_cantina', 1); } catch (_de) {} }
    if (seasonService) {
      seasonService.addSeasonScore(w, 'cantina', 1).catch(() => {});
      if (cur === 'PP') seasonService.addSeasonScore(w, 'pp_spend', 1).catch(() => {});
    }
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// GET /arena/coinflip/history
router.get('/coinflip/history', requireAuth, async (req, res) => {
  try {
    const w = getAuthWallet(req);
    if (!w) return res.json([]);
    const r = await pool.query(
      'SELECT id, choice, result, bet_amount, currency, payout, created_at FROM coinflip_games WHERE LOWER(wallet) = LOWER($1) ORDER BY id DESC LIMIT 20', [w]
    );
    res.json(r.rows.map(g => ({
      id: g.id, choice: g.choice, result: g.result,
      bet: parseFloat(g.bet_amount), currency: g.currency,
      payout: parseFloat(g.payout), time: g.created_at
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════
//  METEORITE PREDICTION (Dice)
// ══════════════════════════════════

router.post('/dice/play', requireAuth, betLimiter, async (req, res) => {
  const { amount, currency, target, direction } = req.body;
  const w = getAuthWallet(req);
  if (currency === 'USDT') return res.status(400).json({ error: 'Casino accepts PP only' }); // (솔벤시 v7.370) PP 전용
  const cur = 'PP';
  const bet = strictNumber(amount);
  const tgt = strictInteger(target);
  const dir = direction === 'under' ? 'under' : 'over';

  if (!w) return res.status(400).json({ error: 'Wallet required' });
  if (!Number.isInteger(tgt) || tgt < 1 || tgt > 98) return res.status(400).json({ error: 'Target must be 1-98' });

  const s = await cfg();
  const minBet = parseFloat(s.dice_min_bet) || 0.1;
  const maxBet = parseFloat(s.dice_max_bet) || 500;
  if (!Number.isFinite(bet) || bet <= 0 || bet < minBet || bet > maxBet) {
    return res.status(400).json({ error: `Bet must be ${minBet}-${maxBet} ${cur}` });
  }

  // Roll & multiplier
  const roll = parseInt(crypto.randomBytes(4).toString('hex'), 16) % 100; // 0-99
  const winChance = dir === 'over' ? (99 - tgt) : tgt;
  if (winChance <= 0) return res.status(400).json({ error: 'Invalid target' });
  const multiplier = Math.round((99 / winChance) * _houseFactor() * 10000) / 10000; // (v7.373) 하우스 엣지 설정 적용
  const won = dir === 'over' ? roll > tgt : roll < tgt;
  const basePayout = won ? Math.round(bet * multiplier * 1000000) / 1000000 : 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const luckyPayout = await applyLuckyCharmPayout(client, w, basePayout, cur);
    const payout = luckyPayout.payout;
    const balCol = cur === 'USDT' ? 'usdt_balance' : 'pp_balance';
    const uRes = await client.query(`SELECT ${balCol} as bal FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`, [w]);
    if (!uRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
    if (parseFloat(uRes.rows[0].bal) < bet) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient balance' }); }

    // Deduct bet (AND guard prevents negative on concurrent requests)
    const deductDice = await client.query(`UPDATE users SET ${balCol} = ${balCol} - $1 WHERE LOWER(wallet_address) = LOWER($2) AND ${balCol} >= $1`, [bet, w]);
    if (deductDice.rowCount === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient balance' }); }
    if (won) {
      await client.query(`UPDATE users SET ${balCol} = ${balCol} + $1 WHERE LOWER(wallet_address) = LOWER($2)`, [payout, w]);
      await awardXP(client, w, Math.max(1, Math.floor(bet)));
    }

    await client.query(
      `INSERT INTO dice_games (wallet, bet_amount, currency, target, direction, roll, multiplier, payout) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [w, bet, cur, tgt, dir, roll, multiplier, payout]
    );

    // Referral commission — uplines get a small PP cut from cantina house edge, not gross wager
    if (cur === 'PP') {
      try {
        const referralBase = await getCantinaReferralBase(bet);
        if (referralBase > 0) {
          await creditReferralCommission(client, w, 'cantina', referralBase, 'pp');
        }
      } catch (_e) {}
    }

    const balRes = await client.query(`SELECT ${balCol} as bal FROM users WHERE LOWER(wallet_address) = LOWER($1)`, [w]);
    await client.query('COMMIT');

    res.json({ roll, target: tgt, direction: dir, won, multiplier, payout, luckyCharmBonus: luckyPayout.luckyCharmBonus, balance: parseFloat(balRes.rows[0].bal) });
    if (dailyService) { try { dailyService.updateMissionProgress(w, 'play_cantina', 1); } catch (_de) {} }
    if (seasonService) {
      seasonService.addSeasonScore(w, 'cantina', 1).catch(() => {});
      if (cur === 'PP') seasonService.addSeasonScore(w, 'pp_spend', 1).catch(() => {});
    }
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════
//  TERRAIN SURVEY (Hi-Lo)
// ══════════════════════════════════

const SUITS = ['rock', 'dust', 'ice', 'iron'];
function drawCard() {
  return { value: Math.floor(Math.random() * 13) + 2, suit: SUITS[Math.floor(Math.random() * 4)] };
  // value: 2-14 (2-10, J=11, Q=12, K=13, A=14)
}
function cardName(v) {
  if (v <= 10) return '' + v;
  return { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[v];
}

// POST /arena/hilo/start
router.post('/hilo/start', requireAuth, betLimiter, async (req, res) => {
  const { amount, currency } = req.body;
  const w = getAuthWallet(req);
  if (currency === 'USDT') return res.status(400).json({ error: 'Casino accepts PP only' }); // (솔벤시 v7.370) PP 전용
  const cur = 'PP';
  const bet = strictNumber(amount);

  if (!w) return res.status(400).json({ error: 'Wallet required' });
  const s = await cfg();
  const minBet = parseFloat(s.hilo_min_bet) || 0.1;
  const maxBet = parseFloat(s.hilo_max_bet) || 500;
  if (!Number.isFinite(bet) || bet <= 0 || bet < minBet || bet > maxBet) {
    return res.status(400).json({ error: `Bet must be ${minBet}-${maxBet} ${cur}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check no active game
    const active = await client.query(
      "SELECT id FROM hilo_games WHERE LOWER(wallet) = LOWER($1) AND status = 'active'", [w]
    );
    if (active.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Active game exists', gameId: active.rows[0].id });
    }

    const balCol = cur === 'USDT' ? 'usdt_balance' : 'pp_balance';
    const uRes = await client.query(`SELECT ${balCol} as bal FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`, [w]);
    if (!uRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
    if (parseFloat(uRes.rows[0].bal) < bet) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient balance' }); }

    // Deduct bet (AND guard prevents negative on concurrent requests)
    const deductHilo = await client.query(`UPDATE users SET ${balCol} = ${balCol} - $1 WHERE LOWER(wallet_address) = LOWER($2) AND ${balCol} >= $1`, [bet, w]);
    if (deductHilo.rowCount === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient balance' }); }

    const firstCard = drawCard();
    const gameRes = await client.query(
      `INSERT INTO hilo_games (wallet, bet_amount, currency, cards, current_multiplier, status)
       VALUES ($1, $2, $3, $4, 1, 'active') RETURNING id`,
      [w, bet, cur, JSON.stringify([firstCard])]
    );

    // Referral commission — uplines get a small PP cut from cantina house edge, not gross wager
    if (cur === 'PP') {
      try {
        const referralBase = await getCantinaReferralBase(bet);
        if (referralBase > 0) {
          await creditReferralCommission(client, w, 'cantina', referralBase, 'pp');
        }
      } catch (_e) {}
    }

    await client.query('COMMIT');
    res.json({
      gameId: gameRes.rows[0].id,
      card: { value: firstCard.value, name: cardName(firstCard.value), suit: firstCard.suit },
      betAmount: bet, currency: cur, multiplier: 1
    });
    if (seasonService) {
      seasonService.addSeasonScore(w, 'cantina', 1).catch(() => {});
      if (cur === 'PP') seasonService.addSeasonScore(w, 'pp_spend', 1).catch(() => {});
    }
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// POST /arena/hilo/guess
router.post('/hilo/guess', requireAuth, betLimiter, async (req, res) => {
  const { gameId, guess } = req.body;
  const pick = guess === 'low' ? 'low' : 'high';
  const callerWallet = getAuthWallet(req);

  if (!gameId) return res.status(400).json({ error: 'gameId required' });

  await cfg(); // (v7.373) _houseFactor()가 최신 하우스엣지를 반영하도록 설정 캐시 갱신
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const gRes = await client.query(
      "SELECT * FROM hilo_games WHERE id = $1 AND status = 'active' FOR UPDATE", [gameId]
    );
    if (!gRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Game not found' }); }

    const g = gRes.rows[0];
    if ((g.wallet || '').toLowerCase() !== callerWallet) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'NOT_YOUR_GAME' });
    }
    const cards = typeof g.cards === 'string' ? JSON.parse(g.cards) : g.cards;
    const lastCard = cards[cards.length - 1];
    const newCard = drawCard();
    cards.push(newCard);

    let correct;
    if (newCard.value === lastCard.value) {
      correct = true; // Push = auto-win
    } else if (pick === 'high') {
      correct = newCard.value > lastCard.value;
    } else {
      correct = newCard.value < lastCard.value;
    }

    if (correct) {
      // Calculate multiplier for this guess.
      // (밸런스 v7.372) push(동점)도 승리(위 line의 correct=true)이므로 승리확률 =
      // (해당 방향 strictly 카드 + 동점 1랭크)/13. 기존 winCards=14-v는 동점을 빼고 13/winCards로
      // 과지급 → 모든 추측이 +EV(하우스 손실, 벽 카드 +96%)였다. 동점 랭크(+1)를 포함해 정확히
      // 2% 하우스엣지로 보정하고, winCards가 항상 ≥1이라 1.5 폴백도 제거.
      const higherCards = 14 - lastCard.value; // strictly higher
      const lowerCards = lastCard.value - 2;   // strictly lower
      const winCards = (pick === 'high' ? higherCards : lowerCards) + 1; // +1 = 동점 랭크도 승리
      const guessMult = Math.round((13 / winCards) * _houseFactor() * 10000) / 10000;
      const newMult = Math.round(parseFloat(g.current_multiplier) * guessMult * 10000) / 10000;

      await client.query(
        `UPDATE hilo_games SET cards = $1, current_multiplier = $2 WHERE id = $3`,
        [JSON.stringify(cards), newMult, gameId]
      );

      // Next guess multiplier preview (동점 랭크 +1 포함 — guessMult와 동일 공식)
      const nextHighMult = Math.round((13 / ((14 - newCard.value) + 1)) * _houseFactor() * 10000) / 10000;
      const nextLowMult  = Math.round((13 / ((newCard.value - 2) + 1)) * _houseFactor() * 10000) / 10000;

      await client.query('COMMIT');
      res.json({
        card: { value: newCard.value, name: cardName(newCard.value), suit: newCard.suit },
        correct: true, multiplier: newMult, guess: pick,
        potentialPayout: Math.round(parseFloat(g.bet_amount) * newMult * 10000) / 10000,
        nextHighMult, nextLowMult, round: cards.length - 1
      });
    } else {
      // Lose
      await client.query(
        `UPDATE hilo_games SET cards = $1, status = 'lost', current_multiplier = 0 WHERE id = $2`,
        [JSON.stringify(cards), gameId]
      );
      await client.query('COMMIT');
      res.json({
        card: { value: newCard.value, name: cardName(newCard.value), suit: newCard.suit },
        correct: false, multiplier: 0, guess: pick, gameOver: true, round: cards.length - 1
      });
    }
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// POST /arena/hilo/cashout
router.post('/hilo/cashout', requireAuth, betLimiter, async (req, res) => {
  const { gameId } = req.body;
  const callerWallet = getAuthWallet(req);
  if (!gameId) return res.status(400).json({ error: 'gameId required' });

  await cfg(); // (v7.373) _houseFactor()가 최신 하우스엣지를 반영하도록 설정 캐시 갱신
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const gRes = await client.query(
      "SELECT * FROM hilo_games WHERE id = $1 AND status = 'active' FOR UPDATE", [gameId]
    );
    if (!gRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Game not found' }); }

    const g = gRes.rows[0];
    if ((g.wallet || '').toLowerCase() !== callerWallet) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'NOT_YOUR_GAME' });
    }
    const cards = typeof g.cards === 'string' ? JSON.parse(g.cards) : g.cards;
    if (cards.length < 2) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Must guess at least once' }); }

    const basePayout = Math.round(parseFloat(g.bet_amount) * parseFloat(g.current_multiplier) * 1000000) / 1000000;
    const luckyPayout = await applyLuckyCharmPayout(client, g.wallet, basePayout, g.currency);
    const payout = luckyPayout.payout;
    const balCol = g.currency === 'USDT' ? 'usdt_balance' : 'pp_balance';

    await client.query(`UPDATE users SET ${balCol} = ${balCol} + $1 WHERE LOWER(wallet_address) = LOWER($2)`, [payout, g.wallet]);
    await client.query(
      `UPDATE hilo_games SET status = 'cashed_out', payout = $1 WHERE id = $2`, [payout, gameId]
    );
    await awardXP(client, g.wallet, Math.max(1, Math.floor(parseFloat(g.bet_amount))));

    const balRes = await client.query(`SELECT ${balCol} as bal FROM users WHERE LOWER(wallet_address) = LOWER($1)`, [g.wallet]);
    await client.query('COMMIT');

    res.json({
      payout, luckyCharmBonus: luckyPayout.luckyCharmBonus, multiplier: parseFloat(g.current_multiplier),
      balance: parseFloat(balRes.rows[0].bal), rounds: cards.length - 1
    });
    if (dailyService) { try { dailyService.updateMissionProgress(g.wallet, 'play_cantina', 1); } catch (_de) {} }
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// GET /arena/hilo/active
router.get('/hilo/active', requireAuth, async (req, res) => {
  try {
    const w = getAuthWallet(req);
    if (!w) return res.json({ active: false });
    const r = await pool.query(
      "SELECT * FROM hilo_games WHERE LOWER(wallet) = LOWER($1) AND status = 'active' ORDER BY id DESC LIMIT 1", [w]
    );
    if (!r.rows.length) return res.json({ active: false });
    const g = r.rows[0];
    const cards = typeof g.cards === 'string' ? JSON.parse(g.cards) : g.cards;
    const lastCard = cards[cards.length - 1];
    await cfg(); // (v7.373) 하우스엣지 freshness
    res.json({
      active: true, gameId: g.id, bet: parseFloat(g.bet_amount), currency: g.currency,
      cards: cards.map(c => ({ value: c.value, name: cardName(c.value), suit: c.suit })),
      multiplier: parseFloat(g.current_multiplier),
      potentialPayout: Math.round(parseFloat(g.bet_amount) * parseFloat(g.current_multiplier) * 10000) / 10000,
      // (v7.373) guessMult와 동일 공식 — 동점 랭크(+1) 포함 + 하우스계수
      nextHighMult: Math.round((13 / ((14 - lastCard.value) + 1)) * _houseFactor() * 10000) / 10000,
      nextLowMult: Math.round((13 / ((lastCard.value - 2) + 1)) * _houseFactor() * 10000) / 10000,
      round: cards.length - 1
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
