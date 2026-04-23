# OCCUPY MARS — 완전 게임 바이블 v4.0
# PART 1: 게임 정체성 · 핵심 루프 · 세계관

> Claude Code 구현 전용 마스터 문서
> 작성 기준: Migration 079 완료 상태
> 이 문서는 게임의 모든 시스템을 처음부터 끝까지 정의한다

---

## 0. 이 문서를 읽는 Claude Code에게

**절대 원칙 5가지:**
1. 모든 수치는 `settings` 테이블 저장. 코드에 숫자 직접 쓰기 금지
2. 기존 Migration 001~079 수정 금지
3. 기능 추가 시 기존 코드 최소 수정 (wrapper 패턴)
4. 각 Migration 완료 후: 변경 파일 목록 + 롤백 SQL + 테스트 3가지 제출
5. 불명확하면 구현 전에 반드시 확인 요청

**기술 스택 (확인된 것):**
- Backend: Node.js + Express
- DB: PostgreSQL 15
- Frontend: index.html 단일 파일 (~21,500줄) + Three.js
- Blockchain: Ethers.js v6 (USDT 입출금만)
- 호스팅: Railway
- 언어: EN / KO / JA / ZH (i18n 완비)

---

## 1. 게임 정체성

### 한 줄 정의
> **"화성 픽셀 지도를 무대로 영토를 점령하고, 경제·전투·정치로 제국을 건설하는 P2E 전략 MMO"**

### 장르 포지셔닝
- 핵심: 영토 전략 + 플레이어 경제 + 정치 시뮬레이션
- 참고: EVE Online (경제·정치 구조) + 리니지 (성주 시스템) + r/place (픽셀 영토)
- 차별점: 브라우저 기반 + USDT P2E + 24섹터 화성 세계관

### 타겟 유저
- **1순위**: Web3 네이티브 (암호화폐·P2E 경험자, 영어권/일본/화교권)
- **2순위**: 전통 MMO 유저 (EVE·리니지·WoW 경험자)
- **한국 미서비스** (규제 리스크)

### 핵심 감정 목표
유저가 이 게임을 하면서 느껴야 할 감정:
1. **소유감**: "이 땅은 내 것이다"
2. **긴장감**: "언제 빼앗길지 모른다"
3. **소속감**: "이 길드가 나를 지켜준다"
4. **자랑하고 싶음**: "내가 Governor다, 내가 +10 달성했다"

---

## 2. 세계관 (Lore)

### 배경 설정
```
2067년. 지구의 자원이 고갈되면서 화성 식민지 개발이 본격화됐다.
초기 탐사대가 확보한 영토는 이미 3개 세력이 분할 점령했다.
당신은 오늘 이 혼돈의 행성에 첫 발을 내딛는 개척자다.
화성에서 살아남는 방법은 하나다 — 더 많은 땅을 가져라.
```

### 세력 구조 (Lore용, 파벌 시스템은 Phase 후반)

