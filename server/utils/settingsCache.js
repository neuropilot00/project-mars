const { getSettings, getActiveEvents } = require('../db');

let cachedSettings = null;
let settingsLastFetch = 0;

async function cfg() {
  if (!cachedSettings || Date.now() - settingsLastFetch > 30000) {
    cachedSettings = await getSettings();
    settingsLastFetch = Date.now();
  }
  return cachedSettings;
}

async function getDepositBonusPercent() {
  const settings = await cfg();
  let bonus = settings.deposit_pp_bonus || 10;
  const events = await getActiveEvents();

  for (const event of events) {
    if (event.type === 'deposit_bonus' && event.config && event.config.extra_pp_percent) {
      bonus += event.config.extra_pp_percent;
    }
  }

  return bonus;
}

module.exports = {
  cfg,
  getDepositBonusPercent,
};
