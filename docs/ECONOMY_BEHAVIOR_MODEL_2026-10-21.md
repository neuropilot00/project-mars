# 다중 seed 경제 행동 민감도 모델 — 2026-10-21

42개 결과는 **선택한 소스 정책과 행동 가정 아래의 부분 경제**를 실행한 것이다. 게임 전체 인플레이션·적정 가격·수익성·유지율을 판정하지 않는다. 48계정의 고정 시작 재산으로 112일을 실행한다. 신규 이용자와 토큰 가격 상승을 수입으로 가정하지 않는다. 기존 게임/시뮬레이터 코드를 수정하지 않고 새 운전기와 검증만 추가했다.

## 실행

```sh
node --test server/tests/economy-behavior-sensitivity.test.js
node --max-old-space-size=768 server/tools/economy_behavior_sensitivity.js --out ../../outputs/evidence/economy-sensitivity-20261021
```

최종 산출물은 `summary.csv`, `summary.json`, `daily.csv`, `parameters.json`, `run-receipt.json`이다. 상세 이벤트는 쓰지 않는다. 실제 경과·CPU·heap·RSS·출력 크기·SHA-256와 compact CSV 재현 여부는 receipt에서 확인한다. 같은 폴더의 선행 receipt가 있으면 누적 실행 CPU/벽시계도 더하여 상한을 검사한다. 출력 내용의 결정성은 CSV/경제 결과에 해당하며, 실제 실행 시간은 매번 달라진다.

기준 정책: `behavior-sensitivity-2026-10-21-v1`. seed는 `20261021`, `20261022`, `20261023`. 가상 기준일은 UTC 2026-10-21, 의사 결정은 6시간마다, 기간은 112일(7일 출석/주간 경계 16주)이다. 건조/채굴 완료는 의사 결정 주기에 맞춰 즉시 처리하지 않고 **25분/4시간 뒤의 실제 가상 due time**에 처리한다. 72시간 전쟁과 48시간 cooldown이 별도라는 소스 해석을 적용한다.

## 재사용 범위

기존 `economy_scenario_simulation.js`의 `Ledger`, `Custody`, `POLICY`, 정수 금액 함수, 실드 레시피 `craft`, 단일 함선 `repairCost`를 사용한다. 실제 API/SQL/전투/마켓 서비스를 호출한 것은 아니다. 원래 `runScenario`와 instant `build`는 사용하지 않는다. 새 건조 큐·역할·고정 호가·자금 예치 주문·시장 체결 운전기를 작성했다. `Ledger`/`Custody`의 매 사건 검증과 역할별 GP 손익 보존식으로 결과를 확인한다. 실제 서버 동시성이나 상품 수요 검증을 대신하지 않는다.

원래 모델의 파일 해시는 `2ef69ccdc0ba137dc5a0055035b8c9bb4e16d284f2ee908b433692dd07973200`으로 유지된다. 기존 pending-spend/reorg/경매 최소 probe를 변경 없이 실행한 결과는 `summary.json.legacyAndPendingProbes`에 별도로 보존한다. 그 probe는 새 운전기의 현실성을 보증하는 추가 관측치가 아니다.

## 소스 값과 가정

실제 운영 DB의 설정값을 읽지 않았다. 자세한 마이그레이션 우선순위는 별도 `ECONOMY_SENSITIVITY_POLICY_SOURCES_2026-10-21.md`, 기계 판독 입력과 소스 해시는 `parameters.json`을 따른다.

