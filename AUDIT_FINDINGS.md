# OCCUPY MARS — Codebase Audit (v5.78 / 2026-05-04)

## ✅ v5.78 Campaign ship upgrade objective — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 강화 objective 추가 | ✅ | MCC CH3에 `first_upgrade`를 추가해 함대전 이후 함선 스탯 강화 1회를 실제 진행 목표로 요구. |
| 서버 강화 횟수 집계 | ✅ | `objectiveState.shipUpgrades`가 `ship_stat_upgrade_log`를 기준으로 유저의 성공 강화 횟수를 집계. |
| DB 버전 호환성 | ✅ | v210 이전 DB처럼 `success` 컬럼이 없으면 기존 로그 전체를 강화 성공으로 처리하고, 테이블/컬럼이 없으면 safe query로 0 처리. |
| 목표 이동 동선 | ✅ | 기존 `shipyard` action routing을 사용해 강화 objective도 조선소로 이동. |

검증:
- `node --check server/services/campaign.js` 통과
- `git diff --check` 통과

---

## ✅ v5.77 Campaign editor default parity + Bug reporter hardening — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 캠페인 캐릭터 기본 좌표 | ✅ | 인게임 fallback을 에디터 기본값 `{x:50,y:55,w:60}` / 2인 `{x:28/72,y:55,w:50}`로 맞춰 저장 layout이 없어도 에디터와 같은 기준으로 렌더. |
| 저장 layout 우선순위 | ✅ | 기본 좌표 위에 서버/editor/local line/scene layout을 덮어 적용하므로 에디터 저장값은 계속 우선 적용. |
| 캠페인 전환 렉 체감 | ✅ | `fade_slow`/`fade_medium` duration을 짧게 줄여 배경 교체 때 빈/파란 화면이 오래 보이는 현상 완화. |
| 버그 신고 버튼 클릭 안정성 | ✅ | bug reporter 버튼/모달 버튼에 `type="button"`과 `preventDefault/stopPropagation`을 적용해 폼/모달 이벤트 간섭을 줄임. |
| 버그 신고 캡처/전송 복구 | ✅ | html2canvas 로드 지연 시 1.8초 후 수동 UI 복구. `/api/bug-report` 실패 시 `/bug-report` alias 재시도, 서버 alias route 추가. |

검증:
- `index.html` inline script syntax check 통과
- `node --check server/routes/bugReport.js` 통과
- `git diff --check` 통과

---

## ✅ v5.76 Shipyard requirement clarity + Fleet Command modal stickiness — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 제작 재료 부족 상세 | ✅ | 청사진 카드에서 재료/GP 부족 시 버튼을 완전 비활성화하지 않고 상세 모달을 열어 보유량/필요량을 확인 가능. |
| 제작 확인 모달 | ✅ | GP/광물을 `보유 / 필요` 문구와 ok/insufficient 색상으로 표시. 부족하면 실행 버튼만 disabled. |
| 강화 확인 모달 | ✅ | 강화 GP/재료도 `보유 / 필요` 문구로 통일해 실제 보유량과 필요량을 바로 확인 가능. |
| 인벤토리 코드 정규화 | ✅ | `/api/resources/my` 응답 resource code를 소문자로 저장하고 조회도 소문자로 해 재료 보유량 미표시 위험 감소. |
| 함대지휘 모달 유지 | ✅ | Fleet Command 주요 버튼에 `type="button"` + 이벤트 차단을 적용해 진형/기동/기함/이동 후 모달 이탈 위험 감소. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.75 Campaign objective hard gate — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 캠페인 자동 완료 조건 | ✅ | 프론트는 `progressPct >= 100`만으로 완료하지 않고 서버의 `preview.readyToComplete`가 true일 때만 완료 호출. |
| 서버 완료 hard gate | ✅ | `/api/campaign/complete`가 DB 기반 필수 objective 미달 시 `OBJECTIVE_REQUIREMENTS_NOT_MET`으로 보상/완료 처리를 차단. |
| 진행률 응답 보강 | ✅ | `/api/campaign/progress`가 `objectives`, `missingObjectives`, `nextObjective`, `preview.readyToComplete`를 함께 내려줌. |
| 남은 목표 안내 | ✅ | 작전 시간은 끝났지만 목표가 남은 경우 캠페인 모달에서 남은 목표와 GO 동선을 표시. |
| 시작 직후 objective 수량 | ✅ | `/api/campaign/start`와 alreadyCompleted 응답도 live objective state를 포함해 수량 표시 공백을 줄임. |

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.74 Campaign editor parity hotfix — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 모바일 stage 좌표계 | ✅ | 인게임 모바일도 에디터와 같은 9:16 좌표계를 유지해 캐릭터 위치가 다른 비율로 해석되지 않게 함. |
| 대사박스 크기 정합 | ✅ | 에디터 좌표 적용 시 인게임 safe-area padding을 compact editor padding으로 교체. |
| 캐릭터 위치 불일치 | ✅ | 모바일 fullscreen 비율 때문에 에디터 x/y와 다르게 보이던 문제를 stage 비율 통일로 수정. |
| layout 캐시 차단 | ✅ | 에디터 GET/POST, 인게임 fetch, 서버 GET 응답 모두 no-store/timestamp 처리. |
| 저장 후 반영 지연 | ✅ | 브라우저/SW 캐시에 묶여 이전 layout이 재사용될 위험을 낮춤. |

검증:
- `node --check server/routes/api.js` 통과
- `index.html` inline script syntax check 통과
- `campaign-editor.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.73 Campaign objective action routing — 착수 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| objective 클릭 액션 | ✅ | 진행 중/미완료 objective 중 지원되는 action에만 `GO`를 표시하고 클릭 가능하게 함. |
| 영토 목표 동선 | ✅ | `territory`, `territory_art` objective는 BASE 내 영토 탭으로 이동. |
| 함선/함대 목표 동선 | ✅ | `shipyard`는 조선소 청사진, `fleet`은 Fleet Command로 이동. |
| 전투/마켓 목표 동선 | ✅ | `fleet_battle`은 PVP Battle Hub, `market`은 BASE Market 탭으로 이동. |
| 안전한 범위 | ✅ | 완료 objective와 story/result/choice 계열은 읽기 전용 유지. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.72 Campaign objective expansion — 착수 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 영토 이미지 objective | ✅ | `claims.image_url`이 있는 내 영토 수를 `artClaims`로 집계. MCC CH1에 첫 영토 이미지 등록 목표 추가. |
| 함대전 완료 objective | ✅ | `fleet_battles.status = 'ended'` + 참여자 wallet 기준으로 완료 전투 수를 집계. MCC CH3에 첫 함대전 완료 목표 추가. |
| 마켓 등록 objective | ✅ | 활성 `ship_market_listings`와 일반 `marketplace_listings`를 합산해 `marketListings`로 집계. MCC CH3에 첫 마켓 등록 목표 추가. |
| objective state 유지 | ✅ | 모든 live objective는 `current/target/requirementMet`으로 내려가며 기존 카드/브리핑 UI에서 수량 표시됨. |
| 범위 통제 | ✅ | 완료 hard gate는 아직 미적용. objective 표시 정확성 확인 후 챕터별로 선별 적용 예정. |

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.71 Campaign live objective state — 착수 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 서버 objective 상태 스냅샷 | ✅ | `/api/campaign/status` 계열 응답에 `objectiveState` 추가. 영토/함선/활성 함선/함대/판매중 함선/완료 전투 수를 서버에서 집계. |
| 실제 DB 기반 objective | ✅ | MCC CH1은 첫 영토, MCC CH2는 첫 함대, FSP/CV CH1은 첫 함선 보유량을 `current/target`으로 연결. |
| UI 수량 표시 | ✅ | 캠페인 카드/브리핑 objective에 `현재/필요` 수량을 표시. 충족된 objective는 done 상태로 표시. |
| 배포 안전성 | ✅ | objective 집계는 safe query로 감싸 테이블/컬럼 차이가 있어도 캠페인 리스트 전체가 internal error로 죽지 않게 함. |
| 범위 통제 | ✅ | 이번 단계는 표시/안내 판정. 완료 hard gate는 기존 유저 진행을 막지 않도록 아직 적용하지 않음. |

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.70 Campaign main quest scaffold — 착수 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 실행 기획 문서 | ✅ | `docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md` 추가. 방향성 문서를 P1~P4 개발 스프린트로 분해. |
| 캠페인 objective 스키마 | ✅ | `server/services/campaign.js`의 `publicChapter()` 응답에 `objectives`와 `nextObjective` 추가. |
| 캠페인 카드 목표 표시 | ✅ | 진행 가능/진행 중 캠페인 카드에 현재 작전 목표를 표시. 완료/잠김 compact 카드 UX는 유지. |
| 브리핑 목표 표시 | ✅ | 캠페인 브리핑 모달에 챕터 목표를 함께 표시해 시작 전에 다음 행동을 알 수 있게 함. |
| 범위 통제 | ✅ | 이번 단계는 목표 표시/동선 스캐폴드. 실제 영토/함선/전투 DB 상태 기반 objective 판정은 다음 단계로 분리. |

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.69 Game direction lock — 문서화 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 방향성 기준 문서 | ✅ | `docs/GAME_DIRECTION_2026-05-04.md` 추가. 캠페인/영토/함대/전쟁·경제 네 기둥으로 전체 게임 방향을 정리. |
| 캠페인 범위 통제 | ✅ | 캠페인은 전면 신규 제작이 아니라 기존 챕터/이미지/캐릭터를 유지하고 목표·보상·잠금 해제·시스템 연결을 붙이는 리마스터 방식으로 정의. |
| 기능 추가 판단 기준 | ✅ | 새 기능은 네 기둥 중 하나와 연결되어야 하며, 단발성 메뉴/미니 기능 확장은 보류하는 기준을 명시. |
| 우선순위 로드맵 | ✅ | P0 방향 고정, P1 캠페인 메인퀘스트화, P2 함대전 감각 완성, P3 함선 경제, P4 영토 유틸리티 순서로 정리. |

검증:
- 문서 변경 전용. 실행 테스트 없음.

---

## ✅ v5.68 Shipyard material ownership visibility — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 제작 재료 보유량 표시 | ✅ | 청사진 카드의 GP/광물 요구량을 `보유 / 필요`로 표시. 충분하면 활성 녹색, 부족하면 비활성 붉은 톤. |
| 제작 확인 모달 | ✅ | 제작 확인 단계에서도 GP와 광물 보유량을 모두 표시하고, 부족 항목이 있으면 confirm disabled. |
| 강화 버튼 정보 | ✅ | 강화 버튼에 GP 비용, 성공 확률, 재료 `보유 / 필요`를 함께 표시. 부족한 항목은 붉은 톤. |
| 강화 확인 모달 | ✅ | 성공 확률, GP `보유 / 필요`, 재료 `보유 / 필요`를 표시하고 GP/재료 부족 시 실행 차단. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.67 Campaign editor/in-game coordinate parity — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 캐릭터 위치 불일치 | ✅ | 에디터의 `x/y` 중심점 좌표를 인게임이 top-left처럼 해석해 캐릭터가 밀리던 문제 수정. |
| 레거시 좌표 호환 | ✅ | 필요 시 `anchor: "top-left"` / `origin: "top-left"`가 명시된 layout은 기존 top-left 방식으로 처리. |
| 스토리 stage 기준 | ✅ | 데스크탑 인게임 story stage를 에디터와 같은 9:16 좌표계로 맞춰 percent 좌표 오차를 줄임. |
| 배경 크롭 기준 | ✅ | 에디터 preview와 동일한 중앙 cover(`50% 50%`)를 기본값으로 통일. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.66 Bug reporter submit contract + Codex inbox payload — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 버그 제출 버튼 실패 | ✅ | 프론트 `description` payload와 서버 `title/body` 계약 불일치로 `empty` 실패하던 문제 수정. |
| 구버전 payload 호환 | ✅ | 서버가 `description/context/screenshot`도 정규화해 수락하므로 캐시된 클라이언트도 제출 가능. |
| Codex/Claude 인박스 | ✅ | 리포트 JSON에 context, recent errors, codex hint를 포함해 `server/bug-reports/inbox`에 미러링. |
| 스크린샷 보존 | ✅ | base64 스크린샷은 파일로 분리 저장하고 JSON에 `screenshot_path` 기록. |
| 자동 캡처 로더 | ✅ | html2canvas script id 오타와 로드 실패 시 UI 복구 처리 추가. |

검증:
- `node --check server/services/bugReport.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.65 Ship upgrade material visibility + fleet command modal stability — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 강화 재료 보유량 표시 | ✅ | 강화 확인 모달에 필요 재료 `보유 / 필요` 수량과 `보유/부족` 상태를 표시. |
| 쐐기 진형 미리보기 | ✅ | 세로 전장 기준 앞쪽 1척, 후방 2/3척으로 퍼지는 삼각 돌격 대형으로 재배치. |
| Composition 수량 정규화 | ✅ | `EW Frigate`, `Interceptor`, `battle_ship` 등 별칭/라벨 기반 크기 집계를 정규화해 우측 수량 누락 방지. |
| 지휘 모달 튕김 완화 | ✅ | 진형/기동/함선 이동/기함 지정 후 모달 active 상태와 내부 스크롤 위치를 복구. |
| 모바일 safe-area | ✅ | Fleet Command backdrop 셀렉터 오타를 수정해 모바일 풀스크린 위치 계산이 적용됨. |
| Fleet API 소유권 비교 | ✅ | 목록/상세/수정/이동에서 wallet 대소문자 차이로 실패하는 케이스 완화. |

검증:
- `node --check server/services/fleet.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.64 Campaign editor position + fleet command vertical UX — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 캠페인 에디터 위치 반영 | ✅ | 서버 레이아웃 응답 뒤에도 localStorage 최신 좌표를 다시 병합해 에디터에서 방금 맞춘 캐릭터 위치가 인게임에 우선 적용됨. |
| 함대지휘 세로형 프리뷰 | ✅ | Fleet Command 진형 미리보기를 함선 PNG의 위쪽 방향과 맞춘 세로 전장으로 변경. |
| 이전 SVG 잔상 차단 | ✅ | 함대지휘 미리보기의 구형 SVG fallback을 숨겨 PNG 뒤로 옛 함선 실루엣이 비치는 문제 방지. |
| 진형/기동 모달 유지 | ✅ | 버튼 클릭 시 모달을 유지하고 프리뷰를 즉시 변형. API 실패 시 이전 상태로 롤백. |
| 함선 선택 식별 | ✅ | 선택 카드에 `SELECTED` 배지, 상세 패널에 최근 클릭 함선 스탯/역할 표시. |
| 기함 지정 오류 보정 | ✅ | `owner_wallet` 대소문자 비교와 `fleet_id` 타입 비교를 안정화해 잘못된 `SHIP_NOT_IN_FLEET`/소유권 실패 가능성 완화. |

검증:
- `node --check server/services/fleet.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.63 Ship market + chance upgrades + fleet FX polish — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 함선 확률 강화 | ✅ | `upgrade_offers`가 GP/성공확률/재료를 내려주고, 실패 시 GP+재료 소모 후 스탯 유지. |
| 강화 재료 소모 | ✅ | 스탯별 재료(`plasma_crystal`, `titanium_alloy`, `alloy_frame`, `nano_polymer`)와 수량을 설정 기반으로 계산. |
| 함선 마켓 등록/구매/취소 | ✅ | `ship_market_listings` 추가. 판매중 함선은 기본 함대에서 분리되고 강화/수리/실드/해체 차단. |
| 판매중 UI | ✅ | 보유함/마켓 카드에 `판매중` 스티커와 가격/판매자/취소·구매 버튼 표시. |
| 조선소 가독성 | ✅ | 청사진/보유함 PNG 불꽃 오버레이 제거, 함선 밝기/대비 강화. |
| 전투 이펙트 가시성 | ✅ | 빔포/미사일 지속시간을 늘리고 미사일 트레일을 추가해 수동 스킬 사용감 보강. |
| 무전/배경 시각 보정 | ✅ | 하단 콜아웃을 위로 올리고 화성 배경 알파/veil을 밝게 조정. |

