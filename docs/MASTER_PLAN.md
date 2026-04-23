# OCCUPY MARS — 마스터 기획서 v2.0
> **Claude Code 구현 전용 문서**
> 작성일: 2026-04-23 | 기준 Migration: 079 | 목표 Migration: 080~089

---

## 📌 이 문서를 읽는 Claude Code에게

**이 문서는 순서대로 구현하는 설계 지침서입니다.**

- 각 Phase는 독립적으로 구현·테스트 가능하다
- 모든 수치는 `settings` 테이블에 저장한다 (하드코딩 절대 금지)
- 기존 코드를 수정할 때는 최소 변경 원칙을 지킨다
- 각 Phase 완료 후 반드시 변경 파일 목록과 롤백 방법을 제시한다
- 기존 마이그레이션(001~079)은 절대 수정하지 않는다

---

## 🗺️ 전체 로드맵

```
Migration 080: 직업 시스템 (Job System)          ← 최우선
Migration 081: 광물 & 자원 시스템                 ← 직업과 연동
Migration 082: 온보딩 튜토리얼                    ← 런칭 전 필수
Migration 083: 서사 엔진 (Lore + Chronicle)       ← 바이럴 기반
Migration 084: Phase 4 옥션 (기존 계획)           ← 기존 플랜 유지
Migration 085: 영토 매매 비주얼 (기존 계획)        ← 기존 플랜 유지
Migration 086: 강화 보호권 아이템                  ← 수익화 강화
Migration 087: 파벌 시스템 (3-Faction)            ← 커뮤니티 성장 후
Migration 088: Reinforcement Timer               ← 서사 엔진 심화
Migration 089: 시즌 경제 리셋 & 밸런싱 자동화      ← 장기 운영
```

---

## 📊 현재 게임 상태 (Migration 079 기준)

### 완성된 시스템 ✅
- 영토 점령 / Hijack / Marketplace (고정가)
- Enhancement (+0~+10) / Item Shop (5종)
- Guild / Guild War / Governance (Governor/Commander)
- Season Pass (30일 자동 순환) / Daily Missions (7종)
- Cantina (5종 미니게임) / POI 탐험 / 로켓 이벤트 / 날씨
- Mining/Harvest / Referral 3-tier / Level/XP
- 4개 언어 (EN/KO/JA/ZH) / Admin 15탭

### 핵심 누락 ❌
| 누락 항목 | 영향 | 우선순위 |
|---|---|---|
| 직업 시스템 | 경제 순환 단절, 약자 루트 없음 | 🔴 Critical |
| 온보딩 튜토리얼 | 신규 유저 5분 내 이탈 | 🔴 Critical |
| 서사 엔진 | 바이럴 불가, 공유 콘텐츠 없음 | 🟡 High |
| 광물/자원 시스템 | 마켓 거래 품목 빈약 | 🟡 High |
| 강화 보호권 | 수익화 기회 누락 | 🟢 Medium |

---

## 🏛️ 설계 철학 (구현 시 항상 참고)

### 원칙 1 — 세 계급의 경제 순환
```
[FRONTIER]          [MID]               [CORE]
약자 광부       →   상인/제작자     →   귀족(고래)
희귀 자원 채굴      가공 & 거래         소비 & 전쟁
     ↑___________________________________|
     고래의 USDT가 약자에게 흘러와야 함
```
**고래가 돈을 쓰면 약자의 주머니로 흘러가는 구조**가 6~12개월 수익의 핵심.

### 원칙 2 — 데이터 드리븐 (하드코딩 금지)
모든 수치는 `settings` 테이블 또는 전용 설정 테이블에 저장.
관리자가 코드 배포 없이 수정 가능해야 함.

### 원칙 3 — 기존 코드 최소 수정
새 기능은 새 테이블/서비스로 분리.
기존 함수에는 `applyJobBuff()` 같은 단일 함수 호출만 추가.

### 원칙 4 — 플레이어가 만드는 서사
EVE Online B-R5RB 전투처럼 플레이어 행동이 역사가 되어야 함.
시스템은 기록하고, 플레이어는 전설을 만든다.

### 원칙 5 — Web3는 숨긴다
"NFT", "Blockchain", "Token" 언급 최소화.
"디지털 자산", "영구 소유", "보상" 표현 사용.

---

# PHASE 1: 직업 시스템 (Migration 080)

## 1.1 목적 및 근거

**왜 지금 넣어야 하는가:**
- 약자(무과금)가 Mining만으로는 경제에 기여하지 못함
- 마켓플레이스(Phase 3)가 완성됐지만 거래 품목이 빈약함
- 직업이 없으면 유저가 "나는 무엇을 해야 하는가"를 모름
- Phase 4 옥션보다 먼저 넣어야 옥션 함수에 직업 버프를 자연스럽게 연결 가능

**기대 효과:**
- 신규 유저에게 "나는 광부다 / 전사다" 정체성 부여
- Mining·Hijack·Enhancement·Marketplace 각각에 전문화 인센티브
- 길드 내 자연스러운 역할 분담 유도
- Phase 2 광물 시스템의 기반

## 1.2 직업 구조

### 4개 기본 직업

| 직업 | 코드 | 특화 활동 | 권장 섹터 |
|---|---|---|---|
| **광부 (Miner)** | `miner` | Mining, POI 탐험 | Frontier |
| **전사 (Warrior)** | `warrior` | Hijack, 방어, Guild War | 전 섹터 |
| **제작자 (Crafter)** | `crafter` | Enhancement, 아이템 제작 | Mid |
| **상인 (Merchant)** | `merchant` | Marketplace, 거래 | Mid/Core |

### 직업별 버프 수치 (settings 테이블 저장, 수정 가능)

#### Miner (광부)
| 버프 키 | 기본값 | 설명 |
|---|---|---|
| `miner_mining_rate` | 1.50 | Mining 수익률 +50% |
| `miner_harvest_speed` | 1.30 | Harvest 쿨다운 -30% |
| `miner_poi_reward` | 1.40 | POI 탐험 보상 +40% |
| `miner_rare_resource_chance` | 1.30 | 희귀 자원 발견 확률 +30% (Phase 2 연동) |
| `miner_combat_power` | 0.70 | 전투력 -30% (약점) |
| `miner_enhancement_success` | 1.00 | 강화 성공률 변화 없음 |
| `miner_market_fee` | 1.00 | 마켓 수수료 변화 없음 |

#### Warrior (전사)
| 버프 키 | 기본값 | 설명 |
|---|---|---|
| `warrior_combat_power` | 1.30 | 전투력 +30% |
| `warrior_hijack_success` | 1.20 | Hijack 성공 확률 +20% |
| `warrior_defense_item_effect` | 1.25 | 방어 아이템 효과 +25% |
| `warrior_attack_item_effect` | 1.20 | 공격 아이템 효과 +20% |
| `warrior_mining_rate` | 0.80 | Mining 수익률 -20% (약점) |
| `warrior_enhancement_success` | 0.90 | 강화 성공률 -10% |
| `warrior_market_fee` | 1.00 | 마켓 수수료 변화 없음 |

