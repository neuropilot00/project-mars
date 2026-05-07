'use strict';
/**
 * Tournament Service — Migration 125
 * Admin creates GP-entry tournaments; winner takes the pot (minus house cut).
 */
const { pool, getSetting, logGPActivity } = require('../db');

let seasonService, weeklySvc, notifyPlayer;
try { seasonService = require('./season'); }           catch (_) {}
try { weeklySvc     = require('./weeklyChallenges'); } catch (_) {}
try { notifyPlayer  = require('../db').notifyPlayer; } catch (_) {}

async function getCfg() {
  const [enabled, housePct, minPlayers] = await Promise.all([
    getSetting('tournament_enabled', 'true'),
    getSetting('tournament_house_cut_pct', '10'),
    getSetting('tournament_min_players', '2'),
  ]);
  return {
    enabled:    enabled === 'true',
    housePct:   parseInt(housePct, 10),
    minPlayers: parseInt(minPlayers, 10),
  };
}

// ── READ ──────────────────────────────────────────────────────────────────────

async function getTournaments(status = null) {
  const where = status ? "WHERE t.status=$1" : "WHERE t.status IN ('open','running')";
  const params = status ? [status] : [];
  const r = await pool.query(`
    SELECT t.*,
           COUNT(e.id)::int AS entry_count
      FROM tournaments t
      LEFT JOIN tournament_entries e ON e.tournament_id = t.id
    ${where}
    GROUP BY t.id
    ORDER BY t.created_at DESC
    LIMIT 50
  `, params);
  return r.rows;
}

async function getTournament(id) {
  const [t, entries] = await Promise.all([
    pool.query('SELECT * FROM tournaments WHERE id=$1', [id]),
    pool.query(
      'SELECT wallet, registered_at FROM tournament_entries WHERE tournament_id=$1 ORDER BY registered_at',
      [id]
    ),
  ]);
  if (!t.rows.length) return null;
  return { ...t.rows[0], entries: entries.rows };
}

async function getMyTournaments(wallet) {
  const r = await pool.query(`
    SELECT t.*, e.registered_at
      FROM tournament_entries e
      JOIN tournaments t ON t.id = e.tournament_id
     WHERE e.wallet=$1
     ORDER BY e.registered_at DESC
     LIMIT 30
  `, [wallet.toLowerCase()]);
  return r.rows;
}

// ── JOIN ──────────────────────────────────────────────────────────────────────

