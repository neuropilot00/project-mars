const { pool, getSetting, notifyPlayer } = require('../db');

// Mission pool definitions
// rewardGP is the default; admin can override via daily_mission_<type>_reward_gp setting
const MISSION_POOL = [
  { type: 'claim_pixels',        label: 'Expand Territory',      desc: 'Claim land pixels on the Mars globe',              icon: '🏴',  targetMin: 3, targetMax: 8, rewardGP: 15, rewardXP: 5 },
  { type: 'harvest',             label: 'Collect Resources',     desc: 'Harvest PP from your owned territory',             icon: '⛏️', targetMin: 1, targetMax: 1, rewardGP: 10, rewardXP: 5 },
  { type: 'explore_poi',         label: 'Recon Mission',         desc: 'Discover a POI marker on the globe',               icon: '🔭',  targetMin: 1, targetMax: 1, rewardGP: 20, rewardXP: 5 },
  { type: 'hijack',              label: 'Hostile Takeover',      desc: 'Hijack enemy territory with GP',                   icon: '⚔️', targetMin: 1, targetMax: 3, rewardGP: 25, rewardXP: 5 },
  { type: 'play_cantina',        label: 'Cantina Night',         desc: 'Play a mini-game in the Cantina',                  icon: '🎰',  targetMin: 1, targetMax: 1, rewardGP: 10, rewardXP: 5 },
  { type: 'equip_cosmetic',      label: 'Mars Fashion',          desc: 'Equip a cosmetic item from your inventory',        icon: '👗',  targetMin: 1, targetMax: 1, rewardGP: 10, rewardXP: 5 },
  { type: 'view_weather',        label: 'Storm Chaser',          desc: 'Check the Mars weather forecast',                  icon: '🌪️', targetMin: 1, targetMax: 1, rewardGP: 10, rewardXP: 5 },
  // ── Migration 095: New activity missions ──
  { type: 'enhance_item',        label: 'Cosmetic Enhancement',  desc: 'Attempt to enhance a cosmetic item',               icon: '⚗️',  targetMin: 1, targetMax: 1, rewardGP: 20, rewardXP: 5 },
  { type: 'marketplace_trade',   label: 'Market Day',            desc: 'Buy an item on the marketplace or auction',        icon: '🛒',  targetMin: 1, targetMax: 1, rewardGP: 15, rewardXP: 5 },
  { type: 'win_naval_battle',    label: 'Naval Victory',         desc: 'Win a naval battle against another fleet',         icon: '⚓',  targetMin: 1, targetMax: 1, rewardGP: 40, rewardXP: 10 },
  { type: 'build_ship',          label: 'Shipyard Rush',         desc: 'Build a new ship for your fleet',                  icon: '🚢',  targetMin: 1, targetMax: 2, rewardGP: 25, rewardXP: 5 },
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

  // 7일 고정 주기 — 8일차 이후 그래픽 없으므로 반드시 리셋
  const CYCLE = 7;
  let streakDay = 1;
  let cycleReset = false;
  if (yesterday.rows.length) {
    streakDay = yesterday.rows[0].streak_day + 1;
    if (streakDay > CYCLE) { streakDay = 1; cycleReset = true; }
  }

  // 7일 주기 보상표 — Day7 완주 후 리셋 시 랜덤 재생성
  // 기본값: [Day1..Day7] GP 고정. 리셋 시 각 일차 보상을 랜덤하게 섞음
  const BASE_GP  = [5, 10, 15, 20, 25, 30, 50];
  const BASE_PP  = [0,  0,  0,  0,  0,  0,  0];
  let gpRewards, ppRewards;
  if (cycleReset) {
    // 리셋 사이클: GP 보상을 랜덤 변형 (±50%), Day7는 항상 보너스
    gpRewards = BASE_GP.map((v, i) => {
      if (i === 6) return randInt(60, 100); // Day7 보너스
      return randInt(Math.floor(v * 0.6), Math.floor(v * 1.5));
    });
    ppRewards = BASE_PP.map(() => randInt(0, 2));
  } else {
    const parseArr = (raw, def) => {
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string') { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : def; } catch (_) { return def; } }
      return def;
    };
    gpRewards = parseArr(await getSetting('daily_login_gp_rewards', BASE_GP), BASE_GP).slice(0, CYCLE);
    while (gpRewards.length < CYCLE) gpRewards.push(BASE_GP[gpRewards.length] || 10);
    ppRewards = parseArr(await getSetting('daily_login_pp_rewards', BASE_PP), BASE_PP).slice(0, CYCLE);
    while (ppRewards.length < CYCLE) ppRewards.push(0);
  }

  const rewardGP = parseFloat(gpRewards[streakDay - 1]) || 0;
  const rewardPP = parseFloat(ppRewards[streakDay - 1]) || 0;

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
    // ✅ Log GP activity
    if (rewardGP > 0) {
      try { const { logGPActivity } = require('../db'); logGPActivity(w, rewardGP, 'daily_login', `Day ${streakDay} check-in`).catch(()=>{}); } catch (_le) {}
    }
  }

  // Count total login days for milestone check
  const totalRes = await pool.query('SELECT COUNT(*) AS cnt FROM daily_logins WHERE wallet = $1', [w]);
  const totalDays = parseInt(totalRes.rows[0].cnt);

  // Milestone bonuses
  let milestone = null;
  let milestoneGP = 0;
  let milestonePP = 0;

  // Streak milestones — 7일 주기 기준 (3일, 7일 완주만)
  if (streakDay === 3) {
    milestoneGP = parseFloat(await getSetting('streak_3_gp', 30));
    milestone = { days: 3, gp: milestoneGP, pp: 0 };
  } else if (streakDay === 7) {
    // 7일 완주 — cycleReset 플래그로 다음 로그인이 새 주기임을 알림
    milestoneGP = parseFloat(await getSetting('streak_7_gp', 100));
    milestone = { days: 7, gp: milestoneGP, pp: 0, cycleComplete: true };
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
    // Admin-configurable reward override (falls back to pool default)
    const settingKey = 'daily_mission_' + m.type + '_reward_gp';
    const settingVal = await getSetting(settingKey, null);  // explicit null fallback
    const parsedVal = settingVal != null && settingVal !== '' ? parseFloat(settingVal) : NaN;
    const rewardGP = !isNaN(parsedVal) ? parsedVal : m.rewardGP;  // use pool default if NaN
    const res = await pool.query(
      `INSERT INTO daily_missions (wallet, mission_date, slot, mission_type, target_value, reward_gp, reward_xp)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6)
       ON CONFLICT (wallet, mission_date, slot) DO NOTHING
       RETURNING *`,
      [w, i + 1, m.type, target, rewardGP, m.rewardXP]
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
    desc: def ? def.desc : '',
    target: row.target_value,
    current: row.current_value,
    reward: parseFloat(row.reward_gp) || 0,
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
    // 🔔 Mission complete notification (fire-and-forget)
    try {
      const def = MISSION_POOL.find(m => m.type === mission.mission_type);
      const label = def ? def.label : mission.mission_type;
      notifyPlayer(w, 'mission_complete',
        `✅ 데일리 미션 완료: ${label} — +${parseFloat(mission.reward_gp).toFixed(0)} GP 수령 가능!`,
        { missionId: mission.id, type: mission.mission_type }
      ).catch(() => {});
    } catch (_ne) {}
  }

  return formatMission(mission);
}

