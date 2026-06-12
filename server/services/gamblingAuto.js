// server/services/gamblingAuto.js
// ═══════════════════════════════════════════════════════════════
// 자동 게임 운영 스케줄러 [v7.314]
//   - GP 래플: 항상 1개 활성 유지 (자동 생성). 마감 추첨/지급은 기존 [RAFFLE] autoDrawExpired 스케줄러가 처리.
//   - GP 예측 배팅: 파벌(MCC/FSP/CV) 경쟁 이벤트 자동 생성 + 마감 자동 정산.
//     (마감 close 전환은 기존 [warBetting] closeExpiredEvents 스케줄러가 처리)
// 어드민 수동 세팅 없이 영구적으로 돌아간다.
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');
const raffle = require('./raffle');
const betting = require('./warBetting');

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

// ─── 래플 자동 생성 ───────────────────────────────────────────
async function tickRaffle() {
  const enabled = String(await getSetting('raffle_auto_enabled', 'true')) !== 'false';
  if (!enabled) return { created: 0 };
  try {
    const open = await raffle.getOpenRaffles();
    if (open && open.length > 0) return { created: 0 }; // 이미 열린 래플 있음
    const ticketCostGp = parseInt(await getSetting('raffle_auto_ticket_gp', '20')) || 20;
    const houseCutPct = parseInt(await getSetting('raffle_auto_house_cut_pct', '10')) || 10;
    const hours = parseInt(await getSetting('raffle_auto_duration_hours', '24')) || 24;
    const endsAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    await raffle.adminCreateRaffle({
      title: 'Mars Daily Jackpot',
      description: 'Buy GP tickets — one random winner takes the pot. Auto-drawn at close.',
      icon: '🎟️',
      ticketCostGp,
      maxTickets: 0,
      prizeDesc: 'GP pot (minus house cut) to one random winner',
      houseCutPct,
      endsAt
    });
    console.log('[gamblingAuto] new raffle created (ends ' + endsAt + ')');
    return { created: 1 };
  } catch (e) {
    console.warn('[gamblingAuto] raffle create:', e.message);
    return { created: 0 };
  }
}

// ─── 배팅 자동 운영 ───────────────────────────────────────────
const FACTION_LABEL = { mcc: 'MCC', fsp: 'FSP', cv: 'CV' };
const FACTION_RACE_PREFIX = 'Faction Race';

// 윈도우(이벤트 생성 created_at ~ 마감 closes_at) 동안 파벌별 신규 클레임 수를 세서 승자 옵션 결정.
// a=MCC, b=FSP, c=CV. 무활동/동점 → null(환불 처리).
async function decideFactionWinner(sinceTs, untilTs) {
  try {
    const r = await pool.query(
      `SELECT u.faction_code AS fc, COUNT(*) AS cnt
         FROM claims c
         JOIN users u ON LOWER(u.wallet_address) = LOWER(c.owner)
        WHERE c.created_at >= $1 AND c.created_at <= $2
          AND u.faction_code IN ('mcc','fsp','cv')
        GROUP BY u.faction_code`,
      [sinceTs, untilTs]
    );
    const counts = { mcc: 0, fsp: 0, cv: 0 };
    for (const row of r.rows) counts[row.fc] = parseInt(row.cnt) || 0;
    const max = Math.max(counts.mcc, counts.fsp, counts.cv);
    if (max === 0) return null;
    const leaders = Object.keys(counts).filter(k => counts[k] === max);
    if (leaders.length > 1) return null;
    return { mcc: 'a', fsp: 'b', cv: 'c' }[leaders[0]];
  } catch (e) {
    console.warn('[gamblingAuto] decideWinner:', e.message);
    return null;
  }
}

