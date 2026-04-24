// server/services/weather.js
// ═══════════════════════════════════════════════════════════════
// Weather Service — 전략적 이벤트 방식으로 교체
// 바이블 COMPLETE_BIBLE PART 3 § 4 기준
//
// 변경 사항:
//   - spawnWeatherEvents(): 랜덤 → 비활성 (weather_random_enabled=false 시 스킵)
//   - createForecast(): 새 함수 — Admin이 48시간 전 예보 설정
//   - activateForecasts(): 시작 시간 된 예보를 active로 전환
//   - 기존 getActiveWeather(), getWeatherModifiers(), expireWeather() 유지
// ═══════════════════════════════════════════════════════════════

const { pool, getSetting } = require('../db');
const { sendTelegramNotification } = require('./telegram');

// ─── 날씨 타입 정의 (기존 유지) ───

const WEATHER_TYPES = {
  sandstorm:     { miningMod: 50,  defenseMod: -30, attackMod: 0,  claimCostMod: 0,   shieldMod: 0,   icon: '🌪️', label: 'Sandstorm',     label_ko: '모래폭풍' },
  solar_flare:   { miningMod: 100, defenseMod: 0,   attackMod: 0,  claimCostMod: 0,   shieldMod: -50, icon: '☀️', label: 'Solar Flare',    label_ko: '태양 폭발' },
  meteor_shower: { miningMod: 30,  defenseMod: 0,   attackMod: 0,  claimCostMod: 0,   shieldMod: 0,   icon: '☄️', label: 'Meteor Shower',  label_ko: '유성우' },
  dust_devil:    { miningMod: 0,   defenseMod: 0,   attackMod: 15, claimCostMod: -20, shieldMod: 0,   icon: '🌀', label: 'Dust Devil',     label_ko: '먼지 악마' },
};

// ─── 기존 함수: 랜덤 생성 (weather_random_enabled=false면 스킵) ───

async function spawnWeatherEvents() {
  const randomEnabled = await getSetting('weather_random_enabled');
  if (randomEnabled === 'false' || randomEnabled === false) {
    // 전략적 이벤트 모드에서는 랜덤 생성 비활성
    return [];
  }

  const enabled = await getSetting('weather_enabled');
  if (enabled === 'false') return [];

  const sectorCount = parseInt(await getSetting('weather_sectors_per_cycle') || '3');
  const minHours = parseInt(await getSetting('weather_duration_min_hours') || '2');
  const maxHours = parseInt(await getSetting('weather_duration_max_hours') || '4');

  const sectors = await pool.query(
    `SELECT s.id FROM sectors s
     WHERE NOT EXISTS (
       SELECT 1 FROM mars_weather mw
       WHERE mw.sector_id = s.id AND mw.active = true AND mw.ends_at > NOW()
     )
     ORDER BY RANDOM() LIMIT $1`,
    [sectorCount]
  );

  const types = Object.keys(WEATHER_TYPES);
  const results = [];

  for (const row of sectors.rows) {
    const weatherType = types[Math.floor(Math.random() * types.length)];
    const durationHours = minHours + Math.random() * (maxHours - minHours);
    const effects = WEATHER_TYPES[weatherType];

    await pool.query(
      `INSERT INTO mars_weather (sector_id, weather_type, effects, starts_at, ends_at, status, is_strategic)
       VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '1 hour' * $4, 'active', false)`,
      [row.id, weatherType, JSON.stringify(effects), durationHours]
    );
    results.push({ sectorId: row.id, weatherType, durationHours: Math.round(durationHours * 10) / 10 });
  }

  if (results.length > 0) {
    console.log('[WEATHER] Spawned (random):', results.map(r => `sector ${r.sectorId}: ${r.weatherType} (${r.durationHours}h)`).join(', '));
    const icons = results.map(r => {
      const def = WEATHER_TYPES[r.weatherType];
      return `${def?.icon || ''} ${def?.label || r.weatherType} in Sector ${r.sectorId} (${r.durationHours}h)`;
    }).join('\n');
    sendTelegramNotification(`<b>🌡️ MARS WEATHER ALERT</b>\n\n${icons}\n\nCheck the map for affected sectors!`).catch(() => {});
  }
  return results;
}

// ─── 신규: 전략적 예보 생성 (Admin 호출) ───

/**
 * 전략적 날씨 이벤트 예보 생성
 * Admin이 48시간 전에 설정 → 전체 공지
 *
 * @param {object} params
 *   - sector_id: 섹터 ID
 *   - weather_type: 'sandstorm' | 'solar_flare' | 'meteor_shower' | 'dust_devil'
 *   - starts_at: 폭풍 시작 시간 (ISO string)
 *   - duration_hours: 지속 시간 (기본 6)
 *   - title_ko: 커스텀 제목 (선택)
 *   - description_ko: 커스텀 설명 (선택)
 */
