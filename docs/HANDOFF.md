# Occupy Mars — AI Handoff Document
> Last updated: 2026-04-30  
> 이 파일을 읽으면 다른 AI 세션이 즉시 이어서 작업 가능

---

## 프로젝트 개요
- **게임명**: Occupy Mars (project-mars)
- **스택**: Node.js + PostgreSQL (Railway) / 단일 파일 프론트엔드 `index.html` (35k+ lines)
- **배포**: GitHub push → Railway 자동 배포 (`origin: github.com/neuropilot00/project-mars`)
- **절대 규칙**: `index.html`은 단일 파일 유지. 절대 분리하지 말 것.

---

## 주요 경로
```
index.html                          # 전체 프론트엔드 (35k+ 줄)
server/
  index.js                          # Express 서버 진입점
  db.js                             # DB pool, notifyPlayer, logGPActivity, awardXP
  routes/api.js                     # 모든 /api/* 라우터
  services/
    campaign.js                     # 캠페인 로직 (3300+ 줄)
    daily.js                        # 출석체크 / 데일리 미션
    achievements.js                 # 업적 시스템
    missions.js                     # 무료미션 / 특수작전
assets/campaign/
  backgrounds/                      # 배경 PNG 83개 (9:16 세로 포맷, SD3)
  characters/                       # 캐릭터 초상화 55개 (9:16 세로 포맷, SD3)
  overlays/                         # 씬 디테일 오버레이 35개 (1:1 정사각형, SD3)
docs/campaign-story/
  SCENE_SCHEMA.md                   # 씬 JSON 스키마 정의
  prologue_shared.json              # 공통 프롤로그 (54씬)
  prologue_mcc/fsp/cv.json          # 루트별 프롤로그
  mcc_ch1~ch10_*.json               # MCC 루트 10챕터
  fsp_ch1~ch10_*.json               # FSP 루트 10챕터
  cv_ch1~ch10_*.json                # CV 루트 10챕터
  hidden_ch1~ch5_*.json             # 히든 루트 5챕터
scripts/
  gen_portrait_all.py               # 배경+캐릭터 9:16 재생성 (Stability AI SD3)
  gen_missing_chars.py              # 누락 캐릭터 생성
  gen_overlays.py                   # 오버레이 이미지 생성
```

---

## 캠페인 시스템 구조

### 비주얼 노벨 씬 엔진 (index.html ~24800~25200줄)
- `showCampaignStory(chapter)` — 씬 엔진 진입점
- `renderCampaignScene()` — 현재 씬 렌더
- `advanceCampaignScene()` — 다음 대사/씬으로 이동
- `_campaignScenes[]`, `_campaignSceneIndex`, `_campaignSceneLineIndex` — 상태 변수

### 씬 타입
| 타입 | 설명 |
|------|------|
| `narration` | 배경 전체 + 하단 텍스트 |
| `dialogue` | 배경 + 캐릭터 초상화 + 대화창 |
| `choice` | 서버 전송 선택지 → `chooseCampaignOption()` |
| `branch` | 클라이언트 전용 분기 |
| `battle_transition` | 전투 타이틀 카드 |
| `result` / `ending` | 결과/엔딩 처리 |

### 씬 오버레이 시스템 (2026-04-30 추가)
- `_OVERLAY_KW{}` — 111개 한국어 키워드 → 35개 이미지 매핑
- `_showStoryDetailOverlay(text)` — 대사 텍스트 실시간 스캔 후 우하단 88px 사각형으로 표시
- 키워드 없으면 자동으로 숨김 (JSON 수정 불필요)
- 이미지 경로: `/assets/campaign/overlays/{keyword}.png`

---

## 시나리오 현황
| 루트 | 챕터 | 총 씬 | 총 대사 |
|------|------|-------|--------|
| MCC | 10 | 396 | 685 |
| FSP | 10 | 385 | 950 |
| CV | 10 | 451 | 816 |
| Hidden | 5 | 201 | 201 |
| Prologue | 4 | 165 | 225 |
| **합계** | **39파일** | **1,598** | **2,877** |

### 핵심 서사 — Chen Weiss 타임라인 (정식)
- Chen 나이: **34세**
- 부모 사망: **22년 전** (Zone 12, 기록 봉인)
- 어머니가 17세 Butcher를 광도에서 구출: **30년 전** (Chen이 4살)
- Chen이 MCC 입사: **22년 전** (부모 사망 직후)
- Cinder Grace Zone 12 사건 (11명 사망): **3년 전** (별도 사건)

---

## 최근 완료 작업 (2026-04-30)

### 이미지 전면 교체
- 기존 가로 1280×720 → **9:16 세로 포맷** 전환
- 배경: 83개 / 캐릭터: 55개 / 오버레이: 35개
- 생성 도구: Stability AI SD3 (`sk-PTUCPZoj9uysIUFu0spIL2IE3zq4pqv6axxQMBJRdFCudTMe`)

### 버그 수정
| 항목 | 파일 | 수정 내용 |
|------|------|---------|
| 퀘스트 {n} 치환 | index.html:18118 | `_questDesc()`에서 `requirement_value`로 `{n}` replace |
| 선택 후 평판 즉시 갱신 | index.html:25265 | `chooseCampaignOption()` 성공 후 `loadCampaignStatus()` 추가 |
| 평판 히스토리 방어 | campaign.js:1324 | `reputation_history` INSERT에 try-catch 추가 |
| 출석체크 7일 리셋 | daily.js:53 | 14일→7일 고정, 리셋 시 보상 랜덤 재생성 |
| 업적 알림 불능 | achievements.js:9 | `./notifications` → `../db`에서 직접 import |

---

## 미완성 / 다음 작업 후보
- [ ] 이벤트 CG (클라이맥스 20~30씬용 풀스크린 일러스트)
- [ ] 캐릭터 감정 변형 초상화 (neutral/angry/sad/smirk — 현재는 neutral 하나만)
- [ ] BGM/SFX 시스템 (씬 JSON에 `bgm` 필드는 있으나 오디오 미구현)
- [ ] 특수작전 실제 동작 검증 (서버-클라이언트 연결 확인 필요)
- [ ] 업적 트리거 연결 확인 (checkAndUnlock 호출 시점 전체 감사)
- [ ] 평판 게이지 UI → 실제 DB 값 실시간 연동 확인

---

## DB 스키마 주요 테이블
```sql
player_campaign_progress   -- 챕터 완료 기록
campaign_sessions          -- 진행 중 세션
player_lore_flags          -- 스토리 분기 플래그
player_branch_modifiers    -- 분기 수정자
player_reputation          -- faction별 평판 값
reputation_history         -- 평판 변경 로그
daily_logins               -- 출석체크 기록
user_achievements          -- 달성된 업적
achievements               -- 업적 정의
```

---

## 이미지 재생성 방법
```bash
cd /Users/jongho/Documents/New\ project/project-mars

# 배경 + 캐릭터 전체 재생성 (9:16)
python3 scripts/gen_portrait_all.py --force

# 오버레이만 재생성 (1:1)
python3 scripts/gen_overlays.py --force

# 캐릭터만 신규 생성 (기존 없는 것만)
python3 scripts/gen_missing_chars.py
```

---

## 커밋 컨벤션
```
feat: 새 기능
fix:  버그 수정
chore: 스크립트/에셋 작업
docs: 문서
```
커밋 후 `git push origin main` → Railway 자동 배포 (약 1~2분 소요)
