const crypto = require('crypto');
const { pool, ensureUser, awardXP, notifyPlayer } = require('../db');

const CH1_ID = 'mcc_campaign_ch1';

const CHAPTERS = {
  [CH1_ID]: {
    questId: CH1_ID,
    campaignId: 'mcc_route',
    chapterNumber: 1,
    faction: 'mcc',
    title: { ko: '산소 쟁탈', en: 'Oxygen Rush', ja: '酸素争奪', zh: '氧气争夺' },
    requiredLevel: 1,
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 840,
    location: { id: 'erebus_crater', displayNameKo: '에레부스 분화구 정제소 단지', region: 'equator' },
    environment: {
      type: 'dust_storm_incoming',
      totalDurationSeconds: 840,
      phases: [
        { phase: 0, startSec: 0, accuracyMod: 0, rangeMod: 0 },
        { phase: 1, startSec: 280, accuracyMod: -10, rangeMod: 0 },
        { phase: 2, startSec: 560, accuracyMod: -25, rangeMod: -20 },
        { phase: 3, startSec: 750, accuracyMod: -40, rangeMod: -50 },
      ],
      weaponsUnaffected: ['railgun'],
    },
    briefing: {
      npcId: 'lifang',
      npcName: 'Li Fang',
      npcTitle: 'MCC 특수사업부 이사',
      lines: [
        { id: 'brief_01', ko: '프로필 봤어. 첫 계약 환영해. 시간 짧아 — 본론.' },
        { id: 'brief_02', ko: 'Helion Dynamics가 내일 Erebus 정제소 7기 매각해. 화성 북반구 산소 41%.' },
        { id: 'brief_03', ko: 'Helion이 매각 직전 산소 850 kT 본사로 빼돌리는 중. 1,200만 명 일주일치.' },
        { id: 'brief_04', ko: '호송 — 화물선 3, 호위 프리깃 6. 격파. 화물 손상 없이.' },
        { id: 'brief_05', ko: 'Dust Storm 5시간 58분 후 도래. 회수 못 하면 산소 폭풍 안에 사라져.' },
      ],
      radio: [
        { triggerSec: 280, ko: '광학 정확도 떨어지기 시작. 조심해.' },
        { triggerSec: 560, ko: '폭풍 임박. 레일건 함선 우선.' },
        { triggerSec: 750, ko: '마지막 회수선 90초 후 출발. 끝내.' },
      ],
    },
    choices: [
      { id: 'ch1_accept', labelKo: '이해했습니다. 시간 안에 끝내죠.', effects: { reputationDelta: {} } },
      { id: 'ch1_moral_concern', labelKo: '산소 탱크 손상 시 정착지 동결 문제는?', effects: { reputationDelta: { fsp: 2 }, flag: 'showed_concern_for_civilians' } },
      { id: 'ch1_tactical', labelKo: 'Helion이 Dust Storm 알면 가속할 텐데요.', effects: { reputationDelta: { mcc: 3 }, flag: 'tactical_thinker' } },
      { id: 'ch1_negotiate', labelKo: '보수 협상부터.', effects: { reputationDelta: { mcc: -2 }, rewardModifier: { creditsMaxBonus: 8000 } } },
    ],
  },
};

function normalizeWallet(wallet) {
  return String(wallet || '').toLowerCase().trim();
}

function publicChapter(chapter, progress) {
  return {
    questId: chapter.questId,
    campaignId: chapter.campaignId,
    chapterNumber: chapter.chapterNumber,
    faction: chapter.faction,
    title: chapter.title,
    requiredLevel: chapter.requiredLevel,
    battleResolution: chapter.battleResolution,
    estimatedPlayTimeSeconds: chapter.estimatedPlayTimeSeconds,
    location: chapter.location,
    environment: chapter.environment,
    briefing: chapter.briefing,
    choices: chapter.choices.map(c => ({ id: c.id, labelKo: c.labelKo })),
    progress: progress ? formatProgress(progress) : null,
  };
}

