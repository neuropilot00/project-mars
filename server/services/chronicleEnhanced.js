// server/services/chronicleEnhanced.js
// ═══════════════════════════════════════════════════════════════
// Chronicle 심화 — 기존 chronicle.js 확장판
// 
// 기존 chronicle.js를 건드리지 않고 이 파일에서 확장.
// 주요 추가:
//   1. 이벤트 핸들러 (governorOverthrown, largeHijack 등)
//   2. Weekly Chronicle 자동 생성 + Discord/Telegram 발송
//   3. 소셜 공유 카드 생성 (share_cards)
//
// 사용법:
//   const ce = require('./chronicleEnhanced');
//   await ce.governorOverthrown({ sector, winner, loser, participants });
//   await ce.generateWeeklyChronicle();
// ═══════════════════════════════════════════════════════════════

const crypto = require('crypto');
const { pool } = require('../db');

// 기존 chronicle.js 의 record + sendDiscordWebhook + getSetting 활용
let chronicle;
try {
  chronicle = require('./chronicle');
} catch {
  chronicle = null;
}

// ─── 내부 헬퍼 ───

async function getSetting(key, fallback = '') {
  try {
    if (chronicle?.getSetting) return chronicle.getSetting(key);
    const { rows } = await pool.query(`SELECT value FROM settings WHERE key = $1`, [key]);
    return rows[0]?.value ?? fallback;
  } catch { return fallback; }
}

async function record(eventType, data) {
  if (chronicle?.record) return chronicle.record(eventType, data);

  // chronicle.js 없으면 직접 INSERT
  try {
    await pool.query(`
      INSERT INTO server_chronicles (
        event_type, actor_wallet, target_wallet, guild_id,
        sector_code, value_pp, value_gp, extra_data,
        title_en, title_ko, body_ko, is_public, webhook_sent
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    `, [
      eventType,
      data.actor_wallet || null,
      data.target_wallet || null,
      data.guild_id || null,
      data.sector_code || null,
      data.value_pp || null,
      data.value_gp || null,
      JSON.stringify(data.extra_data || {}),
      data.title_en || null,
      data.title_ko || null,
      data.body_ko || null,
      data.is_public !== false,
      data.webhook || false,
    ]);
  } catch (err) {
    console.error('[chronicle] record error:', err.message);
  }
}

async function sendDiscordWebhook(payload) {
  if (chronicle?.sendDiscordWebhook) return chronicle.sendDiscordWebhook(payload);
  try {
    const webhookUrl = await getSetting('discord_webhook_url');
    if (!webhookUrl) return;
    const { default: fetch } = await import('node-fetch').catch(() => ({ default: null }));
    if (!fetch) return;
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[chronicle] discord webhook error:', err.message);
  }
}

// ─── 이벤트 핸들러 ───

/**
 * 1. Governor 교체 (항상 기록 + webhook)
 */
async function governorOverthrown(data) {
  const { sector, winner, loser, participants = 0 } = data;
  const titleKo = `${winner.nickname}이/가 ${loser.nickname}으로부터 ${sector.name_ko || sector.name} 점령`;
  const titleEn = `${winner.nickname} seizes ${sector.name_en || sector.name} from ${loser.nickname}`;

  await record('governor_overthrown', {
    actor_wallet: winner.wallet_address,
    target_wallet: loser.wallet_address,
    sector_code: sector.code,
    extra_data: { participants, winner_nickname: winner.nickname, loser_nickname: loser.nickname },
    title_ko: titleKo,
    title_en: titleEn,
    body_ko: `${participants}명의 개척자들이 지켜보는 가운데, ${winner.nickname}이 ${sector.name_ko || sector.name}의 새 Governor가 됐다.`,
    webhook: true,
    is_public: true,
  });

  // Discord 발송
  await sendDiscordWebhook({
    embeds: [{
      title: `🔱 Governor 교체`,
      description: titleKo,
      fields: [
        { name: '섹터', value: sector.name_ko || sector.name, inline: true },
        { name: '승자', value: winner.nickname, inline: true },
        { name: '패자', value: loser.nickname, inline: true },
      ],
      color: 0xFF4500,
    }]
  });
}

/**
 * 2. 대형 Hijack
 */
