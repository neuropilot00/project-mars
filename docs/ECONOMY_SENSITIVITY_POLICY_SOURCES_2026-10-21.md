# 경제 민감도 모델 정책 출처 점검 — 2026-10-21

이 문서는 현재 작업 사본의 SQL·서비스·기존 모델을 읽은 결과다. 운영 설정/DB/환경 파일은 읽지 않았으며 게임 bootstrap/DB 연결/네트워크/스케줄러는 실행하지 않았다. 게임 코드·설정·기존 모델은 수정하지 않았다. 아래의 ‘작성된 정책’은 관련 migration이 정상 적용된 경우의 소스 계약이며 실제 운영 값이라는 뜻이 아니다.

## 우선순위와 가정

- `server/migrate.js:40-71`은 **최상위** migration 디렉터리의 SQL만 파일명 순으로, 적용 기록이 없는 파일만 실행한다. `archived/`는 자동 재귀 적용하지 않는다.
- `ON CONFLICT (key) DO NOTHING`은 나중 파일이어도 기존 값을 바꾸지 않는다. 명시 `UPDATE`/`DO UPDATE`가 작성된 정책 변경이다. `server/db.js:55-62`의 migration 실행 뒤 inline 기본값은 `db.js:343-348`에서 `DO NOTHING`으로 넣는다.
- 공통 `getSetting`(`db.js:370-389`)은 JSONB를 text로 해석하며, 구형 text 컬럼에는 재조회한다. 저장 값이 없거나 조회 실패일 때만 호출자 폴백을 사용한다. `rows[0]`에 `ORDER BY`가 없으므로 중복 key의 우선 행을 소스만으로 확정할 수 없다. migration 293/294/300도 중복 행 가능성을 명시하고 전체 UPDATE를 사용한다.
- shipMining/NPC는 자체 `SELECT value` 헬퍼를 사용한다. dividends/staking은 여러 행을 map에 넣어 해석하므로 공통 헬퍼와 완전히 같은 중복/타입 처리를 가정하면 안 된다.
- 따라서 정상 migration 적용 프로필, 설정 부재/실패 폴백 프로필, 명시적인 행동/정책 민감도를 구분한다. migration 실패 후 inline fallback 부팅 경로가 존재하므로 ‘가장 큰 migration 번호 = 현재 값’으로 추론하지 않는다.

## 주요 값과 모델 판정

