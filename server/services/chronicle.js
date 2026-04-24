/**
 * services/chronicle.js
 * 서사 엔진 (BIBLE Migration 083)
 *
 * 함수 목록:
 *  - record(eventType, data)                        → Chronicle 기록 + 선택적 Discord webhook
 *  - checkHijackRecord(attackerWallet, defenderWallet, claimId, ppAmount)
 *  - checkGovernorMilestone(governorWallet, sectorCode, days)
 *  - checkEnhancementRecord(userWallet, itemName, level)
 *  - sendDiscordWebhook(message)
 *  - getRecentChronicles(limit, publicOnly)
 *  - sendWeeklyReport()
 *
 * ⚠️  users.id 없음 → actor_wallet/target_wallet 사용
 */

'use strict';

const { pool, getSetting } = require('../db');
const { EventEmitter } = require('events');

// SSE 클라이언트에 이벤트 push하는 emitter
const chronicleEmitter = new EventEmitter();
chronicleEmitter.setMaxListeners(100);

// ─────────────────────────────────────────────────────────────
// 이벤트 타입별 타이틀 템플릿
// ─────────────────────────────────────────────────────────────
const TITLE_TEMPLATES = {
  large_hijack:          { en: '{actor} seizes {pp} PP in a massive raid!', ko: '{actor}가 {pp} PP 대규모 습격 성공!' },
  largest_hijack:        { en: '{actor} breaks the hijack record with {pp} PP!', ko: '{actor}가 {pp} PP 역대 최고 습격 기록!' },
  governor_overthrown:   { en: '{actor} overthrows {target} and claims {sector}!', ko: '{actor}가 {target}를 몰아내고 {sector} 장악!' },
  siege_declared:        { en: '{actor} declares siege on {sector}!', ko: '{actor}가 {sector}에 공성전 선언!' },
  governor_milestone_7:  { en: '{actor} has ruled {sector} for 7 days!', ko: '{actor}가 {sector}를 7일째 통치 중!' },
  governor_milestone_30: { en: '{actor} has ruled {sector} for a full month!', ko: '{actor}가 {sector}를 30일째 통치 중!' },
  governor_milestone_90: { en: '{actor} — legendary 90-day governor of {sector}!', ko: '{actor}가 {sector} 90일 전설적 총독!' },
  enhancement_max:       { en: '{actor} reaches +10 on {item} — a first!', ko: '{actor}가 {item}을(를) +10 강화 달성 — 최초!' },
  guild_war_end:         { en: '{actor} guild wins the war!', ko: '{actor} 길드 전쟁 승리!' },
  guild_war_declared:    { en: '{actor} declares war on {target}!', ko: '{actor} 길드가 {target} 길드에 선전포고!' },
  duel_fought:           { en: '{actor} defeats {target} in a personal duel!', ko: '{actor}가 {target}를 1:1 결투에서 격파!' },
  alliance_betrayal:     { en: '{actor} betrays the alliance, defecting with their guild!', ko: '{actor}의 길드가 동맹을 배신하고 이적!' },
  alliance_formed:       { en: '{actor} forges a new alliance!', ko: '{actor}가 새로운 동맹을 결성!' },
  alliance_disbanded:    { en: '{actor}\'s alliance crumbles into dust.', ko: '{actor}의 동맹이 무너졌다.' },
};

function _buildTitle(eventType, data) {
  const tmpl = TITLE_TEMPLATES[eventType];
  if (!tmpl) return null;

  const actor  = data.actor_nickname  || (data.actor_wallet  ? data.actor_wallet.slice(0,8)+'...'  : '???');
  const target = data.target_nickname || (data.target_wallet ? data.target_wallet.slice(0,8)+'...' : '???');
  const sector = data.sector_code || '';
  const pp     = data.value_pp ? parseFloat(data.value_pp).toFixed(2) : '';
  const item   = (data.extra && data.extra.item_name) || '';

  const fill = (s) => s
    .replace('{actor}', actor)
    .replace('{target}', target)
    .replace('{sector}', sector)
    .replace('{pp}', pp)
    .replace('{item}', item);

  return {
    title_en: fill(tmpl.en || ''),
    title_ko: fill(tmpl.ko || tmpl.en || '')
  };
}