async function largeHijack(data) {
  const min = parseFloat(await getSetting('chronicle_hijack_min_pp') || '500');
  if ((data.ppAmount || 0) < min) return;

  const titleKo = `${data.attacker.nickname}이 ${data.ppAmount} PP에 ${data.pixels || '?'}px 탈취`;
  const titleEn = `${data.attacker.nickname} seizes ${data.pixels}px for ${data.ppAmount} PP`;

  await record('large_hijack', {
    actor_wallet: data.attacker.wallet_address,
    target_wallet: data.defender?.wallet_address,
    sector_code: data.sectorCode,
    value_pp: data.ppAmount,
    extra_data: { pixels: data.pixels, attacker: data.attacker.nickname },
    title_ko: titleKo,
    title_en: titleEn,
    body_ko: `${data.sectorCode} 섹터에서 대규모 영토 탈취가 발생했다.`,
    webhook: data.ppAmount > min * 5,
    is_public: true,
  });
}

/**
 * 3. Enhancement +10 최초 달성
 */
async function firstMaxEnhancement(data) {
  const { rows: existing } = await pool.query(
    `SELECT id FROM server_chronicles WHERE event_type = 'first_max_enhancement' LIMIT 1`
  );
  if (existing[0]) return; // 이미 서버 최초 달성자 있음

  await record('first_max_enhancement', {
    actor_wallet: data.wallet_address,
    extra_data: { item_name: data.itemName },
    title_ko: `${data.nickname}이 +10 ${data.itemName} 달성 — 서버 최초!`,
    title_en: `${data.nickname} achieves +10 ${data.itemName} — Server First!`,
    body_ko: `화성 최초의 +10 강화 달성. ${data.nickname}이 역사를 만들었다.`,
    webhook: true,
    is_public: true,
  });

  await sendDiscordWebhook({
    embeds: [{
      title: `⭐ 서버 최초 +10 달성!`,
      description: `**${data.nickname}**이 **+10 ${data.itemName}** 달성 — 화성 역사상 최초!`,
      color: 0xFFD700,
    }]
  });
}

/**
 * 4. Siege 최대 참여 기록
 */
async function siegeRecord(data) {
  const { rows: existing } = await pool.query(`
    SELECT (extra_data->>'participants')::INT AS cnt
    FROM server_chronicles
    WHERE event_type = 'siege_record_participants'
    ORDER BY occurred_at DESC LIMIT 1
  `);
  const currentRecord = existing[0]?.cnt || 0;
  if ((data.participants || 0) <= currentRecord) return;

  await record('siege_record_participants', {
    sector_code: data.sectorCode,
    extra_data: { participants: data.participants, sector_name: data.sectorName },
    title_ko: `${data.participants}명이 ${data.sectorName}에서 충돌 — 신기록!`,
    title_en: `${data.participants} colonists clash in ${data.sectorName} — New Record!`,
    body_ko: `화성 역사상 가장 많은 개척자들이 한 곳에서 싸웠다.`,
    webhook: true,
    is_public: true,
  });
}

/**
 * 5. 신입 Governor (가입 30일 미만)
 */
async function underdogGovernor(data) {
  const accountAgeDays = (Date.now() - new Date(data.winner.created_at).getTime()) / 86400000;
  if (accountAgeDays >= 30) return;

  await record('underdog_governor', {
    actor_wallet: data.winner.wallet_address,
    sector_code: data.sectorCode,
    extra_data: { days_since_join: Math.floor(accountAgeDays), sector_name: data.sectorName },
    title_ko: `신입 ${data.winner.nickname}이 베테랑들을 물리치고 ${data.sectorName} 정복`,
    title_en: `Newcomer ${data.winner.nickname} stuns veterans in ${data.sectorName}`,
    webhook: true,
    is_public: true,
  });
}

/**
 * 6. Governor 장기 재임 마일스톤 (7/30/90일)
 */
async function governorMilestone(data) {
  const milestones = [7, 30, 90];
  if (!milestones.includes(data.days)) return;

  await record('governor_milestone', {
    actor_wallet: data.governorWallet,
    sector_code: data.sectorCode,
    extra_data: { days: data.days, sector_name: data.sectorName, nickname: data.nickname },
    title_ko: `${data.nickname}이 ${data.sectorName}을 ${data.days}일째 통치 중`,
    title_en: `${data.nickname} rules ${data.sectorName} for ${data.days} days`,
    webhook: data.days >= 30,
    is_public: true,
  });
}

/**
 * 7. 폭풍 속 대형 공격
 */
async function stormOffensive(data) {
  const min = parseFloat(await getSetting('chronicle_storm_min_pp') || '300');
  if ((data.ppAmount || 0) < min || !data.duringWeather) return;

  await record('storm_offensive', {
    actor_wallet: data.attackerWallet,
    sector_code: data.sectorCode,
    value_pp: data.ppAmount,
    extra_data: { weather_type: data.weatherType, sector_name: data.sectorName },
    title_ko: `${data.nickname}이 ${data.sectorName} 폭풍 속에서 기습 감행`,
    title_en: `${data.nickname} strikes under cover of dust storm in ${data.sectorName}`,
    webhook: false,
    is_public: true,
  });
}

