# OCCUPY MARS — Changelog

## 2026-05-02 — Fleet doctrine RPS + shipyard vertical UI pass (v5.53)

- **함선 상성 적용**: 전투 엔진과 택티컬랩에 역할/함급/파벌 기반 데미지 배율을 추가. 태클, EW, 로지, 탱커, 저격, 폭격이 서로 카운터를 갖도록 변경.
- **진영별 밸런스 재정리**: migration 208로 MCC는 정밀 저격/대형함 처리, FSP는 장기전/탱킹/로지, CV는 러시/폭격/순간화력 중심으로 스탯과 설명 조정.
- **전투 사운드 추가**: WebAudio 기반 BGM 루프와 레이저/탄막/폭발 SFX를 추가. 브라우저 자동재생 제한 때문에 `SOUND` 버튼으로 활성화.
- **세로 전장 기동 표기**: 전진/후퇴 버튼과 자동 기동 로그를 세로 전장에 맞춰 `↑/↓`로 변경.
- **조선소 세로 카드 UI**: 데스크탑 청사진은 4열 그리드, 모바일은 1열 카드로 정리. `assets/ships/top/` PNG를 세로 함선 프리뷰로 사용.
- **조선소 엔진 플레임 보정**: PNG 로드 시 기존 SVG 프리뷰는 숨기고, 카드 하단 후미에서 새 엔진 플레임이 나오도록 변경.

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `index.html` inline script syntax check 통과
- `node --check server/services/battleEngine.js` 통과
- `git diff --check` 통과

## 2026-05-02 — Top-view fleet sprite + long-range combat pass (v5.52)

- **함선 PNG 22종 매핑**: `assets/ships/top/`에 전투용 축소 PNG 22종을 추가하고 `mcc_destroyer_top.png` 중복 샘플은 제외.
- **전투/조선소 렌더 통일**: 함대전 캔버스와 SHIP REGISTRY 미리보기가 같은 PNG 스프라이트를 사용하도록 변경.
- **엔진 불꽃 통일**: 기존 벡터 기준 파란 불꽃 대신 PNG 함선 길이 기준 후방 엔진 플레임으로 전투/미리보기 모두 통일.
- **장거리 함대전 보정**: 함대 간 최소/이상 교전 거리를 늘려 근접 난전처럼 겹치지 않게 수정.
- **카메라 프레이밍 개선**: 실제 살아있는 함선 스프라이트 바운딩 박스 기준으로 자동 줌/팬을 계산해 함선이 화면 밖으로 잘리는 문제 완화.
- **사격 방향 보정**: 함선이 현재 사격 타겟 좌표를 우선 바라보도록 조준 상태를 저장해 레이저 방향과 함체 방향을 맞춤.
- **대형함 움직임 추가**: 기함/대형함에 묵직한 드리프트와 함대 전체 미세 이동을 추가해 정지된 장식처럼 보이지 않게 수정.

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-02 — Vertical fleet war production update (v5.51)

- **본 서버 함대전 세로화**: `assets/tactical-lab-v11.html`을 v11.1 기반 세로 전장으로 전환. 적군은 상단, 아군은 하단에 배치.
- **초기 배치 개선**: 함대가 일직선으로 시작하지 않도록 상/하단 반원형 아크로 배치하고, 아군 기본 `wedge`, 적군 기본 `screen` 진형 적용.
- **모바일 HUD 압축**: 속도 조절을 우상단 오버레이 단일 버튼으로 변경하고, 클릭마다 `x1/x2/x4/x8` 순환. 증원 테스트 버튼 제거, 전술 버튼은 소형 그리드로 정리.
- **자동 줌 안전화**: 가까운 교전쌍으로 줌 강도를 계산하되 전체 생존 함대와 라벨이 화면 밖으로 나가지 않도록 프레이밍 제한.
- **모바일 성능 최적화**: 작은 함선 대표 렌더, 발사 밀도 제한, 총알 누적 제한, 폭발 파티클 감소, 모바일 shadowBlur 축소로 렉 완화.
- **캔버스 찌그러짐 보정**: 내부 버퍼와 CSS 표시 비율을 `460x600`으로 맞춰 텍스트/함대가 가로로 늘어나 보이던 문제 수정.

검증:
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-02 — Fleet camera containment hotfix (v5.50)

- **Cinema 카메라 이탈 방지**: 오버숄더 카메라가 함선을 화면 밖으로 밀어내던 문제를 수정. 카메라 중심을 소스/타겟 사이로 잡고 월드 경계 안으로 clamp.
- **거리 기반 줌 안정화**: 오버숄더 줌을 함대 간 거리와 반경 기준으로 산출해 두 함대가 화면 안에 남도록 조정.
- **시네마틱 한계 기록**: 현재 2D tactical-lab 카메라만으로는 레퍼런스 같은 3D 박력 구현에 한계가 있어, 후속으로 프리렌더/3D풍 전투 뷰어 분리 개발 권장.

검증:
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-02 — Fleet combat role/preview/camera pass (v5.49)

- **함선 역할 밸런스 기획 반영**: 샤드는 저렴한 주력 DPS, 재머는 비싼 약한 딜러가 아니라 적 함대 사격 지연/화력 저하를 중첩시키는 EW 지원함으로 정리.
- **EW 전투 엔진 적용**: `battleEngine`에서 `fire_type='ew'`가 적 함대에 발사 간격 증가와 공격력 저하 디버프를 부여하도록 구현.
- **조선소 카드 개선**: 함선 카드에 역할 배지와 설명을 표시해 왜 이 함선을 사야 하는지 바로 보이게 수정.
- **함대 지휘 UX 개선**: 선택 함대의 진형 미리보기 보드, 함종 구성 막대, 역할 칩, 함선별 ATK/DEF/SPD 표시 추가.
- **모바일 함대전 v11.2**: 전투 캔버스 높이 확대, 버튼 2열 정렬, 함선 표시 크기 확대, 정보 패널 모바일 정리.
- **모바일 전술 패널 수납**: 오른쪽 구석 `TACTICS` 플로팅 버튼을 추가하고, 전술/진형/기동/카메라 버튼은 사이드 패널로 열리며 선택 후 자동 접힘.
- **시네마틱 카메라**: `Cinema`/`Tactical` 카메라 모드 추가. Cinema는 기함 뒤 오버숄더 추적샷과 전체 전장샷을 자동 전환.

검증:
- `index.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `node --check server/services/battleEngine.js` 통과
- `git diff --check` 통과

## 2026-05-02 — Shipyard build stays on blueprints (v5.48)

- **연속 함선 건조 UX 수정**: 함선 건조 성공 후 Build Queue 탭으로 강제 이동하던 동작을 제거해, 청사진/건조 탭에 머문 채 계속 건조할 수 있도록 수정.
- **상태 갱신 유지**: 탭 이동만 제거하고 `refreshShipyard()`는 유지해 건조 큐, 재화, 버튼 비활성 상태는 즉시 갱신.

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-02 — Completed prologue compact campaign card (v5.47)

- **완료된 프롤로그 접기**: 캠페인 목록에서 완료된 `chapterNumber === 0` 프롤로그는 한 줄 compact 카드로 표시하도록 수정.
- **결과 접근 유지**: 접힌 프롤로그 카드에도 `RESULTS` 버튼을 유지해 결과 확인은 가능.

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-02 — Campaign editor layout save/apply fix (v5.46)

- **에디터 수정값 서버 저장 보장**: 운영 `/api/campaign/editor-layout`가 `{}`인 상태를 확인하고, 에디터 시작 시 서버가 비어 있으면 localStorage layout을 자동 업로드하도록 수정.
- **Save 버튼 정리**: `Export Backup` 버튼을 `Save to Game`으로 바꾸고, 클릭 시 즉시 서버 layout API에 저장.
- **인게임 fallback 추가**: 서버 layout이 비어 있거나 로드 실패하면 같은 origin의 `editorCharacters`, `editorDialog`, `editorFontSize` localStorage 값을 fallback으로 적용.

검증:
- `index.html` inline script syntax check 통과
- `assets/campaign-editor.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-02 — Campaign story background transition flash fix (v5.45)

- **장면 전환 파란/보라 화면 제거**: 스토리 렌더러가 장면마다 `.story-background` inline style을 통째로 지워 기본 그라디언트가 잠깐 노출되던 문제 수정.
- **배경 preload 후 교체**: 기존 배경 이미지를 유지한 채 새 이미지를 로드하고, 로드 성공 후에만 `backgroundImage`를 교체하도록 변경.
- **동일 배경 재로드 방지**: `data-bg-src`로 현재 배경과 같은 경우 이미지 재로드 없이 layout만 적용.

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-02 — Campaign story editor layout runtime bridge (v5.44)

- **에디터 배치값 인게임 반영**: 캠페인 스토리 렌더러가 서버 저장 `_campaignEditorLayout`, `scene.layout`, `line.layout`, `editorLayout`, `stageLayout`을 읽어 캐릭터/배경/대사박스/closeup overlay 위치를 적용하도록 수정.
- **모바일/데스크탑 분리 지원**: `layout.desktop`, `layout.mobile` 값을 현재 화면 폭에 맞게 병합해 적용.
- **캐릭터별 좌표 지원**: `layout.characters.berk` 또는 `layout.characters.left/right` 형식으로 x/y/w/h/scale 값을 지정하면 기본 좌우 CSS 배치를 덮어씀. 에디터 저장값처럼 y가 없으면 bottom-anchor로 배치해 캐릭터가 위로 잘리지 않게 처리.
- **라인 전용 배경 수정**: 기존 `_campaignStorySetBackground()`는 line-level background를 지원한다고 주석만 있었고 호출부가 값을 넘기지 않아 적용되지 않던 문제 수정.
- **캐시 버전 갱신**: `CAMPAIGN_ASSET_VERSION=20260502c`.

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-02 — Campaign character portrait generation complete (v5.43)

- **캠페인 캐릭터 포트레이트 28종 생성 완료**: gpt-image-1 (1024×1536, quality=high) + rembg 배경 제거 파이프라인.
- **생성 대상**: pilot 3종 (butcher/chen/cinder), batch1 7종, needs_story_check 2종 (kenji/lena), hold 16종 — 총 28종.
- **주요 이슈 해결**: cinder 번 스카 identity anchor v9에서 확정 (물리적 묘사 + 얼굴 각도 + 조명 변경), chen 찻잔 제거 + MCC 뱃지 유지, 구도 1024×1536 세로 비율로 전환.
- **생성 로그**: `assets/campaign/characters/_generation_log.json` (각 버전별 prompt/evaluation 기록).
- **character_manifest_v2.json**: `/tmp/character_manifest_v2.json` 로컬 정의 파일 (alias/canonical/variant/create_now/hold 상태 관리).

## 2026-05-02 — Campaign complete internal error fix (v5.42)

- **캠페인 완료 Internal error 수정**: `player_campaign_progress` 완료 UPDATE에서 `$1` 파라미터가 `status` 대입과 `CASE WHEN` 비교에 동시에 쓰이며 운영 PostgreSQL에서 타입 추론 충돌이 발생하던 문제 수정.
- **완료 단계 검증**: 운영 DB 합성 지갑으로 `mcc_prologue` 시작 → 완료 → `mcc_campaign_ch1` unlock까지 확인하고 합성 데이터 삭제.

검증:
- `node --check server/services/campaign.js` 통과
- 운영 DB 합성 플로우 `complete ok true completed mcc_campaign_ch1` 확인

## 2026-05-02 — Backend phantom schema audit + client guard fixes (v5.41)

- **업적 unlock 오류 수정**: `user_achievements` 실제 운영 스키마에는 `id` 컬럼이 없어서 `RETURNING id`가 실패하던 경로를 `RETURNING achievement_key`로 변경.
- **없는 `user_profiles` 참조 제거**: Contest/Expedition/Rental 서비스의 닉네임 JOIN을 실제 `users.wallet_address` 기준으로 변경.
- **Rental 목록 오류 수정**: `claims.pixel_count` 없는 컬럼 참조를 `(width * height)` 계산식으로 변경.
- **지도 합성 클라이언트 오류 방어**: Starlink 응답의 `passes` 배열을 정규화하고, 주기 합성 루프에서 `undefined.length`가 터지지 않도록 가드.
- **Arena crash history 방어**: history 응답이 배열이 아니어도 모달 전체가 죽지 않도록 가드.

검증:
- `onclick` 849개 / 호출 함수 523개 자동 스캔, 실제 미정의 핸들러 0개
- `node --check` 변경 서비스 4개 통과
- `index.html` inline script syntax check 통과
- 운영 DB 스키마 확인 및 `BEGIN/ROLLBACK` 쿼리 드라이런 통과

## 2026-05-02 — Shipyard build button GP summary fix (v5.40)

- **조선소 건조 버튼 비활성화 수정**: `/api/ships/summary`가 `gp_balance`를 반환하지 않아 프론트가 GP를 항상 0으로 판단하던 문제 수정.
- **함대 없는 유저 지원**: summary 쿼리를 `fleets` 기준에서 `users` 기준 LEFT JOIN으로 바꿔, 아직 함대가 없어도 GP/큐 요약을 정상 반환.

검증:
- `node --check server/services/ship.js` 통과
- 운영 DB `ship_build_jobs`/`ship_build_log` 0건 확인 → 건조 시작 요청 자체가 UI에서 막히던 증상과 일치
- 운영 DB `BEGIN/ROLLBACK` 건조 INSERT 드라이런 통과

## 2026-05-02 — Campaign asset hard cache refresh (v5.39)

- `sw.js`: `CACHE_NAME`을 `mars-v8`로 갱신. `/assets/campaign/*`는 `fetch(new Request(..., { cache: 'reload' }))`로 HTTP 캐시까지 우회해 같은 파일명 이미지 교체가 바로 반영되도록 강화.
- `index.html`: 캠페인 배경/캐릭터/closeup 배경 URL을 `campaignAssetUrl()`로 통합하고 `?v=20260502b`를 적용.
- `package.json`: 버전 `5.39.0`으로 갱신.

검증:
- inline script syntax check 통과
- `node --check sw.js` 통과
- `git diff --check` 통과

## 2026-05-02 — SW mars-v6 캐시 버전 업 + 캠페인 배경 184장 Codex gpt-image-1 전면 재생성

변경:
- `assets/campaign/backgrounds/` 184장 PNG 전면 교체:
  - 77장 scene-level (9:16 portrait, ~2200–2800KB): gritty cinematic sci-fi concept art 스타일.
  - 107장 overlay closeup (1:1 square, ~1800–3000KB): 동일 스타일, 1:1 square.
  - 생성 도구: Codex gpt-image-1 (`codex exec`), 0 DIMENSION_FAIL.
  - style lock: "gritty cinematic sci-fi concept art, dense mechanical detail, rusty worn metal,
    warm orange rim lighting, dark shadows, high-detail painterly realism, dramatic framing,
    worn industrial spaceship atmosphere" — green CRT 키워드 제거 (cargo_ship_interior, mcc_briefing_room 2곳만 유지).
