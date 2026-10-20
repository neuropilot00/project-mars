# NPC 시장 초기 발행 한도 — 로컬 변경 및 검증

수정 전 `ensureNpcStock`은 매 등록 시도 전에 별도 autocommit 쿼리로 GP를 최소 200, 활성·거래 가능 NPC 자원 5종을 각각 최소 40으로 보충했다. 판매/등록 실패나 반복 틱으로 발행 총량이 계속 늘어날 수 있어 `bounded seed` 주석과 실제 동작이 달랐다.

수정 후 동일한 정규화 지갑(`LOWER(wallet_address)`)의 초기 예산은 평생 한 번이다. 첫 **성공한 등록**의 DB 트랜잭션에서만 현재 GP가 200보다 작으면 차액, 각 해당 자원이 40보다 작으면 차액을 발행한다. 기존 잔액·재고가 더 많으면 그대로 둔다. 초기 발행, 수수료 차감, 자원 에스크로, 실제 마켓 등록, 발행 원장은 모두 함께 commit/rollback한다. `npc_economy_seed_ledger`는 실제 GP와 자원별 발행량을 기록하며, 사용자 삭제 후에도 보존되어 같은 지갑 재생성으로 초기 예산을 다시 받을 수 없다.

`354_npc_seed_budget.sql` 적용 시점의 기존 AI 지갑은 `legacy_existing`, GP 신규 발행 0, 자원 신규 발행 `{}`로 기록한다. 기존 GP와 자원은 수정하지 않는다. 이후 새 AI만 `initial_seed` 대상이다. 원장이 없는 상태에서는 등록·발행을 모두 건너뛴다. 정규화한 주소에 해당하는 사용자가 정확히 1명이고 `is_ai=true`여야 하며, 기존 marketplace 계약에 맞는 소문자 저장 주소여야 한다. 중복 주소·비AI·음수/잘못된 GP·잘못된 해당 자원 수량은 보충으로 덮어쓰지 않고 실패한다.

고정된 새 AI 지갑 N개에 대해 추가 초기 발행 상한은 GP `200 × N`, 각 활성·거래 가능 자원 `40 × N`이다. 초기 발행 시점에 비활성/거래 불가였던 자원은 이후 켜져도 추가 발행하지 않는다. 새 지갑을 무제한으로 만들 수 있는 경우까지 서버 전체 발행량을 제한하는 정책은 아니다. 일일 자동 리필·새 서버 전체 정책 한도는 추가하지 않았다. 기존 NPC 재고가 고갈되면 목표 리스팅 수를 채우지 못할 수 있다. 추후 실제 재원에 기반한 재보충 여부와 재원·이체 규칙은 별도 오너 결정 사항이다.

## 설정과 가격

운영 DB는 읽지 않았다. 아래 값은 변경하지 않은 현재 소스의 시드/폴백이다.

| 설정/항목 | 소스 값 |
|---|---|
| `npc_economy_enabled` | migration 329 시드 `true`; 설정 없음/조회 실패 시 서비스 폴백 `false` |
| `npc_market_target_listings` | 시드·폴백 `10` |
| `npc_market_per_tick` | 시드·폴백 `4` |
| 스케줄 | 기존 leader 스케줄러 10분 유지 |
| 등록 1건 자원 수량 | `10` |
| `iron_ore` / `carbon_fiber` / `silicon_chip` / `titanium_alloy` / `plasma_crystal` | 10개 묶음 **총 가격** 각각 `6` / `10` / `14` / `28` / `36 GP` |

## 마이그레이션 의존성

기존 `users(wallet_address,is_ai)`, `schema_migrations`가 필요하다. 자원 테이블/마켓은 기존 migration 081 등의 계약을 따른다. 기존 `server/migrate.js`가 파일별 `BEGIN/COMMIT`을 수행한다. 354는 그 트랜잭션에서 `users`에 `SHARE ROW EXCLUSIVE` 잠금을 잡아 사용자 생성과 기존 AI 원장 등록 사이 틈을 막는다. 배포/운영 DB 적용은 하지 않았다. 코드만 먼저 적용하면 원장 부재로 NPC 발행·등록이 멈추므로 실제 적용 계획은 migration 의존성을 포함해야 한다.