| 항목 | 적용한 값/회계 |
|---|---|
| 대표 함선 | 일반 MCC frigate, HP32000, 60GP, 철5/탄소3, 건조1500초(25분). |
| 시작 재산 | 계정마다200GP·일반 함선2척·철20/탄소10/실리콘6. 합성 기존 재산이며 신규 무료 지급 정책이 아니다. 모두 source opening으로 분리한다. |
| 채굴 | 실제 함선당 capacity1. 선택한 함대=min(소유 함선,4). 보상=capacity×4h×3GP, 지갑별 이전24h 1500GP 상한. global funded 보상 풀은 만들지 않고 신규 GP 발행으로 기록한다. |
| 손상/수리 | HP는 참가 함선의 평균이다. 단일 함선 `repairCost`를 **참가 손상 함선 수만큼 GP·철 모두 곱한다**. 새 함선이 참가하면 기존/새 HP를 가중 평균한다. HP50% 미만에서 수리 시도는 행동 가정, 채굴 출항 최소HP15%는 소스 값이다. |
| 수리 true burn | 수리 비용20%는 `victory_slot_pool`,80%만 실제 소각. migration313 schema가 있다는 가지를 가정한다. pool 지급은 모델링하지 않으며 pool 잔액을 소각하지 않는다. schema 없는 full-burn 가지는 최종42개 결과에 섞지 않았다. |
| 광물 | Frontier 철 .50/탄소 .30/실리콘 .20, 수량1..10, capacity·시간에 따른 roll. miner 직업 가산은 넣지 않는다. 완전한 DB drop table/희귀자원 운전기가 아니다. |
| 출석 | 작성된 `[8,12,16,20,22,25,40]`, 3일30GP/7일150GP, PP 상당은 GP로. cycle reset 첫날만 seed GP4..12 + PP상당0/10/20GP, 이후 일차는 설정 배열을 쓰는 실제 분기를 반영한다. |
| 영토 수확 | 성공1회=가정한0.1PP 상당1GP, 작성된 일일0.3PP cap에 따라 하루3회까지만 지급·미션/주간 카운트.4번째 시도는 지급0/카운트0. |
| 일일 미션 | 실제 assignable 유형 중3개를 seed로 선택. 미지원 유형은 보상0으로 남는다. 실제 모델 수확/매수 체결/건조 완료/전투 승리만 대응 진행도를 올린다. 미션 전체 완료50GP는 선택된3개가 모두 완료되어야 지급한다. 활동과 무관한 무조건50+50 발행을 하지 않는다. |
| 주간 | 실제 영토 수확20회→400GP, 확인된 가상 전쟁 격침3회→500GP를 주간 한 번 지급. `weeklyChallenge.js`는 pool 차감 없이 GP를 더하므로 comment의 carve와 달리 **신규 발행**으로 센다. claim5회→300GP는 확장 driver가 없어 미포함. 함대 채굴 job을 영토 수확 카운트로 오인하지 않는다. |
| 제작 |50GP·철5·실리콘3, 성공80%, 실패GP50%환불. 성공 산출물은 실드 아이템1개, 모델 수요자가 실제로 구매하거나 사용한다. |
| 시장 | 등록5GP, 판매5%. 추천 대상/upline을 만들지 않아 실제 추천 지급0. fee의25%는 최대 base이고 자동 지급액이 아니다. schema110이 있다고 가정하여 fee20%를 dividend pool로 보관하고 나머지를 소각한다. staking OFF/새 staker 없음; pool을 자동 배당하지 않는다. |
| NPC | 고정 새 NPC 한 명에게 한 번200GP와5자원 각40개. 재보충/새 identity/무제한 매수 없음. 이 운전기에서는 그중 철/탄소/실리콘3종만 거래하고 나머지80자원은 남는다. |
| 고소비 비교 | 고활동 fighter/trader/builder가 주1회500GP robot-part draw 또는300GP standard crate를 번갈아 시도. 자금 부족은 거부한다. 접근이 해제된 기존 계정이라는 조건이며 결과는 일반 collection proxy로만 보관한다. 실제 odds·등급·재판매·해체·채굴 capacity를 부여하지 않는다. |
| 함선 실드 소비 | 같은 역할이3일마다 가상 용량1000에서 **실제 부족한 단위만**×0.05GP로 충전. 시간당3% decay를 6시간 단위로 내림해 적용한다. 가득 찬 실드에 반복해서50GP를 태우지 않는다. 용량1000과 행동 빈도는 가정이다. |

합체 GP비용0을 새 GP sink로 만들지 않는다. GP 고정 가격이 확인되지 않은 hijack은 GP sink로 넣지 않는다. 강화/대형함·Titan 건조·희귀 채굴·품질·랭크 제한·영토 유지비·가챠 후 재판매/해체/강화·base PvP 보상·시즌·전체 레거시 보상은 포함하지 않는다. 따라서 고소비 가지도 모든 게임 소비를 대표하지 않는다. 가격·소비 빈도·성장 동기를 조절해 경제가 안정적이라고 만드는 정책 튜닝을 하지 않았다.

## 역할과 조건

6역할(miner, crafter, builder, trader, casual, fighter)을 순환 배정한다. 계정은 활성 의사 결정 주기마다 역할별 확률에 따라 채굴·제작·건조·등록·매수·수확·전투·아이템 사용을 시도한다. low/medium/high 활성 확률은 6시간마다25%/60%/95%, 봇은100%이다. 세부 행동 확률은 `parameters.json.roleActionProbabilityPercentPerActiveStep`에 모두 공개한다.