| 세력 | 설명 | 지배 구역 |
|---|---|---|
| **MCC** (Martian Corporate Consortium) | 지구 메가기업 연합. 자원 독점 추구 | Core 섹터 |
| **FSP** (Free Settlers' Pact) | 1세대 개척자 후손. 자유 무역 중시 | Mid 섹터 |
| **CV** (Crimson Verdict) | 반기업 광부 연합. 약자 연대 추구 | Frontier 섹터 |

### 화성 역사 시드 사건 (플레이어 서사의 배경)
```
Year 0 — First Drop: 최초 정착민 500명이 Arcadia Ridge에 착륙
Year 1 — Olympus Schism: MCC가 Core 섹터 전체를 무력 점령
Year 2 — Marineris Strike: 광부들이 Hellas Abyss 채굴권을 두고 반란
Year 3 — The Long Dust: 6주간 모래폭풍으로 모든 세력이 봉쇄
Year 4 — 현재: 당신이 도착했다
```

---

## 3. 핵심 루프 (Core Loop)

### 기본 루프 (매일)
```
[착륙] → 영토 점령 → 자원 채굴 → 아이템 구매/제작 →
영토 방어/공격 → 마켓 거래 → 시즌 경쟁 → [성장]
```

### 심화 루프 (주간)
```
[길드 가입] → 길드 영토 확장 → Governor 도전 →
Siege 준비/참여 → 세금 징수/분배 → 제국 건설
```

### 장기 루프 (시즌)
```
[시즌 시작] → 직업 특화 성장 → 섹터 지배력 경쟁 →
시즌 Champion 달성 → Hall of Fame 기록 → [다음 시즌]
```

---

## 4. 재화 시스템

### 3중 재화 구조

| 재화 | 이름 | 역할 | 획득 | 사용 |
|---|---|---|---|---|
| **USDT** | 실제 가치 | 온체인 실화폐 | 외부 입금 | 출금만 가능 |
| **PP** (Pixel Points) | 게임 기축통화 | 핵심 경제 | Mining·미션·입금보너스 | 영토 구매·Hijack·스왑 |
| **GP** (Game Points) | 소프트 커런시 | 게임 내 소비재 | PP교환·미션·이벤트 | 강화·마켓·아이템 |

### 재화 흐름도
```
외부 USDT 입금
    ↓ (+10% PP 보너스)
    PP 지급
    ↓
[영토 구매] → 시간 경과 → [Mining Harvest] → PP 회수
[Hijack 공격] → 영토 탈취 → 추가 PP 수익
[PP→GP 교환] → GP 획득 (수수료 5%)
    ↓
[강화] → 코스메틱 +N → 마켓 판매 → GP/PP 수익
[마켓 거래] → 자원/아이템 거래
[PP→USDT 스왑] → 외부 출금 (수수료 5%)
```

### PP Sink (소각처) 전체 목록
```
영토 구매 (Claim)
Hijack 수행
PP → USDT 스왑 수수료 5%
PP → GP 교환 수수료 5%
Governor Siege 선언 비용
Territory War Betting 하우스 엣지
섹터 이전 비용 (Phase 2b)
```

### GP Sink (소각처) 전체 목록
```
Enhancement +0~+10 시도 비용
마켓플레이스 등록비 (동적, 10~40 GP)
마켓플레이스 거래 수수료 5%
Territory War Betting 하우스 엣지 5%
직업 유료 변경 50 GP
Governor 선언문 게시 5 GP
칭호 변경 20 GP
Siege 선언 100 GP
보호권 아이템 500~1,500 GP
길드 생성 50 GP
```

---

## 5. 경제 건전성 원칙

### Sink/Faucet 비율 목표
```
PP Sink/Faucet ≥ 1.0 (균형)
GP Sink/Faucet ≥ 1.0 (균형)
목표: 1.1~1.2 (완만한 희소성 유지)
```

### 인플레이션 경고 임계치
```
PP Sink/Faucet < 0.80 → Admin 대시보드 경고
PP Sink/Faucet < 0.60 → 긴급 조치 필요
```

### 조정 수단 (settings 테이블로 즉시 적용)
```
Mining 기본 수익률 조정
스왑 수수료율 조정
미션 보상 조정
강화 비용 조정
마켓 수수료 조정
```
# PART 2: 지도 · 영토 · 섹터 시스템

---

## 1. 화성 지도 구조

### 전체 지도 스펙
```
총 픽셀: 5,040,000 px (2,520 × 2,000 그리드)
섹터 수: 24개 (Core 6 / Mid 10 / Frontier 8)
영토 단위: 최소 5×5 = 25px, 최대 100×100 = 10,000px
Three.js 3D 글로브로 렌더링 (기존 유지)
```

### 섹터 배치 원칙
```
[CORE — 중앙 6섹터]
  화성 지도 중심부 점유
  인구 밀집, 높은 영토 가격
  방어 유리, 정치 중심

[MID — 중간 10섹터]
  Core를 둘러싸는 링 구조
  균형 잡힌 환경
  거래·제작 중심

[FRONTIER — 외곽 8섹터]
  지도 외곽 배치
  낮은 가격, 높은 자원 확률
  고위험 고수익
```

---

## 2. 영토 구매 시스템 (심화 설계)

### 2.1 현재 구조 (Migration 079 기준)
```
유저가 지도에서 빈 영역 드래그 선택 →
크기 결정 → PP 지불 → 클레임 등록 →
이미지+링크 업로드 → Mining 시작
```

### 2.2 가격 결정 방식 (수정)

**기존 문제**: 모든 픽셀이 동일 단가 → 위치 전략 없음

**수정된 가격 공식**:
```
영토 가격 = 기본 단가 × 섹터 배율 × 위치 배율 × 인접 배율

기본 단가: settings('land_base_price_pp') = 0.1 PP/px

섹터 배율:
  Core:     ×5.0
  Mid:      ×2.0
  Frontier: ×1.0

위치 배율 (섹터 내):
  섹터 중심부: ×1.5 (Governor 영토 반경 50px 이내)
  섹터 일반:   ×1.0
  섹터 외곽:   ×0.8

인접 배율 (내 기존 영토에 붙어있는 경우):
  인접 구매: ×0.85 (15% 할인) → 영토 확장 장려
  고립 구매: ×1.0

예시:
  Frontier 일반 영토 100px: 0.1 × 1.0 × 1.0 × 1.0 × 100 = 10 PP
  Core 중심부 100px:        0.1 × 5.0 × 1.5 × 1.0 × 100 = 75 PP
  내 영토 인접 Frontier:    0.1 × 1.0 × 1.0 × 0.85 × 100 = 8.5 PP
```

### 2.3 영토 크기 제한

```yaml
최소 크기: 5×5 = 25px
최대 크기 (1회 구매): 100×100 = 10,000px
1인 보유 최대 (섹터별):
  Frontier: 제한 없음
  Mid: 50,000px (settings 조정 가능)
  Core: 20,000px

이유:
  Core 독점 방지 → Governor 도전 가능성 유지
  1인이 Core 전체 사면 정치가 죽음
```

### 2.4 인접 영토 보너스 (신규)

```yaml
연속 인접 영토 보너스 (내 영토끼리 붙어있을 때):
  5개 인접: Mining 수익 +5%
  10개 인접: Mining 수익 +10% + 방어 범위 확장
  20개 인접: Mining 수익 +20% + 전용 요새화 가능
  50개 이상: "영지" 칭호 부여 + 특수 표시

계산:
  인접이란 상하좌우 또는 대각선으로 맞닿은 영토
  연결된 클러스터 크기 기준
  (services/territory.js에서 BFS로 클러스터 계산)
```

### 2.5 DB 수정 (claims 테이블)

```sql
-- 기존 claims 테이블에 컬럼 추가
ALTER TABLE claims
  ADD COLUMN sector_code    VARCHAR(30) REFERENCES sector_definitions(code),
  ADD COLUMN price_paid_pp  DECIMAL(20,8),
  ADD COLUMN cluster_id     INT,        -- 연결된 영토 클러스터 ID
  ADD COLUMN adjacency_bonus DECIMAL(5,4) DEFAULT 0,  -- 현재 인접 보너스율
  ADD COLUMN is_headquarter BOOLEAN DEFAULT FALSE;     -- 본진 영토 여부

-- 섹터 정의 테이블
CREATE TABLE sector_definitions (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(30) UNIQUE NOT NULL,
  name_en         VARCHAR(50),
  name_ko         VARCHAR(50),
  name_ja         VARCHAR(50),
  name_zh         VARCHAR(50),
  sector_type     VARCHAR(20) NOT NULL, -- 'core', 'mid', 'frontier'
  price_multiplier DECIMAL(5,2) DEFAULT 1.0,
  mining_multiplier DECIMAL(5,2) DEFAULT 1.0,
  defense_multiplier DECIMAL(5,2) DEFAULT 1.0,
  center_x        INT,  -- 섹터 중심 X 좌표
  center_y        INT,  -- 섹터 중심 Y 좌표
  boundary_polygon TEXT, -- JSON: 섹터 경계 다각형 좌표
  is_active       BOOLEAN DEFAULT TRUE,
  lore_en         TEXT,
  lore_ko         TEXT,
  lore_ja         TEXT,
  lore_zh         TEXT,
  special_feature TEXT
);

-- 영토 가격 설정
INSERT INTO settings (key, value, description) VALUES
('land_base_price_pp', '0.1', '픽셀당 기본 PP 가격'),
('land_adjacent_discount', '0.85', '인접 구매 할인 배율'),
('land_core_price_mult', '5.0', 'Core 섹터 가격 배율'),
('land_mid_price_mult', '2.0', 'Mid 섹터 가격 배율'),
('land_frontier_price_mult', '1.0', 'Frontier 섹터 가격 배율'),
('land_center_price_mult', '1.5', '섹터 중심부 가격 배율'),
('land_min_size', '25', '최소 영토 크기 (px)'),
('land_max_single_purchase', '10000', '1회 최대 구매 크기 (px)'),
('land_max_core_pp', '20000', 'Core 1인 최대 보유 (px)'),
('land_max_mid_pp', '50000', 'Mid 1인 최대 보유 (px)'),
('land_adjacency_5_bonus', '0.05', '5개 인접 Mining 보너스'),
('land_adjacency_10_bonus', '0.10', '10개 인접 Mining 보너스'),
('land_adjacency_20_bonus', '0.20', '20개 인접 Mining 보너스');
```

---

## 3. 섹터 시스템 (심화 설계)

### 3.1 24섹터 전체 정의

```sql
-- Core 섹터 6개
INSERT INTO sector_definitions (code, name_en, name_ko, name_ja, name_zh,
  sector_type, price_multiplier, mining_multiplier, defense_multiplier,
  lore_en, special_feature) VALUES

('olympus_crown', 'Olympus Crown', '올림푸스 왕관',
  'オリンポス・クラウン', '奥林匹斯皇冠', 'core', 5.0, 1.0, 1.5,
  'Built atop the solar system''s highest volcano. The political heart of Mars. Three major corporations have fallen trying to hold this peak.',
  'Governor 세금 수입 ×1.5. 모든 섹터에서 가장 큰 정치적 명예'),

('tharsis_citadel', 'Tharsis Citadel', '타르시스 요새',
  'タルシス・シタデル', '塔尔西斯要塞', 'core', 5.0, 0.8, 2.0,
  'The volcanic plateau of Tharsis is the most defensible ground on Mars. No siege has ever succeeded here in the first attempt.',
  '방어 최강. 방어 아이템 효과 +20%. Hijack 비용 +30%'),

('pavonis_gate', 'Pavonis Gate', '파보니스 관문',
  'パヴォニス・ゲート', '帕沃尼斯门', 'core', 5.0, 1.0, 1.0,
  'Every trade route passes through Pavonis Gate. The Governor here controls the flow of goods across half of Mars.',
  '마켓 거래량 +50%. Governor 마켓세 수입 최대'),

('ascraeus_vault', 'Ascraeus Vault', '아스크라이우스 금고',
  'アスクラエウス・ヴォールト', '阿斯克拉乌斯金库', 'core', 5.0, 1.2, 1.0,
  'The underground storage networks beneath Ascraeus hold the largest GP reserves on Mars.',
  'GP 수익 +15%. Enhancement 비용 -10%'),

('arsia_forge', 'Arsia Forge', '아르시아 대장간',
  'アルシア・フォージ', '阿尔西亚熔炉', 'core', 5.0, 1.1, 1.0,
  'Volcanic heat makes Arsia the perfect forge. The best Enhancement craftspeople cluster here.',
  'Crafter 직업 버프 추가 +10%. Enhancement 성공률 +5%'),

('noctis_prime', 'Noctis Prime', '녹티스 프라임',
  'ノクティス・プライム', '诺克提斯首都', 'core', 5.0, 1.0, 1.2,
  'The labyrinth of canyons in Noctis makes it impossible to govern through force alone. Every Governor here has survived through alliances.',
  '외교 보너스. 길드 동맹 효과 +20%'),

-- Mid 섹터 10개
('marineris_east', 'Marineris East', '마리너리스 동부',
  'マリネリス東部', '水手谷东部', 'mid', 2.0, 1.2, 1.0,
  'The eastern mouth of the great canyon. New arrivals often make their first deal here.',
  '신규 유저 보호. Level 10 미만 Hijack 비용 +50%'),

('marineris_west', 'Marineris West', '마리너리스 서부',
  'マリネリス西部', '水手谷西部', 'mid', 2.0, 1.0, 1.0,
  'Merchants have called the western canyon home for three seasons.',
  'Merchant 직업 버프 추가 +10%. 마켓 수수료 -5%'),

('candor_fields', 'Candor Fields', '캔도르 평원',
  'カンドル・フィールズ', '坎多尔原野', 'mid', 2.0, 1.4, 1.0,
  'Flat, open, and fertile by Martian standards. The most consistent PP yields.',
  'Mining 수익 +40%. 가장 안정적인 수확'),

('ophir_station', 'Ophir Station', '오피르 역',
  'オフィル・ステーション', '奥菲尔站', 'mid', 2.0, 1.0, 1.0,
  'Originally a waypoint, Ophir grew into a full settlement. Guilds thrive here.',
  '길드 생성 비용 -20%. 길드 멤버 모집 속도 +20%'),

('hebes_crossing', 'Hebes Crossing', '헤베스 교차로',
  'ヘベス・クロッシング', '赫伯斯十字路', 'mid', 2.0, 1.1, 1.0,
  'Neutral ground by tradition. A place to trade and negotiate before conflicts escalate.',
  'Bounty 등록 비용 -30%. 중립 협상 지역'),

('coprates_ridge', 'Coprates Ridge', '코프라테스 능선',
  'コプラテス・リッジ', '科普拉特斯山脊', 'mid', 2.0, 0.9, 1.0,
  'Warriors come to Coprates to prove themselves.',
  'Warrior 직업 버프 추가 +10%. Hijack 성공률 +5%'),

('eos_plateau', 'Eos Plateau', '에오스 고원',
  'エオス・プラトー', '曙光高原', 'mid', 2.0, 1.0, 0.9,
  'The winds above Eos are legendary. During storm season, it becomes the most dangerous sector.',
  '모래폭풍 이벤트 집중. 폭풍 기간 보상 ×2'),

('melas_basin', 'Melas Basin', '멜라스 분지',
  'メラス・ベイスン', '梅拉斯盆地', 'mid', 2.0, 1.1, 1.0,
  'Deep in the canyon system, full of secrets. Explorers report finding artifacts.',
  'POI 풍부. 탐험 보상 +30%'),

('tithonium_scars', 'Tithonium Scars', '티토니움 상흔',
  'ティトニウム・スカーズ', '塔托尼乌姆伤疤', 'mid', 2.0, 1.0, 0.8,
  'The most betrayals per capita on Mars. The most dramatic siege upsets.',
  'Siege 비용 -20%. 배신의 땅 — 전략적 공격에 유리'),

('syria_planum', 'Syria Planum', '시리아 평원',
  'シリア・プラナム', '叙利亚平原', 'mid', 2.0, 1.3, 1.1,
  'One of the few truly flat regions of Mars. Steady, reliable, boring.',
  'Mining 안정성 최고. 날씨 이벤트 없음'),

-- Frontier 섹터 8개
('hellas_abyss', 'Hellas Abyss', '헬라스 심연',
  'ヘラス・アビス', '赫拉斯深渊', 'frontier', 1.0, 2.0, 0.7,
  'The deepest impact crater on Mars. Ancient Metal has been found here that appears nowhere else.',
  '희귀 자원 확률 최고. Ancient Metal 독점. 위험도 최상'),

('elysium_wastes', 'Elysium Wastes', '엘리시움 황무지',
  'エリシウム・ウェイスツ', '极乐世界废土', 'frontier', 1.0, 1.5, 0.8,
  'When rockets fail, they crash in Elysium. The sector is littered with salvageable cargo.',
  '로켓 낙하 다발. Meteorite Fragment 획득률 ×3'),

('utopia_flats', 'Utopia Flats', '유토피아 평지',
  'ユートピア・フラッツ', '乌托邦平地', 'frontier', 1.0, 1.3, 0.9,
  'Named ironically. Exploration teams keep finding things underground.',
  'POI 탐험 최다. 탐험 보상 +50%'),

('arcadia_ridge', 'Arcadia Ridge', '아르카디아 능선',
  'アルカディア・リッジ', '阿卡迪亚山脊', 'frontier', 1.0, 1.2, 1.0,
  'The veterans who settled here first made a pact: no attacking accounts younger than 14 days.',
  '신규 유저 전통적 보호 구역. 온보딩 추천 섹터'),

('cerberus_scars', 'Cerberus Scars', '케르베로스 상흔',
  'ケルベロス・スカーズ', '地狱三头犬伤疤', 'frontier', 1.0, 1.8, 0.6,
  'Three independent power bases have fought for control since Season 1. None has won.',
  '고위험 고수익. 상시 전투. Hijack 비용 -10% (공격자 유리)'),

('phlegra_deep', 'Phlegra Deep', '플레그라 심부',
  'プレグラ・ディープ', '弗莱格拉深处', 'frontier', 1.0, 1.6, 0.9,
  'The ice formations in Phlegra are unlike anywhere else. Ice Crystal found here is premium.',
  'Ice Crystal 확률 ×2. 냉각 자원 특화'),

('amazonis_sink', 'Amazonis Sink', '아마조니스 함몰지',
  'アマゾニス・シンク', '亚马逊尼斯沉降地', 'frontier', 1.0, 1.4, 1.1,
  'The geological stability of Amazonis makes it an anomaly in the Frontier. No earthquakes.',
  '가장 안전한 Frontier. 날씨 이벤트 없음'),

('borealis_edge', 'Borealis Edge', '보레알리스 끝자락',
  'ボレアリス・エッジ', '北极边缘', 'frontier', 1.0, 1.5, 0.8,
  'The northernmost territory on Mars. Supply lines take three times as long. Isolation has value.',
  '특수 아이템 드롭 보너스. Bounty Hunter 우세');
```

### 3.2 섹터 진입 제한

```sql
-- 섹터별 영토 구매 Level 제한
CREATE TABLE sector_entry_requirements (
  id              SERIAL PRIMARY KEY,
  sector_code     VARCHAR(30) UNIQUE NOT NULL REFERENCES sector_definitions(code),
  min_level       INT DEFAULT 0,
  required_mid_territories INT DEFAULT 0,  -- Core 진입 시 Mid 영토 필요 수
  is_active       BOOLEAN DEFAULT TRUE
);

INSERT INTO sector_entry_requirements (sector_code, min_level, required_mid_territories)
SELECT code, 
  CASE sector_type
    WHEN 'frontier' THEN 0
    WHEN 'mid' THEN 10
    WHEN 'core' THEN 25
  END,
  CASE sector_type WHEN 'core' THEN 1 ELSE 0 END
FROM sector_definitions;

-- settings
INSERT INTO settings (key, value) VALUES
('sector_mid_min_level', '10', 'Mid 섹터 최소 레벨'),
('sector_core_min_level', '25', 'Core 섹터 최소 레벨'),
('sector_core_mid_required', '1', 'Core 진입 필요 Mid 영토 수');
```

### 3.3 섹터별 Governor 시스템

```sql
-- 섹터 거버넌스 상태
CREATE TABLE sector_governance (
  id                    SERIAL PRIMARY KEY,
  sector_code           VARCHAR(30) UNIQUE NOT NULL REFERENCES sector_definitions(code),
  governor_user_id      INT REFERENCES users(id),
  governor_since        TIMESTAMP,
  tax_rate              DECIMAL(5,2) DEFAULT 2.0,     -- 0~10%
  market_cut_rate       DECIMAL(5,4) DEFAULT 0.01,    -- 마켓 거래 자동 귀속
  sector_policy         VARCHAR(20) DEFAULT 'open',   -- 'open','ally_only','closed'
  declaration_text      TEXT,                          -- 공개 선언문
  declaration_updated   TIMESTAMP,
  total_tax_collected   DECIMAL(20,8) DEFAULT 0,
  active_siege_id       INT,                          -- 진행 중 Siege
  created_at            TIMESTAMP DEFAULT NOW()
);

-- 모든 24섹터 초기 거버넌스 레코드
INSERT INTO sector_governance (sector_code)
SELECT code FROM sector_definitions;
```

### 3.4 섹터 지도 표시 API

```javascript
// GET /api/public/sectors
// 각 섹터의 실시간 현황 반환

{
  sectors: [{
    code: 'hellas_abyss',
    name: 'Hellas Abyss',
    type: 'frontier',
    governor: {
      nickname: 'KimWarrior',
      guild_tag: 'DK',
      since: '2026-04-01T00:00:00Z',
      days: 23
    },
    tax_rate: 5,
    policy: 'open',
    active_siege: null,
    pixels_claimed: 34200,
    pixels_total: 210000,
    occupancy_rate: 0.163,
    mining_multiplier: 2.0,
    rare_resource_bonus: true,
    price_multiplier: 1.0,
    active_users_24h: 47,
    lore_snippet: 'The deepest impact crater on Mars...'
  }]
}
```

---

## 4. 영토 점령 (Claim) 상세 흐름

### 4.1 클레임 절차

```
Step 1: 지도에서 영역 드래그 선택
  → 크기 표시 (W × H px)
  → 섹터 자동 감지
  → 가격 실시간 계산 (인접 할인 포함)
  → 섹터 Level 제한 체크

Step 2: 구매 확인 모달
  → 영역 좌표 표시
  → 최종 가격 PP 표시
  → Governor 세금 안내 (현재 세율)
  → [확인] 클릭

Step 3: 처리
  → PP 차감
  → claims 레코드 생성
  → cluster_id 업데이트 (인접 영토 클러스터 재계산)
  → adjacency_bonus 업데이트
  → Mining 시작 (4시간 타이머)
  → Governor 마켓세 설정 반영

Step 4: 완료
  → 지도에 내 영토 표시 (내 색상)
  → 이미지 업로드 유도
  → "첫 영토 점령!" 알림 + XP 지급
```

### 4.2 영토 크기별 가격 예시 (Frontier 기준)

```
25px  (5×5):   2.5 PP    → 입문
100px (10×10): 10 PP     → 기본
400px (20×20): 40 PP     → 소형
1600px(40×40): 160 PP    → 중형
10000px(100×100): 1000 PP → 대형 (1회 최대)
```

### 4.3 영토 커스터마이징 (기존 유지)

```
이미지 업로드 (PNG/JPG/GIF, 5MB)
링크 연결 (외부 URL)
강화된 코스메틱 장착:
  Border 슬롯 (+N 강화 border 아이템)
  Glow 슬롯 (+N 강화 glow 아이템)
  Terrain 슬롯 (+N 강화 terrain 아이템)
이름 설정
```

---

## 5. Hijack (영토 탈취) 상세

### 5.1 기본 Hijack

```
공격자가 적 영토 선택 →
비용: 원래 가격의 1.2배 + 현재 가격 인상분 →
피해자: 100% 환불 + 10% 보너스 →
플랫폼 수수료: 거래액의 10%

공격자 지불: 1.2 × 현재 가격
피해자 수령: 원래 가격 + 10%
플랫폼 수익: 나머지
```

### 5.2 Hijack 성공/실패 판정

```yaml
기본 성공률: 100% (방어 아이템 없을 때)

방어 아이템 효과:
  Basic Shield: -20% 성공률 → 80% 성공
  Advanced Shield: -50% 성공률 → 50% 성공

Warrior 직업 공격자:
  hijack_success 버프 ×1.2 적용
  예: Advanced Shield 있는 방어자 공격 시
      50% × 1.2 = 60% 성공률

Tharsis Citadel 섹터:
  방어 효과 추가 +20% → Advanced Shield 상태에서 30% 성공률로 감소
```

### 5.3 Hijack 결과 처리

```javascript
async function processHijack(attackerId, claimId) {
  // 1. 검증
  const claim = await getClaim(claimId);
  if (claim.marketplace_locked) return { error: 'listing_locked' };
  if (claim.user_id === attackerId) return { error: 'self_attack' };

  // 2. 비용 계산
  const hijackCost = claim.price_paid_pp * settings('hijack_cost_multiplier'); // 1.2
  const defenderRefund = claim.price_paid_pp * settings('hijack_refund_multiplier'); // 1.1

  // 3. 직업 버프 적용
  const successBuff = await jobService.getJobBuff(attackerId, 'warrior_hijack_success', 1.0);
  const defenseBuff = await jobService.getJobBuff(claim.user_id, 'warrior_defense_item_effect', 1.0);

  // 4. 방어 아이템 체크
  const shieldEffect = await getActiveShieldEffect(claim.id);

  // 5. 성공률 계산
  let successRate = 1.0 - shieldEffect;
  successRate *= successBuff;
  successRate *= getSectorHijackModifier(claim.sector_code);

  // 6. 성공/실패
  const success = Math.random() < successRate;

  if (success) {
    // 영토 이전
    await transferClaim(claim.id, attackerId, hijackCost);
    await refundDefender(claim.user_id, defenderRefund);
    await chargeAttacker(attackerId, hijackCost);
    await logHijack(attackerId, claim.user_id, claim.id, hijackCost);
    await chronicleService.checkHijackRecord(attackerId, claim.user_id, claim.id, hijackCost);
    return { success: true, cost: hijackCost };
  } else {
    // 방어 성공 — 비용 30% 소각 (패널티)
    const failPenalty = hijackCost * 0.30;
    await chargeAttacker(attackerId, failPenalty);
    return { success: false, penalty: failPenalty };
  }
}
```

### 5.4 Hijack 방어 아이템 목록 (기존 유지 + 수정)

```yaml
Basic Shield:
  효과: Hijack 성공률 -20%
  지속시간: 24시간
  가격: settings('item_basic_shield_gp') = 50 GP
  수량: 소모품 (1회 사용)

Advanced Shield:
  효과: Hijack 성공률 -50%
  지속시간: 24시간
  가격: settings('item_adv_shield_gp') = 150 GP

Fortress Protocol (신규):
  효과: Hijack 성공률 -70%
  지속시간: 12시간 (짧지만 강력)
  가격: 400 GP 또는 2 USDT
  사용처: Siege 방어 기간에 주로 사용

공격 아이템 (기존 유지):
  EMP: 상대방 방어 아이템 일시 해제 (6시간)
  Orbital Strike: 강제 Hijack 성공률 +30%
  Virus: 상대방 Mining 수익 -50% (48시간)
  Decoy: 가짜 영토 생성 (공격자 비용 낭비 유도)
```
# PART 3: Mining · 자원 · 직업 시스템

---

## 1. Mining 시스템 (심화 재설계)

### 1.1 현재 구조의 문제점
```
현재: 4시간 대기 → Harvest 클릭 → PP 획득 → 반복
문제: 수동적, 전략 없음, "농사 클릭 게임"
```

### 1.2 Mining 3단계 구조

**1단계 — 자동 채굴 (Passive Mining)**
```
영토를 보유하면 시간마다 자동으로 자원 축적
4시간마다 Harvest 가능 (기존 유지)
수익: PP + 자원 드롭 (섹터별 차등)
Miner 직업: 수익 ×1.5
```

**2단계 — 능동 채굴 (Active Prospecting) [신규]**
```
4시간 중간에 "탐사하기" 버튼 클릭 (무제한, 하지만 수익 고정)
클릭마다 소량 자원 즉시 획득 (PP 아님)
일일 능동 채굴 횟수 제한: 10회 (settings 조정)
목적: 기다리는 사람 + 클릭하는 사람 모두 수용
Miner 직업: 일일 횟수 +5회
```

**3단계 — 심화 채굴 (Deep Dig) [신규]**
```
특정 Frontier 섹터에서만 가능
Deep Dig: GP 50 소모 → 즉시 희귀 자원 드롭 시도
성공률: 30% (실패 시 GP 소각)
보상: rare/special 자원 1~3개
일일 3회 제한 (Miner 직업: 일일 5회)
목적: GP Sink + Miner 직업의 핵심 수익 루트
```

### 1.3 Mining 수익 계산

```javascript
async function calculateHarvestYield(userId, claimId) {
  const claim = await getClaim(claimId);
  const sector = await getSector(claim.sector_code);
  const timeDelta = Date.now() - claim.last_harvested_at;
  const hours = timeDelta / (1000 * 60 * 60);

  // 기본 수익
  const baseRate = settings('mining_base_rate_pp_per_px_per_4h'); // 기본 0.001
  let ppYield = claim.pixel_count * baseRate * (hours / 4);

  // 섹터 Mining 배율 적용
  ppYield *= sector.mining_multiplier;

  // 인접 보너스 적용
  ppYield *= (1 + claim.adjacency_bonus);

  // 직업 버프 적용
  const jobBuff = await jobService.getJobBuff(userId, 'miner_mining_rate', 1.0);
  ppYield *= jobBuff;

  // Governor 섹터 Mining 버프 적용
  const sectorBuff = await getSectorMiningBuff(claim.sector_code);
  ppYield *= sectorBuff;

  // 날씨 이벤트 적용 (폭풍 시 Miner 추가 보너스)
  const weatherBuff = await getWeatherMiningBuff(claim.sector_code);
  ppYield *= weatherBuff;

  // 자원 드롭 계산 (별도)
  const resources = await rollResourceDrop(userId, claim.sector_code);

  return { pp: Math.floor(ppYield), resources };
}
```

---

## 2. 자원 시스템

### 2.1 자원 6종

| 코드 | 이름 (EN/KO) | 희귀도 | 아이콘 | 주 획득처 |
|---|---|---|---|---|
| `iron_dust` | Iron Dust / 철 먼지 | Common | 🟤 | 모든 섹터 Mining |
| `red_sand` | Red Sand / 붉은 모래 | Common | 🔴 | Frontier Mining |
| `ice_crystal` | Ice Crystal / 얼음 결정 | Rare | 🔵 | Phlegra Deep 특화 |
| `volcanic_shard` | Volcanic Shard / 화산 파편 | Rare | 🌋 | Frontier + 모래폭풍 |
| `ancient_metal` | Ancient Metal / 고대 금속 | Special | ⭐ | Hellas Abyss 극소 |
| `meteorite_fragment` | Meteorite Fragment / 운석 파편 | Special | ☄️ | 로켓 이벤트 |

### 2.2 DB 구조

```sql
CREATE TABLE resources (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(30) UNIQUE NOT NULL,
  name_en         VARCHAR(50) NOT NULL,
  name_ko         VARCHAR(50),
  name_ja         VARCHAR(50),
  name_zh         VARCHAR(50),
  rarity          VARCHAR(20) DEFAULT 'common',
  icon_emoji      VARCHAR(10),
  base_pp_value   DECIMAL(10,2) DEFAULT 1.0,
  is_tradeable    BOOLEAN DEFAULT TRUE,
  is_active       BOOLEAN DEFAULT TRUE
);

-- 섹터별 자원 산출 확률
CREATE TABLE sector_resource_rates (
  id              SERIAL PRIMARY KEY,
  sector_code     VARCHAR(30) NOT NULL REFERENCES sector_definitions(code),
  resource_code   VARCHAR(30) NOT NULL REFERENCES resources(code),
  base_drop_rate  DECIMAL(6,5) NOT NULL,  -- 0~1
  miner_bonus     DECIMAL(6,5) DEFAULT 0, -- Miner 직업 추가 확률
  UNIQUE(sector_code, resource_code)
);

-- 유저 자원 인벤토리
CREATE TABLE user_resource_inventory (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id),
  resource_id INT NOT NULL REFERENCES resources(id),
  quantity    BIGINT DEFAULT 0,
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, resource_id)
);
```

### 2.3 섹터별 자원 산출 확률 (초기 데이터)

```sql
-- Frontier 섹터 기본 (Arcadia Ridge 예시)
INSERT INTO sector_resource_rates VALUES
('arcadia_ridge', 'iron_dust',          0.50, 0.10),
('arcadia_ridge', 'red_sand',           0.30, 0.05),
('arcadia_ridge', 'ice_crystal',        0.08, 0.04),
('arcadia_ridge', 'volcanic_shard',     0.05, 0.02),
('arcadia_ridge', 'ancient_metal',      0.01, 0.01),
('arcadia_ridge', 'meteorite_fragment', 0.00, 0.00);

-- Hellas Abyss (특화)
('hellas_abyss', 'iron_dust',           0.30, 0.05),
('hellas_abyss', 'red_sand',            0.20, 0.03),
('hellas_abyss', 'ice_crystal',         0.15, 0.07),
('hellas_abyss', 'volcanic_shard',      0.15, 0.07),
('hellas_abyss', 'ancient_metal',       0.05, 0.05),  -- 독점적 높은 확률
('hellas_abyss', 'meteorite_fragment',  0.00, 0.00);

-- Phlegra Deep (얼음 특화)
('phlegra_deep', 'iron_dust',           0.30, 0.05),
('phlegra_deep', 'red_sand',            0.10, 0.02),
('phlegra_deep', 'ice_crystal',         0.35, 0.10),  -- 최고 확률
('phlegra_deep', 'volcanic_shard',      0.05, 0.02),
('phlegra_deep', 'ancient_metal',       0.01, 0.01),
('phlegra_deep', 'meteorite_fragment',  0.00, 0.00);

-- Mid 섹터 (일반)
('candor_fields', 'iron_dust',          0.55, 0.08),
('candor_fields', 'red_sand',           0.25, 0.04),
('candor_fields', 'ice_crystal',        0.05, 0.02),
('candor_fields', 'volcanic_shard',     0.03, 0.01),
('candor_fields', 'ancient_metal',      0.00, 0.00),
('candor_fields', 'meteorite_fragment', 0.00, 0.00);

-- Core 섹터 (자원 빈약, 정치 중심)
('olympus_crown', 'iron_dust',          0.40, 0.05),
('olympus_crown', 'red_sand',           0.15, 0.02),
('olympus_crown', 'ice_crystal',        0.02, 0.01),
('olympus_crown', 'volcanic_shard',     0.01, 0.00),
('olympus_crown', 'ancient_metal',      0.00, 0.00),
('olympus_crown', 'meteorite_fragment', 0.00, 0.00);
```

### 2.4 자원 활용처

```yaml
1. 마켓플레이스 직접 판매:
   Miner → 자원 채굴 → 마켓 등록 → Crafter/기타 유저가 구매

2. Enhancement 강화 재료 (선택적 소모):
   +7 이상 시도 시 자원 소모 → 성공률 상승
   ice_crystal 3개: 성공률 +8%
   volcanic_shard 2개: 파괴 확률 -15%
   ancient_metal 1개: 성공률 +20%
   (자원 소모는 선택, GP만으로도 가능)

3. Governor Siege 방어 강화:
   volcanic_shard 10개: Siege 기간 방어 +10%
   (Governor가 약자 자원을 사야 하는 구조)

4. 특수 아이템 제작:
   meteorite_fragment 5개 → Meteorite Shield 제작
   ancient_metal 3개 + volcanic_shard 5개 → Legendary Border 코스메틱

5. 길드 연구 재료 (Phase 후반):
   길드 연구소에서 자원 투입 → 길드 버프 강화
```

---

## 3. 직업 시스템 (완전 설계)

### 3.1 직업 철학

직업은 **"나는 어떤 방식으로 화성에서 살아남는가"**를 정의한다.

선택 후 모든 게임 경험이 달라진다:
- 보이는 것: 다른 섹터 추천, 다른 미션 강조
- 느끼는 것: 다른 강점·약점
- 만나는 사람: 길드에서 다른 역할 담당

### 3.2 4개 직업 완전 스펙

#### ⛏️ MINER (광부)

**콘셉트**: 위험한 Frontier에서 자원을 캐는 전문가. 싸움은 못하지만 제일 많이 번다.

**추천 섹터**: Hellas Abyss, Phlegra Deep, Cerberus Scars

**버프 수치** (모두 settings 저장):
```yaml
miner_mining_rate: 1.50          # Mining PP 수익 +50%
miner_harvest_cooldown: 0.70     # Harvest 쿨다운 ×0.7 (2.8시간)
miner_active_prospecting: 5      # 일일 능동 채굴 횟수 +5 (총 15)
miner_deep_dig_daily: 5          # 일일 Deep Dig 횟수 (일반 3→5)
miner_poi_reward: 1.40           # POI 탐험 보상 +40%
miner_rare_resource_chance: 1.30 # 희귀 자원 발견 확률 +30%
miner_resource_drop_quantity: 1.20 # 자원 드롭 수량 +20%
miner_combat_power: 0.70         # 전투력 -30% (약점)
miner_enhancement_success: 0.95  # 강화 성공률 -5%
miner_market_fee: 1.00           # 마켓 수수료 변화 없음
```

**핵심 수익 루트**:
```
Frontier 영토 Mining → 자원 대량 확보 →
마켓플레이스 판매 → GP/PP 수익 →
더 많은 Frontier 영토 구매 → 반복
```

**약점 보완책**:
- 길드 가입 → Warrior 보호 받기
- Basic Shield 아이템으로 최소 방어
- Arcadia Ridge같은 신규자 보호 섹터 이용

---

#### ⚔️ WARRIOR (전사)

**콘셉트**: 공격과 방어가 전문. Hijack으로 직접 돈 버는 유일한 직업.

**추천 섹터**: Coprates Ridge, Tithonium Scars, Cerberus Scars

**버프 수치**:
```yaml
warrior_combat_power: 1.30           # 전투력 +30%
warrior_hijack_success: 1.20         # Hijack 성공률 ×1.2
warrior_hijack_damage: 1.15          # Hijack 시 추가 PP 탈취 +15%
warrior_defense_item_effect: 1.25    # 방어 아이템 효과 +25%
warrior_attack_item_effect: 1.20     # 공격 아이템 효과 +20%
warrior_siege_participation: 1.50    # Siege 기간 영토 구매 비용 -33%
warrior_spy_resistance: 1.30         # Decoy 아이템에 속을 확률 -30%
warrior_mining_rate: 0.80            # Mining 수익 -20%
warrior_enhancement_success: 0.90   # 강화 성공률 -10%
warrior_market_fee: 1.00
```

**핵심 수익 루트**:
```
타겟 영토 선별 → Hijack 성공 → 영토 확보 또는 즉시 재판매 →
Bounty 사냥 → 보상 수령 →
Guild War 참여 → 길드 보상
```

**전략적 역할**:
- 길드의 공격 첨병
- Siege 참여로 섹터 정치 참여
- 고래 영토를 Bounty 대상으로 삼아 고수익

---

#### 🔨 CRAFTER (제작자)

**콘셉트**: Enhancement 전문가. 시장에 고가 아이템을 공급한다.

**추천 섹터**: Arsia Forge, Ascraeus Vault, Pavonis Gate

**버프 수치**:
```yaml
crafter_enhancement_success: 1.30       # 강화 성공률 +30%
crafter_enhancement_cost: 0.80          # 강화 GP 비용 -20%
crafter_enhancement_break_protection: 0.40 # 파괴 확률 ×0.4 (60% 감소)
crafter_enhancement_material_saving: 0.85  # 자원 소모 -15%
crafter_daily_enhancement_limit: 20     # 일일 강화 시도 +5 (기본 15→20)
crafter_special_recipe_unlock: true     # 특수 제작 레시피 접근 가능
crafter_mining_rate: 0.80
crafter_combat_power: 0.80
crafter_market_fee: 0.90                # 마켓 수수료 -10%
```

**핵심 수익 루트**:
```
마켓에서 자원 구매 (또는 Mining으로 소량 확보) →
Enhancement +7/+8/+9/+10 도전 (일반보다 훨씬 높은 성공률) →
고강화 코스메틱 마켓 판매 (프리미엄 가격) →
자원 재구매 → 반복
```

**왜 필요한가**:
- Crafter 없으면 +10 아이템이 시장에 없다
- Warrior가 Siege에 쓸 방어 강화 아이템을 Crafter가 공급
- 자원 수요자 (Miner에게 돈이 흘러가는 핵심)

---

#### 💼 MERCHANT (상인)

**콘셉트**: 거래 전문가. 가장 낮은 수수료로 가장 많은 리스팅 가능.

**추천 섹터**: Pavonis Gate, Marineris West, Ophir Station

**버프 수치**:
```yaml
merchant_market_fee: 0.65                   # 마켓 수수료 35% 할인 (5%→3.25%)
merchant_auction_fee: 0.65                  # 옥션 수수료 35% 할인
merchant_listing_limit: 2.00               # 최대 리스팅 2배 (20→40개)
merchant_price_history_days: 60            # 가격 히스토리 60일 (기본 7일)
merchant_market_insight: true              # 최근 10건 거래 가격 열람 가능
merchant_governor_market_cut_reduction: 0.50 # Governor 마켓세 50% 면제
merchant_cross_sector_fee: 0.85            # 섹터 간 이동 비용 -15% (Phase 2b)
merchant_mining_rate: 0.85
merchant_combat_power: 0.80
merchant_enhancement_success: 0.95
```

**핵심 수익 루트**:
```
섹터별 자원/아이템 가격 차이 파악 →
싼 섹터에서 구매 → 비싼 섹터에서 판매 (차익 거래) →
또는 Miner에게서 자원 대량 구매 → Crafter에게 판매 (중간상인) →
또는 강화 코스메틱 독점 리스팅 → 시장 가격 형성
```

**왜 필요한가**:
- 수수료 차이가 대량 거래 시 수백 GP 절약
- 섹터 간 가격 정보 독점 → 차익 거래 수익
- 마켓 유동성 공급자 역할

---

### 3.3 직업 선택 및 변경 규칙

```yaml
최초 선택:
  시점: 온보딩 Step 1 (튜토리얼 시작 시)
  Level 제한: Level 5 이상 버프 활성화
              Level 5 미만은 선택만 하고 버프는 없음
  취소: 선택 완료 전까지 자유

변경:
  무료: 주 1회 (weekly_job_change_count 기준, 월요일 00:00 UTC 리셋)
  유료: 50 GP (settings: job_change_cost_gp)
  쿨다운: 변경 후 24시간 내 재변경 불가
  제한사항:
    - 마켓에 활성 리스팅이 있으면 Merchant → 타 직업 변경 불가
    - Enhancement 진행 중이면 Crafter → 타 직업 변경 불가
    - Siege 참여 중이면 변경 불가
```

### 3.4 DB 스키마

```sql
-- 직업 정의
CREATE TABLE jobs (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(20) UNIQUE NOT NULL,
  name_en         VARCHAR(50),
  name_ko         VARCHAR(50),
  name_ja         VARCHAR(50),
  name_zh         VARCHAR(50),
  description_en  TEXT,
  description_ko  TEXT,
  description_ja  TEXT,
  description_zh  TEXT,
  icon_emoji      VARCHAR(10),
  color_hex       VARCHAR(7),
  recommended_sector VARCHAR(30),
  is_active       BOOLEAN DEFAULT TRUE,
  sort_order      INT DEFAULT 0
);

-- 직업별 버프
CREATE TABLE job_buffs (
  id          SERIAL PRIMARY KEY,
  job_id      INT NOT NULL REFERENCES jobs(id),
  buff_key    VARCHAR(60) NOT NULL,
  buff_value  DECIMAL(10,4) NOT NULL,
  description TEXT,
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(job_id, buff_key)
);

-- users 테이블 컬럼 추가
ALTER TABLE users ADD COLUMN current_job_id      INT REFERENCES jobs(id);
ALTER TABLE users ADD COLUMN job_selected_at     TIMESTAMP;
ALTER TABLE users ADD COLUMN job_changed_at      TIMESTAMP;
ALTER TABLE users ADD COLUMN weekly_job_changes  INT DEFAULT 0;
ALTER TABLE users ADD COLUMN weekly_reset_at     TIMESTAMP DEFAULT NOW();

-- 직업 변경 로그
CREATE TABLE job_change_log (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id),
  from_job_id INT REFERENCES jobs(id),
  to_job_id   INT NOT NULL REFERENCES jobs(id),
  change_type VARCHAR(20),  -- 'free', 'paid', 'onboarding'
  gp_cost     INT DEFAULT 0,
  changed_at  TIMESTAMP DEFAULT NOW()
);

-- 초기 데이터
INSERT INTO jobs (code, name_en, name_ko, name_ja, name_zh, icon_emoji, color_hex, sort_order)
VALUES
('miner',    'Miner',    '광부',   'マイナー',   '矿工', '⛏️', '#F4A460', 1),
('warrior',  'Warrior',  '전사',   'ウォリアー', '战士', '⚔️', '#DC143C', 2),
('crafter',  'Crafter',  '제작자', 'クラフター', '制作者','🔨', '#9370DB', 3),
('merchant', 'Merchant', '상인',   'マーチャント','商人', '💼', '#20B2AA', 4);
```

### 3.5 버프 적용 서비스 (services/job.js)

```javascript
/**
 * services/job.js
 * 핵심 원칙: 모든 수치는 DB에서 조회. 하드코딩 금지.
 * 성능: 10분 메모리 캐시 (빈번 조회 최적화)
 */

const jobBuffCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10분

async function getJobBuff(userId, buffKey, defaultValue = 1.0) {
  const cacheKey = `${userId}:${buffKey}`;
  const cached = jobBuffCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const result = await db.query(`
    SELECT jb.buff_value
    FROM users u
    LEFT JOIN job_buffs jb ON jb.job_id = u.current_job_id AND jb.buff_key = $2
    WHERE u.id = $1
  `, [userId, buffKey]);

  const value = result.rows.length > 0 && result.rows[0].buff_value !== null
    ? parseFloat(result.rows[0].buff_value)
    : defaultValue;

  jobBuffCache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL });
  return value;
}

// 직업 변경 시 캐시 무효화
function invalidateJobCache(userId) {
  for (const key of jobBuffCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      jobBuffCache.delete(key);
    }
  }
}

async function selectJob(userId, jobCode) {
  const user = await getUser(userId);
  const job = await getJobByCode(jobCode);

  // 레벨 체크 (버프 활성화 조건)
  const requiredLevel = parseInt(await getSetting('job_required_level'));

  // 무료/유료 판단
  const weeklyLimit = parseInt(await getSetting('job_change_weekly_free'));
  const isFree = user.weekly_job_changes < weeklyLimit || !user.current_job_id;

  if (!isFree) {
    const cost = parseInt(await getSetting('job_change_cost_gp'));
    const userGP = await getUserGP(userId);
    if (userGP < cost) return { success: false, error: 'insufficient_gp' };
    await deductGP(userId, cost);
  }

  // 변경 처리
  await db.query(`
    UPDATE users SET
      current_job_id = $2,
      job_changed_at = NOW(),
      weekly_job_changes = weekly_job_changes + 1
    WHERE id = $1
  `, [userId, job.id]);

  await logJobChange(userId, user.current_job_id, job.id, isFree ? 'free' : 'paid');
  invalidateJobCache(userId);

  return { success: true, job, costPaid: isFree ? 0 : cost };
}
```

### 3.6 기존 함수 수정 포인트 (각 1~3줄 추가)

```javascript
// services/mining.js 수정 (2줄 추가)
async function processHarvest(userId, claimId) {
  let { pp, resources } = await calculateHarvestYield(userId, claimId);
  // ✅ 추가
  const miningBuff = await jobService.getJobBuff(userId, 'miner_mining_rate', 1.0);
  pp = Math.floor(pp * miningBuff);
  // ...기존 로직 유지
}

// services/hijack.js 수정 (3줄 추가)
async function processHijack(attackerId, claimId) {
  // ✅ 추가
  const hijackBuff = await jobService.getJobBuff(attackerId, 'warrior_hijack_success', 1.0);
  const defenseBuff = await jobService.getJobBuff(defenderId, 'warrior_defense_item_effect', 1.0);
  // successRate 계산에 버프 반영
  // ...기존 로직 유지
}

// services/enhancement.js 수정 (4줄 추가)
async function attemptEnhancement(userId, instanceId, materialResources) {
  // ✅ 추가
  const successBuff = await jobService.getJobBuff(userId, 'crafter_enhancement_success', 1.0);
  const costBuff = await jobService.getJobBuff(userId, 'crafter_enhancement_cost', 1.0);
  const breakBuff = await jobService.getJobBuff(userId, 'crafter_enhancement_break_protection', 1.0);
  // 각 수치에 버프 반영
  // ...기존 로직 유지
}

// services/marketplace.js 수정 (3줄 추가)
async function createListing(userId, itemData, price, currency) {
  // ✅ 추가
  const feeBuff = await jobService.getJobBuff(userId, 'merchant_market_fee', 1.0);
  const limitBuff = await jobService.getJobBuff(userId, 'merchant_listing_limit', 1.0);
  const baseLimit = parseInt(await getSetting('marketplace_max_listings'));
  const userLimit = Math.floor(baseLimit * limitBuff);
  // ...기존 로직 유지
}
```

---

## 4. 날씨 이벤트 (수정: 전략적 이벤트로 전환)

### 4.1 기존 → 수정

```
기존: 랜덤 채굴률 버프/디버프 (예고 없음)
수정: 예고된 전략 기회
```

### 4.2 날씨 이벤트 흐름

```
Step 1 — 예보 발령 (이벤트 48시간 전):
  Admin 또는 자동 스케줄러가 모래폭풍 예보 설정
  전체 공지 (in-game Live Feed + Telegram + Discord)
  "⚠️ Eos Plateau에 48시간 후 거대 모래폭풍 예정"

Step 2 — 전략 준비 기간 (48시간):
  플레이어들이 공격/방어 전략 수립
  Warrior들이 공격 타겟 물색
  Miner들이 Siege 전 자원 비축

Step 3 — 폭풍 발생 (6시간):
  해당 섹터 효과:
    - Hijack 비용 -20% (공격자 유리)
    - 방어 아이템 효과 -15% (방어자 불리)
    - 희귀 자원 드롭률 +50% (위험 감수 보상)
    - Miner 직업은 폭풍 기간 추가 자원 ×1.5

Step 4 — 사후 기록:
  폭풍 기간 발생한 대형 Hijack → Chronicle 자동 기록
  "Eos Plateau 폭풍 속 전투"로 서사화
```

### 4.3 날씨 DB

```sql
CREATE TABLE weather_events (
  id              SERIAL PRIMARY KEY,
  sector_code     VARCHAR(30) REFERENCES sector_definitions(code),
  event_type      VARCHAR(30) DEFAULT 'dust_storm',
  status          VARCHAR(20) DEFAULT 'forecast', -- 'forecast','active','ended'
  forecast_at     TIMESTAMP NOT NULL,  -- 예보 발령 시각
  starts_at       TIMESTAMP NOT NULL,
  ends_at         TIMESTAMP NOT NULL,
  hijack_cost_mod DECIMAL(5,4) DEFAULT 0.80,    -- 0.80 = -20%
  defense_mod     DECIMAL(5,4) DEFAULT 0.85,    -- 0.85 = -15%
  resource_mod    DECIMAL(5,4) DEFAULT 1.50,    -- 1.50 = +50%
  created_at      TIMESTAMP DEFAULT NOW()
);

INSERT INTO settings (key, value) VALUES
('weather_forecast_hours', '48', '예보 발령 선행 시간'),
('weather_duration_hours', '6', '폭풍 지속 시간'),
('weather_monthly_events', '3', '월 최대 날씨 이벤트 수');
```
# PART 4: Governor · Siege · 길드 · 서사 엔진

---

## 1. Governor 시스템 (완전 재설계)

### 1.1 Governor 정의

```
섹터 내 가장 많은 픽셀을 보유한 개인 유저
(길드 아님, 개인 기준)
자동 갱신: 매일 00:00 UTC 섹터별 최대 보유자 확인
```

### 1.2 Governor 권한 전체 목록

| 권한 | 설명 | 제한 |
|---|---|---|
| **세율 설정** | 0~10% (settings 최대값) | 1일 1회 변경 |
| **마켓세 귀속** | 섹터 마켓 거래의 1% 자동 귀속 | 변경 불가 (고정) |
| **섹터 정책** | open/ally_only/closed | 1일 1회 변경 |
| **현상금 게시** | 세금 수입으로 현상금 등록 | 일 3회 |
| **공개 선언문** | 섹터 전체 메시지 발송 | 1일 1회, 5 GP |
| **Mining 버프** | 섹터 전체 Mining +10~+20% | 세금으로 구매 |
| **방어 버프** | 섹터 전체 방어 +5~+10% | 세금으로 구매 |
| **거래 버프** | 섹터 마켓 수수료 -5% | 세금으로 구매 |

### 1.3 Governor 수익 구조

```yaml
수입원:
  1. 세율 × 섹터 내 모든 Mining 수익 (자동 징수)
     예: 섹터 일일 Mining 총액 1000 PP × 5% = 50 PP/일
  2. 섹터 마켓 거래액의 1% 자동 귀속
     예: 일일 마켓 거래 5000 GP × 1% = 50 GP/일
  3. 시즌 포인트 2배 획득

지출처:
  세금 수입은 버프/아이템 구매에만 사용 가능
  영토 구매에는 사용 불가 (권력 재생산 방지)
```

### 1.4 Governor 딜레마 설계

```
높은 세율 (10%) → 단기 수입 최대
  → 주민 불만 증가
  → 이탈 또는 반란 동기 부여
  → Siege 도전자 등장

낮은 세율 (0~2%) → 주민 만족
  → 거주자 증가 → 영토 가격 상승 → 자산가치 상승
  → 하지만 수입 없어서 버프 구매 불가

균형점: 3~5%가 현실적 균형
  Governor의 정치적 판단이 실제 경제에 영향
```

### 1.5 DB 구조

```sql
-- sector_governance 테이블 (Part 2에서 정의한 것)
-- governor_sieges 테이블
CREATE TABLE governor_sieges (
  id                  SERIAL PRIMARY KEY,
  sector_code         VARCHAR(30) NOT NULL REFERENCES sector_definitions(code),
  challenger_id       INT NOT NULL REFERENCES users(id),
  defender_id         INT NOT NULL REFERENCES users(id),
  status              VARCHAR(20) DEFAULT 'pending',
  gp_cost             INT NOT NULL,
  declared_at         TIMESTAMP DEFAULT NOW(),
  siege_starts_at     TIMESTAMP,
  siege_ends_at       TIMESTAMP,
  winner_id           INT REFERENCES users(id),
  final_challenger_px INT DEFAULT 0,
  final_defender_px   INT DEFAULT 0,
  participant_count   INT DEFAULT 0,
  total_pp_volume     DECIMAL(20,8) DEFAULT 0,
  resolved_at         TIMESTAMP
);

-- Hall of Fame
CREATE TABLE governor_hall_of_fame (
  id                SERIAL PRIMARY KEY,
  user_id           INT NOT NULL REFERENCES users(id),
  sector_code       VARCHAR(30) NOT NULL,
  term_start        TIMESTAMP NOT NULL,
  term_end          TIMESTAMP,
  duration_days     INT,
  total_tax_earned  DECIMAL(20,8) DEFAULT 0,
  ended_by          VARCHAR(30),  -- 'siege', 'voluntary', 'inactive', 'active'
  max_tax_rate      DECIMAL(5,2),
  notable_event     TEXT
);

-- settings
INSERT INTO settings (key, value, description) VALUES
('governor_max_tax_rate', '10', 'Governor 최대 세율 (%)'),
('governor_market_cut', '0.01', 'Governor 마켓 자동 귀속 비율'),
('governor_policy_change_daily', '1', '섹터 정책 일일 변경 횟수'),
('governor_declaration_cost_gp', '5', '선언문 게시 GP 비용'),
('siege_declaration_cost_gp', '100', 'Siege 선언 GP 비용'),
('siege_warning_hours', '48', 'Siege 대기 시간'),
('siege_battle_hours', '24', '결전 지속 시간'),
('siege_min_territories', '3', '도전 최소 보유 영토 수');
```

---

## 2. Governor Siege 시스템 (완전 설계)

### 2.1 Siege 4단계 흐름

```
[1단계] 도전 선언
  조건: 해당 섹터 영토 3개 이상 보유
  비용: 100 GP (소각)
  공개: 전체 공지 + Discord/Telegram 웹훅
       "⚔️ KimWarrior가 Hellas Abyss Governor에 도전을 선언했습니다"

[2단계] 대기 기간 (48시간)
  현 Governor: 방어 준비, 동맹 모집, 버프 구매
  도전자: 동맹 모집, 영토 추가 구매 준비
  모든 섹터 주민: Territory War Betting 참여 가능
  주민들: Telegram 방에서 전략 논의

[3단계] 결전 (24시간)
  영토 구매 비용 -30% (대규모 이동 장려)
  Warrior 직업 siege_participation 버프 활성화
  종료 시점 기준 최다 영토 보유자 = 새 Governor

[4단계] 결과 처리
  승자 결정 → Governor 자리 이전 또는 유지
  Chronicle 자동 기록
  Discord/Telegram 결과 발송
  Hall of Fame 업데이트
  Territory War Betting 정산
```

### 2.2 Siege 서비스 (services/siege.js)

```javascript
async function declareSiege(challengerId, sectorCode) {
  // 1. 검증
  const sector = await getSectorGovernance(sectorCode);
  if (sector.active_siege_id) return { error: 'siege_already_active' };

  const challenger = await getUser(challengerId);
  const minTerritories = parseInt(await getSetting('siege_min_territories'));
  const challengerTerritories = await countUserTerritoriesInSector(challengerId, sectorCode);

  if (challengerTerritories < minTerritories) {
    return { error: 'insufficient_territories', need: minTerritories };
  }

  // 2. 비용 차감
  const cost = parseInt(await getSetting('siege_declaration_cost_gp'));
  await deductGP(challengerId, cost);

  // 3. Siege 생성
  const warningHours = parseInt(await getSetting('siege_warning_hours'));
  const battleHours = parseInt(await getSetting('siege_battle_hours'));
  const now = new Date();
  const siegeStart = new Date(now.getTime() + warningHours * 3600000);
  const siegeEnd = new Date(siegeStart.getTime() + battleHours * 3600000);

  const siege = await db.query(`
    INSERT INTO governor_sieges
    (sector_code, challenger_id, defender_id, gp_cost, siege_starts_at, siege_ends_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [sectorCode, challengerId, sector.governor_user_id, cost, siegeStart, siegeEnd]);

  // 4. sector_governance에 active_siege_id 설정
  await updateSectorActiveSiege(sectorCode, siege.rows[0].id);

  // 5. 공지
  await sendSiegeDeclarationNotice(siege.rows[0]);

  // 6. Territory War Betting 이벤트 생성
  await createBettingEvent('siege', siege.rows[0].id,
    challenger.nickname, sector.governor_nickname);

  return { success: true, siege: siege.rows[0] };
}