검증:
- `node --check server/services/ship.js` 통과
- `node --check server/routes/ships.js` 통과
- `index.html`, `assets/tactical-lab-v11.html`, `assets/fleet-assault-demo.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.62 Campaign quest progress gate — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 작전 챕터 즉시 클리어 방지 | ✅ | 프롤로그/순수 시네마틱 외 챕터는 스토리 종료만으로 `complete` 호출하지 않음. |
| 서버 완료 게이트 | ✅ | `/api/campaign/complete`가 런타임 미충족 시 `MISSION_IN_PROGRESS` 반환. 직접 API 호출로도 조기 완료 불가. |
| 진행률 UI | ✅ | `showCampaignSim()`이 `/api/campaign/progress`를 폴링해 진행률/남은 시간 표시 후 준비되면 완료. |
| 챕터별 런타임 | ✅ | CH1 840초 하드코딩 제거. 각 챕터 `environment.totalDurationSeconds`/`estimatedPlayTimeSeconds` 기준. |

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.61 Campaign completed chapter compact cards — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 완료 챕터 접힘 처리 | ✅ | 프롤로그뿐 아니라 CH1 이후 완료 챕터도 compact 카드로 표시. |
| 결과 진입 유지 | ✅ | 접힌 완료 카드에서도 `RESULTS` 버튼으로 결과/챕터 화면 진입 가능. |
| 진행 카드 영향 | ✅ | 진행 중/시작 가능 챕터는 기존 큰 카드와 metric 영역 유지. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.60 Campaign editor layout parity + story perf — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 에디터/인게임 캐릭터 좌표 기준 | ✅ | 에디터의 `x/y/w` top-left percent 모델을 인게임도 동일하게 해석. `cx/cy`만 center 기준으로 처리. |
| 단일 화자 기본 배치 | ✅ | `scene.characters`가 없는 단일 화자 대화씬은 왼쪽이 아니라 중앙 캐릭터로 렌더. |
| 다른 캐릭터 에셋 확인 | ✅ | campaign-story 전체 speaker 42종을 검사했고 누락 초상화 0건. `crow` 매핑 오류도 수정. |
| 화면전환/대사 렉 완화 | ✅ | 배경/캐릭터/오버레이 이미지 캐시+다음 라인 선로딩, RAF 기반 타이핑, 대화창 blur 제거. |

검증:
- campaign-story speaker 42종 캐릭터 이미지 매핑 검사 통과 (missing 0)
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.59 Fleet Mars atmospheric background — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 화성 배경 레이어 | ✅ | `assets/textures/mars_nasa_2k.jpg`를 전투 캔버스 배경으로 비동기 로드. |
| 느린 표면 이동감 | ✅ | `drawBG()`에서 화성 텍스처를 어둡게 누른 뒤 천천히 패닝해 화성 상층권 전투 느낌 추가. |
| 가독성 유지 | ✅ | 어두운 veil, 기존 글로우, 낮은 알파 먼지 스트릭으로 함선/레이저가 묻히지 않게 처리. |
| 본서버 택티컬랩 반영 | ✅ | `assets/tactical-lab-v11.html`에 반영. 검수용 데모 파일도 동일 로직으로 수정. |

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.58 Fleet sprite preload fallback fix — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 첫 프레임 구형 벡터 노출 | ✅ | PNG가 로딩 중이면 구형 fallback 함선을 그리지 않도록 `SHIP_SPRITE_STATUS` 추가. |
| 엔진 플레임 분리 노출 | ✅ | 함선 본체가 그려진 경우에만 플레임/대형함 HP bar를 표시. |
| 본서버 택티컬랩 반영 | ✅ | `assets/tactical-lab-v11.html`에 반영. 검수용 데모 파일도 동일 로직으로 수정. |

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.57 Ship infinite stat upgrades — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 보유 함선 영구 강화 API | ✅ | `POST /api/ships/:id/upgrade-stat` 추가. `atk/def/hp/speed` 중 하나를 실패 없이 누적 강화. |
| DB 영속화 | ✅ | migration 209 추가. `bonus_speed`, `ship_stat_upgrade_log`, 강화 비용/증가량 설정 추가. |
| 조선소 UI 표기 | ✅ | 보유 함선 카드에 기본 스탯과 녹색 `(+보너스)` 표시, ATK/DEF/SPD/HP 강화 버튼 추가. |
| 전투 반영 | ✅ | `battleEngine`이 공격/방어/체력/속도 보너스를 실제 전투 스탯에 반영. |

검증:
- `node --check server/services/ship.js` 통과
- `node --check server/routes/ships.js` 통과
- `node --check server/services/battleEngine.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.56 Fleet battle scale-aware start distance/zoom — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 함대 수 기반 시작 거리 | ✅ | `battleScaleConfig()` 추가. 1:1 소규모전은 더 가까운 상/하단에서 시작하고, 함대 수가 많을수록 시작 간격이 넓어짐. |
| 함대 수 기반 교전 거리 | ✅ | `updateFleets()`의 최소/이상 교전 거리를 전투 규모에 따라 조정. 소규모전은 가까운 거리에서 싸우고 대규모전은 장거리 교전 유지. |
| 함대 수 기반 자동 줌 | ✅ | 자동 카메라가 소규모전에서는 더 크게 줌인하고, 대규모전에서는 전체 함대를 담도록 줌 범위를 낮춤. |
| 데모/본서버 동기화 | ✅ | `assets/fleet-assault-demo.html` 수정 후 `assets/tactical-lab-v11.html`에 동일 반영. |

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.55 Fleet battle chatter callouts — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 전장 무전 자막 | ✅ | 명령/진형/기동은 상단, 피격/격침/후퇴 경고는 하단에 짧은 콜아웃으로 표시. |
| 격침 대사 | ✅ | 소형함 격침은 확률적으로 비명/탈출 대사를 표시하고, 대형함/기함 격침은 더 강한 경고 문구로 표시. |
| 수동 스킬 대사 | ✅ | 집중공격, EMP, 빔포, 미사일 일제사격, 후퇴 확인에 각각 전투 무전 문구 추가. |
| 전투 분위기 | ✅ | 교전 중 간헐적으로 사격선 유지/산개/실드 재분배 같은 ambient 무전이 표시되어 정적인 느낌을 줄임. |
| 데모/본서버 동기화 | ✅ | `assets/fleet-assault-demo.html` 수정 후 `assets/tactical-lab-v11.html`에 동일 반영. |

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.54 Fleet manual beam/missile skills — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 전함/타이탄급 수동 빔포 | ✅ | `☢ 빔포` 게이지 추가. 전함/타이탄이 살아있을 때 게이지가 차고, 100%에서 수동 발사 시 우선순위 대형 목표에 굵은 주포 빔을 발사. |
| 소형/중형함 미사일 일제사격 | ✅ | `☄ 미사일` 게이지 추가. 프리깃/구축함/순양함이 살아있을수록 빨리 차고, 100%에서 다수 미사일을 적 함대에 발사. |
| 연출/사운드 | ✅ | 빔포 전용 두꺼운 글로우 빔, 발사 쇼크웨이브, 미사일/빔포 전용 WebAudio 효과음을 추가. |
| 데모/본서버 동기화 | ✅ | `assets/fleet-assault-demo.html` 수정 후 `assets/tactical-lab-v11.html`에 동일 반영. |

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.53 Fleet doctrine RPS + shipyard vertical UI pass — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 가위바위보식 함선 상성 | ✅ | `battleEngine`와 택티컬랩 양쪽에 역할/함급/파벌 기반 데미지 배율 추가. 태클, EW, 로지, 탱커, 저격, 폭격이 서로 다른 카운터를 가짐. |
| 진영별 함선 밸런스 | ✅ | migration 208 추가. MCC=정밀 저격, FSP=장기전/탱킹/로지, CV=러시/폭격/순간화력으로 스탯과 설명을 재조정. |
| 전투 BGM/SFX | ✅ | 외부 파일 없이 WebAudio 기반 전투 루프 BGM, 레이저/탄막/폭발 효과음 추가. 브라우저 정책 때문에 `SOUND` 버튼으로 활성화. |
| 세로 전장 기동 UI | ✅ | 세로 전장에 맞춰 전진/후퇴 아이콘을 `↑/↓`로 변경. 자동 기동 로그도 같은 방향 표기로 정리. |
| 조선소 세로 함선 카드 | ✅ | 데스크탑 조선소 청사진을 4열 그리드로 변경하고 `assets/ships/top/` PNG를 세로 프리뷰로 사용. 모바일은 1열 카드로 전환. |
| 조선소 엔진 불꽃 | ✅ | 기존 SVG 불꽃은 PNG 로드 시 숨기고, 카드 하단 후미에 새 엔진 플레임 오버레이를 적용. |

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `index.html` inline script syntax check 통과
- `node --check server/services/battleEngine.js` 통과
- `git diff --check` 통과

---

## ✅ v5.52 Top-view fleet sprite + long-range combat pass — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 함선 PNG 22종 매핑 | ✅ | `assets/ships/top/`에 전투용 축소 PNG 22종 추가. 중복 샘플 `mcc_destroyer_top.png`는 실제 22종 코드에 없어서 제외. |
| 전투/조선소 렌더 통일 | ✅ | 전투 화면과 SHIP REGISTRY 미리보기가 같은 PNG 스프라이트를 사용하도록 전환. 기존 벡터 함선 프리뷰는 fallback으로만 유지. |
| 엔진 불꽃 위치 보정 | ✅ | 기존 벡터 기준 파란 불꽃을 제거하고, PNG 함선 길이 기준 후방에서 나오는 공통 엔진 플레임 함수로 통일. |
| 장거리 함대전 보정 | ✅ | 함대 간 최소/이상 교전 거리를 크게 늘려 근접 난전처럼 겹치지 않도록 수정. |
| 카메라 화면 이탈 방지 | ✅ | 카메라 프레이밍을 함대 원이 아니라 실제 살아있는 함선 스프라이트 바운딩 박스 기준으로 계산. |
| 사격 방향 일치 | ✅ | 함선이 이동 방향보다 현재 사격 타겟 좌표를 우선 바라보도록 `aimX/aimY/aimTTL` 적용. |
| 대형함 움직임 | ✅ | 기함/대형함이 완전 고정처럼 보이지 않도록 중심 주변 묵직한 드리프트와 함대 전체 미세 이동 추가. |

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.51 Vertical fleet war production update — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 본 서버 함대전 세로 전장 | ✅ | `assets/tactical-lab-v11.html`을 v11.1 기반 세로 전장으로 전환. 적군은 상단, 아군은 하단에 배치. |
| 초기 함대 배치 | ✅ | 시작 함대가 일직선으로 나오지 않도록 상/하단 반원형 아크 배치 적용. 아군 기본 `wedge`, 적군 기본 `screen`. |
| 모바일 HUD 정리 | ✅ | 속도 조절은 우상단 오버레이 단일 버튼으로 순환 처리. 증원 테스트 버튼 제거, 전술/진형/기동 버튼은 소형 그리드로 압축. |
| 자동 줌/프레이밍 | ✅ | 가까운 교전쌍 거리로 줌 배율을 정하되 전체 생존 함대/라벨을 항상 화면 안에 포함하도록 제한. |
| 모바일 성능 | ✅ | 모바일 퍼포먼스 모드 추가. 작은 함선 대표 렌더, 발사 밀도/총알 누적/폭발 파티클/글로우 비용 감소. |
| 캔버스 비율 | ✅ | 내부 버퍼와 CSS 표시 비율을 `460x600`으로 맞춰 텍스트/함대가 가로로 찌그러지지 않게 보정. |

검증:
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.50 Fleet camera containment hotfix — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| Cinema 카메라 함선 화면 이탈 | ✅ | 오버숄더 카메라 중심을 소스/타겟 사이로 재계산하고, 카메라 target/actual center를 월드 경계 안으로 clamp. |
| 과도한 추적 줌 | ✅ | 오버숄더 줌을 함대 간 거리 기반으로 산출해 두 함대가 화면 안에 남도록 조정. |
| 박력 한계 판단 | 🟡 | 2D 전술맵 카메라만으로는 레퍼런스 같은 3D 깊이감 한계가 명확함. 다음 큰 개선은 프리렌더/3D풍 시네마틱 전투 뷰어로 분리 권장. |

검증:
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.49 Fleet combat role/preview/camera pass — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 샤드/재머 구매 이유 불명확 | ✅ | 재머 `EW` 역할을 실제 전투 엔진에 연결. EW는 낮은 직접딜 대신 적 함대 사격 간격 증가/화력 저하를 중첩시킴. |
| 재머 비용/설명 밸런스 | ✅ | migration 207로 재머 비용/건조시간/재료를 지원함 포지션에 맞게 낮추고, 샤드/재머 설명을 역할 중심으로 정리. |
| 조선소 역할 가독성 | ✅ | 카드에 DPS/TACKLE/EW/LOGI/TANK 역할 배지와 설명을 추가. |
| 함대 지휘 화면 구성 재미 부족 | ✅ | 선택 함대의 진형 미리보기 보드, 함종 구성 막대, 역할 칩, 함선별 ATK/DEF/SPD를 추가. |
| 모바일 함대전 화면 가독성 | ✅ | tactical lab v11.2: 모바일 캔버스 높이 확대, 버튼 2열 정렬, 함선 최소 표시 크기 확대, 정보 패널 모바일 그리드 정리. |
| 모바일 전술 버튼 점유 | ✅ | 오른쪽 구석 `TACTICS` 플로팅 버튼으로 전술 패널을 수납. 버튼 선택 후 자동 접힘으로 전장 화면을 최대한 유지. |
| 전장 카메라 | ✅ | 가장 가까운 교전 쌍 기반 자동 줌/팬과 `Cinema`/`Tactical` 카메라 모드 추가. Cinema는 기함 뒤 오버숄더 느낌의 추적샷과 전체 전장샷을 자동 교차. |

