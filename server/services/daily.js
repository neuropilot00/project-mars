const { pool, getSetting } = require('../db');

// Mission pool definitions
const MISSION_POOL = [
  { type: 'claim_pixels',    label: 'Expand Territory',  icon: '🏴', targetMin: 3, targetMax: 8, rewardGP: 15, rewardXP: 5 },
  { type: 'harvest',         label: 'Collect Resources', icon: '⛏️', targetMin: 1, targetMax: 1, rewardGP: 10, rewardXP: 5 },
  { type: 'explore_poi',     label: 'Recon Mission',     icon: '🔭', targetMin: 1, targetMax: 1, rewardGP: 20, rewardXP: 5 },
  { type: 'hijack',          label: 'Hostile Takeover',   icon: '⚔️', targetMin: 1, targetMax: 3, rewardGP: 25, rewardXP: 5 },
  { type: 'play_cantina',    label: 'Cantina Night',     icon: '🎰', targetMin: 1, targetMax: 1, rewardGP: 10, rewardXP: 5 },
  { type: 'equip_cosmetic',  label: 'Mars Fashion',      icon: '👗', targetMin: 1, targetMax: 1, rewardGP: 10, rewardXP: 5 },
  { type: 'view_weather',    label: 'Storm Chaser',      icon: '🌪️', targetMin: 1, targetMax: 1, rewardGP: 10, rewardXP: 5 },
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Record daily login & streak ──
async function recordDailyLogin(wallet) {
  const w = wallet.toLowerCase();

  // Check if already logged in today
  const existing = await pool.query(
    'SELECT * FROM daily_logins WHERE wallet = $1 AND login_date = CURRENT_DATE',
    [w]
  );
  if (existing.rows.length) {
    const row = existing.rows[0];
    const totalRes = await pool.query('SELECT COUNT(*) AS cnt FROM daily_logins WHERE wallet = $1', [w]);
    const totalDays = parseInt(totalRes.rows[0].cnt);
    return {
      alreadyClaimed: true,
      streakDay: row.streak_day,
      rewardGP: parseFloat(row.reward_gp),
      rewardPP: parseFloat(row.reward_pp),
      totalDays,
      milestone: null
    };
  }

  // Check yesterday's record for streak continuity
  const yesterday = await pool.query(
    "SELECT streak_day FROM daily_logins WHERE wallet = $1 AND login_date = CURRENT_DATE - INTERVAL '1 day'",
    [w]
  );

  let streakDay = 1;
  if (yesterday.rows.length) {
    streakDay = yesterday.rows[0].streak_day + 1;
    const maxDays = parseInt(await getSetting('daily_streak_cycle', 14));
    if (streakDay > maxDays) streakDay = 1; // cycle after 14
  }

  // Get reward arrays from settings
  const gpRewards = await getSetting('daily_login_gp_rewards', [5, 10, 10, 15, 15, 20, 30, 10, 15, 15, 20, 20, 25, 50]);
  const ppRewards = await getSetting('daily_login_pp_rewards', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  const rewardGP = gpRewards[streakDay - 1] || 0;
  const rewardPP = ppRewards[streakDay - 1] || 0;

  // Insert login record
  await pool.query(
    `INSERT INTO daily_logins (wallet, login_date, streak_day, reward_gp, reward_pp)
     VALUES ($1, CURRENT_DATE, $2, $3, $4)`,
    [w, streakDay, rewardGP, rewardPP]
  );

  // Credit user balances
  if (rewardGP > 0 || rewardPP > 0) {
    await pool.query(
      'UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1, pp_balance = pp_balance + $2 WHERE wallet_address = $3',
      [rewardGP, rewardPP, w]
    );
  }

  // Count total login days for milestone check
  const totalRes = await pool.query('SELECT COUNT(*) AS cnt FROM daily_logins WHERE wallet = $1', [w]);
  const totalDays = parseInt(totalRes.rows[0].cnt);

  // Milestone bonuses
  let milestone = null;
  let milestoneGP = 0;
  let milestonePP = 0;

  // Streak milestones (based on current streak day, not total days)
  if (streakDay === 3) {
    milestoneGP = parseFloat(await getSetting('streak_3_gp', 30));
    milestone = { days: 3, gp: milestoneGP, pp: 0 };
  } else if (streakDay === 7) {
    milestoneGP = parseFloat(await getSetting('streak_7_gp', 100));
    milestone = { days: 7, gp: milestoneGP, pp: 0 };
  } else if (streakDay === 10) {
    milestoneGP = parseFloat(await getSetting('streak_10_gp', 150));
    milestone = { days: 10, gp: milestoneGP, pp: 0 };
  } else if (streakDay === 14) {
    milestoneGP = parseFloat(await getSetting('streak_14_gp', 300));
    milestone = { days: 14, gp: milestoneGP, pp: 0 };
  }

  if (milestoneGP > 0 || milestonePP > 0) {
    await pool.query(
      'UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1, pp_balance = pp_balance + $2 WHERE wallet_address = $3',
      [milestoneGP, milestonePP, w]
    );
  }

  return {
    alreadyClaimed: false,
    streakDay,
    rewardGP,
    rewardPP,
    totalDays,
    milestone
  };
}

// ── Get or generate daily missions ──
async function getDailyMissions(wallet) {
  const w = wallet.toLowerCase();

  // Check existing missions for today
  const existing = await pool.query(
    'SELECT * FROM daily_missions WHERE wallet = $1 AND mission_date = CURRENT_DATE ORDER BY slot',
    [w]
  );
  if (existing.rows.length >= 3) {
    return existing.rows.map(formatMission);
  }

  // Generate 3 random missions (no duplicates)
  const shuffled = [...MISSION_POOL].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);

  const missions = [];
  for (let i = 0; i < 3; i++) {
    const m = selected[i];
    const target = randInt(m.targetMin, m.targetMax);
    const res = await pool.query(
      `INSERT INTO daily_missions (wallet, mission_date, slot, mission_type, target_value, reward_gp, reward_xp)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6)
       ON CONFLICT (wallet, mission_date, slot) DO NOTHING
       RETURNING *`,
      [w, i + 1, m.type, target, m.rewardGP, m.rewardXP]
    );
    if (res.rows.length) {
      missions.push(formatMission(res.rows[0]));
    }
  }

  // If ON CONFLICT hit (race condition), re-fetch
  if (missions.length < 3) {
    const refetch = await pool.query(
      'SELECT * FROM daily_missions WHERE wallet = $1 AND mission_date = CURRENT_DATE ORDER BY slot',
      [w]
    );
    return refetch.rows.map(formatMission);
  }

  return missions;
}

function formatMission(row) {
  const def = MISSION_POOL.find(m => m.type === row.mission_type);
  return {
    id: row.id,
    slot: row.slot,
    type: row.mission_type,
    icon: def ? def.icon : '📋',
    title: def ? def.label : row.mission_type,
    target: row.target_value,
    current: row.current_value,
    reward: parseFloat(row.reward_gp),
    rewardXP: row.reward_xp,
    completed: row.completed,
    claimed: row.claimed
  };
}

// ── Update mission progress (called from hooks) ──
async function updateMissionProgress(wallet, missionType, increment) {
  const w = wallet.toLowerCase();
  const inc = increment || 1;

  const res = await pool.query(
    `UPDATE daily_missions
     SET current_value = LEAST(current_value + $1, target_value)
     WHERE wallet = $2 AND mission_date = CURRENT_DATE AND mission_type = $3 AND completed = false
     RETURNING *`,
    [inc, w, missionType]
  );

  if (!res.rows.length) return null;

  const mission = res.rows[0];
  // Check if now completed
  if (mission.current_value >= mission.target_value && !mission.completed) {
    await pool.query(
      'UPDATE daily_missions SET completed = true WHERE id = $1',
      [mission.id]
    );
    mission.completed = true;
  }

  return formatMission(mission);
}

// ── Claim mission reward ──
async function claimMissionReward(wallet, missionId) {
  const w = wallet.toLowerCase();

  // Verify mission belongs to wallet, is completed, not claimed
  const res = await pool.query(
    'SELECT * FROM daily_missions WHERE id = $1 AND wallet = $2 AND completed = true AND claimed = false',
    [missionId, w]
  );
  if (!res.rows.length) {
    return { error: 'Mission not claimable (not completed, already claimed, or not yours)' };
  }

  const mission = res.rows[0];

  // Mark as claimed
  await pool.query('UPDATE daily_missions SET claimed = true WHERE id = $1', [missionId]);

  // Credit GP
  const rewardGP = parseFloat(mission.reward_gp);
  if (rewardGP > 0) {
    await pool.query(
      'UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE wallet_address = $2',
      [rewardGP, w]
    );
  }

  // Award XP if applicable
  let xpAwarded = mission.reward_xp || 0;
  if (xpAwarded > 0) {
    try {
      await pool.query(
        'UPDATE users SET xp = xp + $1 WHERE wallet_address = $2',
        [xpAwarded, w]
      );
    } catch (_e) { /* xp column may not exist */ }
  }

  // Check if all 3 missions are claimed -> bonus GP
  const allClaimed = await pool.query(
    'SELECT COUNT(*) AS cnt FROM daily_missions WHERE wallet = $1 AND mission_date = CURRENT_DATE AND claimed = true',
    [w]
  );
  let bonusGP = 0;
  if (parseInt(allClaimed.rows[0].cnt) >= 3) {
    bonusGP = parseFloat(await getSetting('daily_mission_bonus_gp', 50));
    if (bonusGP > 0) {
      await pool.query(
        'UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE wallet_address = $2',
        [bonusGP, w]
      );
    }
  }

  return {
    success: true,
    missionId,
    rewardGP,
    xpAwarded,
    bonusGP,
    allComplete: parseInt(allClaimed.rows[0].cnt) >= 3
  };
}

// ── Get streak info ──
async function getStreakInfo(wallet) {
  const w = wallet.toLowerCase();

  // Latest login record
  const latest = await pool.query(
    'SELECT * FROM daily_logins WHERE wallet = $1 ORDER BY login_date DESC LIMIT 1',
    [w]
  );

  // Total login days
  const totalRes = await pool.query('SELECT COUNT(*) AS cnt FROM daily_logins WHERE wallet = $1', [w]);
  const totalDays = parseInt(totalRes.rows[0].cnt);

  // Today claimed?
  const todayRes = await pool.query(
    'SELECT 1 FROM daily_logins WHERE wallet = $1 AND login_date = CURRENT_DATE',
    [w]
  );
  const todayClaimed = todayRes.rows.length > 0;

  let currentStreak = 0;
  if (latest.rows.length) {
    const lastDate = new Date(latest.rows[0].login_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today - lastDate) / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) {
      currentStreak = latest.rows[0].streak_day;
    }
    // If more than 1 day gap, streak is broken
  }

  // Next milestone
  let nextMilestone = null;
  if (totalDays < 7) nextMilestone = { days: 7, remaining: 7 - totalDays };
  else if (totalDays < 14) nextMilestone = { days: 14, remaining: 14 - totalDays };
  else if (totalDays < 30) nextMilestone = { days: 30, remaining: 30 - totalDays };

  return {
    currentStreak,
    totalDays,
    todayClaimed,
    nextMilestone
  };
}

module.exports = {
  recordDailyLogin,
  getDailyMissions,
  updateMissionProgress,
  claimMissionReward,
  getStreakInfo
};