async function resolveSiege(siegeId) {
  const siege = await getSiege(siegeId);

  // 최다 영토 보유자 확인
  const [challengerPx, defenderPx] = await Promise.all([
    countUserTerritoriesInSector(siege.challenger_id, siege.sector_code),
    countUserTerritoriesInSector(siege.defender_id, siege.sector_code)
  ]);

  const winner = challengerPx > defenderPx ? siege.challenger_id : siege.defender_id;
  const isNewGovernor = winner === siege.challenger_id;

  // Governor 교체
  if (isNewGovernor) {
    await updateGovernor(siege.sector_code, siege.challenger_id);
    await updateHallOfFame(siege.defender_id, siege.sector_code, 'siege');
  }

  // Siege 완료 처리
  await db.query(`
    UPDATE governor_sieges SET
      status = 'resolved',
      winner_id = $2,
      final_challenger_px = $3,
      final_defender_px = $4,
      resolved_at = NOW()
    WHERE id = $1
  `, [siegeId, winner, challengerPx, defenderPx]);

  // Chronicle 기록
  await chronicleService.record('governor_overthrown', {
    sector: siege.sector_code,
    winner: winner,
    loser: winner === siege.challenger_id ? siege.defender_id : siege.challenger_id,
    challengerPx, defenderPx,
    participants: siege.participant_count
  });

  // 베팅 정산
  await settleBettingEvent('siege', siegeId, winner === siege.challenger_id ? 'challenger' : 'defender');

  // 공지
  await sendSiegeResultNotice(siege, winner, isNewGovernor);
}
```

---

## 3. 길드 시스템 (심화 설계)

### 3.1 현재 구조 (Migration 079 기준)
```
길드 생성 (50 GP)
멤버 모집
길드 채팅
길드 금고 (GP)
길드 전쟁 (기본)
연구 효과 (버프)
```

### 3.2 추가/수정 사항

#### 3.2.1 길드 영토 개념 (신규)

```yaml
길드 영토:
  정의: 같은 길드 멤버들의 영토가 인접하면 "길드 클러스터" 형성
  자동 계산: 멤버 영토 연결 그래프 분석 (BFS)
  효과:
    클러스터 크기 100px+: 길드 Mining 공동 보너스 +5%
    클러스터 크기 500px+: 방어 공동 버프 +10%
    클러스터 크기 1000px+: "길드 영지" 칭호 + 시즌 포인트 보너스
  표시: 지도에서 길드 색상으로 클러스터 영역 하이라이트

이유:
  개인 영토를 모으면 혼자 버프, 길드끼리 모으면 집단 버프
  길드원이 서로 붙어 있으려는 전략적 동기 부여