검증:
- `index.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `node --check server/services/battleEngine.js` 통과
- `git diff --check` 통과

---

## ✅ v5.48 Shipyard build tab retention — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 함선 건조 후 큐 탭 강제 이동 | ✅ | `buildShip()` 성공 후 `switchSyTab('queue')`를 제거해 청사진/건조 탭에 그대로 남도록 수정. |
| 큐/재화 상태 갱신 | ✅ | `refreshShipyard()`는 유지해 건조 큐, GP, 광물, 버튼 상태는 즉시 갱신됨. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.47 Completed prologue compact card — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 완료된 프롤로그 카드 과점유 | ✅ | 완료된 `chapterNumber === 0` 프롤로그는 stats/description 없는 compact 카드로 접어서 표시. |
| 결과 접근 | ✅ | 접힌 카드에서도 `RESULTS` 버튼은 유지해 결과 모달 진입 가능. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.46 Campaign editor layout save/apply — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 에디터 수정값 서버 미저장 | ✅ | 운영 `/api/campaign/editor-layout`가 `{}`를 반환해 인게임이 적용할 layout이 없던 상태 확인. |
| 에디터 서버 동기화 | ✅ | 에디터 시작 시 서버 layout을 로드하고, 서버가 비어 있으면 기존 localStorage layout을 자동 업로드. |
| Save 버튼 의미 정리 | ✅ | `Export Backup` 버튼을 `Save to Game`으로 변경하고 즉시 `/api/campaign/editor-layout`에 저장. |
| 인게임 fallback | ✅ | 서버 layout이 비어 있거나 로드 실패하면 같은 origin localStorage의 `editorCharacters`/`editorDialog`/`editorFontSize`를 fallback으로 적용. |

검증:
- `index.html` inline script syntax check 통과
- `assets/campaign-editor.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.45 Campaign story background transition flash — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 장면 전환 시 파란/보라 화면 노출 | ✅ | `_campaignResetStoryLayout()`이 `.story-background` inline style 전체를 삭제해 기본 CSS 그라디언트가 먼저 보이고 이미지 로드 후 배경이 붙던 문제 수정. |
| 배경 교체 방식 | ✅ | 현재 배경 이미지는 유지하고 위치/크기/opacity/filter만 초기화. 새 배경은 preload 성공 후 `backgroundImage`를 교체. |
| 동일 배경 재렌더 | ✅ | `data-bg-src`로 같은 배경이면 재로드 없이 layout만 적용. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.44 Campaign story editor layout runtime bridge — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 에디터 배치값 인게임 미반영 | ✅ | 스토리 렌더러가 캐릭터/배경/대사박스/closeup overlay 위치를 고정 CSS로만 그려 에디터 preview와 인게임 위치가 달라지던 문제 수정. |
| layout 필드 지원 | ✅ | 서버 저장 `_campaignEditorLayout`, `scene.layout`, `line.layout`, `editorLayout`, `stageLayout`을 병합하고 `desktop`/`mobile` breakpoint 값을 현재 화면에 맞게 적용. |
| 캐릭터 위치 적용 | ✅ | `layout.characters.berk` 같은 캐릭터별 좌표/크기/스케일을 읽어 좌우 기본 배치를 덮어씀. y가 없는 에디터 캐릭터 값은 bottom-anchor 방식으로 적용해 상단 overflow/crop을 방지. |
| 배경/대사창/overlay 위치 적용 | ✅ | `background`, `dialogBox`, `overlay` 계열 layout을 stage percent/px 값으로 적용. |
| 라인 전용 배경 | ✅ | 기존 주석과 달리 호출부가 `line.background`을 넘기지 않던 누락도 수정. |
| 캐시 버전 | ✅ | `CAMPAIGN_ASSET_VERSION` `20260502c`로 갱신. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.43 Campaign character portrait generation — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 캐릭터 포트레이트 파이프라인 | ✅ | gpt-image-1 + rembg, 1024×1536, 배경 제거 |
| pilot 3종 (butcher/chen/cinder) | ✅ | cinder v9 최종 채택 (번 스카 + 툴 벨트 확인) |
| batch1 7종 | ✅ | amara/director_vale/mikhail/miner_elder/olu_adeyemi/phoenix/sera |
| needs_story_check 2종 | ✅ | kenji/lena 스토리 확인 후 생성 |
| hold 16종 | ✅ | 전 캐릭터 생성 완료 |
| 생성 로그 | ✅ | `assets/campaign/characters/_generation_log.json` |

---

## ✅ v5.42 Campaign complete internal error — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 캠페인 완료 Internal error | ✅ | `player_campaign_progress` 완료 UPDATE에서 `$1` 파라미터를 `status` 대입과 `CASE WHEN` 비교에 동시에 사용해 운영 PostgreSQL이 `inconsistent types deduced for parameter $1`로 실패. |
| 완료 SQL 타입 충돌 제거 | ✅ | `CASE WHEN` 비교용 파라미터를 별도 `$8`로 분리해 `status` 컬럼 대입 타입 추론과 분리. |
| 실제 캠페인 플로우 검증 | ✅ | 운영 DB 합성 지갑으로 `mcc_prologue` 시작 → 완료 → `mcc_campaign_ch1` unlock 확인 후 합성 데이터 삭제. |

검증:
- `node --check server/services/campaign.js` 통과
- 운영 DB 합성 플로우: `complete ok true completed mcc_campaign_ch1`

---

## ✅ v5.41 Backend phantom schema + client guard audit — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| `user_achievements.id` phantom 반환 | ✅ | 실제 운영 DB `user_achievements`에는 `id`가 없으므로 업적 unlock INSERT가 `RETURNING id`에서 실패 가능. `RETURNING achievement_key`로 변경. |
| `user_profiles` phantom table 참조 | ✅ | 운영 DB에는 `user_profiles` 테이블이 없음. Contest/Expedition/Rental 닉네임 JOIN을 `users(wallet_address)` 기준으로 변경. |
| Rental `claims.pixel_count` phantom column | ✅ | 운영 DB `claims`에는 `pixel_count` 컬럼이 없음. `(claims.width * claims.height) AS pixel_count`로 계산. |
| Starlink overlay `undefined.length` client error | ✅ | 최근 `client_errors`에서 확인된 `passes.length` 접근을 배열 정규화/가드 처리. |
| Arena crash history 방어 | ✅ | `/api/arena/crash/history`가 배열이 아닌 응답을 주는 순간에도 UI가 터지지 않도록 배열 가드 추가. |
| Inline onclick handler audit | ✅ | `onclick` 849개 / 호출 함수 523개 스캔. 실제 미정의 핸들러 0개. |

검증:
- `node --check server/services/achievements.js`
- `node --check server/services/contest.js`
- `node --check server/services/expedition.js`
- `node --check server/services/rental.js`
- `index.html` inline script syntax check 통과
- 운영 DB 스키마 확인: `user_profiles` 없음, `user_achievements.id` 없음, `claims.pixel_count` 없음
- 운영 DB `BEGIN/ROLLBACK` 드라이런: contest/expedition/rental SELECT, achievement INSERT `RETURNING achievement_key` 통과

---

## ✅ v5.40 Shipyard build button GP summary — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 조선소 건조 버튼 비활성화 | ✅ | 프론트가 `summary.gp_balance`를 기준으로 GP 부족 여부를 판단하지만 `/api/ships/summary`가 해당 필드를 반환하지 않아 모든 유료 함선이 GP 0으로 판정됨. |
| summary 쿼리 기준 | ✅ | `fleets` 기준 집계에서 `users` 기준 LEFT JOIN으로 변경. 함대가 아직 없는 유저도 `gp_balance`, 함대 수, 건조 큐 수를 정상 수신. |
| DB 건조 스키마 | ✅ | 운영 DB `BEGIN/ROLLBACK` 드라이런에서 `ship_build_jobs`/`ship_build_log` INSERT 통과. |

검증:
- `node --check server/services/ship.js` 통과
- 운영 DB `ship_build_jobs`, `ship_build_log` 기존 0건 확인
- 운영 DB 드라이런 ROLLBACK 확인

---

## ✅ v5.39 Campaign asset hard cache refresh — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| SW 캐시 버전 | ✅ | `mars-v8`. 기존 `mars-v7` 이하 캐시 activate 단계에서 삭제. |
| HTTP 캐시 우회 | ✅ | `/assets/campaign/*` fetch를 `cache: reload`로 변경해 Service Worker Cache Storage뿐 아니라 브라우저 HTTP 캐시 고착도 회피. |
| URL 버전 통합 | ✅ | 배경/캐릭터/closeup 배경 URL을 `campaignAssetUrl()` + `?v=20260502b`로 통합. |

검증:
- inline script syntax check 통과
- `node --check sw.js` 통과
- `git diff --check` 통과

---

## ✅ v5.38 캠페인 배경 184장 Codex 전면 재생성 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 77장 scene-level 9:16 portrait | ✅ | 전체 portrait(height>width), 0 DIMENSION_FAIL |
| 107장 overlay 1:1 square | ✅ | 전체 square(width≈height), 0 DIMENSION_FAIL |
| style: gritty cinematic sci-fi | ✅ | green CRT 키워드 제거. cargo_ship_interior/mcc_briefing_room 2곳만 유지 |
| _bgMap 정리 | ✅ | 자체 파일 생긴 항목 제거, 폴백 4개 유지 |
| SW cache-bust mars-v6 | ✅ | 옛 이미지 캐시 전체 무효화 |
| URL ?v=20260502a | ✅ | sw 동기 |

---

# OCCUPY MARS — Codebase Audit (v5.37 / 2026-05-01)

## ✅ 현재 코드베이스 상태 요약 (2026-05-01 기준)

### v5.37 UI 검수 + 캐시 무효화 + 파벌 대사 시스템 — 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 851 onclick 핸들러 검수 | ✅ | 자동 스캔 522 unique 함수, 미정의 3건 → 모두 실구현. |
| 업적 달성 조건 모달 | ✅ | showAchievementDetail() — condition_type 27종 한/영 라벨, 보상, 상태, 일시. |
| 슬로대 스타일 파벌 대사 | ✅ | showFactionFlavor() — 4 situation × 65 라인. MCC/FSP/CV 캐릭터 12명. claim/hijack/함대전 hook. |
| 모바일 옛 이미지 캐시 | ✅ | sw.js CACHE_NAME mars-v4 → mars-v5. activate 시 옛 image cache 일괄 삭제. URL ?v=20260501d 동기. |

---

### v5.37 Ship build transaction silent rollback — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 함선 건조 실패 root cause | ✅ | `server/services/ship.js` `startBuild()`에서 선택적 `fleet_gp_activity` 로그를 트랜잭션 내부에서 `.catch(() => {})`로 삼켜 PostgreSQL transaction-aborted 상태가 `COMMIT` 시 전체 롤백될 수 있었음. |
| `ship_build_jobs` INSERT 보장 | ✅ | 건조 트랜잭션은 GP/광물 차감, `ship_build_jobs` INSERT, `ship_build_log` INSERT만 수행하고 바로 `COMMIT`. optional activity log는 `COMMIT` 이후 `logFleetGpActivity()` fire-and-forget. |
| 재료 조회 스키마 | ✅ | `recipe_minerals` 키는 resource code이며, 조회/차감은 `resources.code` → `resources.id` 매핑 후 `user_resource_inventory(resource_id)`로 수행. `resource_code` 직접 매칭 버그는 현재 경로에 없음. |
| 설정 게이트 | ✅ | `startBuild()`는 `fleet_combat_enabled`/`flagship_required`로 건조를 막지 않음. `max_ships_per_player`는 명시적 `PLAYER_FLEET_FULL`, ship type limit은 `SERVER_LIMIT_REACHED`/`PLAYER_LIMIT_REACHED` 반환. |
| GP/광물 오류 응답 | ✅ | `/api/ships/build`는 `INSUFFICIENT_GP`, `INSUFFICIENT_MINERALS`를 402와 `meta`로 반환. |
| 클라이언트 요청 확인 | ✅ | `index.html` `buildShip()`은 `ship_type_code`를 전송하며 이번 수정에서 UI 파일은 건드리지 않음. `fleet_id`는 optional이고 누락 시 건조 완료 단계에서 기본 함대로 배정됨. |

검증:
- `node --check server/services/ship.js` 통과
- `git diff --check` 통과
- sandbox 네트워크 제한으로 local Postgres `psql` 접속 검증은 불가

---

### v5.36 Scene-level 77 + Variant 301 + JSON round-robin — 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| Scene-level 77장 재생성 | ✅ | location-named (cargo_ship_corridor, olympus_summit_station 등) Imagen 4 Ultra 9:16. 평균 1418KB. |
| 반복 케이스 147건 식별 | ✅ | prologue_shared cargo_ship_corridor 18회, olympus_summit_station 40/39/30회 등. |
| Variant 301장 생성 | ✅ | bg당 N개 variant (N=1~7, 회수에 비례). 평균 1410KB. 8종 angle/lighting hint round-robin. |
| 36개 JSON round-robin | ✅ | scene.background 필드를 base + v2/v3/v4… 로 회전. 시각적 반복 피로감 해소. |
| 인프라 일치 | ✅ | line.background (115 dedicated) + scene.background (77 base + 301 variants) 모두 cinematic 통일 |

검증:
- variant: 301/301 1차 성공, failed 0
- find assets/campaign/backgrounds -name "*.png" → 약 480장
- 36개 챕터 JSON 모든 background ID 가 실제 PNG 와 1:1 매칭

후속:
- 향후 핵심 씬 더 높은 퀄 필요 시 Codex/gpt-image-1 으로 부분 업그레이드 가능

---

### v5.35 Imagen 4 Ultra 115장 일괄 재생성 완료 — 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 모델 업그레이드 | ✅ | `imagen-3.0-generate-001` → `imagen-4.0-ultra-generate-001`. Codex agent 가 작성한 스크립트 실행. |
| 115장 일괄 재생성 | ✅ | 114/115 1차 성공, 1장 safety filter retry 후 완료. 평균 1481.7KB. |
| 골드 스탠다드 도달 | ✅ | 167/190 (88%) ≥1.4MB. ≥2MB 19개, 1.5-2MB 116개. |
| 검수 픽스 (배치 중 3장) | ✅ | cv_ch10_l14 헤드램프 / cv_ch1_l41 캐릭터 박힘 / mcc_ch5_l29 safety filter — 모두 타겟 재생성 |
| 9:16 portrait | ✅ | 모바일 풀스크린 적합 |
| 대사·캐릭터 매칭 | ✅ | hand-crafted 영문 프롬프트 (KO 대사 → 시각 요소) 그대로 적용 |

검증:
- `find assets/campaign/backgrounds -name "*.png" -newermt "2026-05-01" | wc -l` → 115
- 평균 사이즈 1481KB, 분포 ≥2MB 19개 / 1.5-2MB 116개 / 1.4-1.5MB 32개 / <1.4MB 23개
- 기존 70개 scene-level high-quality 배경 보존 (수정 없음)

---

### v5.34 Imagen 4 Ultra 모델 업그레이드 + 골드 스탠다드 적용 — 진행 중

| 라인 | 상태 | 수정 |
|------|------|------|
| 모델 업그레이드 | ✅ | `imagen-3.0-generate-001` → `imagen-4.0-ultra-generate-001` 전환 (`gen_scene_dedicated_v2.py` 내 `IMAGEN_MODEL` env var 지원). Codex 추천. |
| 테스트 검증 | ✅ | CV Ch10 첫 3장 (fire_small / hand_still / death_still) 1494/1506/1510KB 달성, 모두 골드 스탠다드 1.4MB+ 돌파. 디테일 차원이 다름 (정교한 metal gear, 텍스트 레이블, 환경 스토리텔링). |
| 118장 일괄 재생성 | 🔄 | `--strict` 모드로 < 1.4MB 결과물 모두 Imagen 4 Ultra 로 재시도 (백그라운드). |
| 사이즈 보장 | ✅ | 9:16 portrait + Imagen 4 Ultra = 안정적으로 1.4MB+ 출력 확인 |
| 비용 노트 | ⚠ | Imagen 4 Ultra 는 Imagen 3 대비 호출당 단가 ↑. 118장 일괄 재생성 cost 약 $X 추정 (별도 확인 필요) |

검증:
- `imagen-4.0-ultra-generate-001` 첫 3장 모두 1.4MB+ (Imagen 3 대비 약 50-100% 사이즈 증가)
- 9:16 portrait 유지, hand-crafted prompt 그대로 적용
- `assets/campaign/backgrounds_imagen4_test/` 에 비교용 샘플 보존

---

### v5.34 오버레이 폐기 + 씬 전용 9:16 배경 (인프라 1/2) — 진행 중

| 라인 | 상태 | 수정 |
|------|------|------|
| 오버레이 시스템 제거 | ✅ | `.story-detail-overlay` CSS, `<img>` 엘리먼트, `_showStoryDetailOverlay()` 함수, `assets/campaign/overlays/*.png` 35개 일괄 삭제. floating closeup → 라인 풀스크린 배경 swap 으로 전환. |
| `_campaignStorySetBackground` 라인 인자 | ✅ | `(scene, overlay, lineBg)` 시그니처. lineBg 있으면 우선 사용. |
| scene JSON `overlay` → `background` | ✅ | 35개 챕터 / 107 라인 변환 (`scripts/update_scene_overlays_to_backgrounds.py`). |
| hand-crafted 프롬프트 120개 | ✅ | 107 씬 라인 + 13 저퀄 scene-level. KO 대사 직접 읽고 캐릭터·사물·행동·분위기 명시. 9:16 portrait. |
| Imagen 3 9:16 생성 | 🔄 | 진행 중 (~1분/장). 후속 커밋 (2/2) 에 PNG 일괄 포함. |
| `hidden_ch5_last_observation.json` JSON parse | ✅ | line 370 닫는 중괄호 오타 수정. 캠페인 스캔 / 변환 모두 이 챕터 포함 가능. |

