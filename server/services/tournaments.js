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

async function joinTournament(_wallet, _tournamentId) {
  throw Object.assign(new Error('Legacy manual tournaments are retired. Use fleet tournament registration.'), {
    status: 410, code: 'LEGACY_MANUAL_TOURNAMENT_RETIRED'
  });
}

// ── ADMIN ──────────────────────────────────────────────────────────────────────

async function adminCreateTournament(_data) {
  throw Object.assign(new Error('Legacy manual tournament creation is retired. Use fleet tournament admin controls.'), {
    status: 410, code: 'LEGACY_MANUAL_TOURNAMENT_RETIRED'
  });
}

// There is no type column. The fleet creator always stores a deadline, while
// manual creation omitted it. Also guard participant/match evidence for mixed
// historical records; defaults such as total_rounds do not distinguish types.
async function assertManualTournament(client, tournament) {
  if (tournament.registration_deadline != null) throw new Error('FLEET_TOURNAMENT_REQUIRES_BRACKET_CONTROLS');
  const evidence = await client.query(
    `SELECT EXISTS (SELECT 1 FROM tournament_participants WHERE tournament_id=$1)
       OR EXISTS (SELECT 1 FROM tournament_matches WHERE tournament_id=$1) AS fleet_tournament`,
    [tournament.id]
  );
  if (evidence.rows[0]?.fleet_tournament) throw new Error('FLEET_TOURNAMENT_REQUIRES_BRACKET_CONTROLS');
}

async function adminUpdateStatus(id, status) {
  // Terminal transitions must use the payout/refund transaction, and cannot reopen.
  const valid = ['open','running'];
  if (!valid.includes(status)) throw new Error('Use winner or cancel controls for terminal status');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = await client.query('SELECT * FROM tournaments WHERE id=$1 FOR UPDATE', [parseInt(id,10)]);
    if (!row.rows.length) throw new Error('Tournament not found');
    const tournament = row.rows[0];
    await assertManualTournament(client, tournament);
    if (!['open','running','registering','preparing','active'].includes(tournament.status)) {
      throw new Error('Tournament already closed');
    }
    await client.query('UPDATE tournaments SET status=$1 WHERE id=$2', [status, tournament.id]);
    await client.query('COMMIT');
    return { ok: true };
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function adminPickWinner(tournamentId, winnerWallet) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tRow = await client.query('SELECT * FROM tournaments WHERE id=$1 FOR UPDATE', [parseInt(tournamentId,10)]);
    if (!tRow.rows.length) throw new Error('Tournament not found');
    const t = tRow.rows[0];
    await assertManualTournament(client, t);
    if (!['open','running','registering','preparing','active'].includes(t.status)) {
      throw new Error('Tournament is closed; no prize can be paid');
    }

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
      'UPDATE tournaments SET status=$1, winner_wallet=$2, completed_at=NOW() WHERE id=$3',
      ['completed', winner, t.id]
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
    await assertManualTournament(client, t);
    if (['cancelled','refunded'].includes(t.status)) {
      await client.query('COMMIT');
      return { refunded: 0, entryFee: t.entry_fee_gp, alreadyCancelled: true };
    }
    if (!['open','running','registering','preparing','active'].includes(t.status)) {
      throw new Error('Cannot cancel closed tournament');
    }

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
