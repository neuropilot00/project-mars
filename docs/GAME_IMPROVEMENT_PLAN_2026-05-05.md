# OCCUPY MARS — 게임 개선 기획서
> 작성일: 2026-05-05 | 버전: 1.0
> 목적: 4대 약점 해소 + 중기 리텐션 구조 강화

---

## 진단 요약

| 약점 | 현상 | 영향 |
|------|------|------|
| ① 전투 피드백 빈약 | 승패 1줄 + 숫자만 표시 | 전투 의지 감소, 재도전 유인 없음 |
| ② 영토 의미 부재 | 픽셀 캔버스 이상의 역할 없음 | 장기 보유 인센티브 없음 |
| ③ 리텐션 구조 없음 | 일일/주간 루프 미존재 | D3/D7 이탈 극단적 |
| ④ PvP 매칭 구조 없음 | 상대를 찾는 방법 없음 | PvP 사실상 비활성 |

---

## Section 1: 전투 결과 리포트 카드 (Battle Report)

### 1-1. 서버 서비스 `server/services/battleReport.js`

```
generateBattleReport(battle) → BattleReport
```

**BattleReport 스키마:**
```json
{
  "battle_id": 123,
  "winner_side": "atk",
  "ended_at": "...",
  "duration_ticks": 840,
  "atk": {
    "wallet": "0x...",
    "fleet_name": "1함대",
    "total_ships": 8,
    "ships_lost": 2,
    "ships_survived": 6,
    "total_damage_dealt": 12400,
    "total_damage_taken": 5200,
    "flagship_survived": true,
    "mvp_ship": { "name": "...", "kills": 3 }
  },
  "def": { ... },
  "highlights": [
    { "tick": 120, "type": "first_kill", "text": "MCC Frigate destroyed FSP Destroyer" },
    { "tick": 480, "type": "flagship_threatened", "text": "Flagship HP dropped below 30%" },
    { "tick": 720, "type": "turning_point", "text": "ATK fleet gained decisive advantage" }
  ],
  "performance_rating": "A",
  "efficiency_score": 78,
  "field_rating_delta": +3
}
```

**Performance Rating 공식:**
- `efficiency = (damage_dealt / (ships_lost + 1)) / 1000`
- S: efficiency > 15 + 승리
- A: efficiency > 8 + 승리
- B: 승리
- C: 패배 + 선전
- D: 패배 + 대패

### 1-2. API `GET /api/battles/:id/report`

응답: BattleReport JSON

### 1-3. `GET /api/battles/my-stats/:wallet`

응답:
```json
{
  "total_battles": 24,
  "wins": 14,
  "losses": 8,
  "draws": 2,
  "win_rate": 58.3,
  "avg_efficiency": 9.2,
  "best_rating": "S",
  "total_ships_destroyed": 87,
  "total_ships_lost": 45,
  "kill_death_ratio": 1.93,
  "longest_win_streak": 4,
  "favorite_formation": "wedge",
  "faction_win_rates": { "mcc": 0.65, "fsp": 0.50, "cv": 0.60 }
}
```

### 1-4. 프론트 `showBattleResult()` 개선

- 기존 단순 승패 → 리포트 카드 모달
- 전투 하이라이트 타임라인 (텍스트)
- 퍼포먼스 레이팅 배지 (S/A/B/C/D)
- "전투 기록 보기" 버튼 → `/api/battles/my-stats`

### 1-5. Migration 215

```sql
-- fleet_battles: 추가 통계 컬럼
ALTER TABLE fleet_battles
  ADD COLUMN IF NOT EXISTS atk_damage_dealt BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS def_damage_dealt BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS atk_flagship_survived BOOLEAN,
  ADD COLUMN IF NOT EXISTS def_flagship_survived BOOLEAN,
  ADD COLUMN IF NOT EXISTS duration_ticks INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS performance_rating_atk VARCHAR(2),
  ADD COLUMN IF NOT EXISTS performance_rating_def VARCHAR(2);
```

---

## Section 2: 영토 정체성 시스템 (Territory Identity)

### 2-1. Migration 216: claims 테이블 확장

```sql
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS nickname VARCHAR(40),
  ADD COLUMN IF NOT EXISTS bio VARCHAR(200),
  ADD COLUMN IF NOT EXISTS defense_wins INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS times_hijacked INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS battle_wins INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS field_rating INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_hold_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badge_pioneer BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS badge_fortress BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS badge_veteran BOOLEAN DEFAULT FALSE;
```

### 2-2. Field Rating (FR) 공식

```
FR = (보유일수 × 2) + (방어성공 × 5) + (업그레이드레벨 × 3) + (아트등록 × 10)
```

FR 구간:
- FR 0~9: 신규 (🌱)
- FR 10~29: 개척자 (⛏)
- FR 30~59: 정착민 (🏠)
- FR 60~99: 요새 (🛡)
- FR 100+: 전설 (🌟)

### 2-3. 장기 보유 보상

```
보유 7일:  badge_pioneer = TRUE, PP 채굴 보너스 +5%
보유 30일: badge_settler = TRUE, PP 채굴 보너스 +10%
보유 90일: badge_veteran = TRUE, PP 채굴 보너스 +20%
```

스케줄러: 매일 00:00 UTC에 `checkHoldingRewards()` 실행

