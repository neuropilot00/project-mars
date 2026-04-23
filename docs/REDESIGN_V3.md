# OCCUPY MARS — 게임성 재설계 기획서 v3.0
> **"버려야 할 것은 버리고, 서사와 재미를 잡는다"**
> 작성일: 2026-04-24 | 대상: Claude Code 구현 전용
> 기준: Migration 079 완료 상태

---

## 이 문서를 읽는 Claude Code에게

이 문서는 **게임성 재설계** 지침서다.
기존 기능 중 일부를 **제거하거나 대폭 수정**하는 내용이 포함된다.
모든 수정은 명확한 근거와 함께 제시된다.

**작업 원칙:**
1. 제거 항목은 DB 컬럼을 바로 DROP하지 말고 `is_active=false` 처리 후 1개월 후 정리
2. 모든 수치는 `settings` 테이블 저장 (하드코딩 절대 금지)
3. 기존 마이그레이션(001~079) 절대 수정 금지
4. 각 Phase 완료 후 변경 파일 목록, 롤백 SQL, 테스트 방법 제시

---

# PART 0. 핵심 진단

## 0.1 지금 이 게임의 본질적 문제

게임을 한 줄로 설명하라고 하면:
**"USDT 넣고 영토 사서 채굴하다가 빼앗기는 게임"**

이것만으로는 유저가 **홍보하고 싶은 이야기**가 없다.

EVE가 바이럴 된 이유: *"내가 2,000명 전투에서 $300K짜리 함선을 잃었다"*
리니지가 바이럴 된 이유: *"우리 혈맹이 DK를 무너뜨렸다"*
Occupy Mars가 바이럴 되려면: *"내가 Hellas Abyss 거버너를 배신으로 쓰러뜨렸다"*

**지금 이 게임에는 그 이야기가 발생하는 구조가 없다.**

## 0.2 게임성 체크 — 유저가 충분히 참여했을 때 가능한가

질문: "유저가 충분히 참여했을 때 EVE/리니지처럼 되는가?"

답: **구조적으로 가능하다. 단 3가지 조건이 맞아야 한다.**

| 조건 | 현재 상태 | 필요 작업 |
|---|---|---|
| ① 권력이 실질적이어야 한다 | ⚠️ Governor 세금 있지만 권력이 약함 | Governor 권한 대폭 강화 |
| ② 손실이 진짜여야 한다 | ✅ Hijack 시 영토 소실 | Reinforcement Timer 추가 |
| ③ 이야기가 밖으로 나가야 한다 | ❌ 공유 메커니즘 없음 | Chronicle + 공개 API |

## 0.3 버릴 것 / 수정할 것 / 남길 것

### ❌ 버릴 것 (게임성에 해롭거나 산만한 것)

| 항목 | 이유 |
|---|---|
| Cantina 5종 미니게임 (Crash/Mines/Coinflip/Dice/Hi-Lo) | 게임을 카지노처럼 보이게 만듦. 서사와 무관. 진지한 전략 게이머를 쫓아냄. |
| 날씨 이벤트 (채굴률 버프/디버프) | 랜덤 요소가 전략성을 방해. 서사에 기여 없음. 개발 비용 대비 효과 낮음. |
| Arcade 미니게임 3종 (Invaders/Runner/Digger) | 핵심 루프와 완전히 단절. 화성 영토 게임과 무관한 장르. |
| 레퍼럴 3-tier (deposit에서 PP 지급) | 입금 기반 레퍼럴은 폰지 구조로 보임. 커뮤니티 신뢰 훼손. |

### ⚠️ 대폭 수정할 것

| 항목 | 현재 문제 | 수정 방향 |
|---|---|---|
| Governor 시스템 | 권한이 약해서 싸울 이유가 없음 | 권한 5배 강화 (하단 상세) |
| 코어 루프 (Mining → Harvest) | 4시간 대기 → 클릭 → 반복. 지루함 | 능동적 선택 추가 |
| 길드 시스템 | 채팅만 있고 집단 목표 없음 | 길드 영토·분업·Guild Contract 추가 |
| Cantina | 전면 제거 후 → 전략적 베팅으로 교체 | Territory War 베팅 시스템으로 전환 |
| 마켓플레이스 등록비 | 2 GP → 스팸 방지 불가 | 10 GP + 동적 요금으로 수정 |

### ✅ 남길 것 (잘 만들어진 것)

| 항목 | 이유 |
|---|---|
| 영토 점령 / Hijack 구조 | 핵심 루프. 전략성의 원천. |
| Enhancement +0~+10 | 장기 목표 제공. GP Sink 역할. |
| Marketplace (고정가) | 경제 순환의 핵심. |
| Guild War 기반 구조 | 집단 서사의 기반. |
| Season Pass (30일) | 주기적 참여 유도. |
| Daily Missions | 일일 루틴 형성. |
| 4개 언어 i18n | 글로벌 타겟팅. |
| Admin 설정 시스템 | 데이터 드리븐 운영의 핵심. |

---

# PART 1. 제거 작업 (Migration 080)

## 1.1 Cantina 5종 미니게임 제거

### 왜 버리는가

Cantina는 현재 게임에서 **정체성 분열**을 일으킨다.

전략 MMO를 기대하고 온 유저가 카지노를 보는 순간:
- Web3 네이티브: "또 폰지 카지노네"
- 전통 MMO 유저: "이게 게임이야 도박장이야"

딥리서치 결과: Off The Grid·Big Time·Pixels 모두 게임 정체성을 하나로 좁혔을 때 성공.
분산된 정체성은 어떤 타겟에도 강하게 소구하지 못한다.

### 제거 범위

```sql
-- 비활성화 처리 (즉시 DROP 하지 않음)
UPDATE settings SET value = 'false' WHERE key = 'cantina_enabled';

-- 프론트엔드: Cantina 탭 hidden 처리
-- routes/cantina.js: 모든 엔드포인트에 미들웨어 추가
-- "Cantina is temporarily closed for maintenance" 메시지
```

### 대체: Territory War 베팅 (하단 Part 3에서 상세)

Cantina의 GP 소각 역할은 **Territory War 베팅**으로 대체한다.
- 순수 운에 의존하는 도박 → 전략적 판단 기반 베팅
- 게임 서사와 직결 (내가 아는 길드가 이길 것 같다 → 베팅)

---

## 1.2 Arcade 미니게임 3종 제거

### 왜 버리는가

Invaders, Runner, Digger — 이 세 게임은 Occupy Mars와 **장르가 다른 별개의 게임**이다.
개발 리소스를 쓰면서 핵심 경험을 희석시킨다.
화성 영토 전략 게임을 플레이하러 온 유저가 Invaders를 하는 이유가 없다.

### 제거 범위

```sql
UPDATE settings SET value = 'false' WHERE key = 'arcade_enabled';
-- 프론트엔드: ARCADE 탭 제거
-- 관련 API 비활성화
```

---

## 1.3 날씨 이벤트 시스템 축소

### 왜 수정하는가

날씨 이벤트(모래폭풍 등)의 현재 역할: **채굴률 랜덤 버프/디버프**

문제:
- 전략적 선택이 아닌 랜덤 요소
- 유저가 통제할 수 없는 외부 변수 → 불쾌감
- 서사에 기여하지 않음

### 수정 방향: 서사 장치로 전환

날씨는 **랜덤 버프/디버프 → 서사적 이벤트 신호**로 전환한다.

```yaml
기존:
  모래폭풍 발생 → 채굴 -30% (랜덤, 플레이어 통제 불가)

수정 후:
  모래폭풍 예보 발령 → 48시간 후 발생 (예고)
  → 발생 중 (6시간):
    - Hijack 비용 -20% (공격자 유리 → 전략적 공격 타이밍)
    - 방어 아이템 효과 -15%
    - 희귀 자원 드롭률 +30% (위험 감수 = 고수익)
  → 결과: 모래폭풍 기간에 일어난 사건이 Chronicle에 기록
           "Hellas Abyss 모래폭풍 속 대규모 공격 발생"
```

**핵심 변경**: 랜덤 불운 → 예고된 전략 기회.
유저가 날씨를 보고 "지금 공격해야겠다" 또는 "지금 방어를 강화해야겠다" 판단 가능.

---

## 1.4 레퍼럴 구조 수정