```

#### 3.2.2 길드 역할 시스템 (신규)

```sql
-- 길드 내 역할
CREATE TABLE guild_roles (
  id          SERIAL PRIMARY KEY,
  guild_id    INT NOT NULL REFERENCES guilds(id),
  user_id     INT NOT NULL REFERENCES users(id),
  role        VARCHAR(20) DEFAULT 'member',
  -- 'leader', 'officer', 'diplomat', 'treasurer', 'scout', 'member'
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, user_id)
);
```

| 역할 | 권한 | 버프 |
|---|---|---|
| Leader | 모든 권한, 길드 해산 | - |
| Officer | 멤버 승인/제명, War 선포 | - |
| Diplomat | 동맹 협상 권한 | 외교 액션 비용 -20% |
| Treasurer | 금고 배분 권한 | GP 입금 시 +2% 보너스 |
| Scout | 정보 수집 (Explore 특화) | POI 보상 +20% |
| Member | 기본 활동 | - |

#### 3.2.3 길드 동맹 시스템 (신규)

```sql
CREATE TABLE guild_alliances (
  id              SERIAL PRIMARY KEY,
  guild_a_id      INT NOT NULL REFERENCES guilds(id),
  guild_b_id      INT NOT NULL REFERENCES guilds(id),
  alliance_type   VARCHAR(20) DEFAULT 'ally', -- 'ally', 'neutral', 'enemy'
  proposed_by     INT NOT NULL,
  proposed_at     TIMESTAMP DEFAULT NOW(),
  status          VARCHAR(20) DEFAULT 'pending', -- 'pending','active','ended'
  expires_at      TIMESTAMP,
  UNIQUE(guild_a_id, guild_b_id)
);
```

```yaml
동맹 효과:
  - Ally 길드원 영토에 인접 시 Hijack 비용 +50% (사실상 공격 억제)
  - Siege 시 동맹 길드가 지원 가능
  - 섹터 정책 'ally_only'일 때 영토 구매 가능

적대 선언:
  - Guild War 자동 활성화
  - 상대 영토 Hijack 비용 -10% (공격 촉진)
```

#### 3.2.4 길드 Siege 지원

```yaml
Siege 선언 후 동맹 길드도 참여 가능:
  - 도전자 편 또는 수비자 편 선택
  - 선택 후 해당 섹터 영토 구매 비용 -15% 추가
  - 지원 인원이 많을수록 Territory War Betting에서 배당률 영향
```

### 3.3 Guild War 심화

```yaml
기존 Guild War:
  길드 간 미니게임 방식

수정 방향:
  미니게임 방식 유지하되 영토 시스템과 연결
  Guild War 선언: 200 GP
  전쟁 기간: 48시간
  승리 조건: 상대 길드 영토를 더 많이 Hijack한 길드
  보상: 승리 길드 Treasury에 패자 GP 20% 귀속

기존 미니게임 형식 유지 여부:
  기존 코드 유지, 영토 Hijack 결과도 점수에 반영
  하이브리드 방식
```

---

## 4. 서사 엔진 (Chronicle System)

### 4.1 핵심 원칙

```
플레이어 행동 → 시스템이 기록 → 밖으로 발송 → 새 유저 유입

기록되지 않은 사건은 없는 것과 같다.
아무리 극적인 전투도 Discord로 나가지 않으면 바이럴이 없다.
```

### 4.2 Chronicle DB

```sql
CREATE TABLE server_chronicles (
  id              SERIAL PRIMARY KEY,
  event_type      VARCHAR(50) NOT NULL,
  actor_id        INT REFERENCES users(id),
  target_id       INT REFERENCES users(id),
  guild_id        INT REFERENCES guilds(id),
  sector_code     VARCHAR(30),
  value_pp        DECIMAL(20,8),
  value_gp        DECIMAL(20,8),
  extra_data      JSONB,
  title_en        VARCHAR(300),
  title_ko        VARCHAR(300),
  title_ja        VARCHAR(300),
  title_zh        VARCHAR(300),
  body_en         TEXT,
  body_ko         TEXT,
  body_ja         TEXT,
  body_zh         TEXT,
  is_public       BOOLEAN DEFAULT TRUE,
  webhook_sent    BOOLEAN DEFAULT FALSE,
  occurred_at     TIMESTAMP DEFAULT NOW(),
  season_id       INT
);

CREATE INDEX idx_chronicles_event_type ON server_chronicles(event_type, occurred_at);
CREATE INDEX idx_chronicles_actor ON server_chronicles(actor_id, occurred_at);
```

### 4.3 자동 기록 이벤트 (services/chronicle.js)

```javascript
const THRESHOLDS = {
  large_hijack_pp: 'settings.chronicle_hijack_min_pp',      // 기본: 500 PP
  siege_min_participants: 'settings.chronicle_siege_min_p', // 기본: 5명
  bounty_min_amount: 'settings.chronicle_bounty_min',       // 기본: 200 PP
  market_record_gp: 'settings.chronicle_market_record',     // 기본: 5000 GP
};

const EVENT_HANDLERS = {

  // 1. Governor 교체 (항상 기록)
  async governorOverthrown(data) {
    const { sector, winner, loser, participants, challengerPx, defenderPx } = data;
    await record('governor_overthrown', {
      actor_id: winner.id,
      target_id: loser.id,
      sector_code: sector.code,
      extra_data: { participants, winner_px: challengerPx, loser_px: defenderPx },
      title_en: `${winner.nickname} seizes ${sector.name_en} from ${loser.nickname}`,
      title_ko: `${winner.nickname}이/가 ${loser.nickname}으로부터 ${sector.name_ko} 점령`,
      webhook: true
    });
  },

  // 2. 대형 Hijack
  async largeHijack(data) {
    const min = await getSetting('chronicle_hijack_min_pp');
    if (data.ppAmount < parseFloat(min)) return;
    await record('large_hijack', {
      actor_id: data.attacker.id,
      target_id: data.defender.id,
      sector_code: data.sectorCode,
      value_pp: data.ppAmount,
      title_en: `${data.attacker.nickname} seizes ${data.pixels}px for ${data.ppAmount} PP`,
      title_ko: `${data.attacker.nickname}이 ${data.ppAmount} PP에 ${data.pixels}px 탈취`,
      webhook: data.ppAmount > parseFloat(min) * 5  // 5배 이상만 webhook
    });
  },

  // 3. Enhancement +10 최초 달성
  async firstMaxEnhancement(data) {
    const existing = await db.query(
      'SELECT id FROM server_chronicles WHERE event_type = $1 LIMIT 1',
      ['first_max_enhancement']
    );
    if (existing.rows.length === 0) {
      // 서버 최초
      await record('first_max_enhancement', {
        actor_id: data.userId,
        extra_data: { item_name: data.itemName },
        title_en: `${data.userNickname} achieves +10 ${data.itemName} — Server First!`,
        title_ko: `${data.userNickname}이 +10 ${data.itemName} 달성 — 서버 최초!`,
        webhook: true
      });
    }
  },

  // 4. Siege 최대 참여 기록
  async siegeRecord(data) {
    const currentRecord = await getRecord('siege_participants');
    if (data.participants > (currentRecord?.value || 0)) {
      await record('siege_record_participants', {
        sector_code: data.sectorCode,
        extra_data: { participants: data.participants },
        title_en: `${data.participants} colonists clash in ${data.sectorName} — New Record!`,
        title_ko: `${data.participants}명이 ${data.sectorName}에서 충돌 — 신기록!`,
        webhook: true
      });
    }
  },

  // 5. 신입 Governor (가입 30일 미만)
  async underdogGovernor(data) {
    const accountAge = (Date.now() - data.winner.created_at) / (1000 * 60 * 60 * 24);
    if (accountAge < 30) {
      await record('underdog_governor', {
        actor_id: data.winner.id,
        sector_code: data.sectorCode,
        title_en: `Newcomer ${data.winner.nickname} stuns veterans in ${data.sectorName}`,
        title_ko: `신입 ${data.winner.nickname}이 베테랑들을 물리치고 ${data.sectorName} 정복`,
        webhook: true
      });
    }
  },

  // 6. Governor 장기 재임 마일스톤
  async governorMilestone(data) {
    const milestones = [7, 30, 90];
    if (milestones.includes(data.days)) {
      await record('governor_milestone', {
        actor_id: data.governorId,
        sector_code: data.sectorCode,
        extra_data: { days: data.days },
        title_en: `${data.nickname} rules ${data.sectorName} for ${data.days} days`,
        webhook: data.days >= 30  // 30일 이상만 webhook
      });
    }
  },

  // 7. 폭풍 속 대형 공격
  async stormOffensive(data) {
    const min = await getSetting('chronicle_storm_min_pp');
    if (data.ppAmount >= parseFloat(min) && data.duringWeather) {
      await record('storm_offensive', {
        actor_id: data.attackerId,
        sector_code: data.sectorCode,
        value_pp: data.ppAmount,
        title_en: `${data.nickname} strikes under cover of dust storm in ${data.sectorName}`,
        webhook: false
      });
    }
  },

  // 8. 주간 직업별 최고 수익자
  async weeklyTopByJob(data) {
    for (const [job, user] of Object.entries(data.tops)) {
      await record('weekly_top_job', {
        actor_id: user.id,
        extra_data: { job, earnings_pp: user.earnings },
        title_en: `This week's top ${job}: ${user.nickname} with ${user.earnings} PP`,
        webhook: false
      });
    }
  }
};
```

### 4.4 Weekly Chronicle 자동 생성

```javascript
// 매주 월요일 UTC 00:00 실행
async function generateWeeklyChronicle() {
  const events = await getRecentChronicles(7);
  const stats = await collectWeeklyStats();

  // 헤드라인 (가장 webhook_sent + value 높은 것)
  const headline = events
    .filter(e => e.webhook_sent)
    .sort((a, b) => (b.value_pp || 0) - (a.value_pp || 0))[0];

  const chronicle = {
    week: getISOWeek(new Date()),
    headline: formatHeadline(headline),
    power_shifts: events.filter(e => e.event_type.includes('governor')),
    battles: events.filter(e => ['large_hijack', 'storm_offensive', 'siege_record'].includes(e.event_type)),
    achievements: events.filter(e => e.event_type.includes('enhancement', 'milestone')),
    rankings: {
      top_earner: stats.topPPEarner,
      top_warrior: stats.topHijacker,
      hottest_sector: stats.hottestSector,
      most_active_guild: stats.topGuild
    }
  };

  // Discord 발송
  const discordPayload = {
    embeds: [{
      title: `📰 Mars Chronicle — Week ${chronicle.week}`,
      description: `**${chronicle.headline}**`,
      fields: [
        { name: '⚔️ Power Shifts', value: formatEvents(chronicle.power_shifts), inline: false },
        { name: '🔥 Battles', value: formatEvents(chronicle.battles), inline: false },
        { name: '🏆 Rankings', value: formatRankings(chronicle.rankings), inline: false }
      ],
      color: 0xFF4500,
      footer: { text: 'Occupy Mars — Your story becomes history' }
    }]
  };

  await sendDiscordWebhook(await getSetting('discord_webhook_url'), discordPayload);
  await sendTelegramMessage(formatForTelegram(chronicle));
  await saveWeeklyChronicle(chronicle);
}
```

### 4.5 공개 API (서드파티 생태계 기반)

```javascript
// routes/public.js (인증 불필요)

// GET /api/public/stats
{
  total_pixels: 5040000,
  pixels_claimed: 84500,
  occupancy_rate: 0.0168,
  active_users_24h: 1247,
  total_volume_usdt: 84500,
  total_pp_in_circulation: 2340000,
  top_sector_by_activity: 'hellas_abyss'
}

// GET /api/public/sectors
// 24섹터 실시간 현황 (위 Part 2에서 정의)

// GET /api/public/leaderboard
{
  top_territory: [{ rank, nickname, guild_tag, total_px, sector }],
  top_pp_earner: [{ rank, nickname, guild_tag, weekly_pp }],
  top_governors: [{ sector, governor, days_held, tax_rate }]
}

// GET /api/public/chronicles?limit=20
// 최근 Chronicle 목록

// GET /api/public/chronicles/weekly/latest
// 최신 Weekly Chronicle

// GET /api/public/lore/:sector_code
// 섹터 Lore 정보

// SSE: GET /api/public/events/live
// 실시간 이벤트 스트림
data: {"type":"hijack","actor":"KimWarrior","target":"NewPlayer","pp":1200,"sector":"hellas_abyss","timestamp":"..."}
data: {"type":"siege_declared","challenger":"Rebel1","sector":"olympus_crown","starts_at":"..."}
```

### 4.6 소셜 공유 카드 (OG Image)

```javascript
// routes/share.js

// GET /share/claim/:claimId
// 내 영토 위치가 표시된 화성 지도 카드

// GET /share/governor/:userId/:sectorCode
// Governor 취임 카드
// "KimWarrior이 Hellas Abyss를 정복했다 — 23일째 통치 중"

// GET /share/enhancement/:instanceId
// Enhancement 달성 카드
// "+10 Volcanic Shield 달성"

// GET /share/siege/:siegeId
// Siege 결과 카드
// "47명 참전, KimWarrior 승리"

// OG 태그 공통:
// og:image → 서버 생성 카드 이미지 (node-canvas 또는 puppeteer)
// og:title → 사건 제목
// og:description → 상세 설명
// og:url → 게임 메인 URL

// 자동 공유 유도:
// Governor 취임 시: "공유하시겠습니까?" 팝업
// +7 이상 Enhancement 달성 시
// Siege 승리 시
// 7일+ Governor 유지 시
```

---

## 5. Territory War Betting (Cantina 대체)

### 5.1 설계 철학

```
기존 Cantina: 순수 RNG 도박 → 카지노 이미지
Territory War Betting: 게임 내 전투 결과에 베팅 → 전략적 예측

차이:
  Cantina: "운이 좋으면 이긴다"
  War Betting: "저 길드는 질 것 같다. 왜냐면 세율 높여서 주민이 떠났고..."
  
서사 기여:
  베팅 참여자 = 관전자
  관전자가 많을수록 결전이 더 극적
  "내가 베팅한 쪽이 이겼다/졌다" → 공유 동기
```

### 5.2 베팅 대상

```yaml
1. Governor Siege 결과:
   - 도전자 승리 vs 현 Governor 유지
   - 배당: 총 베팅 비율 기반 실시간 오즈
   - 베팅 마감: Siege 시작 1시간 전

2. Guild War 승패:
   - A 길드 승 vs B 길드 승
   - 배당: 실시간 오즈

3. 주간 최다 Hijack 유저:
   - Top 3 후보 중 선택
   - 배당: 3-way 오즈
   - 집계: 매주 일요일 23:59 UTC 마감

통화: GP 전용 (USDT 베팅 없음 — 규제 리스크 방지)
최소 베팅: 10 GP
최대 베팅: 2,000 GP (settings 조정)
하우스 엣지: 5% (winners에게 총 베팅액의 95% 분배)
```

### 5.3 DB

```sql
CREATE TABLE war_bet_events (
  id              SERIAL PRIMARY KEY,
  event_type      VARCHAR(30) NOT NULL, -- 'siege','guild_war','weekly_top'
  event_id        INT NOT NULL,
  option_a_label  VARCHAR(100),
  option_b_label  VARCHAR(100),
  option_c_label  VARCHAR(100),        -- 3-way 베팅 시
  total_bet_a     BIGINT DEFAULT 0,
  total_bet_b     BIGINT DEFAULT 0,
  total_bet_c     BIGINT DEFAULT 0,
  status          VARCHAR(20) DEFAULT 'open', -- 'open','closed','resolved'
  winner_option   VARCHAR(5),          -- 'a','b','c'
  opens_at        TIMESTAMP,
  closes_at       TIMESTAMP,
  resolved_at     TIMESTAMP
);

