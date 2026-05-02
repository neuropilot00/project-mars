# Campaign Story Mode — Scene Schema v1.0

> Occupy Mars 캠페인을 일본 모바일 게임급 시나리오 스토리 모드로 리디자인하기 위한 씬 스크립트 포맷.
> 참조: Arknights, FGO, Honkai Star Rail, Genshin Impact 스토리 모드.

---

## 설계 원칙

1. **서버 최소 변경**: 기존 start → choice → complete 플로우 유지. 씬 내비게이션은 100% 클라이언트.
2. **씬 = 대화 + 연출 단위**: 한 챕터 안에 10~25개 씬. 유저가 탭/클릭으로 진행.
3. **전략적 선택은 기존 그대로**: 챕터당 1개 핵심 선택지 → 서버 전송. 씬 내 선택은 연출용.
4. **에셋 점진 도입**: Phase 1은 캐릭터 초상화 + 배경 일러스트. Phase 2에서 애니메이션/BGM 추가.

---

## Runtime Layout Fields (v5.44)

에디터에서 저장한 배치값은 서버 저장 layout, `scene.layout` 또는 각 `line.layout`에 넣는다. 런타임은 `layout`, `editorLayout`, `stageLayout` 세 이름을 모두 읽으며, 같은 키가 있으면 line 값이 scene 값을 덮어쓴다.

```json
{
  "id": "s10",
  "type": "dialogue",
  "background": "cargo_ship_corridor",
  "layout": {
    "background": { "x": 50, "y": 35, "size": "cover" },
    "characters": {
      "berk": { "x": 50, "y": 50, "w": 58, "scale": 1 },
      "left": { "x": 18, "y": 60, "w": 42 }
    },
    "dialogBox": { "left": 4, "bottom": 7, "width": 92, "height": 22 },
    "mobile": {
      "characters": { "berk": { "x": 23, "y": 62, "w": 54 } },
      "dialogBox": { "left": 5, "bottom": 7, "width": 90, "height": 25 }
    }
  },
  "lines": [
    {
      "speaker": "berk",
      "text": { "ko": "승객 중에 화성이 처음인 분 계십니까." },
      "layout": {
        "characters": { "berk": { "x": 50, "y": 54, "w": 62 } }
      }
    }
  ]
}
```

지원 키:
- `background` / `bg` / `image`: `x`, `y`, `size`, `scale`, `opacity`
- `characters`: 캐릭터 ID 또는 `left`/`right` 키로 `x`, `y`, `w`/`width`, `h`/`height`, `scale`, `opacity`, `z`
- `dialogBox` / `dialog` / `textbox`: `left`, `top`, `right`, `bottom`, `width`, `height`, `padding`, `background`, `border`
- `overlay` / `detailOverlay` / `closeup`: `x`, `y`, `w`, `h`, `opacity`, `z`
- `desktop`, `mobile`: 화면 폭에 따라 위 키들을 추가로 덮어쓴다.

---

## Chapter 구조

```
Chapter
├── meta (제목, 위치, 환경, 추정 플레이 시간)
├── characters[] (이 챕터에 등장하는 캐릭터 ID 목록)
├── scenes[] (순서대로 진행되는 씬 배열)
│   ├── Scene: dialogue (대화 씬)
│   ├── Scene: narration (나레이션/풍경 묘사)
│   ├── Scene: choice (전략적 선택지 — 서버 전송)
│   ├── Scene: branch (연출용 분기 — 클라이언트 전용)
│   ├── Scene: battle_transition (전투 돌입 연출)
│   ├── Scene: result (전투 결과 연출)
│   └── Scene: ending (챕터 마무리)
└── rewards (기존 보상 시스템 그대로)
```

---

## Scene Types

### 1. `dialogue` — 대화 씬

캐릭터가 대사를 주고받는 기본 단위. 한 씬에 1~15개 대사.

