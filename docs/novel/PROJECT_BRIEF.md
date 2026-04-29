# PROJECT_BRIEF

> Claude Code 첫 세션에서 가장 먼저 읽어야 하는 문서.
> 이 프로젝트의 전체 구조, 목표, 작업 방식.

---

## 프로젝트 정체

**제목** (가제): MARS — Crimson Vermillion / Three Flags
**형태**: 멀티트랙 분기형 소설 캠페인
**원전**: 게임 캠페인을 위한 데이터 명세 (spec)가 이미 작성되어 있음. 이 프로젝트는 그 spec을 **소설로 풀어내는 별도 트랙**.
**언어**: 한국어
**총 분량 추정**: 36 챕터 × 30+ 페이지 × 메인+분기 2~3개 ≈ **3,600+ 페이지**
**기간**: 장기. 한 번에 다 못 씀. 챕터 단위 진행.

---

## 두 트랙 분리 (D안)

### Track 1: 데이터 SPEC (기존, 보존)
- 위치: 사용자 시스템의 별도 폴더 (참고용 첨부)
- 용도: Codex가 게임 구현하기 위한 명세
- 7개 파일:
  - `codex-spec-common-systems.md` (1266 lines)
  - `codex-spec-fsp-ch1-3.md` (FSP 첫 묶음)
  - `codex-spec-fsp-ch4-6.md` (3,484 lines)
  - `codex-spec-fsp-ch7-10.md` (6,528 lines)
  - `codex-spec-cv-ch1-3.md` (작성 중, ~3,200 lines, Ch1+Ch2까지 완성)
  - MCC spec 3개 (이전 세션, 위치 별도)
- 형식: YAML, SQL, choice/effect/flag 표
- **이 트랙은 더 이상 새 작성 안 함. 참조만.**

### Track 2: 소설 (이번에 시작)
- 위치: 본 프로젝트 폴더
- 용도: 사용자가 읽기 위함
- 형식: 산문, 다중 시점, 코맥 매카시 톤
- 분기 처리: 메인 라인 + 주요 분기 2~3개 각각 소설화
- **이 트랙이 본 프로젝트의 작업 대상.**

두 트랙은 **같은 세계, 같은 사건, 같은 인물**을 공유하지만 형식과 목적이 다름. SPEC의 분기 트리·메커니즘이 소설의 사건 구조의 뼈대.

---

## 톤·스타일 핵심

**레퍼런스**: 코맥 매카시 (Cormac McCarthy)
- 『로드』, 『노인을 위한 나라는 없다』, 『핏빛 자오선』의 건조함
- 인용부호 없음
- 형용사·부사 절제
- 짧은 단문과 호흡 긴 종속문의 교차
- 감정을 직접 말하지 않고 행동·풍경에 묻음
- 광야, 폭력, 침묵, 무게

**한국어 매카시 톤** (번역체 회피):
- 번역투 ❌ ("그가 말하기를", "그것은 ~이었던 것이다")
- 한국어의 자연스러운 단호함 ✅ (`그는 말했다`, `그것은 그러했다`)
- 종결어미 단순화: `~다` 위주, `~였다`보다 `~었다`
- 한국어 특유의 주어 생략을 매카시 스타일로 활용

상세 톤 가이드 → STYLE_GUIDE.md 참조

---

## 다중 시점

**원칙**: 장(章)마다 다른 인물의 시점

**시점 인물 풀**:
- Player (외부인, 호명되지 않음, "그" 또는 "그녀")
- Chen Weiss (MCC 회장)
- Mikhail Anders, Amara Okafor, Liang Wei, Lena Torres, Yuna, Diego Ortega (FSP 진영)
- Butcher Vasquez, Cinder Grace, Vasco Reyes (CV 진영)
- Rev. Hale (중립 사제)
- Hagar Volkov (조선소 책임자)
- Olu & Mariam Watanabe (노부부, 시민의 눈)
- Aisha (Reza의 아내, 복수자)
- 운항사·정비공·광부·아이 등 무명 인물 (관찰자)

**같은 사건의 다중 시점 처리**:
- FSP Ch9 회담 = CV Ch9 회담 (같은 사건)
- 한쪽은 Amara 시점, 다른 쪽은 Cinder 시점 또는 Rev. Hale 시점
- 독자가 두 챕터를 읽으면 같은 방의 다른 진실이 보임

상세 → PERSPECTIVES_MAP.md

---

## 분기 처리 규칙

**메인 라인 우선**:
- 각 챕터의 가장 정통적인 결정 경로(canonical)를 먼저 작성
- 메인이 완성된 후 분기 변형 작성

**분기 변형 (챕터당 2~3개)**:
- 각 변형은 별도 파일로 (ch08_main.md, ch08_branch_steal.md 등)
- 변형은 해당 분기의 결정 시점부터 갈라져서 챕터 끝까지
- 분기끼리 같은 풍경·같은 인물이지만 다른 호흡

