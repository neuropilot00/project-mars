# OCCUPY MARS — 경제 밸런스 검토표

> 최종 업데이트: 2026-04-25 | Migration 166 기준
> 기준: 1 PP = $1 USD, 타겟 지역: SEA / US / JP / CN / KR

---

## 1. GP (게임 포인트) 순환

### GP 소스 (획득)
| 경로 | 금액 | 빈도 | 비고 |
|------|-----|------|------|
| PvP 승리 기본 | 300 GP | 전투당 | Migration 166: 100→300 |
| 함선 격침 보상 | 30 GP/척 | 전투당 | Migration 166: 10→30 |
| PvP 패배 위로 | 50 GP | 전투당 | Migration 166: 20→50 |
| Siege 승리 | 800 GP | 공성전당 | Migration 166: 500→800 |
| 일일 미션 | 50~500 GP | 1일 | daily.js |
| 업적 | 100~10,000 GP | 1회 | achievement.js |
| PP→GP 환전 | 1 PP = 100 GP | 임의 | migration 071 |

### GP 싱크 (소비)
| 경로 | 금액 | 비고 |
|------|-----|------|
| 함선 건조 (Frigate) | 500~1,500 GP | + 광물 |
| 함선 건조 (Destroyer) | 3,000~5,000 GP | + 광물 |
| 함선 건조 (Cruiser) | 15,000~25,000 GP | + Mid 광물 |
| 함선 건조 (Battleship) | 80,000~120,000 GP | + Core 광물 |
| 함선 건조 (Titan) | 500,000+ GP | + 3종 Core 필수 |
| 함선 수리 | 0.01 GP/HP | Titan 1M HP = 10K GP |
| 실드 충전 | 0.05 GP/unit | Frigate 125 GP, Titan 25K GP |
| 파벌 변경 | 500 GP | 7일 쿨다운 |
| 영토 설명/캡슐/스폰서 | 100~1,000 GP | tdesc/capsule/sponsor |
| 마켓 수수료 | 5% | marketplace |

---

## 2. PP (Premium Point) 순환

### PP 소스
- 채굴: **일일 상한 0.5 PP/유저** (Migration 166)
- 광고 시청 / 미니게임 보상
- 마켓 판매

### PP 싱크
- GP 환전 (1 PP = 100 GP)
- 유지비: 100픽셀 초과분 주당 1 PP (대형 홀더 소각)
- PP→USDT 환전 (1:1)

### 운영사 재무 시나리오
- 유저 1000명 × 일 0.5 PP = $500/day 최대 배출
- 광고수익 + 신규 PP 구매로 커버
- 유지비 수거로 점진 소각 → 인플레이션 방지

---

## 3. 광물 (Resources) 경제

### 3티어 구조
| 티어 | 구역 | 종류 | 드롭률 | 용도 |
|------|------|------|--------|------|
| 1 | Frontier | iron_ore, carbon_fiber, silicon_chip | 20~50% | Frigate + 수리 |
| 2 | Mid | titanium_alloy, plasma_crystal, nano_polymer | 20~25% | Destroyer / Cruiser |
| 3 | Core | dark_matter, quantum_core, exotic_alloy | 10~15% | Battleship / Titan 필수 |

### 수리 재료 수급
- Frigate 수리 (5K HP) = iron_ore 100개
- Titan 수리 (1M HP) = iron_ore 20K개
- Frontier iron_ore 드롭 0.50 + miner_bonus 0.08 → 100픽셀 × 0.5 = 평균 25~50개/일

---

## 4. 함선 경제 (Ship Combat)

### 파벌별 건조 비용 예시 (MCC Frigate)
- GP: 500
- iron_ore: 5개
- carbon_fiber: 3개

### Titan 진입 장벽
- GP: 500K+
- Core 광물 3종 모두 필수 (dark_matter / quantum_core / exotic_alloy)
- 서버당 3척 제한 (trg_ships_server_limit)
- 유저당 ship_types.max_per_player 제한

### 실드 시스템
- 최대: HP의 50%
- GP: 0.05 / unit
- 자연 감소: **3%/hour** (Migration 166: 5%→3%, 유지 동기 부여)
- 전투 시 HP 이전에 먼저 감소

---

## 5. 알려진 이슈 / 관찰 포인트

1. **Frigate 수리 경제성**: 5K HP 수리 = 50 GP + iron_ore 100개 → 채굴 2~4일치. Frigate를 버리고 새로 짓는 게 더 쌀 수 있음 (500 GP + 5 iron_ore). 재검토 필요.
2. **실드 ROI**: Frigate 실드 최대 = 125 GP, 전투에서 2500 데미지 흡수. 유리.
3. **Titan의 수리 부담**: 10K GP + iron_ore 20K개. Core 유저 기준 현실적인지 테스트 필요.
4. **PvP 승리 보상 vs 손실**: 300 GP 승리 vs Frigate 1척 건조비 500 GP. 승리해도 장기적 흑자 어려움 → 개선 방향: 패배 시 함선 일부 생존 / 보상 비율 조정.
5. **Core 광물 드롭 희귀성**: 10~15%, Core 구역 진입 레벨 20 + Mid 보유 조건. Titan 1척 = 20+ 채굴 세션 필요. 적절한 난이도.

---

## 6. 조정 가능한 settings 키 (모두 admin에서 수정 가능)

| 카테고리 | key | 현재값 | 설명 |
|----------|-----|--------|------|
| fleet | `ship_repair_gp_per_hp` | 0.01 | HP당 수리 GP |
| fleet | `ship_repair_iron_per_10hp` | 0.2 | 10 HP당 iron_ore |
| fleet | `shield_gp_per_unit` | 0.05 | 실드 1당 GP |
| fleet | `shield_decay_pct_per_hour` | 3 | 실드 시간당 감소 % |
| mining | `pp_daily_earn_cap_per_user` | 0.5 | 유저 일일 PP 상한 |
| mining | `mining_bonus_frontier` | 1.0 | Frontier 배수 |
| mining | `maintenance_fee_rate` | 1.0 | 유지비 배수 |
| mining | `resource_drop_quantity_max` | 10 | 채굴 1회 최대 드롭 |
| pvp | `reward_base_gp_pvp` | 300 | 승리 기본 GP |
| pvp | `reward_per_ship_destroyed` | 30 | 격침당 GP |
| pvp | `reward_loser_consolation` | 50 | 패배 위로 GP |
| pvp | `reward_base_gp_siege` | 800 | Siege 승리 GP |

---

## 7. 차기 밸런스 검토 우선순위

1. **함선 수리 vs 신조 비교 경제성** — Frigate 수리 vs 신조 비용 비교
2. **전투 손실 회수율** — 승리/패배 시 함선 손실 복구까지 소요 시간 측정
3. **Core 광물 인플레 방지** — 타이탄 소각 이외 Core 광물 소각 메커니즘 필요 여부
4. **파벌 선택 장기 쿨다운** — 168h (7일)이 파벌 이탈 방지에 적정한지
5. **레퍼럴 커미션 연동** — 마켓 수수료의 일부를 추천인에게 환원 (리텐션 강화)

---

*변경 시 반드시 이 문서도 함께 업데이트.*
*admin 패널의 settings 편집으로 대부분 조정 가능 (DB 배포 없이).*