| 항목 | 작성된 정책 / 폴백 | 직접 출처 및 모델 해석 |
|---|---|---|
| 로그인 GP | `[8,12,16,20,22,25,40]` | 044 시드 → 220 UPDATE `[5,8,12,16,22,30,50]` → **224 UPDATE 현 배열**. `daily.js:75-95`의 기본 배열과 일치. 기존 POLICY 값 맞음. |
| 로그인 PP 상당 | day7 `0.1`; GP 환산율 `10` | 220 UPDATE. `daily.js:132-142`, `db.js:392-405`: PP 신규 발행 대신 GP 합산. 설정 부재 환산 폴백 10. 현금 가치/교환권으로 모델링할 근거 없음. |
| 로그인 주기 예외 | 7회 주기; 최근 2일 이내 기록이면 연속 유지 | `daily.js:51-86`: **cycleReset인 날만** day1 GP `randInt(4,12)` 및 PP 상당 `randInt(0,2)`를 사용한다. 재생성 배열을 저장하지 않아 다음 로그인은 다시 설정 배열을 읽는다. 날짜상 매 8일이 아니라 실제 streak가 7→1로 바뀌는 로그인이다. |
| streak | day3 30 GP 폴백; day7 150 GP | 044의 day7 200 → 293 UPDATE 100 → **294 UPDATE/없으면 INSERT 150**. `daily.js:149-157`은 day3/day7만 지급. 14일 400/30일 800 설정이 존재해도 이 로그인 경로에서는 지급하지 않는다. |
| 온보딩 | 75 GP + 0.5 PP 상당(환산시 5 GP) | 082/083의 `DO NOTHING` 시드 차이 이후 220 UPDATE 50 GP/0.5 PP, **224 UPDATE GP75**. `onboarding.js`가 단계 완료 자격을 검사한다. 매일 반복 지급 아님. |
| 일일 미션 | 3슬롯, 종류별 상이; 전부 수령 시 50 GP 추가 | `daily.js:4-23,224-239,360-374`; 보너스 293의25 → **294 UPDATE50**. 15+10+25=50은 실제 가능한 세 미션 묶음의 한 예다. 균등한 보편 일일 지급액이 아니다. 현재 assignable 종류는 claim15/harvest10/hijack25/equip10/enhance20/market15/naval40/build25; 개별 setting override 우선. retired weather/POI/cantina는 새 배정에서 제외. |
| 미션 ‘캡’ | 하루 3개 배정·자격·수령 계약 | 전체 GP 수입을 100 등으로 제한하는 별도 전역 cap 근거가 아니다. `missions.js`의 다른 미션 시스템·mission_daily_cap과 일일 미션을 혼합하지 않는다. |
| 함선 채굴 | capacity·시간당 3 GP, 지갑 24h1500 GP | 277 시드, 278 **UPDATE rate3**, cap은277/278 `DO NOTHING`1500. `shipMining.js:421-437`: 수령 시점 기준 **rolling24h** collected reward 합산. calendar-day reset으로만 구현하면 경계에서 달라진다. |
| 채굴 capacity | frigate1/destroyer2/cruiser4/battleship14/titan60, tier당+10% | 277 시드,278 UPDATE weights. `shipMining.js:263-279` 합산. 대표 T1 mcc_frg 1척은 capacity1; 모델 기본 capacity2는 행동/함대 구성 가정이다. |
| 채굴 시간·마모 | 1/4/8h, 2% 최대HP/h, 최소15%HP; 동시3, 출항0 GP | 275/276/277 시드와 `shipMining.js:92-99,208-214,462-472`. frontier 수율1/마모1/약탈0; mid1.5/1.5/5%; core2.2/2.5/15%. 약탈 보상0.5/마모1.5. HP 하한1. 매일 단일 확정 보상으로 해석하지 않는다. |
| 드롭 양·확률 | 최소1/최대**10**, 최대 종류5; frontier iron_ore base0.50 | 081의 max5/종류3 → **166 UPDATE max10/종류5/ore0.50(miner_bonus0.08)**. 164의 ore0.30은 이후 변경됨. `resource.js:43-104`은 각 자원 확률·직업·등급을 적용. 모델 max5/prob0.45는 실제 작성값이 아닌 proxy/민감도로 라벨해야 한다. |
| 영토 수확 cap | PP상당0.3/day와 mining_daily_cap 중 더 작은 양수 | 166 UPDATE0.5 → **220 UPDATE0.3**. `api.js:1638-1644` 및 다른 harvest 경로가 두 key의 최소 양수를 사용. 이 cap은 shipMining GP1500 및 로그인/미션 cap과 별개. 수확 PP 상당은 별도 GP 환산 경로 확인이 필요하며 현금 수입으로 해석하지 않는다. |
| 대표 MCC 프리깃 | `mcc_frg`: HP32000, 건조60GP, iron_ore5/carbon_fiber3 | 090:91-96 최초 row → **163:62-63 recipe UPDATE**, **212 HP UPDATE**, **220:36 GP UPDATE**. 모델 대표값 맞음. 모든 함종 공통값은 아님. |
| 대표 건조 시간 | **1500초 = 25분** | `090_ship_types.sql:91-96`의 build_time_seconds1500은 이후 이 함종에 덮어쓴 근거 없음. `ship.js:383-393`은 해당 시간 그대로 완료시각 계산, 필드 falsy일 때만600초. 하루 즉시 건조·소비 처리는 시간 세분화가 없는 모델 근사다. |
| 건조 취소/실패 | 취소50%, 실패100%, 각각 자산별 floor | 092 시드 cancel50,295 fail100 부재시 INSERT. `ship.js:620-648,747-775`. 취소/실패/완성은 대체 결과이며 각각 별도 신규 예산 발행으로 합산하면 안 된다. |
| 수리 | GP0.03/HP, 건조비60% cap; iron0.2/10HP | 165 시드 →166 UPDATE →221 **DO UPDATE** decimal →300 **UPDATE GP0.03**. `ship.js:940-981` 현재 공유 수정은 광물도 복구HP 비례 재료 예산으로 제한. mcc_frg GP cap36, 철 cap `max(1,ceil(5×0.6×heal/32000))`, 기존 선형 철 요구와 최소값 사용. 설정 부재 GP폴백2/HP·철1/10HP와 작성값은 크게 다름. |
| 해체 | GP·레시피 자원40% floor 환급 | 173 `ship_scrap_refund_pct=40` 시드, `ship.js:1919-1946`. 대표함 24GP/철2/탄소1 환급. 해체는 battle salvage와 다른 처리다. |
| 마켓 등록/매매 | 기본 등록5GP, 판매5%; 기본 만료168h | 079 등록2 →082 UPDATE10 →**220 UPDATE5**. 판매 key는 **`marketplace_fee_pct`**, 079 시드5. `marketplace.js:30-57,260-280` 등록 5건 이상1.5배·10건 이상2배+ceil, 직업 할인; 판매 직업/영토 할인·최소0.5% floor. 모든 거래에 고정5GP/5%는 할인·리스팅수 없는 대표 프로필. |
| 수수료 추천/배당 | 추천 최대 노출분25%, 명목 배당20% | 173/221 추천분 `DO NOTHING`25. 실제 추천 트리 지급은 각 단계15/10/5%, 자격·day cap 영향. 25% 전체를 추천계정에 보관하는 모델은 명목 carve 예산 근사이며 실제 전액 지급을 증명하지 않는다. 현재 공유 marketplace/dividends는 추천 실지급 후 남은 실제 fee 안에서 배당을 제한한다. |
| NPC | 새 정규화 AI 신원당 첫 성공시 최대200GP·자원별40 일회; 기존AI0신규 | `npcEconomy.js:37-92`, 새354 원장 migration. 329 `npc_economy_enabled=true,target10,per_tick4` **DO NOTHING** 시드; 서비스 enabled부재/조회실패 폴백false. 원장 부재면 발행/등록0. 10개묶음 총6/10/14/28/36GP. 고정 AI인구에만 총예산 유한; 무제한 새 신원 생성을 막는 서버 전체 cap은 추가하지 않음. |