#### Crafter (제작자)
| 버프 키 | 기본값 | 설명 |
|---|---|---|
| `crafter_enhancement_success` | 1.25 | 강화 성공률 +25% |
| `crafter_enhancement_cost` | 0.85 | 강화 GP 비용 -15% |
| `crafter_enhancement_break_protection` | 1.20 | 강화 파괴 확률 감소 (파괴율 × 0.5) |
| `crafter_mining_rate` | 0.80 | Mining 수익률 -20% |
| `crafter_combat_power` | 0.80 | 전투력 -20% |
| `crafter_market_fee` | 0.90 | 마켓 수수료 -10% (약한 상업 보너스) |

#### Merchant (상인)
| 버프 키 | 기본값 | 설명 |
|---|---|---|
| `merchant_market_fee` | 0.70 | 마켓 수수료 30% 할인 |
| `merchant_listing_limit` | 1.50 | 최대 활성 리스팅 ×1.5 (30개) |
| `merchant_price_history_days` | 30 | 가격 히스토리 30일 (기본 7일 대비 연장) |
| `merchant_mining_rate` | 0.85 | Mining 수익률 -15% |
| `merchant_combat_power` | 0.80 | 전투력 -20% |
| `merchant_enhancement_success` | 0.95 | 강화 성공률 -5% |

> ⚠️ 위 수치는 제안값. 실제 운영 데이터로 지속 조정 필요.

## 1.3 직업 선택 규칙

```yaml
최초 선택:
  시점: Level 5 달성 시 강제 모달
  방법: 4개 직업 카드 선택
  철회: 선택 완료 전까지 자유

변경:
  무료 변경: 주 1회 (weekly_job_change_count 기준)
  유료 변경: 50 GP (settings: job_change_cost_gp)
  쿨다운: 변경 후 24시간
  제한: 활성 마켓 리스팅 있으면 Merchant → 타 직업 변경 불가 (정산 후 가능)

직업 없음:
  Level 5 미만 유저는 직업 없이 플레이 (버프 없음)
  Level 5 달성 후 직업 미선택 시: 로그인할 때마다 선택 유도 배너 표시
```

## 1.4 DB 스키마 (Migration 080)

```sql
-- 직업 정의 테이블
CREATE TABLE jobs (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20) UNIQUE NOT NULL,
  name_en     VARCHAR(50) NOT NULL,
  name_ko     VARCHAR(50) NOT NULL,
  name_ja     VARCHAR(50) NOT NULL,
  name_zh     VARCHAR(50) NOT NULL,
  description_en TEXT,
  description_ko TEXT,
  description_ja TEXT,
  description_zh TEXT,
  icon_emoji  VARCHAR(10) DEFAULT '⚔️',
  color_hex   VARCHAR(7)  DEFAULT '#888888',
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 직업별 버프 수치 (settings 패턴 동일하게 적용)
CREATE TABLE job_buffs (
  id          SERIAL PRIMARY KEY,
  job_id      INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  buff_key    VARCHAR(60) NOT NULL,
  buff_value  DECIMAL(8, 4) NOT NULL,
  description TEXT,
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(job_id, buff_key)
);

-- users 테이블 확장
ALTER TABLE users
  ADD COLUMN current_job_id    INT REFERENCES jobs(id),
  ADD COLUMN job_selected_at   TIMESTAMP,
  ADD COLUMN job_changed_at    TIMESTAMP,
  ADD COLUMN weekly_job_change_count INT DEFAULT 0,
  ADD COLUMN weekly_job_reset_at     TIMESTAMP DEFAULT NOW();

-- 직업 변경 로그
CREATE TABLE job_change_log (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id),
  from_job_id INT REFERENCES jobs(id),
  to_job_id   INT NOT NULL REFERENCES jobs(id),
  change_type VARCHAR(20) DEFAULT 'free', -- 'free', 'paid'
  gp_cost     INT DEFAULT 0,
  changed_at  TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_users_job ON users(current_job_id);
CREATE INDEX idx_job_buffs_job ON job_buffs(job_id, buff_key);
CREATE INDEX idx_job_change_log_user ON job_change_log(user_id, changed_at);
```

### 초기 데이터

```sql
-- 직업 4종
INSERT INTO jobs (code, name_en, name_ko, name_ja, name_zh, icon_emoji, color_hex, sort_order) VALUES
('miner',    'Miner',    '광부',   'マイナー',  '矿工', '⛏️', '#F4A460', 1),
('warrior',  'Warrior',  '전사',   'ウォリアー', '战士', '⚔️', '#DC143C', 2),
('crafter',  'Crafter',  '제작자', 'クラフター', '制作者','🔨', '#9370DB', 3),
('merchant', 'Merchant', '상인',   'マーチャント','商人', '💼', '#20B2AA', 4);

-- Miner 버프
INSERT INTO job_buffs (job_id, buff_key, buff_value) VALUES
(1, 'miner_mining_rate', 1.50),
(1, 'miner_harvest_speed', 1.30),
(1, 'miner_poi_reward', 1.40),
(1, 'miner_rare_resource_chance', 1.30),
(1, 'miner_combat_power', 0.70),
(1, 'miner_enhancement_success', 1.00),
(1, 'miner_market_fee', 1.00);

-- Warrior 버프
INSERT INTO job_buffs (job_id, buff_key, buff_value) VALUES
(2, 'warrior_combat_power', 1.30),
(2, 'warrior_hijack_success', 1.20),
(2, 'warrior_defense_item_effect', 1.25),
(2, 'warrior_attack_item_effect', 1.20),
(2, 'warrior_mining_rate', 0.80),
(2, 'warrior_enhancement_success', 0.90),
(2, 'warrior_market_fee', 1.00);

-- Crafter 버프
INSERT INTO job_buffs (job_id, buff_key, buff_value) VALUES
(3, 'crafter_enhancement_success', 1.25),
(3, 'crafter_enhancement_cost', 0.85),
(3, 'crafter_enhancement_break_protection', 0.50),
(3, 'crafter_mining_rate', 0.80),
(3, 'crafter_combat_power', 0.80),
(3, 'crafter_market_fee', 0.90);

-- Merchant 버프
INSERT INTO job_buffs (job_id, buff_key, buff_value) VALUES
(4, 'merchant_market_fee', 0.70),
(4, 'merchant_listing_limit', 1.50),
(4, 'merchant_price_history_days', 30),
(4, 'merchant_mining_rate', 0.85),
(4, 'merchant_combat_power', 0.80),
(4, 'merchant_enhancement_success', 0.95);

-- settings 테이블에 직업 관련 설정 추가
INSERT INTO settings (key, value, description) VALUES
('job_change_cost_gp', '50', '유료 직업 변경 GP 비용'),
('job_change_weekly_free', '1', '주당 무료 직업 변경 횟수'),
('job_change_cooldown_hours', '24', '직업 변경 쿨다운 (시간)'),
('job_system_enabled', 'true', '직업 시스템 활성화 여부'),
('job_required_level', '5', '직업 선택 최소 레벨');
```

## 1.5 서비스 모듈 (신규: `services/job.js`)