### 2-4. 영토 위협 알림

하이잭/공성이 선언되면 소유자에게 `player_notifications` 알림:
```json
{
  "type": "territory_threatened",
  "title": "영토 위협",
  "body": "'{claim_name}' 영토가 공격받고 있습니다!",
  "action_url": "/territory/{claim_id}"
}
```

### 2-5. API 추가

- `PATCH /api/territory/:claimId/identity` — nickname/bio 수정
- `GET /api/territory/:claimId/identity` — FR, 배지, 이력 조회

---

## Section 3: 리텐션 구조 (Daily OPS Board)

### 3-1. Daily OPS 미션 시스템

매일 UTC 00:00에 3개 미션 자동 생성:

```json
[
  { "type": "harvest_pp", "target": 1, "reward_gp": 50, "label": "영토 채굴 1회" },
  { "type": "battle_participate", "target": 1, "reward_gp": 100, "label": "전투 1회 참여" },
  { "type": "upgrade_ship", "target": 1, "reward_gp": 75, "label": "함선 강화 1회" }
]
```

### 3-2. Migration 217: daily_ops 테이블

```sql
CREATE TABLE IF NOT EXISTS daily_ops (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(100) NOT NULL,
  ops_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mission_type VARCHAR(50) NOT NULL,
  target_count INT NOT NULL DEFAULT 1,
  current_count INT NOT NULL DEFAULT 0,
  reward_gp INT NOT NULL DEFAULT 50,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(wallet_address, ops_date, mission_type)
);
```

### 3-3. API

- `GET /api/daily-ops/:wallet` — 오늘의 미션 목록 + 진행도
- `POST /api/daily-ops/claim` — 완료된 미션 보상 수령

### 3-4. 프론트 BASE 탭에 DAILY OPS 섹션 추가

```
[⚡ DAILY OPS]
▣ 영토 채굴 1회     ████░ 1/1 ✓  +50 GP [수령]
▣ 전투 참여 1회     ░░░░░ 0/1    +100 GP
▣ 함선 강화 1회     ░░░░░ 0/1    +75 GP
```

### 3-5. 주간 이벤트 캘린더

```json
[
  { "day": "MON", "type": "mining_bonus", "multiplier": 1.5, "label": "채굴 보너스 +50%" },
  { "day": "WED", "type": "battle_gp_boost", "multiplier": 1.3, "label": "전투 GP +30%" },
  { "day": "FRI", "type": "upgrade_discount", "multiplier": 0.8, "label": "강화 비용 -20%" },
  { "day": "SAT", "type": "double_bounty", "multiplier": 2.0, "label": "현상금 2배" }
]
```

---

## Section 4: PvP 매칭 시스템

### 4-1. Combat Power Index (CPI)

```
CPI = Σ(함선별: ATK×2 + DEF×1.5 + HP×0.01 + SPD×0.5) × 함대규모보너스
함대규모보너스: 1척=1.0, 3척=1.1, 5척=1.2, 10척=1.3
```

### 4-2. `GET /api/battles/recommended-opponents/:wallet`

```sql
-- 비슷한 CPI의 플레이어 추천
SELECT f.owner_wallet, f.name, f.cpi,
       ABS(f.cpi - myfleet.cpi) AS cpi_diff
FROM fleets f
CROSS JOIN (SELECT cpi FROM fleets WHERE owner_wallet=$1 LIMIT 1) myfleet
WHERE f.owner_wallet != $1
  AND f.is_in_battle = FALSE
ORDER BY cpi_diff ASC
LIMIT 10
```

### 4-3. 현상금 게시판 (Bounty Board)

**Migration 218: bounty_listings 테이블**

```sql
CREATE TABLE IF NOT EXISTS bounty_listings (
  id SERIAL PRIMARY KEY,
  poster_wallet VARCHAR(100) NOT NULL,
  target_wallet VARCHAR(100) NOT NULL,
  reward_gp INT NOT NULL,
  reason VARCHAR(200),
  status VARCHAR(20) DEFAULT 'active',  -- active/claimed/expired
  claimed_by VARCHAR(100),
  claimed_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**API:**
- `GET /api/bounty/list` — 현상금 목록
- `POST /api/bounty/post` — 현상금 등록 (GP 예치)
- `POST /api/bounty/claim` — 전투 승리 후 현상금 수령

### 4-4. 섹터 갈등 지도

`GET /api/sectors/conflict-map` — 섹터별 활성 전투/현상금 수 반환, 지구본 오버레이용

---

## 구현 우선순위

| 주차 | 작업 | 임팩트 |
|------|------|--------|
| 1주차 | 전투 결과 리포트 카드 (Migration 215 + battleReport.js + API + UI) | 즉각 체감 |
| 1주차 | Daily OPS Board (Migration 217 + API + UI) | 리텐션 핵심 |
| 2주차 | Territory Identity (Migration 216 + nickname/FR + badges) | 장기 플레이 |
| 2주차 | Battle Hub 추천 상대 + My Stats | PvP 활성화 |
| 3주차 | Bounty Board (Migration 218 + 전체 스택) | 사회적 동기 |
| 3주차 | CPI 계산 + 섹터 갈등 지도 | 전략 깊이 |

---

*이 문서를 기반으로 모든 기능을 구현합니다.*