## 장주기와 누락 위험

| 주기/게이트 | 실제 소스 계약 | 112/120 가상일 모델에서의 의미 |
|---|---|---|
| 길드전 | `073_reset_guild_war_defaults.sql:2-3`의 **48h는 선전 쿨다운**, 구형 전쟁24h. `157_phase_d_war_duel_alliance.sql:89` 새 default72h. `guild.js:1523-1529`: 요청 opts.durationHours → 새 key72 → 구 key24 → 폴백72 순. 승리버프48h는159의 별도 key. | ‘48h 전쟁’은 요청이48을 명시한 민감도로만 정당화된다. 기본 반복전쟁을48h종료로 가정하면 실제 기본72h와 어긋난다. 전쟁 확률·손실은 행동가정이며 실제전투 복제 아님. |
| 잔해 회수 | `301`의 salvage_hours24(없으면INSERT), `battleEngine.js:1798` 폴백24. 영구손실 실제 hull당1회, NPC/연습/자살/스타터함 제외, 재료만 지급. `shipSalvage.js:4` 일일 dust240/plate80/frame40/coil18/rare12. | 회수가능24h를 놓친 잔해 자동회수 가정 금지. `buildWreckResources`(`battleEngine.js:41-54`) 대표60GP/무MOD는 **iron_dust1**, iron_ore를 생성하지 않는다. 현재 full_loss_mode 및 전투 종류가 손실 여부를 결정한다(333). |
| 주간 배당 | `dividends.js:19-24` UTC월요일 주간, `index.js:1316-1332` **6h마다 UTC월요일 체크**, 지난주 pool만 분배. stake가 해당 지난주 시작 전 생성되고 최소100 조건 필요. `dividends_distribute_day`는 읽지만 scheduler는 Monday를 직접 검사한다. | 112일은16주,120일은17주+1일이지만 시작 요일·분배 체크·자격·claim시점이 있어 횟수=일수/7 단순 지급 금지. pool자체는 고객 게임자산 부채/지급재원이며 전액 burn 아님. |
| 배당 schema | pool 최초 schema/시드는 **archived110**(현재 runner 자동적용 아님). 서비스는 table/column 없음이면 pool준비/할당을 건너뛴다. dividends_enabled 부재 폴백true,시장분20%. | 필수 variant는 `dividendSchemaAvailable`/enabled/적격staker 존재 구분. 소스20%만 보고 운영 pool이 존재한다고 주장할 수 없다. |
| 스테이킹 | 182 시드true/7·14·30일/APY15/14일1.2·30일1.5배이나 **306 ON CONFLICT DO UPDATE false**가 새 생성 차단. 기존 stake출금 게이트는 없어 원금+약정yield 처리 가능. | 새stake를 기본활성으로 넣으면 정책 오류. 7/14/30일은 레거시 의무나 명시적 재활성 민감도에서만 적용. 112일이면 최대16/8/3회,120일이면17/8/4회는 즉시연속 재예치라는 추가 가정이다. |
| 주간 챌린지 | **331 시드true**; claim5→300GP/harvest20→400/kill3→500; `weeklyChallenge.js:59-64,192-242` 주간별 실제metric·자격·별도claim, 1회원장. 주석의 carve(발행0)와 달리 현 지급SQL은 users GP를 직접+reward 한다. | 미포함 시 최대 **1200GP/완전자격계정/주**의 조건부 faucet을 제외하는 것. 단순 확정매주1200으로 넣어도 오답. 누락을 명시하거나 metric/claim 민감도에 넣어야 한다. |
| 섹터 서지 | 331 시드true, **6h주기/2h창/2.5배** 회전frontier/mid/core. `weeklyChallenge.js:272-307`; 실제 harvest적용은 api.js 별도 도메인. | 모든 채굴·함선채굴에 항상2.5배로 곱하면 안 된다. 시간창·섹터·적용경로를 만족하는 수확만 해당. |
| 시즌 | 074 시드 auto_rotationtrue/duration30d. `season.js:865-896`: queue된 시즌이 있으면 그 기간 우선, 없을 때만30d 생성. | 112일≈3완주+22일,120일≈4완주라는 계산은 첫날 새30d시즌 시작·queue없음 가정. 시즌/패스 보상 모두 자동으로 지급되는 것은 아님. |