```json
{
  "id": "s01",
  "type": "dialogue",
  "background": "mars_docking_bay",
  "bgm": "tension_low",
  "lines": [
    {
      "speaker": "lifang",
      "emotion": "neutral",
      "text": {
        "ko": "프로필 봤어. 화성 경력 없지?",
        "en": "Read your profile. No Mars experience?",
        "ja": "プロフィール見た。火星の経験なし？",
        "zh": "看了你的简历。没有火星经验？"
      },
      "effect": null
    },
    {
      "speaker": "player",
      "emotion": "calm",
      "text": {
        "ko": "......",
        "en": "......",
        "ja": "……",
        "zh": "……"
      },
      "effect": "screen_shake_subtle"
    },
    {
      "speaker": "lifang",
      "emotion": "smirk",
      "text": {
        "ko": "좋아. 말 없는 사람이 일을 잘해.",
        "en": "Good. Quiet people get things done.",
        "ja": "いいね。寡黙な人間は仕事ができる。",
        "zh": "好。沉默的人干得好。"
      },
      "effect": "character_enter:lifang:slide_left"
    }
  ]
}
```

### 2. `narration` — 나레이션/풍경 씬

캐릭터 없이 분위기를 깔아주는 씬. 배경 전환, CG 표시 등.

```json
{
  "id": "s02",
  "type": "narration",
  "background": "mars_surface_dust_storm",
  "bgm": "ambient_wind",
  "transition": "fade_slow",
  "lines": [
    {
      "text": {
        "ko": "화성의 하늘은 핏빛이었다.\n먼지 폭풍이 에레부스 분화구를 삼키고 있었다.",
        "en": "The Martian sky was blood-red.\nA dust storm was swallowing Erebus Crater.",
        "ja": "火星の空は血の色だった。\n砂嵐がエレバス・クレーターを飲み込んでいた。",
        "zh": "火星的天空血红一片。\n沙尘暴正在吞噬厄瑞玻斯陨石坑。"
      },
      "duration": 3000
    }
  ]
}
```

### 3. `choice` — 전략적 선택지 (서버 전송)

기존 choices[] 시스템과 1:1 매핑. 이 씬에서 선택한 값이 `/api/campaign/choice`로 전송됨.

```json
{
  "id": "s08",
  "type": "choice",
  "background": "mcc_briefing_room",
  "prompt": {
    "ko": "Li Fang이 당신을 바라본다. 결정의 시간이다.",
    "en": "Li Fang looks at you. Time to decide.",
    "ja": "Li Fangがあなたを見つめる。決断の時だ。",
    "zh": "Li Fang看着你。是时候做决定了。"
  },
  "choices": [
    {
      "id": "ch1_accept",
      "text": {
        "ko": "이해했습니다. 시간 안에 끝내죠.",
        "en": "Understood. I'll finish within the time limit.",
        "ja": "了解しました。時間内に終わらせます。",
        "zh": "明白了。我会在时间内完成。"
      },
      "tone": "professional",
      "preview_hint": {
        "ko": "→ MCC 호감도 유지",
        "en": "→ MCC favor maintained"
      }
    },
    {
      "id": "ch1_moral_concern",
      "text": {
        "ko": "산소 탱크 손상 시 정착지 동결 문제는?",
        "en": "What about settlement freezing if oxygen tanks are damaged?",
        "ja": "酸素タンクが損傷したら定住地の凍結問題は？",
        "zh": "如果氧气罐损坏，定居点冻结问题怎么办？"
      },
      "tone": "empathetic",
      "preview_hint": {
        "ko": "→ FSP 호감도 +2, 민간인 우선",
        "en": "→ FSP favor +2, civilian priority"
      }
    },
    {
      "id": "ch1_tactical",
      "text": {
        "ko": "Helion이 Dust Storm 알면 가속할 텐데요.",
        "en": "Helion will accelerate if they know about the Dust Storm.",
        "ja": "HelionがDust Stormを知れば加速するのでは。",
        "zh": "如果Helion知道沙尘暴会加速的。"
      },
      "tone": "analytical",
      "preview_hint": {
        "ko": "→ MCC 호감도 +3, 전술가 태그",
        "en": "→ MCC favor +3, tactician tag"
      }
    },
    {
      "id": "ch1_negotiate",
      "text": {
        "ko": "보수 협상부터.",
        "en": "Let's negotiate the pay first.",
        "ja": "まず報酬の交渉から。",
        "zh": "先谈报酬。"
      },
      "tone": "mercenary",
      "preview_hint": {
        "ko": "→ MCC 호감도 -2, 보수 보너스",
        "en": "→ MCC favor -2, pay bonus"
      }
    }
  ]
}
```

### 4. `branch` — 연출용 분기 (클라이언트 전용)