- `sw.js`: CACHE_NAME 'mars-v5' → 'mars-v6' — 옛 이미지 캐시 전체 무효화.
- `index.html`:
  - 이미지 URL `?v=20260501d` → `?v=20260502a`.
  - `_bgMap` 정리: 직접 파일 생긴 4개 항목 제거 (cargo_ship_interior, hellas_mining_outpost,
    kepler_crater, kepler_crater_dusk, mine_interior).
  - 폴백 유지: hellas_central_underground, hellas_outer_relay_interior, erebus_base_medical,
    hellas_various_night.

## 2026-05-01 — SW mars-v5 캐시 버전 업 + 파벌 대사 풀 65개 + 함대전 hook

사용자 보고:
1) "옛날 이미지 계속 보임" — Service Worker 가 image cache-first 정책으로 이전 PNG 영구 보관
2) "대사 엄청 많아야 함, 함대전에도 있어야"

수정:
- sw.js: CACHE_NAME 'mars-v4' → 'mars-v5' 버전 업.
  SW activate 이벤트가 옛 캐시 일괄 삭제 → 신규 Imagen 4 Ultra 480장 PNG 강제 fresh fetch.
- index.html 이미지 URL 쿼리 파라미터 ?v=20260501c → ?v=20260501d (sw 동기).
- FACTION_FLAVOR 풀 대폭 확장 (총 65 라인):
  - claim_new: 4 → 16 (MCC/FSP/CV/neutral)
  - claim_executing: 3 → 15
  - hijack_start: 4 → 18
  - 신규 fleet_battle_engage: 16 (함대전 진입)
- 등장인물 확장: Chen Weiss / Li Fang / Director Osei (MCC), Mikhail / Lena / Hagar / Yuna /
  Olu Adeyemi (FSP), Butcher / Aisha / Cinder Grace / Crow (CV),
  Mission Control / AI Scout / Fleet Command / Tactical AI / Battle Bridge (neutral)
- 함대전 hook: hijack 후 openBattleViewer 진입 직전 fleet_battle_engage 대사 await.
  setTimeout 1500ms → 2400ms 로 늘려 2.2s 대사 표시 시간 확보.

## 2026-05-01 — UI 검수 + 누락 버튼 구현 + 업적 모달 + 슬로대 파벌 대사 + 캐시 부스트

사용자 검수 보고:
1) 함선 건조 안됨 (별도 commit 8291b9a)
2) 모든 버튼 동작 검수
3) 업적 달성 조건 안 보임 → 모달
4) 미구현 stub 대신 실제 구현
5) 영토/하이잭 시 캐릭터 대사 (슬로대 스타일)
6) 모바일 옛날 이미지

수정:
- 851개 onclick 핸들러 자동 검사 → 누락 3개 식별·실구현:
  - openMineralsPanel: /api/resources/my 모달
  - openShipRegistry: /api/ships/my 모달 (HP/상태)
  - openWorldEventDetail: /api/world-events/:id 모달
- 업적 카드 클릭 → showAchievementDetail() 모달:
  달성 조건 (한/영, condition_type 27종 라벨), 보상 GP, 상태, 달성일시.
- showFactionFlavor() — 슬로대 풍 사전 대사 시스템 (claim_new/claim_executing/hijack_start)
- /assets/campaign/backgrounds/<id>.png?v=20260501c 캐시 부스트.

## 2026-05-01 — Ship build transaction silent rollback fix

사용자 리포트: "재료가 있는데도 함선 건조가 실패함".

원인:
- `server/services/ship.js` `startBuild()`가 `ship_build_jobs` INSERT 후, 같은 트랜잭션 안에서 선택적
  `fleet_gp_activity` 로그를 쓰고 `.catch(() => {})`로 에러를 삼켰음.
- PostgreSQL은 트랜잭션 내부 statement 에러가 한 번 나면 이후 `COMMIT`이 전체 변경을 롤백할 수 있다.
  이 경우 서비스는 이미 받은 `job.id`로 성공 응답을 만들 수 있어 HTTP 200인데 `ship_build_jobs` 행이
  남지 않는 silent fail 경로가 생김.

수정:
- `fleet_gp_activity` 로그를 `COMMIT` 이후 fire-and-forget으로 이동.
- 건조 트랜잭션은 필수 변경만 포함: 유저/함선 검증 → GP 차감 → `user_resource_inventory(resource_id)`
  원자적 광물 차감 → `ship_build_jobs` INSERT → `ship_build_log` INSERT → `COMMIT`.
- 동일한 패턴의 건조 취소 환불 로그도 트랜잭션 밖으로 이동.

검증:
- `node --check server/services/ship.js` 통과
- `git diff --check` 통과
- DB 접속은 sandbox 네트워크 제한으로 실행 불가. 코드 경로상 `ship_build_jobs` INSERT는
  `server/services/ship.js` `startBuild()`의 `COMMIT` 이전 필수 쿼리로 유지됨.

## 2026-05-01 — Scene-level 77장 + Variant 301장 + JSON round-robin (6-7/N)

사용자 지적: "이전 것도 다 바꾸라고 했을텐데" + "이미지 반복사용 하지말고 씬이미지 늘려라".

scene-level (Step 6):
- 77개 location-named scene-level 배경 (cargo_ship_corridor, hellas_central_exterior 등)
  Imagen 4 Ultra 9:16 cinematic 일괄 재생성. 평균 1418KB. 신규 dedicated 115장과 스타일 일관.
- 누락 케이스: 이전 단계는 사이즈 < 1.4MB 만 재생성했으나 1.4MB+ 라도 옛날 8-bit pixel art
  스타일 다수 잔존. 사용자 지적 후 전체 일괄 처리.

Variant (Step 7):
- 3회 이상 반복되는 (chapter, bg) 케이스 147건에서 variant 생성 + 36개 JSON round-robin 배정.
- prologue_shared `cargo_ship_corridor` 18회, `olympus_summit_station` fsp_ch9 40회/cv_ch9 39회/
  mcc_ch9 30회 등 가장 두드러진 반복 분산.
- 변주 hint 8종 (wide establishing / intimate close / high angle / low angle / side profile /
  dawn / deep dusk / with crowds) round-robin.
- 결과: 301/301 1차 성공, 평균 1410KB.

스크립트:
- scripts/gen_scene_level_v2.py (77 hand-crafted prompts)
- scripts/gen_scene_variants.py (variant 생성 + JSON round-robin)

총 변경: 301 신규 PNG + 39 JSON 갱신.

## 2026-05-01 — Imagen 4 Ultra 115장 일괄 재생성 완료 (5/N)

Imagen 3 → Imagen 4 Ultra 전환 후 115장 모두 재생성 완료. Codex agent 가 작성한
`/tmp/codex_generate_campaign_bgs.py` 를 `IMAGEN_MODEL=imagen-4.0-ultra-generate-001`
환경변수로 실행, 115장 중 114장 1차 성공 + 1장 (mcc_ch5_kepler_dispute_l29 candle_flame)
safety filter retry 후 완료.

성과:
- 평균 사이즈: 1481.7KB (직전 Imagen 3 평균 700-1000KB 대비 약 1.5배)
- 골드 스탠다드 (≥1.4MB) 도달: 167/190 (88%)
- 사이즈 분포: ≥2MB 19개, 1.5-2MB 116개, 1.4-1.5MB 32개, 1.0-1.4MB 20개, <1.0MB 3개
- 9:16 portrait 모바일 우선, 캐릭터·사물·대사 매칭 hand-crafted 영문 프롬프트 그대로 적용

검수 픽스 (배치 중 3장):
- `cv_ch10_from_flames_l14_00_hand_still`: 사용자가 이마 미닝 헤드램프 어색하다 지적 → "no headgear" 명시 재생성
- `cv_ch1_baptism_l41_00_candle_flame`: Aisha 하반신이 바닥에 박힘 → 풀바디 + 명확 구도 재생성
- `mcc_ch5_kepler_dispute_l29_00_candle_flame`: 1차 safety filter 차단 → 표현 다듬어 retry 성공

검증:
- `find assets/campaign/backgrounds -name "*.png" -newermt "2026-05-01" | wc -l` → 115
- `ls -la assets/campaign/backgrounds/*.png` 사이즈 분포 위 통계 확인
- 기존 70개 scene-level high-quality 배경은 보존 (수정 없음)

## 2026-04-30 — Imagen 4 Ultra 모델 업그레이드 (4/N)

사용자 피드백 "이미지 퀄리티 기준은 엄격하게 지킬것" 반영.
Imagen 3 → Imagen 4 Ultra 로 모델 전환. Codex agent 추천 따름.

배경:
- Imagen 3 (`imagen-3.0-generate-001`) 9:16 portrait 픽셀아트 출력이 일관되게
  700-1000KB 로 골드 스탠다드(`hellas_central_exterior` 2MB) 못 미침
- 강화 STYLE 프롬프트 + best-of-2 도입해도 마진 개선만 (~1MB 도달 정도)
- Codex sandbox 분석 결과: 모델 자체의 출력 해상도/디테일이 병목

해결:
- `scripts/gen_scene_dedicated_v2.py` 의 `model=` 인자를 환경변수
  `IMAGEN_MODEL` 로 추출. 기본값 `imagen-3.0-generate-001`,
  override `imagen-4.0-ultra-generate-001`.
- 첫 3장 테스트 (CV Ch10 fire_small/hand_still/death_still) 1494/1506/1510KB 달성
- 시각 디테일 차원이 다름: 정교한 metal gear, 텍스트 레이블 ('BUTCHER VASQUEZ'),
  환경 스토리텔링 (벽 그래피티, 산소 호스, 광부 헬멧 자국 등) 모두 1차 시도에서
  픽셀아트로 표현됨

진행:
- 118장 < 1.4MB 결과물 모두 Imagen 4 Ultra 로 `--strict` 재생성 (백그라운드)
- ETA ~1.5-2시간 (rate limit 포함)
- 완료 후 후속 커밋 (5/N) 에 PNG 일괄 포함

검증:
- `assets/campaign/backgrounds_imagen4_test/` 에 비교용 샘플 3장 보존
- `IMAGEN_MODEL=imagen-4.0-ultra-generate-001 python3 scripts/gen_scene_dedicated_v2.py --strict` 동작 확인

## 2026-04-30 — Campaign 오버레이 시스템 폐기 + 씬 전용 9:16 배경 인프라 (1/2)

본 커밋은 오버레이 → 씬 전용 배경 전환의 **인프라 변경분**만 반영. Imagen 3 9:16 신규 배경 약 120개는 후속 커밋에서 추가.

- **오버레이 시스템 전면 제거**: `index.html` 의 `.story-detail-overlay` CSS, `<img class="story-detail-overlay">` 엘리먼트, `_showStoryDetailOverlay()` 함수 폐기. `assets/campaign/overlays/*.png` 35개 파일 일괄 삭제. 사용자 피드백("오버레이는 오히려 보는데 더 방해되니까 차라리 씬 전용 배경으로 바꾸는게 낫겠더라") 반영.
- **라인 단위 풀스크린 배경 swap**: `_campaignStorySetBackground(scene, overlay, lineBg)` 신규 인자. 라인의 `background` 필드가 있으면 씬 배경 대신 라인 전용 배경으로 풀스크린 전환. 모바일 9:16 portrait 우선.
- **scene JSON 일괄 변환**: `scripts/update_scene_overlays_to_backgrounds.py` 가 `docs/campaign-story/*.json` 의 모든 `"overlay": "X"` 라인 필드를 `"background": "<chapter>_l<scene>_<line>_X"` 로 변환. 35개 챕터 / 107개 라인 처리.
- **신규 hand-crafted 프롬프트**: `scripts/gen_scene_dedicated_v2.py` 에 107개 씬 라인 + 13개 저퀄 scene-level 배경 (총 120개) hand-written 영문 프롬프트 정의. 각 라인의 KO 대사를 직접 읽고 캐릭터(Butcher 의수, Lena 문신, Chen 25도 차) / 사물 / 행동 / 분위기를 명시. 모두 9:16 portrait. 현재 백그라운드 생성 중, 완료 후 후속 커밋 (2/2).
- **hidden_ch5_last_observation.json**: line 370 JSON parse error 수정 — 오타로 들어간 닫는 중괄호 제거. 이제 `update_scene_overlays_to_backgrounds.py` 와 Codex prologue scan 모두 이 챕터 포함 가능.

검증:
- `index.html` 정적 파싱 통과, `story-detail-overlay` 잔존 0건
- `python3 -c "import json; [json.load(open(f)) for f in glob.glob('docs/campaign-story/*.json')]"` 36개 모두 파싱 성공
- 변환된 라인 background ID 가 `gen_scene_dedicated_v2.py PROMPTS` 키와 1:1 일치

## 2026-04-30 — Campaign scene choice INVALID_CHOICE hotfix

- **Resolved**: visual novel `type:"choice"` scene options that are not present in server `chapter.choices` now advance locally instead of posting to `/api/campaign/choice`, fixing the prologue `INVALID_CHOICE` modal after CONTINUE.
- **Server guard**: no-choice story chapters such as `mcc_prologue`, `fsp_prologue`, and `cv_prologue` now recognize scene-local choice IDs defensively if a stale client posts them.
- **Scan**: checked all `docs/campaign-story/*.json` files with `type:"choice"` / `type:"branch"` scenes. 31 parseable files contain 32 scene choice/branch scenes and 128 options; the same class of UI bug is covered across MCC/FSP/CV chapters.
- **Note**: `docs/campaign-story/hidden_ch5_last_observation.json` currently has a JSON parse error at line 370, so it could not be included in the structured choice scan.
- **검증**: `node --check server/services/campaign.js`, `node --check server/routes/api.js` 통과.

## 2026-04-30 — Campaign C1/C2 critical hotfix

- **Resolved C1/C2**: `server/services/campaign.js` now gates FSP Ch10 endings with `calculateEligibleFspEndings()` and blocks the FSP Ch9 Pilgrim Arms signal unless the stored Ch7/Ch8 ending-4 seed modifiers are active.
- **검증**: `node --check server/services/campaign.js` 통과. `git diff server/services/campaign.js` 확인 결과 targeted eligibility/choice validation 함수만 변경.

## 2026-04-30 — Campaign system 정밀 감사 (Claude + Codex 협업)