## 즉시 모델에 전달한 판정

1. 주요 POLICY 로그인/온보딩/streak7/대표함HP·건조GP·재료/기본마켓5·5%/신규NPC 일회예산은 출처 확인됨.
2. 대표함 건조는25분.48h전쟁을 작성된 default로 부르면 오류(기본72h,48h쿨다운). max드롭5와 ore확률0.45는 작성값10/0.50과 구분할 proxy다.
3. 스테이킹 신규생성 OFF, 배당 schema 유무, 주간챌린지 최대1200GP 조건부 발행은 장기 결과에 영향을 줄 수 있다. 전부 확정 지급/기능 존재로 가정하면 안 된다.
4. 현재 로그인 day7/주기재설정은 상세 분기와 날짜 공백이 있다. 연속 streak/매일접속/확정미션/즉시건조 등 행동가정은 코드 값과 별도 기록한다. rolling24h 채굴 cap을 calendar일로 근사하는 한계도 남긴다.

## 높은 소비 성향 선택 프로필에 사용할 추가 비용 앵커

294의 과거 시뮬 설명은 가챠·합체·강화·함선·실드 등을 빼고 인플레이션을 단정했던 오류를 경고한다. 그 과거 시뮬의 숫자를 이번 검증 결과로 재사용하지 않고 실제 비용 소스를 별도로 읽었다.

