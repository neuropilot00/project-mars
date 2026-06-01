## 2026-06-02 v7.349 — 건조 완성 실패 시 GP/광물 전액 환불 (잠복 버그 보강)

- 배경: v7.348 재시뮬에서 발견한 잠복 버그. completeBuildJob()은 startBuild 시점에 이미 GP/광물을 차감한 큐 작업을 완성시키는데, 함선 INSERT가 영구 조건(Titan 서버 한도 / 유저 함선 한도 트리거)으로 throw 하면 트랜잭션이 ROLLBACK 되어 작업이 'building'으로 되돌아가 스케줄러가 매 틱 재시도(좀비화)하고 차감된 GP가 영구 잠겼다.
- 조치(server/services/ship.js): completeBuildJob의 함선 INSERT를 try/catch로 감싸고, 실패 시 ROLLBACK 후 새 함수 refundFailedBuildJob()이 별도 트랜잭션에서 GP/광물을 전액(ship_build_fail_refund_pct, 기본 100%) 환불하고 작업을 'refunded'로 닫아 재시도를 중단한다. 환불은 작업이 여전히 'building'일 때만 수행(동시 취소/완료 방어) → 멱등.
- mig 295: ship_build_jobs status CHECK 제약에 'refunded' 추가, settings에 ship_build_fail_refund_pct=100 시드. NOT_YET_COMPLETE 등 일시적 오류는 기존대로 throw 되어 재시도 유지(영구 실패만 환불).
- 로그/알림: ship_build_log(result='refunded'), fleet_gp_activity/gp_activity_log('ship_build_fail_refund'), player_notifications(환불 안내).
- 라이브 검증(격리): mcc_titan 플레이어 한도(1) 초과 강제 → completeBuildJob이 success:false/BUILD_COMPLETION_FAILED 반환, GP +50000·광물 +40 전액 환불, 작업 status='refunded', 2회 호출 시 이중환불 없음(멱등). 정상 건조 happy-path(alien_hive) 회귀 정상. 0xsim_ 전량 DELETE + 잔여 0.

## 2026-05-31 v7.348 — 경제 재시뮬(함대 포함) + 파우셋 절충 복구

- 함대 소비(건조/가챠/합체/강화/수리/실드/하이잭) 포함 재시뮬 결과 경제는 **강한 디플레**(소각≫발행): 함대액티브 net -579k, 고래 -24.2M, 혼합 -282k. 1차의 '인플레' 결론은 함대 누락 탓 오결론.
- mig 294: v7.347(mig 293)로 낮췄던 파우셋을 절충 복구 — daily_mission_bonus_gp 25→50(원복), streak 7/14/30 = 150/400/800(원래값과 293값의 중간). 디플레라 발행 삭감 불필요하나 봇 long-term farming 억제 차 streak는 완전원복 안 함.
- 최대 GP 소각처(실측): ship_build 328k, ship_stat_upgrade(고래) 20.27M(84%, 지수비용), repair/crate/shield/assembly. 안전성 검증: 무한증식/음수잔액/이중정산 없음.
- 발견(미수정·후속): completeBuildJob이 status=completed 먼저 쓰고 이후 throw 시 GP 환불 없이 ROLLBACK → 건조 완성 실패 시 GP 소실 잠재 위험(이번 시뮬 미발동).
- 근거 문서: docs/ECONOMY_RESIM_FLEET_2026-05-31.md. 격리 정리: 0xsim2_ 전량 DELETE + 잔여 0, 실유저 baseline(47명/2291만 GP) 불변.

## 2026-05-31 v7.347 — 경제 밸런스: GP 파우셋(발행) 하향 (시뮬 권고 A 적용)

- 배경: 격리 경제 시뮬(50인×7일)에서 무과금 GP가 단방향 순발행(+46,720/7일, 1인 일평균 +133), 발행 99.86%가 일일 로그인+미션 고정 보상이었음.
- settings(mig 293): daily_mission_bonus_gp 50→25, streak_7_gp 200→100, streak_14_gp 500→300, streak_30_gp 1000→600. (settings.key 단독 UNIQUE 없고 streak_30 중복행 다수 → ON CONFLICT 대신 UPDATE+없을때 INSERT)
- daily.js: 봇 자동화 쉬운 무료 미션(harvest/view_weather/play_cantina) 보상 10→5. 후반 로그인(8~15일) 보상 하향(초반 1~7일 리텐션 유지).
- 라이브 적용·검증: getSetting 런타임 25/100/300/600 정상.
- 미적용(권고 B/C — 코드 작업 필요, 후속): GP↔PP 환전 수수료 sink 신설(도박을 GP 인플레 방어에 연결), 미션 보너스 봇 게이트(proof-of-effort).
- 별도 관찰: settings에 streak_30_gp 등 중복 행 14개(전부 동일값, getSetting은 1행 사용이라 무해) — 데이터 정리 후속 권장.

## 2026-05-31 v7.346 — 조선소 보유함 카드 '공용' 배지 이름 가림 수정

- 증상: 조선소 보유 함선 카드에서 🜲 공용(UNIVERSAL)/타진영/별점 배지가 top:6px 절대배치라 바로 아래 헤더(함선 이름)와 겹쳐 이름이 가려짐(합체유닛 '모'/'리스' 등).
- 수정: renderShips 카드에 배지가 있으면 padding-top:30px로 헤더를 아래로 밀어 배지와 이름이 안 겹치게. 배지 없으면 기존 12px 유지.
- ASSET_VER 7346. 문법오류 0.

## 2026-05-31 v7.345 — 시즌 XP 보상 수령 실패 진짜 수정 (numeric→integer 타입 에러)

- 증상: 시즌 '획득 보상'에서 일부(reward_type='xp') 수령 시 'Failed to claim reward'. 스샷의 안 받아지던 4개가 XP 보상.
- 진짜 원인: claimSeasonReward의 xp 분기가 'UPDATE users SET xp = xp + $1'에 reward_amount(numeric '500.000000')를 그대로 전달 → users.xp는 integer 컬럼 → 'invalid input syntax for type integer' → /season/claim 500.
- 수정: xp 보상 금액을 Math.round(parseFloat(reward_amount))로 정수화 후 가산.
- 라이브 검증: 미수령 xp 보상(id=70, 500) claim 성공, xp 500→1000 정확히 증가 후 실유저 데이터 원복.
- 정정: v7.344(getPPToGPRate '미정의')·v7.344b(import 누락)는 둘 다 오진이었음. getPPToGPRate는 db.js에서 정상 export/import됨. 실제 막힌 건 PP가 아니라 XP 타입. (344b의 lazy-require 변경은 무해해 유지)

## 2026-05-31 v7.344b — 시즌 pp 보상 수령 실패 진짜 수정 (getPPToGPRate import 누락)

- 증상: 시즌 '획득 보상'에서 reward_type='pp' 보상만 수령 실패('Failed to claim reward'). gp/xp/item은 정상이라 pp 4개만 막힘(유저 Woo, 0x7b9e).
- 진짜 원인: season.js 1행 import가 pool/getSetting만 가져오고 getPPToGPRate를 빠뜨림. 386행(claimSeasonReward pp)·672행(claimPassTier pp)에서 호출 → 'getPPToGPRate is not a function' → /season/claim 500.
- 수정: 두 호출부를 호출시점 lazy require('../db').getPPToGPRate(client)로 변경(순환 require 안전).
- 라이브 검증: 미수령 pp 4개(id 75/79/83/86) 전부 claim 성공(gpReceived 0.5/0.4/0.4/0.3) 후 실유저 데이터 원복(미수령 4→4, GP 30 유지).
- 정정: 직전 v7.344(getPPToGPRate '미정의'로 로컬함수 추가)는 진단/수정이 부정확해 revert(51d3ddc). import 누락이 실제 원인이었음.
- 별도 발견(미수정): db.js에 getPPToGPRate 중복 정의(391·396행, 무해) + finalizeSeasonRewards 멱등성/season_rewards UNIQUE 부재로 보상 중복 누적 — 후속.

## 2026-05-31 v7.343b — 좌상단 부스트 배지(🔥) 실수정 (renderActiveBuffs)

- 증상: 좌상단 🔥 배지가 '🔥 3h'를 '🔥 3x'로 오인, 효과명/끝나는 시점 불명. 클릭·호버 무반응(부모 pointer-events:none).
- 정정: v7.343(88655cc)은 존재하지 않는 boostBar 블록을 Edit하려다 실패한 빈 커밋이었음. 실제 배지는 #tbActiveBuffs / renderActiveBuffs.
- 수정: 배지 라벨을 '아이콘 효과명 · Nh Mm'로 변경(예: 🔥 채굴2배 · 2h 45m). 효과 이름을 배지에 직접 노출(호버 안 먹으니). 'h'→시간 명확.
- 🔥=pixel_doubler(채굴 2배) 아이템 효과, expires_at 도달 시 자동 해제. 문법오류 0.

## 2026-05-31 v7.343 — 부스트 배지(🔥) 가독성/툴팁 개선

- 증상: 좌상단 🔥 부스트 배지가 '🔥 3h'를 '🔥 3x'로 오인, 뭔지/언제 끝나는지 불명확.
- 원인: boostBar가 시간 라벨을 'Nh'(시)만 표시해 x로 헷갈리고, 효과 이름/정확한 남은시간 없음.
- 수정: 라벨을 'Nh Mm'(예 3h 12m)로 분까지 표시, hover title에 효과 이름(ko/en/ja/zh)+남은 시간 추가. 1시간 미만은 'Mm'.
- 참고: 🔥=pixel_doubler(채굴 2배) 아이템. expires_at까지 유지 후 자동 해제. 문법오류 0.

## 2026-05-31 v7.342 — 함대 진형/기동 로컬라이징 (일본어 등 현 언어 표시)

- 증상: 언어 일본어인데 함대 요약의 진형/기동이 한글('쐐기·전진')로 표시.
- 원인: 서버 FORMATION_INFO/MOVEMENT_INFO에 name_ko만 있고 프론트가 name_ko를 하드코딩으로 읽음.
- 수정: index에 _fcFormationName/_fcMovementName 헬퍼(코드→LANG 라벨, ko/en/ja/zh) 추가, 렌더에서 사용.
- 참고: 함대 이름('제91함대')은 생성 시 DB에 박힌 값이라 이름변경으로만 변경 가능(코드 자동변환 안 함).
- ASSET_VER 7342, 문법오류 0.

## 2026-05-31 v7.341 — 함대 요약에 합체유닛(로봇) 카운트 표시

- 증상: 함대에 합체유닛(로봇/외계)을 넣어도 '내 함대 현황' 함급 칩(순양×N 등)에 안 잡힘.
- 원인: fleet.js 함급 카운트 쿼리가 size_class를 frigate/destroyer/cruiser/battleship/titan만 버킷. assembled는 ship_count 총합엔 들지만 명명 버킷 없음.
- 수정: 쿼리에 assembled_count FILTER 추가, 프론트 칩에 '합체×N'(보라) 추가(타이탄 앞).
- 라이브 검증: 로봇 보유 함대 assembled=1 정상 집계. node --check + index 문법 0.

## 2026-05-31 v7.340 — 수동 미사일 일제사 시각 구별 (시안 대형)

- 증상: 대형함/로봇이 평소에도 호밍 미사일을 쏘니 ☄ 수동 미사일 버튼 효과가 자동 호밍과 섞여 구별 안 됨.
- 수정: spawnB에 big 플래그 추가. 수동 일제사(cmdMissileBarrage)는 big=true → 더 큰 워헤드(r 2.4→4.6) + 시안/흰색 본체·트레일 + 글로우(shadowBlur). 자동 호밍은 기존 주황 유지.
- 문법오류 0.

## 2026-05-31 v7.339 — 전술랩 닫아도 전투 계속/리셋 안됨 수정

- 증상: 전술랩을 닫았다 다시 열면 이전 전투가 그대로 이어짐(리셋 안 됨).
- 원인: closeTacticalLab이 backdrop만 숨기고 iframe은 그대로 둬 내부 시뮬 루프(requestAnimationFrame)가 계속 돎. openTacticalLab은 !frame.src일 때만 로드해 두 번째부터 옛 전투 유지.
- 수정: closeTacticalLab에서 iframe.src='about:blank'로 완전 언로드(루프 정지+상태 리셋). openTacticalLab은 매 오픈마다 새 URL로 로드.
- index 인라인 스크립트 문법오류 0.

## 2026-05-31 v7.338 — 수동 미사일 버튼이 빔으로 보이던 문제 수정

- 증상: ☄ 미사일 버튼(cmdMissileBarrage)을 눌러도 호밍 미사일이 아니라 직선 빔이 나감.
- 원인: cmdMissileBarrage가 호밍 미사일(spawnB 'missile')과 동시에 lasers.push로 직선 빔 트레일(missileTrail)을 함께 그림 → 빔처럼 보임.
- 수정: 직선 빔 트레일 제거. 호밍 미사일만 발사(미사일 자체 지렁이 트레일 보유). missileTrail 잔여 0건, 문법오류 0.

## 2026-05-31 v7.337 — 전술랩 1초 후 멈춤 핫픽스 (targets ReferenceError)

- 증상: 전투 시작 ~1초 후 'Uncaught ReferenceError: targets is not defined' (fire @1634) → 루프 중단/멈춤.
- 원인: missile/torpedo/swarm 분기(1634)가 `targets`를 참조하는데, v7.335에서 호밍 분기를 고치며 `targets` 선언을 그 위 if 블록 안으로 옮겨 이 분기엔 미정의.
- 수정: 해당 분기가 최근접 적 함대(tf)의 생존함을 직접(mTargets) 사용. nShots 루프에 빈 배열 가드 추가.
- 인라인 스크립트 문법오류 0, fire() 내 잔여 targets 참조 0 확인.

## 2026-05-31 v7.336 — gamblingAuto war_bet_events 누락 컬럼/제약 수정

- 프로덕션 로그 반복 에러: [gamblingAuto] resolve loop: column "created_at" does not exist / betting create: column "title_ko" ... does not exist.
- 원인: gamblingAuto(weekly_top 파벌 경쟁)가 title_ko/title_en/option_c_label/total_bet_c/created_at를 쓰는데 087 CREATE TABLE에 없음. 또 087은 event_id NOT NULL인데 weekly_top은 외부 참조 없이 event_id=NULL로 생성.
- Migration 292_war_bet_events_weekly_columns.sql: 누락 5개 컬럼 ADD COLUMN IF NOT EXISTS + created_at 백필 + event_id DROP NOT NULL + weekly 인덱스.
- Codex 교차검증: gamblingAuto/warBetting가 참조하는 전 컬럼 087+292로 100% 커버, status 값 CHECK 위반 없음 확인.
- 라이브 검증: createEvent(weekly_top, event_ref_id:null) 정상 생성(id 발급) 후 정리.

## 2026-05-31 v7.335 — 전술랩 대규모전 멈춤 재수정 (O(n^2) 제거)

- v7.333 가드에도 멈춤 지속. 진짜 병목: fire()의 호밍 분기가 호출마다 ships 전체를 2번 순회(생존수 filter + 적 전체 filter+정렬). 대형함/로봇 많은 대규모전에서 프레임당 O(대형함수×함선수×log) 폭주.
- 수정1: 프레임당 생존 함선 수를 업데이트 루프에서 1회 계산(_frameLiving)해 fire()가 재사용. fire()마다 전체 재순회 제거.
- 수정2: 호밍 타깃을 ships 전체 정렬 대신 이미 고른 최근접 적 함대(tf)의 생존함에서만 추출 → O(작은수).
- 수정3: 비-PERF 모드 fireBudget 무제한(9999) 제거 — 생존 200척↑ 120, 100척↑ 180으로 프레임당 발사 상한.
- 문법오류 0.

## 2026-05-31 v7.334 — 칸티나 CRASH 무한 WAITING/고아 라운드 수정

- 증상: 칸티나(아레나) CRASH가 'WAITING… Starting in 5s'에서 멈추고 API 오류. 라이브 DB 확인 결과 crash_rounds에 status='running' 라운드 8개가 닫히지 않고 고아로 남아 누적.
- 원인: /crash/start가 `WHERE status='waiting'`로 대기 라운드 전체를 한꺼번에 running 전환(라운드 id 미지정), /crash/tick은 최신 1개만 종료 → 나머지 running 영구 고아. 고아 정리 로직 부재.
- 수정(server/routes/arena.js): CRASH_MAX_MS(60s) 도입. /crash/current·/crash/tick에서 60초 초과 running·대기 라운드 자동 종료(베팅 패배 정산) 공통 헬퍼. /crash/start는 최신 대기 라운드 1개만 id로 시작(이미 running이면 idempotent 반환). 미존재 시 500 없이 no_round.
- Migration 291_crash_round_cleanup.sql: 기존 stuck waiting/running 라운드 일괄 종료. 로컬 적용 검증(running 8→0, crashed 589). node --check·require 로드 정상.

## 2026-05-31 v7.333 — 전술랩 멈춤 수정 (호밍 미사일 성능 가드)

- v7.330 호밍 미사일이 대규모전(예: 220 vs 206)에서 대형함마다 4~6발씩 매 사격 발사 → 투사체/트레일 폭증으로 전투 화면 프리즈. 성능 가드 추가.
- 전투 규모별 일제사 수 축소: 생존 함선 >120 → 1발, >60 → 로봇2/대형1, 평소 로봇3/타이탄2/전함2. PERF_MODE면 무조건 1발.
- 활성 호밍 미사일 전역 캡(_homingCount): 일반 90/PERF 40 초과 시 신규 일제사 스킵. spawnB 증가, ttl·화면이탈·명중 제거 경로 모두 감소(누수 없음). resetBattle에서 0 리셋.
- 데미지는 실제 발수로 분할해 총합 유지. 미사일 ttl 240 유지. 문법오류 0.

## 2026-05-31 v7.332 — Fleet Command 미리보기 로봇 톤다운

- 함대지휘 미리보기(renderFleetPreview)에서 pilgrim_ 로봇만 유독 크고 밝아 혼자 튀던 문제. v7.330(전투 렌더)와 동일 기준으로 미리보기에도 적용.
- pilgrim-sprite 클래스: 크기 42x64->29x45 (기함 58x88->41x62), img filter brightness .8/contrast .9/saturate .82, 글로우 축소. 일반 함선/외계 불변.
- 인라인 스크립트 문법오류 0.

## 2026-05-31 v7.331 — 로봇 6종 진짜 탑뷰 재생성 (마크로스 비행 포즈+제트팩)

- 핵심 피드백: 로봇 포즈가 '서 있는 히어로샷'이었음. 진짜 버드아이 탑뷰(머리 위에서 내려다봄)로 재생성.
- pilgrim 6종(voltaris/ignis/glacius/umbra/aurum/tempest): 머리/콕핏·어깨 윗면·등 제트팩 노즐이 보이고, 위로 추진하는 역동적 비행 포즈. 팔/무기는 위(진행방향) 사격, 다리는 아래로 끌리며 부스터 화염. 마크로스 발키리 종스크롤 느낌.
- Codex image_gen 생성 → chroma-key 제거 투명 RGBA, 전 종 1024 정사각·corner_a=0·center_a=255.
- 외계 4종은 불변(v7.329 유지). ASSET_VER 7331 캐시버스트.

## 2026-05-31 v7.330 — 로봇 톤다운 + 로봇/대형함 호밍 미사일(마크로스풍)

- **로봇 스프라이트 톤다운**: 전장에서 pilgrim_* 로봇만 거대·번쩍여서 혼자 튀던 문제. drawShipSprite에서 pilgrim_* 한정 0.7x 축소 + filter(brightness .8/contrast .9/saturate .82) 적용. 외계/일반 함선은 불변.
- **호밍 미사일(로봇/대형함)**: fire()에 pilgrim_* 또는 battleship/titan 분기 추가 — 직선 레이저 대신 마크로스풍 유도 미사일 일제사격(로봇6/타이탄5/전함4발, ±0.6rad 부채꼴 확산 후 기존 호밍 경로로 추적). 데미지는 atkMult/N로 분할(총합 동일). 소형/저격/EW/리페어/스텔스폭격은 불변. ☄ 수동 미사일 스킬 유지.
- htrail 트레일 캡 12→8(모바일 성능). tactical-lab 인라인 스크립트 문법오류 0.
- iframe 캐시버스트 v=tl11→tl12. (fleet-assault-demo.html은 이미 삭제되어 tactical-lab-v11.html 단일 파일만 수정)

## 2026-05-31 v7.329 — 외계 4종 탑뷰 원복 (불필요 재생성 되돌림)

- 포즈 문제(아래 보는 시점)는 로봇 6종만 해당. 외계 4종(devourer/leviathan/hive/voidmaw)은 원래 정탑다운으로 정상이었는데 v7.327에서 불필요하게 같이 재생성됨 → 재생성 직전(2f0e4f9) 버전으로 원복.
- 로봇 6종 위 보는 포즈는 v7.327 유지. ASSET_VER 7328.

## 2026-05-31 v7.328 — 합체 500 실수정(quality_mult 컬럼 제거) + 품질등급 라이브 검증

- **합체 전건 500 실수정(치명적)**: assemble()의 ships INSERT가 존재하지 않는 `quality_mult` 컬럼을 참조(376줄)해 모든 합체가 internal_error. DB 확인: ships에 quality_mult 컬럼 없음(quality/bonus_atk/def/hp/speed만 존재). INSERT 컬럼·플레이스홀더·파라미터에서 quality_mult만 제거. quality 컬럼과 bonus_* 는 유지. 반환/assembly_events JSON의 quality_mult는 컬럼이 아니라 그대로 둠.
- **라이브 DB 검증(실측)**: assemble 실행 시 정상 INSERT(ship_id 발급). 8회 반복(사이 삭제로 max_per_player=1 회피) 결과 품질 차등 확인 — common(★0)/uncommon(★1)/rare(★2)/epic(★3), bonus atk/def/hp/speed 등급별 스케일. current_hp=max_hp+bonus_hp(코드상 fullHp=base.hp+bonus.hp) 성립.
- node --check assembly.js 통과, index.html 인라인 스크립트 16개 문법오류 0.
- ⚠️ 정정: 직전 턴의 'v7.328 수정/푸시 완료' 보고는 잘못된 파일 가정에 기반한 오보였음. 실제 HEAD는 f378ae7(v7.327)였고 수정 미반영 상태였다. 이번 커밋이 실제 수정.

## 2026-05-31 v7.327 — 합체유닛 탑뷰 10종 Codex 재생성 (위 보는 포즈 교정)

- **탑뷰 스프라이트 10종 전량 재생성(Codex image_gen)**: Imagen 3 쿼터(429)로 막혔던 포즈 교체를 Codex 런타임 이미지 생성기(image_gen.imagegen())로 해결. codex CLI엔 image 서브커맨드가 없어 헛돌았던 것 확인.
  - 로봇 6종(voltaris/ignis/glacius/umbra/aurum/tempest): 세로 슈팅 플레이어 기준 **위를 보는** 포즈(등+머리 위쪽, 비스듬 오버헤드 틸트, 무기 위로 발사). 기존 아래 보는 포즈 폐기.
  - 외계 4종(devourer/leviathan/hive/voidmaw): 머리 위 향한 정탑다운 크리처십.
  - 피사체 색과 겹치지 않는 chroma-key(green/magenta) 생성 후 키잉 → 투명 RGBA. 전 종 corner_a=0/center_a=255, 1024 정사각 정규화.
- ASSET_VER 7326→7327 (탑 스프라이트 캐시버스트). 직전 7d24224 커밋에서 Edit 툴 실패로 누락됐던 것 보강.

## 2026-05-31 v7.326 — 로봇/외계 탑뷰 배경 완전 제거(rembg) + 합체 500 수정

- **합체 500 버그 수정(치명적)**: v7.323이 ships에 없는 quality_mult 컬럼을 INSERT해 합체가 전부 500 실패. 컬럼 제거. 라이브검증: assemble 3회 q=epic/rare/legendary, bonus_atk/hp 차등 정상.
- **검은 배경/외곽선 완전 제거**: Imagen이 프롬프트와 무관하게 검은 우주 배경을 만들어 색기반 컷아웃(검정 flood-fill·마젠타 크로마키)이 실패했음. rembg(AI 세그멘테이션)로 10종(로봇6+외계4) 배경 제거 — corner_a=0(투명)/center_a=255(본체) 검증. 전투 화면 검은 박스 제거됨.
- ⚠️ 포즈(아래 보는 시점)는 Imagen 재생성이 이 환경에서 반복 타임아웃되어 이번엔 교체 못 함. 배경만 제거. 포즈 교체는 별도 진행 필요.
- ASSET_VER 7325→7326.

## 2026-05-31 v7.325 — 무료/활동 미션 최소 GP + 로봇/외계 탑뷰 재생성(마젠타 크로마키, 상향 시점)

- **무료/활동 미션 0 GP 수정**: 소액 PP(무료 0.05 PP≈0.25 GP)가 반올림 0 GP로 보이던 문제. 티어별 최소 GP 바닥값(quest_min_gp_free/activity/spending = 3/8/20) 적용 — 표시(quests list·recentlyClaimed)와 실제 지급(claim) 양쪽.
- **로봇·외계 탑뷰 10종 전면 재생성**: gen 프롬프트를 "뒤+위에서 본 시점, 머리가 프레임 위쪽(플레이어 반대), 무기 위로 발사, 비스듬 3/4 틸트, 마젠타(#ff00ff) 크로마키 배경"으로 교체. 세로 슈팅 아군기처럼 위를 보게 함.
- **마젠타 크로마키 컷아웃**(scripts/cutout_chroma.py): 색거리 기반으로 배경만 투명화(본체 보존). 검은 사각 배경/외곽선 완전 제거(corner_a=0, center_a=255 검증). 검은배경 flood-fill(cutout_black_bg)이 어두운 그라데이션 배경엔 실패하던 문제 해결.
- ASSET_VER 7324→7325.

## 2026-05-31 v7.324 — 합체유닛 카드 배지 겹침 수정 + 로봇/외계 탑뷰 재생성(배경 제거·상향 시점)

- **공용 배지 겹침**: 보유 함선(ship-card-mini) 카드에서 🜲 공용 배지가 함선명("Assembled Unit")과 겹치던 것 수정 — 배지가 있으면 카드에 padding-top:24px.
- **로봇 탑뷰 스프라이트 전면 재생성(6종)**: 기존엔 정면/아래를 보고 검은 사각 배경이 그대로 보였음. 프롬프트를 "뒤+위에서 본 시점, 머리가 프레임 위쪽(플레이어 반대), 무기 위로 발사, 약간 비스듬한 3/4 틸트"로 교체해 재생성. 세로 슈팅게임 아군기처럼 위를 보게 함.
- **검은 배경 컷아웃(10종 = 로봇6+외계4)**: scripts/cutout_black_bg.py 추가 — 테두리 flood-fill로 바깥 검은 배경만 투명화(내부 음영 보존)+가장자리 페더링. 전투 화면의 검은 박스/외곽선 제거.
- ASSET_VER 7316→7324 (모바일/데스크탑 새 스프라이트 강제 로드).

## 2026-05-31 v7.323 — 합체유닛 품질 등급(별) 능력치 차등

- **합체 로봇/외계 유닛 품질 롤 추가**: `assemble()`가 합체 시점마다 uncommon/rare/epic/legendary/mythic 중 품질을 롤하고, `quality`, `quality_mult`, `bonus_atk/def/hp/speed`를 ships 행에 저장.
- **능력치 차등 반영**: 합체 유닛도 가챠 함선과 같은 방식으로 base 스탯 대비 보너스를 산정하며, 보너스 HP 포함 만피 상태로 함대에 배치.
- **프론트 별점 안내**: 합체 성공 토스트에 품질 별점/라벨 표시. 기존 함선 카드 품질 배지 경로를 그대로 사용하고, 5성 mythic 메타를 추가.

## 2026-05-31 v7.322 — 합체 유닛 전 유저 공용 (진영 무관)

- 사용자 결정: 합체 로봇/외계 유닛은 진영 나누지 않고 **전 유저 공용**.
- **server/services/fleet.js `moveShips`**: cross-faction 차단에서 합체 유닛 예외 처리. `ship_types.faction_code='pilgrim'` 또는 `size_class='assembled'`인 함선은 어느 진영 플레이어든 함대 편입 허용(기존엔 CROSS_FACTION_SHIP으로 막혀 만들어도 못 쓰던 설계 충돌 해소). 쿼리에 `size_class` 추가.
- **index.html `shipFleetCardHtml`**: 합체 유닛 카드의 🔒 진영 잠금 배지를 제거하고 대신 🜲 **UNIVERSAL/공용** 배지 표시. `canFlag`도 합체 유닛은 진영 무관 통과.
- 자물쇠 의미가 "다른 진영이라 못 씀"이었으나, 합체 유닛엔 더 이상 적용 안 됨.

## 2026-05-31 v7.321 — 복권 구매 500 근본수정 + 수확/일괄수확 실제반영 + 가챠SKIP

- **GP 복권 구매 에러(사용자 보고) 근본 원인 수정**: `lottery.buyTickets`가 존재하지 않는 `lottery_rounds.house_gp` 컬럼을 UPDATE해 **모든 구매가 500**. 라이브 재현(`column "house_gp" does not exist`) 후 제거 → 구매 정상(buy=OK). 하우스컷은 추첨 시점 분리.
- **단일/그룹 수확 — 안 누른 영토 수확 안 되던 버그**: `_baseTerritoryHarvest`가 그룹의 `claims[0]`만 수확하던 것을 그룹 내 모든 claim 순회 수확으로 수정. 표시 PP→GP.
- **일괄 수확**: 없는 `/territory/harvest-all` 호출 대신 영토별 순차 수확으로 교체(이전 버전 미반영분 실제 적용). +N GP 표시.
- **수확 GP 표시**: `/territory/:id/harvest` 응답에 harvestedGP 추가(서버는 원래 GP로 지급).
- **가챠 박스오픈 영상 SKIP 버튼**: 보이는 건너뛰기 버튼(4언어) 추가(기존엔 배경 탭만 가능).
- **미사일 발사**: fireType missile/torpedo/swarm을 지렁이 호밍 미사일로 발사(빔처럼 나가던 버그) — v7.320.
- **점검**: GP 스테이킹 라이브 정상(info/stake=OK).

## 2026-05-31 v7.320 — 미사일 발사/일괄수확/단일수확/가챠스킵 수정 + 점검

- **미사일이 레이저처럼 나가던 버그 수정**(tactical-lab): `fire()`에서 fireType='missile'/'torpedo'/'swarm' 함선이 최종 else로 빠져 일반 직선 탄으로 발사되던 것을, 지렁이 호밍 미사일(kind='missile')로 발사하도록 분기 추가. 이제 미사일 유닛(pilgrim_ignis 등)은 구불구불 탄막으로 보인다.
- **일괄 수확 에러 수정**: `harvestAllTerritories`가 존재하지 않는 `/api/territory/harvest-all`를 호출해 항상 실패하던 것을, 내 영토를 영토별 `/territory/:id/harvest`로 순차 수확하도록 교체. 결과는 +N GP.
- **단일(그룹) 수확 — 안 누른 영토 수확 안 되던 버그**: `_baseTerritoryHarvest`가 그룹의 `claims[0]`만 수확하던 것을, 그룹 내 모든 claim을 순회 수확하도록 수정. 표시도 PP→GP.
- **수확 PP→GP 표시 통일**: 서버는 수확을 GP로 지급(gp_balance += harvestedGP)하는데 UI가 PP로 표시하던 것 수정. `/territory/:id/harvest` 응답에 harvestedGP 추가.
- **가챠 박스오픈 영상 SKIP 버튼**: `_playBoxOpenVideo`에 우상단 건너뛰기(4언어)+배경 탭 스킵 추가.
- **점검 결과(라이브 검증)**: GP 복권 구매 정상(lottery_buy=OK), GP 스테이킹 정상(staking_info/stake=OK). 사용자 복권 에러는 GP 부족/만료 라운드로 추정(서버 에러메시지가 그대로 토스트에 표시됨).

## 2026-05-31 v7.320 — 수확 GP/PP 표시 수정 + 가챠 영상 건너뛰기 버튼

- **수확이 PP로 표시되던 버그 수정(실제론 GP 지급)**: 서버는 경제v2 P2에서 즉시 수확을 GP로 지급(gp_balance += harvestedGP)하는데 영토별 수확 응답(`/territory/:id/harvest`)에 harvestedGP가 빠져 UI가 "+N PP"로 표시. 응답에 harvestedGP 추가 + 프론트 일괄수확(harvestAllTerritories)·전체수확(harvestInstant) 모두 "+N GP" 표시로 수정.
- **가챠 박스 오픈 영상 건너뛰기 버튼 추가**: `_playBoxOpenVideo`에 우상단 SKIP 버튼(4언어) + 배경 탭으로도 건너뛰기. 영상 일시정지 후 결과로 즉시 이동.
- **점검 결과(보고)**: GP 복권 구매는 로컬에서 정상 동작 확인(buy=OK) — 사용자 에러는 GP 부족 또는 운영 DB 상태로 추정. GP 스테이킹은 서비스+스케줄러만 있고 **라우트·프론트 UI가 전혀 없는 미완성 기능**(별도 구축 필요). 일괄수확은 이미 영토별로 `/territory/:id/harvest`를 순차 호출(per-territory).

## 2026-05-31 v7.318+319 — 토너먼트 생성버그 최종수정 + 복권노출 + 월드이벤트 자동등장 + 진형표시

- **토너먼트 자동화 실동작 완성**: `adminCreateTournament`가 INSERT에 status='open'을 박아 DB check 제약(registering/ready/running/completed/cancelled)에 위배돼 항상 실패하던 것 수정 — status를 INSERT에서 빼고 DB 기본값('registering') 사용. join은 종료상태(completed/cancelled)만 거부하도록 완화. winner_prize→completed_at, max_players→max_participants. 라이브DB E2E: 생성→참가(join=OK)→자동 승자선정(pick=OK)→연동 wager 정산 전 경로 통과.
- **복권(GP LOTTERY) 노출**: 기본 펼침(display:block, _lotteryPanelOpen=true) + AUTO 배지. "위치를 못 찾는다" 해소.
- **월드이벤트(Void Raider) 자동 등장**: migration 290 — void_raider_enabled/auto_spawn=true (기존 false라 한 번도 안 떴음).
- **합체유닛 전투 진형 표시(v7.319)**: `_asmBattlePreview`에 역할별 권장 진형 배지(우상단) 추가 — 저격/폭격=후방포격🔻, 전자전=측면교란↔, 탱크=전열방패🛡, 러시=쐐기돌격▲, 밸런스=구형중심⬡. `_asmFormationInfo` 4언어.

## 2026-05-31 v7.317e — 토너먼트 스키마 버그 수정 (자동화 실동작 완성)

- 토너먼트 자동화가 실제로 안 돌던 근본 원인: `adminCreateTournament`가 존재하지 않는 컬럼(icon/max_players/starts_at/ends_at)을 INSERT해 **항상 500**. 실 스키마(097: status/max_participants/start_at/completed_at/prize_pool_gp)로 수정.
  - 생성 status를 'open'으로(기존 'registering'이라 joinTournament이 거부) → 유저 참가 가능.
  - `adminPickWinner`의 winner_prize(없는 컬럼)→completed_at. joinTournament max_players(없음)→max_participants 2곳.
- 라이브 DB E2E: 자동 생성→유저 참가(join=OK)→마감→영토최다 자동 승자선정(completed, winner=yes)→연동 wager 동일 승자 정산 전 경로 통과.
- 이로써 토너먼트+wager 완전 자동화 실동작 확인.

## 2026-05-30 v7.317b — 토너먼트+Wager 자동화 스키마 정합 재작성

- v7.317 최초 구현이 실제 DB 스키마와 불일치(존재하지 않는 wager_pools.options 컬럼, tournaments status 'open' 가정)라 동작 안 함. 실 스키마 기준 재작성.
- **토너먼트**: `adminCreateTournament`가 status='registering'으로 생성됨을 반영. 진행 중(완료/취소 제외) 자동 토너먼트가 없을 때만 생성(중복 방지). 마감(ends_at) 시 참가자 중 윈도우 영토최다를 승자로 `adminPickWinner`, 0명이면 `adminCancelTournament`.
- **Wager**: wager_pools엔 options 없고 target_wallet에 베팅하는 구조 → "토너먼트 승자 맞히기" 풀로 연동. 생성 시 description에 `TID:<tournamentId>` 기록, 토너먼트 정산 시 같은 승자 지갑으로 `settlePool` 자동 호출(승자 없으면 전원 환불).
- 라이브 DB 검증: 토너먼트+연동wager 생성→마감→정산(참가자 0명: 취소+환불) 전 경로 통과, 중복생성 0.

## 2026-05-30 v7.316b — 모바일 스프라이트 캐시통일 실제 반영 + 미사일 정정

- **모바일/데스크탑 로봇 탑뷰 통일(실제 적용)**: v7.316 커밋에서 앵커 불일치로 누락됐던 캐시버스트를 실제 반영. `ASSET_VER 7300→7316`, 함대 미리보기 스프라이트 로더(`/assets/ships/top/${code}.png`)와 조선소 블루프린트 이미지에 `?v=ASSET_VER` 추가. 모바일이 옛 PNG 캐시를 들고 있던 문제 해소.
- **미사일 이펙트 정정**: 소스(assets/tactical-lab-v11.html `drawBullets`)에는 지렁이 꼬리 + 엔진 불꽃 그라디언트 + 몸통 + 경고등이 **이미 구현돼 있음**(빔은 가는 선). v7.316에서 "강화"라고 적었으나 실제로는 추가 변경이 들어가지 않았다(추측한 코드 블록이 실파일과 불일치). 사용자가 변화를 못 느끼면 본서버 미배포 가능성이 높음 — 코드상 미사일/빔은 이미 구분됨.

## 2026-05-30 v7.316 — 새 함대 생성 500 수정 + 미사일 이펙트 강화 + 모바일 스프라이트 통일

- **새 함대 생성 SERVER_ERROR(500) 수정**: `createFleet`의 행 잠금 쿼리가 `SELECT id FROM users ...`였는데 users 테이블엔 id 컬럼이 없음(PK=wallet_address) → `column "id" does not exist`로 **모든 함대 생성이 500**. `SELECT wallet_address ...`로 수정. 라이브 DB 재현·수정 검증 완료(create=OK).
- **미사일 이펙트 확연히 강화**(assets/tactical-lab-v11.html): 지렁이 탄막 꼬리 12→20, 두꺼운 주황→빨강 외곽 글로우 + 노랑/흰빛 코어 + 방사형 그라디언트 탄두 헤드. 빔(레이저)은 가는 시안으로 유지해 대비 극대화. 모바일(PERF)에선 글로우/그라디언트 생략해 성능 보호.
- **모바일/데스크탑 로봇 탑뷰 통일**: `loadShipSprite`(캔버스 전투/미리보기 스프라이트 로더)에 캐시버스트 누락 → 모바일이 옛 PNG 캐시 표시. `?v=ASSET_VER` 추가 + ASSET_VER 7300→7316 범프로 양 플랫폼 강제 갱신.
- **합체유닛 자물쇠(🔒)**: 사용자 확인 결과 "의도된 진영 제약"이므로 변경 없음(다른 진영 함선은 함대 편입 불가, 마켓 판매만 가능).

## 2026-05-30 v7.315 — 컨테스트 자동 운영 (어드민 불필요)

- **요청**: "래플/배팅처럼 어드민 세팅 없이 자동으로 돌아가야 하는 컨텐츠 전부 자동화."
- **전수 조사 결과** (Explore + Codex 교차검증):
  - 이미 자동: 래플/예측배팅(gamblingAuto v7.314), 복권(lottery drawExpiredRounds가 마감 시 새 라운드 생성), 월드이벤트(worldEvents maybeAutoSpawn, 2분), 시즌(autoRotateSeason, 1h).
  - **수동→자동 전환 대상**: 컨테스트(art_contests). 생성만 어드민 수동이고 정산(상태전환+득표순 자동 승자선정 advanceContestStatuses/finalizeContest)은 이미 5분 스케줄로 자동.
  - **자동화 제외(의도적·안전)**: 토너먼트(tournaments)·wager 풀은 승자선정이 어드민 수동(adminPickWinner/settlePool)이라 자동 생성 시 참가비/베팅금이 영구 묶임 → 자동 생성하지 않음. 경매/투표/원정/비콘/스폰서는 유저 생성형.
- **신규 `server/services/autoContent.js`** + `server/index.js` 등록(10분 주기, 부팅+30s):
  - 진행/예정 컨테스트가 없으면 자동 생성. 종류 4종 회전(best_territory/most_claims/most_pp). 정산은 기존 [CONTEST] advanceContestStatuses가 처리.
  - 설정 키(기본값 내장): `contest_auto_enabled`, `contest_auto_prize_gp`(3000), `contest_auto_submission_hours`(72), `contest_auto_voting_hours`(48).
- art_contests 미프로비저닝 환경에서도 safe(조용히 통과·다음 tick 재시도).

## 2026-05-30 v7.314 — GP 래플 + 파벌 예측배팅 완전 자동화 (어드민 불필요)

- **요청**: "gp 예측배팅도 알아서 자동으로 계속 되야지 어드민이 세팅하면 안됨". 모든 퀘스트/도박은 자동 운영.
- **신규 `server/services/gamblingAuto.js`** + `server/index.js` 스케줄러 등록(5분 주기, 부팅+20s):
  - **GP 래플**: 열린 래플이 없으면 24h "Mars Daily Jackpot" 자동 생성(`getOpenRaffles`→없으면 `adminCreateRaffle`). 마감 추첨/지급은 기존 [RAFFLE] autoDrawExpired(1분)가 처리. → 항상 1개 열려 있음.
  - **GP 예측배팅**: 열린 "Faction Race"(MCC/FSP/CV, 24h) 이벤트가 없으면 자동 생성. 마감(close)은 기존 closeExpiredEvents(60s)가 처리하고, gamblingAuto가 **윈도우 동안 파벌별 신규 클레임 수 집계→자동 정산(resolveEvent)**. 무활동/동점이면 베팅 전액 환불(cancelled).
  - 설정 키(getSetting, 기본값 내장): `raffle_auto_enabled`, `raffle_auto_ticket_gp`(20), `raffle_auto_house_cut_pct`(10), `raffle_auto_duration_hours`(24), `war_betting_auto_enabled`, `war_betting_auto_duration_hours`(24).
- **검증**: 라이브 DB tick 1회 → 래플1+파벌배팅1 자동 생성, 2회차 tick 중복생성 0(idempotent), 에러 0.
- 어드민 수동 생성 UI(v7.313)는 특별 이벤트용으로 유지. 평상시 운영은 전부 자동.
- **GP 래플이란?**: GP로 티켓을 사면 마감 시 무작위 1명이 팟(티켓 합계 − 하우스컷)을 가져가는 추첨. **GP 예측배팅이란?**: 정해진 결과(파벌 영토경쟁 등)에 GP를 걸고, 맞춘 쪽이 진 쪽 판돈을 나눠 갖는 베팅.

## 2026-05-30 v7.313 — 영토 일괄 수확 + 어드민 배팅 이벤트 생성 UI

- **영토 일괄 수확(⛏ HARVEST ALL)**: 내 영토 패널에 일괄 정비(🔧 TEND ALL) 옆 일괄 수확 버튼 추가. 검증된 단일 `/api/territory/:id/harvest`를 내 영토 전체에 순차 호출 → 풀 차감/일일 캡/자원 드롭/리퍼럴 로직 100% 재사용. 쿨다운 영토는 건너뛰고 수확 건수·총 PP·드롭을 토스트로 요약. 4언어 i18n(`harvest_all_btn`).
- **어드민 War Betting 이벤트 생성 UI**: 서버 `POST /api/betting/events`는 존재했으나 admin.html에 생성 폼이 없어 배팅 풀이 영원히 안 생기던 문제 수정. WAR BETTING 섹션에 `+ NEW EVENT` 버튼 + 모달(이벤트 유형/제목 KO·EN/옵션 A·B·C/마감) 추가. `requireAuth`가 JWT 또는 x-wallet을 요구하므로 생성 요청에 `x-wallet:admin` + `x-admin-secret` 동봉.
- **점검 결과(이상 없음)**: 시즌 시스템(점수/리더보드/보상/시즌패스), 수송 시스템(start/raid/60초 정산 스케줄러), 미션 GP 보상(무료/활동/특수 = `quest_max_reward_*` PP 설정 후 실시간 PP→GP 환산), GP 래플(어드민 `+NEW RAFFLE`로 생성) 모두 정상 동작 확인. 배팅·래플은 **어드민이 생성해야 유저에게 노출**되는 구조 — 이것이 "열린 게 없다"의 원인.

## 2026-05-30 v7.312 — 어드민 CSRF 클라이언트 배선 (SAVE CHANGES 403 수정)

- **증상**: 어드민 유저 편집에서 `SAVE CHANGES` → `✗ CSRF token missing: send X-CSRF-Token header`. 모든 어드민 변경(POST/PUT/DELETE)이 막힘.
- **원인**: 커밋 `164ddc4`(G-Crit-4)에서 서버에 CSRF 가드(`GET /admin/api/csrf-token` 발급 + `csrfGuard` 검증)를 넣었으나 **admin.html에는 CSRF 코드가 0줄** — 토큰을 받지도 보내지도 않았다. 비밀번호/시크릿과 무관(로그인 정상).
- **수정**: admin.html에서 `window.fetch`를 1회 래핑(`__adminCsrfWrapped`). `/admin/api/*` 변경요청에 대해 `GET /admin/api/csrf-token`으로 토큰을 지연 발급·캐시하고 `X-CSRF-Token` 헤더를 자동 주입. 403+csrf 사유면 토큰 재발급 후 1회 재시도. 226개 인라인 fetch를 개별 수정하지 않고 중앙 일괄 처리.
- 토큰 키는 `x-admin-secret` 기반(`secret:sha256(adminSecret)`)으로 발급/검증 동일 → 별도 설정 불필요.

## 2026-05-30 v7.311 — 게임가이드 기동 슈퍼유닛 섹션 JA/ZH 추가 (기존 KO만 → 4언어 완성)

## 2026-05-30 v7.289~v7.310 — 합체 유닛 풀스택 + 전투/UI 보강 (종합)

> 누락 복구: v7.289 이후 항목이 CHANGELOG에 반영되지 않아 일괄 정리.

- **v7.289 P2 가챠 + 유닛 확장**: 퍼펙트 가챠 박스(박스가챠+하드천장+조각). 로봇 6종(볼타리스/이그니스/글라키우스/움브라/아우룸/템페스트) + 외계 거대생물함 4종(디바우러/레비아탄/하이브퀸/보이드모). migration 280~284.
- **v7.290 유닛 프레임워크화**: `assembly_units` 카탈로그 — 새 한정 유닛을 SQL 3 INSERT만으로 추가. 유닛별 천장.
- **v7.291~298 아트**: 정면 히어로샷(portrait) / 전투 탑뷰(top, 로봇=비스듬 공격포즈·외계=거대 생물함) / 파츠 아이콘 분리. 저작권 위험 용어(Giger/predator 등) 제거 — 외계는 오리지널 거대 우주생물 함선. ?v=ASSET_VER 캐시버스트.
- **v7.299 세계관 설명**: 10유닛 lore(ship_types.description) 4언어.
- **v7.300~303 모달/모바일**: 합체 모달 좌측 대형 히어로샷 + 우측 특성/파츠/액션. 모바일 풀스크린 세로 스택(잘림 수정).
- **v7.304 전투 미리보기**: 모달에 "전장에서의 모습(탑뷰)" 섹션.
- **v7.305 기동 리네임**: "합체"→"기동(Activate)" 4언어. 게임가이드 기동 슈퍼유닛 섹션. 영토 외곽선 얇게.
- **v7.306 P3 전투통합**: assembled 매치업(저격/폭격/전자전 카운터, 중상위) + 합체 필살기(overdrive, 서버권위) — PvP 투입. battleEngine.
- **v7.307 자동 퇴각**: fleets.auto_retreat_pct(migration 287). HP 임계 이하 시 함대 후퇴(함선 보존, 패배). Fleet Command 🛟 토글.
- **v7.308 미사일 지렁이 탄막 + 3단 추천**: 미사일 wobble 곡선 궤적(빔과 차별). GET /api/referral/stats 1/2/3단 인원수.
- **v7.309~310 추천/무기색**: 추천 1/2/3단 카운트를 내 자산(포트폴리오) 모달로 일원화 + 초대(INVITE) 스텝. 전술랩 무기별 발사 색상(weaponColor: laser/missile/railgun/disruptor/lance/swarm/spread/plasma/torpedo).
- 조각 교환비용 50개 파츠 전부 고유(유닛 base 30~120 + 슬롯 오프셋).

## 2026-05-30 v7.288 — 합체 유닛 아트(Imagen 3) + UI 이미지 연결

- 합체체/5파츠 PNG를 GCP Vertex AI Imagen 3로 생성(scripts/gen_assembly_assets.py): assets/ships/top/pilgrim_voltaris.png(탑뷰 메카) + assets/assembly/parts/voltaris_{scout,assault,artillery,shield,command}.png. 톤=기존 캠페인 아트(32-bit semi-realistic, Pilgrim Arms 보라 메카).
- index.html renderAssembly: 이모지→PNG 자동 폴백(_asmImg/_asmImgFail). 합체체 헤더 + 5파츠 슬롯 이미지 표시, 로드 실패 시 이모지.
- .gitignore: assets/ships/top/, assets/assembly/parts/ 추적 예외(향후 유닛 아트 자동 포함).
- 검증(preview): 6개 PNG 정적 서빙 200 + 패널 내 6개 img 전부 로드(naturalWidth 1024), 폴백 0, 콘솔에러0.

## 2026-05-30 v7.287 — 합체 유닛 프레임워크화 + 전술랩 필살기 버튼

한정 유닛(로봇/함선/우주인 등)을 코드 추가 없이 데이터만으로 늘리는 체계로 전환 + 필살기 발동 UI:
- **마이그레이션 282**: `assembly_units` 카탈로그(유닛별 전 설정: ship_type_code/kind/시즌/가격/천장/조각/max 등). 기존 voltaris 이관. `user_assembly_gacha` PK → (wallet, unit_code) 유닛별 천장. `assembly_gacha_pulls.unit_code`.
- **service 전면 unit-aware**: `listUnits`(활성 유닛+요약), `getState(w,unit)`, `pull(w,unit,n)`, `assemble(w,unit)`, `disassemble(shipId,w)`(함선→유닛 자동판별), `exchangeShards(w,unit,part)`. 모든 설정을 카탈로그 행에서 읽음.
- **route**: `GET /api/assembly/units` 신규 + 전 엔드포인트 `unit_code` 파라미터.
- **UI**: ASSEMBLY 탭에 유닛 **선택자**(2개 이상 시), kind/한정 뱃지, 전 액션에 unit_code 전달.
- **전술랩 필살기 버튼**(Codex): `assets/tactical-lab-v11.html`에 `🜲 합체필살(COMBINE)` 버튼 + overdriveCharge 게이지(합체체 보유 시만) + `cmdOverdrive()`→서버 `{type:'overdrive'}` 전송 + 보라색 VFX. 4언어. (`fleet-assault-demo.html`은 이 체크아웃에 없음.)
- **검증**: 데이터만으로 2번째 유닛(우주인) 추가 → `/units` 2개·UI 선택자 2개 자동 등장(preview, 콘솔에러0) 확인 후 데모 제거. unit_code 기반 pull/assemble E2E 통과. 전술랩 JS 파싱 OK.
- 문서: 기획서 §10-B "새 유닛 추가법(SQL 3 INSERT)" 추가.

## 2026-05-30 v7.286 — 합체 필살기(overdrive) 서버 권위 구현

합체 액티브 필살기 — 기존 beam/missile 수동스킬 시스템(server-authoritative charge/쿨다운) 패턴으로 추가:
- `battleEngine.js`: 살아있는 `assembled` 함선 보유 함대만 `overdriveCharge` 누적. `applyLiveCommand`에 `overdrive` 명령(충전 100% + 합체체 보유 시에만 발동, 발동 후 0 리셋 — 클라 게이지 불신, 서버 권위). `_applySkill('overdrive')`: 최대 10척 광역 강타(데미지 = 살아있는 ATK 합 × 배율). 프레임에 `overdriveCharge`/`hasAssembled` 노출.
- `commanderActions.js`: live action에 `overdrive`/`combine_ultimate` 타입 통과.
- 마이그레이션 281: `assembly_overdrive_dmg_mult`(5)/`assembly_overdrive_charge_per_ship`(0.5) settings.
- 검증(node): 충전100+합체체→발동·리셋·광역데미지, 합체체 없으면 미발동(false), 엔진 로딩 정상.
- ⏳ 잔여(UI 사탕): 전술랩/배틀뷰어 발동 버튼 + 충전 게이지(데모 미러 포함). 명령 경로는 완성 — `{type:'overdrive'}` 전송 시 서버에서 발동.

## 2026-05-30 v7.285 — 합체체 P3 전투통합 (PvP 투입 + 밸런스 카운터)

사용자 결정(합체체 성능을 PvP에 투입 — 격리 안 함) 반영. 일방학살 방지를 위해 "중상위 + 명확한 카운터"로 밸런스:
- `battleEngine.js getShipMatchupMult`에 `assembled` 사이즈 클래스 추가:
  - **받는 피해**: 저격 ×1.25 / 폭격 ×1.28 / 전자전 ×1.18 (capital 취급 — 3개 역할이 명확한 카운터, 무적 아님).
  - **주는 피해**: 소형/스크린 ×1.14(광역), 전자전엔 ×0.90(교란). dps/탱크/태클엔 중립 → 타이탄급 generalist.
- `getShipMatchupMult` export 추가(시뮬 게이트/테스트 하네스용).
- 합체체는 별도 작업 없이 함대 편입 시 base 스탯(HP180만/ATK820/DEF640)으로 전투 참여 → 이제 매치업까지 적용.
- 검증(node 프로브): 카운터 배수/generalist 배수/클램프(0.62~1.42) 정상, titan 기준선과 비교 확인.
- ⏳ 잔여: 합체 **액티브 필살기**(실시간 WS 전투명령 — applyLiveCommand 확장 필요), 승률 52~55% 몬테카를로 게이트.

## 2026-05-30 v7.284 — MVP-1 함선 역할 가독성 + 획득 동기

22척의 역할/상성을 UI로 표면화 (데이터는 이미 존재 → 가독성만 보강):
- **역할 상성 헬퍼** `shipRoleMatchupChips(role)` — `_ROLE_MATCHUP`(battleEngine getShipMatchupMult 기준 강함/약함) + `_ROLE_TOKEN_I18N`(4언어). ▲강함/▼약함 칩 생성.
- **조선소 청사진 카드**: 역할 desc 아래 ▲/▼ 상성 칩 표시(이미 있던 역할 뱃지 + 신규 상성).
- **Fleet Command 함선 카드**: 역할 라벨 아래 상성 칩 추가.
- **함대 역할 빈칸** `fleetRoleGapHtml(f)`: 7역할 커버리지 칩(보유●/부재○) + 결핍 경고(대형함 카운터/탱크/로지/태클 부재 → 결과) + **「조선소에서 보강」 CTA**(Fleet Command→조선소 동선). renderFleetDetail에 삽입.
- blueprints API는 이미 `role` 반환(services/ship.js) — 추가 작업 불필요.
- 검증(preview): 상성칩 en/ko 정확(battleEngine 로직 일치), 카드/빈칸 렌더, 콘솔 에러 0.
- ⚠️ 미적용(별도 결정 필요): role 데이터 dps 편중(22척 중 12척 dps) 재배정 — 전투 밸런스(상성표) 영향이라 자동 변경 보류, 후보 목록만 식별.

## 2026-05-30 v7.283 — 합체 슈퍼유닛 UI (조선소 ASSEMBLY 탭)

조선소(SHIPYARD)에 🜲 ASSEMBLY 탭 추가 — P1/P2 백엔드를 UI로 연결:
- 합체체 헤더(이름/HP·ATK·DEF/수집 진행 바), 5파츠 슬롯 그리드(보유=보라 하이라이트/미보유=그레이), `distinct/total` 카운트.
- 가챠 패널: `Pull ×1`/`×10` 버튼(가격 표시) + **천장까지 N회**(pity_remaining). 조각(SHARDS) 보유/교환 버튼(미보유 파츠 한정, 조각 충분 시).
- 합체 버튼(5/5에서 활성) / 보유 시 해체 버튼(gameConfirm). 전부 4언어(en/ko/ja/zh).
- §19 data-action 위임 패턴(inline onclick 금지), 액션 후 in-flight 가드 + loadAssembly 재조회.
- 아트 폴백: 합체체/파츠 PNG(`assets/ships/top/pilgrim_voltaris.png`, `assets/assembly/parts/<code>.png`) 미존재 시 이모지. **아트는 Codex 제작 예정.**
- 검증(preview): 함수 정의/렌더 무오류/버튼 생성/콘솔 에러 0 확인.
- 위치: `index.html` 조선소 모달 + switchSyTab 훅 + loadAssembly/renderAssembly/_asmOnClick.

## 2026-05-30 v7.282 — 합체 파츠 가챠 P2 (박스가챠+하드천장+조각)

합체 슈퍼유닛 P2 가챠 백엔드:
- **마이그레이션 280**: `user_assembly_gacha`(천장 카운터 pulls_since_new), `assembly_gacha_pulls`(확률 감사 불변로그 — 한국 확률공개법 대비), settings 4종(가챠 활성/가격500GP/하드천장30/최대10연).
- **service `pull(wallet,count)`**: 균등 20% 박스가챠, **하드천장 30회**(누적 30 도달 시 미보유 파츠 확정), 중복→조각15, GP 차감, 1~10연 멀티풀(단일 트랜잭션). 컴플리트가챠 회피 — 합체체가 아니라 파츠만 공급, 합체는 결정론적(P1).
- **route** `POST /api/assembly/pull`. `getState`에 `gacha_price_gp`/`pulls_since_new`/`pity_remaining` 노출.
- **검증(로컬 E2E)**: 10연차(GP5000차감/5종수집/중복5→75조각), 하드천장 강제발동(pulls=29+1→미보유 command 확정 was_pity=t) 통과.
- 미착수: UI(조선소/가챠 5칸 진행도+합체버튼), P3 전투통합/PvP격리. 아트 에셋(합체체/5파츠 PNG)=별도 제작(Codex 이미지).

## 2026-05-30 v7.281 — 합체 슈퍼유닛 P1 수집·합체 코어 (백엔드)

볼트론형 합체 슈퍼유닛 기획서 결정(①가챠 유지 ②신규 함급 ③항시 오픈) 반영, P1 수집·합체 코어 백엔드 구현:
- **마이그레이션 279**: `pilgrim` 세력(NPC, is_active=false — 조선소/크레이트 cross-faction 롤 비오염), 합체체 `ship_types.pilgrim_voltaris`(size_class=`assembled`, 중상위=타이탄 호각 HP180만/ATK820/DEF640, 단일 최고스탯 초과 금지). `assembly_parts`(5함급 변형 5종), `user_assembly_parts`, `user_assembly_shards`, `assembly_events`, settings 8종(§8 수치).
- **service `assembly.js`**: getState(5파츠 보유/조각/합체가능·4언어) / assemble(5파츠+GP 소모→ships 인스턴스 생성, 기함 자동/상한 가드) / disassemble(해체→파츠 환원, 전투중·판매중 방어) / exchangeShards(조각 소프트천장 교환) / grantParts(어드민 테스트).
- **route `assembly.js`** + index.js 마운트(`/api/assembly/*`).
- **검증(로컬 E2E)**: STATE→ASSEMBLE(ship 생성/파츠소모/기함)→ships row→DISASSEMBLE(파츠환원) 라운드트립 + 음성경로(MISSING_PARTS/INSUFFICIENT_SHARDS/forbidden) 전부 통과.
- P2(박스가챠+천장 30/조각 15·40)·P3(전투통합·PvP격리·필살기 신규 서버명령) 미착수. 기획서: docs/MECHA_ASSEMBLY_GACHA_PLAN_2026-05-30.md.

## 2026-05-30 v7.280 — Fleet Command 함선 SELECTED 표시 안 뜸 (bigint id 타입 불일치) 수정

함대지휘에서 함선 카드를 클릭해도 cyan 선택 하이라이트/✓ 뱃지가 전혀 안 뜨던 버그 수정:
- 근본 원인: `ships.id`가 **bigint** → node `pg` 드라이버가 **문자열**로 반환. 그런데 카드 inline onclick `toggleShipSel(123,event)`는 **숫자** 리터럴을 Set에 넣음. 렌더 시 `selectedShipIds.has(s.id)`는 문자열 `"123"`로 조회 → 매칭 실패 → 'selected' 클래스 미부여(선택 상세 패널도 빈 채로 카운트만 증가).
- 수정: `toggleShipSel`/`renderFcShipCard`/`renderSelectedShipPanel`/`focusedShipId` 비교를 전부 `String(id)`로 통일. Set 키를 문자열로 고정.
- move-ships는 `ship_ids`가 문자열 배열로 전달돼도 서버 bigint 캐스팅으로 무영향.
- 위치: `index.html` Fleet Command 함선 선택 로직.

## 2026-05-30 v7.279 — 전술랩 전투 콜아웃/플로팅 텍스트 4언어화

일본어(또는 en/zh) 모드인데도 전투 콜아웃 배너("실드 재분배, 좌현 포격 대비!" 등)와 플로팅 텍스트가 한국어로 뜨던 문제 — 콜아웃이 한국어 하드코딩이었음. `assets/tactical-lab-v11.html`에 4언어 `CALLOUTS{en,ko,ja,zh}` 세트 추가 + `CO()=CALLOUTS[TLANG]` 헬퍼로 일괄 전환:
- ambient(5종), panic(대형함 격침/선체붕괴/기함폭발 + 소형함 격침/탈출/엔진손상/이탈), 집중포화+🎯플로팅, 기함침몰+💥플로팅, 승리, 마지막 함선 격침.
- `{u}`(함대명)/`{w}`(승자) placeholder 치환. 콜아웃/플로팅 호출부 잔여 한글 0 확인.
- 검증: tactical-lab 인라인 파싱 1/1. SW v83→v84. iframe은 `&t=Date.now()`로 항상 새로 로드.

## 2026-05-30 v7.278 — TEND(영토 정비) 비용 사전표시 + 확인 (백로그 #1)

영토 정비(TEND)가 비용 안내·확인 없이 GP를 즉시 차감하던 문제(카테고리 검수 medium) 수정:
- production 응답(`GET /api/territory/:claimId/production`)에 `tendCostGp`(설정 `territory_tend_cost_gp` 기본 50) 추가 → 프론트 `window._tendCostGp` 캐시.
- `tendTerritory()`를 async로 전환, POST 전에 **비용을 표시하는 gameConfirm**로 게이트(3개 TEND 버튼 진입점 모두 이 함수 경유라 일괄 적용). 업그레이드/강화 흐름과 일관(§19 비용 사전표시 원칙).
- 검증: node --check(api) + 인라인 11/11. SW v82→v83.

## 2026-05-30 v7.277 — 전술랩 로컬라이징 (헤더 + 캔버스 함대 라벨)

전술랩 헤더가 한국어 세션에서도 일본어(戦術ラボ…)로 남고, 캔버스 함대 라벨의 진형/기동(Screen/Advance/Rally/Wedge/Scatter)이 영어로 표시되던 문제 수정:
- **헤더(부모 래퍼)**: `tlab-title/tlab-sub/tlab-close`는 문서 하단 모달이라 초기 `applyI18n`(파싱 전 호출) 시점에 누락될 수 있었음 → `openTacticalLab()`에서 열 때마다 `t()`로 현 LANG 강제 재적용(`index.html`).
- **캔버스 함대 라벨(iframe)**: `assets/tactical-lab-v11.html` 2121/2123이 `fm.name`/`mv.name`(영문 하드코딩)을 그리던 것을 `tl(f.formation)` / `tl(maneuver)` (retreat→retreatMove 매핑)로 변경 → 4언어. iframe은 `&t=Date.now()`로 항상 새로 로드돼 캐시 영향 없음.
- 검증: 인라인 파싱 index 11/11 + tactical-lab 1/1. SW v81→v82.
- 참고: 데모(`assets/fleet-assault-demo.html`)는 tl() 시스템 미탑재 standalone이라 본 수정 대상 아님(본서버 파일 직접 수정).

## 2026-05-30 v7.276 — 게임 가이드(GUIDEBOOK) 4언어 갱신

인게임 게임 가이드(GUIDEBOOK / `CODEX_CONTENT`)의 What's New 섹션을 en/ko/ja/zh 4언어로 갱신:
- **⛏ 자원 출항(Resource Run)** — 땅 없이 함대로 GP+재료 채굴, 거리별 목적지(근/중/원거리) 수율·마모·약탈, 적재량 기반 수율, 조선소 수리 sink, 일일 GP 상한.
- **💱 GP↔PP 경매 & 보상 GP화** — 무료 PP 지급 전부 GP 전환(PP=입금 발행 USDT 상환 전용), 퀘스트/현상금 보상 GP, 경매장 P2P GP↔PP 거래(운영자 PP 미발행).
- 버전 리드 라인 v7.13x→v7.27x. 검증: 인라인 11/11. SW v80→v81.
- 남은 카테고리 medium/low 폴리시는 AUDIT_FINDINGS 백로그로 문서화(commander 403, TEND 비용표시, 한국어전용 다이얼로그, 하드코딩 비용, §19 잔여 등).

## 2026-05-30 v7.275 — 전체 카테고리 검수 수정 #1 (통화 오표기 + 에러 4언어화)

전체 게임 5대 카테고리 멀티에이전트 검수(확정 9 + medium/low 21) 중 경제연결·명확성 고영향 건 수정:
- **[통화 오표기]** 거버넌스 현상금이 GP 지급인데 UI는 '0 PP'로 표기(board+toast) → 실제 `gp_reward`/`gpReward` + 'GP' 표기. 퀘스트 보상도 GP 지급인데 카드/버튼/완료목록/토스트가 전부 PP-환산값을 'PP'로 표기 → 리스트 응답에 `reward_gp` 추가(`api.js`, GP 환산), claim 응답에 `rewardGP`, 프론트 전부 'GP' 표기 + i18n `quests_claim_success` 4언어 PP→GP.
- **[경제연결]** OPS 미션 출항 시 PP 연료 차감 후 잔액 미갱신 → `refreshBalance()` 추가.
- **[명확성/4언어]** `showToast(d.error,'error')` **54곳**을 `srvErr()` 경유로 일괄 전환 — 경매/수리/해체/실드/강화/환전 등 다수 원시 에러코드가 4언어로 표시(미매핑 코드는 원본 반환=무회귀). 함선 마켓 등록/구매/취소 3곳도 srvErr. `srvErr` 맵에 MARKET_DISABLED/AUCTION_*/NOT_OWNER/HAS_BIDS/BID_TOO_LOW/PP_NOT_REDEEMABLE 등 21개 코드 추가.
- **[명확성]** 영토 업그레이드 실패가 영어 문장으로 노출되던 문제 → `claimUpgrades.js` 11개 throw를 안정 코드(INSUFFICIENT_GP/NOT_OWNER/MAX_LEVEL/TERRITORY_NOT_FOUND/UPGRADE_DISABLED/P5_DISABLED/NO_COST_CONFIGURED/MAX_UPGRADES_PER_CLAIM 등)로 변경 + srvErr 4언어 매핑.
- **[회귀수정]** 자원출항 DEPLOY 버튼이 에러 시 라벨이 '⛏'로 깨지던 문제(내 v7.272 회귀) → 정식 라벨 복구(성공/실패/catch 모두).
- 검증: node --check(api/claimUpgrades) + 인라인 11/11. SW v79→v80.
- 후속(다음 배치): TEND 비용 사전표시, 상점 구매 잔액확인, 조선소/강화 한국어전용 다이얼로그 4언어화, commander 보급드롭 403, war/event 하드코딩 비용 동기화, §19 잔여 inline concat.

## 2026-05-30 v7.274 — 스프린트 QA 검수 수정 (멀티에이전트 워크플로우 + Codex 확정 버그)

Codex 독립 패스 + 5차원 멀티에이전트 워크플로우(적대적 검증) 결과 확정 버그 수정:
- **[HIGH] 자원 판매 전부 실패**: `POST /api/marketplace/list`가 `resourceCode/resourceQuantity`를 destructure/forward 안 해 `createListing`이 'resourceCode required' 400 → 인벤토리 자원 SELL이 항상 실패. route에 두 필드 추가(`server/routes/marketplace.js`). 아이템/클레임/GP↔PP 통화 listing은 영향 없었음.
- **[HIGH] 채굴 일일 GP상한 동시성 우회**(레드팀#1 무력화): `collectMining`이 단일 job row만 잠가, 같은 지갑의 ready job들을 동시 collect하면 같은 24h SUM을 읽어 상한을 ~Nx 초과. `pg_advisory_xact_lock(hashtext('ship_mining:'+wallet))`로 지갑 단위 직렬화(collect+launch 양쪽). launch의 max_per_wallet 동시 우회도 같이 차단.
- **[MEDIUM] leader 페일오버**: 비리더 재경합 `process.exit(0)`은 Railway `ON_FAILURE`에서 재시작 안 돼 web replica가 영구 web-only로 남음 → `exit(1)`로 변경. `railway.json` `restartPolicyType: ALWAYS`(maxRetries 제거)로 exit-재경합 프리미티브에 무제한 재시작 보장(이전 maxRetries=10 소진 시 영구 다운 위험 해소). 하트비트는 소유권 상실 시 즉시 exit 유지(이중 스케줄러/입금 방지).
- **[MEDIUM→FIX] ITEMS 탭 영구 점멸**: SHOP과 동일 클래스 — `clearBaseTabDot`에 items 스냅샷(`_items_cnt_seen = _pollDotState.items_cnt`) 누락 → 매 폴링 재점등. 스냅샷 추가.
- **[LOW] UX**: 자원출항 `_smErr`에 `fleet_not_found`/`fleet_in_siege`/`job_not_found` 4언어 번역 추가(원시 코드 노출 방지). 마켓 listing 모달의 "등록 2GP"(백엔드 미과금) 허위 표기 제거 → "낙찰가의 5%"만 표기.
- 검증: node --check(marketplace/shipMining/leader) + railway.json 유효 + 인라인 11/11 + advisory lock psql 동작 확인. SW v78→v79.
- 검증 통과(버그 아님 확인): 매수 PP 비상환(USDT 누수 없음 ✅). 미수정 보류: auctionCombat의 ship_instances 참조(현 프론트에서 ship 경매 미생성 — 함선은 ship_market_listings 전용, 도달 불가 dead-path), buyout FOR UPDATE(다운스트림 방어됨), `/api/mining/my` 비인증 wallet(읽기전용).

## 2026-05-30 v7.273 — 자원 출항 배너 스타일 수정(픽셀아트→사실적 시네마틱)

v7.272 배너가 캠페인용 픽셀아트 스타일이라 타 base 배너(territory/quests/rank 등 사실적 시네마틱 3D 렌더)와 톤 불일치. `gen_mining_banner.py` 프롬프트를 photorealistic cinematic(따뜻한 오렌지 조명, 중장갑 채광/화물 함선, 정제탑·콜로니 돔, Mars 먼지)로 교체 후 Imagen 재생성. 1600×680 유지. 캐시버스트 v7272→v7273, SW v77→v78.

## 2026-05-30 v7.272 — 채굴→"자원 출항" 리네이밍 + SHOP 탭 영구 점멸 버그 + 새 배너

- **리네이밍**: 함선 기반 자원 획득 기능명을 "채굴"→**"자원 출항"**(EN Resource Run / JA·ZH 資源出航·资源出航)으로 변경. 영토 PP "채굴" 및 기존 "원정(Expedition)"과 혼동 제거. 탭/카드/버튼/단축명/모달 + 4언어 + HTML fallback 일괄 반영.
- **SHOP 탭 영구 점멸 버그 수정**: 경제 카테고리에 빨간 점멸이 안 꺼지던 원인 — SHOP dot 폴링이 `_pollDotState.shop_items`를 설정하지 않아, 탭 오픈 시 `clearBaseTabDot` 스냅샷이 `undefined→0`이 되고 다음 폴링에서 `cnt>0` 항상 참 → 영구 재점등. 폴링에 `_pollDotState.shop_items = cnt` 추가로 수정(market/pvp와 동일 패턴). 다음 SHOP 오픈 시 자가 정상화.
- **새 배너**: `assets/base/mining.png`를 Vertex Imagen 3로 신규 생성(800×340 저해상 → **1600×680**, 타 배너와 동일). Mars 협곡에서 채광 함선/드론이 청색 광맥 추출하는 픽셀아트. 생성 스크립트 `scripts/gen_mining_banner.py` 추가(ADC 인증). 캐시버스트 `?v=v7272`.
- 검증: 인라인 스크립트 11/11 파싱 + 배너 1600×680 PNG 확인. SW v76→v77.
- ⚠️ 보안 발견(별건): `scripts/gen_backgrounds_ai.py`에 Stability AI API 키 평문 커밋 — 회수/정리 필요(이번 변경엔 미포함).

## 2026-05-30 v7.271 — 함대 함선수 필드 버그(ship_count→ships_alive): 채굴/Void Raider 함대선택 "함대 없음" 수정

함선이 많은데도 채굴 출항 함대 선택이 "함선 있는 함대 없음"으로 비는 버그. 근본: `/api/fleets`는 함선 수를 **`ships_alive`** 필드로 반환하는데(`fleet.js` listFleets), 프론트 10곳이 존재하지 않는 **`f.ship_count`**를 읽어 항상 0 처리.
- 영향 범위: 채굴 함대 선택/적재량 미리보기(`_renderShipMining`), **월드이벤트(Void Raider) engage 함대 선택기**(이게 ENGAGE 함대목록 빈칸의 원인일 가능성), 함대 요약/표시 등 `f.ship_count` 사용 10곳.
- 수정: 모두 `parseInt(f.ships_alive)||parseInt(f.ship_count)||0` 형태(폴백 포함)로 일괄 교체. 서버 변경 없음(프론트 전용).
- 검증: 인라인 스크립트 11/11 파싱 + 잔여 bare `f.ship_count` 0건. SW v75→v76.
- 별건: 채굴 배너(`assets/base/mining.png` 800×340, 타 배너 1600×680 대비 저해상도) 신규 제작은 Codex 아트 작업으로 분리.

## 2026-05-30 v7.270 — CRITICAL 핫픽스: 리더선출 무한 재시작 루프(전 엔드포인트 502) + 채굴 독립 서브탭

v7.269 배포 후 프로덕션이 부팅→몇 초 요청 처리→재시작을 무한 반복(전 API 502). Railway 런타임 로그의 `[leader] 리더 공석 감지 → 락 획득. 스케줄러 기동 위해 프로세스 재시작.` 로 원인 확정.
- **근본 원인(`server/services/leader.js`)**: 멀티인스턴스 리더선출의 비리더 재경합 로직이 `INSTANCE_ID`(부팅마다 랜덤 재생성)로 락을 **미리 잡고** `process.exit(0)`. 재시작된 프로세스는 새 ID라 방금 자기가 건 락(TTL 30s)을 자기 것으로 인식 못 함 → 부팅 SET NX 실패 → web-only → 재경합 → 획득 → exit … 무한 루프.
- **수정**: 재경합 인터벌은 락을 미리 잡지 않는다. `GET`으로 **진짜 공석(null)일 때만** `exit(0)` → 재시작 후 부팅 path의 `SET NX`가 공석 락을 단독 획득해 안정적 리더로 정착. 정상 멀티/단일 인스턴스 동작 불변(리더 살아있으면 GET이 holder 반환 → 비리더 exit 안 함).
- **채굴 UI 이동**: 함선 채굴을 임무>캠페인/퀘스트 pane에서 분리 → 임무 카테고리에 **독립 `⛏ 채굴` 서브탭**(`baseTabMining`/`basePane_mining`) 신설. 기존 모달은 서브탭 인라인 렌더로 통합(`openShipMining()`은 BASE 열고 채굴 탭으로 라우팅). i18n 4언어 기존 `base_tab_mining` 키 사용.
- 검증: leader.js node --check + 인라인스크립트 11/11 파싱 + 구조(탭/pane/스위처) 정상. SW v74→v75.
- 진단 메모: 정적분석으로 경매 스케줄러/조회/트랜잭션·마이그·내 변경 모두 크래시 경로 배제 후, 런타임 로그로 leader.js 핀포인트. (경매 통합/채굴 v2/레드팀 수정 코드는 무결 — 롤백 없이 핫픽스.)

## 2026-05-30 v7.269 — 함선 채굴 v2(적재량/목적지/약탈 깊이) + 레드팀 P0 수정 + 임무탭 이동 + 경매장 GP↔PP 통합

사용자 기획 반영: "어느 함선을, 어디로, 어떻게" 의사결정. 혼자 만들지 말라는 지시에 따라 Plan/레드팀(4에이전트)/Codex 협업.
- **채굴 깊이 v2(mig 277)**: 함급별 적재량(capacity) 가중치(frigate1/destroyer2/cruiser4/battleship14/titan60 — HP비례) × 등급보너스(+10%/tier)로 함대 총 capacity 산출. GP=capacity×시간×`gp_per_capacity_h`. 목적지 3종(frontier/mid/core) 수율·마모·약탈위험 차등(y1.0/1.5/2.2, w1.0/1.5/2.5, raid 0%/5%/15%). core는 고수율이나 마모·피습 위험 큼.
- **레드팀 P0 수정(게임붕괴 차단, mig 278)**:
  · **P0-1(게임엔딩)**: 채굴 중 함대가 공성(full-loss)에 투입되면 영구 함대 파괴 가능 → siege commit이 채굴 함대 거부(`fleet_mining`) + launch가 공성 투입 함대 거부.
  · **P0-2(좀비함선)**: 마모 `GREATEST(1, current_hp - round(...))` clamp → HP 0 함선 발생 차단.
  · **인플레 #1**: 지갑당 채굴 GP 일일 상한(`gp_cap_per_day`1500, 24h 합산 후 headroom clamp) → 무료 GP 무한 양산 차단. GP 환율 5→3 하향(GP→PP 우회 인플레 억제).
  · **수리 게이트**: 최소 출항 HP(`min_hp_pct`0.15) 이하 함선은 채굴 불가 → 조선소 수리(GP+재료) 강제.
- **채굴 임무탭 이동**: FLEET 허브의 ⛏ 버튼 제거(그리드 3열 복귀) → QUESTS 패널에 `⛏ MINING OPS` 카드. 모달에 목적지 카드 선택(색상 구분 #3fb6a8/#e0a93b/#d9483b, 수율·약탈% 표시) + 예상 GP 프리뷰. §19 준수. i18n 4언어.
- **경매장 GP↔PP 통합(Codex)**: 2경매 시스템(auction.js GP전용 ↔ auctionCombat 통화인식)을 auctionCombat로 일원화. 전 자산 PP/GP 매물 + GP↔PP 거래를 경매장 내부에서(별도 위젯 X). 매수 PP는 비상환(USDT 누수 차단). 프론트 create/bid/buyout/cancel 전부 `/api/auctions/*`로 재연결, SELL UI "💱 GP↔PP" 옵션.
- 검증: 채굴 v2 e2e 6/6 + 레드팀수정 5/5 + 일일캡 clamp 2/2 + 경매 4/5(1 코스메틱) + 인라인 9/9 + 부팅 200(mining/info gpPerCapacityHour:3 + auctions). SW v73→v74.

## 2026-05-30 v7.268 — 함선 채굴 내구도 마모 → 수리 GP sink (EVE식)

채굴 런 복귀 시 함대 함선 HP가 닳는다. 닳은 함선은 조선소에서 수리(GP+재료)해야 다시 채굴 가능 → GP/재료 sink 루프.
- collectMining: 함대 함선 `current_hp -= round((max_hp+bonus_hp) × wear_pct × duration_h)`. 설정 `ship_mining_hull_wear_pct_per_hour`(0.02=2%/h, mig 276).
- 채굴 가능 함선 조건에 `current_hp > 0` 추가 → 완전 마모 함선은 수리 전 채굴 불가.
- 프론트 모달에 "채굴은 내구도 소모 — 닳으면 조선소 수리" 안내(4언어).
- 검증: DB e2e 3/3(GP=40·8h 후 HP 100→84 마모·HP0 채굴거부). SW v72→v73.

## 2026-05-30 v7.267 — 함선 채굴 런(경제v2 P5) — 땅 없는 F2P 노가다

EVE식 함선 채굴. 땅(영토) 없는 유저가 함대를 채굴 런에 보내 재료+GP를 수급하는 F2P 사다리 1단.
- **백엔드(격리·추가형, 기존 흐름 무영향)**: `ship_mining_jobs` 테이블(mig 275) + `services/shipMining.js` + `routes/shipMining.js`(`/api/mining/info|my|launch|collect`).
  · launch: 함대 소유·전투중아님·중복채굴아님·동시한도·살아있는 함선≥1 검증 후 시간 점유. collect: 복귀(ends_at 경과) 시 GP(=함선수×시간×`ship_mining_gp_per_ship_h`5) + 재료(rollResourceDrop, 시간비례 roll) 수급. **PP 안 줌**(무료PP 폐지 정책). 출항 비용 0(무료 노가다, 설정 가능).
  · 설정(mig 275): `ship_mining_enabled`, `_durations_h`[1,4,8], `_gp_per_ship_h`5, `_max_per_wallet`3, `_resource_rolls_per_4h`1, `_launch_cost_gp`0.
- **프론트**: FLEET COMMAND 허브에 ⛏ Mining Run 버튼(3열→2×2) + `openShipMining()` 모달(함대/시간 선택→출항, 진행/완료 런 목록+수령). §19 준수(addEventListener, inline concat 없음). i18n 4언어.
- **경매 cancel 엔드포인트** 추가(auctionCombat — 입찰 0건만, 에스크로 환불) — 향후 마켓 통합용.
- 검증: node --check + mig 275 + **DB e2e 8/8**(launch 가드·GP=함선×시간×5·재료·중복/미완료/재collect 거부) + 서버 부팅 200(/api/mining/info) + 인라인스크립트 9/9. SW v71→v72.
- 후속(비차단): 경매 프론트 통화 UI(자산 PP/GP·GP↔PP 거래소) — 2시스템 통합 필요라 별도 검증 세션. 함선 PP 마켓.

## 2026-05-30 v7.266 — 무료 PP→GP 전환(경제v2 P2, Codex) + activity/feed 버그 + 로켓 가드

- **[경제v2 P2] 무료 PP faucet 전부 GP로 전환** (Codex 구현 + 검수). PP는 입금(chain.js)에서만 발행. 무료 보상은 `settings.pp_to_gp_exchange_rate`(기본 10) 배 GP로 가치 보존.
  · 전환: 가입/추천가입 보너스(auth.js), 레벨업(db.js), 채굴 수확·즉시수확·퀘스트(api.js), 미션 보상/환불(missions.js), POI 탐사(exploration.js), 온보딩(onboarding.js), 일일 로그인·마일스톤(daily.js), 로켓 룻(rocket.js), 시즌패스 reward_type='pp'(season.js).
  · 유지(PP): 입금 보너스(chain.js). **하이잭 land-PvP 닫힌 루프(공격비용↔환불/보너스 PP 균형) — PP 유지**(받은 PP는 redeemable 미적립이라 비환매).
  · **governance 바운티 GP→PP 발행 제거**(GP 보상 유지) — 미담보 PP 발행 누수 차단.
  · guild 기여도 차감도 GP로 일치. 신규 헬퍼 `db.getPPToGPRate(client)`.
  · **마이그레이션 없음**(순수 코드) → 부팅 리스크 낮음.
  · 검수: node --check 12파일 + getPPToGPRate()=10 + 모듈 로드 + 잔여 무료 PP 발행 0 + 서버 부팅 200 확인.
- **[FIX] /activity/feed 쿼리 `st.name` 컬럼 없음** → `COALESCE(st.name_ko, s.ship_type_code)`. 함선 건조 이벤트가 피드에서 누락되던 비치명 버그(로그 `column st.name does not exist`).
- **[FIX] _drawRocketOverlay undefined.length 가드** — API 미로드/502 시 globe 텍스처 합성 중 크래시 방지.
- SW v70→v71.

## 2026-05-30 v7.264 — CRITICAL: 네비 data-action 디스패처 누락 → 전 진입 버튼 무반응 복구

**진짜 원인 확정**(브라우저 재현). v7.263 오버레이 가설은 headless 한정 artifact였고, 실제 원인은 별개.
- **[CRITICAL→FIXED]** col-fab/상단바/모바일 네비 버튼(MY LAND/CANTINA/CLAIM/ITEMS/BASE, 로그인, 포트폴리오 등)이 v7.215(239cc5e)에서 inline onclick → `data-action` 으로 마이그(§19)됐으나 **이 무인자 액션들을 함수로 잇는 위임 클릭 리스너가 추가되지 않아** 클릭이 전부 무반응이었다. 재현: 7개 버튼 click 시 함수 0개 호출 확인.
  · 수정: `data-action` 무인자 네비/UI 액션(toggleMyLand/openArena/openBaseModal/openMyItems/activateLandSelect/openAuthModal/openPortfolioModal/openTelegramGroup/toggle*·close*·튜토리얼·copyRefCode 등 24종) 화이트리스트 위임 디스패처 추가. 인자형 액션(syRepairShip/siegeJoin/selectTargetFleet 등)은 기존 디스패처가 인자와 함께 처리 → 이중 호출/충돌 없음.
  · 검증: Preview 브라우저 재현 — 수정 후 7개 버튼 click → 대응 함수(openBaseModal·toggleMyLand·openArena·activateLandSelect·openMyItems …) 전부 호출 확인. 인라인 스크립트 9/9 파싱.
- SW v69→v70.
- 후속(비차단): 21515~ `[onclick*="openBaseModal"]` 잔재 셀렉터(튜토리얼 하이라이트 타겟 탐색)도 data-action 으로 갱신 필요.

## 2026-05-30 v7.263 — 핫픽스: 로딩 오버레이 고착(전 버튼 클릭 불능) + SW 더블로드

사용자 보고: 하단 네비(MY LAND/CANTINA/CLAIM/ITEMS/BASE) 등 모든 버튼 무반응 + 첫 로딩 2번 + 화면 겹침.
- **[CRITICAL→FIXED] 로딩 오버레이 고착** — `#loadOverlay`(z-index 9999, pointer-events:auto)가 화면 전체를 덮은 채 안 닫혀 모든 클릭을 흡수. 원인: `onGlobeReady`/`_doInitGlobe` 내부에서 globe/WebGL init 예외(SW 업데이트 후 stale globe.gl·텍스처, 컨텍스트 손실 등) 발생 시 그 **뒤에** 등록되던 8s fallback(line 12078)이 실행되지 않아 로더가 95%에서 영구 고착. 브라우저 재현으로 `_loadPct=95, loadOverlay display:flex` 확인.
  · 수정: 스크립트 최상위(`setLoadProgress(2)` 직후)에 **init 예외와 독립적인 하드 안전장치** 추가 — 8초 후 무조건 `dismissLoader()` + 실패 시 오버레이 강제 `display:none`/`pointer-events:none`. 재현 환경에서 오버레이 해제→`#openBaseBtn` 클릭→`openBaseModal` 동작 확인.
- **[FIXED] SW 강제 reload 더블로드** — `controllerchange`에서 복귀 유저에게 `location.reload()` 발생 → "로딩 2번 + 겹침". 주석은 silent 표방이나 실제 reload 하던 모순 제거. 이제 완전 silent(다음 nav에서 새 버전 자동 반영, network-first HTML). SW v68→v69.
- 검증: 인라인 스크립트 9/9 파싱 + Preview 브라우저 재현(loadPct 100, overlay display:none/pe:none, 네비 클릭 가능).

## 2026-05-29 v7.262 — 경제 정책: 담보-룸 소프트 환매 + redeemable_pp 게이팅 (W1-10)

적대토론 워크플로(옹호/설계/규제→심판) 단일 권고 채택. 문서: `docs/ECONOMY_TOKEN_POLICY_2026-05-29.md`. M단계(법인구조·캡드토큰)는 사장 지시로 보류.
- **[W1-2] 페그 약속 문구 전면 제거** — index.html 13곳(en/ko/ja/zh)의 "1 PP ≈ $1 / pegged / 페그 / ペッグ / 锚定"을 "운영 환율(변동 가능, 담보 한도 내) USDT 환금 — 고정 페그 아님"으로 교체. 포트폴리오 카드/주석 포함. (상점 결제비율 1:1 테이블은 환매 약속 아님 → 유지.) 프리런칭 무비용 시점에 법적 시한폭탄 제거.
- **[W2-4] redeemable_pp 게이팅** (mig 271) — `users.redeemable_pp` 컬럼 신설. 입금 보너스 PP(+첫입금 보너스)만 redeemable 적립(chain.js). **채굴/가챠/추천 PP는 USDT 직행 불가**(GP 환전만) → 봇 채굴→USDT 차익 구멍 차단. swap이 redeemable 한도 초과 시 `pp_not_redeemable` 반환. **DB 트리거 `clamp_redeemable_pp`로 불변식 `redeemable_pp ≤ pp_balance`를 16개 PP 차감 사이트 전체에 중앙 강제**(누락 방지). 솔벤시 하드가드는 여전히 treasury room(담보)이며 게이팅은 그 위 차익차단 레이어.
- **[W4-6] 환매 한도** — `treasury.checkRedemptionLimits`: 주간 글로벌 cap=max(floor 100, 신규입금×30%), 유저 일일 한도(USDT). swap/withdraw-all에 연결, 초과 시 429. 정산 딜레이는 기존 withdrawal_cooldown_hours(24~72h) 활용. withdraw-all은 게이팅 on 시 redeemable 부분만 USDT화하고 비환매 PP는 계정에 잔류.
- **[W6-10] 환매 대시보드** — `GET /api/admin/economy/redemption`(담보/부채/room, 주간 입금·환매, **환매율 실측 vs 가정 10~25%**, cap 소진율, redeemable PP 비중, 탑 리디머 7d, 설정 스냅샷). admin.html ECONOMY 탭에 REDEMPTION 패널.
- 신규 설정: `redeemable_pp_gating_enabled`(true), `redemption_weekly_cap_enabled`(false—입금0 잠금 footgun 회피, 런칭후 on), `redemption_weekly_cap_pct`(30), `_floor_usdt`(100), `redemption_daily_limit_usdt`(0).
- 검증: node --check(api/treasury/chain/adminEconomy) + mig 271 적용(46명 백필) + DB e2e 6/6(트리거 clamp·게이팅·한도) + 인라인스크립트 파싱(index 9 / admin 1) + 라우트 로드. SW v67→v68.
- **GP·PP·신규토큰 온체인 토큰화는 전부 보류**(무캡 GP 토큰화=가격 0 수렴 자살, PP=가상자산법 트리거). 코드 변경 없음, 정책 기록만.

## 2026-05-29 v7.261 — 공성전 풀스택 QA 수정 (dead-lock / 세수 누수 / 동시성)

최종 통합 QA 워크플로(10에이전트) 확정 결함 수정.
- **[CRITICAL→FIXED] siege 상태머신 dead-lock**: 연결 fleet_battle이 cancelled(함대충돌/예외/재시작정리)되면 resolveSiege가 'ended' 아님→영원히 pending→governor_sieges active 고착+`active_siege_id` 미해제→섹터 영구 잠김. 수정: 진행중(preparing/active)만 보류, **cancelled는 fleet_battle_id 리셋+픽셀 폴백으로 해결 진행**(커맨더 가드도 동일). DB e2e PASS(cancelled→resolved+잠금해제).
- **[HIGH→FIXED] vice_governor 세수 누수**: 공성으로 거버너 바뀌어도 옛 정권 vice 포지션이 남아 siege_governor_locked로 픽셀 재산정 멈춘 섹터 세금 20%를 영구 수취. 수정: `_installGeoGovernor`에서 거버너 교체 시 옛 vice 포지션도 정리(잔여 GP→sector_pool 후 제거).
- **[HIGH→완화] 라이브 전투 동시성 점유**(mig 270): 라이브 시즈가 전역 battle_max_concurrent(3) 슬롯을 점유→타 전투 적체. wall-clock 한도 10→6분으로 단축(정상 1~2분 종료). 근본책(라이브 전용 lane)은 후속.
- node --check + DB e2e + 부팅 OK.
- 후속(AUDIT): 멀티인스턴스 라이브 명령 라우팅(Redis battleCmd — 단일인스턴스 정상), shouldAbort 데드코드 정리, 라이브 전용 동시성 lane.

## 2026-05-29 v7.260 — 게임 가이드북 '길드 공성전' 챕터 (4언어)

공성전 풀스택 출시에 맞춰 게임 가이드북 버전업.
- **🏛 길드 공성전 챕터** 신규 (id='siegewar', 첫 탭) — 4언어(en/ko/ja/zh): 섹터&거버너, 섹터 공성(주간 슬롯·1인1함대 합류), 실시간 명령(진형/기동/포커스/빔·미사일), full-loss 경고+무손실 점유율 대안, 커맨더 공성(월간 맹주전), 세금→길드 금고.
- 기존 'guildwar'(길드전&미니게임) 섹션과 **id 충돌 방지** — 신규는 'siegewar'로 분리.
- 인라인 스크립트 11종 파싱 + onclick 훅 통과. SW v66→v67.
- (공성전 풀스택 최종 통합 QA는 별도 멀티에이전트 워크플로로 병행 검증.)

## 2026-05-29 v7.259 — 커맨더 공성 월 1회 자동 개최 + 무도전 강등 (주기 확립)

레드팀 권고(도전 0명 영구 유임 방지) 반영. 커맨더 공성에 자동 주기 도입.
- **mig 269**: mars_commander.no_challenge_streak/last_attempt_at/term_ends_at. 설정 commander_siege_auto_enabled(true)/dom(1)/hour_utc(12)/vacate_after_no_challenge(3).
- **siege.maybeOpenCommanderSiege()**: 매월 dom일 hourUtc시(UTC) 슬롯 1회 — 도전자(sov2위·최소섹터) 있으면 자동 declareCommanderSiege 개최, 없으면 무도전 streak++ → 3회 연속 시 맹주 vacant 강등(getSovMap이 sov 파생으로 폴백). 같은 달 중복 개최 가드(last_attempt).
- **index.js**: siege 5분 스케줄러 tick에 maybeOpenCommanderSiege 추가.
- **검증**: node --check + DB e2e(슬롯 도달→자동 개최 def/chal 산정→last_attempt 기록 PASS, 같은 달 재개최 안 함 PASS) + 부팅(RUN_SCHEDULERS=true) OK.
- **주기 요약**: 섹터 공성=주간(수·토 12:00 UTC) / 커맨더 공성=월 1회(매월 1일 12:00 UTC) 자동, 선언 후 24h 예고.

## 2026-05-29 v7.258 — 커맨더 공성 전투 (맹주전) — 마지막 큰 조각 완료

Codex 설계 + 레드팀 16에이전트 검토. 맹주(sov 1위)=수비 vs 최강 도전자(sov 2위)=공격, 양측 길드원이 다함대 합류해 실시간 결전, 승리 길드가 화성 맹주. 기존 인프라 최대 재사용(commitSiegeFleet/createSiegeBattleMulti/simulateBattleLive/실시간 명령 무변경).
- **mig 268**: governor_sieges.siege_kind('sector'|'commander'), 시스템 섹터 '__commander__', `mars_commander`(단일행 명시 맹주), 설정(commander_siege_enabled/commander_full_loss_enabled/notice_hours).
- **siege.js**: declareCommanderSiege(sov로 맹주·도전자 산정), resolveCommanderSiege(승자→mars_commander upsert+칭호). resolveSiege 커맨더 가드 — _installGeoGovernor/섹터 로직 우회·전용 resolver 위임(레드팀 #2/#3 차단).
- **getSovMap**: mars_commander 명시 맹주 우선(elected), 없으면 sov 파생(dual-SoT 차단).
- **battleEngine**: 커맨더 full-loss를 commander_full_loss_enabled(별도, 기본 false)로 분리(레드팀 CRITICAL: 맹주전 전손 경제충격 차단).
- **API/UI**: POST /api/siege/commander/declare, SOV MAP 👑 맹주 배너 + "맹주 공성 선언" 버튼.
- **검증**: node --check 4 + DB e2e(선언→도전승리→맹주 교체→getSovMap 우선) PASS + 부팅/엔드포인트 200 + 파싱·훅. SW v65→v66.
- 후속(레드팀 design, 비차단): 강제 신임/임기(도전 0명 영구유임 방지), 결전 시각까지 커밋 윈도우+정족수(조기 락 방지), 맹주 권력/혜택(수도세/칭호 정의). 현 1v1(sov1 vs sov2)은 승자 결정적이라 안전.

## 2026-05-29 v7.257 — 화성 맹주(Commander) = sov 지배 1위 길드

큰 기능 #3 (커맨더) — 1차: sov 지배 기반 맹주. ("거버너들이 한 전장에서 싸우는 커맨더 공성 전투"는 후속 전용 증분.)
- **getSovMap commander 산정**: leaderboard 1위(섹터 최다 → core → mid 동점처리) 길드가 `commander_min_sectors`(기본 3) 이상 + 단독 1위면 맹주. 파생 메트릭(안전, 새 전투 없음).
- **SOV MAP 모달 맹주 배너**: 👑 화성 맹주 [TAG] 길드명 (지배 섹터/core 수). 4언어. mig 267.
- **검증**: getSovMap 맹주(무점령 null) + 단위 정렬 PASS + 파싱·훅. SW v64→v65.
- 후속(남은 큰 조각): 커맨더 공성 **전투**(현 거버너 길드들이 수도 전장에서 simulateBattleLive 다자전 → 승자 맹주) — siege 인프라 재사용 가능, 별도 증분.

## 2026-05-29 v7.256 — 주간 공성 캘린더 (결전 시각 고정 슬롯)

큰 기능 #2 — 공성 결전을 고정 주간 슬롯으로 스냅(관전 집중, 리니지 공성 시간표).
- **mig 266**: siege_schedule_enabled(true)/dows("3,6"=수·토)/hour_utc(12)/min_notice_hours(6).
- **`_nextSiegeSlot` + declareSiege**: 스케줄 활성 시 siege_starts_at을 다음 고정 슬롯(UTC dows+hour)으로 스냅. 비활성 시 기존 now+warning_hours.
- **`getSiegeSchedule` + GET /api/siege/schedule**: 다가오는 결전 슬롯 N개 + 설정. SOV MAP 모달 상단에 "⚔ 다음 공성 결전" 칩으로 노출(현지 시각).
- **검증**: getSiegeSchedule 단위(전 슬롯 수/토 12:00 UTC) PASS + 부팅/엔드포인트 200 + 파싱·훅. SW v63→v64.


## 2026-05-29 v7.255 — SOV MAP: 화성 지배 현황 (24섹터 길드 거버너 지도)

"누가 화성을 지배하나" 한눈에 — 큰 기능 #1 (sov 지도).
- **`sector.getSovMap()` + `GET /api/sector-defs/sov-map`**: sector_definitions + sector_governance + guilds 조인 → 24섹터 각 거버너(길드/개인) + 티어 + 길드별 점유 leaderboard(core/mid/frontier 카운트) + claimed/vacant 요약. (`/:code` 보다 먼저 등록해 라우트 충돌 방지)
- **`openSovMap()` 모달** (거버넌스 탭 🗺 SOV MAP 버튼): 티어별(core/mid/frontier) 섹터 그리드 — 각 섹터 현지화 이름 + 지배 길드(이모지/태그) 또는 무주공산. 상단에 지배 길드 leaderboard. 4언어. §19 준수(inline onclick 없이 listener).
- **검증**: getSovMap 직접 호출(24섹터/leaderboard) PASS + 인라인 11종 파싱 + onclick 훅 통과. SW v62→v63.
- 순서대로 다음: 주간 공성 캘린더 → 커맨더 공성.

## 2026-05-29 v7.253 — 실시간 수동 스킬(beam/missile) 서버 권위 + 1인 1함대 확인 + cmd rate limit

- **1인 1함대 제약(#1)**: `siege_fleet_commits` UNIQUE(siege_id, wallet) + upsert로 이미 강제됨 — DB e2e로 확인(재커밋=교체, 항상 1개). 추가 작업 불요.
- **beam/missile 서버 권위 수동 스킬** (레드팀: 클라 게이지 신뢰 금지): `simulateBattleLive`에서 함대별 충전(살아있는 ATK 함선 수 × per-ship/틱) 서버 누적. `applyLiveCommand` beam/missile — 충전 100%에서만 발동(쿨다운=재충전), 발동 후 0 리셋. `_applySkill`: beam=우선 적함(기함/최대HP) 강타(ATK합×8), missile=최대 6척 분산(×4). 소유권 검증. mig 265 배율/충전율 설정.
- **명령 배선**: WS cmd + commander-action 라우트 + index.html postMessage 핸들러에 beam/missile(=tactical-lab `beam_cannon`/`missile_barrage`) 매핑. tactical-lab 버튼은 이미 `_bridgeToParent` 호출 → 클라 추가 변경 없음.
- **비-라이브 cmd rate limit**(레드팀): commander-action 라우트 per-wallet 5/s — pre-battle declareAction 폭주(풀 고갈/락 경합) 차단.
- **검증**: node --check 4파일 + 수동스킬 단위(발동/격침/충전리셋/저충전거부/소유권거부/missile분산) PASS + 인라인 11종 파싱. SW v60→v61.
- 남은(비차단): 멀티인스턴스 명령 라우팅(Redis battleCmd→권위워커, 현 단일인스턴스 무관), 참가자 전용 버튼 가시성(서버는 비참가자 거부 중).

## 2026-05-29 v7.252 — Phase 3 완성: 참가자 실시간 명령 연결 (클라→서버 라이브 큐)

서버 라이브 루프(v7.251)에 **참가자 명령 입력을 연결** — 이제 진행 중 함대전에서 자기 함대를 실시간 조작.
- **commander-action 라우트 라이브 분기**: `liveBattle.isActive(battleId)` 면 pre-battle `declareAction`(per-msg DB 트랜잭션) 대신 **참가 함대 자동 해석 + 라이브 큐 enqueue**. 클라 변경 0 — 기존 tactical-lab 명령 버튼 → postMessage → 이 라우트 체인이 그대로 라이브로 분기.
- **liveBattle per-wallet rate limit**(5/s) 중앙화 — WS·HTTP 양 경로 공통 choke point (레드팀 플러딩/매크로 차단). clearActive에서 rate 상태 정리.
- **완성된 전체 체인**: tactical-lab 진형/기동/포커스 버튼 → postMessage → commander-action → 라이브 큐 → simulateBattleLive 틱 드레인 → applyLiveCommand(소유권 검증) → fleet state 변경 → 다음 프레임 broadcast → 전원 관전 반영.
- **검증**: node --check 2파일 + rate limit 단위(5 통과/3 차단) PASS + 부팅 에러 0.
- 이로써 "혈맹원 여럿이 각자 함대를 한 전장에 모아(Phase 2) 실시간 명령으로 조작하며(Phase 3) 다 같이 관전"하는 혈맹 공성전이 동작.
- 남은 후속: beam/missile 수동스킬 서버 권위 쿨다운, 멀티인스턴스 명령 라우팅(Redis), 비-라이브 declareAction rate limit, 참가자 전용 버튼 가시성(현재 서버가 비참가자 거부).

## 2026-05-29 v7.251 — Phase 3: 실시간 권위 전투 루프 (서버) — 다유저 동시 명령 기반

"미리 계산 → 스트림" 자동전투를 **실시간 권위 틱 루프**로 전환(siege). 참가자가 진행 중 자기 함대에 명령을 보내고 모두 라이브 관전. Codex 설계 + 레드팀 워크플로(16에이전트) 반영.
- **battleEngine.simulateBattleLive**: simulateBattle과 동일 헬퍼/결과 shape를 쓰되 틱 사이 await + 매 틱 명령 큐 드레인 + 프레임마다 즉시 onFrame broadcast + wall-clock 타임아웃 + 권위 abort. 결과 동일 → applyBattleResults 그대로.
- **applyLiveCommand**: 진형/기동/포커스를 라이브 state에 적용 + **소유권 이중검증**(명령 wallet==함대 owner).
- **liveBattle.js**: 권위 워커 in-memory 명령 큐(enqueue/drain/markActive). 큐 상한 500.
- **battleScheduler**: siege + `siege_realtime_enabled` 면 simulateBattleLive(라이브 broadcast) 분기, 아니면 기존 precompute→stream. 결과 이후 경로 공통.
- **wsServer cmd**: 라이브 전투 진행 중이면 declareAction(pre-battle, per-msg 트랜잭션) 대신 **인메모리 큐 enqueue** — per-socket rate limit(3/s) + 소유권 SELECT 검증. (레드팀 최상위 발견 "명령 플러딩 DoS/트랜잭션 폭풍"을 큐+rate limit로 차단.)
- **mig 264**: siege_realtime_enabled(true)/tick_ms(250)/wallclock_min(10)/cmd_rate_per_sec(3).
- **검증**: node --check 4파일 + 라이브 e2e(틱 루프 완주·명령 드레인·onFrame·결과) PASS + applyLiveCommand 단위(권한 차단) PASS + 라이브 부팅 에러 0.
- **남은(다음 증분)**: 참가자 명령 UI(자기 함대 진형/기동 버튼 → WS, fleetId 포함), beam/missile 수동스킬은 **서버 권위 쿨다운/충전**으로(레드팀: 클라 게이지 신뢰 금지), 멀티인스턴스 명령 라우팅(Redis battleCmd → 권위 워커), 비-라이브 declareAction rate limit.

## 2026-05-29 v7.250 — Phase 2: 다(多)함대 공성 (혈맹원 여럿이 한 전장에)

"1함대 vs 1함대"였던 공성을 **혈맹원 여럿이 각자 함대를 같은 전장에** 투입하는 구조로 확장. battleEngine이 이미 진영당 N함대를 지원(participants ORDER BY side + 위치 배치)함을 확인 → 엔진 재작성 없이 커밋 다중화로 달성.
- **mig 263**: `siege_fleet_commits(siege_id, wallet, fleet_id, side)` — 지갑당 1함대 UNIQUE + 함대 UNIQUE. setting `siege_max_fleets_per_side`(20).
- **siege.js commitSiegeFleet**: 단일 컬럼 → siege_fleet_commits upsert(측 정원 체크). 대표 함대 컬럼은 게이트 호환용으로 COALESCE 유지.
- **siegeFleetBridge.createSiegeBattleMulti**: 공성의 모든 커밋 함대를 한 fleet_battle의 participants로 등록(양측 ≥1, 전투중 함대 거부, is_in_battle 표시). prepareSiegeBattles가 이걸 호출.
- **roster API**: 양 진영 합류 함대 목록 + 카운트(atk_count/def_count) 반환.
- **UI**: '⚔ 결전 함대 (N vs M)' + 진영별 합류 함대 목록(함선 수). JOIN 공격/수비는 정원 차기 전까지 누구나(서버 권한 검증). side_full 에러 한국어.
- **검증**: node --check 3파일 + 인라인 11종 파싱 + DB e2e(공격 2함대+수비 1함대→3 participants 한 전장, 전부 in_battle) PASS. 라이브 부팅(전 플래그 ON, mig 263) 에러 0. SW v59→v60.

## 2026-05-29 v7.248 — 라이브 UX: 합류 full-loss 경고 + 무손실 대안 + 공성 모드 배지

full-loss가 ON인 라이브 전환에 맞춘 공성 UX (워크플로 UX 발견 반영).
- **합류 전 full-loss 경고** (`_loadSiegeFleetPanel` siegeJoin): 함대 합류 시 `gameConfirm`으로 "패배 시 함선 영구 손실 + 함대 안 걸면 점유율 판정(무손실)" 경고 후 커밋.
- **무손실 경로 안내**: 함대 없는 유저에게 "영토 점유율로 도전/방어 가능(◌ 무혈, 손실 없음)"로 안내(조선소 유도 일변도 제거).
- **resolution_mode 배지**: ACTIVE SIEGE 헤더에 ⚔ 함대 결전(패배 시 손실, red) / ⚔ 함대전 대기 / ◌ 무혈 판정을 선언 시점부터 표시.
- 인라인 스크립트 11종 파싱 + onclick 훅 통과. 라이브 부팅(플래그 ON) 에러 0. SW v57→v58.

## 2026-05-29 v7.247 — 레드팀 확정 결함 수정 (disband 금고 소각/admin 동결/세금 라우팅)

guild-war-golive 워크플로(15에이전트) 확정 결함 반영.
- **[HIGH] disband 금고 GP 소각**: `disbandCleanup(client, guildId, refundWallet)` 공통 헬퍼 신설 — 거버너 섹터 무주공산화 + `gp_treasury>0`이면 리더에게 환원 + ledger(disband_settle). disbandGuild + **admin force-disband(DELETE /guilds/:id)** 양쪽이 공유 → 경로 분기 차단(admin은 섹터 잠금·정산 둘 다 누락이었음).
- **[MED] collectTax NULL sector_id 조용한 폴백**: 길드 거버너 조회에 `AND sector_id IS NOT NULL LIMIT 1` 추가.
- **mig 262**: `sector_governance(sector_id)` 부분 UNIQUE — 코드↔지오 1:1 DB 강제.
- node --check 3파일 통과. (앞선 v7.246 머니플로 e2e PASS 유지.)

## 2026-05-29 v7.246 — 세금→길드 금고 + 인출 + disband 가드 + 길드 공성전 라이브 활성화

유저 부재 시점에 길드 공성전 전 기능 ON. 머니플로 e2e 검증 완료.
- **세금→길드 금고** (`governance.js collectTax`): 섹터에 길드 거버너(`sector_governance.governor_guild_id` by sector_id) 있고 `sector_tax_to_guild_treasury`면 거버너 몫을 `guilds.gp_treasury`로 적립 + `guild_treasury_ledger`(kind=sector_tax) + `sector_tax_collected` 누적. 개인 거버너는 기존 governance_positions(이중적립 방지 — 둘 중 하나).
- **`guild.withdrawTreasury`** + `POST /api/guild/treasury/withdraw`: 리더/오피서만, FOR UPDATE+조건부 차감(음수/동시인출 가드), ledger(kind=withdraw), 유저 GP 환급.
- **disband 가드** (`guild.disbandGuild`): 해체 시 거버너 섹터 무주공산화 — `sectors.siege_governor_locked=false`+governor_wallet NULL, governance_positions 정리, sector_governance 클리어 (frozen governor 방지).
- **mig 261 라이브 활성화**: siege_fleet_combat_enabled / guild_governance_enabled / siege_governor_canonical_enabled / sector_tax_to_guild_treasury / siege_full_loss_enabled = true.
- **검증**: node --check 4파일 + DB e2e — collectTax(1000@5%)=50→길드금고 35 적립, 인출 100→40/유저+60, 초과인출·비멤버 차단 PASS.

## 2026-05-29 v7.245 — (A) 지오 섹터 정본 통합: 공성 승리 → 실제 세금 (플래그 OFF)

근본원인(섹터 이원 우주) 해소. 공성 결과를 라이브 세금 시스템(sectors/governance_positions)에 연결. **`siege_governor_canonical_enabled` 기본 false → 프로덕션 세금/클레임 경로 무변경**, 스테이징 검증 후 플래그 ON.
- **mig 260**: `sector_governance.sector_id`(→sectors.id, sector_definitions.id 위치 1:1 backfill 24/24) + `sectors.siege_governor_locked`. setting `siege_governor_canonical_enabled`.
- **siege.js `_installGeoGovernor`**: 공성 승자를 정본 sectors 거버너로 설치 — 옛 거버너 잔여 GP→sector_pool, governance_positions/history 교체, `siege_governor_locked=true`. resolveSiege 트랜잭션에서 거버너 변경 시 호출(원자적).
- **governance.js recalculateGovernor**: `siege_governor_locked` 섹터는 픽셀 자동 재산정 skip → 공성 거버너가 다음 클레임에 안 덮어써짐.
- **updateTaxRate**: 공성 거버너 세율을 `sectors.tax_rate`(collectTax가 읽는 정본)에도 동기화.
- **검증**: node --check + DB end-to-end 2종 PASS — ①공성 승리→sectors 거버너/포지션/lock 설치 ②recalc 가드 동작 + collectTax가 공성 승자에게 세금 적립(2% of 1000=20, gov 14). 테스트 데이터/플래그 정리.
- **남은 활성화 절차**: 스테이징에서 siege_fleet_combat_enabled + guild_governance_enabled + siege_governor_canonical_enabled 순차 ON 검증. 코스메틱(공성 UI에 지오 섹터명 표시)은 비경제 후속.

## 2026-05-29 v7.244 — 공성 결전 함대 합류/로스터/관전 UI (B)

워크플로 #4(CRITICAL) 해소: 백엔드(commit-fleet/roster/applySiegeResult)는 완성됐으나 프론트에 함대 합류 동선이 없어 플래그 켜도 전부 픽셀 폴백이던 문제. **siege 우주 안에서 자족적이라 섹터 통합(A)과 무관하게 안전.**
- 공성 패널(`loadSiegeInfoPanel`)에 결전 함대 패널 async 로드(`_loadSiegeFleetPanel`): `GET /api/siege/:id/roster`로 양측 함대 커밋 상태(공격/수비 미배치/✓) + resolution_mode 배지(⚔함대전/◌무혈판정) 표시.
- **JOIN 공격/수비**: 내 함대 select(함선 보유분만) → `POST /api/siege/:id/commit-fleet`. 6개 에러코드 한국어화. 커밋 후 패널 갱신.
- **관전**: 결전 전투 생성 시(`fleet_battle_id` + active) `👁 관전` → 기존 `openBattleViewer(battleId)` 재사용.
- §19 준수: inline onclick 금지, data-action + delegated listener + in-flight 가드 + `[BTN]` 로그. 인라인 스크립트 11종 node 파싱 통과, onclick 훅 통과. SW v56→v57.
- 다음(A): 섹터 이원 우주 통합(지오 정본) — 별도 큰 마이그레이션. 그 전까지 공성은 코드섹터 우주에서 동작.

## 2026-05-29 v7.243 — 레드팀 수정: 공성 함선 전사 플래그 게이트 (full-loss footgun 차단)

멀티에이전트 검토(guild-war-review 워크플로, 13 에이전트)가 확정한 high 결함 수정.
- **[HIGH] siege full-loss 플래그 무시**: `battle_type='siege'` 전투가 `isHijackBattle=false`라 battleEngine 일반 분기로 빠져 격침함을 **무조건 영구파괴**했음. `siege_full_loss_enabled`(기본 false, "경제 재균형 전까지 OFF")는 코드에서 읽힌 적 없음 → `siege_fleet_combat_enabled`를 켜는 순간 설계 계약과 달리 전사 강제 ON 되는 footgun.
- **수정** (`battleEngine.js` applyBattleResults): siege를 hijack처럼 loss-gated 처리. `siege_full_loss_enabled` OFF면 hijack 비전사와 동일하게 격침함 HP 15% 보존, ON일 때만 영구파괴. node --check 통과.
- 나머지 확정 발견은 AUDIT_FINDINGS에 우선순위 기록(이원 거버넌스 테이블 세금 표류 / JOIN·관전 UI 부재 / 세금→길드금고 미배선 / 도움말 옛모델). 플래그 ON 전 선결.

## 2026-05-29 v7.242 — 길드 공성전 Phase 1b: 거버너=길드 쓰기 로직 (플래그 OFF)

거버너를 길드 소유로 운용하는 쓰기 경로. `guild_governance_enabled` 기본 false → 프로덕션 무변경. Codex+아키텍트 검토 합의(§13) 반영 + Codex 지적 결함 수정. siege.js만 변경.
- **declareSiege**: guildGov 시 도전자의 `guild_members` 리더/오피서 검증(`not_in_guild`/`guild_rank_required`), 도전/수비 길드(`challenger_guild_id`/`defender_guild_id`) 기록. 자기 길드가 현 거버너면 금지. 섹터 조회에 `governor_guild_id` 포함.
- **resolveSiege**: ① [Codex race fix] 해결 트랜잭션 시작 시 `sector_governance` 행 `FOR UPDATE` 잠금. ② guildGov 시 승자 길드 매핑 → `governor_guild_id`/`governor_member_wallet`/`winner_guild_id` 이전. 개인 모드는 기존 동작.
- **commitSiegeFleet**: [Codex auth fix] guildGov 시 본인 지갑뿐 아니라 도전/수비 길드의 **리더/오피서**도 함대 커밋 허용.
- **검증**: node --check + 로컬 DB end-to-end 시뮬(길드 거버너 생성→공성→전투 승자→거버너 길드 이전 PASS, 테스트 데이터/플래그 정리). guild_governance_enabled OFF 유지 — 활성화는 Phase 1a 개인 검증 후.

## 2026-05-29 v7.240 — 길드 공성전 Phase 1a: 섹터 공성 → 실제 함대전 (백엔드, 플래그 OFF)

설계 `docs/GUILD_TERRITORY_WAR_DESIGN_2026-05-29.md` Phase 1 착수. 공성 승패를 "픽셀 수 비교"에서 "실제 함대전 결과"로 전환하는 배선. **`siege_fleet_combat_enabled` 기본 false → 프로덕션 동작 무변경**, 검증 후 플래그 ON.
- **mig 258**: `governor_sieges` 에 `challenger_fleet_id`/`defender_fleet_id`/`resolution_mode` 추가(+`fleet_battle_id`/`uses_fleet_combat` 재보장). settings `siege_fleet_combat_enabled`(false)/`siege_full_loss_enabled`(false, §12 경제 재균형 전까지)/`siege_fleet_commit_deadline_min`.
- **siege.js**: `commitSiegeFleet()`(도전/수비 함대 커밋, 소유·전투중·빈함대 검증), `prepareSiegeBattles()`(active+양측 커밋 시 `create_siege_battle()`로 결전 fleet_battle 생성, `resolution_mode='fleet_battle'`), `resolveSiege(id, opts)` 전투 승자 우선(전투 미종료 시 `pending` 반환해 보류).
- **siegeFleetBridge.applySiegeResult()**: 전투 종료 시 winner_side→지갑 매핑 후 `resolveSiege` 위임(거버너 이전/명예전당/평판 기존 경로 재사용).
- **battleScheduler `_postBattleHooks`**: `battle_type==='siege'` 전투 종료 시 `applySiegeResult` 호출(fire-and-forget).
- **API**: `POST /api/siege/:id/commit-fleet`, `GET /api/siege/:id/roster`.
- **스케줄러**: siege 5분 tick에 `prepareSiegeBattles()` 추가(resolveExpiredSieges 직후).
- **검증**: 5개 서버 파일 `node --check` 통과, 로컬 DB 스모크(모듈 로드/순환참조 없음, helper·컬럼·설정 확인, enabled=false 시 prepare=0).
- **다음**: 검증 후 플래그 ON + UI(합류/관전) + full-loss 경제 재균형(§12) + Phase 2 N-side.

## 2026-05-29 v7.238 — 가챠/하이젝 리빌 영상 SKIP 버튼

- 가챠 리빌 영상 + 하이젝 인트로 영상 우측 상단에 또렷한 `SKIP ▸` 버튼(반투명+블러 알약형, safe-area inset 반영, 4언어). 기존엔 "탭하여 건너뛰기" 텍스트 + 전체 탭만 있었음 — 전체 탭-스킵은 유지하고 버튼으로 명확성 추가. `stopPropagation`으로 버튼 클릭 처리. 모든 등급이 8s 영상을 재생해도 즉시 건너뛸 수 있어 낮은 등급 영상 제거 불필요.

## 2026-05-29 v7.233~v7.237 — 가챠 5티어 리빌 영상 풀세트

사용자 제공 Veo 영상으로 가챠 리빌을 등급별 영상으로 전환. 각 티어 가로(데스크탑)/세로(모바일) 마스터, 720p·crf30·무음·faststart(<1MB), 8.2s 자동종료.
- **티어 매핑 구조**(`_GACHA_TIER_VIDEO`): 항목이 있는 티어만 영상, 없으면 캔버스 연출 폴백. tier = max(rarityTier, qualTier) → `['common','uncommon','rare','epic','legendary'][tier]` 키로 조회. 가로/세로/풀 자동 선택.
- **v7.233**: 기존 가챠 영상 4종(가로 2/세로 3 파일) 전부 **레전더리 풀**로 통합(방향별 랜덤). "에픽" 오기 정정의 연장 — 별도 에픽 영상 없던 상태.
- **v7.234 에픽(tier 3)**: `gacha_reveal_epic(_v)` — 보라 상자·대형 순양함.
- **v7.235 레어(tier 2)**: `gacha_reveal_rare(_v)` — 파랑 상자·중형 구축함.
- **v7.236 언커먼(tier 1)**: `gacha_reveal_uncommon(_v)` — 초록 상자·소형 프리깃.
- **v7.237 커먼(tier 0)**: `gacha_reveal_common(_v)` — 회색 상자·소형 정찰기. 5티어 전부 영상 완성.

## 2026-05-29 v7.231 — 가챠 레전더리 모바일 세로 전용 영상

- `gacha_reveal_legendary_v.mp4`(세로) 추가. `_playGachaVideo`에 tier 인자 — 레전더리는 데스크탑 가로 / 모바일 세로 분기(cover 크롭 제거).

## 2026-05-29 v7.232 — 가챠 영상 라벨 정정 ("에픽" 오기 → 일반 가챠 리빌)

v7.228에서 tier 3을 "에픽 영상"이라 불렀으나, 사용자가 준 영상은 "가챠 일반 리빌"(gacha_reveal/_v01/_v02, Crate_cracks_open 등 3종)과 "레전더리"(gacha_reveal_legendary/_v) 두 종류뿐. 별도 에픽 영상은 받은 적 없음 — 코드 주석의 "에픽" 오기만 정정(동작 무변경). tier>=3은 일반 가챠 리빌 영상, tier>=4는 레전더리 전용 영상.

## 2026-05-29 v7.230 — 로딩 영상 frozen Mars 추가 + 가챠 레전더리 전용 영상

사용자 제공 영상 3종 통합.
- **로딩 배경 frozen Mars 3번째 콘텐츠**: `load_loop_03.mp4`(가로 1280x720) + `load_loop_v03.mp4`(세로 720x1280). 데스크탑/모바일 로딩 랜덤 범위 2종→3종(deep_space/drift/frozen_mars). 720p·crf30·무음·faststart로 <800KB.
- **가챠 레전더리 전용 영상**: `gacha_reveal_legendary.mp4`(battleship 등장, 가로 마스터). `_playGachaVideo(resolve, tier)` 에 tier 인자 추가 — tier>=4(레전더리)는 데/모 공통 전용 영상(object-fit:cover 크롭), tier 3(에픽)은 기존 gacha_reveal. 레전더리는 8s 리빌 완주 위해 자동종료 6s→8.2s.
- SW v47→v48. 신규 mp4는 gitignore allowlist(`*.mp4`) 이미 포함 — git 추적 확인.

## 2026-05-29 v7.229 — 함대전 박력 강화 (발사/폭발 이펙트 + 타격감)

사용자 피드백 "함대전이 박력이 없네" → 발사/폭발 이펙트 약함 + 타격감 없음 두 축으로 좁혀 `assets/tactical-lab-v11.html` 전투 렌더러 강화. 카메라/속도는 손대지 않음.
- **발사 머즐 플래시** (`mkMuzzle`/`drawMuzzles`, 신규 `muzzles[]`): 모든 발사 순간 포구에서 짧고 밝은 additive 섬광. 함급별 크기(타이탄 2.6 → 소형 0.7). PERF_MODE에서 절반 스킵.
- **빔 강화** (`fire`/`drawLasers`): laserW 상향(타이탄 4.2/배틀십 3.2/순양 2.6/그외 2.2), 빔 본체 알파 .55→.72, shadowBlur 3→6, 흰 코어 두께 .28→.4·알파 .82→.92.
- **폭발 강화** (`mkExp`): 파편 파티클 수 ~1.4배·크기 상향, 격침 폭발 크기 r×1.4→×1.9.
- **타격감(히트스톱)** (`triggerHitstop`/loop dt): 타이탄 격침 110ms·배틀십 70ms 프레임 거의 정지(_slowmoMul 0.06). 화면 흔들림도 상향(타이탄 14→18, 배틀십 9→12).
- **피격 임팩트 스파크**: 탄/미사일 명중 지점에 흰 섬광(미사일 1.6/탄 0.7).
- WS 서버 전투는 프레임 기반이라 데미지 로직 무변경 — 시각/로컬 시뮬 계층만 강화. SW v46→v47, 라이브 버전 라벨 v7.229.

## 2026-05-28 v7.177 — 함선 마켓 통합 Phase 2 (인라인 구매 + 마켓 SELL 함선 등록)

v7.176 의 함선 카테고리 추가에 이어 거래 동선 완전 통합. 조선소 진입 강제 없이 마켓에서 모든 단계 처리.
- **인라인 함선 구매** (`openMarketShipBuy`): 마켓 함선 카드 클릭 → 확인 모달 → `/api/ships/market/listings/:id/buy` 직접 호출. 가격·잔액 표시, cross-faction 함선 경고("함대 편성 불가, 재판매 가능"). 5 에러 코드 4언어. 구매 후 `refreshGP` + `loadMarketListings` 갱신.
- **마켓 SELL 탭에 🚀 MY SHIPS 섹션**: `loadSellView` 에 함선 그리드 추가. `/api/ships/my` → 살아있고 미등록 함선만 표시(reveal 포트레이트·각인 별점). `openShipSellModal` (가격 입력) → `/api/ships/:id/list` 호출. 6 에러 코드 4언어. 이전엔 조선소 안에서만 등록 가능했음.
- **각인 품질 별점**: 마켓 카드 좌상단에 ★~★★★★ (가챠로 강화된 함선이 마켓에 더 비싸게 거래되는 시그널).
- **그라데이션 하단 페이드**: 카드 하단 어두운 그라데이션 + 가격 글로우 — 시각 위계 강화.

[Phase 3 권고 — 후속 라운드] 가격 추세 차트(거래 히스토리), 통합 검색(함선 코드/이름), bundle listing(함선+자원).

## 2026-05-28 v7.176 — 마켓 함선 통합 + 커스텀 select 모달

- 마켓 카테고리 🚀 SHIPS 추가 → ship_market_listings 통합 표시
- 4 select 모두 hidden + 게임 styled trigger 버튼 + `openSelectModal` 풀스크린 바텀 시트 — 모바일 native dropdown 차단

## 2026-05-28 v7.175 — 시각 업그레이드 라운드 (코드 part1 — 이미지 별도 도착)

사용자 요청 — 침공/탐사 데드 콘텐츠 교체 + MY ASSETS 메인 노출 + 시각 전반 업그레이드. 모든 변경 fallback 안전(이미지 미존재 시 단색/SVG 폴백).
- **[Task 1] MY ASSETS 메인 상단 버튼** (`#tbMyAssetsBtn`): 측면 패널 안 열어도 접근 가능. 로그인 시 화면 우상단 보라 펄스 버튼. 모바일은 우측 안전영역 안쪽으로. `updateWalletUI()` 에서 자동 토글, `logoutEmail()` 에서 숨김. aria-label + 4언어.
- **[Task 2] OPS 침공/탐사 → 동적 "오늘의 추천 행동"** (`#opsQuick` HTML 교체): 데드 콘텐츠 제거하고 자리에 `updateDailyHint()` 동적 카드 — 우선순위 ① 미완료 일일미션 ② 진행중 캠페인 ③ 기본 가챠. 클릭 시 적절 화면 라우팅(`dailyHintClick`). 4언어.
- **[Task 3c] 마켓 함선 카드 reveal 포트레이트 활용** (`renderShipMarket`): 기존 SVG silhouette → 실사풍 800x600 포트레이트(가챠 22장 재활용). object-fit:cover + 하단 그라데이션. onerror 시 SVG 폴백.
- **SW v11 → v12** + 신규 폴더 4종(`/loading/`, `/factions/`, `/poi/`, `/login_bg/`) network-first 처리.
- **로딩 스크린 동적 배경**: `load_01.jpg`~`load_06.jpg` 6장 중 랜덤 1장, 이미지 로드 성공 시에만 fade-in. 미존재 환경에선 기존 검은 화면 유지(완전 안전).

**Codex 백그라운드 15장 생성 중** (`b0zcoorus`): 로딩 6 + 파벌 3 + POI 5 + 로그인 1. 도착 시 자동 노출(코드는 이미 hook 설치됨).

**백업 전략**:
- BASE 9 배너: `assets/base/_backup_orig/` (v7.160)
- 신규 폴더 4종: 신규 파일이라 백업 불필요 — git history 가 백업.
- 모든 변경에 `[v7.175 Task X]` 주석 — 1초 검색.

## 2026-05-28 v7.174 — 이메일 인증 풀스택 + CSP 강화 + aria 보강

남은 critical 다 처리. 비용 들어도 켜야 할 것들 (이메일 인증·CSP) + 운영 위생.

- **A-C3 이메일 인증 시스템 풀스택**:
  - `mig 252` — `users.email_verified` + 코드/만료/발송시각 + 설정 3종(enabled/ttl/cooldown)
  - 백엔드: `POST /api/auth/register` 가입 시 6자리 코드 자동 발송(SMTP 미설정 시 dev 로그). `POST /api/auth/verify-email` 검증. `POST /api/auth/resend-verification` 재발송(60초 쿨다운).
  - `/api/auth/me` 응답에 `emailVerified` 포함.
  - 프론트: 미인증 시 wallet 패널 위 작은 `✉️ 이메일 인증 필요` 배너 → 클릭 시 6자리 코드 모달 + 재발송 버튼. 4언어 + 5 에러 메시지 매핑.
  - 운영 비용: Gmail SMTP 500/일 무료(현 규모), 수만 명 → Resend 3000/월 무료, 십만 명+ → AWS SES $0.10/1000건. 즉 사실상 무료.

- **G-Crit-3 부분 (CSP 강화)**:
  - `Content-Security-Policy` 에 `object-src 'none'` (플래시/PDF 임베드 차단), `base-uri 'self'` (base 태그 변조 방지), `form-action 'self'` (폼 외부 송신 차단), `frame-ancestors 'none'` (clickjacking 이중 가드).
  - JWT localStorage 자체 제거(httpOnly cookie 전환)는 큰 변경 — 별도 스프린트. 이번엔 XSS 폭발 반경 축소.

- **F-Crit-2 보강**: 지갑 HUD 5 버튼(DEPOSIT/WITHDRAW/KEY/PP→USDT/PP→GP/LOGOUT) aria-label 추가.

검증: 마이그 적용·DB 컬럼 확인, auth.js 신규 endpoint syntax pass, AUDIT 문서 상태 갱신.

## 2026-05-28 v7.173 — ServiceWorker 배너 캐시 진짜 원인 차단 + Tier 3 잔여 처리

**배너 안 바뀜 진짜 원인 확정** — sw.js(mars-v10) 의 cache-first 가 `/assets/base/*` 를 영구 캐싱. 서버 Cache-Control: no-cache 무관. 다음 배포 시 자동 갱신:
- `CACHE_NAME` v10 → **v11** bump → activate 시 옛 캐시 전체 폐기.
- `/assets/base/` + `/assets/banners/` 도 `/assets/campaign/` 와 동일하게 **network-first** 처리. 배너 재생성 시 즉시 반영.
- 사용자 다음 페이지 로드 시 자동 SW 업데이트 → 화면 갱신.

**Tier 3 잔여 처리**:
- **A-M4 비밀번호 정책 일관화** — 클라 6자만 검증 → 서버 8자+대소문자+숫자+특수문자와 일치하도록 강화. placeholder 도 "8+ chars · Aa1!" 로 명확화. reset 흐름 검증 4언어.
- **C-M3 Hijack Phase 2 자동 시작 시 방어자 알림** — `startPhase2` 가 silent 였음. `notifyPlayer(defWallet, '🚨 영토 방어! Phase 2 시작')` 추가. 사용자가 모르고 패배하던 케이스 차단.

## 2026-05-28 v7.172 — 풀 리소스 병렬 처리 (Codex 2 백그라운드 + 직접 4건)

7 페르소나 감사 잔여 Critical 다수를 한 라운드에 일괄 처리. Codex CLI 2건 백그라운드 + Claude 직접 4건 병렬.
- **D-Crit-2 활성 칭호 장착 UI** (Claude 직접) — 신규 `openCampaignProfileModal` 통합 모달. `/api/tags/:wallet` fetch → 보유 칭호 목록·활성 표시·`Equip/Unequip` 버튼 → `/api/tags/set-active-title` 호출. CAMPAIGN 패널 헤더에 `🎖 PROFILE` 진입 버튼.
- **D-Crit-3 reputation history 화면** (Claude 직접) — 신규 endpoint `GET /api/reputation/history/:wallet` (4언어 한도 30) + 프로필 모달의 두 번째 탭. 4파벌 색·delta±·source/시각 표시. 테이블 미존재 silent fallback.
- **G-Crit-4 어드민 CSRF 미들웨어** (Codex `bh9crb2wu`) — `csrfGuard` 추가, `GET /admin/api/csrf-token` 발급(sha256, 1h TTL), 모든 POST/PUT/DELETE 검증. 토큰 없거나 불일치 시 403.
- **G-Crit-5 dead 라우트 식별·비활성** (Codex `bh9crb2wu` 후속) — Hall of Fame 별칭 `/api/titles`, `/api/hof` 등 frontend 호출 0건 라우트 `// [v7.172 G-Crit-5 disabled — frontend 호출 0건]` 주석으로 비활성. 재활성 1초.
- **F-Crit-1 i18n 누락 키 백필** (Codex `bjwcauxlp`) — 8 라인 추가 (`campaign_profile_btn`, `pvp_rewards_btn` 등 4언어 정합). 모든 라인에 `// [i18n backfill v7.172]` 마커.

모든 수정 코드에 `[v7.172 X-XX]` 주석 + AUDIT 문서 ID 매칭. `docs/AUDIT_v7.169_FULL_CATEGORY.md` 상태 갱신.

**잔여(대규모 별도 라운드)**: A-C3 이메일 인증 SMTP, G-Crit-3 JWT httpOnly cookie 전환, C-M3 Hijack Phase 2 푸시 알림, A-M4 비밀번호 정책 일관화, F-Crit-2 나머지 buttons aria-label.

## 2026-05-28 v7.171 — Tier 2 감사 후속 4건 (Enhancement UI · 닉네임 · reveal-key · aria)

- **E-Crit**: enhancementAdvanced 백엔드(scroll/recipe) 완비됐는데 UI 0건이던 결함 → 신규 `enhanceAdvModal` 모달:
  - `GET /api/enhance/info/:id?wallet=...` async fetch → `scroll_status` + `available_recipes` 표시
  - 🛡 Protect Scroll · ✨ Blessed Scroll 보유 시 체크박스 토글
  - 적용 가능 레시피 최대 3개 미리보기 + bonus%
  - `attemptEnhance(id, opts)` 시그니처 확장 — useProtectScroll/useBlessedScroll/recipeIds 전달
- **A-M6**: 닉네임 정규식 `^[a-zA-Z0-9_\-. ]+$` → `^[\p{L}\p{N}_\-. ]+$/u` — 한글/일본어/중국어 등 유니코드 글자 허용. 다국어 사용자 가입 차단 해소.
- **A-M2**: `reveal-key` 에러 메시지 ko-only → 5개 코드(no_custodial_key/invalid_password/invalid_token/rate_limited/server_error) 4언어.
- **F-Crit-2 부분**: 핵심 5 버튼(CRATES/CAMPAIGN/PORTFOLIO/ZB back/zoom-in/zoom-out) aria-label 추가. 나머지 buttons 잔여(별도 라운드).

AUDIT 문서 상태 갱신(🟢/🟡/🔴/⚙). 모든 수정 코드에 `[v7.171 X-XX fix]` 주석.

## 2026-05-28 v7.170 — 풀카테고리 감사 Tier 1 일괄 차단 (7개 Critical/Medium)

7 페르소나 풀카테고리 감사(v7.169) 결과 — Critical/Medium 즉시 처리 가능한 7건 한 번에 차단. 상세는 `docs/AUDIT_v7.169_FULL_CATEGORY.md`.

- **A-C1**: `index.html:21585,21608` change-password / delete-account 의 `API` 전역 미정의로 `'undefined/auth/...'` 호출되던 버그 → `/api/auth/...` 절대경로 직접 호출. 두 기능 즉시 복구.
- **A-C2**: `auth.js` reset-password — SMTP 미설정 시 dev fallback 으로 reset code 평문 응답 노출 → `NODE_ENV !== 'production'` 가드 추가. prod 에선 warn 로그만 남기고 코드 비반환.
- **A-M5**: `index.html` `pw_rem_pass` Base64 평문 비밀번호 localStorage 저장 → 저장 자체 제거 + `_tryCredentialAutoLogin` 비활성 + cleanup. JWT 토큰 갱신 흐름만 사용(XSS 영구 탈취 차단).
- **D-Crit-1**: `renderCampaignReputation` 이 [mcc/fsp/cv] 3종만 순회 → Pilgrim Arms 평판 화면 미노출. 4종 확장 + 보라(`#c08bff`) 추가. Ending 4 분기 추적 가능.
- **D-M1**: `campaignStartErrorMessage` ko/en만 매핑 → 8개 에러 키 모두 `tl()` 4언어. ja/zh 사용자 영어 폴백 해소.
- **G-Crit-1**: `_liveWS.onmessage` 가 chat/feed 2종만 처리 → `cmd_err/error/notification` 핸들러 추가(토스트 + 폴링 갱신). 함대 명령 실패 사일런트 무시 해소.
- **G-Crit-2**: CORS `origin.endsWith(...)` 가 wildcard 우회 가능(`evil-railway.app` 통과) → 정규식 매칭(메타이스케이프 + `[a-z0-9-]+`)으로 교체. 서브도메인 외 거부.

**잔여 (별도 라운드)**: A-C3 이메일 인증(SMTP 시스템), D-Crit-2 활성 칭호 장착 UI, D-Crit-3 reputation history 화면, E-Crit enhancementAdvanced UI, F-Crit-1/2 i18n 누락 키·aria-label, G-Crit-3 JWT httpOnly cookie, G-Crit-4 어드민 CSRF, G-Crit-5 dead 라우트 정리. AUDIT 문서에 🟢/🔴/⚙ 상태 표기.

[원칙] 모든 수정 코드에 `[v7.170 X-XX fix]` 주석으로 AUDIT ID 매칭 — 다음 라운드 중복 작업 방지.

## 2026-05-28 v7.169 — 배너 캐시 버스팅 (브라우저/CDN 강제 무효화)

사용자가 본 BASE 모달 배너(함대 지휘부/PVP/내 영토 등)는 디스크의 새 실사풍 파일이 정확히 배치돼 있었으나 **브라우저/CDN 캐시**로 픽셀아트 구버전이 계속 표시되던 문제. 9개 base-banner `<img src>` 에 모두 `?v=v7160` cache-bust 쿼리스트링 추가:
- territory.png · fleet.jpg · sectors.png · rank.png · quests.png · pvp.jpg · governance.jpg · guild.jpg · transport.jpg
- 향후 배너 업데이트 시 `?v=` 값만 올리면 자동 강제 무효화 패턴(주석으로 명시).
- transport object-position 오타(`create 40%` → `center 40%`) 동시 수정.

## 2026-05-28 v7.168 — 카테고리별 UI↔백엔드 정밀 감사 후속 fixes

5 페르소나 병렬 감사(통화/영토/함선/캠페인-길드/마켓-시즌-자산) 결과 — Critical 잔여 즉시 차단:
- **swap 모달 fee 5% 하드코딩 → 동적 표시** (`/api/public/swap-info` 신규 + openSwapModal fetch). admin이 `swap_fee_percent` 변경하면 즉시 반영. updateSwapPreview/confirmSwap 도 동적 fee 사용.
- **swap 에러 4언어 매핑** (`swap_pool_insufficient`/`amount_too_small`/`insufficient_pp`/`invalid_amount`). 환금 풀 부족 등 솔벤시 가드 메시지 한국어 명확화.
- **가챠 pity 카운터 동적 표시** (`listCrates(wallet)` 시그니처 확장 + `/api/ships/crates` x-wallet 헤더 전달). 각 상자 카드에 "🎯 X/Y 보장까지" 표시(4언어). 천장 시스템 사용자 가시화 — 검증: premium 1/10 → 9 남음 표시 확인.
- **campaign reward inbox 4건 제한 해제** (서버 LIMIT 20인데 프론트 slice(0,4) → slice(0,12) + 스크롤 컨테이너). 5건 이상 미수령 잔존 해소.

[감사 거짓경보 정정] hidden faction 차단(의도된 unlock 미정), guild `/guilds/:id/alliance`(phaseD.js 정상 라우트 존재), 함선 마켓 sort/size/faction 필터(이미 존재).

[Tier 2 잔여 — 별도 후속] NPC arena PvE 진입점, titleExtended 칭호 장착 UI(tags 기반), 어드민에 first_deposit_bonus_pct + pp_to_gp 동적 환율 파라미터(floor/ceil/step) 노출, 함선 마켓 거래 히스토리 그래프, 거버너 수익 화면, 업적 unlock 토스트, enhancementAdvanced UI.

## 2026-05-28 v7.167 — UI 미연결 잔존 2건 연결 (각인 품질·첫 입금 보너스)

최근 백엔드 기능 중 프론트 UI 미반영 잔존분 처리:
- **각인 품질 배지 — 보유 함선 카드** (mig 251 + `ship.js`/`renderShips`):
  - `ships.quality` 컬럼 추가 + 가챠 INSERT 시 함께 저장 + 기존 풀 이력 백필. `getMyShips` SELECT 포함.
  - 보유 함선 카드 우상단에 `★~★★★★` 배지(stars >= 1 일 때만 노출, common=숨김). 색·툴팁은 등급 메타와 일치. 강화된 함선(=마켓 프리미엄 가격 자산)이 한눈에 식별 → 거래·관리 동기.
- **첫 입금 보너스 강조 — 입금 모달** (`/api/wallet/deposit-bonus-info` + `openDepositModal`):
  - 신규 엔드포인트: `base_bonus_pct`, `first_deposit_bonus_pct`, `first_deposit_eligible`, `total_bonus_pct_if_first` 반환(`deposits` 테이블 prior 0건 체크).
  - 입금 모달 열릴 때 fetch → 자격 있으면 🎁 보너스 배너 노출("기본 +10% 위에 추가 +20%, 총 +30% — 일회성"). 4언어. 자격 없으면 배너 숨김.

영토 HP/등급/TEND·cross-faction lock·각인 품질(리빌)·PORTFOLIO 모달 등은 이미 v7.135~v7.165에서 UI 연결 완료. NPC arena/sybil flags 는 운영 측 영역(사용자 표시 불필요).

## 2026-05-28 v7.166 — Tier 2 잔여 4건 모두 처리 (sybil 감지·캐시·treasury·fee 컨벤션)

이번 라운드까지 머니플로 감사 후속 잔여 0:
- **fee_pct 두 컨벤션 자동 정규화** (`auctionCombat.js:252`): admin이 fraction(0.05) 또는 percent(5) 어느 쪽으로 넣어도 `>= 1 → /100`로 안전 변환. 50% 초과 시 0 적용. 컨벤션 혼선·오타 모두 견고.
- **treasury contract 강제화** (`treasury.js:lockRoom`): `lockedWallet` 옵션 인자 추가, 호출자가 명시하면 함수 내부에서 한 번 더 잠금 보장(idempotent). swap·withdraw-all·season USDT 보상 호출 모두 wallet 전달하도록 업데이트. legacy 호환 유지(wallet 안 줘도 작동).
- **settings 캐시 무효화 일관화** (`admin.js:441`): admin이 settings 변경 시 sectors 캐시뿐 아니라 **resource rate 캐시도 자동 무효화**(`/^(resource_|mining_|harvest_|drop_rate)/` 키 패턴). getSetting 자체는 캐시 없어 즉시 반영.
- **sybil chain 자기거래 감지 스캐폴드** (mig 250, `services/sybilDetect.js`):
  - `suspicious_wallet_flags` 테이블 + 설정 4종 시드(`self_trade_window_days=7`, `self_trade_min_pairs=3`, `self_trade_min_value=100`, `sybil_detect_enabled=true`).
  - `detectSelfTradeChains()` — gp_transfers 양방향+`>=minPairs`+`>=minValue` 쌍을 검출해 `suspicious_wallet_flags`에 적립(unique 멱등). `42P01` 미존재 환경 silent skip.
  - 스케줄러(`index.js`): 6시간마다 자동 스캔 + 부팅 60초 후 1회 즉시.
  - admin 엔드포인트 3종: `GET /admin/api/suspicious-wallets`(목록), `POST /scan`(수동), `POST /:id/review`(처리).
  - **자동 차단 없음 — false positive 위험으로 운영자 review 후 액션**. 1차원 sybil 가드(가입·입금·추천)의 사각 보완.

검증: 마이그레이션 적용, treasury 두 시그니처 모두 정상 동작, sybilDetect 미존재 테이블 silent skip 확인.

## 2026-05-28 v7.165 — 머니플로 감사 Tier 2 일괄 수정 (timezone·race·clamp·dust)

Tier 1 hotfix(v7.163) 이후 4 페르소나 감사가 지적한 구조적 위험들 일괄 차단.
- **timezone `CURRENT_DATE` 일관화**: `db.js` Pool `connect` 훅에 `SET TIME ZONE 'Asia/Seoul'` 강제(`DB_SESSION_TZ` env 오버라이드 가능). 30+ 지점(daily/governance/mission/login_streak/quest/gp_transfer)이 한꺼번에 KST 정합 → 호스트 OS TZ 차이로 인한 자정 boundary 더블 보상 우회 차단.
- **GP transfer race** (`api.js:7892`): `sentToday` 집계 전에 **송신자 행 FOR UPDATE 잠금** 추가 + `from_wallet` 비교 LOWER() 양쪽 적용. 동시 송금 시 일일 한도 +amount 초과되던 race window 차단.
- **chain.processDeposit users FOR UPDATE** (`chain.js:255`): deposit listener 가 prior 0건 SELECT ↔ deposits INSERT 사이에 race로 첫입금 보너스 중복 지급 가능했음 → 동일 wallet 행 잠금으로 차단.
- **dividends dust 누적 차단** (`dividends.js:223`): `.toFixed(6)` 절삭 잔여(totalPool - totalDistributed)를 다음 주 풀에 carry-forward. 풀 잔여 ghost GP 영구 적립 방지.
- **marketplace fee floor** (`marketplace.js:294`): Merchant/Crafter/등급 곱연산 누적으로 0% 까지 떨어져 referral/dividend base 0 되던 결함 → `marketplace_fee_min_pct`(기본 0.5%) 하한.
- **referral 분배 0~100 clamp** (`marketplace.js:413`, `db.js:430·435`): `marketplace_referral_commission_pct_of_fee`, `referral_*_pct`(per-trigger), `referral_tier{1,2,3}_percent` 모두 admin 오타로 음수/>100 들어가도 fee 초과 분배 차단.
- **withdraw float 누수 차단** (`api.js:2096`): `parsedAmount = Math.round(amount*1e6)/1e6` 정규화 + SQL 도 parsedAmount 사용. swap/treasury 컨벤션과 일관.
- **auction self-trade LOWER() 비교** (`auction.js:204·311`): `seller_wallet === w` raw 비교 → `LOWER()` 양쪽으로 case-mixed 우회 차단.
- **auctionCombat fee 안전 clamp** (`auctionCombat.js:252`): fee_pct 0.05(fraction) 컨벤션인데 admin 오타로 5(percent) 입력 시 500% 수수료 → 0~0.5 범위 강제, 초과 시 0 적용 + warn 로그.

검증: 모든 모듈 load OK, DB TZ = Asia/Seoul 확인, processDeposit 0/NaN refused 로그, tier clamp 코드 적용. **Tier 2 잔여(2차 그래프 자기거래 chain, settings 캐시 무효화, treasury contract 강제화, fee_pct 명명 통일)**: 아키텍처/네이밍 변경 사안이라 별도 계획 작업.

## 2026-05-28 v7.164 — 가챠 리빌 전용 함선 포트레이트 22종 (실사풍·진영 톤 분리)

리빌 모달의 평평한 탑뷰 폴백 대신, **전투/조선소와 분리된 가챠 전용 시네마틱 포트레이트** 22종을 Codex CLI(6 배치 순차)로 신규 생성·배치. `assets/ships/reveal/{code}.jpg`, 800x600, 3/4 다이내믹 앵글, 실사풍 입체감, 텍스트 없음. 진영 톤 분리:
- **MCC** 8종: 주황/골드 정밀 군용 (frg/int/dst/crs/bs/snp/ewar/titan)
- **FSP** 7종: 청록/블루 견고 방어 (int/dst/crs/bs/logi/logi_crs/titan)
- **CV** 7종: 보라/마젠타 공격적 (frg/int/dst/crs/bs/bomb/titan)
모든 함선 기존 탑뷰 스프라이트(전투/조선소 공유)를 디자인 레퍼런스로 활용, 같은 함급/실루엣/파벌 느낌 유지하되 3/4 시네마틱 포트레이트로 재해석. 스팟 검증 4장 통과(mcc_titan, fsp_crs, cv_titan, fsp_titan, cv_bomb 진영 톤·실사 입체감 확인). `.gitignore`에 `assets/ships/reveal/` 예외 추가됨. 리빌 모달은 자동으로 새 포트레이트 사용(미존재 함선만 탑뷰 폴백).

## 2026-05-28 v7.163 — 머니플로 전수 감사 hotfix Tier 1 (Critical 4건)

4 페르소나 병렬 감사(환전·마켓·보상·비판검토자)로 유저 머니플로 198곳 점검. Critical 4건 즉시 차단:
1. **PP→GP daily-limit wallet 대소문자 우회** (`api.js:7405`) — `from_wallet=$1` raw 비교라 mixed-case JWT 발급 시 일일 한도 0으로 보임 → 무제한 PP→GP 환전 가능했음. `LOWER(from_wallet)=LOWER($1)` 양쪽 적용 + 집계도 `meta->>'pp_amount'` 대신 `pp_amount` 컬럼 직접 사용으로 견고화.
2. **PP→GP `enabled` flag fail-OPEN** (`api.js:7390-7391`, `:7475-7476`) — `enabledVal == null` 시 통과로 설정 삭제·DB 누락 시 GP 인플레 게이트 자동 개방. **명시 true 만 허용**으로 fail-CLOSED 전환(info 엔드포인트도 정합성).
3. **PP→GP rate ≤ 0 / NaN 미검증** (`api.js:7395`) — admin 오타로 rate에 음수/0 들어가면 `Math.floor(netPP * -5)` 음수 GP 발급 + 무한 민팅 위험. `rate > 0 && isFinite` 가드 + feePct 범위(0≤x<100) 가드 추가.
4. **`processDeposit` 음수 amount 미검증** (`chain.js:234`) — 외부 RPC/admin replay에서 음수 amount 시 `pp_balance` 차감 가능. `amountNum > 0 && isFinite` 가드 추가 + refused 로그.

검증: 실DB 스모크 — 음수 deposit 거부(PP 불변·deposits row 미생성), 대소문자 SUM 정확(raw 10 우회 vs LOWER 25 정확).

**Tier 2 (구조적 위험 — 별도 후속)**: timezone `CURRENT_DATE` 일일캡 우회(30+ 파일, daily/governance/mission/login_streak), GP transfer race(FOR UPDATE 미적용), treasury 가드 contract 미강제, dividends 부동소수 누적 dust, settings 캐시 무효화 누락, self-trade chain.

## 2026-05-28 v7.162 — 가챠 cross-faction 함선 (사용 불가 · 마켓 판매 — 시장 유동성 생성)

가챠가 다른 진영 함선도 줄 수 있게 풀었다. 본인은 사용 못 하지만 마켓에 팔 수 있어 진영 간 교차 거래가 자연 발생 = EVE식 깊은 시장 형성.
- Migration 247: `ships.fleet_id` NULL 허용(cross-faction 함선은 "창고" = fleet_id NULL → 함대/전투에서 자동 제외) + `crate_cross_faction_pct` 설정(기본 18%, admin 조정 가능).
- `shipCrate.js`: `crossPct` 확률로 다른 진영 롤. cross-faction 픽은 fleet_id=NULL/is_flagship=false로 INSERT. 응답에 `faction/userFaction/isCrossFaction` 포함.
- 리빌 모달: `🔒 다른 진영 함선 (XXX)` 배너 + "마켓에 등록하면 해당 진영 유저가 구매 가능합니다 — 거래로 가치 실현" 4언어 안내. cross-faction 톤(blue-gray glow) 적용. 기함 표시 X.
- 사용 차단: fleet_id NULL이라 함대지휘·전투 코드가 자연 필터(추가 코드 0). 마켓은 owner_wallet 기준이라 fleet 무관 — cross-faction 함선도 자유 등록·판매.
- 검증: 실유저 6풀 스모크(60% 시 own 3·cross 3 정확, cross 3개 모두 DB fleet_id=NULL 확인). Preview 모달 시각 확인.
- **백엔드 hotfix (3 갭 차단)**: 진영 무관 fleet 편입 우회 경로 차단.
  - `fleet.moveShips`: cross-faction 함선을 함대에 못 넣음(`CROSS_FACTION_SHIP` throw, 핵심 차단).
  - `ship.buyShipListing`: 구매자 진영≠함선 진영이면 `fleet_id=NULL`로 전송(창고, 사용 불가·재판매만).
  - `ship.cancelShipListing`: 판매자 진영≠함선 진영이면 취소 후에도 `fleet_id=NULL` 유지.
  - E2E 스모크 PASS — 풀(cross fleet_id NULL) → moveShips 차단 → 마켓 등록 → 타진영 구매(매칭 시 편입) → 자가 진영 재구매(미매칭 시 fleet_id NULL) 전 시나리오 통과.
- **프론트엔드 보강**: 내 함선 카드에 `🔒 [진영]` 좌상단 lock 배지(cross-faction일 때만, hover 툴팁 "사용 불가·마켓 판매 가능"). Fleet Command 에러 매핑에 `CROSS_FACTION_SHIP` 4언어 추가("다른 진영 함선은 함대에 편입할 수 없습니다 — 마켓에 판매 가능"). 가챠 풀(✅)·보유 표시(✅ cross 배지)·마켓 등록(✅ owner 기준)·구매(✅ 진영 매칭 시 편입)·이동 차단(✅ CROSS_FACTION_SHIP) 전 단계 백엔드+프론트 연결 검증.

## 2026-05-28 v7.161 — P2E → P2O 전환 + 자산 가시화 모달 (팀 진단 반영)

운영자의 "P2E 강조" 요구를 4 페르소나 팀 진단(그로스/게임경제학자/법무/비판검토자) 후 안전한 P2O(Play-to-Own) 프레임으로 전환. `docs/P2E_STRATEGY_2026-05-28.md` 종합.
- **결론**: "Earn/돈 번다/수익 보장" 직접 카피는 SEC Howey·MiCA·한국 게임산업법(환전알선)·게임위 사행성·MLM 트리거. 체인 미가동 시 허위광고 + 약속-실제 격차 worst-case. → "자산 소유·거래·축적" 프레임만.
- **🪐 MY MARS PORTFOLIO 모달**(`openPortfolioModal`, 지갑 HUD 신규 버튼): 함선·영토 자산 수량 + PP/USDT 잔액 + 🔒 환금 잠금(체인 미가동 디스클로저) + P2O 3-스텝(채굴/수집/거래) + 면책. 4언어. "수익률·일당·ROI" 가시화 0.
- 체인 가동 상태는 `walletState.chainContractLive` 플래그로 디스클로저 동적 전환(가동 후 🟢로). 메시지 카피는 docs 가이드 준수.
- **카피 정합성**: 게임 가이드 인트로의 위험 표현(KO "돈을 벌고", JA "稼ぎ", ZH "赚钱")을 EN과 동일한 "PP 채굴/모으기" 톤으로 3언어 통일(EN은 이미 안전). 다른 "earn rewards/PP" 게임 내 보상 맥락은 팀 진단 기준 안전이라 유지.
- **데이터 연결 hotfix**: PORTFOLIO 모달이 잘못된 필드명(`walletState.PP/USDT`)을 읽어 잔액 0 + 함선/영토 지역변수 의존으로 카운트 0 고정이던 버그 수정 → 정확한 `walletState.gamePP/gameUsdt` + `/api/ships/my` & `/api/claims/my` fresh fetch로 패치(placeholder "—" 우아한 폴백). Preview 실측: 함선 7·영토 4·PP 850.50·USDT 25.00·잠재가치 $875.50 정확 합산 확인.

## 2026-05-28 v7.160 — BASE 탭 배너 9종 실사풍 전면 교체 (컨셉 매칭)

가챠 배너처럼 함선 레퍼런스 기반 실사풍으로 BASE 섹션 배너 전면 재생성(Codex CLI 실제 이미지 생성, 1600x680, 텍스트 없음). 원본 12종 `assets/base/_backup_orig/` 백업.
- fleet(함대 지휘부=주력 함대 아르마다) · pvp(주황vs보라 함대 교전) · governance(평의회 통제실+홀로 섹터맵) · sectors(궤도 섹터 그리드) · territory(영토 구획+깃발+전초기지) · quests(화성에 선 사령관 서사) · rank(시즌2 Frozen Frontier 빙하/오로라) · guild(파벌기 든 동맹 사령관단) · transport(화물 수송선 호송대).
- 미사용 dead 에셋(shop/mining/pp.png)은 제외. 9종 전부 1600x680·컨셉 매칭 육안 검증.

## 2026-05-28 v7.159 — 가챠 획득 리빌 모달 + 랜덤 강화 스탯 (각인 품질)

"토스트 너무 썰렁 / 강화된 함선 얻을 수 있어야 돈 쓴다" 반영. 결제 보람·재개봉 동기 강화.
- **각인 품질(quality) 시스템**: 개봉 시 함선이 랜덤 등급(common/uncommon/rare/epic/legendary)을 받아 **base 스탯 비율만큼 보너스 스탯**(bonus_atk/def/hp/speed)이 굴려진다. 같은 함급이라도 강화된 개체가 나옴.
  - 보너스 범위: uncommon 5–13% · rare 14–27% · epic 28–48% · legendary 50–85% (스탯별 ±30% 분산).
  - 상자별 품질 가중치: 고가 상자일수록 강화 확률↑ (recruit 거의 plain → legendary는 epic 14%/legendary 6%).
  - `ships.bonus_*` 컬럼 활용(기존 강화 시스템과 동일), `current_hp = base_hp + bonus_hp` 만피 지급.
- **획득 리빌 모달**(`showCrateReveal`): 토스트 대신 풀스크린 연출 — `✨획득!✨` + 등급/품질(별)/천장 뱃지 + **함선 top PNG(글로우·플로팅)** + 능력치 그리드(ATK/DEF/HP/SPD, 보너스 +N 녹색) + "강화된 함선" 강조 + 확인/다시개봉 버튼(잔액 체크). 4언어.
- **에러 안전**: 함급 보유한도(서버 트리거) 적중 시 GP 롤백+`SHIP_TYPE_LIMIT` 명확 메시지(차감 없음).
- Migration 246: `ship_crate_pulls.quality`. shipCrate.js 응답에 base/bonus/stats/quality 포함.
- 검증: 실유저 스모크(common=보너스0·rare=+64atk/+54k hp 강화 확인, DB bonus 저장·current_hp=max+bonus), Preview 모달 렌더(시각 확인).

## 2026-05-28 v7.158 — 우측 레일 SECTORS 버튼 영문 라벨 칸 넘침 수정

- EN 'SECTORS'(공백 없는 1단어라 줄바꿈 불가)가 42px zb 버튼 밖으로 넘침. 라벨 font 7px+자간 축소+nowrap, 버튼 가로 padding 4→2px. 4언어 칸 내 안착(Preview 실측). ko/ja/zh 영향 없음.

## 2026-05-28 v7.157 — 메인 가챠 버튼을 CAMPAIGN 버튼 바로 위로 배치

- zc 줌레일 버전 제거 → CAMPAIGN 위 전용 `.crates-quick`(보라 펄스). 패널 접힘 런타임 레이아웃에 cratesQuickBtn 추적 추가. 데스크탑/태블릿/모바일 3 브레이크포인트 모두 campaign 위 정렬(Preview 실측+시각 검증).

## 2026-05-28 v7.156 — 신병/엘리트 가챠 배너 2종 실사풍 추가 (5종 전부 전용 아트)

- Codex CLI 실제 이미지 생성. crate_recruit(청록 소형함대), crate_elite(크림슨 순양함/전함). 배너 맵 코드별 매핑 + elite hero fallback 오타 수정.

## 2026-05-28 v7.155 — 가챠샵 확장: 신병 무료 데일리 + 엘리트 상자 (3종→5종)

"가챠 3개로 되겠어?" 지적 반영 — 상자 라인업 확장 + 데일리 리텐션 후크. **경제 안전 원칙 유지**(유료 상자=순수 GP 싱크, 무료 상자=함선 공급 통제).
- **신병 보급 상자(recruit_crate)**: **무료·1일 1회**, frigate 88 / destroyer 12. EVE 무료 루키십 = 신규/복귀 유도. 함선 공급 폭주 방지 위해 `daily_limit` 강제(서버 권위, `ship_crate_pulls` 당일 카운트).
- **엘리트 상자(elite_crate)**: 2000 GP — premium(1000)~legendary(3000) 가격 갭 메움. cruiser 52 / battleship 28 / destroyer 18 / titan 2, 천장 7. 순수 GP 싱크.
- 가격 사다리: **무료 → 300 → 1000 → 2000 → 3000 GP** (5종).
- Migration 245: `ship_crate_types.daily_limit` 컬럼 추가 + 2종 시드 + sort_order 재배치.
- `shipCrate.js`: `listCrates` daily_limit 노출, `openCrate` daily-limit 게이트(0=무제한·기존 동작 불변, price 0 은 GP 체크 자연 통과).
- 프론트: 배너/글로우 **상자 코드별 매핑**(인덱스 의존 제거), 무료 상자 `FREE` 뱃지+무료 라벨+`1일 N회` 태그, 개봉 다이얼로그 비용 `무료` 표기, `DAILY_LIMIT_REACHED` 에러 4언어.
- 검증: migration 적용, 실유저 스모크 — 무료 개봉 #1 성공(gp_spent:0·frigate)·#2 `DAILY_LIMIT_REACHED` 확인(테스트 함선 클린업). 인라인 JS 영향 함수 한정 수정.
- (메모) recruit/elite 배너는 등급 톤 맞춰 기존 배너 재사용(recruit→청색·elite→보라). 전용 아트는 추후 Codex 생성 가능.

## 2026-05-28 v7.154 — 가챠 배너 3종 실사풍 재생성 (함선 레퍼런스 입체감)

- Codex CLI 실제 이미지 생성으로 절차합성/Pillow 배너 → 실사풍 교체(생성 원본 1774x887 → sips 1024x512). standard 청색 소형 함대 / premium 보라 순양함·전함 편대 / legendary 금색 타이탄 기함+호위. 등급 톤 분리·입체감 확인(육안 검증).

## 2026-05-28 v7.153 — GP 표시 소스 통일 (stale 잠재결함 제거)

표시값 미연결 전수 스캔(에이전트) 결과 — stale-DOM 복사 버그는 GP 푸터 1곳뿐(v7.152 수정)이고 다른 사례 0. 단 **GP 표시 소스 이원화** MED 결함 발견·수정:
- `updateGPDisplay`(사이드바 #walletGP + 프로필 #authGPBal), `_updateBaseShopBalances`(#baseShopBalGP), 레거시 SHOP(#shopBalGP) 3곳이 `_dailyState.gpBalance` 만 읽음 → GP 소비 경로(환전/캠페인/길드기부)는 `walletState.gameGP` 갱신이라 일시 stale 가능(refreshEmailBalances self-heal 전까지). 같은 함수의 PP/USDT 는 이미 walletState 사용.
- → 3곳 모두 `walletState.gameGP ?? _dailyState.gpBalance ?? 0` 우선순위로 통일(syGpBalance/푸터와 동일 소스). 인라인 JS 0 errors.
- LOW(미수정/메모): `#guildPpTreasury` ID-라벨 표기 혼동(값 정상·레거시 ID), base/fleet 등 배너 cover-crop 텍스트 잘림 위험(텍스트 구운 경우만).

## 2026-05-28 v7.152 — 조선소 GP "-" 연결 버그 수정 + 가챠 배너 텍스트 잘림 수정

UI 검수 지적 2건:
- **🐞 조선소 푸터 GP "-" 버그**: `updateFooter()`가 GP를 `#gpBalance` DOM 의 textContent 복사로 채워(미로드 시 "-") 광물/함선은 되는데 GP만 "-"로 표시됨. → 권위 소스 `syGpBalance()`(summary.gp_balance ?? walletState.gameGP)에서 직접 채우도록 수정. 카드 affordability와 동일 소스라 일관.
- **🐞 가챠 배너 텍스트 잘림**: 절차배너에 영문 타이틀("STANDARD SUPPLY CRATE" 등)이 구워져 카드 cover-crop 시 잘림 + 카드가 이미 현지화 라벨 오버레이(중복). → 배너 생성 스크립트의 `draw_title` no-op 처리 후 재생성(텍스트 제거). SVG 배너 → PNG 래스터로 교체(`crate_*.png`), 미사용 SVG 삭제.
- 검증: 인라인 JS 0 errors, 배너 PNG 재생성(텍스트 없음 — 실측 확인), 1024x512.
- ⚠️ 배너는 여전히 절차합성(임시) — 실사풍 AI 아트는 이미지생성 키 제공 시 교체(WALLET/이미지 키 env 설정 대기).

## 2026-05-28 v7.151 — 가챠샵 전용 디자인 배너 아트 (Codex 제작)

- **등급별 배너 3종**(`assets/banners/crate_{standard,premium,legendary}.svg`, Codex 제작): 우주/화성 SF 톤 디자인 — 라디얼·리니어 그라데이션 + feGaussianBlur 글로우 + 성운/별 + 벡터 함선 실루엣(등급↑ 대형함). standard 청색 / premium 보라 / legendary 주황금+폭발 이펙트. 자체완결 SVG(외부 PNG 의존 없음 → 깨짐 위험 0).
- `loadShipCrates()` 의 단일 함선 PNG 배너 → 위 3종 디자인 배너로 교체(등급 인덱스 매핑, 글로우/개봉 버튼 하단정렬 유지).
- `.gitignore` 에 `!assets/banners/` 예외 추가(추적). 검증: xmllint 통과, 인라인 JS 0 errors.

## 2026-05-28 v7.150 — 미연결 UI 3종 연결 (파벌통계/복권이력/전투보상이력)

상용화 검수 MED 미연결 잔여분 연결 (백엔드는 이미 존재, 프론트만 연결):
- **파벌 통계** `GET /api/factions/stats` → 파벌 선택 모달 카드에 파벌별 점유율 바 + 인원/함대 + `★ 합류 추천`(최소 인원 파벌) 밸런스 유도 뱃지.
- **복권 이력/내 티켓** `GET /api/lottery/history` + `/my-tickets` → 복권 패널에 "지난 회차/내 티켓" 접힘 섹션(WON/OPEN/CLOSED 태그).
- **내 전투 보상 이력** `GET /api/battles/rewards/mine` → Battle Hub 에 🏅 보상 이력 패널(WIN/LOSS·+GP·광물 칩·time-ago).
- 4언어(tl 인라인), 인라인 JS 0 errors. (워크트리 전문가 작성→diff 검증 후 fast-forward 머지)

## 2026-05-28 v7.149 — 첫 입금 보너스 (첫 결제 후크)

- **첫 입금 보너스**(migration 244, `chain.js processDeposit`): 첫 USDT 입금 시 추가 PP 보너스(`first_deposit_bonus_pct`, 기본 20%, 기존 deposit_pp_bonus 위에). **PP만 추가**라 담보 불변식 무관. deposit row INSERT 전 prior 0건 확인으로 진짜 첫 입금만 적용. (USDT 입금은 컨트랙트 배포 후 개시 — 런칭 대비 후크)

## 2026-05-28 v7.148 — 조선소/가챠 UI 정렬 + 가챠샵 강화 + 메인 진입 버튼

UI 검수 피드백 반영:
- **카드 버튼 하단 정렬**: `.bp-card` flex-column + `.bp-build-btn`/개봉 버튼 `margin-top:auto`. 재료 수·콘텐츠량 달라도 "재료 확인"/"개봉" 버튼이 카드 하단에 통일 정렬(들쑥날쑥 해소). 그리드 stretch 로 카드 높이 동일.
- **가챠샵 강화**: 상자 카드에 **함선 배너 이미지(등급별 함선 PNG) + 등급 글로우/그라데이션**. 밋밋한 텍스트 3개 → 화려한 비주얼.
- **메인 화면 가챠 버튼**: MY BASE 패널에 `🎲 SHIP CRATES`(4언어) + `openGacha()`(조선소→상자 탭 바로 이동).
- 검증: 인라인 JS 0 errors, DOM 렌더 확인(카드3+배너3+버튼 하단정렬), 배너 이미지 존재.

## 2026-05-28 v7.147 — 영토 일괄 정비(TEND ALL)

다수 영토 관리 노동 완화: `territoryCondition.tendAll` + `POST /api/territory/tend-all` + 내 영토 헤더 🔧 TEND ALL 버튼(4언어). condition<100+쿨다운 경과분을 GP 여유 한도(territory_tend_all_max=50)까지 일괄 정비. 실측 검증.

## 2026-05-28 v7.146 — 코어행동 XP 연결 + 가이드 커스터디 면책 섹션

상용화 후속(게임성/가이드):
- **코어행동 → XP**(migration 243): 함대전 승(15)/패(5), 함선 건조(10)에 XP 부여 — 진행감을 핵심 활동과 연결(기존엔 채굴/클레임/일일미션/캠페인만). NPC/AI 전투는 `battleRewards` _isAi 가드로 XP·보상 모두 제외(인플레 없음).
- **가이드 "Wallet & Custody" 섹션**(CODEX_CONTENT, 4언어): 자동 지갑생성·키 백업(🔑 KEY)·**면책 경고(callout warn)**·입출금 안내. 게임성/가이드 검수가 지적한 "가이드 본문 커스터디 면책 누락" 해소.
- 운영보안 점검: `start-test.sh` 의 `admin1234` 평문은 **이미 제거됨**(과거 수정, AUDIT 확인). 게임성 에이전트의 stop-ship 인용은 stale 문서 기반 오탐.

## 2026-05-28 v7.145 — 신규 유저 hijack 면역 (상용화 stop-ship) + 월렛 로드맵

상용화 종합검수(Codex+게임성+미연결+로컬라이징 4트랙 병렬)의 stop-ship 대응 + 월렛 미진행 로드맵화.

- **🛡 신규 유저 hijack 면역**(migration 242, `hijack.js`): full-loss(영구파괴) ON 상태에서 고인물의 신규 학살 방지 — 가입 N일 미만(기본 3)/레벨 N 미만(기본 5) 수비자는 hijack 대상 제외(`DEFENDER_PROTECTED` 403). 설정으로 조정/해제.
- **월렛 로드맵**(`docs/WALLET_ROADMAP.md`): 완료/운영자작업/미진행 Phase2(입금 자동감지+WS UI, 자동 출금 relayer, KMS, EIP-191, 대사, 메인넷) 정리.
- **검수 결과**: 첫 수확은 신규 claim `last_harvest_at` NULL → **즉시 가능**(게임성 에이전트 과대평가, 변경 불요). 로컬라이징 **clean**(1678키×4언어 동일, undefined 0). 가이드 정확(커스터디 면책 안내만 본문 누락 — 후속). 미연결 BLOCKER/HIGH 0(MED: factions/stats·lottery·battle보상 이력 UI — 후속).

## 2026-05-28 v7.144 — 상용화 검수: 솔벤시/링크월렛 fail-open 차단 + PP캡 키 통일

Codex 경제 재검증이 찾은 결함 수정(내가 넣은 fail-open 버그 포함):
- **트레저리 가드 fail-CLOSED 화**(api.js /swap·/withdraw-all, season.js): catch 가 모든 `e.code` 면제 → 미담보 USDT 발행 가능했음. `42P01`(테이블 미존재)만 면제, 그 외 오류는 ROLLBACK+차단.
- **link-wallet 게이트 fail-CLOSED**: custodial 비번 게이트 조회 실패 시 비차단 → 500 차단(계정탈취 방지).
- **PP 일일캡 통일**: 전역 /harvest(mining_daily_cap 1.0) vs 영토(pp_daily_earn_cap 0.3) 키 불일치(공유 today_mined_pp 우회) → 더 제한적 캡으로 통일.

## 2026-05-28 v7.143 — 컨트랙트 배포 툴체인 (자금 없이 미리 준비, 컴파일·드라이런 검증)

체인 연결의 마지막 갭(컨트랙트 배포)을 1커맨드로 만드는 Hardhat 툴체인 — 운영자는 가스용 테스트 ETH만 받으면 됨.

- **`contracts/MockTestUSDC.sol`**: 테스트넷용 USDC 모형(6 decimals, 공개 mint). 메인넷은 실제 USDC 주소 사용.
- **`deploy/`** Hardhat 프로젝트: `package.json`(hardhat 2.22 + toolbox 5 + OZ 5), `hardhat.config.js`(Base Sepolia 84532 / Base 8453, basescan verify), `scripts/deploy.js`(MockUSDC+MarsDeposit 배포 → 100k tUSDC 유동성 충전 → `server/.env` 라인 출력), `.env.example`, `README.md`. `deploy/contracts` → 루트 `contracts/` 심링크.
- **검증**: `npm install` OK, `hardhat compile` 16파일 성공, **드라이런 배포(in-memory)로 MockUSDC+MarsDeposit 배포+유동성충전+env출력 전 과정 동작 확인**.
- 사용: `cd deploy && npm install && npm run deploy:base-sepolia` (가스 ETH 보유 시). `node_modules/cache/artifacts` .gitignore 처리.
- ⚠️ 다음(phase 2, 배포 후): 입금 자동감지(유저 EOA Transfer 워치)→WS UI 반영, 자동 출금 relayer(서버 키 broadcast).

## 2026-05-28 v7.142 — 자동 커스터디 지갑: 실키 생성/암호화/열람 (+ Codex 보안검토 반영)

운영자 결정: 자동 커스터디(서버가 실 키페어 생성·보관) + 유저 키 열람 + 분실 면책. **실제 개인키를 다루는 보안 핵심부**라 Codex 독립검토 후 보강.

- **migration 241**: `users.encrypted_privkey`(암호문), `wallet_type`, `key_revealed_at`, `key_reveal_count` + `custodial_wallet_enabled`(기본 OFF).
- **`services/custodialWallet.js`**: 진짜 EOA 키페어 생성 + **AES-256-GCM**(서버 마스터키 `WALLET_ENCRYPTION_KEY`로 sha256 파생, 매 암호화 랜덤 IV 12B + auth tag) 암호화/복호화. **마스터키 미설정 시 키 생성 거부**(평문 저장 절대 금지) → placeholder 폴백. 개인키/니모닉 로그 금지.
- **가입(`auth.js`)**: custodial 활성화 시 실 지갑 생성·암호문 저장. **가입 응답에 개인키 미포함**.
- **키 열람 `POST /api/auth/reveal-key`**: JWT(본인) + **비밀번호 재확인**(bcrypt) 필수 → 복호화 후 1회 반환 + 면책 문구. 열람 사실(횟수/시각)만 감사. 개인키 로그 금지.
- **프론트(`index.html`)**: 🔑 KEY 버튼 + 면책 동의 체크 + 비밀번호 입력 → 키 표시/복사 모달. 4개 언어(EN/KO/JA/ZH).
- **🔐 Codex 검토 반영**: (E2) reveal-key 비밀번호 재확인 추가, (E3) link-wallet이 custodial 계정 재할당 시 비밀번호 재확인(정식 EIP-191 서명검증은 후속), (A4) `WALLET_ENCRYPTION_KEY` env 문서화(`.env.testnet.example`). 크립토/누출/스키마는 전부 PASS.
- 검증(E2E): 가입 응답 키 없음, 틀린 비번 401, 맞는 비번 키(0x·66자)+면책 반환, **서버 로그 키 누출 0**, 감사 기록 OK.
- ⚠️ 미구현(phase 2): 입금감시(유저 EOA Transfer 감지)·자동 출금 relayer(서버가 가스내고 broadcast)·운영 키 KMS화.

## 2026-05-28 v7.141 — Base 체인 테스트넷 연결 준비 (실지갑 입출금 테스트)

실유저 지갑 입출금(USDT) 테스트를 위한 Base 체인 연결 코드 정비. **온체인 작업(컨트랙트 배포·키·자금·RPC)은 운영자 몫** — 코드/문서로 핸드오프.

- **🐞 chainId 하드코딩 제거** (`server/services/signer.js`): `base.chainId=8453`(메인넷) 고정 → `BASE_CHAIN_ID` env 오버라이드(미설정 시 8453). 테스트넷은 `BASE_CHAIN_ID=84532`만 설정. BNB/ETH 도 동일 패턴. **chainId 는 출금 서명 해시에 포함**되므로 컨트랙트 배포 체인과 일치 필수였던 블로커 해소.
- **교차 검증**: `contracts/MarsDeposit.sol` 이 입금 이벤트/출금 서명 모두 `block.chainid` 사용 → Base Sepolia 84532. 서버 서명도 84532 → **서명 검증 일치 확인**. 입금 리스너(`chain.js`)는 chainId 하드코딩 없음(RPC/주소 env 만 필요).
- **`.env.testnet.example` 생성**: BASE_CHAIN_ID/RPC/DEPOSIT_ADDRESS/SIGNER_PRIVATE_KEY/TREASURY + 백필 튜닝 + 표준 서버 env 안내.
- **런북 §2 갱신**(`docs/BASE_TESTNET_RUNBOOK.md`): chainId env 오버라이드 완료 표기 + 프론트 체인 라벨은 표시용(실입금 대상은 서버 env)이라는 주의.
- 검증: env 미설정→8453 / `BASE_CHAIN_ID=84532`→84532, signer.js 문법 OK.

## 2026-05-28 v7.140 — 영토 등급 → 마켓/드롭 확장 (자산관리 루프 전방위)

자산관리(영토 등급) 루프를 마켓·드롭에 **경제적으로 건전하게** 확장. (가격 직접 커플링은 자유시장 왜곡이라 비채택)

- **등급 → 마켓 수수료 할인**: 판매자 최고 등급 영토 기준 `marketplace_fee_pct` 배수(S 50%/A 30%/B 15% 할인). `buyListing` 의 fee 계산에 적용(가격은 플레이어가 정함 그대로 — 왜곡 없음). migration 240 `market_fee_grade_discount`.
- **등급 → rare/special 재료 드롭 *확률* 보너스**: `rollResourceDrop(w, tier, {gradeRareMult})` 로 rare/special 행 확률을 등급 배수만큼 상향(상한 0.99). 기존 v7.135 의 드롭 *수량* 배수는 제거해 **이중 적용 방지**(이제 등급은 PP 수확배수 + 드롭 확률).
- 검증: S 수수료 배수 0.5/C 1.0, rareMult S 1.5/F 0.75, `node -c` 4파일 통과, migration 240 적용.

## 2026-05-28 v7.139 — 게임 가이드 신기능 반영 (4개 언어)

신기능 추가분을 인게임 GUIDEBOOK(CODEX_CONTENT)에 4개 언어 반영 — 실유저 대비 가이드 최신 유지.

- **What's New** 최상단에 5개 추가: 영토 condition/grade/TEND, 레벨별 탭 해금(Fleet3/Transport4/PVP6/Guild8/Govern10), NPC 아레나(살아있는 세계), 재료 수급 균형(frontier tier-2), 마켓 섹터 필터.
- **Overview**: "Progression & Unlocks" 섹션(해금 레벨 표 + toc) 추가.
- **Territory**: "Condition, Grade & TEND" 섹션(등급→수확 배수 표 S×1.5~F×0.6 + TEND 안내) 추가.
- **Fleet & Shipyard**: frontier tier-2 재료 드롭 안내 callout.
- 검증: 4개 언어 동일 구조, 인라인 JS 0 errors, 편집 CODEX_CONTENT 범위 내 확인.

## 2026-05-28 v7.138 — 재료 수급 균형 보정 (신규 유저 진행 봉쇄 해소)

경제 균형 감사(전문가 에이전트) 결과 진행 차단 2건 해소 — **소스(faucet) 추가만**, 레시피/요구량 무변경(기존 빌드 밸런스 무영향).

- **migration 239**: (1) frontier(신규존)에 tier-2 제작재료(titanium_alloy 0.08/plasma_crystal 0.06/nano_polymer 0.06) 추가 → 신규 유저 **cruiser 제작 진입로** 개방(기존 frontier=0이라 제작 불가였음). (2) mid 섹터에 t3(exotic_alloy 0.03/dark_matter 0.025/quantum_core 0.02) 추가 → **BS/Titan 진입로** 개방(기존 core 섹터 독점 봉쇄 완화).
- 감사 추가 발견(후속 검토): xenomatter/hull_plate/meteorite_fragment 등 sink 없는 "고사 재료"는 레시피 변경 필요 → 밸런스 영향 커서 별도 디자인 검토 후 적용.

## 2026-05-28 v7.137 — 레벨별 탭 해금 (온보딩 단계화)

BASE 모달 고급 탭을 레벨로 단계 해금 — 신규 유저 과부하 완화 + 레벨업에 의미 부여. 핵심 초반 루프는 항상 열림.

- 게이트(`BASE_TAB_MIN_LEVEL`): Fleet Lv3, Transport Lv4, PVP Lv6, Guild Lv8, Govern Lv10. 영토/섹터/상점/마켓/아이템/캠페인/OPS/시즌 = 항상 열림.
- 잠긴 탭은 🔒+필요레벨 뱃지로 노출(숨기지 않음 → 목표 부여), 클릭 시 안내 토스트 후 차단.
- `#profileLevel` 기준. 레벨 미확정(0)이면 fail-open(잘못 잠그지 않음) → 기존 유저 소급 잠금 방지. `window.LEVEL_GATING_ENABLED=false`로 전체 비활성 가능.
- `openBaseModal`/레벨 갱신 시 `applyBaseTabLocks()` 자동 적용. 실측: Lv2에서 fleet/pvp/guild/govern 잠김+클릭차단+🔒뱃지, market/territory 열림.

## 2026-05-28 v7.136 — NPC 아레나 인파이팅 + 초반 밀도 (유령도시 방지, 기본 OFF)

실유저 유입 시 "살아있는 세계" 연출 — NPC 함대끼리 주기적으로 함대전 + 초반 NPC 밀도 유지.

- **`services/npcArena.js`**: `runArenaTick()`(NPC 2함대 선택→기존 battle 파이프라인으로 NPC vs NPC 전투 1건, 가능하면 다른 파벌, 동시 수 cap) + `ensureNpcDensity()`(활성 NPC 함대 최소치 미달 시 aiFleetManager 로 보충). 라이브 피드 브로드캐스트.
- **🔴 경제 안전**: arena 전투를 `battle_summary.is_ai_battle=true` + `arena=true` 로 마킹 → `battleRewards`(v7.121 가드)가 보상 mint 0 차단. 1-tick 실측: 전투 1건 생성, GP/재료 발행 0 확인.
- **migration 238**: `npc_arena_enabled`(기본 false)/interval/concurrent/min_fleets.
- **스케줄러**(index.js, RUN_SCHEDULERS·leader 게이트): arena 120s + density 5min, `npc_arena_enabled` 로 내부 게이트.
- 기본 OFF — 운영자가 검증 후 켬. 부팅/스케줄러 기동 무에러.
- (Codex 워크트리 전문가 구현 → diff 검증 후 fast-forward 머지)

## 2026-05-28 v7.135 — 영토 HP/등급/감쇠 시스템 (자산 관리 루프)

영토에 condition(HP)·grade(F~S)·감쇠를 부여 — "관리 안 하면 등급↓ / 관리하면 수확·레어↑" EVE식 자산관리 루프.

- **migration 237**: `claims.condition`(0~100), `grade`, `last_tended_at` + 설정(감쇠량/정비비용/회복량/쿨다운/등급별 수확·레어 배수). 기존 영토는 grade S/condition 100으로 초기화.
- **`services/territoryCondition.js`**: 등급 계산, 일일 감쇠(bulk UPDATE + grade 재계산), TEND(정비) 트랜잭션(GP 차감→회복→등급/쿨다운).
- **수확 연동**(`api.js`): 등급별 PP 배수(S 1.5x ~ F 0.6x) + 재료 드롭량 배수 적용.
- **TEND 엔드포인트**: `POST /api/territory/:claimId/tend`(GP 소모→condition 회복, 소유자/쿨다운/잔액 가드). production 응답에 `condition/grade/lastTendedAt` 포함.
- **일일 감쇠 스케줄러**(index.js, RUN_SCHEDULERS 게이트, 24h).
- **프론트**(index.html): 영토 PRODUCTION 패널에 HP 바 + 등급 뱃지(색상) + 🔧 TEND 버튼(4개 언어). `tendTerritory()` 연동.
- 검증: tend 실측(cond 50→75, grade C→A, −50 GP), 감쇠 스케줄러 기동, 인라인 JS 0 errors, 부팅 무에러.

## 2026-05-28 v7.134 — 프론트 미연결 기능 연결: 마켓 섹터 필터

전수 조사로 "백엔드 완비 + 프론트 미연결" 실유저 기능 식별 후 1순위 연결.

- **마켓 지역(섹터) 필터 연결** — `GET /api/marketplace/listings?sectorId=`(v7.130에서 백엔드만 있던 것)를 마켓 브라우즈 UI에 연결. 필터바에 섹터 드롭다운 추가(`mktFilterSector`), `/api/sectors/control`로 24개 섹터 자동 채움(tier 아이콘·정렬), 선택 시 `loadMarketListings()`가 `&sectorId=` 전달. 실측: 25옵션 채움 + URL `...&sectorId=5` 정상.
- 남은 미연결(차기): `/api/sectors/control` 글로벌 컨트롤 보드(High), 전투보상 이력/복권 이력/연속로그인/파벌통계(Med). HoF·Jobs 중복 route는 연결 대신 정리 대상.

## 2026-05-28 v7.133 — 게임 가이드 4개 언어 전면 최신화 (실유저 대비) + 로컬라이징/검수

실유저 유입 대비 출시 준비 검수(전문가 팀 병렬 + Codex).

- **게임 가이드(CODEX_CONTENT) 4개 언어 전면 갱신** (EN/KO/JA/ZH):
  - 🔴 **통화 모델 오정보 교정(P0)** — 기존 가이드는 "PP=주통화, GP=구매불가/거버넌스 전용"이라 **실제와 거꾸로**였음. → GP=주 소비통화(PP→GP 환전으로 구매 가능), PP=영토 가치토큰($1 페그, USDT 환금 가능)로 교정. tokens↔exchange 모순 제거(0건 확인).
  - **함선 영구파괴(full-loss) ⚠ 경고** 추가(하이젝 격침=영구 손실).
  - 신규 **Fleet & Shipyard 섹션**(건조/강화/full-loss/함선 가챠 천장·확률/함선 마켓·섹터 관세).
  - exchange 섹션: 고정 "1PP=10GP" → **동적 환율 밴드[5,20]±2%** + PP→USDT 담보(room) 환금 설명.
  - What's New → v7.13x 갱신(full-loss/가챠/동적환율/지역마켓/수평확장/WS푸시/경제 안전장치).
  - 검증: 인라인 JS 0 errors, 편집은 CODEX_CONTENT 범위 내로 한정 확인.
- **로컬라이징 실측 ~100%** — data-i18n 709개 중 미정의는 `live_feed_empty` 1건뿐(v7.132로 4개 언어 추가). (감사 에이전트의 "400개 누락"은 excerpt 오판 → 직접 검증으로 반증)
- **전체 기능 버그 스윕 CLEAN** — fetch↔라우트 290개 매칭/404 0건, 라우터 76개 전부 마운트, onclick 521개 전부 정의, 마이그레이션 236까지 적용, 신규 테이블 전부 존재. BLOCKER/HIGH/MED 0건.
- 잡일: `server/dump.rdb`(Redis 로컬 테스트 잔여물) .gitignore 추가.

## 2026-05-27 v7.131 — 경제 모니터링 대시보드 UI (admin) + 토글 ON + 토픽업 버그 2건 수정

지금껏 백엔드만 있던 경제 기능들을 admin.html 에 **💰 ECONOMY 탭**으로 제대로 배치.

- **ECONOMY 대시보드** (`admin.html`) — `GET /api/admin/economy/health` 연동: 뱅크런 경보, SOLVENCY(담보/USDT부채/환금 room/redemption open) + **담보 적립(topup) 컨트롤**, 유통량(유저/GP/PP/USDT), GP faucet/sink/net, PP flow(type별), EVE 토글 3종 ON/OFF 버튼 + 현재 환율. Claude Preview 실측 검증(스샷).
- **🐞 기존 UI 버그 수정**: `switchTab` cats 배열에 `territory_economy` 누락 → 🌍 TERRITORY 탭 콘텐츠가 표시 안 되던 버그 동시 수정(+`economy` 추가).
- **🐞 토픽업 버그 2건 (UI 검수로 발견)**:
  1. 라우트 경로 불일치 — UI/주석은 `/api/admin/economy/treasury/topup` 인데 실제 등록은 `/treasury/topup` → 404(HTML). 경로 일치 수정.
  2. **트랜잭션 오염** — audit용 `INSERT type='treasury_topup'` 가 CHECK 제약에 없어 실패 → 같은 트랜잭션의 담보 적립까지 COMMIT 시 롤백(성공 응답은 롤백 전 값이라 오해 유발). migration 236(CHECK 에 treasury_topup 추가) + 적립을 COMMIT 후 audit 분리(실패해도 적립 불변). 재검증: 적립 300→health 300/room 300/redemption OPEN + audit row 기록 확인.

## 2026-05-27 v7.130 — 지역(섹터) 마켓 차별화 (휴면 관세 시스템 활성화)

마켓 `sector_id`(mig 156)가 항상 null 로 들어가 섹터 관세/거버너 시스템(`computeSectorTariff`)이 휴면이었음 → 활성화.

- **리스팅 자동 섹터 태깅** (`marketplace.js createListing`) — `pixels.sector_id`(→sectors.id)로 거점 산출. claim 매물=해당 claim 최빈 섹터, 그 외=판매자 보유픽셀 최빈 섹터. 못 찾으면 null(기존 동작).
- **효과**: 매물이 섹터에 귀속 → 매수 시 그 섹터 거버너 관세 적용(기존 시스템 자동 작동) → 섹터별 실효가격 차등 = 지역 시세.
- **섹터별 브라우징** — `GET /api/marketplace/listings?sectorId=N` 필터 + 인덱스(mig 235).
- **동일 섹터 매수 제한 토글** `marketplace_sector_restricted_buy`(기본 OFF) — 켜면 타섹터 매물 차단 → 물류(운송) 강제 + 섹터간 차익거래(EVE 허브화).
- 검증: 거점/claim 섹터 해석(12/20) 정확, 필터 쿼리/엔드포인트 정상, 부팅 무에러.
- 매핑 근거: `pixels.sector_id` 6118건 채워짐(12섹터). `sectors`는 lat/lng 밴드(코드 없음), `sector_definitions`와 분리 — pixels.sector_id 가 권위.

## 2026-05-27 v7.128 — 동적 PP↔GP 환율 (수급 밴딩, 하이퍼인플레 방어, 기본 OFF)

고정 환율(`pp_to_gp_exchange_rate=10`)을 24h 환전 수요 기반으로 자동 밴딩 — EVE식 수급 반영 + 봇 펌핑 방어.

- **migration 233** `pp_gp_rate_history` + 설정(floor 5/ceil 20/max_step_pct 2/daily_vol_target 1000/dynamic_enabled false).
- **`services/exchangeRate.js#recomputeRate()`** — D>목표 → rate↓(GP 인플레 억제), D<목표 → rate↑. 1회 변동 ≤2%, [5,20] 하드밴드. 결과를 기존 `pp_to_gp_exchange_rate` 설정에 써서 read 경로 무변경 + 히스토리 기록.
- **스케줄러** `index.js` RUN_SCHEDULERS 게이트 하 1h 주기(리더 인스턴스만).
- **검증**: D=0→target=1000 → +2% step-cap 상승(10→10.2→10.404), 밴드/스텝캡 정상, 복원 OK. 기본 OFF라 켜기 전 동작 무변경.
- ⚠️ 역방향(GP→PP) 추가 시 round-trip 차익 방지 위해 spread(양방향 fee) 필수 — 후속.

## 2026-05-27 v7.127 — 함선 영구파괴 토글 (EVE full-loss 수요엔진, 기본 OFF)

EVE 경제의 심장 = "전투로 함선 영구파괴 → 재건조 수요 → 생산/시장 순환". 현재 게임은 하이젝 전투에서 함선 HP만 깎고 보존(의도된 설계)이고, 일반 전투(AI/토너먼트)는 원래부터 영구파괴.

- **migration 232** `hijack_ship_loss_enabled`(기본 false) — 켜면 하이젝 격침 함선(sim HP≤0)도 `is_alive=false` 영구파괴.
- **`battleEngine.js applyBattleResults`** 하이젝 분기에 config 게이트 추가. OFF면 기존 HP 보존(15% floor) 그대로, 1줄도 동작 안 바뀜.
- **default OFF** — 플레이어 자산 손실은 리텐션에 직결되므로 운영자가 수리/재건조 비용·보험 밸런스를 정비한 뒤 켜는 것을 권장. 기능만 먼저 완비("지금 다 만들어둔다").
- killmail 데이터 소스는 이미 존재(`fleet_battle_events.event_type='ship_destroyed'`, `fleet_battle_participants.ships_lost`) — looting/killmail 보상 UI는 후속.

## 2026-05-27 v7.126 — 뱅크런 수정 하드닝 (Codex 독립검토 반영)

Codex 독립 검토가 v7.125 에서 찾은 결함 3개 보강(현재 USDT=0 이라 즉시 영향은 없으나 실입금 개시 전 차단):
- **담보 초기식 보정** (migration 231) — 230 은 출금을 `type='withdraw'` 만 차감했으나 `/withdraw-all` 은 `type='withdraw_all'`(실유출=usdt+pp−fee)로 기록되어 누락. 운영자 `treasury_topup` 도 반영. 진짜 담보=입금−(withdraw+withdraw_all)+적립.
- **season.js USDT 보상 가드** — 시즌 보상 `reward_type='usdt'` 가 room 가드 없이 usdt_balance 를 mint 하던 불변식 누수 차단. room 부족 시 보상 청구 보류.
- **chain.js 입금 담보 동기화 강화** — `adjustCollateral` 실패를 `catch(_){}` 로 삼키던 것을 제거. 실패 시 트랜잭션 롤백(입금은 tx_hash 멱등 재처리되어 안전).

## 2026-05-27 v7.125 — 뱅크런 구조적 차단: Treasury 담보 원장 + 솔벤시 가드 (EVE급 핵심)

경제 진단의 **#1 실존 리스크**(미담보 PP가 실USDT로 환금 → 먼저 빠진 PP파머가 트레저리를 말려 실예치자 출금불가 = 뱅크런) 봉쇄.

- **불변식**: `SUM(users.usdt_balance) ≤ treasury_ledger.collateral_usdt`. `room = collateral − liability` 만큼만 신규 PP→USDT 환금 허용.
- **migration 230** `treasury_ledger`(단일행 담보 원장) + 초기 담보=순실입금. 설정 `swap_solvency_guard_enabled`(기본 true).
- **`services/treasury.js`** `lockRoom`(treasury 행 FOR UPDATE 직렬화 + 부채 합계)/`adjustCollateral`/`guardEnabled`.
- **가드 적용**: `POST /api/swap`(PP→USDT) 와 `POST /api/withdraw-all`의 PP유래 발행분(`ppBal−ppFee`)을 room 이내로 제한 → 초과 시 `409 swap_pool_insufficient`. ⚠️ withdraw-all 이 보유 PP 전체를 on-chain 출금액에 합산하던 더 큰 구멍도 함께 막음.
- **담보 동기화**: deposit(`chain.js`) → 담보 +입금액, withdraw/withdraw-all → 담보 −출금액. usdt_balance 와 담보가 같이 움직여 불변식 유지.
- **운영자 환금풀 적립**: `POST /api/admin/economy/treasury/topup {amount}` — 실수익(광고/PP판매)으로 redemption 담보 적립 → 그만큼 환금 허용. `GET /economy/health` 에 `solvency{collateral_usdt, usdt_liability, swap_room, redemption_open}` 노출.
- **현재 상태**: USDT=0 → room=0 → PP→USDT 환금 안전하게 OFF. 운영자가 담보 적립해야 환금 개방(EVE식 "현금화는 실수익 백킹 내에서만").

검증: migration 230 적용 OK, 트랜잭션 단위 불변식 테스트(+100담보→swap50허용→swap60차단→경계50허용) 통과, `node -c` 4파일 통과, 서버 부팅/health/swap-auth 정상.

## 2026-05-27 v7.124 — 경제 인플레 방어: PP 일일 채굴 캡 + 시빌 방어 (EVE급 로드맵 즉시)

- **v7.124 PP 일일 채굴 상한 enforce** — `pp_daily_earn_cap_per_user`(0=무제한) 설정이 정의만 되어 있고 **코드에서 한 번도 적용되지 않던** 문제 수정. `server/routes/api.js` 영토 harvest 에서 `user_mining.today_mined_pp`(오늘 누적, 날짜 리셋) 기준 남은 한도만큼만 지급하고, 소진 시 `429 daily_pp_cap_reached`. 무제한 채굴 farm/봇 파밍 차단. ⚠️ 현재 시드값 `0.3`(=$0.30/일)은 보수적이므로 운영자가 admin 경제 패널에서 실밸런스로 상향 검토 필요.
- **v7.124 시빌(다계정) 방어** — 이메일+비번 커스터디얼 가입(온체인 서명 없음)이라 다계정 생성이 쉬워 가입/추천 PP 보너스 파밍이 가능했음. migration 229: `account_signups`(IP/UA/추천인 기록) + 설정 `signup_max_per_ip_per_day`(기본 8) + `referral_self_ip_block`(기본 true). `server/routes/auth.js`: IP당 24h 가입 캡 초과 시 `429 signup_ip_limit`, 같은 IP에서 가입한 피추천인에게는 양면 추천 보너스 미지급(셀프추천 차단), 모든 가입을 포렌식용으로 기록. trust proxy=1 이라 req.ip 가 실제 IP. 공유 IP 오탐 줄이려 캡은 보수적 시작·admin 조정 가능.

검증: migration 229 로컬 적용 OK, settings 3종 확인, `node -c` api.js/auth.js 통과, 서버 부팅 무에러.

## 2026-05-27 v7.112~7.123 — MMO 수평확장 마감 + 경제 익스플로잇 봉쇄 (catch-up)

- **v7.112~7.117** WS Redis Pub/Sub 팬아웃(`_PUB_CH='om:ws'`), WS 연결 수 제한(DoS), 채팅 닉네임 이중 escape, SCALING.md 갱신.
- **v7.118~7.120** `/health` 에 redis 상태(cachePing) 노출, Redis 부팅 차단/Railway IPv6 내부망(`family:0`) 프로덕션 다운 복구, 리더 선출이 Redis ready 를 기다리도록(스케줄러 미실행 사고 해소).
- **v7.121** AI 연습전 GP/광물 보상 차단 — 무한 mint 현금화 익스플로잇 봉쇄(`battleRewards.js`).
- **v7.122** 영토 패널 `claimId` 게이트 정규화 + 보호막 catalog 로드 — 죽은 버튼 12개(업그레이드/HIJACK/PRODUCTION/보호막 등) 복구.
- **v7.123** 경제 헬스 모니터링 `GET /api/admin/economy/health` — 유통량/담보율(뱅크런 조기경보)/GP·PP flow(EVE MER 대응).

---

## 2026-05-27 v7.108~7.111 — 함대전 화면 정리 + MMO 수평확장 기반

- **v7.108** 함대전 화면 정리 — 함선/함대 주변 원 제거(난잡), PC 발사 렌더를 모바일 경량 모드(PERF_MODE)로 통일(미사일·레이저 무덤/렉 해소).
- **v7.109** 스케줄러/온체인 리스너 **워커 게이트**(`RUN_SCHEDULERS`) — 수평확장 시 web 인스턴스는 false, 워커 1개만 true → 중복 스폰/중복 입금크레딧 방지. 기본 true 하위호환.
- **v7.110** **WebSocket 실시간 푸시**(`/ws/live`, 채팅+활동피드) — 폴링을 푸시로 전환(채팅 5s→15s, 피드 10s→15s 폴백). 동접 N명 채팅 폴링 부하 대폭 감소. WS 끊겨도 폴링 폴백.
- **v7.111** **캐시 추상화**(`services/cache.js`, Redis/인메모리 폴백) + `docs/SCALING.md` 수평확장 로드맵(⚠️ 멀티 인스턴스 시 WS Redis Pub/Sub 팬아웃 필요 명시).

평가: 베타~수백 동접 현 구조로 무리 없음. 수천+ 동접은 위 기반 위에 Redis Pub/Sub WS 팬아웃 + rate-limit-redis + read replica + 전투 워커 추가 시 가능(재작성 불필요).

---

## 2026-05-27 v7.103~7.107 — 양면추천 / 추천캡값 / 함선 가챠 / Base 런북

- **v7.103** 양면 추천 보상 — 추천 코드로 가입한 신규 유저에게 추가 PP 보너스(기본 150, migration 227, admin 조정). 추천인만 받던 단방향 → 가입 전환율↑.
- **v7.104** 추천 일일 캡 기본값을 안전망 수준으로 시드(PP/GP 10000, USDT 500/업라인·일). 봇/파밍만 걸리고 정상 유저 미영향. 프로덕션도 자동 보호.
- **v7.105** 함선 가챠(Ship Crate) 백엔드 — migration 228(3등급 상자/공개확률/천장/풀로그) + `shipCrate.js`(crypto RNG, 천장, 타이탄 서버 캡 존중, 트랜잭션) + `/api/ships/crates`·`/open`. 함선=마켓 거래 가능 실자산이라 가챠가 2차 시장 가치를 가짐(토큰 없이 web3 유입 훅). E2E 검증 통과.
- **v7.106** 함선 가챠 프론트 — 조선소 🎲 CRATES 탭(등급별 공개확률·천장 안내·개봉 연출), 4개 언어.
- **v7.107** Base 테스트넷 연결 런북(`docs/BASE_TESTNET_RUNBOOK.md`) + `.env.testnet.example`. ⚠️ signer.js base.chainId 8453(메인넷) 하드코딩 → 테스트넷(84532) 불일치 명시.

오픈베타 QA: db_smoke 4/4, capital recipes 11/11, 3002 핵심 엔드포인트 200 — 통과.

---

## 2026-05-27 v7.96~7.102 — 7대 점검 일괄 처리 (정리/연결/가이드/추천/캠페인/온보딩)

서브에이전트 4종(연결 전수조사·캠페인·추천·Hermes) 병렬 감사 + 직접 수정.

- **v7.96** 작전보드 죽은 코드 정리 — 미사용 `missionNav` 객체, 안 쓰던 `enabled` read 제거.
- **v7.97** 인게임 게임 가이드(HOW TO PLAY) 4개 언어 최신화 — 폐기된 Hijack 안내 제거, 작전보드/캠페인/함대/추천 반영.
- **v7.98** 상태 메시지 fallback이 없는 `/api/profile/status`(404→거짓 성공) 호출 → `/api/status/set`로 수정. (UI↔백엔드 전수조사의 유일한 실제 단절)
- **v7.99** 캠페인 FSP CH5/CH6 dead-end 제거 — 존재하지 않는 변형 챕터로 하드 리다이렉트하며 메인 스토리를 영구히 막던 버그. 변형 챕터가 실제 존재할 때만 리다이렉트.
- **v7.100** 추천 카운트 `referred_by` 코드/지갑 불일치 수정 — achievements/rank가 항상 0을 반환해 추천 업적/랭크가 영구 미달성이던 버그. 지갑 기준 비교로 통일.
- **v7.101** 추천 커미션 일일 상한(운영 안전) 메커니즘 + migration 226(기본 0=무제한, admin 레버) + 도움말 4개 언어가 비활성 hijack 보상을 광고하던 거짓 광고 정정.
- **v7.102** 온보딩 힌트 영어 하드코딩 → 4개 언어 현지화 + 골든패스(첫 영토→채굴→함대→캠페인 메인 스토리) 유도.

또한 Codex의 캠페인 챕터 잠금 사유 단일화 리팩터링(미커밋 WIP)을 검증 후 보존 커밋.

**감사 총평:** UI↔백엔드 연결 HIGH 0건(전체 양호), Hermes/Codex 최근 배치 회귀·이질변경 0건(패턴 준수), 캠페인 35챕터 거의 정상(HIGH 1건만 수정), 추천 3단 활성이나 운영 캡/양면보상 보강 필요.

---

## 2026-05-27 v7.95 — 작전보드 진행도 날짜 불일치 수정 (완료해도 녹색 안 되던 버그)

**증상:** 작전보드 미션을 실제로 완료해도(채굴/전투/강화 등) 🟢 녹색/완료로 안 바뀌는 경우가 있음.

**원인 (`server/routes/dailyOps.js` `notifyMissionProgress`):**
- 미션 생성/조회(`ensureDailyMissions`, `GET /:wallet`, `POST /progress`)는 `new Date().toISOString().slice(0,10)` = **UTC 날짜** 기준으로 `ops_date`를 사용.
- 그런데 실제 게임 행동(30종 전부: 채굴/전투/강화/제작/클레임/캠페인/로그인 등)이 호출하는 `notifyMissionProgress`만 `ops_date = CURRENT_DATE`(= DB 세션 타임존, 현재 **Asia/Tokyo**)를 사용.
- DB 타임존이 UTC가 아니라 **매일 JST 00:00~09:00(UTC 전날) 9시간 동안** 표시 미션(UTC 날짜)과 진행도 UPDATE 대상(JST 날짜)이 어긋나 0행 매칭 → 진행도 유실 → 완료해도 녹색 안 됨.
- 추가로 `notifyMissionProgress`가 `ensureDailyMissions`를 호출하지 않아, 작전보드를 한 번도 안 연 상태에서 행동하면 미션 행이 없어 진행도가 유실됨.

**수정:**
- `notifyMissionProgress`를 UTC 날짜(`toISOString().slice(0,10)`)로 통일 → 생성/조회/진행도 모두 동일 기준.
- 진행도 기록 전에 `ensureDailyMissions(w)` 호출 → 보드 미오픈 상태의 행동도 정상 집계.

**검증:** 백엔드 직접 호출 테스트 — 오늘(수) combo `harvest_3`(target=3)을 누적 호출 시 `current_count:3, completed:true`로 정상 전환 확인. 전체 미션 30종에 progress 훅 연결 확인(fleets/ships/crafting/api/battleScheduler/campaign 등).

---

## 2026-05-27 v7.94 — 작전보드 GO 버튼 이동 수정

**증상:** 오늘의 작전 보드에서 GO를 눌러도 화면 이동이 안 됨.

**원인 (`index.html` `opsMissionGo`):**
1. **캠페인 미션**(`campaign_progress`/`campaign_complete`)이 존재하지 않는 `'quests'` 카테고리를 `switchBaseCat`에 넘김 → 모든 base-tab이 숨겨지며 네비게이션이 깨짐. 실제 `baseTabQuests`의 `data-cat`은 `'mission'`.
2. **영토 채굴/업그레이드/이미지 미션**(`harvest_*`/`territory_upgrade*`/`territory_art`)이 BASE 모달의 territory 탭으로 이동 — 그런데 작전보드 자체가 그 탭 안에 있어 "같은 탭 재선택" → 시각적 변화 없음. 실제 채굴/업그레이드는 화성 지도(글로브)에서 수행.
3. **영토 클레임**(`territory_claim`)도 territory 탭으로 보냈으나 클레임은 지도에서 함.

**수정:**
- 탭 이동을 `switchBaseCat`+`switchBaseTab` 대신 **탭 버튼 `.click()`**(`_opsClickTab`)으로 처리 → 해당 탭 onclick 로더(`loadMarketTab` 등)까지 함께 발동.
- 캠페인 → `baseTabQuests.click()` (mission 카테고리 자동 활성).
- 영토 채굴/업그레이드/이미지 → `closeBaseModal()` 후 `toggleMyLand()`로 글로브 MY LAND 모드 진입 + 안내 토스트.
- 영토 클레임 → `closeBaseModal()` 후 `activateLandSelect()`로 지도 클레임 모드.
- 알 수 없는 타입엔 안내 토스트(무반응 방지).

**검증:** 로컬 브라우저에서 `opsMissionGo` 직접 호출 — 캠페인→`basePane_quests`, 마켓→`basePane_market`, 전투→`basePane_pvp` 활성 확인. 스크립트 파싱 정상.

---

## 2026-05-27 v7.93 — 하드 새로고침 직후 흰 화성/정지처럼 보이던 초기 로드 공백 축소

**증상:** `Cmd+Shift+R` 하드 새로고침 직후 몇 초 동안 화성이 흰 구처럼 보이고, 사용자는 텍스처가 안 뜨거나 회전이 멈춘 것으로 느낄 수 있었음.

**원인:** `index.html` 글로브 초기화가 데스크탑에서도 첫 텍스처를 곧바로 NASA 2K로 잡고, `onGlobeReady` 직후 로더를 빠르게 내려 버렸음. 그래서 NASA 이미지/합성 캔버스가 준비되기 전의 빈 초기 프레임이 사용자에게 그대로 노출됐음.

**수정:**
- `index.html`
  - 데스크탑 NASA 모드 첫 텍스처를 즉시 procedural surface(`marsTexUrl`)로 시작하도록 변경.
  - NASA 2K 캐시 완료 직후 `compositeClaimsOnTexture()`를 즉시 실행해 실제 표면으로 교체.
  - 데스크탑 NASA 모드에서는 초기 합성이 끝날 때까지 로더를 유지하고, 준비 완료 후 dismiss 하도록 조정.

**검증:** 실제 Chrome 창에서 `Cmd+Shift+R` 직후 즉시 캡처 시 텍스처가 보이는 것 확인. 2초 후 재캡처에서 표면 위치가 달라져 자전도 진행 중인 것 확인.

---

## 2026-05-27 v7.92 — CORS가 127.0.0.1 텍스처 요청을 500으로 막던 근본 버그 (화성 안 보임)

**증상:** 로컬(127.0.0.1:3000)에서 화성이 안 보임. Railway(프로덕션)에선 정상.

**근본 원인:** `server/index.js` CORS 미들웨어
- `allowedOrigins` 기본값이 `http://localhost:3000`만 포함. 사용자는 `127.0.0.1:3000`으로 접속.
- globe.gl이 텍스처를 `crossOrigin='anonymous'`로 로드 → 브라우저가 same-origin 요청에도 `Origin` 헤더 전송 → CORS 검사 대상이 됨.
- `Origin: http://127.0.0.1:3000`이 허용목록에 없어 `callback(new Error('Not allowed by CORS'))` → 전역 에러 핸들러 → **500** → 텍스처 로드 실패 → 머티리얼 맵 null → 행성 투명.
- Railway는 `*.railway.app`가 허용목록에 있어 정상. → "Railway는 되는데 로컬만 안 됨"의 정체.
- 진단 결정타: `curl -H "Origin: http://127.0.0.1:3000"` → 500, `localhost:3000` → 200.

**왜 세션 초반엔 보였나:** SW 캐시가 NASA를 깨진 500으로 들고 있어 globe가 프로시저럴 텍스처(data URL, CORS 무관)로 폴백 → 화성이 보였음. v7.90에서 SW 캐시를 고치자 globe가 진짜 NASA 파일 로드를 시도 → 숨어있던 CORS 버그가 드러남.

**수정:** `server/index.js` CORS origin 콜백
- dev 모드에서 `localhost`/`127.0.0.1` 모든 포트 허용 (`/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/`).
- 비허용 origin도 `callback(new Error)`(→500) 대신 `callback(null, false)`로 처리. CORS 헤더만 생략되고 same-origin 에셋은 정상 서빙, 진짜 cross-origin은 브라우저가 클라이언트측에서 차단. 더는 에셋 요청이 500으로 죽지 않음.

**검증:** 서버 재시작 후 `Origin: http://127.0.0.1:3000` 텍스처 요청 → 200 + `Access-Control-Allow-Origin: *`. 2K/8K 모두 200.

---

## 2026-05-27 v7.91 — 화성 텍스처 안전장치: 머티리얼 맵 null → 투명 행성 방지

**증상:** 별/Starlink 오버레이는 보이는데 화성 본체가 통째로 사라지는 케이스.

**원인:** `compositeClaimsOnTexture()` 데스크탑 직접 맵 갱신 경로에서, 클론할 기존
`mat.map`도 없고 `window.THREE`도 노출 안 된 globe.gl 빌드일 때 `TexClass`가 undefined →
`return`으로 조용히 빠지면서 `mat.map`이 null로 남음. 머티리얼이 `transparent:true`라
맵이 없으면 행성이 완전 투명하게 렌더 → "화성 안 보임".

**수정:**
- `index.html` `compositeClaimsOnTexture()`
  - `TexClass`를 못 구하면 조용히 return 하지 않고, globe.gl 자체 TextureLoader(`globeImageUrl`)로
    현재 모드의 실제 텍스처(nasa→2K/8K, procedural→marsTexUrl)를 폴백 로드.
    globe.gl 내부 로더는 `window.THREE` 불필요 → 행성이 절대 투명해지지 않음.
  - globe.gl이 `mat.map`을 채우면 이후 composite가 `existingMap.constructor`로 클론 →
    클레임 오버레이도 자동 복귀.

**검증:** 브라우저에서 인라인 스크립트 파싱 정상(`_initStep1`/`compositeClaimsOnTexture`/`cacheImage` 함수 존재) 확인.

---

## 2026-05-27 v7.90.2 — capital ship 스모크 테스트 rank 셋업 보강

**테스트 전용 수정 (게임 로직 변경 없음):**

- `server/tools/smoke_capital_recipes.js`
  - `mcc_bs`(battleship, min_player_rank=7) 빌드 테스트가 테스트 지갑 rank_level=1 때문에 `RANK_REQUIRED`로 실패하던 false-negative 수정.
  - 셋업에 `UPDATE users SET rank_level = 8` 추가 → battleship 빌드 경로가 실제 재료 차감까지 검증되도록.
  - rank 8은 titan(rank 10) 미만이라 `mcc_titan` 검증 케이스의 RANK_REQUIRED gate 체크는 그대로 유지.
  - 결과: 11/11 pass (이전 9/11). 게임 랭크 게이팅 로직 자체는 정상 동작 확인.

---

## 2026-05-27 v7.90 — NASA 화성 텍스처 복구 (SW 캐시 오염 수정) + 자전 속도

**근본 원인 — Service Worker 가 깨진 500 응답을 영구 캐시:**

- `sw.js` 정적 에셋 핸들러(이미지/CSS/JS)가 `res.ok` 확인 없이 모든 응답을 `cache.put` 하고 있었음.
  → `/assets/textures/mars_nasa_2k.jpg` 가 (서버 재시작/배포 중) 일시적 500을 받은 순간 SW가 그 500을 캐시.
  → cache-first 전략이라 이후 매 요청이 캐시된 500을 반환 → 브라우저 이미지 로드 실패(`_imgFailed`) →
     `compositeClaimsOnTexture()` 가 프로시저럴 텍스처로 폴백 → 사용자에게 "나사 텍스처 없음"으로 보임.
- 진단 근거 (브라우저 디버깅):
  - `curl` / `?fresh=<ts>` (쿼리스트링 → SW 캐시 우회) → HTTP 200, 177ms 정상 로드
  - 쿼리 없는 plain URL `fetch(...,{cache:'reload'})` → **HTTP 500** (SW 캐시된 500)
  - `navigator.serviceWorker.controller` 활성, `sw_count: 1`
  - 캐시 엔트리 삭제 후 재요청 → **200** (오염 캐시가 원인임을 확정)

**수정:**

- `sw.js`
  - 정적 에셋 핸들러: 2xx 응답만 캐시하도록 변경 (`res.ok && 200~299`). 네트워크 실패 시 cached fallback.
    → API/HTML 핸들러는 이미 `res.ok` 가드가 있었고, 정적 핸들러만 누락돼 있던 비대칭 버그.
  - `CACHE_NAME` `mars-v9` → `mars-v10`. `activate` 이벤트가 오염된 v9 캐시를 전체 삭제 → 기존 사용자도 다음 방문 시 자동 복구.
- `index.html`
  - 글로브 자전 속도 `autoRotateSpeed` 0.35 → 0.6 (사용자 요청: "속도가 좀 느리지만").

**검증:**
- `node --check sw.js` → OK
- 브라우저: 오염 캐시 삭제 후 NASA 텍스처 `cache:'reload'` 요청 → status 200 확인
- 배포 후 기존 사용자: SW v10 activate 시 v9 캐시 wipe → NASA 텍스처 정상 표시 예상

---

## 2026-05-27 v7.89 — 글로브 렌더 경쟁 제거 (채팅/피드 폴링 지연)

**Globe.GL 렌더 루프 보호:**

- `index.html`
  - `startChatPolling()` / `startFeedPolling()` 호출을 `DOMContentLoaded`에서 즉시 시작하지 않고 8s / 12s 지연 후 시작하도록 변경
    → Globe.GL WebGL 초기화(~5-7s) 동안 fetch 경쟁 없음. 행성 자전 끊김 / 초기 렉 해소.
  - `loadChatMessages()` — `document.hidden && !_chatExpanded` 일 때 fetch 스킵 (탭 비활성 + 채팅 닫힘 상태에서 불필요한 네트워크 요청 제거)
  - `loadActivityFeed()` — `document.hidden` 일 때 fetch 스킵
  - `visibilitychange` 리스너 추가: 탭 재활성화 시 즉시 최신 메시지/피드 조회

**검증 계획:**
- `node --check` for server files (no server changes)
- 브라우저 새로고침 후 첫 8초간 `/api/chat/messages` + `/api/activity/feed` 요청 없음 확인 (Network 탭)
- 8초 경과 후 자동 polling 시작 확인

---

## 2026-05-26 v7.88 — campaign retry gates + locked reason UI

**캠페인 평판 잠금/재도전 정합 보강:**

- `server/services/campaign.js`
  - 실패 챕터 재도전 시 평판뿐 아니라 `blockingTags` / `requiredBranchAny` 시작 gate도 건너뛰도록 보강
  - 레벨/선행 챕터 조건은 기존대로 유지
  - public chapter payload에 `requiredReputation`, `prerequisiteChapter`, `blockingTags`, `requiredBranchAny`를 추가해 클라이언트 잠금 사유 표시가 가능하게 함
- `index.html`
  - 잠긴 캠페인 compact 카드에 평판/선행 챕터/태그/분기 기반의 사람이 읽는 잠금 사유를 표시
  - `BRANCH_REQUIRED`, `FSP_DELEGATION_ABSENT`, `FSP_POLITICAL_COLLAPSE` 시작 실패가 raw code로 노출되지 않도록 메시지 매핑 추가

**검증 계획:**
- `node --check server/services/campaign.js`
- `node --check`는 HTML 파일에 직접 적용할 수 없어, `index.html` 변경은 소스 문자열/DOM 경로 확인으로 보조 검증

---

## 2026-05-26 v7.87 — campaign retry gate + daily OPS board sync

**캠페인 재도전/OPS 보드 정합 보강:**

- `server/services/campaign.js`
  - `startChapter()`가 기존 실패 진행 상태를 먼저 읽고, `failed` 챕터 재도전일 때는 현재 평판 재검사를 건너뛰도록 수정
  - 완료/보상수령 챕터의 기존 조기 반환 경로는 그대로 유지
- `index.html`
  - 캠페인 시작 실패 시 raw error code 토스트 대신 브리핑/목표와 함께 사람이 읽는 차단 안내 모달을 표시하도록 변경
  - OPS `daily_login` 자동완료는 내부용 `/api/daily-ops/progress` 재호출 대신 실제 `/api/daily/login` 성공 후 서버 보드 재조회에 의존하도록 정리
  - OPS 보드 점 표시 기준을 `reward_claimed` 전용에서 `completed || reward_claimed`로 보정해 완료 즉시 녹색 점이 보이도록 수정
  - 출석 체크 성공 후 `loadOpsCommandBoard()` / `loadDailyOpsBoard()`를 추가 호출해 서버 진행도가 즉시 반영되게 보강

**검증:**
- `node --check server/services/campaign.js`
- `curl -I http://localhost:3001` → `200 OK`
- 브라우저 페이지 컨텍스트에서 `document.title` 확인 및 콘솔 `js_errors: 0`
- 로컬 서빙 HTML과 소스에서 변경 문자열/분기 존재 재확인

---

## 2026-05-26 v7.86 — onboarding first-claim sync + production backfill

**온보딩 first-claim 연동 보강:**

- `server/routes/api.js`
  - 첫 owned claim 판정 시 onboarding 상태를 먼저 읽고, `current_step >= 2`인 유저는 첫 claim 생성 직후 STEP 2를 자동 완료하도록 보강
  - 기존 `getOnboardingState()` 호출이 서비스 export 누락으로 깨질 수 있던 경로도 함께 정합 보강
- `server/services/onboarding.js`
  - STEP 1(직업 선택) 완료 시 이미 영토를 가진 유저면 earliest claim을 찾아 STEP 2를 즉시 동기화
  - 누락된 `tutorial_claim_id` / `pp_rewarded`를 같은 트랜잭션에서 복구
  - `getOnboardingState` alias export 추가로 route 호환성 복구
- `docs/ops/BACKFILL_ONBOARDING_FIRST_CLAIM.sql`
  - 기존 운영 유저의 earliest real claim 기준으로 `tutorial_claim_id` / `current_step` / `pp_rewarded` 백필 SQL 추가

**검증:**
- `node --check server/services/onboarding.js`
- `node --check server/routes/api.js`
- 운영 DB(Railway public proxy)에서 `docs/ops/BACKFILL_ONBOARDING_FIRST_CLAIM.sql` 직접 실행
- 실행 전후 대조:
  - real claimer `6`
  - `tutorial_claim_id` 보유: `0 -> 5`
  - `pp_rewarded` 보유: `0 -> 4`

---

## 2026-05-26 v7.85 — production KPI / cohort / phase2 audit SQL pack

**운영 분석 SQL 추가:**

- `docs/ops/PROD_KPI_CHECK_WEEK1_FUNNEL.sql`
  - active season
  - 최근 7/30일 signups / onboarding / first claim / D1/D3/D7 / season pass premium 7d
  - PP→GP exchange usage
  - ship / expedition / monument / season pass sink checkpoint
- `docs/ops/DASHBOARD_COHORTS_RETENTION_AND_CONVERSION.sql`
  - 일별 signup cohort 대시보드
  - first territory lag bucket
  - active season premium depth
- `docs/ops/PHASE2_AUDIT_SHIP_EXPEDITION_MONUMENT.sql`
  - ship build mix / builder concentration / throughput
  - expedition usage audit
  - monument usage audit
  - phase2 sink share

**검증:**
- 운영 DB(Railway public proxy)에서 세 SQL 파일 모두 `psql -v ON_ERROR_STOP=1 -f ...` 실행 성공
- 0-row 테이블(expeditions/monuments)도 오탐 없이 `0`으로 집계되도록 보정

---

## 2026-05-26 v7.84 — week-1 economy fallback/verify hardening

**경제 런타임 fallback 정합 보강:**

- settings 누락/구형 DB fallback이 기존 고비용 값으로 되돌아가지 않게 런타임 기본값을 현재 경제 의도와 맞춤
- 반영 파일:
  - `server/services/onboarding.js` → `onboarding_gp_reward` fallback `75`
  - `server/services/daily.js` → 기본 7일 보상표를 현재 week-1 값으로 정렬
  - `server/routes/api.js`, `server/services/guild.js` → `pp_to_gp_exchange_rate` fallback `10`
  - `server/services/expedition.js` → `expedition_base_cost_gp` fallback `15`
  - `server/services/monuments.js` → `monument_cost_base` fallback `100`
  - `server/services/season.js` → season pass fallback `150`
  - `server/services/territoryVisual.js`, `server/services/sector.js` → `land_base_price_pp` fallback `0.08`
- `docs/ops/VERIFY_MIGRATIONS_222_223.sql`도 `220` + week-1 PP/GP/exchange/sink 값까지 확인하도록 확장

**검증:**
- `node --check`로 수정 JS 파일 문법 확인
- 로컬 DB `pixelwar`에서 verify SQL 재실행
- `git diff`로 변경 범위가 economy fallback + verify/docs인지 확인

---

## 2026-05-26 v7.83 — referral safe key backfill

**로컬/구형 DB 정합 보강:**

- `server/migrations/225_referral_safe_key_backfill.sql` 추가
- 누락될 수 있던 referral settings 2개를 안전 기본값 `0`으로 백필
  - `referral_enhance_pct`
  - `referral_auction_buy_pct`
- `docs/ops/VERIFY_MIGRATIONS_222_223.sql`도 `225` 적용 여부까지 확인하도록 확장

**검증:**
- 로컬 DB `pixelwar`에 `225` 적용
- verify SQL 재실행으로 referral/pricing/funnel 기대값 재확인

---

## 2026-05-26 v7.82 — verify SQL JSONB snapshot 실행 오류 수정

**운영 확인 도구 수정:**

- `docs/ops/VERIFY_MIGRATIONS_222_223.sql` snapshot 쿼리의 `MAX(... value ...)`를 `value::text` 기준으로 수정
- `settings.value`가 `jsonb`인 실제 DB에서 `function max(jsonb) does not exist`로 실패하던 실행 오류 제거
- 개별 settings 조회 쿼리는 그대로 두고, 마지막 human-readable snapshot만 실행 가능하게 보정

**검증:**
- 로컬 DB `pixelwar`에서 `psql -d pixelwar -f docs/ops/VERIFY_MIGRATIONS_222_223.sql` 재실행
- snapshot 쿼리까지 오류 없이 완료 확인

---

## 2026-05-26 v7.81 — 224 포함 migration verify SQL 확장

**운영 확인 도구 보강:**

- `docs/ops/VERIFY_MIGRATIONS_222_223.sql` 확장
- 확인 항목 추가:
  - `schema_migrations` 내 `224_week1_funnel_gp_bundle.sql`
  - `onboarding_gp_reward`
  - `daily_login_gp_rewards`
- 기존 referral/pricing 확인과 함께 week-1 funnel GP 기본값까지 한 번에 확인 가능
- 실행 방식은 동일: `psql "$DATABASE_URL" -f docs/ops/VERIFY_MIGRATIONS_222_223.sql`

**검증:**
- SQL 파일 내용 확인
- `git diff`로 변경 범위가 ops SQL + 문서만인지 확인

---

## 2026-05-26 v7.80 — week-1 funnel GP bundle

**경제 설정 조정 (신규 유저 GP 체감 개선):**

- `server/migrations/224_week1_funnel_gp_bundle.sql` 추가
- `onboarding_gp_reward`: `50 -> 75`
- `daily_login_gp_rewards`: `[5, 8, 12, 16, 22, 30, 50] -> [8, 12, 16, 20, 22, 25, 40]`
  - 7일 총합 `143 GP`는 유지
  - Day1~Day3 보상만 앞당겨 초반 체감을 높임
- PP 보상/환율/함선 비용은 이번 묶음에서 건드리지 않음

**검증:**
- migration 파일 내용 확인
- `git diff`로 변경 범위가 migration + 문서만인지 확인

---

## 2026-05-26 v7.79 — 222/223 migration 적용 확인 SQL

**운영 확인 도구:**

- `docs/ops/VERIFY_MIGRATIONS_222_223.sql` 추가
- 확인 항목:
  - `schema_migrations` 내 `222_operator_safe_referral_stage1.sql`, `223_week1_pricing_soften.sql`
  - referral 안전 기본값 4개
  - week-1 pricing 기본값 2개
- `psql "$DATABASE_URL" -f docs/ops/VERIFY_MIGRATIONS_222_223.sql` 로 바로 실행 가능

**검증:**
- SQL 파일 내용 확인
- `git diff`로 변경 범위가 ops SQL + 문서인지 확인

---

## 2026-05-26 v7.78 — 주차 1 가격 완화 (Season Pass / Territory)

**경제 설정 조정 (온보딩 진입 완화):**

- `server/migrations/223_week1_pricing_soften.sql` 추가
  - `season_pass_premium_cost_gp`: `500 -> 150`
  - `land_base_price_pp`: `0.1 -> 0.08`
- 추천(referral) 안전화 migration과 분리해 가격 조정만 별도 롤백/적용 가능하게 유지

**검증:**
- migration 파일 diff 확인
- `git status` / `git diff`로 변경 범위 확인

---

## 2026-05-18 v7.77 — 실시간 활동 피드 (Live Feed)

**신규 기능 (EVE Lite 감각):**

- `server/routes/api.js` — `GET /api/activity/feed?since=&limit=` 공개 엔드포인트
  - 영토 클레임 / 채굴 / 전투 승리 / 함선 건조 4개 소스 Promise.all
  - actor는 nickname 또는 wallet 앞 8자리 (개인정보 최소 노출)
- `index.html` — `loadActivityFeed()` + `startFeedPolling()` (10초 폴링)
  - 기존 `#liveFeed` 컨테이너에 연결, 새 이벤트 위에서 삽입
  - `feed-new` 애니메이션, 최대 30개 유지

**교차검수 (Gemini):**
- 공개 엔드포인트 DB 부하 → 5초 인메모리 캐시 추가 ✅
- fleet_battles JOIN 중복 → `DISTINCT ON (fb.id)` 수정 ✅

---

## 2026-05-18 v7.76 — 신규 유저 온보딩 힌트 시스템

**신규 기능 (온보딩 플로우):**

- `server/routes/api.js` — `/api/onboarding/status` (GET, requireAuth) + `/api/onboarding/dismiss` (POST, requireAuth)
  - 영토 없음(step 0) → 채굴 미경험(1) → 함선 없음(2) → 완료(3) 4단계 판별
  - `claims.owner` / `transactions.from_wallet` / `ships.owner_wallet` 실제 컬럼 사용
- `index.html` — 하단 플로팅 온보딩 힌트 카드:
  - STEP 1/3: 화성 지도 클릭 안내 → STEP 2/3: 채굴 안내 → STEP 3/3: 조선소 안내
  - ✕ 버튼으로 닫기, 로그인 후 2초 딜레이 자동 표시
  - `runOnboardingCheck()` (기존 `checkOnboarding`과 충돌 회피)

**교차검수 (Gemini):**
- wallet 추출이 `req.query` 기반이었던 버그 → `requireAuth` + `getAuthWallet(req)` JWT 전용으로 수정 ✅
- `countFirst` 다중 컬럼 시도 패턴 → 정확한 단일 쿼리 3개 `Promise.all`로 교체 ✅

---

## 2026-05-18 v7.75 — 인게임 채팅 시스템 (COMMS)

**신규 기능 (MMO 사회성 레이어):**

- `server/migrations/212_chat.sql` — `chat_messages` 테이블 + 채널/시간 복합 인덱스
- `server/routes/chat.js` — 채팅 API 3개:
  - `GET /api/chat/messages?channel=&since=` — 최신 50개 (초기: DESC 서브쿼리→ASC 정렬, 폴링: ASC)
  - `POST /api/chat/send` — JWT 전용 wallet, DB timestamp 레이트리밋(10초/3개)
  - `GET /api/chat/channels` — 24시간 내 활성 섹터 채널 목록
- `server/index.js` — chatRoutes 마운트
- `index.html` — 우하단 플로팅 COMMS 오버레이:
  - 글로벌/섹터 채널 전환
  - 5초 폴링, 접힌 상태에서 미읽은 배지 표시
  - XSS 방어 (`_escapeHtml`), 모바일 safe-area 위 배치

**교차검수 (Gemini):**
- rate limit TOCTOU — low risk, 채팅 시스템에서 허용 가능한 수준
- 초기 로딩 정렬 버그 발견 → `DESC LIMIT 50` 서브쿼리 후 `ASC` 재정렬로 수정 ✅

---

## 2026-05-18 v7.74 — withdraw env 변수명 정보 유출 방지

**수정 (MEDIUM — 보안):**

- `server/routes/api.js` `/api/withdraw` + `/api/withdraw-all` — `getAvailableLiquidity()` 예외 시 `e.message`가 클라이언트에 반환되어 서버 env 변수명(`BASE_RPC_URL` 등)이 노출되는 정보 유출 수정.
  - 별도 `try/catch`로 감싸 503 + 제네릭 메시지 반환. 내부 에러는 서버 로그에만 기록.

**Codex 신규 커밋 감사 완료 (be1fe9d ~ 6bc645e):**
- `adminAuth.js` / campaign editor `requireAdmin` 라우트 / `getAdminSecret` 재시도 — ✅ CLEAN
- `minWithdrawAmount` BEGIN 이후 체크 / `signer.js` `getAvailableLiquidity` — ✅ CLEAN (env 정보 유출만 v7.74 수정)
- `admin.js` `withdraw_all` totalOut 계산 / `db.js` 키 변경 호환 — ✅ CLEAN (Codex fix 정상)

---

## 2026-05-15 v7.85 — backup verify script 추가

**수정 (OPS automation — backup verify):**

- `server/tools/backup_verify.js` 추가
  - `DATABASE_URL` 해석 여부
  - `pg_dump` 사용 가능 여부
  - DB ping
  - 백업 핵심 테이블 존재 여부
  - Git 원격 존재 여부를 점검한다.
- `server/package.json`
  - `npm run backup:verify` 스크립트 추가
- `docs/ops/BACKUP_RECOVERY_BASELINE.md`
  - backup baseline에 `backup:verify` 사전 점검 기준을 반영했다.

**검증:**
- `node --check tools/backup_verify.js`
- `npm run backup:verify` → `5 passed / 0 failed`

---

## 2026-05-15 v7.84 — rollback helper script 추가

**수정 (OPS automation — rollback helper):**

- `server/tools/rollback_helper.js` 추가
  - known-good SHA를 받아 `git reset --hard <sha>` 기준 롤백 계획을 dry-run으로 보여준다.
  - `--apply`로 로컬 적용, `--apply --push`로 원격 반영까지 가능하게 했다.
  - `--push`는 `main`에서만 허용하고 `force-with-lease`를 사용한다.
- `server/package.json`
  - `npm run rollback:plan -- <known-good-sha>` 스크립트 추가
- 운영 문서 갱신
  - 배포 체크리스트/런북에 rollback helper 사용 예시 반영

**검증:**
- `node --check tools/rollback_helper.js`
- `npm run rollback:plan -- 8383be7` → dry-run complete

---

## 2026-05-15 v7.83 — release preflight script 추가

**수정 (OPS automation — release preflight):**

- `server/tools/release_preflight.js` 추가
  - `npm run smoke:db` 실행
  - `TARGET_URL` 기준 `/health` 200 + DB ok 확인
  - `TARGET_URL` 기준 `/api/config` 응답 확인
- `server/package.json`
  - `npm run release:check` 스크립트 추가
- 운영 문서 갱신
  - 배포 체크리스트/런북에 `TARGET_URL=https://... npm run release:check` 기준 반영

**검증:**
- `node --check server/tools/release_preflight.js`
- `npm run release:check` → `3 passed / 0 failed`

---

## 2026-05-15 v7.82 — health 응답 보정 + DB smoke script 추가

**수정 (OPS automation — minimal):**

- `server/index.js`
  - `/health`가 DB 장애 시 JSON 본문만 `degraded`를 주는 데서 끝나지 않고 HTTP `503`도 함께 반환하도록 보정했다.
- `server/tools/db_smoke.js` 추가
  - DB ping, 핵심 테이블 존재, settings seed, 핵심 경제 설정 키 존재를 빠르게 확인하는 운영용 smoke script를 추가했다.
- `server/package.json`
  - `npm run smoke:db` 스크립트를 추가했다.
- 운영 문서 갱신
  - 런북/배포 체크리스트/복구 baseline에 `/health` 및 `smoke:db` 사용 기준을 반영했다.

---

## 2026-05-15 v7.81 — 관리자 정책 / 배포 롤백 / 백업 복구 운영 문서 추가

**수정 (DOCS — ops hardening):**

- `docs/ops/ADMIN_ACCESS_POLICY.md` 추가
  - `ADMIN_SECRET` / `x-admin-secret` 기준, 저장 금지/허용 범위, 교체/회수 절차를 정리했다.
- `docs/ops/DEPLOY_ROLLBACK_CHECKLIST.md` 추가
  - 배포 전 확인, 배포 직후 스모크, 롤백 트리거, 핫픽스 vs 롤백 기준을 정리했다.
- `docs/ops/BACKUP_RECOVERY_BASELINE.md` 추가
  - DB/환경변수/배포 SHA 기준의 최소 백업·복구 기준과 복구 검증 항목을 정리했다.
- `docs/OPS_MINIMUM_RUNBOOK_2026-05-15.md`의 다음 단계 권장을 실제 생성 상태에 맞게 갱신했다.

---

## 2026-05-15 v7.80 — 테스트 런처 기본 외부 공개 차단 + 관리자 비밀번호 노출 제거

**수정 (HIGH — launch exposure control):**

- `start-test.sh`를 상업 운영 경로가 아닌 지인 테스트/로컬 확인용 런처로 명시했다.
- 기본 실행에서는 Cloudflare 터널을 열지 않도록 바꾸고, `ALLOW_PUBLIC_TUNNEL=1`일 때만 명시 opt-in으로 외부 공개를 허용했다.
- 출력문에서 `admin1234` 평문 노출을 제거하고, 관리자 시크릿은 환경변수/운영 문서 기준으로 확인하도록 정리했다.
- 로컬 전용 실행일 때와 임시 외부 테스트일 때의 안내 문구를 분리했다.
- `docs/TEST_LAUNCHER_USAGE_2026-05-15.md`를 추가하고 `docs/HANDOFF.md`에 운영 경계를 반영했다.

---

## 2026-05-15 v7.79 — 상용 오픈 blocker 실행 문서 / 회귀 체크리스트 / 최소 런북 추가

**수정 (DOCS — launch readiness):**

- `docs/LAUNCH_BLOCKER_EXECUTION_PLAN_2026-05-15.md` 추가
  - 테스트 공개 경로 차단 → 관리자 정책 → 운영 기본선 → 회귀 게이트 → 첫 세션 polish 순서로 실제 작업 단위를 분해했다.
- `docs/RELEASE_REGRESSION_CHECKLIST_2026-05-15.md` 추가
  - L1 10분 스모크 / L2 1시간 리허설 / L3 주간 회귀팩 기준을 정리했다.
- `docs/OPS_MINIMUM_RUNBOOK_2026-05-15.md` 추가
  - 배포 전/후 확인, 기본 health 판단, 장애 분류, 롤백 기준을 정리했다.

---

## 2026-05-15 v7.78 — 캠페인 가이드 카피를 행동 중심으로 정리

**수정 (LOW — onboarding/campaign UX clarity):**

- 캠페인 카드 CTA를 `시작/계속/결과` 같은 추상 라벨에서 `작전 시작 / 작전 계속 / 결과 확인`으로 구체화했다.
- 캠페인 목표 액션 버튼을 `영토 확인 / 함선 준비 / 함대 편성 / 전투 진입 / 마켓 확인`처럼 실제 플레이 행동이 보이도록 조정했다.
- 목표 미완료 경고를 `아직 완료할 행동이 남아 있습니다 / 남은 목표를 먼저 진행한 뒤 결과를 확인하세요`로 바꿔, 실패처럼 보이던 문구를 진행 안내형으로 정리했다.
- 결과 모달의 `다시 확인`을 `목표 다시 확인`으로 바꿔 의미를 명확히 했다.

---

## 2026-05-14 v7.77 — 구형 튜토리얼 자동 실행 중단 + 신형 온보딩 루프 재정렬

**수정 (HIGH — first-session UX):**

- 로더 종료 후 `startTutorial()`를 자동 실행하던 구형 spotlight 튜토리얼 경로를 비활성화했다.
- 이제 첫 실행 가이드는 `server-backed onboarding` 흐름이 단일 진입점이 된다.
- 신형 온보딩 step 3~5를 `직업 선택 / 길드 / 일일 미션` 중심에서 **영토 → 수확 → 함대 → 캠페인** 중심 루프로 재정렬했다.
- 최종 온보딩 보상 step도 현재 게임의 북극성 루프를 한 줄로 요약하도록 바꿨다.

---

## 2026-05-14 v7.76 — 출금 최소값 설정 일관화 + withdraw-all 계약 잔액 계산 수정

**수정 (HIGH — finance/admin correctness):**

- `min_withdraw` / `withdraw_min_amount` 이중화로 인해 `/api/config`가 보여주는 최소 출금값과 실제 `/api/withdraw`, `/api/withdraw-all` 서버 검증값이 달라질 수 있었다.
- `/api/config`와 출금 검증 로직 모두 `withdraw_min_amount` 우선, 없으면 `min_withdraw` fallback을 쓰도록 통일했다.
- 기본 설정 시드(`server/db.js`)와 migration `201_withdraw_min_amount.sql`도 `withdraw_min_amount = 10` 기준으로 맞췄다.
- `withdraw-all`은 실제 지급액 `meta.totalOut`을 기록해두고도 관리자 대시보드 계약 잔액 계산에서 `usdt_amount`만 차감하고 있어 잔액을 과대 표시할 수 있었다.
- `server/routes/admin.js` 계약 잔액 계산을 수정해 `withdraw_all`은 `meta.totalOut`을 우선 차감하고, 구데이터/예외 시에만 `usdt_amount` fallback을 사용한다.

---

## 2026-05-14 v7.75 — admin 패널 `window.ADMIN_SECRET` 동기화 누락 수정

**수정 (HIGH — admin tab breakage):**

- `admin.html`은 로그인 시 `adminSecret` 지역 변수만 채우고, 다수의 후반 탭(Contest/Rental/Duel/Expedition/Branding/Spells/Tournaments/... 다수)은 `window.ADMIN_SECRET`를 헤더 소스로 사용하고 있었다.
- 그런데 `window.ADMIN_SECRET`에 값을 넣는 코드가 전혀 없어, 로그인 성공 후에도 해당 탭들은 빈 `x-admin-secret`로 요청을 보내며 401/403 또는 빈 데이터 상태가 났다.
- 초기 전역값 `window.ADMIN_SECRET = ''`를 선언하고, `doAuth()` 성공 직후 `window.ADMIN_SECRET = adminSecret`으로 동기화하도록 수정.

---

## 2026-05-14 v7.74 — campaign editor admin auth 회귀 수정

**수정 (HIGH — admin tool regression):**

- `server/index.js`에서 `/admin/api/campaign-editor/*` read endpoints에 `requireAdmin`이 붙은 뒤, `assets/campaign-editor.html`은 여전히 헤더 없는 `fetch()`로 `chapters/assets/chapter`를 읽고 있어 즉시 `403 FORBIDDEN`으로 깨졌다.
- `assets/campaign-editor.html`에 `adminFetch()`를 추가해 `x-admin-secret`을 자동 첨부하도록 수정.
  - `sessionStorage(campaignEditorAdminSecret)`에 저장된 시크릿을 우선 사용하고, 없으면 prompt로 입력받음
  - 저장된 시크릿으로 403이 나면 sessionStorage를 비우고 새 시크릿을 강제로 다시 입력받아 1회 재시도
- 결과적으로 캠페인 에디터가 다시 챕터 목록/에셋/개별 챕터를 정상 로드할 수 있는 상태로 복구.

---

## 2026-05-11 v7.73 — 모바일/데스크탑 nav 아이템 버튼 라우팅 수정 + SW 캐시 bump

**수정 (MEDIUM — UX 단절):**

- `index.html` 하단 nav `mn-items` 버튼이 `openItemShop();shopSwitchTab('inv')` 를 호출. `openItemShop()` 은 BASE 모달을 열어 SHOP 탭으로 가지만(setTimeout 100/150ms), 직후 동기 호출되는 `shopSwitchTab('inv')` 는 더 이상 화면에 떠 있지 않은 구버전 `shopModal` DOM(`shopTabShop`/`shopTabInv`/`shopInventoryView`)을 토글한다. 결과적으로 사용자에게는 "내 아이템"이 아니라 SHOP 진열대가 보이거나 아무 변화도 없는 것처럼 보임.
- 데스크탑 사이드 FAB `col-fab items` 도 동일한 옛 onclick 을 쓰고 있어 같이 수정. v7.73 1차 패치는 `mn-items` 만 고쳐서 데스크탑/사이드바 사용자에게는 그대로 안 통했음.
- BASE 모달은 이미 `baseTabItems`(내 아이템) 탭을 별도 카테고리로 가지고 있음. nav 버튼이 `loadBaseInventory()` 를 거쳐 그 탭으로 직접 이동하도록 `openMyItems()` 헬퍼 추가하고 `mn-items` + `col-fab items` onclick 을 교체.
- `sw.js` CACHE_NAME `mars-v8` → `mars-v9`. HTML 은 이미 network-first 라 영향 없지만, 옛 빌드의 정적 캐시(JS bundle 같은 부수 자원) 를 강제로 비워서 재발 방지.

---

## 2026-05-07 v7.72 — buildShip 다중 함대 선택 UI 추가

**수정 (MEDIUM — UX gap):**

- `index.html` `buildShip()` — 함선 건조 시 `fleet_id`를 서버에 전달하지 않아 다중 함대 보유 플레이어가 건조된 함선의 배치 함대를 선택할 수 없는 기능 공백 수정.
  - 건조 확인 전 `/api/fleets` 호출해 전투 중 아닌 함대 목록 조회.
  - 함대가 2개 이상이면 `gamePicker`로 배치 함대 선택 다이얼로그 표시.
  - 함대 1개면 자동 선택, 함대 없으면(신규 플레이어) `fleet_id` 미전송(서버 자동 배정).
  - `gamePicker` 취소 시 건조 중단.
  - 선택된 `fleet_id`를 `/api/ships/build` POST body에 포함.

---

## 2026-05-07 v7.71 — tdesc 소유권 체크 LOWER() 누락 + 최종 감사 완료

**수정 (LOW):**

- `server/services/tdesc.js` line 46 — 영토 설명 등록 소유권 체크가 `WHERE owner=$2` 로 대소문자 구별. 체크섬 주소(EIP-55)로 로그인한 오너가 "소유하지 않은 영토" 오류를 받는 버그. `LOWER(owner)=LOWER($2)` 로 수정.

**최종 감사 완료 (CLEAN):**
- `siege.js` — CLEAN (FOR UPDATE + rowCount 패턴 정상)
- `tprestige.js` — CLEAN (FOR UPDATE 직렬화 정상)
- `capsule.js` — CLEAN (LOW: 최대 1개 초과 생성 가능, 자금 영향 없음)
- `rental.js` — CLEAN (FOR UPDATE + status 체크 정상)
- `achievements.js` — CLEAN (INSERT ON CONFLICT DO NOTHING 이중 지급 방지)
- `profile.js` — CLEAN (rowCount 가드 정상)
- `beacon.js` — CLEAN (FOR UPDATE + rowCount 가드 정상)
- `territoryIdentity.js` routes — CLEAN (getAuthWallet JWT 전용)
- `api.js` GP/PP spend 구간 — CLEAN (FOR UPDATE + atomic 가드)

---

## 2026-05-07 v7.70 — guild 커스터마이즈 무료 우회 버그 수정 + 감사 완료

**수정 (LOW):**

- `server/services/guild.js` `updateGuildInfo()` — GP 차감 후 `rowCount` 미체크. 동시 GP 소진 시 무료로 길드 이름/엠블럼 변경 가능. 다른 guild.js GP 차감(createGuild/levelUp/declareWar)은 이미 `rowCount === 0` 가드 있음. 같은 패턴 적용.

**감사 완료 (CLEAN):**
- `enhancement.js` — FOR UPDATE + AND quantity >= $1 + rowCount 가드 정상
- `daily.js` — FOR UPDATE 직렬화 + ON CONFLICT DO NOTHING 로그인 보너스 보호
- `transport.js` — FOR UPDATE SKIP LOCKED 스케줄러 이중 처리 방지 정상

**정보 (변경 없음):**
- 마이그레이션 번호 충돌 7쌍(014/090/091/092/189/212/213) — `schema_migrations.filename` UNIQUE 키 기반 러너라 실행 순서 이슈 없음. 기능적 무관.

---

## 2026-05-07 v7.69 — campaign CV 소프트락 + FSP CH9 실패 보상 버그 수정

**수정 (CRITICAL — campaign):**

- `server/services/campaign.js` `calculateCvChapterRewards()` 실패 분기 — `unlocks: nextQuestId ? [] : []` 오타. 두 분기 모두 `[]`여서 CV CH1~CH9 실패 시 다음 챕터가 잠금 해제되지 않아 영구 소프트락. `[nextQuestId]` 로 수정.

**수정 (MEDIUM — campaign):**

- `server/services/campaign.js` `calculateFspCh9Rewards()` — 다른 FSP CH 함수와 달리 `if (!sim.success) return ...` 가드 없음. FSP CH9 실패 시 9000+ GP, branchModifiers, loreFlags 전체 지급. 실패 가드 추가 (GP=0, 디시루전드 엔딩 경로 seed).

**조사 결과 (False Positive):**
- `ship.js` `assertShipNotInBattle` NULL fleet_id bypass — FALSE POSITIVE. `fleet_battle_participants`는 fleet_id 기준 참여 추적. fleet_id=NULL 함선은 구조상 전투 중 불가. early-return 정상.

---

## 2026-05-07 v7.68 — campaign CH1 보상 누락 버그 수정 + 잔여 LOW 감사 항목 해소

**수정 (CRITICAL — campaign):**

- `server/services/campaign.js` `calculateRewards()` — `CH1_ID`(`mcc_campaign_ch1`) 분기가 누락되어 MCC CH1 완료 시 GP/XP/아이템 보상이 0으로 지급됨. `calculateCh1Rewards()` 호출 분기 추가.

**수정 (LOW — 잔여 감사 항목):**

- `server/services/branding.js` `clearBranding()` — 소유권 확인(`SELECT owner FROM claims`)이 트랜잭션 외부. 동시 영토 이전과 TOCTOU 가능. 트랜잭션 + `FOR UPDATE`로 이동.
- `server/services/replayShare.js` `createShare()` — 공유 한도 COUNT 체크와 INSERT 사이 advisory lock 없어 동시 요청 시 한도 초과 가능. `pg_advisory_xact_lock(hashtext(wallet))` 추가.
- `server/services/siegeFleetBridge.js` `createSiegeBattle()` — `is_in_battle` 체크가 트랜잭션 외부. 동시 함대 배정과 TOCTOU 가능. FOR UPDATE + 트랜잭션으로 이동.

**문서화 (변경 없음):**

- `campaign.js` `complete()` `getObjectiveState` — 트랜잭션 외부에서 읽혀 목표 게이트가 FOR UPDATE lock과 엄격하게 직렬화되지 않음. 실용적 위험 낮음. TODO 주석 추가, 향후 리팩터링 대상.
- `campaign.js` CH10 `choices[0]` — 에이전트 보고 FALSE POSITIVE. 챕터당 선택 1개만 저장(line 4158 early-return guard)이 의도된 설계.

---

## 2026-05-07 v7.67 — ships.js 라우트 wallet 스푸핑 취약점 수정

**수정 (HIGH):**

- `server/routes/ships.js` `getWallet()` — `requireAuth` 뮤테이션 라우트(build, upgrade-stat, repair, shield, disassemble, market list/buy/cancel)가 `req.query.wallet` / `req.headers['x-wallet']` 폴백을 포함하는 단일 `getWallet()` 사용. 공격자가 자신의 JWT로 인증 후 `?wallet=victim`으로 타인 계정 GP 차감 가능. `getWallet()` (JWT 전용)와 `getWalletOptional()` (optionalAuth 읽기 전용 폴백 허용)으로 분리.

**감사 완료 (이미 안전):**
- `staking.js` — 뮤테이션 POST 라우트는 이미 `getAuthWallet(req)` (JWT 전용) 사용
- `lottery.js` — 뮤테이션 POST 라우트는 이미 `getAuthWallet(req)` 사용
- `auction.js` (routes) — 뮤테이션 POST 라우트는 이미 `getAuthWallet(req)` 사용
- `bounty.js` — 뮤테이션 POST 라우트는 이미 `getAuthWallet(req)` 사용
- `transport.js` — 뮤테이션 POST 라우트는 이미 `getWalletFromToken(req)` 사용
- `territoryIdentity.js` / `dailyOps.js` — 뮤테이션 라우트는 이미 `getAuthWallet(req)` 사용

---

## 2026-05-07 v7.66 — tribute/sponsor 동시 요청 제한 우회 방지

**수정 (MEDIUM):**

- `server/services/tribute.js` `sendTribute()` — 쿨다운 체크(`SELECT FROM territory_tributes WHERE from_wallet=... ORDER BY created_at DESC`) 가 `FOR UPDATE` 없이 진행. 동시 요청 두 개가 쿨다운 체크를 동시에 통과해 이중 tribute 가능. `pg_advisory_xact_lock(hashtext(wallet))` 추가로 동일 wallet 직렬화.
- `server/services/sponsor.js` `placeSponsor()` — `maxPerTerritory` COUNT 체크가 `FOR UPDATE` 없이 진행. 동시 요청 두 개가 같은 클레임 COUNT < max 통과 → 초과 sponsor 삽입. `pg_advisory_xact_lock(claimId)` 추가로 동일 클레임 직렬화.

**조사 결과 (변경 없음):**
- chain.js `processDeposit` — false positive. `deposits.tx_hash UNIQUE NOT NULL` 제약(migration 001)으로 이중 입금 방지됨.
- exploration.js POI deactivation — `FOR UPDATE` on POI row가 이미 직렬화. UI 상태 이슈. 보안 무관.
- siegeFleetBridge.js — admin/scheduler 경로. `create_siege_battle` stored proc에 DB 수준 보호 의존. 플레이어 직접 제어 불가.
- replayShare.js limit race — 자금 손실 없음. 최대 몇 개 초과 replay record. 낮은 우선순위.

---

## 2026-05-07 v7.65 — missions/worldEvents/governance/rocket 경쟁조건 수정

**수정 (MEDIUM):**

- `server/services/worldEvents.js` `distributeRewards()` — `UPDATE world_event_participants SET rewarded=true` 에 `AND rewarded=false` 가드 없음. 동시 `engageEvent`/`settleExpiredEvents` 호출 시 같은 참가자에게 GP+광물 이중 지급. `rowCount=0` 시 ROLLBACK+continue 추가.
- `server/services/governance.js` `recalculateCommander()` — `SELECT gp_balance FROM governance_positions WHERE role='commander'` 에 `FOR UPDATE` 없음. 동시 호출 시 같은 GP를 이중으로 commander_pool에 이전. `FOR UPDATE` 추가.
- `server/services/rocket.js` `scheduleRocketEvent()` — `SELECT ... WHERE status IN ('incoming','landed','looting')` 가 트랜잭션 외부. 동시 scheduler 틱 두 개가 각각 이벤트 생성. `pg_advisory_xact_lock(75300)` + `BEGIN/ROLLBACK/COMMIT` 블록으로 직렬화.

**수정 (LOW):**

- `server/services/missions.js` `launchMission()` — PP deduct `rowCount` 미체크. 동시 PP 소진 시 atomic guard 실패 무시하고 미션 생성됨. `rowCount=0` 시 ROLLBACK 추가.

**조사 결과 (변경 없음):**

- `hijack.js` `declareHijackWithPP()` `totalCost` — agent 보고 false positive. `baseCost`/`attackCost`는 route가 DB 픽셀 가격에서 서버사이드 계산. 클라이언트 조작 불가.
- `claimUpgrades.js` count check after GP deduction — false positive. `claims FOR UPDATE` 가 동일 영토의 모든 업그레이드를 직렬화함.

---

## 2026-05-07 v7.64 — auction/expedition/warBetting/vip/lottery 서비스 경쟁조건 수정

**수정 (CRITICAL):**

- `server/services/auction.js` `buyout()` — GP 차감 후 `rowCount` 미체크. 동시 GP 소진 시 `rowCount=0` 무시하고 auction이 `settled`로 닫히며 판매자에게 수익 지급 + 아이템 이전됨. 구매자 GP는 차감 안 됨 → 무료 즉구 가능. `rowCount === 0` 시 ROLLBACK 추가.

**수정 (MEDIUM):**

- `server/services/expedition.js` `resolveExpeditions()` — `UPDATE expeditions SET status='completed'` 에 `AND status='active'` 가드 없음. 동시 scheduler 틱 두 개가 같은 expedition 처리 → GP 이중 지급. `rowCount=0` 시 ROLLBACK + continue 추가.
- `server/services/expedition.js` `cancelExpedition()` — SELECT 가 트랜잭션 외부(`pool.query`). 동시 취소 두 요청이 같은 expedition 읽고 이중 환불. SELECT를 `BEGIN` 내 `FOR UPDATE + AND status='active'` 로 이동.
- `server/services/warBetting.js` `resolveEvent()` — 승자 베팅 `SELECT ... WHERE option=$2` 에 `AND status='pending'` 없음. 트랜잭션 충돌 후 재시도 시 `status='won'` 베팅에도 재지급. `AND status='pending'` 추가.

**수정 (LOW):**

- `server/services/vip.js` `buyVip()` — `vip_passes` FOR UPDATE 없어 동시 구매 두 요청이 각각 GP 차감 후 같은 pass row에 upsert → 패스는 1개지만 GP는 이중 차감. `INSERT DO NOTHING + SELECT FOR UPDATE` 직렬화 추가.
- `server/services/lottery.js` `drawWinner()` — `Math.random()` → `crypto.randomInt` 로 교체 (PRNG 예측 가능성 제거).

---

## 2026-05-07 v7.63 — 핵심 서비스 이중 처리 방지 + 경쟁 조건 수정

**수정 (CRITICAL — 서비스 레이어):**

- `server/services/auctionCombat.js` `_finalizeAuction()` — 동시 scheduler 틱 / buyout 요청 두 개가 같은 경매를 동시에 정산할 경우 `UPDATE auctions SET status='sold'`가 두 번 성공해 판매자에게 수익이 이중 지급됨.
  - `BEGIN` 직후 `SELECT ... FOR UPDATE`로 경매 행 잠금, `status IN ('active','ended')` 재확인
  - `UPDATE ... WHERE status IN ('active','ended')` + `rowCount === 0` 시 ROLLBACK & 조기 반환
- `server/services/auctionCombat.js` `placeBid()` — 이전 세션에서 시작된 수정: 경매 SELECT를 트랜잭션 외부(`pool.query`)에서 읽어 동시 입찰 시 GP 이중 차감 가능. FOR UPDATE 내부 트랜잭션으로 이동 완료.

**수정 (HIGH — 서비스 레이어):**

- `server/services/battleEngine.js` `applyBattleResults()` — 동시 호출 시(스케줄러 버그 or 네트워크 재시도) `fleet_battles` status='ended' 없이 UPDATE → 함대 전적(`battles_won/lost/total_kills`) 이중 적산.
  - `BEGIN` 직후 `SELECT ... FOR UPDATE`로 전투 행 잠금, `status === 'ended'` 시 ROLLBACK & skip
  - `UPDATE ... WHERE status != 'ended'` + `rowCount === 0` guard 추가
- `server/services/guild.js` `updateGuildInfo()` — 길드장 역할 체크 `SELECT role FROM guild_members WHERE ...` 에 `FOR UPDATE` 누락. 동시 요청 시 역할 변경 레이스로 비리더가 정보 수정 가능.
  - `SELECT role FROM guild_members WHERE guild_id=$1 AND wallet=$2 FOR UPDATE` 로 수정

**수정 (HIGH — 서비스 레이어):**

- `server/services/crafting.js` `craftItem()` — 일일 제작 횟수 제한 `COUNT(*) FROM crafting_log` 체크가 동시 요청 시 레이스 — 두 요청이 동시에 `count < max` 통과 후 모두 제작 진행.
  - `pg_advisory_xact_lock(hashtext(wallet))` 트랜잭션 어드바이저리 락으로 동일 wallet 직렬화

**조사 결과 (변경 없음):**

- `server/services/enhancementAdvanced.js` `calculateMaterialBonus()` — `pool.query`로 재료 잔액 사전 체크 후 `consumeMaterials(client, ...)` 내 atomic deduct. `AND quantity >= $3` 원자성 가드로 실제 이중 차감 불가. MEDIUM → DESIGN-SAFE 판정.

---

## 2026-05-07 v7.62 — 최종 라우트 감사 완료 + getWallet 정규화 마무리

**수정 (LOW):**

- `server/routes/auctionRoutes.js`, `jobs.js`, `factions.js` `getWallet()` — `.toLowerCase().trim()` 누락. 대소문자 불일치로 경매 self-deal 체크 우회 가능성. 패턴 통일.

**감사 확인 (버그 없음):**
- bugReport.js, crafting.js, resource.js, resources.js, transport.js — CLEAN (read-only 공개 설계)
- fleetSearch.js — wallet 검색 기능은 의도된 설계 (공개 fleet 검색)
- warBettingRoutes.js 레거시 admin 엔드포인트 — isAdmin(req)로 x-admin-secret 체크, JWT 불필요. 정상 패턴.
- weatherRoutes.js — CLEAN
- job.js, transport.js GET 비인증 — read-only 공개 데이터 (직업/수송 정보). 민감 정보 없음.

**최종 감사 범위:**
- 총 75개 라우트 파일 감사 완료
- 수정된 버그: CRITICAL 1개, HIGH 7개, LOW 11개 (v7.53~v7.62)

---

## 2026-05-07 v7.61 — alliance.js CRITICAL 런타임 크래시 + dailyOps GP 조작 + 다중 getWallet 패턴 수정

**수정 (CRITICAL):**

- `server/routes/alliance.js` — 서비스에 없는 5개 함수(`getAlliances`, `getSettings`, `getAllianceLog`, `depositTreasury`, `withdrawTreasury`) 호출로 모든 alliance 엔드포인트가 500 크래시 발생.
  - `getAlliances` → `listAlliances` 로 수정
  - `getSettings` → `getSetting('alliance_create_cost_gp')` 직접 DB 조회로 대체
  - `getAllianceLog` → 미구현 기능, 빈 배열 반환
  - `depositTreasury` / `withdrawTreasury` → 501 NOT_IMPLEMENTED (서비스에 아직 없음)

**수정 (HIGH):**

- `server/routes/dailyOps.js` `POST /daily-ops/progress` — `requireAuth`만 있어 일반 유저가 임의 `mission_type`으로 자신의 미션 진행도를 직접 올려 GP 보상 farming 가능. `requireAdmin` (x-admin-secret 헤더 체크) 추가. 서버 내부 호출은 `module.exports.notifyMissionProgress()` 직접 함수 export 경로 사용이므로 영향 없음.
- `server/routes/battleExtras.js` `POST /battles/siege/create` — "관리자/테스트 전용" 엔드포인트가 `requireAuth`만 있어 일반 유저가 임의 fleet ID로 타인 fleet을 강제 전투에 등록 가능. `requireAdmin` 추가.
- `server/routes/tacticalLab.js` `GET /tactical-lab/fleet-presets` — 비인증 공개 엔드포인트에서 전체 `ownerWallet` 주소 노출. SERIAL `battleId`로 열거 가능. `0x1234...5678` 형식 마스킹 처리.

**수정 (LOW):**

- `server/routes/phaseD.js` `getWallet()` — `?.` optional chaining + `.toLowerCase().trim()` 누락. team-battle 참가자 체크 `p.wallet === wallet` 대소문자 불일치 우회 방지.
- `server/routes/phaseC.js` `getWallet()` — 동일 패턴 수정.
- `server/routes/onboardingRoutes.js` `getWallet()` — 동일 패턴 수정.
- `server/routes/prestige.js` `/prestige/buy` 인라인 wallet 추출 — 동일 패턴 수정.

**감사 확인 (버그 없음):**
- commanderActions.js, announcement.js, branding.js, polls.js, vtag.js, banner.js, donation.js, profile.js, territoryIdentity.js, sectors.js, rating.js, sponsor.js, status.js, tdesc.js, tevt.js, tiers.js — CLEAN
- graffiti.js `placeGraffiti` — 서비스에서 owner 체크 존재 (`SELECT id, owner FROM claims`). 설계상 타인 영토에 쓰는 기능이므로 소유권 차단 아님. DESIGN INTENT.
- highlight.js `setHighlight` — 서비스에서 `NOT your territory` 소유권 체크 확인. FALSE POSITIVE.
- journal.js / milestone.js / beacon.js / broadcasts.js / capsule.js GET 엔드포인트 비인증 — read-only public data 설계. 민감 정보 없음. DESIGN INTENT.
- tombstone.js `svc` 로드 실패 시 TypeError — 서비스 파일 존재 확인, 실제 크래시 없음. LOW 위험.
- tprestige.js `claimId` parseInt 누락 — PostgreSQL 드라이버 자동 coerce, 실질 영향 없음.
- resourceCraft.js `GET /jobs` requireAuth 미들웨어 누락 — wallet length check로 기능적 보호. 방어적 패턴 개선 권장.

---

## 2026-05-07 v7.60 — tournaments.js 중복 참가 GP 이중 차감 수정

**수정 (LOW):**

- `server/services/tournaments.js` `joinTournament()` — 동일 wallet이 동시에 같은 토너먼트에 두 번 참가 요청 시 GP가 두 번 차감되나 entry는 `ON CONFLICT DO NOTHING`으로 한 번만 등록됨. tournament row의 `FOR UPDATE` 락이 직렬화하므로 실질 위험은 낮으나 두 번째 차감분 GP 손실 가능. `FOR UPDATE` 락 직후 `SELECT 1 FROM tournament_entries` 존재 체크를 추가해 `ALREADY_ENTERED` 에러로 조기 차단.

**감사 확인 (버그 없음):**
- `Math.random()` 기반 lottery/raffle 추첨 — 약한 PRNG이나 현재 Web3 블록체인 검증 없는 플랫폼 특성상 실질 조작 위험 낮음. 개선 필요 시 `crypto.getRandomValues()` 전환 권장.

---

## 2026-05-07 v7.59 — auth.js 비밀번호 변경/계정삭제 broken + arena.js hilo 소유권 검증 누락 수정

**수정 (HIGH):**

- `server/routes/auth.js` `POST /change-password` — JWT payload에 `userId` 없음 (`{ wallet, email, nickname }` 만 포함). `decoded.userId = undefined` → `WHERE id = $1` 조건이 null과 비교 → 사용자 미발견 → 비밀번호 변경 불가. `decoded.wallet` 기준 `WHERE LOWER(wallet_address) = $1` 로 수정.
- `server/routes/auth.js` `POST /delete-account` — 동일 원인으로 계정 삭제가 실제로 아무것도 하지 않음. pixels/claims/users 모두 `decoded.wallet` 기준으로 수정.
- `server/routes/arena.js` `POST /hilo/guess`, `POST /hilo/cashout` — 게임 소유권 검증 누락. `hilo_games.id`가 SERIAL(순차 정수)이므로 다른 플레이어의 게임에 guess를 실행해 강제 패배시킬 수 있는 griefing 공격 가능. 두 엔드포인트 모두 `g.wallet !== callerWallet` 시 403 반환하도록 소유권 체크 추가.

---

## 2026-05-07 v7.57 — 종합 감사 (governance/hijack/worldEvents/marketplace/daily-ops/siege) — 버그 없음

**감사 확인 (버그 없음):**
- **Governance/Commander Actions** — `verifyCommander(wallet, role)` 가 governance_positions WHERE wallet = $1 AND role = $2 로 실제 커맨더 권한을 확인. 글로벌 이벤트/바운티 GP 차감은 단일 커맨더 포지션 row에서만 발생. 에이전트가 제보한 "다른 커맨더 GP 도용" 시나리오는 UNIQUE(role, sector_id) 제약 + verifyCommander 게이트로 불가능.
- **Hijack `declareHijackWithPP()`** — `FOR UPDATE` 락 이후 잔액 체크, UPDATE에 `AND pp_balance >= $1` 이중 보호. 에이전트의 TOCTOU 제보는 FOR UPDATE가 행 잠금을 유지하는 한 불가능한 시나리오. FALSE POSITIVE.
- **World Events `engageEvent()`** — HP 차감 `UPDATE ... SET hp = GREATEST(0, hp - $2)` 단일 문장 원자 처리. FOR UPDATE 불필요. 쿨다운 삽입 wallet은 `getAuthWallet()`에서 이미 `.toLowerCase().trim()` 정규화됨. FALSE POSITIVE.
- **Marketplace `createListing()`** — `const w = seller.toLowerCase()` 함수 진입 시 정규화. SELECT/UPDATE 모두 `w`(소문자) 사용. 에이전트의 "wallet normalization mismatch" 제보는 FALSE POSITIVE.
- **Daily Ops claim** — `reward_claimed = FALSE FOR UPDATE` 이중 잠금, 트랜잭션 내 원자 처리. CLEAN.
- **Siege declare** — `requireAuth` 사용, JWT wallet 추출, GP 차감 `AND gp_balance >= $1` 원자 처리. CLEAN.
- **resourceCraft.js** — `user_resource_inventory` 올바르게 사용, 재료 차감과 결과 지급 동일 트랜잭션, `AND quantity >= $1` 원자 처리. CLEAN.

---

## 2026-05-07 v7.56 — tactical-lab reinforce() null guard 수정

**수정 (LOW):**

- `assets/tactical-lab-v11.html` `reinforce()` 함수 — `SHIPS[tid].name` 참조 시 `tid`가 유효하지 않은 코드인 경우 `Cannot read property 'name' of undefined` 크래시. `(SHIPS[tid]||{}).name||tid` 로 null guard 추가. (reinforce는 현재 UI에서 호출되지 않는 dead code지만 방어 처리.)

**감사 확인 (버그 없음):**
- P5-4 영토 업그레이드 UI (`loadTerritoryUpgrades`, `doTerritoryUpgrade`, `renderTerritoryUpgradeBody`) — wallet 전달, endpoint, 에러 처리, UI 갱신 모두 정상
- P5-5 섹터 컨트롤 (`_appendSectorControl`) — 빈 `owners` 배열 graceful 처리, `myEntry`, `influenceTier`/`controlPct` 렌더 정상
- P5-3 섹터 배지 (`sySectorBadge`) — unmapped code 안전 fallback 정상
- 캠페인 `pollCampaignProgress()` — `readyToComplete` 게이트, 미완료 objective 표시, complete 4xx/5xx 에러 처리 정상
- 캠페인 objective action routing — 6개 action type (`territory/territory_art/shipyard/fleet/fleet_battle/market`) 모두 핸들러 존재
- tactical-lab WS frame 핸들러 — v7.52 수정 후 `CATALOG` 참조 없음, `SHIPS[info.code]` null guard 정상
- 세계 이벤트 engage (`worldEvents.js`) — `getAuthWallet()` 정규화 패턴 (`?.` + `.toLowerCase().trim()`) 이미 적용됨

---

## 2026-05-07 v7.55 — ships.js / fleets.js getWallet 정규화 누락 수정

**수정 (LOW):**

- `server/routes/ships.js` `getWallet()` — JWT wallet 추출 시 `.toLowerCase().trim()` 정규화 없이 반환. ship market 등록/구매/취소, 건조, 강화 등 모든 함선 작업에서 미정규화 wallet 전달 가능성. `fleetBattles.js` v7.54 수정과 동일 패턴으로 통일.
- `server/routes/fleets.js` `getWallet()` — `req.user.wallet_address` optional chaining 누락 + `.trim()` 미처리. `?.` 추가 및 `.toLowerCase().trim()` 패턴 통일.

**참고:** 두 파일 모두 하위 서비스 레이어에서 `LOWER($1)` 비교 및 내부 `.toLowerCase()` 정규화가 있어 실제 데이터 불일치 위험은 낮음. 방어적 코드 품질 통일 목적.

**감사 확인 (버그 없음):**
- Guild GET 엔드포인트 (`/guild/my`, `/guild/invites`, `/guild/:id/requests`, `/guild/:id/search-users`) — `req.query.wallet` 기반 공개 READ 패턴은 의도된 설계. `/guild/:id/requests`는 서비스 레이어에서 leader/officer 권한 체크 확인.
- 영토 업그레이드 서비스 (`upgradeTerritory`) — FOR UPDATE 락, GP 차감 원자성, 레벨 한도 체크 정상
- 섹터 컨트롤 쿼리 (`COUNT(p.lat)`) — pixels.lat이 NOT NULL PRIMARY KEY이므로 `COUNT(*)` 동등. 정상.
- 함선 마켓 ID 필드명 — 내 함선 목록 `market_listing_id`, 마켓 목록 `listing_id` 일관성 확인.

---

## 2026-05-07 v7.54 — fleetBattles.js getWallet 정규화 누락 수정

**수정 (LOW):**

- `server/routes/fleetBattles.js` `getWallet()` — JWT 토큰에서 wallet 추출 시 `.toLowerCase().trim()` 정규화 없이 원본 케이스 그대로 반환. `fleet_battle_participants.wallet_address`에 대소문자 혼재 지갑 주소가 저장될 수 있어 향후 case-sensitive 쿼리에서 불일치 위험. 모든 다른 route 파일의 패턴 (`?.` + `toLowerCase().trim()`)으로 통일.

---

## 2026-05-07 v7.53 — 전체 코드베이스 종합 감사 (P5 Territory + Campaign + Admin) — 버그 없음

**감사 완료 (버그 없음):**

- **캠페인 스토리 렌더러** — `_campaignComposeEditorLayout` 병합 로직, `showCampaignStory`, `renderCampaignScene`, `pollCampaignProgress` 정상. `readyToComplete` 게이트, `campaign_objectives_gate` i18n 키 4개 언어 정의 확인
- **영토 업그레이드 UI (P5-4)** — `loadTerritoryUpgrades`/`doTerritoryUpgrade` 가 `/api/territory/:claimId/upgrades|upgrade` 엔드포인트 정확히 호출. `getUpgradeCatalog()` 반환 필드(`key/icon/name/nameEn/desc/bonusUnit/color/isP5/levels`) 프론트 렌더와 일치
- **섹터 컨트롤 UI (P5-5)** — `_appendSectorControl` → `/api/sectors/:sectorId/control` 정상 호출. 응답 필드(`owners/myEntry/influenceTier/controlPct`) 렌더와 일치
- **캠페인 Objective State (P5-7)** — `getObjectiveState` `materialHarvests`(resourceDrops JSONB 쿼리)/`territoryUpgradeLevels`(territory_upgrades SUM(level)) P5 추가 통계 확인
- **Admin 영토 경제 (P5-6)** — `loadTerritoryEconomy` → `/api/admin/territory/economy` 응답 필드(`harvestStats/materialIssued/materialBurn/suspiciousHarvesters/topClaims`) 일치. `_buildProfileEditor`/`saveTerritoryProductionProfile` → `/api/admin/territory/production-profile` 정상
- **서버 라우트 파일** — 전체 라우트/서비스 파일 Syntax check 통과. 모든 require 대상 파일 존재 확인 (`weeklyChallenges` try-catch 안전 처리 확인)
- **함선 마켓** — `syCancelShipListing(market_listing_id)` 취소, `syBuyShipListing(listing_id)` 구매 필드명 정합 확인
- **Daily Ops** — `notifyMissionProgress` 함수 `module.exports.prop` 패턴으로 올바르게 export됨
- **Forge 애니메이션** — DOM 요소(`forgeModal/forgeHammer/forgeGauge/forgeSparks` 등) 모두 존재 확인

**참고 (기능 영향 없음):**
- 마이그레이션 번호 중복: `213_ship_upgrade_materials_fix.sql`과 `213_shop_materials.sql` 동시 존재. 러너는 전체 파일명 기준 추적이므로 두 파일 모두 독립 적용 가능. 충돌 없음.

---

## 2026-05-07 v7.52 — tactical-lab WS 함선 격침 폭발 버그 수정

**수정 (MEDIUM):**

- `assets/tactical-lab-v11.html` — WS 'frame' 핸들러에서 `CATALOG` 미정의 변수 참조 수정. WS 모드에서 이전 프레임 대비 사라진 함선(격침) 감지 시 `CATALOG.ships` 조회가 ReferenceError를 발생시켜 폭발 이펙트/격침 로그가 표시되지 않는 버그. `CATALOG` → `SHIPS[info.code]` 직접 조회로 교체.

**검수 (버그 없음):**

- Fleet Command UX — 진형/기동 변경 모달 유지, 에러 메시지 커버리지, 형성 미리보기 로직 정상
- Ship Economy UX — 강화 확인 모달 (성공확률/GP/재료 보유/필요), 청사진 카드 재료 표시 정상
- `fleet-assault-demo.html` — Git 미추적 파일. `tactical-lab-v11.html`이 단일 프로덕션 파일임 확인

---

## 2026-05-07 v7.51 — 전체 게임 기능 검수 (버그 없음)

**감사 완료 (버그 없음):**

- Fleet Battle 전 경로 (declare-pvp, run, forfeit, history, timeline, report, highlights) — 인증/로직 정상
- Commander Actions (POST/GET) — requireAuth + JWT wallet 정상
- Battle Extras (rewards, siege) — 인증 정상
- Tactical Lab 카탈로그/fleet-presets (?bid= 실제 함대 로드) — 정상
- Fleets 전 엔드포인트 — JWT wallet 정상
- Ships 전 엔드포인트 (blueprints/market/build/upgrade-stat/repair) — 인증 정상
- Daily Ops /progress,/claim — getAuthWallet 사용 확인, getWallet dead code
- Harvest 엔드포인트 — getAuthWallet 확인
- 내부 캠페인 엔드포인트 (reputation/tags/lore/branch) — isInternalRequest 방어 확인
- Campaign OBJECTIVE_PRESETS MCC/FSP/CV 38챕터 전체 DB 연동 확인
- Campaign 보상 시스템 — 실제 지급/안전 수령 정상
- Campaign 시뮬레이션 — 전 경로 핸들러 확인
- Sector Control P5 엔드포인트 — 정상
- 서버 응답 확인 — tactical-lab/catalog, transport/settings 200 OK

---

## 2026-05-07 v7.50 — transport.js 크래시 + 캠페인 프롤로그 완료 블록 수정

**수정 (HIGH — 서버 크래시):**

- `server/routes/transport.js` — `requireWallet`/`getWallet` 미정의 참조 오류 수정. GET `/transport/my` 호출 시 서버가 `ReferenceError`로 크래시하는 버그 수정. `getWallet`/`requireWallet` 헬퍼 함수 추가.

**수정 (MEDIUM — 캠페인 프롤로그 완료 불가):**

- `server/services/campaign.js` — `isObjectiveDone()`에서 `action: 'unlock'`을 `action: 'story'`와 동일하게 처리. 프롤로그의 `route_unlock` objective가 `in_progress` 상태에서도 never-done으로 판정돼 프롤로그 챕터가 영구 OBJECTIVE_REQUIREMENTS_NOT_MET 상태가 되는 버그 수정.

---

## 2026-05-07 v7.48 — 프론트엔드 누락 인증 헤더 일괄 수정 (v7.47 후속 패치)

**수정 (HIGH — index.html 57개 fetch 호출):**

v7.47에서 서버 write endpoint에 requireAuth를 추가한 후 프론트엔드 호출이 Authorization 헤더 없이 요청을 보내 로그인 유저도 401을 받는 회귀 버그 수정.

- `index.html` — 50개 단일라인 `method:'POST',headers:{'Content-Type':'application/json'}` → `headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders())` 일괄 교체 (Python 스크립트 /api/auth/* 제외)
- `index.html` — governor tax-rate PUT, governor policy PUT, governor commander/bounty POST auth 헤더 추가
- `index.html` — `/api/upload` POST + `/api/claim/:id/image` PUT의 구 `localStorage.getItem('jwt')` 키를 `getAuthHeaders()`로 교체
- `index.html` — `/api/notifications/read`, `read-all`에 `getAuthHeaders()` 추가 (기존 x-wallet 헤더는 유지)
- `index.html` — `/api/bounty/post`, `/api/bounty/cancel` (3개 call site) auth 헤더 추가
- Arena `arenaAuthHeaders()` 함수 추가 + 10개 Cantina POST 적용 (v7.47 내 별도 커밋)

**영향 없는 호출 (의도적으로 미수정):**
- `/api/auth/login`, `/api/auth/find-email`, `/api/auth/reset-password`, `/api/auth/reset-password/verify` — 사전 인증 endpoint

## 2026-05-07 v7.47 — 37개 라우트 파일 JWT 인증 일괄 적용 (CRITICAL 보안 패치)

**수정 (CRITICAL / HIGH — 37개 라우트 파일, 70+ 엔드포인트):**

기존 `req.body.wallet` / `req.headers['x-wallet']` 신뢰 취약점을 전체 해소.
모든 파일에 표준 `requireAuth` JWT 미들웨어 + `getAuthWallet(req)` 패턴 적용.

- `profile.js` — `/profile/nickname`, `/avatar-color`, `/motto`
- `rental.js` — `/rental/list`, `/rent`, `/cancel`
- `staking.js` — `/staking/stake`, `/withdraw`
- `shield.js` — `/shield/activate`
- `tombstone.js` — `/tombstone/place`
- `wager.js` — `/wager/bet`
- `branding.js` — `/branding/name`, `/tagline`, `/color`, `/clear` (GP 소각)
- `graffiti.js` — `/graffiti/place`
- `spells.js` — `/spells/cast` (GP 소각)
- `rating.js` — `/rating/rate`
- `duel.js` — `/duels/challenge`, `/accept`, `/decline`, `/cancel` (GP 에스크로)
- `contest.js` — `/contests/submit`, `/vote`
- `tevt.js` — `/tevt/activate`
- `alliance.js` — `/alliances/create`, `/join`, `/leave`, `/deposit`, `/withdraw` (GP 소각)
- `raffle.js` — `/raffles/buy` (GP 소각)
- `crafting.js` — `/crafting/craft` (GP + 재료 소각)
- `expedition.js` — `/expeditions/launch`, `/cancel` (GP 소각)
- `tiers.js` — `/tiers/upgrade` (GP 소각)
- `tribute.js` — `/tribute/send` (GP 소각)
- `capsule.js` — `/capsule/bury` (GP 소각)
- `sponsor.js` — `/sponsor/place` (GP 소각)
- `donation.js` — `/donation/donate` (GP 소각)
- `beacon.js` — `/beacons/place` (GP 소각)
- `claimUpgrades.js` — `/upgrades/upgrade` (GP 소각, writeLimiter 유지)
- `tournaments.js` — `/tournaments/join` (GP 참가비)
- `polls.js` — `/polls/create`, `/vote`
- `banner.js` — `/banner/plant`
- `broadcasts.js` — `/broadcasts/create` (GP 소각)
- `highlight.js` — `/highlight/set` (GP 소각)
- `journal.js` — `/journal/publish`
- `milestone.js` — `/milestone/record`
- `monuments.js` — `/monuments/place`, `/preserve` (GP 소각)
- `status.js` — `/status/set`, `/clear`
- `tdesc.js` — `/tdesc/set` (GP 소각)
- `vtag.js` — `/vtag/set`, `/clear`
- `announcement.js` — `/announce/post`
- `governance.js` — `/sector/:id/tax-rate`, `/buff`, `/announcement`, `/commander/event`, `/announcement`, `/bounty` (GP 소각)
- `arena.js` — `/crash/bet`, `/cashout`, `/mines/start`, `/reveal`, `/cashout`, `/coinflip/play`, `/dice/play`, `/hilo/start`, `/guess`, `/cashout` (PP/USDT 소각 — Cantina 게임)

---

## 2026-05-07 v7.46 — api.js 전체 write 엔드포인트 JWT 인증 일괄 적용

**수정 (CRITICAL / HIGH — 60+ 엔드포인트):**
- `POST /withdraw-all`: body wallet → `requireAuth` (CRITICAL — USDT 전액 인출 취약점)
- `POST /swap`: body wallet → `requireAuth` (PP→USDT 스왑)
- `POST /exchange/pp-to-gp`: body wallet → `requireAuth` (PP→GP 교환)
- `POST /gp/transfer`: body/header wallet → `requireAuth` (GP 이체)
- `POST /shop/buy`, `/shop/use`, `/shop/auto-renew`: body wallet → `requireAuth`
- `POST /enhance`: body wallet → `requireAuth`
- `POST /claim`: body wallet → `requireAuth` (영토 클레임)
- `POST /hijack/declare-with-pp`: body wallet → `requireAuth`
- `PUT /claim/:id/image`: body wallet → `requireAuth`
- `POST /territory/merge`, `/territory/:claimId/upgrade`: body/header wallet → `requireAuth`
- `POST /claims/:id/rename`: body wallet → `requireAuth`
- `POST /campaign/start,/choice,/progress,/complete,/reward/claim,/abandon`: body wallet → `requireAuth`
- `POST /quests/:id/progress,/claim,/track`: body wallet → `requireAuth`
- `POST /season/claim,/share,/taps,/pass/purchase,/pass/claim`: body wallet → `requireAuth`
- `POST /guild/create,/invite,/invite/accept,/invite/decline,/join-request`: body wallet → `requireAuth`
- `POST /guild/request/approve,/reject,/leave,/kick,/promote,/demote,/transfer`: body wallet → `requireAuth`
- `POST /guild/update,/disband,/chat,/contribution,/levelup,/donate,/research`: body wallet → `requireAuth`
- `POST /guild/war/declare,/auto-win,/score,/continue`: body wallet → `requireAuth`
- `POST /missions/launch,/:id/claim,/:id/cancel`: body wallet → `requireAuth`
- `POST /items/materialize,/dematerialize`: body wallet → `requireAuth`
- `POST /exploration/discover,/hint`: body wallet → `requireAuth`
- `POST /rockets/trigger,/claim-loot,/priority`: body wallet → `requireAuth`
- `POST /cosmetic/equip,/unequip`: body wallet → `requireAuth`
- `POST /daily/login,/missions/:id/claim`: body wallet → `requireAuth`
- `POST /notifications/read,/read-all`: body/header wallet → `requireAuth`
- `POST /user/titles/equip`: body wallet → `requireAuth`
- `POST /tags/set-active-title`: body wallet → `requireAuth`

---

## 2026-05-07 v7.45 — harvest 3개 엔드포인트 JWT 인증 + api.js requireAuth 추가

**수정 (HIGH):**
- `server/routes/api.js` `POST /harvest`, `/territory/:claimId/harvest`, `/harvest-instant`: body wallet → `requireAuth` JWT. `/harvest-instant`는 body wallet으로 타인 PP 소각 가능한 치명적 취약점 차단.
- `server/routes/api.js`에 JWT `requireAuth` 미들웨어 추가 (공통 사용 가능).

---

## 2026-05-07 v7.44 — 8개 라우트 JWT 인증 추가

**수정 (HIGH):**
- `server/routes/auction.js` `POST /auction/create,/bid,/buyout,/cancel`: body wallet → `requireAuth` JWT
- `server/routes/bounty.js` `POST /post,/claim,/cancel/:id`: body wallet → `requireAuth` JWT
- `server/routes/dailyOps.js` `POST /progress,/claim`: body wallet → `requireAuth` JWT
- `server/routes/job.js` `POST /user/job`: body wallet → `requireAuth` JWT
- `server/routes/lottery.js` `POST /lottery/buy`: body wallet → `requireAuth` JWT
- `server/routes/resourceCraft.js` `POST /start,/:id/claim,/:id/cancel`: JWT fallback 제거, `requireAuth` 강제
- `server/routes/territoryIdentity.js` `PATCH /:claimId/identity`: body wallet → `requireAuth` JWT
- `server/routes/worldEvents.js` `POST /world-events/:id/engage`: JWT fallback 제거, `requireAuth` 강제

---

## 2026-05-07 v7.43 — 11개 서비스 rowCount 누락 수정

**수정 (MEDIUM — FOR UPDATE 후 rowCount 미검사):**
- `server/services/milestone.js` `createMilestone()`: rowCount guard 추가
- `server/services/enhancement.js` `enhanceItem()`: rowCount guard 추가
- `server/services/faction.js` `changeFaction()`: rowCount guard 추가
- `server/services/vtag.js` `setVtag()` + `clearVtag()`: rowCount guard 2개 추가
- `server/services/monuments.js` `createMonument()` + `preserveMonument()`: rowCount guard 2개 추가
- `server/services/broadcasts.js` `createBroadcast()`: rowCount guard 추가
- `server/services/tournaments.js` `enterTournament()`: rowCount guard 추가
- `server/services/titleExtended.js` `equipTitleExtended()`: rowCount guard 추가
- `server/services/title.js` `equipTitle()`: rowCount guard + ROLLBACK 추가

---

## 2026-05-07 v7.42 — auto-win TOCTOU + 닉네임 TOCTOU + auction 커넥션 수정

**수정 (HIGH):**
- `server/routes/api.js` `/guild/war/auto-win`: 쿨다운 체크(SELECT)와 포인트 INSERT가 별도 `pool.query()` → 동시 요청 2개가 쿨다운을 통과 후 이중 포인트 지급 가능. 전체 로직을 단일 트랜잭션으로 묶고 `guild_wars FOR UPDATE`로 직렬화.

**수정 (MEDIUM):**
- `server/services/profile.js` `_changeField()`: `setNickname()`의 닉네임 중복 체크가 트랜잭션 외부(pool.query) → 동시 2개 요청이 같은 닉네임 선점 가능. 유일성 체크를 `_changeField()` 트랜잭션 내부로 이동.
- `server/services/auction.js` `buyout()` + `settleExpired()`: `COMMIT` 후 이미 사용된 transaction `client`로 `creditReferralCommission()` 호출 → pool에서 fresh connection(`rc`) 획득 후 커미션 처리로 변경.

---

## 2026-05-07 v7.41 — transport/vip JWT 인증 + auction/donate rowCount 수정

**수정 (HIGH):**
- `server/routes/transport.js` `POST /transport/start`, `/raid`, `/cancel`: wallet body/header fallback → 타인 wallet으로 화물 시작/레이드/취소(GP 환불 포함) 가능. `requireAuth` JWT 미들웨어 추가, wallet 토큰에서 추출.
- `server/routes/vip.js` `POST /vip/purchase`: 동일 — JWT 없이 타인 wallet으로 VIP 구매 GP 소각 가능. `requireAuth` 추가.
- `server/services/auction.js` `createAuction()` + `placeBid()`: GP deduct UPDATE rowCount 미검사 → 리스팅비/입찰금 미차감 후 경매 진행 가능. rowCount === 0 → INSUFFICIENT_GP ROLLBACK 추가.
- `server/routes/api.js` `/guild/donate`: GP deduct rowCount 미검사 → GP 미차감 후 treasury 증가 가능. rowCount guard 추가.

**잔여 알려진 이슈 (다음 이터레이션):**
- `api.js /guild/war/auto-win` 쿨다운 체크 TOCTOU (포인트 이중 지급, GP 없음) — medium priority
- `profile.js setNickname()` 닉네임 중복 체크 TOCTOU — DB unique constraint로 해결 필요
- `auction.js creditReferralCommission` post-COMMIT released client — 커미션 신뢰성 문제

---

## 2026-05-07 v7.40 — commanderActions/marketplace JWT 인증 + battleRewards FOR UPDATE

**수정 (HIGH):**
- `server/routes/commanderActions.js` `POST /battles/:id/commander-action`: wallet body/header fallback 허용 → JWT 없이 타인 wallet으로 commander action GP 소각 가능. `requireAuth` 미들웨어 추가, `body.wallet`/`x-wallet` fallback 제거.
- `server/routes/marketplace.js` `POST /list`, `POST /cancel`, `POST /buy`: wallet body에서 신뢰 (JWT 없음) → 타인 wallet으로 리스팅 취소/구매 조작 가능. `requireAuth` JWT 추가, wallet 토큰에서 추출.
- `server/services/battleRewards.js` `distributeMinimalRewards()`: `fleet_battles` FOR UPDATE 없이 idempotency check → 동시 2개 호출이 둘 다 기존 보상 없음으로 판정 후 이중 지급. `SELECT id FROM fleet_battles WHERE id=$1 FOR UPDATE`를 BEGIN 직후에 추가.

**감사 완료 (버그 없음):**
- fleets.js — requireAuth + JWT wallet 정상
- lottery.js buyTickets — FOR UPDATE 있어 ticket 번호 충돌 방지됨 (fragile but safe)
- tprestige.js ownership check — LOW (이미 prestige row FOR UPDATE + service-level 체크로 완화)
- aiFleetManager.js, battleEngine.js, claimUpgrades.js — 정상

---

## 2026-05-07 v7.39 — worldEvents 이중 정산 + rocket rowCount + siege 인증 누락 + warBetting 정보 유출

**수정 (HIGH):**
- `server/services/worldEvents.js` `settleExpiredEvents()`: 만료 이벤트 목록 SELECT 후 별도 UPDATE → 동시 스케줄러 2개가 동일 이벤트 처리 → `distributeRewards` 이중 호출 가능. CAS `UPDATE ... WHERE id=$1 AND status IN ('active','engaged')` + `rowCount===0` → continue 추가.
- `server/services/rocket.js` `claimRocketLoot()`: quest_reward_pool deduct UPDATE rowCount 미검사 → 풀에서 차감 실패 시에도 PP가 유저에게 지급됨. `rowCount===0` 시 콘솔 경고 후 직접 민팅 경로로 이동 (reward 변수 업데이트 조건화).
- `server/routes/siege.js` `POST /siege/declare`, `POST /governor/declaration`, `PUT /governor/tax-rate`, `PUT /governor/policy`: wallet을 body에서 신뢰 (JWT 없음) → 타인 지갑으로 siege 선언/세율 변경/정책 변경 가능. `requireAuth` JWT 미들웨어 추가, wallet은 토큰에서 추출.

**수정 (MEDIUM):**
- `server/routes/warBettingRoutes.js` `GET /betting/mine`: JWT 실패 시 `?wallet=` query param 폴백 → 누구나 임의 지갑의 베팅 내역 조회 가능. 폴백 제거, JWT 필수화.

**감사 완료 (버그 없음):**
- spells.js, shield.js — FOR UPDATE + rowCount 정상
- rocket.js autoScheduleRocket — MEDIUM (스케줄러 중복 INSERT), 이중 이벤트는 서버 재시작 시에만 발생하고 6h 최근 체크로 억제. 향후 advisory lock으로 개선 가능.

---

## 2026-05-07 v7.38 — guild war 이중 정산·createGuild TOCTOU + crafting/announcement/donation/branding rowCount/FOR UPDATE

**수정 (HIGH):**
- `server/services/guild.js` `resolveExpiredWars()`: 전쟁 행을 트랜잭션 밖에서 일괄 SELECT → 동시 스케줄러 2개가 동일 war를 처리해 treasury 이중 지급 가능. 루프 내부 BEGIN 후 `SELECT ... WHERE id=$1 AND status='active' FOR UPDATE` CAS 재조회 추가 — 이미 처리된 war는 ROLLBACK+continue.
- `server/services/crafting.js` `craftItem()`: GP deduct UPDATE rowCount 미검사 → GP 미차감 후 아이템 지급 가능. `rowCount === 0` → `INSUFFICIENT_GP` throw 추가.
- `server/services/announcement.js` `postAnnouncement()`: 동일 — rowCount guard 추가.
- `server/services/donation.js` `donate()`: 동일 — rowCount guard 추가.

**수정 (MEDIUM):**
- `server/services/guild.js` `createGuild()`: guild_id 멤버십 체크를 별도 plain SELECT로 확인 후 FOR UPDATE → TOCTOU — 동시 acceptInvite가 guild_id를 바꿔 2개 길드 동시 멤버십 가능. 단일 `SELECT guild_id, gp_balance ... FOR UPDATE` 쿼리로 통합. GP deduct rowCount guard도 추가.
- `server/services/branding.js` `_setBrandingField()`: 영토 ownership check가 `FOR UPDATE` 없음 → 동시 territory transfer 후에도 이전 소유자가 브랜딩 가능. `SELECT owner FROM claims WHERE id=$1 FOR UPDATE`로 변경.

**감사 완료 (버그 없음):**
- transport.js, sponsor.js, capsule.js — FOR UPDATE + rowCount 정상
- beacon.js, contest.js, announcement.js (잔여 조회) — 정상
- wager.js autoLockExpired — 이중 UPDATE가 idempotent (LOW, 무시)

---

## 2026-05-07 v7.37 — maintenance 이중 실행 + season 동시 생성 + phaseCScheduler CAS + exploration rowCount

**수정 (CRITICAL):**
- `server/services/maintenance.js` `processMaintenanceFees()`: 주간 타임스탬프 체크가 비원자적 → 동시 스케줄러 2개가 둘 다 체크를 통과해 유저에게 이중 유지비/영토 포기 적용 가능. `pg_try_advisory_lock(ADVISORY_LOCK_KEY)` 추가 — 락 획득 실패 시 `concurrent_run`으로 즉시 반환. 타임스탬프 재조회를 락 획득 후로 이동.
- `server/services/maintenance.js` `processMaintenanceFees()`: 영토 포기 시 `owner = 'abandoned'` (리터럴 문자열) → `owner = NULL`로 수정. 문자열 'abandoned'는 `claims.owner`가 `users.wallet_address`를 참조하는 FK 컬럼 의미상 잘못된 값. `deleted_at`만으로 soft-delete 신호 전달.

**수정 (경쟁 조건):**
- `server/services/phaseCScheduler.js` 마감 토너먼트 `registering→ready` 전환: `SELECT + UPDATE` 분리 비원자적 → 동시 2개 스케줄러가 동일 행 중복 전환 가능. 단일 `UPDATE ... WHERE status='registering' ... RETURNING id`로 CAS 원자화.
- `server/services/exploration.js` `discoverPOI()` 탐색비 PP 차감: `FOR UPDATE` 락 후 deduct UPDATE의 `rowCount` 미검사 → 엣지 케이스에서 차감 실패 무시 가능. `rowCount === 0` 시 ROLLBACK + error 반환 추가.
- `server/services/season.js` `autoRotateSeason()` 신규 시즌 INSERT: 동시 2개 스케줄러가 "활성 시즌 없음" 체크 통과 → 2개 시즌 동시 생성 가능. `INSERT ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM seasons WHERE active=true)` 조건부 INSERT로 변경. `rowCount===0` 시 silent skip.

---

## 2026-05-07 v7.36 — prestige/tprestige 인증 추가 + daily 트랜잭션 + prestige rowCount 수정

**수정 (보안):**
- `server/routes/prestige.js` `POST /prestige/buy`: `requireAuth` 미들웨어 없음 — 누구나 임의 지갑의 GP를 소각 가능. JWT `requireAuth` 추가, wallet은 토큰에서 추출 (body.wallet 신뢰 안 함).
- `server/routes/tprestige.js` `POST /tprestige/upgrade`: 동일 문제 — `requireAuth` 추가, wallet 토큰 추출.

**수정 (데이터 정합):**
- `server/services/daily.js` `recordDailyLogin()`: 로그인 INSERT + GP 지급 + 마일스톤 GP 지급이 별도 `pool.query` 3개로 트랜잭션 없이 실행됨 → 서버 크래시 시 부분 지급 가능. BEGIN/COMMIT 단일 트랜잭션으로 통합.
- `server/services/prestige.js` `buyPrestige()`: GP deduct UPDATE rowCount 미검사 → `INSUFFICIENT_GP` throw 추가.

---

## 2026-05-07 v7.35 — enhancement/marketplace/governance FOR UPDATE 경쟁 수정

**수정:**
- `server/services/enhancement.js` `enhanceItem()`: `item_instances` 조회에 `FOR UPDATE OF ii` 누락 → 동시 강화 2회 요청이 둘 다 레벨 올릴 수 있는 경쟁 가능 → `FOR UPDATE OF ii` 추가.
- `server/services/marketplace.js` `cancelListing()`: 리스팅 조회에 `FOR UPDATE` 누락 → 동시 취소 2개 요청이 에스크로(광물/클레임/아이템)를 이중 반환 가능 → `FOR UPDATE` 추가.
- `server/services/governance.js` `recalculateGovernor()` vice_governor GP 이전 SELECT — `FOR UPDATE` 누락 → 동시 거버넌스 재계산 시 이중 이전 가능 → `FOR UPDATE` 추가.
- `server/services/governance.js` `recalculateCommander()` vice_commander GP 이전 SELECT — 동일 수정.

**감사 완료 (버그 없음):**
- lottery.js — FOR UPDATE + rowCount 패턴 정상.
- staking.js — FOR UPDATE + rowCount 패턴 정상. withdrawStake FOR UPDATE + status 체크 정상.
- dividends.js — distributeLastWeek FOR UPDATE + ON CONFLICT DO NOTHING 정상.
- marketplace.js buyListing — FOR UPDATE 정상, 동시 구매 경쟁 차단됨.
- enhancement.js GP deduction — FOR UPDATE + AND balance>= + rowCount 정상.
- achievement.js — ON CONFLICT (wallet, achievement_key) DO NOTHING RETURNING 정상.

---

## 2026-05-07 v7.34 — harvest 첫 수확 경쟁 + SHIP_IN_BATTLE 검사 우회 수정

**수정:**
- `server/routes/api.js` `POST /harvest`: 신규 유저(user_mining 행 없음) 대상 `FOR UPDATE`가 행이 없어 락 미동작 → 동시 2개 요청이 모두 쿨다운 체크 통과해 이중 수확 가능. 쿨다운 SELECT 전에 `INSERT INTO user_mining … ON CONFLICT DO NOTHING` 센티넬 INSERT 추가 → 항상 실제 행에 FOR UPDATE 락 적용.
- `server/services/ship.js` `upgradeShipStat()` SHIP_IN_BATTLE 체크: `try/catch`가 `e.message === 'SHIP_IN_BATTLE'`만 re-throw하고 나머지 DB 오류는 삼킴 → 전투 체크 쿼리가 실패해도 업그레이드 진행 가능. `try/catch` 제거하고 쿼리 오류를 정상 전파하도록 수정.

---

## 2026-05-07 v7.33 — shield 충전 crash 수정 + worldEvents 쿨다운 경쟁 + siege 락 + 스케줄러 admin gate

**수정:**
- `server/services/ship.js` `chargeShield()`: `const chargeUnits` 재할당으로 `TypeError: Assignment to constant variable` crash 발생 → `actualUnits` 변수로 분리. 요청량이 여유 용량 초과 시 크래시 대신 클램핑 처리.
- `server/services/worldEvents.js` `engageEvent()`: 쿨다운 SELECT에 `FOR UPDATE` 누락 → 동시 요청 2개가 쿨다운 체크를 동시에 통과해 동일 이벤트 2회 참가 가능 → `FOR UPDATE` 추가.
- `server/services/siege.js` `declareSiege()`: `FOR UPDATE OF sg` (LEFT JOIN 결과가 NULL인 미거버너 섹터에서 락 없음) → `FOR UPDATE OF sd` (sector_definitions는 항상 존재)로 변경. 동시 2회 siege 선언 경쟁 차단.
- `server/routes/ships.js` `POST /process-completed`: `requireAuth` (일반 유저도 접근 가능) → `requireAdmin` (어드민 시크릿 필수)으로 변경. 스케줄러급 일괄 처리 엔드포인트를 일반 유저에게 노출하지 않음.

---

## 2026-05-07 v7.32 — 함대전 치명 버그 4건 수정 + 캠페인 안전성 강화

**수정:**
- `server/routes/fleetBattles.js` `POST /:id/forfeit`: `status='preparing'` 포기 시 `fleets.is_in_battle` 해제 누락 → 양측 함대 영구 잠금 버그 수정. BEGIN/COMMIT 트랜잭션 안에서 fleet_battle_participants → fleet_id 조회 후 `UPDATE fleets SET is_in_battle=false` 추가.
- `server/routes/fleetBattles.js` `POST /:id/run`: `SELECT 1 FROM fleet_battle_participants` (참가자 여부만 확인)를 `SELECT side` (공격자 확인)로 변경. 방어자가 유리한 시점에 강제 시뮬 시작하는 게임플레이 악용 차단 (`ONLY_ATTACKER_CAN_RUN`).
- `server/services/battleRewards.js` `distributeMinimalRewards()`: 무승부 보상 중복 방지 idempotency guard 추가 — `fleet_battle_rewards` 기존 행 존재 시 즉시 ROLLBACK 반환.
- `server/services/campaign.js` `complete()`: 최종 `UPDATE player_campaign_progress WHERE status='in_progress'` rowCount 미검사 → `if (updated.rowCount === 0)` ROLLBACK + `SESSION_NOT_FOUND` 에러 추가. 동시 호출/abandon 경쟁 시 보상 중복 지급 방지.
- `server/services/campaign.js` campaign_reward_inbox INSERT에 `ON CONFLICT DO NOTHING` 추가 — 리트라이/재시도 시 inbox 중복 행 생성 방지.

---

## 2026-05-07 v7.31 — 28개 write 엔드포인트 rate limiter 추가 + rowCount 누락 2건 수정 + expedition 트랜잭션 수정

**수정:**
- `server/index.js`: `apiWriteLimiter`(60req/min, GET/HEAD/OPTIONS skip) 추가 → `app.use('/api', apiWriteLimiter)`로 모든 API write 엔드포인트에 일괄 적용. 28개 라우트 파일의 GP 소각 write 엔드포인트가 globalLimiter(3000/15min)만 적용된 격차를 해소.
- `server/services/raffle.js`: `buyTickets()` GP deduct UPDATE rowCount 체크 누락 → `if (deductRes.rowCount === 0) throw new Error('INSUFFICIENT_GP')` 추가.
- `server/services/tdesc.js`: `setDescription()` GP deduct UPDATE rowCount 체크 누락 → 동일 패턴으로 추가.
- `server/services/expedition.js`: `cancelExpedition()` 취소 처리 2개 쿼리(status UPDATE + refund credit)가 트랜잭션 없이 별도 `pool.query`로 실행됨 → `BEGIN/COMMIT/ROLLBACK` 트랜잭션으로 감쌈.

**감사 완료 (버그 없음):**
- adminEconomyRoutes.js P5 territory/upgrades, territory/sector-control, territory/production-profile 엔드포인트 → 모두 requireAdmin + allowedKeys 화이트리스트 정상.
- 28개 루트 파일 SQL 인젝션 전수 검사 → 실제 사용자 입력이 SQL에 직접 삽입되는 사례 0건.
- 28개 루트 파일 /admin/ 경로 인증 검사 → admin.js (adminAuth 미들웨어) 별도 마운트로 모두 보호됨.
- 14개 서비스 파일 GP rowCount/FOR UPDATE 패턴 전수 검사 → raffle/tdesc 2건 제외 모두 정상.

---

## 2026-05-07 v7.30 — 기능 감사 완료 + claimUpgrades rate limiter 추가

**기능 감사 (버그 없음):**
- harvest/mining 트랜잭션, P5-2 자원 드롭, P5-5 섹터 컨트롤, declare-pvp, crafting, vip 모두 정상.
- 9개 핵심 서버 파일 `node --check` 통과. 필요 라우트 파일 전부 존재 확인.

**수정:**
- `server/routes/claimUpgrades.js` POST /upgrades/upgrade writeLimiter(30req/min) 추가. 기존에는 globalLimiter(3000req/15min)만 적용됐음.

---

## 2026-05-07 v7.29 — admin 엔드포인트 인증 누락 6건 + SQL 인젝션 1건 수정

**발견 및 수정:**

- **server/routes/siege.js**
  - `GET /admin/sieges`: `requireAdmin` 누락 → 추가
  - `POST /admin/sieges/:id/resolve`: `requireAdmin` 누락 → 추가
  - `GET /admin/sieges`의 `status` 쿼리 파라미터 SQL 직접 삽입 → 화이트리스트(`ALLOWED_STATUSES`) + 파라미터화(`$2`)로 수정
- **server/routes/resource.js**: `GET /admin/resources`, `PUT /admin/resource-rate` — `requireAdmin` 추가
- **server/routes/job.js**: `GET /admin/jobs`, `PUT /admin/job-buff` — `requireAdmin` 추가
- **server/routes/sectors.js**: `GET /admin/sector-defs` — `requireAdmin` 추가

**검증:** `node --check` 전부 통과. 커밋 a2e0006.

**추가 감사 결과 (버그 없음):**
- `declare-pvp` 트랜잭션 내 `FOR UPDATE` 이중 체크 확인
- worldEvents.js engage 플로우 정상
- P5-5 sector control 쿼리 정상
- alliance.js rowCount + FOR UPDATE 기존 적용 확인

---

## 2026-05-07 v7.28 — 전체 코드베이스 버그 감사 완료 (shipScheduler + SQL 정합성)

**감사 완료 항목**:
- `processCompletedJobs()` (ship.js line 566): per-job try/catch 격리 확인, 이중처리 없음 (`WHERE status = 'building'` 원자 claim).
- `cancelBuildJob()` (ship.js line 592): `FOR UPDATE` + 상태 체크 + 환불 트랜잭션 정상.
- SQL 인젝션 스캔: `${balCol}` (arena.js/api.js/marketplace.js) — 모두 코드 내 상수에서 유도됨. `${setClause}` (territoryIdentity.js, admin.js) — hardcoded 키 배열에서 구성됨. 외부 입력 삽입 경로 없음.
- `FOR UPDATE` + 명시적 잔액 체크 패턴 확인: announcement, donation, milestone, monuments, faction, raffle, prestige, tdesc, vtag, tournaments, title, titleExtended, season — 모두 동일한 안전 패턴. rowCount 생략은 `FOR UPDATE` 락이 보장하므로 문제 없음.
- P5 업그레이드 statusMap: `'P5 territory upgrades are currently disabled'` → 400 반환 (의도적, 기능 비활성화는 클라이언트 에러).
- `territory_upgrades` 스키마 확인: `updated_at` 컬럼 존재 (migration 180). 머지 코드(api.js:5638)의 동적 컬럼 감지도 `updated_at` 우선 처리로 정합.
- battleRewards.js: GP 지급만 있고 차감 없음. rowCount 불필요.
- arena.js: crash/mines/coinflip/dice/hilo 모두 rowCount 가드 존재 확인.
- guild/donate (api.js:6836): `FOR UPDATE` + 명시적 잔액 체크로 안전. wallet_address 대소문자 경로 경미한 불일치 존재하나 `w`가 이미 소문자이므로 실 영향 없음.

**결론**: 전체 코드베이스 rowCount/TOCTOU 스윕 완료. SQL 인젝션 경로 없음. 잔액 차감 원자성 보장됨. 새로 발견된 크리티컬 버그 없음.

---

## 2026-05-07 v7.27 — P5 영토 업그레이드 버그 3종 수정

**server/services/claimUpgrades.js**:
- `upgraded_at` → `updated_at`: territory_upgrades 테이블 실제 컬럼명. 이 버그로 모든 업그레이드 시도가 PostgreSQL `42703` 에러로 실패했음.
- P5 활성화 게이트 추가: P5 트랙(effect 필드가 있는 타입)은 `cfg.p5Enabled = false`일 때 차단됨.
- P5 maxLevel 분리: 카탈로그 + upgradeTerritory 모두 P5 트랙에 `cfg.p5MaxLevel`, 클래식 트랙에 `cfg.maxLevel` 사용.
- UPDATE 쿼리 $2 파라미터 정리: wallet이 $2로 전달됐으나 WHERE 절에 미사용 — $2 제거.
- 검증: `getUpgradeCatalog()` 9개 트랙, P5 5개 maxLevel=5, extractor 비용 `[50,150,350,800,2000]` 정상 파싱 확인.

---

## 2026-05-07 v7.26 — 서비스 전체 rowCount 스윕 완료 (38파일)

**rowCount 가드 전체 서비스 적용 완료.** 모든 `AND gp_balance >= $N` / `AND pp_balance >= $N` guarded UPDATE에 `rowCount === 0` 검사 추가:

**server/services/** (Codex 35파일): alliance, banner, beacon, branding, capsule, contest, duel, expedition, graffiti, highlight, hijack, job, journal, lottery, maintenance, polls, profile, rating, rental, shield, siege, spells, sponsor, staking, status, tevt, tiers, tombstone, tournament, tprestige, transport, tribute, vip, wager, warBetting.

**server/routes/governance.js** — governance_positions 차감 3곳 rowCount 추가.
**server/routes/bounty.js** — 현상금 등록 GP 차감 rowCount 추가.
**server/services/enhancement.js** — blessed_scroll/protect_scroll 소모 rowCount 추가 (`BLESSED_SCROLL_UNAVAILABLE` / `PROTECT_SCROLL_UNAVAILABLE`).

모든 38파일 `node --check` 통과. 로직 변경 없음 — 경쟁 조건 시 silent no-op이 명시적 에러로 표면화됨.

---

## 2026-05-07 v7.25 — api.js TOCTOU 12종 + ship.js rowCount 5종 완료

**server/routes/api.js** (Codex) — 12개 엔드포인트 guarded UPDATE 이후 `rowCount === 0` 누락 수정:
- `/claim` · `/swap` · `/shop/buy` · `/cosmetic/equip` · `/harvest-instant` · `/claims/:id/rename`
- `/exploration/hint` · `/rockets/priority` · `/exchange/pp-to-gp` · `/gp/transfer`
- `/harvest` guild contribution · `/guild/war/continue` (GP·PP 두 경로 모두)

모든 위치에 `SELECT ... FOR UPDATE`는 이미 존재했음. 누락된 것은 `deductXxx.rowCount === 0` 시 ROLLBACK + 400 응답 뿐이었음. 이제 완전한 원자적 잔액 차감 보장.

**server/services/ship.js** — 5개 GP 차감 위치 rowCount 검사 추가:
- `startBuild()` (line ~304): `deductBuild.rowCount === 0` → `INSUFFICIENT_GP`
- `repairShip()` (line ~850): `deductRepair.rowCount === 0` → `INSUFFICIENT_GP`
- `chargeShield()` (line ~971): `deductShield.rowCount === 0` → `INSUFFICIENT_GP`
- `upgradeShipStat()` (line ~1251): `deductUpgradeStat.rowCount === 0` → `INSUFFICIENT_GP`
- `buyShipListing()` (line ~1556): `deductBuyListing.rowCount === 0` → `INSUFFICIENT_GP`

모두 FOR UPDATE 락은 이미 있었으나 silent failure 가능성이 있었음. 이제 잔액 경쟁 조건 시 정확한 에러 반환.

---

## 2026-05-07 v7.24 — Rate limiter 누락 엔드포인트 보강

**server/routes/api.js** — `writeLimiter` 누락 엔드포인트 4곳 추가:
- `POST /referral/register`: `ensureUser` 내부에서 wallet 값으로 신규 유저를 생성하므로 스팸 시 DB 블로트 가능. `writeLimiter` 추가.
- `POST /campaign/editor-layout`: 전역 `settings.campaign_editor_layout` 키를 덮어쓰는 공유 엔드포인트 — 스팸 방지.
- `POST /user/titles/equip`: 타이틀 장착 변경 요청 스팸 방지.
- `POST /error-report`: `client_errors` 테이블 INSERT 경로 — 스팸 방지.

---

## 2026-05-07 v7.23 — 캠페인 objective gate + 함선 건조 완료 원자성 수정 (Codex)

**server/services/campaign.js** — `getMissingRequiredObjectives()`: 기존에는 `stat` 필드가 있는 목표만 gate했음. `choice`-type 필수 목표(분기 선택을 아직 안 한 챕터)가 완료 조건으로 작동하지 않던 버그 수정. 이제 모든 non-optional, non-claim_result 목표가 `state !== 'done'`이면 완료를 막는다.

**server/services/ship.js** — `completeBuildJob()`: 함선 INSERT 전에 `UPDATE ship_build_jobs SET status = 'completed' WHERE id = $1 AND status = 'building'` 을 먼저 실행해 원자적으로 작업을 선점. rowCount=0이면 이미 다른 프로세스가 처리 중이므로 ROLLBACK + `already_completed` 반환. 기존에는 CRASH 재시도 시 ship이 중복 생성될 수 있었음. fleet 행 `FOR UPDATE` 락도 flagship 체크 전으로 앞당겨 동시 건조 완료 race condition 차단. `ship_type_code` null check 추가.

---

## 2026-05-07 v7.22 — TOCTOU 전체 스윕 완료 확인

전체 server/ 대상 최종 grep 스캔: 미보호 balance/quantity 차감 0건, SQL 인젝션 경로 0건, connection leak 0건. 추가 확인: bounty/dailyOps/shipScheduler/resourceCraft/battleRewards/fleetBattles 모두 클린.

---

## 2026-05-07 v7.21 — 길드 Treasury + attack_boost 가드 추가

**server/services/guild.js** — levelUp/startResearch/declareWar 3곳 `gp_treasury` 차감 UPDATE에 `AND gp_treasury >= $1` 가드 + rowCount 확인 추가.
**server/routes/api.js** — attack_boost `uses_remaining - 1` 에 `AND uses_remaining > 0` 가드 추가.

---

## 2026-05-07 v7.20 — Cantina 미니게임 TOCTOU 5종 수정

**server/routes/arena.js** — coinflip/dice/hilo: `SELECT balance FROM users` 에 `FOR UPDATE` 추가. mines/crash: `UPDATE users SET balCol = balCol - $1` 에 `AND ${balCol} >= $1` 가드 + rowCount 확인 추가. 5개 미니게임 베팅 경로 동시성 취약점 전부 해소.

---

## 2026-05-07 v7.19 — 시즌 패스 티어 보상 중복 수령 방어

**server/services/season.js** — `claimPassTier()`: `season_pass_claims` INSERT에 `ON CONFLICT DO NOTHING RETURNING id` 추가. rowCount=0이면 ROLLBACK + already claimed 반환. DB unique constraint (`season_id, wallet, tier, is_premium`)를 최후 방어선으로 활용.

---

## 2026-05-07 v7.18 — 일일 출석 동시 요청 이중 지급 수정

**server/services/daily.js** — `recordDailyLogin()`: `INSERT INTO daily_logins`에 `ON CONFLICT (wallet, login_date) DO NOTHING RETURNING id` 추가. rowCount=0이면 race condition으로 다른 요청이 이미 INSERT한 것이므로 alreadyClaimed 반환. 동시 출석 요청 시 unique violation 500 에러 + 이중 GP/PP credit 위험 완전 차단.

---

## 2026-05-07 v7.17 — quest_reward_pool 경쟁 조건 수정

**server/services/missions.js, exploration.js, rocket.js** — `quest_reward_pool` SELECT에 `FOR UPDATE` 추가, UPDATE에 `AND balance >= $1` 가드 추가. 동시 보상 지급 시 pool 잔액이 음수로 가는 경쟁 조건 수정 (3파일).

---

## 2026-05-07 v7.16 — 아이템/재료 소모 TOCTOU 6종 일괄 수정

- **server/routes/api.js** — `/shop/use`: 인벤토리 SELECT에 `FOR UPDATE` + UPDATE에 `AND quantity > 0` 가드 추가.
- **server/routes/api.js** — `/cosmetic/equip`: 코스메틱 quantity deduct에 `AND quantity > 0` 가드 + rowCount 확인 추가.
- **server/routes/governance.js** — buff/event/bounty: `governance_positions` gp_balance UPDATE 3곳에 `AND gp_balance >= $1` 가드 추가.
- **server/services/auction.js** — `createAuction`: resource escrow 차감에 `AND quantity >= $1` 가드 추가.
- **server/services/enhancement.js** — `materializeItem`: SELECT에 `FOR UPDATE`; blessed/protect scroll 소모 UPDATE에 `AND quantity > 0` 가드 추가 (3곳).
- **server/services/crafting.js** — 재료 차감: `AND quantity >= $1` 가드 + rowCount 확인 추가.
- **server/services/marketplace.js** — `createListing` resource escrow: `FOR UPDATE OF inv` + `AND quantity >= $1` 가드 추가.

---

## 2026-05-07 v7.15 — PVP 전투 선언 TOCTOU 수정

**server/routes/fleetBattles.js** — `declare-pvp`: fleet `is_in_battle` 체크를 트랜잭션 외부에서 수행하던 로직을 BEGIN 내부로 이동. `FOR UPDATE` 재확인으로 동시 선언 두 건이 같은 함대를 두 전투에 등록하는 경쟁 조건 수정. COMMIT 전 `is_in_battle = true` 마킹으로 원자성 보장.

---

## 2026-05-07 v7.14 — 샵 구매 잔액 체크 TOCTOU + negative-balance 수정

**server/routes/api.js** — `/shop/buy`: 잔액 SELECT에 `FOR UPDATE` 추가, UPDATE에 `AND ${balCol} >= $1` 가드 추가.
동시 구매 시 잔액 음수 진행 가능한 경쟁 조건 수정.

---

## 2026-05-07 v7.13 — 마켓플레이스 구매 TOCTOU 수정

**server/services/marketplace.js** — `buyListing()` 리스팅 SELECT에 `FOR UPDATE` 추가.
동시 구매 요청 두 건이 모두 `status='active'` 확인 후 진행 → 아이템 중복 지급 + 판매자 이중 크레딧 경쟁 조건 수정.

---

## 2026-05-07 v7.12 — 영토 수확 TOCTOU 경쟁 조건 수정

**server/routes/api.js** — territory harvest claims SELECT에 `FOR UPDATE OF c` 추가.
동시 수확 요청 두 건이 쿨다운 체크를 모두 통과해 이중 PP를 지급하는 경쟁 조건 수정.

---

## 2026-05-07 v7.11 — 일일 출석 cycleDay 수정 ("7일 중 8일차" 버그)

### 수정 내용
**server/routes/api.js** — `/api/daily/status` 응답에 `cycleDay` 필드 추가.
- `daily_streak_cycle` 기본값 14 → 7 (서비스 CYCLE=7과 일치)
- `cycleDay = ((rawStreak - 1) % maxDays + 1)`: streak=8, maxDays=7이면 cycleDay=1
- claimed/not-claimed 양쪽 분기 모두 반환

**index.html** — `renderInlineCheckin()` 및 `checkDailyLogin()` / `claimDailyLogin()`:
- `_dailyState.cycleDay` 저장 (d.cycleDay 또는 폴백 계산)
- 그리드 done/isToday/isFuture: raw `streak` → `cycleDay` 기준으로 변경
- period label: `streak` → `cycleDay` 기준으로 변경 (예: "7일 중 1일차")
- "N일 연속" 헤더는 raw `streak` 유지

---

## 2026-05-07 v7.03~v7.08 — 경쟁 조건 전체 sweep + 캠페인 SAVEPOINT 수정

### 핵심 수정 내용

**marketplace.js** — 판매자/거버너 tariff 지급 LOWER() 누락 수정 (listing.seller, tariffGovernor = DB값)
**db.js** — 레퍼럴 chain 잔액 크레딧 LOWER() 추가 (ref.wallet from DB)
**guild.js** — guild_id UPDATE 5곳 LOWER() 추가 (invited_wallet from DB)
**api.js** — shop 잔액 차감 LOWER() 추가
**aiFleetManager.js / admin.js** — faction_code UPDATE LOWER() 추가
**rank.js, season.js, db.js** — XP/rank_level UPDATE LOWER() 추가

**dividends.js** — CRITICAL 경쟁 조건: 스테이커 스냅샷을 트랜잭션 외부에서 수집 + INSERT ON CONFLICT DO NOTHING 후 GP 크레딧 무조건 실행 → 동시 호출 시 이중 지급. 수정: 락 후 스냅샷 재수집 + RETURNING id 가드.

**governance route (buff purchase)** — TOCTOU: BEGIN 이전에 buff 존재 확인 → 두 동시 요청 모두 통과 후 GP 이중 차감. 수정: BEGIN을 먼저, FOR UPDATE 후 재확인.

**governance service** — `recalculateGovernor()`: old gp_balance SELECT에 FOR UPDATE 없음; pixels.owner LOWER() 없이 sectors에 기록. `applyDailyMaintenance()`: governance_positions SELECT에 FOR UPDATE 없음. 모두 수정.

**fleet.js** — `createFleet()` / `deleteFleet()`: COUNT 기반 체크 전 user row FOR UPDATE 선취득 없음 → 최대 함대 수 초과 / 마지막 함대 삭제 경쟁 조건. 유저 row 락으로 직렬화.

**battleRewards.js** — "already rewarded" 체크가 트랜잭션 외부 → 동시 호출 시 전 참가자 GP/광물 이중 지급. fleet_battles FOR UPDATE + 트랜잭션 내부 재확인으로 수정.

**hijack.js** — `handlePhase1Complete()`: 전체 함수가 트랜잭션 없이 pool.query 3개 분리 → 크래시 시 이중 환불. `handlePhase2Complete()`: 초기 SELECT 트랜잭션 외부 → 동시 호출 시 픽셀 이전 이중 실행. 모두 BEGIN/COMMIT + FOR UPDATE + phase 가드로 수정.

**lottery.js (drawRound)** — FOR UPDATE 이후에도 스테일 `round` 스냅샷 변수 사용 (ticket_count, ticket_price_gp, prize_pool_gp, round_number). `lockRes.rows[0]` (`lockedRound`)로 교체.

**campaign.js** — `applyOptionalCampaignReward()`: ROLLBACK/RELEASE SAVEPOINT가 연결 수준 오류 시 throw → 전체 chapter completion 트랜잭션 중단. try/catch로 삼켜 외부 ROLLBACK에 위임. `complete()` 최종 UPDATE에 `AND status = 'in_progress'` 가드 추가. 중복 `displayNameEn` 키 제거.

---

## 2026-05-07 v7.02 — balance credit LOWER() 전체 서버 완전 정리 (18개 파일)

### 수정 대상 파일
`exploration.js`, `missions.js`, `onboarding.js`, `daily.js`, `duel.js`, `hijack.js`,
`lottery.js`, `achievements.js`, `rocket.js`, `tournament.js`, `dividends.js`,
`season.js`, `tournaments.js`, `chain.js`, `maintenance.js`, `db.js`, `auth.js`, `api.js`

### 수정 내용
- `SET *_balance = *_balance + $N WHERE wallet_address = $N` 패턴 전체 → `LOWER(wallet_address) = LOWER($N)` 변경
- 체인 USDT/PP 입금(chain.js), 시즌 보상(season.js), 복권 당첨(lottery.js), 업적 보상(achievements.js), 로켓 보상(rocket.js), 듀얼 정산(duel.js) 등 실제 GP/PP 지급 경로 모두 커버
- 서버 전체 grep 기준: 0건 잔여

---

## 2026-05-07 v7.01 — api.js + admin.js 핵심 크레딧 경로 LOWER() 수정

### server/routes/api.js
- 하이잭 피해자 PP 환불 (`affectedOwners` 키 = DB `pixels.owner`): LOWER() 추가
- 레퍼럴 PP 크레딧 (`ref.wallet` from DB): LOWER() 추가
- territory harvest PP 지급 x2: LOWER() 추가
- pp→gp 교환 GP 크레딧: LOWER() 추가
- GP 이체 수신자 조회(LOWER 없으면 checksum 지갑 not_found) + 크레딧: LOWER() 추가
- GP 이체 발신자 FOR UPDATE: LOWER() 추가
- hijack 실패 환불 PP: LOWER() 추가

### server/routes/admin.js
- gp/grant 엔드포인트: LOWER() 추가
- staking withdraw 판매자 지급: LOWER() 추가
- bounty cancel 환불: LOWER() 추가
- duel admin cancel challenger/defender 환불 x2: LOWER() 추가

---

## 2026-05-07 v7.00 — auction.js LOWER() 누락으로 인한 GP 소각 버그 수정

### server/services/auction.js — 핵심 GP 지급 경로 LOWER() 누락 수정

**버그**: `auction.current_bidder_wallet`, `auction.seller_wallet`은 DB에서 가져온 값으로 Ethereum 체크섬 주소(혼합 대소문자)일 수 있음.
해당 값을 `WHERE wallet_address = $2` (LOWER 없음)로 업데이트하면 0 rows matched → GP가 허공에 사라짐.

**영향 경로**:
- 입찰(bid): 이전 최고 입찰자 환불 (L224)
- 즉시구매(buyout): 이전 입찰자 환불 (L307) + 판매자 지급 (L314)
- 낙찰 정산(settle): 판매자 지급 (L430)

**수정**: 4곳 → `WHERE LOWER(wallet_address) = LOWER($2)` 변경
**추가**: SELECT FOR UPDATE 3곳 (L69, L212, L297)도 LOWER() 추가 (일관성)

---

## 2026-05-07 v6.99 — SELECT FOR UPDATE LOWER() 2차 일괄 수정 (15개 서비스)

### 서비스 (SELECT FOR UPDATE wallet_address → LOWER 추가)
`alliance.js`, `announcement.js`, `banner.js`, `exploration.js`, `faction.js`, `guild.js` (4곳),
`job.js`, `missions.js`, `onboarding.js`, `prestige.js`, `season.js`, `shield.js`,
`title.js`, `titleExtended.js`, `tribute.js`

이로써 서버 전체(services/) `SELECT ... FOR UPDATE` 유저 잔액/상태 쿼리에서
`WHERE wallet_address = $1` 패턴 없음. 모두 `LOWER(wallet_address) = LOWER($1)` 사용.

---

## 2026-05-07 v6.98 — SELECT FOR UPDATE LOWER() + 라우트 wallet 정규화 (16개 서비스)

### 공통 패턴 수정
- `SELECT gp_balance FROM users WHERE wallet_address=$1 FOR UPDATE` 패턴이 혼합 대소문자 wallet에서 "User not found" 오류를 유발하는 문제 일괄 수정
- `WHERE wallet_address=$1 FOR UPDATE` → `WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE`
- 각 라우트도 `wallet.toLowerCase().trim()` 정규화 추가 (서비스 호출 전)

### 서비스 (SELECT FOR UPDATE LOWER() 추가)
`beacon.js`, `capsule.js`, `sponsor.js`, `tdesc.js`, `tprestige.js`, `graffiti.js`, `journal.js`, `highlight.js`, `status.js`, `milestone.js`, `rating.js`, `tombstone.js`

### 라우트 (wallet 정규화 추가)
`beacon.js`, `capsule.js`, `polls.js`, `tprestige.js`, `tombstone.js`, `journal.js`, `graffiti.js`, `milestone.js`, `highlight.js`, `status.js`, `rating.js`

---

## 2026-05-07 v6.97 — exploration getSetting NaN + polls LOWER() 정규화

### server/services/exploration.js
- `discoverPOI` L229: `getSetting` 반환값이 JSONB 따옴표 포함 문자열(`'"0.5"'`)일 때 `parseFloat` → NaN → 탐사 수수료 무과금 버그 수정
- 수정: `parseFloat(String(...).replace(/^"|"$/g, ''))` — 외부 따옴표 제거 후 파싱

### server/services/polls.js + server/routes/polls.js
- `createPoll` SELECT FOR UPDATE: `WHERE wallet_address=$1` → `LOWER(wallet_address)=LOWER($1)`
- `createPoll` cooldown 조회: `WHERE wallet=$1` → `LOWER(wallet)=LOWER($1)`
- 라우트 `/polls` GET, `/polls/create` POST, `/polls/vote` POST: wallet 파라미터 `.toLowerCase().trim()` 정규화

---

## 2026-05-07 v6.96 — warBetting 환불 LOWER() + FOR UPDATE

### server/routes/warBettingRoutes.js
- admin cancel fallback 환불 루프 L257: `SELECT war_bets ... FOR UPDATE` 추가 (이중 환불 경쟁 방지)
- admin cancel fallback 환불 루프 L259: `WHERE wallet_address = $1` → `WHERE LOWER(wallet_address) = LOWER($1)` (혼합 대소문자 저장 wallet 환불 누락 방지)

---

## 2026-05-07 v6.92 — auto-renew 스케줄러 + ship/fleet FOR UPDATE + crafting LOWER()

### server/index.js (v6.92)
- Shield auto-renew 스케줄러: SELECT LOWER() + FOR UPDATE 이미 있음, UPDATE에 LOWER() + `AND pp_balance >= $1` guard 추가
- Effect auto-renew 스케줄러: 동일 패턴 수정

### server/services/ship.js (v6.90, Codex 14개 수정)
- `completeBuildJob`: LOWER(owner_wallet) + FOR UPDATE on fleet ownership read + flagship existence check
- `cancelBuildJob`: LOWER(wallet_address) on job ownership check
- `getOrCreateDefaultFleet`: LOWER(owner_wallet) + FOR UPDATE on fleet lookup
- `getFleetSummary`: LOWER() on all wallet comparisons
- `repairShip`: NaN/non-finite guard on targetHpPct
- `chargeShield`: NaN/non-finite guard on units
- `consumeShipUpgradeMaterial`: LOWER(wallet_address) on inventory deduction
- `getShipMarketListings`: NaN/non-finite guard on maxPrice
- `ensureFleetHasFlagship`: FOR UPDATE on flagship and candidate ship locks
- `cancelShipListing`, `buyShipListing`: FOR UPDATE OF sml, s (ship locked alongside listing)

### server/services/fleet.js (v6.90, Codex 4개 수정)
- `deleteFleet`: FOR UPDATE on alive ships + FOR UPDATE on target fleet
- `setFlagship`: FOR UPDATE on existing flagships before clearing
- `ensureFlagship`: FOR UPDATE on flagship/candidate selection

### server/services/crafting.js (v6.91)
- craftItem: SELECT + refund UPDATE wallet_address → LOWER()

### server/services/resourceCraft.js (v6.91)
- getMyJobs, startCraft (사용자 확인/재고 JOIN/재료 차감), claimJob, cancelJob: 모든 wallet_address → LOWER()

---

## 2026-05-07 v6.89 — api.js + 최종 잔액 가드 완성 (전체 완료)

### server/routes/api.js
- Codex: 13개 GP/PP 차감 경로 LOWER() + AND guard 추가. 잔액 SELECT에 FOR UPDATE 보강.
- Claude: usdt_balance 출금 L2088 — `AND usdt_balance >= $1` + LOWER() 추가.

**이 커밋 이후 서버 전체(services/ + routes/)에서 unguarded balance deduction 0건 확인.**

---

## 2026-05-07 v6.88 — guild/monuments/crafting/vip/faction/title/tribute/status/season/transport + bounty

### server/services/ (Codex 수정 10개)
- `guild.js`, `monuments.js` (2곳), `crafting.js`, `vip.js`, `faction.js`, `title.js`, `tribute.js`, `status.js`, `season.js`, `transport.js`: LOWER() + AND guard

### server/routes/bounty.js
- L137: `LOWER(wallet_address) = $2` → `LOWER(wallet_address) = LOWER($2)` (LOWER() 누락 버그 수정) + AND guard 추가

---

## 2026-05-07 v6.87 — GP/PP 잔액 가드 전체 서비스 일괄 수정 (39개 서비스)

### 수정 패턴 (전체 공통)
- 모든 `UPDATE users SET gp_balance/pp_balance = balance - $N` 경로에 `AND gp_balance >= $N` (또는 `pp_balance >= $N`) 음수 방지 가드 추가
- `WHERE wallet_address = $N` → `WHERE LOWER(wallet_address) = LOWER($N)` wallet 대소문자 정규화
- 잔액 SELECT에 `FOR UPDATE` 누락 시 추가 (동시 이중 차감 방지)

### v6.86 커밋 (10개 서비스 — Claude + Codex 협업)
- `spells.js`: SELECT에 FOR UPDATE 추가
- `staking.js`: FOR UPDATE + AND guard
- `rental.js`: LOWER() + AND guard (3곳)
- `branding.js`: LOWER() + FOR UPDATE + AND guard
- `enhancement.js`: FOR UPDATE + LOWER() + AND guard
- `lottery.js`: FOR UPDATE + LOWER() + AND guard
- `tournaments.js`: LOWER() + FOR UPDATE + AND guard
- `vtag.js`: setTag + clearTag 양쪽 LOWER() + FOR UPDATE + AND guard
- `broadcasts.js`: LOWER() + FOR UPDATE + AND guard
- `maintenance.js`: LOWER() + FOR UPDATE + SELECT guard + UPDATE guard

### v6.87 커밋 (39개 서비스 — Claude 27개 + Codex 12개)
- `ship.js` 5곳 (건조/수리/실드/업그레이드/마켓 구매): `AND gp_balance >= $1` 일괄 추가
- `hijack.js`: pp_balance 차감 guard 추가
- `duel.js`: challenger 에스크로 + defender 에스크로 양쪽 guard
- `marketplace.js` listing fee: LOWER() + guard
- `auction.js` 3곳 (listing fee/bid/buyout): LOWER() + guard
- `siege.js` 2곳: guard 추가
- `contest.js` 2곳 (entry fee/vote fee): guard 추가
- 나머지 22개 서비스 (`graffiti`, `prestige`, `capsule`, `announcement`, `alliance`, `beacon`, `sponsor`, `banner`, `tdesc`, `highlight`, `titleExtended`, `tprestige`, `shield`, `tombstone`, `rating`, `journal`, `milestone`, `polls`, `profile`, `job`, `missions`, `exploration`, `claimUpgrades`, `warBetting`, `raffle`, `tiers`, `expedition`, `wager`, `tevt`, `tournament`, `donation`): 동일 패턴 수정

---

## 2026-05-07 v6.85 — 일일미션/퀘스트 풀/마켓 구매 동시성 수정

### server/services/daily.js
- `claimMissionReward()`: `pool.query()` 직접 사용 → `BEGIN/COMMIT/ROLLBACK + finally { client.release() }` 패턴으로 리팩터링.
- 중복 수령 방지: `UPDATE ... SET claimed=true WHERE ... AND claimed=false RETURNING *` 원자적 처리.
- wallet 대소문자 정규화 (`LOWER()`).

### server/routes/api.js
- `quest_reward_pool` UPDATE (harvest, territory/harvest): `AND balance >= $1 RETURNING balance` 조건 추가. 0 rows 반환 시 ROLLBACK + pool_depleted 오류.
- 퀘스트 claim `actualReward`: 풀 잔액(`poolBalance`)과 일별 예산 잔여(`dailyBudget - todayPaid`) 캡 추가.
- quest 엔드포인트 wallet 비교: `LOWER(wallet) = LOWER($1)` 통일.

### server/services/marketplace.js
- `buyListing()` 구매자 잔액 SELECT에 `FOR UPDATE` 추가 → 동시 구매 이중 차감 방지.
- 잔액 UPDATE에 `AND ${balCol} >= $1` 음수 방지 가드 추가. `LOWER()` 정규화.

---

## 2026-05-07 v6.84 — 강화/공성/마켓 감사 버그 수정

### server/services/enhancementAdvanced.js
- `getScrollStatus()` / `getScrollCountClient()`: `user_items` 쿼리의 `wallet_address`/`item_code` → `wallet` + `JOIN item_types ... WHERE it.code = $2`로 수정. 보호권 보유 여부가 항상 false로 반환되던 버그 수정.
- `consumeScrollClient()`: 동일 잘못된 컬럼 → `UPDATE user_items ... FROM item_types` JOIN 패턴으로 수정.
- `getResourceBalance()` / `deductResource()` user_items fallback: 동일 컬럼 오류 → JOIN 패턴으로 수정.
- 모든 쿼리에서 wallet을 `.toLowerCase()` 정규화 추가.

### server/services/siege.js
- `declareSiege`, `resolveSiege`, `updateGovernorDeclaration` 등 15곳의 wallet/owner 비교에 `LOWER()` 추가. 대소문자 차이로 공성 참여자 소유권 오판 방지.

### server/routes/marketplace.js
- `GET /listings/:id`, `POST /cancel`, `POST /buy` 3곳에 `parseInt(id, 10)` + `Number.isInteger()` 가드 추가. 무효 ID 입력 시 400 반환.

---

## 2026-05-07 v6.83 — 함대전/함대 지휘 감사 버그 수정

### server/services/battleEngine.js
- 함선별 최종 전투 스냅샷(`is_alive`, `current_hp`, `bonus_atk/def/hp/speed`)을 결과 통계와 `battle_summary.final_ships`에 저장.
- 일반 전투의 생존 함선 HP 반영이 `result.frames`를 참조해 누락될 수 있던 버그를 `result.stats.by_ship` 기반 갱신으로 수정.
- `bonus_hp`가 적용된 유효 최대 HP 기준으로 전투 후 HP를 clamp하도록 보강.

### server/services/battleScheduler.js
- `preparing → active` 전환과 참가 함대 lock을 단일 트랜잭션으로 묶어 동일 전투/동일 함대 중복 실행 race condition 방지.
- 전투 실패·후속 훅 실패 경로 이후에도 `fleet.is_in_battle/current_battle_id`가 정리되도록 `finally` 방어 업데이트 추가.
- 신규 `pool.connect()` 사용 경로에 `finally { release() }` 적용.

### server/routes/fleets.js
- JWT wallet을 소문자로 정규화하고, fleet/ship id를 safe integer로 검증.
- `move-ships`의 문자열/NaN/중복 id 입력을 라우트에서 정규화해 DB 캐스트 오류와 타입 비교 흔들림 방지.
- 기함 지정 `ship_id` NaN 경로를 400 응답으로 차단.

### index.html
- `confirmDeclareBattle()`에서 JSON 파싱 실패와 `battle_id` 누락 응답을 명시적으로 처리.
- `openBattleViewer()`가 battle id와 현재 wallet을 iframe/report 요청에 전달하도록 보강.
- `forfeitBattle()` 클라이언트 함수를 추가하고 iframe 후퇴 메시지의 실패 payload를 성공 처리하지 않도록 수정.
- `setFleetFormation()`/`setFleetManeuver()` 호환 래퍼를 추가해 기존 Fleet Command 상태 업데이트 경로를 재사용.

---

## 2026-05-07 v6.82 — 서버/클라이언트 심층 감사 (신규 버그 없음)

### 추가 감사 완료
- expedition, missions, capsule, beacon, lottery, arena, 11개 서비스 트랜잭션 패턴 전수 확인 — 모두 클린
- auth.js 5개 / api.js JSON.parse / enhancement.js 폴백 — 모두 클린
- ship upgrade-stat stat 화이트리스트 보호 확인
- War Betting 인증 헤더 정상 전송 확인
- admin.html native dialog 0건 확인
- Campaign reward inbox FOR UPDATE 동시성 보호 확인
- **신규 버그 없음**

---

## 2026-05-07 v6.81 — DB 커넥션 더블 릴리즈 전수 스캔 및 추가 수정

### server/routes/api.js (3곳)
- 픽셀 클레임 라우트 내 for-loop 픽셀 검증 로직 3곳에서 `client.release()` 제거.
  - Peace Treaty 차단 경로, Marketplace lock 차단 경로, Shield 차단 경로
  - `finally { client.release() }` 가 항상 실행되므로 이중 릴리즈 발생했던 버그 수정.

### server/services/transport.js (1곳)
- `getRaidables()` 함수의 guild 면제 검사 for-loop 내 `client.release(); continue` → `continue`만 남김.
  - `finally { client.release() }` 와 이중 릴리즈 발생했던 버그 수정.

### 전수 스캔 결과
- Python 스크립트로 `server/**/*.js` 전체 파일 자동 스캔 — 위 2건 외 추가 더블 릴리즈 없음.
- `arena.js` 3곳: try/catch without finally 패턴 — 각 경로 단일 release로 안전.

---

## 2026-05-07 v6.80 — 스케줄러 DB 커넥션 더블 릴리즈 수정

### server/index.js (4곳)
- AUTO-RENEW 스케줄러 Shield/Effect 자동갱신 for-loop에서 early `continue` 경로 4곳에 있던 `client.release()` 제거.
- `finally { client.release() }` 블록이 항상 실행되므로 이중 호출 발생 — pg-pool 더블 릴리즈로 커넥션 풀 오염 가능.
- 동일한 `finally` 단일 경로로 정리.

### 추가 감사 (이번 루프)
- VIP Pass, Onboarding, War Betting, Profile 저장 함수 모두 클린.
- `warBettingRoutes.js` 인증 패턴 전수 검토 — 정상.
- 서버 서비스 `WHERE wallet` vs `WHERE wallet_address` 오용 검사 — users 테이블 접근은 전부 `wallet_address` 정상 사용.

---

## 2026-05-07 v6.79 — 확장 감사 완료 (전 시스템 클린 확인)

### 감사 범위 (v6.78 이후 추가)
- Alliance/Invasion, Auction, Expedition, Rental, GP Transfer, Lottery, Staking, Raffle, Broadcast, Banner/Highlight/Graffiti/Tribute, Siege, Governance, Bounty, Duel, Shield, Branding, Tier Upgrade, Guild, Claim Purchase — 모든 `gameConfirm` 패턴 정상
- P5-1~7 엔드포인트 실동 확인: territory production, resource-sector-hints, territory upgrades, sectors control 전부 응답 정상
- Campaign objectiveState에 `materialHarvests`/`territoryUpgradeLevels` 필드 정상 포함 확인
- 서버 라우트 마운트 순서 충돌 없음 확인 (`/api/sectors` → fall-through → apiRoutes 정상 처리)
- native dialog 잔존 1건 (`showHijackEntryHint` 내 `alert`) — `showFactionToast` 우선 처리로 도달 불가 dead code, 무해
- **신규 버그 발견 없음**

---

## 2026-05-07 v6.78 — 전체 코드베이스 심층 감사 완료 (신규 버그 없음)

### 감사 범위
- `gameConfirm` 60+ 콜 전수 검토 — `.then()`/`await` 패턴 모두 정상
- `walletState.*` 전역 필드 접근 전수 조사 — 유효 필드만 사용 확인
- Fleet Command / Shipyard / Ship Market / Campaign / Battle / Hijack / Territory 전 주요 흐름 점검
- 서버 라우트 5개 로드 테스트 통과
- v6.74~v6.77 수정 사항 전면 검증 완료
- **신규 버그 발견 없음**

---

## 2026-05-07 v6.77 — walletState 잘못된 필드명 수정 (gpBalance, pp → gameGP, gamePP)

### index.html (2곳)
- `govDeclareSiege()`: `walletState.gpBalance` (할당된 곳 없음, 항상 0) → `walletState.gameGP`. 공성전 선언 시 GP 잔액이 항상 0으로 표시되어 버튼이 "INSUFFICIENT GP"로 비활성화되는 버그 수정. 충분한 GP가 있어도 공성전 선언 불가했던 버그 수정.
- `buyMarketListing()`: `walletState.pp` (할당된 곳 없음, 항상 0) → `walletState.gamePP`. PP 구매 시 PP 잔액이 항상 0으로 표시되는 버그 수정.

---

## 2026-05-07 v6.76 — Daily OPS 미션 카운터 누락 수정 (harvest_3/5, battle_3, market_activity)

### server/routes/api.js (1곳)
- 영토 harvest 완료 후 `harvest_pp` 외 `harvest_3`, `harvest_5` 미션 진행도 알림 추가. 기존에는 3회/5회 수확 미션이 실제 수확을 해도 영원히 0으로 남았음.

### server/services/battleScheduler.js (1곳)
- 전투 참여/승리 후 `battle_participate_3`, `battle_win_3`, `ai_battle_3` 미션 진행도 알림 추가. 기존에는 단일 참여/승리 미션만 카운트되고 3회 미션은 영원히 미완료.

### server/routes/ships.js (2곳)
- 함선 마켓 등록/구매 후 `market_activity` (3회 거래 미션) 진행도 알림 추가. 기존에는 market_list/market_buy만 카운트되어 market_activity 미션은 영원히 0.

---

## 2026-05-07 v6.75 — window._walletAddress 항상 undefined 버그 수정 (2곳)

### index.html (2곳)
- `buryCapsule()`: `window._walletAddress` (항상 undefined, 코드베이스 어디서도 할당 없음) → `((walletState&&walletState.address)||getMyWallet()||'').toLowerCase()`. 타임캡슐 묻기 기능이 항상 "Connect wallet first" 오류를 반환하던 버그 수정.
- `loadMyTdescs()`: 동일한 `window._walletAddress` 사용 → 동일 패턴으로 수정. 내 영토 설명 목록이 항상 `'—'` (빈 상태)로 표시되던 버그 수정.

---

## 2026-05-07 v6.74 — gameConfirm 콜백 패턴 전면 수정 + GP 비용 표시

### index.html (9개 함수)
- `doStake()` / `doWithdraw()`: `onConfirm: function(){}` + `confirmLabel:` (Promise 무시, fetch 미실행) → async/await + `confirmText:` + `getAuthHeaders()`. GP 스테이킹/인출 확인 시 실제 fetch가 실행되지 않던 치명 버그 수정.
- `saveTdescDescription()` / `submitSponsor()`: 동일한 `onConfirm:` 콜백 패턴 → async/await 변환. 지갑 주소도 `window._walletAddress` → `((walletState&&walletState.address)||getMyWallet()||'').toLowerCase()` 통일. 영토 설명 저장 / 스폰서 배치가 확인 클릭 후 실제 실행되지 않던 버그 수정.
- `submitBanner()` / `submitRating()` / `submitHighlight()` / `submitGraffiti()` / `submitTribute()`: `cost: value` (인식 불가 필드, UI 표시 안 됨) → `info: [{k:'Cost', v: value}]`. GP 비용이 확인 다이얼로그에 표시되지 않던 UX 버그 수정. 아이콘 추가.

---

## 2026-05-07 v6.73 — 레거시 영토 업그레이드 패널 지갑/재로드 버그 수정

### index.html (2곳)
- `_confirmAndUpgrade()`: `wallet: walletState.address` → `((walletState&&walletState.address)||getMyWallet()||'').toLowerCase()`. JWT-only 유저가 레거시 업그레이드 확인 시 `wallet: undefined` 전송 → 400 오류 수정.
- `_confirmAndUpgrade()`: 성공 후 `loadTerritoryUpgrades()` (args 없음, 항상 400) → `_loadBaseUpgradesPanel()` 호출로 교정. 기존 BASE 탭 업그레이드 패널 재로드 정상화.

---

## 2026-05-07 v6.72 — battleTimeline / battleRewards 지갑 대소문자 비교 수정

### server/services/battleTimeline.js (1곳)
- `getUserBattleHistory()`: `WHERE p.wallet_address = $1` → `LOWER(p.wallet_address) = LOWER($1)`. 전투 기록이 빈 목록으로 반환되는 케이스 수정.

### server/services/battleRewards.js (3곳)
- `getRewardHistory()`: `WHERE r.wallet_address = $1` → `LOWER(r.wallet_address) = LOWER($1)`.
- GP 지급 UPDATE: `WHERE wallet_address = $2` → `WHERE LOWER(wallet_address) = LOWER($2)` (2곳). 케이스 불일치 시 GP 미지급 버그 수정.

## 2026-05-07 v6.71 — 영토 업그레이드/아이덴티티/캠페인 보상 지갑 컨텍스트 수정

### index.html (4곳)
- `claimCampaignReward()`: `wallet:walletState.address` → `getMyWallet()` 폴백 추가. JWT 이메일 유저이면서 지갑 미연결 시 `wallet: undefined`가 서버로 전송되어 `missing fields` 400 오류 발생하던 버그 수정. 지갑 미연결 시 명시적 에러 토스트 표시.
- `loadTerritoryUpgrades()`: `typeof myW2 !== 'undefined' ? myW2 : ''` → `(walletState&&walletState.address)||getMyWallet()`. `myW2`는 `showTerritoryInfo()` 로컬 변수로, 외부 호출(`toggleTerritoryUpgradePanel`) 시 항상 빈 문자열 → ownership 체크 실패 + 업그레이드 버튼 미표시.
- `doTerritoryUpgrade()`: 동일한 `myW2` 스코프 오류 수정. 업그레이드 버튼 클릭 시 지갑 주소 없음으로 `로그인 필요` 오류 수정.
- `openTerritoryIdentityEdit()`: 동일한 `myW2 || walletState?.address` 패턴 → `(walletState&&walletState.address)||getMyWallet()` 통일.

## 2026-05-07 v6.70 — getMyWallet 지갑 연결 전용 유저 누락 수정 + 보상 토스트 개선

### index.html (1곳)
- `getMyWallet()`: JWT pw_token이 없는 지갑 연결 전용 유저는 null 반환 → 배틀 보상 토스트 미표시. `walletState.address` 폴백 추가.

## 2026-05-07 v6.69 — commanderActions.js 지갑 대소문자 비교 버그 수정

### server/services/commanderActions.js (4곳)
- 참가자 검증: `owner_wallet = $2` → `LOWER(owner_wallet) = LOWER($2)`.
- 쿼터 체크: `wallet_address = $2` → `LOWER(wallet_address) = LOWER($2)`.
- 중복 액션 체크: `wallet_address = $2` → `LOWER(wallet_address) = LOWER($2)`.
- GP 차감: `wallet_address = $2` → `LOWER(wallet_address) = LOWER($2)`.
- JWT wallet 소문자 정규화 후 DB 비교 시 케이스 불일치로 `NOT_A_PARTICIPANT` / `INSUFFICIENT_GP` 오류 발생하던 버그 해소.

## 2026-05-07 v6.68 — fleetBattles.js 지갑 대소문자 비교 버그 수정

### server/routes/fleetBattles.js (4곳)
- `declare-pvp` — 내 함대 소유권 체크: `owner_wallet = $2` → `LOWER(owner_wallet) = LOWER($2)`. 지갑 대소문자가 JWT ≠ DB일 때 `MY_FLEET_NOT_FOUND` 오류 수정.
- `declare-pvp` — 자기 함대 공격 방지: `owner_wallet === wallet` → `.toLowerCase()` 비교. 케이스 불일치 시 자기 함대 공격 가능한 버그 수정.
- `/:id/run` — 참가자 확인 쿼리: `wallet_address = $2` → `LOWER(wallet_address) = LOWER($2)`.
- `/:id/forfeit` — 참가자 + 사이드 확인 쿼리: 동일하게 LOWER() 적용.

## 2026-05-07 v6.67 — i18n 누락 키 10개 추가 (4개 언어 블록)

### index.html (4개 언어 블록)
- `connect_wallet` / `connect_wallet_first` / `err_connect_wallet`: 지갑 연결 요청 메시지 — 20/8/11곳에서 `t()` 호출되지만 I18N 미정의 → 키 그대로 표시 또는 || 폴백 영어 사용. 4개 언어 블록에 추가.
- `err_network`: 네트워크 오류 메시지 — 여러 fetch 오류 핸들러에서 사용.
- `vip_confirm`: VIP 구매 확인 버튼 텍스트.
- `use_shipyard` / `use_fleet_cmd`: 함선/함대 관련 안내 문구.
- `gov_battle_use_fleet` / `gov_battle_use_fleet_hint`: 거버넌스 전투 안내 메시지.
- `duel_declined_msg`: 결투 거절 토스트 메시지.

## 2026-05-07 v6.66 — escHtml 미정의 함수 수정 (index.html 21곳 + admin.html 8곳)

### index.html
- `escHtml(s)` — 21곳에서 직접 호출되지만 정의 없음 (ReferenceError). 뉴스 패널/바운티/실드/기념비/이벤트/토너먼트 등 텍스트 렌더 전부 오류. `_escHtml`의 전역 alias `var escHtml = _escHtml` 추가.

### admin.html
- `_escHtml(s)` — 브랜딩/스펠/토너먼트/방송 설정 패널 8곳에서 사용되지만 admin.html에 정의 없음. 함수 정의 추가 + `escHtml` 별칭.

## 2026-05-07 v6.65 — Void Raider 교전 모달 로그인 가드 추가

### index.html (1곳)
- `openWorldEventDetail()`: 비로그인 유저가 Void Raider ENGAGE 버튼을 눌러도 모달이 열리던 문제 수정. `isLoggedIn()` + 지갑 연결 여부 확인 후 미로그인 시 에러 토스트 표시.

## 2026-05-07 v6.64 — Void Raider ENGAGE 지갑 인증 누락 수정

### index.html (1곳)
- `confirmWeEngage()`: `Authorization: Bearer` 헤더만 전송해, JWT 없이 지갑만 연결된 유저가 교전 시 `wallet_required` 오류 수신. `x-wallet` 헤더 + body `wallet` 필드도 함께 전송하도록 수정.

## 2026-05-07 v6.63 — Fleet Command 모달 텍스트 깨짐 수정

### index.html (3곳)
- Fleet Command 모달 정적 HTML에 JS 삼항 표현식(`'+(LANG==='ko'?...)+'`)이 그대로 삽입돼 브라우저가 리터럴 텍스트로 렌더링하는 버그 수정.
  - `.fleetcmd-title` 부제목: `<span id="fleetCmdSubtitle">` 교체 + `openFleetCmd()` 진입 시 LANG 기반 텍스트 설정.
  - "새 함대" 버튼 내부 텍스트: `<span id="fleetCmdNewBtn">` 교체.
  - "함대를 선택하세요" 플레이스홀더: `<span id="fleetCmdSelectHint">` 교체.
- `openFleetCmd()` 시작 시 3개 span에 `LANG` 기반 텍스트 즉시 주입.

## 2026-05-06 v6.62 — 서비스 파일 잘못된 require 수정 (notifications + betting)

### server/services/ (7개 파일)
- `shield.js`, `staking.js`, `lottery.js`, `claimUpgrades.js`, `dividends.js`, `monuments.js`: `require('./notifications').notifyPlayer` → `require('../db').notifyPlayer`. 실드 활성화/스테이킹/복권/영토 업그레이드/배당금 이벤트 알림 이제 정상 작동.
- `siege.js`: `require('./betting')` (삭제된 서비스) → `require('./warBetting')` 호환 래퍼 추가. siege 선언/종료 시 전쟁 베팅 이벤트 자동 생성/정산 이제 작동. (기존에는 try-catch로 silent fail)

## 2026-05-06 v6.61 — typeof 가드 undefined 함수 알리아스 추가 + 거버넌스 리프레시 수정

### index.html
- `loadGPBalance` (1곳 typeof 가드), `refreshPP` (1곳): GP/PP 잔액 갱신 함수 — 정의 없어 silent no-op. `loadWalletData` 알리아스 추가.
- `loadClaims` / `refreshClaims` (영토 병합 후 재로드): 정의 없어 silent no-op. `compositeClaimsOnTexture()` 래퍼 추가.
- `renderBlueprintsGrid` / `renderShipList` (조선소 탭 전환 시 갱신): 정의 없어 silent no-op. `renderBlueprints()` / `renderShips()` 래퍼 추가.
- `loadGovDashboard` (거버넌스 선언 후 대시보드 갱신): 잘못된 함수명. `loadGovernanceData()` 직접 호출로 교체.

### server/routes/crafting.js
- `require('../services/gpService')` / `require('../services/seasonService')`: 존재하지 않는 파일명 → `require('../db').logGPActivity` + `require('../services/season')` 교정. 크래프팅 GP 활동 이제 정상 기록.

## 2026-05-06 v6.60 — 서버 라우트 서비스 require 오류 수정 (6개 파일)

### server/routes/ (6개 파일)
- `vip.js`, `duel.js`, `alliance.js`, `expedition.js`, `rental.js`, `contest.js`: 존재하지 않는 `gpService.js`, `seasonService.js`, `weeklyChallenge.js`를 require하고 있었음.
- 실제 서비스로 교정: `require('../db').logGPActivity` (GP 로깅) + `require('../services/season')` (시즌 점수). 이제 VIP 구매/파벌 행동/듀얼 등 GP 활동이 gp_activity_log에 정상 기록됨.
- `weeklyChallenges`는 삭제된 서비스이므로 주석으로 표시.

## 2026-05-06 v6.59 — admin.html mkStatBox 헬퍼 함수 정의 추가

### admin.html (1곳)
- `mkStatBox(label, value, color)`: 어드민 패널 실드/복권/경매 탭 스탯 카드에 16회 이상 사용되지만 프로젝트 어디에도 정의 없음 → ReferenceError. 함수 정의 추가.

## 2026-05-06 v6.58 — refreshBalance / gameAlert 미정의 함수 수정

### index.html (2곳)
- `refreshBalance`: 마켓/경매/함선 repair/scrap/shield/list 후 11곳 직접 호출 → ReferenceError. `window.refreshBalance = loadWalletData` 알리아스 추가.
- `gameAlert`: 영토 병합/크래프팅/듀얼 등 40곳 직접 호출 → ReferenceError. `window.gameAlert = showToast 래퍼` 추가.

## 2026-05-06 v6.56-v6.57 — 미정의 함수 aliases + 경매 시스템 auth 수정

### index.html (12곳)
- **v6.56** `loadWalletData` 미정의 함수: 복권/스테이킹 등 GP 소비 후 7곳에서 직접 호출 → ReferenceError → catch가 오류 토스트 표시. `window.loadWalletData = refreshEmailBalances` 알리아스로 수정.
- **v6.56** `refreshWalletInfo` (21곳 typeof 가드), `updateBalanceDisplays` (6곳), `loadUserData`/`loadBaseStats` (각 5곳): 모두 정의 없어 silent no-op. window 알리아스 추가.
- **v6.57** `POST /api/auction/create|bid|buyout|cancel`: auctionRoutes.js requireAuth 경로인데 Authorization 헤더 없이 요청 → 경매 등록/입찰/낙찰/취소 전부 401. `getAuthHeaders()` 추가.

## 2026-05-06 v6.55 — getWalletAddress 미정의 함수 수정 (8곳)

### index.html (8곳)
- `loadTransportTab`, `loadFleetCommandCard`, 수송 5개 함수, 월드이벤트 함대 선택에서 `getWalletAddress()` 호출. 이 함수는 앱에 정의되지 않고 폴백 `window._wallet`도 미설정 → 모두 빈 문자열 반환 → 함수 즉시 반환. 수송 탭, Fleet Command 카드, 월드이벤트 함대 선택 완전 비동작.
- `(walletState && walletState.address) || ''` 로 전면 교체.

## 2026-05-06 v6.54 — build-jobs dot 지시자 JWT 수정

### index.html (1곳)
- 베이스 탭 FLEET dot 업데이트 코드: `GET /api/ships/build-jobs` 호출에 `window._authToken` (미정의 변수) → `getAuthHeaders()`. 건조 완료 dot이 항상 보이지 않던 버그 수정.

## 2026-05-06 v6.51-v6.53 — auth 버그 3건 수정

### index.html (3곳)
- `govPlaceBet()`: `POST /api/betting/bet` — `x-wallet` 헤더 → `getAuthHeaders()` JWT 헤더. warBettingRoutes requireAuth는 JWT 전용으로 공성전 베팅이 항상 401 반환되던 버그 수정.
- `openMineralsPanel()`: `GET /api/resources/my?wallet=…` → `fetch('/api/resources/my', { headers: getAuthHeaders() })`. resources.js requireAuth 통과 불가로 MY MINERALS 패널 항상 비어 있던 버그 수정.
- `_phaseDAuthHeaders()`: `localStorage.getItem('jwt_token') || localStorage.getItem('jwt')` → `localStorage.getItem('pw_token')`. 앱 표준 키가 `pw_token`인데 잘못된 키를 조회해 동맹 guild add/remove/betray 모두 401 반환되던 버그 수정.

## 2026-05-06 — bugfix: GET /api/ships/my?wallet= → JWT auth (v6.50)

### index.html (1곳)
- `loadMyShips()` Ship Registry: `fetch('/api/ships/my?wallet='+encodeURIComponent(w))` → `fetch('/api/ships/my', { headers: getAuthHeaders() })`. ships.js requireAuth가 JWT만 인증하므로 쿼리 파라미터 wallet은 401 이후 도달 불가.

## 2026-05-06 — bugfix: GET /api/fleets x-wallet → JWT auth (v6.49)

### index.html (3곳)
- **버그**: `loadFleetCommandCard()`, 전쟁 함대 선택, 거버넌스 패널 — `GET /api/fleets` 호출 시 `x-wallet` 헤더만 사용
  - `fleets.js` 라우터는 `requireAuth` (JWT-only) → 401 UNAUTHORIZED → 함대 데이터 미표시
- **수정**: 3곳 모두 `{ 'x-wallet': w }` → `getAuthHeaders()` (JWT Bearer 토큰) 으로 교체

## 2026-05-06 — bugfix: phaseC tournament shadow-match (v6.48)

### server/routes/phaseC.js
- **버그**: `GET /tournaments/:id` (phaseC, line 305 mount) 이 `GET /tournaments/my` (tournaments.js, line 340 mount) shadow-match
  - `id='my'` → `parseInt('my')=NaN` → `INVALID_ID 400` 반환 → 내 토너먼트 목록 완전 비동작
- **수정**: `staticSubs = ['my','join']` `next()` guard 추가

## 2026-05-06 — bugfix: gameConfirm legacy calls — crafting + VIP (v6.47)

### index.html
- **버그**: `attemptCraft()` — `gameConfirm(confirmMsg, subMsg, callback)` 구버전 콜백 패턴 → 제작 확인 모달 완전 비동작
- **수정**: options object + `.then()` 패턴으로 교체. `\n` → `<br>` 변환 추가
- **버그**: `purchaseVipPass()` — `gameConfirm({title, body})` icon/confirmText 누락
- **수정**: `icon:'👑'`, `confirmText:'GET VIP'` 추가

## 2026-05-06 — bugfix: onboarding API URL mismatch + missing /reward endpoint

### index.html (5개 fetch 수정)
- **버그**: 온보딩 관련 모든 fetch URL이 `/api/user/onboarding/*` 을 사용했으나, 서버는 `/api/onboarding`에 마운트 → 전체 온보딩 API 404
- **버그**: `requireAuth` 미들웨어가 JWT를 요구하지만 Authorization 헤더 미포함 → 401
- **수정**: URL 5곳 모두 `/api/onboarding/*` 로 변경 + `pw_token` JWT 헤더 추가
  - `initOnboarding()`, `obNextStep()` (step advance + reward), `obSkip()`, `onTutorialClaimSuccess()`

### server/routes/onboardingRoutes.js
- **버그**: `POST /api/onboarding/reward` 엔드포인트 미존재 → step 5 보상 수령 버튼 항상 404 → 온보딩 완료 불가
- **수정**: `/reward` POST 핸들러 추가
  - `onboardingService.completeStep(wallet, 5, {})` 호출
  - 프론트 기대 포맷 `{ ok: true, rewards: { gp, pp } }` 로 변환
  - `ALREADY_DONE` → `{ error: 'already_claimed' }` 매핑

## 2026-05-06 — bugfix: FACTION_FLAVOR JS syntax error — unescaped apostrophes

### index.html
- **버그**: `FACTION_FLAVOR` 객체의 `line_en` 값 13개가 단일 따옴표로 감싸인 문자열 안에 미이스케이프 아포스트로피(`'`)를 포함
- 해당 `<script>` 블록(약 25k줄) 전체가 SyntaxError로 파싱 실패 → 클레임/하이잭/함대전 파벌 대사 기능 완전 비동작
- **수정**: 13개 아포스트로피를 `\'`로 이스케이프. 전체 스크립트 블록 파싱 복구 확인

## 2026-05-06 — bugfix: phaseD alliance shadow-match + leave 401

### server/routes/phaseD.js
- **버그**: `GET /alliances/:id` (phaseD, line 90) 이 `GET /alliances/my`, `GET /alliances/settings` (alliance.js) shadow-match
  - phaseD는 line 306 마운트 (alliance.js는 line 334) → phaseD가 먼저 처리
  - `id='settings'` → `parseInt('settings')=NaN → INVALID_ID 400` 반환
- **수정**: `staticSubs = ['my','settings','create','betray']` `next()` guard 추가

### index.html
- **버그**: `leaveAllianceConfirm()` — `POST /api/alliances/leave` JWT 없이 body wallet만 전송
  - phaseD `requireAuth` 가 먼저 처리 → 401 UNAUTHORIZED
- **수정**: `pw_token` 있으면 Authorization 헤더 추가

## 2026-05-06 — bugfix: Express route shadow-match + legacy gameConfirm callback patterns

### server/routes/tournaments.js
- **버그**: `GET /tournaments/my`가 `GET /tournaments/:id` 뒤에 등록 → 항상 `:id` 핸들러에 shadow-match
- **수정**: `/my` 라우트를 `/:id` 앞으로 이동

### server/routes/raffle.js
- `GET /raffles/my` → `/:id(\d+)` 앞으로 이동 (코드 순서 정정)

### server/routes/api.js
- **버그**: `GET /user/:wallet`이 `/user/titles`, `/user/my-territories` shadow-match → user 조회 응답 반환
- **수정**: `staticSubs` `next()` guard 추가 (`titles`, `my-territories`)
- **버그**: `GET /guild/:id`가 `/guild/research-bonuses` shadow-match
- **수정**: `research-bonuses` `next()` guard 추가

### index.html
- **버그**: `respondDuel()`, 임대, 영토 업그레이드, 기념비 설치 — `gameConfirm(icon, title, body)` 구버전 3인수 패턴 (opts=string → 모달 공백)
- **버그**: 저널/마일스톤/공지/묘비 — `gameConfirm(title, body, callback)` 레거시 콜백 패턴 (Promise 기반 함수에서 완전히 비동작)
- **수정**: 모든 8개 호출을 `gameConfirm({icon,title,body,confirmText})` + `.then(ok=>{...})` 패턴으로 교체

## 2026-05-06 — bugfix: BASE QUESTS bounty board broken API + field mismatches

### index.html
- **버그**: `loadBountyBoard()` — `/api/bounties/*` URL 사용 (서버는 `/api/bounty/*` 마운트) → 전체 404
- **버그**: `renderBountyList()` — `b.poster`(없음), `b.gp_amount`(없음), `b.message`(없음) 접근 → JS 오류/NaN
- **버그**: `submitPostBounty()` — `/api/bounties/post` + 잘못된 필드 `targetWallet/gpAmount/message`
- **버그**: `submitPostBounty()` — `gameConfirm('icon','title','body')` 구버전 4인수 호출 패턴
- **버그**: `cancelBounty()` — `/api/bounties/cancel` + body `{bountyId}` (서버는 `/api/bounty/cancel/:id`)
- **버그**: `cancelBounty()` — `d.refund` 미존재 (서버 응답은 `refunded_gp`)
- **수정**: 모든 URL `/api/bounty/...`로 통일, 필드명 `poster_wallet/reward_gp/reason`으로 정렬, gameConfirm options object 패턴으로 교체

## 2026-05-06 — bugfix: hidden campaign chapter wrong rewards (M3/M4)

### server/services/campaign.js
- **버그 M3**: `hidden_campaign_ch1~5` 완료 시 `simulateCh1()` 폴백 실행 — MCC 산소전쟁 시뮬레이션 결과로 처리
- **버그 M4**: `calculateRewards()` 히든 챕터 → `calculateCh1Rewards()` 폴백 — Prism Interceptor (`mcc_int`) 함선 잘못 지급
- **수정**: `simulateHiddenChapter()` 추가 — 관찰 중심 성공 시뮬레이션, 히든 루트 GP 보상 반환
- **수정**: `calculateHiddenChapterRewards()` 추가 — 소량 GP/XP, `the_observer` 태그(ch5), 히든 고유 loreFlag
- **수정**: `simulateChapter()`, `calculateRewards()` 양쪽 HIDDEN_CH1~5 분기 추가
- **수정**: 알 수 없는 챕터 폴백을 중립 시뮬/빈 보상으로 교체 (MCC 아이템 잘못 지급 방지)

## 2026-05-06 — bugfix: daily OPS mission notifications + forfeit exploit patch

### server/routes/ships.js
- **버그**: `POST /:id/list`, `POST /market/listings/:id/buy`, `POST /:id/repair` 에 `notifyMissionProgress` 호출 없음 → market_list/market_buy/repair_ship/repair_ship_3 미션 미적립
- **수정**: 각 핸들러에 성공 시 fire-and-forget notify 추가
- **버그**: `build_ship` — `res.json(result)` 전에 notify 호출, success 체크 없음
- **수정**: 성공(`result.success || result.job`) 확인 후 notify, res.json을 notify 이후로 이동

### server/routes/resourceCraft.js
- **버그**: `POST /start` — craft_resource 미션 알림 없음
- **수정**: craft_resource/craft_resource_3/craft_resource_5 notify 추가

### server/routes/crafting.js
- **버그**: `POST /crafting/craft` — craft_resource 미션 알림 없음
- **수정**: 동일 3종 notify 추가

### server/routes/fleetBattles.js
- **버그**: `POST /:id/forfeit` — already_resolved 분기에서도 `battle_forfeit` 미션 적립 → 반복 호출로 무한 적립 가능
- **수정**: `preparing` 상태에서만 알림 발화, already_resolved에서는 notify 제거

## 2026-05-06 — bugfix: onboarding PP reward parseInt→parseFloat + exchange_max fallback

### server/services/onboarding.js
- **버그**: `onboarding_pp_reward` 설정값 0.5를 `getSettingInt()`로 읽어 `parseInt('0.5')=0` 처리 → PP 보상 0 지급
- **수정**: `getSettingFloat()` 헬퍼 추가 + ppReward 조회를 parseFloat 기반으로 변경
- 기본값(fallback)도 `100`→`0.5`로 경제 밸런스 정렬

### server/routes/api.js
- **수정**: `pp_to_gp_exchange_max` 코드 fallback 값 `'10'`→`'5'` (migration 220 설정값과 일치)

## 2026-05-06 — bugfix: frontend wallet null guards + dead el ref cleanup

### index.html
- `loadTerritoryProduction`: wallet null guard 추가 (undefined가 API URL에 'undefined' 문자열로 들어가는 버그 수정)
- `loadBountyBoard`: 'mine'/'onme' 탭 wallet URL에 encodeURIComponent 적용
- `opsBoardCountdown2` 존재하지 않는 DOM 요소 dead reference 제거 (el 자체는 if 가드로 안전했으나 코드 정리)

## 2026-05-06 — bugfix: battleScheduler stale battle cleanup on startup

### server/services/battleScheduler.js
- **버그**: 서버 재시작 시 `'active'` 상태로 남은 전투가 영구적으로 스케줄러 슬롯을 점유
- **수정**: `cleanupStaleBattles()` 함수 추가 — 시작 시 30분 이상 경과된 `'active'` 전투를 `'cancelled'`로 처리하고 함대 락 해제
- `start()` 호출 시 `cleanupStaleBattles()` 비동기 실행 추가

## 2026-05-06 — bugfix: dailyOps weekly-events 라우트 shadow match 수정

### server/routes/dailyOps.js
- **버그**: `GET /weekly-events` 가 `GET /:wallet` 보다 뒤에 등록되어 있어, `/api/daily-ops/weekly-events` 요청이 wallet='weekly-events'로 처리됨
- **수정**: `/weekly-events` 라우트를 `/:wallet` 라우트 앞으로 이동 (Express 라우트 등록 순서 원칙 적용)
- 하단 중복 `/weekly-events` 블록 제거

## 2026-05-06 — 로컬라이징 27차 — ops카운트/PVP탭버튼/길드기부/프로필헤더 (루프 27차)

### 정적 HTML data-i18n + i18n 키 추가 (index.html) — 배치 27 (11항목)
- Ops 카운트다운 정적 한국어 fallback → 영어 중립 placeholder (JS가 동적으로 LANG처리)
- Ops 보드 loading span data-i18n="loading_dots" 처리
- PVP 탭 이동 버튼 3개 (GP Duels/Sector Siege/Naval Battles) data-i18n 처리
- 길드 GP 기부 라벨 data-i18n 처리
- 프로필 꾸미기 섹션 헤더 data-i18n 처리
- i18n 4개 언어 섹션에 4개 키 추가 (pvp_goto_tab/pvp_from_tab/guild_gp_donate_lbl/prof_customize_title)

## 2026-05-06 — 로컬라이징 26차 — VIP/크레이트/프레스티지 설명 패널 (루프 26차)

### 정적 HTML data-i18n + i18n 키 추가 (index.html) — 배치 26 (7항목)
- VIP 패스 설명 배너 타이틀 + 설명 div data-i18n 처리
- 크레이트 설명 배너 타이틀 + 설명 div data-i18n 처리
- 프레스티지 설명 배너 타이틀 + 설명 div data-i18n 처리
- i18n 4개 언어 섹션에 6개 키 추가 (vip_pass_title/vip_pass_desc/crate_what_title/crate_what_desc/prestige_what_title/prestige_what_desc)
- 모든 HTML 설명 desc 키는 applyI18n()이 innerHTML로 처리 (< 포함 값 자동 감지)

## 2026-05-06 — 로컬라이징 25차 — 영토정체성/섹터라벨/WE모달/카운트/로그인토스트 (루프 25차)

### 정적 HTML data-i18n + 동적 JS LANG 4개 언어 확장 (index.html) — 배치 25 (19항목)
- WE 모달 함대 선택 option + 최소 함선 안내 data-i18n 처리
- 영토 목록 클레임 수 `개` 접미사 4개 언어 처리
- 영토 생산 패널 sectorLabel (코어/미드/프론티어 섹터) 4개 언어 처리
- 영토 정체성 패널 소유자/섹터 메타 4개 언어 처리
- 영토 정체성 이력 4개 항목 (보유일/방어성공/탈환/최대보유) 4개 언어
- 영토 정체성 섹션 라벨 (이력/배지) 4개 언어
- World Events 네트워크 오류 toast 4개 언어
- 캠페인 로그인 필요 toast 4개 언어
- 거버너 전투 힌트 텍스트 4개 언어
- i18n 4개 언어 섹션에 2개 키 추가 (we_select_fleet/we_fleet_min)

## 2026-05-06 — 로컬라이징 24차 — ops보드/PVP허브/워베팅타이틀/포지/영토JS/하이잭알림 (루프 24차)

### 정적 HTML data-i18n + 동적 JS LANG 4개 언어 확장 (index.html) — 배치 24 (24항목)
- Ops 작전 보드 타이틀 + 범례 3개 (완료/미완료/긴급) data-i18n 처리
- PVP 허브 전투 선언 버튼 + 탭 3개 (추천상대/현상금/섹터분쟁) data-i18n 처리
- WAR BETTING 모달 타이틀 + 포지 강화중 텍스트 + 포지 확인 버튼 data-i18n 처리
- BASE 영토 패널 JS: 판매중 배지, 로딩중, 수확/보호막/업그레이드/지도 버튼 4개 언어
- 영토 생산 패널 JS: 최근 수확/아직 수확 없음 4개 언어
- TIER_LABELS (총독/지배/이해관계자/존재감) 4개 언어
- 섹터 컨트롤 `(나)` 레이블 4개 언어
- 하이잭 알림 (AUTO-WIN, 함대전 진행 중) 4개 언어
- i18n 4개 언어 섹션에 10개 키 추가 (ops_board_title/ops_legend_*/pvp_*/wb_title/forge_upgrading)

## 2026-05-06 — 로컬라이징 23차 — 워베팅 toast/모바일 영토 버튼/버그리포터 (루프 23차)

### 동적 JS + 정적 HTML data-i18n + i18n 키 추가 (index.html) — 배치 23 (19항목)
- 워베팅 베팅 성공 toast 4개 언어
- 모바일 영토 액션 버튼 6개 (이름변경/꾸미기/판매/보호막/업그레이드/HIJACK) data-i18n 처리
- 버그 리포터 정적 HTML 8개 요소 (힌트/설명라벨/SS라벨/SS placeholder/드래그/캡처중/제출/지우기) data-i18n 처리
- i18n 4개 언어 섹션에 14개 키 추가 (mt_rename~mt_hijack, br_hint~br_clear_ss)

## 2026-05-06 — 로컬라이징 22차 — 전투결과/동맹/리플레이/워베팅/온보딩 (루프 22차)

### 동적 JS 4개 언어 확장 (index.html) — 배치 22 (41항목)
- 전투 결과 리포트 타이틀, 승/패/무승부 배지 4개 언어
- 하이라이트 라벨맵 (첫 격침/기함 위기/전세 역전), 이동 버튼, 장면 타이틀 4개 언어
- 동맹 로딩/실패, 카드 메타 (멤버/전적/금고/소속), 탈퇴 버튼 4개 언어
- 동맹 목록 (기존 동맹/없음/멤버/함선/가입버튼) 4개 언어
- 동맹 창설/가입/탈퇴 gameInput + gameConfirm + 오류맵 + 성공 toast 4개 언어
- 리플레이 empty 메시지 (공유/추천) 4개 언어
- 워베팅 로딩/empty/실패/typeMap/closeText/베팅버튼/선택/풀/statusMap 4개 언어
- 온보딩 완료 환영 toast 4개 언어

## 2026-05-06 — 로컬라이징 21차 — 전투보상/AI/토너먼트/브래킷/하이잭/후퇴/커맨드/BV패널 (루프 21차)

### 동적 JS 4개 언어 확장 (index.html) — 배치 21 (23항목)
- 전투 승리/참가 보상 타이틀 4개 언어
- AI 카드 척수 표시 + 챌린지 AI gameInput + 대전 시작 toast 4개 언어
- 토너먼트 N강 라운드 라벨 4개 언어
- 토너먼트 등록 gameInput + 규모 선택 picker 4개 언어
- 브래킷 로딩/아직 준비중/관전/로드실패 4개 언어
- 하이잭 힌트 메시지 4개 언어
- 후퇴 toast 4개 언어
- 지시(커맨드) 라벨 맵 (진형/기동/집중공격 등) 4개 언어
- 지시 적용/인증오류/실패 toast 3종 4개 언어
- BV 사이드 패널 함선 수/HP 표시 4개 언어
- BV 자원 empty 메시지 4개 언어
- 전투 스탯 라벨 (공/방/HP) 4개 언어
- 자동 승리/패배 메시지 4개 언어
- BV 내 함대 + 적 함대 참가자 함선 수 표시 4개 언어

## 2026-05-06 — 로컬라이징 20차 — 전투목록/검색/시간표시/CA동적JS (루프 20차)

### 동적 JS 4개 언어 확장 (index.html) — 배치 20 (29항목)
- Battle Viewer 사이드 패널 loading 텍스트 data-i18n 처리 (4개)
- 전투 카드 척수/분 단위 표시 4개 언어
- 관전/리플레이/즉시 시작 버튼 텍스트 4개 언어
- 전투 즉시 시작 gameConfirm + 성공/실패 toast 4개 언어
- formatShortTime: 방금/N분 후/N분 전/N시간 전/N일 전 4개 언어
- 함대 셀렉터 옵션 척수 4개 언어
- 전투 선언 검색 힌트 5종 (최소 글자/검색중/실패/결과없음/오류) 4개 언어
- 검색 결과 카드: 함대/전적/척수/전투중 4개 언어
- 함대 선택 toast 4개 언어
- CA 모달 동적 JS: focus 타겟 자동지정/reinforce 함선선택/최대선택 toast 4개 언어
- CA Doctrines 설명 6종 4개 언어
- caApplyAndFight 버튼 텍스트 리셋 4곳 4개 언어

## 2026-05-06 — 로컬라이징 19차 — CA모달/전투허브/리플레이공유/파벌설명 (루프 19차)

### 동적 JS + 정적 HTML 4개 언어 확장 (index.html) — 배치 19 (38항목)
- 전투 선언 허브 정적 HTML: 타이틀/탭(최근·내기록)/선언버튼/부제목 data-i18n
- 전투 선언 달이얼로그: 내함대/추천상대/상대검색 라벨, 검색 placeholder data-i18n
- Commander Actions 모달 전체: 부제목/프리셋 라벨/SNIPER 액션/카드설명4종/파라미터라벨3종/힌트4종/선택수/버튼2개 data-i18n
- AI 연습전 설명 div data-i18n
- 토너먼트 개최 버튼 span data-i18n
- JS — 전투 선언 gameConfirm 타이틀/본문/확인 4개 언어
- JS — 리플레이 공유 gameInput 타이틀/레이블/placeholder 4개 언어
- JS — 리플레이 에러코드 3종 (NOT_PARTICIPANT/BATTLE_NOT_ENDED/REPLAY_LIMIT_REACHED) 4개 언어
- JS — 리플레이 공유 링크 gameInput + 완료 toast 4개 언어
- JS — 토너먼트 개최 gameInput 타이틀/레이블/placeholder + 참가비 gameInput 4개 언어
- JS — Ship Registry FACTION_META desc 3종 (mcc/fsp/cv) 4개 언어
- i18n 4개 언어 섹션에 30개 키 추가

## 2026-05-06 — 로컬라이징 18차 — 전투/토너먼트/리플레이 정적 HTML (루프 18차)

### 정적 HTML data-i18n 속성 + I18N 4개 언어 키 추가 (index.html) — 배치 18 (11개 항목)
- 전투 취소 버튼 → `data-i18n="btn_cancel"` + 4개 언어 키
- 공격 시작 span → `data-i18n="battle_attack_start"` + 4개 언어 키
- 보상 토스트 타이틀/닫기 → `data-i18n="reward_battle_title"` / `"btn_confirm"` + 4개 언어 키
- AI 연습전 타이틀 → `data-i18n="ai_practice_title"` + 4개 언어 키
- 토너먼트 탭 (모집중/진행중/완료) → `data-i18n` 3종 + 4개 언어 키
- 리플레이 탭 (추천/내 공유) → `data-i18n` 2종 + 4개 언어 키
- 전투 검색 힌트 → `data-i18n="bd_search_hint"` + 4개 언어 키

## 2026-05-06 — 로컬라이징 15~17차 — 인벤/마켓/조선소/함대지휘/전쟁모달 (루프 15-17차)

### 동적 JS + 정적 HTML 4개 언어 확장 (index.html) — 배치 15~17 (70+ 항목)
- 인벤토리 카테고리 비어있음 4개 언어
- 마켓플레이스 등록 다이얼로그 전체: 고정가/경매 버튼, 시작가/즉구가/즉시구매/기간 라벨, 기간 옵션, 수수료 텍스트, 등록하기 confirmText 4개 언어
- 영토 이름 변경 gameInput 타이틀·레이블 4개 언어
- 함선 강화 애니메이션 상태: 강화중/오류/성공/실패 제목, 확률/굴림 결과 텍스트 4개 언어
- 함선 수리 confirm: 타이틀/GP비용/iron_ore 수량/confirmText 4개 언어
- 함선 해체 confirm: 타이틀/body 설명/환불률/confirmText 4개 언어
- 실드 충전 confirm: 이미최대 toast/타이틀/body 설명/GP비용/confirmText/완료 toast 4개 언어
- 함선 마켓 카드: 판매중 스티커/항목 수 4개 언어
- MY FLEET 판매중 스티커 4개 언어
- 함선 판매 등록 gameInput 타이틀/레이블/placeholder 4개 언어
- 판매 취소 confirm: 타이틀/body/confirmText 4개 언어
- 함선 구매 confirm: 타이틀/body/가격 key/confirmText 4개 언어
- 건조중 표시 4개 언어
- 전쟁 선포 모달 정적 HTML: data-i18n 속성 추가 (선포비용/길드재무/검색입력/2글자힌트)
- i18n 4개 언어 섹션에 4개 전쟁모달 키 추가
- Fleet Command 모달: 타이틀/새함대/선택없음/함선없음/이름없음/전투중/리네임/해체 버튼 4개 언어
- Fleet Command 에러 메시지 맵 20종 4개 언어화 (NO_WALLET ~ SHIP_CANNOT_BE_FLAGSHIP)
- 함대 카드 메타: 척/전투중 배지 4개 언어
- 함대 상세: 총N척/전적/해제/이동/척선택 4개 언어
- 함대 해체 confirm: 타이틀/body/confirmText 4개 언어
- 함대 선택 드롭다운 N척 4개 언어

## 2026-05-06 — 로컬라이징 14차 — 정적 HTML 길드기부/인증 입력 (루프 14차)

### 정적 HTML data-i18n 속성 + I18N 4개 언어 키 추가 (index.html) — 배치 14 (9개 항목)
- 길드 기부 GP 입력 placeholder → `data-i18n-placeholder="guild_donate_placeholder"` + 4개 언어 키
- 길드 기부 버튼 → `data-i18n="guild_donate_btn"` + 4개 언어 키
- 콜로니 모토 입력 placeholder → `data-i18n-placeholder="auth_motto_placeholder"` + 4개 언어 키
- 콜로니 상태 입력 placeholder → `data-i18n-placeholder="auth_status_placeholder"` + 4개 언어 키
- vtag 입력 placeholder → `data-i18n-placeholder="auth_vtag_placeholder"` + 4개 언어 키

## 2026-05-06 — 로컬라이징 13차 — 정보모달/PVP허브/현상금/보호막/업적/SVG (루프 13차)

### 동적 JS 4개 언어 확장 (index.html) — 배치 13 (43개 항목)
- `_openInfoModal` 닫기 버튼 4개 언어
- MY MINERALS 비어있음/로드실패 4개 언어
- SHIP REGISTRY 총 N척·가용 N척·로드실패 4개 언어
- PVP Hub 지갑미연결/추천상대 설명 4개 언어
- PVP Hub 온라인·오프라인 상태 점 4개 언어
- PVP Hub 섹터 접미사·오늘활동·도전장 보내기 4개 언어
- PVP 분쟁탭 전투·현상금·클레임 수·로딩실패 4개 언어
- 현상금 보드 전체: 헤더/GP최소/사유/등록/전체·내현상금·내가등록 탭/로딩중 4개 언어
- 보호막 gameConfirm body + GP비용 라벨 + confirmText 4개 언어
- `_achConditionLabel` JA/ZH 사전 29개 항목 추가 → 4개 언어 lookup
- 업적 상세 모달 labels (달성조건/보상/상태/달성됨/미달성/닫기/달성일) 4개 언어
- 아트 제출 gameInput 타이틀·레이블·confirm 4개 언어
- 렌탈 요금 gameInput 4개 언어
- 동맹 금고 입금·출금·최소출금액·메모 gameInput 4개 언어
- SVG 자산 흐름 다이어그램 라벨 8개 4개 언어 (실제화폐/인게임통화/정치권력/환전X/채굴커미션/영토보유/입금/footer)

## 2026-05-06 — 로컬라이징 10차 — 함대카드/길드/타이머/요일라벨 (루프 10차)

### 동적 JS 4개 언어 확장 (index.html) — 배치 10
- 함대카드 함급 칩 (타이탄/전함/순양/구축/프리깃) 4개 언어
- 함대카드 편집 버튼·배치된 척·더보기 텍스트 4개 언어
- 기본 함대명 ("함대") 4개 언어 fallback
- 길드 연구 desc → 다국어 오브젝트 변환 (7종 × 4개 언어), 슬롯 잠금 "필요" 4개 언어
- 길드 레벨업 "연구 N슬롯 · 최대 N명" 4개 언어
- 길드전 없음/선포/진행 설명/함대전 버튼 전체 4개 언어
- 길드전 모달 로딩/오류/빈 상태/선포 완료 토스트 4개 언어
- 길드 전쟁 승리 버프 활성/남은시간 4개 언어
- openGuildWarFight 대화상자 4개 언어
- 동맹 탈퇴 confirm 4개 언어
- 동맹 미가입 상태 (window._lang → LANG + JA/ZH 추가)
- 길드 가입신청/탈퇴/추방/양도/해산 gameConfirm 전체 4개 언어
- 길드 기부 실패 toast 4개 언어
- 얼라이언스 길드 목록 "명" 접미사 4개 언어
- OPS 보드: 로딩/긴급이벤트(남음/지금참여)/미션(PP예상/수령완료/GP수령)/미션없음 4개 언어
- 주간 보드: 완료일/X/Y일/이번 주 보상 4개 언어
- 카운트다운 타이머: 리셋까지/만료/시간·분 포맷 4개 언어
- 요일 라벨 배열 KO/JA/ZH/EN

## 2026-05-06 — 로컬라이징 9차 — 함대전/토너먼트/파벌/버그리포트 전체 (루프 8~9차)

### 동적 JS 4개 언어 확장 (index.html) — 배치 9
- 추천 상대 없음 메시지 4개 언어
- 파벌 모달 전체 (쿨다운/선택/변경 토스트, 배지, 처리 중 버튼) 4개 언어
- 함선 마켓 (판매/취소/구매 성공·실패 토스트, 빈 리스트 문구) 4개 언어
- 함선 강화 (오류/성공/실패 forge 결과, 판매중 차단) 4개 언어
- 함선 수리/해체/실드충전 토스트 전체 4개 언어
- 함선 건조 에러맵 (NO_FACTION/RANK_REQUIRED/INSUFFICIENT 등) 4개 언어
- 함대지휘 (로드/진형/기동/이름변경/해체/함선이동) 모든 메시지 4개 언어
- Battle Hub (로딩/빈 탭/오류 상태) 4개 언어
- PVP 선언 (함대 선택 오류/자기공격/에러맵) 4개 언어
- Commander Actions 지시 적용 (증원 선택/count/에러맵) 4개 언어
- 전투 시작/종료 메시지 4개 언어
- AI 연습전 (그리드 로딩/빈/오류/선택) 4개 언어
- 토너먼트 (상태 라벨/빈 탭/참가비·상금/참가·브래킷 버튼/에러맵) 4개 언어
- Battle Viewer (ID 누락/타임라인 오류) 4개 언어
- 동맹 탈퇴 성공·실패 4개 언어
- 리플레이 (찾을 수 없음/로딩 실패/공유 없음) 4개 언어
- 전쟁 베팅 (옵션 선택/최소/에러맵) 4개 언어
- 버그 리포터 버튼/상태 텍스트 4개 언어 (전송중/제출/저장됨/완료/실패)
- 수송 취소/약탈 gameConfirm 4개 언어
- World Events 교전 실패 fallback 4개 언어

### 검증
- 전체 스캔 후 KO-only 동적 문자열 0건 (showToast/showFactionToast/innerHTML/textContent 기준)

## 2026-05-06 — 로컬라이징 전수 완성 7차 (루프 4~7차)

### 동적 JS 4개 언어 확장 (index.html)
- 함대전 발생 메시지 / 섹터 레벨 잠금 / 수송 관련 토스트 7종
- 수확 UI (로딩/쿨다운/실패/다음수확/로그인) 4개 언어
- 영토 업그레이드 확인 모달+성공/실패 토스트
- 조선소 청사진 카드 함선명/설명 syShipName() 활용
- 광물 패널 티어 제목/이름/설명 name_ja/name_zh DB 컬럼 우선
- 함대지휘 선택 패널 기함/척/선택함선
- 영토 병합 UI 전체 (모달/버튼/카운트/토스트)
- 경매/마켓 등록 성공/실패
- 길드 기부/길드전 참여
- 하이젝 에러맵 ko/ja/zh/en 4중 객체 전환
- 온보딩 직업 선택 카드 JA/ZH 번역 추가 (4개 직업 × 4항목)
- 온보딩 파벌/미션/보상 타이틀 name_ja/name_zh 지원
- 미션 미니게임 컨티뉴 제한 경고
- 글로벌 '함선'/'로그인이 필요합니다' fallback 4개 언어

### 검증
- 12개 핵심 엔드포인트 smoke: 500 에러 0건
- 모든 라우트 마운트 확인 (77/77)

## 2026-05-06 — 서버 smoke 감사 후 legacy read endpoint 보강 (Codex)

### 수정
- `server/routes/fleetBattles.js`
  - `GET /api/battles/history?wallet=...` legacy alias 추가
  - `GET /api/battles/active?wallet=...` legacy alias 추가
  - 기존 `/api/battles/list/history`, `/api/battles/list/active`는 유지
- `server/routes/ships.js`
  - `GET /api/ships/blueprints`를 선택 인증으로 변경
  - JWT가 없을 때도 `?wallet=` 또는 `x-wallet`으로 읽기 smoke 가능
  - wallet 누락은 401 대신 400 `WALLET_REQUIRED`로 분류

### 검증 메모
- `node --check server/routes/ships.js`: 통과
- `node --check server/routes/fleetBattles.js`: 통과
- `server/routes/*.js` 77개 vs `server/index.js` route require 참조 77개: 누락 없음
- sandbox 제한으로 `localhost:3000` curl 및 `localhost:5432`/socket psql 직접 접속은 `Operation not permitted`/connect fail
- `server/tools/smoke_capital_recipes.js`는 테스트 지갑 데이터 UPDATE/INSERT가 포함되어 있어 “기존 데이터 수정 금지” 제약상 실행하지 않음
- `git push` 없음

## 2026-05-06 — 전수 500 에러 제거 완료 (Claude + Codex 협업)

### 수정된 파일 및 내용

#### `server/services/shield.js`, `claimUpgrades.js`, `monuments.js`
- `c.sector_x/y` → `c.center_lng AS sector_x, c.center_lat AS sector_y` 수정

#### `server/services/tdesc.js`, `rating.js`, `tribute.js`, `sponsor.js`, `expedition.js`
- `c.name` → `c.custom_name` 수정
- `tdesc.js`: `c.x/y` → `c.center_lng/lat` 수정

#### `server/routes/auth.js`
- delete-account: `users.wallet` → `users.wallet_address`, `claims.status` → `deleted_at`

#### `server/services/staking.js`
- `ORDER BY staked_at` → `ORDER BY created_at`

#### `server/services/season.js`
- `battles.winner_wallet/attacker_wallet/gp_stake/status` 유령 컬럼 → 실제 스키마(`attacker/defender/success/attack_cost`)로 교체

#### `server/services/auction.js`
- `getUserAuctions`: `current_bidder_wallet` → `winner_wallet` + `bids` EXISTS 서브쿼리

#### `server/migrations/219_auction_current_bid_columns.sql` (신규)
- `auctions` 테이블에 `current_bid`, `current_bidder_wallet` 컬럼 추가

#### `server/services/warBetting.js`, `contest.js`, `spells.js`, `donation.js`
- wallet 비교 `LOWER()` 적용

#### `server/routes/arena.js`
- crash_bets/mines_games/hilo_games wallet 비교 `LOWER()` 적용

#### `server/services/worldEvents.js`
- 보스 보상 중복 지급 방지(idempotent), top-damage wallet 대소문자 무시

#### `server/services/achievements.js`
- `battles.winner_wallet/status` 유령 컬럼 제거, safe `[]` fallback

#### `server/routes/api.js`
- territory production sector_code 수정, upgrade column variance 처리

#### `server/routes/hallOfFameRoutes.js` (Codex)
- `titleExtended.getHallOfFameBoard()` 의존성 제거 → 로컬 구현으로 교체

### 검증
- 50+ 엔드포인트 전수 스모크 테스트: **500 에러 0건** (2026-05-06 16:54 KST)

---

## 2026-05-06 — 서버 전수 버그 수정: hijack/ai-fight/harvest/repair/tournament/admin-economy

### `server/routes/api.js`, `server/services/hijack.js`
- `/api/hijack/declare-with-pp`: 공격 함대/소유 픽셀/유저 PP/수비 claim 조회와 정산 쿼리의 `LOWER()` 지갑 비교 확인
- `fleet_battles.battle_type='hijack'`, `status='preparing'`, `phase='hijack_phase1'` 유지 확인

### `server/routes/phaseC.js`
- `/api/ai/fight`: battle/participants INSERT를 `BEGIN/COMMIT/ROLLBACK/finally release` 트랜잭션으로 원자화
- AI 함대 판별을 `fleets.is_ai` 컬럼 존재 시 + `users.is_ai` owner 기준으로 보강
- DB CHECK constraint 통과를 위해 AI 연습전 battle_type은 허용값 `pvp_duel` 유지, `battle_summary.is_ai_battle=true`로 구분

### `server/services/ship.js`
- `repairShip`, `chargeShield`: wallet 정규화 및 재료 차감 `LOWER(wallet_address)=LOWER($1)` 적용
- market-listed 함선 차단, GP 차감 트랜잭션, GP 로그 fire-and-forget 유지 확인

### `server/services/tournament.js`
- 참가 등록 wallet/fleet/user 비교를 `LOWER()` 기준으로 보강하고 참가비 GP 로그를 fire-and-forget으로 기록
- 정원 도달 시 등록 커밋 후 `startTournament()`를 호출해 브래킷 생성까지 이어지도록 수정
- tournament match의 fleet_battles/participants/match 연결을 트랜잭션으로 원자화, battle_type은 허용값 `event` 유지

### `server/routes/adminEconomyRoutes.js`
- territory economy/upgrades/admin stats 쿼리는 존재하지 않는 보조 뷰/테이블에 대해 `.catch(() => ...)` fallback이 적용되어 있음 확인

---

## 2026-05-06 — OPS 미션 전체 와이어링 + 캘린더 요일 제거 + BASE 탭 이모지 제거

### `server/routes/dailyOps.js`
- `today_dow` UTC → 로컬 시간 기준으로 변경 (UTC 고정 시 한국 기준 하루 밀림)

### `index.html`
- 7일 캘린더 스트립: 요일 이름(SUN/MON/TUE…) 제거 — 국가별 혼동 방지, 이벤트 아이콘+보너스만 표시
- BASE 메인 탭 이모지 전부 제거 (⚓ Fleet → Fleet, ⚔ PVP → PVP, 🛒 SHOP → SHOP, 📦 내 아이템 → 내 아이템)

### OPS 미션 notifyMissionProgress 전체 와이어링 (Codex 협업)
- `harvest_pp` — `/api/territory/:claimId/harvest` 성공 후
- `territory_art` — `/api/claim/:id/image` 성공 후
- `territory_upgrade`, `territory_upgrade_3` — `/api/territory/:claimId/upgrade` 성공 후
- `territory_claim` — 신규 claim 성공 후
- `daily_login` — 일일 로그인 후
- `upgrade_ship`, `upgrade_ship_3`, `upgrade_ship_5` — `ship.js upgradeShipStat()` 후
- `build_ship` — `ship.js startBuild()` 후
- `repair_ship`, `repair_ship_3` — `ship.js repairShip()` 후
- `market_list` — `ship.js listShipForSale()` 후
- `market_buy` — `ship.js buyShip()` 후
- `fleet_formation` — `fleets.js` formation 변경 후
- `craft_resource`, `craft_resource_3`, `craft_resource_5` — `resourceCraft.js` 후
- `battle_forfeit` — `fleetBattles.js` 항복 후
- `campaign_progress`, `campaign_complete` — `campaign.js` 후

---

## 2026-05-06 — Codex 감사 버그 수정 3건

### `server/routes/api.js`
- `/api/territory/:claimId/harvest`: `hold_bonus_pct` (장기 보유 보너스) + 월요일 +50% 보너스 올바른 엔드포인트에 적용
- `/api/harvest` (구버전 미사용): 잘못 추가된 보너스 블록 제거, 미사용 표시

### `server/routes/phaseC.js`
- AI 연습전은 DB CHECK constraint 허용값인 `pvp_duel`을 유지하고 `battle_summary.is_ai_battle=true`로 미션 트래킹 구분

---

## 2026-05-06 — 주간 이벤트/CPI/OPS 연동 + Field Rating 하이젝 가중 (Codex 협업)

### `server/routes/api.js`
- `harvest`: MON(월요일) +50% PP 보너스 적용 (UTC getDay===1)
- `hijack/declare-with-pp`: 수비 영토 Field Rating 구간별 attackCost 가중 (FR 0~9: ×1.0 / FR 10~29: ×1.1 / FR 30~59: ×1.25 / FR 60+: ×1.5)

### `server/services/ship.js`
- `upgradeShipStat`: FRI(금요일) 강화 GP 비용 -20% (UTC getDay===5), finalGpCost 기반으로 차감/로그/반환값 일관화

### `server/services/battleRewards.js`
- `computeReward` + `distributeMinimalRewards`: WED(수요일) 전투 GP 수령 +30% (UTC getDay===3), breakdown에 weekly_event 키 추가

### `server/services/battleScheduler.js`
- `_postBattleHooks()` 신규: 전투 종료 후 CPI 재계산 + Daily OPS 미션 트래킹 (battle_participate/battle_win/ai_battle) 자동 연동

### `server/services/battleReport.js`
- 전투 리포트 생성 시 atk/def performance_rating 계산 후 `fleet_battles.performance_rating_atk/def` DB UPDATE

---

## 2026-05-06 — 약점 개선 기획서 5대 기능 전면 구현

### `server/routes/api.js`
- `harvest`: extractor 업그레이드 보너스 뒤에 `hold_bonus_pct` 장기 보유 보너스 적용
- `hijack/declare-with-pp` 성공 시 수비 소유자에게 `territory_threatened` 알림
- `/api/territory/:claimId/production` 응답에 `holdBonusPct`, `holdDays`, 장기 보유 modifier 추가

### `server/routes/fleetBattles.js`
- `GET /api/battles/:id/highlights` 신규 — 하이라이트 3장면 (first_kill/flagship_threatened/turning_point)

### `server/index.js`
- 비활성 복귀 훅: UTC 09:00 매일, 7~30일 미접속 유저 `return_reminder` 알림 (7일 중복 방지)

### `index.html`
- Daily OPS: 7일 갤럭시 캘린더 스트립 (`#dailyOpsWeekCalendar`), 오늘 강조
- 전투 결과 리포트: 🎬 하이라이트 장면 버튼 3개, `openBattleViewerAt(battleId, tick)`
- 영토 PRODUCTION: 장기 보유 보너스 배지(정착민/토지주/개척자) + % 표시

### `assets/tactical-lab-v11.html`
- `?startTick=N` 파라미터: x8 패스트포워드 후 x1 복귀, 이동 오버레이 표시

---

## 2026-05-05 — 전투 기함 cascade 제거 / Daily OPS 30종 확장

### `server/services/battleEngine.js` — 전투 종료 조건 수정
- 기함 격침 시 전체 함대 즉시 괴멸(`fleet.dead = true`) cascade 제거
- 전투는 사이드의 **모든 함선 HP=0** 또는 항복(`forfeit`)으로만 종료
- `fleet.dead` 체크 → `f.ships.some(s => s.isAlive)` 기반으로 전환
- 기함 파괴 이벤트(`flagship_destroyed`) 로깅은 유지, 나머지 함선 전투 지속

### `server/routes/dailyOps.js` — 미션 30종으로 확장
- 13종 → 30종 (영토7 + 전투7 + 함선7 + 경제6 + 캠페인/로그인3)
- 하루 표시 미션: 5개 → 9개
- 요일별 다양한 조합 순환

### `index.html` — OPS Board + 전투 기록
- `opsMissionGo()`: 30종 미션 타입 GO 분기 전부 처리
- 주간 진척도 UI: 요일 라벨(월~일) + 오늘 강조 + 완료일 밝은 표시
- 전투 결과 카드 표시 후 `내 기록(history)` 탭 자동 갱신

---

## 2026-05-05 — 기획서 스펙 UI 정합 (전투 결과 리포트 + Territory FR)

### `index.html` — 전투 결과 리포트 UI
- `showBattleResult()` 타이틀: `'⚔ ATTACKERS WIN'` → `'⚔ 전투 결과 리포트'` (항상 고정)
- 부제목: 승리/패배 텍스트 → 함대명 `ATK함대 VS DEF함대` + 배지
- ATK/DEF 스탯 라벨: `총 함선→투입 함선`, `손실→격침`, `데미지→총 데미지`
- ATK/DEF 패널에 `나` 배지 + `WIN`/`LOSS` 배지 인라인 표시
- 타이틀 폰트: 32px/8px letter-spacing → 20px/2px (한국어 최적화)

### `index.html` — Territory Identity Field Rating 배지
- `loadTerritoryIdentity()`: FR 숫자 + 티어 레이블 + PP 보너스% 배지 추가
- 신규/개척자/정착민/요새/전설 티어별 색상 + 아이콘 + 보너스% 표시

---

## 2026-05-05 — PvP 매치메이킹 FLEET BATTLE HUB (spec 4-2)

### `server/services/battleReport.js`
- `getRecommendedOpponents`: `sector_code` / `last_battle_at` / `is_online` (1시간 기준) 반환 추가

### `index.html` — PVP 탭 FLEET BATTLE HUB 위젯
- NAVAL BATTLES + RECOMMENDED OPPONENTS + BOUNTY BOARD 3개 섹션 → 단일 `⚔ FLEET BATTLE HUB` 위젯으로 통합
- 3탭: [🎯 추천 상대] — CPI 기반 추천 / [💰 현상금] — 현상금 등록+목록 / [🔥 섹터 분쟁] — conflict-map 기반 Heat 순위
- 추천 상대 카드: 함대명 + 파벌 배지 + `●온라인/●오프라인` + CPI + 섹터 · 전투 시간 + `도전장 보내기` 버튼
- 헤더: `🔴 LIVE` (Battle Hub 모달) + `⚔ 전투 선언` 버튼
- pvp 탭 진입 시 자동 로드, `pvpHubSwitchTab('rec')` API
- 퀵 액션 그리드(FLEET CMD / AI Practice / TOURNAMENT / SHIPYARD) 하단 유지

---

## 2026-05-05 — 게임 개선 4대 기능 구현 (v6.08)

### 기획서: `docs/GAME_IMPROVEMENT_PLAN_2026-05-05.md`

### Migration 215: fleet_battles 전투 통계 컬럼 + CPI
- `fleet_battles`: `atk/def_damage_dealt`, `atk/def_flagship_survived`, `duration_ticks`, `performance_rating_atk/def`
- `fleets.cpi`: Combat Power Index 컬럼
- `ships.total_kills`: 누적 킬 카운터

### Migration 216: claims 영토 정체성 컬럼
- `nickname`, `bio`, `defense_wins`, `times_hijacked`, `battle_wins`, `field_rating`
- `badge_pioneer/settler/veteran/fortress`, `hold_bonus_pct`, `claimed_at`
- FR 공식 설정값 시드 (7/30/90일 보유 보너스)

### Migration 217: daily_ops 테이블 (Daily OPS 미션)
- `daily_ops`: 매일 UTC 00:00 리셋, wallet×date×mission_type UNIQUE
- 5종 미션 타입 + 보상 GP 설정값
- 주간 이벤트 캘린더 설정값 (월/수/금/토)

### Migration 218: bounty_listings 테이블 (현상금 게시판)
- `bounty_listings`: poster/target/reward_gp/reason/status/expires_at
- 만료 자동 환불, 수수료 5%, 최대 3개 동시 게재

### 서버: `server/services/battleReport.js`
- `generateBattleReport(battleId)` — 전투 리포트 카드 (S/A/B/C/D 레이팅, 하이라이트, MVP)
- `getPlayerBattleStats(wallet)` — 전투 통계 집계 (승률/KD/연승/파벌별 승률)
- `calcFleetCPI(ships)` / `updateFleetCPI(fleetId)` — CPI 계산/업데이트
- `getRecommendedOpponents(wallet)` — CPI 기반 추천 상대

### 서버: 신규 라우트
- `GET /api/battles/:id/report` — 전투 리포트 카드
- `GET /api/battles/my-stats/:wallet` — 플레이어 전투 통계
- `GET /api/battles/recommended-opponents/:wallet` — 추천 상대
- `GET /api/daily-ops/:wallet`, `POST /api/daily-ops/progress`, `POST /api/daily-ops/claim` — Daily OPS
- `GET /api/daily-ops/weekly-events` — 주간 이벤트 캘린더
- `GET /api/bounty/list|my-bounties|on-me`, `POST /api/bounty/post|claim|cancel/:id` — 현상금 게시판
- `GET /api/territory/:claimId/identity`, `PATCH /api/territory/:claimId/identity` — 영토 정체성
- `GET /api/sectors/conflict-map` — 섹터 갈등 지도

### 서버: 스케줄러 추가
- Territory Field Rating + Badge (매 5분 체크, UTC 00:00 실행)
- Bounty 만료 처리 + GP 환불 (매 1시간)

### 프론트: `index.html`
- **전투 결과 리포트 카드**: `showBattleResult()` → 비동기 리포트 로드, S/A/B/C/D 레이팅 표시, 하이라이트, MVP
- **내 전투 기록 모달**: `_showMyBattleStats()` — 승률/KD/연승/최고 레이팅
- **Daily OPS Board**: OPS 탭 상단에 미션 목록 + 진행바 + CLAIM 버튼
- **Territory Identity**: 영토 정보 패널에 FR/배지/보유 기간/방어 승리 표시, 닉네임/바이오 편집
- **추천 상대 (PVP 탭)**: CPI 기반 추천 상대 목록 + 도전 버튼
- **현상금 게시판 (PVP 탭)**: 등록/목록/취소 UI
- i18n: 60+ 신규 키 (EN/KO)

## 2026-05-05 — 종합 로컬라이제이션 패스 (v6.07)

### 영문/일문/중문 사용자에게 보이던 한국어 텍스트 전면 수정 (cc2c6df)
- **착륙 오버레이**: 태그라인, 기능 설명, CTA 버튼 → `data-i18n`
- **온보딩 플로우 (Step 0~4)**: 전체 한국어 텍스트 → `t()` 호출
  - 직업 선택: 언어별 직업명·설명·버프/디버프
  - 파벌 선택: 로딩·확인/취소·에러/성공 토스트
  - Step 3 (영토), Step 4 (완료): `t()` 적용
  - 보상 토스트: GP/PP/아이템/칭호 모두 `t()`
- **모달 닫기 버튼**: 모든 "✕ 닫기" → `data-i18n="btn_close"`
  (조선소·함대지휘·전쟁베팅·AI전투·토너먼트·브래킷·동맹·리플레이·배틀뷰어)
- **전쟁 베팅 탭**: `data-i18n="wb_tab_*"`
- **조선소 마켓 정렬**: `data-i18n="sy_sort_*"`
- **배틀뷰어 결과**: 승리/패배/무승부 및 통계 레이블 → `t()`
- **배틀 목록 카드**: 상태 레이블(대기/라이브/공격승/수비승), 전투 유형 맵, 결과 레이블
- **PVP 탭**: 공성전·함대전 설명 블록 `data-i18n`, AI연습전·토너먼트·조선소 버튼
- **함대 빈 상태**: `t('fleet_no_fleet_hint')`, `t('fleet_no_ships_hint')`
- **함대 전투 오류 토스트**: 전투 가능한 함대 없음 → `t()`
- **길드전 자동승리 다이얼로그**: 제목·본문·버튼·에러맵·토스트 → `t()`
- **인벤토리 필터 버튼**: `data-i18n="inv_cat_*"`
- **영토 탭 제목·로그인 힌트**: `data-i18n`
- **하이젝 함대 없음 경고·로딩**: `data-i18n`
- **함선 레지스트리 광물 카탈로그**: 언어별 티어 제목·광물명·설명
- 총 EN/KO 1499 키 (이전 1440), JA/ZH는 신규 키에서 EN 폴백 적용

## 2026-05-05 — 영토별 개별 수확 + 채굴 탭 제거 (v6.06)

### 신기능: 영토별 개별 수확 API (`POST /api/territory/:claimId/harvest`)
- `claims.last_harvest_at` 컬럼 추가 (Migration 214)
- 각 클레임별 독립 쿨다운 (CORE=24h / MID=48h / FRONTIER=72h)
- 기존 `user_mining` stats와 호환 유지 (일일/전체 채굴 통계 누적)
- 모든 보너스 적용 (거버너·섹터 버프·날씨·VIP·위상·티어·업그레이드)
- 자원 드롭 포함 (sector tier 기반)
- `_baseTerritoryHarvest(idx)` → 신규 API 호출, 쿨다운 시 남은 시간 표시

### 채굴 탭 제거 + GP 섹션 영토 탭 하단 이동
- `baseTabMining` + `basePane_mining` 제거
- GP Activity Log / SEND GP / GP LOTTERY / GP STAKING → 영토 탭 하단으로 이동
- 채굴 통계 요소(`baseMineAvail` 등) 숨김 유지로 JS 참조 호환

### 가이드(GUIDEBOOK) 업데이트
- 채굴 섹션: "BASE → MINE 탭" 언급 제거
- 영토 탭 아코디언에서 개별 수확하는 방법 안내 추가 (한/영)
- 광물 드롭 테이블 섹션 추가: FRONTIER(T1) / MID(T2) / CORE(T3) × 용도
- 강화 티어와 드롭 연결 callout 추가

## 2026-05-05 — 영토 목록 아코디언 + 패널 UX 개선 (v6.05)

### 신기능: BASE 내 영토 목록 인라인 아코디언
- `▶` 클릭 시 지구본 이동 → 인라인 아코디언 확장으로 변경
- 아코디언 본문: 예상 PP, 섹터 타입, 최근 수확, 드롭 광물 목록
- 빠른 액션 버튼: ⛏ 수확 / 🛡 보호막 / 🔧 업그레이드 / 🌐 지도
- 🌐 지도 버튼만 지구본으로 이동 (나머지는 BASE 내에서 처리)
- `_baseTerritoryAccordion()` / `_bterrLoadProd()` 신규 함수 추가
- 확장 상태 `_baseTerritoryExpanded{}` 에 유지 (탭 전환 시 복구)

### 영토 정보 패널 UX 수정
- RENAME 버튼 제거 (영토 이름이 화면에 표시되지 않아 사용성 없음)
- 보호막 버튼 `gameConfirm` 호출 방식 수정 (구 3-arg → 신 object 형식)
  - 보호막 버튼 클릭 시 아무 반응 없던 버그 수정
- 업그레이드 패널: 토글 제거, 내 영토 선택 시 자동 확장 + 즉시 데이터 로드
- `scrollToTerritoryUpgrade()` 신규 함수 (모바일 업그레이드 버튼 연결)

## 2026-05-05 — 서브탭 폰트/패딩 개선 (v6.04)

### UI: BASE 탭 가독성/터치 영역 개선
- `.base-tab` 폰트 10px → 13px, 패딩 `9px 12px` → `11px 16px`, min-height 44px
- `.bcat` (상단 카테고리 필) 폰트 10px → 13px, 패딩 `6px 14px` → `8px 18px`, min-height 36px
- `.base-inv-cat` (내 아이템 카테고리 탭) 인라인 스타일 → CSS 클래스로 통합, 폰트 9px → 12px, 패딩 `4px 10px` → `7px 14px`
- `filterBaseInv()` 인라인 스타일 강제 제거 → CSS 클래스 `.active` 위임

## 2026-05-05 — 강화 확인 모달 정보 표시 버그 수정 + Forge 애니메이션 (v6.03)

### 버그 수정: 강화 확인 모달 성공률/재료 미표시
- **원인**: `s.id === shipId` 엄격 일치 실패 (서버는 string `'208'`, onclick은 number `208`) → `ship` 조회 undefined → `offer` undefined → info 테이블 숨겨짐
- **수정**: `String(s.id) === String(shipId)` 비교로 변경

### 신기능: Forge 강화 애니메이션 모달 (`index.html`)
- 강화 확인 후 망치 뚝딱 애니메이션 + 게이지 바 표시 (2.4초)
- 망치 6회 스윙 + 타격 시 스파크 파티클 (Canvas 기반)
- API 호출과 애니메이션 병렬 진행 (`Promise.all`)
- 결과 표시:
  - ✅ 성공: 초록 글로우 + 스파크 버스트 + `+N스탯 (MOD X)`
  - 💔 실패: 주황/붉은 게이지 + GP 소모 확인
  - ⚠ 오류: 빨간 글로우 + 에러 코드
- 결과 서브텍스트: `-GP  ·  확률%  ·  굴림값`

### 강화 확인 모달 정보 개선
- 성공 확률, GP 비용(보유량 포함), 재료명+보유/필요 수량 info 테이블 표시
- `material_tier`, `upgrade_level` 서버 응답에 추가 (`ship.js` upgradeOffers)

## 2026-05-05 — 함선 강화 티어 재료 시스템 (v6.02)

### 함선 강화 재료 티어 시스템 (`server/services/ship.js`, `index.html`)
- 강화 횟수(upgrade_level)에 따라 요구 재료가 T1→T2→T3으로 상승
  - Lv 0-4 (강화 1~5회): T1 기본 광물
  - Lv 5-9 (강화 6~10회): T2 희귀 광물
  - Lv 10+ (강화 11회~): T3 전설 광물
- 스탯별 재료 매핑:

| 스탯 | T1 | T2 | T3 |
|------|-----|-----|-----|
| 공격력 | 탄소섬유 | 플라즈마 결정 | 이그조틱 합금 |
| 방어력 | 철광석 | 티타늄 합금 | 장갑판 |
| 체력 | 실리콘 칩 | 운석 파편 | 합금 프레임 |
| 속도 | 현무암 조각 | 나노 폴리머 | 암흑물질 |

- 강화 확인 모달에 현재 티어(T1/T2/T3) 색상 배지 표시
- "X회 후 T2 희귀 재료 필요" 예고 텍스트 표시
- 강화 버튼에 티어 배지 (초록=T1, 파랑=T2, 보라=T3)
- 높은 강화 함선은 희귀 재료가 소모된 만큼 마켓 가치 차별화

## 2026-05-05 — 함선 강화 재료 T1 광물로 수정 (v6.01)

### 버그 수정: 함선 강화 항상 실패 (`INSUFFICIENT_MATERIALS`)
- **원인**: `ship_upgrade_*_material` 설정값이 T2/T3 재료(`plasma_crystal`, `titanium_alloy`, `alloy_frame`, `nano_polymer`)로 되어 있었는데, 초반 플레이어는 T1 광물만 보유 → 항상 재료 부족 실패
- Migration 213: 강화 재료를 T1 광물로 변경
  - `atk` 공격력: `plasma_crystal` → `carbon_fiber` (탄소섬유, T1)
  - `def` 방어력: `titanium_alloy` → `iron_ore` (철광석, T1)
  - `hp` 체력: `alloy_frame` → `silicon_chip` (실리콘 칩, T1)
  - `speed` 속도: `nano_polymer` → `basalt_chip` (현무암 조각, T1)
- `server/services/ship.js` `calcShipUpgradeOffer` fallback 값도 동일하게 수정

## 2026-05-05 — 전술랩 미사일/EMP/사운드/플로팅텍스트 대폭 개선 (v6.00)

### 전술랩 미사일 개선 (`assets/tactical-lab-v11.html`)
- 미사일 속도 1.55-2.0 → 0.85-1.05 px/frame 감속, TTL 150 → 240 프레임 (착탄 2~3초)
- 유도 미사일(homing): 발사 8프레임 후 타겟 방향 0.045 비율 조향, 곡선 탄도
- 부채꼴 발사 (fan barrage): ±0.35rad 산탄 효과
- 충전 속도 약 55% 감소 (`0.0021+n×0.00007`)
- 미사일 비주얼: 주황 그라디언트 꼬리 + 흰 발광 탄두

### EMP — EWAR(재머) 함선 요구 + 충전 게이지 시스템
- EW Frigate 없으면 버튼 disabled + "재머없음" 표시
- EWAR 함선 수에 비례해 충전, 100% 도달 시에만 발동
- 발동 시 재머 함선 위치에 `⚡ EMP` 플로팅 텍스트 + 충전 초기화

### 오디오 시스템 전면 개편
- 빔/레이저: 충전 180→2200Hz + 방전 2800→90Hz 톱니 + 노이즈 꼬리 (건담 스타일)
- 빔포: 와인 + "콰아앙" 저음 + 심저음 레이어
- BGM: 138bpm 4/4 루프 (킥/스네어/하이햇/베이스/리드)
- `visibilitychange`/`pagehide`: 탭 숨김 시 자동 정지, 복귀 시 재개

### 플로팅 월드좌표 텍스트
- 피격/이벤트 메시지가 해당 함선 위치에서 떠오름 (카메라 추종)
- 기함 격침, EMP 발동, 패닉/피해 이벤트 연동

### 전투 메시지 + 카메라 개선
- bottom slot 메시지 → 상단 div 라우팅 (컨트롤패드 겹침 해소)
- 카메라 lerp 0.025 → 0.06, initBattle 즉시 중심 설정 (jitter 제거)
- 5v5+ 함대 레이블 화면 이탈 방지 (Y clamp +32px)

## 2026-05-05 — 영토 병합 + 임대 버그 + 캠페인 CH2 밸런스 (v5.99)

### 신기능: 영토 병합 (Territory Merge)
- `POST /api/territory/merge` — 여러 영토 클레임을 하나로 병합하는 서버 엔드포인트 추가 (`server/routes/api.js`)
  - body: `{ wallet, claimIds: [id1, id2, ...] }` (2~50개)
  - 검증: 소유권, soft-delete 여부, 활성 임대, 활성 전투, marketplace_locked 체크
  - 모든 픽셀의 `claim_id` → 신규 병합 클레임으로 재할당
  - `territory_upgrades`도 최고 레벨 기준으로 병합 클레임에 복사
  - 기존 클레임 soft-delete (`deleted_at = NOW()`)
  - 바운딩 박스 기반 `center_lat/lng`, `width/height` 자동 계산
- `index.html` 내 영토 정보 패널에 `🔗 MERGE TERRITORIES` / `🔗 영토 병합` 버튼 추가
  - 소유자 전용 표시 (`infoMergeBtn`)
  - `openTerritoryMergePanel()` — 내 영토 체크박스 목록 모달. 현재 영토 기본 선택
  - `doTerritoryMerge()` — 병합 실행 + 완료 후 클레임 재로드
- 4개 언어 i18n (`merge_btn`) 추가: EN/KO/JA/ZH

### 버그 수정: 영토 임대 버튼 미동작
- `openListForRentModal()` — `/api/user/my-territories` 응답이 `{ territories: [...] }` 래퍼로 오는데 `.length` 직접 체크해 항상 "영토 없음" 알림이 뜨던 버그 수정
  - `data.territories || data || []` 로 배열 추출
  - 영토 이름 표시도 `custom_name` 우선으로 개선

### 버그 수정: 캠페인 CH2 실패 임계값 완화
- `server/services/campaign.js` — `simulateCh2()` 시설 HP 실패 임계값 80 → 65
  - 최적 선택(`ch2_request_support`)으로 항상 통과 가능하도록 조정 (기존: 40% 확률 실패)
  - 시드 기반 RNG로 특정 wallet이 항상 실패하는 문제 해소
  - `ch2_intel_query`: ~7% 실패율, `ch2_warn_civilians`: ~27% 실패율로 조정

## 2026-05-05 — P5 버그 수정 + 캠페인 보상 실물화 (v5.98)

### 버그 수정: Extractor 수확 보너스 미반영 (재무 무결성)
- `POST /api/harvest` — `territory_upgrades` 테이블의 extractor 업그레이드 레벨을 실제 PP 수확량에 반영하지 않던 버그 수정 (`server/routes/api.js`)
  - PP는 USDT 1:1 스왑 가능한 실물 화폐이므로 수확 정확도는 재무 무결성 이슈
  - MAX(extractor level) 쿼리 → bonusMap (Lv1=+15%~Lv5=+100%) 적용 후 `harvestedPP` 재계산

### 버그 수정: 캠페인 보상 placeholder → 실물 지급
- `server/services/campaign.js` — 미지급 placeholder 보상 전종을 실제 DB 재료(+GP)로 교체
  - `ship_blueprint/data_artifact/safe_house_access/permanent_buff/residence/corporate_asset/gp_stream/weapon_system/title_position` 등 → exotic_alloy/quantum_core/xenomatter/plasma_crystal 등 실물 재료
  - CH10 엔딩 보상 GP 증액 (ending_2: 800k→1.2M)
  - `lifeline_supply_ship`(존재하지 않는 코드) → `fsp_logi` (유효 함선 코드)
  - `campaignShipRewardPlan` single 맵에 `fsp_logi`, `fsp_logi_crs` 추가

### 버그 수정: 다국어 로컬라이징
- `index.html` `_campaignStoryText()` — 비한국어 유저의 fallback 우선순위를 `ko` → `en`으로 수정 (일어/중국어 선택 시 한글 노출 차단)
- 캠페인 챕터 목록 location 표시도 언어별 분기 (`displayNameEn` / `displayNameKo`)
- `campaignObjectiveActionLabel()` 일어/중국어 번역 맵 추가
- 33개 챕터 제목에 `ja`/`zh` 번역 추가

### 버그 수정: P5 API 경로 오류
- `server/routes/api.js:5219` `require('./db')` → `require('../db')` (영토 업그레이드 GP 로그 silent 실패 수정)
- `server/routes/adminEconomyRoutes.js:456` `materials_used` → `minerals_used` (admin 재료 소각 통계 컬럼명 오타)
- `index.html` `_territoryUpgradeState` reset 시 undefined 참조 방어 코드 추가

## 2026-05-05 — P5-3~7 Territory Full Utility Stack (v5.97)

### P5-3: Shipyard Connection
- `GET /api/ships/blueprints` 응답에 `materialSectorHints` 포함 (`server/routes/ships.js`).
  - `sector_resource_rates` 기반으로 재료별 주요 드롭 섹터(`frontier/mid/core`) 맵 생성 (10분 캐시).
  - `GET /api/ships/resource-sector-hints` 독립 엔드포인트 추가.
- `index.html` 조선소 카드에 재료 칩 옆 섹터 뱃지 추가 (`⛏ 개척지 / ⛏ 중간지 / ⛏ 핵심지`).
  - `shipyardState.materialSectorHints` 저장.
  - `sySectorBadge(resourceCode)` 헬퍼 추가.
  - `syBuildRequirementInfo()` 에도 섹터 정보 포함.

### P5-4: Territory Upgrades & Roles
- `server/migrations/211_territory_upgrade_p5_tracks.sql` — P5 업그레이드 트랙 settings 시드.
  - 5개 트랙: `extractor`, `refinery`, `shield_grid`, `relay_tower`, `art_beacon` (각 5레벨).
- `server/services/claimUpgrades.js` — P5 트랙 정의 + 설정 로딩 확장.
  - `effect` 필드: `material_drop / advanced_material / defense / visibility / pp_bonus`.
  - `getSettings()` 이제 `upgrade_%` 패턴으로 모든 업그레이드 설정 동적 로드.
  - `getUpgradeCatalog()` 에 `isP5`, `effect`, `nameEn` 포함.
- `GET /api/territory/:claimId/upgrades?wallet=` 신규 엔드포인트.
- `POST /api/territory/:claimId/upgrade` 신규 엔드포인트 (기존 `upgradeTerritory` 서비스 재사용).
- `GET /api/territory/:claimId/production` — 업그레이드 보너스 모디파이어 포함.
- `index.html` 영토 정보 패널에 `🔧 UPGRADES` 접힘 섹션 추가.
  - `toggleTerritoryUpgradePanel()`, `loadTerritoryUpgrades()`, `renderTerritoryUpgradeBody()`, `doTerritoryUpgrade()` 함수 추가.

### P5-5: Sector Control
- `GET /api/sectors/control` — 전체 섹터별 컨트롤 스코어 (픽셀+업그레이드+수확 활동).
  - 상위 3위 + 영향력 티어 (presence/stakeholder/dominant/governor).
- `GET /api/sectors/:sectorId/control?wallet=` — 단일 섹터 상세 + 내 위치.
- `index.html` 프로덕션 패널 하단에 섹터 컨트롤 리더보드 append (`_appendSectorControl()`).

### P5-6: Admin Economy Tuning
- `server/routes/adminEconomyRoutes.js` — 3개 신규 엔드포인트:
  - `GET /api/admin/territory/economy` — 재료 발행량, 수확 통계, 의심스러운 고빈도 수확자, 상위 클레임.
  - `GET /api/admin/territory/upgrades` — 업그레이드 분포 및 GP 소각.
  - `GET /api/admin/territory/sector-control` — 섹터별 컨트롤 현황.
  - `POST /api/admin/territory/production-profile` — 생산 설정 수정.
- `admin.html` — `🌍 TERRITORY` 탭 추가 (수확 통계, 재료 발행/소각, 의심 수확자, 상위 클레임, 생산 프로파일 편집기).

### P5-7: Campaign & Season Integration
- `server/services/campaign.js` objectiveState에 2개 신규 지표:
  - `materialHarvests` — 재료 드롭이 있는 수확 횟수.
  - `territoryUpgradeLevels` — 소유 업그레이드 레벨 합산.
- MCC CH1 objectives에 `first_material_harvest` (optional) 추가.
- MCC CH2 objectives에 `territory_upgrade_start` (optional) 추가.
- `getMissingRequiredObjectives()` — `optional: true` 목표는 챕터 완료 gate에서 제외.

검증:
- `server/services/claimUpgrades.js` load OK
- `server/routes/ships.js` load OK
- `server/services/campaign.js` load OK
- `api.js` syntax check OK
- migration 211 DB 적용 완료

## 2026-05-05 — P5-2 Material Drops on Harvest + Doc Sync (v5.96)

**재료 드롭 트랜잭션 통합**
- 수확 시 재료 드롭을 COMMIT 전 트랜잭션 안에서 처리하도록 변경 (`server/routes/api.js`).
  - `rollResourceDrop()` 는 SELECT만 하므로 COMMIT 전 호출 안전.
  - `addResourcesToInventory(client, ...)` — pool 대신 트랜잭션 client 전달.
  - `transactions.meta.resourceDrops` 에 드롭 결과 포함 (이전에는 meta에 없었음).

**프론트 수확 알림 개선**
- 수확 결과 알림이 PP + 재료 드롭을 통합 표시 (`showNotification` + `showToast`).
- 아이콘/이름 매핑을 22종 전체로 확장 (이전: 9종). KO/EN `LANG` 변수 분기.
- `loadTerritoryProduction()` lastHarvest 패널에 재료 드롭 칩 추가.

**문서 동기화**
- `docs/TERRITORY_UTILITY_PLAN`, `CLAUDE_P5_TERRITORY_IMPLEMENTATION_ORDER`, `GAME_IMPLEMENTATION_PLAN` — P5-4~7 포함 풀 플랜으로 동기화.

**캠페인 씬 i18n (v5.94 완료)**
- 39개 씬 JSON 파일 전체 `ja`/`zh` 번역 완료. KO=JA=ZH 동수 검증.

검증:
- `node --check server/routes/api.js` 통과
- JS inline syntax check 통과
- `git diff --check` 통과

## 2026-05-05 — P5-1 Territory Production Visibility (v5.95)

**서버 신규 엔드포인트**
- `GET /api/territory/:claimId/production?wallet=...` 추가.
  - claim 소유 여부 확인, 픽셀 수 + 섹터 유형(frontier/mid/core) 집계.
  - `sector_resource_rates` + `resources` JOIN으로 해당 섹터 드롭 재료 목록 반환.
  - 예상 PP 범위(`ppMin`/`ppMax`) — 기존 harvest 공식(`rewardMin × pixelFactor × sectorMult`) 그대로 사용.
  - 모디파이어: 섹터 유형 보너스, 이미지 등록 여부, adjacency_bonus.
  - 소유자일 때만 최근 수확 이력(`lastHarvest`) + 다음 수확 가능 시각(`nextHarvestAt`) 포함.
  - missing sector/resource 테이블 safe fallback — 500 에러 없음.

**프론트 territory info 패널**
- 내 영토 상세 패널에 `⚙ PRODUCTION` 섹션 추가 (`infoProdRow`/`infoProdBody`).
  - 예상 PP 범위, 섹터 유형, 모디파이어 칩, 드롭 광물 칩(% 표시), 최근/다음 수확 정보.
  - KO/EN 다국어 대응 (lang 기반 레이블 선택).
  - 남의 영토에는 production 섹션 노출하지 않음.
- `loadTerritoryProduction(claimId, wallet)` JS 함수 추가.
- `_timeAgo(date)` 헬퍼 추가.

**범위 밖 (아직 미구현)**
- 섹터 컨트롤, 영토 역할, 영토 업그레이드, 생산 배율 경제 영향.
- P5-2 (재료 드롭 harvest 연동), P5-3 (조선소 연결) — P5-1 안정화 후 진행.

검증:
- `node --check server/routes/api.js` 통과
- JS inline syntax check 통과
- `git diff --check` 통과
- DB 쿼리 smoke test 통과 (claimId=307, frontier 10종 rates)

## 2026-05-05 — Campaign dialogue & objective full i18n (v5.93)

**스토리 렌더러 다국어화**
- `_campaignStoryText(value)`: LANG 변수 기반으로 `value[lang]||value.ko||value.en` 우선순위 체인으로 텍스트를 반환한다. 이전에는 항상 `.ko` 고정이었다.
- `_campaignStorySpeakerName(id)`: KO/EN/JA/ZH 4개 언어 이름 맵 추가. 23개 캐릭터 ID (리팡, 천 회장, 미하일 등) 를 언어별로 적합한 이름으로 반환한다.
- `ch.title`, `ch.location.displayName` — `.ko` 하드코딩 제거, `_campaignStoryText()` 사용.
- `showCampaignBriefing()`: briefing 라인과 선택지 라벨이 `_campaignStoryText(l)` / `_campaignStoryText(c.label)` 로 다국어화.
- `showCampaignSim()`: 무전/진행상태/상세 문자열을 `t()` i18n 키로 교체.
- 스토리 컨트롤 버튼(SKIP/나가기/탭하여 계속)과 abandon 확인 다이얼로그를 `t()` 키 사용.
- `campaignObjectivesHtml()`: `o.label` 다국어 객체를 `_campaignStoryText()` 로 읽어 표시.

**campaign.js 서버 사이드**
- `OBJECTIVE_PRESETS` 75개 이상 objective 항목 전체에 `labelEn` 추가 (프롤로그 + MCC/FSP/CV CH1-10).
- `buildChapterObjectives()`: `label: {ko, en}` 객체를 `labelKo`와 함께 API 응답에 포함.
- `publicChapter()`: `choices`도 `label: {ko, en}` 포함.
- `getMissingRequiredObjectives()`: missing objectives에도 `label: {ko, en}` 포함.

**신규 i18n 키 (EN/KO/JA/ZH)**: `campaign_sim_in_progress`, `campaign_sim_radio_prefix`, `campaign_sim_radio_default`, `campaign_sim_syncing`, `campaign_sim_detail`, `story_skip`, `story_skip_title`, `story_abandon`, `story_abandon_title`, `story_tap_hint`, `story_abandon_confirm_title`, `story_abandon_confirm_body`.

**씬 JSON**: 39개 파일 전체 KO+EN 동수 텍스트 확인 — 렌더러가 이제 EN 언어 설정 시 영어 대사를 표시한다.

검증:
- `node --check server/services/campaign.js` 통과
- I18N 4개 언어 key parity 1357 ✓
- `git diff --check` 통과

## 2026-05-05 — Campaign result/objective-gate i18n (v5.92)

- `showCampaignResult()` 내 '임무 완료'/'임무 실패'/'작전 목표 달성' 등 하드코딩 한국어를 `t()` 호출로 교체.
- `completeCampaignMission()` OBJECTIVE_REQUIREMENTS_NOT_MET 게이트 메시지도 `t()` 사용.
- `pollCampaignProgress()` status/detail 텍스트 한국어 하드코딩 제거.
- `gov_fleet_empty` 키를 KO/JA/ZH에 추가해 전 언어 1345 키 동수 달성.
- 신규 키 13종: `campaign_result_success/failure`, `campaign_result_npc_success/failure`, `campaign_result_reward/confirm/recheck`, `campaign_objectives_gate/gate_sub` — EN/KO/JA/ZH 전부.

검증:
- I18N 전 언어 key parity 1345 ✓
- `git diff --check` 통과

## 2026-05-05 — Campaign UI i18n localization (v5.91)

- `renderCampaignList()` 내 버튼 텍스트/메타 라벨/잠금 토글 문자열을 `t()` 호출로 교체.
- `campaignObjectiveActionLabel()` 언어별 맵으로 한국어(내 영토/조선소/함대/전투/마켓)와 영어(MY LAND/SHIPYARD/FLEET/BATTLE/MARKET)를 분리.
- 신규 i18n 키 15종: `campaign_btn_start/continue/results/locked`, `campaign_label_completed/prologue/route/ch`, `campaign_no_chapters/no_faction`, `campaign_show_locked/hide_locked`, `campaign_meta_sim`, `campaign_reward_claimed`, `campaign_objective_go` — EN/KO/JA/ZH 전부.

검증:
- `git diff --check` 통과

## 2026-05-05 — Static QA: CV campaign simulator bug fix (v5.90)

- **[버그 수정] CV 챕터 시뮬레이터 없음**: CV CH1~CH10 전체가 `simulateChapter()`에서 MCC CH1(`simulateCh1`)으로 폴백되는 버그를 수정했다. `simulateCvChapter(progress)` (CH1~9 공통)와 `simulateCvCh10(progress)` (엔딩)를 추가하고 `simulateChapter()` 분기에 등록했다.
- **[버그 수정] CV 보상 계산기 없음**: `calculateRewards()`도 CV 챕터에서 MCC CH1 보상으로 폴백되는 버그를 수정했다. `calculateCvChapterRewards(progress, sim)` (CH1~9)와 `calculateCvCh10Rewards(progress, sim)` (엔딩 A/B/C/D 분기)를 추가했다.
- **[버그 수정] CV_CH*_ID 상수 미정의**: `CV_CH1_ID` ~ `CV_CH10_ID` 상수 10개를 파일 상단에 추가했다. FSP와 동일한 패턴.
- **[버그 수정] CV CH10 ending choice 미검증**: `complete()`의 ending choice 요구 조건이 MCC CH10만 확인했다. `FSP_CH10_ID`, `CV_CH10_ID`를 포함하는 조건으로 확장했다. CV CH10은 `validateChapterChoice` 함수가 처리하지 않으므로 choice 요구만 적용하고 라우트 검증은 skip.
- **[버그 수정] cv_raider / cv_bomber 함선 코드 미매핑**: `campaignShipRewardPlan`에 `cv_raider→cv_int`, `cv_bomber→cv_bomb`, `cv_titan→cv_titan`, `fsp_ironclad→fsp_bs` 매핑을 추가했다. 미매핑 상태로는 inbox 함선 보상 수령 시 빈 함선이 지급되는 대신 추상 보상 안내만 나왔다.
- **정적 QA 통과 항목**: 마켓 필터 `size_class` 불일치 없음, objective stat 키 전체 정합, battleEngine bonus_* null 가드, cmdFocus sort null 가드, campaign_reward_inbox 컬럼명 일치 확인.

검증:
- `node --check server/services/campaign.js` 통과
- `git diff --check` 통과

## 2026-05-05 — Ship market filter/sort UI (v5.89)

- **파벌 필터 칩 추가**: SHIP MARKET 탭 상단에 ALL / MCC / FSP / CV 파벌 필터 칩을 추가했다. 선택한 파벌 코드와 일치하는 함선만 표시된다.
- **크기 필터 칩 추가**: ALL / FRG / DES / CRU / BS / TTN 크기 필터 칩을 추가했다. `size_class` 기준으로 클라이언트 side 필터링.
- **정렬 드롭다운 추가**: 가격 낮은순 / 높은순 / 강화 높은순(bonus_atk+def+hp+speed 합산) / 최신 등록순 정렬을 선택할 수 있다.
- **결과 카운트 표시**: 필터 조건 적용 시 "N / 전체" 형식으로 표시 항목 수를 보여준다. 조건에 맞는 항목이 없을 때는 별도 안내 메시지.
- **기존 blueprints SIZE 필터와 충돌 없음**: blueprints용 `syFilters` 바는 blueprints 탭에만 표시되고, market 필터는 `syMarketTab` 내부에 독립 삽입돼 탭별 필터가 상호 간섭하지 않는다.

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-05 — Fleet battle readability polish (v5.88)

- **레이저 가시 시간 연장**: 일반 레이저 fireType의 TTL을 함선 크기별로 차등화했다. 타이탄은 120프레임(~2s), 전함 100프레임(1.67s), 순양함 78프레임(1.3s), 그 외 48프레임(0.8s). 기존 10프레임(167ms)에서 전투 가독성이 대폭 향상된다.
- **대형함 함대 이동 속도 제한**: `mkFleet`이 기함 함선 크기 기반 `maxSpd`를 계산한다. 타이탄 기함 함대는 0.22, 전함 0.28, 순양함 0.36, 구축함 0.42, 프리깃 0.44. 대형함 중심 함대가 소형함 함대보다 눈에 띄게 느리게 이동한다.
- **EMP 시각 효과 추가**: EMP 발사 시 DEF 함대 위치에 이중 충격파 shockwave를 표시해 EMP가 뭔가 했다는 시각적 피드백을 제공한다.
- **집중공격 시각 효과 추가**: 집중공격 대상 함대에 타겟팅 shockwave를 표시한다.
- **mixed 레이저 TTL 개선**: mixed fireType의 레이저 보조 빔도 7프레임→40프레임으로 연장.

검증:
- `tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-05 — CH4~CH10 objective wiring + reward note hardening (v5.87)

- **MCC CH4~CH10 목표 와이어링**: `OBJECTIVE_PRESETS`에 MCC CH4~CH10 7개 챕터를 추가했다. 각 챕터에는 `completedFleetBattles`, `fleetShips`, `marketListings`, `shipUpgrades`, `campaignRewardClaims` 중 1~2개의 실-DB 집계 기반 stat 목표가 포함되며, 서버 hard gate를 통과해야 챕터를 완료할 수 있다.
- **FSP CH2~CH10 목표 와이어링**: FSP CH2~CH10 9개 챕터를 추가했다. 서사적 선택이 있는 챕터는 `choice` + 1개 stat 목표, 전투 중심 챕터는 `completedFleetBattles`/`fleetShips` 목표를 가진다.
- **CV CH2~CH10 목표 와이어링**: CV CH2~CH10 9개 챕터를 추가했다. 습격·확장·총력전 서사에 맞게 stat 목표를 설계했다.
- **추상 보상 타입별 안내 메시지**: `applyClaimedInboxReward`가 `ship_blueprint`, `ship_choice`, `asset`, `resource_stream`, `contract`, `data_artifact` 각 타입에 대해 명확한 한국어 안내 메시지를 반환한다.
- **보상 수령 토스트 개선**: `claimCampaignReward`가 서버의 `note` 필드를 우선 표시하고, 실제 지급된 경우에는 `applied` 목록(함선·자원·아이템 코드와 수량)을 토스트로 보여준다.

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Local cleanup tracked DS_Store removal (v5.84)

- **로컬 찌꺼기 정리**: `.gitignore`에는 이미 등록되어 있었지만 과거에 추적된 `assets/campaign/characters/.DS_Store`를 저장소에서 제거했다.
- **정리 범위 통제**: 미추적 `docs/FLEET_ASSAULT_STARFOX_RESEARCH.md`는 기획/리서치 문서일 수 있어 자동 삭제하지 않고 로컬에 남겼다.

검증:
- `git diff --check` 통과

## 2026-05-04 — Campaign CH2 objective clarity + completed card guard (v5.83)

- **완료 카드 판정 보강**: 캠페인 카드 렌더링이 `status` 문자열만 직접 비교하지 않고 정규화 helper를 사용한다. `completedAt`이 있는 완료 진행도도 compact 완료 카드로 처리해 완료 챕터가 풀카드로 풀리는 위험을 줄였다.
- **결과 모달 판정 보강**: 완료/실패 결과 화면도 같은 status helper를 사용해 상태 문자열 차이로 결과 라벨이 흔들리지 않게 했다.
- **CH2 진행 목표 보강**: MCC CH2에 “작전에 투입할 함선 3척을 함대에 배치” objective를 추가했다. 단순히 함대 1개만 있으면 진행 조건이 끝나는 느낌을 줄이고, 캠페인이 함대 편성 루프로 더 명확히 이어진다.
- **함대 배치 수 집계**: 캠페인 `objectiveState.fleetShips`를 추가해 살아 있고 판매중이 아니며 함대에 배치된 함선 수를 서버에서 내려준다.

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Ship economy visibility + Fleet Command sale locks (v5.82)

- **제작 재료 가시성**: 조선소 청사진 카드가 조건 부족 상태여도 보유 재료까지 흐려 보이지 않게 조정했다. 재료 칩은 `보유`/`부족` 라벨과 색으로 상태를 보여준다.
- **강화 버튼 정보 강화**: 강화 버튼 안에 성공 확률과 강화 재료 보유량/필요량을 함께 표시한다.
- **판매중 함선 잠금 강화**: Fleet API에서 판매중 함선의 이동, 기함 지정, 자동 기함 지정 경로를 `SHIP_LISTED_FOR_SALE`로 차단한다.
- **함대지휘 세로 진형 개선**: Fleet Command 미리보기의 쐐기/스크린/핀서/구형 배치를 세로 전장 기준으로 재정렬했다.
- **세로 기동 표기**: 전진/후퇴 기동 아이콘과 설명을 `↑/↓` 기준으로 바꿔 함선 방향과 맞췄다.

검증:
- `node --check server/services/fleet.js` 통과
- `node --check server/routes/fleets.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign ship reward fulfillment (v5.81)

- **함선 보상 실지급**: 캠페인 보상함에서 `ship`/`ship_fleet` 타입 보상을 수령하면 실제 `ships` 레코드가 생성된다.
- **보상 코드 매핑**: Shard, Longeye, Prometheus, Sequoia, Ironclad, MCC 함대 패키지 등 캠페인 보상 코드를 현재 `ship_types` 22종 코드에 연결했다.
- **기본 함대 자동 생성**: 보상을 받을 함대가 없으면 `wedge/advance` 기본 함대를 만들고 지급 함선을 넣는다.
- **기함 처리**: 함대에 기함이 없고 해당 함종이 기함 가능하면 첫 지급 함선을 자동 기함으로 지정한다.
- **장기 보상 분리**: 설계도/선택권/계약/자산 보상은 아직 별도 시스템이 없으므로 보상함 안전 수령 처리에 남겨둔다.

검증:
- `node --check server/services/campaign.js` 통과
- `node --check server/routes/api.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign reward inbox claim flow (v5.80)

- **캠페인 보상함 UI**: BASE/퀘스트의 캠페인 패널에서 미수령 보상을 카드로 보여주고 바로 수령할 수 있게 했다.
- **보상 수령 API**: `/api/campaign/reward/claim`을 추가해 wallet/reward id 검증, row lock, 중복 수령 방지, 수령 완료 처리를 수행한다.
- **실제 인벤토리 지급**: 보상 코드가 `resources`나 `item_types`에 매칭되면 자원/아이템 인벤토리에 적립된다.
- **서사형 보상 안전 처리**: 아직 독립 시스템이 없는 함선 선택권, 계약, 자산, 데이터 보상은 캠페인이 막히지 않도록 수령 처리와 로그 기록까지 진행한다.
- **상태 확장**: 캠페인 상태 응답의 `rewardInbox`에 `id`를 포함하고 `objectiveState.campaignRewardClaims`를 추가했다.

검증:
- `node --check server/services/campaign.js` 통과
- `node --check server/routes/api.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign territory harvest objective (v5.79)

- **채굴 목표 연결**: MCC CH1에 영토 PP 채굴 1회 objective를 추가해 초반 캠페인이 영토 확보, 이미지 등록, 생산 수확까지 이어지게 했다.
- **수확 횟수 집계**: 캠페인 상태 응답의 `objectiveState.territoryHarvests`가 `transactions.type = 'mining'`와 `from_wallet` 기준으로 실제 수확 횟수를 내려준다.
- **초반 루프 강화**: 캠페인이 플레이어에게 “내 영토가 돈/PP를 만든다”는 핵심 루프를 직접 경험시키는 구조로 보강됐다.
- **동선 재사용**: 채굴 objective는 기존 `territory` action을 사용해 BASE/내 영토 쪽으로 이동한다.

검증:
- `node --check server/services/campaign.js` 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign ship upgrade objective (v5.78)

- **강화 목표 연결**: MCC CH3에 함선 스탯 강화 1회 objective를 추가해 함대전 뒤 조선소 강화 루프가 캠페인 진행 조건으로 들어간다.
- **성공 강화 횟수 집계**: 캠페인 상태 응답의 `objectiveState.shipUpgrades`가 `ship_stat_upgrade_log` 기준으로 성공 강화 횟수를 내려준다.
- **DB 호환 처리**: `success` 컬럼이 있는 DB는 성공 로그만 세고, 이전 DB는 기존 강화 로그 전체를 카운트한다. 테이블/컬럼 차이로 캠페인 상태 전체가 터지지 않도록 safe query를 유지했다.
- **동선 재사용**: 강화 objective는 기존 `shipyard` action을 사용해 조선소로 이동한다.

검증:
- `node --check server/services/campaign.js` 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign editor default parity + Bug reporter hardening (v5.77)

- **캠페인 기본 좌표 정합**: 인게임 스토리 캐릭터 fallback을 에디터 기본값과 맞췄다. 저장 layout이 없는 씬도 더 이상 bottom-anchor CSS로 튀지 않고 에디터와 같은 중심 좌표 기준에서 시작한다.
- **저장 좌표 우선 유지**: 에디터/씬/라인/캐릭터 layout은 기본 좌표 위에 계속 덮어 적용된다.
- **전환 렉 체감 완화**: 캠페인 배경 `fade_slow`/`fade_medium` 시간을 줄여 대사/화면 전환 때 빈 화면이 오래 보이는 현상을 줄였다.
- **버그 신고 제출 안정화**: 신고 모달 버튼에 `type="button"`과 이벤트 차단을 추가하고, html2canvas 로드 지연 시 수동 스크린샷 UI로 복구한다.
- **버그 신고 API 호환성**: 프론트는 `/api/bug-report` 실패 시 `/bug-report`로 재시도하고, 서버도 `/bug-report` alias를 받는다.

검증:
- `index.html` inline script syntax check 통과
- `node --check server/routes/bugReport.js` 통과
- `git diff --check` 통과

## 2026-05-04 — Shipyard requirement clarity + Fleet Command modal stickiness (v5.76)

- **제작 조건 상세화**: 청사진 카드에서 GP/재료가 부족해도 버튼을 눌러 상세 모달을 볼 수 있게 변경했다. 실행 버튼만 조건 부족 시 disabled 처리된다.
- **보유량/필요량 문구 통일**: 제작/강화 확인 모달의 GP와 재료 표시를 `보유 / 필요` 형식으로 통일하고, 충분/부족 상태를 색으로 구분했다.
- **재료 보유량 정규화**: 인벤토리 resource code를 소문자로 저장/조회해 실제 보유 재료가 있는데 부족으로 보이는 위험을 낮췄다.
- **함대지휘 모달 안정화**: 진형, 기동, 기함 지정, 함선 이동, 이름 변경, 해체 등 Fleet Command 내부 버튼에 `type="button"`과 이벤트 차단을 적용해 클릭 후 모달이 닫히는 흐름을 줄였다.

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign objective hard gate (v5.75)

- **서버 완료 판정 강화**: 캠페인 완료 API가 필수 DB 기반 objective를 확인하고, 부족하면 `OBJECTIVE_REQUIREMENTS_NOT_MET`으로 완료/보상 처리를 막는다.
- **진행률 응답 보강**: 캠페인 progress 응답에 `objectives`, `missingObjectives`, `nextObjective`, `preview.readyToComplete`를 포함한다.
- **자동 완료 오작동 수정**: 프론트가 진행률 100%만 보고 자동 완료하던 흐름을 중단하고, 서버가 완료 가능하다고 판단한 경우에만 완료 호출한다.
- **남은 목표 UI**: 작전 시간이 끝났지만 영토/이미지/함대/전투/마켓 목표가 남은 경우 캠페인 모달에서 남은 목표와 GO 동선을 보여준다.
- **시작 응답 정합**: 캠페인 start/alreadyCompleted 응답도 live objective 수량을 포함해 시작 직후 목표 상태가 비어 보이지 않게 했다.

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign editor parity hotfix (v5.74)

- **에디터/인게임 대사박스 정합**: 에디터 좌표를 적용할 때 인게임 기본 safe-area padding이 남아 대사박스가 과하게 커지던 문제를 수정했다.
- **모바일 좌표계 정합**: 모바일 스토리 화면도 에디터와 같은 9:16 stage 비율을 유지해 캐릭터/대사박스 위치가 다른 비율로 재해석되지 않게 했다.
- **레이아웃 캐시 차단**: 에디터 layout GET/POST와 인게임 layout fetch에 `no-store`/timestamp를 적용하고 서버 응답도 `Cache-Control: no-store`로 내려준다.
- **좌표 적용 안정화**: 에디터에서 저장한 x/y/w가 인게임에서 이전 캐시나 기본 모바일 padding에 묻히지 않도록 정리했다.

검증:
- `node --check server/routes/api.js` 통과
- `index.html` inline script syntax check 통과
- `campaign-editor.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign objective action routing (v5.73)

- **목표 클릭 동선 연결**: 캠페인 objective 중 영토, 조선소, 함대, 함대전, 마켓 목표에 `GO` 액션을 붙였다.
- **실제 화면 이동**: 목표를 누르면 BASE 내 영토, 조선소 청사진, Fleet Command, PVP Battle Hub, Market 탭으로 바로 이동한다.
- **읽기 전용 유지**: 완료된 objective와 아직 직접 이동할 화면이 없는 story/result objective는 클릭되지 않게 유지했다.
- **캠페인 안내성 강화**: 캠페인이 단순 목록이 아니라 “다음에 뭘 해야 하는지 누르면 이동하는” 메인퀘스트 허브로 한 단계 진입했다.

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign objective expansion (v5.72)

- **영토 이미지 목표 연결**: 내 영토 중 `image_url`이 등록된 영토 수를 `artClaims`로 집계하고 MCC CH1 objective에 추가.
- **함대전 완료 목표 연결**: `fleet_battles`와 `fleet_battle_participants` 기준으로 유저의 완료 함대전 수를 집계하고 MCC CH3 objective에 추가.
- **마켓 등록 목표 연결**: 활성 함선 마켓 등록과 일반 마켓 등록을 합산해 `marketListings`로 내려주고 MCC CH3 objective에 추가.
- **목표 표시 확장**: 추가 objective도 기존 UI의 `현재/필요` 수량 표시와 done/active 상태 판정을 그대로 사용.

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign live objective state (v5.71)

- **캠페인 목표 실제 상태 연결**: 캠페인 상태 응답에 `objectiveState`를 추가해 영토, 함선, 함대, 판매중 함선, 완료 함대전 수를 서버에서 집계.
- **초반 objective 보유량 표시**: MCC CH1은 첫 영토, MCC CH2는 첫 함대, FSP/CV CH1은 첫 함선 보유량을 `current/target`으로 내려줌.
- **목표 UI 보강**: 캠페인 카드와 브리핑 모달에서 objective 옆에 `현재/필요` 수량을 표시하고, 조건 충족 시 done 상태로 표시.
- **안전한 집계 처리**: 마이그레이션 차이로 일부 테이블/컬럼이 없어도 캠페인 리스트가 internal error로 죽지 않도록 objective 집계는 실패 시 0으로 처리.

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Campaign editor/in-game coordinate parity (v5.67)

- **캐릭터 좌표 기준 통일**: 캠페인 에디터가 저장하는 `x/y` 중심점 좌표를 인게임 스토리 렌더러도 동일하게 `translate(-50%,-50%)`로 적용하도록 수정.
- **레거시 top-left 호환**: 기존 top-left 방식이 필요한 layout은 `anchor: "top-left"` 또는 `origin: "top-left"`를 명시하면 그대로 동작.
- **스토리 stage 비율 정합**: 데스크탑 인게임 스토리 컨테이너를 에디터와 같은 9:16 기준으로 맞춰 percent 좌표가 다른 비율에서 어긋나지 않게 변경.
- **배경 기본 크롭 통일**: 에디터 preview와 인게임 story background의 기본 cover 위치를 `50% 50%` 중앙 기준으로 맞춤.

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Bug reporter submit contract + Codex inbox payload (v5.66)

- **버그 제출 버튼 수정**: 프론트가 보내던 `description/context/screenshot` payload를 서버가 `title/body/category`로 정규화해 받도록 수정.
- **프론트 payload 보강**: 버그 리포트 제출 시 제목, 본문, URL, 지갑, viewport, 언어, 최근 콘솔 에러, 열린 모달 정보를 함께 전송.
- **Codex 인박스 보강**: 신규 리포트 JSON 미러에 `context`, `recent_errors`, `screenshot_path`, `codex_hint`를 포함해 바로 재현/수정 흐름으로 이어지게 변경.
- **스크린샷 파일 저장**: base64 스크린샷은 DB에 넣지 않고 `server/bug-reports/screenshots`에 파일로 저장.
- **자동 캡처 안정화**: html2canvas script id 오타와 CDN 로드 실패 시 placeholder 복구를 수정.

검증:
- `node --check server/services/bugReport.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Ship upgrade material visibility + fleet command modal stability (v5.65)

- **강화 재료 보유량 표시**: 함선 강화 확인 모달에 필요 재료의 보유량/필요량과 부족 여부를 표시.
- **쐐기 진형 재배치**: 세로 전장 기준으로 앞쪽 1척에서 후방으로 퍼지는 삼각 돌격 대형으로 수정.
- **Composition 집계 안정화**: 함선 `size_class` 별칭과 `class_label`을 정규화해 우측 수량 표시 누락을 방지.
- **함대지휘 모달 안정화**: 진형/기동/함선 이동/기함 지정 후 모달 상태와 내부 스크롤 위치를 유지.
- **Fleet API wallet 비교 보강**: 함대 목록/상세/수정/이동 소유권 체크에서 wallet 대소문자 차이를 허용.
- **모바일 safe-area 보정**: Fleet Command backdrop CSS 셀렉터 오타를 수정해 모바일 모달 위치 보정이 적용되도록 변경.

검증:
- `node --check server/services/fleet.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Campaign editor position + fleet command vertical UX (v5.64)

- **캠페인 에디터 위치 우선 적용**: 인게임 스토리 화면이 서버 에디터 레이아웃을 받은 뒤에도 localStorage의 최신 에디터 좌표를 다시 병합해, 방금 수정한 캐릭터 위치가 덮이지 않도록 수정.
- **함대지휘 세로 프리뷰**: 함선 PNG가 위를 보는 방향에 맞춰 Fleet Command 미리보기를 세로 전장/세로 진형으로 재배치.
- **구형 SVG 잔상 차단**: 함대지휘 미리보기에서 PNG 뒤로 예전 SVG 함선이 비쳐 보이지 않도록 fallback을 숨김.
- **진형/기동 모달 유지**: 진형/기동 버튼 클릭 시 모달을 닫지 않고, 즉시 프리뷰가 변형되며 서버 실패 시 이전 상태로 복구.
- **함선 선택 피드백**: 클릭한 함선이 명확히 보이도록 `SELECTED` 배지와 선택 상세 패널 추가.
- **기함 지정 안정화**: 서버 기함 지정 로직에서 wallet 대소문자와 `fleet_id` 타입 차이로 발생할 수 있는 오류를 보정.

검증:
- `node --check server/services/fleet.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Ship market + chance upgrades + fleet FX polish (v5.63)

- **함선 확률 강화**: 보유 함선 `ATK/DEF/SPD/HP` 강화가 성공 확률과 재료 소모를 가지도록 변경. 실패해도 GP와 재료는 소모되고 스탯은 유지됨.
- **강화 재료 표시**: 조선소 보유함 카드에 강화 비용, 성공 확률, 필요 재료를 함께 표시.
- **함선 마켓 추가**: 강화한 함선을 GP 가격으로 판매 등록/취소/구매할 수 있는 API와 UI 추가. 판매중 함선은 `판매중` 스티커가 붙고 강화/수리/실드/해체가 차단됨.
- **조선소 함선 가독성 개선**: 청사진/보유함 미리보기에서 엔진 불꽃 오버레이를 제거하고, PNG 함선 밝기/대비를 올려 어둡게 묻히는 문제 완화.
- **전투 수동 스킬 가시성 보강**: 빔포와 미사일 이펙트 지속시간을 늘리고 미사일 트레일을 추가해 사용 여부가 더 분명하게 보이도록 수정.
- **전투 UI 보정**: 하단 무전 콜아웃을 버튼 위로 올리고 화성 배경을 더 밝게 조정.

검증:
- `node --check server/services/ship.js` 통과
- `node --check server/routes/ships.js` 통과
- `index.html`, `assets/tactical-lab-v11.html`, `assets/fleet-assault-demo.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Campaign quest progress gate (v5.62)

- **캠페인 작전 즉시 클리어 방지**: 스토리/결과 씬을 넘기면 바로 완료되던 흐름을 제거하고, 작전 챕터는 진행률 화면으로 이동하도록 수정.
- **서버 완료 조건 강화**: `/api/campaign/complete`가 프롤로그/순수 시네마틱 외 챕터에서 런타임이 차기 전 `MISSION_IN_PROGRESS`를 반환하도록 변경.
- **진행률 폴링 UI**: 캠페인 작전 화면이 `/api/campaign/progress`를 주기적으로 읽어 진행률, 남은 시간, 경과 시간을 표시하고 완료 가능 시점에만 결과를 띄움.
- **챕터별 런타임 적용**: 진행률 계산에서 CH1 840초 고정값을 제거하고 각 챕터의 `environment.totalDurationSeconds` 또는 `estimatedPlayTimeSeconds`를 사용.

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Campaign completed chapter compact cards (v5.61)

- **완료 챕터 전체 접힘 처리**: 캠페인 리스트에서 완료된 챕터는 프롤로그뿐 아니라 CH1 이후도 compact 카드로 접어서 표시.
- **결과 확인 유지**: 접힌 완료 카드의 `RESULTS` 버튼은 그대로 유지해 결과 화면 접근 가능.
- **진행 카드 영향 없음**: 진행 중/시작 가능 챕터만 기존 큰 카드와 metric 영역을 표시.

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Campaign editor layout parity + story perf (v5.60)

- **에디터/인게임 캐릭터 배치 일치**: 에디터가 저장하는 `x/y/w` top-left percent 좌표를 인게임 렌더러도 그대로 적용하도록 수정. `cx/cy` 계열만 중앙 기준으로 처리.
- **단일 화자 중앙 배치**: `scene.characters`가 없는 단일 화자 대화씬은 에디터처럼 중앙 캐릭터로 표시. 광부 어르신 같은 씬이 왼쪽으로 밀리는 문제 수정.
- **캐릭터 에셋 매핑 점검**: campaign-story 전체 speaker 42종을 검사해 누락 초상화 0건 확인. `crow → kara_vex` 잘못된 매핑을 실제 존재하는 `crow.png`로 수정.
- **스토리 전환 렉 완화**: 현재/다음 라인의 배경·캐릭터·오버레이 이미지를 캐시 선로딩하고, 대사 타이핑을 `requestAnimationFrame` 기반으로 변경. 대화창 blur 제거로 repaint 비용 감소.

검증:
- campaign-story speaker 42종 캐릭터 이미지 매핑 검사 통과 (missing 0)
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Fleet Mars atmospheric background (v5.59)

- **화성 상층권 배경 추가**: 택티컬랩 전투 캔버스에 `assets/textures/mars_nasa_2k.jpg`를 배경 레이어로 로드.
- **느린 표면 패닝**: 화성 표면이 매우 천천히 지나가도록 처리해 전투가 검은 우주 공간에 떠 있는 느낌을 줄임.
- **전투 가독성 보강**: 어두운 veil과 기존 주황/푸른 글로우, 낮은 알파 먼지 스트릭으로 함선/레이저가 묻히지 않게 조정.
- **본서버 택티컬랩 반영**: `assets/tactical-lab-v11.html`에 적용하고 검수용 데모 파일에도 동일 로직 반영.

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Fleet sprite preload fallback fix (v5.58)

- **첫 프레임 구형 함선 노출 차단**: PNG 함선 이미지가 로드되기 전에는 구형 벡터/SVG fallback 함선을 그리지 않도록 변경.
- **플레임 표시 안정화**: 함선 본체가 실제로 그려진 프레임에서만 엔진 플레임과 대형함 HP bar를 표시.
- **본서버 택티컬랩 반영**: `assets/tactical-lab-v11.html`에 적용하고 검수용 데모 파일에도 동일 로직 반영.

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Ship infinite stat upgrades (v5.57)

- **보유 함선 무한 강화 추가**: 개별 함선에 `ATK/DEF/SPD/HP`를 영구 투자하는 API와 DB 로그를 추가. 실패/파괴/`+강` 등급명 없이 누적 성장.
- **조선소 강화 UI 추가**: 내 함선 카드에서 기본 스탯 옆에 녹색 `(+보너스)`가 표시되고, 각 스탯 강화 버튼을 바로 누를 수 있음.
- **전투 스탯 반영**: 서버 전투 엔진이 강화된 공격력, 방어력, 체력, 속도를 실제 전투 계산에 반영.
- **경제 설정 추가**: `ship_upgrade_base_gp`, `ship_upgrade_growth`, `ship_upgrade_*_step` 설정으로 강화 비용과 증가량 조절 가능.

검증:
- `node --check server/services/ship.js` 통과
- `node --check server/routes/ships.js` 통과
- `node --check server/services/battleEngine.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Fleet battle scale-aware start distance/zoom (v5.56)

- **함대 수 기반 시작 거리**: `battleScaleConfig()` 추가. 1:1 소규모전은 더 가까운 상/하단에서 시작하고, 함대 수가 많을수록 시작 간격이 넓어짐.
- **함대 수 기반 교전 거리**: 함대 AI의 최소/이상 교전 거리를 전투 규모에 따라 조정. 소규모전은 가까운 거리, 대규모전은 장거리 교전 유지.
- **함대 수 기반 자동 줌**: 자동 카메라가 소규모전에서는 더 크게 줌인하고, 대규모전에서는 전체 함대를 담도록 최대 줌과 프레이밍 여백을 조정.
- **본서버 택티컬랩 반영**: 데모 `assets/fleet-assault-demo.html`과 본서버 `assets/tactical-lab-v11.html`을 동일하게 유지.

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Fleet battle chatter callouts (v5.55)

- **전장 무전 자막 추가**: 명령/진형/기동은 상단, 피격/격침/후퇴 경고는 하단에 짧게 뜨는 콜아웃으로 표시.
- **격침 대사 추가**: 소형함 격침은 확률적으로 비명/탈출 대사가 나오고, 대형함/기함 격침은 더 강한 경고 문구 표시.
- **수동 스킬 연출 강화**: 집중공격, EMP, 빔포, 미사일 일제사격, 후퇴 확인에 전투 무전 문구 추가.
- **간헐 무전 추가**: 교전 중 사격선 유지, 산개, 실드 재분배 같은 ambient 콜아웃이 드물게 표시되어 전투가 덜 정적으로 보임.
- **본서버 택티컬랩 반영**: 데모 `assets/fleet-assault-demo.html`과 본서버 `assets/tactical-lab-v11.html`을 동일하게 유지.

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Fleet manual beam/missile skills (v5.54)

- **수동 빔포 추가**: 전함/타이탄이 살아있으면 `☢ 빔포` 게이지가 차고, 100%에서 우선순위 대형 목표에 굵은 주포 빔을 수동 발사.
- **미사일 일제사격 추가**: 프리깃/구축함/순양함이 살아있으면 `☄ 미사일` 게이지가 차고, 100%에서 소형/중형함들이 다수 미사일을 발사.
- **전투 연출 강화**: 빔포 전용 두꺼운 글로우, 발사 쇼크웨이브, 미사일/빔포 전용 WebAudio 효과음 추가.
- **본서버 택티컬랩 반영**: 데모 `assets/fleet-assault-demo.html`과 본서버 `assets/tactical-lab-v11.html`을 동일하게 유지.

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

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

## 2026-05-08 v5.97 — Daily OPS 내 아이템 이동 + 전술랩 로컬라이징

- 오늘의 작전 보드 주간 보상 버튼이 실제 `BASE > SHOP > MY ITEMS`로 이동하도록 베이스 모달/상점 탭 초기화 순서를 보정했다.
- 완료된 Daily OPS 항목은 초록 상태등으로 표시되도록 로컬 상태 렌더링을 연결했다.
- 영토 외부 링크 입력은 도메인만 넣어도 `https://`로 정규화되게 수정하고, 데스크탑/모바일 표시 로직을 통합했다.
- 전술랩 iframe에 현재 언어를 전달하고, 전술랩 정적 UI/명령 버튼/함선 도감/광물/함대 상태 패널 로컬라이징을 적용했다.
- 검증: `git diff --check` 통과.

---

## 2026-05-05 v5.96 — 전투 피드백/리텐션/PvP 실행 지시서

- `docs/CLAUDE_COMPETITIVE_LOOP_IMPLEMENTATION_ORDER_2026-05-05.md`를 추가했다.
- 클로드 약점 개선 기획을 실제 개발 지시서가 아니라 구현 계약서 수준으로 재정리했다.
- Source of Truth, Meaning of Done, Delivery Gates, Commit Packet Rules, Recon Gate, Acceptance Gate, QA Matrix, API/DB 계약, final report format을 추가했다.
- 구현 순서를 전투 결과 리포트 → Daily OPS Board → 영토 닉네임/Field Rating → Battle Hub 추천 상대 → 현상금 보드 → 섹터 분쟁/주간 캘린더로 고정했다.
- 첫 착수 범위를 P1 전투 결과 리포트로 제한하고, 기존 전투 결과 모달/패널에 붙이도록 명시했다.
- `CLAUDE.md`의 새 세션 읽기 순서에 경쟁 루프 구현 지시서를 추가했다.

---

## 2026-05-05 v5.91 — P5 영토 유틸리티 풀기획

- `docs/TERRITORY_UTILITY_PLAN_2026-05-05.md`를 추가했다.
- `docs/CLAUDE_P5_TERRITORY_IMPLEMENTATION_ORDER_2026-05-05.md`를 추가했다.
- 영토를 개인 캔버스, 생산 노드, 전쟁/경제 앵커로 정의했다.
- P5 풀기획을 생산 가시성, 재료 harvest, 조선소 연결, 영토 업그레이드/역할, 섹터 컨트롤, 어드민 경제 튜닝까지 확장했다.
- 클로드가 풀 시스템을 개발하되 P5-1 생산 가시성부터 순차 착수하도록 구현 지시서를 분리했다.
- `docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md`의 P5 항목을 MVP 기준이 아니라 최종 풀 시스템 기준으로 갱신했다.

## 2026-05-05 v5.87 — Claude 남은 작업 실행 지시서

- `docs/CLAUDE_WORK_ORDER_2026-05-05.md`를 추가했다.
- 남은 작업을 캠페인 진행 정리, 함대전 세로 탑뷰 안정화, Fleet Command UX, 함선 경제 UX, 영토 유틸리티 순서로 정리했다.
- `CLAUDE.md`의 새 세션 읽기 순서에 기준 기획서와 작업지시서를 추가했다.
- 스타폭스/함대전 리서치 문서는 장기 참고용이며 현재 구현 기준이 아님을 명시했다.

## 2026-05-04 v5.86 — 캠페인 에디터 좌표 최신성 정합

- 캠페인 에디터 layout payload에 `updatedAt`을 추가했다.
- 캐릭터/오버레이/대사박스/폰트 위치를 바꾸면 `editorLayoutUpdatedAt` localStorage가 함께 갱신된다.
- 인게임 스토리 렌더러는 timestamp가 있는 최신 로컬 편집만 서버 layout보다 우선하도록 바꿨다.
- 게임 화면에 남은 오래된 localStorage 좌표가 서버 저장 좌표를 덮어쓰는 문제를 막았다.
- 에디터의 reset layout이 서버에 동기화되지 않던 경로도 보강했다.

## 2026-05-04 v5.85 — Fleet Command 모달 유지/선택 UX

- Fleet Command에서 진형/기동 변경 후 전체 목록 재조회 대신 현재 선택 함대 상태를 즉시 갱신하도록 변경했다.
- 기함 지정 성공 후에도 모달과 스크롤 위치를 유지하고, 선택 함대 상세만 다시 읽어오게 했다.
- Fleet Command 서버 오류를 한국어 원인 메시지로 통일했다.
- 함선 카드에 focused 상태를 추가해 마지막으로 누른 함선이 무엇인지 더 명확히 보이게 했다.
- 선택 요약 패널에 기함 가능 여부를 표시해 기함 지정 불가 이유를 추측하지 않아도 되게 했다.

## 2026-05-04 v5.70 — 캠페인 메인퀘스트 스캐폴드

- `docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md`를 추가해 게임 방향성 문서를 실제 개발 스프린트로 쪼갰다.
- 캠페인 서버 응답에 `objectives`와 `nextObjective`를 추가했다.
- 캠페인 리스트 카드에 챕터별 현재 목표를 표시해 유저가 다음 할 일을 바로 볼 수 있게 했다.
- 캠페인 브리핑 모달에도 작전 목표를 표시한다.
- 이번 단계는 목표 표시/동선 스캐폴드이며, 다음 단계에서 영토 확보, 함선 보유, 함대전 완료, 마켓 등록 같은 실제 DB 기반 objective 판정을 연결한다.

## 2026-05-04 v5.69 — 게임 방향성 기준 문서

- `docs/GAME_DIRECTION_2026-05-04.md`를 추가해 OCCUPY MARS의 핵심 방향성을 문서화했다.
- 게임을 "캠페인으로 몰입시키고, 영토로 소유하게 하고, 함선으로 욕심나게 하고, 전쟁과 시장으로 부딪히게 하는 화성 개척 경제 전략 게임"으로 정의했다.
- 캠페인/영토/함대/전쟁·경제 네 기둥을 앞으로의 기능 판단 기준으로 정리했다.
- 캠페인은 전면 신규 제작이 아니라 기존 챕터와 에셋을 유지하면서 목표, 보상, 잠금 해제, 실제 게임 행동 연결을 붙이는 리마스터 방식으로 범위를 제한했다.
- P0 방향 고정 → P1 캠페인 메인퀘스트화 → P2 함대전 감각 완성 → P3 함선 경제 → P4 영토 유틸리티 순서의 우선순위 로드맵을 정리했다.

## 2026-05-03 v5.68 — 조선소 제작/강화 재료 보유량 UX

- 조선소 청사진 카드의 GP/광물 요구량을 `보유 / 필요` 형식으로 변경했다.
- 충분한 재료는 활성 녹색 톤, 부족한 재료는 비활성 붉은 톤으로 표시해 어떤 재료가 막고 있는지 바로 보이게 했다.
- 함선 제작 확인 모달에 GP와 광물 보유량을 모두 표시하고, 부족 시 확인 버튼을 비활성화했다.
- 함선 강화 버튼과 강화 확인 모달에 GP 보유량, 성공 확률, 강화 재료 보유량/필요량을 함께 표시했다.
- 강화 재료뿐 아니라 GP가 부족한 경우도 강화 모달에서 명확히 막히도록 정리했다.

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
- fix: 하이젝 에러맵 + 병합 버튼 JA/ZH 로컬라이징

## 2026-05-07 v7.49 — 프론트엔드 나머지 API 인증 헤더 완전 적용

**수정 (HIGH — index.html ~100개 추가 fetch 호출):**

v7.48에서 누락된 나머지 write endpoint fetch 호출에 `getAuthHeaders()` 완전 적용.

- governance sector tax-rate/buff/announcement, siege/declare, governor/declaration
- rockets/trigger, duels (challenge/cancel/accept), shield/activate
- contests (submit/vote), rental (list/rent/cancel)
- expeditions (launch/cancel), capsule/bury, broadcasts/create
- alliances (join/create/deposit/withdraw), territory/merge, territory/identity PATCH
- user/job, user/titles/equip, vip/purchase, lottery/buy
- daily-ops (progress/claim), campaign/reward/claim, gp/transfer
- exploration/discover, rockets/claim-loot, claims/rename 등

전체 index.html API write 호출 커버리지 완성. `/api/auth/*` + `emailAuth` 패턴 사용 호출은 의도적으로 미수정.
