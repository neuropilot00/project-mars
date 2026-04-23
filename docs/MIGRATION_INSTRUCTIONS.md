# OCCUPY MARS — Claude Code 작업 지시서
# Migration 080 ~ 100 전체 지시 목록
# 
# 사용법:
#   1. 각 Migration을 순서대로 진행
#   2. 각 Migration 완료 후 반드시 git commit
#   3. 다음 Migration으로 이동
#
# 절대 원칙:
#   - 한 번에 하나의 Migration만 진행
#   - 각 완료 후 테스트 확인 후 다음 진행
#   - 모든 수치는 settings 테이블 저장 (하드코딩 금지)
#   - 기존 Migration 001~079 절대 수정 금지

---

# ════════════════════════════════════════
# STEP 0: 시작 전 필수 작업
# ════════════════════════════════════════

## [STEP 0] 현재 코드 파악 (첫 번째 지시)

```
프로젝트의 현재 코드 구조를 파악해줘.
OCCUPY_MARS_COMPLETE_BIBLE.md를 참고문서로 읽어두고,
다음 항목들을 현재 코드에서 찾아서 요약해줘:

1. users 테이블 전체 컬럼 목록
2. settings 테이블 현재 key 목록 (전부)
3. claims 테이블 전체 컬럼 목록
4. transactions 테이블 구조
5. Mining/Harvest 처리 함수 → 파일명 + 함수명
6. Hijack 처리 함수 → 파일명 + 함수명
7. Enhancement 처리 함수 → 파일명 + 함수명
8. Marketplace 처리 함수 → 파일명 + 함수명
9. services/ 폴더 파일 목록 전체
10. routes/ 폴더 파일 목록 전체
11. 기존 스케줄러 파일 위치와 등록된 작업 목록
12. i18n 처리 방식 (어떤 파일에서 어떻게 처리하는지)
13. 기존 guilds 테이블 구조
14. 기존 governance 관련 테이블 구조

수정은 절대 하지 말고 조사만 해줘.
완료 후 위 14개 항목을 정리해서 보고해줘.
```

---

# ════════════════════════════════════════
# MIGRATION 080: 제거 작업 + 설정 수정
# ════════════════════════════════════════

## [Migration 080] 작업 지시

```
OCCUPY_MARS_COMPLETE_BIBLE.md를 참고해서
Migration 080 작업을 실행해줘.

작업 범위 (이것만):

[1] settings 테이블에 다음 SQL을 실행해줘:

UPDATE settings SET value = 'false' WHERE key = 'cantina_enabled';
UPDATE settings SET value = 'false' WHERE key = 'arcade_enabled';
UPDATE settings SET value = '0' WHERE key = 'referral_tier2_rate';
UPDATE settings SET value = '0' WHERE key = 'referral_tier3_rate';
UPDATE settings SET value = '10' WHERE key = 'marketplace_listing_fee_gp';

위 key가 없으면 INSERT로 추가해줘.

그리고 다음 settings를 INSERT해줘
(이미 있으면 UPDATE, 없으면 INSERT):
- cantina_enabled = false
- arcade_enabled = false
- marketplace_dynamic_fee_5 = 2.0
- marketplace_dynamic_fee_10 = 4.0
- governor_max_tax_rate = 10
- governor_market_cut = 0.01
- governor_declaration_cost_gp = 5
- siege_declaration_cost_gp = 100
- siege_warning_hours = 48
- siege_battle_hours = 24
- siege_min_territories = 3
- chronicle_hijack_min_pp = 500
- chronicle_siege_min_p = 5
- discord_webhook_url = (빈 문자열)
- land_base_price_pp = 0.1
- land_adjacent_discount = 0.85
- land_core_price_mult = 5.0
- land_mid_price_mult = 2.0
- land_frontier_price_mult = 1.0
- land_adjacency_5_bonus = 0.05
- land_adjacency_10_bonus = 0.10
- land_adjacency_20_bonus = 0.20
- job_required_level = 5
- job_change_cost_gp = 50
- job_change_weekly_free = 1
- onboarding_enabled = true
- onboarding_pp_reward = 100
- onboarding_gp_reward = 200
- war_betting_enabled = false
- weather_forecast_hours = 48
- weather_duration_hours = 6
- ship_titan_server_max = 3
- ship_wreck_resource_rate = 0.40
- battle_turn_interval_sec = 30
- guild_war_duration_hours = 72
- guild_war_prepare_hours = 72

[2] routes/cantina.js 파일 최상단 (router 선언 바로 다음)에
다음 미들웨어를 추가해줘:

router.use(async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT value FROM settings WHERE key = 'cantina_enabled'"
    );
    const enabled = result.rows[0]?.value;
    if (enabled !== 'true') {
      return res.status(503).json({
        error: 'cantina_closed',
        message: 'Cantina is temporarily closed for renovation.'
      });
    }
    next();
  } catch (e) {
    next();
  }
});

[3] routes/arcade.js 파일이 있으면 동일한 미들웨어를
arcade_enabled key로 추가해줘.

[4] index.html에서 다음을 처리해줘:
- "CANTINA" 텍스트가 있는 탭/버튼에 style="display:none" 추가
- "ARCADE" 텍스트가 있는 탭/버튼에 style="display:none" 추가
- 삭제는 하지 말고 숨김만

절대 하지 말 것:
- 기존 Cantina/Arcade 테이블 삭제 금지
- 기존 라우터 로직 수정 금지
- 위 4가지 외 다른 작업 금지

완료 후 반드시:
1. 수정된 파일 목록
2. 롤백 SQL (원상복구 방법)
3. 테스트 방법: cantina API 호출 시 503 반환 확인
```

---

# ════════════════════════════════════════
# MIGRATION 081: 섹터 정의 시스템
# ════════════════════════════════════════

## [Migration 081] 작업 지시

```
OCCUPY_MARS_COMPLETE_BIBLE.md를 참고해서
Migration 081 작업을 실행해줘.

작업 범위:

[1단계] DB 테이블 생성

다음 테이블을 생성해줘:

CREATE TABLE IF NOT EXISTS sector_definitions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  name_en VARCHAR(50),
  name_ko VARCHAR(50),
  name_ja VARCHAR(50),
  name_zh VARCHAR(50),
  sector_type VARCHAR(20) NOT NULL,
  price_multiplier DECIMAL(5,2) DEFAULT 1.0,
  mining_multiplier DECIMAL(5,2) DEFAULT 1.0,
  defense_multiplier DECIMAL(5,2) DEFAULT 1.0,
  center_x INT,
  center_y INT,
  lore_en TEXT,
  lore_ko TEXT,
  lore_ja TEXT,
  lore_zh TEXT,
  special_feature TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sector_entry_requirements (
  id SERIAL PRIMARY KEY,
  sector_code VARCHAR(30) UNIQUE NOT NULL
    REFERENCES sector_definitions(code),
  min_level INT DEFAULT 0,
  required_mid_territories INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sector_governance (
  id SERIAL PRIMARY KEY,
  sector_code VARCHAR(30) UNIQUE NOT NULL
    REFERENCES sector_definitions(code),
  governor_user_id INT REFERENCES users(id),
  governor_since TIMESTAMP,
  tax_rate DECIMAL(5,2) DEFAULT 2.0,
  market_cut_rate DECIMAL(5,4) DEFAULT 0.01,
  sector_policy VARCHAR(20) DEFAULT 'open',
  declaration_text TEXT,
  declaration_updated TIMESTAMP,
  total_tax_collected DECIMAL(20,8) DEFAULT 0,
  active_siege_id INT,
  created_at TIMESTAMP DEFAULT NOW()
);

[2단계] 24섹터 초기 데이터

기획서 PART 2의 섹터 INSERT SQL을 전부 실행해줘.
(Core 6개, Mid 10개, Frontier 8개, 총 24개)

[3단계] sector_entry_requirements 초기 데이터

INSERT INTO sector_entry_requirements
  (sector_code, min_level, required_mid_territories)
SELECT code,
  CASE sector_type
    WHEN 'frontier' THEN 0
    WHEN 'mid' THEN 10
    WHEN 'core' THEN 25
  END,
  CASE sector_type WHEN 'core' THEN 1 ELSE 0 END
FROM sector_definitions;

[4단계] sector_governance 초기 레코드

INSERT INTO sector_governance (sector_code)
SELECT code FROM sector_definitions
ON CONFLICT (sector_code) DO NOTHING;

[5단계] claims 테이블 컬럼 추가

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS sector_code VARCHAR(30)
    REFERENCES sector_definitions(code),
  ADD COLUMN IF NOT EXISTS price_paid_pp DECIMAL(20,8),
  ADD COLUMN IF NOT EXISTS adjacency_bonus DECIMAL(5,4) DEFAULT 0;

[6단계] services/sector.js 생성

다음 함수들을 포함한 서비스 파일을 생성해줘:

- getSector(sectorCode) → 섹터 정보 반환
- getSectorGovernance(sectorCode) → 거버넌스 상태 반환
- checkEntryRequirement(userId, sectorCode)
  → { allowed: boolean, reason: string }
- calculateLandPrice(pixelCount, sectorCode, isAdjacent)
  → PP 가격 계산 (settings 테이블에서 배율 조회)
- getSectorMiningBuff(sectorCode)
  → 해당 섹터 Mining 버프 배율 반환

모든 수치는 settings 테이블에서 조회할 것.

[7단계] API 엔드포인트 추가 (routes/sectors.js 신규)

GET /api/sectors → 전체 섹터 목록
GET /api/sectors/:code → 섹터 상세
GET /api/sectors/:code/governance → 거버넌스 현황

절대 하지 말 것:
- 기존 claims 데이터 수정 금지
- 기존 governance 관련 기존 코드 수정 금지

완료 후:
1. 생성/수정 파일 목록
2. 롤백 SQL
3. 테스트: GET /api/sectors 호출 시 24개 섹터 반환 확인
```

---

# ════════════════════════════════════════
# MIGRATION 082: Governor 강화 + Siege
# ════════════════════════════════════════

## [Migration 082-A] 작업 지시 (DB + 서비스)