### 왜 수정하는가

현재: 입금(USDT deposit) 시 레퍼럴 PP 지급

문제:
- 입금 기반 레퍼럴 = "돈 넣으면 돈 나눠주는" 폰지 구조로 보임
- Web3 커뮤니티에서 즉각 "MLM" 낙인
- 실제 게임 플레이와 무관한 수익 창출

### 수정 방향

```yaml
제거:
  - deposit 기반 레퍼럴 PP 지급
  - 3-tier 중 Tier 2, Tier 3 (다단계 구조 제거)

유지/수정:
  Tier 1만 유지:
    - 추천인이 게임플레이 (Hijack, Harvest, 마켓 거래) 시 소량 GP 지급
    - 입금 기반 X → 게임 활동 기반 O
    - 비율: 게임 활동 보상의 5% (settings 조정)

이유:
  - 1-tier 구조는 MLM 오해 없음
  - 게임 활동 기반이라 실제 플레이어 유입 인센티브
  - "내 친구가 열심히 하면 나도 조금 받는다" = 자연스러운 소셜 동기
```

---

# PART 2. Governor 시스템 대폭 강화 (Migration 081)

## 2.1 왜 Governor가 핵심인가

리니지에서 성주 자리는 **실질적인 권력**이다. 세금으로 혈맹을 먹여 살리고, 공성전으로 지위를 지킨다. 그래서 싸운다.

현재 Occupy Mars의 Governor는:
- 세금 징수 가능 → 버프/아이템만 구매 가능
- 전쟁/평화 선포 가능
- Mining 보너스 설정 가능

**충분하지 않다.** Governor 자리를 차지하면 얼마나 좋은가? 의 답이 약하다.
강해야 도전자가 나타나고, 도전자가 있어야 서사가 생긴다.

## 2.2 Governor 권한 강화 설계

### 추가 권한 1: 섹터 입장 통제

```yaml
Governor 신규 권한:
  섹터 입장 정책 설정 (1일 1회 변경 가능):
    - OPEN: 누구나 영토 구매 가능 (기본)
    - ALLY_ONLY: 동맹 길드만 신규 영토 구매 가능
    - CLOSED: 기존 거주자만 유지 (신규 구매 불가)

  효과:
    - ALLY_ONLY/CLOSED 설정 시 → 비동맹 유저들의 분노 → 도전 동기
    - 너무 폐쇄적이면 → 세수 감소 (거주자 감소) → Governor의 딜레마
```

### 추가 권한 2: 섹터 세율 범위 확대

```yaml
기존: 세율 0~2% (너무 낮아서 의미 없음)
수정: 세율 0~10%

0%: 인기 정책, 거주자 증가, 하지만 수입 없음
5%: 균형
10%: 단기 고수입, 하지만 거주자 이탈 + 반란 압력

settings:
  governor_max_tax_rate: 10
  governor_min_tax_rate: 0
```

### 추가 권한 3: 섹터 현상금 게시

```yaml
Governor 전용 권한:
  섹터 내 특정 유저에게 현상금 게시
  → 세금 수입 일부를 현상금으로 사용
  → 섹터 주민들이 현상금 사냥에 참여
  → Governor가 "사병"을 세금으로 운용하는 구조
```

### 추가 권한 4: Governor 공개 선언문

```yaml
Governor 선언문 시스템:
  - 하루 1회 섹터 전체에 공개 메시지 게시 가능
  - 길이 제한: 280자 (Twitter급)
  - 언어: 자유
  - 모든 섹터 주민에게 알림

  서사 효과:
    "Hellas Abyss Governor KimWarrior: 세율 10% 인상. 불만 있으면 도전해."
    → 주민 반응 → 반란 조직화 → 서사 발생
```

### 추가 권한 5: Governor 보상 강화

```yaml
Governor 자리의 실질 가치:
  현재: 세금 수입 (버프/아이템만 사용 가능)
  추가:
    - 섹터 내 모든 마켓 거래의 1% 자동 귀속 (settings: governor_market_cut)
    - 주간 시즌 포인트 2배 획득
    - Governor 전용 칭호 + 프로필 배지 (영구 기록)
    - Weekly Chronicle에 Governor 이름 자동 포함
```

## 2.3 Governor 도전 메커니즘 강화

### 현재 구조의 문제

현재: "섹터에서 가장 많은 영토를 보유하면 Governor"
→ 고래가 한번 자리 잡으면 영원히 유지 가능

### Reinforcement Timer 도입

```yaml
Governor Siege 시스템:

1단계 - 도전 선언:
  조건: 섹터 내 영토 3개 이상 보유 (설정값)
  방법: "Governor 도전 선언" 버튼 클릭
  비용: 100 GP (settings: siege_declaration_cost)
  공개: 모든 섹터 주민에게 공지 + Discord Webhook 발송

2단계 - 대기 기간 (48시간):
  - 현 Governor에게 48시간 방어 준비 시간
  - 도전자도 동맹 모집 시간
  - 이 기간이 서사가 만들어지는 시간
  - 관전자들이 베팅 가능 (Territory War Betting)

3단계 - 결전 (24시간 창):
  - 결전 기간 동안 영토 구매 비용 -30% (대규모 이동 유도)
  - 종료 시점 기준 최다 영토 보유자가 새 Governor
  - 기존 Governor가 유지하면 도전자 GP 50% 환불
  - 새 Governor 탄생 시 Chronicle 자동 기록

4단계 - 결과 처리:
  - Chronicle에 전투 기록 (참여 유저 수, 거래된 PP 총량, 승자)
  - Discord/Telegram 자동 발송
  - Hall of Fame에 역대 Governor 목록 누적
```

## 2.4 DB 수정

```sql
-- governors 테이블 (기존 있으면 컬럼 추가)
ALTER TABLE governance_settings ADD COLUMN IF NOT EXISTS
  sector_policy VARCHAR(20) DEFAULT 'open',     -- 'open', 'ally_only', 'closed'
  declaration_text TEXT,                         -- Governor 선언문
  declaration_updated_at TIMESTAMP,
  market_cut_rate DECIMAL(5,4) DEFAULT 0.01,    -- 마켓 거래 자동 귀속 비율
  total_pp_earned DECIMAL(20,8) DEFAULT 0;      -- 누적 수입 (서사용)

-- Governor Siege 테이블
CREATE TABLE governor_sieges (
  id              SERIAL PRIMARY KEY,
  sector_code     VARCHAR(30) NOT NULL,
  challenger_id   INT NOT NULL REFERENCES users(id),
  defender_id     INT NOT NULL REFERENCES users(id),  -- 현 Governor
  status          VARCHAR(20) DEFAULT 'pending',
  -- 'pending'(선언), 'active'(결전중), 'resolved'(완료), 'cancelled'
  gp_cost         INT NOT NULL,
  declared_at     TIMESTAMP DEFAULT NOW(),
  siege_starts_at TIMESTAMP,    -- 선언 후 48시간
  siege_ends_at   TIMESTAMP,    -- siege_starts_at + 24시간
  winner_id       INT REFERENCES users(id),
  pp_volume       DECIMAL(20,8) DEFAULT 0,  -- 결전 기간 거래 PP 총량 (서사용)
  participant_count INT DEFAULT 0,
  resolved_at     TIMESTAMP
);

-- Hall of Fame (역대 Governor)
CREATE TABLE governor_hall_of_fame (
  id              SERIAL PRIMARY KEY,
  user_id         INT NOT NULL REFERENCES users(id),
  sector_code     VARCHAR(30) NOT NULL,
  started_at      TIMESTAMP NOT NULL,
  ended_at        TIMESTAMP,
  duration_days   INT,
  total_tax_earned DECIMAL(20,8),
  how_lost        VARCHAR(50),  -- 'siege', 'voluntary', 'still_active'
  notable_events  TEXT          -- JSON: 재임 중 주요 사건
);

-- settings 추가
INSERT INTO settings (key, value, description) VALUES
('governor_max_tax_rate', '10', 'Governor 최대 세율 (%)'),
('governor_market_cut', '0.01', 'Governor 마켓 거래 자동 귀속 비율'),
('siege_declaration_cost', '100', '도전 선언 GP 비용'),
('siege_warning_hours', '48', '도전 선언 후 대기 시간'),
('siege_battle_hours', '24', '결전 지속 시간'),
('siege_min_territories', '3', '도전 가능 최소 영토 수');
```

