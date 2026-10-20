# 실제 고정 매도 계약을 적용한 좁은 경제 비교 — 2026-10-21

기존42회 결과와 두 frozen 모델의 파일은 바꾸지 않았다. 새 비교는 `mixed_medium`, `buyer_shortage`, `bots_matched_capital`에 기존3seed를 적용한 **9회 한 번**이다.112일·48계정의 역할/행동 운전기는 재사용하되 시장 클래스 의존성 한 곳만 메모리에서 치환한다. 실제 서버·DB·API·동시성 전체 replay가 아니다.

## 실행과 보존

```sh
node --test server/tests/economy-source-market-comparison.test.js
node --max-old-space-size=768 server/tools/economy_source_market_comparison.js --out ../../outputs/evidence/economy-source-market-20261021
```

새 디렉터리에만 `summary.csv`, `summary.json`, `daily.csv`, `comparison.csv`, `parameters.json`, `run-receipt.json`을 쓴다. 기존 디렉터리의13파일은 실행 전후 SHA-256이 모두 같았다. 기존 driver SHA-256은 `fa69d88afa16f363fdaf82194ff3b2445b49b4f7470f8ccec51d2fd588e070d7`, 기존 회계 모듈은 `2ef69ccdc0ba137dc5a0055035b8c9bb4e16d284f2ee908b433692dd07973200`으로 유지된다. 원본을 수정하지 않아 복구용 사본으로 대체하지 않았다.

치환 대상은 정확히 한 번 존재하는 `const book = new OrderBook({`의 클래스 생성 의존성뿐이다. 변경 전/메모리 치환 후 source hash와 occurrences=1을 receipt에 기록한다. Node Module로 원본을 그대로 재컴파일한2일·6계정 결과가 기존 `runCase`와 동일함도 확인했다. source-market2일·6계정 CSV의 별도 compact 재현도 일치했다. 전량9회는 재실행하지 않았다.

## 확인한 소스 계약

실제 운영 DB의 설정값을 읽지 않았다. 아래는 작성된 마이그레이션을 적용한 프로필이다. `parameters.json.sources`가 읽은 소스의 해시를 보관한다.

| 항목 | 채택한 계약/근거 |
|---|---|
| 등록 기본료 | migration079는2GP seed,082는10GP UPDATE,220은5GP UPDATE. 따라서5GP를 사용한다. `marketplace.js` 누락 설정 fallback2와 구분한다. |
| 동적 등록료 | 현재 active listing수가5이상이면2배,10이상이면4배(migration082 DO NOTHING 작성값). source는 ceil 후 직업 할인을 floor한다. 직업 할인 없는 가지이므로5/10/20GP이다. 서비스 누락 설정 fallback1.5/2배와 구분한다. |
| 등록 상한 | migration079의20개. 기존 synthetic 운전기의3개 제한을 비교 옵션20으로 바꿔, 매도 등록3개가 즉시구매 의사를 부당하게 막는 문제를 피한다. |
| 만료 | migration079/서비스 fallback168시간. `expires_at < now`의 strict 조건을 적용한다. source 만료 scheduler는5분이지만 운전기에서의 만료 처리는6시간 결정 시점으로 근사한다. |
| 가격/수량 | 가격은 **전체 묶음 총액**이며 허용 범위1..999999GP. resource_quantity와 함께 전량 escrow한다. |
| 구매 | 현재 고정 listing을 선택해 즉시 전체 대금을 지급하고 전량 수령한다. bid 선예치·지속 bid·부분 체결·남은 bid 잔액이 없다. |
| 매매 수수료 | 총가격의5%, microGP 단위 floor. 무직업·할인 없음·일반 영토·무관세·eligible 추천 upline 없음의 가지이다. |
| pool/소각 | 추천 지급0. source `dividends.addToPool`의20% nominal을6자리로 반올림하고 captured-fee 예산 안에 둔다. schema110이 있다는 가정이다. pool을 소각/매출로 세지 않는다. |
| 만료 자원 반환 | active→expired로 바뀐 listing만 미판매 전량 반환한다. 등록료는 환급하지 않는다. 같은 listing을 다시 만료해 자원이 중복 반환되지 않는다. |

행동상 자산당 한 개 listing 선호는 유지한다. source상한20을 허용하지만 이 비교에서는 자원3종만 등록하므로 보통 동적5/10구간에 도달하지 않는다. 동적 구간 자체와20개 hard cap은 좁은 테스트에서 확인했다.20개를 강제로 등록하는 별도 전량 프로필을 추가하지 않았다.

제작 실드는 `crafting.js`가 `user_items` stack으로 지급하고, 실제 marketplace item 경로는 `item_instances` 소유권을 요구한다. 원 운전기의 `item:energy_shield` 합성 거래는 source-market 모드에서 등록/구매 미지원으로 구분하여 제외한다. 제작/실드 사용 자체는 원 운전기에 남는다. 기존 total trades에는 이 합성 실드가 포함되므로 **새 resource-only total trades와의 차이는 시장 계약과 지원 자산 범위 차이를 함께 포함한다.** 공통 자산인 철 거래량·VWAP·재고도 함께 비교한다.

## 행동 입력과 추론 경계

가격·unit willingness·역할 확률·봇 활동·초기 자본·소비 선택은 그대로 합성 가정이다. 매수자는 현재 판매 중인 서로 다른 controller의 listing 중 단가가 가장 낮은 것을 고르고 자신의 unit 한도 이하이면 전체 묶음을 산다. 의도 수량5라도 NPC listing10개의 총대금6GP를 감당하면10개 전량을 수령한다.5GP밖에 없으면 부분 매수하지 않고 아무 잔액·자원 변경 없이 거부된다.