```
OCCUPY_MARS_COMPLETE_BIBLE.md를 참고해서
Migration 082 1단계를 실행해줘.

작업 범위:

[1단계] DB 테이블 생성

CREATE TABLE IF NOT EXISTS governor_sieges (
  id SERIAL PRIMARY KEY,
  sector_code VARCHAR(30) NOT NULL
    REFERENCES sector_definitions(code),
  challenger_id INT NOT NULL REFERENCES users(id),
  defender_id INT NOT NULL REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending',
  gp_cost INT NOT NULL,
  declared_at TIMESTAMP DEFAULT NOW(),
  siege_starts_at TIMESTAMP,
  siege_ends_at TIMESTAMP,
  winner_id INT REFERENCES users(id),
  final_challenger_px INT DEFAULT 0,
  final_defender_px INT DEFAULT 0,
  participant_count INT DEFAULT 0,
  total_pp_volume DECIMAL(20,8) DEFAULT 0,
  resolved_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS governor_hall_of_fame (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  sector_code VARCHAR(30) NOT NULL,
  term_start TIMESTAMP NOT NULL,
  term_end TIMESTAMP,
  duration_days INT,
  total_tax_earned DECIMAL(20,8) DEFAULT 0,
  ended_by VARCHAR(30),
  max_tax_rate DECIMAL(5,2),
  notable_event TEXT
);

sector_governance 테이블에 컬럼 추가:
ALTER TABLE sector_governance
  ADD COLUMN IF NOT EXISTS active_siege_id INT
    REFERENCES governor_sieges(id);

[2단계] services/siege.js 생성

다음 함수들을 포함한 서비스 파일 생성:

async function declareSiege(challengerId, sectorCode)
  - 섹터 내 영토 수 체크 (siege_min_territories 설정)
  - GP 차감 (siege_declaration_cost_gp 설정)
  - governor_sieges INSERT
  - sector_governance active_siege_id 업데이트
  - 반환: { success, siege, error }

async function resolveSiege(siegeId)
  - 도전자/수비자 영토 수 비교
  - 승자 결정
  - sector_governance governor 업데이트
  - governor_hall_of_fame INSERT
  - active_siege_id NULL로 초기화
  - Chronicle 기록 호출 (chronicleService 없으면 콘솔 로그로 대체)

async function getActiveSiege(sectorCode)
  - 해당 섹터 진행 중 Siege 반환

async function getSiegeStatus(siegeId)
  - Siege 상세 정보 반환

[3단계] 스케줄러에 추가

기존 스케줄러 파일에 다음 추가:
매 5분마다: 종료 시간 지난 활성 Siege 자동 resolve

완료 후:
1. 생성/수정 파일 목록
2. 롤백 SQL
3. 테스트: declareSiege 함수 단위 테스트 방법
```

## [Migration 082-B] 작업 지시 (API + UI)

```
Migration 082 2단계를 실행해줘.
(82-A 완료 후 실행)

작업 범위:

[1단계] API 엔드포인트 (routes/siege.js 신규)

POST /api/siege/declare
  - body: { sectorCode }
  - 인증 필요
  - siegeService.declareSiege 호출

GET /api/siege/:sectorCode
  - 해당 섹터 활성 Siege 반환

GET /api/siege/history/:sectorCode
  - 해당 섹터 Siege 완료 목록 (최근 10개)

POST /api/governor/declaration
  - body: { sectorCode, text }
  - GP 5 차감 (governor_declaration_cost_gp)
  - sector_governance declaration_text 업데이트

PUT /api/governor/tax-rate
  - body: { sectorCode, taxRate }
  - 0~governor_max_tax_rate 범위 검증
  - 본인이 해당 섹터 Governor인지 확인

PUT /api/governor/policy
  - body: { sectorCode, policy }
  - policy: 'open' | 'ally_only' | 'closed'
  - 본인이 해당 섹터 Governor인지 확인

[2단계] 프론트엔드 (index.html)

Governance 탭 또는 섹터 정보 모달에 추가:
- 현재 Governor 표시
- 세율 표시
- "Governor 도전하기" 버튼 (조건 충족 시 활성화)
- 활성 Siege 있으면 진행 현황 표시 (남은 시간, 도전자/수비자)
- Governor 선언문 표시

모든 텍스트는 i18n 처리할 것.

완료 후:
1. 수정/생성 파일 목록
2. 테스트: Siege 선언 → 상태 조회 흐름 확인
```

---

# ════════════════════════════════════════
# MIGRATION 083: 서사 엔진 (Chronicle)
# ════════════════════════════════════════

## [Migration 083-A] 작업 지시 (DB + 서비스)

```
OCCUPY_MARS_COMPLETE_BIBLE.md를 참고해서
Migration 083 1단계를 실행해줘.

작업 범위:

[1단계] DB 테이블 생성

CREATE TABLE IF NOT EXISTS server_chronicles (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  actor_id INT REFERENCES users(id),
  target_id INT REFERENCES users(id),
  guild_id INT REFERENCES guilds(id),
  sector_code VARCHAR(30),
  value_pp DECIMAL(20,8),
  value_gp DECIMAL(20,8),
  extra_data JSONB DEFAULT '{}',
  title_en VARCHAR(300),
  title_ko VARCHAR(300),
  title_ja VARCHAR(300),
  title_zh VARCHAR(300),
  body_en TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  webhook_sent BOOLEAN DEFAULT FALSE,
  occurred_at TIMESTAMP DEFAULT NOW(),
  season_id INT
);

CREATE INDEX IF NOT EXISTS idx_chronicles_event
  ON server_chronicles(event_type, occurred_at);

CREATE INDEX IF NOT EXISTS idx_chronicles_actor
  ON server_chronicles(actor_id, occurred_at);

[2단계] services/chronicle.js 생성

다음 함수들을 포함:

async function record(eventType, data)
  - server_chronicles INSERT
  - data.webhook이 true이고
    discord_webhook_url settings가 있으면
    Discord Webhook 발송 시도
  - 실패해도 Chronicle 기록은 유지

async function checkHijackRecord(attackerId, defenderId, claimId, ppAmount)
  - ppAmount가 chronicle_hijack_min_pp 설정 이상이면
    'large_hijack' Chronicle 기록
  - 역대 최고 Hijack이면 'largest_hijack' Chronicle 기록

async function checkGovernorMilestone(governorId, sectorCode, days)
  - days가 7, 30, 90 중 하나면 Chronicle 기록

async function checkEnhancementRecord(userId, itemName, level)
  - level이 10이고 해당 아이템 최초이면 Chronicle 기록

async function sendDiscordWebhook(message)
  - settings에서 discord_webhook_url 조회
  - 비어있으면 스킵 (에러 없이)
  - 있으면 Discord Webhook POST

[3단계] 기존 서비스에 Chronicle 연결

Hijack 완료 처리 함수 찾아서 마지막에 추가:
  await chronicleService.checkHijackRecord(
    attackerId, defenderId, claimId, ppAmount
  );
  (1줄만 추가, 기존 로직 수정 금지)

Siege resolve 함수에 추가:
  await chronicleService.record('governor_overthrown', {...});
  (siege.js에 이미 있으면 스킵)

완료 후:
1. 생성/수정 파일 목록
2. 테스트: record() 함수 직접 호출해서 DB 저장 확인
```

## [Migration 083-B] 작업 지시 (공개 API + Webhook)

```
Migration 083 2단계를 실행해줘.
(83-A 완료 후 실행)

작업 범위:

[1단계] 공개 API (routes/public.js 신규, 인증 불필요)

GET /api/public/stats
반환:
{
  total_pixels: (claims 총 픽셀 수),
  pixels_claimed: (실제 점령된 픽셀),
  active_users_24h: (최근 24시간 활동 유저),
  total_volume_usdt: (transactions USDT 총액),
  top_sector: (가장 활발한 섹터 코드)
}

GET /api/public/sectors
반환: sector_definitions + sector_governance JOIN
24개 섹터 전체 현황

GET /api/public/leaderboard
반환:
{
  top_territory: (영토 크기 상위 10),
  top_governors: (섹터별 Governor 목록)
}

GET /api/public/chronicles?limit=20
반환: server_chronicles 최근 N개 (is_public=true만)

[2단계] SSE 실시간 이벤트

GET /api/public/events/live
Server-Sent Events로 실시간 이벤트 스트림
Chronicle 기록 시마다 SSE로 발송

[3단계] Weekly Chronicle 스케줄러

기존 스케줄러에 추가:
매주 월요일 00:00 UTC:
  - 지난 7일 Chronicles 수집
  - 랭킹 집계
  - Discord Webhook 발송 (설정된 경우)

[4단계] OG 공유 카드

GET /share/chronicle/:id
- Chronicle ID로 공유 페이지 반환
- og:title, og:description 메타태그 포함
- 실제 이미지 생성은 나중에 (텍스트 기반 먼저)

완료 후:
1. 생성/수정 파일 목록
2. 테스트: GET /api/public/stats 호출 결과 확인
```

---

# ════════════════════════════════════════
# MIGRATION 084: 직업 시스템
# ════════════════════════════════════════

## [Migration 084-A] 작업 지시 (DB)