---

# PART 3. 서사 엔진 구축 (Migration 082)

## 3.1 왜 서사 엔진이 커뮤니티 확장성의 핵심인가

**유저가 홍보하고 싶게 만드는 게임성의 정체는 "자랑할 이야기"다.**

- "나 어제 Hellas에서 Governor 쓰러뜨렸어" → Discord에 공유
- "우리 길드가 역대 최대 Siege 이겼어" → 스크린샷 공유
- "나 Enhancement +10 최초 달성했어" → 자랑

이 이야기가 외부로 나가는 구조가 없으면 아무리 극적인 사건이 일어나도 게임 안에서만 사라진다.

**커뮤니티 확장성의 원리:**
```
플레이어 행동 → 사건 발생 → 자동 기록 → 외부 발송 → 새 유저 유입
     ↑___________________________________________________|
```

## 3.2 플레이어 서사 자동 기록 시스템

### DB 구조

```sql
CREATE TABLE server_chronicles (
  id              SERIAL PRIMARY KEY,
  event_type      VARCHAR(50) NOT NULL,
  actor_id        INT REFERENCES users(id),
  target_id       INT REFERENCES users(id),
  guild_id        INT REFERENCES guilds(id),
  sector_code     VARCHAR(30),
  value_pp        DECIMAL(20,8),
  value_usdt      DECIMAL(20,8),
  participant_count INT,
  title_en        VARCHAR(200),
  title_ko        VARCHAR(200),
  title_ja        VARCHAR(200),
  title_zh        VARCHAR(200),
  description_en  TEXT,
  description_ko  TEXT,
  description_ja  TEXT,
  description_zh  TEXT,
  is_public       BOOLEAN DEFAULT TRUE,
  occurred_at     TIMESTAMP DEFAULT NOW(),
  season_id       INT
);
```

### 자동 기록 이벤트 14종

```javascript
// services/chronicle.js

const CHRONICLE_EVENTS = {

  // 1. Governor 교체
  'governor_overthrown': {
    trigger: 'siege resolved, new governor',
    title: (data) => `${data.winner} seizes ${data.sector} from ${data.loser}`,
    threshold: null,  // 항상 기록
    webhook: true
  },

  // 2. 최대 규모 Siege
  'siege_record_participants': {
    trigger: 'siege resolved',
    title: (data) => `${data.participants} colonists clash in ${data.sector}`,
    threshold: 'settings.chronicle_siege_min_participants',  // 기본 10명
    webhook: true
  },

  // 3. 단일 최대 Hijack
  'largest_hijack': {
    trigger: 'hijack completed',
    title: (data) => `${data.attacker} seized ${data.pixels}px for ${data.pp} PP`,
    threshold: 'settings.chronicle_hijack_min_pp',  // 기본 1000 PP
    webhook: true
  },

  // 4. Enhancement +10 달성
  'max_enhancement_achieved': {
    trigger: 'enhancement level 10 reached',
    title: (data) => `${data.user} achieves +10 ${data.item_name} — first of its kind`,
    threshold: null,  // 최초 달성만 기록 (이후는 TOP 10으로)
    webhook: true
  },

  // 5. Governor 최장 재임 마일스톤
  'governor_milestone': {
    trigger: 'governor duration check (daily)',
    milestones: [7, 30, 90],  // 일 단위
    title: (data) => `${data.governor} rules ${data.sector} for ${data.days} days`,
    webhook: false  // Discord 피로도 방지
  },

  // 6. 모래폭풍 기간 대규모 공격
  'storm_offensive': {
    trigger: 'hijack during weather event',
    title: (data) => `${data.attacker} strikes ${data.sector} under cover of dust storm`,
    threshold: 'settings.chronicle_storm_min_pp',
    webhook: true
  },

  // 7. 길드 첫 섹터 지배 (섹터 내 50% 이상)
  'guild_sector_dominance': {
    trigger: 'guild territory check',
    title: (data) => `[${data.guild_tag}] claims dominance over ${data.sector}`,
    threshold: 0.50,  // 50% 이상
    webhook: true
  },

  // 8. 대형 Bounty 달성
  'massive_bounty_claimed': {
    trigger: 'bounty claimed',
    title: (data) => `${data.hunter} collects ${data.amount} PP bounty on ${data.target}`,
    threshold: 'settings.chronicle_bounty_min_amount',
    webhook: false
  },

  // 9. 신규 유저 첫 Governor (뉴비 서사)
  'underdog_governor': {
    trigger: 'governor seat changes',
    condition: 'new governor account_age < 30 days',
    title: (data) => `Newcomer ${data.governor} stuns veterans, takes ${data.sector}`,
    webhook: true
  },

  // 10. Governor 선언문 (공개 도발)
  'governor_declaration': {
    trigger: 'declaration posted',
    title: (data) => `${data.governor} of ${data.sector}: "${data.text.slice(0,50)}..."`,
    webhook: false  // 텔레그램만
  },

  // 11. 시즌 종료 종합
  'season_ended': {
    trigger: 'season auto-close',
    title: (data) => `Season ${data.season} ends — ${data.mvp} leads all colonists`,
    webhook: true,
    special: 'full_report'  // 상세 보고서 생성
  },

  // 12. 마켓 역대 최고가 거래
  'record_market_sale': {
    trigger: 'marketplace purchase',
    title: (data) => `${data.item} sells for record ${data.price} GP`,
    threshold: 'settings.chronicle_market_record_threshold',
    webhook: false
  },

  // 13. 고래 vs 연합 서사
  'coalition_victory': {
    trigger: 'siege resolved',
    condition: 'winner is non-Governor alliance of 5+ guilds',
    title: (data) => `Coalition of the weak rises — ${data.sector} falls to the people`,
    webhook: true
  },

  // 14. 직업별 최고 수익자 (주간)
  'weekly_top_by_job': {
    trigger: 'weekly chronicle generation',
    title: (data) => `This week's top ${data.job}: ${data.user} with ${data.earnings} PP`,
    webhook: false
  }
};
```

## 3.3 Weekly Chronicle 자동 생성

```javascript
// 매주 월요일 UTC 00:00 실행
// services/chronicle.js

async function generateWeeklyChronicle() {
  const stats = await collectWeeklyStats();

  // 주간 가장 중요한 사건 Top 5 선별
  const topEvents = await getTopChronicleEvents(7); // 최근 7일

  const chronicle = {
    week_number: getWeekNumber(),
    season_week: getCurrentSeasonWeek(),

    // 헤드라인 (가장 극적인 사건)
    headline: topEvents[0],

    // 섹션별 집계
    sections: {
      power_shifts: topEvents.filter(e => e.type.includes('governor')),
      biggest_battles: topEvents.filter(e => e.type.includes('siege', 'hijack')),
      economic: topEvents.filter(e => e.type.includes('market', 'bounty')),
      achievements: topEvents.filter(e => e.type.includes('enhancement', 'milestone'))
    },

    // 랭킹
    rankings: {
      top_attacker: stats.topHijacker,     // 이번 주 최다 Hijack
      top_defender: stats.topDefender,     // 이번 주 방어 최다
      top_earner: stats.topEarner,         // PP 수익 1위
      top_crafter: stats.topEnhancer,      // 강화 시도 1위
      hottest_sector: stats.hottestSector  // 가장 활발한 섹터
    }
  };

  // 저장
  await saveWeeklyChronicle(chronicle);

  // Discord Webhook 발송
  const discordMsg = formatChronicleForDiscord(chronicle);
  await sendDiscordWebhook(discordMsg);

  // Telegram 발송
  await sendTelegramMessage(formatChronicleForTelegram(chronicle));

  // In-game Live Feed에 공지
  await postToLiveFeed('weekly_chronicle', chronicle.headline);
}
```

## 3.4 공개 API — 서드파티 생태계 씨앗

```javascript
// routes/public.js (신규, 인증 불필요)

// 전체 게임 통계
GET /api/public/stats
→ {
    total_pixels: 5040000,
    pixels_claimed: 84500,
    active_users_24h: 1247,
    total_volume_usdt: 84500,
    top_sector: { name: 'Hellas Abyss', activity_score: 847 }
  }

