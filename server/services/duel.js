// ═══════════════════════════════════════════════════════════════
// services/duel.js — 1:1 GP 도전장 (Phase D / M-157)
//
// 인프라:
//   - 테이블: gp_duels (M-157)
//   - 잔액 SSOT: users.gp_balance
//   - 설정 SSOT: settings (key PK)
//   - 결과 결정론: fight_seed 기반 LCG → 통계가 적은 신규 유저도
//     공정한 5050 + 약간의 stat 가중치 (career_stats 없으면 0)
//
// API 함수:
//   challenge(challenger, defender, wagerGp)
//   acceptDuel(duelId, defender)
//   declineDuel(duelId, defender)
//   cancelDuel(duelId, challenger)
//   expireDuels()                          ← 스케줄러용
//   getMyDuels(wallet, limit)
//   getPendingForMe(wallet)
//   getRecentResolved(limit)
//   getAdminStats()
//
// 모든 수치는 settings에서 (하드코딩 금지).
// ═══════════════════════════════════════════════════════════════

'use strict';
const crypto = require('crypto');
const { pool, getSetting, logGPActivity } = require('../db');

// ── helpers ─────────────────────────────────────────────────────
async function getCfg() {
  const [
    enabled, minStake, maxStake, expiryHours, maxPair, maxPerUser, feePct, winnerCutPct
  ] = await Promise.all([
    getSetting('duel_enabled', 'true'),
    getSetting('duel_min_stake_gp', '10'),
    getSetting('duel_max_stake_gp', '5000'),
    getSetting('duel_default_expiry_hours', '24'),
    getSetting('duel_max_pending_per_pair', '1'),
    getSetting('duel_max_active_per_user', '5'),
    getSetting('duel_fee_pct', '5'),
    getSetting('duel_winner_cut_pct', '95'),  // 승자가 가져가는 pot %
  ]);
  return {
    enabled: String(enabled) !== 'false',
    minStake: parseInt(minStake) || 10,
    maxStake: parseInt(maxStake) || 5000,
    expiryHours: parseInt(expiryHours) || 24,
    maxPair: parseInt(maxPair) || 1,
    maxPerUser: parseInt(maxPerUser) || 5,
    feePct: parseFloat(feePct) || 5,
    winnerCutPct: parseFloat(winnerCutPct) || 95,
  };
}

// 결정론적 시뮬: 종족 stat 비대칭 없이 50/50 + 미세 가중치
async function _resolveFight(client, challenger, defender, seed) {
  // optional gentle bias from rank_level (적게 영향, fairness 우선)
  async function _bias(w) {
    try {
      const r = await client.query(
        'SELECT rank_level FROM users WHERE wallet_address = $1', [w]);
      return Math.min(10, parseInt(r.rows[0]?.rank_level || 0));
    } catch (_) { return 0; }
  }
  const [cB, dB] = await Promise.all([_bias(challenger), _bias(defender)]);

  // LCG seeded random
  let rng = (parseInt(seed.slice(0, 8), 16) >>> 0) || 1;
  function next(max) {
    rng = (Math.imul(1664525, rng) + 1013904223) >>> 0;
    return rng % max;
  }
  const cScore = cB + next(101);  // 0..100 + bias
  const dScore = dB + next(101);
  let winner = null;
  if (cScore > dScore) winner = challenger;
  else if (dScore > cScore) winner = defender;
  return { cScore, dScore, winner };
}