| 항목 | 실제 가격/곡선·조건 | 출처 / 소각과 이전 구분 |
|---|---|---|
| 로봇 파츠 가챠 | 기본500GP/1회,5000GP/10회; 최대10회 묶음 | 282 최초Voltaris catalog,283/284 robot catalog. `assembly.js:240-262`는 **유닛 row의 gacha_price_gp**×횟수 사용. 오래된 setting `assembly_gacha_price_gp`500 하나로 모든 유닛을 고정하면 안 됨. 유닛 active/gacha_enabled·잔액 필요; 중복은 조각으로 변환. GP차감과 생성 파츠/조각은 각각 장부에 남긴다. |
| 외계 파츠/통합 박스 | aliens800/8000GP, box700/7000GP | 284 alien catalog800. 283의 assembly_box_price_gp700 시드, `assembly.js:584-616` enabled게이트/설정·횟수 사용. 로봇500과 별도 옵션. |
| 합체(assembly) | 현재 읽은 robots/aliens의 **assemble_gp_cost=0**, 해당 유닛5종 파츠1개씩 소비 | 282/283/284 catalog, `assembly.js:328-365`. 서비스는 DB row 비용이 양수면 GP도 차감하지만 시드0에 새 요금을 상정할 근거 없음. ‘합체’ 비용 대부분은 파츠 가챠/조각 획득에 있으며0GP 합체를 추가GP소각으로 세면 안 됨. 생성 hull·소비 파츠를 자산변환으로 기록. |
| 함선 상자 | standard300/premium1000/elite2000/legendary3000GP; recruit0,하루1 | 228 시드300/1000/3000,245는 elite2000/free recruit를 `DO NOTHING` 추가. `shipCrate.js:200-237,273-302` price_gp 실제row 차감, enabled/active/faction/무료daily quota조건. 유료소각과 무료hull발행을 분리한다. |
| 일반 함선 큰 비용 | MCC `mcc_crs` **2000GP/21600초(6h)**; `mcc_titan` **50000GP/259200초(72h)** | `090_ship_types.sql:111-138` 최초catalog. 163 recipe변경/212 HP변경/220 frigate비용변경은 이 두 함종 GP·시간을 덮지 않는다. 300 주석의 예시 cruiser4500/titan52000을 특정MCC 실제값으로 쓰면 안 됨. 실제건조는 rank/faction/recipe/capital재료·수량상한 등 자격을 확인. |
| 함선 스탯 강화 | `ceil(25 × 1.14^성공투자횟수 × stat배수)`; ATK/DEF1,HP1.2,SPD1.45 | 209 시드와 `ship.js:1222-1261`. 무보너스 ATK 연속성공 첫5회25/29/33/38/43GP. 횟수180에서 지수상한. **UTC금요일 비용20% 할인 후floor**, 자원재료 소비·성공확률·실패비용 있음(`ship.js:1440-1469`). 모든 시도가 성공했다고 확정하지 않는다. |
| 코스메틱 강화 | `floor(50 × 1.8^현재레벨)`; 레벨0..4=50/90/162/291/524GP | 078 시드, `enhancement.js:73-79,153-181`. 활성·소유cosmetic·레벨·일일제한·실패규칙·재료·직업할인 적용. 추천수당 helper호출이 있으므로 차감전액을 무조건burn으로 분류하지 않는다. |
| 함선 실드 | `ceil(실제추가HP×0.05)`; 1000HP=50GP | 165 시드3→166 UPDATE0.05→221 **DO UPDATE0.05**. `ship.js:1148-1168` 최대실드=effectiveHP50%, 현재여유만 충전;설정부재폴백3. 선체복구와 별개 소각 경로. |
| 영토 실드 | 6h72/12h144/24h288/48h576/72h864GP | 182 `DO NOTHING` 시드, `shield.js:16-38,60-74`. 활성·영토소유·중복/최대수량조건. 실제옵션파싱/설정차이를 검증하지 않고 보편신청가능으로 단정하지 않는다. |
| **수리 일부는 pool 이전** | 수리GP의20% 명목적립,0..100%클램프 | 313 `victory_slot_repair_feed_pct=20`, `ship.js:1072-1082`, `victorySlot.js:5-15`. pool테이블없음/오류 시적립0, 실제존재시 수리150GP 중30GP는pool·120GP만순소각. 승리slot 지급은pool감소+유저증가로 이전이며 추가발행 아님. **모델의 수리차감전액burn 가정은 schema미지원 프로필 또는 명시근사로 한정해야 한다.** |
| 하이잭 | 고정GP요금은 이번 확인범위에서 입증하지 못함 | `api.js:390-391,534-538,794-836`: 적pixel가격/섹터base최소×hijack_multiplier(폴백1.2),war_time20%할인; 결제는PP/USDT, 이전소유자PP환급/보너스. `hijack.js:595-612`도 PP차감. PP환불·소유자이전·GP→PP P2P구매를 GP순소각으로 합산하면 안 됨. 요청 경로별 동작을 상세재현하지 않는 모델은 명시적으로 제외. |