CREATE TABLE war_bets (
  id              SERIAL PRIMARY KEY,
  event_id        INT NOT NULL REFERENCES war_bet_events(id),
  user_id         INT NOT NULL REFERENCES users(id),
  option          VARCHAR(5) NOT NULL, -- 'a','b','c'
  amount_gp       INT NOT NULL,
  status          VARCHAR(20) DEFAULT 'pending',
  payout_gp       INT DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- settings
INSERT INTO settings (key, value) VALUES
('war_betting_min_gp', '10', '최소 베팅 GP'),
('war_betting_max_gp', '2000', '최대 베팅 GP'),
('war_betting_house_edge', '0.05', '하우스 엣지'),
('war_betting_close_before_hours', '1', 'Siege 시작 전 베팅 마감 시간');
```
# PART 5: 마켓플레이스 · Enhancement · 온보딩 · 시즌 · 보안

---

## 1. 마켓플레이스 (수정 및 확장)

### 1.1 현재 상태 (Migration 079 완성)
```
고정가 판매 (Phase 3 완성)
거래 대상: 강화 코스메틱 / 일반 아이템 / 영토(claim)
등록비: 2 GP (너무 낮음 — 수정 필요)
수수료: 5%
기간: 7일
최대 리스팅: 20개
에스크로: 완비
가격 히스토리: 완비
```

### 1.2 수정 사항

```sql
-- 등록비 수정 (2 GP → 10 GP)
UPDATE settings SET value = '10' WHERE key = 'marketplace_listing_fee_gp';

-- 동적 요금 설정 추가 (스팸 방지)
INSERT INTO settings (key, value, description) VALUES
('marketplace_dynamic_fee_5', '2.0', '5개 이상 리스팅 시 등록비 배율'),
('marketplace_dynamic_fee_10', '4.0', '10개 이상 리스팅 시 등록비 배율'),
('marketplace_max_price_gp', '9999999', '최대 판매가 GP'),
('marketplace_max_price_pp', '9999999', '최대 판매가 PP');
```

### 1.3 자원 거래 추가

```sql
-- 기존 marketplace_listings 테이블 확장
ALTER TABLE marketplace_listings
  ADD COLUMN resource_code     VARCHAR(30) REFERENCES resources(code),
  ADD COLUMN resource_quantity BIGINT;

-- item_type CHECK 업데이트: 'resource' 추가
```

### 1.4 거래 대상 전체 목록

| 타입 | 설명 | 주 거래자 |
|---|---|---|
| `cosmetic` | 강화된 코스메틱 (+N) | Crafter → Warrior/Miner |
| `item` | 방어/공격/유틸 아이템 | Crafter → Warrior |
| `claim` | 영토 소유권 | 모든 직업 |
| `resource` | 광물 (iron_dust 등) | Miner → Crafter |

### 1.5 Merchant 직업 특수 기능

```javascript
// Merchant는 가격 히스토리 60일 조회 가능
// 기본 유저: 7일
async function getPriceHistory(userId, itemType, itemCode, days) {
  const historyBuff = await jobService.getJobBuff(userId, 'merchant_price_history_days', 7);
  const maxDays = Math.floor(historyBuff);
  const actualDays = Math.min(days, maxDays);
  // ...
}

// Merchant는 시장 정보 추가 제공
// GET /api/market/insight/:itemCode (Merchant 전용)
// 최근 10건 거래 내역 + 평균 가격 + 추세
```

### 1.6 Phase 4 옥션 (기존 계획 유지)

```yaml
Migration 090으로 진행 (직업·서사·온보딩 완료 후)

기존 계획 그대로:
  auctions, bids 테이블
  입찰/환불/자동 정산
  스나이핑 방지 (마감 5분 전 입찰 → 자동 연장)
  만료 정산 스케줄러

추가: 직업 연동
  Merchant: 옥션 수수료 35% 할인
  자원 번들 옥션 지원 (meteorite_fragment 묶음 등)
```

---

## 2. Enhancement 시스템 (수정 및 보완)

### 2.1 현재 상태 (완성, 기본 유지)
```
+0 → +10 강화
GP 비용: 50 × 1.8^n (현재 설정값)
+10 기준 약 25,700 GP
성공률: +0=95%, 하락하여 +10=7%
실패 페널티: 50% 유지 / 40% 하락 / 10% 파괴
글로우 비주얼: +1~+3 흰색, +4~+6 금색, +7~+9 보라, +10 빨강
```

### 2.2 자원 소모 옵션 추가 (신규)

```sql
CREATE TABLE enhancement_material_recipes (
  id                  SERIAL PRIMARY KEY,
  min_enhance_level   INT NOT NULL,  -- 이 레벨 이상에서 선택 가능
  resource_code       VARCHAR(30) REFERENCES resources(code),
  quantity_required   INT NOT NULL,
  success_rate_bonus  DECIMAL(5,4),  -- 성공률 추가 (0.08 = +8%)
  break_reduction     DECIMAL(5,4),  -- 파괴 확률 감소 (0.15 = -15%)
  is_active           BOOLEAN DEFAULT TRUE
);

INSERT INTO enhancement_material_recipes
  (min_enhance_level, resource_code, quantity_required, success_rate_bonus, break_reduction)
VALUES
  (7, 'ice_crystal',     3, 0.08, 0.00),  -- +7 이상: ice_crystal 3개 → 성공률 +8%
  (7, 'volcanic_shard',  2, 0.00, 0.15),  -- 파괴 확률 -15%
  (9, 'ancient_metal',   1, 0.20, 0.00),  -- +9 이상: 성공률 +20%
  (9, 'ancient_metal',   2, 0.00, 0.40);  -- 2개: 파괴 확률 -40%
```

### 2.3 보호권 아이템 (신규 — 수익화 핵심)

```sql
-- 기존 아이템 Shop에 보호권 추가 (item_type: 'utility')
INSERT INTO items (name_en, name_ko, name_ja, name_zh,
  category, gp_price, usdt_price, effect_type, description_en)
VALUES
(
  'Protect Scroll', '보호 주문서', 'プロテクトスクロール', '保护卷轴',
  'utility', 500, NULL, 'protect_scroll',
  'Prevents level decrease on enhancement failure. Destruction still possible.'
),
(
  'Blessed Scroll', '축복 주문서', 'ブレッスドスクロール', '祝福卷轴',
  'utility', 0, 2.00, 'blessed_scroll',
  'Prevents both decrease AND destruction on failure. Full protection.'
);
```

```javascript
// services/enhancement.js 수정 (기존 로직에 보호권 체크 추가)
async function attemptEnhancement(userId, instanceId, materialResources = []) {

  // 직업 버프 (Crafter)
  const successBuff = await jobService.getJobBuff(userId, 'crafter_enhancement_success', 1.0);
  const costBuff = await jobService.getJobBuff(userId, 'crafter_enhancement_cost', 1.0);
  const breakBuff = await jobService.getJobBuff(userId, 'crafter_enhancement_break_protection', 1.0);

  // 자원 소모 보너스
  const materialBonus = await calculateMaterialBonus(materialResources, currentLevel);

  // 보호권 체크
  const protectScroll = await getActiveProtectScroll(userId);
  const blessedScroll = await getActiveBlessedScroll(userId);

  // 최종 수치 계산
  const finalSuccessRate = baseSuccessRate * successBuff + materialBonus.successBonus;
  const finalGPCost = Math.floor(baseGPCost * costBuff);
  let finalBreakChance = baseBreakChance * breakBuff - materialBonus.breakReduction;

  if (blessedScroll) {
    finalBreakChance = 0;       // 파괴 완전 방지
    // 하락도 방지
  } else if (protectScroll) {
    // 하락 방지, 파괴는 유지
  }

  // 보호권 소모
  if (usedProtect) await consumeScrollItem(userId, 'protect_scroll');
  if (usedBlessed) await consumeScrollItem(userId, 'blessed_scroll');

  // ...기존 로직 유지
}
```

---

## 3. 온보딩 튜토리얼 (완전 설계)

### 3.1 온보딩 목표

```
신규 유저가 첫 10분 안에:
1. "나는 누구인가" (직업 선택 → 정체성)
2. "내 땅은 어디인가" (영토 점령 → 소유감)
3. "위험이 있다" (공격 시뮬레이션 → 긴장감)
4. "혼자선 힘들다" (길드 소개 → 소속감)
5. "오늘 할 것이 있다" (첫 미션 → 목표)
```

### 3.2 5단계 온보딩 상세

#### STEP 0: 착륙 (60초)
```
배경: 화성 글로브 천천히 회전
텍스트 (연속 페이드 인):
  "2067년. 지구의 자원이 고갈됐다."
  "화성이 마지막 희망이다."
  "당신은 오늘 첫 발을 내딛는 개척자다."

[착륙하기] 버튼
→ 클릭 시 착륙 효과음 + 화성 글로브 줌인
→ 직업 선택 화면으로 전환
```

#### STEP 1: 직업 선택 (2~3분)
```
상단: "화성에서 살아남는 방법을 선택하세요"

4개 카드 표시:
  [⛏️ 광부]         [⚔️ 전사]
  채굴로 부를 쌓다   영토를 빼앗고 지킨다
  Mining +50%        Hijack +20%
  약함: 전투 -30%   약함: 채굴 -20%

  [🔨 제작자]        [💼 상인]
  아이템을 만든다    거래로 이익을 본다
  강화 성공률 +30%   마켓 수수료 -35%
  약함: 전투 -20%   약함: 전투 -20%

카드 hover/클릭 시 상세 설명 표시:
  "광부는 Frontier 섹터에서 희귀 자원을 캐고,
   그것을 마켓에서 팔아 돈을 법니다.
   길드에서 전사들의 보호를 받으면 최고입니다."

[선택하기] → 확인 모달 → 온보딩 계속
(나중에 변경 가능 — 주 1회 무료)

Level 5 미만이면: 버프는 Level 5부터 활성화됨을 안내
```

#### STEP 2: 첫 영토 점령 (3분)
```
직업에 따라 다른 섹터 추천:
  광부 → "Arcadia Ridge를 추천합니다. 자원이 풍부합니다."
  전사 → "Coprates Ridge를 추천합니다. 전투가 활발합니다."
  제작자 → "Ascraeus Vault를 추천합니다. 강화 비용이 저렴합니다."
  상인 → "Pavonis Gate를 추천합니다. 거래가 가장 많습니다."

화살표로 추천 섹터 하이라이트
빈 영토 5×5 영역 하이라이트

"클릭해서 점령하세요!"
→ 첫 영토 무료 점령 (온보딩 전용, 1회)
→ "✅ 첫 영토 점령! 이 땅은 이제 당신의 것입니다."
→ +100 XP + 50 PP 지급
→ 이미지 업로드 유도 (건너뛰기 가능)
```

#### STEP 3: 위협 경험 (2분)
```
"잠깐! 당신의 영토가 위험합니다."

시뮬레이션 애니메이션 (실제 공격 아님):
  적 마커가 내 영토를 향해 이동
  "⚠️ 공격 시도 감지!"

"화성에서는 아무도 내 땅을 지켜주지 않습니다.
 방어 아이템을 사용하거나, 길드에 가입하세요."

→ Basic Shield 1개 무료 지급 (온보딩 보상)
→ [방어 아이템 장착하기] 버튼
→ 장착 시 "✅ 방어 완료! 다음 24시간 보호됩니다."
```

#### STEP 4: 길드 가입 유도 (2분)
```
"혼자서는 한계가 있습니다."

"현재 [추천 섹터]에 활동 중인 길드:"
→ 해당 섹터 활성 길드 3개 자동 추천
  [길드명] 멤버 23명 | 매우 활발 | 직업 친화: 광부
  [길드명] 멤버 47명 | 전투 특화 | 직업 친화: 전사
  [무관심하게 진행하기]

→ 클릭 시 1-click 가입 신청
→ 스킵 가능 (skip 가능)
```

#### STEP 5: 첫 미션 (1분)
```
"오늘 할 일이 있습니다."

직업별 맞춤 첫 미션:
  광부: "4시간 후 첫 Harvest → 50 GP"
  전사: "이번 주 첫 Hijack 시도 → 100 GP"
  제작자: "Enhancement +1 시도 → 50 GP"
  상인: "마켓에 첫 아이템 등록 → 30 GP"

"튜토리얼 완료! 🎉"
→ 최종 보상: 200 GP + 100 PP + "개척자" 칭호
→ 메인 화면으로 이동
```

### 3.3 DB

```sql
CREATE TABLE user_onboarding (
  id                  SERIAL PRIMARY KEY,
  user_id             INT UNIQUE NOT NULL REFERENCES users(id),
  current_step        INT DEFAULT 0,
  job_selected        VARCHAR(20),
  tutorial_claim_id   INT,
  completed           BOOLEAN DEFAULT FALSE,
  skipped             BOOLEAN DEFAULT FALSE,
  completed_at        TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW()
);

INSERT INTO settings (key, value) VALUES
('onboarding_enabled', 'true'),
('onboarding_pp_reward', '100'),
('onboarding_gp_reward', '200'),
('onboarding_free_item_type', 'basic_shield'),
('onboarding_skip_allowed', 'true');
```

---

## 4. Hall of Fame & 칭호 시스템

### 4.1 Hall of Fame

```sql
CREATE TABLE hall_of_fame (
  id              SERIAL PRIMARY KEY,
  category        VARCHAR(60) NOT NULL,
  user_id         INT REFERENCES users(id),
  guild_id        INT REFERENCES guilds(id),
  sector_code     VARCHAR(30),
  value_numeric   DECIMAL(20,8),
  description_en  TEXT,
  description_ko  TEXT,
  description_ja  TEXT,
  description_zh  TEXT,
  achieved_at     TIMESTAMP DEFAULT NOW(),
  season_id       INT,
  is_all_time     BOOLEAN DEFAULT FALSE,
  is_featured     BOOLEAN DEFAULT FALSE
);
```

### 4.2 칭호 시스템

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
  is_equipped BOOLEAN DEFAULT FALSE,
  season_id   INT
);
```

**칭호 자동 부여 조건:**

```yaml
게임플레이:
  "First Colonist": 서버 최초 영토 점령
  "Landowner": 영토 100px 이상 보유
  "Domain": 영토 1000px 이상 보유
  "Governor": 현재 Governor (실시간 부여/해제)
  "Iron Governor": 30일 연속 Governor 유지
  "Eternal Ruler": 90일 연속 Governor 유지
  "Siege Victor": Siege에서 처음 승리
  "Underdog": 3배 이상 격차 Siege 역전 승리
  "Master Crafter": 서버 최초 Enhancement +10 달성
  "Forge Legend": Enhancement +10 3개 이상 보유
  "Grand Merchant": 누적 거래액 10,000 GP
  "Bounty Hunter": 5개 이상 Bounty 달성
  "Veteran Colonist": 180일 이상 플레이

직업 특화:
  "Iron Miner": 누적 채굴 10,000 PP
  "Deep Digger": Deep Dig 100회 달성
  "Warlord": Hijack 50회 성공
  "Guild Champion": Guild War 10회 승리

시즌 (종료 시 자동):
  "Season Champion S[N]": 시즌 N 종합 1위
  "Mining Legend S[N]": 시즌 N 채굴 1위
  "Conqueror S[N]": 시즌 N Hijack 1위
  "Grandmaster S[N]": 시즌 N Enhancement 1위
```

---

## 5. 시즌 시스템 (수정 및 보완)

### 5.1 현재 상태 (완성)
```
30일 자동 순환
무료/프리미엄 트랙 (500 GP)
5개 카테고리 경쟁
자동 정산
```

### 5.2 직업별 시즌 카테고리 연동

```yaml
기존 카테고리 유지:
  overall, warrior, miner, explorer, fashionista

수정:
  'fashionista' → 'crafter' (제작자 직업과 연동)
  'cantina master' 제거 (Cantina 제거로 인해)
  'merchant' 추가 (마켓 거래 특화)

최종 5개:
  overall: 종합 점수 (모든 활동)
  miner: 채굴 PP 총량
  warrior: Hijack 성공 횟수 × 획득 PP
  crafter: Enhancement 시도 및 성공 점수
  merchant: 마켓 거래 GP 총액
  explorer: POI 발견 + Bounty 달성
```

### 5.3 시즌 종료 보상

```yaml
1위:
  GP 5,000 + 해당 시즌 칭호 + 특수 코스메틱 NFT (준비 시)
  Hall of Fame 영구 기록

2~3위:
  GP 2,000 + 칭호

4~10위:
  GP 500

프리미엄 패스 보유자:
  모든 보상 ×1.5
```

### 5.4 시즌 Chronicle 자동 생성

```javascript
// services/season.js 수정
async function closeSeason(seasonId) {
  // 기존 정산 로직 실행 후
  const finalStats = await collectSeasonFinalStats(seasonId);

  // Chronicle 시즌 종료 이벤트
  await chronicleService.record('season_ended', {
    extra_data: {
      season_id: seasonId,
      champions: finalStats.champions,
      total_hijacks: finalStats.hijacks,
      total_pp_mined: finalStats.ppMined,
      total_sieges: finalStats.sieges,
      most_memorable_event: finalStats.topChronicleEvent
    },
    title_en: `Season ${seasonId} ends — ${finalStats.champions.overall.nickname} leads all colonists`,
    webhook: true
  });

  // Discord에 시즌 요약 발송
  await sendSeasonSummaryToDiscord(finalStats);
}
```

---

## 6. POI 탐험 & 로켓 (기존 유지 + 수정)

### 6.1 POI 탐험 수정

```yaml
기존: 랜덤 POI → 보상
수정:
  POI 타입 추가:
    Ancient Ruin: ancient_metal 1~3개 드롭
    Ice Cave: ice_crystal 5~10개 드롭
    Crashed Rover: meteorite_fragment 1~2개 드롭
    Signal Beacon: GP 50~200 드롭
    Governor's Cache: 현 Governor가 설정한 보상 드롭 (가버너 세금으로 채움)

  Miner 직업: POI 보상 +40%
  Scout 길드 역할: POI 보상 +20%
  섹터별 POI 빈도 차이:
    Frontier: 매우 많음
    Mid: 보통
    Core: 적음
```

### 6.2 로켓 이벤트 수정

```yaml
기존: 주기적 로켓 → 루팅 드롭
수정:
  meteorite_fragment 드롭 추가 (신규 자원 연동)
  위치: Elysium Wastes에서 빈도 3배
  Miner 직업: 로켓 드롭 +20%
  Chronicle 기록: 대형 로켓 이벤트 → Chronicle에 포함
  "로켓이 Elysium Wastes에 추락했습니다. 지금 채굴하세요!" 공지
```

---

## 7. 제거된 기능 처리

### 7.1 Cantina 비활성화

```javascript
// routes/cantina.js
router.use(async (req, res, next) => {
  const enabled = await getSetting('cantina_enabled');
  if (enabled !== 'true') {
    const lang = req.user?.lang || 'en';
    return res.status(503).json({
      error: 'cantina_closed',
      message: t(lang, 'cantina_closed_message')
    });
  }
  next();
});

// i18n 추가:
// cantina_closed_message_en: "The Cantina is being renovated. Territory War Betting is coming soon!"
// cantina_closed_message_ko: "칸티나 리노베이션 중입니다. 곧 영토 전쟁 베팅으로 돌아옵니다!"
```

```sql
UPDATE settings SET value = 'false' WHERE key = 'cantina_enabled';
```

### 7.2 Arcade 비활성화

```sql
UPDATE settings SET value = 'false' WHERE key = 'arcade_enabled';
```

### 7.3 레퍼럴 수정

```sql
-- 3-tier 다단계 → 1-tier 게임활동 기반
UPDATE settings SET value = '0' WHERE key = 'referral_tier2_rate';
UPDATE settings SET value = '0' WHERE key = 'referral_tier3_rate';
UPDATE settings SET value = 'false' WHERE key = 'referral_deposit_reward_enabled';
UPDATE settings SET value = 'true' WHERE key = 'referral_gameplay_reward_enabled';
UPDATE settings SET value = '0.05' WHERE key = 'referral_tier1_gameplay_rate';
-- 게임 활동(Mining, Hijack, 마켓 거래)의 5%를 추천인에게 GP로 지급
```

---

## 8. 보안 체크리스트

### 8.1 Critical (런칭 전 필수)

```
USDT 인출 보안:
  [ ] 서버 서명 키 → HSM 또는 AWS KMS 격리
  [ ] 일일 인출 한도 설정 (settings: daily_withdrawal_limit_usdt)
  [ ] 이상 패턴 감지: 단시간 대량 인출 → 수동 승인 큐
  [ ] 핫월렛 잔고 30% / 나머지 콜드월렛

Territory War Betting RNG:
  [ ] 베팅 결과는 게임 내 실제 전투 결과에 연동
  [ ] RNG 없음 (순수 전투 결과) → Provably Fair 불필요
  [ ] 단, 배당 계산 로직 투명 공개

Hijack/Enhancement 동시성:
  [ ] 같은 클레임에 동시 Hijack → DB 트랜잭션 SERIALIZABLE
  [ ] Enhancement 중복 시도 → DB 레벨 락

마켓플레이스 에스크로:
  [ ] 에스크로 → 구매 → 정산 원자성 보장
  [ ] 서버 다운 시 에스크로 자산 복구 절차 문서화

Rate Limiting:
  [ ] Harvest API: 유저당 4시간 1회 (서버 강제, 클라이언트 믿지 않음)
  [ ] Hijack API: 유저당 분당 5회
  [ ] 마켓 등록: 유저당 시간당 20회
  [ ] Siege 선언: 유저당 동시 1개

Input Validation:
  [ ] 모든 amount 파라미터 양수 강제
  [ ] 음수 입력으로 잔고 조작 불가
  [ ] SQL Injection 방지 (parameterized query 전수 확인)
  [ ] 마켓 가격 상한 (settings: marketplace_max_price)
```

### 8.2 High

```
봇 탐지:
  [ ] Harvest 정확히 4시간마다 실행하는 계정 패턴 감지
  [ ] 동일 IP 다중 계정 제한
  [ ] Deep Dig 일일 한도 강제 (서버 검증)
  [ ] 비정상 트랜잭션 패턴 Admin 알림

마켓 조작 방지:
  [ ] 자기 자신에게 판매 차단 (wash trading)
  [ ] 짧은 시간 내 동일 아이템 반복 거래 감지

인증/세션:
  [ ] JWT 만료 시간 적절성 확인
  [ ] Refresh Token 탈취 방지
  [ ] 지갑 서명 검증 로직 재확인
```

---

## 9. Admin 기능 확장

### 9.1 현재 Admin 15탭 (유지)
```
DASHBOARD / USERS / GAME SETTINGS / FINANCE / CLAIMS / ITEM SHOP
BATTLES / GUILD / SEASON / GP / POI / GOVERNANCE / LORE / ENHANCE / MARKETPLACE
```

### 9.2 추가 탭 (신규 시스템)

```
JOBS (16번째): 직업 분포 + 버프 수치 수정
RESOURCES (17번째): 자원 인벤토리 + 드롭률 조정
SIEGE (18번째): 진행 중 Siege 현황 + 강제 종료
CHRONICLE (19번째): Chronicle 목록 + 수동 생성 + Webhook 테스트
ECONOMY (20번째): PP/GP Sink/Faucet 비율 실시간 모니터링
BETTING (21번째): 베팅 이벤트 관리 + 정산
ONBOARDING (22번째): 완료율 통계 + 단계별 이탈률
```

### 9.3 경제 모니터링 대시보드 (Admin Economy 탭)

```sql
-- 실시간 경제 현황 뷰
CREATE OR REPLACE VIEW economy_health AS
SELECT
  DATE(created_at) AS date,
  SUM(CASE WHEN amount > 0 AND currency='PP' THEN amount ELSE 0 END) AS pp_issued,
  SUM(CASE WHEN amount < 0 AND currency='PP' THEN ABS(amount) ELSE 0 END) AS pp_burned,
  ROUND(
    SUM(CASE WHEN amount < 0 AND currency='PP' THEN ABS(amount) ELSE 0 END) /
    NULLIF(SUM(CASE WHEN amount > 0 AND currency='PP' THEN amount ELSE 0 END), 0),
    4
  ) AS pp_sink_ratio,
  SUM(CASE WHEN amount > 0 AND currency='GP' THEN amount ELSE 0 END) AS gp_issued,
  SUM(CASE WHEN amount < 0 AND currency='GP' THEN ABS(amount) ELSE 0 END) AS gp_burned,
  COUNT(DISTINCT user_id) AS active_users
FROM transactions
GROUP BY DATE(created_at)
ORDER BY date DESC;
```
# PART 6: 전체 Migration 순서 & Claude Code 작업 가이드

---

## 1. 전체 Migration 로드맵

```
[완료] Migration 001~079: 기존 모든 시스템

[즉시] Migration 080: 제거 작업 + 설정 수정
[즉시] Migration 081: 섹터 정의 시스템
[즉시] Migration 082: Governor 강화 + Siege
[즉시] Migration 083: 서사 엔진 (Chronicle)
[단기] Migration 084: 직업 시스템
[단기] Migration 085: 광물 & 자원
[단기] Migration 086: 온보딩 튜토리얼
[단기] Migration 087: Territory War Betting
[중기] Migration 088: Hall of Fame & 칭호
[중기] Migration 089: 마켓 수정 + 옥션 준비
[중기] Migration 090: Phase 4 옥션 (기존 계획)
[장기] Migration 091: 영토 매매 비주얼 (기존 계획)
[장기] Migration 092: 파벌 시스템
[장기] Migration 093: Reinforcement Timer 확장
```

---

## 2. 각 Migration 상세 작업 지시

---

### Migration 080: 제거 작업 + 기존 설정 수정

**작업 범위만:**
1. `settings` 테이블 수정
2. 비활성화 미들웨어 추가 (라우터 파일만)
3. 프론트엔드 탭 hidden 처리

**DB 작업:**
```sql
-- Cantina 비활성화
UPDATE settings SET value = 'false' WHERE key = 'cantina_enabled';

-- Arcade 비활성화
UPDATE settings SET value = 'false' WHERE key = 'arcade_enabled';

-- 레퍼럴 수정
UPDATE settings SET value = '0' WHERE key = 'referral_tier2_rate';
UPDATE settings SET value = '0' WHERE key = 'referral_tier3_rate';
UPDATE settings SET value = 'false'
  WHERE key = 'referral_deposit_reward_enabled';
UPDATE settings SET value = 'true'
  WHERE key = 'referral_gameplay_reward_enabled';

-- 마켓 등록비 상향
UPDATE settings SET value = '10'
  WHERE key = 'marketplace_listing_fee_gp';

-- 새 settings 추가
INSERT INTO settings (key, value, description) VALUES
('marketplace_dynamic_fee_5', '2.0', '5개+ 리스팅 배율'),
('marketplace_dynamic_fee_10', '4.0', '10개+ 리스팅 배율'),
('war_betting_enabled', 'false', 'Territory War Betting (아직 미구현)'),
('governor_max_tax_rate', '10', 'Governor 최대 세율'),
('governor_market_cut', '0.01', 'Governor 마켓 자동 귀속'),
('governor_declaration_cost_gp', '5', '선언문 GP 비용'),
('siege_declaration_cost_gp', '100', 'Siege 선언 GP'),
('siege_warning_hours', '48', 'Siege 대기 시간'),
('siege_battle_hours', '24', '결전 시간'),
('siege_min_territories', '3', 'Siege 최소 영토'),
('chronicle_hijack_min_pp', '500', 'Chronicle 기록 최소 Hijack PP'),
('chronicle_siege_min_p', '5', 'Chronicle Siege 최소 참여자'),
('discord_webhook_url', '', 'Discord Webhook URL'),
('telegram_bot_token', '', '기존 Telegram 봇 토큰 확인'),
('land_base_price_pp', '0.1', '픽셀당 기본 PP'),
('land_adjacent_discount', '0.85', '인접 구매 할인'),
('land_core_price_mult', '5.0', 'Core 가격 배율'),
('land_mid_price_mult', '2.0', 'Mid 가격 배율'),
('land_frontier_price_mult', '1.0', 'Frontier 가격 배율'),
('land_adjacency_5_bonus', '0.05', '5개 인접 보너스'),
('land_adjacency_10_bonus', '0.10', '10개 인접 보너스'),
('land_adjacency_20_bonus', '0.20', '20개 인접 보너스'),
('job_required_level', '5', '직업 버프 활성화 레벨'),
('job_change_cost_gp', '50', '직업 변경 GP'),
('job_change_weekly_free', '1', '주간 무료 변경'),
('onboarding_enabled', 'true', '온보딩 활성화'),
('onboarding_pp_reward', '100', '온보딩 PP 보상'),
('onboarding_gp_reward', '200', '온보딩 GP 보상');
```

**Claude Code 지시:**
```
GAME_BIBLE_V4.md의 Migration 080을 실행해줘.

이번 작업:
1. 위 SQL 실행 (settings 수정 및 추가)
2. routes/cantina.js 최상단에 비활성화 미들웨어 추가
3. routes/arcade.js 최상단에 비활성화 미들웨어 추가
4. index.html에서 CANTINA, ARCADE 탭 display:none 처리

주의:
- 기존 Cantina/Arcade 데이터는 보존 (DROP 금지)
- 기존 레퍼럴 데이터 보존
- 완료 후: 변경 파일 목록 + 롤백 SQL
```

---

### Migration 081: 섹터 정의 시스템

**신규 테이블:**
- `sector_definitions` (24섹터 정의)
- `sector_entry_requirements` (진입 제한)
- `sector_governance` (거버넌스 상태)
- `sector_resource_rates` (자원 산출 확률)

**기존 테이블 수정:**
- `claims` 테이블에 `sector_code`, `price_paid_pp`, `cluster_id`, `adjacency_bonus` 컬럼 추가
- 기존 claims에 sector_code 자동 매핑 (좌표 기반)

**신규 서비스:**
- `services/sector.js` (섹터 정보 조회, 가격 계산, 진입 검증)

**Claude Code 지시:**
```
GAME_BIBLE_V4.md Part 2의 섹터 정의 시스템을 구현해줘.

이번 작업:
1. sector_definitions 테이블 생성 + 24섹터 초기 데이터
2. sector_entry_requirements 테이블 생성 + 초기 데이터
3. sector_governance 테이블 생성 (24섹터 초기 레코드)
4. claims 테이블에 sector_code 컬럼 추가
5. services/sector.js 생성:
   - getSector(code)
   - getSectorByCoord(x, y)
   - checkEntryRequirement(userId, sectorCode)
   - calculateLandPrice(userId, x, y, width, height)

주의:
- 기존 claims 데이터 보존
- sector_code는 좌표 기반으로 자동 계산 (기존 좌표계 확인 필요)
- 완료 후: 변경 파일 + 롤백 SQL
```

---

### Migration 082: Governor 강화 + Siege

**신규 테이블:**
- `governor_sieges`
- `governor_hall_of_fame`

**기존 테이블 수정:**
- `sector_governance`에 `tax_rate`, `market_cut_rate`, `sector_policy`, `declaration_text` 컬럼 추가
  (이미 Migration 081에서 생성됨, 컬럼만 추가)

**신규 서비스:**
- `services/siege.js`

**신규 API:**
- POST /api/siege/declare
- GET /api/siege/:sectorCode
- POST /api/governor/declaration
- PUT /api/governor/policy
- PUT /api/governor/tax-rate

**Claude Code 지시:**
```
GAME_BIBLE_V4.md Part 4의 Governor Siege 시스템을 구현해줘.

이번 작업 (2단계로 분리):

[1단계] DB + 서비스:
  - governor_sieges 테이블 생성
  - governor_hall_of_fame 테이블 생성
  - sector_governance에 컬럼 추가
  - services/siege.js 생성:
    - declareSiege(challengerId, sectorCode)
    - resolveSiege(siegeId) — 스케줄러에서 호출
    - getActiveSiege(sectorCode)

[2단계] API + 프론트엔드:
  - Siege 선언 API
  - Governor 선언문 API
  - 프론트엔드: Siege 선언 버튼 + 대기 기간 표시 + 결과 공지

주의:
- Siege 결과 처리는 chronicleService.record() 호출 포함 (서비스 먼저 생성)
- 완료 후: 변경 파일 + 롤백 SQL + 테스트 방법
```

---

### Migration 083: 서사 엔진 (Chronicle)

**신규 테이블:**
- `server_chronicles`
- `weekly_chronicles`

**신규 서비스:**
- `services/chronicle.js` (사건 감지 + 기록 + Webhook 발송)

**신규 API:**
- GET /api/public/stats
- GET /api/public/sectors
- GET /api/public/leaderboard
- GET /api/public/chronicles
- GET /api/public/events/live (SSE)
- GET /share/:type/:id (소셜 공유 카드)

**스케줄러 추가:**
- 매주 월요일 00:00 UTC: generateWeeklyChronicle()

**Claude Code 지시:**
```
GAME_BIBLE_V4.md Part 4의 서사 엔진을 구현해줘.

[1단계] DB + 서비스:
  - server_chronicles 테이블
  - services/chronicle.js:
    - record(eventType, data) — 기록 함수
    - checkHijackRecord(attackerId, defenderId, claimId, pp) — Hijack 기록 체크
    - checkGovernorMilestone(governorId, sectorCode, days) — 마일스톤 체크
  - Hijack 완료 함수에 chronicle.checkHijackRecord() 1줄 추가
  - Siege resolve 함수에 chronicle.record() 1줄 추가

[2단계] 공개 API + Webhook:
  - routes/public.js 생성 (인증 없음)
  - Discord Webhook 발송 로직
  - Weekly Chronicle 스케줄러 추가 (기존 스케줄러 파일에 추가)

[3단계] 소셜 공유:
  - /share/:type/:id 라우트
  - OG 메타 태그 생성
  - 공유 버튼 UI (Governor 취임, Enhancement +10 달성 시)

주의:
- chronicleService는 다른 서비스에서 import해서 사용
- Webhook URL은 settings에서 조회 (하드코딩 금지)
- 완료 후: 변경 파일 + 테스트 방법
```

---

### Migration 084: 직업 시스템

**신규 테이블:**
- `jobs`
- `job_buffs`
- `job_change_log`
- `users` 컬럼 추가

**신규 서비스:**
- `services/job.js`

**기존 서비스 수정:**
- `services/mining.js` — 2줄 추가
- `services/hijack.js` (또는 해당 파일) — 3줄 추가
- `services/enhancement.js` — 4줄 추가
- `services/marketplace.js` — 3줄 추가

**Claude Code 지시:**
```
GAME_BIBLE_V4.md Part 3의 직업 시스템을 구현해줘.

[1단계] DB:
  - jobs, job_buffs, job_change_log 테이블
  - users 테이블에 컬럼 4개 추가
  - 4개 직업 초기 데이터 삽입
  - 모든 직업 버프 수치 삽입 (Part 3 스펙 기준)

[2단계] services/job.js:
  - getJobBuff(userId, buffKey, default) — 캐시 포함
  - selectJob(userId, jobCode)
  - getUserJob(userId)
  - getAllJobs(lang)
  - invalidateJobCache(userId)

[3단계] 기존 서비스 수정:
  먼저 각 파일의 Mining/Hijack/Enhancement/Marketplace 핵심 함수를 찾아서
  getJobBuff 호출 1줄씩만 추가 (기존 로직 절대 수정 금지)

[4단계] API + UI:
  - 6개 API 엔드포인트
  - 직업 선택 모달 (Level 5 달성 시)
  - My Base 직업 표시
  - Admin JOBS 탭

주의:
  - 모든 버프 수치는 DB에서 조회 (하드코딩 금지)
  - 캐시 TTL: 10분
  - 직업 변경 시 캐시 무효화
```

---

### Migration 085: 광물 & 자원

**신규 테이블:**
- `resources`
- `sector_resource_rates`
- `user_resource_inventory`
- `enhancement_material_recipes`

**기존 서비스 수정:**
- `services/mining.js` — 자원 드롭 로직 추가 (PP 지급 유지)

**마켓플레이스 수정:**
- `marketplace_listings` 테이블에 `resource_code`, `resource_quantity` 추가

**Claude Code 지시:**
```
GAME_BIBLE_V4.md Part 3의 자원 시스템을 구현해줘.

[1단계] DB:
  - resources 테이블 + 6종 초기 데이터
  - sector_resource_rates 테이블 + 24섹터 드롭 확률 데이터
  - user_resource_inventory 테이블
  - enhancement_material_recipes 테이블 + 4종 레시피

[2단계] Mining 수정:
  Mining harvest 완료 시 자원 드롭 로직 추가
  (기존 PP 지급은 100% 유지, 자원 드롭은 별도 추가)
  rollResourceDrop(userId, sectorCode) 함수 구현

[3단계] 마켓 확장:
  marketplace_listings에 resource 타입 추가
  자원 리스팅/구매 API 확장

[4단계] 인벤토리 UI:
  My Base에 자원 인벤토리 섹션 추가
  각 자원 수량 + 마켓 등록 버튼

주의:
  - 기존 PP Mining 수익 변경 금지
  - 자원은 순수 추가 기능
```

---

### Migration 086: 온보딩 튜토리얼

**신규 테이블:**
- `user_onboarding`

**Claude Code 지시:**
```
GAME_BIBLE_V4.md Part 5의 온보딩 튜토리얼을 구현해줘.

[1단계] DB:
  - user_onboarding 테이블

[2단계] API:
  - GET /api/user/onboarding
  - POST /api/user/onboarding/step
  - POST /api/user/onboarding/skip

[3단계] 프론트엔드:
  신규 가입 유저에게 온보딩 자동 시작
  5단계 흐름 (Step 0~4)
  각 단계 완료 시 서버 API 호출
  완료 시 보상 지급

주의:
  - 온보딩 완료한 유저에게 재표시 금지
  - 4개 언어 지원
  - onboarding_enabled 설정으로 on/off 가능
```

---

### Migration 087: Territory War Betting

**신규 테이블:**
- `war_bet_events`
- `war_bets`

**기존 서비스 연동:**
- `services/siege.js` — Siege 선언 시 자동 베팅 이벤트 생성

**Claude Code 지시:**
```
GAME_BIBLE_V4.md Part 4의 Territory War Betting을 구현해줘.

[1단계] DB:
  - war_bet_events, war_bets 테이블

[2단계] services/betting.js:
  - createBettingEvent(type, eventId, optionA, optionB)
  - placeBet(userId, eventId, option, amount)
  - settleBettingEvent(eventId, winnerOption)
  - getBettingOdds(eventId)

[3단계] Siege 연동:
  siege.js의 declareSiege에 createBettingEvent 1줄 추가
  siege.js의 resolveSiege에 settleBettingEvent 1줄 추가

[4단계] UI:
  Siege 대기 기간 화면에 베팅 UI 추가
  실시간 배당률 표시
  내 베팅 현황

주의:
  - GP 전용 (USDT 베팅 없음)
  - 하우스 엣지 settings에서 조회
  - 베팅 마감 시간 자동 처리
```

---

### Migration 088: Hall of Fame & 칭호

**신규 테이블:**
- `hall_of_fame`
- `user_titles`

**Claude Code 지시:**
```
GAME_BIBLE_V4.md Part 5의 Hall of Fame & 칭호 시스템을 구현해줘.

[1단계] DB:
  - hall_of_fame, user_titles 테이블

[2단계] services/title.js:
  - awardTitle(userId, titleCode)
  - checkAndAwardTitles(userId, action) — 행동 기반 자동 체크
  - getUserTitles(userId)
  - equipTitle(userId, titleCode)

[3단계] 트리거 연결:
  - Enhancement +10 달성 시 → title 체크
  - Siege 승리 시 → title 체크
  - Governor 일수 마일스톤 → title 체크
  (각 서비스에 checkAndAwardTitles 1줄 추가)

[4단계] UI:
  - 프로필에 칭호 표시
  - 칭호 변경 UI (20 GP)
  - Hall of Fame 페이지 (공개)
```

---

### Migration 089: 마켓 수정 + 보호권 아이템

**Claude Code 지시:**
```
GAME_BIBLE_V4.md Part 5의 마켓 수정 및 보호권 아이템을 구현해줘.

[1단계] 마켓 동적 요금:
  marketplace.js에서 등록비 계산 시 활성 리스팅 수 체크
  5개 이상: ×2, 10개 이상: ×4 (settings에서 조회)

[2단계] 보호권 아이템:
  items 테이블에 protect_scroll, blessed_scroll 추가
  services/enhancement.js에 보호권 체크 로직 추가 (3줄)

[3단계] 자원 소모 강화:
  enhancement_material_recipes 연동
  강화 시도 UI에 자원 소모 옵션 표시
```

---

## 3. 공통 작업 원칙

### 각 작업 요청 시 반드시 포함할 것

```
작업 요청 형식:
"GAME_BIBLE_V4.md의 [Migration XXX: 항목]을 구현해줘.

이번 범위:
- [구체적 항목만]

제약:
- 기존 Migration 001~079 수정 금지
- 하드코딩 금지
- 기존 기능 건드리지 말 것

완료 후 제출:
1. 변경/생성 파일 목록
2. 롤백 SQL
3. 테스트 방법 3가지
4. 기존 기능 영향 여부"
```

### 절대 하지 말아야 할 것

```javascript
// ❌ 하드코딩
if (job === 'miner') yield *= 1.5;
const TAX_RATE = 0.05;

// ✅ settings 조회
const miningBuff = await jobService.getJobBuff(userId, 'miner_mining_rate', 1.0);
const taxRate = await getSetting('governor_default_tax_rate');
```

### 기존 함수 수정 패턴

```javascript
// ❌ 기존 로직 수정
async function processHarvest(userId, claimId) {
  const baseYield = territory.size * 0.5; // 기존 로직 변경
  return baseYield * 1.5; // 직접 수정
}

// ✅ 최소 추가만
async function processHarvest(userId, claimId) {
  // 기존 로직 완전 유지
  const baseYield = calculateBaseYield(claimId); // 기존 계산 함수 그대로

  // ✅ 이것만 추가
  const miningBuff = await jobService.getJobBuff(userId, 'miner_mining_rate', 1.0);
  return Math.floor(baseYield * miningBuff);
}
```

---

## 4. 완성도 추적표

| 시스템 | 현재 | 목표 | 완료 Migration |
|---|:---:|:---:|---|
| 게임 정체성 | 50% | 90% | 080 |
| 섹터 전략 | 20% | 90% | 081 |
| Governor 권력 | 40% | 90% | 082 |
| 서사 엔진 | 5% | 85% | 083 |
| 직업 시스템 | 0% | 90% | 084 |
| 자원 경제 | 0% | 85% | 085 |
| 신규 유저 경험 | 10% | 80% | 086 |
| War Betting | 0% | 80% | 087 |
| Hall of Fame | 0% | 85% | 088 |
| 마켓 완성 | 80% | 95% | 089 |
| 옥션 | 0% | 90% | 090 |
| 영토 비주얼 | 60% | 90% | 091 |
| **종합** | **60%** | **88%** | **089 완료 후** |

---

## 5. 런칭 체크리스트

### 런칭 전 필수 (088 완료 후)
```
기술:
[ ] 보안 감사 완료 (USDT 인출 + Rate Limiting)
[ ] 부하 테스트 (동시 100명 Harvest/Hijack)
[ ] DB 백업 자동화 (매일)
[ ] Railway 환경변수 정리

게임성:
[ ] 온보딩 완주 테스트 (비게이머 3명)
[ ] 섹터 가격 밸런싱 (Frontier vs Core 비율)
[ ] Mining 수익 시뮬레이션 (DAU 100명 기준 Sink/Faucet)
[ ] Governor Siege 전체 흐름 테스트

커뮤니티:
[ ] Discord 서버 셋업 (24섹터별 채널)
[ ] Telegram 채널 24개 (또는 언어별)
[ ] Discord Webhook URL settings에 등록
[ ] Weekly Chronicle 첫 테스트 발송
[ ] 공개 API 문서화

법무:
[ ] ToS 업데이트 (Cantina 관련 내용 제거)
[ ] 국가별 서비스 제한 명시
[ ] 한국 IP 차단 확인
```

### 런칭 후 첫 2주
```
모니터링:
[ ] PP Sink/Faucet 매일 확인
[ ] 이상 봇 패턴 감지
[ ] Siege 첫 발생 → Chronicle 수동 확인
[ ] 신규 유저 온보딩 완료율 확인 (목표 40%+)

조정:
[ ] Mining 수익률 조정 (인플레이션 감지 시)
[ ] 섹터 가격 조정 (특정 섹터 쏠림 시)
[ ] War Betting 배당 이상 체크
```
# OCCUPY MARS — 전투 시스템 완전 설계
# COMBAT BIBLE v1.0
# Claude Code 구현 전용 문서

> 작성일: 2026-04-24
> 기준: GAME_BIBLE_V4.md 위에 추가되는 전투 레이어
> 핵심 원칙: 전투는 2~3초가 아닌 수분~수시간이 지속되어야 한다

---

## 0. 설계 철학

### 왜 기존 Hijack만으로는 서사가 없는가

```
현재 Hijack:
  클릭 → 2~3초 → 성공/실패 → 끝
  
결과: 아무도 이야기할 것이 없다
  "어제 뭐 했어?" → "Hijack 20번 했어" → "그래서?"
  
EVE B-R5RB:
  실수로 시작 → 증원 도착 → 반격 → 21시간 지속
  결과: $300K 손실 → 전 세계 언론 보도 → 신규 유저 폭발
  
리니지 공성전:
  2시간 예약된 결전 → 혈맹 총집결 → 반역자 등장 → 역전 드라마
  결과: 서버 전설로 10년 회자
  
핵심 공식: 시간 + 집단 + 불확실성 = 서사
```

### 전투 시스템 3층 구조

```
[Layer 1] 함선 전투 (개인/소규모) ← 새로운 핵심
  픽셀 함선 건조 → 출격 → 실시간 전투 → 결과 Chronicle 기록

[Layer 2] Siege (섹터 패권) ← 기존 설계 강화
  48시간 준비 → 24시간 결전 → 함선 전투 연동

[Layer 3] Guild War (길드 간 전쟁) ← 완전 재설계
  선전포고 → 72시간 전쟁 → 함선 전투 + 영토 Hijack 복합
```

---

## 1. 픽셀 함선 시스템 (핵심 신규 기능)

### 1.1 설계 의도

일론 머스크 맥락: SpaceX가 화성에 로켓을 보내듯,
Occupy Mars 유저들은 픽셀 우주선으로 화성을 누빈다.

**시각적 장면**: 픽셀 함선들이 화성 지도 위를 날아다니며 전투하는 화면
→ 스트리머가 찍고 싶은 화면
→ X(트위터)에 공유하고 싶은 화면
→ "이게 뭐야?" 하고 클릭하게 만드는 화면

### 1.2 함선 종류 (5종)

EVE의 함선 계층을 픽셀로 구현.
이름은 SpaceX 로켓명과 유사하되 상표 침해 없게 설정.

| 함선 | 코드 | 크기 | 역할 | 참고 원형 |
|---|---|---|---|---|
| **Scout** | `scout` | 4×4px | 정찰·채굴 지원 | SpaceX Dragon 연상 |
| **Raider** | `raider` | 8×6px | 빠른 공격 | Falcon 연상 |
| **Carrier** | `carrier` | 12×10px | 중형 전투 | 화성 순양함 |
| **Dreadnought** | `dreadnought` | 20×16px | 중전투 | EVE 드레드넛 |
| **Titan** | `titan` | 32×24px | 최강 함선 | EVE 타이탄 |

### 1.3 함선 건조 시스템 (EVE 채용)

**EVE의 핵심**: 함선은 반드시 플레이어가 만들어야 한다.
NPC 상점에서 살 수 없다. → 제작자(Crafter) 직업의 핵심 역할

```yaml
함선 건조 프로세스:
  Step 1: 설계도 확보
    - 기본 Scout/Raider: 마켓에서 구매 가능
    - 고급 Carrier 이상: 탐험(POI)에서 희귀 드롭 또는 특수 제작
    - Titan 설계도: Governor Siege 승리 보상 (극히 희귀)

  Step 2: 재료 수집
    Scout:
      iron_dust: 50개
      red_sand: 20개
      건조 시간: 30분

    Raider:
      iron_dust: 200개
      red_sand: 100개
      ice_crystal: 20개
      건조 시간: 2시간

    Carrier:
      iron_dust: 500개
      ice_crystal: 100개
      volcanic_shard: 50개
      건조 시간: 6시간

    Dreadnought:
      iron_dust: 2000개
      ice_crystal: 500개
      volcanic_shard: 200개
      ancient_metal: 20개
      건조 시간: 24시간

    Titan:
      iron_dust: 10000개
      ice_crystal: 2000개
      volcanic_shard: 1000개
      ancient_metal: 200개
      meteorite_fragment: 50개
      건조 시간: 72시간 (3일!)
      제약: 서버 전체 동시 최대 3척 (희소성 유지)

  Step 3: 건조소 사용
    - Crafter 직업 유저만 건조 가능 (또는 Crafter에게 의뢰)
    - Crafter: 건조 시간 -30%, 재료 -15%
    - 길드 건조소: 길드 멤버 10인 이상 시 건조 시간 -20% 추가

  Step 4: 출고
    - 건조 완료 → 함선 인스턴스 생성 (Enhancement처럼)
    - 함선도 강화 가능: +0~+5 (소규모 강화)
    - 강화된 함선은 마켓 판매 가능
```

### 1.4 함선 스탯 시스템

```yaml
공통 스탯:
  HP: 체력 (0이 되면 함선 파괴 또는 손상)
  ATK: 공격력
  DEF: 방어력
  SPD: 이동 속도
  RANGE: 공격 사거리

스탯 기본값:
  Scout:       HP=100, ATK=10,  DEF=5,   SPD=10, RANGE=3
  Raider:      HP=300, ATK=30,  DEF=15,  SPD=8,  RANGE=4
  Carrier:     HP=1000,ATK=80,  DEF=50,  SPD=5,  RANGE=6
  Dreadnought: HP=3000,ATK=200, DEF=150, SPD=3,  RANGE=8
  Titan:       HP=10000,ATK=500,DEF=400, SPD=1,  RANGE=12

강화 보너스 (+1당):
  HP: +5%
  ATK: +4%
  DEF: +4%

직업 버프:
  Warrior: 모든 함선 ATK×1.2, DEF×1.1
  Miner: Scout ATK×0.8, 하지만 채굴 효율 ×1.5
```

### 1.5 함선 파괴 시 처리

**EVE의 핵심 철학**: 손실이 진짜여야 승리가 진짜다.

```yaml
파괴 시:
  함선 인스턴스 삭제 (영구 소멸)
  잔해물(Wreckage) 생성:
    - 건조 재료의 30~50% 회수 가능 (Miner/Scout가 수거)
    - 수거까지 30분 시간 제한
    - 적군도 수거 가능 (약탈)

손상 상태:
  HP 0~25%: 중파 (모든 스탯 -30%, 자동 귀환)
  HP 26~50%: 손상 (모든 스탯 -15%)
  HP 51~100%: 정상

수리:
  격납고에서 수리 가능
  비용: iron_dust × 손상 정도
  시간: 30분~6시간 (손상 정도별)
  Crafter 직업: 수리 비용 -20%, 시간 -30%
```

---

## 2. 전투 실행 시스템 (실시간 vs 자동)

### 2.1 판단: 실시간 vs 자동 전투

**결론: 자동 전투 + 실시간 관전 구조**

이유:
```
순수 실시간 (조이스틱 조작):
  - 브라우저 기반 한계 (Three.js로 실시간 PvP는 무거움)
  - 1인 개발로 구현 난이도 극단적으로 높음
  - 모바일에서 조작 불가
  - ❌ 현실적으로 불가

순수 자동 (클릭 후 방치):
  - 현재 Hijack과 다를 게 없음
  - 서사가 생기지 않음
  - ❌ 서사 목표 미달

자동 전투 + 실시간 관전 (채택):
  - 함선 편성 → 전투 명령 → 자동 전투 진행
  - 전투 중 지도에 실시간 함선 이동 애니메이션
  - 관전자는 실시간으로 전투 진행 상황 확인
  - 전략적 선택은 사전에 (편성, 전술 설정)
  - ✅ 구현 가능 + 서사 생성 + 모바일 호환
```

### 2.2 전투 진행 구조

```
[전투 시작 전 — 전략 단계 (5~30분)]
  공격자: 함선 편성 선택 (최대 편성 슬롯은 격납고 크기)
  수비자: 방어 편성 설정 (또는 자동 방어)
  양측: 전술 설정 (공격적/균형/수비적)
  관전자: 베팅 가능 (Territory War Betting 연동)

[전투 진행 — 자동 전투 (수분~수시간)]
  서버에서 매 30초마다 전투 턴 처리
  각 턴:
    1. 함선들이 적 방향으로 이동 (SPD 기준)
    2. 사거리 내 적 함선 공격 (ATK vs DEF 계산)
    3. HP 감소 → 0이면 파괴
    4. 잔해물 생성
  지도에 실시간 함선 위치 업데이트 (SSE 또는 WebSocket)

[전투 결과]
  모든 적 함선 파괴 또는 도주 → 공격 성공
  공격 함선 전멸 또는 도주 → 방어 성공
  제한 시간 초과 → 현재 HP 합산으로 판정
  Chronicle 자동 기록
```

### 2.3 전투 시각화

```
Three.js 기반 전투 화면 (기존 글로브 활용):
  - 함선들이 지도 위를 실제로 이동하는 픽셀 아트 애니메이션
  - 공격 시 레이저/미사일 이펙트 (간단한 선/원)
  - 파괴 시 폭발 애니메이션 (픽셀 파편)
  - 잔해물 아이콘 표시

전투 로그 패널 (채팅 형식):
  "🚀 KimWarrior의 Raider가 적 Scout를 파괴"
  "💥 NewPlayer의 Carrier가 중파"
  "⚠️ KimWarrior의 Dreadnought 출격"

전투 상태 표시:
  공격팀 함선 수 / 수비팀 함선 수
  총 HP 바 (양팀)
  경과 시간
  현재 전세 (공격 우세 / 균형 / 방어 우세)
```

---

## 3. 함선 전투 종류

### 3.1 채굴 원정대 (Mining Expedition)

**EVE 채굴 원정 모델 직접 채용**

```yaml
목적: 자원이 풍부한 섹터(Frontier)로 채굴 원정

구성:
  채굴함: Scout 1~3척 (채굴 특화)
  호위함: Raider 1~2척 (적 공격 방어)
  지휘함: Carrier 1척 (선택, 있으면 채굴량 ×1.5)

진행:
  출발 → 이동 시간 (거리 기반, 10분~1시간) →
  목적지 도착 → 채굴 시작 (자동, 30분~2시간) →
  귀환

위험:
  원정 중 다른 유저 공격 가능
  공격받으면 채굴 중단 + 전투 돌입
  채굴한 자원 일부 약탈 가능

보상:
  Frontier 섹터 자원 대량 확보 (Mining 영토 없어도 가능)
  특수 섹터 Hellas Abyss 원정: ancient_metal 획득 가능
  멀리 갈수록 위험하고 보상도 큼

Miner 직업:
  채굴함 채굴량 ×1.5
  원정 중 희귀 자원 발견 확률 +30%
```

```sql
CREATE TABLE mining_expeditions (
  id              SERIAL PRIMARY KEY,
  leader_id       INT NOT NULL REFERENCES users(id),
  guild_id        INT REFERENCES guilds(id),
  destination_sector VARCHAR(30) REFERENCES sector_definitions(code),
  status          VARCHAR(20) DEFAULT 'preparing',
  -- 'preparing', 'traveling', 'mining', 'returning', 'completed', 'failed'
  ship_formation  JSONB NOT NULL,  -- [{ship_id, role: 'miner/escort/command'}]
  departed_at     TIMESTAMP,
  arrived_at      TIMESTAMP,
  mining_ends_at  TIMESTAMP,
  returns_at      TIMESTAMP,
  resources_collected JSONB DEFAULT '{}',
  was_attacked    BOOLEAN DEFAULT FALSE,
  attacker_id     INT REFERENCES users(id),
  attack_result   VARCHAR(20),  -- 'repelled', 'looted', 'destroyed'
  created_at      TIMESTAMP DEFAULT NOW()
);
```

### 3.2 개인 PvP 전투 (함선 결투)

```yaml
목적: 개인 간 함선 전투

발동 조건:
  A. 채굴 원정 공격: 다른 유저의 원정대를 공격
  B. 도전장: 특정 유저에게 함선 전투 도전 (상대 수락 필요)
  C. Bounty 전투: 현상금 대상을 추적해 전투

전투 규모: 1v1 ~ 10v10 함선

승리 조건:
  상대 함선 전부 파괴 또는 도주

패배 결과:
  공격자: 함선 손실 + PP 소각 (출격 비용)
  수비자: 함선 손실 + 원정 자원 일부 약탈당함

서사 생성:
  "KimWarrior의 Dreadnought가 신인 원정대 5척을 전멸시킴"
  → Chronicle 기록 → Discord 발송
```

### 3.3 영토 공성 전투 (Territory Siege Combat)

**기존 Hijack을 함선 전투로 확장**

```yaml
기존 Hijack (유지):
  함선 없이 즉시 시도 가능
  성공률 기반 빠른 탈취
  2~3초로 유지 (캐주얼 플레이어용)

새로운 함선 공성 (추가):
  함선을 이용한 대규모 영토 공격
  Carrier 이상 함선 보유 시 가능
  대형 영토(500px 이상)를 한 번에 공격 가능
  진행:
    함선 편성 → 공격 선언 (30분 예고) →
    방어자 방어 편성 기회 →
    함선 전투 (자동, 5~30분) →
    승리 시 영토 탈취
  보상: 일반 Hijack보다 30% 더 많은 PP 획득
  위험: 함선 손실 가능
```

### 3.4 섹터 습격 (Sector Raid)

```yaml
목적: 특정 섹터의 Mining 수익을 일시적으로 약탈

참여: Carrier 이상 함선 필요, 최대 5명 연합 가능

진행:
  습격 선언 (1시간 예고) →
  섹터 방어자들 집결 시간 →
  함선 전투 →
  승리 시: 해당 섹터 Mining 수익의 20%를 공격자에게 귀속 (6시간)
  패배 시: 함선 손실

제한:
  같은 섹터 연속 습격 불가 (48시간 쿨다운)
  Governor Siege 진행 중인 섹터 습격 불가

서사:
  "Cerberus Scars가 외부 해적에게 6시간 점거됨"
  → 섹터 주민들의 반격 → 해방 전투 → 전설
```

---

## 4. Guild War 완전 재설계

### 4.1 기존 Guild War 문제점

```
현재:
  선전포고 → 미니게임 → 승패
  
문제:
  미니게임은 게임의 세계관과 무관
  픽셀 전투 게임에서 미니게임은 이질감
  서사가 생기지 않음
  대형 전쟁의 느낌 없음
```

### 4.2 새로운 Guild War 3단계 구조

```
[1단계] 선전포고 (선택: 즉시전 or 예약전)
  즉시전: 200 GP → 24시간 전쟁 즉시 시작
  예약전: 200 GP → 72시간 후 시작 (준비 기간)
            → 준비 기간에 함선 건조, 동맹 모집, 베팅 시작

[2단계] 전쟁 진행 (24~72시간)
  포인트 경쟁 시스템:
    함선 전투 승리: +10포인트
    적 영토 Hijack: +5포인트
    적 채굴 원정 격퇴: +3포인트
    적 거점 영토 함락: +20포인트 (상대 Guild HQ 영토)

  전쟁 지도:
    두 길드의 영토가 색상으로 구분되어 실시간 표시
    전선이 이동하는 것이 보임
    전투가 일어난 위치에 전투 아이콘 표시

  동맹 참전:
    동맹 길드가 전쟁 지원 선언 시 참전 가능
    최대 3개 길드 연합 vs 3개 길드 연합

[3단계] 전쟁 종료
  72시간 후 포인트 합산
  또는 어느 한쪽이 완전 항복 선언 (GP 배상 조건)

  승리 조건:
    포인트 우세 종료: 승자 결정
    항복: 패자 Guild Treasury의 30% 몰수

  보상:
    승리 길드 전원: GP 보상 + "전쟁 영웅" 칭호 (시즌 한정)
    최다 전공자: "War MVP" 칭호 + Hall of Fame 기록

  Chronicle:
    전쟁 전체 요약 자동 생성
    "A 길드 vs B 길드 72시간 전쟁 — A 최종 승리"
    Discord/Telegram 발송
```

### 4.3 Guild War 지도 표시

```javascript
// 전쟁 중 지도에 추가되는 시각 요소:

// 1. 길드 영토 색상 코딩
// 공격 길드: 빨간 테두리
// 방어 길드: 파란 테두리
// 중립: 기본

// 2. 활성 전투 마커
// 함선 전투 중인 위치에 교차 검 아이콘 (⚔️)

// 3. 전선(Battle Line)
// 두 길드 영토의 경계선을 굵은 선으로 표시
// 전선이 이동하면 애니메이션

// 4. 함선 이동 표시
// 원정 중인 함선들의 이동 경로 점선으로 표시

// SSE로 실시간 업데이트
GET /api/public/war/active
→ 진행 중인 모든 Guild War 현황
```

---

## 5. 연합 전쟁 (Coalition War)

### 5.1 발동 조건

```yaml
자연 발생 조건:
  - Guild War에 동맹 길드가 3개 이상 참전 시 자동으로 Coalition War 상태
  - 또는 3개 이상 길드가 공동 선전포고 가능

의미:
  소규모 길드들이 연합해 대형 길드에 맞서는 구조
  "다윗 vs 골리앗" 서사의 구조적 발생 장치
  리니지 바츠 해방 전쟁의 재현 가능성
```

### 5.2 Coalition War 특수 규칙

```yaml
연합 지휘 구조:
  연합 리더: 가장 먼저 선전포고한 길드의 리더
  연합 채팅: 참전 길드 리더들 전용 채널 자동 생성
  전략 투표: 주요 결정은 다수결 (예: 항복 여부)

특수 보상:
  소수 병력으로 대형 길드 승리 시 "Coalition Victory" Chronicle
  "다수를 이긴 연합" 칭호 자동 부여

약점:
  연합 내 배신 가능 (다른 쪽에 정보 팔기)
  배신 발생 시 자동으로 Chronicle 기록 "연합 내 배신자 등장"
  → 이게 서사의 꽃
```

---

## 6. 자랑할 수 있는 시각적 요소 설계

### 6.1 함선 외형 커스터마이징

```yaml
유저가 자신의 함선을 꾸밀 수 있음:
  함선 색상 변경: GP 100
  함선 문양 추가 (길드 엠블럼): 자동
  함선 이름 설정: GP 20
  특수 이펙트:
    불꽃 꼬리 (Rare): 마켓 구매
    번개 이펙트 (Epic): 특수 전투 보상
    황금 도장 (Legendary): Titan 전용

자랑 요소:
  Titan은 지도에서 다른 유저 모두에게 보임 (대형 픽셀)
  "+5 강화 Carrier" → 빛나는 효과
  Hall of Fame 등록 함선은 특수 아이콘
```

### 6.2 전투 결과 카드 (공유용)

```yaml
전투 종료 시 자동 생성되는 공유 카드:

카드 내용:
  배경: 전투가 일어난 섹터 지도
  양측 편성: 함선 픽셀 아트 나열
  결과: "승리" or "패배" 대형 텍스트
  통계:
    - 파괴한 적 함선: X척
    - 손실한 아군 함선: Y척
    - 약탈한 자원: Z개
    - 전투 지속 시간: N분

OG 이미지 생성:
  /share/battle/:battleId
  X(트위터) 공유 시 자동 프리뷰

자동 공유 유도:
  Titan 전투 승리 시: "역사적 전투에 승리했습니다. 공유하시겠습니까?"
  Coalition Victory 시: 모든 참전자에게 공유 팝업
```

### 6.3 Hall of Fame — 함선 관련

```yaml
새 카테고리:
  'first_titan_built': 서버 최초 Titan 건조
  'titan_destroyer': 처음으로 적 Titan 파괴
  'longest_expedition': 최장 채굴 원정 거리
  'largest_fleet': 최대 함선 편성 전투
  'perfect_defense': 아군 함선 1척 손실 없이 방어 성공
  'great_betrayal': Guild War 중 연합 배신 (플레이어 이름 영구 기록)
```

---

## 7. 일론 머스크 맥락 활용

### 7.1 게임 내 SpaceX 오마주 (상표 침해 없이)

```yaml
함선 이름 체계 (SpaceX 연상하되 독자적):
  Scout → "Sparrow" (Falcon 연상)
  Raider → "Hawk" (Falcon Heavy 연상)
  Carrier → "Starfarer" (Starship 연상)
  Dreadnought → "Colossus" (Super Heavy 연상)
  Titan → "Prometheus" (신화 기반, 독자적)

이벤트 연동:
  실제 SpaceX 발사 뉴스 → 게임 내 특별 이벤트 트리거
  "오늘 실제 화성 탐사선이 발사됐습니다. 화성에서도 전투가 격렬해집니다"
  → 해당 날 모든 전투 보상 2배

마케팅 언어:
  "지구인이 화성을 쟁취할 시간이 됐다"
  "Elon says Mars is next. We're already there."
  → r/SpaceX, r/elonmusk 커뮤니티에 유기적 노출 가능

X(트위터) 전략:
  게임 공식 X 계정: @OccupyMarsGame
  SpaceX 뉴스에 리플로 게임 컨텐츠 노출
  "당신이 화성을 정복하는 동안 Elon은 아직 준비 중" 같은 밈 활용
```

### 7.2 Titan 함선의 스토리텔링

```yaml
Titan 건조까지:
  재료: meteorite_fragment 50개 (로켓 이벤트에서만 획득)
  시간: 72시간 (3일)
  서버 최대 3척 동시 존재

Titan이 전장에 나타나면:
  전체 서버 공지: "⚠️ [유저명]의 Titan이 [섹터명]에 나타났습니다"
  지도에서 모든 유저에게 보임
  Chronicle 자동 기록

Titan 파괴 시:
  Chronicle: "KimWarrior의 Prometheus가 연합에 의해 격침됐다"
  Discord 전체 발송
  파괴한 유저: "Titan Slayer" 칭호
  잔해물: ancient_metal 50개 (건조 비용의 25%)
  → 모두가 잔해를 노리는 2차 전투 발생 가능성

이것이 서버 전설이 된다.
```

---

## 8. DB 전체 구조

### 8.1 함선 관련 테이블

```sql
-- 함선 설계도
CREATE TABLE ship_blueprints (
  id              SERIAL PRIMARY KEY,
  ship_type       VARCHAR(20) NOT NULL,  -- 'scout','raider','carrier','dreadnought','titan'
  name_en         VARCHAR(50),
  name_ko         VARCHAR(50),
  name_ja         VARCHAR(50),
  name_zh         VARCHAR(50),
  size_width      INT NOT NULL,          -- 픽셀 너비
  size_height     INT NOT NULL,
  base_hp         INT NOT NULL,
  base_atk        INT NOT NULL,
  base_def        INT NOT NULL,
  base_spd        INT NOT NULL,
  base_range      INT NOT NULL,
  build_time_min  INT NOT NULL,          -- 건조 시간 (분)
  server_max_count INT DEFAULT NULL,     -- NULL = 무제한
  is_craftable    BOOLEAN DEFAULT TRUE,
  sort_order      INT DEFAULT 0
);

-- 함선 건조 재료
CREATE TABLE ship_build_requirements (
  id              SERIAL PRIMARY KEY,
  blueprint_id    INT NOT NULL REFERENCES ship_blueprints(id),
  resource_code   VARCHAR(30) NOT NULL REFERENCES resources(code),
  quantity        INT NOT NULL
);

-- 유저 함선 인스턴스 (Enhancement의 item_instances와 동일 패턴)
CREATE TABLE ship_instances (
  id              SERIAL PRIMARY KEY,
  user_id         INT NOT NULL REFERENCES users(id),
  guild_id        INT REFERENCES guilds(id),
  blueprint_id    INT NOT NULL REFERENCES ship_blueprints(id),
  ship_name       VARCHAR(50),           -- 유저 설정 이름
  enhance_level   INT DEFAULT 0,         -- +0~+5
  current_hp      INT NOT NULL,
  max_hp          INT NOT NULL,
  status          VARCHAR(20) DEFAULT 'docked',
  -- 'docked','traveling','mining','combat','damaged','destroyed'
  location_sector VARCHAR(30) REFERENCES sector_definitions(code),
  location_x      DECIMAL(10,4),
  location_y      DECIMAL(10,4),
  color_hex       VARCHAR(7),
  special_effect  VARCHAR(30),
  built_at        TIMESTAMP DEFAULT NOW(),
  last_combat_at  TIMESTAMP
);

-- 함선 건조 큐
CREATE TABLE ship_build_queue (
  id              SERIAL PRIMARY KEY,
  user_id         INT NOT NULL REFERENCES users(id),
  blueprint_id    INT NOT NULL REFERENCES ship_blueprints(id),
  status          VARCHAR(20) DEFAULT 'building', -- 'building','ready','cancelled'
  started_at      TIMESTAMP DEFAULT NOW(),
  completes_at    TIMESTAMP NOT NULL,
  materials_consumed JSONB
);

-- 함선 초기 데이터
INSERT INTO ship_blueprints
  (ship_type, name_en, name_ko, name_ja, name_zh,
   size_width, size_height, base_hp, base_atk, base_def, base_spd, base_range,
   build_time_min, server_max_count, sort_order)
VALUES
('scout',       'Sparrow',    '스패로',     'スパロー',   '麻雀',  4,  4,  100,  10,  5,  10, 3, 30,    NULL, 1),
('raider',      'Hawk',       '호크',       'ホーク',     '鹰',    8,  6,  300,  30,  15, 8,  4, 120,   NULL, 2),
('carrier',     'Starfarer',  '스타패러',   'スターファーラー','星行者',12,10,1000, 80,  50, 5,  6, 360,   NULL, 3),
('dreadnought', 'Colossus',   '콜로서스',   'コロッサス', '巨神',  20, 16, 3000, 200, 150,3,  8, 1440,  NULL, 4),
('titan',       'Prometheus', '프로메테우스','プロメテウス','普罗',  32, 24, 10000,500, 400,1,  12,4320,  3,    5);

-- 함선 건조 재료
INSERT INTO ship_build_requirements (blueprint_id, resource_code, quantity) VALUES
(1, 'iron_dust', 50),   (1, 'red_sand', 20),
(2, 'iron_dust', 200),  (2, 'red_sand', 100),  (2, 'ice_crystal', 20),
(3, 'iron_dust', 500),  (3, 'ice_crystal', 100),(3, 'volcanic_shard', 50),
(4, 'iron_dust', 2000), (4, 'ice_crystal', 500),(4, 'volcanic_shard', 200),(4, 'ancient_metal', 20),
(5, 'iron_dust', 10000),(5, 'ice_crystal', 2000),(5, 'volcanic_shard', 1000),(5, 'ancient_metal', 200),(5, 'meteorite_fragment', 50);
```

### 8.2 전투 관련 테이블

```sql
-- 전투 인스턴스
CREATE TABLE battles (
  id              SERIAL PRIMARY KEY,
  battle_type     VARCHAR(30) NOT NULL,
  -- 'expedition_attack','territory_siege','guild_war_combat','pvp_duel','sector_raid'
  attacker_id     INT REFERENCES users(id),
  attacker_guild_id INT REFERENCES guilds(id),
  defender_id     INT REFERENCES users(id),
  defender_guild_id INT REFERENCES guilds(id),
  sector_code     VARCHAR(30) REFERENCES sector_definitions(code),
  status          VARCHAR(20) DEFAULT 'preparing',
  -- 'preparing','active','completed','cancelled'
  attacker_fleet  JSONB NOT NULL,  -- [{ship_instance_id, role}]
  defender_fleet  JSONB NOT NULL,
  attacker_tactic VARCHAR(20) DEFAULT 'balanced', -- 'aggressive','balanced','defensive'
  defender_tactic VARCHAR(20) DEFAULT 'defensive',
  current_turn    INT DEFAULT 0,
  battle_log      JSONB DEFAULT '[]',  -- 턴별 전투 로그
  attacker_score  INT DEFAULT 0,
  defender_score  INT DEFAULT 0,
  winner          VARCHAR(20),         -- 'attacker','defender','draw'
  resources_looted JSONB DEFAULT '{}',
  started_at      TIMESTAMP,
  ends_at         TIMESTAMP,
  completed_at    TIMESTAMP,
  chronicle_id    INT                  -- 연결된 Chronicle
);

-- 전투 턴 로그 (상세)
CREATE TABLE battle_turns (
  id              SERIAL PRIMARY KEY,
  battle_id       INT NOT NULL REFERENCES battles(id),
  turn_number     INT NOT NULL,
  events          JSONB NOT NULL,
  -- [{type: 'attack', attacker_ship_id, target_ship_id, damage, result: 'hit/destroyed'}]
  attacker_ships_remaining INT,
  defender_ships_remaining INT,
  processed_at    TIMESTAMP DEFAULT NOW()
);

-- 채굴 원정
CREATE TABLE mining_expeditions (
  id              SERIAL PRIMARY KEY,
  leader_id       INT NOT NULL REFERENCES users(id),
  guild_id        INT REFERENCES guilds(id),
  destination_sector VARCHAR(30) REFERENCES sector_definitions(code),
  status          VARCHAR(20) DEFAULT 'preparing',
  ship_formation  JSONB NOT NULL,
  departed_at     TIMESTAMP,
  arrived_at      TIMESTAMP,
  mining_ends_at  TIMESTAMP,
  returns_at      TIMESTAMP,
  resources_collected JSONB DEFAULT '{}',
  battle_id       INT REFERENCES battles(id),  -- 공격받았을 때
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Guild War
CREATE TABLE guild_wars (
  id              SERIAL PRIMARY KEY,
  attacker_guild_id   INT NOT NULL REFERENCES guilds(id),
  defender_guild_id   INT NOT NULL REFERENCES guilds(id),
  coalition_attacker  JSONB DEFAULT '[]',  -- 연합 참전 길드 ID 배열
  coalition_defender  JSONB DEFAULT '[]',
  war_type        VARCHAR(20) DEFAULT 'declared', -- 'instant','declared'
  status          VARCHAR(20) DEFAULT 'preparing',
  gp_cost         INT NOT NULL,
  attacker_points INT DEFAULT 0,
  defender_points INT DEFAULT 0,
  declared_at     TIMESTAMP DEFAULT NOW(),
  war_starts_at   TIMESTAMP NOT NULL,
  war_ends_at     TIMESTAMP NOT NULL,
  winner_guild_id INT REFERENCES guilds(id),
  surrender_by    INT REFERENCES guilds(id),
  treasury_looted DECIMAL(20,8) DEFAULT 0,
  total_battles   INT DEFAULT 0,
  chronicle_id    INT
);
```

### 8.3 settings 추가

```sql
INSERT INTO settings (key, value, description) VALUES
-- 함선 관련
('ship_build_crafter_time_bonus', '0.70', 'Crafter 건조 시간 배율'),
('ship_build_crafter_material_bonus', '0.85', 'Crafter 재료 절약 배율'),
('ship_build_guild_time_bonus', '0.80', '길드 건조소 시간 배율'),
('ship_titan_server_max', '3', '서버 Titan 최대 존재 수'),
('ship_wreck_resource_rate', '0.40', '파괴 시 재료 회수율'),
('ship_wreck_duration_min', '30', '잔해 수거 가능 시간(분)'),

-- 전투 관련
('battle_turn_interval_sec', '30', '전투 턴 처리 간격(초)'),
('battle_max_duration_min', '120', '전투 최대 지속 시간(분)'),
('battle_expedition_attack_pp_cut', '0.20', '원정 약탈 자원 비율'),
('battle_territory_siege_pp_bonus', '0.30', '함선 공성 추가 PP'),
('sector_raid_mining_cut', '0.20', '섹터 습격 채굴 수익 약탈 비율'),
('sector_raid_duration_hours', '6', '섹터 습격 효과 지속 시간'),
('sector_raid_cooldown_hours', '48', '섹터 습격 쿨다운'),

-- Guild War
('guild_war_instant_cost_gp', '200', '즉시 선전포고 GP'),
('guild_war_declared_cost_gp', '200', '예약 선전포고 GP'),
('guild_war_prepare_hours', '72', '예약전 준비 시간'),
('guild_war_duration_hours', '72', '전쟁 지속 시간'),
('guild_war_surrender_treasury_cut', '0.30', '항복 시 Treasury 몰수 비율'),
('guild_war_ship_battle_points', '10', '함선 전투 승리 포인트'),
('guild_war_hijack_points', '5', 'Hijack 성공 포인트'),
('guild_war_hq_capture_points', '20', '상대 HQ 영토 함락 포인트'),

-- Chronicle
('chronicle_titan_spawn', 'true', 'Titan 출격 시 서버 공지'),
('chronicle_titan_destroy', 'true', 'Titan 파괴 시 Chronicle'),
('chronicle_coalition_victory', 'true', '연합 승리 Chronicle'),
('chronicle_great_betrayal', 'true', '배신 Chronicle');
```

---

## 9. 서비스 구조

### 9.1 services/combat.js

```javascript
/**
 * services/combat.js
 * 전투 핵심 로직
 */

// 전투 턴 처리 (30초마다 스케줄러가 호출)
async function processBattleTurn(battleId) {
  const battle = await getBattle(battleId);
  if (battle.status !== 'active') return;

  const attackerFleet = await getFleetState(battle.attacker_fleet);
  const defenderFleet = await getFleetState(battle.defender_fleet);

  const turnEvents = [];

  // 각 공격 함선이 사거리 내 적 공격
  for (const ship of attackerFleet.alive) {
    const target = findNearestEnemy(ship, defenderFleet.alive);
    if (!target || distance(ship, target) > ship.range) continue;

    const damage = calculateDamage(ship.atk, target.def);
    target.current_hp -= damage;

    turnEvents.push({
      type: 'attack',
      attacker_ship_id: ship.id,
      attacker_name: ship.ship_name,
      target_ship_id: target.id,
      target_name: target.ship_name,
      damage,
      target_remaining_hp: Math.max(0, target.current_hp)
    });

    if (target.current_hp <= 0) {
      turnEvents.push({
        type: 'destroyed',
        ship_id: target.id,
        ship_type: target.ship_type,
        ship_name: target.ship_name,
        owner_nickname: target.owner_nickname
      });
      await destroyShip(target.id, battle.id);
      await createWreckage(target, battle.sector_code);
    }
  }

  // 방어 함선도 동일하게 처리

  // 이동 처리
  await moveFleets(attackerFleet, defenderFleet, battle.tactics);

  // 턴 저장
  await saveBattleTurn(battle.id, battle.current_turn + 1, turnEvents);

  // 승리 조건 체크
  const result = checkVictory(attackerFleet, defenderFleet, battle);
  if (result) {
    await resolveBattle(battle.id, result);
  }
}

// 피해 계산 (단순하되 전술 영향)
function calculateDamage(atk, def) {
  const base = Math.max(1, atk - def * 0.5);
  const variance = 0.8 + Math.random() * 0.4; // ±20% 랜덤
  return Math.floor(base * variance);
}

// 전투 해결
async function resolveBattle(battleId, result) {
  const battle = await getBattle(battleId);

  // 자원 약탈 처리
  if (result.winner === 'attacker' && battle.battle_type === 'expedition_attack') {
    const expedition = await getExpeditionByBattle(battleId);
    const lootRate = parseFloat(await getSetting('battle_expedition_attack_pp_cut'));
    await lootExpeditionResources(expedition, battle.attacker_id, lootRate);
  }

  // Chronicle 기록
  await chronicleService.checkBattleRecord(battle, result);

  // Titan 파괴 시 특별 처리
  const destroyedTitan = await checkTitanDestroyed(battleId);
  if (destroyedTitan) {
    await chronicleService.record('titan_destroyed', {
      destroyer_id: result.winner_id,
      titan_owner_id: destroyedTitan.user_id,
      sector_code: battle.sector_code,
      titan_name: destroyedTitan.ship_name
    });
    await awardTitle(result.winner_id, 'titan_slayer');
  }

  // 함선 HP 업데이트
  await updateFleetAfterBattle(battle);

  await db.query(
    'UPDATE battles SET status=$2, winner=$3, completed_at=NOW() WHERE id=$1',
    [battleId, 'completed', result.winner]
  );
}
```

### 9.2 services/expedition.js

```javascript
/**
 * services/expedition.js
 * 채굴 원정 관리
 */

async function launchExpedition(leaderId, destinationSector, shipFormation) {
  // 함선 검증
  for (const {ship_id, role} of shipFormation) {
    const ship = await getShip(ship_id);
    if (ship.user_id !== leaderId && ship.guild_id !== await getUserGuildId(leaderId)) {
      return { error: 'invalid_ship' };
    }
    if (ship.status !== 'docked') {
      return { error: 'ship_not_docked', ship_id };
    }
  }

  // 거리 기반 이동 시간 계산
  const travelTime = calculateTravelTime(
    await getUserHomeSector(leaderId),
    destinationSector
  );

  const expedition = await db.query(`
    INSERT INTO mining_expeditions
    (leader_id, destination_sector, status, ship_formation,
     departed_at, arrived_at, mining_ends_at, returns_at)
    VALUES ($1, $2, 'traveling', $3, NOW(),
      NOW() + $4::interval,
      NOW() + $4::interval + $5::interval,
      NOW() + $4::interval + $5::interval + $4::interval)
    RETURNING *
  `, [leaderId, destinationSector, JSON.stringify(shipFormation),
      `${travelTime} minutes`,
      `${calculateMiningDuration(shipFormation)} minutes`]);

  // 함선 상태 업데이트
  for (const {ship_id} of shipFormation) {
    await updateShipStatus(ship_id, 'traveling', destinationSector);
  }

  // Chronicle: 대형 원정 공지
  if (shipFormation.length >= 5) {
    await chronicleService.record('large_expedition', {
      leader_id: leaderId,
      destination: destinationSector,
      fleet_size: shipFormation.length
    });
  }

  return { success: true, expedition: expedition.rows[0] };
}

// 원정 공격 (다른 유저가 원정 중인 함대 공격)
async function attackExpedition(attackerId, expeditionId, attackerFleet) {
  const expedition = await getExpedition(expeditionId);
  if (!['traveling', 'mining'].includes(expedition.status)) {
    return { error: 'not_attackable' };
  }

  // 전투 생성
  const battle = await combatService.createBattle({
    battle_type: 'expedition_attack',
    attacker_id: attackerId,
    defender_id: expedition.leader_id,
    sector_code: expedition.destination_sector,
    attacker_fleet: attackerFleet,
    defender_fleet: expedition.ship_formation
  });

  await updateExpeditionStatus(expeditionId, 'combat', battle.id);
  return { success: true, battle };
}
```

### 9.3 services/guildwar.js

```javascript
/**
 * services/guildwar.js
 */

async function declareWar(attackerGuildId, defenderGuildId, warType) {
  const cost = parseInt(await getSetting(`guild_war_${warType}_cost_gp`));
  const guildGP = await getGuildTreasuryGP(attackerGuildId);

  if (guildGP < cost) return { error: 'insufficient_treasury_gp' };

  await deductGuildGP(attackerGuildId, cost);

  const prepareHours = warType === 'declared'
    ? parseInt(await getSetting('guild_war_prepare_hours'))
    : 0;
  const durationHours = parseInt(await getSetting('guild_war_duration_hours'));

  const now = new Date();
  const warStart = new Date(now.getTime() + prepareHours * 3600000);
  const warEnd = new Date(warStart.getTime() + durationHours * 3600000);

  const war = await db.query(`
    INSERT INTO guild_wars
    (attacker_guild_id, defender_guild_id, war_type, status,
     gp_cost, war_starts_at, war_ends_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [attackerGuildId, defenderGuildId, warType,
      warType === 'instant' ? 'active' : 'preparing',
      cost, warStart, warEnd]);

  // Chronicle + Webhook
  await chronicleService.record('guild_war_declared', {
    attacker_guild: await getGuildName(attackerGuildId),
    defender_guild: await getGuildName(defenderGuildId),
    war_type: warType,
    starts_at: warStart
  });

  // Territory War Betting 이벤트 생성
  await bettingService.createBettingEvent(
    'guild_war', war.rows[0].id,
    await getGuildName(attackerGuildId),
    await getGuildName(defenderGuildId)
  );

  return { success: true, war: war.rows[0] };
}