```
OCCUPY_MARS_COMPLETE_BIBLE.md를 참고해서
Migration 084 1단계를 실행해줘.

작업 범위:

[1단계] DB 테이블 생성

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name_en VARCHAR(50),
  name_ko VARCHAR(50),
  name_ja VARCHAR(50),
  name_zh VARCHAR(50),
  description_en TEXT,
  description_ko TEXT,
  description_ja TEXT,
  description_zh TEXT,
  icon_emoji VARCHAR(10),
  color_hex VARCHAR(7),
  recommended_sector VARCHAR(30),
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS job_buffs (
  id SERIAL PRIMARY KEY,
  job_id INT NOT NULL REFERENCES jobs(id),
  buff_key VARCHAR(60) NOT NULL,
  buff_value DECIMAL(10,4) NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(job_id, buff_key)
);

CREATE TABLE IF NOT EXISTS job_change_log (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  from_job_id INT REFERENCES jobs(id),
  to_job_id INT NOT NULL REFERENCES jobs(id),
  change_type VARCHAR(20),
  gp_cost INT DEFAULT 0,
  changed_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS current_job_id INT REFERENCES jobs(id),
  ADD COLUMN IF NOT EXISTS job_selected_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS job_changed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS weekly_job_changes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_job_reset_at TIMESTAMP DEFAULT NOW();

[2단계] 4개 직업 초기 데이터

INSERT INTO jobs (code, name_en, name_ko, name_ja, name_zh,
  icon_emoji, color_hex, sort_order) VALUES
('miner',    'Miner',    '광부',   'マイナー',   '矿工', '⛏️','#F4A460',1),
('warrior',  'Warrior',  '전사',   'ウォリアー', '战士','⚔️','#DC143C',2),
('crafter',  'Crafter',  '제작자', 'クラフター', '制作者','🔨','#9370DB',3),
('merchant', 'Merchant', '상인',   'マーチャント','商人','💼','#20B2AA',4)
ON CONFLICT (code) DO NOTHING;

[3단계] 직업별 버프 수치 초기 데이터

기획서 PART 3에 있는 버프 수치 전부 INSERT해줘.
(Miner 9개, Warrior 7개, Crafter 7개, Merchant 7개)

INSERT INTO job_buffs (job_id, buff_key, buff_value)
SELECT j.id, buff.key, buff.value
FROM jobs j, (VALUES
  ('miner', 'miner_mining_rate', 1.50),
  ('miner', 'miner_harvest_cooldown', 0.70),
  ('miner', 'miner_poi_reward', 1.40),
  ('miner', 'miner_rare_resource_chance', 1.30),
  ('miner', 'miner_combat_power', 0.70),
  ('miner', 'miner_enhancement_success', 0.95),
  ('miner', 'miner_market_fee', 1.00),
  ('warrior', 'warrior_combat_power', 1.30),
  ('warrior', 'warrior_hijack_success', 1.20),
  ('warrior', 'warrior_hijack_damage', 1.15),
  ('warrior', 'warrior_defense_item_effect', 1.25),
  ('warrior', 'warrior_attack_item_effect', 1.20),
  ('warrior', 'warrior_siege_participation', 1.50),
  ('warrior', 'warrior_mining_rate', 0.80),
  ('warrior', 'warrior_enhancement_success', 0.90),
  ('warrior', 'warrior_market_fee', 1.00),
  ('crafter', 'crafter_enhancement_success', 1.30),
  ('crafter', 'crafter_enhancement_cost', 0.80),
  ('crafter', 'crafter_enhancement_break_protection', 0.40),
  ('crafter', 'crafter_enhancement_material_saving', 0.85),
  ('crafter', 'crafter_mining_rate', 0.80),
  ('crafter', 'crafter_combat_power', 0.80),
  ('crafter', 'crafter_market_fee', 0.90),
  ('merchant', 'merchant_market_fee', 0.65),
  ('merchant', 'merchant_auction_fee', 0.65),
  ('merchant', 'merchant_listing_limit', 2.00),
  ('merchant', 'merchant_price_history_days', 60),
  ('merchant', 'merchant_mining_rate', 0.85),
  ('merchant', 'merchant_combat_power', 0.80),
  ('merchant', 'merchant_enhancement_success', 0.95)
) AS buff(job_code, key, value)
WHERE j.code = buff.job_code
ON CONFLICT (job_id, buff_key) DO UPDATE SET buff_value = EXCLUDED.buff_value;

완료 후:
1. 수정/생성 파일 목록
2. 롤백 SQL
3. 테스트: SELECT * FROM job_buffs 확인 (28개 이상)
```

## [Migration 084-B] 작업 지시 (서비스 + 버프 적용)

```
Migration 084 2단계를 실행해줘.
(84-A 완료 후 실행)

작업 범위:

[1단계] services/job.js 생성

다음 함수들 포함:

const jobBuffCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

async function getJobBuff(userId, buffKey, defaultValue = 1.0)
  - jobBuffCache에서 먼저 확인
  - 없으면 DB 조회 (users + job_buffs JOIN)
  - 결과 캐시에 저장 (10분)
  - 반환: 수치 (없으면 defaultValue)

function invalidateJobCache(userId)
  - 해당 userId의 모든 캐시 삭제

async function getUserJob(userId)
  - 현재 직업 + 버프 목록 반환

async function selectJob(userId, jobCode)
  - Level 체크 (job_required_level 설정)
  - 무료/유료 변경 판단
  - GP 차감 (유료 시)
  - DB 업데이트
  - 캐시 무효화
  - job_change_log INSERT
  - 반환: { success, job, costPaid, error }

async function getAllJobs(lang)
  - 전체 직업 목록 반환 (해당 언어)

async function resetWeeklyJobChanges()
  - 모든 유저 weekly_job_changes = 0으로 리셋
  - 스케줄러에서 매주 월요일 호출

[2단계] 기존 서비스에 버프 적용

다음 파일들을 찾아서 각 1~4줄만 추가해줘
(기존 로직은 절대 수정 금지, 추가만):

Mining/Harvest 함수:
  const miningBuff = await jobService.getJobBuff(userId, 'miner_mining_rate', 1.0);
  ppYield = Math.floor(ppYield * miningBuff);

Hijack 함수:
  const hijackBuff = await jobService.getJobBuff(attackerId, 'warrior_hijack_success', 1.0);
  successRate = successRate * hijackBuff;

Enhancement 함수:
  const successBuff = await jobService.getJobBuff(userId, 'crafter_enhancement_success', 1.0);
  const costBuff = await jobService.getJobBuff(userId, 'crafter_enhancement_cost', 1.0);
  const breakBuff = await jobService.getJobBuff(userId, 'crafter_enhancement_break_protection', 1.0);

Marketplace createListing 함수:
  const feeBuff = await jobService.getJobBuff(userId, 'merchant_market_fee', 1.0);
  const limitBuff = await jobService.getJobBuff(userId, 'merchant_listing_limit', 1.0);

[3단계] 스케줄러에 추가

매주 월요일 00:00 UTC:
  jobService.resetWeeklyJobChanges()

완료 후:
1. 수정된 파일 목록
2. 테스트: Miner 직업 선택 후 Mining 수익 1.5배 확인 방법
```

## [Migration 084-C] 작업 지시 (API + UI)

```
Migration 084 3단계를 실행해줘.
(84-B 완료 후 실행)

작업 범위:

[1단계] API (routes/job.js 신규)

GET /api/jobs → 전체 직업 목록 (lang 쿼리 파라미터)
GET /api/user/job → 내 현재 직업 + 버프
POST /api/user/job → 직업 선택/변경 (body: {jobCode})
GET /api/user/job/change-status → 변경 가능 여부

[2단계] 프론트엔드 (index.html)

A. Level 5 달성 이벤트에 직업 선택 모달 트리거 추가
   (기존 Level Up 처리 코드 찾아서 Level 5일 때 모달 열기)

B. 직업 선택 모달:
   4개 직업 카드 표시
   각 카드: 아이콘 + 이름 + 주요 버프 3개 + 추천 섹터
   [선택하기] 버튼

C. My Base 화면에 직업 표시 섹션 추가:
   현재 직업 아이콘 + 이름
   주요 버프 3개
   [직업 변경] 버튼 (무료/유료 여부 표시)

D. Admin 탭 추가 (JOBS):
   직업별 유저 수 표시
   버프 수치 수정 테이블 (job_buffs 직접 수정)

모든 텍스트는 i18n 처리.

완료 후:
1. 수정/생성 파일 목록
2. 테스트: 직업 선택 → My Base에서 확인 흐름
```

---

# ════════════════════════════════════════
# MIGRATION 085: 광물 & 자원 시스템
# ════════════════════════════════════════

## [Migration 085-A] 작업 지시 (DB)

```
Migration 085 1단계를 실행해줘.

작업 범위:

[1단계] DB 테이블 생성

CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  name_en VARCHAR(50) NOT NULL,
  name_ko VARCHAR(50),
  name_ja VARCHAR(50),
  name_zh VARCHAR(50),
  rarity VARCHAR(20) DEFAULT 'common',
  icon_emoji VARCHAR(10),
  base_pp_value DECIMAL(10,2) DEFAULT 1.0,
  is_tradeable BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sector_resource_rates (
  id SERIAL PRIMARY KEY,
  sector_code VARCHAR(30) NOT NULL
    REFERENCES sector_definitions(code),
  resource_code VARCHAR(30) NOT NULL
    REFERENCES resources(code),
  base_drop_rate DECIMAL(6,5) NOT NULL,
  miner_bonus DECIMAL(6,5) DEFAULT 0,
  UNIQUE(sector_code, resource_code)
);

CREATE TABLE IF NOT EXISTS user_resource_inventory (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  resource_id INT NOT NULL REFERENCES resources(id),
  quantity BIGINT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, resource_id)
);

CREATE TABLE IF NOT EXISTS enhancement_material_recipes (
  id SERIAL PRIMARY KEY,
  min_enhance_level INT NOT NULL,
  resource_code VARCHAR(30) REFERENCES resources(code),
  quantity_required INT NOT NULL,
  success_rate_bonus DECIMAL(5,4),
  break_reduction DECIMAL(5,4),
  is_active BOOLEAN DEFAULT TRUE
);

[2단계] 자원 6종 초기 데이터

INSERT INTO resources
  (code, name_en, name_ko, name_ja, name_zh, rarity, icon_emoji, base_pp_value)
VALUES
('iron_dust',          'Iron Dust',          '철 먼지',   '鉄の粉',     '铁尘',    'common',  '🟤', 0.5),
('red_sand',           'Red Sand',           '붉은 모래', '赤い砂',     '红沙',    'common',  '🔴', 0.8),
('ice_crystal',        'Ice Crystal',        '얼음 결정', '氷の結晶',   '冰晶',    'rare',    '🔵', 5.0),
('volcanic_shard',     'Volcanic Shard',     '화산 파편', '火山の破片', '火山碎片','rare',    '🌋', 4.0),
('ancient_metal',      'Ancient Metal',      '고대 금속', '古代の金属', '古代金属','special', '⭐', 50.0),
('meteorite_fragment', 'Meteorite Fragment', '운석 파편', '隕石の破片', '陨石碎片','special', '☄️', 30.0)
ON CONFLICT (code) DO NOTHING;

[3단계] 섹터별 드롭 확률 (대표 섹터만, 나머지는 패턴으로)

기획서 PART 3 sector_resource_rates 데이터 전부 INSERT.
(24섹터 × 6자원 = 144개 레코드)

[4단계] Enhancement 재료 레시피

INSERT INTO enhancement_material_recipes
  (min_enhance_level, resource_code, quantity_required,
   success_rate_bonus, break_reduction)
VALUES
(7, 'ice_crystal',    3, 0.08, 0.00),
(7, 'volcanic_shard', 2, 0.00, 0.15),
(9, 'ancient_metal',  1, 0.20, 0.00),
(9, 'ancient_metal',  2, 0.00, 0.40)
ON CONFLICT DO NOTHING;

완료 후:
1. 생성 파일 목록
2. 롤백 SQL
3. 테스트: SELECT COUNT(*) FROM sector_resource_rates (144 확인)
```