검증:
- `python3 -c "import json,glob; [json.load(open(f)) for f in glob.glob('docs/campaign-story/*.json')]"` 36개 모두 파싱 성공
- `grep -c story-detail-overlay index.html` 잔존 0건 (코멘트 1개 제외)
- 변환된 라인 background ID ↔ `gen_scene_dedicated_v2.py PROMPTS` 키 1:1 일치

---

### v5.33 Campaign Visual Novel Engine + 이미지 에셋 + Internal Error 수정 — 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 비주얼 노벨 씬 엔진 | ✅ | `showCampaignStory()` 구현. narration/dialogue/choice/branch/battle_transition/result/ending 씬 타입 지원. 타이핑 애니메이션, 캐릭터 초상화(현재 화자 밝게/비화자 dim), 배경 전환 효과. |
| 배경 이미지 78개 | ✅ | `assets/campaign/backgrounds/*.png`. 기존 8 + Imagen 3 신규 70개. 씬 JSON의 background ID와 1:1 대응. `.gitignore` 예외 추가. |
| 캐릭터 초상화 21개 | ✅ | `assets/campaign/characters/*.png`. Imagen 3 신규 10개(liang_wei/yuna/crow/aisha/hagar/kenji/verk/observer/miner_anon/miner_elder) + 기존 11개. |
| `complete()` Internal Error | ✅ | `applyReputation()` 호출을 `applyOptionalCampaignReward` SAVEPOINT로 감쌈. reputation_history 테이블 이슈 시 평판만 건너뛰고 챕터 완료 유지. 기존에는 전체 롤백 → 500. |
| 프롤로그 scene choice `INVALID_CHOICE` | ✅ | `index.html`이 서버 `chapter.choices`에 없는 VN scene-local 선택지는 로컬로 진행하고, no-choice 프롤로그 챕터는 서버에서도 scene choice ID를 방어적으로 인식. |
| Migration 204 방어 재보장 | ✅ | `attempts`/`best_metrics`/`last_metrics`/`source_chapter` ADD COLUMN IF NOT EXISTS. `reputation_history`/`campaign_sessions`/`player_branch_modifiers` CREATE TABLE IF NOT EXISTS. `hidden_campaign_ch1~5` FK 시드. |
| `.jpg` 확장자 버그 | ✅ | 배경 로딩 코드에서 `.jpg` → `.png` 수정. 기존에는 모든 배경이 gradient fallback이었음. |

검증:
- `ls assets/campaign/backgrounds/ | wc -l` → 78
- `ls assets/campaign/characters/ | wc -l` → 21
- `git log --oneline` → migration 204, applyReputation SAVEPOINT, _bgMap 업데이트 커밋 확인
- `node --check server/services/campaign.js` 통과
- `node --check server/routes/api.js` 통과
- `docs/campaign-story/*.json` scene choice scan: 31개 parseable 파일, 32개 choice/branch scene, 128개 scene option 확인. `hidden_ch5_last_observation.json`은 기존 JSON parse error(line 370)로 structured scan 제외.

---

### v5.32 Capital ship Core/Mid material gate + Phase C hijack modal cleanup — 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| Battleship/Titan Core+Mid mat 보장 | ✅ | Migration 203 적용. 모든 BS/Titan(6종)이 Core 전용(`exotic_alloy`/`dark_matter`/`quantum_core`)과 Mid 전용(`titanium_alloy`/`plasma_crystal`/`nano_polymer`) 광물을 둘 다 포함. fsp_titan에 nano_polymer:40 추가, 모든 BS의 exotic_alloy 최소치를 3 으로 통일. 마이그레이션이 invariant assertion으로 자체 검증. |
| 어드민 추적용 settings | ✅ | `capital_ship_core_mat_required`, `capital_ship_mid_mat_required`, `capital_ship_recipe_contract`, `core_exclusive_minerals`, `mid_exclusive_minerals` 키 시드. admin이 광물 코드 set을 한 곳에서 관리/감사 가능. |
| Phase C 죽은 하이잭 모달 제거 | ✅ | `index.html`의 `hijackModal` HTML(31줄) + `openHijackModal/closeHijack/confirmHijack` 함수 삭제. `useLegacyDeclare` 게이트 뒤에 숨어 있어 도달 불가능했던 dead code. 영토 정보 패널의 정식 진입점(`hijackFromTerritoryInfo` → claim 모달 → `/api/hijack/declare-with-pp`)은 유지. |
| `/api/hijack/declare` 410 응답 보강 | ✅ | 메시지에 alternatives 객체(territory_hijack/ai_duel/pvp_tournament 경로)를 명시. `phaseC.js` + `services/hijack.js` 라우트 정리 주석 동기화. 외부에서 잘못 호출했을 때 어디로 가야 하는지 즉시 안내. |
| ships/build·resource-craft/start·hijack/declare-with-pp 스모크 | ✅ | `server/tools/smoke_capital_recipes.js` 작성·통과. 11/11 통과 — `ship.startBuild` (mcc_bs/mcc_titan), `resourceCraft.startCraft` (hull_plate/plasma_coil), `hijack` 서비스 export 4종, `hijack_battles` 스키마(target_claim_id NULL 허용 + pending_pixels 컬럼), Migration 203 invariant. Core+Mid 광물이 실제로 차감되는지(`exotic_alloy`/`titanium_alloy`/`nano_polymer`)도 직접 검증. |

검증:
- `psql -f server/migrations/203_capital_ship_core_mid_materials.sql` 적용 (assertion 통과)
- `node server/tools/smoke_capital_recipes.js` → 11 passed / 0 failed
- `node --check` 모든 수정 JS 파일 통과
- `grep -c openHijackModal hijackModal closeHijack confirmHijack index.html admin.html` → 0/0

---

### v5.31 Bug report 버튼 중복 제거 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 신규 `#bugReportFab` 🐞 + `class="bug-modal"` 시스템 | ✅ 삭제 | CSS(.bug-fab/.bug-modal 약 65줄), HTML(버튼+모달 약 45줄), JS(`selectBugCat`/`openBugReport`/`closeBugReport`/`submitBugReport` 신규본 약 120줄) 일괄 제거. 레거시 시스템과 `id="bugReportModal"` 중복으로 클릭 시 잘못된 모달이 열리던 충돌 해소. |
| 레거시 `#bugReportBtn` 🐛 위치 | ✅ 이동 | 우하단 고정에서 `.zc` 줌 컬럼의 SECTORS 버튼 바로 왼쪽(8px gap, 세로 가운데)으로 이동. `alignBugFab()` rAF-throttled 함수가 load/resize/DOMContentLoaded/주기 타이머에서 재계산. |
| `i18n` 사전 잔여(`bug_report_*`, `bug_cat_*` × 4 lang) | 🟢 무해 | 더 이상 참조하는 UI 없음. 후속 정리 가능하나 동작 영향 없음. |

검증:
- `index.html` 정적 파싱 — `bugReportBtn` 1, `bugReportFab` 0, `bugReportModal` 1 (레거시 한정).
- 신규 시스템 함수/CSS 클래스 잔존 0건 grep 확인.

---

### 🔍 Campaign System 정밀 감사 (2026-04-30, Claude+Codex 협업) — **수정 필요**

> 직전 hotfix(commit a84f208) 이후 캠페인 30+ 챕터 출시 전 정밀 감사. Codex가 `server/services/campaign.js` 비즈니스 로직, Claude가 마이그레이션 192-201 + API 라우트 + index.html UI를 분담해 검토함.

#### 🔴 Critical (출시 차단)

| # | 위치 | 결함 | 재현 |
|---|------|------|------|
| ✅ C1 | `server/services/campaign.js:3122` | **Resolved (2026-04-30)**: `calculateEligibleFspEndings()` 추가 및 FSP_CH10_ID ending eligibility 검증 적용 | 자격 미달 FSP Ch10 엔딩 직접 제출 차단 |
| ✅ C2 | `server/services/campaign.js:3122` | **Resolved (2026-04-30)**: FSP Ch9 조건부 Pilgrim Arms 선택지 prerequisite branch modifier 검증 적용 | 전제 조건 없는 `fsp_ch9_signal_pilgrim_arms` 직접 제출 차단 |
| ✅ C3 | `index.html:25095`, `server/services/campaign.js:3298` | **Resolved (2026-04-30)**: scene-local VN choices no longer post to `/api/campaign/choice`; no-choice prologue chapters defensively accept scene choice IDs | 프롤로그 CONTINUE 후 선택지 클릭 시 `INVALID_CHOICE` modal 발생 차단 |

#### 🟡 Major (조기 핫픽스 필요)

| # | 위치 | 결함 | 영향 |
|---|------|------|------|
| M1 | `campaign.js:2135` `simulatePrologue()` | 마지막 씬/진행도 검증 없음 | 프롤로그 `start` 직후 `complete` 호출 시 보상/Ch1 해금 즉시 지급 (스킵 farming) |
| M2 | `campaign.js:3167` `startChapter()` | `campaign_sessions`에 (wallet, chapter_id, status='active') UNIQUE 제약 없음 | 동시 `start()` 호출 시 같은 wallet/chapter에 활성 세션 중복 생성 가능 |
| M3 | `campaign.js:2173` `simulateChapter()` | 미지원 routeId(CV/hidden) → MCC Ch1 시뮬레이션으로 폴백 | CV 캠페인 완료 시 MCC Ch1 시뮬레이션 결과로 처리 |
| M4 | `campaign.js:2923` `calculateRewards()` | M3와 동일한 폴백 | CV/hidden 챕터가 MCC Ch1 보상(Prism blueprint + Ch2 unlock)을 잘못 수령 |

#### 🟢 Minor (후속 정리)

| # | 위치 | 결함 |
|---|------|------|
| m1 | `campaign.js:3361` `applyOptionalCampaignReward` catch | `err.message`만 로깅, stack 누락 — Railway에서 보상 SAVEPOINT 실패 원인 추적 어려움 |
| m2 | `campaign.js:43` `loadScenesFile()` | 동일하게 stack/context 없이 detail만 출력 |
| m3 | `routes/api.js:3508-` 캠페인 라우트 전체 | wallet 길이 검증 없음 (`if (!wallet)`만). 다른 라우트는 `requireWallet`로 ≥10자 강제 — 일관성 부족 (위험도 낮음) |

#### ✅ 검증 통과 항목

- 마이그레이션 192~201 schema/seed 무결성 (FK, ON CONFLICT, schema_migrations 자동 등록 via migrate.js)
- `complete()` 트랜잭션: `FOR UPDATE` 행 잠금으로 동시 complete 차단, status='in_progress' 필터로 idempotency 보장
- 보상 SAVEPOINT 격리(blueprint/title/mastery/tag/lore/branch) — 부가 보상 실패가 챕터 완료를 깨지 않음
- 보상 payload는 클라이언트가 제출하지 않음 — `calculateRewards()`가 서버에서만 결정
- choice ID 화이트리스트 검증 (`chapter.choices.find(c => c.id === choiceId)`) — Ch1~Ch9는 정상
- MCC Ch10 ending eligibility 서버 enforcement 정상 (`calculateEligibleEndings()` + `validateChapterChoice()`)
- Ch7/8/9 route prefix 강제 (a/b/c) 정상
- 서비스 `CHAPTERS` 딕셔너리 ↔ `docs/campaign-story/*.json` 36개 씬 파일 ↔ migration seed 모두 일관
- index.html 캠페인 UI 흐름: 파벌 필터, 잠긴 챕터 compact list, sessionId 이어받기, abandon 호출 정상
- 마이그레이션 201로 prologue + CV 챕터 FK 위반(`Internal error`) 해소 확인

#### 권장 수정 순서

1. ✅ **C1, C2 resolved** (`validateChapterChoice` 확장: `FSP_CH7~10_ID` 추가, FSP ending eligibility 함수 추가)
2. **M1** (`simulatePrologue`에 최소 진행 시간/씬 도달 플래그 검증)
3. **M2** (`campaign_sessions(wallet, chapter_id) WHERE status='active'` 부분 UNIQUE 인덱스 추가)
4. **M3, M4** (지원 안 되는 routeId는 명시적으로 `error: 'NOT_IMPLEMENTED'` 반환)
5. **m1, m2** (catch 로그에 `err.stack` 추가)
6. **m3** (`requireWallet` 헬퍼 적용)

검증:
- Codex agent가 `server/services/campaign.js` 3712줄 정밀 감사
- Claude가 마이그레이션 192-201 + API 라우트 + index.html UI 검사 (병행)
- 마이그레이션 BEGIN/ROLLBACK 드라이런은 본 감사에서는 수행하지 않음 (수정 후 별도 검증 예정)

---

### v5.30 Mobile first-load side panel lock — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| iPhone XS Max 첫 화면 | ✅ | 1024px 이하에서 좌/우 사이드 패널은 `.open` 없이는 `!important` off-screen transform을 적용해 지도 화면을 가리지 않게 수정. |
| iOS 상태 복귀 | ✅ | `pageshow`, `load`, `orientationchange`에서 `forceCloseMobilePanels()`를 호출해 bfcache/회전/이전 open 상태가 첫 화면에 남지 않도록 보강. |

검증:
- `index.html` 인라인 script 파싱 통과
- `git diff --check` 통과

---

### v5.29 FSP Campaign Ch7~10 MVP — 구현 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| FSP Ch7 Assembly | ✅ | Hellas Central 의회, Mikhail/Liang/Amara/Diego/Player 의장 분기, 환경 위기 병행 지표, Ch8~Ch10 branch modifier 보상 추가. |
| FSP Ch8 Gaia | ✅ | 시민 기부/전투 pledge/침묵/MCC 절도 4선택, Gaia 건조율·HP·민간 피해·절도 성공 지표, Gaia/Pilgrim Arms seed 보상 추가. |
| FSP Ch9 Three Flags | ✅ | Olympus 정상회담, Amara/Chen/Butcher/전원후퇴/Pilgrim Arms 신호 보호 선택, 배신/4파벌/Peacemaker 분기 추가. |
| FSP Ch10 Freedom's Price | ✅ | Citizen, Peacemaker, Gaia Captain, Disillusioned, New Chair, Bad Ending 최종 보상과 route completion token 추가. |
| persistence | ✅ | `200_fsp_campaign_ch7_to_ch10.sql`에 환경, 위치, NPC, 의장 후보/유권자 테이블, lore, branch, tag, item, chapter seed 추가. |
| full engine/UI 잔여 | 🟡 | Assembly 전용 11석 UI, Gaia 조선소 방어 UI, Three Flags 회담장 protect UI, ending eligibility 자동 추천/락 UI는 후속 P1/P2. |

검증:
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/services/campaign.js` + `server/routes/api.js` require 스모크 통과
- 운영 DB 기준 `200_fsp_campaign_ch7_to_ch10.sql` BEGIN/ROLLBACK 드라이런 통과

---

### v5.28 Campaign Ch1 continue/complete 안정화 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 산소 쟁탈 CONTINUE | ✅ | 진행 중인 `sessionId`가 있으면 `/api/campaign/start`로 새 세션을 만들지 않고 기존 브리핑/시뮬레이션을 이어가도록 수정. |
| Ch1 완료 보상 | ✅ | blueprint/title/mastery/tag/lore/branch 같은 부가 보상을 `SAVEPOINT`로 격리해 한 항목 실패가 전체 완료 500으로 번지지 않게 보강. |
| Ch1 구식 id | ✅ | Ch1 unlock/failure branch의 `mcc_ch2`, `mcc_ch6` 구식 id를 `mcc_campaign_ch2`, `mcc_campaign_ch6` 상수 경로로 정정. |

검증:
- 운영 DB 읽기 전용 schema/status 점검
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/services/campaign.js` + `server/routes/api.js` require 스모크 통과
- `index.html` 인라인 script 파싱 통과
- `git diff --check` 통과