```javascript
/**
 * services/job.js
 * 직업 시스템 핵심 서비스
 * 
 * 모든 버프 수치는 DB에서 조회. 하드코딩 금지.
 * 캐싱: 직업별 버프는 10분 메모리 캐시 (빈번 조회 최적화)
 */

// 핵심 함수 명세

/**
 * 유저의 특정 버프 값 조회
 * @param {number} userId
 * @param {string} buffKey - 예: 'miner_mining_rate'
 * @param {number} defaultValue - 버프 없을 때 기본값 (보통 1.0)
 * @returns {Promise<number>}
 * 
 * 사용 예:
 *   const rate = await getJobBuff(userId, 'miner_mining_rate', 1.0);
 *   yield = baseYield * rate;
 */
async function getJobBuff(userId, buffKey, defaultValue = 1.0)

/**
 * 유저의 현재 직업 정보 조회
 * @param {number} userId
 * @returns {Promise<{job: Object, buffs: Object} | null>}
 */
async function getUserJob(userId)

/**
 * 직업 선택/변경
 * @param {number} userId
 * @param {string} jobCode - 'miner' | 'warrior' | 'crafter' | 'merchant'
 * @returns {Promise<{success: boolean, message: string, costPaid: number}>}
 * 
 * 내부 로직:
 * 1. 레벨 체크 (job_required_level 설정 조회)
 * 2. 현재 직업 확인
 * 3. 무료/유료 변경 판단 (weekly_job_change_count 기준)
 * 4. 쿨다운 체크
 * 5. 유료 시 GP 차감
 * 6. 직업 변경 + 로그 기록
 */
async function selectJob(userId, jobCode)

/**
 * 모든 직업 목록 조회 (프론트엔드 직업 선택 UI용)
 * @param {string} lang - 'en' | 'ko' | 'ja' | 'zh'
 * @returns {Promise<Array>}
 */
async function getAllJobs(lang = 'en')

/**
 * 주간 무료 변경 횟수 리셋 (매주 월요일 00:00 UTC 실행)
 * 기존 스케줄러에 등록
 */
async function resetWeeklyJobChangeCounts()
```

## 1.6 기존 서비스 수정 포인트

> **수정 원칙**: 기존 로직은 건드리지 말고, 버프 적용 코드 1줄만 추가

### services/mining.js (또는 harvest 처리 파일)
```javascript
// 기존 코드 (예상 구조)
async function calculateHarvestYield(userId, claimId) {
  const baseYield = /* 기존 로직 */;
  
  // ✅ 추가 (1줄)
  const miningBuff = await jobService.getJobBuff(userId, 'miner_mining_rate', 1.0);
  
  return Math.floor(baseYield * miningBuff);
}
```

### 기존 hijack 처리 파일
```javascript
async function processHijack(attackerId, targetClaimId) {
  // ... 기존 로직 ...
  
  // ✅ 추가: Warrior hijack 성공률 버프
  const hijackBuff = await jobService.getJobBuff(attackerId, 'warrior_hijack_success', 1.0);
  const adjustedSuccessRate = baseSuccessRate * hijackBuff;
  
  // ✅ 추가: Warrior 방어 아이템 효과 버프 (수비자)
  const defBuff = await jobService.getJobBuff(defenderId, 'warrior_defense_item_effect', 1.0);
  // ...
}
```

### services/enhancement.js (기존 완성)
```javascript
async function attemptEnhancement(userId, instanceId) {
  // ✅ 추가: Crafter 강화 성공률 버프
  const successBuff = await jobService.getJobBuff(userId, 'crafter_enhancement_success', 1.0);
  const costBuff = await jobService.getJobBuff(userId, 'crafter_enhancement_cost', 1.0);
  const breakBuff = await jobService.getJobBuff(userId, 'crafter_enhancement_break_protection', 1.0);
  
  const finalSuccessRate = baseSuccessRate * successBuff;
  const finalCost = Math.floor(baseCost * costBuff);
  const finalBreakChance = baseBreakChance * breakBuff; // breakBuff = 0.50이면 파괴 50% 감소
  
  // ... 기존 로직 유지 ...
}
```

### services/marketplace.js (기존 완성)
```javascript
async function createListing(userId, itemData, price, currency) {
  // ✅ 추가: Merchant 수수료 할인
  const feeBuff = await jobService.getJobBuff(userId, 'merchant_market_fee', 1.0);
  const baseFeeRate = await getSetting('marketplace_fee_rate'); // 기존: 0.05
  const finalFeeRate = baseFeeRate * feeBuff; // Merchant: 0.05 * 0.70 = 0.035
  
  // ✅ 추가: Merchant 리스팅 한도 확장
  const listingBuff = await jobService.getJobBuff(userId, 'merchant_listing_limit', 1.0);
  const baseLimit = await getSetting('marketplace_max_listings'); // 기존: 20
  const finalLimit = Math.floor(baseLimit * listingBuff); // Merchant: 30
  
  // ... 기존 로직 유지 ...
}
```

## 1.7 API 엔드포인트 (신규: `routes/job.js`)

```
GET  /api/jobs                    → 전체 직업 목록 (언어 파라미터)
GET  /api/user/job                → 내 현재 직업 + 버프 목록
POST /api/user/job                → 직업 선택/변경
GET  /api/user/job/change-status  → 변경 가능 여부 (무료/유료/쿨다운)
GET  /api/admin/jobs              → 어드민: 직업별 유저 분포 통계
PUT  /api/admin/job-buff          → 어드민: 버프 수치 수정
```

### API 응답 예시

```json
// GET /api/user/job
{
  "job": {
    "code": "miner",
    "name": "광부",
    "icon_emoji": "⛏️",
    "color_hex": "#F4A460"
  },
  "buffs": {
    "mining_rate": 1.50,
    "harvest_speed": 1.30,
    "combat_power": 0.70
  },
  "changeStatus": {
    "canChangeFree": false,
    "freeChangesLeft": 0,
    "freeResetsAt": "2026-04-28T00:00:00Z",
    "canChangePaid": true,
    "paidCostGp": 50,
    "cooldownEndsAt": null
  }
}
```

## 1.8 프론트엔드 UI (index.html 수정)

### 1.8.1 직업 선택 모달 (Level 5 달성 시 자동 표시)

```
┌─────────────────────────────────┐
│  🚀 당신의 운명을 선택하세요      │
│  Choose Your Destiny             │
├─────────────────────────────────┤
│  ┌──────┐ ┌──────┐              │
│  │ ⛏️   │ │ ⚔️   │              │
│  │ 광부 │ │ 전사 │              │
│  │+50%  │ │+30%  │              │
│  │채굴  │ │전투  │              │
│  └──────┘ └──────┘              │
│  ┌──────┐ ┌──────┐              │
│  │ 🔨   │ │ 💼   │              │
│  │제작자│ │ 상인 │              │
│  │+25%  │ │-30%  │              │
│  │강화  │ │수수료│              │
│  └──────┘ └──────┘              │
│                                 │
│  [선택하기]  (나중에 변경 가능)  │
└─────────────────────────────────┘
```

**구현 사항:**
- 기존 `gameConfirm()` 패턴 재활용
- Level 5 달성 시 levelUp 이벤트 핸들러에서 트리거
- 카드 hover 시 상세 버프 목록 툴팁 표시
- 선택 전까지 닫기 불가 (ESC 비활성화)

### 1.8.2 My Base 직업 표시

```
기존 MY BASE 화면에 추가:

┌─────────────────────┐
│ 직업    ⛏️ 광부      │
│ [직업 변경] 무료 1회 │
│ 버프: 채굴 +50%      │
│       탐험 +40%      │
└─────────────────────┘
```