// 연합 참전
async function joinWarAsCoalition(guildId, warId, side) {
  const war = await getWar(warId);
  if (war.status !== 'preparing') return { error: 'war_already_started' };

  const field = side === 'attacker' ? 'coalition_attacker' : 'coalition_defender';
  const current = war[field] || [];

  if (current.length >= 2) return { error: 'coalition_full' }; // 최대 3길드 (원래 1 + 연합 2)

  current.push(guildId);
  await db.query(
    `UPDATE guild_wars SET ${field} = $2 WHERE id = $1`,
    [warId, JSON.stringify(current)]
  );

  // 배신 감지 로직 (같은 길드가 양쪽에 가입 시도)
  // ...

  return { success: true };
}

// Guild War 포인트 계산
async function addWarPoints(warId, side, eventType) {
  const pointsMap = {
    'ship_battle_win': await getSetting('guild_war_ship_battle_points'),
    'hijack': await getSetting('guild_war_hijack_points'),
    'hq_capture': await getSetting('guild_war_hq_capture_points')
  };

  const points = parseInt(pointsMap[eventType] || 1);
  const field = side === 'attacker' ? 'attacker_points' : 'defender_points';

  await db.query(
    `UPDATE guild_wars SET ${field} = ${field} + $2 WHERE id = $1`,
    [warId, points]
  );
}
```

---

## 10. 프론트엔드 구현 지침

### 10.1 함선 건조 UI (My Base 탭)

```
격납고 탭 (신규):
  ┌─────────────────────────────────┐
  │ 🚀 격납고 (HANGAR)               │
  │ 도입함: 3/5 슬롯                 │
  ├────────────────┬────────────────┤
  │ 내 함선 목록   │ 건조 큐        │
  │                │                │
  │ ⚡ Sparrow +2  │ 🔨 Hawk 건조중 │
  │ HP: 100/100   │ 완료: 1:23:45  │
  │ [출격] [강화] │                │
  │                │ [새 함선 건조] │
  │ 🚀 Hawk +0    │                │
  │ HP: 180/300   │ 설계도 목록:   │
  │ [수리] [출격] │ Scout ✓        │
  │                │ Raider ✓       │
  │                │ Carrier ✗      │
  └────────────────┴────────────────┘