---

### v5.27 Campaign Quick Button 기준 위치 재조정 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 데스크탑 CAMPAIGN 버튼 | ✅ | 오른쪽 줌 컬럼의 되돌리기 버튼 위에 배치. |
| 모바일 CAMPAIGN 버튼 | ✅ | 왼쪽 하단의 "화성을 클릭하여 영토 선택" 모드 배지 바로 위에 배치. |

검증:
- `index.html` 인라인 script 파싱 통과
- `git diff --check` 통과

---

### v5.26 Campaign Quick Button 위치 보정 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 데스크탑 CAMPAIGN 버튼 | ✅ | 하단 중앙 액션 영역에서 제거하고 좌측 패널 오른쪽 상단 보조 액션 위치로 이동. |
| 태블릿/모바일 CAMPAIGN 버튼 | ✅ | 하단 네비, OPS split card, 줌 컬럼과 충돌하지 않도록 상단 왼쪽 작은 pill로 이동. |

검증:
- `index.html` 인라인 script 파싱 통과
- `git diff --check` 통과

---

### v5.25 FSP Campaign Ch5~6 MVP + Campaign UI 압축 — 구현 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| FSP Ch5 Kepler Commons | ✅ | Liang Wei, Roth dead drop, Kepler 회담, 산소 보급 시한, Commons/중재/압박/전투/전면 공개 분기를 서버 시뮬레이션으로 추가. |
| FSP Ch6 The Mole | ✅ | Kenji Tanaka 진범, Sarah/Diego red herring, 단서 수집/심문 지표, 처형/이중첩자/추방/오판 분기 추가. |
| 조건부 선택 검증 | ✅ | Ch5 Roth 데이터 압박/전면 공개 선택은 증거 flag가 있을 때만 허용. Ch5/Ch6 hard block도 서버 시작 조건에 반영. |
| Campaign UI | ✅ | 메인 지도 CAMPAIGN 퀵 버튼 추가. QUESTS 안 캠페인 목록은 진행 가능/진행 중 카드만 크게 보이고 locked chapter는 접힘 compact list로 축소. |
| persistence | ✅ | `199_fsp_campaign_ch5_ch6.sql`에 신규 환경, 위치, NPC, dead drop, internal zones, clue/suspect pool, lore, branch, tag, item, chapter seed 추가. |
| full engine/UI 잔여 | 🟡 | Ch5 3파벌 회담 전용 테이블 UI, Ch6 수동 단서 수집/심문 루프, NPC 표정/zone map/real-time combat는 후속 P1/P2. |

검증:
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/services/campaign.js` + `server/routes/api.js` require 스모크 통과
- `index.html` 인라인 script 파싱 통과
- 운영 DB 기준 `199_fsp_campaign_ch5_ch6.sql` ROLLBACK 드라이런 통과
- `git diff --check` 통과

---

### v5.24 FSP Campaign Ch4 Diplomacy MVP — 구현 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| FSP Ch4 Diplomacy | ✅ | Sandstone Junction 비밀 회담, Cinder Grace 첫 등장, Amara 보호, MCC 정찰 회피 MVP 시뮬레이션 추가. |
| 협상 선택지 | ✅ | 피난소 제공/보급 공유/정보 교환/증거 공유/협상 중단 5개 선택지와 Cinder 동맹 강도, CV/FSP 평판 변화를 서버 보상으로 계산. |
| 조건부 증거 공유 | ✅ | `fsp_ch4_evidence_share`는 FSP Ch3 공식 작전 lore 또는 MCC cross-route 산소 노예제 branch evidence가 있어야 선택 가능. |
| persistence | ✅ | `198_fsp_campaign_ch4_diplomacy.sql`에 Sandstone Junction, Cinder Grace, 신규 환경, lore flag, branch modifier, tag, item, chapter config seed 추가. |
| Ch5/Ch6 spec 상태 | 🟡 | 전달된 FSP Ch4~6 문서에서 Ch5/Ch6는 placeholder라 이번 범위에서 제외. 다음 spec 수령 후 이어서 구현 필요. |
| full engine/UI 잔여 | 🟡 | 외교 전용 UI, Amara 보호 객체, MCC 정찰선 조건부 호위전, Phobos shadow escape 연출은 후속 P1/P2. |

검증:
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/services/campaign.js` + `server/routes/api.js` require 스모크 통과
- `index.html` 인라인 script 파싱 통과
- 운영 DB 기준 `198_fsp_campaign_ch4_diplomacy.sql` ROLLBACK 드라이런 통과
- `git diff --check` 통과

---

### v5.23 FSP Campaign Ch1~3 MVP — 구현 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| FSP Ch1 Breakwater | ✅ | New Athens 차 두 잔 의식, H2O 호송 2척, 응급 환자 2명, CV 약탈단, cargo/patient 상태 MVP 시뮬레이션 추가. |
| FSP Ch2 Ice Caravan | ✅ | 태양광 노출 얼음 손실, Phobos Eclipse 활용 횟수, Lena 생존/신뢰, Sal Cruz 매복 결과를 서버 지표로 계산. |
| FSP Ch3 Blood Mine | ✅ | Verin-7 산소 조절기, 알람 여부, 412명 광부 구출률, 60명 잔류 존중, Samuel/Amara 신뢰 분기 추가. |
| FSP persistence | ✅ | lore flag, branch modifier, tag, NPC, environment, item, settlement seed를 `197_fsp_campaign_ch1_to_ch3.sql`에 추가. |
| 정착지 seed | ✅ | `settlement_data`를 idempotent하게 생성/확장하고 New Athens/Cold Brook/Ridge Town/Hellas Central 초기값 추가. |
| full engine/UI 잔여 | 🟡 | Tea Ceremony, Patient Gauge, Ice Gauge, Solar Exposure, Oxygen Regulator UI와 실제 battle object 연동은 후속 P1/P2. |

검증:
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/services/campaign.js` + `server/routes/api.js` require 스모크 통과
- `index.html` 인라인 script 파싱 통과
- 운영 DB 기준 `197_fsp_campaign_ch1_to_ch3.sql` ROLLBACK 드라이런 통과
- `git diff --check` 통과

---

### v5.22 MCC Campaign Ch8~10 MVP — 구현 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| Ch8 Prometheus | ✅ | 4-phase environmental sequence와 Branch A 파괴/Branch B·C 방어 MVP 시뮬레이션, Prometheus Titan/조기 Ending 3 분기 반영. |
| Ch9 Broken Alliance | ✅ | 4전장 선택, NPC 전장 자동 결과, Pilgrim Arms 24척 공개, Amara/Butcher/Chen 운명 branch modifier 반영. |
| Ch10 Shareholder Ending | ✅ | Ending 1~4 + fallback cinematic-only 챕터, 엔딩별 GP/XP/평판/아이템/tag/lore/cross-route modifier 지급. |
| 엔딩 자격 계산 | ✅ | Branch A/B/C, Chen 사망, Roth 데이터, MCC 평판, blackmail data 조건을 서버에서 계산하고 부적격 엔딩 선택을 거부. |
| 루트 선택 검증 | ✅ | Ch7~9 선택지가 활성 Ch6 루트 prefix와 맞지 않으면 `/api/campaign/choice`에서 차단. |
| seed migration | ✅ | `196_mcc_campaign_ch8_to_ch10.sql`에 lore flag, branch modifier, tag, NPC, special asset, item, achievement, environment/chapter seed 추가. |
| full engine/UI 잔여 | 🟡 | Ch8 phase UI, Ch9 4전장 실시간 UI, Ch10 엔딩 시네마틱/크레딧/NG+ UI는 후속 P1/P2. |

검증:
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/services/campaign.js` + `server/routes/api.js` require 스모크 통과
- `index.html` 인라인 script 파싱 통과
- 운영 DB 기준 `196_mcc_campaign_ch8_to_ch10.sql` ROLLBACK 드라이런 통과
- `git diff --check` 통과

---

### v5.21 MCC Campaign Ch5~7 MVP — 구현 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| Ch5 Kepler Commons | ✅ | low gravity/oxygen pressure 환경과 FSP 차단, 보급선 호위, 단독 데이터 탈취, CV 자급 모선 격파 4분기 MVP 시뮬레이션 추가. |
| Dr. Roth 데이터 | ✅ | Ch5 성공 경로에서 Roth 외계 기원 데이터, 플레이어 공개, Roth 실종 lore flag와 XP 보너스/데이터 artifact 보상을 지급. |
| Ch6 Whistleblower | ✅ | Li Fang 지원/Chen 보고/자료 사본 보관 3개 선택으로 A/B/C 루트를 확정하고 tag, lore, ending branch modifier를 지급. |
| Ch7 Market War | ✅ | Ch6 루트별 A/B/C 변형 선택지와 CV 군벌 제거, Helion 자회사 인수, Chen 감시 branch modifier를 반영. |
| 루트 선택 검증 | ✅ | Ch7 시작 조건이 `mcc_route_a/b/c_active` 중 하나를 요구하고, `/api/campaign/choice`가 활성 루트와 맞지 않는 Ch7 선택지를 거부. |
| status endpoint 호환 | ✅ | `player_branch_modifiers`의 실제 정렬 컬럼 `set_at`을 사용해 Ch7 branch availability 합산 중 500이 나지 않도록 수정. |
| seed migration | ✅ | `195_mcc_campaign_ch5_to_ch7.sql`에 lore flag, branch modifier, tag, NPC, data artifact, 신규 환경, chapter/environment seed 추가. |
| full engine 잔여 | 🟡 | Ch5 산소 보급선/Kepler 서버/CV 모선, Ch6 방사선 폭풍 탈출, Ch7 시장전 함대/경제 객체는 후속 전투 엔진 통합 필요. |

검증:
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/services/campaign.js` + `server/routes/api.js` require 스모크 통과
- `index.html` 인라인 script 파싱 통과
- 운영 DB 기준 `195_mcc_campaign_ch5_to_ch7.sql` ROLLBACK 드라이런 통과
- `git diff --check` 통과

---

### v5.20 MCC Campaign Ch2~4 MVP — 구현 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| Ch2 Frozen Highway | ✅ | Hellas 채굴장 인수 MVP 시뮬레이션 추가. 시설 HP, 민간인 피해, 민병대 격파, FSP 증원 ETA, `war_criminal` 실패 분기 반영. |
| Ch3 Boardroom | ✅ | Helion/Verin/Chromium 3분기 선택과 branch별 보상/난이도/Ch6·Ch7 modifier 반영. |
| Ch4 Pirate's Payroll | ✅ | Kara Vex 첫 만남, Ion Storm, Helion 습격대 도주/생존/호감 분기와 Ch9·Ch10 modifier 반영. |
| seed migration | ✅ | `194_mcc_campaign_ch2_to_ch4.sql`에 22개 lore flag, 6개 branch modifier, `clean_operator`, 신규 환경, NPC, chapter seed 추가. |
| 시작 조건 | ✅ | 서버가 prerequisite, required level, required reputation, blocking tag를 검증. Ch2 거부 시 Ch3 마지막 기회 branch override 허용. |
| 보상/분기 지급 | ✅ | GP/XP/평판/아이템 inbox/lore/tag/branch modifier를 기존 complete 트랜잭션 경로로 처리. |
| UI 범용화 | ✅ | 캠페인 카드/결과 모달이 Ch1 산소 지표에 고정되지 않고 Ch2~4 주요 metric을 표시. Locked chapter 버튼 비활성화. |
| full engine 잔여 | 🟡 | Ch2 구조물/민간인 객체, Ch3 신규 함선, Ch4 NPC protection/manual-only mode는 후속 전투 엔진 통합 필요. |

검증:
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/routes/api.js` require 스모크 통과
- `index.html` 인라인 script 파싱 통과
- 운영 DB 기준 `194_mcc_campaign_ch2_to_ch4.sql` ROLLBACK 드라이런 통과
- `git diff --check` 통과

---

### v5.19 Campaign Common Systems — 구현 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| campaign progress/session | ✅ | 기존 Ch1 진행 테이블을 유지하면서 `campaign_sessions`, attempts, best/last metrics를 추가해 재접속/재시도 기반을 마련. |
| reputation system | ✅ | MCC/FSP/CV/Pilgrim Arms 축 지원, -100~100 clamp, tier label, `reputation_history` 감사 로그 추가. |
| tags/titles | ✅ | `tag_definitions`, `player_active_title`, player tag API 추가. grant/revoke는 admin secret 필요. |
| lore flags | ✅ | `lore_flag_definitions`, player/global lore flag 기반 추가. set endpoint는 internal-only, check/get은 조회용. |
| branch modifiers | ✅ | modifier definition/player modifier 테이블 및 active 조회 API 추가. Ch1 실패 modifier도 공통 테이블에 기록 가능. |
| environment system | ✅ | 5개 환경 정의 seed와 Ch1 dust storm intensity curve seed 추가. 서버 helper가 현재 phase/modifier를 계산. |
| campaign UI | ✅ | QUESTS CAMPAIGN 패널에 3축 평판 게이지 추가. |
| status payload | ✅ | 캠페인 미시작 유저도 reputation 4축 기본값 `0`을 받도록 보정. |
| security audit | ✅ | 클라이언트가 보상/평판/태그/분기를 결정하지 않도록 조작성 endpoint는 `x-admin-secret`/`x-admin-key` 필요. |
| P2/P3 잔여 | 🟡 | 복잡 조건 evaluator, chapter spec validator, admin rollback 도구, full engine 환경 hook은 후속 단계. |