- **감사 범위**: v5.33 출시 직후 캠페인 30+ 챕터(MCC/FSP/CV 프롤로그 + 1~10 + hidden 1~5) 정밀 감사. Codex가 `server/services/campaign.js` 비즈니스 로직, Claude가 마이그레이션 192-205 + API 라우트 + index.html UI를 분담.
- **Critical 2건**: `validateChapterChoice()`가 `[CH7_ID, CH8_ID, CH9_ID, CH10_ID]`만 게이팅(line 3124) — FSP_CH7~10은 화이트리스트 누락. FSP Ch10 ending eligibility 함수 부재로 자격 미달 엔딩 선택지 직접 제출 시 `calculateFspCh10Rewards`(~line 2855)의 100만 GP급 보상 farming 가능. FSP Ch9 `fsp_ch9_signal_pilgrim_arms`도 동일.
- **Major 4건**: `simulatePrologue()`(line 2138) 마지막 씬 도달 검증 없음 → 스킵 farming, `campaign_sessions` 부분 UNIQUE 누락(동시 활성 세션 중복), `simulateChapter`/`calculateRewards` CV/hidden 라우트가 MCC Ch1으로 폴백(line 2175 / 2920+).
- **Minor 3건**: `applyOptionalCampaignReward`/`loadScenesFile` catch 로그 stack 누락, 캠페인 라우트 wallet 길이 검증 누락(`requireWallet` 미적용).
- **결함 외 통과 확인**: 마이그레이션 192-205 무결성, `complete()` `FOR UPDATE` idempotency, v5.33 `applyReputation` SAVEPOINT 격리, 서버 보상 결정성, choice 화이트리스트(Ch1~9, FSP Ch1~6), MCC Ch10 ending eligibility, MCC Ch7/8/9 route prefix 강제, 36개 씬 파일 ↔ CHAPTERS dict ↔ seed 일관, 78개 배경 + 21개 캐릭터 에셋 매핑 일관, index.html 캠페인 UI 흐름.
- **권장 수정 순서**: C1/C2 → M1 → M2 → M3/M4 → m1/m2/m3. 본 커밋은 감사 보고서만 반영하며 코드 수정은 별도 후속.

검증:
- Codex sub-agent가 `server/services/campaign.js` 3716줄 감사
- Claude가 마이그레이션 192-205, `routes/api.js` 캠페인 라우트, `index.html` 캠페인 UI 검사

## 2026-04-30 — Campaign Visual Novel Engine + 배경·캐릭터 에셋 완성 + Internal Error 수정 (v5.33)

### 비주얼 노벨 씬 엔진 (Codex 구현)
- **`showCampaignStory()` 씬 엔진**: 기존 `showCampaignBriefing()` 를 교체하는 새 비주얼 노벨 엔진. 씬 타입별 렌더링(`narration`, `dialogue`, `choice`, `branch`, `battle_transition`, `result`, `ending`)을 지원한다.
- **타이핑 애니메이션**: 한 글자씩 30ms 간격, 탭하면 즉시 전체 표시. `typeText()` + `advanceCampaignScene()`.
- **캐릭터 초상화**: 현재 화자 밝게, 비화자 opacity 0.5. `/assets/campaign/characters/{id}.png`. `_portraitMap`으로 scene speaker ID → 파일명 매핑.
- **배경 이미지**: `/assets/campaign/backgrounds/{id}.png`. `_bgMap`으로 씬 background ID → 파일명 폴백 매핑. 미존재 시 gradient fallback.
- **폴백 라우팅**: `ch.scenes` 없는 챕터는 기존 `showCampaignBriefing()` 유지.

### 이미지 에셋 — Gemini Imagen 3 (GCP Vertex AI)
- **배경 78개**: `assets/campaign/backgrounds/*.png`
  - 기존 8개 (mcc_briefing_room, cargo_ship_interior, mars_sunset 등)
  - Imagen 3 신규 20개: hellas_zone4_deep_tunnel, mcc_board_chamber, erebus_throne_hall, fsp_assembly_hall, olympus_exterior 등
  - Imagen 3 신규 50개 (씬별 전용): kariope_cargo_bay, cargo_ship_corridor, deep_space_window, new_athens_shipyard_dawn/interior/night, hellas_central_exterior 시리즈, mine_shaft/exterior/interior, erebus_crater_panorama/exterior, argyre_canyon_depot, mars_surface_dust_storm 등
- **캐릭터 초상화 21개**: `assets/campaign/characters/*.png`
  - liang_wei, yuna, crow, aisha, hagar, kenji, verk, observer, miner_anon, miner_elder (Imagen 3)
  - 기존 11개 유지
- **스타일**: 32-bit pixel art, semi-realistic concept art, Mars sci-fi, 16:9(배경)/3:4(캐릭터).
- **생성 스크립트**: `scripts/gen_ai_assets.py`, `scripts/gen_missing_backgrounds.py` (GCP ADC 인증).

### 씬 파일 전면 확충
- 36개 챕터 JSON (`docs/campaign-story/`): MCC Ch1~10, FSP Ch1~10, CV Ch1~10, Prologue 3종.
- 각 파일 배경 ID가 `_bgMap` + 실제 파일 78개와 1:1 대응되도록 정렬.

### 버그 수정
- **`complete()` Internal Error**: `applyReputation()` 호출을 `applyOptionalCampaignReward` SAVEPOINT 로 감쌈. `reputation_history` 테이블 이슈 또는 스키마 미적용 시 평판 변경만 건너뛰고 챕터 완료는 유지. 기존에는 이 경우 전체 트랜잭션이 ROLLBACK → 500 "Internal error" 였다.
- **Migration 204**: 방어적 재보장
  - `player_campaign_progress`: `attempts`/`best_metrics`/`last_metrics` ADD COLUMN IF NOT EXISTS
  - `player_lore_flags`: `source_chapter`/`metadata` ADD COLUMN IF NOT EXISTS
  - `reputation_history`, `campaign_sessions`, `player_branch_modifiers` CREATE TABLE IF NOT EXISTS
  - `hidden_campaign_ch1~5` `campaign_chapters` 시드 — hidden 챕터 start 시 FK 위반 방지.
- **`.jpg` → `.png` 확장자 버그**: 배경 로딩 코드가 `.jpg`를 참조해 모든 배경이 gradient fallback으로 표시되던 문제 수정.
- **에러 메시지 개선**: `complete` 라우트에서 DB 스키마 관련 에러 시 힌트 포함 — Railway 로그 없이도 디버깅 가능.

검증:
- `git log --oneline` 확인: 이미지 커밋 78개, 씬 엔진 코드, migration 204 적용 확인
- `ls assets/campaign/backgrounds/ | wc -l` → 78
- `ls assets/campaign/characters/ | wc -l` → 21

## 2026-04-30 — Capital ship Core/Mid material gate + Phase C hijack modal cleanup (v5.32)

