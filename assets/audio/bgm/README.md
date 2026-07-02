# 캠페인 BGM 트랙 (assets/audio/bgm/)

캠페인 씬의 bgm 필드가 참조하는 배경음악. 아래 파일명으로 **.mp3** 를 이 폴더에 넣으면 자동 재생된다.
(assets/campaign-system.js #_campaignPlayBgm — 루프 재생, 같은 트랙 연속 유지, 전역 사운드설정 연동. 파일 없으면 무음.)

음원: 로열티프리/CC0 권장(무료 라이선스 트랙). 라이선스 출처를 커밋에 남길 것.

| 파일명(.mp3) | 사용 씬 수 |
|---|---|
| tension_medium.mp3 | 284 |
| tension_low.mp3 | 254 |
| tension_high.mp3 | 187 |
| hidden_ambient.mp3 | 178 |
| cv_ambient.mp3 | 117 |
| fsp_ambient.mp3 | 109 |
| mcc_ambient.mp3 | 75 |
| ambient_melancholy.mp3 | 47 |
| victory_calm.mp3 | 44 |
| defeat_ambient.mp3 | 33 |
| choice_tension.mp3 | 31 |
| prologue_ambient.mp3 | 29 |
| ambient_quiet.mp3 | 24 |
| mcc_ambient_warm.mp3 | 23 |
| hidden_ambient_heavy.mp3 | 15 |
| prologue_tension.mp3 | 12 |
| battle_theme_mcc.mp3 | 10 |
| battle_theme_cv.mp3 | 10 |
| hellas_ambient.mp3 | 10 |
| ambient_vast.mp3 | 9 |
| battle_theme_fsp.mp3 | 9 |
| ambient_engine_hum.mp3 | 8 |
| tension_building.mp3 | 7 |
| fsp_ambient_heavy.mp3 | 7 |
| prologue_arrival.mp3 | 7 |
| prologue_landing.mp3 | 5 |
| mcc_ambient_low.mp3 | 3 |
| ambient_night.mp3 | 3 |
| ambient_wind.mp3 | 3 |
| ending_theme_fsp.mp3 | 2 |
| battle_build.mp3 | 2 |
| landing_approach_tension.mp3 | 2 |
| arrival_theme.mp3 | 2 |
| choice_finale.mp3 | 1 |
| battle_theme_finale.mp3 | 1 |
| ending_theme_mcc.mp3 | 1 |
| ending_theme_casualty.mp3 | 1 |
| battle_intense.mp3 | 1 |
| battle_fade.mp3 | 1 |
| prologue_choice.mp3 | 1 |

총 40 트랙. tension_*/*_ambient 계열은 하나의 루프로 재사용 가능(같은 무드끼리 묶어 제작해도 됨).

## 현재 트랙(v7.468) — 절차적 생성 플레이스홀더
40트랙 전부 `tools/gen-bgm.js` 로 **절차 합성**한 앰비언트/텐션 루프다(24s, mono, 이음매 없는 무한루프, 로열티프리).
프로 OST 는 아니고 "분위기 베드" 수준 — 언제든 **같은 파일명**의 프로 트랙으로 교체하면 그대로 적용된다.

재생성: `node tools/gen-bgm.js /tmp/bgm-wav` → WAV 생성 후
`for w in /tmp/bgm-wav/*.wav; do ffmpeg -y -i "$w" -codec:a libmp3lame -b:a 64k -ac 1 "assets/audio/bgm/$(basename "$w" .wav).mp3"; done`
무드는 이름 키워드로 결정(battle/tension/defeat/victory·ending/choice/ambient…).