## 검증

작업 경로는 `/Users/jongho/Documents/Codex/2026-10-10/oc/work/occupy-upgrade`다. 기존 DB/계정/환경 파일/메일/체인/지갑/자금에 접근하지 않았다.

```sh
cd server
env -i PATH=/opt/homebrew/bin:/usr/bin:/bin NODE_ENV=test RUN_SCHEDULERS=false node --require ./tests/isolation-guard.cjs --test ./tests/npc-economy-budget.test.js
env -i PATH=/opt/homebrew/bin:/usr/bin:/bin NODE_ENV=test RUN_SCHEDULERS=false node tools/npc_economy_isolated_regression.js
```

격리 단위 테스트 **11/11 통과**. 실제 PostgreSQL 16 임시 private cluster와 Unix socket, 실제 `npcEconomy.runMarketTick` + `marketplace.createListing`으로 **9개 검증 묶음 통과**:

- migration 없음은 발행/등록 0; migration 적용은 기존 AI 잔액 17 GP/철 3개 그대로, 원장 발행량 0.
- 새 AI의 첫 등록은 총 200 GP/자원 200개 발행. 반복하여 5종 자원 20건을 등록한 후 재고 0, 에스크로 200개, GP 135, 수수료 65 GP, 원장은 최초 그대로. 고갈 후 추가 발행/등록 0.
- 12개 동시 틱은 초기 발행 1회, 철 4건/40개 에스크로만 성공. GP 192, 남은 다른 자원 160개.
- 실제 listing INSERT에 강제 오류를 넣으면 원장·초기 발행·수수료·재고 모두 rollback. 오류 제거 후 첫 성공에서만 예산 지급.
- GP 199.25 및 자원 50/39/39/39/39에서 실제 발행량은 0.75 GP 및 0/1/1/1/1로 기록.
- 비AI/정규화 중복 소유자에는 발행 0. 음수·NaN·null GP, 음수·null 재고도 발행 0.
- 삭제 후 같은 지갑을 재생성해도 원장이 남아 재발행 0.

GP 수수료 65는 fixture에서 기존 소스 폴백을 사용한 결과다: 기본 등록료 2 GP, 기존 5건 이상 배수 1.5, 10건 이상 배수 2.0. 일반 운영 설정/직업 할인에 대한 추정값이 아니다. 실제 서비스의 선택·검증·에스크로·수수료·등록 SQL을 실행했으며 부수 미션/직업 서비스는 명시적으로 fixture/noop 주입했다. 네트워크는 해당 임시 Unix socket만 허용했고 scheduler/application bootstrap을 실행하지 않았다. 종료 코드 0 및 `CLEANUP temporary PostgreSQL cluster removed`를 확인했다. `node --check` 2개 파일 및 이 작업 파일의 `git diff --check`도 통과했다.

## 검증한 소스 SHA-256

| 파일 | SHA-256 |
|---|---|
| `server/services/npcEconomy.js` | `fa979dd4b083d9ed48db5eb73d367455ed281eb4dee011c680d5e2356aab36bd` |
| `server/services/marketplace.js` (기존 공유 변경 포함, 이 작업에서 수정 안 함) | `de8ae608d7bbe3d797fe360e169211f19e43b7b056c40acad884efaa9a2a945e` |
| `server/migrations/354_npc_seed_budget.sql` | `72772bffce871ef8d0fdab53dc99038c90c8c60d28e3c09c88682cd1b4e0ac17` |
| `server/tests/npc-economy-budget.test.js` | `de34a44459b8b27385ebce8180cb64b71934ebb3e0be3a478ead9df4efb237ec` |
| `server/tools/npc_economy_isolated_regression.js` | `d959a560bbd6819c18f8d081e947295a4f22abb14df1ca49e1193ef32da06154` |

위 증거는 로컬 격리 DB의 실제 트랜잭션 동작에 한정된다. 운영 migration·배포·실유저 수요·시장 유동성 유지 검증은 포함하지 않는다.
