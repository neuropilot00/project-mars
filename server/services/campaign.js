const crypto = require('crypto');
const { pool, ensureUser, awardXP, notifyPlayer } = require('../db');

const CH1_ID = 'mcc_campaign_ch1';
const CH2_ID = 'mcc_campaign_ch2';
const CH3_ID = 'mcc_campaign_ch3';
const CH4_ID = 'mcc_campaign_ch4';
const FACTIONS = ['mcc', 'fsp', 'cv', 'pilgrim_arms'];
const REP_MIN = -100;
const REP_MAX = 100;

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
  [CH2_ID]: {
    questId: CH2_ID,
    campaignId: 'mcc_route',
    chapterNumber: 2,
    faction: 'mcc',
    title: { ko: '동결된 고속도로', en: 'Frozen Highway' },
    requiredLevel: 2,
    prerequisiteChapter: CH1_ID,
    requiredReputation: { mcc: 10 },
    blockingTags: ['war_criminal'],
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1800,
    location: { id: 'hellas_north_mining_outpost', displayNameKo: 'Hellas 북부 수소 채굴장', region: 'hellas_basin' },
    environment: {
      type: 'night_freezing',
      totalDurationSeconds: 1800,
      phases: [
        { phase: 0, startSec: 0, propulsionMod: 0, evasionMod: 0 },
        { phase: 1, startSec: 600, propulsionMod: -10, evasionMod: -15 },
        { phase: 2, startSec: 1200, propulsionMod: -15, evasionMod: -20 },
        { phase: 3, startSec: 1800, hpDrainPerMin: 0.5 },
      ],
    },
    briefing: {
      npcId: 'lifang',
      npcName: 'Li Fang',
      npcTitle: 'MCC 특수사업부 이사',
      lines: [
        { id: 'ch2_brief_01', ko: '지난 계약 잘했어. 이번 건 좀 달라. 외교적 민감.' },
        { id: 'ch2_brief_02', ko: 'FSP 영토 안 수소 채굴장 1기. 월 산출량이 우리 팔레노스 화학 공장 가동량의 32%.' },
        { id: 'ch2_brief_03', ko: '수비대 약해. 민병대 구축함 4척. 격파하되 시설 보존.' },
        { id: 'ch2_brief_04', ko: '민간인 피해 0. 사진 한 장 새는 순간 우리 주가 박살.' },
        { id: 'ch2_brief_05', ko: '야간이야. 영하 95도. 동력 끊으면 30분 내 시설 동결 시작. 30분 안에 끝.' },
      ],
      radio: [
        { triggerSec: 600, ko: '외부 항해 시간 누적. 함선 차폐 점검.' },
        { triggerSec: 1200, ko: 'FSP 증원 11분 후 도착. 빨리.' },
        { triggerSec: 1500, ko: '광부 후퇴 신호 OK. 작업 마무리.' },
      ],
    },
    choices: [
      { id: 'ch2_request_support', labelKo: '추가 함선 지원 요청.', effects: { flag: 'requested_extra_support', rewardModifier: { creditsDelta: -2000 }, simulationModifier: { playerFleetPower: 1.3 } } },
      { id: 'ch2_warn_civilians', labelKo: '광부 후퇴 시간 5분 부여.', effects: { reputationDelta: { fsp: 3 }, flag: 'warned_civilians_ch2', simulationModifier: { timePressure: 1.2 } } },
      { id: 'ch2_intel_query', labelKo: 'FSP 증원 정확한 시간?', effects: { reputationDelta: { mcc: 3 }, flag: 'requested_intel_ch2' } },
      { id: 'ch2_refuse', labelKo: '거부. 명백한 침공.', effects: { reputationDelta: { mcc: -15 }, flag: 'chapter_refused', branchSet: { modifierId: 'mcc_route_termination_offered', targetChapter: CH3_ID } } },
    ],
  },
  [CH3_ID]: {
    questId: CH3_ID,
    campaignId: 'mcc_route',
    chapterNumber: 3,
    faction: 'mcc',
    title: { ko: '이사회', en: 'Boardroom' },
    requiredLevel: 3,
    prerequisiteChapter: CH2_ID,
    requiredReputation: { mcc: 25 },
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1800,
    location: { id: 'olympus_shareholder7', displayNameKo: 'Shareholder-7 궤도 스테이션', region: 'olympus_orbit' },
    environment: {
      type: 'phobos_eclipse_periodic',
      totalDurationSeconds: 1800,
      phases: [
        { phase: 0, startSec: 0, opticalTracking: 'normal' },
        { phase: 1, startSec: 600, opticalTracking: 'disabled', missileAdvantage: 20 },
        { phase: 2, startSec: 1200, opticalTracking: 'disabled', missileAdvantage: 20 },
        { phase: 3, startSec: 1800, opticalTracking: 'disabled', missileAdvantage: 20 },
      ],
    },
    briefing: {
      npcId: 'chen_weiss',
      npcName: 'Chen Weiss',
      npcTitle: 'MCC 이사회 의장',
      lines: [
        { id: 'ch3_brief_01', ko: '여기 처음이지. 어때, 따뜻해? 화성에서 가장 따뜻한 방이야. 지열로 25도.' },
        { id: 'ch3_brief_02', ko: '평균 시민 정착지 — 5도. 우리 직원 사는 곳 — 12도. 그리고 이 방. 이게 권력이야.' },
        { id: 'ch3_brief_03', ko: 'Li Fang이 당신 좋아해. 나는 그녀 판단 70% 신뢰해. 나머지 30%는 직접 확인.' },
        { id: 'ch3_brief_04', ko: 'MCC 17개 자회사 연합. 그 중 셋이 내 체제에 적대적. 하나를 무너뜨려야 다음 분기 살아남아.' },
        { id: 'ch3_brief_05', ko: '당신이 선택해. 어느 자회사를 칠지.' },
      ],
      radio: [
        { triggerSec: 600, ko: 'Phobos Eclipse 진입. 광학 추적 정지.' },
        { triggerSec: 1200, ko: '두 번째 eclipse window. 미사일 우위.' },
        { triggerSec: 1800, ko: '마지막 eclipse window. 끝내.' },
      ],
    },
    choices: [
      { id: 'ch3_attack_helion', labelKo: 'Helion Dynamics', effects: { flag: 'chose_helion_subsidiary', branchSet: { modifierId: 'ch6_chen_invitation', targetChapter: 'mcc_campaign_ch6' }, difficultyModifier: 1.4 } },
      { id: 'ch3_attack_verin', labelKo: 'Verin Labs', effects: { flag: 'chose_verin_subsidiary', difficultyModifier: 1.0 } },
      { id: 'ch3_attack_chromium', labelKo: 'Chromium Futures', effects: { flag: 'chose_chromium_subsidiary', branchSet: { modifierId: 'ch7_chen_distrust', targetChapter: 'mcc_campaign_ch7' }, difficultyModifier: 0.7 } },
      { id: 'ch3_request_time', labelKo: '48시간 더.', effects: { reputationDelta: { mcc: -3 }, flag: 'requested_more_time', simulationModifier: { intelBonus: 0.1 } } },
    ],
  },
  [CH4_ID]: {
    questId: CH4_ID,
    campaignId: 'mcc_route',
    chapterNumber: 4,
    faction: 'mcc',
    title: { ko: '해적 매수', en: "Pirate's Payroll" },
    requiredLevel: 4,
    prerequisiteChapter: CH3_ID,
    requiredReputation: { mcc: 30 },
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1080,
    location: { id: 'red_dust_station', displayNameKo: 'Red Dust 정거장', region: 'valles_marineris_entrance' },
    environment: {
      type: 'ion_storm_active',
      totalDurationSeconds: 1080,
      phases: [
        { phase: 0, startSec: 0, fleetCommandMode: 'disabled', radarAccuracy: -60, empEffectBonus: 50 },
      ],
    },
    briefing: {
      npcId: 'lifang',
      npcName: 'Li Fang / Kara Vex',
      npcTitle: 'MCC 특수사업부 · CV 현장 지휘관',
      lines: [
        { id: 'ch4_brief_01', ko: '이번 건 좀 달라. CV한테 직접 가야 해.' },
        { id: 'ch4_brief_02', ko: '우리, 3개월간 CV한테 경쟁사 함대 습격 대행시켜왔어. 회계상 컨설팅 수수료.' },
        { id: 'ch4_brief_03', ko: '그들이 5배 인상 요구. 합의 안 되면 우리 비밀 시장에 흘려.' },
        { id: 'ch4_brief_04', ko: 'Valles는 자기장 약해 Ion Storm 빈발. 18분 안에 끝내야 해.' },
        { id: 'ch4_kara_01', ko: 'Li Fang. 오랜만이야. 그리고 이쪽은... 프리랜서? 쟤는 왜 여기 있어? 증인?' },
      ],
      radio: [
        { triggerSec: 360, ko: '회담장 외곽 침입자 발견. 무장 5+.' },
        { triggerSec: 720, ko: 'Ion Storm 유지 중. 함대 명령 차단.' },
        { triggerSec: 1000, ko: '통신 복구 전 마무리.' },
      ],
    },
    choices: [
      { id: 'ch4_silent', labelKo: '(침묵)', effects: {} },
      { id: 'ch4_compliment_ship', labelKo: "Kara 함선 칭찬: 'Mauler 시리즈 개조했죠?'", effects: { reputationDelta: { cv: 5 }, flag: 'kara_likes_player', branchSet: { modifierId: 'ch10_kara_loyalty', targetChapter: 'mcc_campaign_ch10' } } },
      { id: 'ch4_question_li_fang', labelKo: "Li Fang에게: '5명 사망. 보험금은?'", effects: { reputationDelta: { mcc: -8 }, flag: 'kara_strongly_likes_player', flag2: 'lifang_distrust_player', negotiationOutcome: 'forced_5x' } },
      { id: 'ch4_question_helion_intel', labelKo: "'Helion이 이 회담 알면?'", effects: { flag: 'caused_negotiation_tension', simulationModifier: { combatDifficulty: 1.15 } } },
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
  for (const faction of FACTIONS) {
    await client.query(
      `INSERT INTO player_reputation (wallet, faction, value)
       VALUES ($1, $2, 0) ON CONFLICT (wallet, faction) DO NOTHING`,
      [wallet, faction]
    );
  }
}

function clampReputation(value) {
  return Math.max(REP_MIN, Math.min(REP_MAX, parseInt(value, 10) || 0));
}

function reputationTierLabel(value) {
  const v = parseInt(value, 10) || 0;
  if (v <= -75) return 'Hostile';
  if (v <= -25) return 'Distrusted';
  if (v <= 24) return 'Neutral';
  if (v <= 49) return 'Friendly';
  if (v <= 79) return 'Trusted';
  return 'Allied';
}

async function applyReputation(client, wallet, delta, sourceType = 'campaign_chapter', sourceId = null) {
  const entries = Object.entries(delta || {});
  for (const [faction, value] of entries) {
    if (!FACTIONS.includes(faction)) continue;
    const amount = parseInt(value, 10) || 0;
    if (!amount) continue;
    const beforeRes = await client.query(
      `SELECT value FROM player_reputation WHERE wallet = $1 AND faction = $2 FOR UPDATE`,
      [wallet, faction]
    );
    const before = beforeRes.rows[0] ? parseInt(beforeRes.rows[0].value, 10) || 0 : 0;
    const after = clampReputation(before + amount);
    await client.query(
      `INSERT INTO player_reputation (wallet, faction, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (wallet, faction)
       DO UPDATE SET value = $3, updated_at = NOW()`,
      [wallet, faction, after]
    );
    await client.query(
      `INSERT INTO reputation_history (wallet, faction, delta, before_value, after_value, source_type, source_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [wallet, faction, after - before, before, after, sourceType, sourceId]
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

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function selectedChoiceId(progress, fallback) {
  const choices = Array.isArray(progress.choices_payload) ? progress.choices_payload : [];
  return choices[0] && choices[0].choice_id ? choices[0].choice_id : fallback;
}

function phaseForElapsed(sec) {
  if (sec >= 750) return 3;
  if (sec >= 560) return 2;
  if (sec >= 280) return 1;
  return 0;
}

function phaseForChapter(chapterId, sec) {
  const env = CHAPTERS[chapterId]?.environment;
  const phases = env?.phases || [];
  let current = phases[0]?.phase || 0;
  for (const phase of phases) {
    if ((phase.startSec || 0) <= sec) current = phase.phase || 0;
    else break;
  }
  return current;
}

function simulateCh1(progress) {
  const choiceId = selectedChoiceId(progress, 'ch1_accept');
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

function simulateCh2(progress) {
  const choiceId = selectedChoiceId(progress, 'ch2_intel_query');
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}:ch2`);
  if (choiceId === 'ch2_refuse') {
    return {
      success: false,
      failureReason: 'chapter_refused',
      metrics: { facility_hp_percent: 100, civilian_casualties: 0, militia_destroyed: 0, elapsed_sec: 0, fsp_reinforcement_eta_sec: 2100, environmental_phase_reached: 0, secondary_completed: [] },
    };
  }

  const requestedSupport = choiceId === 'ch2_request_support';
  const warned = choiceId === 'ch2_warn_civilians';
  const intel = choiceId === 'ch2_intel_query';
  let baseSuccess = 0.74 + (requestedSupport ? 0.15 : 0) + (intel ? 0.05 : 0);
  const timeFactor = warned ? 1.2 : 1.0;
  const facilityHp = Math.round(clampNumber(baseSuccess * 100 - roll * 15 + (warned ? 2 : 0), 0, 100));
  const civilianCasualties = warned ? 0 : (roll < 0.10 ? 1 + Math.floor(roll * 20) : 0);
  const elapsed = Math.round(1450 * timeFactor * (0.88 + roll * 0.26));
  const militiaDestroyed = facilityHp >= 80 && elapsed <= 2100 && civilianCasualties === 0 ? 4 : Math.max(1, Math.floor(roll * 4));
  let failure = null;
  if (civilianCasualties > 0) failure = 'fail_civilian_massacre';
  else if (facilityHp < 80) failure = 'fail_facility_destroyed';
  else if (elapsed > 2100) failure = 'fail_timeout';

  const success = !failure;
  const secondary = [];
  if (success && facilityHp >= 95) secondary.push('obj_facility_pristine');
  if (success && elapsed < 1800) secondary.push('obj_finish_under_30min');
  if (success && civilianCasualties === 0) secondary.push('obj_clean_operation');

  return {
    success,
    failureReason: failure,
    metrics: {
      facility_hp_percent: facilityHp,
      civilian_casualties: civilianCasualties,
      militia_destroyed: militiaDestroyed,
      elapsed_sec: elapsed,
      fsp_reinforcement_eta_sec: Math.max(0, 2100 - elapsed),
      environmental_phase_reached: phaseForChapter(CH2_ID, elapsed),
      secondary_completed: secondary,
    },
  };
}

function simulateCh3(progress) {
  const choiceId = selectedChoiceId(progress, 'ch3_attack_verin');
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}:ch3`);
  const branch = choiceId === 'ch3_attack_helion' ? 'helion' : choiceId === 'ch3_attack_chromium' ? 'chromium' : 'verin';
  const difficulty = branch === 'helion' ? 1.4 : branch === 'chromium' ? 0.7 : 1.0;
  const requestTime = choiceId === 'ch3_request_time';
  const successScore = 0.88 - (difficulty - 1) * 0.28 + (requestTime ? 0.1 : 0) - roll * 0.12;
  const timeLimit = branch === 'helion' ? 2400 : branch === 'chromium' ? 1500 : 2100;
  const elapsed = Math.round((branch === 'chromium' ? 1120 : branch === 'helion' ? 2000 : 1750) * (0.88 + roll * 0.28) * (requestTime ? 0.95 : 1));
  const playerShipsLost = successScore > 0.72 ? 0 : 1;
  const eclipseKills = branch === 'verin' ? 2 + Math.floor(roll * 3) : Math.floor(roll * 2);
  const failure = (elapsed > timeLimit || successScore < 0.48) ? 'fail_time_exceeded' : null;
  const secondary = [];
  if (!failure && playerShipsLost === 0) secondary.push('obj_no_player_ship_lost');
  if (!failure && eclipseKills >= 3) secondary.push('obj_eclipse_kill_count');
  return {
    success: !failure,
    failureReason: failure,
    branchChoice: branch,
    metrics: {
      subsidiary_target: branch,
      elapsed_sec: elapsed,
      player_ships_lost: playerShipsLost,
      eclipse_kill_count: eclipseKills,
      targets_destroyed: failure ? Math.max(3, Math.floor(successScore * 12)) : branch === 'helion' ? 16 : branch === 'verin' ? 12 : 21,
      environmental_phase_reached: phaseForChapter(CH3_ID, elapsed),
      secondary_completed: secondary,
    },
  };
}

function simulateCh4(progress) {
  const choiceId = selectedChoiceId(progress, 'ch4_silent');
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}:ch4`);
  const compliment = choiceId === 'ch4_compliment_ship';
  const challengedLi = choiceId === 'ch4_question_li_fang';
  const tension = choiceId === 'ch4_question_helion_intel';
  const difficulty = tension ? 1.15 : 1.0;
  const effectivePower = (0.66 + (compliment ? 0.08 : 0) + (challengedLi ? 0.04 : 0) - (difficulty - 1) * 0.18);
  const successChance = clampNumber(effectivePower + (1 - roll) * 0.18, 0, 1);
  const destroyed = Math.min(14, Math.floor(9 + successChance * 5));
  const escapes = Math.max(0, 14 - destroyed);
  const elapsed = Math.round(650 + roll * 420 + (tension ? 90 : 0));
  const lifangSurvives = successChance > 0.45;
  const karaSurvives = successChance > 0.40;
  const karaPristine = compliment && successChance + 0.1 > 0.78;
  const lifangPristine = successChance + 0.15 > 0.78;
  let failure = null;
  if (!lifangSurvives) failure = 'fail_lifang_dead';
  else if (!karaSurvives) failure = 'fail_kara_dead';
  else if (escapes > 0) failure = 'fail_helion_escapes';
  else if (elapsed > 1080) failure = 'fail_timeout';
  const secondary = [];
  if (!failure && karaPristine) secondary.push('obj_kara_ship_pristine');
  if (!failure && lifangPristine) secondary.push('obj_lifang_shuttle_pristine');
  if (!failure && elapsed < 720) secondary.push('obj_finish_under_12min');
  if (!failure && escapes === 0) secondary.push('obj_zero_helion_escapes');
  return {
    success: !failure,
    failureReason: failure,
    metrics: {
      helion_destroyed: destroyed,
      helion_escapes: escapes,
      elapsed_sec: elapsed,
      lifang_survives: lifangSurvives,
      kara_survives: karaSurvives,
      kara_ship_pristine: karaPristine,
      lifang_shuttle_pristine: lifangPristine,
      command_mode: 'disabled',
      environmental_phase_reached: phaseForChapter(CH4_ID, elapsed),
      secondary_completed: secondary,
    },
  };
}

