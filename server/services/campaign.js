const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pool, ensureUser, awardXP, notifyPlayer, logGPActivity } = require('../db');

const CH1_ID = 'mcc_campaign_ch1';
const CH2_ID = 'mcc_campaign_ch2';
const CH3_ID = 'mcc_campaign_ch3';
const CH4_ID = 'mcc_campaign_ch4';
const CH5_ID = 'mcc_campaign_ch5';
const CH6_ID = 'mcc_campaign_ch6';
const CH7_ID = 'mcc_campaign_ch7';
const CH8_ID = 'mcc_campaign_ch8';
const CH9_ID = 'mcc_campaign_ch9';
const CH10_ID = 'mcc_campaign_ch10';
const FSP_CH1_ID = 'fsp_campaign_ch1';
const FSP_CH2_ID = 'fsp_campaign_ch2';
const FSP_CH3_ID = 'fsp_campaign_ch3';
const FSP_CH4_ID = 'fsp_campaign_ch4';
const FSP_CH5_ID = 'fsp_campaign_ch5';
const FSP_CH6_ID = 'fsp_campaign_ch6';
const FSP_CH7_ID = 'fsp_campaign_ch7';
const FSP_CH8_ID = 'fsp_campaign_ch8';
const FSP_CH9_ID = 'fsp_campaign_ch9';
const FSP_CH10_ID = 'fsp_campaign_ch10';
const CV_CH1_ID = 'cv_campaign_ch1';
const CV_CH2_ID = 'cv_campaign_ch2';
const CV_CH3_ID = 'cv_campaign_ch3';
const CV_CH4_ID = 'cv_campaign_ch4';
const CV_CH5_ID = 'cv_campaign_ch5';
const CV_CH6_ID = 'cv_campaign_ch6';
const CV_CH7_ID = 'cv_campaign_ch7';
const CV_CH8_ID = 'cv_campaign_ch8';
const CV_CH9_ID = 'cv_campaign_ch9';
const CV_CH10_ID = 'cv_campaign_ch10';
const HIDDEN_CH1_ID = 'hidden_campaign_ch1';
const HIDDEN_CH2_ID = 'hidden_campaign_ch2';
const HIDDEN_CH3_ID = 'hidden_campaign_ch3';
const HIDDEN_CH4_ID = 'hidden_campaign_ch4';
const HIDDEN_CH5_ID = 'hidden_campaign_ch5';
const FACTIONS = ['mcc', 'fsp', 'cv', 'pilgrim_arms'];
const REP_MIN = -100;
const REP_MAX = 100;
const PROJECT_ROOT = path.resolve(__dirname, '../..');