| 프로필 | 조건 |
|---|---|
| miner_heavy | miner24/crafter6/builder6/trader6/casual6/fighter0, 동일48계정·동일 시작 총량·중간 활동. |
| fighter_builder_heavy | fighter16/builder16/나머지4역할 각4, 동일48계정·동일 시작 총량·중간 활동. |
| mixed_low / mixed_medium | 낮은/중간 활동, 추가 인원0. |
| high_consumption | 높은 활동+자금이 있을 때만 위 가챠/실드 선택 소비. |
| zero_entrants_no_purchases | 유입0, 구매0. 초기 가상 고객 예치 잔액은 수입으로 세지 않는다. |
| player_decline |28일 후3일마다 한 명 활동 중단, 최소12명. 재산/고객 부채는 삭제하지 않는다. |
| bots_matched_capital |48계정 중8개를 하나의 봇 controller로 교체. **계정당 시작 자본/2척 capacity는 인간과 동일**. 더 긴 활동과 선택 소비 회피를 가정한다.8계정 시작 자본을 공짜20capacity 한 척으로 압축하지 않는다. |
| whale_hoard / whale_dump | 기존48계정의 GP·철·탄소·실리콘90%를 한 계정으로 이전. 전체 시작 총량은 보존된다. hoard는 자원을 등록하지 않고 자금 내 실제 bid; dump는 기존 재고만 낮은 호가로 등록한다. 매수자는 유한하다. |
| long_peace |112일 전쟁 없음. baseline 역시 전쟁이 없으므로 같은 행동 빈도/seed면 같은 결과가 되는 대조군이다. 이 중복을 새 효과로 해석하지 않는다. |
| war_resource_blockade |28~84일 동안 가상72시간 전쟁/48시간 cooldown 반복,42~70일 광물 공급 proxy10%. 실제 사람이 서로 교전한다는 가정으로 hull loss와 잔해를 기록한다. 실제 전투 승률 예측이 아니다. |
| buyer_shortage | 매수 행동의8%만 실제 주문으로 이어짐. 매도 호가·수수료·재고는 그대로 남아 체결 부족을 관찰한다. |
| withdrawal_run_unknown | 초기 고객 USDT 청구권을90일차에 예약,12시간 뒤 확인 정산.8계정마다1개는 timeout unknown으로 유지한다. 일부 정산 전에 남은 예약은 계속 부채/현금 예약이다. |

## 주문과 지표의 의미

실제 서비스는 고정 매도 listing이다. 새 운전기의 **자금 선예치 limit bid·부분 체결·5일 expiry**는 매수 의사를 조건부로 모델링하는 가정이며 서버 주문서 기능을 구현했다고 주장하지 않는다. 매수 GP와 매도 물건을 먼저 보관하고 호가가 교차할 때만 매도 호가로 정산한다. 미체결/거부/가격 거절/만료 반환을 구분한다. 한 beneficial controller의 계정 간 교차는 체결·volume에서 제외한다. 등록으로 실제 낸 수수료와 예약은 그럼에도 실제로 남고 만료 시 미체결 자산만 반환한다. NPC volume도 인간 거래와 분리한다. 소스의 할인/동적 등록료/관세는 이 프로필에 포함하지 않는다. 특히 기본 철 lot5개×참조단가0.6GP=3GP 매출인데 등록5GP+매매5%를 내면 성공해도 판매자 순현금흐름은-2.15GP다. 이 driver의 확률적 판매자는 이를 최적화하지 않고 등록할 수 있다. 따라서 거래량/소각은 합리적 균형이나 수익성의 증거가 아니며 willingness·lot 크기·등록 의사 자체가 중요한 행동 한계다.

`summary.csv`는 seed×조건42행, `daily.csv`는 run×일4704행이다. 주요 정의:

- GP issuance는 opening을 제외한다. 실제 보상과 finite NPC seed를 source별로 공개한다. GP true burn에는 수수료·수리 pool 잔액을 포함하지 않는다.
- GP transferred는 동일 실소유자 안의 지갑↔주문/건조 escrow 이동을 상쇄하고, 다른 실소유자·수수료 pool로 이동한 순액이다. 자산 교환 volume/신규 발행/매출과 동일한 수치가 아니다.
- 역할 `openingGP`, `faucetsGP`, `marketNetGP`, `consumedGP`, `otherTransfersGP`, `endingGP`를 분리한다. `consumedGP`는 그 역할이 지불한 비용으로 pool 이전을 포함할 수 있다. 게임 전체 true burn은 별도이다. `ending-opening=faucets+marketNet-consumed+otherTransfers`가 맞아야 한다. 잔액 증가를 거래 수익이나 현금 이익으로 부르지 않는다.
- `iron_global_inventory`는 지갑·NPC·주문·건조 escrow를 포함한 철 총량이다. `iron_inventory_wallet_and_asks`는 이용자 지갑+판매 등록 재고이다. `iron_ask_quantity`는 지금 판매 중인 물량만이다. 호딩 상태에서 이 값들이 다를 수 있다.
- `repair_unmet_material_accounts`는 HP50% 미만 수리 목표를 선택한 계정 중 소유 철이 부족한 수, `repair_unmet_funded_accounts`는 수리 GP+현재 최저 매도 호가(없으면 참조가격)로 필요한 철을 살 GP가 있는 수이다. 매수 willingness/refusal과 체결 실패는 별도 계수이다. 이 수리는 행동 목표이며 source 출항 최소HP15%와 다르다.
- longest stockout은6시간 연속 구간이다. 전체 철0·판매 호가0·개별 미충족 수리 재료를 따로 센다. 재료가 가득 찬 비활동 재고가 있다고 실수요자가 살 수 있다고 보지 않는다.
- 철 VWAP/min/max는 실제 서로 다른 controller의 체결만 사용한다. turnover는 거래량/일별 평균 전체 철 재고로 정의한다. 가격은 source NPC 단가를 기준으로 역할/seed의 finite willingness와 고정 ask에서 형성되며 자동±1% 시세 경로가 아니다.
- top1/top10은 각각 한 계정/상위10% 계정의 GP 비중이다. controller 집중도를 별도로 낸다. 봇 지분은8계정 보유 GP/모든 플레이어 GP이며 NPC/pool은 제외한다.

## 고객 예치와 수익 분리

주 스트레스는 기존 코드에 자산 경로가 있는 **USDT**로 표기한다. 계정마다 시작 예치20USDT는 고객 부채와 준비금이 동시에20 늘어나는 가상 기존 자금이다. 신규 인원이 예치해 기존 청구권을 갚는 구조가 아니다. GP와 일반 거래 PP는 환매 청구권을 만들지 않는다.

`purchases=true` 가지는 주1USDT의 가상 비환불 접근 구매를 가용 청구권/가용 현금 안에서만 처리한다. 지급한 현금만 고객 부채에서 사업 수익으로 이동하며 비환불 크레딧을 별도 발행한다. GP/PP 지급은 없다. 구매0/출금-run 가지는 현금 매출0이다. 기존 실제 환매 자격 `redeemable_pp`·스왑 풀·한도·체인 정산을 복제하지 않는다. frozen 최소 probe의 USDC/USDG는 별도 가상 registry이며 주 모델에 해당 자산 입출금 지원을 구현했다는 뜻이 아니다.

unknown 예약금/고객 부채를 함께 공개한다. unknown이 부채보다 작거나 같아야 하고 현금 예약을 소비/잠금으로 재사용하지 못한다. 실제 timeout을 실패로 취급하지 않는다. 최종 출금-run의 계정8개당1개 unknown 비율은 선택한 스트레스 입력이며 실패율 예측이 아니다.

## 검증과 범위

새 집중 테스트8개: 실제 자금 체결/차액 반환, 공통 controller 제외/자금 부족/만료 멱등, 함대N 수리, due-time 완료와 horizon 밖 escrow, seed/CSV 재현, 역할/자원/현금 회계, 동일 자본 봇·unknown 청구권, 역할 분포/일일 수확 상한, 기존 frozen 코드 해시를 확인한다. 전체 driver는 각 일 source 원장 보존식을 다시 확인하고 각 역할 GP 손익 보존식도 검사한다.

최종 receipt는 앞선 임시 실행을 누적해 기록한다. 첫 임시 실행20.531초 CPU와 두 번째14.212초 CPU 및 후속36-case 갱신 실행은 새 최종 결과와 섞지 않으며 최종 소비/plot에는 최종 파일만 쓴다. 제한은 모델 CPU100초·벽시계120초·heap768MiB·출력20MiB이며 compact 재현만 추가한다. 실제 최종 수치와 검사 결과는 receipt에 있다. 네트워크·DB·실계정·키·지갑·배포·서버·추가 패키지·기존 증거 수정은 없고 생성 프로세스는 종료한다.