서버에 안 보내는 가벼운 분기. 대사 톤만 바뀌고 결과에 영향 없음.

```json
{
  "id": "s05",
  "type": "branch",
  "prompt": {
    "ko": "(무엇을 먼저 물어볼까?)",
    "en": "(What should I ask first?)"
  },
  "options": [
    {
      "label": { "ko": "Helion에 대해", "en": "About Helion" },
      "goto": "s05a"
    },
    {
      "label": { "ko": "Dust Storm에 대해", "en": "About the Dust Storm" },
      "goto": "s05b"
    }
  ]
}
```

### 5. `battle_transition` — 전투 돌입 연출

선택 완료 후 전투로 넘어가는 시네마틱 씬.

```json
{
  "id": "s10",
  "type": "battle_transition",
  "background": "space_battle_start",
  "bgm": "battle_theme_mcc",
  "transition": "flash_white",
  "title": {
    "ko": "작전 개시 — 산소 회수 작전",
    "en": "Operation Start — Oxygen Recovery"
  },
  "subtitle": {
    "ko": "Dust Storm 도래까지 5시간 58분",
    "en": "5h 58m until Dust Storm"
  }
}
```

### 6. `result` — 전투 결과 연출

서버 complete 응답을 받아서 결과를 드라마틱하게 표시.

```json
{
  "id": "s12",
  "type": "result",
  "success_scene": "s12a",
  "failure_scene": "s12b"
}
```

### 7. `ending` — 챕터 마무리

다음 챕터 예고, 여운 대사.

```json
{
  "id": "s15",
  "type": "ending",
  "background": "mars_sunset",
  "bgm": "ambient_melancholy",
  "lines": [
    {
      "speaker": "lifang",
      "emotion": "thoughtful",
      "text": {
        "ko": "첫 계약 치고 나쁘지 않았어. ...다음엔 더 어려워질 거야.",
        "en": "Not bad for a first contract. ...Next time will be harder.",
        "ja": "初めての契約にしては悪くなかった。…次はもっと厳しくなる。",
        "zh": "作为第一份合同还不错。……下次会更难的。"
      }
    }
  ],
  "next_chapter_preview": {
    "questId": "mcc_campaign_ch2",
    "teaser": {
      "ko": "다음 이야기: 동결된 고속도로",
      "en": "Next: Frozen Highway"
    }
  }
}
```

---

## Character Registry

각 캐릭터의 메타데이터. 초상화, 감정 스프라이트, 말투 등.

