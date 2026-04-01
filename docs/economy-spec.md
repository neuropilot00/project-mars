# PIXEL WAR Economy System — DB Spec

## 재화 구조 (DB 테이블)

### users
| column | type | desc |
|--------|------|------|
| wallet_address | VARCHAR(42) PK | 유저 지갑 주소 |
| usdt_balance | DECIMAL(20,6) | 출금 가능 USDT |
| pp_balance | DECIMAL(20,6) | 보너스 포인트 (게임 재화) |
| created_at | TIMESTAMP | |

### deposits (온체인 이벤트 → DB 동기화)
| column | type | desc |
|--------|------|------|
| id | SERIAL PK | |
| wallet_address | VARCHAR(42) | |
| amount | DECIMAL(20,6) | 입금 USDT |
| pp_bonus | DECIMAL(20,6) | 10% PP 보너스 |
| chain | ENUM('base','bnb','eth') | |
| tx_hash | VARCHAR(66) | 온체인 트랜잭션 |
| block_number | BIGINT | |
| created_at | TIMESTAMP | |

### pixels
| column | type | desc |
|--------|------|------|
| lat | DECIMAL(8,2) PK | 그리드 좌표 |
| lng | DECIMAL(8,2) PK | 그리드 좌표 |
| owner | VARCHAR(42) | 소유자 (NULL=무소유) |
| price | DECIMAL(20,6) | 현재 픽셀 가격 |
| claim_id | INT FK | 소속 클레임 |
| updated_at | TIMESTAMP | |

### claims (이미지 단위)
| column | type | desc |
|--------|------|------|
| id | SERIAL PK | |
| owner | VARCHAR(42) | |
| center_lat | DECIMAL(8,2) | |
| center_lng | DECIMAL(8,2) | |
| width | INT | 픽셀 셀 수 |
| height | INT | 픽셀 셀 수 |
| image_url | TEXT | |
| link_url | TEXT | |
| total_paid | DECIMAL(20,6) | 총 지불 금액 |
| created_at | TIMESTAMP | |

### transactions
| column | type | desc |
|--------|------|------|
| id | SERIAL PK | |
| type | ENUM('deposit','claim','hijack','swap','withdraw','withdraw_all') | |
| from_wallet | VARCHAR(42) | |
| to_wallet | VARCHAR(42) NULL | |
| usdt_amount | DECIMAL(20,6) | |
| pp_amount | DECIMAL(20,6) | |
| fee | DECIMAL(20,6) | |
| meta | JSONB | 추가 정보 |
| created_at | TIMESTAMP | |

---

## API 엔드포인트

### POST /api/deposit/confirm
서버가 온체인 Deposited 이벤트 감지 후 호출 (또는 크론)
```
Input: { wallet, amount, chain, txHash, blockNumber }
Logic:
  users.usdt_balance += amount
  users.pp_balance += amount * 0.10
  INSERT deposits
  INSERT transactions(type='deposit')
```

### POST /api/claim
```
Input: { wallet, lat, lng, width, height, imageUrl, linkUrl }
Logic:
  1. 커버하는 모든 픽셀 좌표 계산
  2. 각 픽셀별 비용 계산:
     - 무소유 픽셀: $0.1
     - 소유 픽셀: 현재가 × 1.2 (하이재킹)
  3. 총 비용 = SUM(모든 픽셀 비용)
  4. 결제 차감 (PP 우선 → USDT 보충)
     - pp_balance >= total → pp_balance -= total
     - else → pp_balance = 0, usdt_balance -= (total - pp)
  5. 겹치는 픽셀의 기존 소유자에게 PP 보상:
     - 원금 100% + (하이재킹가 - 원금) × 50% → pp_balance
     - (하이재킹가 - 원금) × 50% → treasury
  6. 모든 픽셀 소유권 업데이트
  7. claims 테이블에 INSERT
  8. transactions 기록
```

### POST /api/swap
PP → USDT 환전
```
Input: { wallet, ppAmount }
Logic:
  fee = ppAmount × 5%
  userReceives = ppAmount - fee
  users.pp_balance -= ppAmount

  실제 USDT 전송 (관리자 지갑 → 유저 지갑)
  treasury에 fee 만큼 수익

  INSERT transactions(type='swap')
```

### POST /api/withdraw
USDT 출금
```
Input: { wallet, amount }
Logic:
  users.usdt_balance -= amount
  실제 USDT 온체인 전송
  INSERT transactions(type='withdraw')
```

### POST /api/withdraw-all
전액 출금 + 픽셀 리셋
```
Input: { wallet }
Logic:
  1. 프론트에서 경고 팝업 확인 후 호출
  2. totalPP = users.pp_balance
     totalUSDT = users.usdt_balance
     ppFee = totalPP × 5%
     totalOut = totalUSDT + totalPP - ppFee
  3. users.usdt_balance = 0
     users.pp_balance = 0
  4. 해당 유저의 모든 pixels → owner=NULL, price=0
     해당 유저의 모든 claims → soft delete
  5. 실제 USDT 전송: totalOut → 유저 지갑, ppFee → treasury
  6. INSERT transactions(type='withdraw_all')
```

### GET /api/user/:wallet
```
Response: { usdtBalance, ppBalance, plots: [...], totalDeposited }
```

### GET /api/pixel/:lat/:lng
```
Response: { owner, price, claimId, imageUrl, linkUrl }
```

### GET /api/search/owner/:query
```
Response: [{ lat, lng, width, height, imageUrl, price }]
```

---

## 가격 누적 예시

| 이벤트 | 픽셀 가격 | 비용 |
|-------|---------|------|
| 최초 클레임 | $0.10 | $0.10 |
| 1차 하이재킹 | $0.12 | $0.12 |
| 2차 하이재킹 | $0.144 | $0.144 |
| 3차 하이재킹 | $0.173 | $0.173 |
| 10차 하이재킹 | $0.619 | $0.619 |

## 수익 구조

| 항목 | Treasury 수익 |
|------|-------------|
| 신규 클레임 | 픽셀 가격 100% (빈 땅) |
| 하이재킹 | 프리미엄의 50% |
| PP 환전 수수료 | 5% |
| 전액 출금 수수료 | PP분의 5% |