async function joinTournament(wallet, tournamentId) {
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Tournaments are disabled');
  wallet = wallet.toLowerCase();
  tournamentId = parseInt(tournamentId, 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tRow = await client.query('SELECT * FROM tournaments WHERE id=$1 FOR UPDATE', [tournamentId]);
    if (!tRow.rows.length) throw new Error('Tournament not found');
    const t = tRow.rows[0];
    if (t.status !== 'open') throw new Error(`Tournament is ${t.status}, not open for registration`);

    // [v7.60] Check for duplicate entry BEFORE GP deduction to prevent double-charge
    const dupCheck = await client.query(
      'SELECT 1 FROM tournament_entries WHERE tournament_id=$1 AND wallet=$2',
      [tournamentId, wallet]
    );
    if (dupCheck.rows.length) throw new Error('ALREADY_ENTERED');

    if (t.max_players) {
      const cnt = await client.query('SELECT COUNT(*) AS n FROM tournament_entries WHERE tournament_id=$1', [tournamentId]);
      if (parseInt(cnt.rows[0].n, 10) >= t.max_players) throw new Error('Tournament is full');
    }

    const gpCost = t.entry_fee_gp;
    const bal    = await client.query('SELECT gp_balance AS balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE', [wallet]);
    const balance = bal.rows.length ? parseInt(bal.rows[0].balance, 10) : 0;
    if (balance < gpCost) throw new Error(`Insufficient GP. Need ${gpCost}, have ${balance}`);

    // Deduct GP
    const tnDeduct = await client.query('UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND gp_balance >= $1', [gpCost, wallet]);
    if (tnDeduct.rowCount === 0) throw new Error('INSUFFICIENT_GP');
    await client.query(
      "INSERT INTO gp_transactions(wallet,amount,type,note) VALUES($1,$2,'tournament_entry',$3)",
      [wallet, -gpCost, `Entered ${t.name} (#${tournamentId})`]
    );

    // House cut burned, rest to prize pool
    const houseCut  = Math.floor(gpCost * cfg.housePct / 100);
    const toPrize   = gpCost - houseCut;
    await client.query(
      'UPDATE tournaments SET prize_pool_gp=prize_pool_gp+$1 WHERE id=$2',
      [toPrize, tournamentId]
    );

    // Register entry
    await client.query(
      'INSERT INTO tournament_entries(tournament_id, wallet) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [tournamentId, wallet]
    );

    await client.query('COMMIT');

    // Side effects
    if (logGPActivity) logGPActivity(wallet, -gpCost, 'tournament', `Entry: ${t.name}`).catch(() => {});
    if (seasonService && seasonService.trackGPSpend) seasonService.trackGPSpend(wallet, gpCost).catch(() => {});
    if (weeklySvc && weeklySvc.trackProgress) weeklySvc.trackProgress(wallet, 'gp_burn', gpCost).catch(() => {});

    return { tournamentId, tournamentName: t.name, gpSpent: gpCost, addedToPrize: toPrize };
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

// ── ADMIN ──────────────────────────────────────────────────────────────────────

async function adminCreateTournament(data) {
  const { name, description, icon, entryFeeGp, maxPlayers, startsAt, endsAt } = data;
  if (!name) throw new Error('name required');
  const r = await pool.query(
    'INSERT INTO tournaments(name,description,icon,entry_fee_gp,max_players,starts_at,ends_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [name, description || null, icon || '🏆', parseInt(entryFeeGp,10)||50, maxPlayers||null, startsAt||null, endsAt||null]
  );
  return r.rows[0];
}

async function adminUpdateStatus(id, status) {
  const valid = ['open','running','completed','cancelled'];
  if (!valid.includes(status)) throw new Error('Invalid status');
  await pool.query('UPDATE tournaments SET status=$1 WHERE id=$2', [status, parseInt(id,10)]);
  return { ok: true };
}

async function adminPickWinner(tournamentId, winnerWallet) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tRow = await client.query('SELECT * FROM tournaments WHERE id=$1 FOR UPDATE', [parseInt(tournamentId,10)]);
    if (!tRow.rows.length) throw new Error('Tournament not found');
    const t = tRow.rows[0];
    if (t.status === 'completed') throw new Error('Already completed');

    // Verify winner is an entrant
    const entry = await client.query(
      'SELECT id FROM tournament_entries WHERE tournament_id=$1 AND wallet=$2',
      [t.id, winnerWallet.toLowerCase()]
    );
    if (!entry.rows.length) throw new Error('Winner must be a registered entrant');

    const prize = t.prize_pool_gp;
    const winner = winnerWallet.toLowerCase();

    // Award prize
    await client.query(
      'UPDATE users SET gp_balance = gp_balance + $2 WHERE LOWER(wallet_address) = LOWER($1)',
      [winner, prize]
    );
    await client.query(
      "INSERT INTO gp_transactions(wallet,amount,type,note) VALUES($1,$2,'tournament_win',$3)",
      [winner, prize, `Won ${t.name} (#${t.id})`]
    );
    await client.query(
      'UPDATE tournaments SET status=$1, winner_wallet=$2, winner_prize=$3 WHERE id=$4',
      ['completed', winner, prize, t.id]
    );

    await client.query('COMMIT');

    if (notifyPlayer) notifyPlayer(winner, `🏆 You won ${t.name}! +${prize} GP`, 'tournament').catch(() => {});
    if (logGPActivity) logGPActivity(winner, prize, 'tournament_win', `Won ${t.name}`).catch(() => {});

    return { tournamentId: t.id, winner, prize };
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function adminCancelTournament(tournamentId) {
  // Refund all entrants
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tRow = await client.query('SELECT * FROM tournaments WHERE id=$1 FOR UPDATE', [parseInt(tournamentId,10)]);
    if (!tRow.rows.length) throw new Error('Tournament not found');
    const t = tRow.rows[0];
    if (t.status === 'completed') throw new Error('Cannot cancel completed tournament');

    const entries = await client.query('SELECT wallet FROM tournament_entries WHERE tournament_id=$1', [t.id]);
    for (const e of entries.rows) {
      await client.query(
        'UPDATE users SET gp_balance = gp_balance + $2 WHERE LOWER(wallet_address) = LOWER($1)',
        [e.wallet, t.entry_fee_gp]
      );
      await client.query(
        "INSERT INTO gp_transactions(wallet,amount,type,note) VALUES($1,$2,'tournament_refund',$3)",
        [e.wallet, t.entry_fee_gp, `Refund: ${t.name} cancelled`]
      );
    }
    await client.query("UPDATE tournaments SET status='cancelled' WHERE id=$1", [t.id]);
    await client.query('COMMIT');
    return { refunded: entries.rows.length, entryFee: t.entry_fee_gp };
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function getAdminStats() {
  const [totals, open, recent, settings] = await Promise.all([
    pool.query("SELECT COUNT(*) AS total, COALESCE(SUM(prize_pool_gp),0) AS total_prizes FROM tournaments"),
    pool.query("SELECT t.*, COUNT(e.id)::int AS entry_count FROM tournaments t LEFT JOIN tournament_entries e ON e.tournament_id=t.id WHERE t.status IN ('open','running') GROUP BY t.id ORDER BY t.created_at DESC LIMIT 10"),
    pool.query("SELECT t.*, COUNT(e.id)::int AS entry_count FROM tournaments t LEFT JOIN tournament_entries e ON e.tournament_id=t.id WHERE t.status IN ('completed','cancelled') GROUP BY t.id ORDER BY t.created_at DESC LIMIT 10"),
    pool.query("SELECT key, value FROM game_settings WHERE category='tournament' ORDER BY key"),
  ]);
  return {
    totalTournaments: parseInt(totals.rows[0].total, 10),
    totalPrizes: parseInt(totals.rows[0].total_prizes, 10),
    open: open.rows,
    recent: recent.rows,
    settings: Object.fromEntries(settings.rows.map(r => [r.key, r.value])),
  };
}

module.exports = { getTournaments, getTournament, getMyTournaments, joinTournament, adminCreateTournament, adminUpdateStatus, adminPickWinner, adminCancelTournament, getAdminStats, getCfg };