function loadScenesFile(filePath) {
  if (!filePath) return null;
  try {
    const resolvedPath = path.resolve(PROJECT_ROOT, filePath);
    if (!fs.existsSync(resolvedPath)) return null;
    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (err) {
    console.warn('[campaign] failed to load scenes file:', filePath, err && err.message ? err.message : err);
    return null;
  }
}

function findSceneChoice(chapter, choiceId) {
  if (!chapter || !choiceId) return null;
  const story = chapter.scenesFile ? loadScenesFile(chapter.scenesFile) : null;
  const scenes = Array.isArray(story) ? story : (story && Array.isArray(story.scenes) ? story.scenes : []);
  for (const scene of scenes) {
    if (!scene || !['choice', 'branch'].includes(scene.type)) continue;
    const options = scene.choices || scene.options || [];
    const option = options.find(o => o && (o.id === choiceId || o.value === choiceId));
    if (option) {
      return {
        id: choiceId,
        labelKo: typeof option.text === 'object' ? option.text.ko : (option.labelKo || option.label || option.text || choiceId),
        effects: option.effects || {},
        sceneLocal: true,
      };
    }
  }
  return null;
}

const CHAPTERS = {
  mcc_prologue: {
    questId: 'mcc_prologue',
    scenesFile: 'docs/campaign-story/prologue_shared.json',
    campaignId: 'mcc_route',
    chapterNumber: 0,
    faction: 'mcc',
    title: { ko: '프롤로그: 카리오페호', en: 'Prologue: The Kariyope', ja: 'プロローグ: カリオペ号', zh: '序章：卡里奥佩号' },
    requiredLevel: 1,
    battleResolution: 'none',
    estimatedPlayTimeSeconds: 480,
    location: { id: 'earth_to_mars_transit', displayNameKo: '지구-화성 화물 항로', displayNameEn: 'Earth-Mars Cargo Route', region: 'space' },
    briefing: { npcId: 'lifang', npcName: 'Li Fang', npcTitle: 'MCC 현장 책임자', lines: [{ id: 'mcc_p_01', ko: '화성은 지구랑 달라요. 여기서 실수는 죽음이에요.' }], radio: [] },
    choices: [],
  },
  fsp_prologue: {
    questId: 'fsp_prologue',
    scenesFile: 'docs/campaign-story/prologue_shared.json',
    campaignId: 'fsp_route',
    chapterNumber: 0,
    faction: 'fsp',
    title: { ko: '프롤로그: 카리오페호', en: 'Prologue: The Kariyope', ja: 'プロローグ: カリオペ号', zh: '序章：卡里奥佩号' },
    requiredLevel: 1,
    battleResolution: 'none',
    estimatedPlayTimeSeconds: 480,
    location: { id: 'new_athens_settlement', displayNameKo: 'New Athens 정착지', displayNameEn: 'New Athens Settlement', displayNameEn: 'New Athens Settlement', region: 'hellas' },
    briefing: { npcId: 'mikhail', npcName: 'Mikhail', npcTitle: 'New Athens 원로', lines: [{ id: 'fsp_p_01', ko: '규칙은 하나야. 여기선 혼자 살 수 없어.' }], radio: [] },
    choices: [],
  },
  cv_prologue: {
    questId: 'cv_prologue',
    scenesFile: 'docs/campaign-story/prologue_shared.json',
    campaignId: 'cv_route',
    chapterNumber: 0,
    faction: 'cv',
    title: { ko: '프롤로그: 카리오페호', en: 'Prologue: The Kariyope', ja: 'プロローグ: カリオペ号', zh: '序章：卡里奥佩号' },
    requiredLevel: 1,
    battleResolution: 'none',
    estimatedPlayTimeSeconds: 480,
    location: { id: 'outer_colony_ruins', displayNameKo: '외곽 식민지 폐허', displayNameEn: 'Outer Colony Ruins', displayNameEn: 'Outer Colony Ruins', region: 'outer' },
    briefing: { npcId: 'butcher', npcName: 'The Butcher', npcTitle: 'CV 지도자', lines: [{ id: 'cv_p_01', ko: 'CV에는 규칙이 없어. 그게 규칙이야.' }], radio: [] },
    choices: [],
  },
  [CH1_ID]: {
    questId: CH1_ID,
    scenesFile: 'docs/campaign-story/mcc_ch1_oxygen_rush.json',
    campaignId: 'mcc_route',
    chapterNumber: 1,
    faction: 'mcc',
    title: { ko: '산소 쟁탈', en: 'Oxygen Rush', ja: '酸素争奪', zh: '氧气争夺' },
    requiredLevel: 1,
    prerequisiteChapter: 'mcc_prologue',
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 840,
    location: { id: 'erebus_crater', displayNameKo: '에레부스 분화구 정제소 단지', displayNameEn: 'Erebus Crater Refinery Complex', region: 'equator' },
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
    scenesFile: 'docs/campaign-story/mcc_ch2_frozen_highway.json',
    campaignId: 'mcc_route',
    chapterNumber: 2,
    faction: 'mcc',
    title: { ko: '동결된 고속도로', en: 'Frozen Highway', ja: '凍結した高速道路', zh: '冰封公路' },
    requiredLevel: 2,
    prerequisiteChapter: CH1_ID,
    requiredReputation: { mcc: 10 },
    blockingTags: ['war_criminal'],
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1800,
    location: { id: 'hellas_north_mining_outpost', displayNameKo: 'Hellas 북부 수소 채굴장', displayNameEn: 'Hellas North Hydrogen Mine', region: 'hellas_basin' },
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
    scenesFile: 'docs/campaign-story/mcc_ch3_boardroom.json',
    campaignId: 'mcc_route',
    chapterNumber: 3,
    faction: 'mcc',
    title: { ko: '이사회', en: 'Boardroom', ja: '取締役会', zh: '董事会' },
    requiredLevel: 3,
    prerequisiteChapter: CH2_ID,
    requiredReputation: { mcc: 25 },
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1800,
    location: { id: 'olympus_shareholder7', displayNameKo: 'Shareholder-7 궤도 스테이션', displayNameEn: 'Shareholder-7 Orbital Station', region: 'olympus_orbit' },
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
    scenesFile: 'docs/campaign-story/mcc_ch4_pirates_payroll.json',
    campaignId: 'mcc_route',
    chapterNumber: 4,
    faction: 'mcc',
    title: { ko: '해적 매수', en: "Pirate's Payroll", ja: '海賊への賄賂', zh: '海盗贿赂' },
    requiredLevel: 4,
    prerequisiteChapter: CH3_ID,
    requiredReputation: { mcc: 30 },
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1080,
    location: { id: 'red_dust_station', displayNameKo: 'Red Dust 정거장', displayNameEn: 'Red Dust Station', region: 'valles_marineris_entrance' },
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
  [CH5_ID]: {
    questId: CH5_ID,
    scenesFile: 'docs/campaign-story/mcc_ch5_kepler_dispute.json',
    campaignId: 'mcc_route',
    chapterNumber: 5,
    faction: 'mcc',
    title: { ko: '케플러 분쟁', en: 'Kepler Commons', ja: 'ケプラー紛争', zh: '开普勒争端' },
    requiredLevel: 5,
    prerequisiteChapter: CH4_ID,
    requiredReputation: { mcc: 40 },
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1200,
    location: { id: 'kepler_crater', displayNameKo: 'Kepler 분화구', displayNameEn: 'Kepler Crater', region: 'equator_south_12' },
    environment: {
      type: 'low_gravity_pocket',
      secondary: 'oxygen_supply_pressure',
      totalDurationSeconds: 1200,
      phases: [
        { phase: 0, startSec: 0, shipManeuverability: 20, longRangeAccuracy: -25, railgunEffectiveModifier: -15, missileEffectiveModifier: 20 },
      ],
    },
    briefing: {
      npcId: 'chen_weiss',
      npcName: 'Chen Weiss / Dr. Roth',
      npcTitle: 'MCC 이사회 · Roth 기록 방송',
      lines: [
        { id: 'ch5_brief_01', ko: '이건 단순 전투가 아니야. 화성 다음 100년이 결정돼.' },
        { id: 'ch5_brief_02', ko: 'Kepler 데이터 서버 — Dr. Roth 원본 분석 자료. 누가 확보하느냐가 모든 걸 결정.' },
        { id: 'ch5_brief_03', ko: '분화구야. 저중력 — 운동성 +20%, 장거리 -25%. 우리 레일건 약화. CV 미사일 우세.' },
        { id: 'ch5_roth_01', ko: '이건... 모든 파벌이 들어야 해. 고대 금속은 외계 기원이야.' },
        { id: 'ch5_roth_02', ko: '4억 년 전, 화성에 외계 종족이 있었어. 그들이 사라진 이유 — 자원 분쟁.' },
      ],
      radio: [
        { triggerSec: 600, ko: 'Roth 메시지 수신. 모든 분기 기록해.' },
        { triggerSec: 900, ko: '산소 잔량 확인. Kepler 저중력 영향 계속.' },
      ],
    },
    choices: [
      { id: 'ch5_block_fsp', labelKo: 'FSP 측면을 막습니다.', effects: { flag: 'ch5_chose_block_fsp' } },
      { id: 'ch5_escort_supply', labelKo: '우리 산소 보급선 호위.', effects: { flag: 'ch5_chose_escort' } },
      { id: 'ch5_solo_data', labelKo: '데이터 서버 직접 탈취.', effects: { flag: 'ch5_chose_solo_data', flag2: 'insubordination_attempt', branchSet: { modifierId: 'ending_2_executive_eligible', targetChapter: 'mcc_campaign_ch10' } } },
      { id: 'ch5_strike_cv', labelKo: 'CV 자급 시스템 격파.', effects: { reputationDelta: { cv: -25 }, flag: 'ch5_chose_cv_strike', flag2: 'cv_plague_ship_destroyed' } },
    ],
  },
  [CH6_ID]: {
    questId: CH6_ID,
    scenesFile: 'docs/campaign-story/mcc_ch6_whistleblower.json',
    campaignId: 'mcc_route',
    chapterNumber: 6,
    faction: 'mcc',
    title: { ko: '내부고발자', en: 'Whistleblower', ja: '内部告発者', zh: '揭发者' },
    requiredLevel: 6,
    prerequisiteChapter: CH5_ID,
    requiredReputation: { mcc: 50 },
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1500,
    location: { id: 'shareholder7_external_dock_8', displayNameKo: 'Shareholder-7 8번 도크', displayNameEn: 'Shareholder-7 Dock 8', region: 'olympus_orbit' },
    environment: {
      type: 'solar_radiation_storm',
      totalDurationSeconds: 1500,
      phases: [
        { phase: 0, startSec: 0, nonArmoredHpDrainPerMin: -1, satelliteTrackingAccuracy: -80, commInterference: 10 },
      ],
    },
    briefing: {
      npcId: 'lifang',
      npcName: 'Li Fang',
      npcTitle: '비공식 셔틀 · 카메라 OFF',
      lines: [
        { id: 'ch6_pre_01', ko: '지금 당장 와줘. 공식 통신 쓰지 마. 8번 도크. 혼자.' },
        { id: 'ch6_pre_03', ko: '내가 알게 된 것. 2156년 Crimson Verdict 창설은 우연이 아니야.' },
        { id: 'ch6_pre_04', ko: 'MCC가 직접 자금 지원했어. 비공식 무력부로 사용하려고.' },
        { id: 'ch6_pre_06', ko: '증거. 자금 이체 47건, 군벌 채용 서류, Chen 친필 서명 8개. 다 가져왔어.' },
        { id: 'ch6_pre_08', ko: 'Chen이 날 이미 의심해. Solar Flare 36시간 후 도착. 그 안에 결정해.' },
      ],
      radio: [
        { triggerSec: 300, ko: '이 선택은 MCC 루트를 영구히 바꾼다.' },
      ],
    },
    choices: [
      { id: 'ch6_help_lifang', labelKo: '...같이 갑시다. FSP 언론 채널까지 호위하겠습니다.', effects: { reputationDelta: { mcc: -50, fsp: 30 }, flag: 'ch6_chose_help_lifang', tagsAdded: ['whistleblower'], branchSet: { modifierId: 'mcc_route_a_active', targetChapter: 'any_mcc_post_ch6' }, extraBranchSet: { modifierId: 'ending_3_locked_in', targetChapter: 'mcc_campaign_ch10' } } },
      { id: 'ch6_report_chen', labelKo: '...Li Fang. 미안합니다. 회사 안보 문제예요.', effects: { reputationDelta: { mcc: 40, fsp: -10 }, flag: 'ch6_chose_report_chen', flag2: 'lifang_arrested', branchSet: { modifierId: 'mcc_route_b_active', targetChapter: 'any_mcc_post_ch6' }, extraBranchSet: { modifierId: 'ending_1_eligible', targetChapter: 'mcc_campaign_ch10' } } },
      { id: 'ch6_copy_silent', labelKo: '사본만 복사하고 침묵.', effects: { flag: 'ch6_chose_copy_silent', tagsAdded: ['secret_keeper'], branchSet: { modifierId: 'mcc_route_c_active', targetChapter: 'any_mcc_post_ch6' }, extraBranchSet: { modifierId: 'ending_4_unlocked', targetChapter: 'mcc_campaign_ch10' } } },
    ],
  },
  [CH7_ID]: {
    questId: CH7_ID,
    scenesFile: 'docs/campaign-story/mcc_ch7_chens_gambit.json',
    campaignId: 'mcc_route',
    chapterNumber: 7,
    faction: 'mcc',
    title: { ko: '시장 전쟁', en: 'Market War', ja: '市場戦争', zh: '市场战争' },
    requiredLevel: 7,
    prerequisiteChapter: CH6_ID,
    requiredBranchAny: ['mcc_route_a_active', 'mcc_route_b_active', 'mcc_route_c_active'],
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1500,
    location: { id: 'dust_storm_market_war', displayNameKo: 'Dust Storm 시즌 작전 구역', displayNameEn: 'Dust Storm Season Operation Zone', region: 'equator' },
    environment: {
      type: 'dust_storm_season_peak',
      totalDurationSeconds: 1500,
      phases: [
        { phase: 0, startSec: 0, accuracyMod: -40, rangeMod: -50, satelliteTracking: -80, cargoSpeed: -30 },
      ],
      weaponsUnaffected: ['railgun'],
    },
    briefing: {
      npcId: 'route_variant',
      npcName: 'Route Variant',
      npcTitle: 'Ch6 분기 기반 작전',
      lines: [
        { id: 'ch7_common_01', ko: 'Dust Storm 시즌. 위성 -80%. 작전 기록은 남지 않는다.' },
        { id: 'ch7a_li_01', ko: 'Branch A: Chen이 우리 둘 다 끝내려고 해. CV 군벌 둘을 동시에 처리해야 해.' },
        { id: 'ch7b_chen_01', ko: 'Branch B: Helion 주가 박살내. 화물 운송선 3개 동시 습격.' },
        { id: 'ch7c_chen_01', ko: 'Branch C: 같은 임무. 그리고 회사 내 이상한 데이터 흐름이 있어.' },
      ],
      radio: [
        { triggerSec: 500, ko: 'Dust Storm peak. 레일건 영향 없음.' },
        { triggerSec: 1100, ko: '위성 추적 차단 유지. 마무리.' },
      ],
    },
    choices: [
      { id: 'ch7a_dual_attack', labelKo: 'Branch A: Cruz와 Vain 동시 타격.', effects: {} },
      { id: 'ch7a_sequential', labelKo: 'Branch A: Cruz 먼저, Vain 뒤로.', effects: {} },
      { id: 'ch7a_diplomatic', labelKo: 'Branch A: Cruz 매수 시도.', effects: { reputationDelta: { cv: 5 } } },
      { id: 'ch7b_standard', labelKo: 'Branch B: 정석 3척 동시 격파.', effects: {} },
      { id: 'ch7b_helion_hq', labelKo: 'Branch B: Helion 본사 직접 타격.', effects: {} },
      { id: 'ch7c_deflect', labelKo: 'Branch C: 정상적인 운영 흐름 같습니다.', effects: { flag: 'chen_loyalty_test_passed' } },
      { id: 'ch7c_helpful', labelKo: 'Branch C: Marcus Reeve를 제가 보내볼까요?', effects: { flag: 'chen_loyalty_test_passed' } },
      { id: 'ch7c_redirect', labelKo: 'Branch C: 다른 부서일 수 있어요. 보안팀 확인을.', effects: { flag: 'chen_loyalty_test_failed', branchSet: { modifierId: 'ch8_chen_surveillance', targetChapter: 'mcc_campaign_ch8' } } },
    ],
  },
  [CH8_ID]: {
    questId: CH8_ID,
    scenesFile: 'docs/campaign-story/mcc_ch8_red_parliament.json',
    campaignId: 'mcc_route',
    chapterNumber: 8,
    faction: 'mcc',
    title: { ko: '프로메테우스', en: 'Prometheus', ja: 'プロメテウス', zh: '普罗米修斯' },
    requiredLevel: 8,
    prerequisiteChapter: CH7_ID,
    requiredBranchAny: ['mcc_route_a_active', 'mcc_route_b_active', 'mcc_route_c_active'],
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 2160,
    location: { id: 'deimos_orbital_shipyard', displayNameKo: 'Deimos 궤도 조선소', displayNameEn: 'Deimos Orbital Shipyard', region: 'deimos_orbit' },
    environment: {
      type: 'ch8_environmental_sequence',
      totalDurationSeconds: 2160,
      phases: [
        { phase: 1, startSec: 0, endSec: 720, labelKo: '건조 초기', enemyWave: 1 },
        { phase: 2, startSec: 720, endSec: 1080, labelKo: 'Phobos 일식', opticalTracking: 'disabled', missileAdvantage: 20, enemyWave: 2 },
        { phase: 3, startSec: 1080, endSec: 1800, labelKo: '태양풍', nonArmoredHpDrainPerMin: -0.5, crewCasualtyBuildup: 5 },
        { phase: 4, startSec: 1800, endSec: 2160, labelKo: '이온 폭풍', fleetCommandMode: 'disabled', radarAccuracy: -60, empEffectBonus: 50, enemyWave: 3 },
      ],
    },
    briefing: {
      npcId: 'route_variant',
      npcName: 'Chen Weiss / Li Fang / Kara Vex',
      npcTitle: 'Ch6 루트 기반 Prometheus 작전',
      lines: [
        { id: 'ch8_common_01', ko: 'Deimos 조선소. 36시간짜리 환경 시퀀스가 시작된다.' },
        { id: 'ch8b_chen_01', ko: 'Branch B: Prometheus는 우리 결정타. 완공되면 3파벌 균형 깨져.' },
        { id: 'ch8c_chen_extra', ko: 'Branch C: ...당신, 최근 데이터 흐름이 좀 이상해. 다 끝나면 우리 얘기 좀 하자.' },
        { id: 'ch8a_li_01', ko: 'Branch A: Prometheus 파괴해야 해. 그게 건조되면 Chen은 신이 돼.' },
        { id: 'ch8a_kv_01', ko: 'Kara: 외부인. 그 빚 갚을 시간.' },
      ],
      radio: [
        { triggerSec: 720, ko: 'Phobos 일식 시작 — 광학 추적 일시 무효.' },
        { triggerSec: 1080, ko: '태양풍 진입 — 비장갑 함선 피해 누적.' },
        { triggerSec: 1800, ko: '이온 폭풍 — 함대 명령 차단.' },
      ],
    },
    choices: [
      { id: 'ch8b_standard', labelKo: 'Branch B: 정석 36시간 방어.', effects: {} },
      { id: 'ch8b_accelerate', labelKo: 'Branch B: 건조 24시간 가속.', effects: { flag: 'ch8_accelerated_construction' } },
      { id: 'ch8b_intel', labelKo: 'Branch B: 적 본대 위치 사전 정찰.', effects: { flag: 'ch8_wave3_intel' } },
      { id: 'ch8c_standard', labelKo: 'Branch C: 정석 방어, 의심 감수.', effects: {} },
      { id: 'ch8c_alibi', labelKo: 'Branch C: 데이터 흐름은 Marcus 부서 작업입니다.', effects: { flag: 'ch8_chen_alibi' } },
      { id: 'ch8c_partial_truth', labelKo: 'Branch C: 개인 분석이었습니다. Roth 데이터가 흥미로워서.', effects: { flag: 'ch8_partial_truth' } },
      { id: 'ch8a_kara_command', labelKo: 'Branch A: Kara, 당신 지휘 따르겠습니다.', effects: { flag: 'ch8_kara_command' } },
      { id: 'ch8a_distributed', labelKo: 'Branch A: 분산 공격. 셋이 각자.', effects: { flag: 'ch8_distributed_attack' } },
      { id: 'ch8a_chen_hunt', labelKo: 'Branch A: Kara, Chen이 Prometheus 안에 있을 가능성?', effects: { flag: 'ch8_chen_hunt' } },
    ],
  },
  [CH9_ID]: {
    questId: CH9_ID,
    scenesFile: 'docs/campaign-story/mcc_ch9_martian_night.json',
    campaignId: 'mcc_route',
    chapterNumber: 9,
    faction: 'mcc',
    title: { ko: '깨진 동맹', en: 'Broken Alliance', ja: '崩れた同盟', zh: '破碎的同盟' },
    requiredLevel: 9,
    prerequisiteChapter: CH8_ID,
    requiredBranchAny: ['mcc_route_a_active', 'mcc_route_b_active', 'mcc_route_c_active'],
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 2400,
    location: { id: 'mars_four_fronts', displayNameKo: '화성 4개 전장', displayNameEn: 'Mars Four Fronts', region: 'olympus_hellas_valles_kepler' },
    environment: {
      type: 'parallel_4_environments',
      totalDurationSeconds: 2400,
      battlefields: {
        olympus: { environment: 'olympus_geothermal', difficulty: 3 },
        hellas: { environment: 'night_freezing', difficulty: 5 },
        valles: { environment: 'ion_storm_active', difficulty: 4 },
        kepler: { environment: 'low_gravity_pocket', difficulty: 5 },
      },
    },
    briefing: {
      npcId: 'route_variant',
      npcName: 'Chen Weiss / Amara Okafor / Kara Vex',
      npcTitle: '4전장 전쟁 회의',
      lines: [
        { id: 'ch9bc_chen_01', ko: 'Branch B/C: 이건 전쟁이야. 공식 전쟁. 당신이 직접 지휘할 곳을 골라.' },
        { id: 'ch9a_am_01', ko: 'Branch A: Chen 방어선 중 가장 약한 지점이 Kepler. 거기 당신이 지휘.' },
        { id: 'ch9a_kv_01', ko: 'Kara: Olympus에 내 동생이 있어. 따로 부탁이야.' },
        { id: 'ch9_pa_alert', ko: '미식별 함선 24척 진입. 함체 마크: PA-3, PA-7, PA-12.' },
      ],
      radio: [
        { triggerSec: 1200, ko: 'Pilgrim Arms 4번째 파벌 확인. 모든 전장 혼전.' },
      ],
    },
    choices: [
      { id: 'ch9_lead_olympus', labelKo: 'Branch B/C: Olympus 지휘 (홈).', effects: { flag: 'ch9_chose_olympus' } },
      { id: 'ch9_lead_hellas_kill_amara', labelKo: 'Branch B/C: Hellas 지휘 — Amara 사살.', effects: { flag: 'ch9_chose_hellas', flag2: 'amara_dead' } },
      { id: 'ch9_lead_hellas_capture_amara', labelKo: 'Branch B/C: Hellas 지휘 — Amara 생포.', effects: { flag: 'ch9_chose_hellas', flag2: 'amara_captured' } },
      { id: 'ch9_lead_valles_kill_butcher', labelKo: 'Branch B/C: Valles 지휘 — Butcher 사살.', effects: { flag: 'ch9_chose_valles', flag2: 'butcher_dead' } },
      { id: 'ch9_lead_valles_let_butcher_flee', labelKo: 'Branch B/C: Valles 지휘 — Butcher 도주 허용.', effects: { flag: 'ch9_chose_valles', flag2: 'butcher_escaped' } },
      { id: 'ch9_lead_kepler', labelKo: 'Branch B/C: Kepler 지휘 — Roth 데이터 영구 확보.', effects: { flag: 'ch9_chose_kepler' } },
      { id: 'ch9a_kepler_only', labelKo: 'Branch A: Kepler 지휘 (Amara 명령).', effects: { flag: 'ch9_chose_kepler', flag2: 'chen_weiss_at_kepler' } },
      { id: 'ch9a_chen_face_to_face', labelKo: 'Branch A: Kepler에서 Chen 직접 조우.', effects: { flag: 'chen_weiss_at_kepler' } },
    ],
  },
  [CH10_ID]: {
    questId: CH10_ID,
    scenesFile: 'docs/campaign-story/mcc_ch10_the_choice.json',
    campaignId: 'mcc_route',
    chapterNumber: 10,
    faction: 'mcc',
    title: { ko: '주주 엔딩', en: 'Shareholder Ending', ja: '株主エンディング', zh: '股东结局' },
    requiredLevel: 10,
    prerequisiteChapter: CH9_ID,
    battleResolution: 'cinematic_only',
    estimatedPlayTimeSeconds: 900,
    location: { id: 'olympus_shareholder7_lounge', displayNameKo: 'Shareholder-7 라운지', displayNameEn: 'Shareholder-7 Lounge', region: 'olympus_orbit' },
    environment: { type: 'cinematic', noCombat: true, phases: [{ phase: 0, startSec: 0 }] },
    briefing: {
      npcId: 'chen_weiss',
      npcName: 'Chen Weiss / Li Fang / Pilgrim Arms',
      npcTitle: 'MCC 루트 최종 선택',
      lines: [
        { id: 'end_intro_01', ko: '화성에서 가장 따뜻한 방으로 돌아왔다. 이번에는 당신의 선택이 마지막 문을 연다.' },
        { id: 'end1_chen_01', ko: '당신은 이 회사에서 가장 안전한 자리를 얻었어. 내 주머니 안.' },
        { id: 'end2_player_02', ko: 'Roth 데이터 사본을 갖고 있습니다. 시장에 풀리면 어떻게 될까요?' },
        { id: 'end3_lifang_final', ko: '그게 이긴 거야. 의심하는 자만이 다음 회사를 만들지 않아.' },
        { id: 'end4_chen_final', ko: '당신은 나보다 더 나빠질 수 있어. 축하해.' },
      ],
      radio: [],
    },
    choices: [
      { id: 'ending_1_loyal_hire', labelKo: 'Ending 1: The Loyal Hire.', effects: { flag: 'chose_ending_1' } },
      { id: 'ending_2_executive', labelKo: 'Ending 2: The Executive.', effects: { flag: 'chose_ending_2' } },
      { id: 'ending_3_whistleblower', labelKo: 'Ending 3: The Whistleblower.', effects: { flag: 'chose_ending_3' } },
      { id: 'ending_4_traitor', labelKo: 'Ending 4: The Traitor.', effects: { flag: 'chose_ending_4' } },
      { id: 'bad_ending_dismissed', labelKo: 'Bad Ending: Forgotten Freelancer.', effects: { flag: 'chose_bad_ending' } },
    ],
  },
  [FSP_CH1_ID]: {
    questId: FSP_CH1_ID,
    scenesFile: 'docs/campaign-story/fsp_ch1_breakwater.json',
    campaignId: 'fsp_route',
    chapterNumber: 1,
    faction: 'fsp',
    title: { ko: '차의 무게', en: 'The Weight of Tea', ja: 'お茶の重さ', zh: '茶的重量' },
    requiredLevel: 1,
    prerequisiteChapter: 'fsp_prologue',
    requiredReputation: { fsp: 0 },
    blockingTags: ['war_criminal'],
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 900,
    location: { id: 'new_athens_settlement', displayNameKo: 'New Athens 정착지', displayNameEn: 'New Athens Settlement', region: 'hellas_basin', altitudeKm: -7 },
    environment: {
      type: 'dust_storm_recovery',
      secondary: 'night_freezing',
      totalDurationSeconds: 900,
      phases: [
        { phase: 0, startSec: 0, opticalMod: -15, freezeDrain: 0 },
        { phase: 1, startSec: 300, opticalMod: -15, freezeDrain: 0 },
        { phase: 2, startSec: 600, opticalMod: -10, freezeDrain: 0.5 },
        { phase: 3, startSec: 900, opticalMod: -5, freezeDrain: 1.0 },
      ],
      weaponsUnaffected: ['railgun'],
    },
    briefing: {
      npcId: 'mikhail_anders',
      npcName: 'Mikhail Anders / Lena Torres / Yuna Kim',
      npcTitle: 'New Athens 격납고 · 차 두 잔',
      lines: [
        { id: 'fsp_ch1_mishka_01', ko: '왔구나. 추워? 미안. 풍력 두 개 박살나서 격납고 30%만 가동.' },
        { id: 'fsp_ch1_mishka_02', ko: '차 들어. 이게 진짜 차야. 지구에서 가져온 씨앗으로 키운 거.' },
        { id: 'fsp_ch1_mishka_04', ko: 'Amara가 당신 추천했어. 그녀 추천이면 우리도 받지. 근데 분명히 해. 우리 단가 35%.' },
        { id: 'fsp_ch1_mishka_05', ko: 'CV 약탈단이 H2O 호송선을 매주 털어. 새벽 03시 출발.' },
        { id: 'fsp_ch1_mishka_07', ko: '호송선 한 대에 응급 환자 둘. 늦으면 죽어.' },
      ],
      radio: [
        { triggerSec: 300, ko: 'Lena: CV 1파고 진입! 좌현!' },
        { triggerSec: 600, ko: 'Yuna: 환자 골든 타임 6분 남음.' },
        { triggerSec: 750, ko: 'Mikhail: 외부 동결 시작. 함선 차폐 점검.' },
      ],
    },
    choices: [
      { id: 'fsp_ch1_accept_standard', labelKo: '받겠습니다. 단가 그대로.', effects: { reputationDelta: { fsp: 10 }, flag: 'tea_ceremony_completed' } },
      { id: 'fsp_ch1_negotiate_price', labelKo: '단가 협상 가능합니까?', effects: { reputationDelta: { fsp: -2 }, flag: 'tried_to_negotiate' } },
      { id: 'fsp_ch1_question_mcc', labelKo: '왜 MCC에 도움 요청 안 합니까?', effects: { reputationDelta: { fsp: 5 }, flag: 'heard_mikhail_backstory', flag2: 'mikhail_oxygen_mask_revealed' } },
      { id: 'fsp_ch1_prioritize_patients', labelKo: '응급 환자가 우선 아닙니까? 환자만이라도 빠른 함선으로?', effects: { reputationDelta: { fsp: 15 }, flag: 'civilian_minded', simulationModifier: { missionSplit: true, timePressure: -0.2 } } },
    ],
  },
  [FSP_CH2_ID]: {
    questId: FSP_CH2_ID,
    scenesFile: 'docs/campaign-story/fsp_ch2_ice_caravan.json',
    campaignId: 'fsp_route',
    chapterNumber: 2,
    faction: 'fsp',
    title: { ko: '얼음 캐러밴', en: 'The Ice Caravan', ja: '氷のキャラバン', zh: '冰雪商队' },
    requiredLevel: 2,
    prerequisiteChapter: FSP_CH1_ID,
    requiredReputation: { fsp: 15 },
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1800,
    location: { id: 'north_pole_to_new_athens', displayNameKo: '북극관 → New Athens 항로', displayNameEn: 'North Pole → New Athens Route', region: 'north_pole_to_hellas' },
    environment: {
      type: 'solar_exposure_active',
      secondary: 'phobos_eclipse_periodic',
      totalDurationSeconds: 1800,
      phases: [
        { phase: 0, startSec: 0, iceLossPerHour: 0 },
        { phase: 1, startSec: 720, iceLossPerHour: 1 },
        { phase: 2, startSec: 900, iceLossPerHour: 3 },
        { phase: 3, startSec: 1080, iceLossPerHour: 8 },
      ],
    },
    briefing: {
      npcId: 'mikhail_anders',
      npcName: 'Mikhail Anders / Lena Torres / Sal Cruz',
      npcTitle: '북극관 얼음 호송 브리핑',
      lines: [
        { id: 'fsp_ch2_brief_01', ko: '지난주 호송 잘 끝나서 다음 큰 임무야.' },
        { id: 'fsp_ch2_brief_03', ko: '북극관에서 얼음 800 kT. 운반선 6대.' },
        { id: 'fsp_ch2_brief_04', ko: '운반선 단열 약해. 18시간 이상 태양광 노출되면 30% 녹아.' },
        { id: 'fsp_ch2_lena_01', ko: '오 외부인 보스 또 왔네! 이번엔 얼음?' },
        { id: 'fsp_ch2_sal_01', ko: 'Sal Cruz: FSP 얼음? 우리 마을도 물 없어. 내려놓고 가.' },
      ],
      radio: [
        { triggerSec: 720, ko: 'Lena: 적도. CV 함대 9시 방향 매복 진입!' },
      ],
    },
    choices: [
      { id: 'fsp_ch2_lena_command', labelKo: 'Lena, 함께. 정찰 부탁.', effects: { flag: 'lena_collaboration_full' } },
      { id: 'fsp_ch2_split_convoy', labelKo: '운반선 6대를 두 그룹으로?', effects: { flag: 'convoy_split' } },
      { id: 'fsp_ch2_request_mcc_ships', labelKo: 'MCC 단열선 빌릴 곳? 중고품?', effects: { reputationDelta: { fsp: -3 }, flag: 'tried_mcc_route' } },
      { id: 'fsp_ch2_question_storm', labelKo: 'Lena, 폭풍 좋아해? 어머니가 폭풍에서...', effects: { reputationDelta: { fsp: 5 }, flag: 'heard_lena_mother_story', flag2: 'lena_mother_revealed' } },
    ],
  },
  [FSP_CH3_ID]: {
    questId: FSP_CH3_ID,
    scenesFile: 'docs/campaign-story/fsp_ch3_blood_mine.json',
    campaignId: 'fsp_route',
    chapterNumber: 3,
    faction: 'fsp',
    title: { ko: '피의 광산', en: 'Blood Mine', ja: '血の鉱山', zh: '血矿' },
    requiredLevel: 3,
    prerequisiteChapter: FSP_CH2_ID,
    requiredReputation: { fsp: 25 },
    blockingTags: ['war_criminal'],
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1800,
    location: { id: 'verin7_mining_complex', displayNameKo: 'Verin-7 광산', displayNameEn: 'Verin-7 Mine', region: 'olympus_4th_ridge', altitudeKm: 8 },
    environment: {
      type: 'high_altitude_thin_air',
      secondary: 'olympus_geothermal',
      totalDurationSeconds: 1800,
      phases: [{ phase: 0, startSec: 0, breathingLoad: 20, crewEfficiency: -5, railgunAccuracy: -10, missileEfficiency: 5 }],
    },
    briefing: {
      npcId: 'samuel_torres',
      npcName: 'Samuel Torres / Amara Okafor',
      npcTitle: 'Verin-7 산소 조절기 해방 작전',
      lines: [
        { id: 'fsp_ch3_sam_01', ko: 'Verin-7 광산에서 노동자 412명 사실상 노예. 부채 노예.' },
        { id: 'fsp_ch3_sam_04', ko: 'MCC가 산소 조절기로 사람들을 통제. 빚 못 갚는 광부 산소 배급 줄어.' },
        { id: 'fsp_ch3_amara_01', ko: 'Samuel. 이건 우리 권한 밖이야. MCC 자산 침공은 전쟁이야.' },
        { id: 'fsp_ch3_miners_60', ko: '광부 60명: 우리는 안 가. 여기 가족 묻혀 있어요.' },
      ],
      radio: [
        { triggerSec: 900, ko: '산소 조절기 5개 동시 무력화 금지. 알람 뜬다.' },
      ],
    },
    choices: [
      { id: 'fsp_ch3_solo_op', labelKo: '제가 단독 작전. FSP 책임은 면합니다.', effects: { reputationDelta: { mcc: -25 }, flag: 'solo_op_chosen' } },
      { id: 'fsp_ch3_official_op', labelKo: '공식 작전. 책임은 같이.', effects: { reputationDelta: { mcc: -40, fsp: 20 }, flag: 'official_op_chosen', flag2: 'amara_approves' } },
      { id: 'fsp_ch3_question_intel', labelKo: '광부들이 정말 나오고 싶어할까요? 의사 확인.', effects: { reputationDelta: { fsp: 5 }, flag: 'requested_intel', flag2: 'samuel_cousin_inside' } },
      { id: 'fsp_ch3_diplomatic_attempt', labelKo: 'MCC와 협상 안 됩니까? 광부 빚 대신 갚는 식?', effects: { reputationDelta: { fsp: 3 }, flag: 'tried_diplomacy', flag2: 'mcc_diplomacy_history_revealed' } },
    ],
  },
  [FSP_CH4_ID]: {
    questId: FSP_CH4_ID,
    scenesFile: 'docs/campaign-story/fsp_ch4_diplomacy.json',
    campaignId: 'fsp_route',
    chapterNumber: 4,
    faction: 'fsp',
    title: { ko: '외교', en: 'Diplomacy', ja: '外交', zh: '外交' },
    requiredLevel: 4,
    prerequisiteChapter: FSP_CH3_ID,
    requiredReputation: { fsp: 25 },
    blockingTags: ['war_criminal'],
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1500,
    location: { id: 'sandstone_junction', displayNameKo: 'Sandstone Junction 지하 3레벨', displayNameEn: 'Sandstone Junction Underground Level 3', region: 'equatorial_belt', altitudeKm: 1.2 },
    environment: {
      type: 'subterranean_dust',
      secondary: 'equatorial_phobos_pattern',
      totalDurationSeconds: 1500,
      phases: [
        { phase: 0, startSec: 0, opticalMod: -50, commRange: -80, detectionModifier: -40 },
        { phase: 1, startSec: 600, opticalMod: -50, commRange: -80, detectionModifier: -40 },
        { phase: 2, startSec: 1200, opticalMod: -50, commRange: -80, detectionModifier: -40 },
      ],
      weaponsUnaffected: ['point_defense'],
      mccReconWindow: { baseArrivalSec: 1080, arrivalJitter: 180 },
    },
    briefing: {
      npcId: 'amara_okafor',
      npcName: 'Amara Okafor / Cinder Grace / Lena Torres',
      npcTitle: 'Sandstone Junction 비밀 회담',
      lines: [
        { id: 'fsp_ch4_amara_01', ko: 'Cinder Grace. CV 4위 군벌. 광산 출신이야 — 우리랑 비슷한 출신.' },
        { id: 'fsp_ch4_amara_03', ko: '장소: Sandstone Junction 지하 3레벨. MCC는 18분 안에 정찰 와.' },
        { id: 'fsp_ch4_cinder_01', ko: 'FSP 외교관. 시간 됐어. 30분 줄게. 더는 안 줘.' },
        { id: 'fsp_ch4_cinder_03', ko: 'The Butcher는 곧 미친 짓 할 거야. MCC가 그걸 빌미로 화성 전체 군사화해.' },
        { id: 'fsp_ch4_amara_offer_01', ko: '우리가 줄 수 있는 건 세 가지야. 어느 걸 원해?' },
      ],
      radio: [
        { triggerSec: 600, ko: 'Lena: 외부 모래 상태 변화. 누군가 지나간 흔적.' },
        { triggerSec: 900, ko: 'Lena: MCC 위성 신호 잡혔어. 9분 남았어.' },
        { triggerSec: 1080, ko: 'Lena: 정찰선 도착. 구축함 1, 프리깃 2.' },
      ],
    },
    choices: [
      { id: 'fsp_ch4_offer_settlement_refuge', labelKo: '정착지 임시 피난소 제공.', effects: { reputationDelta: { fsp: -3, cv: 15 }, flag: 'pact_settlement_refuge_offered', flag2: 'cinder_grace_alliance_strong', branchSet: { modifierId: 'fsp_cv_truce_active', targetChapter: 'fsp_campaign_ch5' } } },
      { id: 'fsp_ch4_offer_supply_share', labelKo: '보급 공유 (월 식량 5%, 의약품 10%).', effects: { reputationDelta: { fsp: -1, cv: 10 }, flag: 'pact_supply_share_offered', flag2: 'cinder_grace_alliance_modest', branchSet: { modifierId: 'fsp_cv_truce_modest', targetChapter: 'fsp_campaign_ch5' } } },
      { id: 'fsp_ch4_propose_intel_exchange', labelKo: 'MCC 정보 교환만.', effects: { reputationDelta: { cv: 5 }, flag: 'pact_intel_exchange_only', flag2: 'cinder_grace_alliance_weak', branchSet: { modifierId: 'bonus_mcc_intel', targetChapter: 'fsp_campaign_ch6' } } },
      { id: 'fsp_ch4_evidence_share', labelKo: '[조건부] Helion 산소 노예제 증거 공유.', effects: { reputationDelta: { cv: 25 }, flag: 'pact_evidence_shared_with_cv', flag2: 'cinder_grace_alliance_blood_oath', branchSet: { modifierId: 'cv_active_alliance', targetChapter: 'fsp_campaign_ch5' } } },
      { id: 'fsp_ch4_walk_away', labelKo: '협상 중단.', effects: { reputationDelta: { fsp: -5, cv: -15 }, flag: 'negotiation_walked_away', flag2: 'cinder_grace_alliance_failed', branchSet: { modifierId: 'cinder_warlord_hostile', targetChapter: 'fsp_campaign_ch5' } } },
    ],
  },
  [FSP_CH5_ID]: {
    questId: FSP_CH5_ID,
    scenesFile: 'docs/campaign-story/fsp_ch5_kepler_commons.json',
    campaignId: 'fsp_route',
    chapterNumber: 5,
    faction: 'fsp',
    title: { ko: 'Kepler 공유지', en: 'Kepler Commons', ja: 'ケプラー共有地', zh: '开普勒公地' },
    requiredLevel: 5,
    prerequisiteChapter: FSP_CH4_ID,
    requiredReputation: { fsp: 35 },
    blockingTags: ['war_criminal'],
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1800,
    location: { id: 'kepler_crater', displayNameKo: 'Kepler 분화구 회담장', displayNameEn: 'Kepler Crater Conference Hall', region: 'arabia_terra', altitudeKm: -3 },
    environment: {
      type: 'low_gravity_crater',
      secondary: 'oxygen_supply_critical',
      totalDurationSeconds: 1800,
      phases: [
        { phase: 0, startSec: 0, gravityMod: -0.3, oxygenReserveHours: 24 },
        { phase: 1, startSec: 600, gravityMod: -0.3, oxygenReserveHours: 22 },
        { phase: 2, startSec: 1200, gravityMod: -0.3, oxygenReserveHours: 18 },
        { phase: 3, startSec: 1800, gravityMod: -0.3, oxygenReserveHours: 15 },
      ],
      weaponsUnaffected: ['missile', 'point_defense'],
      weaponsAffected: { laser: -10, railgun: 15 },
    },
    briefing: {
      npcId: 'liang_wei',
      npcName: 'Amara Okafor / Liang Wei / Li Fang',
      npcTitle: 'Kepler Commons 3파벌 회담',
      lines: [
        { id: 'fsp_ch5_amara_01', ko: 'MCC는 Li Fang이 와. CV는 Ch4에서 네가 만든 관계에 따라 달라져.' },
        { id: 'fsp_ch5_amara_02', ko: '산소 보급선이 30분 후 도착해야 해. 회담은 그 안에 끝나야.' },
        { id: 'fsp_ch5_liang_03', ko: '광산은 누구의 것도 아닙니다. 그 안에 있는 것이 문제일 뿐.' },
        { id: 'fsp_ch5_liang_04', ko: 'Roth 박사에게서 사후 메시지가 왔습니다. 마지막으로 본 사람은 Li Fang.' },
      ],
      radio: [
        { triggerSec: 600, ko: 'Lena: 보급선 12분 후 도착 예정.' },
        { triggerSec: 1200, ko: 'Yuna: 회담장 산소 농도 18%. 인지 능력 저하 시작.' },
        { triggerSec: 1500, ko: 'Amara: 5분 남았어. 결단할 시간이야.' },
      ],
    },
    choices: [
      { id: 'fsp_ch5_propose_commons', labelKo: 'Liang의 Commons 제안 지지.', effects: { reputationDelta: { fsp: 15, mcc: -5, cv: 5 }, flag: 'ch5_commons_proposed', flag2: 'liang_wei_legitimized', branchSet: { modifierId: 'commons_legitimacy_diplomatic', targetChapter: 'fsp_campaign_ch9' } } },
      { id: 'fsp_ch5_propose_fsp_arbitration', labelKo: 'FSP 중립 중재자 제안.', effects: { reputationDelta: { fsp: 5, mcc: 10, cv: 10 }, flag: 'ch5_arbitration_proposed', flag2: 'fsp_neutral_arbiter_recognized', branchSet: { modifierId: 'fsp_neutral_arbiter', targetChapter: 'fsp_campaign_ch9' } } },
      { id: 'fsp_ch5_propose_evidence_lever', labelKo: '[조건부] Roth 데이터로 MCC 압박.', effects: { reputationDelta: { mcc: -30, cv: 15 }, flag: 'ch5_evidence_lever_used', flag2: 'ancient_metal_origin_disclosed', branchSet: { modifierId: 'mcc_revenge_priority', targetChapter: 'fsp_campaign_ch9' } } },
      { id: 'fsp_ch5_force_combat', labelKo: '회담 결렬 + 전투 우위 확보.', effects: { reputationDelta: { fsp: -10, mcc: -20 }, flag: 'ch5_combat_forced_by_fsp', flag2: 'kepler_militarily_held', branchSet: { modifierId: 'mcc_full_offensive', targetChapter: 'fsp_campaign_ch9' } } },
      { id: 'fsp_ch5_propose_global_disclosure', labelKo: '[조건부] 외계 기원 즉시 공개.', effects: { reputationDelta: { fsp: 5, mcc: -50, cv: -20 }, flag: 'ch5_global_disclosure', flag2: 'alien_metal_publicly_known', branchSet: { modifierId: 'martian_world_state_changed', targetChapter: 'fsp_campaign_ch9' } } },
    ],
  },
  [FSP_CH6_ID]: {
    questId: FSP_CH6_ID,
    scenesFile: 'docs/campaign-story/fsp_ch6_the_mole.json',
    campaignId: 'fsp_route',
    chapterNumber: 6,
    faction: 'fsp',
    title: { ko: '두더지', en: 'The Mole', ja: 'もぐら', zh: '内鬼' },
    requiredLevel: 6,
    prerequisiteChapter: FSP_CH5_ID,
    requiredReputation: { fsp: 45 },
    blockingTags: ['war_criminal'],
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1800,
    location: { id: 'hellas_central_settlement', displayNameKo: 'Hellas Central 정착지', displayNameEn: 'Hellas Central Settlement', region: 'hellas_basin', altitudeKm: -7 },
    environment: {
      type: 'settlement_interior',
      secondary: 'time_pressure_attack',
      totalDurationSeconds: 1800,
      phases: [
        { phase: 0, startSec: 0, civilianPanic: 0 },
        { phase: 1, startSec: 600, civilianPanic: 20 },
        { phase: 2, startSec: 1200, civilianPanic: 40 },
        { phase: 3, startSec: 1800, civilianPanic: 60 },
      ],
      noCombatZone: true,
      attackWindow: { baseArrivalSec: 1800, arrivalJitter: 600 },
    },
    briefing: {
      npcId: 'amara_okafor',
      npcName: 'Amara Okafor / Liang Wei / Kenji Tanaka',
      npcTitle: 'Hellas Central 내부 누출 조사',
      lines: [
        { id: 'fsp_ch6_amara_01', ko: 'Kepler 이후 MCC가 우리 다음 작전을 알아냈어. 누군가 내부에서 흘렸어.' },
        { id: 'fsp_ch6_amara_03', ko: '용의자는 셋. Kenji Tanaka, Sarah Mendel, Diego Cole.' },
        { id: 'fsp_ch6_kenji_04', ko: 'Kenji의 가족은 MCC 영토에 인질로 잡혀 있다.' },
        { id: 'fsp_ch6_decision_02', ko: '처형, 이중첩자, 추방. 셋 중 하나. 영구입니다.' },
      ],
      radio: [
        { triggerSec: 600, ko: 'Lena: 발전소 정전 로그 확인. 5분 정확히 비었어.' },
        { triggerSec: 1200, ko: 'Liang: 통신 패턴이 Kenji 쪽으로 모입니다.' },
        { triggerSec: 1500, ko: 'Amara: 결정할 시간이야. MCC 공격까지 얼마 안 남았어.' },
      ],
    },
    choices: [
      { id: 'fsp_ch6_execute_kenji', labelKo: '처형.', effects: { reputationDelta: { fsp: -8, mcc: -15 }, flag: 'ch6_kenji_executed', flag2: 'spy_executed_publicly', tagsAdded: ['coercive_executor'], branchSet: { modifierId: 'assembly_fearful_atmosphere', targetChapter: 'fsp_campaign_ch7' }, extraBranchSet: { modifierId: 'kenji_family_killed_in_retaliation', targetChapter: 'fsp_campaign_ch9' } } },
      { id: 'fsp_ch6_use_as_handler', labelKo: '이중첩자 활용.', effects: { reputationDelta: { fsp: 5, mcc: -25 }, flag: 'ch6_kenji_handler', flag2: 'spy_double_agent_active', tagsAdded: ['the_handler'], branchSet: { modifierId: 'kenji_intelligence_pipeline', targetChapter: 'fsp_campaign_ch7' }, extraBranchSet: { modifierId: 'kenji_family_rescue_attempt', targetChapter: 'fsp_campaign_ch9' } } },
      { id: 'fsp_ch6_exile_kenji', labelKo: '추방.', effects: { reputationDelta: { mcc: -10 }, flag: 'ch6_kenji_exiled', flag2: 'spy_exiled_mercifully', tagsAdded: ['the_merciful'], branchSet: { modifierId: 'assembly_humanitarian_signal', targetChapter: 'fsp_campaign_ch7' }, extraBranchSet: { modifierId: 'no_intel_advantage', targetChapter: 'fsp_campaign_ch9' } } },
      { id: 'fsp_ch6_accuse_wrong', labelKo: '[조건부] 다른 인물 지목.', effects: { reputationDelta: { fsp: -25 }, flag: 'ch6_wrong_culprit_accused', flag2: 'innocent_punished', tagsAdded: ['paranoid_judge'], branchSet: { modifierId: 'assembly_loss_of_trust', targetChapter: 'fsp_campaign_ch7' }, extraBranchSet: { modifierId: 'real_spy_continues_leaks', targetChapter: 'fsp_campaign_ch9' } } },
    ],
  },
  [FSP_CH7_ID]: {
    questId: FSP_CH7_ID,
    scenesFile: 'docs/campaign-story/fsp_ch7_assembly.json',
    campaignId: 'fsp_route',
    chapterNumber: 7,
    faction: 'fsp',
    title: { ko: '의회', en: 'Assembly', ja: '議会', zh: '议会' },
    requiredLevel: 7,
    prerequisiteChapter: FSP_CH6_ID,
    requiredReputation: { fsp: 50 },
    blockingTags: ['war_criminal'],
    battleResolution: 'political_dual_track',
    estimatedPlayTimeSeconds: 1800,
    location: { id: 'hellas_central_settlement', displayNameKo: 'Hellas Central 정착지 (의회 회기)', displayNameEn: 'Hellas Central Settlement (Assembly)', region: 'hellas_basin', altitudeKm: -7 },
    environment: {
      type: 'assembly_session',
      secondary: 'dynamic_crisis',
      totalDurationSeconds: 1800,
      phases: [
        { phase: 0, startSec: 0, sessionPhase: 'opening' },
        { phase: 1, startSec: 600, sessionPhase: 'floor_debate' },
        { phase: 2, startSec: 1200, sessionPhase: 'coalition' },
        { phase: 3, startSec: 1500, sessionPhase: 'vote_call' },
        { phase: 4, startSec: 1800, sessionPhase: 'deadline' },
      ],
      noCombatZone: true,
    },
    briefing: {
      npcId: 'amara_okafor',
      npcName: 'Amara Okafor / Liang Wei / Mikhail Anders',
      npcTitle: 'Hellas Central 의회당',
      lines: [
        { id: 'fsp_ch7_open_01', ko: '회기를 개시합니다. 영구 의장 선출. Kepler 회담 결과를 받아들이는 첫 의회입니다.' },
        { id: 'fsp_ch7_open_02', ko: '후보 발언, 토론, 연합 구성, 그리고 투표. 동시에 외곽 위기도 처리해야 합니다.' },
        { id: 'fsp_ch7_open_03', ko: '의장직은 누구의 것도 아닙니다. 시민 모두의 것입니다.' },
      ],
      radio: [
        { triggerSec: 600, ko: 'Lena: 외곽 방어와 발전소 복구 요청이 동시에 들어왔어.' },
        { triggerSec: 1200, ko: '의회: 연합 구성 시간입니다. 표를 모아야 합니다.' },
        { triggerSec: 1500, ko: '의회: 투표 호출. 마지막 발언입니다.' },
      ],
    },
    choices: [
      { id: 'fsp_ch7_support_mikhail', labelKo: 'Mikhail Anders를 실용 의장으로 지지.', effects: { reputationDelta: { fsp: 5 }, flag: 'ch7_supported_mikhail' } },
      { id: 'fsp_ch7_support_liang', labelKo: 'Liang Wei의 Commons 비전을 지지.', effects: { reputationDelta: { fsp: 8 }, flag: 'ch7_supported_liang' } },
      { id: 'fsp_ch7_support_amara', labelKo: 'Amara Okafor의 외교 노선을 지지.', effects: { reputationDelta: { fsp: 6, cv: 5 }, flag: 'ch7_supported_amara' } },
      { id: 'fsp_ch7_support_diego', labelKo: 'Diego Cole의 행정 안정 노선을 지지.', effects: { reputationDelta: { fsp: 3 }, flag: 'ch7_supported_diego' } },
      { id: 'fsp_ch7_run_for_chair', labelKo: '[조건부] 직접 의장 출마.', effects: { reputationDelta: { fsp: -5, mcc: 5 }, flag: 'outsider_chair_aspirant', tagsAdded: ['outsider_chair_aspirant'] } },
    ],
  },
  [FSP_CH8_ID]: {
    questId: FSP_CH8_ID,
    scenesFile: 'docs/campaign-story/fsp_ch8_water_war.json',
    campaignId: 'fsp_route',
    chapterNumber: 8,
    faction: 'fsp',
    title: { ko: '가이아', en: 'Gaia', ja: 'ガイア', zh: '盖亚' },
    requiredLevel: 8,
    prerequisiteChapter: FSP_CH7_ID,
    requiredReputation: { fsp: 50 },
    blockingTags: ['war_criminal'],
    battleResolution: 'triphase_construction_defense',
    estimatedPlayTimeSeconds: 1800,
    location: { id: 'new_athens_shipyard', displayNameKo: 'New Athens 조선소 (Gaia 건조 부지)', displayNameEn: 'New Athens Shipyard (Gaia Construction Site)', region: 'hellas_basin' },
    environment: {
      type: 'civilian_donation_drive',
      secondary: 'shipyard_wave_defense',
      totalDurationSeconds: 1800,
      phases: [
        { phase: 0, startSec: 0, construction: 0 },
        { phase: 1, startSec: 600, construction: 30 },
        { phase: 2, startSec: 1200, construction: 60 },
        { phase: 3, startSec: 1500, construction: 90 },
      ],
    },
    briefing: {
      npcId: 'mikhail_anders',
      npcName: 'Mikhail Anders / Hagar Watanabe / Lena Torres',
      npcTitle: 'Gaia 시민 기부 호소',
      lines: [
        { id: 'fsp_ch8_appeal_01', ko: '오늘 부탁할 게 있어. 우리는 Gaia를 만들어. 36시간 후 출항. 우리에게 12만 크레딧이 부족해.' },
        { id: 'fsp_ch8_appeal_02', ko: '시민은 결혼식을 미루고, 식량을 줄이고, 보석 상자까지 내놓고 있어. 부끄럽지만 자랑스러운 방식이야.' },
        { id: 'fsp_ch8_hagar_01', ko: '30년 차 조선공이 처음으로 외부인에게 함선 이름을 부탁하게 될지도 몰라.' },
      ],
      radio: [
        { triggerSec: 600, ko: 'Lena: 첫 wave. MCC 정찰 3척.' },
        { triggerSec: 1200, ko: 'Lena: 두 번째 wave. 좌우 포대 선택해야 해.' },
        { triggerSec: 1500, ko: 'Hagar: Gaia 90%. 5분만 더 버텨.' },
      ],
    },
    choices: [
      { id: 'fsp_ch8_donate_personal_50k', labelKo: '자비 부담 (50,000 Cr 기부).', effects: { reputationDelta: { fsp: 50 }, flag: 'ch8_player_donated_personal', tagsAdded: ['fsp_brotherhood', 'the_humble_giver'] } },
      { id: 'fsp_ch8_pledge_combat', labelKo: '전투로 갚겠습니다.', effects: { reputationDelta: { fsp: 25 }, flag: 'ch8_player_pledged_combat', tagsAdded: ['the_combat_pledger'] } },
      { id: 'fsp_ch8_silent_no_help', labelKo: '침묵한다.', effects: { reputationDelta: { fsp: -10 }, flag: 'ch8_player_silent', flag2: 'civilian_silent_disappointment', tagsAdded: ['the_silent_one', 'the_disengaged'] } },
      { id: 'fsp_ch8_steal_mcc_funds', labelKo: 'MCC 자금을 훔쳐오겠습니다.', effects: { reputationDelta: { fsp: 15, mcc: -30 }, flag: 'ch8_player_chose_theft', tagsAdded: ['the_thief_with_purpose'] } },
    ],
  },
  [FSP_CH9_ID]: {
    questId: FSP_CH9_ID,
    scenesFile: 'docs/campaign-story/fsp_ch9_last_harvest.json',
    campaignId: 'fsp_route',
    chapterNumber: 9,
    faction: 'fsp',
    title: { ko: '세 개의 깃발', en: 'Three Flags', ja: '三つの旗', zh: '三面旗' },
    requiredLevel: 9,
    prerequisiteChapter: FSP_CH8_ID,
    requiredReputation: { fsp: 50 },
    blockingTags: ['war_criminal'],
    battleResolution: 'summit_assault_choice',
    estimatedPlayTimeSeconds: 1800,
    location: { id: 'olympus_neutral_summit', displayNameKo: 'Olympus Mons 산자락 중립 회담장', displayNameEn: 'Olympus Mons Foothills Neutral Summit', region: 'olympus_mons' },
    environment: { type: 'neutral_summit', secondary: 'pilgrim_arms_assault', totalDurationSeconds: 1800, phases: [{ phase: 0, startSec: 0 }, { phase: 1, startSec: 900 }, { phase: 2, startSec: 1500 }] },
    briefing: {
      npcId: 'father_hale',
      npcName: 'Father Hale / Amara / Chen / Butcher',
      npcTitle: 'Three Flags 정상회담',
      lines: [
        { id: 'fsp_ch9_hale_01', ko: '30년 만에 너희 셋이 한 방에 있어. 오늘 의제는 Commons, 휴전, Roth 데이터 공동 연구.' },
        { id: 'fsp_ch9_chen_01', ko: 'Kepler 자원은 MCC 우선권. 협상이 아니라 사실입니다.' },
        { id: 'fsp_ch9_warning_01', ko: '외곽에서 Pilgrim Arms 표식 무장 4명 침입. 5분 안에 회담장.' },
      ],
      radio: [
        { triggerSec: 900, ko: 'Hale: 보호 대상을 선택해야 합니다.' },
        { triggerSec: 1500, ko: 'Lena: 암살자들이 빠져나가려 해.' },
      ],
    },
    choices: [
      { id: 'fsp_ch9_protect_amara', labelKo: 'Amara를 보호한다.', effects: { reputationDelta: { fsp: 50, mcc: -20 }, flag: 'ch9_amara_protected', tagsAdded: ['the_loyal_protector'] } },
      { id: 'fsp_ch9_protect_chen', labelKo: 'Chen을 보호한다.', effects: { reputationDelta: { mcc: 100, fsp: -100, cv: -50 }, flag: 'ch9_chen_protected', flag2: 'fsp_route_terminated_by_betrayal', tagsAdded: ['the_corporate_servant', 'fsp_route_betrayer'] } },
      { id: 'fsp_ch9_protect_butcher', labelKo: 'Butcher를 보호한다.', effects: { reputationDelta: { cv: 60, mcc: -40, fsp: 10 }, flag: 'ch9_butcher_protected', tagsAdded: ['the_unexpected_ally'] } },
      { id: 'fsp_ch9_full_retreat', labelKo: '모두 후퇴시킨다.', effects: { flag: 'ch9_full_retreat', flag2: 'summit_postponed_one_year', tagsAdded: ['the_indecisive_arbiter'] } },
      { id: 'fsp_ch9_signal_pilgrim_arms', labelKo: '[조건부] Pilgrim Arms에 신호한다.', effects: { reputationDelta: { mcc: -100, fsp: -50, cv: -20 }, flag: 'ch9_chen_killed_by_player_signal', flag2: 'pilgrim_arms_full_alignment', tagsAdded: ['the_fourth_faction_emergent', 'fourth_faction_slayer'] } },
    ],
  },
  [FSP_CH10_ID]: {
    questId: FSP_CH10_ID,
    scenesFile: 'docs/campaign-story/fsp_ch10_freedoms_price.json',
    campaignId: 'fsp_route',
    chapterNumber: 10,
    faction: 'fsp',
    title: { ko: '자유의 대가', en: "Freedom's Price", ja: '自由の代償', zh: '自由的代价' },
    requiredLevel: 10,
    prerequisiteChapter: FSP_CH9_ID,
    requiredReputation: { fsp: -100 },
    blockingTags: ['war_criminal'],
    battleResolution: 'ending_evaluation_and_cinematic',
    estimatedPlayTimeSeconds: 900,
    location: { id: 'fsp_route_finale', displayNameKo: 'FSP 루트 최종 장면', displayNameEn: 'FSP Route Finale', region: 'mars' },
    environment: { type: 'cinematic', noCombat: true, phases: [{ phase: 0, startSec: 0 }] },
    briefing: {
      npcId: 'father_hale',
      npcName: 'Father Hale / FSP Route Cast',
      npcTitle: 'FSP 루트 엔딩 평가',
      lines: [
        { id: 'fsp_ch10_review_01', ko: '10 챕터. 의장 결정, Gaia, 회담. 오늘은 그 모든 결과를 받는 날입니다.' },
        { id: 'fsp_ch10_review_02', ko: '시민, 평화중재자, Gaia 함장, 표류자, 혹은 네 번째 깃발. 당신의 길입니다.' },
      ],
      radio: [],
    },
    choices: [
      { id: 'fsp_ending_1_citizen', labelKo: 'Ending 1: Citizen.', effects: { flag: 'chose_fsp_ending_1' } },
      { id: 'fsp_ending_2_peacemaker', labelKo: 'Ending 2: Peacemaker.', effects: { flag: 'chose_fsp_ending_2' } },
      { id: 'fsp_ending_2_alt_gaia_captain', labelKo: 'Ending 2 Alt: Gaia Captain.', effects: { flag: 'chose_fsp_ending_2_alt' } },
      { id: 'fsp_ending_3_disillusioned', labelKo: 'Ending 3: Disillusioned.', effects: { flag: 'chose_fsp_ending_3' } },
      { id: 'fsp_ending_4_new_chair', labelKo: 'Ending 4: New Chair.', effects: { flag: 'chose_fsp_ending_4' } },
      { id: 'fsp_bad_ending_fallback', labelKo: 'Bad Ending: Failed Arc.', effects: { flag: 'chose_fsp_bad_ending' } },
    ],
  },

  // ── CV 루트 (크림슨 워로드) ────────────────────────────────────────────────
  cv_campaign_ch1: {
    questId: 'cv_campaign_ch1', scenesFile: 'docs/campaign-story/cv_ch1_baptism.json',
    campaignId: 'cv_route', chapterNumber: 1, faction: 'cv',
    title: { ko: '세례', en: 'Baptism', ja: '洗礼', zh: '洗礼' }, requiredLevel: 1, prerequisiteChapter: 'cv_prologue', requiredReputation: { cv: 0 },
    battleResolution: 'server_simulation', estimatedPlayTimeSeconds: 900,
    location: { id: 'outer_colony_ruins', displayNameKo: '외곽 식민지 폐허', displayNameEn: 'Outer Colony Ruins', region: 'outer_belt' },
    environment: { type: 'wasteland_night', totalDurationSeconds: 900, phases: [{ phase: 0, startSec: 0 }] },
    briefing: { npcId: 'butcher', npcName: 'The Butcher / Cinder Grace', npcTitle: 'CV 입단 세례', lines: [{ id: 'cv_ch1_01', ko: '살아있네. 의외야. CV에는 규칙이 없어. 그게 규칙이야.' }], radio: [] },
    choices: [
      { id: 'cv_ch1_brutal', labelKo: '힘으로 증명한다.', effects: { reputationDelta: { cv: 15 }, flag: 'cv_brutal_entry' } },
      { id: 'cv_ch1_smart', labelKo: '영리하게 통과한다.', effects: { reputationDelta: { cv: 10 }, flag: 'cv_smart_entry' } },
      { id: 'cv_ch1_refuse', labelKo: '테스트를 거부한다.', effects: { reputationDelta: { cv: -10 }, flag: 'cv_refused_test' } },
      { id: 'cv_ch1_question', labelKo: '왜 이런 테스트가 필요한가 묻는다.', effects: { reputationDelta: { cv: 5 }, flag: 'cv_questioned_test', flag2: 'cinder_noticed_player' } },
    ],
  },
  cv_campaign_ch2: {
    questId: 'cv_campaign_ch2', scenesFile: 'docs/campaign-story/cv_ch2_raid.json',
    campaignId: 'cv_route', chapterNumber: 2, faction: 'cv',
    title: { ko: '약탈', en: 'The Raid', ja: '略奪', zh: '掠夺' }, requiredLevel: 2, prerequisiteChapter: 'cv_campaign_ch1',
    battleResolution: 'server_simulation', estimatedPlayTimeSeconds: 1200,
    location: { id: 'north_pole_route', displayNameKo: '북극관 호송 항로', displayNameEn: 'North Pole Convoy Route', region: 'north_pole_to_hellas' },
    environment: { type: 'convoy_ambush', totalDurationSeconds: 1200, phases: [{ phase: 0, startSec: 0 }, { phase: 1, startSec: 600 }] },
    briefing: { npcId: 'butcher', npcName: 'The Butcher / Cinder Grace', npcTitle: 'FSP 얼음 호송 습격', lines: [{ id: 'cv_ch2_01', ko: '얼음 호송선이 지나간다. 우리가 먹는다.' }], radio: [] },
    choices: [
      { id: 'cv_ch2_full_raid', labelKo: '전면 약탈. 모두 가져간다.', effects: { reputationDelta: { cv: 15, fsp: -20 }, flag: 'cv_full_raid' } },
      { id: 'cv_ch2_selective', labelKo: '절반만. 의료 호송은 건드리지 않는다.', effects: { reputationDelta: { cv: 5, fsp: -5 }, flag: 'cv_selective_raid', flag2: 'cinder_approved' } },
      { id: 'cv_ch2_abort', labelKo: '환자가 있다. 철수한다.', effects: { reputationDelta: { cv: -10, fsp: 5 }, flag: 'cv_aborted_raid' } },
      { id: 'cv_ch2_negotiate', labelKo: '공격 대신 통행세를 요구한다.', effects: { reputationDelta: { cv: 8 }, flag: 'cv_toll_demanded' } },
    ],
  },
  cv_campaign_ch3: {
    questId: 'cv_campaign_ch3', scenesFile: 'docs/campaign-story/cv_ch3_mine_king.json',
    campaignId: 'cv_route', chapterNumber: 3, faction: 'cv',
    title: { ko: '광산왕', en: 'Mine King', ja: '鉱山王', zh: '矿山王' }, requiredLevel: 3, prerequisiteChapter: 'cv_campaign_ch2',
    battleResolution: 'server_simulation', estimatedPlayTimeSeconds: 1500,
    location: { id: 'cv_eastern_mines', displayNameKo: 'CV 동쪽 광산 구역', displayNameEn: 'CV Eastern Mining Zone', region: 'arabia_terra' },
    environment: { type: 'internal_conflict', totalDurationSeconds: 1500, phases: [{ phase: 0, startSec: 0 }, { phase: 1, startSec: 750 }] },
    briefing: { npcId: 'butcher', npcName: 'The Butcher / Cinder Grace', npcTitle: 'CV 내부 파벌 충돌', lines: [{ id: 'cv_ch3_01', ko: '내부에서 도전자가 나왔어. 처리해.' }], radio: [] },
    choices: [
      { id: 'cv_ch3_crush', labelKo: '완전히 제압한다.', effects: { reputationDelta: { cv: 15 }, flag: 'cv_crushed_rival' } },
      { id: 'cv_ch3_absorb', labelKo: '흡수한다. 싸우지 않고.', effects: { reputationDelta: { cv: 10 }, flag: 'cv_absorbed_rival' } },
      { id: 'cv_ch3_cinder_way', labelKo: '신더의 방식대로. 협상.', effects: { reputationDelta: { cv: 5 }, flag: 'cv_cinder_method', flag2: 'cinder_trust_up' } },
      { id: 'cv_ch3_question_butcher', labelKo: '왜 이 싸움이 필요한지 정육점에게 묻는다.', effects: { reputationDelta: { cv: -5 }, flag: 'cv_questioned_butcher' } },
    ],
  },
  cv_campaign_ch4: {
    questId: 'cv_campaign_ch4', scenesFile: 'docs/campaign-story/cv_ch4_cinder.json',
    campaignId: 'cv_route', chapterNumber: 4, faction: 'cv',
    title: { ko: '신더', en: 'Cinder', ja: 'シンダー', zh: '辛德' }, requiredLevel: 4, prerequisiteChapter: 'cv_campaign_ch3',
    battleResolution: 'server_simulation', estimatedPlayTimeSeconds: 1500,
    location: { id: 'sandstone_junction_cv', displayNameKo: 'Sandstone Junction 지하', displayNameEn: 'Sandstone Junction Underground', region: 'equatorial_belt' },
    environment: { type: 'subterranean_secret', totalDurationSeconds: 1500, phases: [{ phase: 0, startSec: 0 }] },
    briefing: { npcId: 'cinder', npcName: 'Cinder Grace / FSP Diplomat', npcTitle: 'FSP 비밀 협상 — CV 시각', lines: [{ id: 'cv_ch4_01', ko: 'FSP가 협상을 원해. The Butcher는 알면 안 돼.' }], radio: [] },
    choices: [
      { id: 'cv_ch4_support_cinder', labelKo: '신더를 지지한다. 협상 진행.', effects: { reputationDelta: { cv: 5, fsp: 10 }, flag: 'cv_cinder_supported', flag2: 'fsp_cv_channel_open' } },
      { id: 'cv_ch4_report_butcher', labelKo: '정육점에게 보고한다.', effects: { reputationDelta: { cv: 10, fsp: -20 }, flag: 'cv_reported_cinder', flag2: 'cinder_exposed' } },
      { id: 'cv_ch4_watch', labelKo: '지켜본다. 아직 판단 안 한다.', effects: { flag: 'cv_watched_cinder' } },
      { id: 'cv_ch4_demand_terms', labelKo: 'FSP에게 더 많은 조건을 요구한다.', effects: { reputationDelta: { cv: 3 }, flag: 'cv_demanded_more' } },
    ],
  },
  cv_campaign_ch5: {
    questId: 'cv_campaign_ch5', scenesFile: 'docs/campaign-story/cv_ch5_kepler_king.json',
    campaignId: 'cv_route', chapterNumber: 5, faction: 'cv',
    title: { ko: '케플러의 왕', en: 'King of Kepler', ja: 'ケプラーの王', zh: '开普勒之王' }, requiredLevel: 5, prerequisiteChapter: 'cv_campaign_ch4',
    battleResolution: 'server_simulation', estimatedPlayTimeSeconds: 1800,
    location: { id: 'kepler_crater', displayNameKo: 'Kepler 분화구', displayNameEn: 'Kepler Crater', region: 'arabia_terra' },
    environment: { type: 'three_faction_battle', totalDurationSeconds: 1800, phases: [{ phase: 0, startSec: 0 }, { phase: 1, startSec: 900 }] },
    briefing: { npcId: 'butcher', npcName: 'The Butcher / Cinder Grace', npcTitle: 'Kepler 분화구 강점 작전', lines: [{ id: 'cv_ch5_01', ko: '티타늄이 거기 있어. 우리가 먼저 가져간다.' }], radio: [] },
    choices: [
      { id: 'cv_ch5_full_force', labelKo: 'MCC와 FSP 모두 제압. CV 단독 통치.', effects: { reputationDelta: { cv: 20, fsp: -20, mcc: -20 }, flag: 'cv_kepler_full_force' } },
      { id: 'cv_ch5_fsp_deal', labelKo: 'FSP와 분할 협상. MCC만 제압.', effects: { reputationDelta: { cv: 10, fsp: 5, mcc: -15 }, flag: 'cv_kepler_fsp_deal' } },
      { id: 'cv_ch5_three_way', labelKo: '삼각 분할 제안. 신더 방식.', effects: { reputationDelta: { cv: 5, fsp: 5, mcc: 5 }, flag: 'cv_kepler_three_way', flag2: 'cinder_method_validated' } },
      { id: 'cv_ch5_withdraw', labelKo: '철수. 피가 너무 많다.', effects: { reputationDelta: { cv: -10 }, flag: 'cv_kepler_withdrew', flag2: 'butcher_disappointed' } },
    ],
  },
  cv_campaign_ch6: {
    questId: 'cv_campaign_ch6', scenesFile: 'docs/campaign-story/cv_ch6_thirty_years.json',
    campaignId: 'cv_route', chapterNumber: 6, faction: 'cv',
    title: { ko: '30년', en: 'Thirty Years', ja: '30年', zh: '三十年' }, requiredLevel: 6, prerequisiteChapter: 'cv_campaign_ch5',
    battleResolution: 'server_simulation', estimatedPlayTimeSeconds: 1200,
    location: { id: 'cv_inner_sanctum', displayNameKo: 'CV 본거지 내부', displayNameEn: 'CV Inner Sanctum', region: 'outer_belt' },
    environment: { type: 'personal_memory', totalDurationSeconds: 1200, phases: [{ phase: 0, startSec: 0 }] },
    briefing: { npcId: 'butcher', npcName: 'The Butcher', npcTitle: '30년 전 이야기', lines: [{ id: 'cv_ch6_01', ko: '오래된 이야기야. 들을 시간 있어?' }], radio: [] },
    choices: [
      { id: 'cv_ch6_listen_all', labelKo: '모든 이야기를 듣는다.', effects: { reputationDelta: { cv: 5 }, flag: 'cv_heard_butcher_story', flag2: 'butcher_trust_deepened' } },
      { id: 'cv_ch6_ask_regret', labelKo: '후회하는지 묻는다.', effects: { reputationDelta: { cv: 3 }, flag: 'cv_asked_regret', flag2: 'butcher_rare_vulnerable' } },
      { id: 'cv_ch6_challenge', labelKo: '그 선택이 옳았는지 따진다.', effects: { reputationDelta: { cv: -5 }, flag: 'cv_challenged_butcher' } },
      { id: 'cv_ch6_cinder_perspective', labelKo: '신더에게도 물어본다.', effects: { reputationDelta: { cv: 2 }, flag: 'cv_cinder_history_revealed' } },
    ],
  },
  cv_campaign_ch7: {
    questId: 'cv_campaign_ch7', scenesFile: 'docs/campaign-story/cv_ch7_last_war.json',
    campaignId: 'cv_route', chapterNumber: 7, faction: 'cv',
    title: { ko: '최후의 전쟁', en: 'The Last War', ja: '最後の戦争', zh: '最后的战争' }, requiredLevel: 7, prerequisiteChapter: 'cv_campaign_ch6',
    battleResolution: 'server_simulation', estimatedPlayTimeSeconds: 1800,
    location: { id: 'cv_war_camp', displayNameKo: 'CV 전쟁 캠프', displayNameEn: 'CV War Camp', region: 'outer_belt' },
    environment: { type: 'war_mobilization', totalDurationSeconds: 1800, phases: [{ phase: 0, startSec: 0 }, { phase: 1, startSec: 900 }, { phase: 2, startSec: 1500 }] },
    briefing: { npcId: 'cinder', npcName: 'Cinder Grace / The Butcher', npcTitle: '전면전 개시 전날', lines: [{ id: 'cv_ch7_01', ko: '내일 전부 시작돼. 막을 수 있어.' }], radio: [] },
    choices: [
      { id: 'cv_ch7_follow_butcher', labelKo: '정육점을 따른다. 전쟁을 시작한다.', effects: { reputationDelta: { cv: 20, fsp: -30, mcc: -20 }, flag: 'cv_war_started' } },
      { id: 'cv_ch7_stop_war', labelKo: '신더를 따른다. 전쟁을 막는다.', effects: { reputationDelta: { cv: -10, fsp: 15 }, flag: 'cv_war_stopped', flag2: 'cinder_leads_now' } },
      { id: 'cv_ch7_negotiate', labelKo: '마지막 협상 시도. 의회 소집.', effects: { reputationDelta: { cv: 5 }, flag: 'cv_negotiated_last', flag2: 'three_flags_possible' } },
      { id: 'cv_ch7_disappear', labelKo: '모든 것을 떠난다.', effects: { reputationDelta: { cv: -20 }, flag: 'cv_player_disappeared', flag2: 'butcher_betrayed' } },
    ],
  },
  cv_campaign_ch8: {
    questId: 'cv_campaign_ch8', scenesFile: 'docs/campaign-story/cv_ch8_red_parliament_cv.json',
    campaignId: 'cv_route', chapterNumber: 8, faction: 'cv',
    title: { ko: '붉은 의회 — CV', en: 'Red Parliament — CV', ja: '赤い議会 — CV', zh: '红色议会 — CV' }, requiredLevel: 8, prerequisiteChapter: 'cv_campaign_ch7',
    battleResolution: 'server_simulation', estimatedPlayTimeSeconds: 1800,
    location: { id: 'kepler_crater_parliament', displayNameKo: 'Kepler 분화구 긴급 회의', displayNameEn: 'Kepler Crater Emergency Assembly', region: 'arabia_terra' },
    environment: { type: 'emergency_summit_cv', totalDurationSeconds: 1800, phases: [{ phase: 0, startSec: 0 }, { phase: 1, startSec: 900 }] },
    briefing: { npcId: 'butcher', npcName: 'The Butcher / Cinder / Mikhail / Li Fang', npcTitle: '붉은 의회 — CV 시각', lines: [{ id: 'cv_ch8_01', ko: '우리는 여기서 아무것도 서명하지 않아.' }], radio: [] },
    choices: [
      { id: 'cv_ch8_bloc_vote', labelKo: 'CV 독자 블록으로 투표. 어느 쪽도 지지 안 함.', effects: { reputationDelta: { cv: 10 }, flag: 'cv_bloc_voted' } },
      { id: 'cv_ch8_support_mcc', labelKo: 'MCC를 지지한다. 천의 계획이 CV에 유리하다.', effects: { reputationDelta: { cv: 5, mcc: 15 }, flag: 'cv_supported_mcc' } },
      { id: 'cv_ch8_support_fsp', labelKo: 'FSP 헌법을 지지한다. CV도 그 아래.', effects: { reputationDelta: { cv: -5, fsp: 15 }, flag: 'cv_supported_fsp', flag2: 'butcher_shocked' } },
      { id: 'cv_ch8_speak', labelKo: '정육점 대신 직접 발언한다.', effects: { reputationDelta: { cv: 5 }, flag: 'cv_player_spoke', flag2: 'butcher_surprised_player' } },
    ],
  },
  cv_campaign_ch9: {
    questId: 'cv_campaign_ch9', scenesFile: 'docs/campaign-story/cv_ch9_olympus.json',
    campaignId: 'cv_route', chapterNumber: 9, faction: 'cv',
    title: { ko: '올림푸스의 밤', en: 'Olympus Night', ja: 'オリンポスの夜', zh: '奥林匹斯之夜' }, requiredLevel: 9, prerequisiteChapter: 'cv_campaign_ch8',
    battleResolution: 'server_simulation', estimatedPlayTimeSeconds: 1200,
    location: { id: 'olympus_cv_camp', displayNameKo: 'Olympus Mons 산자락 CV 야영지', displayNameEn: 'Olympus Mons CV Camp', region: 'olympus_mons' },
    environment: { type: 'night_before_summit', totalDurationSeconds: 1200, phases: [{ phase: 0, startSec: 0 }] },
    briefing: { npcId: 'butcher', npcName: 'The Butcher / Cinder Grace', npcTitle: '정상회담 전날 밤 — CV', lines: [{ id: 'cv_ch9_01', ko: '내일이면 끝나.' }], radio: [] },
    choices: [
      { id: 'cv_ch9_stand_with_butcher', labelKo: '정육점 옆에 선다.', effects: { reputationDelta: { cv: 15 }, flag: 'cv_stood_with_butcher' } },
      { id: 'cv_ch9_stand_with_cinder', labelKo: '신더와 함께한다.', effects: { reputationDelta: { cv: 5 }, flag: 'cv_stood_with_cinder', flag2: 'cinder_final_alliance' } },
      { id: 'cv_ch9_ask_hale', labelKo: '헤일 신부에게 조언을 구한다.', effects: { flag: 'cv_consulted_hale' } },
      { id: 'cv_ch9_alone', labelKo: '혼자 있는다.', effects: { flag: 'cv_spent_night_alone' } },
    ],
  },
  cv_campaign_ch10: {
    questId: 'cv_campaign_ch10', scenesFile: 'docs/campaign-story/cv_ch10_from_flames.json',
    campaignId: 'cv_route', chapterNumber: 10, faction: 'cv',
    title: { ko: '가시 면류관', en: 'The Thorn Crown', ja: '茨の冠', zh: '荆棘王冠' }, requiredLevel: 10, prerequisiteChapter: 'cv_campaign_ch9',
    requiredReputation: { cv: -100 },
    battleResolution: 'ending_evaluation_and_cinematic', estimatedPlayTimeSeconds: 900,
    location: { id: 'erebus_crater_base', displayNameKo: '에레보스 분화구 기지', displayNameEn: 'Erebus Crater Base', region: 'mars' },
    environment: { type: 'cv_base_final', phases: [{ phase: 0, startSec: 0 }] },
    briefing: { npcId: 'butcher', npcName: 'The Butcher', npcTitle: 'CV 루트 엔딩', lines: [{ id: 'cv_ch10_01', ko: '30년이 지났어. CV가 여전히 필요해?' }], radio: [] },
    choices: [
      { id: 'cv_ch10_warlord', labelKo: 'Ending A: 군벌 — 화성이 두려워하는 자.', effects: { flag: 'cv_ending_warlord' } },
      { id: 'cv_ch10_renegade', labelKo: 'Ending B: 반역자 — 아무것에도 속하지 않는 자.', effects: { flag: 'cv_ending_renegade' } },
      { id: 'cv_ch10_mercenary', labelKo: 'Ending C: 용병 — 코드가 법인 자.', effects: { flag: 'cv_ending_mercenary' } },
      { id: 'cv_ch10_crown', labelKo: 'Ending D: 왕관 — Zone 12가 화성의 법이 된다.', effects: { flag: 'cv_ending_crown' } },
    ],
  },

  // ─── Hidden Observer Route (Ch1-5) ───────────────────────────────────────
  hidden_campaign_ch1: {
    questId: 'hidden_campaign_ch1', scenesFile: 'docs/campaign-story/hidden_ch1_observer.json',
    campaignId: 'hidden_route', chapterNumber: 1, faction: 'hidden',
    title: { ko: '관찰자', en: 'The Observer', ja: '観察者', zh: '观察者' }, requiredLevel: 1, prerequisiteChapter: null,
    unlockCondition: 'all_routes_ch1_complete',
    battleResolution: 'standard', estimatedPlayTimeSeconds: 900,
    location: { id: 'kariope_cargo_ship', displayNameKo: '화물선 카리오페호', displayNameEn: 'Cargo Ship Kariyope', region: 'deep_space' },
    environment: { type: 'cargo_ship_deep_space', phases: [{ phase: 0, startSec: 0 }] },
    briefing: { npcId: 'verk', npcName: '운항사 베르크', npcTitle: '카리오페호', lines: [{ id: 'hidden_ch1_01', ko: '화성에 뭐 하러 가요.' }], radio: [] },
    choices: [
      { id: 'hidden_ch1_watch_mcc', labelKo: 'MCC 본부 방향.', effects: { flag: 'hidden_watched_mcc_first' } },
      { id: 'hidden_ch1_watch_fsp', labelKo: '헬라스 외곽 광부 마을 방향.', effects: { flag: 'hidden_watched_fsp_first' } },
      { id: 'hidden_ch1_watch_cv', labelKo: '아르기레 협곡 방향.', effects: { flag: 'hidden_watched_cv_first' } },
      { id: 'hidden_ch1_watch_all', labelKo: '멈춘다. 전체를 본다.', effects: { flag: 'hidden_watched_all', tagsAdded: ['true_observer'] } },
    ],
  },
  hidden_campaign_ch2: {
    questId: 'hidden_campaign_ch2', scenesFile: 'docs/campaign-story/hidden_ch2_traces.json',
    campaignId: 'hidden_route', chapterNumber: 2, faction: 'hidden',
    title: { ko: '흔적들', en: 'Traces', ja: '痕跡', zh: '痕迹' }, requiredLevel: 1, prerequisiteChapter: 'hidden_campaign_ch1',
    battleResolution: 'standard', estimatedPlayTimeSeconds: 900,
    location: { id: 'hellas_various', displayNameKo: '헬라스 — 여러 장소', displayNameEn: 'Hellas — Various Locations', region: 'mars' },
    environment: { type: 'multiple_locations', phases: [{ phase: 0, startSec: 0 }] },
    briefing: { npcId: 'observer', npcName: '관찰자', npcTitle: '숨겨진 루트', lines: [{ id: 'hidden_ch2_01', ko: '흔적이 있었다. 분필이었다.' }], radio: [] },
    choices: [
      { id: 'hidden_ch2_names', labelKo: '이름들을 연결한다.', effects: { flag: 'hidden_connected_names' } },
      { id: 'hidden_ch2_people', labelKo: '사람들을 연결한다.', effects: { flag: 'hidden_connected_people' } },
      { id: 'hidden_ch2_ancient', labelKo: 'Ancient Metal을 연결한다.', effects: { flag: 'hidden_connected_ancient', tagsAdded: ['ancient_metal_seeker'] } },
      { id: 'hidden_ch2_nothing', labelKo: '연결하지 않는다.', effects: { flag: 'hidden_pure_observer' } },
    ],
  },
  hidden_campaign_ch3: {
    questId: 'hidden_campaign_ch3', scenesFile: 'docs/campaign-story/hidden_ch3_fourth_flag.json',
    campaignId: 'hidden_route', chapterNumber: 3, faction: 'hidden',
    title: { ko: '세 개의 깃발, 네 번째 시점', en: 'Three Flags, Fourth Perspective', ja: '三つの旗、四番目の視点', zh: '三面旗，第四视角' }, requiredLevel: 1, prerequisiteChapter: 'hidden_campaign_ch2',
    battleResolution: 'standard', estimatedPlayTimeSeconds: 1200,
    location: { id: 'olympus_summit_exterior', displayNameKo: '올림포스 산 정상 외부', displayNameEn: 'Olympus Mons Summit Exterior', region: 'olympus' },
    environment: { type: 'olympus_exterior_thin_air', phases: [{ phase: 0, startSec: 0 }] },
    briefing: { npcId: 'observer', npcName: '관찰자', npcTitle: '숨겨진 루트', lines: [{ id: 'hidden_ch3_01', ko: '세 파벌. 세 깃발. 관찰자는 안에 없었다.' }], radio: [] },
    choices: [
      { id: 'hidden_ch3_enter', labelKo: '안으로 들어간다.', effects: { flag: 'hidden_entered_summit', reputationDelta: { mcc: 5, fsp: 5, cv: 5 } } },
      { id: 'hidden_ch3_wait', labelKo: '기다린다.', effects: { flag: 'hidden_waited_outside' } },
      { id: 'hidden_ch3_record', labelKo: '기록한다.', effects: { flag: 'hidden_recorded_summit', tagsAdded: ['historian_of_mars'] } },
      { id: 'hidden_ch3_ancient', labelKo: 'Ancient Metal을 꺼낸다.', effects: { flag: 'hidden_revealed_ancient_at_summit' } },
    ],
  },
  hidden_campaign_ch4: {
    questId: 'hidden_campaign_ch4', scenesFile: 'docs/campaign-story/hidden_ch4_thirty_years.json',
    campaignId: 'hidden_route', chapterNumber: 4, faction: 'hidden',
    title: { ko: '30년', en: 'Thirty Years', ja: '30年', zh: '三十年' }, requiredLevel: 1, prerequisiteChapter: 'hidden_campaign_ch3',
    battleResolution: 'standard', estimatedPlayTimeSeconds: 1200,
    location: { id: 'hellas_zone4_ruins', displayNameKo: '헬라스 4구역 폐광', displayNameEn: 'Hellas Zone 4 Abandoned Mine', region: 'mars' },
    environment: { type: 'flashback_mine', phases: [{ phase: 0, startSec: 0 }] },
    briefing: { npcId: 'observer', npcName: '관찰자', npcTitle: '숨겨진 루트', lines: [{ id: 'hidden_ch4_01', ko: '30년 전이었다. 기억이 아니었다. 흔적이었다.' }], radio: [] },
    choices: [
      { id: 'hidden_ch4_document', labelKo: '모든 것을 기록한다.', effects: { flag: 'hidden_documented_zone4' } },
      { id: 'hidden_ch4_tell_butcher', labelKo: 'Butcher에게 말한다.', effects: { flag: 'hidden_told_butcher', reputationDelta: { cv: 10 } } },
      { id: 'hidden_ch4_tell_liang', labelKo: 'Liang Wei에게 말한다.', effects: { flag: 'hidden_told_liang', tagsAdded: ['ancient_metal_bridge'] } },
      { id: 'hidden_ch4_ancient_metal', labelKo: 'Ancient Metal 샘플을 가져간다.', effects: { flag: 'hidden_holds_ancient_sample' } },
    ],
  },
  hidden_campaign_ch5: {
    questId: 'hidden_campaign_ch5', scenesFile: 'docs/campaign-story/hidden_ch5_last_observation.json',
    campaignId: 'hidden_route', chapterNumber: 5, faction: 'hidden',
    title: { ko: '마지막 관찰', en: 'Last Observation', ja: '最後の観察', zh: '最后的观察' }, requiredLevel: 1, prerequisiteChapter: 'hidden_campaign_ch4',
    battleResolution: 'ending_evaluation_and_cinematic', estimatedPlayTimeSeconds: 1500,
    location: { id: 'hellas_zone4_deep_tunnel', displayNameKo: '헬라스 4구역 갱도 최심부', displayNameEn: 'Hellas Zone 4 Deep Tunnel', region: 'mars' },
    environment: { type: 'ancient_deep_final', phases: [{ phase: 0, startSec: 0 }] },
    briefing: { npcId: 'observer', npcName: '관찰자', npcTitle: '숨겨진 루트 — 엔딩', lines: [{ id: 'hidden_ch5_01', ko: '가장 깊은 곳이었다. 아무도 30년 동안 오지 않은 곳.' }], radio: [] },
    choices: [
      { id: 'hidden_ch5_reveal_all', labelKo: 'Ending A: 계시 — 화성의 역사가 다시 쓰인다.', effects: { flag: 'hidden_ending_revelation' } },
      { id: 'hidden_ch5_three_keepers', labelKo: 'Ending B: 네 번째 길 — 깃발 없는 화성.', effects: { flag: 'hidden_ending_fourth_path' } },
      { id: 'hidden_ch5_bury_again', labelKo: 'Ending C: 관찰자 — 30년을 더 기다린다.', effects: { flag: 'hidden_ending_observer' } },
      { id: 'hidden_ch5_give_liang', labelKo: 'Ending D: 과학자의 것 — 30년의 기다림이 보상된다.', effects: { flag: 'hidden_ending_scientist' } },
    ],
  },
};

// 아직 VN 스크립트가 없는 챕터도 동일한 공개 스키마를 갖도록 null로 맞춘다.
Object.values(CHAPTERS).forEach(ch => {
  if (ch.scenesFile === undefined) ch.scenesFile = null;
});

const OBJECTIVE_PRESETS = {
  prologue: [
    { id: 'story_intro', labelKo: '카리오페호 프롤로그를 확인한다.', labelEn: 'Read the Kariope prologue.', action: 'story' },
    { id: 'route_unlock', labelKo: '첫 작전 루트를 개방한다.', labelEn: 'Unlock the first operation route.', action: 'unlock' },
  ],
  mcc_campaign_ch1: [
    { id: 'briefing', labelKo: '에레부스 정제소 브리핑을 확인한다.', labelEn: 'Review the Erebus refinery briefing.', action: 'story' },
    { id: 'first_claim', labelKo: '내 영토 1개를 확보한다.', labelEn: 'Claim 1 territory on Mars.', action: 'territory', stat: 'ownedClaims', target: 1 },
    { id: 'first_art', labelKo: '영토에 이미지를 등록해 기지를 표시한다.', labelEn: 'Register an image on your territory to mark your base.', action: 'territory_art', stat: 'artClaims', target: 1 },
    { id: 'first_harvest', labelKo: '영토에서 PP 채굴을 1회 수확한다.', labelEn: 'Harvest PP from your territory once.', action: 'territory', stat: 'territoryHarvests', target: 1 },
    { id: 'first_material_harvest', labelKo: '영토 수확으로 광물 1종을 획득한다.', labelEn: 'Obtain 1 material from a territory harvest.', action: 'territory', stat: 'materialHarvests', target: 1, optional: true },
    { id: 'operation_timer', labelKo: '산소 회수 작전 진행률 100%를 달성한다.', labelEn: 'Reach 100% progress in the oxygen recovery operation.', action: 'campaign_progress' },
    { id: 'unlock_next', labelKo: '결과를 확인하고 다음 작전 권한을 얻는다.', labelEn: 'Check results and unlock the next operation.', action: 'claim_result' },
  ],
  mcc_campaign_ch2: [
    { id: 'briefing', labelKo: 'Hellas 북부 수소 채굴장 상황을 확인한다.', labelEn: 'Review the Hellas North hydrogen mine briefing.', action: 'story' },
    { id: 'first_fleet', labelKo: '함대 1개를 구성한다.', labelEn: 'Form 1 fleet.', action: 'fleet', stat: 'fleets', target: 1 },
    { id: 'fleet_line', labelKo: '작전에 투입할 함선 3척을 함대에 배치한다.', labelEn: 'Deploy 3 ships to your fleet for the operation.', action: 'fleet', stat: 'fleetShips', target: 3 },
    { id: 'territory_upgrade_start', labelKo: '영토에 채굴기 또는 실드 그리드를 설치해 거점을 강화한다.', labelEn: 'Install an Extractor or Shield Grid to fortify your base.', action: 'territory', stat: 'territoryUpgradeLevels', target: 1, optional: true },
    { id: 'operation_timer', labelKo: '시설 피해를 억제하며 작전 진행률 100%를 달성한다.', labelEn: 'Reach 100% progress while containing facility damage.', action: 'campaign_progress' },
    { id: 'unlock_next', labelKo: '결과를 확인하고 이사회 루트를 연다.', labelEn: 'Check results and unlock the boardroom route.', action: 'claim_result' },
  ],
  mcc_campaign_ch3: [
    { id: 'briefing', labelKo: '이사회 선택지를 확인한다.', labelEn: 'Review the boardroom choices.', action: 'story' },
    { id: 'choice', labelKo: 'MCC 내 정치적 선택을 확정한다.', labelEn: 'Confirm your political position within MCC.', action: 'choice' },
    { id: 'first_battle', labelKo: '함대전을 1회 완료한다.', labelEn: 'Complete 1 fleet battle.', action: 'fleet_battle', stat: 'completedFleetBattles', target: 1 },
    { id: 'first_upgrade', labelKo: '함선 스탯을 1회 강화한다.', labelEn: 'Upgrade a ship stat once.', action: 'shipyard', stat: 'shipUpgrades', target: 1 },
    { id: 'first_listing', labelKo: '함선 또는 자원 1개를 마켓에 등록한다.', labelEn: 'List 1 ship or resource on the market.', action: 'market', stat: 'marketListings', target: 1 },
    { id: 'unlock_next', labelKo: '선택 결과에 따라 다음 루트를 연다.', labelEn: 'Check results and unlock the next route.', action: 'claim_result' },
  ],
  fsp_campaign_ch1: [
    { id: 'briefing', labelKo: 'FSP 첫 작전 브리핑을 확인한다.', labelEn: 'Review the FSP first operation briefing.', action: 'story' },
    { id: 'first_ship', labelKo: '작전에 투입할 함선 1척을 보유한다.', labelEn: 'Own 1 ship for the operation.', action: 'shipyard', stat: 'ownedShips', target: 1 },
    { id: 'operation_timer', labelKo: '정착지 보호 작전 진행률 100%를 달성한다.', labelEn: 'Reach 100% progress in the settlement protection operation.', action: 'campaign_progress' },
    { id: 'unlock_next', labelKo: '결과를 확인하고 다음 FSP 작전을 연다.', labelEn: 'Check results and unlock the next FSP operation.', action: 'claim_result' },
  ],
  cv_campaign_ch1: [
    { id: 'briefing', labelKo: 'CV 첫 습격 브리핑을 확인한다.', labelEn: 'Review the CV first raid briefing.', action: 'story' },
    { id: 'first_ship', labelKo: '습격에 투입할 함선 1척을 보유한다.', labelEn: 'Own 1 ship for the raid.', action: 'shipyard', stat: 'ownedShips', target: 1 },
    { id: 'operation_timer', labelKo: '습격 작전 진행률 100%를 달성한다.', labelEn: 'Reach 100% progress in the raid operation.', action: 'campaign_progress' },
    { id: 'unlock_next', labelKo: '결과를 확인하고 다음 CV 작전을 연다.', labelEn: 'Check results and unlock the next CV operation.', action: 'claim_result' },
  ],

  // ── MCC CH4~CH10 ──────────────────────────────────────────────────────────
  mcc_campaign_ch4: [
    { id: 'briefing', labelKo: '해적 매수 작전 브리핑을 확인한다.', labelEn: 'Review the pirate recruitment briefing.', action: 'story' },
    { id: 'choice', labelKo: 'Kara Vex와의 협상 전략을 선택한다.', labelEn: 'Choose your negotiation strategy with Kara Vex.', action: 'choice' },
    { id: 'fleet_strength', labelKo: '함선 5척 이상을 함대에 배치해 위용을 갖춘다.', labelEn: 'Deploy 5+ ships to demonstrate force.', action: 'fleet', stat: 'fleetShips', target: 5 },
    { id: 'combat_veteran', labelKo: '함대전을 누적 2회 이상 완료해 전투 경력을 쌓는다.', labelEn: 'Complete 2+ fleet battles to build combat credentials.', action: 'fleet_battle', stat: 'completedFleetBattles', target: 2 },
    { id: 'unlock_next', labelKo: '협상 결과를 확인하고 Kepler 분쟁 루트를 연다.', labelEn: 'Check negotiation results and unlock the Kepler dispute route.', action: 'claim_result' },
  ],
  mcc_campaign_ch5: [
    { id: 'briefing', labelKo: 'Kepler 분쟁 브리핑을 확인한다.', labelEn: 'Review the Kepler dispute briefing.', action: 'story' },
    { id: 'choice', labelKo: 'Roth 데이터 취득 전략을 선택한다.', labelEn: 'Choose your strategy for obtaining Roth data.', action: 'choice' },
    { id: 'fleet_expansion', labelKo: '함선 7척 이상을 함대에 배치한다.', labelEn: 'Deploy 7+ ships to your fleet.', action: 'fleet', stat: 'fleetShips', target: 7 },
    { id: 'combat_record', labelKo: '함대전을 누적 3회 이상 완료한다.', labelEn: 'Complete 3+ fleet battles total.', action: 'fleet_battle', stat: 'completedFleetBattles', target: 3 },
    { id: 'unlock_next', labelKo: '분쟁 결과를 확인하고 내부고발자 루트를 연다.', labelEn: 'Check dispute results and unlock the whistleblower route.', action: 'claim_result' },
  ],
  mcc_campaign_ch6: [
    { id: 'briefing', labelKo: '내부고발자 Li Fang 상황을 확인한다.', labelEn: 'Review the Li Fang whistleblower situation.', action: 'story' },
    { id: 'choice', labelKo: 'Li Fang 처리 방향(루트 A/B/C)을 결정한다.', labelEn: "Decide Li Fang's fate (Route A/B/C).", action: 'choice' },
    { id: 'proven_commander', labelKo: '함대전을 누적 3회 이상 완료해 신뢰를 증명한다.', labelEn: 'Complete 3+ fleet battles to prove your trustworthiness.', action: 'fleet_battle', stat: 'completedFleetBattles', target: 3 },
    { id: 'operation_timer', labelKo: '방사선 폭풍 속 작전을 완수한다.', labelEn: 'Complete the operation amid a radiation storm.', action: 'campaign_progress' },
    { id: 'unlock_next', labelKo: '루트 선택 결과를 확인하고 시장 전쟁 루트를 연다.', labelEn: 'Check route results and unlock the market war route.', action: 'claim_result' },
  ],
  mcc_campaign_ch7: [
    { id: 'briefing', labelKo: '시장 전쟁 브리핑과 경쟁 세력을 확인한다.', labelEn: 'Review the market war briefing and competing factions.', action: 'story' },
    { id: 'market_presence', labelKo: '마켓에 아이템 또는 함선을 2개 이상 등록한다.', labelEn: 'List 2+ items or ships on the market.', action: 'market', stat: 'marketListings', target: 2 },
    { id: 'tech_superiority', labelKo: '함선 스탯을 누적 3회 이상 강화한다.', labelEn: 'Upgrade ship stats 3+ times total.', action: 'shipyard', stat: 'shipUpgrades', target: 3 },
    { id: 'unlock_next', labelKo: '시장 점령 결과를 확인하고 프로메테우스 루트를 연다.', labelEn: 'Check market results and unlock the Prometheus route.', action: 'claim_result' },
  ],
  mcc_campaign_ch8: [
    { id: 'briefing', labelKo: 'Prometheus 시설 방어 브리핑을 확인한다.', labelEn: 'Review the Prometheus facility defense briefing.', action: 'story' },
    { id: 'fleet_power', labelKo: '함선 10척 이상을 함대에 배치해 방어 전력을 갖춘다.', labelEn: 'Deploy 10+ ships to your fleet for defense.', action: 'fleet', stat: 'fleetShips', target: 10 },
    { id: 'battle_hardened', labelKo: '함대전을 누적 5회 이상 완료한다.', labelEn: 'Complete 5+ fleet battles total.', action: 'fleet_battle', stat: 'completedFleetBattles', target: 5 },
    { id: 'operation_timer', labelKo: '4단계 환경 시퀀스를 견디며 Prometheus를 방어한다.', labelEn: 'Defend Prometheus through a 4-phase environmental sequence.', action: 'campaign_progress' },
    { id: 'unlock_next', labelKo: '방어 결과를 확인하고 깨진 동맹 루트를 연다.', labelEn: 'Check defense results and unlock the broken alliance route.', action: 'claim_result' },
  ],
  mcc_campaign_ch9: [
    { id: 'briefing', labelKo: '4전장 병렬 작전 브리핑을 확인한다.', labelEn: 'Review the 4-front parallel operation briefing.', action: 'story' },
    { id: 'choice', labelKo: 'Pilgrim Arms 공개 여부를 결정한다.', labelEn: 'Decide whether to expose Pilgrim Arms.', action: 'choice' },
    { id: 'war_veteran', labelKo: '함대전을 누적 7회 이상 완료해 전쟁 경력을 증명한다.', labelEn: 'Complete 7+ fleet battles to prove your war record.', action: 'fleet_battle', stat: 'completedFleetBattles', target: 7 },
    { id: 'unlock_next', labelKo: '동맹 해체 결과를 확인하고 최종 루트를 연다.', labelEn: 'Check alliance dissolution results and unlock the final route.', action: 'claim_result' },
  ],
  mcc_campaign_ch10: [
    { id: 'briefing', labelKo: 'MCC 주주 총회 최종 브리핑을 확인한다.', labelEn: 'Review the MCC shareholder assembly final briefing.', action: 'story' },
    { id: 'choice', labelKo: '최종 엔딩 선택지를 결정한다.', labelEn: 'Make your final ending choice.', action: 'choice' },
    { id: 'reward_claim', labelKo: '작전 보상을 수령해 MCC 캠페인을 마무리한다.', labelEn: 'Claim operation rewards to conclude the MCC campaign.', action: 'shipyard', stat: 'campaignRewardClaims', target: 1 },
    { id: 'unlock_next', labelKo: '엔딩을 확인하고 MCC 캠페인을 완결한다.', labelEn: 'View the ending and complete the MCC campaign.', action: 'claim_result' },
  ],

  // ── FSP CH2~CH10 ──────────────────────────────────────────────────────────
  fsp_campaign_ch2: [
    { id: 'briefing', labelKo: '얼음 캐러밴 브리핑을 확인한다.', labelEn: 'Review the ice caravan briefing.', action: 'story' },
    { id: 'fleet_ready', labelKo: '호송 함선 5척 이상을 함대에 배치한다.', labelEn: 'Deploy 5+ escort ships to your fleet.', action: 'fleet', stat: 'fleetShips', target: 5 },
    { id: 'resource_secured', labelKo: '영토 채굴을 누적 2회 이상 수행해 자원을 확보한다.', labelEn: 'Harvest territory resources 2+ times to secure supplies.', action: 'territory', stat: 'territoryHarvests', target: 2 },
    { id: 'operation_timer', labelKo: '얼음 호송 작전 진행률 100%를 달성한다.', labelEn: 'Reach 100% progress in the ice convoy operation.', action: 'campaign_progress' },
    { id: 'unlock_next', labelKo: '호송 결과를 확인하고 피의 광산 루트를 연다.', labelEn: 'Check convoy results and unlock the blood mine route.', action: 'claim_result' },
  ],
  fsp_campaign_ch3: [
    { id: 'briefing', labelKo: 'Verin-7 광산 해방 브리핑을 확인한다.', labelEn: 'Review the Verin-7 mine liberation briefing.', action: 'story' },
    { id: 'first_battle_fsp', labelKo: '함대전을 1회 이상 완료해 전투 역량을 증명한다.', labelEn: 'Complete 1+ fleet battle to prove combat capability.', action: 'fleet_battle', stat: 'completedFleetBattles', target: 1 },
    { id: 'choice', labelKo: '60명 잔류 광부 처우를 결정한다.', labelEn: 'Decide the fate of the 60 remaining miners.', action: 'choice' },
    { id: 'unlock_next', labelKo: '해방 결과를 확인하고 외교 루트를 연다.', labelEn: 'Check liberation results and unlock the diplomacy route.', action: 'claim_result' },
  ],
  fsp_campaign_ch4: [
    { id: 'briefing', labelKo: 'Cinder Grace 비밀 회담 브리핑을 확인한다.', labelEn: 'Review the Cinder Grace secret summit briefing.', action: 'story' },
    { id: 'choice', labelKo: 'CV 동맹 전략을 선택한다.', labelEn: 'Choose your CV alliance strategy.', action: 'choice' },
    { id: 'diplomatic_strength', labelKo: '함대전을 누적 2회 이상 완료해 외교적 영향력을 확보한다.', labelEn: 'Complete 2+ fleet battles to establish diplomatic influence.', action: 'fleet_battle', stat: 'completedFleetBattles', target: 2 },
    { id: 'operation_timer', labelKo: '회담 호위 작전 진행률 100%를 달성한다.', labelEn: 'Reach 100% progress in the summit escort operation.', action: 'campaign_progress' },
    { id: 'unlock_next', labelKo: '회담 결과를 확인하고 Kepler 공유지 루트를 연다.', labelEn: 'Check summit results and unlock the Kepler Commons route.', action: 'claim_result' },
  ],
  fsp_campaign_ch5: [
    { id: 'briefing', labelKo: 'Kepler 공유지 3파벌 회담 브리핑을 확인한다.', labelEn: 'Review the Kepler Commons tri-faction summit briefing.', action: 'story' },
    { id: 'choice', labelKo: 'Roth dead drop 처리와 회담 전략을 선택한다.', labelEn: 'Choose your Roth dead drop handling and summit strategy.', action: 'choice' },
    { id: 'fleet_strength_fsp', labelKo: '함선 5척 이상을 함대에 배치한다.', labelEn: 'Deploy 5+ ships to your fleet.', action: 'fleet', stat: 'fleetShips', target: 5 },
    { id: 'combat_record_fsp', labelKo: '함대전을 누적 2회 이상 완료한다.', labelEn: 'Complete 2+ fleet battles total.', action: 'fleet_battle', stat: 'completedFleetBattles', target: 2 },
    { id: 'unlock_next', labelKo: '공유지 협상 결과를 확인하고 두더지 루트를 연다.', labelEn: 'Check commons negotiation results and unlock the mole route.', action: 'claim_result' },
  ],
  fsp_campaign_ch6: [
    { id: 'briefing', labelKo: '내부 첩자 색출 브리핑을 확인한다.', labelEn: 'Review the internal spy hunt briefing.', action: 'story' },
    { id: 'choice', labelKo: 'Kenji Tanaka 처리 방식(처형/이중첩자/추방)을 결정한다.', labelEn: 'Decide how to handle Kenji Tanaka (execute/double agent/exile).', action: 'choice' },
    { id: 'fleet_integrity', labelKo: '함선 5척 이상을 함대에 배치해 정착지 수비 전력을 갖춘다.', labelEn: 'Deploy 5+ ships to maintain settlement defense force.', action: 'fleet', stat: 'fleetShips', target: 5 },
    { id: 'upgrade_commitment', labelKo: '함선 스탯을 1회 이상 강화한다.', labelEn: 'Upgrade a ship stat once.', action: 'shipyard', stat: 'shipUpgrades', target: 1 },
    { id: 'unlock_next', labelKo: '색출 결과를 확인하고 의회 루트를 연다.', labelEn: 'Check spy hunt results and unlock the assembly route.', action: 'claim_result' },
  ],
  fsp_campaign_ch7: [
    { id: 'briefing', labelKo: 'FSP 의회 소집 브리핑을 확인한다.', labelEn: 'Review the FSP assembly convening briefing.', action: 'story' },
    { id: 'choice', labelKo: '의회 의장 선출 전략을 결정한다.', labelEn: 'Decide your strategy for electing an assembly chair.', action: 'choice' },
    { id: 'market_influence', labelKo: '마켓에 함선 또는 자원을 2개 이상 등록해 경제적 영향력을 행사한다.', labelEn: 'List 2+ ships or resources on the market for economic influence.', action: 'market', stat: 'marketListings', target: 2 },
    { id: 'unlock_next', labelKo: '의회 결과를 확인하고 가이아 루트를 연다.', labelEn: 'Check assembly results and unlock the Gaia route.', action: 'claim_result' },
  ],
  fsp_campaign_ch8: [
    { id: 'briefing', labelKo: 'Gaia 건조 및 웨이브 방어 브리핑을 확인한다.', labelEn: 'Review the Gaia construction and wave defense briefing.', action: 'story' },
    { id: 'fleet_power_fsp', labelKo: '함선 10척 이상을 함대에 배치해 Gaia 방어 전력을 갖춘다.', labelEn: 'Deploy 10+ ships to establish Gaia defense force.', action: 'fleet', stat: 'fleetShips', target: 10 },
    { id: 'battle_hardened_fsp', labelKo: '함대전을 누적 4회 이상 완료한다.', labelEn: 'Complete 4+ fleet battles total.', action: 'fleet_battle', stat: 'completedFleetBattles', target: 4 },
    { id: 'operation_timer', labelKo: '웨이브 방어 작전 진행률 100%를 달성한다.', labelEn: 'Reach 100% progress in the wave defense operation.', action: 'campaign_progress' },
    { id: 'unlock_next', labelKo: '방어 결과를 확인하고 세 개의 깃발 루트를 연다.', labelEn: 'Check defense results and unlock the three flags route.', action: 'claim_result' },
  ],
  fsp_campaign_ch9: [
    { id: 'briefing', labelKo: 'MCC·FSP·CV 정상회담 브리핑을 확인한다.', labelEn: 'Review the MCC-FSP-CV summit briefing.', action: 'story' },
    { id: 'choice', labelKo: 'Pilgrim Arms 위기 속 보호 대상을 선택한다.', labelEn: 'Choose who to protect amid the Pilgrim Arms crisis.', action: 'choice' },
    { id: 'war_veteran_fsp', labelKo: '함대전을 누적 6회 이상 완료해 전쟁 경력을 증명한다.', labelEn: 'Complete 6+ fleet battles to prove your war record.', action: 'fleet_battle', stat: 'completedFleetBattles', target: 6 },
    { id: 'unlock_next', labelKo: '정상회담 결과를 확인하고 자유의 대가 루트를 연다.', labelEn: "Check summit results and unlock the Freedom's Price route.", action: 'claim_result' },
  ],
  fsp_campaign_ch10: [
    { id: 'briefing', labelKo: 'FSP 최종 평가 브리핑을 확인한다.', labelEn: 'Review the FSP final assessment briefing.', action: 'story' },
    { id: 'choice', labelKo: '최종 FSP 행동 방침을 결정한다.', labelEn: 'Make your final FSP decision.', action: 'choice' },
    { id: 'reward_claim_fsp', labelKo: '작전 보상을 수령해 FSP 캠페인을 마무리한다.', labelEn: 'Claim operation rewards to conclude the FSP campaign.', action: 'shipyard', stat: 'campaignRewardClaims', target: 1 },
    { id: 'unlock_next', labelKo: '최종 엔딩을 확인하고 FSP 캠페인을 완결한다.', labelEn: 'View the final ending and complete the FSP campaign.', action: 'claim_result' },
  ],

  // ── CV CH2~CH10 ───────────────────────────────────────────────────────────
  cv_campaign_ch2: [
    { id: 'briefing', labelKo: 'CV 2차 습격 브리핑을 확인한다.', labelEn: 'Review the CV second raid briefing.', action: 'story' },
    { id: 'first_battle_cv', labelKo: '함대전을 1회 이상 완료한다.', labelEn: 'Complete 1+ fleet battle.', action: 'fleet_battle', stat: 'completedFleetBattles', target: 1 },
    { id: 'fleet_line_cv', labelKo: '습격 함선 3척 이상을 함대에 배치한다.', labelEn: 'Deploy 3+ raid ships to your fleet.', action: 'fleet', stat: 'fleetShips', target: 3 },
    { id: 'unlock_next', labelKo: '습격 결과를 확인하고 다음 CV 작전을 연다.', labelEn: 'Check raid results and unlock the next CV operation.', action: 'claim_result' },
  ],
  cv_campaign_ch3: [
    { id: 'briefing', labelKo: 'CV 영토 확장 브리핑을 확인한다.', labelEn: 'Review the CV territory expansion briefing.', action: 'story' },
    { id: 'territory_seized', labelKo: '영토 2개 이상을 확보한다.', labelEn: 'Claim 2+ territories.', action: 'territory', stat: 'ownedClaims', target: 2 },
    { id: 'fleet_raid_ready', labelKo: '함선 5척 이상을 함대에 배치한다.', labelEn: 'Deploy 5+ ships to your fleet.', action: 'fleet', stat: 'fleetShips', target: 5 },
    { id: 'unlock_next', labelKo: '확장 결과를 확인하고 다음 CV 작전을 연다.', labelEn: 'Check expansion results and unlock the next CV operation.', action: 'claim_result' },
  ],
  cv_campaign_ch4: [
    { id: 'briefing', labelKo: 'CV 대형 작전 브리핑을 확인한다.', labelEn: 'Review the CV large-scale operation briefing.', action: 'story' },
    { id: 'choice', labelKo: '작전 전략을 선택한다.', labelEn: 'Choose your operation strategy.', action: 'choice' },
    { id: 'battle_proven_cv', labelKo: '함대전을 누적 2회 이상 완료한다.', labelEn: 'Complete 2+ fleet battles total.', action: 'fleet_battle', stat: 'completedFleetBattles', target: 2 },
    { id: 'unlock_next', labelKo: '작전 결과를 확인하고 다음 CV 루트를 연다.', labelEn: 'Check operation results and unlock the next CV route.', action: 'claim_result' },
  ],
  cv_campaign_ch5: [
    { id: 'briefing', labelKo: 'CV 세력 확장 브리핑을 확인한다.', labelEn: 'Review the CV force expansion briefing.', action: 'story' },
    { id: 'fleet_power_cv', labelKo: '함선 5척 이상을 함대에 배치한다.', labelEn: 'Deploy 5+ ships to your fleet.', action: 'fleet', stat: 'fleetShips', target: 5 },
    { id: 'combat_record_cv', labelKo: '함대전을 누적 3회 이상 완료한다.', labelEn: 'Complete 3+ fleet battles total.', action: 'fleet_battle', stat: 'completedFleetBattles', target: 3 },
    { id: 'unlock_next', labelKo: '확장 결과를 확인하고 다음 CV 작전을 연다.', labelEn: 'Check expansion results and unlock the next CV operation.', action: 'claim_result' },
  ],
  cv_campaign_ch6: [
    { id: 'briefing', labelKo: 'CV 기술 획득 브리핑을 확인한다.', labelEn: 'Review the CV technology acquisition briefing.', action: 'story' },
    { id: 'choice', labelKo: '기술 확보 전략을 선택한다.', labelEn: 'Choose your technology acquisition strategy.', action: 'choice' },
    { id: 'tech_upgrade_cv', labelKo: '함선 스탯을 누적 2회 이상 강화한다.', labelEn: 'Upgrade ship stats 2+ times total.', action: 'shipyard', stat: 'shipUpgrades', target: 2 },
    { id: 'unlock_next', labelKo: '기술 확보 결과를 확인하고 다음 CV 루트를 연다.', labelEn: 'Check technology results and unlock the next CV route.', action: 'claim_result' },
  ],
  cv_campaign_ch7: [
    { id: 'briefing', labelKo: 'CV 전략 자산 브리핑을 확인한다.', labelEn: 'Review the CV strategic asset briefing.', action: 'story' },
    { id: 'market_raid', labelKo: '마켓에 1개 이상 등록해 CV 경제 네트워크를 가동한다.', labelEn: 'List 1+ item on the market to activate the CV economic network.', action: 'market', stat: 'marketListings', target: 1 },
    { id: 'battle_elite_cv', labelKo: '함대전을 누적 4회 이상 완료한다.', labelEn: 'Complete 4+ fleet battles total.', action: 'fleet_battle', stat: 'completedFleetBattles', target: 4 },
    { id: 'unlock_next', labelKo: '자산 확보 결과를 확인하고 다음 CV 작전을 연다.', labelEn: 'Check asset results and unlock the next CV operation.', action: 'claim_result' },
  ],
  cv_campaign_ch8: [
    { id: 'briefing', labelKo: 'CV 총력전 브리핑을 확인한다.', labelEn: 'Review the CV all-out war briefing.', action: 'story' },
    { id: 'fleet_force_cv', labelKo: '함선 8척 이상을 함대에 배치해 총력전 전력을 갖춘다.', labelEn: 'Deploy 8+ ships for all-out war readiness.', action: 'fleet', stat: 'fleetShips', target: 8 },
    { id: 'war_machine_cv', labelKo: '함대전을 누적 5회 이상 완료한다.', labelEn: 'Complete 5+ fleet battles total.', action: 'fleet_battle', stat: 'completedFleetBattles', target: 5 },
    { id: 'operation_timer', labelKo: '총력전 진행률 100%를 달성한다.', labelEn: 'Reach 100% progress in the all-out war operation.', action: 'campaign_progress' },
    { id: 'unlock_next', labelKo: '총력전 결과를 확인하고 최종 루트를 연다.', labelEn: 'Check all-out war results and unlock the final route.', action: 'claim_result' },
  ],
  cv_campaign_ch9: [
    { id: 'briefing', labelKo: 'CV 최종 결전 브리핑을 확인한다.', labelEn: 'Review the CV final showdown briefing.', action: 'story' },
    { id: 'choice', labelKo: '최종 작전 방향을 선택한다.', labelEn: 'Choose your final operation direction.', action: 'choice' },
    { id: 'final_warrior_cv', labelKo: '함대전을 누적 7회 이상 완료해 CV 최강 전사임을 증명한다.', labelEn: 'Complete 7+ fleet battles to prove CV supremacy.', action: 'fleet_battle', stat: 'completedFleetBattles', target: 7 },
    { id: 'unlock_next', labelKo: '결전 결과를 확인하고 엔딩 루트를 연다.', labelEn: 'Check showdown results and unlock the ending route.', action: 'claim_result' },
  ],
  cv_campaign_ch10: [
    { id: 'briefing', labelKo: 'CV 최종 엔딩 브리핑을 확인한다.', labelEn: 'Review the CV final ending briefing.', action: 'story' },
    { id: 'choice', labelKo: '최종 CV 행동 방침을 결정한다.', labelEn: 'Make your final CV decision.', action: 'choice' },
    { id: 'reward_claim_cv', labelKo: '작전 보상을 수령해 CV 캠페인을 마무리한다.', labelEn: 'Claim operation rewards to conclude the CV campaign.', action: 'shipyard', stat: 'campaignRewardClaims', target: 1 },
    { id: 'unlock_next', labelKo: '최종 엔딩을 확인하고 CV 캠페인을 완결한다.', labelEn: 'View the final ending and complete the CV campaign.', action: 'claim_result' },
  ],
};

function normalizeWallet(wallet) {
  return String(wallet || '').toLowerCase().trim();
}

async function safeCampaignCount(sql, params) {
  try {
    const { rows } = await pool.query(sql, params);
    return parseInt(rows[0]?.count || rows[0]?.cnt || 0, 10) || 0;
  } catch (err) {
    console.warn('[campaign] objective count skipped:', err && err.message ? err.message : err);
    return 0;
  }
}

async function getSuccessfulShipUpgradeCount(wallet) {
  const hasSuccessColumn = await safeCampaignCount(`
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_name = 'ship_stat_upgrade_log'
      AND column_name = 'success'
  `, []);
  if (hasSuccessColumn) {
    return safeCampaignCount(`
      SELECT COUNT(*)
      FROM ship_stat_upgrade_log
      WHERE LOWER(wallet_address) = $1
        AND success = true
    `, [wallet]);
  }
  return safeCampaignCount(`
    SELECT COUNT(*)
    FROM ship_stat_upgrade_log
    WHERE LOWER(wallet_address) = $1
  `, [wallet]);
}

async function getObjectiveState(wallet) {
  const w = normalizeWallet(wallet);
  if (!w) {
    return {
      ownedClaims: 0,
      artClaims: 0,
      ownedShips: 0,
      activeShips: 0,
      fleetShips: 0,
      fleets: 0,
      marketListedShips: 0,
      marketListings: 0,
      completedFleetBattles: 0,
      shipUpgrades: 0,
      territoryHarvests: 0,
      campaignRewardClaims: 0,
      materialHarvests: 0,
      territoryUpgradeLevels: 0,
    };
  }
  const [
    ownedClaims,
    artClaims,
    ownedShips,
    activeShips,
    fleetShips,
    fleets,
    marketListedShips,
    marketplaceListings,
    completedFleetBattles,
    shipUpgrades,
    territoryHarvests,
    campaignRewardClaims,
    materialHarvests,
    territoryUpgradeLevels,
  ] = await Promise.all([
    safeCampaignCount(`SELECT COUNT(*) FROM claims WHERE LOWER(owner) = $1 AND deleted_at IS NULL`, [w]),
    safeCampaignCount(`SELECT COUNT(*) FROM claims WHERE LOWER(owner) = $1 AND deleted_at IS NULL AND COALESCE(image_url, '') <> ''`, [w]),
    safeCampaignCount(`SELECT COUNT(*) FROM ships WHERE LOWER(owner_wallet) = $1`, [w]),
    safeCampaignCount(`SELECT COUNT(*) FROM ships WHERE LOWER(owner_wallet) = $1 AND is_alive = true`, [w]),
    safeCampaignCount(`SELECT COUNT(*) FROM ships WHERE LOWER(owner_wallet) = $1 AND is_alive = true AND fleet_id IS NOT NULL AND COALESCE(is_market_listed, false) = false`, [w]),
    safeCampaignCount(`SELECT COUNT(*) FROM fleets WHERE LOWER(owner_wallet) = $1`, [w]),
    safeCampaignCount(`SELECT COUNT(*) FROM ships WHERE LOWER(owner_wallet) = $1 AND is_market_listed = true`, [w]),
    safeCampaignCount(`SELECT COUNT(*) FROM marketplace_listings WHERE LOWER(seller) = $1 AND status = 'active'`, [w]),
    safeCampaignCount(`
      SELECT COUNT(DISTINCT fb.id)
      FROM fleet_battles fb
      JOIN fleet_battle_participants p ON p.battle_id = fb.id
      WHERE LOWER(p.wallet_address) = $1 AND fb.status = 'ended'
    `, [w]),
    getSuccessfulShipUpgradeCount(w),
    safeCampaignCount(`SELECT COUNT(*) FROM transactions WHERE type = 'mining' AND LOWER(from_wallet) = $1`, [w]),
    safeCampaignCount(`SELECT COUNT(*) FROM campaign_reward_inbox WHERE LOWER(wallet) = $1 AND claimed = TRUE`, [w]),
    // P5: material harvests (harvests with at least one resource drop)
    safeCampaignCount(`
      SELECT COUNT(*) FROM transactions
      WHERE type = 'mining' AND LOWER(from_wallet) = $1
        AND meta->'resourceDrops' IS NOT NULL
        AND jsonb_array_length(COALESCE(meta->'resourceDrops','[]'::jsonb)) > 0
    `, [w]),
    // P5: territory upgrade count (total upgrade levels owned)
    safeCampaignCount(`SELECT COALESCE(SUM(level),0) FROM territory_upgrades WHERE LOWER(owner) = $1 AND is_active = true`, [w]),
  ]);
  const marketListings = marketListedShips + marketplaceListings;
  return {
    ownedClaims,
    artClaims,
    ownedShips,
    activeShips,
    fleetShips,
    fleets,
    marketListedShips,
    marketListings,
    completedFleetBattles,
    shipUpgrades,
    territoryHarvests,
    campaignRewardClaims,
    materialHarvests,
    territoryUpgradeLevels,
  };
}

function objectivePresetForChapter(chapter) {
  if (!chapter) return [];
  if (OBJECTIVE_PRESETS[chapter.questId]) return OBJECTIVE_PRESETS[chapter.questId];
  if (chapter.chapterNumber === 0) return OBJECTIVE_PRESETS.prologue;
  if (chapter.battleResolution === 'server_simulation') {
    return [
      { id: 'briefing', labelKo: '작전 브리핑과 선택지를 확인한다.', action: 'story' },
      { id: 'operation_timer', labelKo: '서버 작전 진행률 100%를 달성한다.', action: 'campaign_progress' },
      { id: 'unlock_next', labelKo: '결과를 확인하고 다음 챕터를 연다.', action: 'claim_result' },
    ];
  }
  return [
    { id: 'story', labelKo: '스토리를 확인한다.', action: 'story' },
    { id: 'result', labelKo: '결과를 확인한다.', action: 'claim_result' },
  ];
}

function applyLiveObjectiveState(objective, state) {
  if (!objective?.stat) return objective;
  const current = Math.max(0, parseInt(state?.[objective.stat] || 0, 10) || 0);
  const target = Math.max(1, parseInt(objective.target || 1, 10) || 1);
  return {
    ...objective,
    current,
    target,
    requirementMet: current >= target,
  };
}

function isObjectiveDone(objective, chapter, progress, options = {}) {
  if (objective?.stat) return objective.requirementMet === true;
  const status = progress?.status || 'new';
  const active = status === 'in_progress' || status === 'completed' || status === 'claimed';
  if (objective?.action === 'story') return active;
  if (objective?.action === 'campaign_progress') return Number(options.progressPct || 0) >= 100;
  if (objective?.action === 'choice') {
    const choices = Array.isArray(progress?.choices_payload) ? progress.choices_payload : [];
    return choices.length > 0 || !Array.isArray(chapter?.choices) || chapter.choices.length === 0;
  }
  return false;
}

function getMissingRequiredObjectives(objectives) {
  return (objectives || [])
    .filter(o => o?.stat && o.requirementMet !== true && !o.optional)  // optional objectives don't block
    .map(o => ({
      id: o.id,
      labelKo: o.labelKo,
      label: { ko: o.labelKo, en: o.labelEn || o.labelKo },
      action: o.action,
      stat: o.stat,
      current: o.current || 0,
      target: o.target || 1,
      state: o.state || 'active',
    }));
}

function buildChapterObjectives(chapter, progress, objectiveState, options = {}) {
  const objectives = objectivePresetForChapter(chapter);
  const status = progress?.status || 'new';
  const completed = status === 'completed' || status === 'claimed';
  let firstOpenAssigned = false;
  return objectives.map((rawObjective, index) => {
    const objective = applyLiveObjectiveState(rawObjective, objectiveState);
    let state = 'pending';
    if (completed) state = 'done';
    else if (isObjectiveDone(objective, chapter, progress, options)) state = 'done';
    else if (!firstOpenAssigned && (status === 'in_progress' || index === 0)) {
      state = 'active';
      firstOpenAssigned = true;
    }
    // expose multilingual label so client can pick the right language
    const labelObj = { ko: objective.labelKo, en: objective.labelEn || objective.labelKo };
    return { ...objective, label: labelObj, state };
  });
}

function publicChapter(chapter, progress, objectiveState) {
  const objectives = buildChapterObjectives(chapter, progress, objectiveState);
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
    scenes: chapter.scenesFile ? loadScenesFile(chapter.scenesFile) : null,
    briefing: chapter.briefing,
    choices: chapter.choices.map(c => ({ id: c.id, labelKo: c.labelKo, label: { ko: c.labelKo, en: c.labelEn || c.labelKo } })),
    objectives,
    nextObjective: objectives.find(o => o.state !== 'done') || objectives[objectives.length - 1] || null,
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
    try {
      await client.query(
        `INSERT INTO reputation_history (wallet, faction, delta, before_value, after_value, source_type, source_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [wallet, faction, after - before, before, after, sourceType, sourceId]
      );
    } catch (_rh) { /* reputation_history 테이블 없어도 평판 업데이트는 유지 */ }
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
  const militiaDestroyed = facilityHp >= 65 && elapsed <= 2100 && civilianCasualties === 0 ? 4 : Math.max(1, Math.floor(roll * 4));
  let failure = null;
  if (civilianCasualties > 0) failure = 'fail_civilian_massacre';
  else if (facilityHp < 65) failure = 'fail_facility_destroyed';
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

function simulateCh5(progress) {
  const choiceId = selectedChoiceId(progress, 'ch5_block_fsp');
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}:ch5`);
  const branch = choiceId.replace('ch5_', '');
  let oxygen = Math.round(clampNumber(100 - roll * 30 - (choiceId === 'ch5_escort_supply' ? 5 : 15), 0, 100));
  let elapsed = Math.round((choiceId === 'ch5_escort_supply' ? 2100 : choiceId === 'ch5_solo_data' ? 980 : 1180) * (0.86 + roll * 0.22));
  let failure = null;
  if (oxygen <= 0) failure = 'fail_oxygen_depleted';
  if (choiceId === 'ch5_solo_data' && roll < 0.22) failure = 'fail_solo_data_caught';
  if (choiceId === 'ch5_escort_supply' && roll < 0.12) failure = 'fail_supply_lost';
  const secondary = ['obj_witness_roth_message'];
  if (!failure && roll > 0.42) secondary.push('obj_no_player_ship_lost');
  return {
    success: !failure,
    failureReason: failure,
    branchChoice: branch,
    metrics: {
      tactical_choice: branch,
      oxygen_remaining_percent: oxygen,
      fleet_efficiency_percent: oxygen <= 0 ? 50 : 100,
      elapsed_sec: elapsed,
      data_server_status: choiceId === 'ch5_solo_data' && !failure ? 'mcc_solo_obtained' : !failure ? 'mcc_owned' : 'untouched',
      roth_message_received: true,
      environmental_phase_reached: phaseForChapter(CH5_ID, elapsed),
      secondary_completed: secondary,
    },
  };
}

function simulateCh6(progress) {
  const choiceId = selectedChoiceId(progress, 'ch6_report_chen');
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}:ch6`);
  const branch = choiceId === 'ch6_help_lifang' ? 'branch_a' : choiceId === 'ch6_copy_silent' ? 'branch_c' : 'branch_b';
  let failure = null;
  let elapsed = branch === 'branch_a' ? Math.round(1150 + roll * 320) : branch === 'branch_c' ? Math.round(250 + roll * 210) : Math.round(220 + roll * 80);
  const lifangHp = branch === 'branch_a' ? Math.round(62 + (1 - roll) * 38) : branch === 'branch_b' ? 35 : 100;
  if (branch === 'branch_a' && roll < 0.08) failure = 'fail_lifang_killed';
  if (branch === 'branch_b' && roll < 0.05) failure = 'fail_lifang_escapes_during_subdue';
  if (branch === 'branch_c' && roll < 0.16) failure = 'fail_caught_copying';
  const secondary = [];
  if (!failure && branch === 'branch_a' && roll > 0.55) secondary.push('obj_minimize_armor_damage');
  if (!failure && branch === 'branch_a' && lifangHp >= 95) secondary.push('obj_lifang_shuttle_full_hp');
  if (!failure && branch === 'branch_c' && roll > 0.5) secondary.push('obj_stealth_perfect');
  return {
    success: !failure,
    failureReason: failure,
    branchChoice: branch,
    metrics: {
      route_branch: branch,
      elapsed_sec: elapsed,
      lifang_shuttle_hp_percent: lifangHp,
      chen_suspicion: branch === 'branch_c' && failure ? 'active' : 'none',
      assassins_destroyed: branch === 'branch_a' && !failure ? 9 : 0,
      environmental_phase_reached: phaseForChapter(CH6_ID, elapsed),
      secondary_completed: secondary,
    },
  };
}

function simulateCh7(progress) {
  const choiceId = selectedChoiceId(progress, 'ch7b_standard');
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}:ch7`);
  const branch = choiceId.startsWith('ch7a_') ? 'branch_a' : choiceId.startsWith('ch7c_') ? 'branch_c' : 'branch_b';
  let failure = null;
  let elapsed = Math.round(1120 + roll * 360);
  if (branch === 'branch_a' && choiceId === 'ch7a_sequential' && roll < 0.28) failure = 'fail_one_warlord_escapes';
  if (branch !== 'branch_a' && roll < 0.08) failure = 'fail_helion_intel_leak';
  if (elapsed > 1500) failure = failure || 'fail_time_exceeded';
  const secondary = [];
  if (!failure && branch === 'branch_a' && choiceId === 'ch7a_dual_attack') secondary.push('obj_warlord_assassinated_personally');
  if (!failure && branch !== 'branch_a') secondary.push('obj_zero_helion_escapes');
  if (!failure && choiceId === 'ch7b_helion_hq') secondary.push('obj_helion_hq_struck');
  return {
    success: !failure,
    failureReason: failure,
    branchChoice: branch,
    metrics: {
      route_branch: branch,
      elapsed_sec: elapsed,
      warlords_killed: !failure && branch === 'branch_a' ? 2 : failure === 'fail_one_warlord_escapes' ? 1 : 0,
      battlefields_cleared: !failure && branch !== 'branch_a' ? 3 : 0,
      helion_stock_drop_pct: !failure && branch !== 'branch_a' ? 40 : 0,
      environmental_phase_reached: phaseForChapter(CH7_ID, elapsed),
      secondary_completed: secondary,
    },
  };
}

function simulateCh8(progress) {
  const choiceId = selectedChoiceId(progress, 'ch8b_standard');
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}:ch8`);
  const branch = choiceId.startsWith('ch8a_') ? 'branch_a' : choiceId.startsWith('ch8c_') ? 'branch_c' : 'branch_b';
  const secondary = [];
  if (branch === 'branch_a') {
    const collabBonus = choiceId === 'ch8a_kara_command' ? 0.18 : choiceId === 'ch8a_distributed' ? -0.16 : 0;
    const elapsed = Math.round((choiceId === 'ch8a_distributed' ? 1040 : 920) * (0.86 + roll * 0.26));
    const criticalSystemsDestroyed = Math.max(0, Math.min(5, Math.floor(3 + (1 - roll + collabBonus) * 3)));
    const chenHuntSuccess = choiceId === 'ch8a_chen_hunt' && roll > 0.58;
    let failure = null;
    if (elapsed > 1080) failure = 'fail_caught_outside_window';
    if (criticalSystemsDestroyed < 3) failure = failure || 'fail_critical_systems_intact';
    if (!failure && criticalSystemsDestroyed >= 5) secondary.push('obj_5_critical_systems_destroyed');
    if (!failure && roll > 0.32) secondary.push('obj_zero_collab_npc_lost');
    return {
      success: !failure || chenHuntSuccess,
      failureReason: chenHuntSuccess ? null : failure,
      branchChoice: branch,
      metrics: {
        route_branch: branch,
        elapsed_sec: elapsed,
        critical_systems_destroyed: criticalSystemsDestroyed,
        shipyard_hp_percent: failure ? 70 : 0,
        prometheus_completion_percent: chenHuntSuccess ? 0 : failure ? 100 : 0,
        chen_hunt_success: chenHuntSuccess,
        environmental_phase_reached: phaseForChapter(CH8_ID, elapsed),
        secondary_completed: secondary,
      },
    };
  }

  const intelBonus = choiceId === 'ch8b_intel' ? 8 : 0;
  const acceleratePenalty = choiceId === 'ch8b_accelerate' ? 12 : 0;
  const suspicionPenalty = choiceId === 'ch8c_standard' ? 6 : choiceId === 'ch8c_partial_truth' ? 10 : 0;
  const hp = Math.round(clampNumber(82 + (1 - roll) * 18 + intelBonus - acceleratePenalty - suspicionPenalty, 0, 100));
  const elapsed = choiceId === 'ch8b_accelerate' ? Math.round(1440 + roll * 150) : Math.round(2050 + roll * 110);
  let failure = null;
  if (hp < 50) failure = 'fail_shipyard_destroyed';
  else if (hp < 60) failure = 'fail_prometheus_incomplete';
  if (!failure && hp >= 90) secondary.push('obj_perfect_defense');
  if (!failure && roll > 0.46) secondary.push('obj_zero_player_ship_lost');
  if (!failure && (choiceId === 'ch8b_intel' || choiceId === 'ch8c_alibi')) secondary.push('obj_phase_4_prepared');
  return {
    success: !failure,
    failureReason: failure,
    branchChoice: branch,
    metrics: {
      route_branch: branch,
      elapsed_sec: elapsed,
      shipyard_hp_percent: hp,
      waves_repelled: failure ? 2 : 3,
      prometheus_completion_percent: failure ? Math.max(0, hp - 20) : 100,
      current_phase: phaseForChapter(CH8_ID, elapsed),
      environmental_phase_reached: phaseForChapter(CH8_ID, elapsed),
      secondary_completed: secondary,
    },
  };
}

function simulateCh9(progress) {
  const choiceId = selectedChoiceId(progress, 'ch9_lead_kepler');
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}:ch9`);
  const branch = choiceId.startsWith('ch9a_') ? 'branch_a' : 'branch_b_or_c';
  const battlefield = choiceId.includes('olympus') ? 'olympus'
    : choiceId.includes('hellas') ? 'hellas'
      : choiceId.includes('valles') ? 'valles'
        : 'kepler';
  const difficulty = battlefield === 'olympus' ? 3 : battlefield === 'valles' ? 4 : 5;
  const chosenProgress = Math.round(clampNumber(102 - difficulty * 8 + (1 - roll) * 30 + (branch === 'branch_a' ? 8 : 0), 0, 100));
  const npcLosses = Math.max(0, Math.floor((roll * 4) - (branch === 'branch_a' ? 0.5 : 0)));
  const pilgrimDestroyed = Math.min(24, Math.round(10 + (1 - roll) * 10 + (battlefield === 'kepler' ? 4 : 0)));
  const secondary = [];
  if (pilgrimDestroyed >= 24) secondary.push('obj_destroy_pilgrim_arms_squadron');
  if (branch === 'branch_a' && npcLosses === 0) secondary.push('obj_zero_critical_npc_lost');
  let failure = null;
  if (chosenProgress < 55) failure = 'fail_chosen_battlefield_lost';
  if (npcLosses >= 3) failure = failure || 'fail_majority_battlefields_lost';
  return {
    success: !failure,
    failureReason: failure,
    branchChoice: branch,
    metrics: {
      route_branch: branch,
      chosen_battlefield: battlefield,
      chosen_battlefield_progress: chosenProgress,
      other_battlefields_npc_results: {
        olympus: battlefield === 'olympus' ? 'player_led' : roll < 0.78 ? 'held' : 'lost',
        hellas: battlefield === 'hellas' ? 'player_led' : roll < 0.64 ? 'contested' : 'lost',
        valles: battlefield === 'valles' ? 'player_led' : roll < 0.70 ? 'won' : 'lost',
        kepler: battlefield === 'kepler' ? 'player_led' : roll < 0.72 ? 'secured' : 'contested',
      },
      pilgrim_arms_destroyed: pilgrimDestroyed,
      critical_npc_status: choiceId.includes('kill_amara') ? 'amara_dead'
        : choiceId.includes('capture_amara') ? 'amara_captured'
          : choiceId.includes('kill_butcher') ? 'butcher_dead'
            : choiceId.includes('flee') ? 'butcher_escaped'
              : choiceId.startsWith('ch9a_') ? 'chen_weiss_at_kepler'
                : 'none',
      elapsed_sec: Math.round(1900 + roll * 480),
      environmental_phase_reached: 0,
      secondary_completed: secondary,
    },
  };
}

