# 생산자↔소비자 경제 검수 + 시뮬 (2026-06-03)

## 🔴 발견·수정한 버그 (mig 304)
- **마켓 등록이 통째로 깨져 있었음.** `transactions.type`가 varchar(20)인데 `marketplace.js:54`가
  `'marketplace_listing_fee'`(23자)를 INSERT → "value too long" → `/api/marketplace/list` 전체 실패.
  생산자-소비자 재료 순환의 **핵심 링크(채굴자가 재료를 시장에 올리는 것)가 막혀 있었음.**
- 수정: mig 304로 `transactions.type` → varchar(40). 라이브 재검증 후 마켓 정상.

## 검수 결과 — 구조는 건강함 (Explore 초기 결론은 오진)
1. **재료 매칭 OK**: 채굴이 함선 재료를 직접 떨굼(iron_ore/carbon_fiber/titanium_alloy/exotic_alloy/
   plasma_crystal/quantum_core/dark_matter…). 함선 전용 크래프트는 alloy_frame/plasma_coil뿐(raw로 제작).
2. **재료 P2P 시장 존재·동작**(E2E 검증): list/buy로 채굴자→빌더 재료 이전 + GP 이전 + 5% 수수료 sink.
3. **티어 전문화 구조**:
   | 섹터(레벨) | 떨구는 재료 | 함선 |
   |---|---|---|
   | frontier(lv0) | iron_ore .50, carbon_fiber .30, silicon_chip .20 | 프리깃 |
   | mid | titanium_alloy .25, plasma_crystal .20, nano_polymer .20 | 순양/배틀십 |
   | core(lv20+) | exotic_alloy .10, quantum_core .12, dark_matter .15 | 타이탄/배틀십 희귀 |

## 시뮬 — 생산/수요 밸런스 (실측 드롭률/레시피)
- 핵심재료 일일 생산(1클레임): frontier iron_ore 0.92, mid titanium_alloy 0.69, core exotic_alloy 0.55.
- **자급 소요일(단독)**: 프리깃 4.4일(1)/0.4일(10클레임), 배틀십 65.5/6.5일, 타이탄 145.5/14.5일.
- 결론: 프리깃은 신규 즉시 자급. **배틀십/타이탄은 단독 자급이 수십~수백일 → 시장 구매가 사실상 필수
  = 전문화 강제(건강한 설계).** exotic/quantum/dark_matter는 core(lv20+) 전용이라 신규는 시장에서만 입수
  → core 채굴자에게 수요·GP 유입.

## 수요 깊이 (사용자 우려: "코스메틱 안 팔리고 함선만")
재료 소비 sink는 함선만이 아님:
- 함선 건조(프리깃~타이탄), 함선 무한 스탯강화(titanium/plasma/level), **영토 전쟁 아이템**(crafting_recipes:
  에너지/플라즈마 실드, EMP, 픽셀더블러 등 — titanium/plasma/exotic/iron_ore/silicon 소비, **기능성**),
  full-loss 전투로 인한 영구 재건 수요.
- 코스메틱(이미지/배너 등)은 대체로 flavor/무료 — 경제가 여기 의존하지 않음. **수요는 함선+전쟁아이템+강화**가 떠받침.

## 판정
**생산자-소비자 순환 = 건강(수정 후).** 티어 전문화 + 작동하는 재료 시장 + 다층 수요 sink + full-loss
재건 수요. 시장이 끊겨 있던 mig304 버그만이 진짜 문제였고 수정됨. GP는 채굴자→빌더로 흐르고 수수료/소각으로 빠짐.