## [Migration 085-B] 작업 지시 (자원 드롭 + 마켓 연동)

```
Migration 085 2단계를 실행해줘.
(85-A 완료 후 실행)

작업 범위:

[1단계] services/resource.js 생성

async function rollResourceDrop(userId, sectorCode)
  - sector_resource_rates에서 해당 섹터 드롭 확률 조회
  - Miner 직업이면 miner_bonus 추가
  - 각 자원별 확률로 드롭 여부 결정
  - 드롭된 자원들을 user_resource_inventory에 추가
  - 반환: [{resource_code, quantity}] 배열

async function addResourcesToInventory(userId, resources)
  - resources: [{code, quantity}]
  - user_resource_inventory UPSERT (quantity 누적)

async function getUserResourceInventory(userId)
  - 유저의 자원 목록 반환

async function consumeResources(userId, resources)
  - 자원 차감
  - 부족하면 에러 반환

[2단계] Mining/Harvest 함수에 자원 드롭 추가

기존 Harvest 완료 처리 함수 찾아서
PP 지급 후 마지막에 1~3줄 추가:
  const droppedResources = await resourceService.rollResourceDrop(userId, sectorCode);
  if (droppedResources.length > 0) {
    response.resources = droppedResources;
  }
  (기존 PP 지급 로직은 절대 건드리지 말 것)

[3단계] Marketplace에 자원 타입 추가

marketplace_listings 테이블에 컬럼 추가:
ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS resource_code VARCHAR(30)
    REFERENCES resources(code),
  ADD COLUMN IF NOT EXISTS resource_quantity BIGINT;

Marketplace createListing에
resource 타입 처리 추가
(기존 cosmetic/item/claim 타입 처리 그대로 유지)

[4단계] Enhancement에 자원 소모 옵션 추가

Enhancement 시도 API에
선택적 재료 파라미터 추가:
  body에 materialResources: [{code, quantity}] 추가 (선택, 없으면 기존과 동일)
  있으면 enhancement_material_recipes 조회해서 보너스 적용
  자원 차감 (consumeResources 호출)

[5단계] API

GET /api/user/resources → 내 자원 인벤토리
GET /api/resources → 전체 자원 목록

완료 후:
1. 수정/생성 파일 목록
2. 테스트: Harvest 후 user_resource_inventory에 자원 추가 확인
```

## [Migration 085-C] 작업 지시 (인벤토리 UI)

```
Migration 085 3단계를 실행해줘.
(85-B 완료 후 실행)

작업 범위:

[1단계] 프론트엔드 자원 인벤토리 UI

My Base 화면에 자원 인벤토리 섹션 추가:
  각 자원: 아이콘 + 이름 + 보유량 + [마켓 판매] 버튼
  0개인 자원은 흐릿하게 표시 (숨기지 말고)

Harvest 완료 응답에 드롭된 자원이 있으면
"자원 획득!" 팝업 표시:
  "⭐ ancient_metal 1개 획득!"

[2단계] Marketplace UI에 자원 탭 추가

기존 BROWSE 탭에 자원 필터 추가
자원 판매 등록 UI 추가 (resource 타입 선택 시)

완료 후:
1. 수정 파일 목록
2. 테스트: Harvest → 자원 획득 → 인벤토리 표시 흐름
```

---

# ════════════════════════════════════════
# MIGRATION 086: 온보딩 튜토리얼
# ════════════════════════════════════════

## [Migration 086] 작업 지시

```
OCCUPY_MARS_COMPLETE_BIBLE.md를 참고해서
Migration 086을 실행해줘.

작업 범위:

[1단계] DB 테이블 생성

CREATE TABLE IF NOT EXISTS user_onboarding (
  id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL REFERENCES users(id),
  current_step INT DEFAULT 0,
  job_selected VARCHAR(20),
  tutorial_claim_id INT,
  completed BOOLEAN DEFAULT FALSE,
  skipped BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

[2단계] API (routes/onboarding.js 신규)

GET /api/user/onboarding → 현재 온보딩 상태
POST /api/user/onboarding/step → 단계 완료
  body: { step, data }
  step 0: 세계관 확인
  step 1: 직업 선택 (data.jobCode 필요, jobService.selectJob 호출)
  step 2: 첫 영토 무료 클레임 (1회 한정)
  step 3: 방어 아이템 수령
  step 4: 길드 가입 유도 (완료만 기록)
  step 5: 미션 확인 → 완료 처리, 보상 지급
POST /api/user/onboarding/skip → 건너뛰기

보상 지급 (step 5 완료 시):
  PP: onboarding_pp_reward 설정값
  GP: onboarding_gp_reward 설정값
  무료 방어 아이템 1개 (step 3)

[3단계] 프론트엔드 (index.html)

신규 가입 유저 감지:
  로그인 후 user_onboarding 확인
  completed=false이고 skipped=false이면 온보딩 시작

5단계 온보딩 UI:
  Step 0: 화성 배경 + 세계관 텍스트 + [착륙하기]
  Step 1: 4개 직업 카드 선택 UI (084-C에서 만든 것 재활용)
  Step 2: 지도에서 빈 영토 하이라이트 + 무료 클레임 유도
  Step 3: 위협 시뮬레이션 애니메이션 + 방어 아이템 지급
  Step 4: 길드 추천 3개 표시
  Step 5: 첫 미션 표시 + 완료 보상

각 단계 완료 버튼 클릭 시 API 호출
건너뛰기 버튼 (onboarding_skip_allowed=true일 때)

모든 텍스트 i18n 처리.

완료 후:
1. 수정/생성 파일 목록
2. 테스트: 신규 계정으로 로그인 → 온보딩 자동 시작 확인
```

---

# ════════════════════════════════════════
# MIGRATION 087: Territory War Betting
# ════════════════════════════════════════

## [Migration 087] 작업 지시

```
OCCUPY_MARS_COMPLETE_BIBLE.md를 참고해서
Migration 087을 실행해줘.

작업 범위:

[1단계] DB 테이블 생성

CREATE TABLE IF NOT EXISTS war_bet_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(30) NOT NULL,
  event_id INT NOT NULL,
  option_a_label VARCHAR(100),
  option_b_label VARCHAR(100),
  total_bet_a BIGINT DEFAULT 0,
  total_bet_b BIGINT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'open',
  winner_option VARCHAR(5),
  opens_at TIMESTAMP,
  closes_at TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS war_bets (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES war_bet_events(id),
  user_id INT NOT NULL REFERENCES users(id),
  option VARCHAR(5) NOT NULL,
  amount_gp INT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  payout_gp INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

[2단계] services/betting.js 생성

async function createBettingEvent(eventType, eventId, labelA, labelB, closesAt)
  - war_bet_events INSERT
  - 반환: 생성된 이벤트

async function placeBet(userId, eventId, option, amountGP)
  - war_betting_min_gp / max_gp 설정 검증
  - GP 차감
  - war_bets INSERT
  - war_bet_events total_bet 업데이트

async function settleBettingEvent(eventId, winnerOption)
  - 패자 GP 수집
  - 하우스 엣지 5% 소각 (war_betting_house_edge 설정)
  - 승자들에게 배당 지급 (베팅 비율 기반)
  - war_bets status 업데이트

async function getBettingOdds(eventId)
  - 현재 A/B 베팅 비율과 예상 배당률 반환

[3단계] Siege 연동

services/siege.js의 declareSiege 함수에 추가:
  await bettingService.createBettingEvent(
    'siege', siege.id,
    `${challengerNickname} (도전자)`,
    `${defenderNickname} (Governor)`,
    siegeStartsAt
  );
  (1줄 추가, 기존 로직 수정 금지)

resolveSiege 함수에 추가:
  await bettingService.settleBettingEvent(
    siege.betting_event_id,
    winnerId === siege.challenger_id ? 'a' : 'b'
  );

[4단계] API (routes/betting.js 신규)

GET /api/betting/events → 활성 베팅 이벤트 목록
GET /api/betting/events/:id/odds → 현재 배당률
POST /api/betting/bet → 베팅 (body: {eventId, option, amount})
GET /api/user/bets → 내 베팅 목록

[5단계] 프론트엔드

Siege 대기 화면에 베팅 UI 추가:
  A팀/B팀 현재 배당률 표시
  베팅 금액 입력 + [베팅하기] 버튼
  내 베팅 현황

완료 후:
1. 수정/생성 파일 목록
2. 테스트: 베팅 이벤트 생성 → 베팅 → 정산 흐름
```

---

# ════════════════════════════════════════
# MIGRATION 088: Hall of Fame & 칭호
# ════════════════════════════════════════

## [Migration 088] 작업 지시

```
OCCUPY_MARS_COMPLETE_BIBLE.md를 참고해서
Migration 088을 실행해줘.

작업 범위:

[1단계] DB 테이블 생성

CREATE TABLE IF NOT EXISTS hall_of_fame (
  id SERIAL PRIMARY KEY,
  category VARCHAR(60) NOT NULL,
  user_id INT REFERENCES users(id),
  guild_id INT REFERENCES guilds(id),
  sector_code VARCHAR(30),
  value_numeric DECIMAL(20,8),
  description_en TEXT,
  description_ko TEXT,
  description_ja TEXT,
  description_zh TEXT,
  achieved_at TIMESTAMP DEFAULT NOW(),
  season_id INT,
  is_all_time BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS user_titles (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  title_code VARCHAR(50) NOT NULL,
  title_en VARCHAR(100),
  title_ko VARCHAR(100),
  title_ja VARCHAR(100),
  title_zh VARCHAR(100),
  earned_at TIMESTAMP DEFAULT NOW(),
  is_equipped BOOLEAN DEFAULT FALSE,
  season_id INT,
  UNIQUE(user_id, title_code)
);

[2단계] services/title.js 생성

async function awardTitle(userId, titleCode, titleData)
  - user_titles UPSERT
  - 이미 보유한 칭호면 스킵 (중복 부여 금지)
  - Chronicle 기록 (중요 칭호만)

async function checkAndAwardTitles(userId, actionType, actionData)
  - actionType별 조건 체크:
    'enhancement_10': +10 달성 → 'master_crafter' 칭호
    'siege_win': Siege 승리 → 'siege_victor'
    'governor_7days': 7일 재임 → 'iron_governor' 후보
    'first_territory': 첫 영토 → 'landowner'
  - 조건 충족 시 awardTitle 호출

async function getUserTitles(userId)
  - 보유 칭호 목록 반환

async function equipTitle(userId, titleCode)
  - 기존 장착 칭호 해제
  - 새 칭호 장착
  - 비용: 20 GP

[3단계] 기존 서비스에 칭호 체크 연결

Enhancement +10 달성 시:
  await titleService.checkAndAwardTitles(userId, 'enhancement_10', {});

Siege 승리 시:
  await titleService.checkAndAwardTitles(winnerId, 'siege_win', {sectorCode});

첫 영토 점령 시:
  await titleService.checkAndAwardTitles(userId, 'first_territory', {});

[4단계] API

GET /api/user/titles → 내 칭호 목록
POST /api/user/titles/equip → 칭호 장착 (body: {titleCode})
GET /api/hall-of-fame → Hall of Fame 목록

[5단계] 프론트엔드

프로필/My Base에 장착 칭호 표시
Hall of Fame 공개 페이지
칭호 획득 시 축하 팝업

완료 후:
1. 수정/생성 파일 목록
2. 테스트: Enhancement +10 달성 시 칭호 부여 확인
```