// 24섹터 현황
GET /api/public/sectors
→ [{
    code: 'hellas_abyss',
    name: 'Hellas Abyss',
    type: 'frontier',
    governor: { nickname: 'KimWarrior', guild_tag: 'DK' },
    governor_since: '2026-04-01',
    pixels_claimed: 3400,
    active_siege: null | { challenger: ..., starts_at: ... },
    tax_rate: 5,
    policy: 'open'
  }]

// 실시간 이벤트 스트림 (SSE)
GET /api/public/events/live
→ Server-Sent Events:
  data: {"type":"hijack","actor":"KimWarrior","sector":"Hellas","pp":1200}
  data: {"type":"siege_declared","challenger":"NewPlayer","sector":"Olympus"}

// Chronicle 목록
GET /api/public/chronicles?limit=10
GET /api/public/chronicles/weekly/latest

// 섹터별 Lore
GET /api/public/lore/:sector_code
```

**이 API가 공개되면:**
- 커뮤니티 팬들이 가격 트래커, 순위 사이트, Discord 봇 자발 제작
- EVE의 zKillboard·DOTLAN이 이 방식으로 탄생

## 3.5 소셜 공유 — 유저가 홍보하고 싶게 만드는 기능

### 공유 카드 생성 시스템

```javascript
// 공유 가능한 이미지 카드를 서버에서 생성 (node-canvas 또는 puppeteer)

// 케이스 1: 내 영토 카드
// URL: /share/territory/:claimId
// 내용: 화성 지도에서 내 영토 위치 + "나는 [섹터명]을 지배한다"

// 케이스 2: Governor 취임 카드
// URL: /share/governor/:userId/:sectorCode
// 내용: "KimWarrior가 Hellas Abyss를 정복했다"

// 케이스 3: Enhancement 달성 카드
// URL: /share/enhancement/:instanceId
// 내용: "+10 Volcanic Shield 달성" + 글로우 이미지

// 케이스 4: Siege 결과 카드
// URL: /share/siege/:siegeId
// 내용: 도전자 vs 수비자 + 결과 + 참여자 수
```

**OG 태그 완비:**
```html
<meta property="og:image" content="https://[도메인]/share/siege/123.png">
<meta property="og:title" content="KimWarrior가 Hellas Abyss를 정복했다">
<meta property="og:description" content="47명의 식민지 개척자가 참여한 역사적 전투">
```

### 공유 트리거 시스템

```yaml
자동 공유 유도 시점:
  1. Governor 자리 획득 시
     → "당신은 이제 [섹터명]의 지배자입니다. 공유하시겠습니까?"
     → [X에 공유] [Discord 복사] [나중에]

  2. Enhancement +7/+8/+9/+10 달성 시
     → "+[N] 달성! 이 성과를 공유하세요"

  3. 대형 Siege 참여 후 (10명 이상)
     → "당신은 역사적 전투에 참여했습니다"

  4. 7일 이상 Governor 유지 시
     → "당신은 7일째 [섹터]를 지배하고 있습니다"
```

---

# PART 4. 직업 시스템 (Migration 083)

> **이전 기획서(v2.0)의 Phase 1 내용을 이 문서에 통합.**
> 상세 스펙은 동일하되, 제거된 Cantina 연동 부분 제거.

## 4.1 4개 직업 구조 (수정)

Cantina 제거로 인한 수정:
- ~~Cantina Master 시즌 카테고리 제거~~
- Crafter 직업의 **Enhancement 전문화** 강화
- Warrior 직업에 **Siege 보너스** 추가

### 수정된 버프 수치

#### Miner (광부) — 변경 없음
```yaml
mining_rate: 1.50
harvest_speed: 1.30
poi_reward: 1.40
rare_resource_chance: 1.30  # Phase 2 광물 연동
combat_power: 0.70
```

#### Warrior (전사) — Siege 보너스 추가
```yaml
combat_power: 1.30
hijack_success: 1.20
defense_item_effect: 1.25
attack_item_effect: 1.20
siege_participation_bonus: 1.50  # Siege 기간 영토 구매 비용 감소
mining_rate: 0.80
```

#### Crafter (제작자) — Enhancement 전문화 강화
```yaml
enhancement_success: 1.30        # 기존 1.25 → 1.30으로 강화
enhancement_cost: 0.80           # 기존 0.85 → 0.80 (더 저렴)
enhancement_break_protection: 0.40  # 파괴 확률 60% 감소
enhancement_material_saving: 0.90   # 자원 소모 -10% (Phase 2 연동)
mining_rate: 0.80
combat_power: 0.80
```

#### Merchant (상인) — 마켓 전문화 강화
```yaml
market_fee: 0.65                 # 기존 0.70 → 0.65 (35% 할인)
listing_limit: 2.00              # 기존 1.50 → 2.00 (40개)
price_history_days: 60           # 기존 30일 → 60일
auction_fee: 0.70                # 옥션 수수료도 30% 할인
governor_market_cut_exemption: 0.50  # Governor 마켓세 50% 면제
mining_rate: 0.85
combat_power: 0.80
```

> Merchant의 `governor_market_cut_exemption`은 Governor 수수료에서 50% 면제.
> 상인은 Governor의 "착취"를 덜 받는다 → 정치적 긴장 구조.

## 4.2 DB 구조 (이전 기획서와 동일)

```sql
-- 이전 기획서 v2.0 Phase 1.4 DB 스키마 그대로 사용
-- Migration 083으로 실행
```

## 4.3 온보딩과의 연결

직업 선택 = 온보딩 Step 3의 핵심 장면.
자세한 온보딩 흐름은 Part 5에서.

---

# PART 5. 광물 & 자원 시스템 (Migration 084)

> **이전 기획서(v2.0) Phase 2 내용 통합. 핵심만 유지.**

## 5.1 자원 종류 (9종 → 6종으로 축소)

복잡도를 낮추고 핵심만 남긴다.

| 코드 | 이름 | 희귀도 | 주 획득처 |
|---|---|---|---|
| `iron_dust` | Iron Dust | common | Frontier/Mid Mining |
| `red_sand` | Red Sand | common | Frontier Mining |
| `ice_crystal` | Ice Crystal | rare | Frontier Mining |
| `volcanic_shard` | Volcanic Shard | rare | Frontier Mining + 모래폭풍 |
| `ancient_metal` | Ancient Metal | special | Frontier Mining (극소) |
| `meteorite_fragment` | Meteorite Fragment | special | 로켓 이벤트 |

**3종 제거 이유**:
- `basalt_chip`: 섹터 구분 역할만 하는데 불필요한 복잡도
- `plasma_dust`: POI 전용이라 획득 경로 단순화
- `regolith_ore`: Ice Crystal과 역할 중복

## 5.2 자원 활용처 (경제 순환 핵심)

```yaml
자원 활용처:

1. 마켓플레이스 거래:
   Miner → 자원 채굴 → 마켓 판매 → GP/PP 수익
   Crafter → 자원 구매 → Enhancement에 활용

2. Enhancement 강화 재료:
   +7 이상 시도 시 자원 소모 옵션:
     ice_crystal 3개 소모 → 성공률 +8%
     volcanic_shard 2개 소모 → 파괴 방지 +15%
     ancient_metal 1개 소모 → 성공률 +20%

3. Governor Siege 강화:
   volcanic_shard 10개 소모 → Siege 기간 방어 버프 +10%
   (Governor가 자원을 사야 하는 이유 → 약자에게 자원 구매)

4. 특수 아이템 제작:
   meteorite_fragment 5개 → "Meteorite Shield" 제작
   (기존 Shop에 없는 희귀 아이템)
```

## 5.3 DB 구조

```sql
-- 이전 기획서 v2.0 Phase 2 DB 구조 사용
-- 자원 6종으로 초기 데이터 수정