function simulateCh10(progress) {
  const ending = selectedChoiceId(progress, 'bad_ending_dismissed');
  return {
    success: true,
    failureReason: null,
    branchChoice: ending,
    metrics: {
      chosen_ending: ending,
      elapsed_sec: 900,
      cinematic_only: true,
      environmental_phase_reached: 0,
      secondary_completed: ['mcc_route_completed'],
    },
  };
}

function simulateFspCh1(progress) {
  const choiceId = selectedChoiceId(progress, 'fsp_ch1_accept_standard');
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}:fsp1`);
  const civilian = choiceId === 'fsp_ch1_prioritize_patients';
  const elapsed = Math.round((civilian ? 650 : 760) * (0.88 + roll * 0.24));
  const alphaHp = Math.round(clampNumber(96 - roll * 22, 0, 100));
  const betaHp = Math.round(clampNumber(92 - roll * 28 + (civilian ? 8 : 0), 0, 100));
  const raidersDestroyed = Math.min(10, Math.max(6, Math.round(10 - roll * 3 + (civilian ? 0 : 1))));
  const patient1 = betaHp <= 0 || elapsed > 760 ? 'dead' : elapsed > 720 ? 'critical' : 'stable';
  const patient2 = betaHp <= 0 || elapsed > 680 ? 'dead' : elapsed > 600 ? 'critical' : 'stable';
  const secondary = [];
  if (raidersDestroyed >= 10) secondary.push('obj_zero_cv_escapes');
  if (alphaHp >= 95 && betaHp >= 95) secondary.push('obj_cargo_full_hp');
  if (elapsed <= 900) secondary.push('obj_finish_under_15min');
  if (patient1 !== 'dead' && patient2 !== 'dead') secondary.push('patients_both_alive');
  let failure = null;
  if (alphaHp <= 0 && betaHp <= 0) failure = 'fail_total_loss';
  else if (alphaHp <= 0 || betaHp <= 0) failure = 'fail_cargo_lost';
  else if (patient1 === 'dead' || patient2 === 'dead') failure = 'fail_patient_died';
  return {
    success: !failure,
    failureReason: failure,
    metrics: {
      cargo_alpha_hp_percent: alphaHp,
      cargo_beta_hp_percent: betaHp,
      patient_1_status: patient1,
      patient_2_status: patient2,
      cv_raiders_destroyed: raidersDestroyed,
      elapsed_sec: elapsed,
      environmental_phase_reached: phaseForChapter(FSP_CH1_ID, elapsed),
      secondary_completed: secondary,
    },
  };
}

function simulateFspCh2(progress) {
  const choiceId = selectedChoiceId(progress, 'fsp_ch2_lena_command');
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}:fsp2`);
  const lena = choiceId === 'fsp_ch2_lena_command' || choiceId === 'fsp_ch2_question_storm';
  const split = choiceId === 'fsp_ch2_split_convoy';
  const eclipsesUsed = Math.max(2, Math.min(5, Math.round(5 - roll * 2 + (lena ? 1 : 0))));
  const timeLost = roll < (split ? 0.22 : 0.12) ? 200 : 0;
  const elapsed = Math.round(1080 + timeLost - eclipsesUsed * 60 + (split ? 70 : 0));
  const solarLoss = elapsed <= 720 ? 0 : elapsed <= 900 ? (elapsed - 720) * 0.08 : 14.4 + (elapsed - 900) * 0.16;
  const iceRemaining = Math.round(clampNumber(800 - solarLoss, 0, 800));
  const icePct = Math.round((iceRemaining / 800) * 100);
  const lenaHp = Math.round(clampNumber(96 - roll * (split ? 45 : 28), 0, 100));
  const cvDestroyed = Math.min(10, Math.max(5, Math.round(8 + (1 - roll) * 3 + (lena ? 1 : 0))));
  const secondary = [];
  if (icePct >= 90) secondary.push('obj_ice_90_percent');
  if (cvDestroyed >= 10) secondary.push('obj_zero_cv_escapes');
  if (eclipsesUsed >= 5) secondary.push('obj_no_eclipse_misses');
  if (lenaHp >= 95) secondary.push('lena_survives_full_hp');
  let failure = null;
  if (lenaHp <= 0) failure = 'fail_lena_dead';
  else if (icePct < 70) failure = 'fail_ice_below_70';
  else if (elapsed > 1800) failure = 'fail_timeout';
  return {
    success: !failure,
    failureReason: failure,
    metrics: {
      ice_remaining_kt: iceRemaining,
      ice_loss_to_solar: Math.round(800 - iceRemaining),
      ice_remaining_percent: icePct,
      eclipses_used: eclipsesUsed,
      cv_raiders_destroyed: cvDestroyed,
      elapsed_sec: elapsed,
      lena_hp_percent: lenaHp,
      environmental_phase_reached: phaseForChapter(FSP_CH2_ID, elapsed),
      secondary_completed: secondary,
    },
  };
}