---

# ════════════════════════════════════════
# MIGRATION 089: 마켓플레이스 수정 + 보호권
# ════════════════════════════════════════

## [Migration 089] 작업 지시

```
Migration 089를 실행해줘.

작업 범위:

[1단계] 마켓 등록비 동적 요금

marketplace.js의 createListing 함수에서
등록비 계산 부분 찾아서 수정:

현재 활성 리스팅 수를 확인해서:
  5개 이상: settings('marketplace_dynamic_fee_5') 배율 적용
  10개 이상: settings('marketplace_dynamic_fee_10') 배율 적용
  (Merchant 직업이면 feeBuff도 곱해야 함)

기존 등록비 계산 로직을 이 로직으로 교체.

[2단계] 보호권 아이템 추가

items 테이블에 보호권 아이템 2개 추가
(items 테이블 구조 먼저 확인 후 INSERT):
  - protect_scroll: 강화 레벨 하락 방지
    GP 가격: 500 (settings: item_protect_scroll_gp)
    USDT 가격: NULL
  - blessed_scroll: 하락 + 파괴 방지
    GP 가격: NULL
    USDT 가격: 2.0 (settings: item_blessed_scroll_usdt)

settings 추가:
  item_protect_scroll_gp = 500
  item_blessed_scroll_usdt = 2.0

[3단계] Enhancement에 보호권 적용

services/enhancement.js에서
강화 시도 함수에 보호권 체크 추가:

  강화 실패 시:
    유저가 blessed_scroll 보유하면:
      → 하락 없음, 파괴 없음, 아이템 소모
    유저가 protect_scroll 보유하면:
      → 하락 없음, 파괴는 유지, 아이템 소모
    없으면: 기존 로직 그대로

  아이템 소모: 인벤토리에서 1개 차감

[4단계] API

GET /api/items/scrolls → 보호권 아이템 목록 + 내 보유량

완료 후:
1. 수정/생성 파일 목록
2. 테스트: 보호권 구매 → 강화 실패 시 보호 효과 확인
```

---

# ════════════════════════════════════════
# MIGRATION 090: Phase 4 옥션 (기존 계획)
# ════════════════════════════════════════

## [Migration 090] 작업 지시

```
Migration 090 옥션 시스템을 구현해줘.
(기존 GAME_CONCEPT_REVIEW Phase 4 계획)

작업 범위:

[1단계] DB 테이블 생성

CREATE TABLE IF NOT EXISTS auctions (
  id SERIAL PRIMARY KEY,
  seller_id INT NOT NULL REFERENCES users(id),
  item_type VARCHAR(20) NOT NULL,
  item_instance_id INT,
  resource_code VARCHAR(30),
  resource_quantity BIGINT,
  claim_id INT,
  start_price INT NOT NULL,
  currency VARCHAR(10) DEFAULT 'GP',
  current_bid INT NOT NULL,
  current_bidder_id INT REFERENCES users(id),
  buyout_price INT,
  listing_fee INT NOT NULL,
  platform_fee_rate DECIMAL(5,4) DEFAULT 0.05,
  status VARCHAR(20) DEFAULT 'active',
  starts_at TIMESTAMP DEFAULT NOW(),
  ends_at TIMESTAMP NOT NULL,
  snipe_extension_min INT DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bids (
  id SERIAL PRIMARY KEY,
  auction_id INT NOT NULL REFERENCES auctions(id),
  bidder_id INT NOT NULL REFERENCES users(id),
  bid_amount INT NOT NULL,
  is_winning BOOLEAN DEFAULT FALSE,
  refunded BOOLEAN DEFAULT FALSE,
  bid_at TIMESTAMP DEFAULT NOW()
);

[2단계] services/auction.js 생성

async function createAuction(userId, auctionData)
  - 아이템/자원/클레임 에스크로 처리
  - Merchant 직업 수수료 할인 적용
  - auctions INSERT

async function placeBid(userId, auctionId, bidAmount)
  - 현재가 + 최소 입찰 증가량 이상 검증
  - 이전 최고 입찰자 환불
  - 새 입찰 GP 차감
  - 마감 5분 전이면 ends_at 5분 연장 (스나이핑 방지)

async function settleAuction(auctionId)
  - 낙찰자 확정
  - 플랫폼 수수료 차감
  - 판매자에게 낙찰금 지급
  - 아이템 낙찰자에게 이전
  - 유찰 시 에스크로 반환

[3단계] 스케줄러에 추가

매 5분: 종료된 옥션 자동 정산

[4단계] API (routes/auction.js 신규)

POST /api/auction/create → 옥션 등록
GET /api/auctions → 목록 (필터: 타입, 정렬)
GET /api/auction/:id → 상세 + 입찰 내역
POST /api/auction/:id/bid → 입찰
POST /api/auction/:id/buyout → 즉구
GET /api/user/auctions → 내 등록/참여 옥션

[5단계] 프론트엔드

Marketplace에 AUCTION 탭 추가
옥션 목록, 상세, 입찰 UI

완료 후:
1. 수정/생성 파일 목록
2. 테스트: 옥션 등록 → 입찰 → 정산 전체 흐름
```

---

# ════════════════════════════════════════
# MIGRATION 091: 영토 매매 비주얼 (기존 계획)
# ════════════════════════════════════════

## [Migration 091] 작업 지시

```
Migration 091 영토 매매 비주얼을 구현해줘.
(기존 GAME_CONCEPT_REVIEW Phase 5 계획)

작업 범위:

[1단계] 맵에 FOR SALE 마커 표시

Marketplace에 claim 타입 리스팅이 있는 영토를
지도에서 특별 마커로 표시:
  마커: 작은 노란색 $ 아이콘 (픽셀 위에 오버레이)
  hover 시: 가격 + 크기 툴팁 표시
  클릭 시: 영토 상세 모달

[2단계] 영토 상세 모달에 판매 정보 추가

기존 영토 클릭 모달에:
  "이 영토는 판매 중입니다: XXX GP"
  [구매하기] 버튼
  [옥션 참여] 버튼 (옥션 등록된 경우)
  섹터 Lore 정보 표시
  해당 영토의 Mining 예상 수익 표시
  예상 자원 드롭 확률 표시 (섹터 기반)

[3단계] 내 영토 판매 등록 UI

My Base > My Territories 탭에서
[판매 등록] 버튼 추가
클릭 시: 가격 설정 → Marketplace 등록 연결

[4단계] 섹터 Lore 연동

영토 모달에 해당 섹터의 lore_en/ko/ja/zh 표시
섹터 아이콘 + 이름 + 특징 표시

완료 후:
1. 수정 파일 목록 (주로 index.html)
2. 테스트: 클레임 판매 등록 → 맵에서 마커 확인
```

---

# ════════════════════════════════════════
# MIGRATION 092: 함선 건조 시스템
# ════════════════════════════════════════

## [Migration 092-A] 작업 지시 (DB)

```
OCCUPY_MARS_COMPLETE_BIBLE.md COMBAT_BIBLE 섹션을 참고해서
Migration 092 1단계를 실행해줘.

작업 범위:

[1단계] DB 테이블 생성

CREATE TABLE IF NOT EXISTS ship_blueprints (
  id SERIAL PRIMARY KEY,
  ship_type VARCHAR(20) NOT NULL,
  name_en VARCHAR(50),
  name_ko VARCHAR(50),
  name_ja VARCHAR(50),
  name_zh VARCHAR(50),
  size_width INT NOT NULL,
  size_height INT NOT NULL,
  base_hp INT NOT NULL,
  base_atk INT NOT NULL,
  base_def INT NOT NULL,
  base_spd INT NOT NULL,
  base_range INT NOT NULL,
  build_time_min INT NOT NULL,
  server_max_count INT DEFAULT NULL,
  is_craftable BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ship_build_requirements (
  id SERIAL PRIMARY KEY,
  blueprint_id INT NOT NULL REFERENCES ship_blueprints(id),
  resource_code VARCHAR(30) NOT NULL REFERENCES resources(code),
  quantity INT NOT NULL
);

CREATE TABLE IF NOT EXISTS ship_instances (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  guild_id INT REFERENCES guilds(id),
  blueprint_id INT NOT NULL REFERENCES ship_blueprints(id),
  ship_name VARCHAR(50),
  enhance_level INT DEFAULT 0,
  current_hp INT NOT NULL,
  max_hp INT NOT NULL,
  status VARCHAR(20) DEFAULT 'docked',
  location_sector VARCHAR(30)
    REFERENCES sector_definitions(code),
  location_x DECIMAL(10,4),
  location_y DECIMAL(10,4),
  color_hex VARCHAR(7),
  special_effect VARCHAR(30),
  built_at TIMESTAMP DEFAULT NOW(),
  last_combat_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ship_build_queue (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  blueprint_id INT NOT NULL REFERENCES ship_blueprints(id),
  status VARCHAR(20) DEFAULT 'building',
  started_at TIMESTAMP DEFAULT NOW(),
  completes_at TIMESTAMP NOT NULL,
  materials_consumed JSONB
);

[2단계] 함선 5종 초기 데이터

기획서 COMBAT_BIBLE의 함선 INSERT SQL 실행
(Sparrow, Hawk, Starfarer, Colossus, Prometheus)

[3단계] 건조 재료 초기 데이터

기획서 COMBAT_BIBLE의 ship_build_requirements INSERT SQL 실행

[4단계] settings 추가

ship_build_crafter_time_bonus = 0.70
ship_build_crafter_material_bonus = 0.85
ship_build_guild_time_bonus = 0.80
ship_titan_server_max = 3
ship_wreck_resource_rate = 0.40
ship_wreck_duration_min = 30

완료 후:
1. 생성 파일 목록
2. 롤백 SQL
3. 테스트: SELECT * FROM ship_blueprints (5개 확인)
```