### 1.8.3 어드민 JOBS 탭 (Admin 16번째 탭)

```
JOBS 탭 내용:
- 직업별 유저 수 / 비율 도넛 차트
- 직업별 평균 PP 수익 (인플레이션 모니터링)
- 버프 수치 실시간 수정 테이블
- 직업 변경 로그 (최근 100건)
- 직업 시스템 전체 ON/OFF 스위치
```

## 1.9 Phase 1 성공 기준 체크리스트

```
DB:
- [ ] jobs 테이블 생성 + 4개 직업 데이터
- [ ] job_buffs 테이블 생성 + 초기 버프 데이터 (총 ~26개 레코드)
- [ ] users 테이블 컬럼 4개 추가 완료
- [ ] job_change_log 테이블 생성
- [ ] settings 테이블에 직업 설정 5개 추가

서비스:
- [ ] services/job.js 생성 (5개 함수)
- [ ] Mining 함수에 버프 적용 (1줄)
- [ ] Hijack 함수에 버프 적용 (2줄)
- [ ] Enhancement 함수에 버프 적용 (3줄)
- [ ] Marketplace 함수에 버프 적용 (4줄)

API:
- [ ] 6개 엔드포인트 구현
- [ ] 4개 언어 응답 지원

프론트엔드:
- [ ] Level 5 달성 시 직업 선택 모달
- [ ] My Base 직업 표시 섹션
- [ ] Admin JOBS 탭

검증:
- [ ] Miner 유저의 Mining 수익이 1.5배
- [ ] Warrior 유저의 Hijack 성공률이 1.2배
- [ ] Crafter 유저의 Enhancement GP 비용이 15% 감소
- [ ] Merchant 유저의 Marketplace 수수료가 30% 감소
- [ ] 직업 변경 쿨다운 24시간 작동
- [ ] 기존 직업 없는 유저의 기존 기능 정상 작동
```

---

# PHASE 2: 광물 & 자원 시스템 (Migration 081)

## 2.1 목적 및 근거

현재 Mining은 PP만 직접 산출한다. 이것만으로는:
- 마켓플레이스 거래 품목이 강화 코스메틱뿐
- 약자가 강자에게 팔 것이 없음
- 경제 순환의 핵심 고리 단절

광물 시스템 추가로:
- 약자(Miner)가 채굴한 자원 → 마켓에 판매 → USDT/GP 수익
- 강자(Crafter)가 자원 구매 → Enhancement에 활용 (또는 아이템 제작)
- 강자(Warrior)가 완제품 구매 → PvP 소비

## 2.2 자원 종류 (데이터 드리븐)

```sql
CREATE TABLE resources (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(30) UNIQUE NOT NULL,
  name_en         VARCHAR(50),
  name_ko         VARCHAR(50),
  name_ja         VARCHAR(50),
  name_zh         VARCHAR(50),
  rarity          VARCHAR(20) DEFAULT 'common', -- common/rare/special
  icon_emoji      VARCHAR(10),
  base_pp_value   DECIMAL(10,2) DEFAULT 1.0,    -- PP 환산 기준가
  is_tradeable    BOOLEAN DEFAULT TRUE,
  is_active       BOOLEAN DEFAULT TRUE
);
```

### 초기 자원 (9종)

| 코드 | 이름(EN) | 희귀도 | 아이콘 | 주 산출 섹터 |
|---|---|---|---|---|
| `iron_dust` | Iron Dust | common | 🟤 | Frontier/Mid |
| `red_sand` | Red Sand | common | 🔴 | Frontier |
| `basalt_chip` | Basalt Chip | common | ⬛ | Mid/Core |
| `ice_crystal` | Ice Crystal | rare | 🔵 | Frontier |
| `regolith_ore` | Regolith Ore | rare | 🟠 | Frontier |
| `volcanic_shard` | Volcanic Shard | rare | 🌋 | Frontier |
| `ancient_metal` | Ancient Metal | special | ⭐ | Frontier(극소) |
| `plasma_dust` | Plasma Dust | special | 💜 | POI 탐험 |
| `meteorite_fragment` | Meteorite Fragment | special | ☄️ | 로켓 이벤트 |

### 섹터별 자원 산출 확률 (settings 저장)

```sql
CREATE TABLE sector_resource_rates (
  id              SERIAL PRIMARY KEY,
  sector_type     VARCHAR(20) NOT NULL, -- 'core', 'mid', 'frontier'
  resource_code   VARCHAR(30) NOT NULL REFERENCES resources(code),
  base_rate       DECIMAL(5,4) NOT NULL, -- 0~1 확률
  miner_bonus     DECIMAL(5,4) DEFAULT 0, -- Miner 직업 추가 확률
  is_active       BOOLEAN DEFAULT TRUE,
  UNIQUE(sector_type, resource_code)
);
```

| 섹터 | Iron Dust | Red Sand | Basalt | Ice Crystal | Regolith | Volcanic | Ancient | Plasma |
|---|---|---|---|---|---|---|---|---|
| Frontier | 30% | 25% | 5% | 15% | 12% | 8% | 0.5% | 0% |
| Mid | 25% | 10% | 20% | 8% | 5% | 5% | 0.1% | 0% |
| Core | 15% | 5% | 30% | 2% | 2% | 1% | 0% | 0% |
| POI | - | - | - | - | - | - | 2% | 5% |
| 로켓 | - | - | - | - | - | - | 1% | - |

> Miner 직업은 희귀 자원 확률에 ×1.3 추가 적용

## 2.3 유저 인벤토리 (자원)

```sql
CREATE TABLE user_resource_inventory (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id),
  resource_id INT NOT NULL REFERENCES resources(id),
  quantity    INT DEFAULT 0,
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, resource_id)
);
```

## 2.4 Mining 동작 변경

**기존**: Mining → PP 직접 지급
**변경**: Mining → PP 지급(기존 유지) + 자원 드롭(추가)

```javascript
// services/mining.js 수정
async function processHarvest(userId, claimId) {
  // 기존 PP 지급 로직 유지 (100% 보존)
  const ppYield = calculatePPYield(userId, claimId);
  await awardPP(userId, ppYield);
  
  // ✅ 추가: 자원 드롭 (독립 로직, 기존에 영향 없음)
  const resources = await rollResourceDrop(userId, claimId);
  if (resources.length > 0) {
    await addResourcesToInventory(userId, resources);
    return { pp: ppYield, resources }; // 응답에 자원 포함
  }
  
  return { pp: ppYield, resources: [] };
}
```

## 2.5 마켓플레이스 연동

기존 마켓플레이스의 `item_type` 확장:

```sql
-- 기존: 'cosmetic', 'item', 'claim'
-- 추가: 'resource'
ALTER TABLE marketplace_listings 
  ADD COLUMN resource_code VARCHAR(30) REFERENCES resources(code),
  ADD COLUMN resource_quantity INT DEFAULT 1;
```

**거래 예시**: Miner가 `regolith_ore` 100개를 500 PP에 등록 → Crafter가 구매

## 2.6 Enhancement 연동 (선택적, Phase 2b)

Enhancement에 자원 소모 옵션 추가 (기존 GP 비용 외):

