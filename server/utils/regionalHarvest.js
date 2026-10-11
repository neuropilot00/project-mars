'use strict';
// Keep local effects on the local share, including weather/satellite overlap.
async function regionMultiplier(sectorId, weather, exploration) {
  let miningMod = 0, satelliteBoost = 0;
  if (sectorId) {
    try { if (weather) miningMod = Number((await weather.getWeatherModifiers(sectorId)).miningMod) || 0; } catch (_) {}
    try { if (exploration) satelliteBoost = Number(await exploration.getStarlinkBoost(sectorId)) || 0; } catch (_) {}
  }
  return Math.max(0, 1 + miningMod / 100) * Math.max(0, 1 + satelliteBoost);
}
async function weightedRegionMultiplier(rows, tierMultipliers, weather, exploration) {
  let baseline = 0, adjusted = 0;
  for (const row of rows) {
    const weight = Number(row.cnt) * (Number(tierMultipliers[row.tier]) || 1);
    baseline += weight;
    adjusted += weight * await regionMultiplier(row.sector_id, weather, exploration);
  }
  return baseline > 0 ? adjusted / baseline : 1;
}
module.exports = { regionMultiplier, weightedRegionMultiplier };
