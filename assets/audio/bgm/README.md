# 캠페인 BGM (assets/audio/bgm/)

캠페인 씬의 `bgm` 필드(40종)를 **무드 12종**의 실제 CC0 음악으로 매핑해 재생한다.
매핑은 `assets/campaign-system.js #_campaignBgmSrc` (이름 키워드 → mood_*.mp3). 파일 없으면 무음(진행 영향 0).

## 트랙 (12종, 전부 CC0 / 퍼블릭 도메인 · OpenGameArt.org)

| 파일 | 무드 | 출처 (CC0) |
|---|---|---|
| `mood_ambient.mp3` | 평온 앰비언트 (fsp·hellas·quiet) | "Forest Ambience" — TinyWorlds |
| `mood_warm.mp3` | 따뜻/희망 (mcc 계열) | "A New Town (RPG Theme)" — cynicmusic |
| `mood_vast.mp3` | 우주/도착/광활 (prologue·arrival·vast) | "Space Music: Out There" |
| `mood_dark.mp3` | 어둠 (cv·night·wind) | "Cave Theme" |
| `mood_horror.mp3` | 음산/공포 (hidden) | "Post Apocalyptic Wastelands" — Juhani Junkala |
| `mood_tension.mp3` | 긴장/추격 (tension·choice·building) | "Determined Pursuit" — Emma_MA |
| `mood_battle.mp3` | 전투 (battle_build·fade) | "Battle" |
| `mood_boss.mp3` | 대규모 전투 (battle_theme_*·intense) | "Epic Boss Battle" — Juhani Junkala |
| `mood_victory.mp3` | 승리 (victory) | "New Sunrise" — nene |
| `mood_ending.mp3` | 서사 피날레 (ending) | "A Legend Will Rise" |
| `mood_sad.mp3` | 비애 (melancholy) | "The Field Of Dreams" — pauliuw |
| `mood_defeat.mp3` | 패배/희생 (defeat·casualty) | "Lament of the War" — Cethiel |

라이선스: 전부 **CC0(Creative Commons Zero, 퍼블릭 도메인)** — 출처 표기 의무 없음. 위 크레딧은 예의상 기재.

## 매핑 분포 (40 씬이름 → 12 무드)
tension 9 · vast 6 · boss 5 · ambient 4 · dark 3 · warm 3 · battle 2 · defeat 2 · ending 2 · horror 2 · sad 1 · victory 1.
같은 무드로 이어지는 연속 씬은 곡을 재시작하지 않고 유지한다(해석된 src 기준 연속성).

## 교체 / 확장
개별 무드가 마음에 안 들면 같은 파일명(`mood_<무드>.mp3`)의 다른 CC0/구매 트랙으로 덮으면 즉시 적용된다.
더 세분화하려면 `_campaignBgmSrc` 의 무드 분기를 늘리고 그만큼 `mood_*.mp3` 를 추가하면 된다(예: 팩션별 전투 테마 분리).

## 참고
- `tools/gen-bgm.js` 는 절차 합성(전자음) 폴백 생성기다. 현재는 위 CC0 실음악을 쓰므로 사용하지 않는다.
