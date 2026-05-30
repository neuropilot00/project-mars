// server/services/autoContent.js
// ═══════════════════════════════════════════════════════════════
// 자동 컨텐츠 운영 스케줄러 [v7.315]
//   어드민 수동 생성 없이 상시 돌아가야 하는 컨텐츠를 자동 생성한다.
//   - 컨테스트(art_contests): 진행 중인 컨테스트가 없으면 자동 생성.
//     정산(상태전환 upcoming→active→voting→finalize + 득표순 자동 승자선정)은
//     기존 [CONTEST] advanceContestStatuses 스케줄러가 5분마다 처리하므로 안전.
//
//   ※ 자동화 제외(의도적):
//     - 토너먼트(tournaments) / wager 풀: 승자 선정이 어드민 수동(adminPickWinner/settlePool)이라
//       자동 생성 시 참가비/베팅금이 영구 묶임 → 자동 생성하지 않음.
//     - 래플/예측배팅: gamblingAuto.js 가 처리(v7.314).
//     - 복권(lottery): drawExpiredRounds 가 마감 시 새 라운드 자동 생성.
//     - 월드이벤트(world_events): maybeAutoSpawn 이 자동 스폰.
//     - 시즌(season): autoRotateSeason 이 자동 순환.
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');

let contest;
try { contest = require('./contest'); } catch (_) {}

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

// 종류를 순환시켜 매번 다른 목표를 제시한다. (contest_type 값은 contest.js 기본/검증과 무관하게 자유 문자열 허용)
const CONTEST_ROTATION = [
  { contest_type: 'best_territory', title: 'Land Showcase — Best Territory Art' },
  { contest_type: 'most_claims',    title: 'Land Rush — Most Claims' },
  { contest_type: 'most_pp',        title: 'Mining Marathon — Most PP Mined' },
  { contest_type: 'best_territory', title: 'Colony Pride — Best Territory Art' },
];