function simulateFspCh3(progress) {
  const choiceId = selectedChoiceId(progress, 'fsp_ch3_official_op');
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}:fsp3`);
  const official = choiceId === 'fsp_ch3_official_op';
  const solo = choiceId === 'fsp_ch3_solo_op';
  const intel = choiceId === 'fsp_ch3_question_intel';
  const diplomacy = choiceId === 'fsp_ch3_diplomatic_attempt';
  const alarmChance = intel ? 0.15 : diplomacy ? 0.30 : 0.50;
  const alarm = roll < alarmChance;
  const disabled = alarm ? 5 : intel ? 4 : 4 + Math.round((1 - roll) * 1);
  const rescuePct = Math.round(clampNumber(82 + (official ? 12 : 0) - (solo ? 10 : 0) + (intel ? 8 : 0) - (alarm ? 8 : 0) - roll * 8, 50, 100));
  const minersRescued = Math.round(412 * rescuePct / 100);
  const elapsed = Math.round(1460 + roll * 260 + (alarm ? 160 : 0) + (solo ? 80 : 0));
  const secondary = [];
  if (rescuePct >= 90) secondary.push('obj_rescue_90_percent');
  if (!alarm) secondary.push('obj_no_alarm_triggered');
  if (intel || diplomacy) secondary.push('obj_60_stayers_respected');
  if (roll > 0.35) secondary.push('obj_no_player_ship_lost');
  let failure = null;
  if (rescuePct < 80) failure = 'fail_miners_below_80_percent';
  else if (elapsed > 1800) failure = 'fail_timeout';
  return {
    success: !failure,
    failureReason: failure,
    metrics: {
      miners_rescued: minersRescued,
      miners_rescued_percent: rescuePct,
      oxygen_regulators_disabled: disabled,
      alarm_status: alarm ? 'triggered' : 'silent',
      elapsed_sec: elapsed,
      mcc_reinforcement_eta: alarm ? Math.max(0, 1800 - elapsed) : null,
      respected_60_stayers: secondary.includes('obj_60_stayers_respected'),
      environmental_phase_reached: phaseForChapter(FSP_CH3_ID, elapsed),
      secondary_completed: secondary,
    },
  };
}

function simulateFspCh4(progress) {
  const choiceId = selectedChoiceId(progress, 'fsp_ch4_propose_intel_exchange');
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}:fsp4`);
  const evidence = choiceId === 'fsp_ch4_evidence_share';
  const refuge = choiceId === 'fsp_ch4_offer_settlement_refuge';
  const supply = choiceId === 'fsp_ch4_offer_supply_share';
  const intel = choiceId === 'fsp_ch4_propose_intel_exchange';
  const walkAway = choiceId === 'fsp_ch4_walk_away';
  const trustBase = evidence ? 92 : refuge ? 72 : supply ? 62 : intel ? 50 : 18;
  const cinderTrust = Math.round(clampNumber(trustBase + (1 - roll) * 12, 0, 100));
  const elapsed = Math.round((evidence ? 820 : refuge ? 900 : supply ? 980 : intel ? 1040 : 1160) * (0.9 + roll * 0.2));
  const detection = Math.round(clampNumber((elapsed - 760) / 4 + roll * 18 + (walkAway ? 35 : 0), 0, 100));
  const combatEngaged = walkAway || (elapsed >= 1080 && detection >= 80 && roll < 0.55);
  const eclipseEscape = elapsed >= 1080 && !combatEngaged;
  const amaraHp = combatEngaged ? Math.round(clampNumber(92 - roll * 55, 0, 100)) : 100;
  const secondary = [];
  if (elapsed < 900) secondary.push('obj_finish_under_15min');
  if (!combatEngaged && !walkAway) secondary.push('obj_no_combat_at_all');
  if (eclipseEscape) secondary.push('obj_use_eclipse_escape');
  let failure = null;
  if (amaraHp <= 0) failure = 'fail_amara_killed';
  else if (cinderTrust < 20 && !walkAway) failure = 'fail_negotiation_collapsed';
  else if (detection >= 100 && combatEngaged) failure = 'fail_mcc_full_engagement';
  return {
    success: !failure && !walkAway,
    failureReason: walkAway ? 'negotiation_walked_away' : failure,
    branchChoice: choiceId.replace('fsp_ch4_', ''),
    metrics: {
      negotiation_phase: failure || walkAway ? 'collapsed' : 'resolution',
      amara_hp_percent: amaraHp,
      elapsed_sec: elapsed,
      mcc_detection_progress: detection,
      cinder_trust_score: cinderTrust,
      combat_engaged: combatEngaged,
      eclipse_escape_used: eclipseEscape,
      environmental_phase_reached: phaseForChapter(FSP_CH4_ID, elapsed),
      secondary_completed: secondary,
    },
  };
}