함선 건조 모달:
  Hawk 건조
  재료: iron_dust 200/200 ✓ / ice_crystal 15/20 ✗
  건조 시간: 2시간
  Crafter 직업 보너스: 시간 -30% = 1시간 24분
  [건조 시작] [취소]
```

### 10.2 전투 화면 (지도 오버레이)

```
전투 시작 시 지도에 오버레이:
  함선 픽셀 아트가 지도 위를 실제 이동
  레이저/미사일 이펙트 (얇은 선)
  파괴 시 픽셀 폭발 애니메이션

전투 패널 (오른쪽):
  ┌─────────────────────┐
  │ ⚔️ BATTLE LIVE      │
  │ KimWarrior 길드     │
  │ vs                  │
  │ Defender 길드       │
  ├─────────────────────┤
  │ 공격 함선: ████░ 4/5│
  │ 방어 함선: ██░░░ 2/5│
  ├─────────────────────┤
  │ 전투 로그:          │
  │ Hawk이 Scout 파괴   │
  │ Carrier 중파!       │
  │ Sparrow 격침됨      │
  ├─────────────────────┤
  │ 경과: 00:04:32      │
  │ [관전] [베팅] [공유]│
  └─────────────────────┘
```

### 10.3 원정 출격 UI

```
원정 출격 (지도에서 섹터 우클릭 → "원정 출격"):
  ┌─────────────────────────────────┐
  │ 🚀 채굴 원정대 편성              │
  │ 목적지: Hellas Abyss             │
  │ 이동 시간: 45분                  │
  │ 채굴 시간: 2시간                 │
  │ 귀환 시간: 45분                  │
  │ 총 소요: 3시간 30분             │
  ├─────────────────────────────────┤
  │ 함선 편성:                       │
  │ 채굴함: [Sparrow ▼] [+ 추가]    │
  │ 호위함: [Hawk ▼] [+ 추가]       │
  ├─────────────────────────────────┤
  │ 예상 획득 자원:                  │
  │ ancient_metal: 0~3개 (5%)       │
  │ volcanic_shard: 2~8개 (30%)     │
  │ ice_crystal: 5~15개 (40%)       │
  ├─────────────────────────────────┤
  │ ⚠️ 원정 중 공격받을 수 있습니다 │
  │ [출격] [취소]                    │
  └─────────────────────────────────┘