검증:
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/routes/api.js` require 스모크 통과
- `index.html` 인라인 script 파싱 통과

---

### v5.18 MCC Campaign Ch1 "산소 쟁탈" MVP — 구현 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 기존 quest 시스템 호환성 | ✅ | daily/weekly quest 진행 테이블을 건드리지 않고 `player_campaign_progress`로 분리해 기존 QUESTS 로직과 충돌을 피함. |
| 캠페인 DB 기반 | ✅ | chapter 메타, 진행도, 선택지, 평판, 태그, lore flag, branch modifier, reward inbox 테이블 추가. |
| `/api/campaign/*` | ✅ | status/start/choice/progress/complete 5개 엔드포인트 추가. wallet/player_id alias와 session 검증 적용. |
| 선택지 위변조 방어 | ✅ | 서버가 chapter 정의의 choice id만 허용하고, 이미 선택한 세션은 첫 선택지만 유지. 클라이언트 보상 payload는 받지 않음. |
| 보상 지급 | ✅ | GP/XP/평판/칭호/환경 숙련도/blueprint inbox/진행도 갱신을 완료 트랜잭션 안에서 처리. |
| 시뮬레이션 결정성 | ✅ | wallet + session_id + choice_id 기반 seed로 같은 세션 결과가 서버에서 결정됨. |
| UI 진입 | ✅ | QUESTS 탭에 CAMPAIGN 카드, 브리핑 선택지, 진행 애니메이션, 결과 모달 추가. |
| Phase 2 잔여 | 🟡 | v11.1 전투 엔진 통합, Helion 전용 함선/화물선 HP 보존 목표, 프롤로그 route lock/NG+는 다음 단계로 분리. |

검증:
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/routes/api.js` require 스모크 통과
- `index.html` 인라인 script 파싱 통과
- `git diff --check` 통과

---

### v5.17 내 영토 테두리 두께 완화 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 내 영토 금색 테두리 | ✅ | halo `7px → 4.5px`, crisp line `2.2px → 1.5px`로 완화. |
| 배경 텍스처 가독성 | ✅ | 내 영토 fill alpha와 shadow 강도를 낮춰 Mars 텍스처를 덜 가리도록 조정. |
| 커밋/푸시 운영 규칙 | ✅ | `CLAUDE.md`에 audit/changelog 동반 업데이트 규칙 추가. |

검증:
- `index.html` 인라인 script 파싱 통과

---

### v5.16 영토 시인성/텍스처 예산 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 내/남/NPC 영토 구분 | ✅ | 내 영토 금색, 다른 플레이어 cyan, NPC 회보라 점선으로 단순화. |
| 업로드 이미지 claim | ✅ | 이미지가 있는 영토도 동일한 외곽선/halo 체계를 적용. |
| 텍스처 품질/렉 균형 | ✅ | 기본 4K 유지, 고성능 데스크톱만 6K, 수동 opt-in일 때만 8K 합성. |

검증:
- `index.html` 인라인 script 파싱 통과

---

### v5.15 POI 광물 발견 실패 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| Ancient Ruins 발견 실패 | ✅ | `mineral` 보상 POI가 `poi_discoveries` CHECK 제약에서 롤백되던 문제 수정. |
| 운영 DB 즉시 복구 | ✅ | 운영 `poi_discoveries_reward_type_check`에 `mineral` 허용 반영. |
| 보상 표시 | ✅ | `mineral` 보상을 아이콘/이름/수량으로 표시하도록 프론트 보강. |

검증:
- 운영 DB 제약조건 확인
- `index.html` 인라인 script 파싱 통과

---

### v5.14 하이잭 자동승리 영토 표시 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| NPC/무함대 자동승리 표시 | ✅ | 새 픽셀 없이 적 픽셀만 하이잭해도 공격자 claim을 생성하고 이전 픽셀 `claim_id`를 새 claim으로 연결. |
| 클릭/렌더 불일치 | ✅ | `pixels.owner`는 내 지갑인데 `claims` 대표 레코드가 없어 NPC 라벨/색으로 보이던 케이스 차단. |
| Phase 2 audit | ✅ | 전투 승리 후 사후 생성한 claim id를 `hijack_battles.new_claim_id`에 기록. |
| 즉시 렌더 | ✅ | 자동승리 응답 직후 프론트 임시 claim이 `lat/lng/w/h` 필드명을 사용하도록 수정. |

검증:
- `server/services/hijack.js` `node --check` 통과

---

### v5.13 전수 버튼/하이잭 플로우 감사 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 하이잭 진입점 | ✅ | 영토 이전 없는 legacy `/api/hijack/declare` UI 진입 제거. 실제 영토 하이잭은 `/api/hijack/declare-with-pp`만 사용. |
| legacy 하이잭 API | ✅ | 서버에서 `/api/hijack/declare`는 `410 HIJACK_DECLARE_DEPRECATED`로 차단. |
| 제거된 서비스 버튼 | ✅ | `weeklyChallenges`, `gpBurn`, `luckyBox` player/admin UI가 404/503 API를 호출하지 않도록 정리. |
| 버튼 핸들러 | ✅ | `index.html`, `admin.html`, tactical-lab inline handler 전수 검사에서 누락 0건. |
| 보조 API 연결 | ✅ | `/api/fleets/my` alias 추가, World Event fallback, Governor declaration 저장 버튼 수정. |

검증:
- `index.html` / `admin.html` 인라인 script 파싱 통과
- 전체 서버 JS `node --check` 통과
- hijack/battle/routes require 스모크 통과
- 제거된 legacy endpoint 문자열 grep 확인

---

### v5.12 핵심 플레이 라인 검수 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 함선 건조/수리 | ✅ | `recipe_minerals`, `iron_ore` 차감이 실제 `user_resource_inventory(resource_id)` 스키마를 사용하도록 수정. 동시성 안전을 위해 `quantity >= required` 조건으로 원자적 차감. |
| 자원 제작 | ✅ | `resourceCraft`의 제작 시작/완료/취소 환불을 전부 `resource_id` 기반으로 정정. |
| 고급 강화 재료 | ✅ | `enhancementAdvanced`의 재료 조회/차감을 `resources.code -> resource_id` 조인으로 정정. |
| 하이잭 Phase 1 | ✅ | 전투 엔진과 시작 통계 모두 프리깃/구축함만 반영하도록 수정. |
| 하이잭 HP 보존 | ✅ | `applyBattleResults()`가 실제 `result.timeline.frames` 마지막 프레임을 읽어 HP를 반영하도록 수정. |
| 영토 정보 HIJACK 버튼 | ✅ | 전투-only `/api/hijack/declare` 모달 대신 PP 정산/픽셀 이전이 포함된 클레임 하이잭 플로우(`/api/hijack/declare-with-pp`)로 연결. |

검증:
- 전체 서버 JS `node --check` 통과
- `services/` + `routes/` 전체 require 스모크 통과
- `index.html` 인라인 script 9개 `vm.Script` 파싱 통과

---

### 브라우저 네이티브 다이얼로그 — 완전 제거 완료

**`confirm()` / `prompt()` / `alert()` 잔여 개수: 0**

| 파일 | 교체 전 | 교체 후 | 사용 함수 |
|------|---------|---------|-----------|
| `index.html` | confirm 15 + prompt 10 + alert 1 = 26 | 0 | `gameConfirm()`, `gameInput()`, `gameAlert()` |
| `admin.html` | confirm 70 + prompt 5 + alert 275 = 350 | 0 | `adminConfirm()`, `adminInput()`, `showToast()` |
| `tactical-lab-v11.html` | confirm 1 | 0 | `#forfeit-overlay` 인라인 오버레이 |

### 인게임 모달 함수 목록 (§18 상세)

| 함수 | 파일 | 용도 | 비고 |
|------|------|------|------|
| `gameConfirm({icon,title,body,confirmText})` | index.html | 확인/취소 — Promise | async/await 필수 |
| `gameInput({title,label,placeholder,defaultValue,maxLength})` | index.html | 텍스트 입력 — Promise | null=취소 |
| `gameAlert(msg)` | index.html | 단순 알림 | 확인 버튼만 |
| `shopConfirm(icon,title,msg,btn)` | index.html | 쇼핑 전용 — Promise | 신규코드엔 gameConfirm 사용 |
| `adminConfirm(msg, title)` | admin.html | 확인/취소 — Promise | async/await 필수 |
| `adminInput(msg, defaultVal, title)` | admin.html | 텍스트 입력 — Promise | null=취소 |
| `showToast(msg, type, duration)` | admin.html | 단순 알림 토스트 | type: 'success'/'error'/'' |
| `#forfeit-overlay` + `cmdForfeit()` | tactical-lab | RETREAT 전용 오버레이 | iframe 격리 환경 |

---

## v5.10 변경 요약 (2026-04-28)

### 1단계: confirm() 제거
| # | 내용 | 수정 |
|---|------|------|
| 1 | index.html confirm() 15곳 | gameConfirm() Promise로 교체, 일부 함수 async화 |
| 2 | admin.html confirm() 70곳 | adminConfirm() Promise로 교체, 67개 함수 async 추가 |
| 3 | tactical-lab RETREAT confirm() | #forfeit-overlay CSS 인라인 오버레이로 교체 |

### 2단계: prompt() + alert() 완전 제거
| # | 내용 | 수정 |
|---|------|------|
| 4 | admin.html showToast() 미정의 | 신규 구현 — 기존 95곳 undefined 호출 정상화 |
| 5 | admin.html adminInput() 미정의 | 신규 구현 — prompt() 5개 교체, 3개 함수 async화 |
| 6 | admin.html alert() 275개 | showToast()로 일괄 교체 |
| 7 | index.html prompt() 10개 | gameInput()으로 교체 (영토이름·콘텐스트·렌탈·동맹 입출금·창설) |
| 8 | index.html alert() 1개 | gameAlert()으로 교체 |

### 수정 파일
- `index.html`: 26개 네이티브 다이얼로그 → 인게임 모달
- `admin.html`: 350개 네이티브 다이얼로그 → showToast/adminConfirm/adminInput
- `assets/tactical-lab-v11.html`: RETREAT 오버레이, SPEED 패널, maxHp WS 보정

# OCCUPY MARS — Codebase Audit (v5.9 / 2026-04-27)

## 🔴 v5.9 변경 요약 (2026-04-27)

### 함대전 HP 보존 + 후퇴 + 속도 조절 + 무한 전투

| # | 이슈 | 원인 | 수정 |
|---|------|------|------|
| 1 | 전투 시간제한 초과 시 HP 비율로 승자 결정 | battleEngine MAX_TICKS(9000) 초과 fallback으로 HP 비교 | MAX_TICKS=54000, 타임아웃 결과를 draw로 변경. 전투는 함선 전멸로만 끝남 |
| 2 | HP바가 100%에서 안 움직임 | WS frame의 HP가 로컬 카탈로그 HP보다 훨씬 커서 항상 100% 이상 | captureFrame에 maxHp+side 추가, WS 첫 프레임에서 atkMaxHP/defMaxHP 재보정 |
| 3 | 내 이름이 적 함대 패널에 표시 | loadBvSidePanels가 지갑 prefix vs nickname 비교 오류 | participants 배열 기반으로 wallet 직접 비교 |
| 4 | 전투 포기 불가 | 없음 | /api/battles/:id/forfeit 신규 endpoint, RETREAT 버튼, forfeit postMessage 처리 |
| 5 | WS 스트리밍 느림 | tickMs/4 (4x) | tickMs/8 (8x)으로 변경 |
| 6 | 로컬 시뮬 속도 조절 없음 | 없음 | SPEED 패널 ×1/×2/×4/×8 버튼 추가 (WS 모드에서는 비활성) |

### 수정 파일
- `server/services/battleEngine.js`: captureFrame maxHp+side, MAX_TICKS 54000, timeout→draw
- `server/services/battleScheduler.js`: tickMs/8
- `server/routes/fleetBattles.js`: POST /api/battles/:id/forfeit
- `assets/tactical-lab-v11.html`: WS maxHp 보정, RETREAT 버튼, SPEED 패널, cmdForfeit()
- `index.html`: forfeit postMessage 핸들러, loadBvSidePanels 수정, showBattleResult "나" 배지

# OCCUPY MARS — Codebase Audit (v5.8 / 2026-04-27)

## 🔴 v5.8 변경 요약 (2026-04-27)

### 하이젝 후 영토 즉시 금색 반영

| # | 이슈 | 원인 | 수정 |
|---|------|------|------|
| 1 | 하이젝 auto_win 후 Railway에서 영토가 NPC색으로 남음 | 서버 응답에 어떤 픽셀이 이전됐는지 없어 API 재요청에 의존 → Railway DB 레이턴시로 여전히 NPC owner 반환 | 서버 응답에 `hijacked_pixels`+`new_pixels_list` 추가 → 클라이언트가 `_serverPixels` 즉시 업데이트 후 `_rebuildOwnerData()`+`compositeClaimsOnTexture()` 호출 |

### 수정 파일
- `server/services/hijack.js`: `declareHijackWithPP` return에 `hijacked_pixels`, `new_pixels_list` 추가
- `index.html`: auto_win 핸들러에 즉시 반영 로직 추가 (기존 2s+6s 재시도 백업으로 유지)

# OCCUPY MARS — Codebase Audit (v5.7 / 2026-04-26)

## 🔴 v5.7 변경 요약 (2026-04-26)

### 모바일 텍스트 + 골드 시각 강화

| # | 이슈 | 원인 | 수정 |
|---|------|------|------|
| 1 | 모바일 영토 모달 좌표/크기 텍스트 검정 (불가시) | `.mob-territory-card .mt-val`이 `var(--tx1)` 사용 (미정의 CSS 변수 → 브라우저 fallback 검정) | `var(--tx)` (크림 `#E8E0D8`)으로 변경 |
| 2 | 내 영토 골드 색상이 화성 표면에서 잘 안 보임 | fill alpha 0.40, halo/border 강도 약함 | alpha 0.65, shadowBlur 12, halo lineWidth 10, inner 3으로 강화 |

### 수정 파일
- `index.html`: CSS `.mob-territory-card .mt-val` + `compositeClaimsOnTexture` isMine 파라미터

# OCCUPY MARS — Codebase Audit (v5.6 / 2026-04-26)

## 🔴 v5.6 변경 요약 (2026-04-26)

### 하이젝 전투 3종 수정

| # | 이슈 | 원인 | 수정 |
|---|------|------|------|
| 1 | 하이젝 함대전 후 함선이 즉시 파괴됨 | `applyBattleResults`가 battle_type 구분 없이 모든 전투에서 함선 삭제 | hijack 전투: 시뮬 HP 반영 + 0 이면 max_hp×15% 보존, is_alive=true 유지 |
| 2 | 전투 뷰어 튕기며 TIMELINE_NOT_FOUND | 폴링 15s 안에 타임라인 저장 완료 안 됨 (스케줄러 30s 간격) | 폴링 60s 연장, 전투 진행 중이면 에러 없이 대기 (iframe WS 처리) |
| 3 | Railway에서 하이젝 후 영토 갱신 안 됨 | auto_win 후 2s 딜레이가 Railway DB 레이턴시 못 따라감 | 2s+6s 두 번 재시도, claims 배열도 동기화 |

### 수정 파일
- `server/services/battleEngine.js`: isHijackBattle 플래그 + 함선 생존 로직
- `index.html`: openBattleViewer 폴링 + auto_win 픽셀 재시도

# OCCUPY MARS — Codebase Audit (v5.5 / 2026-04-26)

## 🔴 v5.5 변경 요약 (2026-04-26)

### 내 영토 글로브 골드 하이라이트

| # | 이슈 | 원인 | 수정 |
|---|------|------|------|
| 1 | 내 영토가 다른 영토와 구분 안 됨 | `isMine` 영토에 동일한 지갑 해시 색상 사용 | `isMine=true`면 골드 `{r:255,g:209,b:102}` fill/border/shadow 적용 |
| 2 | 대소문자 다른 지갑 주소에서 `isMine` 미감지 | `c.owner===myAddr` 엄격 비교 | 양쪽 모두 `.toLowerCase()` — myAddr, sort, isMine 체크, showTerritoryInfo |

### 수정 파일
- `index.html`: `compositeClaimsOnTexture` 골드 색상 + `.toLowerCase()` 비교 (4곳), `showTerritoryInfo` 지갑 비교 fix

### 검증
- 캔버스 픽셀 샘플: `[252,205,101,255]` ≈ gold `(255,209,102)` 확인
- _ownerStrips에 내 지갑 존재, _ownerGroups에 Valles Marineris 그룹 존재 확인
- 브라우저 글로브 near-zoom 스크린샷: 내 영토 금색으로 명확히 표시

## 🔴 v5.3 변경 요약 (2026-04-26)

### Tactical-lab 전투 뷰어 4종 버그 수정

| # | 이슈 | 원인 | 수정 |
|---|------|------|------|
| 1 | 기동 버튼 누르면 크래시 | battleEngine.js wedgeSides 처리에서 `f.movement='wedge'` (잘못된 필드) → ws frame 수신 후 MANEUVERS['wedge'] undefined → drawFleets crash | `f.formation='wedge'` 로 수정. 클라 전체 MANEUVERS/FORMATIONS null-safe fallback 적용 |
| 2 | 공격 모션 없음 | ws 활성 시 `fire()` 완전 비활성화 → bullet/laser 한 개도 안 생김 | ws mode에서도 `fire(sh, wsMode=true)` 호출. `visual:true` 플래그 bullet/laser는 `applyDmg` 스킵 (HP는 ws frame으로만 동기화) |
| 3 | 1 vs 1 전투가 캔버스 상단에서 시작 | atkPos 하드코딩 `cy:H*0.15` → 함대 1개면 무조건 상단 | `centeredPos(n, side)` 함수: 1함대면 `H*0.5`, n함대면 H*0.15~H*0.85 균등 분배 |
| 4 | 화면 너무 작음 / 거리 기반 줌 없음 | 카메라 시스템 부재 | 매 프레임 생존 함대 bounding box 계산 → `_camTargetScale` 산출 → lerp 0.025로 부드럽게 줌/팬. `CX.save/translate/scale/translate/restore` 로 월드 좌표 변환 |

### 수정 파일
- `server/services/battleEngine.js`: wedgeSides → `f.formation` (1줄)
- `assets/tactical-lab-v11.html`: 4종 fix (61줄 추가)

## 🔴 v5.2 변경 요약 (2026-04-26)

### 함선 단위 정밀 폭발 이펙트 (Phase 2-E)
- battleEngine.js: ws frame ships 배열에 `code` (ship_type_code) 필드 추가
- tactical-lab-v11.html:
  - `_wsPrevShips` Map — 이전 프레임 생존 함선 id → {x, y, code} 추적
  - 매 frame 수신 시 이전 맵과 diff → 사라진 함선마다 `mkExp()` 호출 (size_class 기반 반경)
  - battleship/titan 격침 시 `mkShockwave()` + 격침 로그 추가
  - fleet dead 전환 시 shockwave 즉시 트리거 (이전에는 shockwave 없이 일괄 dead 처리)
  - `initBattle()`에서 `_wsPrevShips` 리셋

## 🔴 v4.8~v5.1 변경 요약 (2026-04-26)

### Phase 2 — WebSocket 실시간 함대전 4단계 완료
- v4.8 (Phase 2-A): wsServer.js 신규 — battle 채널 + frame/end broadcast + JWT 인증 cmd
- v4.9 (Phase 2-B): tactical-lab v11 안에서 ws 연결 + ws_end 부모에 postMessage → 결과 카드 즉시
- v5.0 (Phase 2-C): fleet-presets ?bid 응답에 dbFleetId/ownerWallet 추가 → ws frame fleet 매칭 (위치/HP/진형/기동)
- v5.1 (Phase 2-D): ws 활성 시 자체 시뮬 fire/damage skip + 자동 재시작 skip

### 사용자 요구 4가지 모두 완료
1. ✅ tactical-lab v11 그대로 이식 (iframe)
2. ✅ 실제 게임 데이터 연결 (catalog + fleet-presets ?bid + ws frame)
3. ✅ 유저 컨트롤 (postMessage + ws cmd → commander_actions → battleEngine)
4. ✅ 실시간 함대전 (hijack manual + AI 자동 + ws frame stream)

### 잔여 (선택, 비필수)
- ~~ship 단위 dbShipId 매핑~~ → ✅ v5.2에서 완료

---

## 🔴 v4.0~v4.7 변경 요약 (2026-04-26)

### Phase 4 (v4.7) — AI 전략 자동 적용
- `services/aiStrategy.js` 신규 — 파벌별 doctrine 가중치 random
- battleScheduler 가 hijack 외 battle 의 양쪽에 commander_actions formation/maneuver INSERT
- Migration 190: `ai_strategy_enabled` settings 토글
- 검증: PvP battle 양쪽 정확히 doctrine 따라 INSERT

### Phase 5 — 사실상 이미 동작 중
- tactical-lab v11 의 SHIPS/MINERALS/FACTIONS 글로벌은 `loadCatalog()` 가 이미 우리 DB catalog API 에서 자동 채움
- FLEET STATUS / SHIP REGISTRY / MINERALS 패널 모두 우리 데이터로 표시
- 추가 작업 불필요

### Battle Viewer 전면 리팩터 — Tactical Lab 통합
- v4.0: 데스크탑 1500×820 오버레이, 모바일 풀스크린 유지
- v4.1: 살아남은 함선 부분 HP 손실 DB 반영 (battleEngine `applyBattleResults`)
- v4.2: 결과 카드 디자인 + 조선소 SVG drawShip + HP 바
- v4.3: tactical-lab v11 iframe 통째 통합 (자체 canvas/HUD/컨트롤 폐기)
- v4.4: `?bid={battleId}` 로 실제 fleet 구성 주입 (`fleet_battle_participants` JOIN)
- v4.5: 사이드 패널 (좌 MY FLEET/RESOURCES, 우 ENEMY FLEET/BATTLE STATS) + postMessage 컨트롤 bridge
- v4.6: Phase 3-B — commanderActions `formation_change` + `maneuver_change` (Migration 189), mutable update, 시뮬 반영

### Migration 189
- `commander_actions.action_type` CHECK 갱신 — formation_change, maneuver_change 추가
- settings: `commander_action_formation_gp_cost`, `commander_action_maneuver_gp_cost` (기본 0)

### 잔여 P1 (다음 사이클)
- **Phase 2**: WebSocket 실시간 frame broadcast (현재는 timeline replay 만)
- **Phase 4**: AI 전략 (PvP/Siege battle 에 자동 진형/기동 명령)
- **Phase 5**: tactical-lab 패널 (FLEET STATUS / SHIP REGISTRY / MINERALS / DOCTRINES) 실데이터 연결

---

## 🔴 v3.9 변경 요약 (2026-04-26)
- **POI 보상에 mineral 추가** (사용자 요청): Migration 188 + reward_type CHECK 갱신 + exploration.js spawn/claim 양쪽 mineral 분기. GP 50 / Item 20 / Mineral 25 / PP 10.
- **NPC 함선 일괄 부여** (사용자 요청 — hijack 함대전 테스트 차단됨): grant-starter-all-npcs 호출. 21 NPC 모두 함대 보유.

---

## 🔴 v3.8 변경 요약 (2026-04-26)
- **로켓드롭 보상 다양화** (사용자 신고 "GP만 존나 나옴"): mineral 카테고리 신규 추가. Migration 187, weight 30/25/25/12/6/2 (gp/item/mineral/xp/pp/cosmetic). 검증: 15개 슬롯에 mineral 7 / item 3 / xp 3 / gp 1 / cosmetic 1.
- **새 로켓 SVG** (`assets/textures/rocket_drop.svg`): 화염 트레일 + 윈도우 + 핀 + 엔진 벨. PNG fallback 유지.
- **viewer 롤백**: v3.7 의 자동승리 viewer 즉시 닫기 → frames<2 시에만 경고 토스트 (viewer 풀 표시 유지).
- **잔여**: POI 보상도 동일 패턴으로 mineral 추가 필요 (다음 사이클).

---

## 🔴 v3.7 변경 요약 (2026-04-26)
- **모바일 OPS 탭 빈 화면** (사용자 신고): 1024 미디어쿼리 `.ops-launch-form ... display:none !important` 가 BASE 모달 내부 발사 폼까지 숨김. 룰에서 `.ops-launch-form` 제거.
- **하이젝 함대전 viewer 빈 화면** (사용자 신고): 자동승리(atk=0 또는 def=0) 케이스에 시뮬레이션 frame 거의 없음 → 빈 캔버스 + "0:00/0:00". `openBattleViewer` 가 atkN/defN 체크 후 viewer 닫고 winner 기준 토스트 표시.

---

## 🔴 v3.6 변경 요약 (2026-04-26)
- **모바일 침공/탐사 버튼 사라짐** (사용자 신고): 태블릿/모바일 미디어쿼리의 `.ops-quick { display:none !important }` 룰이 element class `"ops-quick ops-quick-split"` 둘 다 매치. `.ops-quick:not(.ops-quick-split)` 로 좁혀서 fix. 모바일 전용 split 카드 정상 복원.

---

## 🔴 v3.5 변경 요약 (2026-04-26)
- **리더보드 픽셀 수 부풀림** (사용자 신고): `/api/leaderboard` 가 `claims.width × height` (이론적 직사각형) 로 계산해 BASE 패널의 진짜 카운트(`pixels` 테이블)와 어긋남. 실제 owner 카운트로 변경.

---

## 🔴 v3.4 변경 요약 (2026-04-26)

### 🚨 시스템 결함 fix
- **레벨업 자동 갱신 부재** (사용자 신고): XP 는 누적되는데 `rank_level` 갱신은 admin 수동 호출만 동작. 평생 멈춤.
  - **`services/rank.js` 신규** — single-user `recalcUserRank` (admin 로직 추출, breakthrough conditions 평가)
  - **Lazy trigger** — `GET /user/:wallet/base` 진입 시 fire-and-forget
  - **Periodic scheduler** (`server/index.js`) — 5분 간격, 최근 24h 활성 유저 batch
  - **Migration 186**: settings 4종 (auto_recalc_enabled / interval_seconds / lookback_hours / batch_size). 모두 admin 조정 가능.
  - 검증: lain test → 정상 호출. stuck user (xp 110k, lv 4) → pixels=0 으로 breakthrough 막힘 (정상).

### 잔여 P1 (다음 작업 후보)
- **Level 5+ breakthrough UI** — 현재 사용자가 "왜 안 올라가는지" 모름. 다음 레벨의 조건과 본인 진행도를 명시하는 UI 필요.

---

## 🔴 v3.3 변경 요약 (2026-04-26)

### 사용자 신고 fix
- **함대전 "전투 데이터 로딩 실패"** — `openBattleViewer(undefined)` 호출 시 invalid id 로 15초 폴링 후 토스트
  - Fix: `openBattleViewer` 진입에 `parseInt(battleId)` 가드 + 폴링 실패 시 lastErr 메시지 포함
  - 호출처 2곳 (`confirmHijack`, `challengeAi`) 에 `if (id) setTimeout` 가드 추가

### 검증 완료
- 파벌 선택 시 가장 싼 frigate 자동 지급 — `services/faction.js:148-198` 라이브 동작 확인. 트랜잭션 내 처리, 함대 없으면 자동 생성.

---

## 🔴 v3.2 변경 요약 (2026-04-26)

### 사용자 신고 fix (즉시 대응)
- **Hijack 함대 정보 에러** ("상대 함대 정보 확인 실패")
  - 원인: `phaseC.js` 의 `GET /hijack/:id` 가 `defender-info` 문자열까지 매치 → `parseInt('defender-info')`=NaN → INVALID_ID 400
  - Fix: `:id(\\d+)` regex로 숫자만 매치, 문자열은 다음 라우터(api.js `/hijack/defender-info`)로 fallthrough
  - 검증: NPC 지갑 `0xnpc_elysium_mons` 응답 정상 (`fleetCount:1, aliveShips:1`)

- **거버너/사령관 잔존 표시**: commander 없어졌는데 메인 배너 + 베이스 공지 박스가 잔존
  - 백엔드 `services/governance.js`: `getCommanderInfo`/`getSectorInfo` 응답에서 `commander/governor` 빈 문자열 → `null`, governor/commander 없으면 `announcement` 강제 `''`
  - 클라이언트 `index.html`: `_hideCommanderUI()` 안전망 추가, fetch 실패 또는 commander 비면 즉시 모든 UI hide
  - sector overlay 두 곳에 `&& s.governor` 가드 추가 (orphan 방어 2중화)
- **토스트 위치 거슬림**: 통합 시스템(e764e75)이 정중앙 배치 → 사용자가 옛 3종 분리 시스템 선호
  - **showToast** = 화면 중앙 그린 알약 (옛 위치 그대로)
  - **showFactionToast** = 하단 블루 박스 (옛 자체 구현)
  - **showNotification** = 우상단 카드 (변경 없음)
  - `@supports(env(safe-area-inset-top))` 안의 `top:50%; bottom:auto` 룰 제거

### 신규 슬롯
- **함선 PNG 이미지 슬롯**: `assets/ships/` 디렉터리 + `shipVisual()` wrapping. PNG 없으면 SVG 실루엣 fallback (`<img onerror="this.remove()">`).
  - 적용 위치: 조선소 블루프린트 카드, 건조 confirm 모달
  - 파일명 우선순위: `{code}.png` > `{faction}_{size}.png`

### 인식 정정 (CLAUDE.md §8 잘못된 메모)
| 항목 | CLAUDE.md 메모 | 실제 |
|---|---|---|
| Hijack 실패 시 영토 처리 | "비-primary 디펜더 잔여 P1" | ✅ 정상 동작 — 영토 보존 + PP 90% 환불 (`hijack.js:197,379`) |
| `recipe_minerals` 차감 | "현재 무시됨" | ✅ `ship.js:278` 에서 `resources` JOIN 후 `user_resource_inventory` UPDATE |
| Titan/Battleship Core/Mid 재료 | "추가 필요" | ✅ Migration 163 시드 + Migration 203 (v5.31)로 BS/Titan 6/6 모두 Core+Mid 광물 보장 + invariant assertion + admin settings |
| 함선 수리 UI | "라우트+UI 모두 필요" | ✅ `syRepairShip/syChargeShield/syScrapShip` 모두 라이브 (`index.html:40588~`) |
| 광물 도감 UI | (언급 없음) | ✅ Minerals Panel 모달 + `openMineralsPanel()` 진입 (`index.html:41332`) |

---

## 🔴 v3.1 변경 요약 (2026-04-26)

### 신규 자동화
- **거버너/사령관 자동 만료**: migration 185 + `services/governanceExpire.js` + 1h 스케줄러. 14일 비활성/탈퇴/임기만료 시 자동 자리비움 + 공지 클리어. admin 수동 부담 제거.

### 해소된 P0/P1 (감사 에이전트 결과 반영, commit `135da81`)
| ID | 영역 | Before | After |
|---|---|---|---|
| P0-1 | Shield | `pixel_shields`(상점) 가 hijack 못 막음 | `isClaimShielded/Tx` 가 두 테이블 UNION 조회 |
| P0-2 | Cosmetic | quantity 차감 없음 → 1개로 N장착 | equip -1, unequip +1, 교체 시 이전 cosmetic 환수 |
| P0-3 | Tier | tiers.js miningBonusPct dead code | `/api/harvest` 에 territory_tiers MAX(tier) 곱셈 블록 |
| P1-1 | Harvest cap | multiplier 후 cap → VIP/governor 보너스 무용 | base 직후로 cap 이동, multiplier 가 그 위에서 amplify |
| P1-2 | Season | trackGPSpend 미export → 6개 라우트 silently skip | alias + export |
| P1-3 | logGPActivity | `./gpActivity`(없는 모듈) 잘못된 require | 10개 서비스 일괄 `../db` 로 fix |

### 추가 fix (commit `13efdc0`, `b7aa2bf`, `f424b6a`, `6046673`)
- **Mining tierCounts 응답 누락** → UI 항상 'no land' 표시
- **Mining bestTier 만 roll** → 모든 보유 tier 독립 roll + 합산
- **Governance expire NULL fallback** → 옛 데이터(last_login_at NULL) 도 governor_since 기준 판정
- **고아 announcement 정리** → governor=NULL & announcement≠NULL sector 자동 cleanup
- **거대 토스트 박스** → `.toast{top:50%}` + `bottom:130px` 충돌 fix (bottom:auto + transform)
- **알림창 닫기** → ✕ 버튼 + outside-click
- **출석체크 빈 화면** → QUESTS 탭 진입 시 자동 로드

### 🟡 잔여 known issues
- **P1-4**: hijack 비-primary 디펜더 픽셀 처리 — 의도된 디자인(주 수비자만 공격) 으로 동작 중. 개선 여지 있음
- **CLICK START POINT 박스** — 토스트 stretch 버그였음, 위에서 fix됨

---

# OCCUPY MARS — Codebase Audit (v3.0 / 2026-04-25 — final)

> **이 문서는 코드베이스의 현재 상태를 외부 검토자(Codex 등)에게 넘기기 위한 정리본입니다.**
> 신고된 모든 버그와 자가 진단으로 발견한 이슈, 그리고 검증된 라이브 시스템을 한눈에 볼 수 있도록 구성됨.

## 📊 최종 통계
- **DB 테이블**: 219개
- **Settings 키**: 907개 (모든 라이브 기능 admin 조정 가능)
- **업적**: 29개 (4 카테고리, 4 언어)
- **마이그레이션**: 184개 적용
- **누적 커밋 (이번 작업)**: **27개**
- **Phantom 테이블**: 0개 (이전 35+)
- **검증된 frontend endpoint**: 60+개
- **마지막 커밋**: `3ca106e` — fix(hijack): 지불금액 + NPC 자동승리 + 함대 미리보기

## 🔄 최신 커밋 흐름 (시간 역순)
```
3ca106e  fix(hijack): 지불금액 0.00 + NPC 자동승리 + 함대 미리보기 (사용자 신고 3건)
290ce90  fix(mobile): iPad portrait/iPhone Pro Max landscape 사이드바 자동 열림 + 글로브 안 보임
e764e75  fix(mobile): 사이드바 z-index + 토스트 시각 일관성
2e76af9  docs(v3.0): CHANGELOG + 게임 가이드 'What's New' + AUDIT 최종화
0a48f17  fix: 추가 endpoint 버그 일괄 (전체 endpoint 감사 결과)
cfa8c10  fix(bugs): 사용자 신고 3건 + 테스트 중 발견 2건
```

## ✅ 사용자 신고 버그 (이번 세션 — 모두 해결)
| # | 신고 | 원인 | 처리 | 커밋 |
|---|---|---|---|---|
| 1 | 일일 출석체크 'Daily login failed' | getSetting() string 반환을 array로 사용 → INSERT NaN | JSON.parse + Array.isArray 가드 (services/daily.js + routes/api.js daily/status) | cfa8c10 |
| 2 | JOBS admin 통계 빈 값 | backend `{distribution}` vs frontend `{byJob, noJob, recentChanges}` shape mismatch | `routes/job.js` /admin/jobs에 byJob (per-job avg_gp/avg_pp 집계) + noJob + recentChanges | cfa8c10 |
| 3 | EVENTS 탭 빈 화면 | `switchTab()` cats 배열에 `'worldevents'` 누락 → .cat-worldevents 영원히 display:none | cats 배열에 worldevents 추가 (admin.html line 2716) | cfa8c10 |
| 4 | 모바일 사이드바 잡아먹힘 (하단 잘림) | `.panel-r/.panel-l` 모바일 open 시 z-index 120 < `.mob-bottom-nav` z 200 | z 250, padding-bottom safe-area + 110px, panel-close-fixed z 260 | e764e75 |
| 5 | 토스트 시각 일관성 부족 | showToast/showFactionToast 시각·위치·alias 모두 제각각 | 통합 .toast CSS (accent color만 type별 변경), showFactionToast→showToast 위임, 'red'/'green'/'h' legacy alias 자동 normalize | e764e75 |
| 6 | iPhone 양쪽 사이드바 열림 + 글로브 안 보임 | `@media(max-width:768px)`만 처리 → iPad portrait(820), Pro Max landscape(932), split-screen(800~)에서 데스크탑 layout 적용되어 panel 250+250=500px 가 글로브 가림 | 새 `@media(max-width:1024px)` 블록 — 태블릿도 슬라이드 패널, mob-toggle/mob-bottom-nav 표시, panel-tab 숨김. DOMContentLoaded에서 `innerWidth≤1024`면 .open 강제 제거 (캐시 방어) | 290ce90 |
| 7 | 하이젝 지불금액 0.00 PP 표시 | NPC 점령 영토 `pixels.price = 0` → `0 × 1.2 = 0` (무료 하이잭 가능) | `Math.max(existing.price, sectorBasePrice) × HIJACK_MULT` (client + server 4곳) | 3ca106e |
| 8 | NPC 함선 줬는데 자동승리 처리 | defender fleet lookup이 ORDER BY만 하고 HAVING 없음 → 빈 함대도 선택돼 phase1 결함 | `HAVING alive_ships > 0` 명시, 디버그 로그, 신규 `/admin/api/fleet/npc-status` 진단 endpoint + admin 버튼 | 3ca106e |
| 9 | 하이젝 시 상대 함대 정보 미표시 (사용자 추가 요청) | 디클레어 전에 자동승리/함대전 여부 알 방법 없음 | 신규 `/api/hijack/defender-info` + 모달에 "Fleet N개 · 함선 M척 → 함대전" 또는 "함대 없음 → 자동 승리" 라벨 표시 | 3ca106e |
| 10 | iPhone 에 사이드바 stale 상태 (close 버튼 미표시) | Service Worker `mars-v3` 캐시가 옛 index.html 을 iOS 단말에 보존 → 새 CSS/JS fix 적용 안 됨 | sw.js: CACHE_NAME → `mars-v4`, `/index.html` pre-cache 제거, HTML 문서 network-first 분기 신규, index.html에 controllerchange auto-reload 핸들러 + SKIP_WAITING 메시지 처리 | (이번 커밋) |
| 11 | 태블릿 (820px) 바텀 네비 두 줄 중복 렌더링 (실제 페이지 감사 중 발견) | `.col-fab-wrap.show` 가 `display:block` 강제 → `@media(max-width:1024px) .col-fab-wrap{display:none}` 무시됨 (same specificity). 데스크탑 col-fab + 모바일 mob-bottom-nav 동시 표시 | `.col-fab-wrap, .col-fab-wrap.show { display:none !important }` + `#myLandBtn`, `.ops-launch-form`, `.ops-quick` 도 1024 이하 숨김 | 92a8e7f |
| 12 | 구매가능 섹터가 admin 변경 후 즉시 반영 안 됨 ("다른 창 열었다 닫아야") | 서버 `_sectorsCache` 60s TTL + 클라 `_sectorsData` 가 BASE 모달 열 때만 refresh | 서버: `invalidateSectorsCache()` + admin/governance 변경 시 즉시 호출. 클라: `refreshSectors()` 함수 + 60s polling + visibility/focus + sector toggle / claim modal 진입 시 자동 refresh | 6dee1a8 |
| 13 | 거버너/사령관 메시지가 변경 후 안 사라짐 + 페이지 두 번 로딩 | (a) globe 의 governor 라벨이 `marsCanvasTexture` 캐시에 그려져 sector data 갱신해도 텍스처 재합성 안 됨. (b) commander 박스가 announcement 빈 케이스 처리 안 함. (c) SW auto-reload 가 매 업데이트마다 `location.reload()` 호출 | (a) `refreshSectors()` 에 diff 검사 + 변경 시 `marsCanvasTexture=null` + 재합성. (b) `loadCommanderBanner()`: commander 없거나 announcement 빈 케이스 박스 숨김 + textContent 비움. (c) SW auto-reload 제거. HTML network-first 로 자연 nav 시 새 콘텐츠 적용 + 1h background `reg.update()` 만 | f8e545a |
| 14 | commander 교체 시 옛 announcement 잔존 ("커맨더 표시는 왜 남김?") | governance 서비스 commander 교체 SQL 이 `announcement` 컬럼을 NULL 로 클리어 안 함 | `UPDATE commander SET commander_wallet=$1, commander_since=NOW(), announcement=NULL` + `loadCommanderBanner()` 에 visibilitychange/focus 리스너 추가 | (이번 커밋) |
| 15 | 처음 로딩 시 모든 high-tier 섹터가 entry-blocked 로 표시, BASE 누르면 정상 | sector overlay 가 `profileLevel` DOM 에서 user level 읽음. BASE 모달 안 열면 DOM 이 default '1' → 모든 entryMinLevel>1 섹터 잠금. | auto-login `/api/auth/me` 성공 시점에 `/api/user/:wallet/base` 미리 fetch → profileLevel 채움 + 텍스처 재합성 | d63aa4b |
| 16 | 거버너/사령관/공지 자동 expire 로직 부재 ("아직도 수정 안된 듯") | governor/commander 는 siege/admin replace 외엔 자동 사라지지 않음. 캐시 버그가 아니라 **expire 메커니즘 자체가 없는 것**. 사용자는 "임기 끝났다" 생각하지만 DB 엔 데이터 그대로 남음. | admin clear endpoint 3개 신규: `/governance/commander/clear`, `/governance/sector/:id/clear`, `/governance/clear-all`. admin UI 에 버튼 추가 (사령관 초기화 + 전체 거버넌스 초기화). 모두 sectors cache 무효화 호출. | (이번 커밋) |

## ✅ 자가 진단 버그 (테스트 중 발견 — 모두 해결)
| 영향 | 원인 | 처리 |
|---|---|---|
| /api/achievements 500 | ORDER BY a.sort_order (없음) | a.condition_value, a.key |
| /api/profile 500 | users.avatar_color/motto 컬럼 없음 | migration 184 추가 |
| /api/branding/my, spells admin 500 | claims.x1/y1/x2/y2 (실제: center_lat/lng/width/height) | 컬럼명 정정 |
| /api/resources/my 500 | i.resource_code (실제: resource_id FK) | JOIN resources r ON r.id = i.resource_id |
| /api/raffles/active 500 | /raffles/:id가 'active' parseInt → NaN | :id(\d+)로 숫자 제한 |
| 15+ 서비스 u.wallet JOIN 에러 | 이전 fix 시 WHERE만 정정, JOIN 누락 | u.wallet_address로 일괄 정정 |
| /api/claims/my 404 | endpoint 자체 없음 | routes/api.js에 추가 |
| /api/burn/* 404 | gpBurn 삭제됐으나 frontend UI 잔존 | UI 숨김 + loadBurnPanel no-op |

## 🟢 검증된 라이브 시스템 (현재 모두 동작)

### 핵심 게임 루프
| 시스템 | endpoint | 검증 |
|---|---|---|
| 클레임/픽셀 | /api/claims, /api/pixels | ✅ 300+ records |
| GP 경제 | gp_balance + gp_transactions + gp_activity_log | ✅ |
| 하이잭 (PVP) | /api/hijack/declare-with-pp + phaseC.js | ✅ |
| Fleet Combat | /api/fleets, /api/ships/* | ✅ 22 ship types, fleet detail OK |
| 공성전 | /api/siege/* | ✅ |
| 거버넌스 | /api/governance/leaderboard, /bounties | ✅ |
| 시즌 점수 | /api/season/active, /season/leaderboard | ✅ 1 season active |
| 마켓플레이스 | /api/marketplace/listings | ✅ |
| 옥션 | /api/auction, /api/auctions | ✅ |
| 일일 미션 | /api/daily/status, /missions, /login | ✅ Day 3, rewards 5/10/15... |
| 업적 | /api/achievements + auto-trigger | ✅ 29 achievements |
| PVP 베팅 | /api/betting/events, /bet, /mine | ✅ warBetting 단일 시스템 |
| 로켓 드롭 | /api/rockets | ✅ event #12 incoming |
| POI | /api/poi/* | ✅ |
| 파벌 | /api/factions | ✅ 3 factions (mcc/fsp/cv) |
| 길드 | /api/guild/leaderboard, /my | ✅ |
| 직업 | /api/jobs (5 jobs) | ✅ |
| 자원 | /api/resources/catalog, /my | ✅ 13 resources |
| 거버넌스 (commander/governor) | /api/governance/* | ✅ commander Woo |

### 보조 기능 (검증 통과)
- 영토: branding, monuments, tiers, spells, sponsors, shields, rentals, upgrades
- 플레이어: status, beacons, capsules, banners, graffiti, vtag, journals, milestones, highlights, ratings, tombstones
- 경제: stakes, polls, wagers, contests, donations, broadcasts, expeditions, raffles
- 미니게임: lottery, dividends, news, crafting

## 🟢 의도된 레이어드 아키텍처 (병합 불필요)
- chronicle + chronicleEnhanced (base + Discord wrapper)
- title + titleExtended (basic 13 + advanced 11)
- enhancement + enhancementAdvanced (instancing + recipe bonuses)
- job + jobs routes (user-ops + catalog)
- resource + resources routes (admin + user)
- auction + auctionRoutes (ops + listing)
- tournament + tournaments services (fleet + simple)

## 🟡 의도적 보류 (별도 작업, 영향 미미)
없음 — 이전 보류 4건 모두 처리됨.
- ✅ Fleet Combat 활성화 (이미 enabled, UI 정합성 fix)
- ✅ routes/ships.js 정리 (실제로는 신 fleet 시스템이었음, CLAUDE.md 메모 정정)
- ✅ news.js retention (24h 스케줄러 + retention setting 동작 확인)
- ✅ referral_count 최적화 (idx_users_referred_by 인덱스 존재)

## 🔴 알려진 미해결 (영향도 낮음, 의도적)
- battle.js / battle 라우트: 완전히 제거됨 (PVP는 fleet+hijack으로 통합)
- routes/ships.js의 일부 endpoint는 JWT auth만 (frontend가 매번 토큰 송부)
- /api/auth/me 404: frontend가 사용 안 함 (JWT decode local-side)

## 📚 문서 (모두 최신)
- **CHANGELOG.md** ← v3.0 패치 노트 (개발자용 상세)
- **CLAUDE.md** ← 신규 세션 핸드오프 (§13~16 보강)
- **AUDIT_FINDINGS.md** ← 이 문서 (기능별 매트릭스)
- **index.html in-game guide** ← "What's New" 섹션 신규 추가 (4개 언어 모두)

## 🆕 신규 진단/검증 API (이번 세션 추가)

| Endpoint | 목적 | 권한 |
|---|---|---|
| `GET /api/hijack/defender-info?wallet=` | 하이젝 모달에서 상대방 함대 미리보기 (auto-win vs fleet battle 사전 판단) | public |
| `GET /api/claims/my?wallet=` | 내 영토 목록 (expedition 셀렉터 등) | public |
| `GET /admin/api/fleet/npc-status` | NPC 전수 진단 (함대전 가능 vs 자동승리 위험 분류) | admin |
| `POST /admin/api/fleet/grant-starter-all-npcs` | NPC 전수 함대+함선+광물 일괄 지급 | admin |

## 🧪 실제 페이지 렌더링 감사 (Claude Preview 사용)

이번 세션 마지막에 실제 브라우저 렌더링 테스트 수행:

| viewport | 결과 |
|---|---|
| Desktop (1280x720) | ✅ 글로브, 패널 collapsed (default), 토글 버튼, 바텀 네비 정상. 콘솔 에러 0건. |
| Mobile (375x812 iPhone X) | ✅ 패널 transform=-319/+319 (off-screen), mob-toggle 보임, mob-bottom-nav 보임, 사이드바 열기/닫기 X 버튼 정상. |
| Tablet (820x1180 iPad portrait) | ⚠️ → ✅ 초기엔 col-fab-wrap + mob-bottom-nav 동시 렌더 (바텀 네비 2줄). `!important` 처리 후 단일 표시. |
| Admin EVENTS 탭 | ✅ Bug #3 fix 검증. World Events (Void Raiders) 섹션 정상 표시. |
| Admin JOBS 탭 | ✅ Bug #2 fix 검증. TOTAL/NO JOB/RECENT/PAID stat cards + JOB DISTRIBUTION 테이블 + RECENT CHANGE LOG 정상. |

추가로 발견된 SW 캐시 이슈 → mars-v4 + HTML network-first + auto-reload 로 해소 (Bug #10).

## 🛡 검증 방법론

이번 작업에서 사용한 audit 방법:
1. 사용자 신고 스크린샷 직접 분석 → 정확한 원인 추적
2. **로컬 서버 가동** (port 3000) + curl로 60+ frontend endpoint 직접 호출
3. 5xx/404 응답마다 server.log 확인 → 코드 수정 → 재테스트
4. PostgreSQL 직접 쿼리로 schema mismatch 추적
5. node 스모크 테스트 (require 모든 services/routes)
6. index.html `<script>` 13개 syntax 검증

→ **다른 사람이 이 audit을 재현하려면**:
```bash
# 1. 서버 가동
DATABASE_URL=postgresql://jongho@localhost:5432/pixelwar \
JWT_SECRET=test-key ADMIN_SECRET=test-admin \
node server/index.js > /tmp/server.log 2>&1 &

# 2. endpoint 일괄 테스트
WALLET=0x... ; for ep in /api/claims/my /api/fleets /api/achievements; do
  curl -s -o /dev/null -w "%{http_code} $ep\n" "http://localhost:3000$ep?wallet=$WALLET"
done

# 3. 로그 확인
tail -30 /tmp/server.log | grep -E "error|warn"
```

---

*이 audit은 OCCUPY MARS 메인 컨텐츠(영토 점령, 함대 전투, 채굴, 거버넌스, 마켓)와*
*38개 보조 기능 모두 정상 동작을 검증한 결과입니다.*