**작성 순서**:
1. Prologue → MCC Ch1~10 → FSP Ch1~10 → CV Ch1~10 → Hidden Observer Ch1~5 (메인만)
2. 메인 전체 완성 후 → 주요 분기 작성

---

## 작업 단위

**챕터당 3 패스**:
1. **초고 패스**: 30+ 페이지 산문 작성, 톤 우선
2. **톤 검수 패스**: STYLE_GUIDE 기준 자체 lint, 형용사 빈도, 인용부호 누락 확인
3. **일관성 검수 패스**: CHARACTER_SHEETS와 대조, 인물 시그니처 패턴 일치 확인, 풍경·지명 사전 업데이트

**챕터 완성 후 자동 갱신**:
- `dictionary/places.md` (지명 사전, 매번 추가)
- `dictionary/characters_seen.md` (등장 인물 추적)
- `dictionary/recurring_motifs.md` (차 의식, 25도 라운지, 광부 곡괭이 등 모티브 회수 추적)
- `STYLE_GUIDE.md`에 새 패턴 발견 시 추가

---

## 폴더 구조 (Claude Code에서 권장)

```
mars-novel/
├── 00_meta/
│   ├── PROJECT_BRIEF.md           ← 본 문서
│   ├── WORLD_BIBLE.md
│   ├── CHARACTER_SHEETS.md
│   ├── STYLE_GUIDE.md
│   ├── CHAPTER_OUTLINES.md
│   ├── PERSPECTIVES_MAP.md
│   ├── EXISTING_SPECS.md
│   └── WRITING_PROTOCOL.md
├── 01_prologue/
│   ├── prologue_main.md
│   ├── prologue_branch_mcc.md
│   ├── prologue_branch_fsp.md
│   └── prologue_branch_cv.md
├── 02_mcc/
│   ├── ch01_main.md
│   └── ...
├── 03_fsp/
│   └── ...
├── 04_cv/
│   └── ...
├── 05_hidden/
│   └── ...
├── 99_dictionary/
│   ├── places.md
│   ├── characters_seen.md
│   └── recurring_motifs.md
├── _spec_reference/                ← 기존 spec 7개 파일 복사 (참조용)
│   ├── codex-spec-common-systems.md
│   ├── codex-spec-fsp-ch1-3.md
│   └── ...
└── _samples/
    └── prologue_first_scene.md     ← 톤 확인용 초기 샘플
```

---

## Claude Code에 첫 세션에서 줄 지시

다음 메시지 그대로 Claude Code에 붙여넣을 수 있도록 준비:

```
이 프로젝트는 화성 SF 캠페인의 소설 트랙입니다.

먼저 00_meta/ 폴더 안 8개 파일을 모두 읽어주세요:
1. PROJECT_BRIEF.md - 프로젝트 정의
2. WORLD_BIBLE.md - 세계관
3. CHARACTER_SHEETS.md - 인물 시트
4. STYLE_GUIDE.md - 톤 가이드 (코맥 매카시)
5. CHAPTER_OUTLINES.md - 36 챕터 요약
6. PERSPECTIVES_MAP.md - 다중 시점 배치
7. EXISTING_SPECS.md - 기존 spec 활용법
8. WRITING_PROTOCOL.md - 작성 절차

읽은 후 다음을 확인해주세요:
- 8 문서가 서로 모순되는 부분이 있는지
- 사용자에게 작업 시작 전에 명확히 해야 할 질문이 있는지

확인 끝나면 _samples/prologue_first_scene.md를 참고해서
01_prologue/prologue_main.md 작성 시작.

작성 전에 반드시:
- 시점 인물 결정 (PERSPECTIVES_MAP 참조)
- 챕터 내 장(章) 구조 outline 먼저 (3-5 장)
- 사용자 OK 받은 후 본문 작성

진행은 천천히. 한 번에 한 챕터씩.
```

---

## 비기능 요구사항

- **사용자 부재 가능**: Claude Code가 백그라운드에서 한 챕터를 통째로 완성한 후 보고 가능
- **버전 관리**: git 사용 권장. 챕터별 커밋
- **사용자 직접 수정 존중**: 사용자가 손본 부분은 학습. 다음 챕터에서 그 패턴 반영
- **품질 > 속도**: 빠른 양산보다 톤 일관성 우선

---

## 정체성 잠금 (drift 방지)

다음은 **이 프로젝트에서 절대 변하지 않는 것**:

1. 코맥 매카시 톤 (한국어로 번역되지 않은, 한국어 그대로의 단호함)
2. 인용부호 없음
3. 다중 시점, 매 장마다 다른 인물
4. 분기 처리는 메인+2~3 변형 (모든 분기 다 쓰지 않음)
5. SPEC 트랙은 손대지 않음 (참조만)
6. 30+ 페이지 챕터 분량
7. Player는 호명되지 않음 (외부인, 그/그녀)
8. 감정 직접 표현 금지

세션이 길어지면서 톤이 흐려질 위험. 매 챕터 시작 전에 STYLE_GUIDE 재확인.

---

**END · PROJECT_BRIEF**