## [Migration 092-B] 작업 지시 (서비스 + UI)

```
Migration 092 2단계를 실행해줘.
(92-A 완료 후 실행)

작업 범위:

[1단계] services/shipyard.js 생성

async function getBlueprint(blueprintId)
async function getAllBlueprints()

async function canBuild(userId, blueprintId)
  - 자원 보유량 확인 (user_resource_inventory)
  - Titan이면 서버 현재 존재 수 확인
  - 반환: { canBuild, missingResources }

async function startBuild(userId, blueprintId)
  - canBuild 체크
  - 자원 차감
  - Crafter 직업이면 시간 버프 적용
  - 길드 건조소 버프 적용 (Guild 테이블 확인)
  - ship_build_queue INSERT
  - 반환: { success, queue, completesAt }

async function checkBuildComplete()
  - 완료 시간 지난 building 큐 처리
  - ship_instances 생성
  - ship_build_queue status = 'ready'

async function getHangar(userId)
  - 내 함선 목록 + 건조 큐 반환

[2단계] 스케줄러에 추가

매 1분: checkBuildComplete() 실행

[3단계] API (routes/shipyard.js 신규)

GET /api/ships/blueprints → 설계도 목록
GET /api/user/hangar → 내 격납고
POST /api/ships/build/start → 건조 시작
GET /api/ships/build/queue → 내 건조 큐

[4단계] 프론트엔드

My Base에 HANGAR 탭 추가:
  보유 함선 목록 (아이콘 + 이름 + HP + 상태)
  건조 큐 (진행바 + 남은 시간)
  [새 함선 건조] 버튼 → 설계도 선택 → 재료 확인 → 건조 시작

완료 후:
1. 수정/생성 파일 목록
2. 테스트: Scout 건조 시작 → 30분 후 완료 확인
```

---

# ════════════════════════════════════════
# MIGRATION 093: 전투 엔진
# ════════════════════════════════════════

## [Migration 093-A] 작업 지시 (DB + 전투 로직)

```
COMBAT_BIBLE를 참고해서 Migration 093 1단계를 실행해줘.

작업 범위:

[1단계] DB 테이블 생성

CREATE TABLE IF NOT EXISTS battles (
  id SERIAL PRIMARY KEY,
  battle_type VARCHAR(30) NOT NULL,
  attacker_id INT REFERENCES users(id),
  attacker_guild_id INT REFERENCES guilds(id),
  defender_id INT REFERENCES users(id),
  defender_guild_id INT REFERENCES guilds(id),
  sector_code VARCHAR(30) REFERENCES sector_definitions(code),
  status VARCHAR(20) DEFAULT 'preparing',
  attacker_fleet JSONB NOT NULL DEFAULT '[]',
  defender_fleet JSONB NOT NULL DEFAULT '[]',
  attacker_tactic VARCHAR(20) DEFAULT 'balanced',
  defender_tactic VARCHAR(20) DEFAULT 'defensive',
  current_turn INT DEFAULT 0,
  attacker_score INT DEFAULT 0,
  defender_score INT DEFAULT 0,
  winner VARCHAR(20),
  resources_looted JSONB DEFAULT '{}',
  started_at TIMESTAMP,
  ends_at TIMESTAMP,
  completed_at TIMESTAMP,
  chronicle_id INT
);

CREATE TABLE IF NOT EXISTS battle_turns (
  id SERIAL PRIMARY KEY,
  battle_id INT NOT NULL REFERENCES battles(id),
  turn_number INT NOT NULL,
  events JSONB NOT NULL DEFAULT '[]',
  attacker_ships_remaining INT,
  defender_ships_remaining INT,
  processed_at TIMESTAMP DEFAULT NOW()
);

[2단계] services/combat.js 생성

async function createBattle(config)
  - battles INSERT
  - 함선 상태 'combat'으로 변경

async function processBattleTurn(battleId)
  - 활성 전투 불러오기
  - 각 함선 이동 처리 (SPD 기반)
  - 사거리 내 적 함선 공격 (ATK vs DEF)
  - HP 0 이하 함선 파괴 처리
  - Warrior 직업 버프 적용
  - battle_turns INSERT
  - 승리 조건 체크

function calculateDamage(attackerShip, defenderShip)
  - base = Math.max(1, atk - def * 0.5)
  - variance = 0.8 + Math.random() * 0.4
  - return Math.floor(base * variance)

async function checkVictory(battleId)
  - 한쪽 함선 전멸 또는 제한 시간 초과
  - 반환: { winner, reason } or null

async function resolveBattle(battleId, result)
  - 함선 HP 업데이트 (파괴된 것 제외)
  - 자원 약탈 처리 (expedition_attack 타입인 경우)
  - battles 완료 처리
  - Chronicle 기록 (chronicleService 호출)
  - Titan 파괴 체크 → 특별 Chronicle

async function destroyShip(shipInstanceId, battleId)
  - ship_instances status = 'destroyed'
  - 잔해물 생성 (ship_instance를 wreckage로 변환)

[3단계] 스케줄러에 추가

매 30초: 활성 전투(status='active') 전체 processBattleTurn 실행
(battle_turn_interval_sec 설정값으로)

완료 후:
1. 생성 파일 목록
2. 테스트: createBattle → processBattleTurn 1회 → battle_turns 저장 확인
```

## [Migration 093-B] 작업 지시 (전투 시각화)

```
Migration 093 2단계를 실행해줘.
(93-A 완료 후 실행)

작업 범위:

[1단계] SSE 전투 스트림

GET /api/battle/:id/stream
Server-Sent Events:
  전투 턴 처리마다 최신 상태 발송:
  {
    battleId, turn, attackerShips, defenderShips,
    latestEvents, winner (있으면)
  }

[2단계] Three.js 전투 시각화 (index.html)

기존 화성 글로브 위에 전투 레이어 추가:

활성 전투가 있는 섹터에:
  - 함선 픽셀 직사각형 표시
    (ship_blueprint의 size_width × size_height px)
  - 공격 시 얇은 선 이펙트 (레이저)
  - 파괴 시 픽셀 폭발 (간단한 파티클)
  - 함선 이동 애니메이션 (30초마다 SSE 데이터 기반 위치 업데이트)

전투 패널 (오른쪽 사이드바):
  - 공격/수비 팀 함선 수
  - 전체 HP 바
  - 전투 로그 (최근 5개 이벤트)
  - 경과 시간
  - [관전] [베팅] [공유] 버튼

Titan이 전장에 있으면:
  - 다른 함선보다 크게 표시
  - 특수 색상 (황금)

[3단계] 전투 시작 API

POST /api/battle/start
  body: {
    battleType, targetId/expeditionId,
    attackerFleet: [shipInstanceId, ...],
    tactic: 'aggressive|balanced|defensive'
  }
  인증 필요

완료 후:
1. 수정/생성 파일 목록
2. 테스트: 전투 시작 → SSE 스트림 수신 → 화면에 함선 표시 확인
```

---

# ════════════════════════════════════════
# MIGRATION 094: 채굴 원정
# ════════════════════════════════════════

## [Migration 094] 작업 지시

```
COMBAT_BIBLE를 참고해서 Migration 094를 실행해줘.

작업 범위:

[1단계] DB 테이블

CREATE TABLE IF NOT EXISTS mining_expeditions (
  id SERIAL PRIMARY KEY,
  leader_id INT NOT NULL REFERENCES users(id),
  guild_id INT REFERENCES guilds(id),
  destination_sector VARCHAR(30)
    REFERENCES sector_definitions(code),
  status VARCHAR(20) DEFAULT 'preparing',
  ship_formation JSONB NOT NULL,
  departed_at TIMESTAMP,
  arrived_at TIMESTAMP,
  mining_ends_at TIMESTAMP,
  returns_at TIMESTAMP,
  resources_collected JSONB DEFAULT '{}',
  battle_id INT REFERENCES battles(id),
  created_at TIMESTAMP DEFAULT NOW()
);

[2단계] services/expedition.js 생성

async function launchExpedition(leaderId, destinationSector, shipFormation)
  - 함선 상태 'docked' 확인
  - 거리 기반 이동 시간 계산
  - mining_expeditions INSERT
  - 함선 status = 'traveling' 업데이트

async function processExpeditionTick()
  - traveling → mining 상태 전환 (arrived_at 도달 시)
  - mining → returning 전환 (mining_ends_at 도달 시)
  - returning → completed (returns_at 도달 시)
  - completed 시: 수집 자원을 리더 인벤토리에 추가

async function attackExpedition(attackerId, expeditionId, attackerFleet)
  - 원정 상태 확인 (traveling/mining 중만 공격 가능)
  - combatService.createBattle 호출 (expedition_attack 타입)
  - 원정 status = 'combat' 업데이트

[3단계] 스케줄러에 추가

매 5분: processExpeditionTick() 실행

[4단계] API (routes/expedition.js 신규)

POST /api/expedition/launch → 원정 출발
GET /api/user/expeditions → 내 원정 목록
GET /api/expedition/:id → 원정 현황
POST /api/expedition/:id/attack → 원정 공격

[5단계] 프론트엔드

지도에서 섹터 우클릭 또는 섹터 패널에 [원정 출격] 버튼
원정 편성 UI (함선 선택, 역할 배정)
원정 중인 함선 지도에 이동 경로 표시 (점선)
원정 현황 알림 (도착, 채굴 완료, 귀환 완료)

완료 후:
1. 수정/생성 파일 목록
2. 테스트: 원정 출발 → 도착 → 자원 수집 → 귀환 전체 흐름
```

---