// ─── Weekly Chronicle 생성 ───

/**
 * 매주 월요일 UTC 00:00 실행
 * 지난 7일간 chronicles 집계 → Discord/Telegram 발송
 */
async function generateWeeklyChronicle() {
  const enabled = await getSetting('chronicle_weekly_enabled');
  if (enabled === 'false') return;

  const now = new Date();
  const weekNum = getISOWeek(now);
  const year = now.getFullYear();

  // 이미 생성됐으면 스킵
  const { rows: existing } = await pool.query(
    `SELECT id FROM weekly_chronicles WHERE year = $1 AND week_number = $2`,
    [year, weekNum]
  );
  if (existing[0]) {
    console.log(`[chronicle] weekly ${year}-W${weekNum} already exists`);
    return;
  }

  // 지난 7일 chronicles
  const { rows: events } = await pool.query(`
    SELECT c.*, u.nickname AS actor_nickname
    FROM server_chronicles c
    LEFT JOIN users u ON u.wallet_address = c.actor_wallet
    WHERE c.occurred_at >= NOW() - INTERVAL '7 days'
      AND c.is_public = true
    ORDER BY c.occurred_at DESC
    LIMIT 100
  `);

  // 주간 통계 집계
  const stats = await collectWeeklyStats();

  // 헤드라인: webhook_sent + value_pp 가장 높은 것
  const headline = events
    .filter(e => e.webhook_sent)
    .sort((a, b) => (parseFloat(b.value_pp) || 0) - (parseFloat(a.value_pp) || 0))[0];

  const powerShifts   = events.filter(e => e.event_type.includes('governor'));
  const battles       = events.filter(e => ['large_hijack','storm_offensive','siege_record_participants','fleet_battle_concluded'].includes(e.event_type));
  const achievements  = events.filter(e => ['first_max_enhancement','governor_milestone','underdog_governor'].includes(e.event_type));

  const chronicleBody = {
    week: weekNum, year,
    headline: headline ? (headline.title_ko || headline.title_en) : '이번 주는 조용했다.',
    power_shifts: powerShifts.map(e => ({ type: e.event_type, title: e.title_ko || e.title_en, sector: e.sector_code })),
    battles: battles.map(e => ({ type: e.event_type, title: e.title_ko || e.title_en, pp: e.value_pp })),
    achievements: achievements.map(e => ({ type: e.event_type, title: e.title_ko || e.title_en })),
    rankings: stats,
    total_events: events.length,
  };

  const headlineText = chronicleBody.headline;

  // DB 저장
  await pool.query(`
    INSERT INTO weekly_chronicles (week_number, year, headline_ko, headline_en, body_json)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (year, week_number) DO NOTHING
  `, [weekNum, year, headlineText, headlineText, JSON.stringify(chronicleBody)]);

  // Discord 발송
  const discordPayload = buildWeeklyDiscordPayload(weekNum, year, chronicleBody, stats);
  await sendDiscordWebhook(discordPayload);

  // Telegram 발송 (있으면)
  try {
    const { sendTelegramNotification } = require('./telegram');
    await sendTelegramNotification(buildWeeklyTelegramMessage(weekNum, year, chronicleBody, stats));
  } catch {}

  // 발송 완료 표시
  await pool.query(`
    UPDATE weekly_chronicles SET discord_sent = true, telegram_sent = true
    WHERE year = $1 AND week_number = $2
  `, [year, weekNum]);

  console.log(`[chronicle] weekly ${year}-W${weekNum} generated and sent`);
  return chronicleBody;
}

async function collectWeeklyStats() {
  try {
    const [topPP, topHijack, hotSector] = await Promise.all([
      // 주간 최다 PP 획득자
      pool.query(`
        SELECT u.nickname, SUM(c.value_pp) AS total_pp
        FROM server_chronicles c
        JOIN users u ON u.wallet_address = c.actor_wallet
        WHERE c.occurred_at >= NOW() - INTERVAL '7 days' AND c.value_pp > 0
        GROUP BY u.nickname ORDER BY total_pp DESC LIMIT 1
      `),
      // 주간 최다 Hijack
      pool.query(`
        SELECT u.nickname, COUNT(*) AS cnt
        FROM server_chronicles c
        JOIN users u ON u.wallet_address = c.actor_wallet
        WHERE c.occurred_at >= NOW() - INTERVAL '7 days'
          AND c.event_type = 'large_hijack'
        GROUP BY u.nickname ORDER BY cnt DESC LIMIT 1
      `),
      // 가장 활발한 섹터
      pool.query(`
        SELECT sector_code, COUNT(*) AS cnt
        FROM server_chronicles
        WHERE occurred_at >= NOW() - INTERVAL '7 days'
          AND sector_code IS NOT NULL
        GROUP BY sector_code ORDER BY cnt DESC LIMIT 1
      `),
    ]);

    return {
      top_pp_earner: topPP.rows[0] || null,
      top_hijacker: topHijack.rows[0] || null,
      hottest_sector: hotSector.rows[0]?.sector_code || null,
    };
  } catch { return {}; }
}