// ── Challenge ───────────────────────────────────────────────────
async function challenge(challenger, defender, wagerGp) {
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('DUEL_DISABLED');

  const cLower = String(challenger || '').toLowerCase();
  const dLower = String(defender || '').toLowerCase();
  if (!cLower || !dLower) throw new Error('WALLET_REQUIRED');
  if (cLower === dLower) throw new Error('CANNOT_DUEL_SELF');

  const wager = parseInt(wagerGp);
  if (!Number.isFinite(wager) || wager < cfg.minStake || wager > cfg.maxStake) {
    const err = new Error('INVALID_STAKE');
    err.meta = { min: cfg.minStake, max: cfg.maxStake };
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 두 유저 존재 확인
    const u = await client.query(
      `SELECT wallet_address, gp_balance FROM users
       WHERE wallet_address IN ($1, $2) FOR UPDATE`,
      [cLower, dLower]
    );
    const cRow = u.rows.find(r => r.wallet_address === cLower);
    const dRow = u.rows.find(r => r.wallet_address === dLower);
    if (!cRow) throw new Error('CHALLENGER_NOT_FOUND');
    if (!dRow) throw new Error('DEFENDER_NOT_FOUND');
    if (parseFloat(cRow.gp_balance) < wager) throw new Error('INSUFFICIENT_GP');

    // 페어 동시 pending 제한
    const pairChk = await client.query(
      `SELECT COUNT(*)::int AS c FROM gp_duels
       WHERE status = 'pending'
         AND ((challenger = $1 AND defender = $2) OR
              (challenger = $2 AND defender = $1))`,
      [cLower, dLower]
    );
    if ((pairChk.rows[0]?.c || 0) >= cfg.maxPair) {
      throw new Error('PAIR_DUEL_LIMIT');
    }

    // 유저별 pending 상한
    const myPend = await client.query(
      `SELECT COUNT(*)::int AS c FROM gp_duels
       WHERE challenger = $1 AND status = 'pending'`,
      [cLower]
    );
    if ((myPend.rows[0]?.c || 0) >= cfg.maxPerUser) {
      throw new Error('USER_DUEL_LIMIT');
    }

    // GP 에스크로 (challenger만 선차감 — defender는 accept 시)
    await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1`,
      [wager, cLower]
    );

    const expires = new Date(Date.now() + cfg.expiryHours * 3600 * 1000);
    const ins = await client.query(
      `INSERT INTO gp_duels (challenger, defender, wager_gp, status, created_at, expires_at)
       VALUES ($1, $2, $3, 'pending', NOW(), $4)
       RETURNING id, created_at, expires_at`,
      [cLower, dLower, wager, expires]
    );

    await client.query('COMMIT');

    // fire-and-forget
    try { logGPActivity(cLower, -wager, 'duel_challenge_escrow', `vs ${dLower}`).catch(() => {}); } catch(_){}

    return {
      id: ins.rows[0].id,
      challenger: cLower, defender: dLower,
      wager_gp: wager,
      status: 'pending',
      created_at: ins.rows[0].created_at,
      expires_at: ins.rows[0].expires_at,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch(_){}
    throw err;
  } finally {
    client.release();
  }
}

// ── Accept (즉시 fight 처리) ─────────────────────────────────────
async function acceptDuel(duelId, defender) {
  const cfg = await getCfg();
  const dLower = String(defender || '').toLowerCase();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const r = await client.query(
      `SELECT * FROM gp_duels WHERE id = $1 FOR UPDATE`, [duelId]);
    if (!r.rows[0]) throw new Error('DUEL_NOT_FOUND');
    const d = r.rows[0];
    if (d.defender !== dLower) throw new Error('NOT_YOUR_DUEL');
    if (d.status !== 'pending') throw new Error('DUEL_NOT_PENDING');
    if (new Date(d.expires_at) < new Date()) throw new Error('DUEL_EXPIRED');

    // defender 잔액 확인 + 차감
    const dr = await client.query(
      `SELECT gp_balance FROM users WHERE wallet_address = $1 FOR UPDATE`, [dLower]);
    if (!dr.rows[0]) throw new Error('USER_NOT_FOUND');
    if (parseFloat(dr.rows[0].gp_balance) < d.wager_gp) throw new Error('INSUFFICIENT_GP');
    await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1`,
      [d.wager_gp, dLower]
    );

    // 시뮬레이션 (결정론적 — seed 고정)
    const seed = crypto.randomBytes(16).toString('hex');
    const result = await _resolveFight(client, d.challenger, dLower, seed);

    // 보상 정산
    const totalPot = d.wager_gp * 2;
    const fee = Math.floor(totalPot * (cfg.feePct / 100));
    const winnerTake = Math.floor((totalPot - fee) * (cfg.winnerCutPct / 100));
    const loserTake  = (totalPot - fee) - winnerTake;  // tie 보존용

    if (result.winner) {
      await client.query(
        `UPDATE users SET gp_balance = gp_balance + $1 WHERE wallet_address = $2`,
        [winnerTake, result.winner]
      );
      const loser = result.winner === d.challenger ? dLower : d.challenger;
      if (loserTake > 0) {
        await client.query(
          `UPDATE users SET gp_balance = gp_balance + $1 WHERE wallet_address = $2`,
          [loserTake, loser]
        );
      }
    } else {
      // 무승부 — 양쪽에 (totalPot - fee) / 2
      const half = Math.floor((totalPot - fee) / 2);
      await client.query(
        `UPDATE users SET gp_balance = gp_balance + $1 WHERE wallet_address IN ($2, $3)`,
        [half, d.challenger, dLower]
      );
    }

    await client.query(
      `UPDATE gp_duels
       SET status = 'fought',
           winner = $1,
           fight_seed = $2,
           fight_log = $3::jsonb,
           resolved_at = NOW()
       WHERE id = $4`,
      [result.winner, seed,
       JSON.stringify({ cScore: result.cScore, dScore: result.dScore, fee, winnerTake, loserTake }),
       duelId]
    );

    await client.query('COMMIT');

    // Chronicle (fire-and-forget)
    try {
      const chronicle = require('./chronicle');
      chronicle.record('duel_fought', {
        actorWallet: d.challenger,
        targetWallet: dLower,
        valueGp: d.wager_gp,
        extra: { duelId, winner: result.winner || 'tie', cScore: result.cScore, dScore: result.dScore },
      }).catch(() => {});
    } catch(_){}

    // 시즌 점수 (fire-and-forget)
    try {
      const seasonSvc = require('./season');
      seasonSvc.addSeasonScore(d.challenger, 'duel', 1).catch(() => {});
      seasonSvc.addSeasonScore(dLower, 'duel', 1).catch(() => {});
      if (result.winner) seasonSvc.addSeasonScore(result.winner, 'duel_win', 1).catch(() => {});
    } catch(_){}

    return {
      id: duelId,
      status: 'fought',
      winner: result.winner,
      challenger_score: result.cScore,
      defender_score: result.dScore,
      total_pot: totalPot,
      fee,
      winner_take: winnerTake,
      loser_take: loserTake,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch(_){}
    throw err;
  } finally {
    client.release();
  }
}