# ════════════════════════════════════════
# MIGRATION 095: Guild War 재설계
# ════════════════════════════════════════

## [Migration 095-A] 작업 지시 (DB + 서비스)

```
COMBAT_BIBLE를 참고해서 Migration 095 1단계를 실행해줘.

작업 범위:

[1단계] DB 테이블

CREATE TABLE IF NOT EXISTS guild_wars (
  id SERIAL PRIMARY KEY,
  attacker_guild_id INT NOT NULL REFERENCES guilds(id),
  defender_guild_id INT NOT NULL REFERENCES guilds(id),
  coalition_attacker JSONB DEFAULT '[]',
  coalition_defender JSONB DEFAULT '[]',
  war_type VARCHAR(20) DEFAULT 'declared',
  status VARCHAR(20) DEFAULT 'preparing',
  gp_cost INT NOT NULL,
  attacker_points INT DEFAULT 0,
  defender_points INT DEFAULT 0,
  declared_at TIMESTAMP DEFAULT NOW(),
  war_starts_at TIMESTAMP NOT NULL,
  war_ends_at TIMESTAMP NOT NULL,
  winner_guild_id INT REFERENCES guilds(id),
  surrender_by INT REFERENCES guilds(id),
  treasury_looted DECIMAL(20,8) DEFAULT 0,
  total_battles INT DEFAULT 0,
  chronicle_id INT
);

[2단계] services/guildwar.js 생성

async function declareWar(attackerGuildId, defenderGuildId, warType)
  - Guild Treasury GP 확인
  - GP 차감
  - guild_wars INSERT
  - Chronicle 기록
  - Betting 이벤트 생성

async function joinWarAsCoalition(guildId, warId, side)
  - coalition 배열에 길드 추가 (최대 2개)
  - 양쪽 동시 참여 배신 체크

async function addWarPoints(warId, side, eventType)
  - 포인트 추가 (settings에서 각 행동별 포인트 조회)

async function resolveGuildWar(warId)
  - 포인트 비교
  - 승자 결정
  - 패자 Treasury 일부 몰수
  - Hall of Fame 업데이트
  - Chronicle 기록

async function surrender(guildId, warId)
  - Treasury 30% 몰수
  - 전쟁 즉시 종료

[3단계] 기존 Guild War 코드와 통합

기존 guild_wars 관련 코드 찾아서
새 시스템과 호환되도록 연결
(기존 미니게임 결과도 포인트로 환산 가능하면 연결)

[4단계] Hijack에 Guild War 포인트 연결

Hijack 완료 후 해당 유저가 Guild War 참전 중이면:
  addWarPoints(warId, side, 'hijack') 호출
  (1줄 추가)

완료 후:
1. 수정/생성 파일 목록
2. 테스트: 선전포고 → 포인트 획득 → 정산 흐름
```

## [Migration 095-B] 작업 지시 (UI)

```
Migration 095 2단계를 실행해줘.
(95-A 완료 후 실행)

작업 범위:

[1단계] Guild War 지도 표시

전쟁 중인 두 길드의 영토를
각 길드 색상으로 구분해서 지도에 표시
(공격 길드: 붉은 테두리, 방어 길드: 파란 테두리)

전투 발생 위치에 ⚔️ 아이콘 표시

[2단계] Guild War 선언 UI

Guild 탭에 [전쟁 선포] 버튼 추가
  → 상대 길드 검색
  → 즉시전 vs 예약전 선택
  → 비용 확인
  → 선포

[3단계] 연합 참전 UI

진행 중인 Guild War에 동맹 길드 참전 버튼
[도전자 편 지원] / [수비자 편 지원]

[4단계] 전쟁 현황 패널

각 섹터 또는 길드 페이지에
진행 중인 전쟁 포인트 현황 표시
  공격팀: XX포인트 vs 수비팀: YY포인트
  남은 시간: HH:MM:SS

완료 후:
1. 수정 파일 목록
2. 테스트: 전쟁 선포 → 지도 색상 변경 확인
```

---

# ════════════════════════════════════════
# MIGRATION 096: 섹터 습격 (Sector Raid)
# ════════════════════════════════════════

## [Migration 096] 작업 지시

```
COMBAT_BIBLE를 참고해서 Migration 096을 실행해줘.

작업 범위:

[1단계] DB 테이블

CREATE TABLE IF NOT EXISTS sector_raids (
  id SERIAL PRIMARY KEY,
  raider_id INT NOT NULL REFERENCES users(id),
  raider_guild_id INT REFERENCES guilds(id),
  sector_code VARCHAR(30) NOT NULL
    REFERENCES sector_definitions(code),
  status VARCHAR(20) DEFAULT 'announced',
  ship_formation JSONB NOT NULL,
  announced_at TIMESTAMP DEFAULT NOW(),
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP,
  battle_id INT REFERENCES battles(id),
  mining_cut_active BOOLEAN DEFAULT FALSE,
  mining_cut_ends_at TIMESTAMP,
  result VARCHAR(20)
);

[2단계] services/raid.js 생성

async function announceRaid(raiderId, sectorCode, shipFormation)
  - 습격 선언 (1시간 후 시작)
  - 섹터 주민 전체 알림
  - Chronicle 기록

async function startRaid(raidId)
  - combatService.createBattle 호출
  - 섹터 방어자들 vs 공격자 전투

async function resolveRaid(raidId, winner)
  - 승리 시: 6시간 동안 섹터 Mining 수익 20% 약탈
  - 패배 시: 함선 손실만

async function processActiveMiningCut()
  - mining_cut_active인 섹터의 Harvest 처리 시
    20%를 raider 계정으로 이전

[3단계] 기존 Harvest에 습격 세금 추가

Harvest 처리 함수에:
  해당 섹터에 활성 Raid가 있으면
  ppYield의 20%를 raider에게 이전
  (기존 로직 최소 수정)

[4단계] API + 스케줄러

POST /api/raid/announce → 습격 선언
GET /api/raid/active → 현재 습격 중인 섹터 목록

스케줄러:
  매 5분: 시작 시간 된 Raid 자동 시작
  매 5분: 종료 시간 된 mining_cut 자동 해제

완료 후:
1. 수정/생성 파일 목록
2. 테스트: 습격 선언 → 전투 → Mining 수익 약탈 확인
```

---

# ════════════════════════════════════════
# MIGRATION 097: Chronicle 전투 연동
# ════════════════════════════════════════

## [Migration 097] 작업 지시

```
Migration 097을 실행해줘.
전투 시스템과 Chronicle을 완전히 연동해줘.

작업 범위:

[1단계] services/chronicle.js에 전투 이벤트 추가

다음 함수들 추가:

async function checkBattleRecord(battle, result)
  - 전투 규모가 크면 Chronicle 기록
  - Titan 관련이면 무조건 기록 + Webhook

async function recordTitanSpawn(shipInstance, sectorCode)
  - Titan 출격 시 호출
  - 서버 전체 공지 (in-game Live Feed)
  - Discord Webhook 즉시 발송

async function recordTitanDestroyed(shipInstance, destroyerId, sectorCode)
  - Titan 파괴 Chronicle
  - "Titan Slayer" 칭호 부여
  - Discord Webhook 즉시 발송

async function recordCoalitionVictory(warId, winnerCoalition)
  - 다수를 이긴 연합 승리 Chronicle

async function recordGuildWarEnd(guildWar, winner)
  - 전쟁 전체 요약 Chronicle
  - 주요 통계 포함

[2단계] 전투 서비스들에 Chronicle 호출 연결

combat.js resolveBattle에:
  chronicleService.checkBattleRecord 호출 추가

siege.js resolveSiege에:
  이미 있으면 확인, 없으면 추가

guildwar.js resolveGuildWar에:
  chronicleService.recordGuildWarEnd 호출 추가

shipyard.js startBuild에 (Titan 건조 시):
  서버 공지 "Titan 건조 시작됨"

shipyard.js completeBuild에 (Titan 완성 시):
  chronicleService.recordTitanSpawn 호출

[3단계] 소셜 공유 카드 개선

/share/battle/:battleId 라우트:
  전투 결과 요약 카드
  OG Image: 참전 함선 수 + 승패 + 섹터명
  og:title: "[공격자] vs [수비자] 전투 — [승자] 승리"

/share/war/:warId 라우트:
  Guild War 전체 요약 카드

[4단계] Titan 서버 공지

in-game Live Feed에 Titan 관련 즉시 공지:
  "⚠️ [유저명]의 Prometheus가 [섹터명] 상공에 나타났습니다!"
  (실시간 SSE로 모든 접속자에게 발송)

완료 후:
1. 수정 파일 목록
2. 테스트: Titan 완성 → 서버 공지 → Chronicle 기록 확인
```

---

# ════════════════════════════════════════
# MIGRATION 098: 함선 커스터마이징
# ════════════════════════════════════════

## [Migration 098] 작업 지시

```
Migration 098을 실행해줘.

작업 범위:

[1단계] 함선 이름 + 색상 설정

ship_instances에 이미 color_hex, ship_name 컬럼 있음
API 추가:

PATCH /api/ships/:instanceId/customize
  body: { shipName, colorHex }
  비용: 이름 변경 20 GP, 색상 변경 50 GP
  (settings: ship_rename_cost_gp, ship_recolor_cost_gp)

[2단계] 지도에 함선 색상 반영

전투 시각화에서
함선 픽셀의 색상을 ship_instances.color_hex로 렌더링

[3단계] 마켓에 함선 거래 추가

Marketplace에 ship 타입 추가:
  - 건조 완료된 함선을 마켓에 판매 가능
  - 강화된 함선 (+1~+5) 프리미엄 가격

marketplace_listings:
  ADD COLUMN IF NOT EXISTS ship_instance_id INT
    REFERENCES ship_instances(id);

에스크로 처리:
  함선 listing 시 status = 'listed'
  구매 완료 시 user_id 변경

[4단계] 함선 강화 (+0~+5)

기존 Enhancement 시스템 확장:
  ship_instances도 강화 가능하도록
  강화 재료: iron_dust 기반
  성공률: 아이템보다 낮게 (함선이 더 귀하므로)
    +1: 80%, +2: 60%, +3: 40%, +4: 20%, +5: 10%
  실패 시: 하락만 (파괴 없음 — 함선은 너무 제작 비용이 큼)

settings 추가:
  ship_enhance_success_base = 0.80
  ship_enhance_no_destroy = true

완료 후:
1. 수정/생성 파일 목록
2. 테스트: 함선 이름 변경 → 지도에서 색상 확인
```