function formatProgress(row) {
  if (!row) return null;
  return {
    id: row.id,
    questId: row.quest_id,
    campaignId: row.campaign_id,
    chapterNumber: row.chapter_number,
    sessionId: row.session_id,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    oxygenRecoveryPct: row.oxygen_recovery_pct == null ? null : parseFloat(row.oxygen_recovery_pct),
    environmentalPhaseReached: row.environmental_phase_reached || 0,
    choices: row.choices_payload || [],
    metrics: row.metrics_payload || {},
    outcome: row.outcome_payload || {},
    rewards: row.rewards_payload || {},
  };
}

async function ensureReputationRows(client, wallet) {
  for (const faction of ['mcc', 'fsp', 'cv']) {
    await client.query(
      `INSERT INTO player_reputation (wallet, faction, value)
       VALUES ($1, $2, 0) ON CONFLICT (wallet, faction) DO NOTHING`,
      [wallet, faction]
    );
  }
}

async function applyReputation(client, wallet, delta) {
  const entries = Object.entries(delta || {});
  for (const [faction, value] of entries) {
    const amount = parseInt(value, 10) || 0;
    if (!amount) continue;
    await client.query(
      `INSERT INTO player_reputation (wallet, faction, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (wallet, faction)
       DO UPDATE SET value = player_reputation.value + $3, updated_at = NOW()`,
      [wallet, faction, amount]
    );
  }
}

function mergeRep(a, b) {
  const out = Object.assign({}, a || {});
  for (const [k, v] of Object.entries(b || {})) out[k] = (out[k] || 0) + v;
  return out;
}

function seededFloat(seed) {
  const h = crypto.createHash('sha256').update(seed).digest();
  return h.readUInt32BE(0) / 0xffffffff;
}

function phaseForElapsed(sec) {
  if (sec >= 750) return 3;
  if (sec >= 560) return 2;
  if (sec >= 280) return 1;
  return 0;
}