async function createForecast(params) {
  const {
    sector_id,
    weather_type,
    starts_at,
    duration_hours = 6,
    title_ko,
    description_ko,
  } = params;

  if (!WEATHER_TYPES[weather_type]) throw new Error('INVALID_WEATHER_TYPE');
  if (!sector_id) throw new Error('SECTOR_ID_REQUIRED');
  if (!starts_at) throw new Error('STARTS_AT_REQUIRED');

  const startsAt = new Date(starts_at);
  if (isNaN(startsAt.getTime())) throw new Error('INVALID_STARTS_AT');
  if (startsAt <= new Date()) throw new Error('STARTS_AT_MUST_BE_FUTURE');

  const effects = WEATHER_TYPES[weather_type];
  const endsAt = new Date(startsAt.getTime() + duration_hours * 3600 * 1000);
  const forecastHours = await getSettingInt('weather_forecast_hours', 48);
  const forecastAt = new Date(startsAt.getTime() - forecastHours * 3600 * 1000);

  // 섹터 이름 조회
  const { rows: sectorRows } = await pool.query(
    `SELECT name FROM sectors WHERE id = $1`, [sector_id]
  );
  const sectorName = sectorRows[0]?.name || `Sector ${sector_id}`;

  const weatherDef = WEATHER_TYPES[weather_type];
  const autoTitle = title_ko || `${sectorName} ${weatherDef.label_ko} 예보`;
  const autoDesc = description_ko || buildDefaultDescription(weather_type, sectorName);

  const { rows } = await pool.query(`
    INSERT INTO mars_weather (
      sector_id, weather_type, effects,
      starts_at, ends_at, forecast_at,
      status, is_strategic, active,
      title_ko, description_ko
    ) VALUES ($1,$2,$3,$4,$5,$6,'forecast',true,false,$7,$8)
    RETURNING *
  `, [
    sector_id, weather_type, JSON.stringify(effects),
    startsAt, endsAt, forecastAt,
    autoTitle, autoDesc
  ]);

  const event = rows[0];

  // 텔레그램 + 게임 내 공지
  const hoursUntil = Math.round((startsAt - Date.now()) / 3600000);
  const msg = buildForecastMessage(weatherDef, sectorName, hoursUntil, duration_hours, effects);
  sendTelegramNotification(msg).catch(() => {});

  console.log(`[WEATHER] Strategic forecast created: ${weather_type} in sector ${sector_id} at ${startsAt.toISOString()}`);

  return event;
}

// ─── 예보 → 활성 전환 (스케줄러 호출) ───

/**
 * starts_at <= NOW() 인 예보를 active로 전환
 * 매 1분마다 스케줄러에서 호출
 */
async function activateForecasts() {
  const strategicEnabled = await getSetting('weather_strategic_enabled');
  if (strategicEnabled === 'false') return;

  const { rows } = await pool.query(`
    UPDATE mars_weather
    SET status = 'active', active = true
    WHERE status = 'forecast'
      AND is_strategic = true
      AND starts_at <= NOW()
      AND ends_at > NOW()
    RETURNING id, sector_id, weather_type, title_ko
  `);

  for (const row of rows) {
    console.log(`[WEATHER] Activated forecast: #${row.id} ${row.weather_type} in sector ${row.sector_id}`);

    // 폭풍 시작 공지
    const def = WEATHER_TYPES[row.weather_type];
    const { rows: sRows } = await pool.query(
      `SELECT name FROM sectors WHERE id = $1`, [row.sector_id]
    );
    const sName = sRows[0]?.name || `Sector ${row.sector_id}`;

    sendTelegramNotification(
      `<b>${def?.icon || '🌪️'} 폭풍 시작!</b>\n\n` +
      `${row.title_ko || def?.label_ko || row.weather_type}\n` +
      `📍 ${sName}\n\n` +
      `전략적 기회가 시작됐습니다!`
    ).catch(() => {});
  }

  return rows;
}

// ─── 기존 함수 유지 ───

async function getActiveWeather(sectorId) {
  let query = `
    SELECT mw.*, s.name AS sector_name
    FROM mars_weather mw
    JOIN sectors s ON s.id = mw.sector_id
    WHERE mw.active = true
      AND mw.ends_at > NOW()
      AND mw.starts_at <= NOW()
  `;
  const params = [];
  if (sectorId) {
    query += ' AND mw.sector_id = $1';
    params.push(sectorId);
  }
  query += ' ORDER BY mw.starts_at';

  const res = await pool.query(query, params);
  return res.rows.map(r => ({
    id: r.id,
    sectorId: r.sector_id,
    sectorName: r.sector_name,
    weatherType: r.weather_type,
    effects: r.effects,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    isStrategic: r.is_strategic,
    titleKo: r.title_ko,
    descriptionKo: r.description_ko,
    icon: WEATHER_TYPES[r.weather_type]?.icon || '🌡️',
    label: WEATHER_TYPES[r.weather_type]?.label_ko || r.weather_type,
  }));
}

