// server/services/autoContent.js
// ═══════════════════════════════════════════════════════════════
// 자동 컨텐츠 운영 스케줄러 [v7.315~v7.317]
//   어드민 수동 생성 없이 상시 돌아가야 하는 컨텐츠를 자동 생성/정산한다.
//   - 컨테스트(art_contests): 진행 중이 없으면 자동 생성 (정산은 advanceContestStatuses)
//   - 토너먼트(tournaments): 자동 생성 + 마감 시 영토최다 참가자 자동 승자판정
//   - GP Wager: 토너먼트 연동 "승자 맞히기" 풀 자동 생성 + 토너먼트 정산 시 동일 승자로 자동 정산
//   ※ 래플/예측배팅=gamblingAuto, 복권=lottery, 월드이벤트=maybeAutoSpawn, 시즌=autoRotateSeason 이미 자동.
// 모든 작업 try/catch 격리. 미프로비저닝 환경에서도 safe.
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');

let contest, tournaments, wager;
try { contest = require('./contest'); } catch (_) {}
try { tournaments = require('./tournaments'); } catch (_) {}
try { wager = require('./wager'); } catch (_) {}

async function getSetting(key, fallback) {
  try {
    const r = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    if (r.rows[0] && r.rows[0].value != null) {
      let v = r.rows[0].value;
      if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) {} }
      return v;
    }
  } catch (_) {}
  return fallback;
}

function isOn(v) { return String(v) !== 'false'; }

// ─── 컨테스트 ──────────────────────────────────────────────────
const CONTEST_ROTATION = [
  { title: 'Land Showcase — Best Territory Art' },
  { title: 'Land Rush — Most Claims' },
  { title: 'Mining Marathon — Most PP Mined' },
  { title: 'Colony Pride — Best Territory Art' },
];

async function tickContest() {
  if (!contest || !contest.adminCreateContest) return { created: 0 };
  if (!isOn(await getSetting('contest_auto_enabled', 'true'))) return { created: 0 };
  try {
    const { rows: act } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM art_contests WHERE status IN ('upcoming','open','voting')`
    );
    if ((act[0] && act[0].n) > 0) return { created: 0 };

    let idx = 0;
    try {
      const c = await pool.query('SELECT COUNT(*)::int AS n FROM art_contests');
      idx = (c.rows[0].n || 0) % CONTEST_ROTATION.length;
    } catch (_) {}
    const pick = CONTEST_ROTATION[idx];

    const prizePoolGp = parseInt(await getSetting('contest_auto_prize_gp', '3000')) || 3000;
    const subHours = parseInt(await getSetting('contest_auto_submission_hours', '72')) || 72;
    const voteHours = parseInt(await getSetting('contest_auto_voting_hours', '48')) || 48;
    const now = Date.now();
    await contest.adminCreateContest({
      title: pick.title,
      description: 'Auto-run colony contest. Join, submit, and the top voted entries win the GP pool.',
      theme: 'Mars Colony',
      entry_fee_gp: 0,
      vote_fee_gp: 0,
      prize_pool_gp: prizePoolGp,
      status: 'open',
      submission_start: new Date(now).toISOString(),
      submission_end: new Date(now + subHours * 3600000).toISOString(),
      voting_end: new Date(now + (subHours + voteHours) * 3600000).toISOString(),
      created_by: 'auto'
    });
    console.log('[autoContent] contest created: ' + pick.title);
    return { created: 1 };
  } catch (e) {
    console.warn('[autoContent] contest create:', e.message);
    return { created: 0 };
  }
}

// ─── 토너먼트 자동 운영 (생성 + 자동 승자판정) ───────────────
// 실제 스키마: tournaments.status 기본 'registering'. ends_at 컬럼 없음 → created_at + duration 으로 마감 판정.
const AUTO_TOURNEY_NAME = 'Weekly Land Tournament';

async function hasOpenAutoTournament() {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM tournaments
      WHERE name = $1 AND status NOT IN ('completed','cancelled')`,
    [AUTO_TOURNEY_NAME]
  );
  return (r.rows[0] && r.rows[0].n) > 0;
}