function simulateCh1(progress) {
  const choices = Array.isArray(progress.choices_payload) ? progress.choices_payload : [];
  const choiceId = choices[0] && choices[0].choice_id ? choices[0].choice_id : 'ch1_accept';
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}`);

  let oxygen = 100;
  let elapsed = 690 + Math.floor(roll * 125);
  let shipsDestroyed = 9;
  let survivors = 0;
  let failure = null;

  if (roll < 0.06) {
    oxygen = 0;
    shipsDestroyed = 5 + Math.floor(roll * 30);
    survivors = 4;
    elapsed = 840;
    failure = 'fail_cold_death';
  } else if (roll < 0.12) {
    oxygen = 78;
    shipsDestroyed = 8;
    survivors = 1;
    elapsed = 855;
    failure = 'fail_time_exceeded';
  } else if (roll < 0.28) {
    oxygen = 60 + Math.floor(roll * 80);
    shipsDestroyed = 8;
    survivors = 1;
    elapsed = 780 + Math.floor(roll * 80);
  }

  if (choiceId === 'ch1_tactical') elapsed = Math.max(600, elapsed - 35);
  if (choiceId === 'ch1_moral_concern' && !failure) oxygen = Math.min(100, oxygen + 6);
  if (choiceId === 'ch1_negotiate' && !failure) elapsed += 18;

  const success = !failure;
  const secondary = [];
  if (success && survivors === 0) secondary.push('obj_zero_survivors');
  if (success && elapsed <= 840) secondary.push('obj_finish_before_storm');

  return {
    success,
    failureReason: failure,
    metrics: {
      oxygen_recovery_pct: oxygen,
      ships_destroyed: shipsDestroyed,
      survivors,
      elapsed_sec: elapsed,
      environmental_phase_reached: phaseForElapsed(elapsed),
      secondary_completed: secondary,
    },
  };
}

function calculateRewards(progress, sim) {
  if (!sim.success) {
    if (sim.failureReason === 'fail_cold_death') return { GP: 0, XP: 0, reputationDelta: { mcc: -10, fsp: -25 }, tags: ['cold_death'], loreFlags: ['cold_sister_frozen'], branchModifiers: [{ targetChapter: 'mcc_ch6', key: 'chen_distrust_increased', value: { active: true } }] };
    if (sim.failureReason === 'fail_time_exceeded') return { GP: 0, XP: 0, reputationDelta: { mcc: -15 }, tags: [], loreFlags: ['oxygen_lost_to_storm'], branchModifiers: [] };
    return { GP: 0, XP: 0, reputationDelta: {}, tags: [], loreFlags: [], branchModifiers: [] };
  }

  const choices = Array.isArray(progress.choices_payload) ? progress.choices_payload : [];
  let gp = 12000;
  let rep = { mcc: 15, fsp: -5, cv: 0 };
  const oxygen = sim.metrics.oxygen_recovery_pct;

  if (oxygen >= 100) { gp += 8000; rep = mergeRep(rep, { mcc: 5 }); }
  else if (oxygen >= 80) gp += 5000;
  else if (oxygen >= 50) gp += 2000;

  const secondary = sim.metrics.secondary_completed || [];

  if (choices.some(c => c.choice_id === 'ch1_negotiate') && oxygen >= 100) gp += 8000;

  return {
    GP: gp,
    XP: 500,
    reputationDelta: rep,
    items: [{ type: 'ship_blueprint', code: 'prism_interceptor', label: 'Prism Interceptor Blueprint' }],
    titles: secondary.length === 2 ? ['efficient_operator'] : [],
    masteries: secondary.includes('obj_finish_before_storm') ? ['dust_storm_combat'] : [],
    tags: secondary.length === 2 ? ['efficient_operator'] : [],
    loreFlags: ['lifang_personal_arc_unlocked'],
    unlocks: ['mcc_ch2'],
    branchModifiers: [],
  };
}

async function getStatus(wallet) {
  const w = normalizeWallet(wallet);
  const [progressRes, reputationRes, branchRes, inboxRes] = await Promise.all([
    pool.query(`SELECT * FROM player_campaign_progress WHERE wallet = $1 ORDER BY chapter_number ASC`, [w]),
    pool.query(`SELECT faction, value FROM player_reputation WHERE wallet = $1 ORDER BY faction ASC`, [w]),
    pool.query(`SELECT target_chapter, modifier_key, modifier_value, source_quest_id, created_at FROM chapter_branch_modifiers WHERE wallet = $1 ORDER BY created_at DESC`, [w]),
    pool.query(`SELECT quest_id, reward_type, reward_code, quantity, payload, created_at FROM campaign_reward_inbox WHERE wallet = $1 AND claimed = FALSE ORDER BY created_at DESC LIMIT 20`, [w]),
  ]);
  const rows = progressRes.rows;
  const progressByQuest = {};
  rows.forEach(r => { progressByQuest[r.quest_id] = r; });
  const reputation = {};
  reputationRes.rows.forEach(r => { reputation[r.faction] = r.value; });
  return {
    chapters: Object.values(CHAPTERS).map(ch => publicChapter(ch, progressByQuest[ch.questId])),
    completedChapters: rows.filter(r => r.status === 'completed' || r.status === 'claimed').map(r => r.quest_id),
    active: rows.find(r => r.status === 'in_progress') ? formatProgress(rows.find(r => r.status === 'in_progress')) : null,
    reputation,
    branchModifiers: branchRes.rows,
    rewardInbox: inboxRes.rows,
  };
}

async function startChapter(wallet, questId) {
  const w = normalizeWallet(wallet);
  const chapter = CHAPTERS[questId];
  if (!chapter) return { error: 'QUEST_NOT_FOUND' };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureUser(client, w);
    await ensureReputationRows(client, w);
    const { rows: userRows } = await client.query('SELECT rank_level FROM users WHERE wallet_address = $1 FOR UPDATE', [w]);
    const rank = parseInt(userRows[0]?.rank_level || 1, 10);
    if (rank < chapter.requiredLevel) {
      await client.query('ROLLBACK');
      return { error: 'LEVEL_REQUIRED', requiredLevel: chapter.requiredLevel };
    }

    const existing = await client.query(
      'SELECT * FROM player_campaign_progress WHERE wallet = $1 AND quest_id = $2 FOR UPDATE',
      [w, chapter.questId]
    );
    if (existing.rows[0] && ['completed', 'claimed'].includes(existing.rows[0].status)) {
      await client.query('COMMIT');
      return { alreadyCompleted: true, chapter: publicChapter(chapter, existing.rows[0]), progress: formatProgress(existing.rows[0]) };
    }

    const sessionId = crypto.randomBytes(16).toString('hex');
    const { rows } = await client.query(
      `INSERT INTO player_campaign_progress
        (wallet, quest_id, campaign_id, chapter_number, session_id, status, battle_resolution, started_at)
       VALUES ($1,$2,$3,$4,$5,'in_progress',$6,NOW())
       ON CONFLICT (wallet, quest_id) DO UPDATE SET
         session_id = EXCLUDED.session_id,
         status = 'in_progress',
         choices_payload = '[]'::jsonb,
         metrics_payload = '{}'::jsonb,
         outcome_payload = '{}'::jsonb,
         rewards_payload = '{}'::jsonb,
         oxygen_recovery_pct = NULL,
         environmental_phase_reached = 0,
         completed_at = NULL,
         failed_at = NULL,
         started_at = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [w, chapter.questId, chapter.campaignId, chapter.chapterNumber, sessionId, chapter.battleResolution]
    );
    await client.query('COMMIT');
    return { sessionId: rows[0].session_id, chapter: publicChapter(chapter, rows[0]), progress: formatProgress(rows[0]) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function choose(wallet, sessionId, choiceId) {
  const w = normalizeWallet(wallet);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM player_campaign_progress WHERE wallet = $1 AND session_id = $2 AND status = 'in_progress' FOR UPDATE`,
      [w, sessionId]
    );
    const progress = rows[0];
    if (!progress) {
      await client.query('ROLLBACK');
      return { error: 'SESSION_NOT_FOUND' };
    }
    const chapter = CHAPTERS[progress.quest_id];
    const choice = chapter.choices.find(c => c.id === choiceId);
    if (!choice) {
      await client.query('ROLLBACK');
      return { error: 'INVALID_CHOICE' };
    }
    const existingChoices = Array.isArray(progress.choices_payload) ? progress.choices_payload : [];
    if (existingChoices.length > 0) {
      await client.query('COMMIT');
      return { effectsApplied: existingChoices[0].effects_applied || {}, progress: formatProgress(progress) };
    }
    const payload = [{ choice_id: choice.id, ts: new Date().toISOString(), effects_applied: choice.effects }];
    await applyReputation(client, w, choice.effects.reputationDelta || {});
    if (choice.effects.flag) {
      await client.query(
        `INSERT INTO player_lore_flags (wallet, flag_id, source_quest_id)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [w, choice.effects.flag, progress.quest_id]
      );
    }
    await client.query(
      `INSERT INTO player_chapter_choices (wallet, quest_id, session_id, choice_id, effects_applied)
       VALUES ($1,$2,$3,$4,$5)`,
      [w, progress.quest_id, sessionId, choice.id, JSON.stringify(choice.effects)]
    );
    const updated = await client.query(
      `UPDATE player_campaign_progress SET choices_payload = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify(payload), progress.id]
    );
    await client.query('COMMIT');
    return { effectsApplied: choice.effects, progress: formatProgress(updated.rows[0]) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getProgress(wallet, sessionId) {
  const w = normalizeWallet(wallet);
  const { rows } = await pool.query(
    'SELECT * FROM player_campaign_progress WHERE wallet = $1 AND session_id = $2',
    [w, sessionId]
  );
  if (!rows[0]) return { error: 'SESSION_NOT_FOUND' };
  const p = rows[0];
  const elapsed = p.started_at ? Math.min(840, Math.floor((Date.now() - new Date(p.started_at).getTime()) / 1000 * 28)) : 0;
  return { progress: formatProgress(p), environmentalPhase: phaseForElapsed(elapsed), preview: { elapsedSec: elapsed, oxygenRecoveryPct: Math.min(100, Math.round((elapsed / 840) * 100)) } };
}

async function complete(wallet, sessionId) {
  const w = normalizeWallet(wallet);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM player_campaign_progress WHERE wallet = $1 AND session_id = $2 AND status = 'in_progress' FOR UPDATE`,
      [w, sessionId]
    );
    const progress = rows[0];
    if (!progress) {
      await client.query('ROLLBACK');
      return { error: 'SESSION_NOT_FOUND' };
    }
    const sim = simulateCh1(progress);
    const rewards = calculateRewards(progress, sim);
    const status = sim.success ? 'completed' : 'failed';

    await applyReputation(client, w, rewards.reputationDelta || {});
    if (sim.success) {
      if (rewards.GP > 0) {
        await client.query('UPDATE users SET gp_balance = COALESCE(gp_balance,0) + $1 WHERE wallet_address = $2', [rewards.GP, w]);
        await client.query(
          'INSERT INTO gp_activity_log (wallet, delta, source, note) VALUES ($1,$2,$3,$4)',
          [w, rewards.GP, 'campaign_reward', 'MCC Ch1 Oxygen Rush']
        );
      }
      if (rewards.XP > 0) await awardXP(client, w, rewards.XP);
      for (const item of rewards.items || []) {
        await client.query(
          `INSERT INTO campaign_reward_inbox (wallet, quest_id, reward_type, reward_code, quantity, payload)
           VALUES ($1,$2,$3,$4,1,$5)`,
          [w, progress.quest_id, item.type, item.code, JSON.stringify(item)]
        );
      }
      for (const title of rewards.titles || []) {
        await client.query(
          `INSERT INTO user_titles (user_wallet, title_code, title_en, title_ko)
           VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
          [w, title, 'Efficient Operator', '효율적인 해결사']
        );
      }
      for (const mastery of rewards.masteries || []) {
        await client.query(
          `INSERT INTO player_environment_mastery (wallet, environment_type, encounter_count, success_count, mastery_level)
           VALUES ($1,$2,1,1,1)
           ON CONFLICT (wallet, environment_type)
           DO UPDATE SET encounter_count = player_environment_mastery.encounter_count + 1,
                         success_count = player_environment_mastery.success_count + 1,
                         mastery_level = GREATEST(player_environment_mastery.mastery_level, 1),
                         updated_at = NOW()`,
          [w, mastery]
        );
      }
    }

    for (const tag of rewards.tags || []) {
      await client.query('INSERT INTO player_tags (wallet, tag_id, source_quest_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [w, tag, progress.quest_id]);
    }
    for (const flag of rewards.loreFlags || []) {
      await client.query('INSERT INTO player_lore_flags (wallet, flag_id, source_quest_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [w, flag, progress.quest_id]);
    }
    for (const mod of rewards.branchModifiers || []) {
      await client.query(
        `INSERT INTO chapter_branch_modifiers (wallet, target_chapter, modifier_key, modifier_value, source_quest_id)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [w, mod.targetChapter, mod.key, JSON.stringify(mod.value || {}), progress.quest_id]
      );
    }

    const updated = await client.query(
      `UPDATE player_campaign_progress SET
         status = $1,
         completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
         failed_at = CASE WHEN $1 = 'failed' THEN NOW() ELSE failed_at END,
         oxygen_recovery_pct = $2,
         environmental_phase_reached = $3,
         metrics_payload = $4,
         outcome_payload = $5,
         rewards_payload = $6,
         updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [
        status,
        sim.metrics.oxygen_recovery_pct,
        sim.metrics.environmental_phase_reached,
        JSON.stringify(sim.metrics),
        JSON.stringify({ success: sim.success, failureReason: sim.failureReason, secondaryCompleted: sim.metrics.secondary_completed || [] }),
        JSON.stringify(rewards),
        progress.id,
      ]
    );
    await client.query('COMMIT');
    notifyPlayer(w, 'campaign_result', sim.success ? '⚡ MCC Ch1 완료: 산소 쟁탈' : '⚠ MCC Ch1 실패: 산소 쟁탈', { questId: progress.quest_id }).catch(() => {});
    return { success: sim.success, progress: formatProgress(updated.rows[0]), metrics: sim.metrics, rewards, nextChapterUnlocked: sim.success ? 'mcc_ch2' : null };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getStatus, startChapter, choose, getProgress, complete };
