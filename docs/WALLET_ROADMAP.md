# 월렛/온체인 로드맵 (입출금 자동화)
> 최종: 2026-05-28. 상용화 검수 시 "월렛은 미진행 상황으로 로드맵에 추가" 지시 반영.

## ✅ 완료 (코드 준비됨, 대기 중)
- **자동 커스터디 지갑**(v7.142): 가입 시 실 EOA 키페어 생성 + AES-256-GCM 암호화 저장(서버 마스터키). 유저 키 열람(비밀번호 재확인 + 면책). 4언어 UI. `custodial_wallet_enabled`(기본 OFF) + `WALLET_ENCRYPTION_KEY` 설정 시 활성.
- **chainId env 오버라이드**(v7.141): `BASE_CHAIN_ID=84532`(테스트넷) — 출금 서명 chainId 일치.
- **컨트랙트 배포 툴체인**(v7.143): `deploy/`(Hardhat + MockTestUSDC + deploy.js). 가스만 받으면 1커맨드 배포. 컴파일/드라이런 검증 완료.
- **입금 리스너**(`chain.js`) + **출금 서명**(`signer.js`): RPC/컨트랙트 주소 env 설정 시 동작.
- **솔벤시 가드**(v7.125~7.144): PP→USDT 환금이 담보(collateral) 내에서만 — 뱅크런 차단. fail-closed.
- **link-wallet/reveal-key 보안**(v7.142/7.144): 비밀번호 재확인 + fail-closed.

## ⏳ 운영자 작업 (온체인 — 코드 아님, 자금/키 필요)
1. Base Sepolia 배포 지갑 + 가스용 테스트 ETH (Coinbase CDP faucet 권장)
2. `cd deploy && npm install && npm run deploy:base-sepolia` → 컨트랙트 배포
3. `server/.env` 에 BASE_CHAIN_ID/RPC/DEPOSIT_ADDRESS/SIGNER_PRIVATE_KEY/WALLET_ENCRYPTION_KEY 설정
4. `custodial_wallet_enabled=true` (admin) 로 커스터디 활성

## 🔜 미진행 (Phase 2 — 컨트랙트 배포 *후* 구현, 실자금 테스트 필요)
1. **입금 자동감지 → UI 실시간 반영**: 유저 EOA로 들어온 USDT Transfer 감지(또는 컨트랙트 deposit 이벤트) → `usdt_balance` 적립 → WS 푸시로 즉시 화면 갱신. (현재 입금 리스너는 컨트랙트 이벤트 기반 — 자동커스터디 EOA 모델과 정합 작업 필요)
2. **자동 출금 relayer**: 유저 출금 요청 시 서버가 보관 키로 직접 서명+broadcast(가스 운영부담) → 완전 자동 출금. (현재는 서버 서명만, 유저가 직접 제출)
3. **출금 키 운영 보안 KMS화**: `WALLET_ENCRYPTION_KEY`/`SIGNER_PRIVATE_KEY` 를 env → KMS/시크릿매니저.
4. **link-wallet EIP-191 소유권 서명검증**: 현재 비밀번호 게이트(임시) → 신규 주소 nonce 서명검증으로 정식화.
5. **온체인 입금 vs DB 잔고 정기 대사(reconciliation)** 잡 + 알림.
6. **메인넷 전환**: 실 USDC 주소 + Base 8453 + 컨트랙트 재배포 + 감사.

## 권장 순서
운영자 배포(위 1~4) → Phase 2-①(입금 자동감지+UI) → Phase 2-②(자동 출금 relayer) → 나머지 보안/대사 → 메인넷.
> 실자금/실컨트랙트 없이 미리 만들 수 있는 것(툴체인·커스터디·서명)은 모두 완료. Phase 2 는 배포 후 실체인에 붙여 테스트하며 구현하는 게 안전.
