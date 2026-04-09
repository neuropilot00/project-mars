const { pool, getSetting } = require('../db');

// Weather type definitions with effects
const WEATHER_TYPES = {
  sandstorm:     { miningMod: 50, defenseMod: -30, attackMod: 0, claimCostMod: 0, shieldMod: 0,    icon: '🌪️', label: 'Sandstorm' },
  solar_flare:   { miningMod: 100, defenseMod: 0,  attackMod: 0, claimCostMod: 0, shieldMod: -50,  icon: '☀️', label: 'Solar Flare' },
  meteor_shower: { miningMod: 30, defenseMod: 0,   attackMod: 0, claimCostMod: 0, shieldMod: 0,    icon: '☄️', label: 'Meteor Shower' },
  dust_devil:    { miningMod: 0,  defenseMod: 0,   attackMod: 15, claimCostMod: -20, shieldMod: 0,  icon: '🌀', label: 'Dust Devil' }
};

async function spawnWeatherEvents() {
  const enabled = await getSetting('weather_enabled');
  if (enabled === 'false') return;

  const sectorCount = parseInt(await getSetting('weather_sectors_per_cycle') || '3');
  const minHours = parseInt(await getSetting('weather_duration_min_hours') || '2');
  const maxHours = parseInt(await getSetting('weather_duration_max_hours') || '4');

  // Get sectors without active weather
  const sectors = await pool.query(
    `SELECT s.id FROM sectors s
     WHERE NOT EXISTS (SELECT 1 FROM mars_weather mw WHERE mw.sector_id = s.id AND mw.active = true AND mw.ends_at > NOW())
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
      `INSERT INTO mars_weather (sector_id, weather_type, effects, starts_at, ends_at)
       VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '1 hour' * $4)`,
      [row.id, weatherType, JSON.stringify(effects), durationHours]
    );
    results.push({ sectorId: row.id, weatherType, durationHours: Math.round(durationHours * 10) / 10 });
  }

  if (results.length > 0) {
    console.log('[WEATHER] Spawned:', results.map(r => `sector ${r.sectorId}: ${r.weatherType} (${r.durationHours}h)`).join(', '));
  }
  return results;
}

async function getActiveWeather(sectorId) {
  let query = 'SELECT mw.*, s.name AS sector_name FROM mars_weather mw JOIN sectors s ON s.id = mw.sector_id WHERE mw.active = true AND mw.ends_at > NOW() AND mw.starts_at <= NOW()';
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
    icon: WEATHER_TYPES[r.weather_type]?.icon || '🌡️',
    label: WEATHER_TYPES[r.weather_type]?.label || r.weather_type
  }));
}

async function getWeatherModifiers(sectorId) {
  const weather = await getActiveWeather(sectorId);
  const mods = { miningMod: 0, defenseMod: 0, attackMod: 0, claimCostMod: 0, shieldMod: 0 };
  for (const w of weather) {
    const e = w.effects || {};
    mods.miningMod += (e.miningMod || 0);
    mods.defenseMod += (e.defenseMod || 0);
    mods.attackMod += (e.attackMod || 0);
    mods.claimCostMod += (e.claimCostMod || 0);
    mods.shieldMod += (e.shieldMod || 0);
  }
  return mods;
}

async function expireWeather() {
  const res = await pool.query(
    "UPDATE mars_weather SET active = false WHERE active = true AND ends_at < NOW() RETURNING id, sector_id, weather_type"
  );
  if (res.rowCount > 0) {
    console.log('[WEATHER] Expired:', res.rows.map(r => `#${r.id} ${r.weather_type} in sector ${r.sector_id}`).join(', '));
  }
}

module.exports = {
  WEATHER_TYPES,
  spawnWeatherEvents,
  getActiveWeather,
  getWeatherModifiers,
  expireWeather
};