// ── Decline (defender) ───────────────────────────────────────────
async function declineDuel(duelId, defender) {
  const dLower = String(defender || '').toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `SELECT * FROM gp_duels WHERE id = $1 FOR UPDATE`, [duelId]);
    if (!r.rows[0]) throw new Error('DUEL_NOT_FOUND');
    const d = r.rows[0];
    if (d.defender !== dLower) throw new Error('NOT_YOUR_DUEL');
    if (d.status !== 'pending') throw new Error('DUEL_NOT_PENDING');

    // challenger 환불
    await client.query(
      `UPDATE users SET gp_balance = gp_balance + $1 WHERE wallet_address = $2`,
      [d.wager_gp, d.challenger]
    );
    await client.query(
      `UPDATE gp_duels SET status = 'declined', resolved_at = NOW() WHERE id = $1`,
      [duelId]
    );
    await client.query('COMMIT');
    return { id: duelId, status: 'declined' };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch(_){}
    throw err;
  } finally {
    client.release();
  }
}

// ── Cancel (challenger) ─────────────────────────────────────────
async function cancelDuel(duelId, challenger) {
  const cLower = String(challenger || '').toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `SELECT * FROM gp_duels WHERE id = $1 FOR UPDATE`, [duelId]);
    if (!r.rows[0]) throw new Error('DUEL_NOT_FOUND');
    const d = r.rows[0];
    if (d.challenger !== cLower) throw new Error('NOT_YOUR_DUEL');
    if (d.status !== 'pending') throw new Error('DUEL_NOT_PENDING');

    await client.query(
      `UPDATE users SET gp_balance = gp_balance + $1 WHERE wallet_address = $2`,
      [d.wager_gp, cLower]
    );
    await client.query(
      `UPDATE gp_duels SET status = 'cancelled', resolved_at = NOW() WHERE id = $1`,
      [duelId]
    );
    await client.query('COMMIT');
    return { id: duelId, status: 'cancelled' };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch(_){}
    throw err;
  } finally {
    client.release();
  }
}