async function tickTournament() {
  if (!tournaments || !tournaments.adminCreateTournament) return { created: 0, settled: 0 };
  if (!isOn(await getSetting('tournament_auto_enabled', 'true'))) return { created: 0, settled: 0 };
  let settled = 0, created = 0;

  // 1) 생성 후 duration 지난 미완료 자동 토너먼트 승자판정
  try {
    const durDays = parseInt(await getSetting('tournament_auto_duration_days', '7')) || 7;
    const { rows: due } = await pool.query(
      `SELECT id, created_at FROM tournaments
        WHERE name = $1 AND status NOT IN ('completed','cancelled')
          AND created_at <= NOW() - ($2 || ' days')::interval
        ORDER BY created_at ASC LIMIT 20`,
      [AUTO_TOURNEY_NAME, String(durDays)]
    );
    for (const t of due) {
      let winnerWallet = null;
      try {
        const { rows: win } = await pool.query(
          `SELECT te.wallet, COUNT(c.id)::int AS claims
             FROM tournament_entries te
             LEFT JOIN claims c ON LOWER(c.owner) = LOWER(te.wallet) AND c.created_at >= $2
            WHERE te.tournament_id = $1
            GROUP BY te.wallet
            ORDER BY claims DESC, te.wallet ASC
            LIMIT 1`,
          [t.id, t.created_at]
        );
        winnerWallet = win.length ? win[0].wallet : null;
        if (winnerWallet) {
          await tournaments.adminPickWinner(t.id, winnerWallet);
          settled++;
        } else {
          await tournaments.adminCancelTournament(t.id);
        }
      } catch (e) { console.warn('[autoContent] tournament settle #' + t.id + ':', e.message); }
      try { await settleLinkedWager(t.id, winnerWallet); } catch (_) {}
    }
  } catch (e) { console.warn('[autoContent] tournament settle loop:', e.message); }

  // 2) 진행 중 자동 토너먼트가 없으면 새로 생성 (+ 연동 wager 풀)
  try {
    if (!(await hasOpenAutoTournament())) {
      const days = parseInt(await getSetting('tournament_auto_duration_days', '7')) || 7;
      const entryFee = parseInt(await getSetting('tournament_auto_entry_gp', '50')) || 50;
      const prize = parseInt(await getSetting('tournament_auto_prize_gp', '2000')) || 2000;
      const endsAt = new Date(Date.now() + days * 86400000).toISOString();
      const t = await tournaments.adminCreateTournament({
        name: AUTO_TOURNEY_NAME,
        description: 'Claim the most territory before it ends to win the GP prize. Auto-judged.',
        entryFeeGp: entryFee,
        maxPlayers: null,
        startsAt: new Date().toISOString(),
        endsAt
      });
      try { await pool.query(`UPDATE tournaments SET prize_pool_gp = $1 WHERE id = $2`, [prize, t.id]); } catch (_) {}
      created++;
      console.log('[autoContent] tournament created id=' + t.id);
      try { await createLinkedWager(t.id, endsAt); } catch (_) {}
    }
  } catch (e) { console.warn('[autoContent] tournament create:', e.message); }

  return { created, settled };
}

// ─── GP Wager — 토너먼트 승자 맞히기 풀 (target_wallet 베팅) ──
// wager_pools 엔 options 컬럼이 없고 wager_bets.target_wallet 에 베팅. description "TID:<id>" 로 연동.
async function createLinkedWager(tournamentId, closesAt) {
  if (!wager || !wager.adminCreatePool) return;
  if (!isOn(await getSetting('wager_auto_enabled', 'true'))) return;
  await wager.adminCreatePool({
    title: 'Who wins the Weekly Land Tournament?',
    description: 'TID:' + tournamentId + ' — Bet GP on which entrant wins. Auto-settled with the winner.',
    icon: '🎯',
    category: 'tournament',
    minBetGp: 10,
    maxBetGp: 2000,
    houseCutPct: 10,
    closesAt
  });
  console.log('[autoContent] linked wager pool created for tournament ' + tournamentId);
}

async function settleLinkedWager(tournamentId, winnerWallet) {
  if (!wager || !wager.settlePool) return;
  const { rows } = await pool.query(
    `SELECT id FROM wager_pools
      WHERE status IN ('open','locked') AND description LIKE $1
      LIMIT 5`,
    ['TID:' + tournamentId + ' %']
  );
  for (const w of rows) {
    try {
      await wager.settlePool(w.id, winnerWallet || '0x0000000000000000000000000000000000000000');
    } catch (e) { console.warn('[autoContent] linked wager settle #' + w.id + ':', e.message); }
  }
}

async function tick() {
  await tickContest();
  await tickTournament();
}

function start() {
  const RUN_MS = 10 * 60 * 1000; // 10분마다
  setTimeout(() => { tick().catch(e => console.warn('[autoContent] initial tick:', e.message)); }, 30 * 1000);
  setInterval(() => { tick().catch(e => console.warn('[autoContent] tick:', e.message)); }, RUN_MS);
  console.log('[autoContent] auto contest + tournament + wager scheduler started (every 10min)');
}

module.exports = { start, tick, tickContest, tickTournament, createLinkedWager, settleLinkedWager };
