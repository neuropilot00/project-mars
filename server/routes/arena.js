const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { pool, getSettings, awardXP } = require('../db');

const router = express.Router();

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

// ══════════════════════════════════
//  CRASH GAME
// ══════════════════════════════════

// Generate provably fair crash point
const CRASH_MAX_MULT = 100; // Maximum multiplier cap
function generateCrashPoint(seed) {
  const hash = crypto.createHmac('sha256', seed).update('crash').digest('hex');
  const h = parseInt(hash.slice(0, 13), 16);
  const e = Math.pow(2, 52);
  // House edge 4%: 1 in 25 chance of instant crash (1.00x)
  if (h % 25 === 0) return 1.00;
  const raw = Math.max(1.00, Math.floor((100 * e - h) / (e - h)) / 100);
  return Math.min(raw, CRASH_MAX_MULT); // Cap at 100x
}

// GET /arena/crash/current — Get current round
router.get('/crash/current', async (req, res) => {
  try {
    // Find active round or create one
    let round = await pool.query(
      "SELECT * FROM crash_rounds WHERE status IN ('waiting','running') ORDER BY id DESC LIMIT 1"
    );

    if (round.rows.length === 0) {
      // Create new round
      const seed = crypto.randomBytes(32).toString('hex');
      const crashPoint = generateCrashPoint(seed);
      const hash = crypto.createHash('sha256').update(seed).digest('hex');

      const r = await pool.query(
        `INSERT INTO crash_rounds (crash_point, hash, status)
         VALUES ($1, $2, 'waiting') RETURNING *`,
        [crashPoint, hash]
      );
      round = { rows: [r.rows[0]] };
    }

    const r = round.rows[0];

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
    console.error('[Arena] crash current:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /arena/crash/bet — Place a bet
router.post('/crash/bet', betLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    const { wallet, amount, currency } = req.body;
    const w = (wallet || '').toLowerCase().trim();
    const cur = currency === 'USDT' ? 'USDT' : 'PP';
    const bet = parseFloat(amount);
    const s = await cfg();

    if (!w) return res.status(400).json({ error: 'Wallet required' });
    const minBet = parseFloat(s.crash_min_bet) || 0.1;
    const maxBet = parseFloat(s.crash_max_bet) || 50;
    if (!bet || bet < minBet || bet > maxBet) {
      return res.status(400).json({ error: `Bet must be ${minBet}-${maxBet} ${cur}` });
    }

    await client.query('BEGIN');

    // Check balance
    const balCol = cur === 'USDT' ? 'usdt_balance' : 'pp_balance';
    const userRes = await client.query(
      `SELECT ${balCol} as bal FROM users WHERE wallet_address = $1 FOR UPDATE`, [w]
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
      'SELECT id FROM crash_bets WHERE round_id = $1 AND wallet = $2', [roundId, w]
    );
    if (existBet.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already bet this round' });
    }

    // Deduct balance
    await client.query(
      `UPDATE users SET ${balCol} = ${balCol} - $1 WHERE wallet_address = $2`, [bet, w]
    );

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

    await client.query('COMMIT');
    res.json({ success: true, roundId, bet, currency: cur });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Arena] crash bet:', e.message);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// POST /arena/crash/cashout — Cash out during a round
router.post('/crash/cashout', betLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    const { wallet, multiplier } = req.body;
    const w = (wallet || '').toLowerCase().trim();
    const cashoutAt = parseFloat(multiplier);

    if (!w || !cashoutAt || cashoutAt < 1.01) {
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

    // Find active bet
    const betRes = await client.query(
      "SELECT * FROM crash_bets WHERE round_id = $1 AND wallet = $2 AND status = 'active' FOR UPDATE",
      [round.id, w]
    );
    if (betRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active bet' });
    }

    const bet = betRes.rows[0];
    const payout = Math.round(parseFloat(bet.bet_amount) * cashoutAt * 10000) / 10000;
    const balCol = bet.currency === 'USDT' ? 'usdt_balance' : 'pp_balance';

    // Update bet
    await client.query(
      "UPDATE crash_bets SET cashout_at = $1, payout = $2, status = 'cashed' WHERE id = $3",
      [cashoutAt, payout, bet.id]
    );

    // Credit winnings
    await client.query(
      `UPDATE users SET ${balCol} = ${balCol} + $1 WHERE wallet_address = $2`, [payout, w]
    );

    // Transaction log
    await client.query(
      `INSERT INTO transactions (type, from_wallet, ${bet.currency === 'USDT' ? 'usdt_amount' : 'pp_amount'}, fee, meta)
       VALUES ('crash_win', $1, $2, 0, $3)`,
      [w, payout, JSON.stringify({ roundId: round.id, multiplier: cashoutAt, bet: parseFloat(bet.bet_amount) })]
    );

    await client.query('COMMIT');
    res.json({ success: true, cashoutAt, payout, currency: bet.currency });
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

// POST /arena/crash/start — Start a round (called by game loop)
router.post('/crash/start', async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE crash_rounds SET status = 'running', started_at = NOW() WHERE status = 'waiting' RETURNING *"
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'No waiting round' });
    res.json({ roundId: result.rows[0].id, started: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
        await client.query(
          "UPDATE crash_bets SET status = 'busted' WHERE round_id = $1 AND status = 'active'", [round.id]
        );

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
  const key = revealed + '_' + mineCount;
  if (_multCache[key]) return _multCache[key];
  const safeTotal = 25 - mineCount;
  let mult = 1;
  for (let i = 0; i < revealed; i++) {
    mult *= (25 - i) / (safeTotal - i);
  }
  const result = Math.round(mult * 0.97 * 10000) / 10000; // 3% house edge
  _multCache[key] = result;
  return result;
}

// POST /arena/mines/start — Start a new mines game
router.post('/mines/start', betLimiter, async (req, res) => {
  // Validate outside transaction
  const { wallet, amount, currency, mines } = req.body;
  const w = (wallet || '').toLowerCase().trim();
  const cur = currency === 'USDT' ? 'USDT' : 'PP';
  const bet = parseFloat(amount);
  const mineCount = Math.max(1, Math.min(24, parseInt(mines) || 5));

  if (!w) return res.status(400).json({ error: 'Wallet required' });
  const s = await cfg();
  const minBet = parseFloat(s.mines_min_bet) || 0.1;
  const maxBet = parseFloat(s.mines_max_bet) || 1000;
  if (!bet || bet < minBet || bet > maxBet) {
    return res.status(400).json({ error: `Bet must be ${minBet}-${maxBet} ${cur}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check no active game + balance in parallel
    const balCol = cur === 'USDT' ? 'usdt_balance' : 'pp_balance';
    const [activeGame, userRes] = await Promise.all([
      client.query("SELECT id FROM mines_games WHERE wallet = $1 AND status = 'active'", [w]),
      client.query(`SELECT ${balCol} as bal FROM users WHERE wallet_address = $1 FOR UPDATE`, [w])
    ]);

    if (activeGame.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Finish your current game first', gameId: activeGame.rows[0].id });
    }
    if (userRes.rows.length === 0 || parseFloat(userRes.rows[0].bal) < bet) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct + Create game in parallel
    const grid = generateMinesGrid(mineCount);
    const [, gameRes] = await Promise.all([
      client.query(`UPDATE users SET ${balCol} = ${balCol} - $1 WHERE wallet_address = $2`, [bet, w]),
      client.query(
        `INSERT INTO mines_games (wallet, bet_amount, currency, mine_count, grid, current_multiplier)
         VALUES ($1,$2,$3,$4,$5,1.0) RETURNING id`,
        [w, bet, cur, mineCount, grid]
      )
    ]);

    // Transaction log + XP in parallel
    await Promise.all([
      client.query(
        `INSERT INTO transactions (type, from_wallet, ${cur === 'USDT' ? 'usdt_amount' : 'pp_amount'}, fee, meta)
         VALUES ('mines_bet', $1, $2, 0, $3)`,
        [w, bet, JSON.stringify({ gameId: gameRes.rows[0].id, mines: mineCount })]
      ),
      awardXP(client, w, 1)
    ]);

    await client.query('COMMIT');
    res.json({
      gameId: gameRes.rows[0].id,
      bet, currency: cur,
      mines: mineCount,
      multiplier: 1.0,
      nextMultiplier: minesMultiplier(1, mineCount)
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Arena] mines start:', e.message);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// POST /arena/mines/reveal — Reveal a tile
router.post('/mines/reveal', betLimiter, async (req, res) => {
  // Validate outside transaction
  const { wallet, gameId, position } = req.body;
  const w = (wallet || '').toLowerCase().trim();
  const pos = parseInt(position);
  if (!w || !gameId || pos < 0 || pos > 24) {
    return res.status(400).json({ error: 'Invalid params' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gameRes = await client.query(
      "SELECT id, grid, revealed, mine_count, bet_amount FROM mines_games WHERE id = $1 AND wallet = $2 AND status = 'active' FOR UPDATE",
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
router.post('/mines/cashout', betLimiter, async (req, res) => {
  const { wallet, gameId } = req.body;
  const w = (wallet || '').toLowerCase().trim();
  if (!w || !gameId) return res.status(400).json({ error: 'Missing params' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gameRes = await client.query(
      "SELECT id, bet_amount, currency, current_multiplier, revealed, grid FROM mines_games WHERE id = $1 AND wallet = $2 AND status = 'active' FOR UPDATE",
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

    const payout = Math.round(parseFloat(game.bet_amount) * parseFloat(game.current_multiplier) * 10000) / 10000;
    const balCol = game.currency === 'USDT' ? 'usdt_balance' : 'pp_balance';

    // Credit + Update game + Transaction log in parallel
    await Promise.all([
      client.query(`UPDATE users SET ${balCol} = ${balCol} + $1 WHERE wallet_address = $2`, [payout, w]),
      client.query("UPDATE mines_games SET status = 'cashed', payout = $1, ended_at = NOW() WHERE id = $2", [payout, gameId]),
      client.query(
        `INSERT INTO transactions (type, from_wallet, ${game.currency === 'USDT' ? 'usdt_amount' : 'pp_amount'}, fee, meta)
         VALUES ('mines_win', $1, $2, 0, $3)`,
        [w, payout, JSON.stringify({ gameId, multiplier: parseFloat(game.current_multiplier), tilesRevealed: revealed.length })]
      )
    ]);

    await client.query('COMMIT');
    res.json({
      success: true, payout,
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
router.get('/mines/active', async (req, res) => {
  try {
    const w = (req.query.wallet || '').toLowerCase().trim();
    if (!w) return res.status(400).json({ error: 'Wallet required' });

    const r = await pool.query(
      "SELECT id, bet_amount, currency, mine_count, revealed, current_multiplier FROM mines_games WHERE wallet = $1 AND status = 'active' LIMIT 1",
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

router.post('/coinflip/play', betLimiter, async (req, res) => {
  const { wallet, amount, currency, choice } = req.body;
  const w = (wallet || '').toLowerCase().trim();
  const cur = currency === 'USDT' ? 'USDT' : 'PP';
  const bet = parseFloat(amount);
  const pick = choice === 'perish' ? 'perish' : 'survive';

  if (!w) return res.status(400).json({ error: 'Wallet required' });
  const s = await cfg();
  const minBet = parseFloat(s.coinflip_min_bet) || 0.1;
  const maxBet = parseFloat(s.coinflip_max_bet) || 500;
  if (!bet || bet < minBet || bet > maxBet) {
    return res.status(400).json({ error: `Bet must be ${minBet}-${maxBet} ${cur}` });
  }

  const seed = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHmac('sha256', seed).update('coinflip').digest('hex');
  const result = parseInt(hash.slice(0, 8), 16) % 2 === 0 ? 'survive' : 'perish';
  const won = pick === result;
  const payout = won ? Math.round(bet * 1.96 * 1000000) / 1000000 : 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const balCol = cur === 'USDT' ? 'usdt_balance' : 'pp_balance';
    const uRes = await client.query(`SELECT ${balCol} as bal FROM users WHERE wallet_address = $1`, [w]);
    if (!uRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
    if (parseFloat(uRes.rows[0].bal) < bet) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient balance' }); }

    // Deduct bet
    await client.query(`UPDATE users SET ${balCol} = ${balCol} - $1 WHERE wallet_address = $2`, [bet, w]);

    // Credit winnings
    if (won) {
      await client.query(`UPDATE users SET ${balCol} = ${balCol} + $1 WHERE wallet_address = $2`, [payout, w]);
      await awardXP(client, w, Math.max(1, Math.floor(bet)));
    }

    // Record game
    await client.query(
      `INSERT INTO coinflip_games (wallet, bet_amount, currency, choice, result, payout, seed) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [w, bet, cur, pick, result, payout, seed]
    );

    const balRes = await client.query(`SELECT ${balCol} as bal FROM users WHERE wallet_address = $1`, [w]);
    await client.query('COMMIT');

    res.json({ result, won, choice: pick, payout, balance: parseFloat(balRes.rows[0].bal), hash: hash.slice(0, 16), seed });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// GET /arena/coinflip/history
router.get('/coinflip/history', async (req, res) => {
  try {
    const w = (req.query.wallet || '').toLowerCase().trim();
    if (!w) return res.json([]);
    const r = await pool.query(
      'SELECT id, choice, result, bet_amount, currency, payout, created_at FROM coinflip_games WHERE wallet = $1 ORDER BY id DESC LIMIT 20', [w]
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

router.post('/dice/play', betLimiter, async (req, res) => {
  const { wallet, amount, currency, target, direction } = req.body;
  const w = (wallet || '').toLowerCase().trim();
  const cur = currency === 'USDT' ? 'USDT' : 'PP';
  const bet = parseFloat(amount);
  const tgt = parseInt(target);
  const dir = direction === 'under' ? 'under' : 'over';

  if (!w) return res.status(400).json({ error: 'Wallet required' });
  if (isNaN(tgt) || tgt < 1 || tgt > 98) return res.status(400).json({ error: 'Target must be 1-98' });

  const s = await cfg();
  const minBet = parseFloat(s.dice_min_bet) || 0.1;
  const maxBet = parseFloat(s.dice_max_bet) || 500;
  if (!bet || bet < minBet || bet > maxBet) {
    return res.status(400).json({ error: `Bet must be ${minBet}-${maxBet} ${cur}` });
  }

  // Roll & multiplier
  const roll = parseInt(crypto.randomBytes(4).toString('hex'), 16) % 100; // 0-99
  const winChance = dir === 'over' ? (99 - tgt) : tgt;
  if (winChance <= 0) return res.status(400).json({ error: 'Invalid target' });
  const multiplier = Math.round((99 / winChance) * 0.98 * 10000) / 10000; // 2% house edge
  const won = dir === 'over' ? roll > tgt : roll < tgt;
  const payout = won ? Math.round(bet * multiplier * 1000000) / 1000000 : 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const balCol = cur === 'USDT' ? 'usdt_balance' : 'pp_balance';
    const uRes = await client.query(`SELECT ${balCol} as bal FROM users WHERE wallet_address = $1`, [w]);
    if (!uRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
    if (parseFloat(uRes.rows[0].bal) < bet) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient balance' }); }

    await client.query(`UPDATE users SET ${balCol} = ${balCol} - $1 WHERE wallet_address = $2`, [bet, w]);
    if (won) {
      await client.query(`UPDATE users SET ${balCol} = ${balCol} + $1 WHERE wallet_address = $2`, [payout, w]);
      await awardXP(client, w, Math.max(1, Math.floor(bet)));
    }

    await client.query(
      `INSERT INTO dice_games (wallet, bet_amount, currency, target, direction, roll, multiplier, payout) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [w, bet, cur, tgt, dir, roll, multiplier, payout]
    );

    const balRes = await client.query(`SELECT ${balCol} as bal FROM users WHERE wallet_address = $1`, [w]);
    await client.query('COMMIT');

    res.json({ roll, target: tgt, direction: dir, won, multiplier, payout, balance: parseFloat(balRes.rows[0].bal) });
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
router.post('/hilo/start', betLimiter, async (req, res) => {
  const { wallet, amount, currency } = req.body;
  const w = (wallet || '').toLowerCase().trim();
  const cur = currency === 'USDT' ? 'USDT' : 'PP';
  const bet = parseFloat(amount);

  if (!w) return res.status(400).json({ error: 'Wallet required' });
  const s = await cfg();
  const minBet = parseFloat(s.hilo_min_bet) || 0.1;
  const maxBet = parseFloat(s.hilo_max_bet) || 500;
  if (!bet || bet < minBet || bet > maxBet) {
    return res.status(400).json({ error: `Bet must be ${minBet}-${maxBet} ${cur}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check no active game
    const active = await client.query(
      "SELECT id FROM hilo_games WHERE wallet = $1 AND status = 'active'", [w]
    );
    if (active.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Active game exists', gameId: active.rows[0].id });
    }

    const balCol = cur === 'USDT' ? 'usdt_balance' : 'pp_balance';
    const uRes = await client.query(`SELECT ${balCol} as bal FROM users WHERE wallet_address = $1`, [w]);
    if (!uRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
    if (parseFloat(uRes.rows[0].bal) < bet) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient balance' }); }

    await client.query(`UPDATE users SET ${balCol} = ${balCol} - $1 WHERE wallet_address = $2`, [bet, w]);

    const firstCard = drawCard();
    const gameRes = await client.query(
      `INSERT INTO hilo_games (wallet, bet_amount, currency, cards, current_multiplier, status)
       VALUES ($1, $2, $3, $4, 1, 'active') RETURNING id`,
      [w, bet, cur, JSON.stringify([firstCard])]
    );

    await client.query('COMMIT');
    res.json({
      gameId: gameRes.rows[0].id,
      card: { value: firstCard.value, name: cardName(firstCard.value), suit: firstCard.suit },
      betAmount: bet, currency: cur, multiplier: 1
    });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// POST /arena/hilo/guess
router.post('/hilo/guess', betLimiter, async (req, res) => {
  const { gameId, guess } = req.body;
  const pick = guess === 'low' ? 'low' : 'high';

  if (!gameId) return res.status(400).json({ error: 'gameId required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const gRes = await client.query(
      "SELECT * FROM hilo_games WHERE id = $1 AND status = 'active' FOR UPDATE", [gameId]
    );
    if (!gRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Game not found' }); }

    const g = gRes.rows[0];
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
      // Calculate multiplier for this guess
      const higherCards = 14 - lastCard.value; // cards strictly higher
      const lowerCards = lastCard.value - 2; // cards strictly lower
      const winCards = pick === 'high' ? higherCards : lowerCards;
      const guessMult = winCards > 0 ? Math.round((13 / Math.max(winCards, 1)) * 0.98 * 10000) / 10000 : 1.5;
      const newMult = Math.round(parseFloat(g.current_multiplier) * guessMult * 10000) / 10000;

      await client.query(
        `UPDATE hilo_games SET cards = $1, current_multiplier = $2 WHERE id = $3`,
        [JSON.stringify(cards), newMult, gameId]
      );

      // Next guess multiplier preview
      const nextHigher = 14 - newCard.value;
      const nextLower = newCard.value - 2;
      const nextHighMult = nextHigher > 0 ? Math.round((13 / nextHigher) * 0.98 * 10000) / 10000 : 99;
      const nextLowMult = nextLower > 0 ? Math.round((13 / nextLower) * 0.98 * 10000) / 10000 : 99;

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
router.post('/hilo/cashout', betLimiter, async (req, res) => {
  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ error: 'gameId required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const gRes = await client.query(
      "SELECT * FROM hilo_games WHERE id = $1 AND status = 'active' FOR UPDATE", [gameId]
    );
    if (!gRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Game not found' }); }

    const g = gRes.rows[0];
    const cards = typeof g.cards === 'string' ? JSON.parse(g.cards) : g.cards;
    if (cards.length < 2) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Must guess at least once' }); }

    const payout = Math.round(parseFloat(g.bet_amount) * parseFloat(g.current_multiplier) * 1000000) / 1000000;
    const balCol = g.currency === 'USDT' ? 'usdt_balance' : 'pp_balance';

    await client.query(`UPDATE users SET ${balCol} = ${balCol} + $1 WHERE wallet_address = $2`, [payout, g.wallet]);
    await client.query(
      `UPDATE hilo_games SET status = 'cashed_out', payout = $1 WHERE id = $2`, [payout, gameId]
    );
    await awardXP(client, g.wallet, Math.max(1, Math.floor(parseFloat(g.bet_amount))));

    const balRes = await client.query(`SELECT ${balCol} as bal FROM users WHERE wallet_address = $1`, [g.wallet]);
    await client.query('COMMIT');

    res.json({
      payout, multiplier: parseFloat(g.current_multiplier),
      balance: parseFloat(balRes.rows[0].bal), rounds: cards.length - 1
    });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// GET /arena/hilo/active
router.get('/hilo/active', async (req, res) => {
  try {
    const w = (req.query.wallet || '').toLowerCase().trim();
    if (!w) return res.json({ active: false });
    const r = await pool.query(
      "SELECT * FROM hilo_games WHERE wallet = $1 AND status = 'active' ORDER BY id DESC LIMIT 1", [w]
    );
    if (!r.rows.length) return res.json({ active: false });
    const g = r.rows[0];
    const cards = typeof g.cards === 'string' ? JSON.parse(g.cards) : g.cards;
    const lastCard = cards[cards.length - 1];
    const nextHigher = 14 - lastCard.value;
    const nextLower = lastCard.value - 2;
    res.json({
      active: true, gameId: g.id, bet: parseFloat(g.bet_amount), currency: g.currency,
      cards: cards.map(c => ({ value: c.value, name: cardName(c.value), suit: c.suit })),
      multiplier: parseFloat(g.current_multiplier),
      potentialPayout: Math.round(parseFloat(g.bet_amount) * parseFloat(g.current_multiplier) * 10000) / 10000,
      nextHighMult: nextHigher > 0 ? Math.round((13 / nextHigher) * 0.98 * 10000) / 10000 : 99,
      nextLowMult: nextLower > 0 ? Math.round((13 / nextLower) * 0.98 * 10000) / 10000 : 99,
      round: cards.length - 1
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
