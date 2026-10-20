# Occupy Mars 결제·정산 체인 연결 계획

2026-10-21 Asia/Tokyo. **설계 완료 범위**는 Base/Robinhood Chain의 결제·지급 정산을 기존 웹게임과 연결하는 방법이다. 체인 활성화·테스트넷/메인넷 거래·지갑/키/API키 생성·컨트랙트 배포는 실행하지 않는다. 이번 로컬 안전장치 구현 결과는 `CUSTODY_SAFETY_2026-10-21.md`와 구분한다.

## 제품 경계와 우선 경로

게임 가입은 아이디+인증기로 끝낸다. 지갑은 결제/정산이 필요한 사용자가 나중에 연결한다. 영토·함선·파츠는 서버 소유권/재고로 유지하고 경매도 서버에서 정산한다. GP/PP 토큰, NFT, 시세 상승에 의존하는 보상 구조를 도입하지 않는다. GP나 PP를 새로 현금 상환 가능하게 바꾸지 않는다.

권고안은 **Base의 native USDC를 첫 결제 경로**, Robinhood Chain의 native USDG를 별도 어댑터 대상으로 두는 것이다. 이는 사용자의 체인·통화 선택을 대신 확정한 결정이 아니다. USDT는 선택한 체인에서 발행자·브리지·계약·소수점·상환 경로를 확인하기 전 지원 목록에 넣지 않는다.

## 공식 근거와 현재 네트워크

| 구분 | Base | Robinhood Chain |
|---|---|---|
| 네트워크 | Mainnet8453 / Sepolia84532 | Mainnet4663 / Testnet46630 |
| 게임 결제 후보 | Circle native USDC | Paxos native USDG |
| 가스 | ETH. 사용자 또는 서비스의 별도 가스예산 | ETH. 가스 대납도 비용/한도가 필요 |
| 어댑터 분리 | OP 계열의 최종성·RPC 규칙 | Arbitrum 계열의 최종성·RPC 규칙 |
| 지원 판단 | 기존 Base 설정과 연결할 수 있으나 USDT 단일 원장을 그대로 USDC라고 부르면 안 됨 | 현재 앱의 `CHAINS`에는 없음. 별도 자산·네트워크 등록과 인덱서가 필요 |