-- Enhancement 자원 소모 테이블 추가
CREATE TABLE enhancement_material_recipes (
  id              SERIAL PRIMARY KEY,
  min_enhance_level INT NOT NULL,  -- 이 레벨 이상에서 사용 가능
  resource_code   VARCHAR(30) REFERENCES resources(code),
  quantity        INT NOT NULL,
  success_bonus   DECIMAL(5,4),    -- 성공률 추가 (0.08 = +8%)
  break_reduction DECIMAL(5,4),    -- 파괴 확률 감소 (0.15 = -15%)
  is_active       BOOLEAN DEFAULT TRUE
);
```

---

# PART 6. 온보딩 튜토리얼 (Migration 085)

## 6.1 설계 원칙

온보딩의 목표는 **첫 30분 안에 유저에게 "나만의 이야기"를 만들어주는 것**.

단순 기능 설명(X) → 유저가 직접 경험하면서 배움(O)

## 6.2 5단계 온보딩 흐름

### STEP 0 — 세계관 진입 (60초)

```
화면 구성:
  배경: 화성 글로브 천천히 회전
  텍스트 (페이드 인):

  "2067년. 지구 기업들이 화성을 분할했다."
  "자원은 무한하다. 하지만 영토는 제한되어 있다."
  "당신은 오늘 첫 발을 내딛는다."

  [착륙하기] 버튼

이유:
  세계관이 없으면 게임이 그냥 "픽셀 클릭"이다.
  60초 서사가 "나는 화성 개척자다" 정체성을 만든다.
```

### STEP 1 — 직업 선택 (2~3분)

```
기존 Level 5 직업 선택을 온보딩 시작으로 앞당김.
(Level 5 전에는 버프 없이 선택만 하고, 실제 버프는 Level 5부터 적용)

화면:
  "화성에서 살아남는 방법은 4가지입니다"

  [⛏️ 광부]        [⚔️ 전사]
  자원을 캔다      영토를 뺏는다
  안전하게 벌기    공격적으로 정복

  [🔨 제작자]      [💼 상인]
  아이템을 만든다  거래로 부를 쌓는다
  희귀 강화 전문   마켓 수수료 할인

  → 카드 클릭 시 상세 설명 + 추천 플레이 스타일 표시

이유:
  직업 선택이 온보딩 첫 장면 = "나는 누구인가" 즉시 확립
  이후 모든 설명이 "당신의 직업에 맞춰" 개인화됨
```

### STEP 2 — 첫 영토 점령 (3분)

```
화면:
  선택한 직업에 맞는 섹터 추천:
    광부 → "Arcadia Ridge를 추천합니다. Frontier에서 자원이 풍부합니다."
    전사 → "Marineris East를 추천합니다. 전투가 활발합니다."
    제작자 → "Candor Fields를 추천합니다. 중간 지대라 안전합니다."
    상인 → "Pavonis Gate를 추천합니다. 거래가 가장 많습니다."

  → 추천 섹터의 빈 영토 하이라이트
  → 클릭하면 첫 영토 무료 점령 (튜토리얼 전용, 1회 한정)
  → "첫 영토 점령! 이 땅은 이제 당신의 것입니다. +100 XP"

이유:
  무료 첫 영토 = 즉각적인 소유감
  직업별 다른 섹터 추천 = 게임이 나를 알아준다는 느낌
```

### STEP 3 — 첫 위협 경험 (2분)

```
화면:
  "잠깐, 당신의 영토가 위험합니다"
  (시뮬레이션: 다른 유저가 내 영토를 Hijack 시도하는 애니메이션)

  "화성에서는 빈 땅도 언제든 빼앗길 수 있습니다"
  "방어 아이템을 사용하거나, 길드에 가입해 보호받으세요"

  → [기본 방어 아이템 무료 지급] (온보딩 보상)
  → [방어 아이템 장착하기] 버튼

이유:
  위협 없이는 방어 욕구가 없다.
  위협을 경험해야 길드 가입 동기가 생긴다.
  실제 Hijack이 아닌 시뮬레이션이므로 실제 손실 없음.
```

### STEP 4 — 길드 가입 유도 (2분)

```
화면:
  "혼자서는 한계가 있습니다"

  "현재 [Arcadia Ridge]에 [3개 길드]가 활동 중입니다"
  → 섹터 내 길드 3개 자동 추천 (멤버 수, 활동 점수 기준)

  [길드 A] 멤버 23명 | 활동 매우 활발 | "초보 환영"
  [길드 B] 멤버 47명 | 전투 특화     | "Warrior 모집"
  [무관심하게 진행]

  → 선택 시 1-click 가입 신청
  → 스킵 가능

이유:
  길드 가입은 리텐션의 핵심.
  가입 후 길드원과 상호작용이 생기면 이탈률 급감.
  섹터별 추천으로 관련성 높음.
```

### STEP 5 — 첫 목표 설정 (1분)

```
화면:
  "당신의 다음 목표는 무엇인가요?"

  직업별 맞춤 목표 제시:
    광부: "이번 주 Ice Crystal 10개 채굴하기 → 마켓에 판매해보세요"
    전사: "이번 주 첫 Hijack 성공하기 → 영토를 2개로 늘리세요"
    제작자: "Enhancement +3 달성하기 → 강화의 재미를 느껴보세요"
    상인: "마켓에 첫 아이템 등록하기 → 거래 흐름을 파악하세요"

  → [튜토리얼 완료!]
  → 보상 지급: 200 GP + 100 PP + "신참 개척자" 칭호

이유:
  목표가 없으면 뭘 해야 할지 모른다.
  직업별 맞춤 목표 = "게임이 나를 위해 만들어진 것 같다"는 느낌.
```

## 6.3 DB 구조

```sql
CREATE TABLE user_onboarding (
  id                  SERIAL PRIMARY KEY,
  user_id             INT UNIQUE NOT NULL REFERENCES users(id),
  current_step        INT DEFAULT 0,
  job_selected        VARCHAR(20),           -- 온보딩 중 선택한 직업
  tutorial_claim_id   INT,                   -- 무료 점령 클레임 ID
  completed           BOOLEAN DEFAULT FALSE,
  skipped             BOOLEAN DEFAULT FALSE,
  completed_at        TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW()
);

-- settings 추가
INSERT INTO settings (key, value) VALUES
('onboarding_enabled', 'true'),
('onboarding_pp_reward', '100'),
('onboarding_gp_reward', '200'),
('onboarding_free_item_id', '1'),  -- 기본 방어 아이템 ID
('onboarding_skip_allowed', 'true');
```

---

# PART 7. Territory War Betting — Cantina 대체 (Migration 086)

## 7.1 설계 의도

Cantina 5종 도박 게임을 제거하고, **게임 내 전투에 거는 전략적 베팅**으로 대체한다.

차이:
| | 기존 Cantina | Territory War Betting |
|---|---|---|
| 성격 | 순수 운 (RNG) | 정보 기반 예측 |
| 서사 기여 | 없음 | 직접 연결 |
| 이미지 | 카지노 | 전략 게임 |
| GP Sink | 동일 | 동일 + 더 강함 |

## 7.2 베팅 대상

```yaml
베팅 가능 이벤트:
  1. Governor Siege 결과
     - 도전자 승리 / 현 Governor 유지
     - 배당: 실시간 오즈 (총 베팅 금액 비율 기반)

  2. Guild War 승패
     - 두 길드 중 어느 쪽이 이기는가

  3. 주간 섹터 최다 Hijack 유저
     - Top 3 중 누가 1위를 할 것인가

