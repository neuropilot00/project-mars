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

async function tick() {
  await tickContest();
}

function start() {
  const RUN_MS = 10 * 60 * 1000; // 10분마다 (컨테스트는 길게 도므로 자주 볼 필요 없음)
  setTimeout(() => { tick().catch(e => console.warn('[autoContent] initial tick:', e.message)); }, 30 * 1000);
  setInterval(() => { tick().catch(e => console.warn('[autoContent] tick:', e.message)); }, RUN_MS);
  console.log('[autoContent] auto contest scheduler started (every 10min)');
}

module.exports = { start, tick, tickContest };