async function getWeatherModifiers(sectorId) {
  const weather = await getActiveWeather(sectorId);
  const mods = { miningMod: 0, defenseMod: 0, attackMod: 0, claimCostMod: 0, shieldMod: 0 };
  for (const w of weather) {
    const e = w.effects || {};
    mods.miningMod    += (e.miningMod    || 0);
    mods.defenseMod   += (e.defenseMod   || 0);
    mods.attackMod    += (e.attackMod    || 0);
    mods.claimCostMod += (e.claimCostMod || 0);
    mods.shieldMod    += (e.shieldMod    || 0);
  }
  return mods;
}

async function expireWeather() {
  const res = await pool.query(
    `UPDATE mars_weather
     SET active = false, status = 'ended'
     WHERE active = true AND ends_at < NOW()
     RETURNING id, sector_id, weather_type, is_strategic`
  );
  if (res.rowCount > 0) {
    console.log('[WEATHER] Expired:', res.rows.map(r => `#${r.id} ${r.weather_type} in sector ${r.sector_id}`).join(', '));
  }
}

// ─── 예보 목록 조회 (UI용) ───

async function getUpcomingForecasts() {
  const { rows } = await pool.query(`
    SELECT mw.*, s.name AS sector_name
    FROM mars_weather mw
    JOIN sectors s ON s.id = mw.sector_id
    WHERE mw.status = 'forecast'
      AND mw.is_strategic = true
      AND mw.ends_at > NOW()
    ORDER BY mw.starts_at ASC
    LIMIT 10
  `);
  return rows.map(r => ({
    ...r,
    sectorName: r.sector_name,
    icon: WEATHER_TYPES[r.weather_type]?.icon || '🌡️',
    labelKo: WEATHER_TYPES[r.weather_type]?.label_ko || r.weather_type,
    hoursUntil: Math.max(0, Math.round((new Date(r.starts_at) - Date.now()) / 3600000)),
    durationHours: Math.round((new Date(r.ends_at) - new Date(r.starts_at)) / 3600000),
  }));
}

// ─── 예보 취소 (Admin) ───

async function cancelForecast(forecastId) {
  const { rows } = await pool.query(`
    UPDATE mars_weather
    SET status = 'ended', active = false
    WHERE id = $1 AND status = 'forecast' AND is_strategic = true
    RETURNING id, weather_type, sector_id
  `, [forecastId]);
  if (!rows[0]) throw new Error('FORECAST_NOT_FOUND');
  return rows[0];
}

// ─── 헬퍼 ───

function buildDefaultDescription(weatherType, sectorName) {
  const descs = {
    sandstorm:     `${sectorName}에 대규모 모래폭풍이 예보됩니다. Miner는 자원 채굴에 유리하지만 방어력이 약해집니다.`,
    solar_flare:   `${sectorName}에 태양 폭발이 예보됩니다. Mining 수익이 2배가 되지만 Shield 효과가 감소합니다.`,
    meteor_shower: `${sectorName}에 유성우가 예보됩니다. 희귀 자원 드롭률이 증가합니다.`,
    dust_devil:    `${sectorName}에 먼지 악마가 예보됩니다. 공격 성공률 증가, 영토 구매 비용 감소.`,
  };
  return descs[weatherType] || `${sectorName}에 날씨 이벤트가 예보됩니다.`;
}

function buildForecastMessage(def, sectorName, hoursUntil, durationHours, effects) {
  const effectLines = [];
  if (effects.miningMod)    effectLines.push(`⛏️ Mining ${effects.miningMod > 0 ? '+' : ''}${effects.miningMod}%`);
  if (effects.defenseMod)   effectLines.push(`🛡 방어 ${effects.defenseMod > 0 ? '+' : ''}${effects.defenseMod}%`);
  if (effects.attackMod)    effectLines.push(`⚔️ 공격 ${effects.attackMod > 0 ? '+' : ''}${effects.attackMod}%`);
  if (effects.claimCostMod) effectLines.push(`💰 영토 비용 ${effects.claimCostMod > 0 ? '+' : ''}${effects.claimCostMod}%`);
  if (effects.shieldMod)    effectLines.push(`🔮 Shield ${effects.shieldMod > 0 ? '+' : ''}${effects.shieldMod}%`);

  return (
    `<b>⚠️ ${def.icon} ${def.label_ko} 예보</b>\n\n` +
    `📍 ${sectorName}\n` +
    `⏱ ${hoursUntil}시간 후 시작 · ${durationHours}시간 지속\n\n` +
    effectLines.join('\n') + '\n\n' +
    `지금 전략을 세우세요!`
  );
}

async function getSettingInt(key, fallback) {
  try {
    const v = await getSetting(key);
    const n = parseInt(v, 10);
    return isNaN(n) ? fallback : n;
  } catch { return fallback; }
}

module.exports = {
  WEATHER_TYPES,
  spawnWeatherEvents,       // 기존 유지 (random disabled 시 스킵)
  createForecast,           // 신규: Admin 예보 생성
  activateForecasts,        // 신규: 예보 → active 전환
  getActiveWeather,         // 기존 유지
  getWeatherModifiers,      // 기존 유지
  expireWeather,            // 기존 유지 (status='ended' 추가)
  getUpcomingForecasts,     // 신규: 예보 목록
  cancelForecast,           // 신규: 예보 취소
};