function simulateChapter(progress) {
  if (progress.quest_id === CH2_ID) return simulateCh2(progress);
  if (progress.quest_id === CH3_ID) return simulateCh3(progress);
  if (progress.quest_id === CH4_ID) return simulateCh4(progress);
  return simulateCh1(progress);
}

function calculateCh1Rewards(progress, sim) {
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

function calculateCh2Rewards(progress, sim) {
  const choiceId = selectedChoiceId(progress, 'ch2_intel_query');
  if (choiceId === 'ch2_refuse') {
    return {
      GP: 0,
      XP: 0,
      reputationDelta: {},
      tags: [],
      loreFlags: ['chapter_refused'],
      branchModifiers: [{ targetChapter: CH3_ID, key: 'mcc_route_termination_offered', value: { ch3_briefing_variant: 'termination_warning', available_choices_filter: ['accept_or_quit'] } }],
      unlocks: [CH3_ID],
    };
  }
  if (!sim.success) {
    if (sim.failureReason === 'fail_civilian_massacre') return { GP: 0, XP: 0, reputationDelta: { fsp: -50 }, tags: ['war_criminal'], loreFlags: ['hellas_civilian_massacre'], branchModifiers: [{ targetChapter: 'any_fsp', key: 'ch2_war_criminal_status', value: { fsp_route_access: 'locked', cv_route_access: 'bonus' } }] };
    if (sim.failureReason === 'fail_facility_destroyed') return { GP: 0, XP: 0, reputationDelta: { mcc: -10 }, tags: [], loreFlags: ['hellas_facility_lost'], branchModifiers: [] };
    return { GP: 0, XP: 0, reputationDelta: { mcc: -10 }, tags: [], loreFlags: [], branchModifiers: [] };
  }
  const secondary = sim.metrics.secondary_completed || [];
  let gp = 25000;
  let rep = { mcc: 20, fsp: -15 };
  const tags = [];
  const loreFlags = ['hellas_facility_acquired'];
  const items = [{ type: 'ship', code: 'shard_frigate', label: 'Shard Frigate', quantity: 2 }, { type: 'resource_stream', code: 'hellas_h2o_monthly', label: 'Hellas H2O Monthly Contract', quantity: 2000 }];
  if (choiceId === 'ch2_request_support') gp -= 2000;
  if (choiceId === 'ch2_warn_civilians') loreFlags.push('warned_civilians_ch2');
  if (choiceId === 'ch2_intel_query') loreFlags.push('requested_intel_ch2');
  if (secondary.includes('obj_facility_pristine')) gp += 5000;
  if (secondary.includes('obj_clean_operation')) { gp += 3000; tags.push('clean_operator'); rep = mergeRep(rep, { mcc: 5 }); }
  if (secondary.includes('obj_finish_under_30min')) items.push({ type: 'ship_blueprint', code: 'shard_frigate_blueprint', label: 'Shard Frigate Blueprint' });
  return { GP: gp, XP: 800, reputationDelta: rep, items, tags, loreFlags, unlocks: [CH3_ID], branchModifiers: [] };
}

function calculateCh3Rewards(progress, sim) {
  if (!sim.success) return { GP: 0, XP: 0, reputationDelta: { mcc: -20 }, tags: [], loreFlags: ['chen_first_meeting'], branchModifiers: [] };
  const branch = sim.branchChoice || 'verin';
  const secondary = sim.metrics.secondary_completed || [];
  let gp = branch === 'helion' ? 80000 : branch === 'chromium' ? 35000 : 60000;
  let xp = branch === 'helion' ? 1500 : branch === 'chromium' ? 1000 : 1200;
  let rep = { mcc: branch === 'helion' ? 40 : branch === 'chromium' ? 15 : 25 };
  const loreFlags = ['chen_first_meeting', branch === 'helion' ? 'chose_helion_subsidiary' : branch === 'chromium' ? 'chose_chromium_subsidiary' : 'chose_verin_subsidiary', `${branch}_destroyed`];
  const items = [];
  const masteries = [];
  const branchModifiers = [];
  if (branch === 'helion') {
    items.push({ type: 'resource_stream', code: 'o2_supply_stream', label: 'O2 Supply Stream', quantity: 500 }, { type: 'asset', code: 'refinery_ownership', label: 'Refinery Ownership', quantity: 12 });
    branchModifiers.push({ targetChapter: 'mcc_campaign_ch6', key: 'ch6_chen_invitation', value: { ch6_briefing_variant: 'secret_meeting_invited', additional_choice: 'ch6_attend_secret_meeting' } });
  } else if (branch === 'verin') {
    items.push({ type: 'ship_blueprint', code: 'longeye_sniper', label: 'Longeye Sniper Blueprint' });
  } else {
    items.push({ type: 'resource_stream', code: 'parts_supply_stream', label: 'Parts Supply Stream', quantity: 500 });
    branchModifiers.push({ targetChapter: 'mcc_campaign_ch7', key: 'ch7_chen_distrust', value: { chen_dialog_variant: 'distrustful', chen_surveillance_active: true, ch7_difficulty_modifier: 1.15 } });
  }
  if (secondary.includes('obj_no_player_ship_lost')) gp += 5000;
  if (secondary.includes('obj_eclipse_kill_count')) { gp += 3000; masteries.push('phobos_eclipse_combat'); }
  return { GP: gp, XP: xp, reputationDelta: rep, items, masteries, tags: [], loreFlags, unlocks: [CH4_ID], branchModifiers };
}

function calculateCh4Rewards(progress, sim) {
  const choiceId = selectedChoiceId(progress, 'ch4_silent');
  if (!sim.success) {
    if (sim.failureReason === 'fail_lifang_dead') return { GP: 0, XP: 0, reputationDelta: { mcc: -100 }, tags: [], loreFlags: ['lifang_dead'], branchModifiers: [{ targetChapter: 'mcc_route', key: 'mcc_route_locked', value: { locked: true } }] };
    if (sim.failureReason === 'fail_kara_dead') return { GP: 0, XP: 0, reputationDelta: { cv: -100 }, tags: [], loreFlags: ['kara_dead'], branchModifiers: [{ targetChapter: 'cv_route', key: 'cv_route_locked', value: { locked: true } }] };
    if (sim.failureReason === 'fail_helion_escapes') return { GP: 0, XP: 0, reputationDelta: { mcc: -15 }, tags: [], loreFlags: ['ch4_intel_leaked'], branchModifiers: [] };
    return { GP: 0, XP: 0, reputationDelta: { mcc: -10 }, tags: [], loreFlags: ['ch4_meeting_exposed'], branchModifiers: [] };
  }
  const secondary = sim.metrics.secondary_completed || [];
  let gp = 30000;
  let rep = { mcc: 15, cv: 10 };
  const loreFlags = [];
  const branchModifiers = [];
  if (choiceId === 'ch4_compliment_ship') loreFlags.push('kara_likes_player');
  if (choiceId === 'ch4_question_li_fang') loreFlags.push('kara_strongly_likes_player', 'lifang_distrust_player');
  if (secondary.includes('obj_kara_ship_pristine') && (choiceId === 'ch4_compliment_ship' || choiceId === 'ch4_question_li_fang')) {
    loreFlags.push('kara_personal_channel_unlocked');
    branchModifiers.push({ targetChapter: 'mcc_campaign_ch10', key: 'ch10_kara_loyalty', value: { ch10_kara_can_switch_sides: true, ch10_kara_dialog: 'friendly_variant' } });
  }
  if (secondary.includes('obj_lifang_shuttle_pristine')) rep = mergeRep(rep, { mcc: 5 });
  if (secondary.includes('obj_finish_under_12min')) gp += 8000;
  if (secondary.includes('obj_zero_helion_escapes')) { gp += 5000; rep = mergeRep(rep, { mcc: 10 }); }
  if (!loreFlags.includes('kara_likes_player') && !loreFlags.includes('kara_strongly_likes_player')) {
    branchModifiers.push({ targetChapter: 'mcc_campaign_ch9', key: 'ch9_kara_hostile', value: { ch9_kara_appears_as_enemy: true } });
  }
  return { GP: gp, XP: 1200, reputationDelta: rep, items: [], tags: [], loreFlags, unlocks: ['mcc_campaign_ch5'], branchModifiers };
}

function calculateRewards(progress, sim) {
  if (progress.quest_id === CH2_ID) return calculateCh2Rewards(progress, sim);
  if (progress.quest_id === CH3_ID) return calculateCh3Rewards(progress, sim);
  if (progress.quest_id === CH4_ID) return calculateCh4Rewards(progress, sim);
  return calculateCh1Rewards(progress, sim);
}

async function getStatus(wallet) {
  const w = normalizeWallet(wallet);
  const [progressRes, reputationRes, branchRes, inboxRes, tagRes, sessionRes] = await Promise.all([
    pool.query(`SELECT * FROM player_campaign_progress WHERE wallet = $1 ORDER BY chapter_number ASC`, [w]),
    pool.query(`SELECT faction, value FROM player_reputation WHERE wallet = $1 ORDER BY faction ASC`, [w]),
    pool.query(`SELECT target_chapter, modifier_key, modifier_value, source_quest_id, created_at FROM chapter_branch_modifiers WHERE wallet = $1 ORDER BY created_at DESC`, [w]),
    pool.query(`SELECT quest_id, reward_type, reward_code, quantity, payload, created_at FROM campaign_reward_inbox WHERE wallet = $1 AND claimed = FALSE ORDER BY created_at DESC LIMIT 20`, [w]),
    pool.query(`SELECT tag_id FROM player_tags WHERE wallet = $1 ORDER BY created_at DESC`, [w]),
    pool.query(`SELECT * FROM campaign_sessions WHERE wallet = $1 AND status = 'active' ORDER BY started_at DESC LIMIT 1`, [w]),
  ]);
  const rows = progressRes.rows;
  const progressByQuest = {};
  rows.forEach(r => { progressByQuest[r.quest_id] = r; });
  const reputation = {};
  reputationRes.rows.forEach(r => { reputation[r.faction] = r.value; });
  for (const faction of FACTIONS) if (reputation[faction] == null) reputation[faction] = 0;
  const completedSet = new Set(rows.filter(r => r.status === 'completed' || r.status === 'claimed').map(r => r.quest_id));
  const activeSet = new Set(rows.filter(r => r.status === 'in_progress').map(r => r.quest_id));
  const tagSet = new Set(tagRes.rows.map(r => r.tag_id));
  const branchSet = new Set(branchRes.rows.map(r => r.modifier_key));
  const availableChapters = [];
  const lockedChapters = [];
  for (const ch of Object.values(CHAPTERS)) {
    if (completedSet.has(ch.questId) || activeSet.has(ch.questId)) continue;
    const prereqOk = !ch.prerequisiteChapter || completedSet.has(ch.prerequisiteChapter) || (ch.questId === CH3_ID && branchSet.has('mcc_route_termination_offered'));
    const repOk = Object.entries(ch.requiredReputation || {}).every(([f, v]) => (reputation[f] || 0) >= v);
    const tagOk = !(ch.blockingTags || []).some(t => tagSet.has(t));
    if (prereqOk && repOk && tagOk) availableChapters.push(ch.questId);
    else lockedChapters.push(ch.questId);
  }
  return {
    chapters: Object.values(CHAPTERS).map(ch => publicChapter(ch, progressByQuest[ch.questId])),
    completedChapters: Array.from(completedSet),
    active: rows.find(r => r.status === 'in_progress') ? formatProgress(rows.find(r => r.status === 'in_progress')) : null,
    activeSession: sessionRes.rows[0] || null,
    availableChapters,
    lockedChapters,
    reputation,
    tierLabels: Object.fromEntries(Object.entries(reputation).map(([f, v]) => [f, reputationTierLabel(v)])),
    tags: tagRes.rows.map(r => r.tag_id),
    branchModifiers: branchRes.rows,
    rewardInbox: inboxRes.rows,
  };
}

async function validateStartConditions(client, wallet, chapter) {
  const userRows = await client.query('SELECT rank_level FROM users WHERE wallet_address = $1 FOR UPDATE', [wallet]);
  const rank = parseInt(userRows.rows[0]?.rank_level || 1, 10);
  if (rank < chapter.requiredLevel) return { error: 'LEVEL_REQUIRED', requiredLevel: chapter.requiredLevel };

  if (chapter.prerequisiteChapter) {
    const prereq = await client.query(
      `SELECT 1 FROM player_campaign_progress
       WHERE wallet = $1 AND quest_id = $2 AND status IN ('completed','claimed')`,
      [wallet, chapter.prerequisiteChapter]
    );
    let branchOverride = false;
    if (chapter.questId === CH3_ID) {
      const branch = await client.query(
        `SELECT 1 FROM player_branch_modifiers
         WHERE wallet = $1 AND modifier_id = 'mcc_route_termination_offered' AND consumed_at IS NULL`,
        [wallet]
      );
      branchOverride = branch.rows.length > 0;
    }
    if (!prereq.rows.length && !branchOverride) return { error: 'PREREQUISITE_NOT_MET', prerequisiteChapter: chapter.prerequisiteChapter };
  }

  for (const [faction, minValue] of Object.entries(chapter.requiredReputation || {})) {
    const rep = await client.query('SELECT value FROM player_reputation WHERE wallet = $1 AND faction = $2', [wallet, faction]);
    const value = parseInt(rep.rows[0]?.value || 0, 10);
    if (value < minValue) return { error: 'INSUFFICIENT_REPUTATION', faction, required: minValue, current: value };
  }

  for (const tag of chapter.blockingTags || []) {
    const tagRows = await client.query('SELECT 1 FROM player_tags WHERE wallet = $1 AND tag_id = $2', [wallet, tag]);
    if (tagRows.rows.length) return { error: 'BLOCKED_BY_TAG', tag };
  }
  return null;
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
    const startError = await validateStartConditions(client, w, chapter);
    if (startError) {
      await client.query('ROLLBACK');
      return startError;
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
    const randomSeed = crypto.randomBytes(8).readBigInt64BE().toString();
    await client.query(
      `UPDATE campaign_sessions SET status = 'abandoned', updated_at = NOW()
       WHERE wallet = $1 AND chapter_id = $2 AND status = 'active'`,
      [w, chapter.questId]
    );
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
    await client.query(
      `INSERT INTO campaign_sessions (session_id, wallet, chapter_id, expires_at, random_seed, status)
       VALUES ($1,$2,$3,NOW() + INTERVAL '1 hour',$4,'active')
       ON CONFLICT (session_id) DO UPDATE SET
         wallet = EXCLUDED.wallet,
         chapter_id = EXCLUDED.chapter_id,
         expires_at = EXCLUDED.expires_at,
         random_seed = EXCLUDED.random_seed,
         status = 'active',
         updated_at = NOW()`,
      [sessionId, w, chapter.questId, randomSeed]
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
    await applyReputation(client, w, choice.effects.reputationDelta || {}, 'choice', choice.id);
    if (choice.effects.flag) {
      await client.query(
        `INSERT INTO player_lore_flags (wallet, flag_id, source_quest_id, source_chapter)
         VALUES ($1,$2,$3,$3) ON CONFLICT DO NOTHING`,
        [w, choice.effects.flag, progress.quest_id]
      );
    }
    if (choice.effects.flag2) {
      await client.query(
        `INSERT INTO player_lore_flags (wallet, flag_id, source_quest_id, source_chapter)
         VALUES ($1,$2,$3,$3) ON CONFLICT DO NOTHING`,
        [w, choice.effects.flag2, progress.quest_id]
      );
    }
    if (choice.effects.branchSet) {
      await client.query(
        `INSERT INTO player_branch_modifiers (wallet, modifier_id, target_chapter, source_chapter)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [w, choice.effects.branchSet.modifierId, choice.effects.branchSet.targetChapter, progress.quest_id]
      );
      await client.query(
        `INSERT INTO chapter_branch_modifiers (wallet, target_chapter, modifier_key, modifier_value, source_quest_id)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [w, choice.effects.branchSet.targetChapter, choice.effects.branchSet.modifierId, JSON.stringify({ fromChoice: choice.id }), progress.quest_id]
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
  const preview = { elapsedSec: elapsed, oxygenRecoveryPct: Math.min(100, Math.round((elapsed / 840) * 100)) };
  await pool.query(
    `UPDATE campaign_sessions SET current_metrics = $1, updated_at = NOW()
     WHERE session_id = $2 AND wallet = $3 AND status = 'active'`,
    [JSON.stringify(preview), sessionId, w]
  );
  return { progress: formatProgress(p), environmentalPhase: phaseForElapsed(elapsed), preview, environmentState: getEnvironmentState(CHAPTERS[p.quest_id]?.environment, elapsed) };
}

function getEnvironmentState(config, elapsedSec) {
  if (!config) return null;
  const phases = config.phases || [];
  let current = phases[0] || { phase: 0, startSec: 0 };
  let next = null;
  for (const phase of phases) {
    if ((phase.startSec || 0) <= elapsedSec) current = phase;
    else { next = phase; break; }
  }
  return {
    type: config.type,
    currentPhase: current.phase || 0,
    activeModifiers: {
      optical_accuracy: current.accuracyMod || 0,
      laser_range: current.rangeMod || 0,
      railgun_accuracy: config.weaponsUnaffected?.includes('railgun') ? 0 : (current.accuracyMod || 0),
      missile_accuracy: current.accuracyMod || 0,
      ship_maneuverability: 0,
    },
    nextPhaseAtSec: next ? next.startSec : null,
  };
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
    const sim = simulateChapter(progress);
    const rewards = calculateRewards(progress, sim);
    const status = sim.success ? 'completed' : 'failed';

    await applyReputation(client, w, rewards.reputationDelta || {}, 'campaign_chapter', progress.quest_id);
    if (sim.success) {
      if (rewards.GP > 0) {
        await client.query('UPDATE users SET gp_balance = COALESCE(gp_balance,0) + $1 WHERE wallet_address = $2', [rewards.GP, w]);
        await client.query(
          'INSERT INTO gp_activity_log (wallet, delta, source, note) VALUES ($1,$2,$3,$4)',
          [w, rewards.GP, 'campaign_reward', progress.quest_id]
        );
      }
      if (rewards.XP > 0) await awardXP(client, w, rewards.XP);
      for (const item of rewards.items || []) {
        await client.query(
          `INSERT INTO campaign_reward_inbox (wallet, quest_id, reward_type, reward_code, quantity, payload)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [w, progress.quest_id, item.type, item.code, item.quantity || 1, JSON.stringify(item)]
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
      await client.query(
        `INSERT INTO player_tags (wallet, tag_id, source_quest_id, acquired_from)
         VALUES ($1,$2,$3,$3) ON CONFLICT DO NOTHING`,
        [w, tag, progress.quest_id]
      );
    }
    for (const flag of rewards.loreFlags || []) {
      await client.query(
        `INSERT INTO player_lore_flags (wallet, flag_id, source_quest_id, source_chapter)
         VALUES ($1,$2,$3,$3) ON CONFLICT DO NOTHING`,
        [w, flag, progress.quest_id]
      );
    }
    for (const mod of rewards.branchModifiers || []) {
      await client.query(
        `INSERT INTO chapter_branch_modifiers (wallet, target_chapter, modifier_key, modifier_value, source_quest_id)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [w, mod.targetChapter, mod.key, JSON.stringify(mod.value || {}), progress.quest_id]
      );
      await client.query(
        `INSERT INTO player_branch_modifiers (wallet, modifier_id, target_chapter, source_chapter)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [w, mod.key, mod.targetChapter, progress.quest_id]
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
         attempts = attempts + 1,
         last_metrics = $4,
         best_metrics = CASE
           WHEN COALESCE((best_metrics->>'oxygen_recovery_pct')::numeric, -1) < $2 THEN $4
           ELSE best_metrics
         END,
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
    await client.query(
      `UPDATE campaign_sessions SET status = $1, current_metrics = $2, updated_at = NOW()
       WHERE session_id = $3`,
      [sim.success ? 'completed' : 'expired', JSON.stringify(sim.metrics), sessionId]
    );
    await client.query('COMMIT');
    const chapter = CHAPTERS[progress.quest_id] || {};
    const title = chapter.title?.ko || progress.quest_id;
    notifyPlayer(w, 'campaign_result', sim.success ? `⚡ 캠페인 완료: ${title}` : `⚠ 캠페인 실패: ${title}`, { questId: progress.quest_id }).catch(() => {});
    return { success: sim.success, progress: formatProgress(updated.rows[0]), metrics: sim.metrics, rewards, nextChapterUnlocked: sim.success ? (rewards.unlocks || [])[0] || null : null };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function abandon(wallet, sessionId) {
  const w = normalizeWallet(wallet);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE player_campaign_progress SET status = 'failed', failed_at = NOW(), updated_at = NOW()
       WHERE wallet = $1 AND session_id = $2 AND status = 'in_progress'
       RETURNING *`,
      [w, sessionId]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return { error: 'SESSION_NOT_FOUND' };
    }
    await client.query(
      `UPDATE campaign_sessions SET status = 'abandoned', updated_at = NOW()
       WHERE wallet = $1 AND session_id = $2 AND status = 'active'`,
      [w, sessionId]
    );
    await client.query('COMMIT');
    return { success: true, progress: formatProgress(rows[0]) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getReputation(wallet) {
  const w = normalizeWallet(wallet);
  const { rows } = await pool.query('SELECT faction, value FROM player_reputation WHERE wallet = $1 ORDER BY faction', [w]);
  const reputation = {};
  rows.forEach(r => { reputation[r.faction] = r.value; });
  for (const faction of FACTIONS) if (reputation[faction] == null) reputation[faction] = 0;
  return { reputation, tierLabels: Object.fromEntries(Object.entries(reputation).map(([f, v]) => [f, reputationTierLabel(v)])) };
}

async function applyReputationDelta(wallet, faction, delta, sourceType, sourceId) {
  const w = normalizeWallet(wallet);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureUser(client, w);
    await ensureReputationRows(client, w);
    await applyReputation(client, w, { [faction]: delta }, sourceType || 'admin', sourceId || 'manual');
    await client.query('COMMIT');
    return getReputation(w);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getTags(wallet) {
  const w = normalizeWallet(wallet);
  const [tagRes, titleRes] = await Promise.all([
    pool.query(
      `SELECT pt.tag_id, pt.created_at, pt.source_quest_id, pt.acquired_from, td.category, td.display_name_key, td.is_negative, td.effects
       FROM player_tags pt
       LEFT JOIN tag_definitions td ON td.id = pt.tag_id
       WHERE pt.wallet = $1
       ORDER BY pt.created_at DESC`,
      [w]
    ),
    pool.query('SELECT title_tag_id, set_at FROM player_active_title WHERE wallet = $1', [w]),
  ]);
  return { tags: tagRes.rows, activeTitle: titleRes.rows[0] || null };
}

async function grantTag(wallet, tagId, source, metadata = {}) {
  const w = normalizeWallet(wallet);
  await pool.query(
    `INSERT INTO player_tags (wallet, tag_id, source_quest_id, acquired_from, metadata)
     VALUES ($1,$2,$3,$3,$4)
     ON CONFLICT (wallet, tag_id) DO NOTHING`,
    [w, tagId, source || 'admin', JSON.stringify(metadata || {})]
  );
  return getTags(w);
}

async function revokeTag(wallet, tagId) {
  const w = normalizeWallet(wallet);
  const { rows } = await pool.query('SELECT removable FROM tag_definitions WHERE id = $1', [tagId]);
  if (!rows[0]?.removable) return { error: 'TAG_NOT_REMOVABLE' };
  await pool.query('DELETE FROM player_tags WHERE wallet = $1 AND tag_id = $2', [w, tagId]);
  return getTags(w);
}

async function setActiveTitle(wallet, tagId) {
  const w = normalizeWallet(wallet);
  const { rows } = await pool.query(
    `SELECT td.id FROM player_tags pt
     JOIN tag_definitions td ON td.id = pt.tag_id
     WHERE pt.wallet = $1 AND pt.tag_id = $2 AND td.category = 'title'`,
    [w, tagId]
  );
  if (!rows[0]) return { error: 'TITLE_TAG_NOT_OWNED' };
  await pool.query(
    `INSERT INTO player_active_title (wallet, title_tag_id, set_at)
     VALUES ($1,$2,NOW())
     ON CONFLICT (wallet) DO UPDATE SET title_tag_id = EXCLUDED.title_tag_id, set_at = NOW()`,
    [w, tagId]
  );
  return getTags(w);
}

async function getLoreFlags(wallet) {
  const w = normalizeWallet(wallet);
  const { rows } = await pool.query(
    `SELECT plf.flag_id, plf.created_at, plf.source_quest_id, plf.source_chapter, plf.metadata, lfd.category, lfd.scope
     FROM player_lore_flags plf
     LEFT JOIN lore_flag_definitions lfd ON lfd.id = plf.flag_id
     WHERE plf.wallet = $1
     ORDER BY plf.created_at DESC`,
    [w]
  );
  return { flags: rows };
}

async function setLoreFlag(wallet, flagId, sourceChapter, metadata = {}) {
  const w = normalizeWallet(wallet);
  await pool.query(
    `INSERT INTO player_lore_flags (wallet, flag_id, source_quest_id, source_chapter, metadata)
     VALUES ($1,$2,$3,$3,$4)
     ON CONFLICT (wallet, flag_id) DO UPDATE SET metadata = EXCLUDED.metadata`,
    [w, flagId, sourceChapter || 'admin', JSON.stringify(metadata || {})]
  );
  return getLoreFlags(w);
}

async function checkLoreFlags(wallet, flagIds) {
  const w = normalizeWallet(wallet);
  const ids = Array.isArray(flagIds) ? flagIds : [];
  const { rows } = await pool.query('SELECT flag_id FROM player_lore_flags WHERE wallet = $1 AND flag_id = ANY($2)', [w, ids]);
  const present = new Set(rows.map(r => r.flag_id));
  return Object.fromEntries(ids.map(id => [id, present.has(id)]));
}

async function getActiveBranchModifiers(wallet, targetChapter) {
  const w = normalizeWallet(wallet);
  const { rows } = await pool.query(
    `SELECT pbm.modifier_id, pbm.target_chapter, pbm.source_chapter, pbm.set_at, bmd.effects, bmd.activation_conditions
     FROM player_branch_modifiers pbm
     LEFT JOIN branch_modifier_definitions bmd ON bmd.id = pbm.modifier_id
     WHERE pbm.wallet = $1 AND pbm.target_chapter = $2 AND pbm.consumed_at IS NULL
     ORDER BY pbm.set_at DESC`,
    [w, targetChapter]
  );
  const appliedEffects = {};
  rows.forEach(r => Object.assign(appliedEffects, r.effects || {}));
  return { activeModifiers: rows, appliedEffects };
}

async function setBranchModifier(wallet, modifierId, targetChapter, sourceChapter) {
  const w = normalizeWallet(wallet);
  await pool.query(
    `INSERT INTO player_branch_modifiers (wallet, modifier_id, target_chapter, source_chapter)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT DO NOTHING`,
    [w, modifierId, targetChapter, sourceChapter || null]
  );
  return getActiveBranchModifiers(w, targetChapter);
}

module.exports = {
  getStatus,
  startChapter,
  choose,
  getProgress,
  complete,
  abandon,
  getReputation,
  applyReputationDelta,
  getTags,
  grantTag,
  revokeTag,
  setActiveTitle,
  getLoreFlags,
  setLoreFlag,
  checkLoreFlags,
  getActiveBranchModifiers,
  setBranchModifier,
  getEnvironmentState,
};