function simulateFspCh5(progress) {
  const choiceId = selectedChoiceId(progress, 'fsp_ch5_propose_commons');
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}:fsp5`);
  const commons = choiceId === 'fsp_ch5_propose_commons';
  const arbitration = choiceId === 'fsp_ch5_propose_fsp_arbitration';
  const evidence = choiceId === 'fsp_ch5_propose_evidence_lever';
  const combat = choiceId === 'fsp_ch5_force_combat';
  const disclosure = choiceId === 'fsp_ch5_propose_global_disclosure';
  const elapsed = Math.round((commons ? 1420 : arbitration ? 1280 : evidence ? 1380 : combat ? 1660 : 1180) * (0.92 + roll * 0.16));
  const mccAcceptance = Math.round(clampNumber((commons ? 52 : arbitration ? 68 : evidence ? 34 : combat ? 5 : 12) + (1 - roll) * 28, 0, 100));
  const cvAttitude = evidence || disclosure ? 'volatile' : combat ? 'hostile' : arbitration ? 'cooperative' : 'neutral';
  const combatEngaged = combat || (commons && mccAcceptance < 50) || (elapsed >= 1700 && roll < 0.35);
  const amaraHp = combatEngaged ? Math.round(clampNumber(95 - roll * 36, 0, 100)) : 100;
  const liangHp = combatEngaged ? Math.round(clampNumber(92 - roll * 42, 0, 100)) : 100;
  const oxygenReserve = Math.round(clampNumber(100 - elapsed / 18, 0, 100));
  const secondary = [];
  if (elapsed < 1500) secondary.push('obj_summit_under_25min');
  if (amaraHp >= 100 && liangHp >= 100) secondary.push('obj_zero_civilian_casualty');
  if (commons || arbitration || disclosure) secondary.push('obj_legitimize_liang');
  let failure = null;
  if (amaraHp <= 0) failure = 'fail_amara_killed';
  else if (liangHp <= 0) failure = 'fail_liang_killed';
  else if (elapsed >= 1800) failure = 'fail_oxygen_evacuation';
  else if (!combat && mccAcceptance <= 8) failure = 'fail_summit_collapsed';
  return {
    success: !failure,
    failureReason: failure,
    branchChoice: choiceId.replace('fsp_ch5_', ''),
    metrics: {
      summit_phase: failure ? 'collapsed' : 'resolution',
      amara_hp_percent: amaraHp,
      liang_wei_hp_percent: liangHp,
      elapsed_sec: elapsed,
      oxygen_reserve_percent: oxygenReserve,
      mcc_acceptance_score: mccAcceptance,
      cv_attitude_dynamic: cvAttitude,
      combat_engaged: combatEngaged,
      environmental_phase_reached: phaseForChapter(FSP_CH5_ID, elapsed),
      secondary_completed: secondary,
    },
  };
}

function simulateFspCh6(progress) {
  const choiceId = selectedChoiceId(progress, 'fsp_ch6_use_as_handler');
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}:fsp6`);
  const wrong = choiceId === 'fsp_ch6_accuse_wrong';
  const handler = choiceId === 'fsp_ch6_use_as_handler';
  const execute = choiceId === 'fsp_ch6_execute_kenji';
  const clues = wrong ? Math.round(3 + roll * 3) : handler ? Math.round(6 + (1 - roll) * 3) : Math.round(5 + (1 - roll) * 4);
  const required = 5;
  const motiveRevealed = handler || clues >= 7 || roll > 0.45;
  const elapsed = Math.round((handler ? 1460 : execute ? 1320 : wrong ? 1680 : 1500) * (0.92 + roll * 0.16));
  const panic = Math.round(clampNumber(elapsed / 30, 0, 60));
  const secondary = [];
  if (clues >= 9) secondary.push('obj_collect_all_9_clues');
  if (clues >= 7 && !wrong) secondary.push('obj_exonerate_innocents');
  if (elapsed < 1500) secondary.push('obj_under_25min');
  if (motiveRevealed) secondary.push('obj_truth_revealed');
  let failure = null;
  if (wrong) failure = 'fail_wrong_accusation';
  else if (elapsed >= 1800) failure = 'fail_time_expired';
  else if (clues < required) failure = 'fail_clues_insufficient';
  return {
    success: !failure,
    failureReason: failure,
    branchChoice: choiceId.replace('fsp_ch6_', ''),
    metrics: {
      clues_collected: clues,
      clues_required: required,
      kenji_score: wrong ? 42 : 92,
      sarah_score: wrong ? 70 : 18,
      diego_score: wrong ? 62 : 15,
      interrogation_progress: failure ? 55 : 100,
      civilian_panic_level: panic,
      elapsed_sec: elapsed,
      decision_phase: failure ? 'failed' : 'resolved',
      kenji_motive_revealed: motiveRevealed,
      mcc_attack_advance_warning: handler ? 'partial_misdirected' : execute ? 'full' : wrong ? 'none' : 'minimal',
      environmental_phase_reached: phaseForChapter(FSP_CH6_ID, elapsed),
      secondary_completed: secondary,
    },
  };
}

function simulateFspCh7(progress) {
  const choiceId = selectedChoiceId(progress, 'fsp_ch7_support_mikhail');
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}:fsp7`);
  const supportMap = {
    fsp_ch7_support_mikhail: 'mikhail_anders',
    fsp_ch7_support_liang: 'liang_wei',
    fsp_ch7_support_amara: 'amara_okafor',
    fsp_ch7_support_diego: 'diego_cole',
    fsp_ch7_run_for_chair: 'player_self_run',
  };
  const winner = supportMap[choiceId] || 'mikhail_anders';
  const playerRun = winner === 'player_self_run';
  const baseSupport = playerRun ? 0.58 : winner === 'liang_wei' ? 0.63 : winner === 'amara_okafor' ? 0.61 : winner === 'diego_cole' ? 0.56 : 0.66;
  const support = clampNumber(baseSupport + (1 - roll) * 0.18, 0, 0.95);
  const crisis = clampNumber(0.62 + (1 - roll) * 0.35 - (playerRun ? 0.1 : 0), 0, 1);
  const morale = Math.round(clampNumber(48 + support * 35 + crisis * 12 - (playerRun ? 18 : 0), 0, 100));
  const elapsed = Math.round((playerRun ? 1760 : support >= 0.8 ? 1120 : 1450) * (0.94 + roll * 0.12));
  const secondary = [];
  if (support >= 0.8) secondary.push('obj_unanimity_chair');
  if (crisis >= 1) secondary.push('obj_environmental_crisis_resolved');
  if (morale >= 30) secondary.push('obj_civilian_morale_above_30');
  if (elapsed <= 1200) secondary.push('obj_quick_consensus');
  if (support >= (playerRun ? 0.73 : 0.5) && crisis >= 1 && morale >= 30) secondary.push('obj_dual_track_perfect');
  let failure = null;
  if (support < (playerRun ? 0.73 : 0.5)) failure = 'fail_deadlock_no_chair';
  else if (morale <= 0) failure = 'fail_assembly_riot';
  else if (crisis < 0.3 && elapsed >= 1500) failure = 'fail_environmental_crisis_critical_escalation';
  return {
    success: !failure,
    failureReason: failure,
    branchChoice: choiceId.replace('fsp_ch7_', ''),
    metrics: {
      chair_elected: !failure ? winner : null,
      winning_support_percent: Math.round(support * 100),
      vote_distribution: {
        mikhail_anders: winner === 'mikhail_anders' ? Math.round(support * 11) : 2,
        liang_wei: winner === 'liang_wei' ? Math.round(support * 11) : 3,
        amara_okafor: winner === 'amara_okafor' ? Math.round(support * 11) : 2,
        diego_cole: winner === 'diego_cole' ? Math.round(support * 11) : 1,
        player_self_run: winner === 'player_self_run' ? Math.round(support * 11) : 0,
      },
      environmental_crisis_progress: Number(crisis.toFixed(2)),
      civilian_morale: morale,
      session_phase: elapsed >= 1500 ? 'vote_call' : elapsed >= 1200 ? 'coalition' : 'floor_debate',
      speech_time_remaining: Math.max(0, 1800 - elapsed),
      elapsed_sec: elapsed,
      environmental_phase_reached: phaseForChapter(FSP_CH7_ID, elapsed),
      secondary_completed: secondary,
    },
  };
}

function simulateFspCh8(progress) {
  const choiceId = selectedChoiceId(progress, 'fsp_ch8_pledge_combat');
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}:fsp8`);
  const donate = choiceId === 'fsp_ch8_donate_personal_50k';
  const combat = choiceId === 'fsp_ch8_pledge_combat';
  const silent = choiceId === 'fsp_ch8_silent_no_help';
  const theft = choiceId === 'fsp_ch8_steal_mcc_funds';
  const theftSuccess = theft && roll >= 0.18;
  const donationPool = Math.round(120000 + (donate ? 50000 : 0) + (theftSuccess ? 250000 : 0) + (silent ? -25000 : combat ? 25000 : 0) + (1 - roll) * 65000);
  const constructionPct = Math.round(clampNumber(donationPool / 2200 + (combat ? 8 : 0), 0, 100));
  const gaiaHp = Math.round(clampNumber(72 + (combat ? 18 : 0) + (donate ? 8 : 0) - roll * 18, 0, 100));
  const civilianCasualties = combat ? 0 : silent ? Math.round(4 + roll * 12) : roll < 0.25 ? 2 : 0;
  const elapsed = Math.round((theft ? 1680 : donate ? 1320 : combat ? 1480 : 1760) * (0.92 + roll * 0.14));
  const secondary = [];
  if (donate) secondary.push('obj_personal_donation_50k');
  if (combat && civilianCasualties === 0) secondary.push('obj_combat_pledger_no_civilian_loss');
  if (theftSuccess) secondary.push('obj_mcc_theft_success');
  if (donationPool >= 250000) secondary.push('obj_enhanced_gaia_completion');
  if (gaiaHp >= 90) secondary.push('obj_zero_wave_breach');
  if (elapsed <= 1500) secondary.push('obj_under_25min');
  let failure = null;
  if (theft && !theftSuccess) failure = 'fail_mcc_theft_detected';
  else if (constructionPct < 80) failure = 'fail_gaia_construction_failed';
  else if (gaiaHp <= 0) failure = 'fail_gaia_destroyed_in_combat';
  else if (civilianCasualties >= 10) failure = 'fail_civilian_casualties_severe';
  return {
    success: !failure,
    failureReason: failure,
    branchChoice: choiceId.replace('fsp_ch8_', ''),
    metrics: {
      donation_pool_cr: donationPool,
      construction_progress_percent: constructionPct,
      gaia_hp_percentage: gaiaHp,
      civilian_casualties: civilianCasualties,
      mcc_theft_success: theftSuccess,
      elapsed_sec: elapsed,
      environmental_phase_reached: phaseForChapter(FSP_CH8_ID, elapsed),
      secondary_completed: secondary,
    },
  };
}

