# Base 체인 연결 런북 (테스트넷 → 메인넷)

> OCCUPY MARS 입출금(USDC) 온체인 연결 단계별 가이드.
> 온체인 작업(컨트랙트 배포·키 생성·자금)은 **운영자(사용자)가 직접** 수행해야 합니다. 이 문서는 그 핸드오프입니다.
> 코드 구조: `contracts/MarsDeposit.sol`(입금 이벤트 + 서명검증 출금), `server/services/chain.js`(입금 리스너), `server/services/signer.js`(출금 서명).

---

## 0. 아키텍처 요약
- **입금**: 유저가 `MarsDeposit` 컨트랙트에 USDC 입금 → `Deposited(user, amount, ts, chainId)` 이벤트 → 서버(`chain.js`)가 감지 → `usdt_balance` + PP 보너스 적립.
- **출금**: 유저 요청 → 서버가 잔액/쿨다운/유동성 확인 → `signer.js`가 EIP-191 서명 → 유저가 컨트랙트 `withdraw(...)`에 서명 제출 → USDC 수령. 서명자 = `SIGNER_PRIVATE_KEY`의 주소(컨트랙트 `signer`와 일치해야 함).
- 컨트랙트 생성자: `constructor(address _usdt, address _treasury, address _signer)`. `usdt`는 immutable(배포 시 확정).

---

## 1. 테스트넷(Base Sepolia) 준비물
- [ ] **Base Sepolia 지갑** (배포자/owner용). MetaMask에 Base Sepolia 네트워크 추가(chainId **84532**).
- [ ] **테스트 ETH** — Base Sepolia 가스용. (Base 공식 faucet 또는 Sepolia→Base 브리지)
- [ ] **테스트 USDC** — Base Sepolia용 테스트 ERC20. 자체 Mock ERC20을 배포하거나 공개 테스트 토큰 사용.
- [ ] **RPC** — `https://sepolia.base.org` (공용) 또는 Alchemy/Infura의 Base Sepolia 엔드포인트(권장).
- [ ] **서명자 키** — 출금 승인용 별도 키페어 생성. 이 키의 주소를 컨트랙트 `signer`로 설정.

## 2. ✅ 코드 선반영 완료 (테스트넷 chainId env 오버라이드)
**(v7.141) 적용됨** — `server/services/signer.js`의 chainId 하드코딩 제거, 이제 **env 로 오버라이드**:
- `BASE_CHAIN_ID` 미설정 → 8453(메인넷 기본). 테스트넷은 **`BASE_CHAIN_ID=84532`** 설정만 하면 됨(코드수정 불필요).
- 컨트랙트(`MarsDeposit.sol`)는 입금/출금 모두 `block.chainid` 사용 → Base Sepolia 에서 84532. 서버 서명도 84532 가 되어 **서명 검증 일치**(교차 확인 완료).
- 같은 패턴으로 `BNB_CHAIN_ID`(testnet 97) / `ETH_CHAIN_ID`(Sepolia 11155111) 오버라이드 가능.
- 입금 리스너(`chain.js`)는 chainId 하드코딩 없음 — RPC/주소 env 만 설정하면 동작.
> ⚠️ 프론트 입금 UI 의 체인 라벨(`index.html` ~16149, `chainIdDec:8453 name:'Base'`)은 **표시용**. 실제 입금 대상은 서버 env `BASE_DEPOSIT_ADDRESS`(테스트넷 컨트랙트)라 자금은 올바른 곳으로 가지만, 테스터 혼동 방지 위해 테스트 중 "테스트넷" 별도 안내 권장.

## 3. 컨트랙트 배포 (Base Sepolia)
1. [ ] `contracts/MarsDeposit.sol` 컴파일 (Hardhat/Foundry). OpenZeppelin 의존성 설치.
2. [ ] 배포: `constructor(_usdt = 테스트USDC주소, _treasury = 트레저리주소, _signer = 서명자주소)`.
3. [ ] **Basescan(Sepolia) verify** — 소스 검증 공개.
4. [ ] 배포된 **컨트랙트 주소** 기록 → `BASE_DEPOSIT_ADDRESS`.
5. [ ] (필요 시) `setSigner(서명자주소)`로 서명자 재확인.

## 4. 서버 env (`server/.env`) — `.env.testnet.example` 참고
```
BASE_RPC_URL=https://sepolia.base.org           # 또는 Alchemy Base Sepolia
BASE_DEPOSIT_ADDRESS=0x...배포된 컨트랙트
SIGNER_PRIVATE_KEY=0x...서명자 개인키           # 컨트랙트 signer와 동일 주소
TREASURY_ADDRESS=0x...트레저리
```
- `SIGNER_PRIVATE_KEY`는 **절대 git/평문 노출 금지** — 시크릿 매니저/KMS.

## 5. 유동성
- [ ] 컨트랙트에 **출금용 테스트 USDC** 예치 (`getAvailableLiquidity`가 온체인 잔고 확인).
- [ ] owner/treasury 지갑에 가스용 테스트 ETH.

## 6. 연결 & 검증 (E2E)
1. [ ] 서버 재기동 후 로그에 `[Chain] Base: listening...`(skip 아님) 확인.
2. [ ] **입금 테스트**: 테스트 지갑 → 컨트랙트 `deposit(amount)` → 서버가 잔고 적립하는지(usdt_balance↑ + PP 보너스) 확인.
3. [ ] **출금 테스트**: 인게임 출금 요청 → 서버 서명 → 컨트랙트 `withdraw(...)` 제출 → USDC 수령. 서명/chainId 불일치 시 거부되므로 §2 확인.
4. [ ] 쿨다운/수수료/최소금액(`withdraw_fee_percent / withdraw_min_amount / withdrawal_cooldown_hours`) 동작 확인.

## 7. 운영
- [ ] 입금 리스너 모니터링/알림(RPC 다운 시 재시도·헬스체크 있음).
- [ ] **온체인 입금 vs 적립 잔고 정기 대사(reconciliation)** 잡.
- [ ] 출금 서명 키 접근 감사 로그.

---

## 8. 메인넷(Base) 전환 체크리스트
- [ ] 🔴 **`MarsDeposit.sol` 외부 보안 감사** (실자금 보관 — 필수).
- [ ] §2 chainId를 **8453**으로 (메인넷 기본값).
- [ ] `BASE_RPC_URL` = 유료 RPC(Alchemy/Infura/QuickNode) — 공용 `mainnet.base.org`은 레이트리밋.
- [ ] 토큰 = **Base USDC** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (decimals 6 — `chain.js` base decimals=6과 일치 ✓).
- [ ] 서명자 키 KMS/HSM, 충분한 USDC 유동성, 가스용 ETH.
- [ ] ⚖️ 실화폐 취급 규제(KYC/AML) 관할별 검토.
- [ ] `ALLOWED_ORIGINS` = 실제 도메인, `JWT_SECRET`/`ADMIN_SECRET` 강력 랜덤.

---

*문의: §2(b) env 기반 chainId 패치를 원하면 코드 보강해 드립니다.*