// ─────────────────────────────────────────────────────────────
// 1. Chronicle 기록
// ─────────────────────────────────────────────────────────────
async function record(eventType, data = {}) {
  try {
    const titles = _buildTitle(eventType, data);

    const res = await pool.query(
      `INSERT INTO server_chronicles
         (event_type, actor_wallet, target_wallet, guild_id, sector_code,
          value_pp, value_gp, extra_data,
          title_en, title_ko, title_ja, title_zh,
          body_en, is_public, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
       RETURNING id`,
      [
        eventType,
        data.actor_wallet  || null,
        data.target_wallet || null,
        data.guild_id      || null,
        data.sector_code   || null,
        data.value_pp      || null,
        data.value_gp      || null,
        JSON.stringify(data.extra || {}),
        (titles && titles.title_en) || data.title_en || null,
        (titles && titles.title_ko) || data.title_ko || null,
        data.title_ja      || null,
        data.title_zh      || null,
        data.body_en       || null,
        data.is_public !== false  // default public
      ]
    );

    const chronicle = {
      id: res.rows[0].id,
      event_type: eventType,
      actor_wallet: data.actor_wallet,
      sector_code: data.sector_code,
      title_en: (titles && titles.title_en) || data.title_en,
      occurred_at: new Date()
    };

    // SSE 브로드캐스트
    chronicleEmitter.emit('chronicle', chronicle);

    // Discord webhook (non-blocking, optional)
    if (data.webhook) {
      const title = (titles && titles.title_en) || data.title_en || eventType;
      sendDiscordWebhook(`[MARS CHRONICLE] ${title}`).catch(() => {});
    }

    return chronicle;
  } catch (err) {
    console.error('[CHRONICLE] record error:', err.message);
    return null; // Chronicle 실패해도 게임 진행에 영향 없음
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Hijack Chronicle 체크
// ─────────────────────────────────────────────────────────────
async function checkHijackRecord(attackerWallet, defenderWallet, claimId, ppAmount) {
  if (!attackerWallet || !ppAmount) return;

  try {
    const minPP = parseFloat(await getSetting('chronicle_hijack_min_pp') ?? '500');
    if (parseFloat(ppAmount) < minPP) return;

    // 역대 최고 hijack 확인
    const maxRes = await pool.query(
      "SELECT MAX(value_pp) AS max_pp FROM server_chronicles WHERE event_type IN ('large_hijack','largest_hijack')"
    );
    const currentMax = parseFloat(maxRes.rows[0]?.max_pp ?? 0);

    const isRecord = parseFloat(ppAmount) > currentMax;
    const eventType = isRecord ? 'largest_hijack' : 'large_hijack';

    // 공격자 닉네임 조회
    const nickRes = await pool.query(
      'SELECT nickname FROM users WHERE wallet_address = $1',
      [attackerWallet.toLowerCase()]
    );
    const actorNickname = nickRes.rows[0]?.nickname || null;

    await record(eventType, {
      actor_wallet:    attackerWallet.toLowerCase(),
      actor_nickname:  actorNickname,
      target_wallet:   defenderWallet ? defenderWallet.toLowerCase() : null,
      value_pp:        ppAmount,
      extra:           { claim_id: claimId, is_record: isRecord },
      webhook:         isRecord || parseFloat(ppAmount) >= minPP * 2
    });
  } catch (err) {
    console.error('[CHRONICLE] checkHijackRecord error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Governor 임기 마일스톤 체크
// ─────────────────────────────────────────────────────────────
async function checkGovernorMilestone(governorWallet, sectorCode, days) {
  if (!governorWallet || ![7, 30, 90].includes(days)) return;

  try {
    // 이미 동일 마일스톤 기록됐는지 확인
    const existing = await pool.query(
      "SELECT 1 FROM server_chronicles WHERE event_type = $1 AND actor_wallet = $2 AND sector_code = $3 LIMIT 1",
      ['governor_milestone_'+days, governorWallet.toLowerCase(), sectorCode]
    );
    if (existing.rows.length) return; // 이미 기록됨

    const nickRes = await pool.query(
      'SELECT nickname FROM users WHERE wallet_address = $1',
      [governorWallet.toLowerCase()]
    );

    await record('governor_milestone_'+days, {
      actor_wallet:   governorWallet.toLowerCase(),
      actor_nickname: nickRes.rows[0]?.nickname || null,
      sector_code:    sectorCode,
      extra:          { days },
      webhook:        days >= 30
    });
  } catch (err) {
    console.error('[CHRONICLE] checkGovernorMilestone error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// 4. Enhancement +10 최초 달성 체크
// ─────────────────────────────────────────────────────────────
async function checkEnhancementRecord(userWallet, itemName, level) {
  if (!userWallet || level !== 10) return;

  try {
    // 해당 아이템 최초 +10 확인
    const existing = await pool.query(
      "SELECT 1 FROM server_chronicles WHERE event_type = 'enhancement_max' AND extra_data->>'item_name' = $1 LIMIT 1",
      [itemName]
    );
    if (existing.rows.length) return; // 이미 누군가 달성함

    const nickRes = await pool.query(
      'SELECT nickname FROM users WHERE wallet_address = $1',
      [userWallet.toLowerCase()]
    );

    await record('enhancement_max', {
      actor_wallet:   userWallet.toLowerCase(),
      actor_nickname: nickRes.rows[0]?.nickname || null,
      extra:          { item_name: itemName, level },
      webhook:        true
    });
  } catch (err) {
    console.error('[CHRONICLE] checkEnhancementRecord error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// 5. Discord Webhook 발송
// ─────────────────────────────────────────────────────────────
async function sendDiscordWebhook(message) {
  const rawUrl = await getSetting('discord_webhook_url') ?? '';
  // JSONB에 따옴표 포함될 수 있음 처리
  const url = String(rawUrl).replace(/^["']|["']$/g, '').trim();
  if (!url || url === '' || url === '""') return; // 설정 없으면 스킵

  const payload = {
    content: message,
    username: 'Occupy Mars Chronicle',
    avatar_url: 'https://cdn.discordapp.com/attachments/mars_bot.png'
  };

  // Node.js 내장 https
  const https = require('https');
  const body = JSON.stringify(payload);
  const parsedUrl = new URL(url);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('webhook timeout')); });
    req.write(body);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────
// 6. 최근 Chronicle 목록
// ─────────────────────────────────────────────────────────────
async function getRecentChronicles(limit = 20, publicOnly = true) {
  const where = publicOnly ? 'WHERE is_public = true' : '';
  const res = await pool.query(
    `SELECT sc.*,
            ua.nickname AS actor_nickname,
            ut.nickname AS target_nickname
     FROM server_chronicles sc
     LEFT JOIN users ua ON ua.wallet_address = sc.actor_wallet
     LEFT JOIN users ut ON ut.wallet_address = sc.target_wallet
     ${where}
     ORDER BY sc.occurred_at DESC LIMIT $1`,
    [Math.min(parseInt(limit), 100)]
  );
  return res.rows;
}

// ─────────────────────────────────────────────────────────────
// 7. 주간 보고 (스케줄러용)
// ─────────────────────────────────────────────────────────────
async function sendWeeklyReport() {
  try {
    // 지난 7일 주요 이벤트 수집
    const res = await pool.query(`
      SELECT event_type, COUNT(*) AS cnt,
             MAX(value_pp) AS max_pp
      FROM server_chronicles
      WHERE occurred_at > NOW() - INTERVAL '7 days'
      GROUP BY event_type ORDER BY cnt DESC LIMIT 10
    `);

    // 상위 플레이어
    const topRes = await pool.query(`
      SELECT actor_wallet, u.nickname, COUNT(*) AS events
      FROM server_chronicles sc
      LEFT JOIN users u ON u.wallet_address = sc.actor_wallet
      WHERE sc.occurred_at > NOW() - INTERVAL '7 days'
        AND sc.actor_wallet IS NOT NULL
      GROUP BY actor_wallet, u.nickname ORDER BY events DESC LIMIT 5
    `);

    const lines = [
      '**📋 WEEKLY MARS CHRONICLE REPORT**',
      `Week ending ${new Date().toISOString().slice(0,10)}`,
      '',
      '**Top Events:**'
    ];
    res.rows.forEach(r => lines.push(`• ${r.event_type}: ${r.cnt} times`));
    lines.push('', '**Most Active Colonists:**');
    topRes.rows.forEach(r => lines.push(`• ${r.nickname || r.actor_wallet.slice(0,8)+'...'}: ${r.events} events`));

    await sendDiscordWebhook(lines.join('\n'));
    console.log('[CHRONICLE] Weekly report sent');
  } catch (err) {
    console.error('[CHRONICLE] sendWeeklyReport error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// SSE emitter 내보내기
// ─────────────────────────────────────────────────────────────
module.exports = {
  record,
  checkHijackRecord,
  checkGovernorMilestone,
  checkEnhancementRecord,
  sendDiscordWebhook,
  getRecentChronicles,
  sendWeeklyReport,
  chronicleEmitter
};
