# 캠페인 BGM (assets/audio/bgm/)

캠페인 씬의 `bgm` 필드(40종)를 **무드 6종**의 실제 CC0 음악으로 매핑해 재생한다.
매핑은 `assets/campaign-system.js #_campaignBgmSrc` (이름 키워드 → mood_*.mp3). 파일 없으면 무음(진행 영향 0).

## 트랙 (6종, 전부 CC0 / 퍼블릭 도메인)

| 파일 | 무드 | 출처 (OpenGameArt.org, CC0) |
|---|---|---|
| `mood_ambient.mp3` | 평온 앰비언트 (일반 씬) | "Forest Ambience" — TinyWorlds |
| `mood_dark.mp3` | 긴장/음산 (tension·hidden·choice·defeat 前) | "Cave Theme" |
| `mood_battle.mp3` | 전투/액션 (battle_build·tension_high) | "Battle" |
| `mood_boss.mp3` | 대규모 전투 (battle_theme_*·intense) | "Epic Boss Battle" — Juhani Junkala |
| `mood_victory.mp3` | 승리/해소 (victory·ending·arrival) | "New Sunrise" — nene |
| `mood_sad.mp3` | 비애 (melancholy·defeat·casualty) | "The Field Of Dreams" — pauliuw |

라이선스: 전부 **CC0(Creative Commons Zero, 퍼블릭 도메인)** — 출처 표기 의무 없음. 위 크레딧은 예의상 기재.

## 매핑 분포 (40 씬이름 → 6 무드)
dark 15 · ambient 9 · victory 5 · boss 5 · battle 3 · sad 3.
같은 무드로 이어지는 연속 씬은 곡을 재시작하지 않고 유지한다(src 기준 연속성).

## 교체
개별 무드가 마음에 안 들면 같은 파일명(`mood_<무드>.mp3`)의 다른 CC0/구매 트랙으로 덮으면 즉시 적용된다.
더 세분화하려면 `_campaignBgmSrc` 의 무드 종류를 늘리고 그만큼 파일을 추가하면 된다.

## 참고
- `tools/gen-bgm.js` 는 절차 합성(전자음) 폴백 생성기다. 현재는 위 CC0 실음악을 쓰므로 사용하지 않는다.