```yaml
강화 +7 이상 시도 시:
  기존: GP만 소모
  추가 옵션: GP + 특정 자원 소모 → 성공률 보너스
  예시:
    ice_crystal 5개 소모 → 성공률 +5%
    ancient_metal 1개 소모 → 파괴 방지 확률 +20%
```

## 2.7 Phase 2 성공 기준

```
- [ ] resources 테이블 + 9개 자원 데이터
- [ ] sector_resource_rates 테이블 + 확률 데이터
- [ ] user_resource_inventory 테이블
- [ ] Mining harvest 시 자원 드롭 추가 (PP 지급 유지)
- [ ] 마켓플레이스에 자원 타입 거래 가능
- [ ] 인벤토리 UI에 자원 섹션 추가
- [ ] Miner 직업 희귀 자원 보너스 적용 확인
```

---

# PHASE 3: 온보딩 튜토리얼 (Migration 082)

## 3.1 목적

신규 유저가 첫 10분 내에 이탈하지 않으려면:
- PP가 뭔지
- 영토를 왜 사야 하는지
- 첫 수익을 어떻게 내는지
- 나는 무엇을 해야 하는지

이 4가지를 **직접 플레이하면서** 학습해야 한다.

딥리서치 결과: Big Time·Pixels·Off The Grid 모두 온보딩에 가장 많은 리소스를 투입.
GAME_CONCEPT_REVIEW 9.1에 대표님도 체크하신 가장 취약한 고리.

## 3.2 온보딩 단계 설계

### Step 0: 랜딩 (가입 직후, 30초)

```
화면: 화성 글로브 배경 + 중앙 텍스트

"화성이 분열됐다.
 당신은 오늘 첫 발을 내딛는 식민지 개척자다."

[시작하기] 버튼 → Step 1
```

### Step 1: 첫 영토 점령 (2~3분)

```
튜토리얼 오버레이 표시:

"→ 저 빨간 구역이 당신의 첫 영토입니다"
   (Frontier 섹터의 특정 빈 영토를 하이라이트)
   
"클릭해서 점령하세요!"

→ 유저가 클릭하면 PP 차감 없이 무료 클레임 (튜토리얼 전용)
→ "영토를 점령했습니다! +10 XP"
→ 첫 이미지 업로드 유도 (건너뛰기 가능)
```

### Step 2: Mining 설명 (1분)

```
"이 영토는 시간마다 PP를 생성합니다"
"→ 4시간 후 [수확하기]를 누르면 PP가 쌓여요"

[지금 미리보기] → 0.1 PP 즉시 지급 (튜토리얼 보상)

"PP는 이 게임의 기본 화폐입니다
 영토를 더 사거나, 아이템을 구매하거나
 USDT로 교환할 수 있어요"
```

### Step 3: 직업 선택 (2분) — Level 5 전이어도 설명

```
"화성에는 4가지 생존 방식이 있습니다"

[광부] [전사] [제작자] [상인] 카드 표시

"Level 5가 되면 직업을 선택할 수 있어요
 지금은 게임을 탐험해보세요"

→ Level 5 미만이면 설명 후 다음 단계로
→ Level 5 이상이면 직업 선택 화면으로
```

### Step 4: 길드 가입 유도 (1분)

```
"화성에서 혼자는 살아남기 어렵습니다"

"길드에 가입하면:"
✓ 선배 플레이어의 도움을 받을 수 있어요
✓ 길드 섹터 버프를 받아요  
✓ 길드 전쟁에 참여해 더 많은 보상을

[길드 찾기] → 길드 검색 화면으로
[나중에 하기] → 건너뛰기 가능
```

### Step 5: 첫 미션 안내 (30초)

```
"매일 미션을 완료하면 GP와 XP를 받아요"

오늘의 미션 중 가장 쉬운 것 하이라이트:
예: "오늘 첫 수확하기 → 50 GP 보상"

[미션 보기] → Daily Missions 화면으로

"튜토리얼 완료! 🎉 +100 GP + 50 PP 지급"
```

## 3.3 DB 구조

```sql
-- 온보딩 진행 상태
CREATE TABLE user_onboarding (
  id              SERIAL PRIMARY KEY,
  user_id         INT UNIQUE NOT NULL REFERENCES users(id),
  current_step    INT DEFAULT 0,        -- 0~5
  completed       BOOLEAN DEFAULT FALSE,
  skipped_at      TIMESTAMP,
  completed_at    TIMESTAMP,
  tutorial_claim_id INT,                -- 튜토리얼 무료 클레임 ID
  created_at      TIMESTAMP DEFAULT NOW()
);
```

### settings 테이블 추가

```sql
INSERT INTO settings (key, value) VALUES
('onboarding_enabled', 'true'),
('onboarding_pp_reward', '50'),
('onboarding_gp_reward', '100'),
('onboarding_skip_allowed', 'true');
```

## 3.4 API

```
GET  /api/user/onboarding          → 현재 온보딩 상태
POST /api/user/onboarding/step     → 단계 완료 처리
POST /api/user/onboarding/skip     → 건너뛰기
POST /api/user/onboarding/restart  → 다시 시작 (선택사항)
```

## 3.5 성공 기준

```
- [ ] 신규 가입 유저에게 자동으로 온보딩 표시
- [ ] 5단계 흐름 완주 가능
- [ ] 각 단계에서 건너뛰기 가능 (skip_allowed 설정)
- [ ] 완료 시 PP + GP 보상 지급
- [ ] 튜토리얼 전용 무료 첫 클레임 (1회 한정)
- [ ] Admin에서 온보딩 완료율 통계 확인 가능
- [ ] 4개 언어 지원
```

---

# PHASE 4: 서사 엔진 (Migration 083)

## 4.1 목적

**플레이어 행동이 역사가 되어야 한다.**

EVE Online B-R5RB 전투는 언론에 퍼지며 수만 명의 신규 유저를 유입시켰다. 이 사건은 CCP가 만든 게 아니라 **플레이어가 만들고, CCP가 기록한** 것이다. Occupy Mars도 이 구조가 필요하다.

현재 문제:
- "💀 예원♥ hijacked ELYSIUM" 같은 이벤트가 Live Feed에 표시되지만 외부로 나가지 않음
- 섹터 역사가 기록되지 않음
- 유저들이 자신의 업적을 공유할 도구 없음

## 4.2 서사 씨앗 — 최소 구현 (1주일)

### 4.2.1 24섹터 Codex (텍스트 전용)

```sql
CREATE TABLE sector_lore (
  id              SERIAL PRIMARY KEY,
  sector_code     VARCHAR(30) UNIQUE NOT NULL,  -- 'olympus_crown' 등
  name_en         VARCHAR(50) NOT NULL,
  name_ko         VARCHAR(50),
  name_ja         VARCHAR(50),
  name_zh         VARCHAR(50),
  lore_en         TEXT,    -- 배경 설명 (각 200~300자)
  lore_ko         TEXT,
  lore_ja         TEXT,
  lore_zh         TEXT,
  sector_type     VARCHAR(20), -- 'core', 'mid', 'frontier'
  special_feature TEXT,        -- "최고 Mining 보너스", "역사적 전장" 등
  created_at      TIMESTAMP DEFAULT NOW()
);
```

**24섹터 네이밍 (IAU 공식 화성 지형, 저작권 없음)**