// ── Expire pending duels (scheduler) ────────────────────────────
async function expireDuels() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `SELECT id, challenger, wager_gp FROM gp_duels
       WHERE status = 'pending' AND expires_at <= NOW() FOR UPDATE`
    );
    let n = 0;
    for (const d of r.rows) {
      await client.query(
        `UPDATE users SET gp_balance = gp_balance + $1 WHERE wallet_address = $2`,
        [d.wager_gp, d.challenger]
      );
      await client.query(
        `UPDATE gp_duels SET status = 'expired', resolved_at = NOW() WHERE id = $1`,
        [d.id]
      );
      n++;
    }
    await client.query('COMMIT');
    return { expired: n };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch(_){}
    throw err;
  } finally {
    client.release();
  }
}

// ── Read-side helpers ───────────────────────────────────────────
async function getMyDuels(wallet, limit = 30) {
  const w = String(wallet || '').toLowerCase();
  const r = await pool.query(
    `SELECT d.*,
      uc.nickname AS challenger_nick, ud.nickname AS defender_nick,
      uw.nickname AS winner_nick
     FROM gp_duels d
     LEFT JOIN users uc ON uc.wallet_address = d.challenger
     LEFT JOIN users ud ON ud.wallet_address = d.defender
     LEFT JOIN users uw ON uw.wallet_address = d.winner
     WHERE d.challenger = $1 OR d.defender = $1
     ORDER BY d.created_at DESC LIMIT $2`,
    [w, limit]
  );
  return r.rows;
}

async function getPendingForMe(wallet) {
  const w = String(wallet || '').toLowerCase();
  const r = await pool.query(
    `SELECT d.*, uc.nickname AS challenger_nick
     FROM gp_duels d
     LEFT JOIN users uc ON uc.wallet_address = d.challenger
     WHERE d.defender = $1 AND d.status = 'pending'
     ORDER BY d.expires_at ASC`,
    [w]
  );
  return r.rows;
}

async function getRecentResolved(limit = 20) {
  const r = await pool.query(
    `SELECT d.*,
      uc.nickname AS challenger_nick, ud.nickname AS defender_nick,
      uw.nickname AS winner_nick
     FROM gp_duels d
     LEFT JOIN users uc ON uc.wallet_address = d.challenger
     LEFT JOIN users ud ON ud.wallet_address = d.defender
     LEFT JOIN users uw ON uw.wallet_address = d.winner
     WHERE d.status IN ('fought','declined','cancelled','expired')
     ORDER BY d.resolved_at DESC NULLS LAST LIMIT $1`,
    [limit]
  );
  return r.rows;
}

async function getAdminStats() {
  const r = await pool.query(
    `SELECT status, COUNT(*)::int AS n, COALESCE(SUM(wager_gp),0)::int AS total_gp
     FROM gp_duels GROUP BY status`
  );
  const out = { total: 0, by_status: {}, total_gp: 0 };
  for (const row of r.rows) {
    out.total += row.n;
    out.total_gp += row.total_gp;
    out.by_status[row.status] = { count: row.n, gp: row.total_gp };
  }
  return out;
}

/**
 * getSettings — 클라이언트가 도전장 UI 표시할 때 필요한 룰 값
 */
async function getSettings() {
  const { getSetting } = require('../db');
  const [
    minStake, maxStake, expiryHours, maxPendingPair, maxActiveUser,
    feePct, winnerCutPct,
  ] = await Promise.all([
    getSetting('duel_min_stake_gp', '10'),
    getSetting('duel_max_stake_gp', '5000'),
    getSetting('duel_default_expiry_hours', '24'),
    getSetting('duel_max_pending_per_pair', '1'),
    getSetting('duel_max_active_per_user', '5'),
    getSetting('duel_fee_pct', '5'),
    getSetting('duel_winner_cut_pct', '90'),
  ]);
  const num = (v, d) => parseInt(String(v ?? d).replace(/[^0-9]/g, '')) || d;
  const flt = (v, d) => parseFloat(String(v ?? d).replace(/[^0-9.]/g, '')) || d;
  return {
    min_stake_gp:        num(minStake, 10),
    max_stake_gp:        num(maxStake, 5000),
    expiry_hours:        num(expiryHours, 24),
    max_pending_per_pair: num(maxPendingPair, 1),
    max_active_per_user: num(maxActiveUser, 5),
    fee_pct:             flt(feePct, 5),
    winner_cut_pct:      flt(winnerCutPct, 90),
  };
}

module.exports = {
  challenge,
  acceptDuel,
  declineDuel,
  cancelDuel,
  expireDuels,
  getMyDuels,
  getPendingForMe,
  getRecentResolved,
  getAdminStats,
  getSettings,
};