베팅 통화: GP 전용 (USDT 베팅 없음 — 규제 리스크 방지)
최소 베팅: 10 GP
최대 베팅: 2,000 GP (설정값)
하우스 엣지: 5% (settings: war_betting_house_edge)
```

## 7.3 서사 효과

```
Siege 선언 → 베팅 오픈 → 유저들이 베팅 → 베팅 현황 공개 →
"도전자가 70% 우세" → 현 Governor 위기감 → 방어 강화 →
유저들이 관전하며 응원 → 결과 발표 → Chronicle 기록 →
Discord/Telegram 공유
```

**핵심**: 베팅 참여자가 관전자가 되고, 관전자가 다음 참여자가 된다.

## 7.4 DB 구조

```sql
CREATE TABLE war_bets (
  id              SERIAL PRIMARY KEY,
  event_type      VARCHAR(30) NOT NULL,  -- 'siege', 'guild_war', 'weekly_top'
  event_id        INT NOT NULL,
  user_id         INT NOT NULL REFERENCES users(id),
  predicted_winner VARCHAR(50),          -- 닉네임 또는 길드 태그
  bet_amount      INT NOT NULL,          -- GP 금액
  status          VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'won', 'lost'
  payout          INT DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE war_bet_events (
  id              SERIAL PRIMARY KEY,
  event_type      VARCHAR(30) NOT NULL,
  event_id        INT NOT NULL,
  option_a        VARCHAR(50) NOT NULL,   -- "KimWarrior (Governor)"
  option_b        VARCHAR(50) NOT NULL,   -- "NewPlayer (Challenger)"
  total_bet_a     INT DEFAULT 0,
  total_bet_b     INT DEFAULT 0,
  status          VARCHAR(20) DEFAULT 'open',  -- 'open', 'closed', 'resolved'
  winner          VARCHAR(50),
  opens_at        TIMESTAMP,
  closes_at       TIMESTAMP,              -- Siege 시작 1시간 전 마감
  resolved_at     TIMESTAMP
);
```

---

# PART 8. Hall of Fame & 영구 서사 (Migration 087)

## 8.1 목적

**유저의 업적이 영구적으로 기록되어야 한다.**

EVE의 B-R5RB 전투 참여자들은 10년이 지나도 "나 거기 있었어"라고 말한다.
이것이 장기 리텐션의 핵심이다.

## 8.2 Hall of Fame 카테고리

```sql
CREATE TABLE hall_of_fame (
  id              SERIAL PRIMARY KEY,
  category        VARCHAR(50) NOT NULL,
  -- 'first_governor', 'longest_governor', 'largest_siege',
  -- 'first_max_enhance', 'largest_single_hijack',
  -- 'season_mvp', 'underdog_victory', 'most_betrayals'
  user_id         INT REFERENCES users(id),
  guild_id        INT REFERENCES guilds(id),
  sector_code     VARCHAR(30),
  value           DECIMAL(20,8),
  description_en  TEXT,
  description_ko  TEXT,
  description_ja  TEXT,
  description_zh  TEXT,
  achieved_at     TIMESTAMP DEFAULT NOW(),
  season_id       INT,
  is_all_time     BOOLEAN DEFAULT FALSE,  -- 역대 기록 vs 시즌 기록
  is_featured     BOOLEAN DEFAULT FALSE   -- 어드민 추천
);
```

### 기록 카테고리 14종

```yaml
역대 기록 (all_time):
  first_governor_{sector}: 섹터별 최초 Governor
  first_max_enhance: 최초 +10 달성자
  largest_single_hijack: 역대 최대 단일 Hijack
  largest_siege_participants: 역대 최다 참여 Siege
  longest_governor: 최장 재임 Governor
  underdog_victory: 최대 역전 Siege 승리 (영토 적은 도전자가 이긴 경우)

시즌 기록 (per_season):
  season_mvp: 시즌 종합 1위
  season_top_miner: 시즌 채굴 1위
  season_top_warrior: 시즌 Hijack 1위
  season_top_crafter: 시즌 Enhancement 1위
  season_top_merchant: 시즌 거래 1위
  season_best_governor: 시즌 중 최장 재임 Governor
  season_biggest_betrayal: 시즌 중 가장 극적인 Governor 교체
  season_coalition: 가장 많은 길드가 연합한 Siege
```

## 8.3 칭호 시스템 (자동 부여)

```sql
CREATE TABLE user_titles (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id),
  title_code  VARCHAR(50) NOT NULL,
  title_en    VARCHAR(100),
  title_ko    VARCHAR(100),
  title_ja    VARCHAR(100),
  title_zh    VARCHAR(100),
  earned_at   TIMESTAMP DEFAULT NOW(),
  is_equipped BOOLEAN DEFAULT FALSE  -- 프로필에 표시할 칭호 선택
);
```

### 주요 칭호 목록

```yaml
게임플레이 칭호:
  "First Colonist": 서버 최초 영토 점령
  "Governor": 현재 Governor (자동 부여/해제)
  "Iron Governor": 30일 이상 Governor 유지
  "Eternal Ruler": 90일 이상 Governor 유지
  "Siege Victor": Siege에서 승리
  "Underdog": 10배 이상 격차 Siege에서 승리
  "Master Crafter": Enhancement +10 달성
  "Grand Merchant": 누적 10,000 PP 마켓 거래
  "Bounty Hunter": 10개 이상 Bounty 달성
  "Veteran": 180일 이상 플레이

시즌 칭호 (시즌 종료 시 자동 부여):
  "Season Champion [N]": 시즌 N 종합 1위
  "Mining Legend": 시즌 채굴 1위
  "Warlord": 시즌 Hijack 1위
```

---

# PART 9. 직업 시스템 + 섹터 진입 제한 (Migration 083 연계)

## 9.1 섹터 진입 레벨 제한

```yaml
영토 구매 조건:
  Frontier: 제한 없음
  Mid: Level 10 이상
  Core: Level 25 이상 + Mid 영토 1개 이상 보유

방문은 자유 (구매만 제한)

DB:
  sector_entry_requirements 테이블 (이전 기획서 동일)
  Level 기준은 settings 테이블로 관리
```

---

# PART 10. 마켓플레이스 수정 (Migration 088)

## 10.1 등록비 수정

```sql
-- 기존 2 GP → 10 GP로 상향
UPDATE settings SET value = '10' WHERE key = 'marketplace_listing_fee_gp';

-- 동적 요금 추가 (활성 리스팅 수에 따라)
-- 활성 리스팅 5개 이상: 등록비 ×2
-- 활성 리스팅 10개 이상: 등록비 ×4
-- (Merchant는 이 상승분도 30% 할인)

INSERT INTO settings (key, value, description) VALUES
('marketplace_dynamic_fee_threshold_1', '5', '1차 등록비 상승 기준 리스팅 수'),
('marketplace_dynamic_fee_multiplier_1', '2.0', '1차 등록비 배율'),
('marketplace_dynamic_fee_threshold_2', '10', '2차 등록비 상승 기준'),
('marketplace_dynamic_fee_multiplier_2', '4.0', '2차 등록비 배율');
```

## 10.2 자원 거래 추가

```sql
-- 기존 marketplace_listings에 자원 타입 추가
ALTER TABLE marketplace_listings
  ADD COLUMN resource_code VARCHAR(30) REFERENCES resources(code),
  ADD COLUMN resource_quantity INT;

-- item_type에 'resource' 추가
-- CHECK 조건 업데이트
```

---

# PART 11. 경제 밸런싱 (설정값 수정)

## 11.1 GP Sink 강화 (Cantina 제거 보완)

Cantina 제거로 GP Sink가 감소한다. 보완책:

```yaml
추가 GP Sink:
  1. Governor Siege 선언: 100 GP 소각
  2. 직업 변경 (유료): 50 GP 소각
  3. 마켓 등록비 상향: 2→10 GP
  4. 동적 마켓 등록비: 최대 40 GP
  5. Territory War Betting: 하우스 엣지 5% 소각
  6. 칭호 변경: 20 GP 소각
  7. Governor 선언문: 5 GP 소각 (스팸 방지)
  8. Hall of Fame 조회: 무료 (접근성 유지)
  9. 보호권 아이템: 500~1500 GP 소각 (Phase 후반)
```

## 11.2 PP Sink 강화

```yaml
추가 PP Sink:
  1. Siege 선언 비용: 100 GP (GP Sink와 별도)
  2. 파벌 변경: 500 GP → 또는 PP 200
  3. 섹터 이전 비용 (Phase 2b): PP 50 (다른 섹터로 주력 이동 시)
```

## 11.3 인플레이션 모니터링 쿼리 (Admin에 추가)

```sql
-- 일별 경제 현황 뷰
CREATE OR REPLACE VIEW daily_economy_health AS
SELECT
  DATE(t.created_at) AS date,
  SUM(CASE WHEN t.amount > 0 AND t.currency = 'PP' THEN t.amount ELSE 0 END) AS pp_issued,
  SUM(CASE WHEN t.amount < 0 AND t.currency = 'PP' THEN ABS(t.amount) ELSE 0 END) AS pp_burned,
  SUM(CASE WHEN t.amount > 0 AND t.currency = 'GP' THEN t.amount ELSE 0 END) AS gp_issued,
  SUM(CASE WHEN t.amount < 0 AND t.currency = 'GP' THEN ABS(t.amount) ELSE 0 END) AS gp_burned,
  ROUND(
    SUM(CASE WHEN t.amount < 0 AND t.currency = 'PP' THEN ABS(t.amount) ELSE 0 END) /
    NULLIF(SUM(CASE WHEN t.amount > 0 AND t.currency = 'PP' THEN t.amount ELSE 0 END), 0),
    4
  ) AS pp_sink_ratio,
  COUNT(DISTINCT t.user_id) AS active_users
