# MarsDeposit 배포 툴체인 (Base Sepolia 테스트넷)

자금/키 없이 미리 만들어 둔 배포 도구. **가스용 테스트 ETH만 받으면 1커맨드로 배포**됩니다.

## 사전 준비 (당신)
1. 테스트넷 배포 지갑 + 가스용 Base Sepolia ETH (Coinbase CDP faucet 권장 — 메인넷 잔액 불필요)
2. `cp .env.example .env` 후 `DEPLOYER_PRIVATE_KEY` 채우기 (테스트넷 전용 키)
   - (선택) `SIGNER_ADDRESS` = 서버 `SIGNER_PRIVATE_KEY` 의 주소. 미설정 시 배포자 주소 사용.

## 실행
```bash
cd deploy
npm install
npm run deploy:base-sepolia
```
출력 마지막에 `server/.env` 에 붙여넣을 라인(BASE_CHAIN_ID/RPC/DEPOSIT_ADDRESS)이 찍힙니다.

동작:
- `USDC_ADDRESS` 미설정(테스트넷) → MockTestUSDC 배포 + MarsDeposit 에 100,000 tUSDC 출금 유동성 충전.
- `USDC_ADDRESS` 설정(메인넷 등) → 그 토큰으로 MarsDeposit 만 배포.

## 배포 후
1. 출력된 `BASE_DEPOSIT_ADDRESS` 등을 `server/.env` 에 반영.
2. `SIGNER_PRIVATE_KEY`(서버) 가 `signer` 주소와 같은지 확인.
3. 서버 재기동 → `[Chain] Base: listening...` 확인 → 입금/출금 테스트.

## 메인넷 전환
- `.env` 에 실제 USDC 주소(`USDC_ADDRESS`) 지정, `--network base` 사용, `BASE_CHAIN_ID` 삭제(또는 8453).
- ⚠️ 메인넷은 MockTestUSDC 배포 금지.

## 참고
- 컨트랙트 소스: 리포 루트 `contracts/MarsDeposit.sol`, `contracts/MockTestUSDC.sol` (hardhat `sources: ../contracts`).
- `deploy/node_modules`, `cache`, `artifacts` 는 .gitignore 처리됨.
