# EXISTING_SPECS

> 기존에 작성한 데이터 SPEC 7개 파일의 위치, 구조, 본 소설 트랙에서의 활용법.

---

## 기존 SPEC 파일 목록

다음 파일들은 게임 구현용 데이터 명세. 본 소설 트랙은 이를 **참조**만 한다 (수정 안 함).

### 위치 (사용자 시스템)

```
mars-novel/
└── _spec_reference/
    ├── codex-spec-common-systems.md         (1,266 lines, 공통 시스템)
    ├── codex-spec-mcc-ch1-3.md             (이전 세션, 정확한 줄 수 미상)
    ├── codex-spec-mcc-ch4-7.md             (이전 세션)
    ├── codex-spec-mcc-ch8-10.md            (이전 세션)
    ├── codex-spec-fsp-ch1-3.md             (이전 세션)
    ├── codex-spec-fsp-ch4-6.md             (3,484 lines)
    ├── codex-spec-fsp-ch7-10.md            (6,528 lines, FSP 마감)
    └── codex-spec-cv-ch1-3.md              (작성 중, ~3,200 lines, CV Ch1+Ch2 완성, Ch3 미완)
```

**중요**: CV Ch4~10, Hidden Observer, Prologue는 spec이 없음. 소설 트랙에서 처음부터 새로 씀.

---

## SPEC 활용법

### 1. SPEC에서 가져올 것

**사건 구조**:
- 챕터별 무대 (위치, 환경, 시간)
- 등장 NPC 목록과 역할
- 핵심 결정 분기점
- 결정의 결과 (인물 관계, 다음 챕터 영향)

**인물 정보**:
- NPC 외양 디테일 (Butcher의 의수, Hagar의 새끼손가락 잘림 등)
- NPC 시그니처 패턴 (Mikhail 차 두 손으로, Lena의 "보스" 호칭 등)
- NPC 대사 톤 (이미 SPEC에서 매카시 톤에 가깝게 작성됨)

**lore 디테일**:
- 30년 광부 학살 사건
- Sandstone 약속
- Roth 데이터 / Ancient Metal
- 25도 라운지 / 광부 곡괭이 / 차 의식

### 2. SPEC에서 가져오지 않을 것

**게임 시스템 언어**:
- HP, 평판, GP, XP
- 태그, branch_modifier, lore_flag
- sec, phase, trigger
- choice_id, decision_id, ending_id
- DB 스키마, SQL, YAML 구조

이런 것들은 절대 본문에 노출 ❌. 매카시 톤 깨짐.

**시간 표기**:
- SPEC: `at_sec_720`, `phase_2`, `1800 sec`
- 소설: "그날 오후", "한참 후", "어떤 밤"

**메커니즘 설명**:
- SPEC: `civilian_donation_pool >= 200000`
- 소설: 시민들이 돈을 모으는 행위 자체를 풍경으로

### 3. 분기는 SPEC의 분기 트리 따름

각 챕터의 분기 갈림길은 SPEC에 정의되어 있음. 소설은 그 분기 트리를 자연스럽게 풀어냄.

예시:
- SPEC: `ch8_donate_personal_50k` choice → `tag: fsp_brotherhood`
- 소설: Player가 자비를 부담한다고 말하는 행동, 그 결정의 무게, Mikhail의 눈물, 그 결과로 시민이 되는 풍경

---

## 챕터별 SPEC 매핑

작성 시 해당 챕터의 SPEC 부분을 먼저 정독. 이후 소설로 풀어냄.

### Prologue
- SPEC 없음. 새로 작성.
- 다만 `codex-spec-common-systems.md`의 reputation/tag 시스템 이해 필요 (4 entry path 시드 위해)

### MCC Ch1~10
- `codex-spec-mcc-ch1-3.md` (Ch1~3)
- `codex-spec-mcc-ch4-7.md` (Ch4~7)
- `codex-spec-mcc-ch8-10.md` (Ch8~10)
- 이 파일들은 이전 세션에서 작성됨. Claude Code 세션에서 사용자께서 위치 확인 후 복사 필요.

### FSP Ch1~3
- `codex-spec-fsp-ch1-3.md`

### FSP Ch4~6
- `codex-spec-fsp-ch4-6.md` (3,484 lines)

### FSP Ch7~10
- `codex-spec-fsp-ch7-10.md` (6,528 lines)
- §1 Ch7 Assembly
- §2 Ch8 Gaia
- §3 Ch9 Three Flags
- §4 Ch10 Freedom's Price

### CV Ch1~3
- `codex-spec-cv-ch1-3.md` (작성 중)
- §1 Ch1 Initiation (완성)
- §2 Ch2 First Blood (완성)
- §3 Ch3 The Mercenary's Code (작성 중간 단계)
- ⚠️ Ch3는 spec도 미완. 소설 작성 시 일부 spec 보충 필요할 수 있음.

### CV Ch4~10
- SPEC 없음. **소설 트랙에서 새로 설계.**
- WORLD_BIBLE의 화성 세계관 + CHAPTER_OUTLINES의 한 줄 요약을 기반으로 작성.
- 사용자 검토 받으면서 진행.

