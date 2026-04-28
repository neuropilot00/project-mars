const crypto = require('crypto');
const { pool, ensureUser, awardXP, notifyPlayer } = require('../db');

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
  [CH5_ID]: {
    questId: CH5_ID,
    campaignId: 'mcc_route',
    chapterNumber: 5,
    faction: 'mcc',
    title: { ko: '케플러 분쟁', en: 'Kepler Commons' },
    requiredLevel: 5,
    prerequisiteChapter: CH4_ID,
    requiredReputation: { mcc: 40 },
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1200,
    location: { id: 'kepler_crater', displayNameKo: 'Kepler 분화구', region: 'equator_south_12' },
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
    campaignId: 'mcc_route',
    chapterNumber: 6,
    faction: 'mcc',
    title: { ko: '내부고발자', en: 'Whistleblower' },
    requiredLevel: 6,
    prerequisiteChapter: CH5_ID,
    requiredReputation: { mcc: 50 },
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1500,
    location: { id: 'shareholder7_external_dock_8', displayNameKo: 'Shareholder-7 8번 도크', region: 'olympus_orbit' },
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
    campaignId: 'mcc_route',
    chapterNumber: 7,
    faction: 'mcc',
    title: { ko: '시장 전쟁', en: 'Market War' },
    requiredLevel: 7,
    prerequisiteChapter: CH6_ID,
    requiredBranchAny: ['mcc_route_a_active', 'mcc_route_b_active', 'mcc_route_c_active'],
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1500,
    location: { id: 'dust_storm_market_war', displayNameKo: 'Dust Storm 시즌 작전 구역', region: 'equator' },
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
    campaignId: 'mcc_route',
    chapterNumber: 8,
    faction: 'mcc',
    title: { ko: '프로메테우스', en: 'Prometheus' },
    requiredLevel: 8,
    prerequisiteChapter: CH7_ID,
    requiredBranchAny: ['mcc_route_a_active', 'mcc_route_b_active', 'mcc_route_c_active'],
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 2160,
    location: { id: 'deimos_orbital_shipyard', displayNameKo: 'Deimos 궤도 조선소', region: 'deimos_orbit' },
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
    campaignId: 'mcc_route',
    chapterNumber: 9,
    faction: 'mcc',
    title: { ko: '깨진 동맹', en: 'Broken Alliance' },
    requiredLevel: 9,
    prerequisiteChapter: CH8_ID,
    requiredBranchAny: ['mcc_route_a_active', 'mcc_route_b_active', 'mcc_route_c_active'],
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 2400,
    location: { id: 'mars_four_fronts', displayNameKo: '화성 4개 전장', region: 'olympus_hellas_valles_kepler' },
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
    campaignId: 'mcc_route',
    chapterNumber: 10,
    faction: 'mcc',
    title: { ko: '주주 엔딩', en: 'Shareholder Ending' },
    requiredLevel: 10,
    prerequisiteChapter: CH9_ID,
    battleResolution: 'cinematic_only',
    estimatedPlayTimeSeconds: 900,
    location: { id: 'olympus_shareholder7_lounge', displayNameKo: 'Shareholder-7 라운지', region: 'olympus_orbit' },
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
    campaignId: 'fsp_route',
    chapterNumber: 1,
    faction: 'fsp',
    title: { ko: '방파제', en: 'The Breakwater' },
    requiredLevel: 1,
    requiredReputation: { fsp: 0 },
    blockingTags: ['war_criminal'],
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 900,
    location: { id: 'new_athens_settlement', displayNameKo: 'New Athens 정착지', region: 'hellas_basin', altitudeKm: -7 },
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
    campaignId: 'fsp_route',
    chapterNumber: 2,
    faction: 'fsp',
    title: { ko: '얼음 캐러밴', en: 'The Ice Caravan' },
    requiredLevel: 2,
    prerequisiteChapter: FSP_CH1_ID,
    requiredReputation: { fsp: 15 },
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1800,
    location: { id: 'north_pole_to_new_athens', displayNameKo: '북극관 → New Athens 항로', region: 'north_pole_to_hellas' },
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
    campaignId: 'fsp_route',
    chapterNumber: 3,
    faction: 'fsp',
    title: { ko: '피의 광산', en: 'Blood Mine' },
    requiredLevel: 3,
    prerequisiteChapter: FSP_CH2_ID,
    requiredReputation: { fsp: 25 },
    blockingTags: ['war_criminal'],
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1800,
    location: { id: 'verin7_mining_complex', displayNameKo: 'Verin-7 광산', region: 'olympus_4th_ridge', altitudeKm: 8 },
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
    campaignId: 'fsp_route',
    chapterNumber: 4,
    faction: 'fsp',
    title: { ko: '외교', en: 'Diplomacy' },
    requiredLevel: 4,
    prerequisiteChapter: FSP_CH3_ID,
    requiredReputation: { fsp: 25 },
    blockingTags: ['war_criminal'],
    battleResolution: 'server_simulation',
    estimatedPlayTimeSeconds: 1500,
    location: { id: 'sandstone_junction', displayNameKo: 'Sandstone Junction 지하 3레벨', region: 'equatorial_belt', altitudeKm: 1.2 },
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

function simulateChapter(progress) {
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
    items = [{ type: 'ship', code: 'lifeline_supply_ship', label: 'Lifeline Supply Ship', quantity: 1 }, { type: 'resource_stream', code: 'o2_supply_stream_kepler', label: 'O2 Supply Stream', quantity: 200 }];
    loreFlags.push('ch5_chose_escort', 'kepler_data_server_secured');
  } else if (choiceId === 'ch5_solo_data') {
    gp = 120000; xp = 2500; rep = { mcc: 40 };
    items = [{ type: 'data_artifact', code: 'roth_data_copy', label: 'Roth Data Copy', quantity: 1 }];
    loreFlags.push('ch5_chose_solo_data', 'kepler_data_server_player_solo', 'insubordination_attempt');
    branchModifiers.push({ targetChapter: 'mcc_campaign_ch10', key: 'ending_2_executive_eligible', value: { ch10_ending_options_add: ['ending_2_executive'] } });
  } else if (choiceId === 'ch5_strike_cv') {
    gp = 100000; xp = 2000; rep = { mcc: 40, cv: -25 };
    items = [{ type: 'weapon_system', code: 'plague_burner', label: 'Plague Burner', quantity: 1 }];
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
    return { GP: gp, XP: 2500, reputationDelta: rep, items: [{ type: 'safe_house_access', code: 'new_athens', label: 'New Athens Safe House' }], tags: ['whistleblower'], loreFlags: ['ch6_chose_help_lifang'], unlocks: [CH7_ID], branchModifiers: [{ targetChapter: 'any_mcc_post_ch6', key: 'mcc_route_a_active', value: { ch7_route: 'branch_a', ch8_route: 'branch_a', ch9_route: 'branch_a', ch10_endings_available: ['ending_3_whistleblower'] } }, { targetChapter: 'mcc_campaign_ch10', key: 'ending_3_locked_in', value: { ending: 'ending_3_whistleblower' } }] };
  }
  if (branch === 'branch_c') {
    const lore = ['ch6_chose_copy_silent'];
    if (secondary.includes('obj_stealth_perfect')) lore.push('chen_no_suspicion');
    return { GP: secondary.includes('obj_stealth_perfect') ? 15000 : 0, XP: 1500, reputationDelta: {}, items: [{ type: 'data_artifact', code: 'lifang_blackmail_data', label: 'Lifang Blackmail Data' }], tags: ['secret_keeper'], loreFlags: lore, unlocks: [CH7_ID], branchModifiers: [{ targetChapter: 'any_mcc_post_ch6', key: 'mcc_route_c_active', value: { ch7_route: 'branch_c', ch10_endings_available: ['ending_1_loyal_hire', 'ending_2_executive', 'ending_4_traitor'] } }, { targetChapter: 'mcc_campaign_ch10', key: 'ending_4_unlocked', value: { ending: 'ending_4_traitor' } }] };
  }
  return { GP: 100000, XP: 2000, reputationDelta: { mcc: 40, fsp: -10 }, items: [{ type: 'office_assets', code: 'lifang_office_assets', label: 'Li Fang Office Assets', quantity: 50000 }], tags: [], loreFlags: ['ch6_chose_report_chen', 'lifang_arrested'], unlocks: [CH7_ID], branchModifiers: [{ targetChapter: 'any_mcc_post_ch6', key: 'mcc_route_b_active', value: { ch7_route: 'branch_b', ch10_endings_available: ['ending_1_loyal_hire', 'ending_2_executive'] } }, { targetChapter: 'mcc_campaign_ch10', key: 'ending_1_eligible', value: { ending: 'ending_1_loyal_hire' } }] };
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
  return { GP: gp, XP: 1800, reputationDelta: { mcc: branch === 'branch_c' ? 15 : 25 }, items: [{ type: 'asset', code: 'helion_subsidiary_acquired', label: 'Helion Subsidiary Acquired', quantity: 1 }, { type: 'resource_stream', code: 'helion_o2_monthly', label: 'Helion O2 Monthly Stream', quantity: 500 }, { type: 'gp_stream', code: 'helion_monthly_gp', label: 'Helion Monthly GP Income', quantity: 5000 }], tags: [], loreFlags: lore, unlocks: ['mcc_campaign_ch8'], branchModifiers };
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
      items: [{ type: 'title_position', code: 'federal_foreign_advisor', label: 'Federal Foreign Advisor' }],
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
      items: [{ type: 'ship_choice', code: 'sequoia_or_mauler_choice', label: 'Sequoia or Mauler Choice' }],
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
    items: [{ type: 'ship', code: 'prometheus_titan', label: 'Prometheus Titan', quantity: 1 }, { type: 'permanent_buff', code: 'mcc_fleet_atk_modifier', label: 'MCC Fleet ATK +5%', quantity: 5 }],
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
    items.push({ type: 'ship_choice', code: 'tessellate_sequoia_mauler_choice', label: 'Capital Ship Choice' });
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
    return { GP: 500000, XP: 5000, reputationDelta: { mcc: 50 }, items: [{ type: 'ship_fleet', code: 'mcc_loyal_hire_fleet', label: 'MCC Fleet Package', quantity: 5 }, { type: 'residence', code: 'olympus_residence', label: 'Olympus 4th Ridge Residence' }, { type: 'permanent_buff', code: 'annual_income_100k', label: 'Annual Income 100000 GP' }], tags: ['shareholder'], loreFlags: ['mcc_route_completed', 'chose_ending_1'], unlocks: [], branchModifiers: [] };
  }
  if (ending === 'ending_2_executive') {
    return { GP: 800000, XP: 6000, reputationDelta: { mcc: 70 }, items: [{ type: 'ship_fleet', code: 'mcc_executive_fleet', label: 'Executive Fleet', quantity: 7 }, { type: 'corporate_asset', code: 'mcc_equity_8pct', label: 'MCC Equity 8%' }, { type: 'permanent_buff', code: 'mcc_equity_dividend_25k', label: 'Monthly MCC Dividend 25000 GP' }], tags: ['future_chairman'], loreFlags: ['mcc_route_completed', 'chose_ending_2'], unlocks: [], branchModifiers: [] };
  }
  if (ending === 'ending_3_whistleblower') {
    return { GP: 300000, XP: 5500, reputationDelta: { mcc: -100, fsp: 50, cv: 10 }, items: [{ type: 'title_position', code: 'federal_foreign_advisor', label: 'Federal Foreign Advisor' }, { type: 'permanent_buff', code: 'federal_safe_haven', label: 'Federal Safe Haven' }], tags: ['whistleblower'], loreFlags: ['mcc_route_completed', 'chose_ending_3'], unlocks: [], branchModifiers: [{ targetChapter: 'any_route', key: 'cross_route_chen_dead', value: { chen_npc_unavailable: true, mcc_post_chen_state: true } }, { targetChapter: 'any_route_ng_plus', key: 'cross_route_lifang_alive', value: { lifang_in_federal_government: true } }] };
  }
  if (ending === 'ending_4_traitor') {
    return { GP: 1000000, XP: 7000, reputationDelta: { mcc: -25, fsp: -25, cv: -25, pilgrim_arms: -25 }, items: [{ type: 'ship_fleet', code: 'pilgrim_arms_starter_fleet', label: 'Pilgrim Arms Starter Fleet', quantity: 30 }, { type: 'territory', code: 'kepler_territory', label: 'Kepler Crater Territory' }, { type: 'corporation_ownership', code: 'pilgrim_arms', label: 'Pilgrim Arms Ownership' }], tags: ['the_fourth_faction', 'the_traitor'], loreFlags: ['mcc_route_completed', 'chose_ending_4'], unlocks: [], branchModifiers: [{ targetChapter: 'any_route_ng_plus', key: 'cross_route_pilgrim_arms_exists', value: { pilgrim_arms_npc_faction_active: true } }] };
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
    { type: 'ship_blueprint', code: 'sprite_frigate_blueprint', label: 'Sprite Frigate Blueprint' },
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
    items.push({ type: 'ship_blueprint', code: 'shadow_frigate_blueprint', label: 'Shadow Frigate Blueprint' });
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

function calculateRewards(progress, sim) {
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
  return calculateCh1Rewards(progress, sim);
}

async function getStatus(wallet) {
  const w = normalizeWallet(wallet);
  const [progressRes, reputationRes, branchRes, playerBranchRes, inboxRes, tagRes, sessionRes] = await Promise.all([
    pool.query(`SELECT * FROM player_campaign_progress WHERE wallet = $1 ORDER BY chapter_number ASC`, [w]),
    pool.query(`SELECT faction, value FROM player_reputation WHERE wallet = $1 ORDER BY faction ASC`, [w]),
    pool.query(`SELECT target_chapter, modifier_key, modifier_value, source_quest_id, created_at FROM chapter_branch_modifiers WHERE wallet = $1 ORDER BY created_at DESC`, [w]),
    pool.query(`SELECT modifier_id FROM player_branch_modifiers WHERE wallet = $1 AND consumed_at IS NULL ORDER BY set_at DESC`, [w]),
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
  const branchSet = new Set([
    ...branchRes.rows.map(r => r.modifier_key),
    ...playerBranchRes.rows.map(r => r.modifier_id),
  ]);
  const availableChapters = [];
  const lockedChapters = [];
  for (const ch of Object.values(CHAPTERS)) {
    if (completedSet.has(ch.questId) || activeSet.has(ch.questId)) continue;
    const prereqOk = !ch.prerequisiteChapter || completedSet.has(ch.prerequisiteChapter) || (ch.questId === CH3_ID && branchSet.has('mcc_route_termination_offered'));
    const repOk = Object.entries(ch.requiredReputation || {}).every(([f, v]) => (reputation[f] || 0) >= v);
    const tagOk = !(ch.blockingTags || []).some(t => tagSet.has(t));
    const branchOk = !(ch.requiredBranchAny || []).length || ch.requiredBranchAny.some(b => branchSet.has(b));
    if (prereqOk && repOk && tagOk && branchOk) availableChapters.push(ch.questId);
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

async function validateChapterChoice(client, wallet, progress, choiceId) {
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
  if (![CH7_ID, CH8_ID, CH9_ID, CH10_ID].includes(progress.quest_id)) return null;
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
    if (progress.quest_id === CH10_ID) {
      const choices = Array.isArray(progress.choices_payload) ? progress.choices_payload : [];
      const endingChoice = choices[0]?.choice_id;
      if (!endingChoice) {
        await client.query('ROLLBACK');
        return { error: 'ENDING_CHOICE_REQUIRED' };
      }
      const endingError = await validateChapterChoice(client, w, progress, endingChoice);
      if (endingError) {
        await client.query('ROLLBACK');
        return endingError;
      }
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