async function tickBetting() {
  const enabled = String(await getSetting('war_betting_auto_enabled', 'true')) !== 'false';

  // 1) closed(마감, 미정산) 파벌 경쟁 이벤트 자동 정산.
  //    (open→closed 전환은 기존 closeExpiredEvents 스케줄러가 60초마다 수행)
  let resolved = 0;
  try {
    const { rows: closed } = await pool.query(
      `SELECT id, created_at, closes_at FROM war_bet_events
        WHERE status = 'closed' AND event_type = 'weekly_top'
          AND title_en LIKE $1
        ORDER BY closes_at ASC LIMIT 20`,
      [FACTION_RACE_PREFIX + '%']
    );
    for (const ev of closed) {
      const winner = await decideFactionWinner(ev.created_at, ev.closes_at);
      if (!winner) {
        // 무승부/무활동 → 베팅 환불(cancelled)로 멈추지 않게.
        try {
          await pool.query(
            `UPDATE war_bet_events SET status='cancelled', resolved_at=NOW() WHERE id=$1 AND status='closed'`,
            [ev.id]
          );
          // 베팅금 환불
          await refundEventBets(ev.id);
        } catch (_) {}
        continue;
      }
      try { await betting.resolveEvent(ev.id, winner); resolved++; }
      catch (e) { console.warn('[gamblingAuto] resolve #' + ev.id + ':', e.message); }
    }
  } catch (e) { console.warn('[gamblingAuto] resolve loop:', e.message); }

  // 2) 열린 파벌 경쟁 이벤트가 없으면 새로 생성
  let created = 0;
  if (enabled) {
    try {
      const open = await betting.listActiveEvents();
      const hasRace = (open || []).some(e => e.event_type === 'weekly_top' && String(e.title_en || '').startsWith(FACTION_RACE_PREFIX));
      if (!hasRace) {
        const hours = parseInt(await getSetting('war_betting_auto_duration_hours', '24')) || 24;
        const closesAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
        const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
        await betting.createEvent({
          event_type: 'weekly_top',
          event_ref_id: null,
          title_ko: '파벌 경쟁: 다음 ' + hours + '시간 동안 영토를 가장 많이 확보할 파벌은? (' + stamp + ')',
          title_en: FACTION_RACE_PREFIX + ' (' + stamp + '): which faction claims the most territory?',
          option_a_label: FACTION_LABEL.mcc,
          option_b_label: FACTION_LABEL.fsp,
          option_c_label: FACTION_LABEL.cv,
          closes_at: closesAt
        });
        created = 1;
        console.log('[gamblingAuto] new faction-race betting event (closes ' + closesAt + ')');
      }
    } catch (e) { console.warn('[gamblingAuto] betting create:', e.message); }
  }

  return { resolved, created };
}

// 환불: 취소된 이벤트의 모든 베팅 GP를 유저에게 돌려준다.
async function refundEventBets(eventId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: bets } = await client.query(
      `SELECT user_wallet, amount_gp FROM war_bets WHERE event_id = $1 AND status = 'pending'`,
      [eventId]
    );
    for (const b of bets) {
      await client.query(
        `UPDATE users SET gp_balance = COALESCE(gp_balance,0) + $1 WHERE LOWER(wallet_address) = LOWER($2)`,
        [b.amount_gp, b.user_wallet]
      );
    }
    await client.query(`UPDATE war_bets SET status = 'refunded' WHERE event_id = $1 AND status = 'pending'`, [eventId]);
    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    // war_bets 컬럼명이 다를 수 있으니 조용히 실패(정산 자체는 cancelled로 진행됨)
    console.warn('[gamblingAuto] refund #' + eventId + ':', e.message);
  } finally {
    client.release();
  }
}

let startTimer = null;
let intervalTimer = null;
let tickInProgress = false;

async function tick() {
  if (tickInProgress) {
    console.warn('[gamblingAuto] tick skipped: previous tick still active');
    return { skipped: true };
  }
  tickInProgress = true;
  try {
    const raffleResult = await tickRaffle();
    const bettingResult = await tickBetting();
    return { raffle: raffleResult, betting: bettingResult };
  } finally {
    tickInProgress = false;
  }
}

function start() {
  if (intervalTimer) {
    console.log('[gamblingAuto] scheduler already running');
    return;
  }
  const RUN_MS = 5 * 60 * 1000; // 5분마다
  startTimer = setTimeout(() => { tick().catch(e => console.warn('[gamblingAuto] initial tick:', e.message)); }, 20 * 1000);
  intervalTimer = setInterval(() => { tick().catch(e => console.warn('[gamblingAuto] tick:', e.message)); }, RUN_MS);
  if (startTimer.unref) startTimer.unref();
  if (intervalTimer.unref) intervalTimer.unref();
  console.log('[gamblingAuto] auto raffle + betting scheduler started (every 5min)');
}

function stop() {
  if (startTimer) clearTimeout(startTimer);
  if (intervalTimer) clearInterval(intervalTimer);
  startTimer = null;
  intervalTimer = null;
}

module.exports = { start, stop, tick, tickRaffle, tickBetting, decideFactionWinner };