function simulateFspCh9(progress) {
  const choiceId = selectedChoiceId(progress, 'fsp_ch9_protect_amara');
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}:fsp9`);
  const signal = choiceId === 'fsp_ch9_signal_pilgrim_arms';
  const protectChen = choiceId === 'fsp_ch9_protect_chen';
  const fullRetreat = choiceId === 'fsp_ch9_full_retreat';
  const assassinsKilled = Math.round(clampNumber((signal ? 4 : 2) + (1 - roll) * 3, 0, 4));
  const casualties = protectChen ? 2 : fullRetreat ? 0 : roll < 0.22 ? 1 : 0;
  const elapsed = Math.round((fullRetreat ? 1120 : signal ? 1500 : 1360) * (0.92 + roll * 0.12));
  const secondary = [];
  if (assassinsKilled >= 4) secondary.push('obj_full_squad_killed');
  if (casualties === 0) secondary.push('obj_zero_casualty_summit');
  if (elapsed <= 1500) secondary.push('obj_under_25min');
  if (choiceId === 'fsp_ch9_protect_butcher') secondary.push('obj_cv_bridge_kept');
  if (signal) secondary.push('obj_pilgrim_arms_signal');
  let failure = null;
  if (protectChen) failure = 'fail_protect_chen_betrayal';
  else if (casualties >= 2) failure = 'fail_two_or_more_delegates_killed';
  else if (assassinsKilled === 0) failure = 'fail_assassin_squad_escapes_intact';
  return {
    success: !failure || protectChen,
    failureReason: failure,
    branchChoice: choiceId.replace('fsp_ch9_', ''),
    metrics: {
      protect_choice_made: choiceId,
      assassins_killed: assassinsKilled,
      summit_casualties: casualties,
      summit_agreement_score: signal ? 10 : protectChen ? 0 : fullRetreat ? 55 : 72,
      elapsed_sec: elapsed,
      environmental_phase_reached: phaseForChapter(FSP_CH9_ID, elapsed),
      secondary_completed: secondary,
    },
  };
}

function simulateFspCh10(progress) {
  const choiceId = selectedChoiceId(progress, 'fsp_bad_ending_fallback');
  return {
    success: choiceId !== 'fsp_bad_ending_fallback',
    failureReason: choiceId === 'fsp_bad_ending_fallback' ? 'fail_bad_ending_fallback' : null,
    branchChoice: choiceId,
    metrics: {
      ending_assigned: choiceId.replace('fsp_', '').replace('_ending_', 'ending_'),
      elapsed_sec: 900,
      environmental_phase_reached: 0,
      secondary_completed: choiceId.includes('ending_2') ? ['obj_ideal_ending_achieved'] : choiceId.includes('ending_4') ? ['obj_dark_path_achieved'] : [],
    },
  };
}

// 프롤로그(0번 챕터)는 시나리오 전용이라 전투 시뮬이 없다. complete 시 항상 성공으로 처리한다.
function simulatePrologue(progress) {
  return {
    success: true,
    failureReason: null,
    metrics: {
      elapsed_sec: 0,
      environmental_phase_reached: 0,
      secondary_completed: [],
    },
  };
}

function isPrologueQuest(questId) {
  return questId === 'mcc_prologue' || questId === 'fsp_prologue' || questId === 'cv_prologue';
}

const CAMPAIGN_TIME_COMPRESSION = 28;

function getChapterRuntimeSeconds(questId) {
  const chapter = CHAPTERS[questId];
  const runtime = chapter?.environment?.totalDurationSeconds || chapter?.estimatedPlayTimeSeconds || 840;
  return Math.max(60, Number(runtime) || 840);
}

function isInstantCampaignCompletion(questId) {
  const resolution = CHAPTERS[questId]?.battleResolution;
  return isPrologueQuest(questId) || resolution === 'cinematic_only' || resolution === 'ending_evaluation_and_cinematic';
}

function getCampaignElapsedSeconds(progress) {
  if (!progress?.started_at) return 0;
  const raw = Math.floor((Date.now() - new Date(progress.started_at).getTime()) / 1000 * CAMPAIGN_TIME_COMPRESSION);
  return Math.max(0, raw);
}

function simulateChapter(progress) {
  if (isPrologueQuest(progress.quest_id)) return simulatePrologue(progress);
  if (progress.quest_id === CH2_ID) return simulateCh2(progress);
  if (progress.quest_id === CH3_ID) return simulateCh3(progress);
  if (progress.quest_id === CH4_ID) return simulateCh4(progress);
  if (progress.quest_id === CH5_ID) return simulateCh5(progress);
  if (progress.quest_id === CH6_ID) return simulateCh6(progress);
  if (progress.quest_id === CH7_ID) return simulateCh7(progress);
  if (progress.quest_id === CH8_ID) return simulateCh8(progress);
  if (progress.quest_id === CH9_ID) return simulateCh9(progress);
  if (progress.quest_id === CH10_ID) return simulateCh10(progress);
  if (progress.quest_id === FSP_CH1_ID) return simulateFspCh1(progress);
  if (progress.quest_id === FSP_CH2_ID) return simulateFspCh2(progress);
  if (progress.quest_id === FSP_CH3_ID) return simulateFspCh3(progress);
  if (progress.quest_id === FSP_CH4_ID) return simulateFspCh4(progress);
  if (progress.quest_id === FSP_CH5_ID) return simulateFspCh5(progress);
  if (progress.quest_id === FSP_CH6_ID) return simulateFspCh6(progress);
  if (progress.quest_id === FSP_CH7_ID) return simulateFspCh7(progress);
  if (progress.quest_id === FSP_CH8_ID) return simulateFspCh8(progress);
  if (progress.quest_id === FSP_CH9_ID) return simulateFspCh9(progress);
  if (progress.quest_id === FSP_CH10_ID) return simulateFspCh10(progress);
  if (progress.quest_id === CV_CH10_ID) return simulateCvCh10(progress);
  if (progress.quest_id === CV_CH1_ID) return simulateCvChapter(progress);
  if (progress.quest_id === CV_CH2_ID) return simulateCvChapter(progress);
  if (progress.quest_id === CV_CH3_ID) return simulateCvChapter(progress);
  if (progress.quest_id === CV_CH4_ID) return simulateCvChapter(progress);
  if (progress.quest_id === CV_CH5_ID) return simulateCvChapter(progress);
  if (progress.quest_id === CV_CH6_ID) return simulateCvChapter(progress);
  if (progress.quest_id === CV_CH7_ID) return simulateCvChapter(progress);
  if (progress.quest_id === CV_CH8_ID) return simulateCvChapter(progress);
  if (progress.quest_id === CV_CH9_ID) return simulateCvChapter(progress);
  return simulateCh1(progress);
}

function calculateCh1Rewards(progress, sim) {
  if (!sim.success) {
    if (sim.failureReason === 'fail_cold_death') return { GP: 0, XP: 0, reputationDelta: { mcc: -10, fsp: -25 }, tags: ['cold_death'], loreFlags: ['cold_sister_frozen'], branchModifiers: [{ targetChapter: CH6_ID, key: 'chen_distrust_increased', value: { active: true } }] };
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
    items: [{ type: 'ship', code: 'mcc_int', label: 'Prism Interceptor', quantity: 1 }],
    titles: secondary.length === 2 ? ['efficient_operator'] : [],
    masteries: secondary.includes('obj_finish_before_storm') ? ['dust_storm_combat'] : [],
    tags: secondary.length === 2 ? ['efficient_operator'] : [],
    loreFlags: ['lifang_personal_arc_unlocked'],
    unlocks: [CH2_ID],
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
  const items = [{ type: 'ship', code: 'shard_frigate', label: 'Shard Frigate', quantity: 2 }, { type: 'resource', code: 'ice_crystal', label: 'Ice Crystal', quantity: 15 }];
  if (choiceId === 'ch2_request_support') gp -= 2000;
  if (choiceId === 'ch2_warn_civilians') loreFlags.push('warned_civilians_ch2');
  if (choiceId === 'ch2_intel_query') loreFlags.push('requested_intel_ch2');
  if (secondary.includes('obj_facility_pristine')) gp += 5000;
  if (secondary.includes('obj_clean_operation')) { gp += 3000; tags.push('clean_operator'); rep = mergeRep(rep, { mcc: 5 }); }
  if (secondary.includes('obj_finish_under_30min')) items.push({ type: 'ship', code: 'mcc_frg', label: 'Shard Frigate (Bonus)', quantity: 1 });
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
    items.push({ type: 'resource', code: 'plasma_crystal', label: 'Plasma Crystal', quantity: 10 }, { type: 'resource', code: 'titanium_alloy', label: 'Titanium Alloy', quantity: 8 });
    branchModifiers.push({ targetChapter: 'mcc_campaign_ch6', key: 'ch6_chen_invitation', value: { ch6_briefing_variant: 'secret_meeting_invited', additional_choice: 'ch6_attend_secret_meeting' } });
  } else if (branch === 'verin') {
    items.push({ type: 'ship', code: 'mcc_snp', label: 'Longeye Sniper', quantity: 1 });
  } else {
    items.push({ type: 'resource', code: 'carbon_fiber', label: 'Carbon Fiber', quantity: 12 }, { type: 'resource', code: 'silicon_chip', label: 'Silicon Chip', quantity: 8 });
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

function calculateCh5Rewards(progress, sim) {
  const choiceId = selectedChoiceId(progress, 'ch5_block_fsp');
  const commonLore = ['dr_roth_data_obtained', 'dr_roth_data_published_to_player', 'dr_roth_disappeared'];
  if (!sim.success) {
    if (sim.failureReason === 'fail_solo_data_caught') return { GP: 0, XP: 500, reputationDelta: { mcc: -25 }, tags: ['insubordinate'], loreFlags: commonLore.concat(['insubordination_attempt']), branchModifiers: [] };
    if (sim.failureReason === 'fail_oxygen_depleted') return { GP: 0, XP: 500, reputationDelta: { mcc: -15 }, tags: [], loreFlags: commonLore, branchModifiers: [] };
    return { GP: 0, XP: 500, reputationDelta: {}, tags: [], loreFlags: commonLore, branchModifiers: [] };
  }
  const secondary = sim.metrics.secondary_completed || [];
  const branchModifiers = [];
  let gp = 60000, xp = 1500, rep = { mcc: 30, fsp: -15 }, items = [{ type: 'ship', code: 'longeye_sniper', label: 'Longeye Sniper', quantity: 1 }], loreFlags = commonLore.slice();
  if (choiceId === 'ch5_escort_supply') {
    gp = 80000; xp = 1800; rep = { mcc: 35 };
    items = [{ type: 'ship', code: 'fsp_logi', label: 'FSP Logistics Frigate', quantity: 1 }, { type: 'resource', code: 'ice_crystal', label: 'Ice Crystal', quantity: 20 }];
    loreFlags.push('ch5_chose_escort', 'kepler_data_server_secured');
  } else if (choiceId === 'ch5_solo_data') {
    gp = 120000; xp = 2500; rep = { mcc: 40 };
    items = [{ type: 'resource', code: 'meteorite_fragment', label: 'Meteorite Fragment', quantity: 3 }, { type: 'resource', code: 'plasma_crystal', label: 'Plasma Crystal', quantity: 5 }];
    loreFlags.push('ch5_chose_solo_data', 'kepler_data_server_player_solo', 'insubordination_attempt');
    branchModifiers.push({ targetChapter: 'mcc_campaign_ch10', key: 'ending_2_executive_eligible', value: { ch10_ending_options_add: ['ending_2_executive'] } });
  } else if (choiceId === 'ch5_strike_cv') {
    gp = 100000; xp = 2000; rep = { mcc: 40, cv: -25 };
    items = [{ type: 'resource', code: 'plasma_dust', label: 'Plasma Dust', quantity: 5 }, { type: 'resource', code: 'ancient_metal', label: 'Ancient Metal', quantity: 3 }];
    loreFlags.push('ch5_chose_cv_strike', 'cv_plague_ship_destroyed');
  } else {
    loreFlags.push('ch5_chose_block_fsp', 'kepler_data_server_secured');
  }
  if (secondary.includes('obj_no_player_ship_lost')) gp += 8000;
  return { GP: gp, XP: xp + 500, reputationDelta: rep, items, tags: [], loreFlags, unlocks: [CH6_ID], branchModifiers };
}

function calculateCh6Rewards(progress, sim) {
  const branch = sim.branchChoice || 'branch_b';
  const secondary = sim.metrics.secondary_completed || [];
  if (!sim.success) {
    if (sim.failureReason === 'fail_lifang_killed') return { GP: 0, XP: 0, reputationDelta: { mcc: -100 }, tags: [], loreFlags: ['lifang_died_in_escape'], branchModifiers: [{ targetChapter: 'mcc_route', key: 'mcc_route_locked', value: { locked: true } }] };
    if (sim.failureReason === 'fail_lifang_escapes_during_subdue') return { GP: 0, XP: 0, reputationDelta: { mcc: -30 }, tags: [], loreFlags: ['lifang_escaped'], branchModifiers: [] };
    return { GP: 0, XP: 0, reputationDelta: {}, tags: [], loreFlags: ['chen_suspicion_active'], branchModifiers: [] };
  }
  if (branch === 'branch_a') {
    let gp = 50000; let rep = { mcc: -50, fsp: 30 };
    if (secondary.includes('obj_minimize_armor_damage')) gp += 10000;
    if (secondary.includes('obj_lifang_shuttle_full_hp')) rep = mergeRep(rep, { fsp: 10 });
    return { GP: gp, XP: 2500, reputationDelta: rep, items: [{ type: 'resource', code: 'titanium_alloy', label: 'Titanium Alloy', quantity: 5 }, { type: 'resource', code: 'plasma_crystal', label: 'Plasma Crystal', quantity: 3 }], tags: ['whistleblower'], loreFlags: ['ch6_chose_help_lifang'], unlocks: [CH7_ID], branchModifiers: [{ targetChapter: 'any_mcc_post_ch6', key: 'mcc_route_a_active', value: { ch7_route: 'branch_a', ch8_route: 'branch_a', ch9_route: 'branch_a', ch10_endings_available: ['ending_3_whistleblower'] } }, { targetChapter: 'mcc_campaign_ch10', key: 'ending_3_locked_in', value: { ending: 'ending_3_whistleblower' } }] };
  }
  if (branch === 'branch_c') {
    const lore = ['ch6_chose_copy_silent'];
    if (secondary.includes('obj_stealth_perfect')) lore.push('chen_no_suspicion');
    return { GP: secondary.includes('obj_stealth_perfect') ? 15000 : 0, XP: 1500, reputationDelta: {}, items: [{ type: 'resource', code: 'ancient_metal', label: 'Ancient Metal', quantity: 2 }], tags: ['secret_keeper'], loreFlags: lore, unlocks: [CH7_ID], branchModifiers: [{ targetChapter: 'any_mcc_post_ch6', key: 'mcc_route_c_active', value: { ch7_route: 'branch_c', ch10_endings_available: ['ending_1_loyal_hire', 'ending_2_executive', 'ending_4_traitor'] } }, { targetChapter: 'mcc_campaign_ch10', key: 'ending_4_unlocked', value: { ending: 'ending_4_traitor' } }] };
  }
  return { GP: 100000, XP: 2000, reputationDelta: { mcc: 40, fsp: -10 }, items: [{ type: 'resource', code: 'hull_plate', label: 'Hull Plate', quantity: 3 }, { type: 'resource', code: 'alloy_frame', label: 'Alloy Frame', quantity: 2 }], tags: [], loreFlags: ['ch6_chose_report_chen', 'lifang_arrested'], unlocks: [CH7_ID], branchModifiers: [{ targetChapter: 'any_mcc_post_ch6', key: 'mcc_route_b_active', value: { ch7_route: 'branch_b', ch10_endings_available: ['ending_1_loyal_hire', 'ending_2_executive'] } }, { targetChapter: 'mcc_campaign_ch10', key: 'ending_1_eligible', value: { ending: 'ending_1_loyal_hire' } }] };
}

function calculateCh7Rewards(progress, sim) {
  const branch = sim.branchChoice || 'branch_b';
  const choiceId = selectedChoiceId(progress, 'ch7b_standard');
  const secondary = sim.metrics.secondary_completed || [];
  if (!sim.success) {
    if (sim.failureReason === 'fail_one_warlord_escapes') return { GP: 0, XP: 500, reputationDelta: {}, tags: [], loreFlags: [], branchModifiers: [{ targetChapter: 'mcc_campaign_ch9', key: 'ch9_warlord_escape_risk', value: { ch9_difficulty_modifier: 1.2 } }] };
    return { GP: 0, XP: 500, reputationDelta: { mcc: sim.failureReason === 'fail_helion_intel_leak' ? -15 : -10 }, tags: [], loreFlags: ['ch7_market_war_exposed'], branchModifiers: [] };
  }
  if (branch === 'branch_a') {
    const branchModifiers = secondary.includes('obj_warlord_assassinated_personally') ? [{ targetChapter: 'mcc_campaign_ch9', key: 'ch9_cv_destabilized', value: { cv_internal_chaos: true, cv_fleet_strength: -20 } }] : [];
    return { GP: 50000, XP: 2200, reputationDelta: { mcc: -25, fsp: 30 }, items: [{ type: 'ship', code: 'fsp_sequoia_borrowed', label: 'FSP Sequoia Borrowed' }], tags: [], loreFlags: ['cv_warlords_killed', 'cv_warlord_cruz_dead', 'cv_warlord_vain_dead'], unlocks: ['mcc_campaign_ch8'], branchModifiers };
  }
  let gp = 80000;
  if (secondary.includes('obj_zero_helion_escapes')) gp += 10000;
  if (secondary.includes('obj_helion_hq_struck')) gp += 30000;
  const lore = ['helion_stock_collapsed', 'helion_subsidiary_acquired'];
  const branchModifiers = [];
  if (branch === 'branch_c') {
    lore.push(choiceId === 'ch7c_redirect' ? 'chen_loyalty_test_failed' : 'chen_loyalty_test_passed');
    if (choiceId === 'ch7c_redirect') branchModifiers.push({ targetChapter: 'mcc_campaign_ch8', key: 'ch8_chen_surveillance', value: { surveillance_intensity: 'high', ch8_difficulty_modifier: 1.2 } });
  }
  return { GP: gp, XP: 1800, reputationDelta: { mcc: branch === 'branch_c' ? 15 : 25 }, items: [{ type: 'resource', code: 'exotic_alloy', label: 'Exotic Alloy', quantity: 5 }, { type: 'resource', code: 'plasma_coil', label: 'Plasma Coil', quantity: 3 }, { type: 'resource', code: 'alloy_frame', label: 'Alloy Frame', quantity: 4 }], tags: [], loreFlags: lore, unlocks: ['mcc_campaign_ch8'], branchModifiers };
}

function calculateCh8Rewards(progress, sim) {
  const choiceId = selectedChoiceId(progress, 'ch8b_standard');
  const secondary = sim.metrics.secondary_completed || [];
  const branch = sim.branchChoice || 'branch_b';
  if (sim.metrics.chen_hunt_success) {
    return {
      GP: 300000,
      XP: 5500,
      reputationDelta: { mcc: -100, fsp: 50, cv: 10 },
      items: [{ type: 'resource', code: 'quantum_core', label: 'Quantum Core', quantity: 3 }, { type: 'resource', code: 'exotic_alloy', label: 'Exotic Alloy', quantity: 2 }],
      tags: ['whistleblower'],
      loreFlags: ['chen_killed_in_prometheus', 'prometheus_destroyed_by_player', 'chose_ending_3', 'mcc_route_completed'],
      unlocks: [CH10_ID],
      branchModifiers: [{ targetChapter: 'any_route', key: 'cross_route_chen_dead', value: { chen_npc_unavailable: true, mcc_post_chen_state: true } }],
    };
  }
  if (!sim.success) {
    if (branch === 'branch_a') {
      const lore = ['prometheus_completed'];
      if (choiceId === 'ch8a_distributed') lore.push('kara_vex_dead');
      return { GP: 0, XP: 500, reputationDelta: { mcc: -20, fsp: -10, cv: -10 }, tags: [], loreFlags: lore, branchModifiers: [{ targetChapter: CH9_ID, key: 'ch9_prometheus_active', value: { mcc_fleet_strength: 30, ch9_difficulty: -0.2 } }] };
    }
    const lore = [sim.failureReason === 'fail_shipyard_destroyed' ? 'prometheus_destroyed' : 'prometheus_construction_failed'];
    return { GP: 0, XP: 500, reputationDelta: { mcc: -25 }, tags: [], loreFlags: lore, unlocks: [CH9_ID], branchModifiers: [{ targetChapter: CH9_ID, key: 'ch9_prometheus_lost', value: { mcc_fleet_strength: -30, ch9_difficulty: 0.3 } }] };
  }
  if (branch === 'branch_a') {
    let gp = 100000; let rep = { mcc: -50, fsp: 30, cv: 20 };
    if (secondary.includes('obj_5_critical_systems_destroyed')) gp += 25000;
    if (secondary.includes('obj_zero_collab_npc_lost')) rep = mergeRep(rep, { fsp: 10, cv: 10 });
    return {
      GP: gp,
      XP: 3000,
      reputationDelta: rep,
      items: [{ type: 'ship', code: 'captured_sequoia', label: 'Captured Sequoia', quantity: 1 }, { type: 'resource', code: 'exotic_alloy', label: 'Exotic Alloy', quantity: 3 }],
      tags: ['titan_killer'],
      loreFlags: ['prometheus_destroyed', 'prometheus_destroyed_by_player'],
      unlocks: [CH9_ID],
      branchModifiers: [{ targetChapter: CH9_ID, key: 'ch9_prometheus_lost', value: { mcc_fleet_strength: -30, ch9_difficulty: 0.3 } }],
    };
  }
  let gp = 150000;
  if (secondary.includes('obj_perfect_defense')) gp += 30000;
  if (secondary.includes('obj_zero_player_ship_lost')) gp += 15000;
  if (secondary.includes('obj_phase_4_prepared')) gp += 10000;
  const branchModifiers = [{ targetChapter: CH9_ID, key: 'ch9_prometheus_active', value: { mcc_fleet_strength: 30, ch9_difficulty: -0.2 } }];
  if (branch === 'branch_c') branchModifiers.push({ targetChapter: CH10_ID, key: 'ch10_chen_pre_warned', value: { ch10_blackmail_difficulty: 1, chen_dialog: 'cold_pre_warned' } });
  return {
    GP: gp,
    XP: 3500,
    reputationDelta: { mcc: branch === 'branch_c' ? 30 : 40 },
    items: [{ type: 'ship', code: 'prometheus_titan', label: 'Prometheus Titan', quantity: 1 }, { type: 'resource', code: 'exotic_alloy', label: 'Exotic Alloy', quantity: 5 }, { type: 'resource', code: 'quantum_core', label: 'Quantum Core', quantity: 2 }],
    tags: [],
    loreFlags: ['prometheus_completed'],
    unlocks: [CH9_ID],
    branchModifiers,
  };
}

function calculateCh9Rewards(progress, sim) {
  const choiceId = selectedChoiceId(progress, 'ch9_lead_kepler');
  const battlefield = sim.metrics.chosen_battlefield || 'kepler';
  const secondary = sim.metrics.secondary_completed || [];
  if (!sim.success) {
    const rep = sim.failureReason === 'fail_majority_battlefields_lost' ? { mcc: -40 } : { mcc: -25 };
    return { GP: 0, XP: 500, reputationDelta: rep, tags: [], loreFlags: [], unlocks: [CH10_ID], branchModifiers: [{ targetChapter: CH10_ID, key: 'ch10_weakened_position', value: { endings_limited: sim.failureReason === 'fail_majority_battlefields_lost' } }] };
  }
  let gp = 250000;
  let xp = battlefield === 'kepler' ? 5000 : battlefield === 'olympus' ? 4000 : 4500;
  let rep = battlefield === 'hellas' ? { mcc: 35, fsp: -30 }
    : battlefield === 'valles' ? { mcc: 35, cv: -30 }
      : battlefield === 'kepler' && sim.branchChoice === 'branch_a' ? { fsp: 40, cv: 40 }
        : { mcc: 30 };
  const items = [];
  const tags = [];
  const loreFlags = [];
  const branchModifiers = [];
  if (battlefield === 'olympus') items.push({ type: 'ship', code: 'tessellate_battleship', label: 'Tessellate Battleship' });
  if (battlefield === 'hellas') items.push({ type: 'ship', code: 'captured_sequoia', label: 'Captured Sequoia' });
  if (battlefield === 'valles') items.push({ type: 'ship', code: 'captured_ironclad', label: 'Captured Ironclad' });
  if (battlefield === 'kepler') {
    items.push({ type: 'ship', code: 'mcc_bs', label: 'Tessellate Battleship', quantity: 1 });
    loreFlags.push('roth_data_permanent_secure');
  }
  if (choiceId.includes('kill_amara')) {
    loreFlags.push('amara_dead');
    branchModifiers.push({ targetChapter: CH10_ID, key: 'ch10_npc_amara_dead', value: { fsp_eternal_hostility: true, ending_3_modified: true } });
  } else if (choiceId.includes('capture_amara')) {
    loreFlags.push('amara_captured');
    branchModifiers.push({ targetChapter: CH10_ID, key: 'ch10_npc_amara_captured', value: { ch10_npc: 'amara_in_chains' } });
  } else if (choiceId.includes('kill_butcher')) {
    loreFlags.push('butcher_dead');
  } else if (choiceId.includes('flee')) {
    loreFlags.push('butcher_escaped');
    branchModifiers.push({ targetChapter: CH10_ID, key: 'ch10_npc_butcher_active', value: { ch10_butcher_intervention: 'possible' } });
  }
  if (choiceId.startsWith('ch9a_')) loreFlags.push('chen_weiss_at_kepler');
  loreFlags.push(`ch9_chose_${battlefield}`, 'pilgrim_arms_revealed_to_player');
  branchModifiers.push({ targetChapter: CH10_ID, key: 'ch10_pilgrim_revealed', value: { ending_4_pilgrim_context: 'enriched' } });
  if (secondary.includes('obj_destroy_pilgrim_arms_squadron')) {
    gp += 50000;
    items.push({ type: 'ship', code: 'pilgrim_pa3', label: 'Captured Pilgrim PA-3' });
    tags.push('fourth_faction_slayer');
    loreFlags.push('all_pilgrim_arms_destroyed');
  }
  if (secondary.includes('obj_zero_critical_npc_lost')) rep = mergeRep(rep, { fsp: 20, cv: 20 });
  return { GP: gp, XP: xp, reputationDelta: rep, items, tags, loreFlags, unlocks: [CH10_ID], branchModifiers };
}

function calculateCh10Rewards(progress, sim) {
  const ending = sim.branchChoice || selectedChoiceId(progress, 'bad_ending_dismissed');
  if (ending === 'ending_1_loyal_hire') {
    return { GP: 700000, XP: 5000, reputationDelta: { mcc: 50 }, items: [{ type: 'ship_fleet', code: 'mcc_loyal_hire_fleet', label: 'MCC Fleet Package', quantity: 5 }, { type: 'resource', code: 'exotic_alloy', label: 'Exotic Alloy', quantity: 5 }, { type: 'resource', code: 'hull_plate', label: 'Hull Plate', quantity: 5 }], tags: ['shareholder'], loreFlags: ['mcc_route_completed', 'chose_ending_1'], unlocks: [], branchModifiers: [] };
  }
  if (ending === 'ending_2_executive') {
    return { GP: 1200000, XP: 6000, reputationDelta: { mcc: 70 }, items: [{ type: 'ship_fleet', code: 'mcc_executive_fleet', label: 'Executive Fleet', quantity: 7 }, { type: 'resource', code: 'exotic_alloy', label: 'Exotic Alloy', quantity: 10 }, { type: 'resource', code: 'quantum_core', label: 'Quantum Core', quantity: 5 }, { type: 'resource', code: 'dark_matter', label: 'Dark Matter', quantity: 3 }], tags: ['future_chairman'], loreFlags: ['mcc_route_completed', 'chose_ending_2'], unlocks: [], branchModifiers: [] };
  }
  if (ending === 'ending_3_whistleblower') {
    return { GP: 500000, XP: 5500, reputationDelta: { mcc: -100, fsp: 50, cv: 10 }, items: [{ type: 'resource', code: 'xenomatter', label: 'Xenomatter', quantity: 1 }, { type: 'resource', code: 'quantum_core', label: 'Quantum Core', quantity: 3 }], tags: ['whistleblower'], loreFlags: ['mcc_route_completed', 'chose_ending_3'], unlocks: [], branchModifiers: [{ targetChapter: 'any_route', key: 'cross_route_chen_dead', value: { chen_npc_unavailable: true, mcc_post_chen_state: true } }, { targetChapter: 'any_route_ng_plus', key: 'cross_route_lifang_alive', value: { lifang_in_federal_government: true } }] };
  }
  if (ending === 'ending_4_traitor') {
    return { GP: 1000000, XP: 7000, reputationDelta: { mcc: -25, fsp: -25, cv: -25, pilgrim_arms: -25 }, items: [{ type: 'ship_fleet', code: 'pilgrim_arms_starter_fleet', label: 'Pilgrim Arms Starter Fleet', quantity: 30 }, { type: 'resource', code: 'exotic_alloy', label: 'Exotic Alloy', quantity: 10 }, { type: 'resource', code: 'quantum_core', label: 'Quantum Core', quantity: 5 }, { type: 'resource', code: 'xenomatter', label: 'Xenomatter', quantity: 2 }], tags: ['the_fourth_faction', 'the_traitor'], loreFlags: ['mcc_route_completed', 'chose_ending_4'], unlocks: [], branchModifiers: [{ targetChapter: 'any_route_ng_plus', key: 'cross_route_pilgrim_arms_exists', value: { pilgrim_arms_npc_faction_active: true } }] };
  }
  return { GP: 50000, XP: 1000, reputationDelta: {}, items: [], tags: ['forgotten_freelancer'], loreFlags: ['mcc_route_completed', 'chose_bad_ending'], unlocks: [], branchModifiers: [] };
}

function calculateFspCh1Rewards(progress, sim) {
  const choiceId = selectedChoiceId(progress, 'fsp_ch1_accept_standard');
  const secondary = sim.metrics.secondary_completed || [];
  if (!sim.success) {
    if (sim.failureReason === 'fail_total_loss') return { GP: 0, XP: 100, reputationDelta: { fsp: -15 }, tags: [], loreFlags: ['new_athens_water_crisis', 'cargo_alpha_lost', 'cargo_beta_lost'], unlocks: [FSP_CH2_ID], branchModifiers: [{ targetChapter: FSP_CH2_ID, key: 'ch2_settlement_water_critical', value: { ch2_time_pressure: 0.3 } }] };
    if (sim.failureReason === 'fail_cargo_lost') {
      const lost = sim.metrics.cargo_alpha_hp_percent <= 0 ? 'cargo_alpha_lost' : 'cargo_beta_lost';
      return { GP: 0, XP: 100, reputationDelta: { fsp: -5 }, tags: [], loreFlags: [lost], unlocks: [FSP_CH2_ID], branchModifiers: [{ targetChapter: FSP_CH2_ID, key: 'ch2_settlement_water_critical', value: { ch2_time_pressure: 0.3 } }] };
    }
    return { GP: 0, XP: 100, reputationDelta: { fsp: -5 }, tags: ['failed_the_wounded'], loreFlags: ['ch1_patient_died'], unlocks: [FSP_CH2_ID], branchModifiers: [{ targetChapter: 'any_fsp', key: 'npc_yuna_distrust', value: { yuna_kim_cooperation: 'reduced' } }] };
  }
  let gp = 4000;
  if (secondary.includes('obj_zero_cv_escapes')) gp += 5000;
  if (secondary.includes('obj_cargo_full_hp')) gp += 2000;
  const tags = [];
  const loreFlags = [];
  const items = [
    { type: 'ship', code: 'fsp_frg', label: 'Sprite Frigate', quantity: 1 },
    { type: 'resource', code: 'grain_canisters', label: 'Grain Canisters', quantity: secondary.includes('obj_cargo_full_hp') ? 60 : 30 },
    { type: 'resource', code: 'medical_kit', label: 'Medical Kit', quantity: 3 },
  ];
  if (secondary.includes('patients_both_alive')) tags.push('lifesaver');
  if (choiceId === 'fsp_ch1_question_mcc') loreFlags.push('mikhail_oxygen_mask_revealed', 'mikhail_trust_deepened');
  if (choiceId === 'fsp_ch1_prioritize_patients') loreFlags.push('civilian_minded');
  if (choiceId === 'fsp_ch1_accept_standard') loreFlags.push('tea_ceremony_completed');
  const masteries = secondary.includes('obj_finish_under_15min') ? ['dust_storm_recovery_combat'] : [];
  return { GP: gp, XP: 400, reputationDelta: { fsp: 20, cv: -5 }, items, tags, loreFlags, masteries, unlocks: [FSP_CH2_ID], branchModifiers: [] };
}

function calculateFspCh2Rewards(progress, sim) {
  const choiceId = selectedChoiceId(progress, 'fsp_ch2_lena_command');
  const secondary = sim.metrics.secondary_completed || [];
  if (!sim.success) {
    if (sim.failureReason === 'fail_lena_dead') return { GP: 0, XP: 100, reputationDelta: { fsp: -20 }, tags: [], loreFlags: ['lena_dead'], unlocks: [FSP_CH3_ID], branchModifiers: [{ targetChapter: FSP_CH3_ID, key: 'ch3_samuel_hostile', value: { samuel_initial_dialog: 'hostile' } }] };
    if (sim.failureReason === 'fail_ice_below_70') return { GP: 0, XP: 100, reputationDelta: { fsp: -10 }, tags: [], loreFlags: ['ch2_water_shortage'], unlocks: [FSP_CH3_ID], branchModifiers: [{ targetChapter: 'any_fsp_post_ch2', key: 'cross_route_water_crisis', value: { settlement_morale: -10, fsp_resource_baseline: -15 } }] };
    return { GP: 0, XP: 100, reputationDelta: { fsp: -5 }, tags: [], loreFlags: ['ch2_water_shortage'], unlocks: [FSP_CH3_ID], branchModifiers: [] };
  }
  let gp = 6000;
  if (secondary.includes('obj_ice_90_percent')) gp += 5000;
  if (secondary.includes('obj_zero_cv_escapes')) gp += 3000;
  const loreFlags = [];
  const branchModifiers = [];
  const masteries = [];
  if (choiceId === 'fsp_ch2_lena_command') loreFlags.push('lena_collaboration_full');
  if (choiceId === 'fsp_ch2_split_convoy') loreFlags.push('convoy_split');
  if (choiceId === 'fsp_ch2_request_mcc_ships') loreFlags.push('tried_mcc_route');
  if (choiceId === 'fsp_ch2_question_storm') loreFlags.push('heard_lena_mother_story', 'lena_mother_revealed');
  if (secondary.includes('lena_survives_full_hp') || choiceId === 'fsp_ch2_question_storm') {
    loreFlags.push('lena_deep_trust');
    branchModifiers.push({ targetChapter: FSP_CH3_ID, key: 'ch3_lena_companion', value: { lena_can_join_ch3: true, mission_difficulty: -0.1 } });
  }
  if (secondary.includes('obj_no_eclipse_misses')) masteries.push('phobos_eclipse_navigation');
  return { GP: gp, XP: 600, reputationDelta: { fsp: 15, cv: -10 }, items: [{ type: 'resource', code: 'medical_kit', label: 'Medical Kit', quantity: 3 }, { type: 'ship_modification', code: 'sprite_speed_kit', label: 'Sprite Speed Kit' }], tags: [], loreFlags, masteries, unlocks: [FSP_CH3_ID], branchModifiers };
}

function calculateFspCh3Rewards(progress, sim) {
  const choiceId = selectedChoiceId(progress, 'fsp_ch3_official_op');
  const secondary = sim.metrics.secondary_completed || [];
  if (!sim.success) {
    return { GP: 0, XP: 200, reputationDelta: { fsp: -10 }, tags: [], loreFlags: ['ch3_partial_rescue'], branchModifiers: [] };
  }
  let gp = 10000;
  let rep = { fsp: 30, mcc: -30 };
  const tags = [];
  const loreFlags = ['new_athens_population_350_added'];
  const branchModifiers = [
    { targetChapter: 'fsp_campaign_ch4', key: 'ch4_settlement_resource_strain', value: { settlement_food_pressure: 0.3, mikhail_dialog_burdened: true } },
  ];
  if (choiceId === 'fsp_ch3_solo_op') { loreFlags.push('solo_op_chosen'); rep = { mcc: -25, fsp: 0 }; }
  if (choiceId === 'fsp_ch3_official_op') {
    loreFlags.push('official_op_chosen', 'amara_approves');
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch4', key: 'mcc_oxygen_slavery_evidence_obtained', value: { leverage_mcc_evidence: true } });
    branchModifiers.push({ targetChapter: 'any_route_ng_plus', key: 'cross_route_mcc_oxygen_slavery_known', value: { player_knows_mcc_oxygen_weapon: true } });
  }
  if (choiceId === 'fsp_ch3_question_intel') loreFlags.push('samuel_cousin_inside');
  if (choiceId === 'fsp_ch3_diplomatic_attempt') loreFlags.push('mcc_diplomacy_history_revealed');
  if (secondary.includes('obj_rescue_90_percent')) gp += 8000;
  if (secondary.includes('obj_no_alarm_triggered')) gp += 5000;
  if (secondary.includes('obj_60_stayers_respected')) { rep = mergeRep(rep, { fsp: 5 }); tags.push('true_liberator'); loreFlags.push('respected_miner_choice'); }
  if (choiceId === 'fsp_ch3_official_op') {
    loreFlags.push('samuel_trusts_player');
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch4', key: 'ch4_samuel_companion', value: { samuel_can_join: true, battle_strength: 0.15 } });
  }
  return { GP: gp, XP: 1000, reputationDelta: rep, items: [{ type: 'ship', code: 'vector_destroyer_captured', label: 'Captured Vector Destroyer' }, { type: 'settlement_population', code: 'new_athens_population', label: 'New Athens Population', quantity: 350 }], tags, loreFlags, unlocks: ['fsp_campaign_ch4'], branchModifiers };
}

function calculateFspCh4Rewards(progress, sim) {
  const choiceId = selectedChoiceId(progress, 'fsp_ch4_propose_intel_exchange');
  const secondary = sim.metrics.secondary_completed || [];
  if (!sim.success) {
    if (sim.failureReason === 'fail_amara_killed') {
      return {
        GP: 0,
        XP: 100,
        reputationDelta: { fsp: -30 },
        tags: ['diplomatic_disaster'],
        loreFlags: ['amara_killed_at_sandstone'],
        branchModifiers: [
          { targetChapter: 'fsp_campaign_ch5', key: 'fsp_leadership_vacuum', value: { no_chair_available: true } },
          { targetChapter: 'fsp_campaign_ch7', key: 'assembly_no_chair', value: { assembly_no_chair: true } },
        ],
      };
    }
    if (sim.failureReason === 'negotiation_walked_away') {
      return { GP: 0, XP: 200, reputationDelta: { fsp: -5, cv: -15 }, tags: [], loreFlags: ['negotiation_walked_away', 'cinder_grace_alliance_failed'], unlocks: ['fsp_campaign_ch5'], branchModifiers: [{ targetChapter: 'fsp_campaign_ch5', key: 'cinder_warlord_hostile', value: { cv_attitude: 'hostile', ch5_modifier: 'cv_hostile_at_kepler' } }] };
    }
    return { GP: 0, XP: 200, reputationDelta: { fsp: -8, cv: -20 }, tags: [], loreFlags: ['cinder_grace_alliance_failed', 'ch4_mcc_engagement_occurred'], unlocks: ['fsp_campaign_ch5'], branchModifiers: [{ targetChapter: 'fsp_campaign_ch5', key: 'cinder_warlord_hostile', value: { cv_attitude: 'hostile' } }] };
  }
  let gp = 5500;
  let rep = { fsp: 25 };
  const items = [{ type: 'resource', code: 'medical_kit', label: 'Medical Kit', quantity: 10 }];
  const tags = [];
  const loreFlags = [];
  const branchModifiers = [];
  const masteries = [];
  if (secondary.includes('obj_finish_under_15min')) {
    gp += 3000;
    masteries.push('covert_diplomacy');
    items.push({ type: 'ship', code: 'cv_frg', label: 'Shadow Frigate', quantity: 1 });
  }
  if (secondary.includes('obj_no_combat_at_all')) { gp += 2000; tags.push('pacifist_envoy'); }
  if (secondary.includes('obj_use_eclipse_escape')) { gp += 1500; loreFlags.push('phobos_navigator'); masteries.push('phobos_navigator_mastery'); }
  if (choiceId === 'fsp_ch4_offer_settlement_refuge') {
    gp += 2000; rep = mergeRep(rep, { fsp: -3, cv: 15 });
    items.push({ type: 'intel', code: 'cv_intel_packet', label: 'CV Intel Packet' });
    loreFlags.push('pact_settlement_refuge_offered', 'cinder_grace_alliance_strong');
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch5', key: 'fsp_cv_truce_active', value: { cv_attitude: 'allied', ch5_modifier: 'cv_neutral_at_kepler' } });
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch7', key: 'cv_intel_assist_assembly', value: { cv_intel_assist: true } });
  } else if (choiceId === 'fsp_ch4_offer_supply_share') {
    gp += 1000; rep = mergeRep(rep, { fsp: -1, cv: 10 });
    loreFlags.push('pact_supply_share_offered', 'cinder_grace_alliance_modest');
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch5', key: 'fsp_cv_truce_modest', value: { cv_attitude: 'passive', ch5_modifier: 'cv_passive_at_kepler' } });
  } else if (choiceId === 'fsp_ch4_evidence_share') {
    gp += 3000; rep = mergeRep(rep, { cv: 25 });
    items.push({ type: 'npc_summon_token', code: 'cinder_grace_blood_oath_token', label: 'Cinder Grace Blood Oath Token' });
    loreFlags.push('pact_evidence_shared_with_cv', 'cinder_grace_alliance_blood_oath');
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch5', key: 'cv_active_alliance', value: { cv_attitude: 'blood_oath', ch5_modifier: 'cv_active_alliance_at_kepler' } });
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch9', key: 'mcc_targets_fsp_priority', value: { mcc_retaliation_priority: 'fsp' } });
  } else {
    gp += 500; rep = mergeRep(rep, { cv: 5 });
    items.push({ type: 'intel', code: 'mcc_internal_memo_fragment', label: 'MCC Internal Memo Fragment', quantity: 2 });
    loreFlags.push('pact_intel_exchange_only', 'cinder_grace_alliance_weak');
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch6', key: 'bonus_mcc_intel', value: { mole_investigation_bonus: true } });
  }
  return { GP: gp, XP: 800, reputationDelta: rep, items, tags, loreFlags, masteries, unlocks: ['fsp_campaign_ch5'], branchModifiers };
}

function calculateFspCh5Rewards(progress, sim) {
  const choiceId = selectedChoiceId(progress, 'fsp_ch5_propose_commons');
  const secondary = sim.metrics.secondary_completed || [];
  if (!sim.success) {
    if (sim.failureReason === 'fail_amara_killed') return { GP: 0, XP: 200, reputationDelta: { fsp: -40 }, tags: ['diplomatic_disaster'], loreFlags: ['amara_killed_at_kepler'], unlocks: [FSP_CH6_ID], branchModifiers: [{ targetChapter: 'fsp_campaign_ch7', key: 'assembly_no_chair', value: { assembly_no_chair: true } }, { targetChapter: 'fsp_campaign_ch10', key: 'alt_ending_required', value: { no_chair_available: true } }] };
    if (sim.failureReason === 'fail_liang_killed') return { GP: 0, XP: 200, reputationDelta: { fsp: -15 }, tags: ['failed_protector'], loreFlags: ['liang_wei_killed'], unlocks: [FSP_CH6_ID], branchModifiers: [{ targetChapter: 'fsp_campaign_ch7', key: 'policy_line_weakened', value: { liang_policy_line: 'weakened' } }] };
    return { GP: 0, XP: 200, reputationDelta: { fsp: -10 }, tags: [], loreFlags: ['kepler_evacuated_unresolved', 'summit_total_collapse'], unlocks: [FSP_CH6_ID], branchModifiers: [{ targetChapter: 'fsp_campaign_ch9', key: 'kepler_disputed_renewed_combat', value: { kepler_status: 'disputed' } }] };
  }
  let gp = 7500;
  let rep = { fsp: 30 };
  const items = [{ type: 'resource', code: 'medical_kit', label: 'Medical Kit', quantity: 8 }];
  const tags = [];
  const loreFlags = [];
  const branchModifiers = [];
  const masteries = [];
  if (secondary.includes('obj_summit_under_25min')) { gp += 4000; masteries.push('efficient_diplomacy'); }
  if (secondary.includes('obj_zero_civilian_casualty')) { gp += 2500; tags.push('civilian_protector'); }
  if (secondary.includes('obj_legitimize_liang')) loreFlags.push('liang_wei_political_career_started');
  if (choiceId === 'fsp_ch5_propose_commons') {
    gp += 5000; rep = mergeRep(rep, { mcc: -5, cv: 5 });
    tags.push('commons_architect');
    loreFlags.push('ch5_commons_proposed', 'liang_wei_legitimized', 'kepler_commons_treaty');
    items.push({ type: 'ship', code: 'fsp_crs', label: 'Scholar Corvette', quantity: 1 }, { type: 'resource', code: 'ancient_metal', label: 'Ancient Metal', quantity: 5 });
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch9', key: 'commons_legitimacy_diplomatic', value: { reputation_buffer: 15 } });
  } else if (choiceId === 'fsp_ch5_propose_fsp_arbitration') {
    gp += 3000; rep = mergeRep(rep, { fsp: 5, mcc: 10, cv: 10 });
    loreFlags.push('ch5_arbitration_proposed', 'fsp_neutral_arbiter_recognized');
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch9', key: 'fsp_neutral_arbiter', value: { tripartite_meeting_easier: true } });
  } else if (choiceId === 'fsp_ch5_propose_evidence_lever') {
    gp += 8000; rep = mergeRep(rep, { mcc: -30, cv: 15 });
    tags.push('the_lever');
    loreFlags.push('ch5_evidence_lever_used', 'ancient_metal_origin_disclosed', 'mcc_publicly_humiliated', 'roth_legacy_keeper');
    items.push({ type: 'rare_resource', code: 'ancient_metal', label: 'Ancient Metal', quantity: 350 });
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch9', key: 'mcc_revenge_priority', value: { intensity: 1.5 } });
  } else if (choiceId === 'fsp_ch5_propose_global_disclosure') {
    gp += 2000; rep = mergeRep(rep, { fsp: 5, mcc: -50, cv: -20 });
    tags.push('the_disclosurist');
    loreFlags.push('ch5_global_disclosure', 'alien_metal_publicly_known');
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch9', key: 'martian_world_state_changed', value: { un_intervention_threat: true } });
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch10', key: 'alt_ending_disclosure_path', value: { disclosure_path: true } });
  } else {
    gp += 4000; rep = mergeRep(rep, { fsp: -10, mcc: -20 });
    tags.push('crater_baron');
    loreFlags.push('ch5_combat_forced_by_fsp', 'kepler_militarily_held');
    masteries.push('crater_combat');
    items.push({ type: 'rare_resource', code: 'ancient_metal', label: 'Ancient Metal', quantity: 280 });
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch7', key: 'assembly_militarized_critique', value: { critique: true } });
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch9', key: 'mcc_full_offensive', value: { mcc_full_offensive: true } });
  }
  return { GP: gp, XP: 1200, reputationDelta: rep, items, tags, loreFlags, masteries, unlocks: [FSP_CH6_ID], branchModifiers };
}

function calculateFspCh6Rewards(progress, sim) {
  const choiceId = selectedChoiceId(progress, 'fsp_ch6_use_as_handler');
  const secondary = sim.metrics.secondary_completed || [];
  if (!sim.success) {
    if (sim.failureReason === 'fail_wrong_accusation') return { GP: 0, XP: 150, reputationDelta: { fsp: -25 }, tags: ['paranoid_judge'], loreFlags: ['ch6_wrong_culprit_accused', 'innocent_punished', 'real_spy_at_large'], branchModifiers: [{ targetChapter: 'fsp_campaign_ch7', key: 'assembly_loss_of_trust', value: { reputation_buffer: -25 } }, { targetChapter: 'fsp_campaign_ch9', key: 'real_spy_continues_leaks', value: { real_spy_at_large: true } }] };
    return { GP: 0, XP: 150, reputationDelta: { fsp: -10 }, tags: ['too_slow'], loreFlags: ['ch6_time_expired', 'settlement_attacked_no_warning'], branchModifiers: [{ targetChapter: 'fsp_campaign_ch7', key: 'settlement_damaged_no_warning', value: { starting_morale: -20 } }] };
  }
  let gp = 6500;
  let rep = { fsp: 25 };
  const items = [{ type: 'ship', code: 'fsp_crs', label: 'Investigator Corvette', quantity: 1 }, { type: 'resource', code: 'carbon_fiber', label: 'Carbon Fiber', quantity: 6 }];
  const tags = [];
  const loreFlags = [];
  const branchModifiers = [];
  const masteries = [];
  if (secondary.includes('obj_collect_all_9_clues')) { gp += 5000; loreFlags.push('master_investigator'); }
  if (secondary.includes('obj_exonerate_innocents')) { gp += 2500; tags.push('thorough_judge'); }
  if (secondary.includes('obj_under_25min')) { gp += 3000; masteries.push('rapid_investigation'); }
  if (secondary.includes('obj_truth_revealed')) loreFlags.push('kenji_family_location_known');
  if (choiceId === 'fsp_ch6_execute_kenji') {
    gp += 3000; rep = mergeRep(rep, { fsp: -8, mcc: -15 });
    tags.push('coercive_executor');
    loreFlags.push('ch6_kenji_executed', 'spy_executed_publicly');
    items.push({ type: 'consumable_intel', code: 'mcc_attack_intel_full', label: 'MCC Attack Intel Full' });
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch7', key: 'assembly_fearful_atmosphere', value: { civilian_morale_buffer: -15 } });
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch9', key: 'kenji_family_killed_in_retaliation', value: { family_killed: true } });
  } else if (choiceId === 'fsp_ch6_use_as_handler') {
    gp += 4500; rep = mergeRep(rep, { fsp: 5, mcc: -25 });
    tags.push('the_handler');
    loreFlags.push('ch6_kenji_handler', 'spy_double_agent_active');
    items.push({ type: 'recurring_intel', code: 'kenji_handler_token', label: 'Kenji Handler Token' });
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch7', key: 'kenji_intelligence_pipeline', value: { disinfo_active_chapters: 2 } });
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch9', key: 'handler_discovery_risk', value: { risk_factor: 'high' } });
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch9', key: 'kenji_family_rescue_attempt', value: { unlocks_side_op: 'ch9_kenji_family_rescue_op' } });
  } else {
    gp += 2500; rep = mergeRep(rep, { mcc: -10 });
    tags.push('the_merciful');
    loreFlags.push('ch6_kenji_exiled', 'spy_exiled_mercifully');
    items.push({ type: 'consumable_intel', code: 'mcc_attack_intel_minimal', label: 'MCC Attack Intel Minimal' });
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch7', key: 'assembly_humanitarian_signal', value: { diplomatic_legitimacy_buffer: true } });
    branchModifiers.push({ targetChapter: 'fsp_campaign_ch9', key: 'no_intel_advantage', value: { no_intel_advantage: true } });
  }
  return { GP: gp, XP: 1100, reputationDelta: rep, items, tags, loreFlags, masteries, unlocks: [], branchModifiers };
}

function calculateFspCh7Rewards(progress, sim) {
  const secondary = sim.metrics.secondary_completed || [];
  if (!sim.success) {
    if (sim.failureReason === 'fail_assembly_riot') {
      return { GP: 0, XP: 200, reputationDelta: { fsp: -35 }, tags: ['riot_president'], loreFlags: ['ch7_assembly_riot'], unlocks: [FSP_CH8_ID], branchModifiers: [{ targetChapter: FSP_CH10_ID, key: 'ending_3_pathway_unlocked', value: { disillusioned_path: true } }] };
    }
    if (sim.failureReason === 'fail_environmental_crisis_critical_escalation') {
      return { GP: 0, XP: 250, reputationDelta: { fsp: -15 }, tags: ['distracted_leader'], loreFlags: ['ch7_crisis_critical_escalation', 'civilian_casualties_severe'], unlocks: [FSP_CH8_ID], branchModifiers: [{ targetChapter: FSP_CH8_ID, key: 'settlement_severely_weakened', value: { starting_morale: -25 } }] };
    }
    return { GP: 0, XP: 250, reputationDelta: { fsp: -20 }, tags: ['indecisive_settlement'], loreFlags: ['ch7_assembly_deadlock', 'fsp_political_paralysis'], unlocks: [FSP_CH8_ID], branchModifiers: [{ targetChapter: FSP_CH8_ID, key: 'gaia_funding_severely_compromised', value: { funding_buffer: -0.3 } }, { targetChapter: FSP_CH10_ID, key: 'ending_3_pathway_unlocked', value: { disillusioned_path: true } }] };
  }
  const winner = sim.metrics.chair_elected;
  let gp = 7000;
  let rep = { fsp: 30 };
  const items = [{ type: 'chair_seal', code: 'chair_seal', label: 'FSP Chair Seal' }, { type: 'resource', code: 'medical_kit', label: 'Medical Kit', quantity: 4 }];
  const tags = [];
  const loreFlags = [];
  const masteries = [];
  const branchModifiers = [];
  if (winner === 'mikhail_anders') {
    gp += 3000; tags.push('the_practical_leader'); loreFlags.push('ch7_mikhail_chair');
    branchModifiers.push({ targetChapter: FSP_CH8_ID, key: 'gaia_funding_pragmatic_drive', value: { funding_buffer: 0.1 } }, { targetChapter: FSP_CH10_ID, key: 'ending_1_pathway_aligned', value: { citizen_path: true } });
  } else if (winner === 'liang_wei') {
    gp += 3500; tags.push('the_visionary_chair'); loreFlags.push('ch7_liang_chair');
    items.push({ type: 'access_token', code: 'liang_wei_chair_office_access', label: 'Liang Wei Chair Office Access' });
    branchModifiers.push({ targetChapter: FSP_CH8_ID, key: 'gaia_visionary_design_approved', value: { tech_innovation_buffer: 0.15 } }, { targetChapter: FSP_CH9_ID, key: 'liang_diplomatic_summit_attendance', value: { liang_voice_at_summit: true } }, { targetChapter: FSP_CH10_ID, key: 'ending_2_pathway_aligned', value: { peacemaker_path: true } });
  } else if (winner === 'amara_okafor') {
    gp += 3000; tags.push('the_diplomatic_chair'); loreFlags.push('ch7_amara_chair');
    branchModifiers.push({ targetChapter: FSP_CH9_ID, key: 'three_flags_proactive_route', value: { summit_starts_advantageous: true } }, { targetChapter: FSP_CH10_ID, key: 'ending_2_pathway_aligned', value: { peacemaker_path: true } });
  } else if (winner === 'diego_cole') {
    gp += 2500; tags.push('the_caretaker_chair'); loreFlags.push('ch7_diego_chair');
    branchModifiers.push({ targetChapter: FSP_CH10_ID, key: 'ending_1_pathway_aligned', value: { citizen_path: true } });
  } else if (winner === 'player_self_run') {
    gp += 5000; rep = mergeRep(rep, { fsp: -10, mcc: 5 }); tags.push('the_outsider_chair', 'crown_seeker'); loreFlags.push('ch7_player_chair', 'assembly_charter_amended_outsider_eligible');
    items.push({ type: 'ending_seed', code: 'pilgrim_arms_charter_seed', label: 'Pilgrim Arms Charter Seed' });
    branchModifiers.push({ targetChapter: FSP_CH10_ID, key: 'ending_4_pathway_unlocked', value: { pilgrim_arms_seed_active: true } });
  }
  if (secondary.includes('obj_environmental_crisis_resolved')) loreFlags.push('ch7_crisis_resolved');
  else loreFlags.push('ch7_crisis_unresolved');
  if (secondary.includes('obj_unanimity_chair')) { gp += 5000; loreFlags.push('assembly_unanimity'); masteries.push('political_mastery'); }
  if (secondary.includes('obj_dual_track_perfect')) { gp += 5000; tags.push('master_legislator'); masteries.push('dual_track_perfect'); }
  if (secondary.includes('obj_quick_consensus')) { gp += 3000; masteries.push('rapid_consensus'); }
  return { GP: gp, XP: 1300, reputationDelta: rep, items, tags, loreFlags, masteries, unlocks: [FSP_CH8_ID], branchModifiers };
}

function calculateFspCh8Rewards(progress, sim) {
  const choiceId = selectedChoiceId(progress, 'fsp_ch8_pledge_combat');
  const secondary = sim.metrics.secondary_completed || [];
  if (!sim.success) {
    if (sim.failureReason === 'fail_mcc_theft_detected') return { GP: 0, XP: 250, reputationDelta: { mcc: -60, fsp: -15 }, tags: ['the_failed_thief'], loreFlags: ['ch8_mcc_theft_detected'], unlocks: [FSP_CH9_ID], branchModifiers: [{ targetChapter: FSP_CH9_ID, key: 'mcc_revenge_doubled', value: { revenge: 2 } }] };
    if (sim.failureReason === 'fail_gaia_destroyed_in_combat') return { GP: 0, XP: 250, reputationDelta: { fsp: -40 }, tags: [], loreFlags: ['ch8_gaia_destroyed', 'gaia_destroyed'], unlocks: [FSP_CH9_ID], branchModifiers: [{ targetChapter: FSP_CH9_ID, key: 'no_gaia_at_summit', value: { gaia: 'destroyed' } }, { targetChapter: FSP_CH10_ID, key: 'ending_3_pathway_unavoidable', value: { disillusioned: true } }] };
    return { GP: 0, XP: 250, reputationDelta: { fsp: -30 }, tags: ['failed_funder'], loreFlags: ['ch8_gaia_construction_failed', 'gaia_failed'], unlocks: [FSP_CH9_ID], branchModifiers: [{ targetChapter: FSP_CH9_ID, key: 'no_gaia_at_summit', value: { gaia: 'failed' } }, { targetChapter: FSP_CH10_ID, key: 'ending_3_pathway_strengthened', value: { disillusioned: true } }] };
  }
  let gp = 8500;
  let rep = { fsp: 35 };
  const items = [{ type: 'ship', code: 'fsp_crs', label: 'Gaia Explorer Corvette', quantity: 1 }];
  const tags = [];
  const loreFlags = ['ch8_gaia_completed', 'gaia_full_specs'];
  const masteries = [];
  const branchModifiers = [{ targetChapter: FSP_CH9_ID, key: 'gaia_at_summit', value: { gaia_present: true } }];
  if (choiceId === 'fsp_ch8_donate_personal_50k') {
    gp += 5000; rep = mergeRep(rep, { fsp: 50 }); tags.push('fsp_brotherhood', 'the_humble_giver'); loreFlags.push('ch8_player_donated_personal');
    branchModifiers.push({ targetChapter: FSP_CH10_ID, key: 'ending_1_pathway_strengthened', value: { citizen_path: true } }, { targetChapter: FSP_CH10_ID, key: 'gaia_captain_offer_unlocked', value: { gaia_captain: true } });
  } else if (choiceId === 'fsp_ch8_pledge_combat') {
    gp += secondary.includes('obj_combat_pledger_no_civilian_loss') ? 4000 : 1500; rep = mergeRep(rep, { fsp: 25 }); tags.push('the_combat_pledger'); loreFlags.push('ch8_player_pledged_combat');
    if (secondary.includes('obj_combat_pledger_no_civilian_loss')) tags.push('master_protector');
    branchModifiers.push({ targetChapter: FSP_CH10_ID, key: 'ending_2_pathway_strengthened', value: { peacemaker_path: true } });
  } else if (choiceId === 'fsp_ch8_steal_mcc_funds') {
    gp += 6000; rep = mergeRep(rep, { fsp: 15, mcc: -30 }); tags.push('the_thief_with_purpose', 'the_funder'); loreFlags.push('ch8_player_chose_theft', 'ch8_mcc_theft_success', 'pilgrim_arms_seed_funded');
    branchModifiers.push({ targetChapter: FSP_CH10_ID, key: 'ending_4_pathway_strengthened', value: { pilgrim_arms_seed_funded: true } });
  } else {
    rep = mergeRep(rep, { fsp: -10 }); tags.push('the_silent_one', 'the_disengaged'); loreFlags.push('ch8_player_silent', 'civilian_silent_disappointment');
    branchModifiers.push({ targetChapter: FSP_CH10_ID, key: 'ending_3_pathway_strengthened', value: { disillusioned: true } });
  }
  if (secondary.includes('obj_enhanced_gaia_completion')) { gp += 4000; loreFlags.push('gaia_enhanced_specs'); items.push({ type: 'ship_module', code: 'gaia_combat_module', label: 'Gaia Combat Module' }); branchModifiers.push({ targetChapter: FSP_CH9_ID, key: 'gaia_combat_module_visible', value: { visible: true } }); }
  if (secondary.includes('obj_zero_wave_breach')) { gp += 3000; masteries.push('shipyard_master'); }
  if (secondary.includes('obj_under_25min')) { gp += 3000; masteries.push('rapid_construction_defense'); }
  if (sim.metrics.gaia_hp_percentage < 90) { loreFlags.push('ch8_gaia_completed_partial', 'gaia_partial_specs'); branchModifiers.push({ targetChapter: FSP_CH9_ID, key: 'gaia_at_summit_weakened', value: { gaia_hp: sim.metrics.gaia_hp_percentage } }); }
  return { GP: gp, XP: 1500, reputationDelta: rep, items, tags, loreFlags, masteries, unlocks: [FSP_CH9_ID], branchModifiers };
}

function calculateFspCh9Rewards(progress, sim) {
  const choiceId = selectedChoiceId(progress, 'fsp_ch9_protect_amara');
  const secondary = sim.metrics.secondary_completed || [];
  let gp = 9000;
  let rep = { fsp: 40 };
  const items = [{ type: 'summit_token', code: 'hale_blessing_token', label: 'Hale Blessing Token' }];
  const tags = [];
  const loreFlags = ['pilgrim_arms_publicly_known', 'cross_route_pilgrim_arms_first_appearance'];
  const masteries = [];
  const branchModifiers = [];
  if (choiceId === 'fsp_ch9_protect_amara') {
    gp += 4000; rep = mergeRep(rep, { fsp: 50, mcc: -20 }); tags.push('the_loyal_protector'); loreFlags.push('ch9_amara_protected');
    branchModifiers.push({ targetChapter: FSP_CH10_ID, key: 'ending_1_pathway_strengthened', value: { citizen_path: true } }, { targetChapter: FSP_CH10_ID, key: 'ending_2_pathway_aligned', value: { peacemaker_path: true } });
  } else if (choiceId === 'fsp_ch9_protect_butcher') {
    gp += 4000; rep = mergeRep(rep, { cv: 60, mcc: -40, fsp: 10 }); tags.push('the_unexpected_ally'); loreFlags.push('ch9_butcher_protected', 'cv_potential_alliance_path');
    branchModifiers.push({ targetChapter: FSP_CH10_ID, key: 'ending_2_alt_path_cv_alliance', value: { cv_big_tent: true } });
  } else if (choiceId === 'fsp_ch9_full_retreat') {
    gp += 5000; tags.push('the_indecisive_arbiter'); loreFlags.push('ch9_full_retreat', 'summit_postponed_one_year');
    branchModifiers.push({ targetChapter: FSP_CH10_ID, key: 'ending_2_pathway_aligned', value: { peacemaker_path: true } }, { targetChapter: FSP_CH10_ID, key: 'ending_3_pathway_strengthened', value: { disillusioned: true } });
  } else if (choiceId === 'fsp_ch9_protect_chen') {
    gp += 1000; rep = mergeRep(rep, { mcc: 100, fsp: -100, cv: -50 }); tags.push('the_corporate_servant', 'fsp_route_betrayer'); loreFlags.push('ch9_chen_protected', 'fsp_route_terminated_by_betrayal');
    branchModifiers.push({ targetChapter: FSP_CH10_ID, key: 'ending_3_pathway_unavoidable', value: { betrayal_variant: true } });
  } else {
    gp += 6000; rep = mergeRep(rep, { mcc: -100, fsp: -50, cv: -20 }); tags.push('the_fourth_faction_emergent', 'fourth_faction_slayer'); loreFlags.push('ch9_chen_killed_by_player_signal', 'pilgrim_arms_full_alignment', 'chen_weiss_dead');
    branchModifiers.push({ targetChapter: FSP_CH10_ID, key: 'ending_4_pathway_unavoidable', value: { new_chair: true } });
  }
  if (secondary.includes('obj_full_squad_killed')) { gp += 3000; tags.push('fourth_faction_slayer'); masteries.push('assassin_hunter'); }
  if (secondary.includes('obj_zero_casualty_summit')) loreFlags.push('zero_casualty_summit');
  if (secondary.includes('obj_under_25min')) { gp += 3000; masteries.push('rapid_summit'); }
  return { GP: gp, XP: 1700, reputationDelta: rep, items, tags, loreFlags, masteries, unlocks: [FSP_CH10_ID], branchModifiers };
}

function calculateFspCh10Rewards(progress, sim) {
  const choiceId = selectedChoiceId(progress, 'fsp_bad_ending_fallback');
  const endingMap = {
    fsp_ending_1_citizen: { gp: 200000, rep: { fsp: 150 }, tags: ['fsp_citizen_eternal', 'the_humble_giver_legacy'], flag: 'fsp_ending_1_citizen' },
    fsp_ending_2_peacemaker: { gp: 300000, rep: { fsp: 50, mcc: 50, cv: 50 }, tags: ['the_peacemaker_eternal', 'master_diplomat'], flag: 'fsp_ending_2_peacemaker' },
    fsp_ending_2_alt_gaia_captain: { gp: 250000, rep: { fsp: 120 }, tags: ['gaia_first_captain_legendary', 'fsp_brotherhood_eternal'], flag: 'fsp_ending_2_alt_gaia_captain' },
    fsp_ending_3_disillusioned: { gp: 150000, rep: { fsp: -10 }, tags: ['the_drifter', 'the_disillusioned'], flag: 'fsp_ending_3_disillusioned' },
    fsp_ending_4_new_chair: { gp: 1000000, rep: { mcc: -150, fsp: -100, cv: -50 }, tags: ['the_fourth_faction_founder', 'ascendant_chair_eternal'], flag: 'fsp_ending_4_new_chair' },
  };
  const ending = endingMap[choiceId] || { gp: 5000, rep: {}, tags: ['failed_arc'], flag: 'ch10_bad_ending_assigned' };
  const loreFlags = ['fsp_route_ch10_completed', ending.flag, `ch10_ending_locked:${choiceId}`];
  const masteries = [];
  let gp = 10000 + ending.gp;
  if (['fsp_ending_1_citizen', 'fsp_ending_2_peacemaker', 'fsp_ending_2_alt_gaia_captain'].includes(choiceId)) { gp += 5000; masteries.push('ideal_path_walker'); }
  if (choiceId === 'fsp_ending_4_new_chair') gp += 6000;
  if (choiceId === 'fsp_ending_2_alt_gaia_captain') { gp += 4000; masteries.push('explorer'); }
  return {
    GP: gp,
    XP: 2000,
    reputationDelta: ending.rep,
    items: [{ type: 'route_completion_token', code: 'fsp_route_completion_token', label: 'FSP Route Completion Token' }],
    tags: ending.tags,
    loreFlags,
    masteries,
    unlocks: [],
    branchModifiers: [{ targetChapter: 'ng_plus', key: 'fsp_route_completed', value: { ending: choiceId } }],
  };
}

// ─── CV 루트 시뮬레이터 (CH1~9 공통) ────────────────────────────────────────
// CV 챕터에는 MCC/FSP 같은 개별 시뮬레이터가 없어 모두 이 함수로 처리한다.
function simulateCvChapter(progress) {
  const chNum = parseInt((progress.quest_id || '').replace('cv_campaign_ch', ''), 10) || 1;
  // 각 챕터별 기본 선택지 ID (첫 번째 선택지)
  const defaultChoiceByChapter = {
    [CV_CH1_ID]: 'cv_ch1_brutal',
    [CV_CH2_ID]: 'cv_ch2_full_raid',
    [CV_CH3_ID]: 'cv_ch3_crush',
    [CV_CH4_ID]: 'cv_ch4_support_cinder',
    [CV_CH5_ID]: 'cv_ch5_full_force',
    [CV_CH6_ID]: 'cv_ch6_listen_all',
    [CV_CH7_ID]: 'cv_ch7_follow_butcher',
    [CV_CH8_ID]: 'cv_ch8_bloc_vote',
    [CV_CH9_ID]: 'cv_ch9_stand_with_butcher',
  };
  const defaultChoice = defaultChoiceByChapter[progress.quest_id] || 'cv_ch1_brutal';
  const choiceId = selectedChoiceId(progress, defaultChoice) || defaultChoice;
  const roll = seededFloat(`${progress.wallet}:${progress.session_id}:${choiceId}:cv${chNum}`);

  // 선택지 성향 분류
  const aggressiveSet = new Set(['cv_ch1_brutal','cv_ch2_full_raid','cv_ch3_crush',
    'cv_ch5_full_force','cv_ch7_follow_butcher','cv_ch8_bloc_vote','cv_ch9_stand_with_butcher']);
  const diplomaticSet = new Set(['cv_ch1_smart','cv_ch2_selective','cv_ch3_cinder_way',
    'cv_ch4_support_cinder','cv_ch5_three_way','cv_ch6_listen_all','cv_ch7_negotiate',
    'cv_ch8_speak','cv_ch9_stand_with_cinder','cv_ch9_ask_hale']);
  const refuseSet = new Set(['cv_ch1_refuse','cv_ch2_abort','cv_ch5_withdraw',
    'cv_ch7_disappear','cv_ch9_alone']);

  const aggressive = aggressiveSet.has(choiceId);
  const diplomatic = diplomaticSet.has(choiceId);
  const refused = refuseSet.has(choiceId);

  // 성공 판정
  const baseChance = aggressive ? 0.82 : diplomatic ? 0.74 : refused ? 0.42 : 0.68;
  const success = roll < baseChance;
  let failureReason = null;
  if (!success) {
    failureReason = refused ? 'fail_refused_orders' : roll > 0.88 ? 'fail_ambushed' : 'fail_objective_lost';
  }

  // 습격/전투 지표
  const raidPct = Math.round(clampNumber(
    aggressive ? 70 + roll * 30 : diplomatic ? 50 + roll * 30 : 25 + roll * 35, 0, 100));
  const shipsLost = Math.round(aggressive ? 1 + (1 - roll) * 5 : diplomatic ? (1 - roll) * 3 : (1 - roll) * 2);
  const elapsed = Math.round(600 + chNum * 80 + roll * 400);
  const cinderAlignment = diplomatic ? 'high' : aggressive ? 'low' : 'neutral';

  return {
    success,
    failureReason,
    metrics: {
      chapter_number: chNum,
      raid_success_percent: raidPct,
      ships_lost: shipsLost,
      choice_id: choiceId,
      aggressive_approach: aggressive,
      diplomatic_approach: diplomatic,
      cinder_alignment: cinderAlignment,
      elapsed_sec: elapsed,
      environmental_phase_reached: phaseForChapter(progress.quest_id, elapsed),
    },
  };
}

function simulateCvCh10(progress) {
  const choiceId = selectedChoiceId(progress, 'cv_ch10_mercenary') || 'cv_ch10_mercenary';
  return { success: true, failureReason: null, metrics: { choice_id: choiceId, chapter_number: 10, elapsed_sec: 600 } };
}

// ─── CV 루트 보상 계산 (CH1~9 공통) ─────────────────────────────────────────
function calculateCvChapterRewards(progress, sim) {
  const chNum = parseInt((progress.quest_id || '').replace('cv_campaign_ch', ''), 10) || 1;
  if (!sim.success) {
    const nextQuestId = chNum < 9 ? `cv_campaign_ch${chNum + 1}` : null;
    return { GP: 0, XP: 80 + chNum * 20, reputationDelta: { cv: -5 }, items: [], tags: [], loreFlags: [], masteries: [], branchModifiers: [], unlocks: nextQuestId ? [] : [] };
  }
  const metrics = sim.metrics || {};
  const gp = 9000 + chNum * 2500 + (metrics.raid_success_percent >= 90 ? 5000 : metrics.raid_success_percent >= 75 ? 2000 : 0);
  const xp = 120 + chNum * 60;
  const rep = { cv: 10 + chNum * 2 };
  if (metrics.diplomatic_approach) { rep.fsp = (rep.fsp || 0) + 3; }
  if (metrics.aggressive_approach) { rep.mcc = (rep.mcc || 0) - 5; rep.fsp = (rep.fsp || 0) - 5; }

  const loreFlags = [`cv_ch${chNum}_completed`];
  const tags = [];
  const items = [];
  if (chNum >= 8 && metrics.cinder_alignment === 'high') tags.push('cinder_ally');
  if (metrics.raid_success_percent >= 90) loreFlags.push(`cv_ch${chNum}_elite_raid`);

  // 챕터별 인박스 함선 보상 (ch5, ch8)
  if (chNum === 5) items.push({ type: 'ship', code: 'cv_raider', quantity: 1, label: 'CV Raider', note: 'CV Kepler 전역 보상 함선' });
  if (chNum === 8) items.push({ type: 'ship', code: 'cv_bomber', quantity: 1, label: 'CV Bomber', note: 'CV 붉은 의회 보상 함선' });

  const nextQuestId = `cv_campaign_ch${chNum + 1}`;
  return {
    GP: gp, XP: xp,
    reputationDelta: rep,
    items,
    tags,
    loreFlags,
    masteries: [],
    branchModifiers: [],
    unlocks: chNum < 9 ? [nextQuestId] : [CV_CH10_ID],
  };
}

function calculateCvCh10Rewards(progress, sim) {
  const choiceId = selectedChoiceId(progress, 'cv_ch10_mercenary') || 'cv_ch10_mercenary';
  const endingMap = {
    cv_ch10_warlord:   { gp: 200000, rep: { cv: 100, mcc: -80, fsp: -80 }, tags: ['cv_warlord_eternal', 'the_feared_one'], flag: 'cv_ending_warlord' },
    cv_ch10_renegade:  { gp: 150000, rep: { cv: 20, mcc: -20, fsp: -20 }, tags: ['cv_renegade_eternal', 'the_stateless'], flag: 'cv_ending_renegade' },
    cv_ch10_mercenary: { gp: 180000, rep: { cv: 50 }, tags: ['cv_mercenary_eternal', 'code_is_law'], flag: 'cv_ending_mercenary' },
    cv_ch10_crown:     { gp: 300000, rep: { cv: 150, mcc: -100, fsp: -50 }, tags: ['cv_zone12_king', 'the_crowned_warlord'], flag: 'cv_ending_crown' },
  };
  const ending = endingMap[choiceId] || { gp: 5000, rep: { cv: -10 }, tags: ['cv_bad_ending'], flag: 'cv_ending_unknown' };
  const gp = 10000 + ending.gp;
  return {
    GP: gp,
    XP: 2000,
    reputationDelta: ending.rep,
    items: [{ type: 'route_completion_token', code: 'cv_route_completion_token', label: 'CV Route Completion Token' }],
    tags: ending.tags,
    loreFlags: ['cv_route_ch10_completed', ending.flag, `cv_ending_locked:${choiceId}`],
    masteries: [],
    unlocks: [],
    branchModifiers: [{ targetChapter: 'ng_plus', key: 'cv_route_completed', value: { ending: choiceId } }],
  };
}

// 프롤로그는 GP 보상 없이 소량의 XP 만 지급한다. 다음 챕터(Ch1)의 prerequisite 만 만족하면 된다.
function calculatePrologueRewards(progress, sim) {
  const faction = progress.quest_id.startsWith('mcc') ? 'mcc' :
                  progress.quest_id.startsWith('fsp') ? 'fsp' : 'cv';
  const nextChapter = `${faction}_campaign_ch1`;
  return {
    GP: 0,
    XP: 50,
    reputationDelta: { [faction]: 5 },
    items: [],
    tags: [],
    loreFlags: [`${faction}_prologue_completed`],
    masteries: [],
    titles: [],
    branchModifiers: [],
    unlocks: [nextChapter],
  };
}

function calculateRewards(progress, sim) {
  if (isPrologueQuest(progress.quest_id)) return calculatePrologueRewards(progress, sim);
  if (progress.quest_id === CH2_ID) return calculateCh2Rewards(progress, sim);
  if (progress.quest_id === CH3_ID) return calculateCh3Rewards(progress, sim);
  if (progress.quest_id === CH4_ID) return calculateCh4Rewards(progress, sim);
  if (progress.quest_id === CH5_ID) return calculateCh5Rewards(progress, sim);
  if (progress.quest_id === CH6_ID) return calculateCh6Rewards(progress, sim);
  if (progress.quest_id === CH7_ID) return calculateCh7Rewards(progress, sim);
  if (progress.quest_id === CH8_ID) return calculateCh8Rewards(progress, sim);
  if (progress.quest_id === CH9_ID) return calculateCh9Rewards(progress, sim);
  if (progress.quest_id === CH10_ID) return calculateCh10Rewards(progress, sim);
  if (progress.quest_id === FSP_CH1_ID) return calculateFspCh1Rewards(progress, sim);
  if (progress.quest_id === FSP_CH2_ID) return calculateFspCh2Rewards(progress, sim);
  if (progress.quest_id === FSP_CH3_ID) return calculateFspCh3Rewards(progress, sim);
  if (progress.quest_id === FSP_CH4_ID) return calculateFspCh4Rewards(progress, sim);
  if (progress.quest_id === FSP_CH5_ID) return calculateFspCh5Rewards(progress, sim);
  if (progress.quest_id === FSP_CH6_ID) return calculateFspCh6Rewards(progress, sim);
  if (progress.quest_id === FSP_CH7_ID) return calculateFspCh7Rewards(progress, sim);
  if (progress.quest_id === FSP_CH8_ID) return calculateFspCh8Rewards(progress, sim);
  if (progress.quest_id === FSP_CH9_ID) return calculateFspCh9Rewards(progress, sim);
  if (progress.quest_id === FSP_CH10_ID) return calculateFspCh10Rewards(progress, sim);
  if (progress.quest_id === CV_CH10_ID) return calculateCvCh10Rewards(progress, sim);
  if (progress.quest_id === CV_CH1_ID) return calculateCvChapterRewards(progress, sim);
  if (progress.quest_id === CV_CH2_ID) return calculateCvChapterRewards(progress, sim);
  if (progress.quest_id === CV_CH3_ID) return calculateCvChapterRewards(progress, sim);
  if (progress.quest_id === CV_CH4_ID) return calculateCvChapterRewards(progress, sim);
  if (progress.quest_id === CV_CH5_ID) return calculateCvChapterRewards(progress, sim);
  if (progress.quest_id === CV_CH6_ID) return calculateCvChapterRewards(progress, sim);
  if (progress.quest_id === CV_CH7_ID) return calculateCvChapterRewards(progress, sim);
  if (progress.quest_id === CV_CH8_ID) return calculateCvChapterRewards(progress, sim);
  if (progress.quest_id === CV_CH9_ID) return calculateCvChapterRewards(progress, sim);
  return calculateCh1Rewards(progress, sim);
}

async function getStatus(wallet) {
  const w = normalizeWallet(wallet);
  const [progressRes, reputationRes, branchRes, playerBranchRes, inboxRes, tagRes, sessionRes, objectiveState] = await Promise.all([
    pool.query(`SELECT * FROM player_campaign_progress WHERE wallet = $1 ORDER BY chapter_number ASC`, [w]),
    pool.query(`SELECT faction, value FROM player_reputation WHERE wallet = $1 ORDER BY faction ASC`, [w]),
    pool.query(`SELECT target_chapter, modifier_key, modifier_value, source_quest_id, created_at FROM chapter_branch_modifiers WHERE wallet = $1 ORDER BY created_at DESC`, [w]),
    pool.query(`SELECT modifier_id FROM player_branch_modifiers WHERE wallet = $1 AND consumed_at IS NULL ORDER BY set_at DESC`, [w]),
    pool.query(`SELECT id, quest_id, reward_type, reward_code, quantity, payload, created_at FROM campaign_reward_inbox WHERE wallet = $1 AND claimed = FALSE ORDER BY created_at DESC LIMIT 20`, [w]),
    pool.query(`SELECT tag_id FROM player_tags WHERE wallet = $1 ORDER BY created_at DESC`, [w]),
    pool.query(`SELECT * FROM campaign_sessions WHERE wallet = $1 AND status = 'active' ORDER BY started_at DESC LIMIT 1`, [w]),
    getObjectiveState(w),
  ]);
  const rows = progressRes.rows;
  const progressByQuest = {};
  rows.forEach(r => { progressByQuest[r.quest_id] = r; });
  const reputation = {};
  reputationRes.rows.forEach(r => { reputation[r.faction] = r.value; });
  for (const faction of FACTIONS) if (reputation[faction] == null) reputation[faction] = 0;
  const completedSet = new Set(rows.filter(r => r.status === 'completed' || r.status === 'claimed').map(r => r.quest_id));
  const activeSet = new Set(rows.filter(r => r.status === 'in_progress').map(r => r.quest_id));
  // Failed chapters are always retryable — never lock them regardless of prereq state
  const failedSet = new Set(rows.filter(r => r.status === 'failed').map(r => r.quest_id));
  const tagSet = new Set(tagRes.rows.map(r => r.tag_id));
  const branchSet = new Set([
    ...branchRes.rows.map(r => r.modifier_key),
    ...playerBranchRes.rows.map(r => r.modifier_id),
  ]);
  const availableChapters = [];
  const lockedChapters = [];
  for (const ch of Object.values(CHAPTERS)) {
    if (completedSet.has(ch.questId) || activeSet.has(ch.questId)) continue;
    // Always allow retry of previously failed chapters — they must never appear locked
    if (failedSet.has(ch.questId)) { availableChapters.push(ch.questId); continue; }
    const prereqOk = !ch.prerequisiteChapter || completedSet.has(ch.prerequisiteChapter) || (ch.questId === CH3_ID && branchSet.has('mcc_route_termination_offered'));
    const repOk = Object.entries(ch.requiredReputation || {}).every(([f, v]) => (reputation[f] || 0) >= v);
    const tagOk = !(ch.blockingTags || []).some(t => tagSet.has(t));
    const branchOk = !(ch.requiredBranchAny || []).length || ch.requiredBranchAny.some(b => branchSet.has(b));
    if (prereqOk && repOk && tagOk && branchOk) availableChapters.push(ch.questId);
    else lockedChapters.push(ch.questId);
  }
  return {
    chapters: Object.values(CHAPTERS).map(ch => publicChapter(ch, progressByQuest[ch.questId], objectiveState)),
    completedChapters: Array.from(completedSet),
    active: rows.find(r => r.status === 'in_progress') ? formatProgress(rows.find(r => r.status === 'in_progress')) : null,
    activeSession: sessionRes.rows[0] || null,
    objectiveState,
    availableChapters,
    lockedChapters,
    reputation,
    tierLabels: Object.fromEntries(Object.entries(reputation).map(([f, v]) => [f, reputationTierLabel(v)])),
    tags: tagRes.rows.map(r => r.tag_id),
    branchModifiers: branchRes.rows,
    rewardInbox: inboxRes.rows,
  };
}

async function applyClaimedInboxReward(client, wallet, reward) {
  const qty = Math.max(1, parseInt(reward.quantity || 1, 10) || 1);
  const payload = reward.payload && typeof reward.payload === 'object' ? reward.payload : {};
  const type = String(reward.reward_type || payload.type || '').toLowerCase();
  const code = String(reward.reward_code || payload.code || '').trim();
  const label = payload.label || code;
  const applied = [];

  if (!code) return { applied, note: 'empty reward code' };

  if (type === 'ship' || type === 'ship_fleet') {
    const granted = await grantCampaignShips(client, wallet, code, qty);
    if (granted.length) {
      return { applied: granted.map(g => ({ kind: 'ship', code: g.shipTypeCode, id: g.shipId })) };
    }
  }

  // Resource rewards are real inventory when the code exists in resources.
  if (type === 'resource' || type === 'resource_stream') {
    const { rows } = await client.query('SELECT id FROM resources WHERE code = $1 AND COALESCE(is_active, true) = true', [code]);
    if (rows[0]) {
      await client.query(
        `INSERT INTO user_resource_inventory (wallet_address, resource_id, quantity, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (wallet_address, resource_id)
         DO UPDATE SET quantity = user_resource_inventory.quantity + EXCLUDED.quantity,
                       updated_at = NOW()`,
        [wallet, rows[0].id, qty]
      );
      applied.push({ kind: 'resource', code, quantity: qty });
      return { applied };
    }
  }

  // Item rewards are real item inventory when the code exists in item_types.
  const itemRes = await client.query('SELECT id FROM item_types WHERE code = $1 AND COALESCE(active, true) = true', [code]);
  if (itemRes.rows[0]) {
    await client.query(
      `INSERT INTO user_items (wallet, item_type_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (wallet, item_type_id)
       DO UPDATE SET quantity = user_items.quantity + EXCLUDED.quantity`,
      [wallet, itemRes.rows[0].id, qty]
    );
    applied.push({ kind: 'item', code, quantity: qty });
    return { applied };
  }

  // Narrative/entitlement rewards are still claimable so the campaign cannot dead-end while
  // those long-term systems are being built out.
  const typeNotes = {
    ship_blueprint: '설계도가 연구 데이터에 기록되었습니다. 추후 조선소 시스템 확장 시 실제 건조가 가능해집니다.',
    ship_choice: '함선 선택권이 부여되었습니다. 함선 지급 시스템 확장 후 선택 화면이 열립니다.',
    asset: '전략 자산이 기록되었습니다. 자산 관리 시스템에서 확인할 수 있습니다.',
    resource_stream: '자원 공급 계약이 체결되었습니다. 정기 공급 시스템 확장 시 자원이 배송됩니다.',
    contract: '계약이 체결되어 기록되었습니다. 계약 시스템 확장 후 효과가 활성화됩니다.',
    data_artifact: '데이터 아티팩트가 기록되었습니다. 서사 진행에 영향을 미칠 수 있습니다.',
  };
  const friendlyNote = typeNotes[type] || `${label || code} 보상이 수령 처리되었습니다.`;
  return { applied, note: friendlyNote, label, rewardType: type };
}

function campaignShipRewardPlan(code, quantity) {
  const q = Math.max(1, parseInt(quantity || 1, 10) || 1);
  const single = {
    shard_frigate: ['mcc_frg'],
    longeye_sniper: ['mcc_snp'],
    fsp_sequoia_borrowed: ['fsp_bs'],
    vector_destroyer_captured: ['mcc_dst'],
    prometheus_titan: ['mcc_titan'],
    tessellate_battleship: ['mcc_bs'],
    captured_sequoia: ['fsp_bs'],
    captured_ironclad: ['cv_bs'],
    pilgrim_pa3: ['cv_crs'],
    // CV 루트 보상 함선
    cv_raider: ['cv_int'],
    cv_bomber: ['cv_bomb'],
    cv_titan: ['cv_titan'],
    fsp_ironclad: ['fsp_bs'],
    fsp_logi: ['fsp_logi'],
    fsp_logi_crs: ['fsp_logi_crs'],
  };
  if (single[code]) return Array(q).fill(single[code]).flat();

  if (code === 'mcc_loyal_hire_fleet') return ['mcc_frg', 'mcc_frg', 'mcc_dst', 'mcc_crs', 'mcc_snp'].slice(0, q);
  if (code === 'mcc_executive_fleet') return ['mcc_frg', 'mcc_dst', 'mcc_crs', 'mcc_snp', 'mcc_bs', 'mcc_ewar', 'mcc_int'].slice(0, q);
  if (code === 'pilgrim_arms_starter_fleet') {
    const pattern = ['cv_int', 'cv_frg', 'cv_dst', 'cv_crs', 'cv_bomb'];
    return Array.from({ length: q }, (_, i) => pattern[i % pattern.length]);
  }
  return [];
}

async function getOrCreateCampaignFleet(client, wallet) {
  const { rows: existing } = await client.query(
    `SELECT id FROM fleets WHERE owner_wallet = $1 ORDER BY id ASC LIMIT 1`,
    [wallet]
  );
  if (existing[0]) return existing[0].id;
  const { rows: nick } = await client.query('SELECT nickname FROM users WHERE LOWER(wallet_address) = LOWER($1)', [wallet]);
  const name = `${nick[0]?.nickname || 'Commander'} 제1함대`;
  const { rows } = await client.query(
    `INSERT INTO fleets (owner_wallet, name, formation, movement)
     VALUES ($1, $2, 'wedge', 'advance')
     RETURNING id`,
    [wallet, name]
  );
  return rows[0].id;
}

async function grantCampaignShips(client, wallet, rewardCode, quantity) {
  const plan = campaignShipRewardPlan(rewardCode, quantity);
  if (!plan.length) return [];
  const fleetId = await getOrCreateCampaignFleet(client, wallet);
  const granted = [];
  for (const shipTypeCode of plan) {
    const { rows: stRows } = await client.query(
      `SELECT code, base_hp, is_flagship_capable
       FROM ship_types
       WHERE code = $1 AND is_active = true`,
      [shipTypeCode]
    );
    const st = stRows[0];
    if (!st) continue;
    const { rows: flagRows } = await client.query(
      `SELECT COUNT(*) AS c
       FROM ships
       WHERE fleet_id = $1 AND is_flagship = true AND is_alive = true`,
      [fleetId]
    );
    const isFlagship = parseInt(flagRows[0]?.c || 0, 10) === 0 && st.is_flagship_capable;
    const { rows: shipRows } = await client.query(
      `INSERT INTO ships (
         fleet_id, ship_type_code, owner_wallet,
         current_hp, max_hp, is_flagship, is_alive,
         built_at, built_by_wallet
       ) VALUES ($1, $2, $3, $4, $4, $5, true, NOW(), $3)
       RETURNING id`,
      [fleetId, shipTypeCode, wallet, st.base_hp, isFlagship]
    );
    granted.push({ shipTypeCode, shipId: shipRows[0].id });
  }
  return granted;
}

async function claimReward(wallet, rewardId) {
  const w = normalizeWallet(wallet);
  const id = parseInt(rewardId, 10);
  if (!w || !id) return { error: 'INVALID_REWARD' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rewardRes = await client.query(
      `SELECT id, wallet, quest_id, reward_type, reward_code, quantity, payload, created_at
       FROM campaign_reward_inbox
       WHERE id = $1 AND wallet = $2 AND claimed = FALSE
       FOR UPDATE`,
      [id, w]
    );
    const reward = rewardRes.rows[0];
    if (!reward) {
      await client.query('ROLLBACK');
      return { error: 'REWARD_NOT_FOUND' };
    }

    const applyResult = await applyClaimedInboxReward(client, w, reward);
    await client.query(
      `UPDATE campaign_reward_inbox
       SET claimed = TRUE, claimed_at = NOW()
       WHERE id = $1`,
      [id]
    );
    await client.query(
      `INSERT INTO transactions (type, from_wallet, pp_amount, usdt_amount, fee, meta)
       VALUES ('quest', $1, 0, 0, 0, $2)`,
      [w, JSON.stringify({
        source: 'campaign_reward_claim',
        rewardId: id,
        questId: reward.quest_id,
        type: reward.reward_type,
        code: reward.reward_code,
        quantity: reward.quantity,
        applied: applyResult.applied,
        note: applyResult.note || null,
      })]
    );

    await client.query('COMMIT');
    return {
      success: true,
      reward: {
        id: reward.id,
        questId: reward.quest_id,
        type: reward.reward_type,
        code: reward.reward_code,
        quantity: reward.quantity,
        payload: reward.payload,
      },
      applied: applyResult.applied,
      note: applyResult.note || null,
    };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[campaign] reward claim error:', e && e.stack || e && e.message || e);
    throw e;
  } finally {
    client.release();
  }
}

async function validateStartConditions(client, wallet, chapter) {
  const userRows = await client.query('SELECT rank_level FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE', [wallet]);
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
    if (chapter.questId === CH10_ID) {
      const early = await client.query(
        `SELECT 1 FROM player_lore_flags
         WHERE wallet = $1 AND flag_id = 'chen_killed_in_prometheus'`,
        [wallet]
      );
      branchOverride = early.rows.length > 0;
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
  if (chapter.questId === FSP_CH5_ID) {
    const amaraDead = await client.query(
      `SELECT 1 FROM player_lore_flags WHERE wallet = $1 AND flag_id = 'amara_killed_at_sandstone' LIMIT 1`,
      [wallet]
    );
    if (amaraDead.rows.length) return { error: 'FSP_DELEGATION_ABSENT', alternativeChapter: 'fsp_campaign_ch5_no_chair_variant' };
  }
  if (chapter.questId === FSP_CH6_ID) {
    const collapse = await client.query(
      `SELECT flag_id FROM player_lore_flags
       WHERE wallet = $1 AND flag_id = ANY($2)`,
      [wallet, ['amara_killed_at_kepler', 'liang_wei_killed']]
    );
    const flags = new Set(collapse.rows.map(r => r.flag_id));
    if (flags.has('amara_killed_at_kepler') && flags.has('liang_wei_killed')) return { error: 'FSP_POLITICAL_COLLAPSE', alternativeChapter: 'fsp_campaign_ch6_collapse_variant' };
  }
  if ((chapter.requiredBranchAny || []).length) {
    const branch = await client.query(
      `SELECT modifier_id FROM player_branch_modifiers
       WHERE wallet = $1 AND modifier_id = ANY($2) AND consumed_at IS NULL`,
      [wallet, chapter.requiredBranchAny]
    );
    if (!branch.rows.length) return { error: 'BRANCH_REQUIRED', requiredAny: chapter.requiredBranchAny };
  }
  return null;
}

async function getRouteBranch(client, wallet) {
  const branch = await client.query(
    `SELECT modifier_id FROM player_branch_modifiers
     WHERE wallet = $1
       AND modifier_id = ANY($2)
       AND consumed_at IS NULL`,
    [wallet, ['mcc_route_a_active', 'mcc_route_b_active', 'mcc_route_c_active']]
  );
  const active = new Set(branch.rows.map(r => r.modifier_id));
  if (active.has('mcc_route_a_active')) return 'a';
  if (active.has('mcc_route_c_active')) return 'c';
  if (active.has('mcc_route_b_active')) return 'b';
  return null;
}

async function calculateEligibleEndings(client, wallet) {
  const route = await getRouteBranch(client, wallet);
  const repRes = await client.query(`SELECT value FROM player_reputation WHERE wallet = $1 AND faction = 'mcc'`, [wallet]);
  const flagRes = await client.query(
    `SELECT flag_id FROM player_lore_flags
     WHERE wallet = $1 AND flag_id = ANY($2)`,
    [wallet, ['dr_roth_data_obtained', 'ch6_chose_copy_silent', 'amara_dead', 'chen_killed_in_prometheus']]
  );
  const rewardRes = await client.query(
    `SELECT 1 FROM campaign_reward_inbox
     WHERE wallet = $1 AND reward_code = 'lifang_blackmail_data'
     LIMIT 1`,
    [wallet]
  );
  const flags = new Set(flagRes.rows.map(r => r.flag_id));
  const mcc = parseInt(repRes.rows[0]?.value || 0, 10);
  const hasBlackmail = flags.has('ch6_chose_copy_silent') || rewardRes.rows.length > 0;
  const eligible = [];
  if (flags.has('chen_killed_in_prometheus') || route === 'a') eligible.push('ending_3_whistleblower');
  if (route === 'b') {
    eligible.push('ending_1_loyal_hire');
    if (mcc >= 80 && flags.has('amara_dead')) eligible.push('ending_2_executive');
  }
  if (route === 'c') {
    eligible.push('ending_1_loyal_hire');
    if (flags.has('dr_roth_data_obtained') && mcc >= 80) eligible.push('ending_2_executive');
    if (hasBlackmail) eligible.push('ending_4_traitor');
  }
  if (!eligible.length) eligible.push('bad_ending_dismissed');
  return { route, eligible: Array.from(new Set(eligible)), mcc, flags: Array.from(flags), hasBlackmail };
}

async function calculateEligibleFspEndings(client, wallet) {
  const branch = await client.query(
    `SELECT modifier_id FROM player_branch_modifiers
     WHERE wallet = $1
       AND consumed_at IS NULL`,
    [wallet]
  );
  const active = new Set(branch.rows.map(r => r.modifier_id));
  const eligible = [];
  if (active.has('ending_1_pathway_aligned') || active.has('ending_1_pathway_strengthened')) eligible.push('fsp_ending_1_citizen');
  if (active.has('ending_2_pathway_aligned') || active.has('ending_2_pathway_strengthened') || active.has('ending_2_alt_path_cv_alliance')) eligible.push('fsp_ending_2_peacemaker');
  if (active.has('gaia_captain_offer_unlocked')) eligible.push('fsp_ending_2_alt_gaia_captain');
  if (active.has('ending_3_pathway_unlocked') || active.has('ending_3_pathway_unavoidable') || active.has('ending_3_pathway_strengthened')) eligible.push('fsp_ending_3_disillusioned');
  if (active.has('ending_4_pathway_unlocked') || active.has('ending_4_pathway_unavoidable') || active.has('ending_4_pathway_strengthened')) eligible.push('fsp_ending_4_new_chair');
  if (!eligible.length || active.has('bad_ending_dismissed') || active.has('bad_ending_forced')) eligible.push('fsp_bad_ending_fallback');
  return Array.from(new Set(eligible));
}

async function validateChapterChoice(client, wallet, progress, choiceId) {
  if (progress.quest_id === FSP_CH5_ID && (choiceId === 'fsp_ch5_propose_evidence_lever' || choiceId === 'fsp_ch5_propose_global_disclosure')) {
    const evidence = await client.query(
      `SELECT 1 FROM player_lore_flags
       WHERE wallet = $1
         AND flag_id = ANY($2)
       LIMIT 1`,
      [wallet, ['liang_wei_full_picture', 'roth_legacy_keeper', 'dr_roth_data_obtained']]
    );
    if (!evidence.rows.length) return { error: 'CHOICE_REQUIRES_ROTH_DATA', requiredAny: ['liang_wei_full_picture', 'roth_legacy_keeper', 'dr_roth_data_obtained'] };
    return null;
  }
  if (progress.quest_id === FSP_CH4_ID && choiceId === 'fsp_ch4_evidence_share') {
    const loreEvidence = await client.query(
      `SELECT 1 FROM player_lore_flags
       WHERE wallet = $1
         AND flag_id = ANY($2)
       LIMIT 1`,
      [wallet, ['official_op_chosen', 'mcc_oxygen_slavery_evidence_obtained']]
    );
    const branchEvidence = await client.query(
      `SELECT 1 FROM player_branch_modifiers
       WHERE wallet = $1
         AND modifier_id = ANY($2)
         AND consumed_at IS NULL
       LIMIT 1`,
      [wallet, ['cross_route_mcc_oxygen_slavery_known', 'mcc_oxygen_slavery_evidence_obtained']]
    );
    if (!loreEvidence.rows.length && !branchEvidence.rows.length) return { error: 'CHOICE_REQUIRES_EVIDENCE', requiredAny: ['official_op_chosen', 'mcc_oxygen_slavery_evidence_obtained', 'cross_route_mcc_oxygen_slavery_known'] };
    return null;
  }
  if (![CH7_ID, CH8_ID, CH9_ID, CH10_ID, FSP_CH7_ID, FSP_CH8_ID, FSP_CH9_ID, FSP_CH10_ID].includes(progress.quest_id)) return null;
  const fspConditionalChoiceRequirements = {
    fsp_ch9_signal_pilgrim_arms: ['ending_4_pathway_unlocked', 'ending_4_pathway_strengthened'],
  };
  const requiredFspModifiers = fspConditionalChoiceRequirements[choiceId];
  if ([FSP_CH7_ID, FSP_CH8_ID, FSP_CH9_ID].includes(progress.quest_id) && requiredFspModifiers) {
    const branch = await client.query(
      `SELECT 1 FROM player_branch_modifiers
       WHERE wallet = $1
         AND modifier_id = ANY($2)
         AND consumed_at IS NULL
       LIMIT 1`,
      [wallet, requiredFspModifiers]
    );
    if (!branch.rows.length) return { error: 'CHOICE_PREREQUISITE_NOT_MET', requiredAny: requiredFspModifiers };
    return null;
  }
  if (progress.quest_id === FSP_CH10_ID) {
    const eligible = await calculateEligibleFspEndings(client, wallet);
    if (!eligible.includes(choiceId)) return { error: 'ENDING_NOT_ELIGIBLE', valid: false, reason: 'ending_not_eligible', eligibleEndings: eligible };
    return null;
  }
  const route = await getRouteBranch(client, wallet);
  if (progress.quest_id === CH10_ID) {
    const endings = await calculateEligibleEndings(client, wallet);
    if (!endings.eligible.includes(choiceId)) return { error: 'ENDING_NOT_ELIGIBLE', eligibleEndings: endings.eligible };
    return null;
  }
  let allowedPrefix = null;
  if (progress.quest_id === CH7_ID) allowedPrefix = route === 'a' ? 'ch7a_' : route === 'c' ? 'ch7c_' : route === 'b' ? 'ch7b_' : null;
  if (progress.quest_id === CH8_ID) allowedPrefix = route === 'a' ? 'ch8a_' : route === 'c' ? 'ch8c_' : route === 'b' ? 'ch8b_' : null;
  if (progress.quest_id === CH9_ID) allowedPrefix = route === 'a' ? 'ch9a_' : route ? 'ch9_lead_' : null;
  if (!allowedPrefix) return { error: 'BRANCH_REQUIRED', requiredAny: ['mcc_route_a_active', 'mcc_route_b_active', 'mcc_route_c_active'] };
  if (!choiceId.startsWith(allowedPrefix)) {
    return { error: 'CHOICE_NOT_AVAILABLE_FOR_ROUTE', requiredPrefix: allowedPrefix };
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
      const objectiveState = await getObjectiveState(w);
      return { alreadyCompleted: true, chapter: publicChapter(chapter, existing.rows[0], objectiveState), progress: formatProgress(existing.rows[0]) };
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
    const objectiveState = await getObjectiveState(w);
    return { sessionId: rows[0].session_id, chapter: publicChapter(chapter, rows[0], objectiveState), progress: formatProgress(rows[0]) };
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
    // 평판 INSERT 가 첫 시도에 깨지지 않도록 행을 보장한다.
    await ensureUser(client, w);
    await ensureReputationRows(client, w);
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
    if (!chapter) {
      await client.query('ROLLBACK');
      return { error: 'QUEST_NOT_FOUND' };
    }
    let choice = chapter.choices.find(c => c.id === choiceId);
    if (!choice && chapter.choices.length === 0) {
      choice = findSceneChoice(chapter, choiceId);
    }
    if (!choice) {
      await client.query('ROLLBACK');
      return { error: 'INVALID_CHOICE' };
    }
    const choiceError = await validateChapterChoice(client, w, progress, choiceId);
    if (choiceError) {
      await client.query('ROLLBACK');
      return choiceError;
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
    if (choice.effects.extraBranchSet) {
      await client.query(
        `INSERT INTO player_branch_modifiers (wallet, modifier_id, target_chapter, source_chapter)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [w, choice.effects.extraBranchSet.modifierId, choice.effects.extraBranchSet.targetChapter, progress.quest_id]
      );
      await client.query(
        `INSERT INTO chapter_branch_modifiers (wallet, target_chapter, modifier_key, modifier_value, source_quest_id)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [w, choice.effects.extraBranchSet.targetChapter, choice.effects.extraBranchSet.modifierId, JSON.stringify({ fromChoice: choice.id }), progress.quest_id]
      );
    }
    for (const tag of choice.effects.tagsAdded || []) {
      await client.query(
        `INSERT INTO player_tags (wallet, tag_id, source_quest_id, acquired_from)
         VALUES ($1,$2,$3,$3) ON CONFLICT DO NOTHING`,
        [w, tag, progress.quest_id]
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
  const runtime = getChapterRuntimeSeconds(p.quest_id);
  const elapsed = Math.min(runtime, getCampaignElapsedSeconds(p));
  const progressPct = Math.min(100, Math.round((elapsed / runtime) * 100));
  const chapter = CHAPTERS[p.quest_id];
  const objectiveState = await getObjectiveState(w);
  const objectives = buildChapterObjectives(chapter, p, objectiveState, { progressPct });
  const missingObjectives = getMissingRequiredObjectives(objectives);
  const preview = {
    elapsedSec: elapsed,
    runtimeSec: runtime,
    remainingSec: Math.max(0, runtime - elapsed),
    progressPct,
    oxygenRecoveryPct: progressPct,
    readyToComplete: p.status === 'in_progress' && progressPct >= 100 && missingObjectives.length === 0,
    missingObjectives,
    objectives,
  };
  await pool.query(
    `UPDATE campaign_sessions SET current_metrics = $1, updated_at = NOW()
     WHERE session_id = $2 AND wallet = $3 AND status = 'active'`,
    [JSON.stringify(preview), sessionId, w]
  );
  if (p.status === 'in_progress' && progressPct < 100) {
    try { const _dOps = require('../routes/dailyOps'); _dOps.notifyMissionProgress(w, 'campaign_progress').catch(()=>{}); } catch(_) {}
  }
  return {
    progress: formatProgress(p),
    environmentalPhase: phaseForChapter(p.quest_id, elapsed),
    preview,
    objectives,
    nextObjective: objectives.find(o => o.state !== 'done') || objectives[objectives.length - 1] || null,
    missingObjectives,
    environmentState: getEnvironmentState(chapter?.environment, elapsed),
  };
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

async function applyOptionalCampaignReward(client, label, fn) {
  await client.query('SAVEPOINT campaign_optional_reward');
  try {
    await fn();
    await client.query('RELEASE SAVEPOINT campaign_optional_reward');
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT campaign_optional_reward');
    await client.query('RELEASE SAVEPOINT campaign_optional_reward');
    console.warn(`[CAMPAIGN] optional reward skipped (${label}):`, err.message);
  }
}

async function complete(wallet, sessionId) {
  const w = normalizeWallet(wallet);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // ensureUser 는 트랜잭션 시작 직후 한 번 실행한다 — 보상 INSERT 의 FK 위반을 미연에 방지한다.
    await ensureUser(client, w);
    const { rows } = await client.query(
      `SELECT * FROM player_campaign_progress WHERE wallet = $1 AND session_id = $2 AND status = 'in_progress' FOR UPDATE`,
      [w, sessionId]
    );
    const progress = rows[0];
    if (!progress) {
      await client.query('ROLLBACK');
      return { error: 'SESSION_NOT_FOUND' };
    }
    const runtime = getChapterRuntimeSeconds(progress.quest_id);
    const elapsed = Math.min(runtime, getCampaignElapsedSeconds(progress));
    if (!isInstantCampaignCompletion(progress.quest_id) && elapsed < runtime) {
      await client.query('ROLLBACK');
      return {
        error: 'MISSION_IN_PROGRESS',
        elapsedSec: elapsed,
        runtimeSec: runtime,
        remainingSec: runtime - elapsed,
      };
    }
    const campaignChapter = CHAPTERS[progress.quest_id];
    const objectiveState = await getObjectiveState(w);
    const objectives = buildChapterObjectives(campaignChapter, progress, objectiveState, { progressPct: 100 });
    const missingObjectives = getMissingRequiredObjectives(objectives);
    if (missingObjectives.length > 0) {
      await client.query('ROLLBACK');
      return {
        error: 'OBJECTIVE_REQUIREMENTS_NOT_MET',
        missingObjectives,
        objectives,
        nextObjective: objectives.find(o => o.state !== 'done') || missingObjectives[0],
        chapter: campaignChapter ? publicChapter(campaignChapter, progress, objectiveState) : null,
        progress: formatProgress(progress),
      };
    }
    if (progress.quest_id === CH10_ID || progress.quest_id === FSP_CH10_ID || progress.quest_id === CV_CH10_ID) {
      const choices = Array.isArray(progress.choices_payload) ? progress.choices_payload : [];
      const endingChoice = choices[0]?.choice_id;
      if (!endingChoice) {
        await client.query('ROLLBACK');
        return { error: 'ENDING_CHOICE_REQUIRED' };
      }
      if (progress.quest_id !== CV_CH10_ID) {
        const endingError = await validateChapterChoice(client, w, progress, endingChoice);
        if (endingError) {
          await client.query('ROLLBACK');
          return endingError;
        }
      }
    }
    const sim = simulateChapter(progress);
    const rewards = calculateRewards(progress, sim);
    const status = sim.success ? 'completed' : 'failed';

    // 평판 갱신: player_reputation 갱신은 중요하므로 SAVEPOINT 안에서 시도한다.
    // reputation_history 테이블 미존재 등 예외 발생 시 평판 변경만 건너뛰고 챕터 완료는 유지.
    await ensureReputationRows(client, w);
    await applyOptionalCampaignReward(client, 'reputation', () =>
      applyReputation(client, w, rewards.reputationDelta || {}, 'campaign_chapter', progress.quest_id)
    );
    if (sim.success) {
      // GP/XP/로그 INSERT 는 어느 한쪽 컬럼 변경이나 일시적인 제약 위반으로 챕터 완료 자체가
      // 실패하지 않도록 SAVEPOINT 로 감싼다 — 보상 일부가 실패해도 진행은 완료시킨다.
      if (rewards.GP > 0) {
        await applyOptionalCampaignReward(client, 'gp_balance', () => client.query(
          'UPDATE users SET gp_balance = COALESCE(gp_balance,0) + $1 WHERE LOWER(wallet_address) = LOWER($2)', [rewards.GP, w]
        ));
      }
      if (rewards.XP > 0) {
        await applyOptionalCampaignReward(client, 'awardXP', () => awardXP(client, w, rewards.XP));
      }
      for (const item of rewards.items || []) {
        await applyOptionalCampaignReward(client, `item:${item.code}`, () => client.query(
            `INSERT INTO campaign_reward_inbox (wallet, quest_id, reward_type, reward_code, quantity, payload)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [w, progress.quest_id, item.type, item.code, item.quantity || 1, JSON.stringify(item)]
          )
        );
      }
      for (const title of rewards.titles || []) {
        await applyOptionalCampaignReward(client, `title:${title}`, () => client.query(
            `INSERT INTO user_titles (user_wallet, title_code, title_en, title_ko)
             VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
            [w, title, 'Efficient Operator', '효율적인 해결사']
          )
        );
      }
      for (const mastery of rewards.masteries || []) {
        await applyOptionalCampaignReward(client, `mastery:${mastery}`, () => client.query(
            `INSERT INTO player_environment_mastery (wallet, environment_type, encounter_count, success_count, mastery_level)
             VALUES ($1,$2,1,1,1)
             ON CONFLICT (wallet, environment_type)
             DO UPDATE SET encounter_count = player_environment_mastery.encounter_count + 1,
                           success_count = player_environment_mastery.success_count + 1,
                           mastery_level = GREATEST(player_environment_mastery.mastery_level, 1),
                           updated_at = NOW()`,
            [w, mastery]
          )
        );
      }
    }

    for (const tag of rewards.tags || []) {
      await applyOptionalCampaignReward(client, `tag:${tag}`, () => client.query(
          `INSERT INTO player_tags (wallet, tag_id, source_quest_id, acquired_from)
           VALUES ($1,$2,$3,$3) ON CONFLICT DO NOTHING`,
          [w, tag, progress.quest_id]
        )
      );
    }
    for (const flag of rewards.loreFlags || []) {
      await applyOptionalCampaignReward(client, `lore:${flag}`, () => client.query(
          `INSERT INTO player_lore_flags (wallet, flag_id, source_quest_id, source_chapter)
           VALUES ($1,$2,$3,$3) ON CONFLICT DO NOTHING`,
          [w, flag, progress.quest_id]
        )
      );
    }
    for (const mod of rewards.branchModifiers || []) {
      await applyOptionalCampaignReward(client, `branch:${mod.key}`, async () => {
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
      });
    }

    const updated = await client.query(
      `UPDATE player_campaign_progress SET
         status = $1,
         completed_at = CASE WHEN $8 = 'completed' THEN NOW() ELSE completed_at END,
         failed_at = CASE WHEN $8 = 'failed' THEN NOW() ELSE failed_at END,
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
        status,
      ]
    );
    await client.query(
      `UPDATE campaign_sessions SET status = $1, current_metrics = $2, updated_at = NOW()
       WHERE session_id = $3`,
      [sim.success ? 'completed' : 'expired', JSON.stringify(sim.metrics), sessionId]
    );
    await client.query('COMMIT');
    if (sim.success && rewards.GP > 0 && typeof logGPActivity === 'function') {
      logGPActivity(w, rewards.GP, 'campaign_reward', progress.quest_id).catch(() => {});
    }
    if (sim.success) {
      try { const _dOps = require('../routes/dailyOps'); _dOps.notifyMissionProgress(w, 'campaign_complete').catch(()=>{}); } catch(_) {}
    }
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
  claimReward,
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