| 타입 | 섹터 이름 | 특징 |
|---|---|---|
| Core | Olympus Crown | 최대 정치 중심, Governor 세금 집중 |
| Core | Tharsis Citadel | 방어 버프 최강 |
| Core | Pavonis Gate | 주요 무역 허브 |
| Core | Ascraeus Vault | 아이템 상점 할인 |
| Core | Arsia Forge | 강화 비용 할인 |
| Core | Noctis Prime | 레퍼럴 보너스 |
| Mid | Marineris East | 기본 거래 지역 |
| Mid | Marineris West | Merchant 우세 지역 |
| Mid | Candor Fields | PP 생산 중간지대 |
| Mid | Ophir Station | 길드 구성 허브 |
| Mid | Hebes Crossing | 중립 무역 지점 |
| Mid | Coprates Ridge | Warrior 강화 지역 |
| Mid | Eos Plateau | 날씨 이벤트 집중 |
| Mid | Melas Basin | POI 풍부 지역 |
| Mid | Tithonium Scars | 배신의 땅 (PvP 다발) |
| Mid | Syria Planum | 안정적 수확 지역 |
| Frontier | Hellas Abyss | 최고 희귀 자원 확률 |
| Frontier | Elysium Wastes | 로켓 낙하 다발 |
| Frontier | Utopia Flats | 탐험 POI 최다 |
| Frontier | Arcadia Ridge | 신규 유저 추천 |
| Frontier | Cerberus Scars | 고위험 고수익 |
| Frontier | Phlegra Deep | 얼음 자원 집중 |
| Frontier | Amazonis Sink | 날씨 이벤트 없음 (안정) |
| Frontier | Borealis Edge | 신비 아이템 드롭 |

### 4.2.2 플레이어 서사 자동 기록

```sql
-- 서버 사건 기록
CREATE TABLE server_chronicles (
  id              SERIAL PRIMARY KEY,
  event_type      VARCHAR(50) NOT NULL,
  -- 'largest_hijack', 'longest_governor', 'biggest_guild_war',
  -- 'first_max_enhancement', 'sector_power_shift', 'bounty_claimed'
  actor_id        INT REFERENCES users(id),       -- 주인공 유저
  target_id       INT REFERENCES users(id),       -- 대상 유저
  guild_id        INT REFERENCES guilds(id),
  sector_code     VARCHAR(30),
  value           DECIMAL(20,8),                  -- 금액 또는 수치
  description_en  TEXT,
  description_ko  TEXT,
  description_ja  TEXT,
  description_zh  TEXT,
  occurred_at     TIMESTAMP DEFAULT NOW(),
  season_id       INT                             -- 시즌과 연결
);
```

**자동 기록되는 사건 타입:**

```javascript
// 사건 감지 및 기록 로직 (services/chronicle.js)

// 1. 사상 최대 Hijack 발생 시
if (hijackAmount > getCurrentRecord('largest_hijack')) {
  await recordChronicle('largest_hijack', {
    actor: attackerId,
    target: defenderId,
    sector: sectorCode,
    value: hijackAmount,
    description: `${attackerName} seized ${claimSize} pixels from ${defenderName} in ${sectorName}`
  });
}

// 2. Governor 최장 재임 (7일 돌파 시)
// 3. 길드전 최대 규모
// 4. Enhancement +10 최초 달성
// 5. 섹터 권력 이동 (Governor 교체)
// 6. 대형 Bounty 달성
```

### 4.2.3 Weekly Chronicle 자동 생성

```javascript
// 매주 월요일 UTC 00:00 실행
async function generateWeeklyChronicle(seasonId) {
  const stats = await collectWeeklyStats(); // 이번 주 통계
  
  // 챕터 자동 구성:
  // - 이번 주 최대 Hijack
  // - 권력 이동 (Governor 변경)
  // - 가장 활발한 섹터
  // - 길드 순위 변동
  // - 이번 주 첫 +10 달성자
  
  const chronicle = {
    week: getCurrentWeekNumber(),
    title: generateTitle(stats),        // "The Week of Crimson Dust" 등
    sections: buildSections(stats),
    top_player: stats.mostActivePLayer,
    top_guild: stats.largestGuild
  };
  
  await saveChronicle(chronicle);
  
  // Discord Webhook 발송 (settings: discord_webhook_url)
  await sendToDiscord(formatForDiscord(chronicle));
  
  // Telegram 발송 (기존 telegram 서비스 활용)
  await sendToTelegram(formatForTelegram(chronicle));
}
```

### 4.2.4 공개 API (서드파티 생태계 씨앗)

```
GET /api/public/stats              → 전체 게임 통계 (공개)
GET /api/public/sectors            → 24섹터 현황 (공개)
GET /api/public/leaderboard        → 상위 10 플레이어/길드 (공개)
GET /api/public/chronicles         → 최근 주간 Chronicle (공개)
GET /api/public/events/live        → SSE 실시간 이벤트 스트림 (공개)
```

**이 API가 공개되면**: 커뮤니티 팬들이 자발적으로 가격 트래커, 순위 사이트, Discord 봇을 만든다. EVE의 zKillboard·DOTLAN이 이 방식으로 탄생했다.

### 4.2.5 소셜 공유 기능

```javascript
// 내 영토 공유 카드 생성
// Canvas API로 마커 좌표 기반 화성 맵 스니펫 + 통계 생성

// 공유 URL: /share/claim/{claimId}
// OG 태그:
// - og:image → 내 영토 위치가 표시된 화성 지도 이미지
// - og:title → "나는 HELLAS ABYSS를 점령했다"
// - og:description → "Occupy Mars - 당신의 화성을 점령하세요"
```

## 4.3 Phase 4 성공 기준

```
- [ ] 24섹터 Lore 텍스트 DB 저장
- [ ] 섹터 정보 페이지에 Lore 표시
- [ ] server_chronicles 테이블 + 6가지 사건 자동 기록
- [ ] Weekly Chronicle 자동 생성 (월요일 스케줄러)
- [ ] Discord/Telegram 웹훅 자동 발송
- [ ] 공개 API 5개 구현
- [ ] 영토 공유 OG 카드 생성
- [ ] Admin에서 Chronicle 수동 생성 가능
```

---

# PHASE 5: Phase 4 옥션 (Migration 084, 기존 계획 유지)

> **기존 GAME_CONCEPT_REVIEW Phase 4 계획을 그대로 승계.**
> 직업 시스템·자원 시스템 완료 후 연결 포인트만 추가.

## 5.1 기존 계획 요약

- `auctions`, `bids` 테이블
- 입찰/환불/자동 정산
- 스나이핑 방지 (마감 5분 전 입찰 → 자동 연장)
- 만료 옥션 정산 스케줄러

## 5.2 직업 시스템 연동 추가

```javascript
// 기존 옥션 서비스에 추가
async function createAuction(userId, itemData, startPrice, duration) {
  // ✅ 추가: Merchant 옥션 수수료 할인
  const feeBuff = await jobService.getJobBuff(userId, 'merchant_market_fee', 1.0);
  const baseFee = await getSetting('auction_fee_rate'); // 예: 0.05
  const finalFee = baseFee * feeBuff;
  
  // ✅ 추가: 자원 타입 옥션 지원 (Phase 2 연동)
  // ...
}
```

## 5.3 옥션 거래 대상 확장