체인ID와 두 네트워크 존재는 [Base 연결 문서](https://docs.base.org/get-started/connect-to-base), [Robinhood 연결 문서](https://docs.robinhood.com/chain/connecting/)에서 확인했다. 자산은 [Circle 공식 USDC 주소](https://developers.circle.com/stablecoins/usdc-contract-addresses), [Robinhood 공식 토큰 목록](https://docs.robinhood.com/chain/contracts/), [Paxos USDG 메인넷 목록](https://docs.paxos.com/guides/stablecoin/usdg/mainnet)을 기준으로 한다. 배포 직전 공식 목록·체인ID·실제 계약 코드를 다시 대조한다. 같은 심볼의 임의 토큰은 허용하지 않는다.

Robinhood의 native USDC/CCTP/Circle Paymaster 지원은 이번 공식 목록에서 확인하지 못했다. Arbitrum 지원을 Robinhood 지원으로 옮겨 적지 않는다. Robinhood 체인 연결 자체는 Robinhood 앱 입점·제휴를 의미하지 않는다.

[Base 최종성 문서](https://docs.base.org/specifications/transactions/transaction-finality)는 사전확인·L2 포함·L1 배치·L1 최종성을 구분한다. 빠른 receipt를 환급 가능한 고객 잔액의 최종 확정으로 사용하지 않는다. Robinhood도 어댑터에서 canonical/finalized 상태를 판정하며 고정된 몇 초 경과만으로 확정하지 않는다. 체인별 정책은 [Robinhood 최종성 문서](https://docs.robinhood.com/chain/transaction-finality/)를 출시 시 재대조한다.

게임의 같은 L2 지갑 지급과 L1 브리지를 구분한다. Base→Ethereum 표준 브리지에는 문서상5일 또는 이중증명 경로1일 조건이 있고, Robinhood→Ethereum 표준 경로는7일 대기 후 L1 claim이 필요하다. 게임 화면에서 모든 출금을 이 시간으로 표시하지 않는다. [Base 출금 설명](https://docs.base.org/specifications/base-protocol/bridging/withdrawals), [Robinhood 브리지](https://docs.robinhood.com/chain/bridging/).

## 현재 코드에서 재사용하는 것과 바꾸어야 하는 것

| 현재 위치 | 재사용 | 연결 전 필요한 작업 |
|---|---|---|
| `services/chain.js` | 입금 처리·재시작 backfill·중복 처리·출금 대사 | 최종 블록/로그 식별, 커서와 재조직 보정, 자산별 격리 |
| `services/signer.js` | 체인·계약·nonce·만료를 묶은 서명 도메인 | 토큰/정산 asset 식별과 키 권한 분리. 현재 Base/BNB/ETH 설정을 새 체인으로 암묵 전환 금지 |
| `routes/redemptionRoutes.js` | 자금 잠금·미결 예약·조회 실패 시 차단 | 예약/확정/미확인/만료 상태를 일관되게 처리. 안전하지 않은 이전 일괄 초기화 API는 재사용하지 않음 |
| `services/treasury.js` | 같은 DB트랜잭션의 담보·발행 여력 검사 | 예약분 포함한 전체 청구권 보고와 체인/자산별 물리 준비금 대사 |
| `services/totpAuth.js`, `routes/auth.js` | 지갑 없이 게임 로그인 | 아래 별도 지갑 소유권 증명. TOTP 계정에 기존 PK재할당용 link-wallet 경로 사용 금지 |
| `contracts/MarsDeposit.sol` | 입출금 이벤트, nonce·체인·계약을 묶은 서명 구조의 참고 | 단일 토큰 계약·서버서명·수익 인출 권한을 감사하고 적합한 보관 모델을 선택. 현재 계약의 `collectRevenue`는 고객 부채를 온체인에서 알지 못함 |

현재 `users.usdt_balance`/`treasury_ledger.collateral_usdt`는 다중 stablecoin 원장이 아니다. Base USDC와 Robinhood USDG를 같은 숫자 칸에 합산하는 방식으로 확장하지 않는다. 기존 재화의 이름만 바꾸는 마이그레이션도 금지한다.

## 체인 어댑터 계약

어댑터는 게임 보상·영토 판정에 관여하지 않는다. `chainId + tokenContract`가 asset의 식별자이며 토큰 심볼은 표시용이다.

```text
AssetSpec: chainId, network, tokenAddress, decimals, depositContract,
           canonicalityPolicy, minimumAmount, feePolicyVersion, enabled
ChainAdapter:
  validateNetwork()             # 예상 chainId/계약/토큰/decimals 불일치 차단
  readCanonicalFinalizedHead()
  scanDepositEvents(from,to)    # blockHash,txHash,logIndex 포함
  readWithdrawalEvidence(id)    # nonce와 확정 블록·시각을 같은 기준에서 조회
  estimateFee()                # ETH gas + L1 data, 게임 수수료와 별도
  buildUnsignedPayout(intent)   # 실행 권한 없음
```

실제 서명은 별도 승인 계층이 담당한다. Base/Robinhood 어댑터는 각각 꺼진 상태로 등록하고 DB·키·지원자산 설정이 완성된 뒤에만 활성화할 수 있어야 한다. 새 환경의 공개 RPC를 운영 SLA로 간주하지 않는다. 읽기 보조 RPC와 일관성 검사, 쓰기 제한·회로 차단·지연 경보를 둔다.

## 계정과 지갑 연결

불변 `account_id`를 게임 소유자 기준으로 유지하고 `wallet_links(account_id, chain_id, address, verified_at, revoked_at)`를 별도로 둔다. 현재 가상 wallet 키를 외부 주소로 일괄 치환하면 모든 재고/길드/세션 FK와 복구 경계가 바뀌므로 새 연결 모델에서 재사용하지 않는다.

1. 로그인한 사용자가 선택적으로 연결 요청. 새 challenge에 도메인·origin·account_id·목적·체인ID·주소·일회 nonce·만료 포함.
2. 사용자 지갑의 EIP-191/EIP-712 또는 지원 스마트계정 서명을 검증. TOTP 코드는 지갑 소유권 증명이 아니다.
3. challenge 사용 여부와 주소 소속을 한 DB트랜잭션에서 잠금/확정. 중복 주소·만료·다른 목적/체인·재사용 거절.
4. 교체/해제는 기존 연결·계정 세션 재인증과 정산 대기 상태를 확인. 계정 탈취 복구와 이미 실행한 온체인 지급의 취소를 구분.

스마트계정/가스 대납은 후속 선택 사항이다. Robinhood의 [계정 추상화 문서](https://docs.robinhood.com/chain/account-abstraction/), Base의 [Coinbase Wallet 안내](https://docs.cdp.coinbase.com/coinbase-wallet/overview)를 연결 후보로 검토하되 새 SDK·서비스 계정·유료 계약을 이번에 설치/생성하지 않는다. 이메일 없는 게임 가입을 유지한다.

## 고객자산·재화·수익 원장

각 금액은 정수 최소단위/DB NUMERIC 문자열로 저장하고 자산ID와 정책버전을 붙인다. JS 부동소수점으로 토큰 단위를 왕복하지 않는다. asset별 `decimals()`와 발행자 공식 계약을 대조하고 dust·수수료·반올림 규칙을 명시한다.

원장 계정은 다음을 분리한다.

- 획득 GP: 게임 보상/소모/이전. 현금 지급 약속 없음.
- PP/구매 크레딧: 현재 게임의 구매·사용 계약. 법적 환불 예외까지 없애는 명칭으로 사용하지 않음.
- stablecoin 고객 잔액과 지급 대기: 실제 확정 입금에 근거한 고객 청구권. pending/unknown도 부채.
- 게임 매출/수수료 수익, operator 보조금, 가스예산, 환불·분쟁 충당: 고객 준비금과 별도 계정.

현재 `redeemable_pp`는 기존 환매 허용량을 검사하는 버킷이며 별도 준비금이나 새 법적 청구권의 증거가 아니다. 구매 크레딧→아이템→유저 거래→받은 PP→환매 허용량의 간접 경로도 정책 그래프에서 검사한다. 거래 수익이 자동으로 환급 가능해지거나 GP를 현금으로 바꾸지 않는다.

asset별 보존식은 `확정 준비금 >= 사용가능 고객잔액 + 예약/unknown 고객지급 + 확정미지급 환불`이다. 회계상 예약분을 이미 담보에서 뺐다면 보고 시 예약분을 양쪽에 일관되게 복원해 비교한다. 매출 인출 가능액은 이 차액에서 가스/분쟁/추가 보류를 차감한 후의 승인 금액이다. 신규 입금이나 신규 유저 유입을 기존 고객 지급의 필수 재원으로 삼지 않는다.

## 입금·출금 상태와 장애 복구

입금: `observed → canonical_wait → finalized → credited`. 고유키는 `(chain_id,asset_id,contract,tx_hash,log_index)`. 이벤트 내용·블록 해시·사용자 연결·금액·확정 높이를 대조한 뒤 같은 트랜잭션에서 고객잔액/원장/커서를 반영한다. receipt 관측만으로 환매 크레딧을 지급하지 않는다. 재조직 전 관측은 제거하고, 확정 처리 이후 불일치는 asset 지급을 멈춘 뒤 정정 원장으로 처리한다.

커서는 이벤트가 없는 블록도 기록하고, 한 청크 실패 뒤 뒤쪽 청크의 성공으로 누락 구간을 넘어가지 않는다. 재시작은 겹치는 범위를 재조회하고 고유키로 중복 지급을 막는다. 과거 `tx_hash` 단위만 저장된 레코드는 legacy로 보존하며 다중 로그를 임의로 추가 적립하지 않는다.

출금: `requested → reserved → approved/signed → submitted_or_unknown → finalized_paid` 또는 `confirmed_expired → released`. 승인·금액·수수료·받는 주소·체인·asset·계약·nonce·만료·정책버전을 같은 intent에 묶는다. 다시 요청하면 같은 유효 예약을 돌려주며 추가 차감/서명 발급을 하지 않는다.

RPC timeout·브라우저 종료·로컬 만료만으로 실패 확정/환불하지 않는다. unknown 예약은 잠근 채 대사한다. **확정 블록 시각이 서명 만료를 지나고 해당 nonce 미실행이 확인된 경우**에만 해제한다. 이미 지급된 온체인 금액은 DB 백업 복원이나 예약 환불로 취소되지 않는다. 동일 계정/체인/asset 예약과 준비금 점검을 직렬화하고 처리 idempotency를 보장한다.

키는 게임 API 프로세스의 운영 비밀 문자열로 공유하지 않는 구조를 목표로 한다. 지급 승인/서명/계약 owner/수익 인출 권한을 분리하고 KMS/HSM 또는 정책 제한된 signer, 다중 승인·일일 운영한도·비상중지를 적용한다. 현재 계약 owner의 준비금 인출 위험은 보관 모델 선택과 계약 보안검토에서 반드시 해결해야 한다. 이번에는 새 키를 만들지 않는다.

## 모니터링과 출시 완료조건

| 단계 | 구체적인 통과 조건 | 이번 실행 |
|---|---|---|
| 로컬 개발 | 미결 예약 보존, 로그 재처리·중복/정밀도·원장 보존식, 잘못된 자산/체인 차단, RPC장애·재시작 회귀 | 현재 USDT 경로의 선택 안전장치와 더미 검증. 별도 결과 문서 참조 |
| 테스트넷 어댑터 | 사용자 선택 체인/asset 등록, 소유권 증명, 최종성/reorg·중복로그·provider불일치·nonce재사용·미제출/실행 예약 회귀 | 계획. 실제 체인 연결/배포 미실행 |
| 보안검토 | 컨트랙트·서명·수익 인출의 권한 분리, 자산별 고객부채/준비금 대사, 과거 데이터 이행/복원·키 분실 절차 | 계획. 운영 데이터/키 미접근 |
| 제한 출시 | 결정된 판매/환불/수탁 정책, 제한 예산/대상/잔액, 입출금 비상중지·장애지원, 준비금 부족 시 신규 승인 차단 | 별도 승인 필요 |

필수 관측값: 자산별 confirmed reserve·available/pending/unknown liability, 준비금 차이, 마지막 확정 블록/커서 지연, 중복/재조직 수, 정산 미결 시간, signer 승인/거절·nonce 충돌, 입출금 수수료·가스 사용, 매출 인출·고객 환불과 보조금. 개인정보·채팅 원문을 공개 전쟁 기록이나 대시보드에 싣지 않는다.

## 사용자가 결정할 항목

1. 첫 체인/결제자산: 권고 Base USDC 또는 Robinhood USDG. USDT를 원하면 해당 체인의 정확한 지원 자산을 별도 확정.
2. 판매 크레딧과 환금 정책: 단방향 게임 구매인지, 어떤 기존 stablecoin 잔액/환불 청구를 지원할지. GP/PP의 신규 환금권은 만들지 않은 상태.
3. 수탁 형태·판매 법인/서비스 국가·법정 환불/고객지원 정책. 이 결정에 따라 승인/분쟁/준비금/계약 권한 구성이 달라진다.

기술계획은 위 결정을 임의로 대신하지 않고 구현 단위·원장·상태·완료조건까지 정의했다. 체인 연결이 게임의 승패·경제 보존을 대신하지 않는다. 실제 운영 활성화는 이 로컬 개발 작업의 완료 범위 밖이다.