- **Migration 203 추가**: `203_capital_ship_core_mid_materials.sql`. `fsp_titan` 에 `nano_polymer:40` 추가(다른 두 Titan 처럼 Mid mat 2종 보유), 모든 Battleship의 `exotic_alloy` 최소치를 3 으로 통일. 어드민 추적용 5개 settings 키 시드 (`capital_ship_core_mat_required`, `capital_ship_mid_mat_required`, `capital_ship_recipe_contract`, `core_exclusive_minerals`, `mid_exclusive_minerals`). 마이그레이션 안에 invariant assertion 포함 — 모든 BS/Titan 이 Core+Mid 광물을 둘 다 포함하지 않으면 적용 실패.
- **CLAUDE.md §8 task #1 클로즈**: Migration 163이 이미 시드한 Core/Mid 전용 재료 정책(Frontier=iron_ore/carbon_fiber/silicon_chip, Mid=titanium_alloy/plasma_crystal/nano_polymer, Core=exotic_alloy/dark_matter/quantum_core)을 강화·문서화 완료. AUDIT_FINDINGS.md 라인 643이 이미 ✅ 표시했지만 CLAUDE.md TODO에서 누락 — 이번에 정합 처리.
- **Phase C 하이잭 모달 정리 (CLAUDE.md §8 task #3)**: `index.html`의 죽은 `hijackModal` HTML(31줄)과 `openHijackModal/closeHijack/confirmHijack` 함수 일괄 제거. `useLegacyDeclare` 게이트 뒤에 숨어 있어 사용자에게 도달 불가능했던 dead code. 진입 헬퍼 `showHijackEntryHint`와 영토 정보 패널의 `hijackFromTerritoryInfo`(claim 모달 → `/api/hijack/declare-with-pp` 경로)는 유지.
- **`/api/hijack/declare` 410 응답 개선**: 메시지를 사용자가 알 수 있는 대안 경로(영토 하이잭=`/api/hijack/declare-with-pp`, AI 결투=`/api/ai/fight`, PvP 토너먼트=`/api/tournaments/:id/register`)와 함께 반환하도록 수정. `phaseC.js` + `services/hijack.js` 라우트 정리 주석 동기화.
- **Smoke 테스트 도구 추가**: `server/tools/smoke_capital_recipes.js`. `node ./server/tools/smoke_capital_recipes.js` 로 `ship.startBuild` (battleship+titan recipe 검증), `resourceCraft.startCraft` (hull_plate, plasma_coil), `hijack` 서비스 export·hijack_battles 스키마, Migration 203 invariant 까지 11항목 직접 검증. CLAUDE.md §8 task #2 검수 통과.

검증:
- `psql ... -f server/migrations/203_capital_ship_core_mid_materials.sql` 적용 (assertion 통과, schema_migrations 등록)
- `psql -c "SELECT recipe_minerals ? 'exotic_alloy' OR recipe_minerals ? 'dark_matter' OR recipe_minerals ? 'quantum_core' AS has_core, recipe_minerals ? 'titanium_alloy' OR recipe_minerals ? 'plasma_crystal' OR recipe_minerals ? 'nano_polymer' AS has_mid FROM ship_types WHERE size_class IN ('battleship','titan')"` → 6/6 모두 t,t
- `node server/tools/smoke_capital_recipes.js` → 11 passed / 0 failed (ship build, resource craft, hijack 서비스, schema, recipe invariant)
- `node --check server/routes/phaseC.js`, `node --check server/services/hijack.js`, `node --check server/tools/smoke_capital_recipes.js`
- `grep -c openHijackModal hijackModal closeHijack confirmHijack index.html admin.html` → 0/0 (ghost ref 없음)

## 2026-04-29 — Bug report 버튼 중복 제거 + SECTORS 좌측 배치 (v5.31)

- **버그리포트 버튼 중복 제거**: `index.html`에 동시에 살아 있던 두 개의 버그리포트 시스템(신규 `#bugReportFab` 🐞 + `class="bug-modal"` / 레거시 `#bugReportBtn` 🐛 + `class="br-*"`)이 같은 `id="bugReportModal"`을 공유해 DOM 충돌을 일으키던 문제를 정리. 신규 시스템(버튼 + 모달 + CSS + JS)을 전부 삭제하고 레거시 단일 시스템만 유지.
- **SECTORS 좌측 정렬**: 살아남은 `#bugReportBtn` 🐛 버튼을 화면 우하단 고정 위치 대신 SECTORS 버튼 바로 왼쪽(8px 간격, 세로 가운데 정렬)에 정렬되도록 `alignBugFab()` rAF-throttled 루틴으로 재배치. 패널 접힘/반응형 변화에도 추적되도록 resize/load/주기 타이머에 묶음.
- **삭제 범위**: `.bug-fab`/`.bug-modal` CSS 블록(약 65줄), 신규 버튼 + 모달 HTML(약 45줄), 신규 시스템 JS(`alignBugFab` 구버전, `selectBugCat`, `openBugReport`, `closeBugReport`, 신규 `submitBugReport`; 약 120줄). 신규 시스템 전용 i18n 키(`bug_report_*`, `bug_cat_*`)는 4개 언어 사전에 남아 있으나 참조하는 UI가 없어 무해한 dead 데이터로 둠.

검증:
- `index.html` 정적 파싱 — `bugReportBtn` 1개, `bugReportFab` 0개, `bugReportModal` 1개(레거시 onclick→`closeBugReporter`).
- 신규 시스템 함수/클래스 잔존 0건 grep 확인.
- `alignBugFab` 리스너(load/resize/DOMContentLoaded/setInterval) 1세트 유지.

## 2026-04-29 — Mobile first-load side panel lock (v5.30)

- **iPhone 첫 화면 패널 잠금**: 1024px 이하에서 좌/우 사이드 패널이 `.open` 상태가 아닐 때 `!important` off-screen transform을 적용해, 첫 진입 시 지도 대신 사이드 화면이 열려 보이는 문제를 차단.
- **iOS 상태 복귀 보강**: `pageshow`, `load`, `orientationchange`에서 `forceCloseMobilePanels()`를 호출해 Safari/Chrome iOS bfcache나 회전 후 이전 open 상태가 남지 않도록 수정.

검증:
- `index.html` 인라인 script 파싱
- `git diff --check`

## 2026-04-29 — FSP Campaign Ch7~10 MVP 구현 (v5.29)

- **FSP Ch7 "의회" 추가**: Hellas Central 의회 회기, 5개 의장 후보(Mikhail/Liang/Amara/Diego/Player), 환경 위기 병행 지표, 의장별 Ch8~Ch10 분기 modifier를 서버 시뮬레이션으로 구현.
- **FSP Ch8 "가이아" 추가**: 시민 기부 호소, Gaia 건조율/HP, MCC 절도 성공/실패, 전투 pledge/침묵/개인 기부 선택과 Gaia·Pilgrim Arms seed 보상을 추가.
- **FSP Ch9 "세 개의 깃발" 추가**: MCC/FSP/CV 정상회담, Pilgrim Arms 암살단, 보호 대상 선택(Amara/Chen/Butcher/전원후퇴/신호)과 배신·4파벌·Peacemaker 분기를 추가.
- **FSP Ch10 "자유의 대가" 추가**: Citizen, Peacemaker, Gaia Captain, Disillusioned, New Chair, Bad Ending 보상과 FSP route completion token을 추가.
- **Ch7~10 seed migration 추가**: 신규 환경, 위치, NPC, 의장 후보/지원 modifier/유권자 pool, lore flags, branch modifiers, tags, items, chapter config를 `200_fsp_campaign_ch7_to_ch10.sql`에 추가.
- **핸드오프 문서 업데이트**: `CLAUDE.md`와 audit 문서를 FSP Ch1~10 완료/v5.29 기준으로 갱신.

검증:
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/services/campaign.js` + `server/routes/api.js` require 스모크
- 운영 DB 기준 migration BEGIN/ROLLBACK 드라이런

## 2026-04-29 — Campaign Ch1 continue/complete 안정화 (v5.28)

- **산소 쟁탈 CONTINUE 복구**: 진행 중인 캠페인 카드의 `CONTINUE`가 기존 `sessionId`를 이어가도록 수정해, 이미 선택지를 고른 Ch1을 다시 시작/초기화하지 않게 했다.
- **완료 트랜잭션 안정화**: blueprint inbox, 칭호, 환경 숙련도, 태그, lore flag, branch modifier 지급을 `SAVEPOINT`로 격리해 부가 보상 하나가 실패해도 GP/XP/평판/진행 완료가 500으로 죽지 않도록 보강.
- **Ch1 구식 id 정리**: Ch1 보상의 다음 챕터 unlock과 cold death failure branch에 남아 있던 `mcc_ch2`/`mcc_ch6` 구식 id를 캠페인 상수 기반 id로 교체.

검증:
- 운영 DB 읽기 전용 schema/status 점검
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/services/campaign.js` + `server/routes/api.js` require 스모크
- `index.html` 인라인 script 파싱
- `git diff --check`

## 2026-04-29 — Campaign Quick Button 기준 위치 재조정 (v5.27)

- **데스크탑 위치 재조정**: CAMPAIGN 퀵 버튼을 오른쪽 줌 컬럼의 되돌리기 버튼 위로 이동.
- **모바일 위치 재조정**: CAMPAIGN 퀵 버튼을 왼쪽 하단의 "화성을 클릭하여 영토 선택" 모드 배지 바로 위로 이동.

검증:
- `index.html` 인라인 script 파싱
- `git diff --check`

## 2026-04-29 — Campaign Quick Button 위치 보정 (v5.26)

- **데스크탑 위치 보정**: CAMPAIGN 퀵 버튼을 하단 중앙 액션 영역에서 빼고, 좌측 패널 오른쪽 상단 보조 액션 위치로 이동.
- **태블릿/모바일 위치 보정**: 하단 네비/오른쪽 OPS·줌 조작과 겹치지 않도록 상단 왼쪽 작은 pill 위치로 이동.

검증:
- `index.html` 인라인 script 파싱
- `git diff --check`

## 2026-04-29 — FSP Campaign Ch5~6 MVP + Campaign UI 압축 (v5.25)

- **FSP Ch5 "Kepler 공유지" 추가**: Liang Wei, Roth dead drop, Kepler 3파벌 회담, 산소 보급 시한, Commons/중재/압박/전투/외계 기원 공개 5분기 서버 시뮬레이션 추가.
- **FSP Ch6 "두더지" 추가**: Kenji Tanaka 내부 스파이 색출, Sarah/Diego red herring, 단서 수집 지표, 처형/이중첩자/추방/오판 분기와 Ch7~Ch9 branch modifier 추가.
- **조건부 선택 검증 보강**: Ch5 Roth 데이터 압박/전면 공개 선택은 Roth/Lenag Wei 관련 증거 flag가 있을 때만 서버에서 허용.
- **캠페인 UI 압축**: QUESTS 탭의 잠긴 챕터 카드를 기본 접힘 compact list로 바꾸고, 메인 지도에 CAMPAIGN 퀵 진입 버튼을 추가.
- **Ch5~6 seed migration 추가**: 신규 환경, 위치, NPC, dead drop, internal zones, clue pool, suspect pool, lore flags, branch modifiers, tags, item, chapter config를 `199_fsp_campaign_ch5_ch6.sql`에 추가.
- **핸드오프 문서 업데이트**: `CLAUDE.md`와 audit 문서를 MCC Ch1~10 + FSP Ch1~6/v5.25 기준으로 갱신.

검증:
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/services/campaign.js` + `server/routes/api.js` require 스모크
- `index.html` 인라인 script 파싱
- 운영 DB 기준 migration ROLLBACK 드라이런
- `git diff --check`

## 2026-04-29 — FSP Campaign Ch4 Diplomacy MVP 구현 (v5.24)

- **FSP Ch4 "외교" 추가**: Sandstone Junction 비밀 회담, Cinder Grace 첫 등장, Amara 보호, MCC 정찰 회피/조건부 교전 MVP 시뮬레이션 추가.
- **협상 선택지/분기 구현**: 피난소 제공, 보급 공유, MCC 정보 교환, 산소 노예제 증거 공유, 협상 중단 5개 선택지와 Cinder 동맹 강도/적대 branch modifier를 반영.
- **조건부 증거 선택 검증**: `fsp_ch4_evidence_share`는 FSP Ch3 lore flag 또는 MCC cross-route branch modifier가 있을 때만 서버에서 허용하도록 보강.
- **Ch4 seed migration 추가**: `198_fsp_campaign_ch4_diplomacy.sql`에 Sandstone Junction, Cinder Grace, 신규 환경, lore flags, branch modifiers, tags, item, chapter config를 추가.
- **핸드오프 문서 업데이트**: `CLAUDE.md`와 audit 문서를 MCC Ch1~10 + FSP Ch1~4/v5.24 기준으로 갱신.

검증:
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/services/campaign.js` + `server/routes/api.js` require 스모크
- `index.html` 인라인 script 파싱
- 운영 DB 기준 migration ROLLBACK 드라이런
- `git diff --check`

비고:
- 전달된 FSP Ch4~6 spec에서 Ch5/Ch6는 “Sprint 2/3 작성 예정” placeholder라 이번 커밋에는 Ch4만 구현했다.

## 2026-04-29 — FSP Campaign Ch1~3 MVP 구현 (v5.23)

- **FSP Ch1 "방파제" 추가**: New Athens 차 두 잔 의식, H2O 호송 2척, 응급 환자 2명, CV 약탈단 4파 MVP 시뮬레이션과 낮은 FSP 단가 보상 구조 추가.
- **FSP Ch2 "얼음 캐러밴" 추가**: 북극관 → New Athens 얼음 운반, 태양광 노출 누적 손실, Phobos Eclipse 그늘 점프, Lena 개인 서사와 Sal Cruz 매복 분기 추가.
- **FSP Ch3 "피의 광산" 추가**: Verin-7 고도 8km 산소 노예제, 산소 조절기 5개, 광부 412명 구출, 60명 잔류 결정과 Samuel/Amara 분기 추가.
- **FSP 전용 seed migration 추가**: lore flags, branch modifiers, tags, NPC, 환경, item, settlement seed와 FSP Ch1~3 chapter config를 `197_fsp_campaign_ch1_to_ch3.sql`에 추가.
- **정착지 기반 seed 추가**: `settlement_data`를 안전하게 생성/확장하고 New Athens/Cold Brook/Ridge Town/Hellas Central 초기 데이터를 추가.
- **핸드오프 문서 업데이트**: `CLAUDE.md`의 현재 캠페인 구현 범위를 MCC Ch1~10 + FSP Ch1~3/v5.23 기준으로 갱신.

검증:
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/services/campaign.js` + `server/routes/api.js` require 스모크
- `index.html` 인라인 script 파싱
- 운영 DB 기준 migration ROLLBACK 드라이런
- `git diff --check`

비고:
- FSP Ch1~3도 MVP server simulation 단계이며, Tea Ceremony/Patient Gauge/Ice Gauge/Oxygen Regulator UI와 full battle engine 객체화는 후속 P1/P2.

## 2026-04-29 — MCC Campaign Ch8~10 MVP 구현 (v5.22)

- **MCC Ch8 "프로메테우스" 추가**: Deimos 조선소 4-phase 환경 시퀀스, Branch A 파괴 작전, Branch B/C 방어 작전, Prometheus Titan/조기 Ending 3 분기를 서버 시뮬레이션으로 구현.
- **MCC Ch9 "깨진 동맹" 추가**: Olympus/Hellas/Valles/Kepler 4전장 병렬 MVP, Pilgrim Arms 24척 침입, Amara/Butcher/Chen 관련 NPC 운명과 Ch10 branch modifier 반영.
- **MCC Ch10 "주주 엔딩" 추가**: cinematic-only 엔딩 챕터와 Ending 1~4/fallback 보상, lore flag, title tag, NG+ cross-route modifier 지급 추가.
- **엔딩 자격 서버 검증**: `calculateEligibleEndings()`를 추가해 Branch A/B/C, Roth 데이터, MCC 평판, blackmail data, Chen 사망 조건에 맞는 엔딩만 선택 가능하게 제한.
- **루트 선택 검증 확장**: Ch7뿐 아니라 Ch8/Ch9도 활성 Ch6 루트와 맞지 않는 선택지를 `/api/campaign/choice`에서 거부.
- **통합 seed migration 추가**: Ch8~10 lore flags, branch modifiers, tags, NPC, special asset, item definitions, achievements, environment/chapter config를 `196_mcc_campaign_ch8_to_ch10.sql`에 추가.
- **핸드오프 문서 업데이트**: `CLAUDE.md`의 현재 캠페인 구현 범위를 MCC Ch1~10 완료/v5.22 기준으로 갱신.

검증:
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/services/campaign.js` + `server/routes/api.js` require 스모크
- `index.html` 인라인 script 파싱
- 운영 DB 기준 migration ROLLBACK 드라이런
- `git diff --check`

비고:
- Ch8~10도 MVP server simulation 단계이며, Ch8 full environmental sequence UI, Ch9 parallel battlefield UI, Ch10 cinematic playback/credits roll은 후속 P1/P2.

## 2026-04-29 — MCC Campaign Ch5~7 MVP 구현 (v5.21)

- **MCC Ch5 "케플러 분쟁" 추가**: low gravity/oxygen pressure 환경, Roth 데이터 공개, FSP 차단/보급선 호위/단독 데이터 탈취/CV 자급 모선 격파 4분기와 보상/실패 분기 추가.
- **MCC Ch6 "내부고발자" 추가**: Li Fang 지원, Chen 보고, 자료 사본 보관 3개 루트 확정 선택과 `mcc_route_a/b/c_active` branch modifier, ending modifier, 태그/서사 플래그 지급 추가.
- **MCC Ch7 "시장 전쟁" 추가**: Ch6 루트 기반 A/B/C 변형 선택지와 Market War 결과, CV 불안정/Chen 감시/Helion 자회사 인수 분기 추가.
- **루트 잠금 검증 보강**: Ch7 시작 조건은 Ch6 루트 branch modifier를 요구하고, 선택 API도 활성 루트에 맞지 않는 Ch7 선택지를 서버에서 거부.
- **운영 status 호환 수정**: `player_branch_modifiers` 조회가 실제 스키마의 `set_at` 컬럼을 사용하도록 정정해 `/api/campaign/status/:wallet` 500을 방지.
- **통합 seed migration 추가**: Ch5~7 lore flags, branch modifiers, tags, NPC, data artifact, 신규 환경, chapter/environment config를 `195_mcc_campaign_ch5_to_ch7.sql`에 추가.
- **핸드오프 문서 업데이트**: `CLAUDE.md`의 현재 캠페인 구현 범위와 마지막 migration 정보를 Ch1~7/v5.21 기준으로 갱신.

검증:
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/services/campaign.js` + `server/routes/api.js` require 스모크
- `index.html` 인라인 script 파싱
- 운영 DB 기준 migration ROLLBACK 드라이런
- `git diff --check`

비고:
- Ch5~7도 MVP server simulation 단계이며, 실제 함선/건물/NPC 전투 객체를 v11.1 full battle engine에 연결하는 작업은 후속 P2/P3.

## 2026-04-29 — MCC Campaign Ch2~4 MVP 구현 (v5.20)

- **MCC Ch2 "동결된 고속도로" 추가**: Hellas 채굴장 인수, `night_freezing` 환경, 시설 HP/민간인 피해/민병대 격파 서버 시뮬레이션과 보상/실패 분기 추가.
- **MCC Ch3 "이사회" 추가**: Chen Weiss 첫 등장, Helion/Verin/Chromium 3분기 선택, Phobos Eclipse MVP 시뮬레이션, 분기별 보상과 Ch6/Ch7 branch modifier 추가.
- **MCC Ch4 "해적 매수" 추가**: Kara Vex 첫 등장, Ion Storm 회담 호위, 함대 명령 차단 상태, Helion 습격대/생존/도주 분기 시뮬레이션 추가.
- **통합 seed migration 추가**: Ch2~4 lore flags, branch modifiers, `clean_operator`, 신규 환경, NPC 정의, chapter/environment config를 `194_mcc_campaign_ch2_to_ch4.sql`에 추가.
- **캠페인 UI 범용화**: QUESTS 캠페인 카드/모달/결과 화면이 Ch1 전용 문구와 지표에 묶이지 않도록 챕터별 위치/환경/주요 metric을 표시.
- **시작 조건 적용**: prerequisite, required level, required reputation, blocking tags를 서버에서 검증하고 locked chapter는 UI에서 비활성화.

검증:
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/routes/api.js` require 스모크
- `index.html` 인라인 script 파싱
- 운영 DB 기준 migration ROLLBACK 드라이런
- `git diff --check`

비고:
- Ch2 구조물/민간인 객체, Ch3 자회사 함선 6종, Ch4 NPC protection/manual-only mode의 full battle engine 통합은 후속 P2/P3.

## 2026-04-28 — Campaign Common Systems 기반 확장 (v5.19)

- **공통 캠페인 DB 추가**: `campaigns`, `chapters`, `campaign_sessions`, `reputation_history`, tag/lore/branch/environment 정의 테이블과 Ch1 환경 config seed 추가.
- **평판 시스템 확장**: MCC/FSP/CV/Pilgrim Arms 4축을 지원하고, -100~100 clamp와 `reputation_history` 감사 로그를 추가.
- **공통 API 추가**: `/api/campaign/abandon`, `/api/reputation/*`, `/api/tags/*`, `/api/lore/*`, `/api/branch/*` 추가. 보상/평판/태그/lore/branch 조작 endpoint는 admin secret 기반 internal-only로 제한.
- **환경 시스템 MVP 추가**: 챕터 환경 phase 상태와 전투 modifier 계산 helper를 추가해 MVP 시뮬레이션과 추후 full engine 양쪽에서 재사용 가능하게 정리.
- **캠페인 UI 보강**: QUESTS > CAMPAIGN 패널에 MCC/FSP/CV 평판 게이지를 추가.
- **status payload 보정**: 캠페인을 아직 시작하지 않은 유저도 `reputation` 4축 기본값 `0`을 받도록 정리.

검증:
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/routes/api.js` require 스모크
- `index.html` 인라인 script 파싱

비고:
- 복잡한 branch modifier 조건 평가 엔진, 챕터 spec 자동 검증 스크립트, v11.1 full engine 환경 hook은 P2/P3로 분리.

## 2026-04-28 — MCC 캠페인 Ch1 MVP 구현 (v5.18)

- **캠페인 기반 DB 추가**: `campaign_chapters`, `player_campaign_progress`, `player_reputation`, 선택지/태그/서사 플래그/분기 modifier/보상 inbox 테이블을 추가.
- **MCC Route Ch1 "산소 쟁탈" 추가**: `server/services/campaign.js`에서 브리핑 선택지, 평판 변화, dust storm 단계, 산소 회수율, 성공/실패 결과를 서버 결정형 시뮬레이션으로 계산.
- **캠페인 API 추가**: `/api/campaign/status/:wallet`, `/api/campaign/start`, `/api/campaign/choice`, `/api/campaign/progress`, `/api/campaign/complete` 추가.
- **QUESTS 탭 CAMPAIGN UI 추가**: MCC Ch1 카드, Li Fang 브리핑 모달, 선택지, 압축 진행 화면, 결과/보상 모달을 추가.
- **보상 지급 트랜잭션화**: GP/XP/평판/칭호/환경 숙련도/아이템 inbox 기록을 완료 처리 트랜잭션 안에서 처리.

검증:
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/routes/api.js` require 스모크
- `index.html` 인라인 script 파싱
- `git diff --check`

비고:
- v11.1 실시간 전투 엔진 완전 통합, Helion 전용 함선/화물선 보존 전투 로직, 프롤로그 route lock은 Phase 2로 분리.

## 2026-04-28 — 내 영토 테두리 두께 완화 (v5.17)

- **내 영토 금색 테두리 완화**: halo 두께와 crisp line 두께를 낮춰 지도 위에서 과하게 떠 보이지 않도록 조정.
- **내 영토 fill/광도 조정**: 금색 fill alpha와 shadow 강도를 낮춰 배경 텍스처 가독성을 회복.
- **작업 규칙 명문화**: `CLAUDE.md`에 커밋/푸시 시 `CHANGELOG.md`와 `AUDIT_FINDINGS.md`를 함께 갱신하는 규칙 추가.

검증:
- `index.html` 인라인 script 파싱

## 2026-04-28 — 영토 시인성/텍스처 예산 개선 (v5.16)

- **영토 색 체계 단순화**: 내 영토는 금색, 다른 플레이어는 cyan, NPC는 회보라 점선으로 통일해 지도에서 즉시 구분되도록 정리.
- **이미지 영토 외곽선 개선**: 업로드 이미지가 있는 claim도 같은 색 체계를 따르는 두께/halo 외곽선을 적용.
- **텍스처 품질 예산화**: 기본 데스크톱은 안정적인 4K 유지, 고성능 데스크톱만 6K 자동 사용, `localStorage.marsHiResTexture='1'`일 때만 8K 합성 사용.

검증:
- `index.html` 인라인 script 파싱

## 2026-04-28 — POI 광물 발견 실패 수정 (v5.15)

- **POI mineral 로그 제약 수정**: `exploration_pois`는 `mineral` 보상을 생성하지만 `poi_discoveries` 로그 제약이 `mineral`을 허용하지 않아 발견 트랜잭션이 롤백되던 문제 수정.
- **광물 보상 표시 개선**: POI 발견 결과에서 `mineral` 보상을 아이템처럼 아이콘/이름/수량으로 표시.

검증:
- 운영 DB `poi_discoveries_reward_type_check`에 `mineral` 허용 확인
- `index.html` 인라인 script 파싱

## 2026-04-28 — 하이잭 자동승리 영토 표시 수정 (v5.14)

- **NPC/무함대 자동승리 claim 생성 보강**: 새 픽셀 없이 기존 적 픽셀만 하이잭한 경우에도 공격자 `claims` 레코드를 생성하고, 이전된 픽셀의 `claim_id`를 새 claim에 연결.
- **Phase 2 승리 audit 보강**: 전투 승리 후 새 claim을 사후 생성한 경우 `hijack_battles.new_claim_id`에도 기록.
- **자동승리 즉시 렌더 수정**: 클라이언트가 새 claim을 임시 추가할 때 `lat/lng/w/h` 필드명을 사용하도록 수정해 새로고침 전에도 내 영토 골드 표시가 안정적으로 보이게 함.

검증:
- `server/services/hijack.js` `node --check`

## 2026-04-28 — 전수 버튼/하이잭 플로우 감사 (v5.13)

- **하이잭 전투-only 진입점 차단**: Governor 대시보드 `HIJACK` 버튼과 Phase C 하이잭 모달이 `/api/hijack/declare`를 통해 영토 이전 없는 전투만 만들 수 있던 경로를 제거.
- **`/api/hijack/declare` 서버 안전장치**: legacy endpoint는 `410 HIJACK_DECLARE_DEPRECATED`를 반환하도록 변경. 실제 영토 하이잭은 `/api/hijack/declare-with-pp`만 사용.
- **죽은 서비스 UI 정리**: 제거된 `weeklyChallenges`, `gpBurn`, `luckyBox` 관련 player/admin 버튼이 404/503 API를 호출하지 않도록 no-op/안내 상태로 정리.
- **보조 버튼 플로우 보강**: `govSaveDeclaration()` 누락, `/api/fleets/my` alias, World Event detail fallback 문제 수정.

검증:
- `index.html` / `admin.html` 인라인 script 파싱
- `index.html` / `admin.html` / tactical-lab inline handler 전수 검사
- 서버 JS 전체 `node --check`
- hijack/battle/routes require 스모크
- 제거된 legacy endpoint 문자열 grep 확인

## 2026-04-28 — 핵심 플레이 라인 검수 및 버그 수정 (v5.12)

- **함선 건조/수리 재료 차감 수정**: `user_resource_inventory.resource_code`로 접근하던 경로를 실제 스키마인 `resource_id` 기반으로 정정.
- **자원 제작 루프 수정**: tier 자원 제작 시작/완료/취소 환불이 `resources.code -> resource_id` 조인을 통해 일관되게 동작.
- **고급 강화 재료 차감 수정**: `enhancementAdvanced` 재료 조회/차감이 실제 인벤토리 스키마와 일치.
- **하이잭 Phase 1 전투 수정**: 프리깃/구축함만 투입된다는 UI/문서 규칙을 battleEngine과 battleScheduler 통계에 반영.
- **하이잭 HP 보존 수정**: 전투 결과 HP 반영이 `result.timeline.frames`를 보도록 수정.
- **영토 정보 HIJACK 버튼 수정**: 전투-only Phase C 모달 대신 PP 정산/픽셀 이전이 포함된 `/api/hijack/declare-with-pp` 플로우로 연결.
- **admin resource circulation view 수정**: `user_resource_inventory` 조인을 `resource_id` 기준으로 정정.

검증:
- 서버 JS 전체 `node --check`
- route/service require 스모크
- `index.html` 인라인 script 파싱

## 2026-04-28 — 네이티브 다이얼로그 전면 제거 (v5.10)

### 브라우저 confirm() / prompt() / alert() → 인게임 모달

| 위치 | 함수 | 용도 |
|------|------|------|
| `index.html` | `gameConfirm({icon,title,body,confirmText})` → Promise | 범용 확인 모달 (기존) |
| `index.html` | `gameInput({title,label,placeholder,defaultValue,maxLength})` → Promise | 텍스트 입력 모달 (기존) |
| `admin.html` | `adminConfirm(msg, title)` → Promise | 어드민 전용 확인 모달 (신규) |
| `tactical-lab-v11.html` | 인라인 `#forfeit-overlay` CSS 오버레이 | RETREAT 전용 |

**변경 내역:**
- `index.html` `confirm()` 15곳 전부 `gameConfirm()` 교체 (수송·길드·동맹·함대·건조 취소·계정 삭제)
- `admin.html` `confirm()` 70곳 전부 `adminConfirm()` 교체, 67개 함수에 `async` 자동 추가
- `tactical-lab-v11.html` RETREAT `confirm()` → `#forfeit-overlay` 인라인 오버레이
- `admin.html`에 `adminConfirm` CSS + HTML + JS 삽입 (어드민 스타일 오렌지 테마)

**추가 완료 (같은 세션):**
- `admin.html` `showToast()` 신규 구현 — 기존 95곳 undefined 호출 정상화, `alert()` 275개 교체
- `admin.html` `adminInput()` 신규 구현 — `prompt()` 5개 교체
- `index.html` `prompt()` 10곳 → `gameInput()` 전부 교체 (영토이름, 콘텐스트, 렌탈, 동맹 입출금/창설)
- `index.html` 잔여 `alert()` 1곳 → `gameAlert()` 교체
- **결과: 코드베이스 전체에 브라우저 네이티브 다이얼로그 0개**

## 2026-04-27 — 함대전 HP 보존 + 속도 조절 + 무한 전투 (v5.9)

- **battleEngine.js** 타임아웃(MAX_TICKS 54000) 시 HP 비교 승자 선정 → `draw`로 변경 — 전투는 함선 전멸로만 끝남
- **battleScheduler.js** WS frame 스트리밍 `tickMs/4` → `tickMs/8` (기본 2배 빠른 전송)
- **tactical-lab-v11.html** SPEED 버튼 패널 추가 (×1/×2/×4/×8) — WS 없는 로컬 시뮬 전용, WS 모드는 서버 8x 스트리밍 적용
- **fleetBattles.js** `POST /api/battles/:id/forfeit` 신규 endpoint — 공격자가 전투 포기 시 preparing이면 즉시 취소, 이미 시뮬됐으면 현재 HP 보존
- **tactical-lab-v11.html** 🏳 RETREAT 버튼 → `/api/battles/:id/forfeit` 호출 → 부모에 `forfeit` postMessage → 조선소 FLEET 탭 자동 열기
- **index.html** forfeit postMessage 핸들러: 뷰어 닫기 → 토스트 → 조선소 FLEET 탭 이동
- **battleEngine.js** `captureFrame` 에 `maxHp`, `side` 추가 — WS 첫 프레임에서 HP바 최대값 보정
- **tactical-lab-v11.html** WS 첫 프레임 수신 시 `atkMaxHP`/`defMaxHP` 서버값으로 재보정 (`_wsMaxHpCalibrated`)
- **index.html** `loadBvSidePanels`: participants 배열 기반으로 내 함대 vs 적 함대 구분 — 지갑 비교 기준 수정
- **index.html** `showBattleResult`: "나" 배지 + 승리/패배 서브타이틀 표시

## 2026-04-27 — 하이젝 후 영토 즉시 금색 반영 (v5.8)

- **server/services/hijack.js** `declareHijackWithPP` 응답에 `hijacked_pixels`, `new_pixels_list` 추가 — auto_win 시 이전된 픽셀 좌표 반환
- **index.html** auto_win 핸들러: 서버 응답으로 `_serverPixels` 즉시 업데이트 → `_rebuildOwnerData()` + `compositeClaimsOnTexture()` 즉시 호출 — Railway DB 레이턴시와 무관하게 하이젝 즉시 금색 표시
- 기존 2s+6s API 재시도는 백업으로 유지

## 2026-04-26 — 모바일 영토 텍스트 색 + 골드 강도 향상 (v5.7)

- **index.html** CSS `.mob-territory-card .mt-val`: `var(--tx1)` (미정의 → 검정) → `var(--tx)` (크림 `#E8E0D8`) — 모바일 좌표/크기 텍스트 가독성 복구
- **index.html** `compositeClaimsOnTexture` isMine 골드 시각 강화: fill alpha 0.40→0.65, shadowBlur 8→12, 외곽선 alpha 0.35→0.6, halo lineWidth 6→10, inner line 2.2→3

## 2026-04-26 — 하이젝 전투 3종 수정 (v5.6)

- **battleEngine.js** `applyBattleResults`: 하이젝 전투(`battle_type LIKE 'hijack%'`) 시 함선 파괴 없음 — 시뮬 최종 HP 반영, 0 이면 max_hp×15% 보존 (is_alive=true 유지)
- **index.html** `openBattleViewer`: TIMELINE_NOT_FOUND 시 전투 진행 중이면 에러 없이 대기(iframe WS 처리). 폴링 15s→60s 연장. 전투 종료 확인 후에만 에러 토스트.
- **index.html** 하이젝 auto_win 후 픽셀 갱신: 2s+6s 두 번 재시도 + claims 배열도 동시 갱신 (Railway DB 레이턴시 대응)

## 2026-04-26 — 내 영토 골드 하이라이트 (v5.5)

- **index.html** `compositeClaimsOnTexture`: `isMine` 영토 골드 색상 `{r:255,g:209,b:102}` 적용 (fill alpha 0.40, border shadowBlur:8 글로우, lineWidth 2.2)
- **index.html** 지갑 주소 대소문자 무관 비교 — `myAddr`, sortedClaims sort, isMine 체크, `showTerritoryInfo` 전부 `.toLowerCase()` 적용
- 결과: 글로브에서 내 영토가 NPC/타인 영토와 명확히 구분되는 금색으로 표시됨 (캔버스 픽셀 샘플 `[252,205,101,255]` 확인)

## 2026-04-26 — 내 영토 표시 + 전투 버튼 정리 (v5.4)

- **index.html** `compositeClaimsOnTexture`: `isMine` 에서 `_myLandMode &&` 조건 제거 → 내 영토 항상 밝게 렌더
- **index.html** `showTerritoryInfo`: 내 영토 클릭 시 상단 오렌지 border + "✦ 내 영토 ✦" 배지
- **tactical-lab-v11.html**: Reinforce 3개 버튼 제거 (ws 전투에서 서버 미반영)
- **tactical-lab-v11.html**: Scatter, Rally 기동 버튼 추가 (기존 MANEUVERS 정의는 있었으나 버튼 누락)

## 2026-04-26 — Tactical-lab 전투 뷰어 4종 버그 수정 (v5.3)

- **battleEngine.js**: wedgeSides 처리 `f.movement='wedge'` → `f.formation='wedge'` (크래시 root cause)
- **tactical-lab-v11.html**:
  - MANEUVERS/FORMATIONS null-safe fallback (`||MANEUVERS.advance`, `||FORMATIONS.sphere`) 전체 적용
  - ws sync 시 MANEUVERS/FORMATIONS 유효성 검사 후 적용
  - ws mode에서도 `fire(sh, wsMode)` 시각 전용 bullet/laser 활성화 (`visual:true` → applyDmg 스킵)
  - `centeredPos(n, side)` 함수: 1 vs 1 → 캔버스 정중앙(H*0.5), n대 → 균등 분배
  - 자동 줌/팬 카메라: 생존 함대 bounding box → `camScale/camCx/camCy` lerp, canvas transform 적용

## 2026-04-26 — 함선 단위 정밀 폭발 이펙트 (v5.2)

- **battleEngine.js**: ws frame ships 배열에 `code` 필드 추가 (ship_type_code)
- **tactical-lab-v11.html**:
  - 매 ws frame 수신 시 이전 프레임과 diff → 격침 함선마다 위치 기반 `mkExp()` 트리거
  - size_class 별 폭발 반경 차별화 (frigate 1.2 → titan 6.0)
  - battleship/titan 격침 시 추가 shockwave + 격침 로그
  - fleet dead 전환 시 shockwave 즉시 트리거
  - `initBattle()` 에서 `_wsPrevShips` 리셋

## 2026-04-26 — Phase 2 완료: WebSocket 실시간 함대전 (v4.8~v5.1)

### Phase 2 4가지 모두 ✅
| Phase | 내용 | 커밋 |
|---|---|---|
| 2-A | WebSocket 인프라 (server/wsServer.js + index.js attach + battleScheduler frame stream) | v4.8 `ba34f9a` |
| 2-B | 클라이언트 ws 연결 + ws_end → 결과 카드 즉시 표시 | v4.9 `7d9fcd3` |
| 2-C | fleet 단위 동기화 (위치/HP/진형/기동) — dbFleetId 매핑 | v5.0 `ccbdfb0` |
| 2-D | 자체 시뮬 fire/damage + 자동 재시작 비활성화 | v5.1 `49d0138` |

### 동작 흐름 (사용자 hijack 후)
1. viewer → tactical-lab iframe 로드 → ws 연결 (`ws://.../ws/battle/{id}?token=`)
2. 명령 로그: "🔌 실시간 연결됨"
3. 서버 battleScheduler 가 시뮬 결과 frames 를 4x speed 로 ws stream
4. iframe 가 매 frame 받아 자체 fleets 의 cx/cy/hp/formation/maneuver 갱신
5. 자체 시뮬 fire/damage 비활성 — 진짜 데이터로만 시각화
6. 사용자 컨트롤 (진형 변경 등) → ws cmd → commanderActions → 다음 battle 적용
7. 시뮬 종료 → ws_end → 부모 viewer 의 결과 카드 즉시 표시
8. 자동 재시작 안 함 (실제 hijack 결과 영구)

### 사용자 요구 4가지 최종 진행도
| # | 요구 | 상태 |
|---|---|---|
| 1 | tactical-lab 모든 항목 그대로 이식 | ✅ iframe + 우리 catalog/fleet-presets |
| 2 | 모든 항목 실제 게임과 연결 | ✅ ?bid → fleet 데이터 + ws frame 동기화 |
| 3 | 유저 컨트롤 (진형/기동/EMP/집중) | ✅ postMessage + ws cmd → commander_actions → battleEngine |
| 4 | 실시간 (hijack manual + AI 자동) | ✅ AI strategy + ws 실시간 frame + end 즉시 결과 |

---

## 2026-04-26 — Phase 4: AI Strategy + Phase 5 검증 (v4.7)

### Phase 4 — AI 전략 (PvP/Siege/Event 자동 진형/기동)
- **`services/aiStrategy.js`** 신규
  - 파벌별 doctrine:
    - MCC: screen 50% / sphere 30% / wedge 20% + advance 50% / flank 30% / rally 20%
    - FSP: sphere 50% / screen 30% / pincer 20% + advance 40% / rally 35% / retreat 25%
    - CV : wedge 50% / pincer 30% / sphere 20% + flank 50% / advance 35% / scatter 15%
  - `applyAIStrategy(battleId, battleType)` — hijack 외 battle 양쪽에 자동 commander_actions INSERT
  - `pickFormation(faction)` / `pickManeuver(faction)` weighted random
- **Migration 190**: `ai_strategy_enabled=true` settings (admin 토글 가능)
- **`battleScheduler.js`**: simulate 직전 hook 추가 — hijack 외 battle 자동 적용
- 검증: 테스트 battle #20 (PvP) → atk(MCC): screen+rally, def(FSP): sphere+retreat 정확히 INSERT

### Phase 5 — tactical-lab 패널 실데이터 연결 (이미 동작 중)
- tactical-lab v11 의 `loadCatalog()` 가 이미 `/api/tactical-lab/catalog` 에서 우리 DB 데이터 fetch:
  - `MINERALS` (13종 광물) ← `resources` 테이블
  - `FACTIONS` (3파벌) ← `factions` 테이블
  - `SHIPS` (22종 함선) ← `ship_types` 테이블
- FLEET STATUS 패널 → 시뮬 중인 fleets (?bid=N 으로 받은 진짜 함대)
- SHIP REGISTRY 패널 → 우리 ship_types 22종 자동 표시
- MINERALS 패널 → 우리 resources 13종 자동 표시
- DOCTRINES 패널 → 별도 분석 화면 (시뮬 데이터 기반)
- **추가 작업 불필요** — 검증 완료

### 누적 v4.0~v4.7 (Battle Viewer = Tactical Lab 통합)
- viewer 자체 canvas/HUD/컨트롤 폐기, tactical-lab v11 iframe 통째 통합
- `?bid={battleId}` 로 실제 fleet 구성 주입
- 데스크탑 1500×820, 양쪽 240px 사이드 패널 (MY FLEET / RESOURCES / ENEMY FLEET / BATTLE STATS)
- 모바일 풀스크린 유지
- 컨트롤 (진형 4종 / 기동 5종 / EMP / 집중공격) → postMessage → API → 시뮬 실제 적용
- AI 전략으로 PvP/Siege 자동 명령
- 결과 카드 디자인 + 재시작 버튼 제거 + 함선 HP DB 반영

### 잔여 Phase
- **Phase 2 (다음 사이클)**: WebSocket 실시간 frame broadcast — battleScheduler tick → ws emit, 클라 실시간 렌더링. 진정한 "실시간" 함대전.

---

## 2026-04-26 — Phase 3-B: Commander Actions → Sim Apply (v4.6)

### 사용자 요청 4가지 (Phase 1~3 단계 완료):
1. ✅ tactical-lab 모든 항목 우리 게임에 그대로 이식
2. ✅ 모든 항목 실제 게임과 연결 (fleet-presets ?bid)
3. ✅ 함대전 유저 컨트롤 가능 (postMessage bridge)
4. 🟡 실시간 함대전 (WebSocket) — Phase 2 다음 사이클

### Migration 189 — commander_actions formation/maneuver 지원
- CHECK constraint 에 `formation_change`, `maneuver_change` 추가
- settings: `commander_action_formation_gp_cost=0`, `commander_action_maneuver_gp_cost=0` (잦은 변경 무료)

### `services/commanderActions.js` 강화
- `VALID_FORMATIONS` (sphere/wedge/screen/pincer) + `VALID_MANEUVERS` (advance/flank/retreat/scatter/rally) 검증
- mutable 액션 (formation/maneuver):
  - quota 카운트 제외
  - 중복 시 UPDATE (params 변경 가능)
  - GP 재차감 안 함
- `loadForBattle` 결과에 `formationsBySide` + `maneuversBySide` 추가

### `services/battleEngine.js` 적용
- `initializeBattle` 가 양쪽 함대에 commanderActions 의 formation/maneuver 적용
- focus_fire / wedge / EMP / reinforce 는 기존대로

### 검증 (preview)
- 테스트 battle #19 에 lain 등록 후:
  - formation_change wedge → 200 OK
  - maneuver_change flank → 200 OK
  - formation_change sphere (mutable update) → 200 OK
  - emp → 200 OK
  - 최종 list 3건 (sphere, flank, emp)

### 잔여 Phase
- **Phase 2**: WebSocket 실시간 frame broadcast (battle scheduler tick → ws emit)
- **Phase 4**: AI 전략 (services/aiStrategy.js) — hijack 외 battle 에 자동 진형/기동 INSERT
- **Phase 5**: tactical-lab FLEET STATUS / SHIP REGISTRY / MINERALS / DOCTRINES 패널을 실제 게임 데이터에 연결

---

## 2026-04-26 — Battle Viewer 데스크탑 오버레이 (v4.0)

### 🟢 사용자 요청: "데스크탑에서 전투화면 좀 오버레이로 작게 보여야 할 텐데 너무 풀화면이더라고"
- **Fix**: `.bv-backdrop` 에 데스크탑 미디어쿼리 추가 — `min-width:769px` 일 때 중앙 오버레이 (max 1100×680, 92vw/88vh, border-radius 12px, dim 배경 rgba(0,0,0,.82))
- 모바일 (≤768px) 은 풀스크린 유지 (기존 그대로)
- 사용자 데스크탑에서 hijack/declare 후 viewer 가 적당한 사이즈로 떠 globe 화면을 일부 가림 → 게임 컨텍스트 유지

---

## 2026-04-26 — POI Mineral Loot + NPC 함선 일괄 부여 (v3.9)

### 🟢 사용자 요청: "POI 에도 GP/아이템/광물 섞여서 나오는게 맞지?"
- **Migration 188**: `poi_drop_mineral_weight=25` + 광물 풀 (rocket 과 동일 6종) + qty 1~4 settings
- **`exploration_pois.reward_type` CHECK constraint** 갱신: `'mineral'` 추가
- **`spawnPOIs`**: weighted pick 에 mineral 분기 추가 (resources random + qty)
- **`claimPOI`**: mineral 처리 — `user_resource_inventory` ON CONFLICT 적립
- 기존 GP weight 70 → 50 으로 균형 조정
- POI 50 / Item 20 / Mineral 25 / PP 10 분포 (admin 조정 가능)

### 🟢 사용자 요청: "NPC 들에게 함선 부여 — hijack 함대전 테스트 안 됨"
- `/admin/api/fleet/grant-starter-all-npcs` 호출
- 결과: total 21 NPC, granted 3 (새로 부여), alreadyHad 18 (이미 보유), errors 0
- 모든 NPC 함대 보유 → hijack 시 함대전 정상 트리거 가능

---

## 2026-04-26 — Rocket Drop Mineral Loot + 새 Rocket SVG + viewer 롤백 (v3.8)

### 🔴 사용자 신고: "자원드롭 15개인데 GP만 존나 나옴"
- **원인**: `services/rocket.js` 보상 풀이 GP 50% / Item 25% / XP 17% / PP 6% / Cosmetic 2% — 광물(mineral) 카테고리 자체가 없음.
- **Fix**: mineral 카테고리 추가
  - **Migration 187**: `rocket_drop_mineral_weight=25`, `rocket_drop_mineral_pool` (6종 광물 admin 조정), `rocket_drop_mineral_min_qty/max_qty=1~5`. 기존 GP weight 50→30 으로 균형 조정.
  - rocket.js: weighted pick 에 mineral 분기 추가 (resources 테이블에서 random pick + qty)
  - claim 로직: `user_resource_inventory` 적립 (resource_id 기반 INSERT...ON CONFLICT)
- **검증** (rocket 13, 15 loot): mineral 7 / item 3 / xp 3 / gp 1 / cosmetic 1 — 다양하게 섞임 ✅

### 🟢 사용자 요청: "로켓드롭 이미지 어울리는 거로 만들어"
- **신규**: `assets/textures/rocket_drop.svg` 인라인 SVG 로 새 로켓 디자인 (화염 트레일 + 윈도우 + 핀 + 엔진 벨)
- 기존 starship.png 대체. PNG 로드 실패 시 자동 fallback (`onerror`).
- 적용 위치: globe overlay 의 incoming 마커 + `.rocket-banner` 의 인라인 아이콘

### 🟡 v3.7 viewer 롤백
- **이전 v3.7 fix 가 너무 공격적**: atk=0 또는 def=0 시 viewer 즉시 닫음 → 사용자 요청 "1:1 이어도 풀 viewer 떠야" 와 충돌.
- **Fix**: viewer 정상적으로 풀 시각화 띄우되, frames<2 (시뮬 이상 의심) 일 때만 경고 토스트 + viewer 유지. 사용자가 ✕ 로 닫게.

### 🟢 사용자 신고 1: "영토 있는데 OPS 발사대 슬롯 0"
- v3.7 의 모바일 OPS 탭 launch-form 살린 fix 로 자동 해결 (사용자 "어 슬롯 이제 나왔다" 확인).

---

## 2026-04-26 — Mobile OPS Pane + Hijack 자동승리 Viewer Fix (v3.7)

### 🔴 사용자 신고 1: 모바일에서 OPS 탭 진입 후 내용 빈 화면
- **원인**: 1024 미디어쿼리 룰 `.ops-launch-form, .ops-quick:not(...) { display:none !important }` 가 BASE 모달 내부 OPS 탭 발사 폼 (`.ops-launch-form`) 까지 숨김. OPS 탭 본문이 launch-form 이라 모바일에서 빈 페이지로 보임.
- **Fix**: 룰에서 `.ops-launch-form` 제거. `.ops-quick:not(.ops-quick-split)` 만 남김 — 데스크탑 floating launcher 만 숨기고 BASE 모달 내부 발사 폼은 모바일에서도 표시.
- 검증: ops-launch-form display:block h:316px ✅, basePane_ops h:433px ✅

### 🔴 사용자 신고 2: 하이젝 함대전 viewer 빈 화면
- **원인**: 자동승리 케이스 (atk_ships_total=0 또는 def_ships_total=0) 에 시뮬레이션 frame 이 사실상 1개라 캔버스에 그릴 게 없음 → 빈 화면 + "0:00 / 0:00"
- **Fix**: `openBattleViewer` 가 timeline 로드 후 `atkN === 0 || defN === 0` 체크 → viewer 모달 닫고 winner 기준 명확한 토스트 표시 ("⚔ 자동 승리" / "🛡 자동 패배" / "⚡ 자동 종료").
- 검증: battle 10 (atk 1, def 0) 호출 → 793ms 만에 토스트 + viewer 닫힘 ✅

---

## 2026-04-26 — Mobile 침공/탐사 퀵카드 복원 (v3.6)

### 🔴 사용자 신고: "모바일 메인 화면에서 침공/탐사 버튼이 안 보임"
- **원인**: 1024 이하(태블릿) 미디어쿼리의 `.ops-launch-form, .ops-quick { display:none !important }` 룰이 element class `"ops-quick ops-quick-split"` 둘 다 매치 → 모바일 전용 split 카드까지 숨김
- **Fix**: `.ops-quick:not(.ops-quick-split)` 로 좁혀서 옛 desktop-only `.ops-quick` 만 숨기고 모바일 split 카드 살림
- 검증 (preview, 375×812): 우측 가운데 침공/탐사 분할 카드 60×120 정상 표시 ✅

---

## 2026-04-26 — Leaderboard Pixel Count Fix (v3.5)

### 🔴 사용자 신고: "리더보드 픽셀 수가 BASE 패널과 안 맞음"
- 스크린샷 비교: 리더보드 1위 Woo = **9,260 px** vs BASE 패널 "총 픽셀" = **7,173 px**
- **원인**: `/api/leaderboard` 의 `pixel_count` 가 `SUM(claims.width × height)` (이론적 직사각형) 로 계산. claim 안에서 hijack 당하거나 NPC 영역인 픽셀까지 포함해 부풀려짐.
- **Fix**: `pixels` 테이블에서 실제 `owner = wallet` 카운트로 변경. BASE 패널과 동일한 SSOT.
- 검증: Woo = 7,173 px ✅, NPC들도 정확.

---

## 2026-04-26 — Rank Auto-Recalc System (v3.4)

### 🔴 사용자 신고: "레벨업 기준 다 통과한 상태인데 레벨업이 안 됨"
- **진짜 원인**: XP 는 daily/season/worldEvents 에서 += 되지만 `rank_level` 갱신은 admin 수동 `/admin/api/recalc-ranks` 호출 때만. **자동 트리거가 없어서 평생 lv 4에 멈춤**.
- **Fix 1: `services/rank.js` 신규** — `recalcUserRank(wallet)` 헬퍼 (admin 로직 single-user 버전 추출, breakthrough conditions 평가까지)
- **Fix 2: Lazy trigger** — `GET /api/user/:wallet/base` (BASE 패널 진입 hot path) 에서 매번 fire-and-forget recalc → 사용자가 화면 보면 즉시 반영
- **Fix 3: Periodic scheduler** — `server/index.js` 에 5분 (settings 조정 가능) 간격 batch. 최근 24h 내 로그인 유저만 처리해서 full-table scan 회피.
- **Migration 186** (`186_rank_auto_recalc.sql`): settings 4종 (`rank_auto_recalc_enabled`/`interval_seconds`/`lookback_hours`/`batch_size`)

### 🟢 진단 결과 — 사용자 본인 케이스
- 신고 wallet `0x68556e2e...` 상태:
  - XP **110,997** ✅ (level 5 required 1,600)
  - play_days **24일** ✅ (level 5 require 3일)
  - **pixels 0개** ❌ (level 5 breakthrough require ≥ 10개)
- Level 5 (Storm Chaser) breakthrough = `pixels ≥ 10 AND play_days ≥ 3` 미충족 → 정상 동작.
- 자동 recalc 가 동작해도 동일한 결과 — XP 외 추가 조건이 막는 케이스. UI 에서 "다음 레벨 진입 조건" 명시 필요 (다음 작업 후보).

---

## 2026-04-26 — Battle Viewer Guard + Faction Auto-Starter Verify (v3.3)

### 🔴 함대전 데이터 로딩 실패 (사용자 신고 — "전투 데이터 로딩 실패" 토스트)
- **원인 1**: `openBattleViewer(undefined)` 호출 시 `/api/battles/undefined/timeline` 을 1.5s × 10회 폴링 → 모두 실패 → 토스트.
- **원인 2 가능성**: 응답에 `phase1_battle_id` / `battle_id` 누락 시에도 `setTimeout` 으로 호출됨 → 위와 동일.
- **Fix**:
  - `openBattleViewer()` 에 `parseInt(battleId)` 가드 추가. falsy/invalid 면 즉시 명확 토스트 + return.
  - 폴링 실패 시 마지막 에러 메시지를 토스트와 console.error 에 포함 — 진단 가능.
  - 호출처 2곳에 `if (id) setTimeout(...) else console.warn` 가드 추가 (hijack confirmHijack + challengeAi).
- **검증** (preview): `openBattleViewer(undefined)` → 4ms 만에 토스트 + return, 모달 안 열림 ✅. battle 9/10 정상 응답 200 OK ✅.

### 🟢 파벌 선택 시 스타터 함선 자동 지급 (사용자 확인 요청)
- **이미 구현 라이브** ([faction.js:148-198](server/services/faction.js:148))
  - 파벌 선택 시 활성 함선 0척이면 가장 싼 frigate 자동 지급 + 함대 자동 생성 + 기함 지정.
  - 트랜잭션 내, 함선 지급 실패해도 파벌 선택 자체는 성공 (방어적).
- **파벌별 자동 지급될 함선** (`build_gp_cost ASC LIMIT 1`):
  - MCC → 프리즘 (mcc_int, 50 GP)
  - FSP → 스프라이트 (fsp_int, 80 GP)
  - CV  → 슬래셔 (cv_int, 45 GP)

---

## 2026-04-26 — Toast 3-style Restore + Orphan Display Defense + Ship Image Slot + Hijack Defender Info Fix (v3.2)

### 🔴 Hijack 함대 정보 에러 (사용자 신고 — "상대 함대 정보 확인 실패")
- **원인**: `phaseC.js:211` 의 `GET /hijack/:id` 가 `:id` 패턴에 `defender-info` 문자열도 매치 → `parseInt('defender-info')` = NaN → `INVALID_ID 400` 반환. NPC 지갑(예: `0xnpc_elysium_mons`) hijack 모달에서 함대 미리보기 실패.
- **Fix**: phaseC.js 의 `:id` path 를 `:id(\\d+)` 정규식으로 강제 → 숫자만 매치, 다른 문자열은 다음 핸들러(api.js `/hijack/defender-info`)로 fallthrough.
- 검증: `GET /api/hijack/defender-info?wallet=0xnpc_elysium_mons` → 200 `{fleetCount:1, aliveShips:1, willAutoWin:false}` ✅


### 🔴 사용자 신고 fix
- **거버너/사령관 없는데 메인화면에 옛 표시 잔존** (스크린샷 신고)
  - 백엔드: `services/governance.js` `getCommanderInfo`/`getSectorInfo` 응답 정규화 — `commander/governor` 빈 문자열 → `null`, governor/commander 없으면 `announcement` 강제 `''`
  - 클라이언트: `_hideCommanderUI()` 안전망 추가 — `loadCommanderBanner` 응답이 비거나 fetch 실패 시 즉시 banner+박스 hide
  - `_drawSectorOverlay`/sector 카드: `s.announcement` 표시 조건에 `&& s.governor` 추가 (orphan 잔존 방어 2중화)
- **토스트 3종 시스템 복원** (사용자 신고 "옛날 토스트 3종류였던게 좋았는데")
  - `e764e75`(통합) + `f424b6a`(stretch fix) 모두 무효화
  - **showToast** = 화면 중앙 그린 알약 (1줄 함수)
  - **showFactionToast** = 하단 블루 박스 (자체 구현 복원)
  - **showNotification** = 우상단 카드 스택 (변경 없음)
  - `@supports(env(safe-area-inset-top))` 안의 `top:50%; bottom:auto` rule 제거 → 옛 위치 그대로

### 🟢 함선 이미지 슬롯 (사용자 요청 — nano-banana 등으로 교체 가능)
- **`assets/ships/`** 디렉터리 + README (네이밍 규칙 + 파벌 컬러 가이드)
- **`shipVisual()`** 신규 함수: SVG 실루엣 + PNG 오버레이 (PNG 로드 성공 시 덮어씀, 실패 시 `onerror`로 자동 제거 → SVG fallback)
- 조선소 블루프린트 카드 + 건조 confirm 모달 두 곳에 적용. 컨테이너에 `position:relative; overflow:hidden` 추가
- 파일명 우선순위: `{code}.png` > `{faction}_{size}.png`. 22종 함선 코드는 README 참조

### 📝 코드베이스 인식 정정 (CLAUDE.md §8)
- **함선 건조 `recipe_minerals` 무시됨** → ❌ 잘못된 메모. 이미 `services/ship.js:278-321` 에서 차감 중. Migration 163 이 zone-tier 기반 광물(iron_ore/titanium_alloy/exotic_alloy/dark_matter/quantum_core 등)로 22종 모두 시드 완료
- **타이탄/배틀십 Core/Mid 재료** → ❌ 잘못된 메모. 타이탄은 `dark_matter+quantum_core+exotic_alloy` 필수, 배틀십은 `exotic_alloy` 포함. Migration 163 시드됨
- **함선 수리 UI 미완** → ❌ 잘못된 메모. `index.html:40588-40700` `syRepairShip/syChargeShield/syScrapShip` 모두 라이브
- **광물 도감 UI 부재** → ❌ 잘못된 메모. `index.html:41332` Minerals Panel 모달 + `openMineralsPanel()` 진입 버튼 존재
- **Hijack 비-primary 디펜더 픽셀 처리** → ❌ "잔여 P1" 아님. 의도된 디자인. Phase 1/2 패배 시 영토 보존 + PP 90% 환불 정상 동작 (`services/hijack.js:197,379`)

### 📝 Commits (시간순 예정)
```
d0b1adf  docs: v3.1 audit findings + changelog (이전 커밋)
[다음]   feat(v3.2): toast 3-style restore + orphan display defense + ship image slot
```

---

## 2026-04-26 — Audit Punch List + Governance Auto-Expire + UX (v3.1)

### 🔴 Governance 자동 만료 (사용자 신고 — admin 수동 클리어 부담 제거)
- **Migration 185** (`185_governance_auto_expire.sql`): settings + idx_users_last_login_at
- **`server/services/governanceExpire.js`** NEW: governor/commander 자동 자리비움 로직
  - 조건: orphaned wallet | `COALESCE(last_login_at, governor_since)` 14일 이전 | term_expired
  - 1시간 스케줄러 (`server/index.js`)
  - `__invalidateSectorsCache()` 자동 호출
- **`server/routes/auth.js`**: 로그인 + /me 시 `last_login_at = NOW()` 갱신
- **고아 announcement 정리**: governor=NULL & announcement≠NULL sector 자동 cleanup
- **즉시 결과**: 15 sectors + commander + 9 orphan announcements 모두 클리어

### 🟡 Audit P0/P1 punch list (commit `135da81`)
- **P0-1 Shield 일원화**: `services/shield.js isClaimShielded/Tx` 가 `territory_shields` 만 조회 → `pixel_shields`(상점) UNION 추가. 상점 shield 가 hijack 못 막던 버그 fix.
- **P0-2 Cosmetic decrement**: `/api/cosmetic/equip` 가 `user_items.quantity` 차감 안 해 1개로 N장착 가능했음 → equip -1, unequip +1, 교체 시 이전 cosmetic 환수 트랜잭션화.
- **P0-3 Tier 보너스 적용**: `services/tiers.js miningBonusPct` 가 dead code → `/api/harvest` 에 territory_tiers MAX(tier) → cfg.tiers[].miningBonusPct 곱셈 블록 추가.
- **P1-1 Harvest cap 순서**: cap=1.0PP 가 모든 multiplier 후 적용돼 VIP/buff/governor 보너스가 cap 에 흡수됨 → cap 을 base 직후로 이동, multiplier 가 그 위에서 amplify.
- **P1-2 season.trackGPSpend**: 미export 라 6개 라우트 silently skip → `addSeasonScore('gp_spend')` alias + export.
- **P1-3 gpActivity require**: 10개 서비스가 `require('./gpActivity')` (없는 모듈) → `require('../db')` 일괄 fix.

### 🟢 Mining 광물 드롭 (사용자 신고 — "PP 만 표시")
- **Bug 1**: `/api/users/:wallet/base` 응답 territory 에 `tierCounts` 누락 → UI 가 항상 'no land' 표시
- **Bug 2**: `/api/harvest` 가 `bestTier` 한 개만 roll → mid+frontier 보유 시 frontier 광물 누락
- **수정**: tierCounts 응답 추가 + 보유한 모든 tier 별로 독립 roll, 결과 합산
- **UX**: 채굴 버튼 라벨에 `+ 🪨` 추가 (`(0.03~1.50 PP + 🪨)`)

### 🐛 UI/UX 버그
- **거대 토스트 박스** (사용자 신고 "이게 뭐야?"): `.toast` 가 `top:50%` + `bottom:130px` 동시 적용으로 viewport 절반 만큼 세로로 stretch. `bottom:auto` + `transform:translate(-50%,-50%)` 로 fix.
- **알림창 닫기**: ✕ 버튼 + outside-click 닫기 (`closeNotifPanel`, `_notifOutsideClick`)
- **출석체크/데일리미션 빈 화면**: QUESTS 탭 진입 시 `checkDailyLogin/renderInlineCheckin/loadDailyMissions` 자동 호출
- **Hijack 모달 undefined**: `data-i18n="hijack_def_label"` 키 노출 + parseInt 방어, `willAutoWin` auto-detection

### 📝 Commits (시간순)
```
f424b6a  fix(toast): 거대 박스 (top+bottom 충돌) fix
b7aa2bf  fix(governance-expire): NULL last_login_at fallback + orphan announcement cleanup
135da81  fix(audit): P0/P1 punch list — shield, cosmetic, tier, harvest cap, season, gpActivity
13efdc0  fix(mining): tierCounts 응답 + 모든 tier roll
6046673  fix(ux): notif 닫기 + daily refresh + mining 라벨 + governance auto-expire
```

---

## 2026-04-25 — Major Stability & Polish Pass (v3.0)

### 🐛 사용자 신고 버그 수정

- **일일 출석체크 'Daily login failed'** 오류 수정
  - 원인: `getSetting()`이 string 반환하는데 array로 사용 → INSERT NaN
  - 수정: JSON 파싱 + Array.isArray 가드 추가
- **JOBS admin 통계 빈 값** 수정
  - 원인: backend response shape (distribution) vs frontend expects (byJob/noJob/recentChanges)
  - 수정: backend 응답에 byJob (per-job avg_gp/avg_pp 집계) + noJob + recentChanges 추가
- **EVENTS admin 탭 빈 화면** 수정
  - 원인: `switchTab()` cats 배열에 `'worldevents'` 누락
  - 수정: cats 배열에 worldevents 추가
- **모바일 사이드바 잡아먹힘** 수정
  - 원인: `.panel-r/.panel-l` 모바일 open 상태 z-index 120 < `.mob-bottom-nav` 200
    → 사이드바 하단이 바텀 네비/FAB에 가려짐
  - 수정: 사이드바 z-index 250 (200 위, 모달 510 아래), `padding-bottom: safe-area + 110px`로 마지막 항목 스크롤 가능,
    `panel-close-fixed` z 260로 닫기 버튼 항상 위

- **하이젝 지불금액 0.00 PP 표시 + NPC 자동승리 +함대 미리보기 부재** 수정 (사용자 신고)
  - 원인: NPC가 점령한 영토는 `pixels.price = 0` (무료 점령) → `existing.price × HIJACK_MULT = 0`
    → "지불금액 0.00 PP" 표시 + 무료 하이잭 가능. 또한 "함대전 준비" 약속했는데 NPC에 함선 없으면 즉시 자동승리.
  - 수정 1: 하이잭 비용 = `max(existing.price, sectorBasePrice) × HIJACK_MULT` (4곳: client + server 3 path)
  - 수정 2: defender fleet lookup에 `HAVING alive_ships > 0` 조건 + 디버그 로그
  - 수정 3: hijack 모달에 상대방 함대 미리보기 (`/api/hijack/defender-info` 신규 endpoint)
    → "Fleet N개 · 살아있는 함선 M척 → 함대전" 또는 "함대 없음 → 자동 승리" 명시
  - 수정 4: admin에 "🔍 NPC 함대 진단" 버튼 (`/admin/api/fleet/npc-status`)
    → 현재 NPC들 중 함대전 가능 vs 자동승리 위험 분류 표시. 하이잭 정상 동작 검증 도구.

- **처음 로딩 시 모든 high-tier 섹터가 entry-blocked로 잘못 표시 + BASE 한번 누르면 정상화** — 사용자 신고
  - 원인: globe sector overlay 렌더링이 `document.getElementById('profileLevel').textContent` 로 user level 을 읽음. 이 DOM 은 BASE 모달 열 때 `loadBaseData()` → `renderBaseUser()` 가 채움. boot 시점엔 default '1' → 모든 entryMinLevel>1 섹터가 잠금 표시.
  - 수정: auto-login(`/api/auth/me` 성공) 시점에 `/api/user/:wallet/base` 미리 fetch → `profileLevel`/`profileLevelBadge` 채움 + 텍스처 재합성. 두 auto-login IIFE 모두 처리.
  - 효과: 페이지 처음 로드 직후 sector overlay가 정확한 잠금 상태로 그려짐. BASE 안 눌러도 정상.

- **거버너/사령관 자동 expire 로직 부재 + 옛 데이터 클리어 도구 부재** — 사용자 신고 ("아직도 수정 안된 듯")
  - 원인 분석: governor/commander 는 siege/admin replace 외엔 자동으로 사라지지 않음. 사용자가 "임기 끝났다"고 생각해도 DB 에 데이터 남아 있어 frontend 가 정확히 표시 중. 즉 캐시/렌더링 버그가 아니라 **expire 메커니즘 자체가 없어 admin 수동 클리어 도구가 필요한 상태**.
  - 추가 (admin endpoint 3개):
    * `POST /admin/api/governance/commander/clear` — commander_wallet/vice_commander_wallet/announcement 모두 NULL
    * `POST /admin/api/governance/sector/:id/clear` — 특정 섹터 governor/vice/announcement 클리어 + governance_positions 삭제
    * `POST /admin/api/governance/clear-all` — 전체 거버넌스 일괄 클리어 (claims/pixels 유지)
    * 모두 `__invalidateSectorsCache()` 호출 → 클라 즉시 반영
  - 추가 (admin UI):
    * GOVERNANCE 탭 헤더에 "🧹 사령관 초기화" + "🗑 전체 거버넌스 초기화" 버튼
    * 확인 dialog 후 실행, 토스트 알림

- **governor 교체 시 옛 sector announcement 잔존** — commander fix 와 동일 패턴, governor 측에도 동일 처리
  - 원인: `services/governance.js` 의 governor 교체 SQL 이 sector `announcement` 컬럼을 클리어 안 함. 새 governor 가 자기 메시지 올리기 전까지 옛 governor 메시지가 sector에 표시.
  - 수정: `UPDATE sectors SET governor_wallet=$1, governor_since=NOW(), announcement=NULL` — governor 교체 시 sector announcement 자동 NULL.
  - 추가: governor/vice_governor/sector announcement post 모든 경로에서 `__invalidateSectorsCache()` 호출 → 클라이언트 다음 polling/visibility 시 즉시 fresh.

- **commander 변경 시 옛 announcement 잔존** — 사용자 신고 ("커맨더 표시는 왜 남김?")
  - 원인: governance 서비스의 commander 교체 SQL이 `commander_wallet` 만 갱신, `announcement` 컬럼은 NULL 로 클리어 안 함. 새 commander 가 자기 메시지 올리기 전까지 옛 commander 메시지가 박스에 남음.
  - 수정: `UPDATE commander SET commander_wallet=$1, commander_since=NOW(), announcement=NULL WHERE id=1` — commander 교체 시 announcement 자동 초기화.
  - 추가: `loadCommanderBanner()` 에 visibilitychange + focus 리스너 추가 — 탭 복귀 시 즉시 fresh.

- **거버너/사령관 메시지가 변경 후 안 사라짐 + 페이지 두 번 로딩** — 사용자 신고
  - 원인 1 (텍스처 캐시): globe 의 governor 이름·자물쇠·tier 라벨은 `marsCanvasTexture` 에 그려져 GPU 캐시. `_sectorsData` 만 갱신해도 텍스처 재합성이 안 일어나 옛 governor 이름 그대로 남음.
  - 원인 2 (commander 박스): commander 가 임기 종료되거나 announcement 가 비어도 BASE > TERRITORY 의 announcement 박스가 숨겨지지 않아 옛 메시지 표시.
  - 원인 3 (이중 로딩): SW auto-reload 가 SW 업데이트 시마다 `location.reload()` 호출 → 사용자가 페이지를 두 번 로드.
  - 수정:
    * `refreshSectors()` 에 sector data diff 검사 + 변경 감지 시 `marsCanvasTexture/claimsSnapshot` 무효화 + `compositeClaimsOnTexture()` 재호출 → 텍스처 재합성으로 옛 라벨 사라짐
    * `toggleSectorOverlay()` 토글 ON/OFF 어느 쪽이든 무조건 refresh 후 텍스처 재합성
    * `loadCommanderBanner()`: commander 가 null 이거나 announcement 가 비면 박스 명시적으로 숨김 + textContent 비움
    * SW 등록 — auto-reload 제거. HTML network-first 로 다음 자연 nav 시 새 콘텐츠 자동 적용. 1시간마다 background `reg.update()` 만 수행 → 사용자에게 보이지 않음.

- **구매가능 섹터가 admin 변경 후 즉시 반영 안 됨** ("다른 창 열었다 닫아야 반영") — 사용자 신고
  - 원인 (서버): `routes/api.js`의 `_sectorsCache` 60초 TTL. admin 이 sector tier/price/entry-level 을 변경해도 60초 동안 옛 값 반환.
  - 원인 (클라이언트): `_sectorsData` boot 시 1회만 로드. BASE 모달 열 때(`loadBaseData`)에만 refresh → 사용자 입장에서 "다른 창 열었다 닫아야 반영"으로 보임.
  - 수정 (서버):
    * `invalidateSectorsCache()` 함수 + `global.__invalidateSectorsCache` 노출
    * `PUT /admin/api/sectors/:id` 변경 후 즉시 캐시 무효화
    * `POST /admin/api/setting/:key` 가 `price_pixel_*` 또는 `sector_*_min_level` 변경 시 무효화
    * `POST /api/governance/sector/:id/tax` 변경 후 무효화
  - 수정 (클라이언트):
    * `window.refreshSectors()` 함수 신규 (boot/주기/이벤트 모두에서 재사용)
    * 60초 polling refresh (서버 TTL 과 동일)
    * `visibilitychange`/`focus` 이벤트 시 즉시 refresh (탭/창 복귀 시)
    * `toggleSectorOverlay()` 활성화 시 즉시 refresh
    * `openClaimModal()` 호출 시 즉시 refresh — admin 가격 변경이 다음 클레임에 즉시 반영
  - 효과: admin 변경 → 최대 60초 (활동 사용자) / 즉시 (탭 복귀/모달 열기 시) 반영

- **iPhone 사이드바 stale 상태 (close 버튼 안 보임 + 사이드바 강제 열림)** — Service Worker 캐시 이슈 수정
  - 원인: `sw.js`의 `CACHE_NAME = 'mars-v3'` 가 옛 `index.html` 을 보존. iOS Safari 가 SW 캐시를 적극 활용해서 사용자 단말에 사이드바 옛 코드가 그대로 남음.
  - 수정:
    * `CACHE_NAME` `mars-v3` → `mars-v4` (activate 이벤트로 옛 캐시 자동 제거)
    * `STATIC_ASSETS` 에서 `/index.html` 제거 (pre-cache 안 함)
    * **HTML 문서는 NETWORK-FIRST 로 변경** (이전: cache-first 가능 분기) — 매번 fresh 받기
    * `index.html` 에 SW updatefound + controllerchange 핸들러 추가 — 새 SW 활성화되면 자동 1회 reload (`sessionStorage` guard)
    * `SKIP_WAITING` 메시지로 waiting SW 강제 활성화
  - 효과: iOS 사용자도 다음 방문 시 fix 자동 적용, 강력 새로고침 불필요.

- **태블릿 (iPad portrait 820px) 바텀 네비 두 줄 중복 렌더링** — 실제 페이지 렌더링 감사 중 발견
  - 원인: `.col-fab-wrap.show` 셀렉터가 `display:block` 강제 → 새로 만든 `@media(max-width:1024px) .col-fab-wrap{display:none}` (specificity 동일) 무시됨. 데스크탑 col-fab + 모바일 mob-bottom-nav 가 동시 표시되어 바텀이 두 줄로 보임.
  - 수정: `.col-fab-wrap, .col-fab-wrap.show { display:none !important }` + `#myLandBtn`, `.ops-launch-form`, `.ops-quick` 도 1024 이하에서 숨김
  - 검증: 820x1180 viewport 에서 mob-bottom-nav 단일 표시 확인.

- **iPhone/iPad 사이드바 자동 열림 + 글로브 안 보임** 수정 (iPhone 사용자 신고)
  - 원인: 기존 `@media(max-width:768px)` 만 적용 → iPad portrait(820px), iPhone Pro Max landscape(932px),
    Safari split-screen 등 769~1024px 구간에서는 데스크탑 레이아웃이 적용되어 panel-l(250px) + panel-r(250px) = 500px가
    좁은 화면을 채워 글로브가 안 보이고 양쪽 사이드바가 열린 것처럼 보임.
  - 수정:
    * 새 `@media(max-width:1024px)` 블록 추가 — 태블릿/내로우 데스크톱에서도 패널이 슬라이드 인/아웃 작동
    * `mob-toggle`, `mob-bottom-nav` 1024 이하에서도 표시 (사용자가 패널을 열 수 있도록)
    * 패널 폭: 768~1024 구간은 `min(360px, 70vw)`, 768 이하는 기존 `85% / max 320px`
    * DOMContentLoaded 시 `window.innerWidth ≤ 1024`면 panels의 .open 클래스를 강제 제거
      (브라우저 캐시/이전 세션 잔재 방어)
    * `.panel-tab` 1024 이하 숨김 (mob-toggle만 사용)
- **토스트 일관성 부족** 수정
  - 원인: `showToast` (중앙 그린 알약), `showFactionToast` (하단 블루 알약), `showNotification` (우측상단 카드) — 시각/위치/스타일 모두 제각각
  - 수정: 통합 `.toast` CSS (글래스 효과 + accent border, 색상만 type별 변경: success/error/warn/info),
    바닥은 `safe-area-inset-bottom + 110px`로 mob-bottom-nav 위 자동 배치,
    `showFactionToast` → `showToast` 위임, legacy type ('red'/'h'/'green' 등) 자동 정규화 호환

### 🐛 자가 진단 버그 수정 (테스트 중 발견)

- `/api/achievements`: `column "sort_order" does not exist` → `condition_value, key`로 ORDER BY 정정
- `/api/profile`: `column "avatar_color" does not exist` → migration 184로 컬럼 추가 (avatar_color, motto)
- `/api/branding/my, /api/spells admin`: `c.x1, c.y1, c.x2, c.y2` (없는 컬럼) → `center_lat, center_lng, width, height`
- `/api/resources/my`: `i.resource_code` (없음) → `JOIN resources r ON r.id = i.resource_id`로 정정
- `/api/raffles/active`: `:id` 라우트가 'active' 매칭 → `:id(\d+)`로 숫자만 허용
- **u.wallet JOIN 다수 (15개 서비스)**: `u.wallet → u.wallet_address`로 일괄 정정
  (prestige, tprestige, tombstone, graffiti, capsule, beacon, sponsor, highlight, journal, milestone, tdesc, polls, status, banner, vtag, tribute, donation 등)
- `/api/claims/my`: 누락 endpoint 추가 (expedition 영토 셀렉터용)
- `/api/burn/*`: 죽은 시스템 (gpBurn 삭제됨) → frontend UI 숨김 + loadBurnPanel no-op

### 🚀 기능 활성화 / 콘텐츠 확장

- **Fleet Combat 시스템 정합성** — `loadFleetPanel()`이 `/api/fleets`로 재배선됨
- **govBuildShip / govRepairShip / govUpgradeShip** UI는 `openShipyard()` / `openFleetCmd()` 모달로 redirect
- **업적 자동 트리거 와이어링** — claim/battle/marketplace/ship/guild/signup 6개 게임 이벤트
- **29개 업적 시드** — territory(5), combat(11), economy(7), social(6), 4개 언어 (ko/en/ja/zh)
- **Phantom 테이블 39개 일괄 생성** (migration 176~184)
- **907개 settings 키 시드** — admin이 모든 라이브 기능 조정 가능 (No Hardcoding 100%)

### 🧹 코드 정리 / 통합

- **dead 서비스 4개 삭제**: weeklyChallenges, gpBurn, bounty, luckyBox
- **dead 라우트 5개 삭제**: factionRoutes (v2), onboarding (v1), territoryRoutes, public, publicRoutes
- **legacy battle.js 일괄 제거** — schema mismatch + UI 제거 → Fleet + Hijack로 통합
- **betting v1 → warBetting v2 통합** — 단일 시스템, 5min/60s 중복 스케줄러 제거

### 🗄 DB 마이그레이션

| ID | 내용 |
|---|---|
| 176 | game_settings 호환 VIEW (legacy 코드 호환) |
| 177 | gp_activity_log + gp_transactions + colony_prestige + prestige_log |
| 178 | phantom 테이블 30개 일괄 생성 (territory_*, gp_*, raffles, contests 등) |
| 179 | lottery_rounds + lottery_tickets + gp_dividend_pool + planet_news |
| 180 | achievements + user_achievements + territory_rentals + rental_log + territory_upgrades + profile_change_log + tournament_entries (+ 14 업적 시드) |
| 181 | 88개 settings 시드 (prestige/news/branding/tdesc/tiers/donation/capsule/sponsor/beacon/status/tevt/polls/wager) |
| 182 | 78개 settings 시드 (monuments/spells/shield/staking/expedition/raffle/broadcasts/contest/crafting/achievements) |
| 183 | 29개 업적 (확장 15개) + 4개 언어 + cosmetic/enhancement 종류 |
| 184 | users.avatar_color + users.motto 컬럼 추가 |

### 📚 문서

- **AUDIT_FINDINGS.md** — 기능별 동작 매트릭스 신규 작성 (🟢/🟡/🔴 + 우선순위)
- **CLAUDE.md §13~16** — 신규 세션 핸드오프 정보 대폭 보강
- **핵심 서비스 헤더 주석** — hijack, rocket, prestige, tprestige (STATUS / Flow / DB / Settings)

### 📊 시스템 상태 (현재)

| 항목 | 값 |
|---|---|
| DB 테이블 | 219개 |
| Settings 키 | 907개 |
| 업적 | 29개 (4 카테고리, 4 언어) |
| 마이그레이션 | 156+ (~184) |
| Phantom 테이블 | 0개 |
| 누적 커밋 (이번 작업) | 22개 |

---

## 게임 시스템 요약

### 🟢 라이브 핵심
- 클레임/픽셀, GP/PP 경제, 하이잭, Fleet Combat, 공성전, 거버넌스, 마켓플레이스, 강화, 옥션, 로켓 드롭, POI, VIP, 일일 미션, 업적, PVP 베팅, 시즌 점수, 길드/수송, 날씨, Colony/Territory Prestige

### 🟢 보조 기능 (모두 admin 조정 가능)
- 영토 시스템: branding, descriptions, monuments, tiers, spells, events, sponsors, shields, rentals, upgrades
- 플레이어: status, beacons, capsules, banners, graffiti, tombstones, vtag, journals, ratings, milestones, highlights
- 경제/소셜: stakes, polls, wagers, art contests, donations, broadcasts, expeditions, raffles, lottery, dividends, news, crafting
- 메타: 토너먼트, 프로필 변경 로그

### 🟡 의도된 레이어드 아키텍처 (병합 불필요)
- chronicle + chronicleEnhanced
- title + titleExtended
- enhancement + enhancementAdvanced
- job + jobs (catalog + admin)
- resource + resources (admin + user)
- auction + auctionRoutes (ops + listing)
- tournament + tournaments (fleet + simple)