```json
{
  "characters": {
    "lifang": {
      "name": { "ko": "Li Fang", "en": "Li Fang" },
      "title": { "ko": "MCC 특수사업부 이사", "en": "MCC Special Operations Director" },
      "faction": "mcc",
      "portrait": "assets/campaign/characters/lifang.png",
      "emotions": ["neutral", "smirk", "serious", "angry", "surprised", "thoughtful"],
      "voice_style": "sharp, efficient, no wasted words"
    },
    "player": {
      "name": { "ko": "???", "en": "???" },
      "title": { "ko": "", "en": "" },
      "faction": null,
      "portrait": "assets/campaign/characters/player_silhouette.png",
      "emotions": ["calm", "determined", "hesitant", "shocked"],
      "voice_style": "minimal, actions over words"
    },
    "mikhail": {
      "name": { "ko": "Mikhail Anders", "en": "Mikhail Anders" },
      "title": { "ko": "FSP 의장", "en": "FSP Chairman" },
      "faction": "fsp",
      "portrait": "assets/campaign/characters/mikhail.png",
      "emotions": ["warm", "serious", "sad", "determined", "nostalgic"],
      "voice_style": "slow, gentle, pauses between words"
    },
    "chen": {
      "name": { "ko": "Chen Weiss", "en": "Chen Weiss" },
      "title": { "ko": "MCC 회장 겸 CEO", "en": "MCC Chairman & CEO" },
      "faction": "mcc",
      "portrait": "assets/campaign/characters/chen.png",
      "emotions": ["cold", "calculating", "neutral", "contempt", "rare_warmth"],
      "voice_style": "precise, efficient, never repeats"
    },
    "butcher": {
      "name": { "ko": "Butcher Vasquez", "en": "Butcher Vasquez" },
      "title": { "ko": "CV Chairman", "en": "CV Chairman" },
      "faction": "cv",
      "portrait": "assets/campaign/characters/butcher.png",
      "emotions": ["stoic", "menace", "pain", "rare_warmth", "silence"],
      "voice_style": "one word at a time, pauses with dashes"
    },
    "lena": {
      "name": { "ko": "Lena Torres", "en": "Lena Torres" },
      "title": { "ko": "FSP 보안", "en": "FSP Security" },
      "faction": "fsp",
      "portrait": "assets/campaign/characters/lena.png",
      "emotions": ["cheerful", "serious", "joking", "protective", "grief"],
      "voice_style": "direct, jokes often, calls player Boss"
    },
    "cinder": {
      "name": { "ko": "Cinder Grace", "en": "Cinder Grace" },
      "title": { "ko": "CV Rank 4 Warlord", "en": "CV Rank 4 Warlord" },
      "faction": "cv",
      "portrait": "assets/campaign/characters/cinder.png",
      "emotions": ["neutral", "tense", "honest", "conflicted", "resolute"],
      "voice_style": "clear, miner's speech, dual-faced (official vs personal)"
    },
    "hale": {
      "name": { "ko": "Rev. Hale", "en": "Rev. Hale" },
      "title": { "ko": "Olympus 종교 중립 지대 사제", "en": "Olympus Neutral Zone Priest" },
      "faction": "neutral",
      "portrait": "assets/campaign/characters/hale.png",
      "emotions": ["serene", "grave", "compassion", "authority"],
      "voice_style": "gentle but authoritative, 30 years of memory"
    },
    "amara": {
      "name": { "ko": "Amara Okafor", "en": "Amara Okafor" },
      "title": { "ko": "전 FSP 의장", "en": "Former FSP Chairman" },
      "faction": "fsp",
      "portrait": "assets/campaign/characters/amara.png",
      "emotions": ["warm", "diplomatic", "resolute", "weary", "fierce"],
      "voice_style": "clear, warm but weighty, diplomatic detours that always arrive"
    },
    "vasco": {
      "name": { "ko": "Vasco 'Crow' Reyes", "en": "Vasco 'Crow' Reyes" },
      "title": { "ko": "CV 입문 동기", "en": "CV Initiate" },
      "faction": "cv",
      "portrait": "assets/campaign/characters/vasco.png",
      "emotions": ["grin", "serious", "loyal", "hurt", "defiant"],
      "voice_style": "fast, warm, quotes the Outland Code"
    },
    "hagar": {
      "name": { "ko": "Hagar Volkov", "en": "Hagar Volkov" },
      "title": { "ko": "New Athens 조선소 책임자", "en": "New Athens Shipyard Chief" },
      "faction": "fsp",
      "portrait": "assets/campaign/characters/hagar.png",
      "emotions": ["gruff", "proud", "moved", "nostalgic"],
      "voice_style": "ships are people, people are ships, 30 years"
    },
    "liang": {
      "name": { "ko": "Liang Wei", "en": "Liang Wei" },
      "title": { "ko": "FSP 의원 / 외계 금속 학자", "en": "FSP Council / Xenometal Scholar" },
      "faction": "fsp",
      "portrait": "assets/campaign/characters/liang.png",
      "emotions": ["excited", "thoughtful", "hesitant", "visionary"],
      "voice_style": "visionary, slows down for miners, always scribbling notes"
    }
  }
}
```

---

## Background Registry

배경 이미지 목록. 점진적으로 추가.

```
assets/campaign/backgrounds/
├── mars_docking_bay.jpg         — 화성 도킹 항만 (Prologue, MCC Ch1)
├── mars_surface_dust_storm.jpg  — 먼지 폭풍 화성 표면
├── mars_sunset.jpg              — 화성 일몰 (핏빛 황혼)
├── mcc_briefing_room.jpg        — MCC 브리핑룸 (25도 라운지 아님)
├── mcc_25deg_lounge.jpg         — Chen의 25도 라운지 (MCC Ch3~)
├── erebus_crater_interior.jpg   — CV 본거지 내부 (모닥불)
├── erebus_crater_exterior.jpg   — CV 본거지 외부 (영하 100도)
├── hellas_central_fsp.jpg       — FSP 본부 내부
├── hellas_mining_outpost.jpg    — 광산 시설
├── kepler_crater.jpg            — 케플러 분화구
├── olympus_summit.jpg           — Olympus 산자락 회담장
├── new_athens_shipyard.jpg      — 조선소
├── sandstone_junction.jpg       — 사암 교차로 광부 마을
├── space_battle_start.jpg       — 우주 전투 진입
├── cargo_ship_interior.jpg      — 화물선 내부 (Prologue)
└── mars_outland_night.jpg       — 화성 광야 밤
```

