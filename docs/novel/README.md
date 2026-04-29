# README — Claude Code 세션 시작 가이드

이 폴더는 화성 소설 캠페인 프로젝트의 첫 세팅 패키지입니다.

---

## 폴더 구성 (이 패키지가 담고 있는 것)

```
mars-novel-package/
├── README.md                          ← 본 문서
├── PROJECT_BRIEF.md                   ← 프로젝트 정의 (가장 먼저 읽기)
├── WORLD_BIBLE.md                     ← 화성 세계관
├── CHARACTER_SHEETS.md                ← 인물 시트
├── STYLE_GUIDE.md                     ← 코맥 매카시 톤 가이드 (핵심)
├── CHAPTER_OUTLINES.md                ← 36 챕터 한 줄 요약
├── PERSPECTIVES_MAP.md                ← 다중 시점 배치
├── EXISTING_SPECS.md                  ← 기존 spec 활용법
├── WRITING_PROTOCOL.md                ← 챕터 작성 절차
└── _sample_prologue_first_scene.md    ← 톤 확인용 샘플 (1장)
```

---

## Claude Code 첫 세션 시작 절차

### 1단계: 프로젝트 폴더 생성

본인 컴퓨터에 작업 폴더 만들기. 권장 구조:

```
mars-novel/
├── 00_meta/                  ← 본 패키지 8개 .md 파일을 여기로 복사
├── 01_prologue/              ← 빈 폴더 (Claude Code가 작성)
├── 02_mcc/
├── 03_fsp/
├── 04_cv/
├── 05_hidden/
├── 99_dictionary/            ← 사전 (작업 중 자동 갱신)
│   ├── places.md             ← 빈 파일
│   ├── characters_seen.md
│   └── recurring_motifs.md
├── _spec_reference/          ← 기존 spec 7개 파일 복사
└── _samples/                 ← _sample_prologue_first_scene.md 복사
```

### 2단계: 기존 spec 파일 복사

다음 파일들을 `_spec_reference/`로 복사:
- `codex-spec-common-systems.md` (반드시)
- `codex-spec-fsp-ch1-3.md`
- `codex-spec-fsp-ch4-6.md`
- `codex-spec-fsp-ch7-10.md`
- `codex-spec-cv-ch1-3.md` (작성 중인 것까지)
- MCC spec 파일 3개 (있으면)

### 3단계: git 초기화 (권장)

```bash
cd mars-novel
git init
git add .
git commit -m "Initial setup: meta files + spec references"
```

챕터 작성 후 매번 commit. 톤 흐트러지면 이전 버전으로 복구 가능.

### 4단계: Claude Code 시작

`mars-novel/` 폴더에서 Claude Code 실행. 첫 세션에서 다음 메시지를 그대로 붙여넣기:

---

## ▶ Claude Code 첫 메시지 (복사해서 사용)

```
이 프로젝트는 화성 SF 캠페인의 소설 트랙입니다.
30+ 페이지 챕터 × 36 챕터, 코맥 매카시 톤, 한국어, 다중 시점.

먼저 00_meta/ 폴더 안 8개 파일을 모두 정독해주세요:
1. PROJECT_BRIEF.md
2. WORLD_BIBLE.md
3. CHARACTER_SHEETS.md
4. STYLE_GUIDE.md (가장 중요)
5. CHAPTER_OUTLINES.md
6. PERSPECTIVES_MAP.md
7. EXISTING_SPECS.md
8. WRITING_PROTOCOL.md

그리고 _samples/_sample_prologue_first_scene.md도 읽어주세요. 이게 톤의 기준선입니다.

읽은 후 다음을 보고해주세요:
- 8 문서 사이에 모순이 있는지
- 작업 시작 전에 사용자(저)에게 명확히 해야 할 질문이 있는지
- 기존 spec 파일들이 _spec_reference/에 다 있는지 (없는 게 있으면 알려주세요)

질문 답변 받은 후, Prologue 작성 시작합니다. WRITING_PROTOCOL의 4단계 절차 따라:
1단계 (아웃라인) → 사용자 OK → 2단계 (초고) → 3단계 (lint) → 4단계 (사전 갱신)

천천히. 한 챕터씩. 톤 우선.
```

---

## ▶ 작업 진행 시 주의사항

### 매 챕터마다

- 챕터 시작 전 STYLE_GUIDE.md 다시 읽기 (톤 환기)
- 아웃라인 먼저, 사용자 OK 받은 후 본문
- 본문 작성 후 lint 패스 (체크리스트)
- lint 통과 후 사전 갱신
- git commit

### 톤이 흐트러진다 싶을 때

- 전체 작업 멈춤
- 직전 챕터 마지막 단락 + 매카시 샘플 다시 읽기
- 손상된 챕터의 첫 단락부터 재작성 고려

### 사용자가 부재중일 때

- Claude Code는 백그라운드에서 한 챕터를 통째로 완성 가능
- 단, 큰 결정 (시점 변경, lore 추가 등)은 사용자 OK 기다림
- 작은 디테일은 알아서 결정

---

## ▶ 작업 페이스 권장

- 일주일에 1~2 챕터 (속도보다 톤)
- 메인 라인 36 챕터 = 약 6개월~1년
- 분기 변형까지 = 추가 6개월~1년
- 총 1~2년 장기 프로젝트로 접근

---

## ▶ 추천 워크플로우

```
주 1회 (예: 토요일):
  1. 직전 챕터 검토 + 사용자 피드백 반영
  2. 다음 챕터 아웃라인
  3. 사용자 OK
  4. (백그라운드) Claude Code가 1~3일에 걸쳐 초고 작성
  5. 사용자 검수 + 손보기
  6. 사전 갱신 + commit
```

---

## ▶ 트러블슈팅

### Q. 톤이 어긋나는데 어떻게 복구?

A. 직전 챕터의 톤이 OK였다면 그 챕터 마지막 페이지를 읽고 새 챕터 첫 단락 재작성. STYLE_GUIDE 체크리스트 다시 적용.

### Q. SPEC과 모순되는 사건이 필요할 때?

A. 사용자께 보고. SPEC 수정 가능 여부 확인. 본 트랙은 SPEC 수정 안 함이 원칙이지만, 명백한 SPEC 오류면 예외.

### Q. 분량 부족 (30 페이지 못 채움)

A. 무리해서 늘리지 말고 시점 추가 또는 풍경 더 깊이. 그래도 부족하면 한 챕터 25 페이지로 마감.

### Q. 분량 초과 (50 페이지 넘음)

A. 초과한 부분이 매카시 톤이면 OK. 군더더기면 잘라냄. 한 챕터를 두 챕터로 분할 가능 (CHAPTER_OUTLINES 갱신).

### Q. Player의 정체를 자꾸 명확히 하고 싶다

A. 명확히 하지 않는 것이 본 작품의 의도. STYLE_GUIDE의 Player 항목 재확인. 모호함이 매카시 톤의 핵심.

---

## ▶ 정체성 잠금 (재확인)

다음은 절대 변하지 않음:

1. 코맥 매카시 톤 (한국어 그대로의 단호함)
2. 인용부호 없음
3. 다중 시점, 매 장마다 다른 인물
4. 분기 처리는 메인+2~3 변형
5. SPEC 트랙은 손대지 않음 (참조만)
6. 30+ 페이지 챕터 분량
7. Player는 호명되지 않음 (그/그녀)
8. 감정 직접 표현 금지

---

**END · README**

이 문서들로 시작 가능합니다. 본 작업은 장기 프로젝트입니다. 천천히, 톤 우선으로.