공통 controller 거래는 제외한다. 이는 실서비스 controller 식별 기능을 구현했다는 뜻이 아니다. source는 실제 listing 선택 구매이며, 이 비교에서 최저 단가 listing 선택은 합성 수요 행동이다.5개 철×0.6GP=3GP 매출에 등록5GP와 판매5%를 내면 성공해도 판매자의 순현금흐름은-2.15GP다. 합성 판매자는 이를 최적화하지 않고 등록할 수 있으므로 체결·등록료 소각을 합리적 시장 균형이나 이익으로 해석하면 안 된다.

다음 차이가 동시에 있다:120→168시간 expiry, 지속 bid/선예치/부분 체결 제거, 전체 묶음 매수, 행동 cap3→source cap20, 지원 자산 범위와 source pool 반올림. 따라서 만료 시간 하나만 바꾼 실험이라고 부르지 않는다. 같은 seed라도 시장 분기에 따라 공유 RNG의 이후 사용 순서와 행동이 달라질 수 있다. seed별 조건 비교이며 paired causal 효과·신뢰구간·실수요 추정이 아니다.

기존 전체 경제 범위 한계도 유지한다. 대표 일반 함선, 실제 원장의 일부 수식, 가상 역할/호가만 사용한다. 전체 가챠·강화·대형함·품질·랭크·PvP 보상·영토 유지비·모든 생산/소비를 복제하지 않으므로 게임 전체의 적정 발행률/인플레이션/경제 건전성을 판정하지 않는다. GP/일반 PP에 현금 청구권을 추가하지 않고 USDT 고객 부채·준비금은 기존 별도 원장을 유지한다.

`runs[].boundary`는 재사용한 driver가 출력한 일반 범위 경고를 보존한다. 그 안의 옛 proxy bid 표현은 이 비교의 시장 구현 설명으로 사용하지 않는다. 실제 시장 모드는 `summary.source_mode`, 이 문서와 `parameters.json.sourceProfile`을 따른다.

## 결과와 지표 정의

최종 결과는9행 summary,1008행 daily다. baseline은 기존42회 `summary.json`에서 profile+seed로 읽어 join한다. 원래 결과를 다시 만들지 않는다.

- `listingCreated`: 자금·자원을 확인하고 등록료/전량 escrow를 실제 반영한 매도 listing 수.
- `listingSold`: listing 전량 즉시구매가 정산된 수. 한 listing은 한 번만 판매한다.
- `listingExpired`:168시간을 넘겨 실제 만료 처리한 수.
- `horizonOpenReturned`:112일 horizon 종료 때 아직 열린 listing의 인위적 회계 반환 수. 실제 만료/유찰로 부르지 않는다. 종료 전 이미 만료된 것은 먼저 만료로 분류한다.
- 항상 `Created=Sold+Expired+HorizonOpenReturned`이다.
- `purchaseAttempts`: 합성 매수 의사가 즉시구매 함수까지 도달한 수. `Sold + noEligibleListing + priceRefusals + fundingDenials + unsupportedAsset`로 분해한다. 미지원 stack/단가 거절/전체 묶음 대금 부족을 구분한다.
- `fundedBidOrders=0`이다. 기존 운전기의 `filledOrders`는 ask+bid 양쪽이고 `expiredOrders`는 양쪽과 horizon 반환이 섞였으므로 새 listing 판매율/만료율과 직접 % 차이를 계산하지 않는다.
- `comparison.csv`는 공통 화폐 흐름·체결수·철 거래량/가격/재고·controller/봇 집중도만 baseline/source/difference로 join한다. GP net 차이는 바뀐 거래/활동·미션 완료에 따른 source별 신규 보상 변화도 포함한다. `issuanceSourcesGP`에서 출처를 따로 확인한다.
- 전체 자원 재고와 가용 판매 물량은 구분한다. 재고가 많아도 구매 의사·접근·수익성·물량 수용이 충분하다는 뜻은 아니다.

원장 보존·역할 손익·listing 분해·purchase 분해 오류는9회 모두0이었다. seed3개에서 source 모드 철 지표:

| 조건 | 철 거래 수량 | 철 VWAP(GP/개) | 봇 GP지분 |
|---|---:|---:|---:|
| mixed_medium |1855–2295|0.5592–0.5678|0%|
| buyer_shortage |160–315|0.4938–0.5030|0%|
| bots_matched_capital |1395–1840|0.5378–0.5536|33.03–33.20%|

이 범위는 선택한3seed에서 관찰한 가정 실행 결과이다. 운영 시장의 가격 예측이나 봇 실제 성공률이 아니다.

## 검증과 자원 사용

좁은 테스트6개가 전량 구매/자금 부족 불변/가격 거절/공통 controller 제외/168시간 strict 만료/멱등 반환/horizon 분리/작성 수수료·상한·총가격 제한/stack 제외/반올림·예산 보존/원본 compile 동일/compact 재현을 검사했다.6/6 통과했다.

전량9회는 한 번만 실행했다. 실행 CPU3.837초, 벽시계2.601초, 관측 heap93.87MB, max RSS228.43MB, 결과291811bytes였다. 선행 모델 CPU73.933초와 합친 알려진 모델 CPU는77.770초로100초 이내다. 새 실행 자체도15초 CPU/30초 벽시계/768MiB heap/20MiB 출력 제한 이내다. 독립적인 좁은 테스트 과정은 별도이고 전량 재실행은 없다. 정확한 값·해시·기존13파일 보존 결과는 새 receipt에 있다.

네트워크·패키지 설치·실DB·`.env`·키·계정·지갑·체인·운영·배포·서버 프로세스를 사용하지 않았으며 기존42회 산출물에 쓰지 않았다. 새 full event log도 만들지 않았다.