선택 가능한 **한 계정의 1회 소비 묶음** 예시는 112/120일 기간 중 로봇10회5000 + standard상자300 + MCCcruiser건조2000 + 금요일이 아닌 첫ATK강화25 + 함선실드1000HP50 + 영토24h실드288 = **7663GP**다. 시작 장부에 **출처를 명시한 가상10000GP**와 각 행동에 필요한 재료·선체·영토·rank자격을 가진 선택계정에만 적용하면 잔액은2337GP이며 추가획득을 가정할 필요가 없다. 이 시작GP는 모델 endowment/이전된 과거재고로 기록하고 현금매출·모든유저실제보유로 주장하지 않는다. 자격/재원이 없으면 시도/집행을 건너뛰고 실패수를 기록한다. 상자·가챠 결과자산/추후판매·해체환급도 장부에 남겨 후속소각을 과장하지 않는다.

선택계정이 추가로 cruiser5000HP를 수리한다면 작성단가상150GP(건조비60%=1200cap미도달)이며, 그 중30pool/120burn variant와 pool schema없음150burn variant를 비교할 수 있다. 실재손상·보유철이 있어야 한다. 이 높은소비성향 프로필은 코드상 가능한 **행동 민감도**이며 실제사용자 수요·최적가격·강제소비정책이 아니다. 신규NPC 예산이나 일반계정 보상을 여기에 맞추어 늘리는 근거가 되지 않는다.

이번 기본모델에 없는 가챠·큰함선·강화·실드·합체파츠 소비를 제외한 채 순발행만 보고 전체경제 인플레/디플레를 단정할 수 없다. 반대로 비용앵커를 모든유저가 자동지출한다고 넣어서 디플레를 주장해도 안 된다. 영토/추천/시장/pool처럼 상대계정이 남는 것은 이전, 대가없이 잔여잔액이 소멸한 몫만 burn으로 구분한다.

## 읽은 핵심 소스 스냅샷 SHA-256

공유 작업 사본이므로 이후 다른 작업자가 바꾸면 해시가 달라질 수 있다. 이 표는 읽은 시점의 provenance다.

| 파일 | SHA-256 |
|---|---|
| `server/services/daily.js` | `552353b0752818a3c13c2b9f4f92a65b4a3b9e1824f239c61872b64a0e52577c` |
| `server/services/ship.js` | `6267cb86bddd350f6ebb27076ea6fadfc82953e82959afb365ddb2aaaafe38ad` |
| `server/services/shipMining.js` | `62ec2e1d28125e44f3935a9b691776c5396377d54023f53d75fe3008133f1045` |
| `server/services/marketplace.js` | `f883f3a414d8605f64fbb60d5b3afffbe1628d8335ddc32c9d277c9a82e5d844` |
| `server/services/weeklyChallenge.js` | `56830c3f08054bb597071ed7a4c2da6d7d7ba1890dda5ae7f5a350916a063ac4` |
| `server/services/npcEconomy.js` | `fa979dd4b083d9ed48db5eb73d367455ed281eb4dee011c680d5e2356aab36bd` |
| `server/services/dividends.js` | `c4785d2de939e7f42f03ae5e099991c91ba16b42d265626b62c4539ff608e3fe` |
| `server/migrations/306_disable_staking_inflation.sql` | `962275daa6e582dbe2e7ecfdde3ef6b09e1a396c84761b7df7c18851ba399ce2` |
| `server/migrations/354_npc_seed_budget.sql` | `72772bffce871ef8d0fdab53dc99038c90c8c60d28e3c09c88682cd1b4e0ac17` |

범위는 모델의 핵심 정책과 장주기 출처에 한정했다. 전체 경제·모든 보상/소각 경로의 완전성 감사나 실제 운영 설정 검증은 아니다.