```

---

## 11. Migration 순서

```
Migration 094: 함선 설계도 + 건조 시스템
  - ship_blueprints, ship_build_requirements 테이블
  - ship_instances, ship_build_queue 테이블
  - services/shipyard.js (건조 로직)
  - 격납고 UI

Migration 095: 전투 엔진
  - battles, battle_turns 테이블
  - services/combat.js (턴 처리 + 피해 계산)
  - 전투 스케줄러 (30초 턴)
  - 전투 시각화 UI (Three.js 오버레이)

Migration 096: 채굴 원정
  - mining_expeditions 테이블
  - services/expedition.js
  - 원정 출격 UI
  - 원정 공격 API

Migration 097: Guild War 재설계
  - guild_wars 테이블
  - services/guildwar.js
  - 선전포고 UI + 전쟁 지도 표시
  - Coalition 참전 UI

Migration 098: 섹터 습격 (Sector Raid)
  - services/raid.js
  - 습격 선언 UI
  - 습격 현황 표시

Migration 099: Chronicle 전투 연동
  - 전투 결과 → Chronicle 자동 기록
  - Titan 출격/파괴 서버 공지
  - 공유 카드 (전투 결과)

Migration 100: 함선 커스터마이징
  - 색상/이름/이펙트 설정
  - 마켓플레이스에 함선 거래 추가
```

---

## 12. Claude Code 작업 지시

### Migration 094 작업 지시

```
COMBAT_BIBLE_V1.md의 Migration 094를 구현해줘.

[1단계] DB:
  - ship_blueprints 테이블 + 5종 함선 초기 데이터
  - ship_build_requirements 테이블 + 재료 데이터
  - ship_instances 테이블
  - ship_build_queue 테이블
  - settings 추가 (함선 관련 설정)

[2단계] services/shipyard.js:
  - getBlueprint(shipType)
  - canBuild(userId, blueprintId) → 재료 충분 여부 체크
  - startBuild(userId, blueprintId) → 건조 시작 + 재료 차감
  - checkBuildComplete() → 스케줄러용, 완료된 건조 처리
  - getHangar(userId) → 내 함선 목록

[3단계] API:
  GET  /api/ships/blueprints    → 설계도 목록
  GET  /api/user/hangar         → 내 격납고
  POST /api/ships/build/start   → 건조 시작
  GET  /api/ships/build/queue   → 건조 큐 확인

[4단계] 프론트엔드:
  My Base에 HANGAR 탭 추가
  함선 목록 표시
  건조 큐 표시

제약:
  자원 차감은 user_resource_inventory 테이블 사용
  (Migration 085에서 생성된 것)
  Crafter 직업 시 건조 시간/재료 버프 적용
  (services/job.js의 getJobBuff 사용)
```

### Migration 095 작업 지시

```
COMBAT_BIBLE_V1.md의 Migration 095를 구현해줘.

[1단계] DB:
  - battles, battle_turns 테이블

[2단계] services/combat.js:
  - createBattle(config) → 전투 생성
  - processBattleTurn(battleId) → 턴 처리 (가장 중요)
  - calculateDamage(atk, def) → 피해 계산
  - checkVictory(attackerFleet, defenderFleet) → 승리 조건
  - resolveBattle(battleId, result) → 전투 종료 처리

[3단계] 스케줄러:
  기존 스케줄러 파일에 추가:
  매 30초: 활성 전투(status='active') 전부 processBattleTurn 실행

[4단계] 전투 시각화:
  SSE 엔드포인트: GET /api/battle/:id/stream
  지도에 함선 위치 실시간 표시
  전투 패널 UI

중요:
  픽셀 함선 이동 애니메이션은 Three.js로 구현
  기존 글로브 코드 위에 레이어 추가
  함선은 단순 픽셀 직사각형 (복잡한 모델 불필요)
```

---

## 13. 완성 후 기대 서사

### 시나리오: 서버 첫 Titan 건조

```
Day 1: [CRAFT_KING]이 72시간 건조 시작
  → "Titan 건조 시작됨" 서버 공지
  → 모든 유저: "저걸 막아야 해"

Day 3: Titan 완성
  → "⚠️ CRAFT_KING의 Prometheus가 Hellas Abyss로 출격합니다"
  → 전서버 공지
  → 연합 결성: 5개 길드가 긴급 동맹

Day 3, 오후: Titan vs 연합 함대 전투
  → 21척 연합 vs Titan 1척 + 호위함 8척
  → 전투 30분 진행
  → 관전자 200명 (전 서버 유저가 지켜봄)
  → Territory War Betting 3,000 GP 베팅

Day 3, 저녁: Titan 격침
  → "CRAFT_KING의 Prometheus가 격침됐습니다"
  → [HERO_KID]가 최후의 일격 → "Titan Slayer" 칭호
  → 잔해에서 ancient_metal 80개 수거 경쟁 시작

Chronicle 자동 생성:
  "The Siege of Hellas — 서버 최초 Titan, 연합에 격침되다"
  Discord 전체 발송
  X에 공유하는 유저들 다수

결과:
  신규 유저 유입: "저 게임에서 무슨 일이 있었어?"
  기존 유저 리텐션: "다음 Titan은 내가 만들겠다"
```

**이것이 서사입니다.**