// ── Claim mission reward ──
async function claimMissionReward(wallet, missionId) {
  const w = wallet.toLowerCase();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      'SELECT id FROM daily_missions WHERE LOWER(wallet) = LOWER($1) AND mission_date = CURRENT_DATE ORDER BY id FOR UPDATE',
      [w]
    );

    // Atomically claim the mission so concurrent requests cannot both pay it.
    const res = await client.query(
      `UPDATE daily_missions
       SET claimed = true
       WHERE id = $1 AND LOWER(wallet) = LOWER($2) AND completed = true AND claimed = false
       RETURNING *`,
      [missionId, w]
    );
    if (!res.rows.length) {
      await client.query('ROLLBACK');
      return { error: 'Mission not claimable (not completed, already claimed, or not yours)' };
    }

    const mission = res.rows[0];

    // Credit GP
    const rewardGP = parseFloat(mission.reward_gp);
    if (rewardGP > 0) {
      await client.query(
        'UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE LOWER(wallet_address) = LOWER($2)',
        [rewardGP, w]
      );
    }

    // Award XP if applicable
    let xpAwarded = mission.reward_xp || 0;
    if (xpAwarded > 0) {
      try {
        await client.query(
          'UPDATE users SET xp = xp + $1 WHERE LOWER(wallet_address) = LOWER($2)',
          [xpAwarded, w]
        );
      } catch (_e) { /* xp column may not exist */ }
    }

    // Check if all 3 missions were claimed by this transaction -> bonus GP
    const allClaimed = await client.query(
      'SELECT COUNT(*) AS cnt FROM daily_missions WHERE LOWER(wallet) = LOWER($1) AND mission_date = CURRENT_DATE AND claimed = true',
      [w]
    );
    let bonusGP = 0;
    if (parseInt(allClaimed.rows[0].cnt) === 3) {
      bonusGP = parseFloat(await getSetting('daily_mission_bonus_gp', 50));
      if (bonusGP > 0) {
        await client.query(
          'UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE LOWER(wallet_address) = LOWER($2)',
          [bonusGP, w]
        );
      }
    }

    await client.query('COMMIT');

    // ✅ Log GP activity after commit
    if (rewardGP > 0) {
      try { const { logGPActivity } = require('../db'); logGPActivity(w, rewardGP, 'mission_reward', mission.mission_type).catch(()=>{}); } catch (_le) {}
    }

    return {
      success: true,
      missionId,
      rewardGP,
      xpAwarded,
      bonusGP,
      allComplete: parseInt(allClaimed.rows[0].cnt) >= 3
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
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