기존 계획 (코스메틱/아이템/클레임) + **자원 번들 옥션** 추가:
- "regolith_ore 500개 묶음 옥션" → 수집가/Crafter 대상

---

# PHASE 6: 영토 매매 비주얼 (Migration 085, 기존 계획 유지)

> **기존 GAME_CONCEPT_REVIEW Phase 5 계획 그대로.**
> 추가 사항만 기재.

## 6.1 서사 엔진 연동 추가

```javascript
// 클레임이 마켓에 등록될 때 서사 기록
async function listClaimForSale(userId, claimId, price) {
  // ... 기존 로직 ...
  
  // ✅ 추가: 고가 클레임 판매 시 Chronicle 기록
  if (price > await getSetting('chronicle_landmark_sale_threshold')) {
    await chronicleService.record('landmark_sale', {
      actor: userId,
      value: price,
      claimId
    });
  }
}
```

## 6.2 맵 UI 추가

- FOR SALE 마커 (기존 계획)
- 섹터 Lore 모달 연동: 클레임 클릭 → 해당 섹터 Lore 표시
- 자원 산출 확률 미리보기: "이 영토에서 Ice Crystal이 나올 수 있어요"

---

# PHASE 7: 강화 보호권 (Migration 086)

## 7.1 목적

현재 강화 시스템:
- +10 달성 확률이 매우 낮음 (누적 GP 수만 단위 필요)
- 10% 파괴 페널티 → 유저 이탈 원인
- **보호권 아이템이 없어 수익화 기회 누락**

Big Time·Lineage 모두 강화 보호권이 주요 매출원.

## 7.2 보호권 아이템 2종

### Protect Scroll (강화 보호권)
- **효과**: 강화 실패 시 레벨 하락 방지 (하락 40% 확률 → 0%)
- 파괴는 여전히 발생 (10%)
- **획득**: Item Shop GP 구매 / 마켓플레이스 거래
- **가격**: 500 GP (settings 조정 가능)

### Blessed Scroll (축복 보호권)
- **효과**: 강화 실패 시 파괴 방지 (파괴 10% → 0%) + 하락 방지
- 완전 보호
- **획득**: 프리미엄 (USDT 결제 또는 고가 GP)
- **가격**: 1,500 GP 또는 $2 USDT

## 7.3 DB 구조

```sql
-- 기존 Item Shop에 보호권 아이템 추가 (설정으로 관리)
-- 기존 enhancement 로직에 소모 아이템 체크 추가

ALTER TABLE item_instances
  ADD COLUMN item_effect_type VARCHAR(30); -- 'protect_scroll', 'blessed_scroll'

-- Enhancement 시도 시 보호권 소모 로직
-- services/enhancement.js에 3줄 추가
```

## 7.4 경제 효과 시뮬레이션

```
현재:
  +7 이상 시도 시 평균 파괴: 10%
  → 파괴 발생 → 유저 불만 + 다시 제작 비용

보호권 도입 후:
  유저: 파괴 불안 해소 → 강화 더 많이 시도
  → Blessed Scroll 2 USDT × 1,000명 = $2,000/월 추가 수익
  → GP Sink 역할도 동시 수행
```

---

# PHASE 8: 파벌 시스템 (Migration 087)

> **커뮤니티 규모 확장 후 구현. DAU 1,000 이상 시 도입 권장.**

## 8.1 설계

딥리서치 결과: 3파벌이 2파벌보다 인구 밸런스 유지에 안정적 (EVE·DAoC·Foxhole 사례).

### 파벌 3종