---

# ════════════════════════════════════════
# MIGRATION 099: 파벌 시스템 (선택적)
# ════════════════════════════════════════

## [Migration 099] 작업 지시

```
Migration 099를 실행해줘.
(DAU 1,000 이상 달성 후 진행 권장)

작업 범위:

[1단계] DB 테이블

CREATE TABLE IF NOT EXISTS factions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  name_en VARCHAR(50),
  name_ko VARCHAR(50),
  name_ja VARCHAR(50),
  name_zh VARCHAR(50),
  description_en TEXT,
  color_hex VARCHAR(7),
  home_sector_type VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS faction_code VARCHAR(10)
    REFERENCES factions(code),
  ADD COLUMN IF NOT EXISTS faction_joined_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS faction_change_at TIMESTAMP;

[2단계] 3개 파벌 초기 데이터

INSERT INTO factions (code, name_en, name_ko, name_ja, name_zh,
  color_hex, home_sector_type)
VALUES
('mcc', 'MCC', 'MCC (화성기업연합)', 'MCC', '火星企业联合',
  '#4169E1', 'core'),
('fsp', 'FSP', 'FSP (자유정착자연맹)', 'FSP', '自由定居者盟约',
  '#228B22', 'mid'),
('cv',  'CV',  'CV (크림슨 버딕트)', 'CV',  '赤色裁决',
  '#DC143C', 'frontier')
ON CONFLICT (code) DO NOTHING;

[3단계] 파벌 버프 (job_buffs 패턴과 동일하게 faction_buffs 테이블)

CREATE TABLE IF NOT EXISTS faction_buffs (
  id SERIAL PRIMARY KEY,
  faction_code VARCHAR(10) NOT NULL REFERENCES factions(code),
  buff_key VARCHAR(60) NOT NULL,
  buff_value DECIMAL(10,4) NOT NULL,
  UNIQUE(faction_code, buff_key)
);

INSERT INTO faction_buffs (faction_code, buff_key, buff_value) VALUES
('mcc', 'mcc_deposit_bonus', 1.02),
('mcc', 'mcc_core_tax_reduction', 0.95),
('fsp', 'fsp_guild_treasury_bonus', 1.10),
('fsp', 'fsp_guild_war_bonus', 1.15),
('cv',  'cv_bounty_reward', 1.20),
('cv',  'cv_frontier_mining', 1.10);

[4단계] services/faction.js 생성

async function joinFaction(userId, factionCode)
  - 파벌 가입 (30일 변경 쿨다운)
  - 비용: 500 GP (settings: faction_change_cost_gp)

async function getFactionBuff(userId, buffKey, defaultValue)
  - job.js의 getJobBuff와 동일 패턴

[5단계] API + UI

POST /api/user/faction → 파벌 가입/변경
GET /api/factions → 파벌 목록 + 현재 인구

프론트엔드:
  파벌 선택 화면 (온보딩 이후 선택)
  지도에서 파벌별 색상 오버레이 (선택)

완료 후:
1. 수정/생성 파일 목록
2. 테스트: 파벌 가입 → 파벌 버프 적용 확인
```

---

# ════════════════════════════════════════
# MIGRATION 100: 경제 밸런싱 + 운영 도구
# ════════════════════════════════════════

## [Migration 100] 작업 지시

```
Migration 100을 실행해줘.
마지막 Migration — 운영에 필요한 모든 모니터링 도구를 완성해줘.

작업 범위:

[1단계] 경제 모니터링 뷰 생성

CREATE OR REPLACE VIEW economy_health AS
SELECT
  DATE(created_at) AS date,
  SUM(CASE WHEN amount > 0 AND currency='PP'
    THEN amount ELSE 0 END) AS pp_issued,
  SUM(CASE WHEN amount < 0 AND currency='PP'
    THEN ABS(amount) ELSE 0 END) AS pp_burned,
  ROUND(
    SUM(CASE WHEN amount < 0 AND currency='PP'
      THEN ABS(amount) ELSE 0 END) /
    NULLIF(SUM(CASE WHEN amount > 0 AND currency='PP'
      THEN amount ELSE 0 END), 0), 4
  ) AS pp_sink_ratio,
  SUM(CASE WHEN amount > 0 AND currency='GP'
    THEN amount ELSE 0 END) AS gp_issued,
  SUM(CASE WHEN amount < 0 AND currency='GP'
    THEN ABS(amount) ELSE 0 END) AS gp_burned,
  ROUND(
    SUM(CASE WHEN amount < 0 AND currency='GP'
      THEN ABS(amount) ELSE 0 END) /
    NULLIF(SUM(CASE WHEN amount > 0 AND currency='GP'
      THEN amount ELSE 0 END), 0), 4
  ) AS gp_sink_ratio,
  COUNT(DISTINCT user_id) AS active_users
FROM transactions
GROUP BY DATE(created_at)
ORDER BY date DESC;

[2단계] Admin Economy 탭 추가 (20번째 탭)

다음 정보 표시:
  최근 7일 PP Sink/Faucet 비율 차트 (Chart.js)
  최근 7일 GP Sink/Faucet 비율 차트
  비율이 0.80 미만이면 빨간색 경고 표시
  현재 총 PP 유통량
  현재 총 GP 유통량

GET /api/admin/economy/stats → Admin 전용 경제 통계

[3단계] Admin 추가 탭들

SIEGE 탭 (18번째):
  진행 중 Siege 목록
  [강제 종료] 버튼
  역대 Siege 목록

CHRONICLE 탭 (19번째):
  Chronicle 목록 (필터, 검색)
  [수동 생성] 버튼
  [Webhook 테스트] 버튼

COMBAT 탭 (21번째):
  진행 중 전투 목록
  함선 인스턴스 현황
  Titan 현재 존재 여부 + 소유자

ONBOARDING 탭 (22번째):
  완료율 (완료/전체 유저)
  단계별 이탈률
  평균 완료 시간

[4단계] 인플레이션 자동 경고

스케줄러에 추가:
  매일 09:00 UTC:
    economy_health 뷰에서 어제 비율 확인
    pp_sink_ratio < 0.80이면:
      Admin 알림 (시스템 알림 또는 Discord 특정 채널)
    pp_sink_ratio < 0.60이면:
      긴급 알림

[5단계] 설정 관리 개선

기존 GAME SETTINGS Admin 탭에서
모든 settings key를 카테고리별로 표시:
  경제 관련 / 직업 관련 / 전투 관련 / 섹터 관련 / 온보딩 관련
  각 key마다 설명 표시
  실시간 수정 가능

완료 후:
1. 수정/생성 파일 목록
2. 최종 테스트: Admin Economy 탭에서 PP Sink 비율 확인
3. 전체 시스템 통합 테스트 체크리스트 제공
```

---

# ════════════════════════════════════════
# 전체 완료 후 최종 체크리스트
# ════════════════════════════════════════

## [FINAL] 런칭 전 최종 확인 지시

```
Migration 080~100이 모두 완료됐어.
런칭 전 최종 점검을 해줘.

다음 항목들을 확인하고 각 결과를 보고해줘:

[보안]
1. USDT 인출 API에 일일 한도 제한 있는지 확인
2. Harvest API에 Rate Limiting 있는지 확인 (4시간 1회)
3. Hijack API에 Rate Limiting 있는지 확인 (분당 5회)
4. 마켓 등록 API에 Rate Limiting 있는지 확인
5. 모든 금액 파라미터에 음수 입력 방지 있는지 확인
6. JWT 인증이 필요한 모든 API에 인증 미들웨어 있는지 확인

[데이터 정합성]
7. settings 테이블에 필수 key들이 전부 있는지 확인
8. 24개 섹터 전부 sector_governance에 레코드 있는지 확인
9. 4개 직업 job_buffs 수치 전부 있는지 확인
10. 5개 함선 설계도 + 재료 데이터 있는지 확인

[기능 연결]
11. Hijack 완료 → Chronicle 기록 → Discord Webhook 흐름 확인
12. Siege 완료 → Governor 교체 → Hall of Fame → Betting 정산 흐름 확인
13. Mining Harvest → 자원 드롭 → 인벤토리 추가 흐름 확인
14. Enhancement +10 → 칭호 부여 → Chronicle 기록 흐름 확인
15. Titan 건조 완료 → 서버 공지 → SSE 발송 흐름 확인

[설정]
16. discord_webhook_url settings에 실제 URL 입력되어 있는지 확인
17. 경제 경고 임계치 설정 (economy_warn_pp_sink_ratio) 있는지 확인
18. 온보딩이 신규 유저에게 정상 표시되는지 확인

각 항목 확인 결과를 ✅ / ❌ / ⚠️ 로 표시하고
❌ 항목은 수정 방법도 같이 알려줘.
```

---

# ════════════════════════════════════════
# 긴급 롤백 방법
# ════════════════════════════════════════

## 특정 Migration 롤백이 필요할 때

```
[Migration XXX]을 롤백해야 해.

1. 해당 Migration에서 생성된 테이블 목록을 확인해줘
2. 테이블 DROP SQL을 생성해줘
   (의존 관계 순서 맞게 — 참조하는 테이블 먼저 DROP)
3. users 테이블에 추가된 컬럼이 있으면 ALTER TABLE DROP COLUMN SQL도
4. settings에 추가된 key들 DELETE SQL도
5. 기존 서비스 파일에 추가된 코드 제거 방법도

롤백 전에 현재 데이터 백업 방법도 알려줘.
```

---

# ════════════════════════════════════════
# 자주 쓰는 디버깅 지시
# ════════════════════════════════════════

## 특정 기능이 작동 안 할 때

```
[기능명]이 작동하지 않아. 
다음 순서로 확인해줘:

1. 관련 API 엔드포인트 로그 확인
2. 관련 서비스 함수 로직 점검
3. DB 데이터 확인 (관련 테이블 SELECT)
4. settings 테이블에 필요한 key가 있는지 확인
5. 문제 원인 파악 후 수정

수정 시 기존 로직 최대한 유지할 것.
```

## settings 값 조정이 필요할 때

```
[설정 이름]을 [새 값]으로 변경해줘.
변경 전 현재 값을 먼저 확인하고,
변경 후 영향을 받는 기능들도 알려줘.
```