function buildWeeklyDiscordPayload(weekNum, year, body, stats) {
  const fields = [];

  if (body.power_shifts.length > 0) {
    fields.push({
      name: '🔱 권력 교체',
      value: body.power_shifts.slice(0, 3).map(e => `• ${e.title}`).join('\n') || '-',
      inline: false,
    });
  }

  if (body.battles.length > 0) {
    fields.push({
      name: '⚔️ 전투',
      value: body.battles.slice(0, 3).map(e => `• ${e.title}`).join('\n') || '-',
      inline: false,
    });
  }

  const rankLines = [];
  if (stats.top_pp_earner) rankLines.push(`🥇 최다 PP: **${stats.top_pp_earner.nickname}**`);
  if (stats.top_hijacker) rankLines.push(`⚔️ 최다 Hijack: **${stats.top_hijacker.nickname}**`);
  if (stats.hottest_sector) rankLines.push(`🔥 최고 섹터: **${stats.hottest_sector}**`);
  if (rankLines.length > 0) {
    fields.push({ name: '🏆 이번 주 랭킹', value: rankLines.join('\n'), inline: false });
  }

  return {
    embeds: [{
      title: `📰 Mars Chronicle — ${year}년 ${weekNum}주차`,
      description: `**${body.headline}**`,
      fields,
      color: 0xFF4500,
      footer: { text: 'Occupy Mars — Your story becomes history' },
      timestamp: new Date().toISOString(),
    }]
  };
}

function buildWeeklyTelegramMessage(weekNum, year, body, stats) {
  let msg = `<b>📰 Mars Chronicle — ${year}년 ${weekNum}주차</b>\n\n`;
  msg += `<i>${body.headline}</i>\n\n`;

  if (body.power_shifts.length > 0) {
    msg += `<b>🔱 권력 교체</b>\n`;
    body.power_shifts.slice(0, 3).forEach(e => { msg += `• ${e.title}\n`; });
    msg += '\n';
  }

  if (stats.top_pp_earner) msg += `🥇 주간 최다 PP: <b>${stats.top_pp_earner.nickname}</b>\n`;
  if (stats.top_hijacker) msg += `⚔️ 최다 Hijack: <b>${stats.top_hijacker.nickname}</b>\n`;

  return msg;
}

// ─── 소셜 공유 카드 ───

/**
 * 공유 카드 생성
 */
async function createShareCard(params) {
  const { card_type, wallet_address, ref_id, title_ko, title_en, extra_data = {} } = params;

  const token = crypto.randomBytes(12).toString('base64url');  // 16자
  const expireDays = parseInt(await getSetting('share_card_expire_days') || '90');
  const expiresAt = expireDays > 0
    ? new Date(Date.now() + expireDays * 86400000)
    : null;

  const { rows } = await pool.query(`
    INSERT INTO share_cards (token, card_type, wallet_address, ref_id, title_ko, title_en, extra_data, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING token, card_type, created_at
  `, [token, card_type, wallet_address, ref_id || null, title_ko, title_en,
      JSON.stringify(extra_data), expiresAt]);

  return {
    ...rows[0],
    share_url: `/share/${token}`,
    og_url: `/api/public/share/${token}`,
  };
}

async function getShareCard(token) {
  const { rows } = await pool.query(`
    SELECT sc.*, u.nickname
    FROM share_cards sc
    LEFT JOIN users u ON u.wallet_address = sc.wallet_address
    WHERE sc.token = $1
      AND (sc.expires_at IS NULL OR sc.expires_at > NOW())
  `, [token]);

  if (!rows[0]) return null;

  // 조회수 증가
  pool.query(`UPDATE share_cards SET view_count = view_count + 1 WHERE token = $1`, [token]).catch(() => {});

  return rows[0];
}

// ─── 유틸 ───

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

module.exports = {
  // 이벤트 핸들러
  governorOverthrown,
  largeHijack,
  firstMaxEnhancement,
  siegeRecord,
  underdogGovernor,
  governorMilestone,
  stormOffensive,
  // Weekly
  generateWeeklyChronicle,
  collectWeeklyStats,
  // 공유 카드
  createShareCard,
  getShareCard,
};