| 파벌 | 코드 | 특화 | 색상 | 주 거주 |
|---|---|---|---|---|
| **MCC** (Martian Corporate Consortium) | `mcc` | 경제/Mining | 🔵 파랑 | Core 6섹터 |
| **FSP** (Free Settlers' Pact) | `fsp` | 길드/PvP | 🟢 초록 | Mid 10섹터 |
| **CV** (Crimson Verdict) | `cv` | 은신/Bounty | 🔴 빨강 | Frontier 8섹터 |

### 파벌 버프 (직업 버프와 독립 적용, 중첩)

```yaml
MCC:
  - 경제 섹터 내 세금 감면 5%
  - USDT 입금 보너스 +2%

FSP:
  - 길드 Treasury 입금 +10%
  - 길드전 승리 보너스 +15%

CV:
  - Bounty 수령 +20%
  - Frontier 섹터 Mining +10%
  - Hijack 은신 성공 (탐지 확률 감소)
```

### 파벌 선택 규칙

```yaml
선택 시점: 튜토리얼 완료 후 또는 Level 10
변경: 30일 1회 (긴 쿨다운으로 소속감 유지)
비용: 파벌 변경 500 GP (이탈 패널티)
중립: 파벌 미선택 유지 가능 (버프 없음)
```

## 8.2 파벌 전쟁

```yaml
주간 파벌 전쟁 이벤트 (토요일 UTC 20:00~22:00):
  - 3파벌이 동시에 특정 섹터(중립 섹터) 점령 경쟁
  - 2시간 동안 최다 픽셀 보유 파벌 승리
  - 승리 파벌: 해당 섹터 1주일 세금 면제 + 파벌원 전체 Mining +20%
  - 패배 파벌: 정상 상태
  - 결과는 Weekly Chronicle에 자동 기록
```

---

# PHASE 9: Reinforcement Timer (Migration 088)

> **커뮤니티가 성숙한 후 구현. 파벌 시스템 완료 후 도입.**

## 9.1 목적

EVE Online의 핵심 서사 장치.
"예약된 결전"이 없으면 창발적 서사가 발생하지 않는다.

## 9.2 설계

```yaml
Reinforcement Timer:
  발동: 고가치 영토(X PP 이상) Hijack 시도 시
  효과:
    - 즉시 Hijack 불가
    - 수비자에게 알림: "48시간 내 방어 준비하세요"
    - 48시간 후 결전 시간 (1시간 창) 자동 설정
  결전 시간:
    - 해당 창 내 공격자가 재시도해야 Hijack 성공
    - 창 안에 재시도 없으면 Hijack 취소 + 수비자 유지
  임계값: settings('reinforcement_threshold_pp') 로 조정
```

---

# PHASE 10: 시즌 경제 리셋 (Migration 089)

## 10.1 목적

- PP 인플레이션 누적 방지
- 신규 유저 따라잡기 기회 제공
- 시즌 종료 이벤트 = 자연스러운 마케팅 사이클

## 10.2 리셋 범위 (부분 리셋)

```yaml
리셋 O (초기화):
  - 섹터 점수 / 시즌 랭킹
  - Governor 임시 버프 (3위 이내 시즌 보상)
  
리셋 X (영구 유지):
  - 영토 소유권 (자산은 보존)
  - 강화된 코스메틱 아이템
  - 직업 선택
  - PP/GP/USDT 잔고

조정 O (분기 밸런싱):
  - Mining 기본 수익률 (인플레이션 대응)
  - 강화 비용 곡선
  - 직업별 버프 수치
```

---

# 경제 밸런싱 대시보드

> Admin 패널에 추가될 모니터링 지표

## Sink/Faucet 모니터링

```sql
-- 일일 PP 발행량 뷰
CREATE OR REPLACE VIEW daily_pp_faucet AS
SELECT
  DATE(created_at) AS date,
  SUM(CASE WHEN type='harvest' THEN amount END) AS harvest_pp,
  SUM(CASE WHEN type='mission' THEN amount END) AS mission_pp,
  SUM(CASE WHEN type='referral' THEN amount END) AS referral_pp,
  SUM(CASE WHEN type='deposit_bonus' THEN amount END) AS deposit_pp,
  SUM(amount) AS total_faucet
FROM transactions
WHERE currency='PP' AND amount > 0
GROUP BY DATE(created_at);

-- 일일 PP 소각량 뷰
CREATE OR REPLACE VIEW daily_pp_sink AS
SELECT
  DATE(created_at) AS date,
  SUM(CASE WHEN type='claim' THEN ABS(amount) END) AS claim_sink,
  SUM(CASE WHEN type='hijack' THEN ABS(amount) END) AS hijack_sink,
  SUM(CASE WHEN type='swap_fee' THEN ABS(amount) END) AS swap_fee_sink,
  SUM(CASE WHEN type='bounty_fee' THEN ABS(amount) END) AS bounty_fee_sink,
  SUM(ABS(amount)) AS total_sink
FROM transactions
WHERE currency='PP' AND amount < 0
GROUP BY DATE(created_at);
```

## 경고 임계치 (settings)

```sql
INSERT INTO settings (key, value, description) VALUES
('economy_alert_sink_faucet_min', '0.80', 'Sink/Faucet 비율 경고 임계치'),
('economy_alert_sink_faucet_critical', '0.60', 'Sink/Faucet 비율 위험 임계치'),
('economy_alert_avg_balance_growth', '0.20', '평균 잔고 주간 성장률 경고 (20%)'),
('marketplace_listing_fee_gp', '10', '마켓 등록비 GP (기존 2→10 상향 권장)');
```

---

# 보안 체크리스트 (런칭 전)

> GAME_CONCEPT_REVIEW 9.6 기반 + 딥리서치 추가

## Critical (반드시 완료)

```
[ ] USDT 인출 로직 재검토
    - 서버 서명 키 HSM 또는 AWS KMS 격리
    - 일일 인출 한도 설정 (settings: daily_withdrawal_limit_usdt)
    - 이상 패턴 감지 (단시간 대량 인출 시 수동 승인)
    - 콜드월렛 70% / 핫월렛 30% 분리 권장

[ ] Cantina RNG 검증
    - Provably Fair 구현 (client seed + server seed hash + nonce)
    - 또는 외부 VRF 활용
    - 현재 서버 RNG만이면 "조작 의혹" 커뮤니티 이슈 불가피

[ ] Hijack/Enhancement 동시성 처리
    - 같은 클레임에 동시 Hijack 시도 시 race condition
    - DB 트랜잭션 SERIALIZABLE 격리 수준 확인

[ ] 마켓플레이스 에스크로 검증
    - 에스크로 → 구매 → 정산 흐름 원자성 보장
    - 서버 다운 시 에스크로 자산 복구 절차

[ ] Rate Limiting
    - Harvest API: 유저당 4시간에 1회
    - Hijack API: 유저당 분당 5회
    - 마켓 등록: 유저당 시간당 20회

[ ] Input Validation
    - 모든 amount 파라미터 음수 입력 차단
    - SQL Injection 전수 점검
    - 마켓 가격 상한 (settings: marketplace_max_price)

[ ] 인증/세션
    - JWT 만료 시간 적절성 확인
    - Refresh Token 탈취 방지
    - 지갑 서명 검증 로직 재확인
```

## High

```
[ ] 봇 탐지
    - Harvest 정확히 4시간마다 실행하는 계정 패턴 감지
    - 동일 IP 다중 계정 제한
    - 비정상 트랜잭션 패턴 알림

[ ] 마켓플레이스 조작 방지
    - 자기 자신에게 판매 (wash trading) 차단
    - 가격 조작 패턴 감지

[ ] GDPR/개인정보
    - 이메일 암호화 저장
    - 데이터 삭제 요청 처리 절차
    - 지갑 주소 + 이메일 연결 데이터 보호
```

---

# Claude Code 작업 가이드

## 이 문서를 받은 Claude Code에게

**작업 시작 전 반드시:**

1. 현재 `users` 테이블 컬럼 전체 확인
2. 현재 `settings` 테이블 키 목록 확인
3. Mining/Harvest 처리 함수 파일 위치 확인
4. Hijack 처리 함수 파일 위치 확인
5. `services/enhancement.js` 함수 구조 확인
6. `services/marketplace.js` 함수 구조 확인

**작업 완료 후 반드시:**
- 변경/생성 파일 목록 제시
- 롤백 SQL 제시
- 테스트 방법 3가지 이상 제시
- 기존 기능 영향 여부 명시

## 작업 분할 원칙

```
❌ "Phase 1 전체 구현해줘"
✅ "Phase 1의 DB 마이그레이션만 먼저"
✅ "job.js 서비스 파일 생성 (DB 연결 없이 함수 구조만)"
✅ "Mining 함수에 getJobBuff 1줄만 추가"
```

## 하드코딩 금지 예시

```javascript
// ❌ 절대 금지
const MINER_BUFF = 1.5;
if (job === 'miner') yield *= 1.5;

// ✅ 올바른 방식
const buff = await jobService.getJobBuff(userId, 'miner_mining_rate', 1.0);
yield *= buff;
```

## 성능 고려사항

직업 버프는 Mining/Harvest/Hijack 등 빈번한 API에서 호출된다.
**반드시 캐싱 구현:**

```javascript
// 유저의 직업 버프는 10분 메모리 캐시
const jobBuffCache = new Map(); // key: `${userId}:${buffKey}`, value: {value, expiresAt}

async function getJobBuff(userId, buffKey, defaultValue = 1.0) {
  const cacheKey = `${userId}:${buffKey}`;
  const cached = jobBuffCache.get(cacheKey);
  
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  
  // DB 조회
  const result = await db.query(`
    SELECT jb.buff_value 
    FROM users u
    JOIN job_buffs jb ON jb.job_id = u.current_job_id
    WHERE u.id = $1 AND jb.buff_key = $2
  `, [userId, buffKey]);
  
  const value = result.rows.length > 0 
    ? parseFloat(result.rows[0].buff_value) 
    : defaultValue;
  
  // 10분 캐시
  jobBuffCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + 10 * 60 * 1000
  });
  
  // 직업 변경 시 캐시 무효화 필요 (selectJob 함수에서 처리)
  
  return value;
}
```

---

# 완성도 예측

| 항목 | 현재 | Phase 1 후 | Phase 1~4 후 |
|---|:---:|:---:|:---:|
| 경제 순환 | 75% | 88% | 95% |
| 약자 콘텐츠 | 20% | 60% | 80% |
| 신규 유저 경험 | 10% | 15% | 75% |
| 바이럴 잠재력 | 15% | 15% | 70% |
| 수익화 | 70% | 75% | 85% |
| **종합** | **60%** | **75%** | **85%** |

> 85% 이상 달성 후 마케팅 시작 = 6~12개월 강한 수익 목표 현실적

---

*문서 끝. 이 기획서는 살아있는 문서입니다. 구현하면서 발견되는 문제는 즉시 이 문서에 반영하세요.*