FROM transactions t
GROUP BY DATE(t.created_at)
ORDER BY date DESC;
```

### 경고 임계치

```sql
INSERT INTO settings (key, value, description) VALUES
('economy_warn_pp_sink_ratio', '0.80', 'PP Sink/Faucet 경고 (80% 미만)'),
('economy_critical_pp_sink_ratio', '0.60', 'PP Sink/Faucet 위험 (60% 미만)'),
('economy_warn_gp_sink_ratio', '0.70', 'GP Sink/Faucet 경고');
```

---

# PART 12. 24섹터 Lore (Migration 089)

## 12.1 섹터 Lore 텍스트

> 화성 실제 지형 기반. 저작권 없음. 게임 세계관 적용.

```sql
-- sector_lore 테이블 초기 데이터 (24섹터)

-- CORE 섹터 (6개)
INSERT INTO sector_lore (sector_code, name_en, name_ko, sector_type,
  lore_en, special_feature) VALUES

('olympus_crown', 'Olympus Crown', '올림푸스 왕관', 'core',
  'Built atop the solar system''s highest volcano, this sector is the political heart of Mars. The first Governor of Olympus Crown is said to have written: "From here, I see everything." Three major corporations have fallen trying to hold this peak.',
  '최고 정치 중심. Governor 세금 ×1.5'),

('tharsis_citadel', 'Tharsis Citadel', '타르시스 요새', 'core',
  'The volcanic plateau of Tharsis is the most defensible ground on Mars. No siege has ever succeeded here in the first attempt. Defenders joke: "They came three times. The third time, we kept their equipment."',
  '방어 최강. 방어 아이템 효과 +20%'),

('pavonis_gate', 'Pavonis Gate', '파보니스 관문', 'core',
  'Every trade route passes through Pavonis Gate. The current Governor taxes 8% on all passage goods — the highest rate in Core. Merchants hate it. But there is no bypass.',
  '주요 무역 허브. 마켓 거래량 2배'),

('ascraeus_vault', 'Ascraeus Vault', '아스크라이우스 금고', 'core',
  'The underground storage networks beneath Ascraeus are rumored to hold the largest GP reserves on Mars. No one knows who controls the deepest vaults.',
  '강화 비용 -10%'),

('arsia_forge', 'Arsia Forge', '아르시아 대장간', 'core',
  'Volcanic heat makes Arsia the perfect forge. The best Enhancement craftspeople cluster here, chasing the +10 that has never been achieved in this sector.',
  '최고 Enhancement 수율. Crafter 버프 추가 +5%'),

('noctis_prime', 'Noctis Prime', '녹티스 프라임', 'core',
  'The labyrinth of canyons in Noctis makes it impossible to govern through force alone. Every Governor here has survived through alliances and information — never through firepower.',
  '외교 보너스. 길드 동맹 관련 보너스'),

-- MID 섹터 (10개)
('marineris_east', 'Marineris East', '마리너리스 동부', 'mid',
  'The eastern mouth of the great canyon. New arrivals often make their first deal here — cheap land, willing sellers, and enough chaos to make a profit.',
  '신규 유저 추천. 거래 활발'),

('marineris_west', 'Marineris West', '마리너리스 서부', 'mid',
  'Merchants have called the western canyon home for three seasons. The invisible trade networks here are more complex than any map can show.',
  'Merchant 우세 지역'),

('candor_fields', 'Candor Fields', '캔도르 평원', 'mid',
  'Flat, open, and fertile by Martian standards. The most consistent PP yields come from Candor — not the highest, but never failing. Farmers here don''t dream of glory. They dream of harvest.',
  'PP 생산 안정. 채굴 기복 없음'),

('ophir_station', 'Ophir Station', '오피르 역', 'mid',
  'Originally a waypoint for cargo transfers, Ophir Station grew into a full settlement. The current Governor runs it like a corporation: efficient, impersonal, and profitable.',
  '길드 구성 허브. 길드 생성 비용 -20%'),

('hebes_crossing', 'Hebes Crossing', '헤베스 교차로', 'mid',
  'Neutral ground by tradition. Three wars have begun at Hebes Crossing. All three paused here first.',
  '중립 거래 지점. 전투 우선 협상 가능'),

('coprates_ridge', 'Coprates Ridge', '코프라테스 능선', 'mid',
  'Warriors come to Coprates to prove themselves. The ridge is littered with the ruins of former territories — each one a story of someone who thought they were untouchable.',
  'Warrior 강화 구역. Hijack 성공률 추가 +5%'),

('eos_plateau', 'Eos Plateau', '에오스 고원', 'mid',
  'The winds above Eos are legendary. During storm season, the Plateau becomes the most dangerous — and most rewarding — sector on Mars.',
  '날씨 이벤트 집중. 모래폭풍 보상 ×2'),

('melas_basin', 'Melas Basin', '멜라스 분지', 'mid',
  'Deep in the canyon system, Melas Basin is full of secrets. Explorers report finding artifacts that predate human settlement — artifacts no one can explain.',
  'POI 풍부. 탐험 보상 +30%'),

('tithonium_scars', 'Tithonium Scars', '티토니움 상흔', 'mid',
  'They call it the Scars because of what happens here. The most betrayals per capita on Mars. The most dramatic siege upsets. If you''re looking for enemies, come to Tithonium.',
  '배신의 땅. PvP 다발 구역'),

('syria_planum', 'Syria Planum', '시리아 평원', 'mid',
  'One of the few truly flat regions of Mars. Nothing dramatic happens in Syria. That''s exactly why people come here.',
  '안정적 수확. 하이잭 빈도 낮음'),

-- FRONTIER 섹터 (8개)
('hellas_abyss', 'Hellas Abyss', '헬라스 심연', 'frontier',
  'The deepest impact crater on Mars. The pressure here is higher, the temperature more extreme. Ancient Metal has been found in Hellas that appears nowhere else on the planet. Three expeditions never returned.',
  '최고 희귀 자원 확률. 극도로 위험'),

('elysium_wastes', 'Elysium Wastes', '엘리시움 황무지', 'frontier',
  'When rockets fail to land at designated zones, they crash in Elysium. The sector is littered with half-salvaged cargo. The best Meteorite Fragments come from here.',
  '로켓 낙하 다발. Meteorite Fragment 최다'),

('utopia_flats', 'Utopia Flats', '유토피아 평지', 'frontier',
  'Named ironically by its first settlers, who found nothing utopian about it. But exploration teams keep finding things underground — old structures, odd readings, unexplained signals.',
  '탐험 POI 최다. 탐험 보상 +50%'),

('arcadia_ridge', 'Arcadia Ridge', '아르카디아 능선', 'frontier',
  'The most welcoming Frontier sector for newcomers. The veterans who settled here first made a pact: no attacking accounts younger than 14 days. The pact has held for two seasons.',
  '신규 유저 보호 전통. 초보자 추천'),

('cerberus_scars', 'Cerberus Scars', '케르베로스 상흔', 'frontier',
  'Named after the three-headed guardian of the underworld. Three independent power bases have fought for control here since Season 1. None has won. None has given up.',
  '고위험 고수익. 상시 전투'),

('phlegra_deep', 'Phlegra Deep', '플레그라 심부', 'frontier',
  'The ice formations in Phlegra are unlike anywhere else on Mars. Ice Crystal found here has properties that Core manufacturers pay premium prices for.',
  '얼음 자원 집중. Ice Crystal 확률 ×2'),

('amazonis_sink', 'Amazonis Sink', '아마조니스 함몰지', 'frontier',
  'The geological stability of Amazonis makes it an anomaly in the Frontier. No earthquakes. No storms. No drama. Just reliable, consistent extraction.',
  '날씨 이벤트 없음. 가장 안전한 Frontier'),

('borealis_edge', 'Borealis Edge', '보레알리스 끝자락', 'frontier',
  'The northernmost settled territory on Mars. Supply lines from Core take three times as long to reach here. But the isolation also means no one is watching — which some find valuable.',
  '특수 아이템 드롭. 희귀 Bounty 다발');