### Hidden Observer Ch1~5
- SPEC 없음. **소설 트랙에서 처음부터 설계.**
- 사용자 결정 필요한 영역 다수.

---

## SPEC 회수 시 매카시 변환 예시

### 예시 1: SPEC에서 소설로 변환

**SPEC** (codex-spec-fsp-ch7-10.md, FSP Ch8 §2 발췌):
```yaml
- choice_id: ch8_donate_personal_50k
  label_ko: "자비 부담 (50,000 Cr 기부)"
  requires: { credits_min: 50000 }
  effects:
    donation_pool_delta: +50000
    reputation_delta: { fsp: 50 }
    tags_added: [fsp_brotherhood, the_humble_giver]
```

**대사 SPEC**:
```yaml
ch8_hagar_02_player_donated:
  ko: "...자비를 — 부담했다고? 외부인이? ...내 30년 일에서 — 처음 보는 일이야.
       손가락 한 마디 — 없는 — 노인이 — 50K 기부하는 외부인을 — 처음 봤어.
       함선 안 — 같이 들어가."
```

**소설**:
```
그녀는 단상으로 갔다. Mikhail이 비켜섰다. 그녀가 입을 열었다.

자비 부담할게요.

방 안 누구도 말하지 않았다. Mikhail이 그녀를 보았다. 한참 보았다.
모래폭풍이 창밖에서 멈췄다. 그날 처음으로 멈췄다.

50,000.

그녀는 말했다. 그러고 더 말하지 않았다.

Hagar가 단상 옆에서 들었다. 30년 차 조선공이었다. 손가락 한 마디가
없었다. 그가 그녀를 보았다. 그러고 다시 함선을 보았다. 그러고 다시
그녀를 보았다.

함선 안 같이 들어가 그가 말했다.

그것이 그가 그날 그녀에게 한 모든 말이었다.
```

게임 시스템 언어 0개. 매카시 톤 100%. SPEC의 핵심 (자비 부담, Hagar의 인정, fsp_brotherhood 태그의 정신)은 모두 회수.

---

### 예시 2: SPEC의 분기 결정을 소설로

**SPEC** (CV Ch1 Test 2 의리 시험):
```yaml
- choice_id: ch1_test2_execute
  label_ko: "처형 — 광야 코드 적용"
  effects:
    butcher_warmth: +0.20
    cinder_warmth: -0.15
    tag: the_loyal_executor
```

**소설**:
```
부처는 의자에 앉았다. 광부 곡괭이를 책상에 두었다. 그가 그녀를 보았다.

자네 — 어떻게 — 처리할 — 건가.

그녀는 Reza를 보았다. Reza는 무릎을 꿇고 있었다. 손이 떨렸다.

처형하겠습니다.

그녀는 말했다. 부처는 답하지 않았다. 의자에서 일어나지 않았다.
그녀에게 곡괭이를 건네지 않았다. 그러나 그가 한 손을 들었다. Cinder가
방을 나갔다. 정비공 복장이었다. 문이 닫혔다.

부처가 곡괭이를 들었다.

자네가 — 해.

그가 말했다.
```

분기 결정의 무게가 풍경과 침묵으로 표현됨. 매카시 톤.

---

## SPEC에 없는 것을 소설에서 만들 때

CV Ch4~10, Hidden Observer, Prologue처럼 SPEC이 없는 영역에서는:

1. **WORLD_BIBLE**의 lore 일관성 유지
2. **CHARACTER_SHEETS**의 인물 시그니처 반영
3. **CHAPTER_OUTLINES**의 한 줄 요약을 기반으로 확장
4. **STYLE_GUIDE** 톤 유지
5. 새로 만든 lore는 WORLD_BIBLE에 추가 (다음 챕터에서 회수 위해)
6. 새로 만든 인물 디테일은 CHARACTER_SHEETS에 추가
7. 사용자께 확인 — 큰 결정은 사용자 OK 받고 진행

---

## SPEC 충돌 시

만약 SPEC끼리 충돌하거나 (예: FSP Ch4의 NPC 이름이 CV Ch5에서 다르게 등장) 발견 시:

1. 충돌 부분을 사용자께 보고
2. 어느 쪽이 정통인지 확인
3. WORLD_BIBLE에 정정 후 본 소설 트랙은 수정된 정통 따름
4. SPEC 자체는 수정 안 함 (D안 원칙)

---

## SPEC 활용 팁

- **챕터 작성 전 SPEC 정독**: 5~10분 정도. 핵심 사건과 분기 머릿속에 정리.
- **SPEC의 NPC 대사는 거의 그대로 회수 가능**: 이미 매카시 톤에 가깝게 작성됨.
- **SPEC의 풍경 묘사는 그대로 안 가져옴**: 형식적이라 톤 어긋남. 매카시 풍으로 다시 씀.
- **SPEC의 시간 표기는 절대 안 가져옴**: 모호한 매카시 시간으로.

---

**END · EXISTING_SPECS**