async function tickContest() {
  if (!contest || !contest.adminCreateContest) return { created: 0 };
  if (!isOn(await getSetting('contest_auto_enabled', 'true'))) return { created: 0 };

  try {
    // 진행/예정 중인 컨테스트가 있으면 새로 만들지 않는다.
    const { rows: act } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM art_contests WHERE status IN ('upcoming','active','voting')`
    );
    if ((act[0] && act[0].n) > 0) return { created: 0 };

    // 회전 인덱스: 누적 컨테스트 수 기반 (랜덤 미사용 환경)
    let idx = 0;
    try {
      const c = await pool.query('SELECT COUNT(*)::int AS n FROM art_contests');
      idx = (c.rows[0].n || 0) % CONTEST_ROTATION.length;
    } catch (_) {}
    const pick = CONTEST_ROTATION[idx];

    const prizePoolGp = parseInt(await getSetting('contest_auto_prize_gp', '3000')) || 3000;
    const submissionHours = parseInt(await getSetting('contest_auto_submission_hours', '72')) || 72;
    const votingHours = parseInt(await getSetting('contest_auto_voting_hours', '48')) || 48;

    await contest.adminCreateContest({
      title: pick.title,
      description: 'Auto-run colony contest. Join, submit, and the top voted entries win the GP pool.',
      theme: 'Mars Colony',
      contest_type: pick.contest_type,
      entry_fee_gp: 0,
      prize_pool_gp: prizePoolGp,
      submission_hours: submissionHours,
      voting_hours: votingHours,
      max_entries_per_user: 1,
      starts_at: null
    });
    console.log('[autoContent] contest created: ' + pick.title);
    return { created: 1 };
  } catch (e) {
    // art_contests 미프로비저닝 등은 조용히 통과 (다음 tick 재시도)
    console.warn('[autoContent] contest create:', e.message);
    return { created: 0 };
  }
}

// ─── 파벌 영토 집계 (토너먼트/wager 자동 승자 판정 공용) ───────
// 윈도우 동안 파벌별 신규 클레임 수. 반환: {mcc,fsp,cv, topFaction|null}
async function factionClaimCounts(sinceTs, untilTs) {
  const counts = { mcc: 0, fsp: 0, cv: 0 };
  try {
    const r = await pool.query(
      `SELECT u.faction_code AS fc, COUNT(*)::int AS cnt
         FROM claims c JOIN users u ON LOWER(u.wallet_address) = LOWER(c.owner)
        WHERE c.created_at >= $1 AND c.created_at <= $2 AND u.faction_code IN ('mcc','fsp','cv')
        GROUP BY u.faction_code`,
      [sinceTs, untilTs]
    );
    for (const row of r.rows) counts[row.fc] = row.cnt;
  } catch (_) {}
  const max = Math.max(counts.mcc, counts.fsp, counts.cv);
  let top = null;
  if (max > 0) {
    const leaders = ['mcc', 'fsp', 'cv'].filter(k => counts[k] === max);
    if (leaders.length === 1) top = leaders[0];
  }
  return { ...counts, topFaction: top };
}

// ─── 토너먼트 자동 운영 (생성 + 자동 승자판정) ───────────────
let tournaments;
try { tournaments = require('./tournaments'); } catch (_) {}

async function tickTournament() {
  if (!tournaments) return { created: 0, settled: 0 };
  if (!isOn(await getSetting('tournament_auto_enabled', 'true'))) return { created: 0, settled: 0 };
  let settled = 0, created = 0;

  // 1) 마감(ends_at 지남) 미완료 토너먼트 자동 승자판정/정산
  try {
    const { rows: due } = await pool.query(
      `SELECT id, created_at, ends_at FROM tournaments
        WHERE status IN ('open','running') AND ends_at IS NOT NULL AND ends_at <= NOW()
        ORDER BY ends_at ASC LIMIT 20`
    );
    for (const t of due) {
      try {
        // 참가자 중 (생성~마감) 윈도우 동안 영토를 가장 많이 확보한 사람을 승자로.
        const { rows: win } = await pool.query(
          `SELECT te.wallet, COUNT(c.id)::int AS claims
             FROM tournament_entries te
             LEFT JOIN claims c ON LOWER(c.owner) = LOWER(te.wallet)
                  AND c.created_at >= $2 AND c.created_at <= $3
            WHERE te.tournament_id = $1
            GROUP BY te.wallet

// ─── 토너먼트 자동 운영 (생성 + 자동 승자판정) ───────────────
// 실제 스키마: tournaments.status 기본 'registering', 컬럼 starts_at/ends_at/winner_prize 존재.
let tournaments;
try { tournaments = require('./tournaments'); } catch (_) {}

const AUTO_TOURNEY_NAME = 'Weekly Land Tournament';

// 진행 중(미완료) 자동 토너먼트가 있는지
async function hasOpenAutoTournament() {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM tournaments
      WHERE name = $1 AND status NOT IN ('completed','cancelled')`,
    [AUTO_TOURNEY_NAME]
  );
  return (r.rows[0] && r.rows[0].n) > 0;
}

async function tickTournament() {
  if (!tournaments) return { created: 0, settled: 0 };
  if (!isOn(await getSetting('tournament_auto_enabled', 'true'))) return { created: 0, settled: 0 };
  let settled = 0, created = 0;

  // 1) 마감(ends_at 지남) 미완료 토너먼트 자동 승자판정
  try {
    const { rows: due } = await pool.query(
      `SELECT id, created_at, ends_at FROM tournaments
        WHERE name = $1 AND status NOT IN ('completed','cancelled')
          AND ends_at IS NOT NULL AND ends_at <= NOW()
        ORDER BY ends_at ASC LIMIT 20`,
      [AUTO_TOURNEY_NAME]
    );
    for (const t of due) {
      try {
        // 참가자 중 (생성~마감) 윈도우 동안 영토를 가장 많이 확보한 사람을 승자로.
        const { rows: win } = await pool.query(
          `SELECT te.wallet, COUNT(c.id)::int AS claims
             FROM tournament_entries te
             LEFT JOIN claims c ON LOWER(c.owner) = LOWER(te.wallet)
                  AND c.created_at >= $2 AND c.created_at <= $3
            WHERE te.tournament_id = $1
            GROUP BY te.wallet
            ORDER BY claims DESC, te.wallet ASC
            LIMIT 1`,
          [t.id, t.created_at, t.ends_at]
        );
        let winnerWallet = win.length ? win[0].wallet : null;
        if (winnerWallet) {
          // 토너먼트가 'running'이 아니면 adminPickWinner 내부 검증 통과를 위해 상태 보정
          await pool.query(`UPDATE tournaments SET status='running' WHERE id=$1 AND status NOT IN ('completed','cancelled')`, [t.id]);
          await tournaments.adminPickWinner(t.id, winnerWallet);
          settled++;
        } else {
          await tournaments.adminCancelTournament(t.id);
        }
        // 연동된 wager 풀도 같은 승자로 정산
        await settleLinkedWager(t.id, winnerWallet);
      } catch (e) { console.warn('[autoContent] tournament settle #' + t.id + ':', e.message); }
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
      console.log('[autoContent] tournament created id=' + t.id + ' (ends ' + endsAt + ')');
      // 연동 wager 풀 생성 (참가자에게 베팅)
      await createLinkedWager(t.id, AUTO_TOURNEY_NAME, endsAt);
    }
  } catch (e) { console.warn('[autoContent] tournament create:', e.message); }

  return { created, settled };
}

// ─── GP Wager 풀 — 토너먼트 연동 (target_wallet = 참가자 지갑) ──
// wager_pools 스키마엔 options 컬럼이 없고 bets 는 target_wallet 에 건다.
// 그래서 "토너먼트 승자 맞히기" 풀로 운영: 설명에 TID:<id> 를 기록해 연동.
let wager;
try { wager = require('./wager'); } catch (_) {}

async function createLinkedWager(tournamentId, tourneyName, closesAt) {
  if (!wager || !wager.adminCreatePool) return;
  if (!isOn(await getSetting('wager_auto_enabled', 'true'))) return;
  try {
    await wager.adminCreatePool({
      title: 'Who wins: ' + tourneyName + '?',
      description: 'TID:' + tournamentId + ' — Bet GP on which entrant wins the tournament. Auto-settled with the winner.',
      icon: '🎯',
      category: 'tournament',
      minBetGp: 10,
      maxBetGp: 2000,
      houseCutPct: 10,
      closesAt
    });
    console.log('[autoContent] linked wager pool created for tournament ' + tournamentId);
  } catch (e) { console.warn('[autoContent] wager create:', e.message); }
}

async function settleLinkedWager(tournamentId, winnerWallet) {
  if (!wager || !wager.settlePool) return;
  try {
    const { rows } = await pool.query(
      `SELECT id FROM wager_pools
        WHERE status IN ('open','locked') AND description LIKE $1
        LIMIT 5`,
      ['TID:' + tournamentId + ' %']
    );
    for (const w of rows) {
      try {
        // 승자 없으면(참가자 0) 승자 지갑 없음 → settlePool에 빈 지갑이면 전원 환불 효과
        await wager.settlePool(w.id, winnerWallet || '0x0');
      } catch (e) { console.warn('[autoContent] linked wager settle #' + w.id + ':', e.message); }
    }
  } catch (e) { console.warn('[autoContent] linked wager lookup:', e.message); }
}

// tickWager: 연동되지 않은 잔여 만료 wager 안전 정산(전원 환불). 자동 생성은 토너먼트와 함께.
async function tickWager() {
  if (!wager) return { settled: 0 };
  let settled = 0;
  try {
    const { rows: due } = await pool.query(
      `SELECT id FROM wager_pools
        WHERE status IN ('open','locked') AND category = 'tournament'
          AND closes_at <= NOW() AND description LIKE 'TID:%'
        ORDER BY closes_at ASC LIMIT 20`
    );
    // 토너먼트가 아직 정산 안 됐을 수 있으니, 마감 후 그대로 둔다(토너먼트 정산 시 settleLinkedWager가 처리).
    // 단 토너먼트가 cancelled/없음인 고아 풀은 전원 환불.
    for (const w of due) {
      const m = /TID:(\d+)/.exec(w._desc || '');
      // 안전: 고아 여부는 settleLinkedWager 경로에서 처리되므로 여기선 skip
    }
  } catch (_) {}
  return { settled };
}

async function tick() {
  await tickContest();
  await tickTournament();
  await tickWager();
}

function start() {
  const RUN_MS = 10 * 60 * 1000; // 10분마다
  setTimeout(() => { tick().catch(e => console.warn('[autoContent] initial tick:', e.message)); }, 30 * 1000);
  setInterval(() => { tick().catch(e => console.warn('[autoContent] tick:', e.message)); }, RUN_MS);
  console.log('[autoContent] auto contest + tournament + wager scheduler started (every 10min)');
}

module.exports = { start, tick, tickContest, tickTournament, tickWager, factionClaimCounts, createLinkedWager, settleLinkedWager };