```

---

# PART 13. 전체 Migration 순서 및 Claude Code 작업 지시

## 13.1 작업 순서 (엄수)

```
Migration 080: 제거 작업
  - Cantina 비활성화 (settings + 미들웨어)
  - Arcade 비활성화
  - 날씨 이벤트 수정 (전략적 이벤트로 전환)
  - 레퍼럴 3-tier → 1-tier + 게임활동 기반으로 수정

Migration 081: Governor 강화
  - governance_settings 테이블 컬럼 추가
  - governor_sieges 테이블 생성
  - governor_hall_of_fame 테이블 생성
  - Siege 선언/진행/해결 API
  - Governor 선언문 API
  - 프론트엔드: Siege UI + 선언문 UI

Migration 082: 서사 엔진
  - server_chronicles 테이블
  - services/chronicle.js (사건 감지 + 기록)
  - Weekly Chronicle 스케줄러
  - 공개 API 5개
  - Discord/Telegram Webhook
  - 소셜 공유 카드 생성

Migration 083: 직업 시스템
  - jobs, job_buffs 테이블
  - users 테이블 컬럼 추가
  - services/job.js
  - 기존 Mining/Hijack/Enhancement/Marketplace에 버프 적용
  - API 6개 + Admin JOBS 탭

Migration 084: 광물 & 자원
  - resources, sector_resource_rates 테이블
  - user_resource_inventory 테이블
  - Mining에 자원 드롭 추가
  - 마켓플레이스 자원 거래 추가
  - Enhancement 자원 소모 옵션

Migration 085: 온보딩
  - user_onboarding 테이블
  - 5단계 온보딩 UI
  - 직업별 맞춤 추천 로직

Migration 086: Territory War Betting
  - war_bets, war_bet_events 테이블
  - Siege 연동 자동 베팅 이벤트 생성
  - 베팅 UI

Migration 087: Hall of Fame & 칭호
  - hall_of_fame 테이블
  - user_titles 테이블
  - 자동 칭호 부여 로직

Migration 088: 마켓플레이스 수정
  - 등록비 10 GP
  - 동적 요금 로직
  - 자원 거래 타입 추가

Migration 089: 섹터 Lore
  - sector_lore 테이블 + 24섹터 텍스트
  - 공개 API 연동
```

## 13.2 각 Migration 작업 지시 템플릿

**Claude Code에게 각 Migration을 지시할 때 사용할 형식:**

```
"MASTER_PLAN_V3.md의 [Migration XXX: 항목명]을 구현해줘.

이번 작업 범위:
- [구체적 항목 1]
- [구체적 항목 2]
(범위 외 작업 금지)

제약:
- 기존 마이그레이션(001~079) 수정 금지
- 하드코딩 금지 (모든 수치는 settings 테이블)
- 기존 정상 동작 기능은 건드리지 말 것

완료 후 제출:
1. 생성/수정 파일 목록
2. 롤백 SQL
3. 테스트 방법 3가지
4. 기존 기능 영향 여부"
```

## 13.3 기능 제거 작업 상세 (Migration 080 전용)

### Cantina 비활성화 절차

```javascript
// 1. settings 수정
UPDATE settings SET value = 'false' WHERE key = 'cantina_enabled';

// 2. routes/cantina.js 최상단에 미들웨어 추가
router.use((req, res, next) => {
  const enabled = await getSetting('cantina_enabled');
  if (enabled !== 'true') {
    return res.status(503).json({
      error: 'Cantina is temporarily closed',
      message: getI18n(req.user?.lang, 'cantina_closed_message')
    });
  }
  next();
});

// 3. 프론트엔드: Cantina 탭 숨김
// index.html에서 CANTINA 관련 탭/버튼에 display:none 추가
// (삭제 아님, 추후 Territory War Betting 연결 예정)

// 4. i18n 추가
// cantina_closed_message: "Cantina is being renovated. Coming soon: Territory War Betting"
```

### Arcade 비활성화 절차

```javascript
// 동일 패턴
UPDATE settings SET value = 'false' WHERE key = 'arcade_enabled';
// routes/arcade.js 미들웨어 추가
// 프론트엔드 ARCADE 탭 hidden
```

### 레퍼럴 수정 절차

```sql
-- settings 수정
UPDATE settings SET value = '0.05' WHERE key = 'referral_tier1_rate';
-- 게임 활동 기반으로 변경 (deposit → gameplay)

UPDATE settings SET value = '0' WHERE key = 'referral_tier2_rate';
UPDATE settings SET value = '0' WHERE key = 'referral_tier3_rate';
UPDATE settings SET value = 'false' WHERE key = 'referral_deposit_enabled';
UPDATE settings SET value = 'true' WHERE key = 'referral_gameplay_enabled';
```

---

# 완성도 예측 (재설계 반영)

| 항목 | 현재 | 제거 후 | v3.0 완성 후 |
|---|:---:|:---:|:---:|
| 게임 정체성 명확성 | 50% | 70% | 90% |
| 경제 순환 | 75% | 75% | 95% |
| 서사 생성 구조 | 5% | 5% | 85% |
| 유저 홍보 동기 | 10% | 10% | 80% |
| 신규 유저 경험 | 10% | 10% | 80% |
| EVE식 정치 구조 | 30% | 30% | 75% |
| 리니지식 중독성 | 20% | 20% | 65% |
| **종합** | **60%** | **65%** | **85%** |

**65% 이상에서 마케팅 시작 → 85% 달성 후 본격 확장 권장**

---

# 핵심 답변 정리

## Q1. 유저가 충분히 참여했을 때 EVE/리니지처럼 되는가?

**YES, 단 다음 3가지가 완성되어야 한다:**

1. **Governor 권한이 실질적이어야 한다** — Migration 081 완료 후
   세율 10%, 마켓 거래세, 섹터 입장 통제 = 진짜 권력
   진짜 권력이 있어야 진짜 도전자가 나타난다

2. **Siege 시스템이 "예약된 결전"을 만들어야 한다** — Migration 081
   48시간 대기 = 긴장, 준비, 동맹 모집, 베팅
   이 48시간이 EVE의 전투 전야와 같다

3. **이야기가 밖으로 나가야 한다** — Migration 082
   Chronicle + Webhook + 공유 카드 없이는
   극적인 사건이 게임 안에서 사라진다

## Q2. 커뮤니티 확장성을 어디에 두어야 하는가?

**"자랑할 이야기"를 자동으로 만들고, 밖으로 내보내는 구조**

```
플레이어가 Governor 자리를 빼앗음
     ↓
Chronicle 자동 생성
"NewPlayer가 48시간 혈전 끝에 Hellas를 점령했다"
     ↓
Discord Webhook 자동 발송
     ↓
관전자들이 Discord에서 반응
     ↓
"나도 해보고 싶다" → 신규 유저 유입
     ↓
다음 Siege가 더 많은 참여자와 함께
```

**홍보하고 싶게 만드는 구체적 기능 5가지:**
1. Governor 취임 공유 카드 (OG 이미지 포함)
2. Enhancement +10 달성 카드
3. Siege 결과 공유 카드 (참여자 수, 거래 PP 총량 포함)
4. Hall of Fame — 내 이름이 영구 기록됨
5. Weekly Chronicle — 내 이름이 뉴스레터에 나옴

## Q3. 버려야 할 것

```
버린다:
  Cantina 5종 도박 게임 → Territory War Betting으로 대체
  Arcade 3종 미니게임 → 완전 제거
  날씨 랜덤 버프/디버프 → 전략적 이벤트로 전환
  레퍼럴 3-tier 다단계 → 1-tier 게임활동 기반으로 단순화

이유:
  게임 정체성을 "화성 영토 전략 MMO"로 좁혀야 한다.
  카지노 + 아케이드 + 전략 MMO = 어느 타겟에도 강하게 소구 못함.
  버릴수록 남은 것이 더 강해진다.
```

---

*이 문서는 Claude Code가 보고 직접 개발할 수 있도록 설계된 완전 명세서입니다.*
*불명확한 부분이 있으면 구현 전에 확인 요청하세요.*
*각 Migration은 독립적으로 구현·테스트 가능합니다.*