---

## UI 렌더링 Flow (클라이언트)

```
[챕터 시작]
    ↓
showCampaignStory(chapter)
    ↓
┌─────────────────────────────────────────┐
│  배경 이미지 (전체 화면 or 모달 배경)      │
│                                          │
│  ┌──────┐                                │
│  │캐릭터 │  ← 좌/우 배치, 감정별 표정     │
│  │초상화 │                                │
│  └──────┘                                │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │ 대화창                            │    │
│  │ [캐릭터명]                        │    │
│  │ 대사 텍스트 (타이핑 애니메이션)    │    │
│  └──────────────────────────────────┘    │
│                                          │
│              [탭하여 계속]                 │
└─────────────────────────────────────────┘
    ↓ (클릭/탭)
다음 대사 or 다음 씬
    ↓ (choice 씬 도달)
┌─────────────────────────────────────────┐
│  선택지 UI                               │
│  ┌─────────────────────────────────┐     │
│  │ 💬 선택지 1 텍스트               │     │
│  │    → 결과 힌트                   │     │
│  └─────────────────────────────────┘     │
│  ┌─────────────────────────────────┐     │
│  │ 💬 선택지 2 텍스트               │     │
│  └─────────────────────────────────┘     │
│  ...                                     │
└─────────────────────────────────────────┘
    ↓ (서버 전송)
[전투 연출] → [결과] → [엔딩 씬] → [다음 챕터 예고]
```

### 타이핑 애니메이션
- 한 글자씩 표시 (30ms/글자)
- 탭하면 즉시 전체 표시
- 전체 표시 상태에서 다시 탭하면 다음 대사

### 캐릭터 전환 연출
- `character_enter:lifang:slide_left` — 좌측에서 슬라이드 인
- `character_exit:lifang:fade` — 페이드 아웃
- `character_emotion:lifang:angry` — 표정 변경
- `screen_shake` — 화면 흔들림
- `flash_white` / `fade_black` — 전환 효과

---

## 서버 연동 (최소 변경)

### 기존 API 변경 없음
- `POST /api/campaign/start` — 그대로
- `POST /api/campaign/choice` — 그대로 (choice 씬의 선택 ID 전송)
- `POST /api/campaign/complete` — 그대로

### 추가 필요
- `GET /api/campaign/story/:questId` — 해당 챕터의 scenes[] 배열 반환
  - 또는 CHAPTERS 객체에 `scenes` 필드 추가하고 `publicChapter()`에서 포함

### campaign.js 변경
- 각 CHAPTERS 객체에 `scenes: [...]` 배열 추가
- `publicChapter()` 함수에서 scenes 포함하여 클라이언트에 전달
- 기존 `briefing`, `choices`는 하위호환용으로 유지 (scenes가 없는 챕터는 기존 방식 폴백)

---

## Phase 계획

### Phase 1 — 시나리오 + 초상화 (현재)
- [ ] MCC Ch1 풀 시나리오 작성 (15~20 씬)
- [ ] 주요 캐릭터 10명 초상화 생성 (나노바나나)
- [ ] 배경 이미지 5~8장 생성
- [ ] 클라이언트 씬 엔진 구현 (타이핑, 캐릭터 전환, 배경 전환)
- [ ] 선택지 UI 리디자인

### Phase 2 — 전체 MCC/FSP Route
- [ ] MCC Ch2~10 시나리오
- [ ] FSP Ch1~10 시나리오
- [ ] 추가 캐릭터 초상화/배경
- [ ] BGM/SFX 시스템

### Phase 3 — CV Route + 연출 강화
- [ ] CV Ch1~10 시나리오 + 게임 SPEC 동시 설계
- [ ] 전투 시뮬 연출 강화
- [ ] CG 일러스트 (핵심 장면)

---

**END · SCENE_SCHEMA v1.0**
