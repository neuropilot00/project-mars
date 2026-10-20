# 경제 릴리스 검증 범위와 정책 경계 — 2026-10-21

**현재 근거는 전체 경제 건전성 승인에 부족하다.** 기존 42개 행동 실행과 실제 고정 매도 계약을 적용한 9개 비교는 선택한 자산·행동·소스 경로의 부분 모델이다. 보존식 오류 0은 새로 발행한 GP까지 정확히 장부에 기록했다는 뜻이며, 발행률·수요·재미·매출·실제 봇 억제가 적절하다는 뜻은 아니다. 이 문서는 게임/모델 소스와 기존 산출물을 읽고 범위를 대조했으며, 아래 시즌 멱등성 결함 한 항목만 별도 승인으로 구현·격리 검증했다.

운영 DB·환경·키·계정·체인·네트워크·배포에는 접근하지 않았다. 기존 42/9 실행, frozen 모델, 기존 산출물은 수정하거나 재실행하지 않았다. 알려진 누적 **모델 CPU77.770초/100초 상한**은 그대로다. 아래 PostgreSQL 회귀는 행동 모델 추가 실행이 아니다.

## 실제 결함과 작성된 발행 정책을 구분한다

`server/migrations/298_drop_quest_reward_pool.sql`은 사용자 결정으로 quest_reward_pool throttle을 제거하고 게임플레이 보상을 GP로 직접 지급하도록 분리한 정책이다. 따라서 `users.gp_balance += reward` 자체, 보상 pool의 부재, GP의 신규 발행은 곧바로 코드 버그가 아니다. 로그인·주간·업적·미션·시즌·PvP 등의 **실제 신규 발행**으로 집계해야 한다. GP를 현금 교환권으로 추가 해석하거나 기존 보상 권리를 임의 삭감할 근거도 없다.

실제 버그는 같은 약정 보상을 중복 생성/청구하거나, 이미 지급한 escrow를 다시 반환하거나, 자산·자격 증거 없이 발행하는 식으로 계약을 어기는 경우다. 이번 범위에서는 **시즌 최종화의 중복 권리 생성**을 실제 PG로 재현하고 수정했다. 아래 다른 경로에 잠금/원장이 보인다는 것은 소스상 보호 근거이며, 이번 작업에서 모두 실제 PG 동시성을 통과했다는 뜻은 아니다.

## 경로별 포함/생략과 반복 자격

‘42’는 `economy_behavior_sensitivity.js`의 14조건×3seed·112일·48계정, ‘9’는 같은 운전기의 시장 구현만 바꾼 `economy_source_market_comparison.js`다. 9의 비시장 범위는42와 같으며 전체 실제 서버 replay는 아니다. 초창기 `economy_scenario_simulation.js`에 있던 proxy를42에 자동 포함된 것으로 세지 않는다.

| 경로 / 소스 근거 | 42 및 9의 포함 상태 | 발행·이전·소비 | 반복 자격·멱등성 / 남은 검증 |
|---|---|---|---|
| 로그인·streak, `daily.js:recordDailyLogin` | 포함: 실제 배열·7회주기/2일유예·reset첫날난수·3/7일 보너스 | GP신규발행; PP상당도 GP환산 | wallet/date INSERT conflict로1회. 접속/활동 분포는 합성. 실제 timezone/date 경계 전체 검증 아님. |
| 일일 미션, `daily.js:getDailyMissions/claimMission` | 부분 포함: 실제8종 중3선정, 모델 활동에 대응하는 수확/시장구매/건조/승리만 진행 | 적격 GP신규발행+전부수령50 | 실제3슬롯/날짜·소유·완료·claimed·잠금 계약. 미지원 종류를 무료완료시키지 않음. 전체 미션 종류/직업분포 미복제. |
| 주간 챌린지, `weeklyChallenge.js:claim` | 수확20→400/kill3→500 포함; claim5→300 생략 | comment의 carve와 달리 GP직접신규발행 | wallet/week/metric 원장+잠금, 실제metric 선행. 가상kill은 실제 battle engine 증거가 아님. |
| 업적, **`achievements.js:117` 전후** | **생략** | reward_gp×설정mult의 일회성 GP신규발행 | server 조건값 조회→catalog조건 비교→wallet/key UNIQUE INSERT 후 GP 같은TX. 유한 catalog라도 신규 계정마다 발생 가능; 무조건반복일일 수입으로 취급 금지. source182 enabledtrue/mult1, archived104 schema유무 별도. |
| 탐험 미션, **`missions.js:1014` 전후** | **생략**, 일일 미션과 다른 시스템 | PP연료 소비, 저장 resolved reward.pp의 GP환산+reward.gp 신규발행, 아이템/XP | 발사대 소유·점유/연료·24h12회·시간 후 서버resolve, claim은 owner/status/claimed_at/rowlock. 클라이언트 minigame 점수를 보상으로 신뢰하지 않음. type별 실패/환급은 저장 계약에 따름. |
| timed invasion | **retired410**, 새 모델 유입으로 넣으면 안 됨 | 신규 보상 없음; 이미 저장된 과거 complete/failed claim은 별도 권리 | `missions.js:375`, `missionRoutes.js:53,76`. 탐험 전체까지 retired로 해석하지 않는다. |
| 레거시 random quests | **신규배정/progress/tracking retired410**, 과거완료claim 생략 | 과거적격 보상만 GP신규발행; 298유지된 tier/day cap/GP최소값 적용 | `questRoutes.js:26,97,100-166,212`. 기존완료/claimed행 삭제없음. 410은 옛 보상권리 무효화가 아님. |
| 시즌 순위 보상, **`season.js:claimSeasonReward` (원래385 전후)** | **생략** | GP/PP상당 신규GP, XP/아이템; USDT는 별도담보조건부 고객청구권 | 각 reward row는 owner/claimed/rowlock로1회. **그 앞의 최종화 중복row 버그는 아래359로 수정**. active category/rank/config·주기30d/queued기간에 따라 권리가 달라진다. |
| 시즌패스, `season.js:claimPassTier` | **생략** | 자격티어 GP/PP상당 신규GP 또는아이템/XP; premium 접근결제와 보상은 별도 | user/progress잠금→premium/XP/기수령확인→unique claim. industry XP도 source349 등 서버사건·일일cap. retired 수동tap/score 경로로 보상을 임의 생성하면 안 됨. |
| 월드 이벤트, **`worldEvents.js:518` 전후** | **생략** | defeated/positive damage참가자당 기본GP200+XP500+dust100+ice10;top ancient_metal5·title | event/wallet rewarded=false FOR UPDATE 후 지급·marker 같은TX. 154false→**290 DO UPDATE enabled/auto true**; fallbackfalse, 기본3일/19UTC·활성이벤트1·출격최소5척/30분cooldown. 자동생성=자동격퇴·모든계정보상 아님. |
| 기본 PvP·siege·hijack 전투, `battleRewards.js:212-335,computeReward` | **GP/광물 보상 생략**; 합성전쟁은 소형함 손실과잔해만 모델링 | 서버보상 신규GP/광물. 096seed→166 UPDATE PvP300/siege800/kill30/loser50; damage0.5..1.5 등 배율 | ended battle lock→해당battle기존 rewards확인→1회. AI연습 guard는무지급. base보상/위로/kill·환경modifier를 모두포함한 전체반복인센티브 검증은 아님. 손실없는반복전투를 충분한sink라고 가정 금지. |
| 동맹 전투 보너스, `battleRewards.js:awardAllianceBattleDividend`, migration323 | **생략** | 승리GP의5%(기본cap100)를 동맹treasury에 **추가발행** | 소스323도 minted라고 명시. 플레이어 지급에서 깎는carve가 아님. 전투1회멱등범위·실제active membership 잠금. 이 정책을 과지급버그로 혼동하지 않는다. |
| 길드전, `guild.js:declareWar/resolveExpiredWars` | **기본보상·stake/pot 생략**; 72hactive/48hcooldown 가상손실만 | 선전fee200GP소비, 별도stake잠금; 승리base500GP는신규발행, pot70%는이전/나머지소비. 무승부각stake50%환급은잔여stake소비 | 전쟁active rowlock→resolved1회; 자격·재무·실제점수 선행. +500을정책으로계산하되반복자격/순수익의실제강제비용을 별도검증. auto-win/클라이언트minigame점수는현재410. |
| 함선 채굴, `shipMining.js` | 포함: T1capacity·4h·3GP·rolling24h1500·손상/수리 | GP/드롭 신규발행, 출항GP0 | 사용자advisory+job/status잠금으로1회수령. fleet occupancy·minHP15%·3동시제약. 실제DB설정/전체함대·직업/멀티account권위는 미복제. |
| 희귀 채굴·MID/CORE, `shipMining.js`/`resource.js` | **생략**; frontier철.50/탄소.30/실리콘.20·1..10만proxy | 희귀자원신규발행, 경로yield/wear/raid·직업·등급 영향 | 미래 rare수요/자본함재료 병목·품질·유저선택은 미측정. 자원코드간 무조건환산 금지. |
| 영토 수확, `api.js` harvest | 부분포함: 성공0.1PP상당1GP, 일일3회/0.3PP상당 | GP신규발행, 길드기여는별도이전 | 실제픽셀/등급/직업/서지/가치비례·수확interval·전체드롭 미복제. 생략된기능을 없다고 선언하지 않는다. |
| frontier 생산·운송·탈취, `frontierIndustry.js:production/collectProduction/startCargo/settleBattleIn` | **42/9의 실제산업회로 생략**. 옛frozen의하루풀배치proxy와구분 | 30분배치·저장16·dust20/plate4 신규생산;창고→cargo→repair depot는이전,raid절반은기존cargo이전 | node/owner/generation·watermark/stock/settled_at 잠금. 수령후쌓인시간재mint 방지. 월권공격·실제PvP·보급품소비/가치경쟁은 별도수요검증. |
| frontier 수리, `frontierIndustry.js:repairCost/repair` | **생략** | 일반quote GP소비+전달된depot iron_dust소비; 특정스타터1회는10dust/0GP | ownerkey advisory·선체/점유·실제 quote/재고조건. 일반 `ship.repair`는iron_ore를쓰지만 **이경로는dust대체**가명시됨; 모든dust를일반ore로환산하는것도, 어떤수리에도dust가쓸모없다는것도틀림. |
| 소형함 건조·제작·해체·수리 | 포함하되MCCfrigate대표와평균HP/최대4척모델 | 건조/재료소비, 취소·해체부분환급; 수리20%victorypool이전/80%burn | 지급전충분한자금/재료·25분due time·결과구분. 실제전체선종·품질·업그레이드·전선할인·starter자격 미복제. |
| 큰 함선·Titan·강화·합체 | **생략** | cruiser2000GP/6h, MCCtitan50000/72h; stat강화GP기하곡선+재료소비; 합체파츠변환/기본합체GP0 | rank/faction·자본함전용재료·서버수량·실패확률·재원필요. 가격앵커존재=유저가그만큼지출한다는뜻아님. 이전정책출처문서참조. |
| 유료가챠/상자 산출물 | **고소비조건에만**500GProbot/300GPstandard주별선택 | GP소비+**추상collection발행**; 실제소스는파츠/품질함선·중복조각 | 자금부족거부포함. 실제odds·무료recruit1일1회·품질·재판매·해체환급·채굴능력생성을복제하지 않음. 결과를영구쓸모없는sink로과장하면안됨. |
| 코스메틱/함선 강화, `enhancement.js`/`ship.js:upgradeShipStat` | **생략** | GP/재료소비, 성공자산변경·실패비용; 일부추천이전가능 | 현소유/레벨·재료·일일제한/실패·금요일할인·rowlock. 50×1.8^레벨/25×1.14^성공투자앵커로확정소비추정 금지. |
| 실드 | 고소비조건함선1000가상용량·실제부족량×0.05·decay부분포함; 영토실드생략 | 소비. 가득찬실드에계속전액청구하지않음 | 실제함선effectiveHP50%cap·영토소유/쿨다운·직업별조건 미복제. |
| 영토 유지/정비 | **생략** | `maintenance.js` 주간>100pixel PP차감/미납포기; `territoryCondition.js:tend` GP50정비,decay·등급별수확/희귀효과 | 영토수/소유·condition<100·cooldown60분·잔액/잠금. PP유지비를GP순소각/현금매출로합치지않음. governance dailymaintenance는직책잔액의다른소비. |
| 거래·추천·배당·승리pool | 42는synthetic bid/partial/5d,9는실제fixed ask/전량/168h. 추천upline없음0;pool분리포함 | 구매자→판매자/P2P이전; capturedfee일부pool이전,나머지만burn | 9의실제시장계약범위만교정. controller구분은합성groundtruth이며실서비스봇탐지가아님. 배당/승리pool실지급·staking기존의무는생략. |
| NPC | 새가상1명200GP·5종각40일회포함;그중3종거래 | 최초발행후재고/거래이전, 무한보충없음 | 354현재기존AI는0신규·wallet원장. 새identity무제한생성을막는서버전역cap은없음. 모델에없는무한매수·보충을사후전제하지않음. |
| 카지노/클라이언트전쟁점수 | **retired410**, 정상sink/faucet로신규활동에넣지않음 | 옛fundedround정산/기존권리는별도이전 | `arena.js:22-28` 신규stake만410; `guildRoutes.js` auto-win/score410; `phaseD.js` 일방team-battle410/초대동의대체. 기존자산삭제/몰수검증 아님. |

반복 권한은 대부분 **계정/보상행/이벤트 단위**다. 장부가1회여도 계정을 여러 개 만들거나 새이벤트를 계속 만들 수 있으면 총보상은 계속 늘 수 있다. 이것은 필요 자격·비용·기간·운영정책을 비교해야 할 문제이며, 모델 controller를 실제차단기능처럼 말하거나 이미약정된보상을삭제하는결론으로뛸수없다.

## 시즌 권리 중복 생성 결함 — 실제 재현과 최소 수정

수정 전 `finalizeSeasonRewards`는 시즌을 inactive로 UPDATE한 뒤 기완료 여부를 검사하지 않고 같은 시즌/rank/config의 `season_rewards`를 INSERT했다. migration047은 보상id PK만 있고 동일권리unique가없다. 각reward의 claimed잠금은 **각각의 복제row가한번씩**청구되는것을막지못했다. 자동rotation이동시에같은만료시즌을선택하거나최종화를재시도/재활성하면새권리가생겼다.

pre-fix Git blob **`8f98a3a1d258869d40cec894e2c3d0aae06797ba`**(SHA256 `b8165bcd2f4cfad579a5cbaa93c8686e912a1696cec8b5c767de52fb92990193`)을 실제 private PostgreSQL16/Unix socket에 주입했다. 동시최종화2회에서100GP권리2개, 실제각rowclaim에서합계200GP를확인했다. 이는 정책상첫권리100GP발행과별도의 **중복권리100GP 버그**다. 일반적인298직접발행정책과구분한다.

수정 파일은 `server/services/season.js`, 새 `server/migrations/359_season_reward_finalizations.sql`, 전용 `server/tools/season_finalize_isolated_regression.js`다. 서비스의기존USDT담보증거없음/42P01 fail-closed변경을보존했다.

- 같은TX에서시즌row `FOR UPDATE` 후 지속원장 `season_reward_finalizations(season_id PK)`를확인한다. 최초active시즌만기존분배계산/금액/범주로권리를만들고, 생성row수와`completed`를함께기록한다. **0적격시즌도완료기록**을남긴다.
- 원장에있는시즌은admin재활성/점수수정후에도새권리0이다. 기존reward행이보이면`legacy_rewards_present`로기록하고새권리를추가하지않는다. inactive+이미종료된빈시즌은`legacy_closed`로기록한다. 이표식은과거지급발생을추정하지않는다. 미래inactivequeued는원장없이유지해이후활성화자격을보존한다.
- 359는기존reward행·claimed·금액·유저잔액을수정/삭제하지않는다. 과거중복row도자동정리하지않으며판정/차감하지않는다. 원장부재는failclosed다.
- INSERT실패/원장부재시권리/활성상태/완료원장을rollback한다. `autoRotateSeason`도그오류를삼킨뒤시즌을닫지않고즉시반환하여재시도가능상태를유지한다.359의존성을배포계획에포함해야한다.

```sh
env -i PATH=/opt/homebrew/bin:/usr/bin:/bin NODE_ENV=test RUN_SCHEDULERS=false node server/tools/season_finalize_isolated_regression.js --baseline-only
env -i PATH=/opt/homebrew/bin:/usr/bin:/bin NODE_ENV=test RUN_SCHEDULERS=false node server/tools/season_finalize_isolated_regression.js
```

최종 실제PG **9개묶음통과/종료0**, 임시cluster삭제확인: 고정baseline의동시중복·실제200GP지급;359부재와actualauto-rotation재시도보존;기존권리/잔액바이트보존·legacy표식;8동시finalize권리1개와동시claim1회;admin재활성;0적격이후점수추가;미래queued/이미closed/없는season;**두번째INSERT실패후첫권리까지rollback**, 재시도시원래100+50GP두보상유지. 소스/harness `node --check`와작업파일diff검사도통과했다. 전체시즌자동생성·모든종류보상·실제운영적용의완전성검증은아니다.

| 검증 파일 | SHA256 |
|---|---|
| `server/services/season.js` | `c233b8c253383a31487495bee661e7a7665a49bd165ff61e3e83d60fb9aeb3b6` |
| `server/migrations/359_season_reward_finalizations.sql` | `5fea9004bfd1252c173a801f90e0ca15bfa254394ec4ba65fbe4a5d6e21398bb` |
| `server/tools/season_finalize_isolated_regression.js` | `d5e0feee0cf09e3f0e16f65355ecb80c186e70e75957b9dd343e8d80cdceb2fc` |

## 정책 후보는 로컬 opt-in 비교로만 설계한다

다음은 이번구현/운영기본값변경이아니다. 현행298직접GP발행과약정된보상권리를기준프로필로보존하고, 새로운가설은별도이름/입력/출력폴더에서만비교한다. 새숫자cap·몰수·보상삭감은정하지않았다.

| 후보 가설 | 로컬 opt-in 입력/회계 | 필요한근거·금지사항 |
|---|---|---|
| 보상예산 | `rewardMode=authored_direct` 기본과 `hypothetical_funded_future` 비교. 가상예산재원·상대계정·부족시미발생/대기의무를명시 | 기존claim권리삭감/지급완료표시금지. 직접GP발행을잘못이라고가정하지않고신규행동에관한별도정책안으로취급. |
| 소액자원비용 | `listingPolicy=authored` 대비명시적한종류의묶음크기/소액등록료가설만교체 | 기존42/9를덮어쓰거나새가격을현재설정으로표현금지. 유료등록/미체결/전체매수·수령예상액·자원소비수요를함께비교. |
| NPC재보충 | 현행일회원장기본과 `hypothetical_funded_restock`만분리 | 재원계정에서GP/재고를실제로차감하는이전이어야함. 무한매수·무한mint·자동일일리필은승인된정책아님. |
| 자동화보상자격 | `controller=known_synthetic` 활동민감도,별도명시한verified-action/cap가설 | 합성controller를실서비스증거라고주장금지. 정상장시간활동/다계정보상권리를임의회수하지않고자격·탐지오탐·실사용데이터가선행돼야함. |

추가모델은 **실행하지않았다**. 필요하면먼저source자격/빈도를정의한뒤기존baseline을재실행하지않고 `mixed_medium`/`bots_matched_capital` 2조건×기존3seed×112일×48계정의 **6개증분**만별도폴더에서비교하는안을제안한다. 직전9개가CPU3.837초였음을기준으로예상CPU3~6초,hardstop8초(누적77.770+8=85.770초≤100초),동일heap768MiB/출력20MiB경계를두는안이다. 이는견적이며새경로의실제CPU를보증하지않는다. root가필요성과행동가정을선택하기전실행하지않는다. 이번소스bug회귀와coverage정리에새행동시뮬은필요하지않았다.

## 기존 증거 보존과 릴리스 판단

읽은모델해시는 frozen `2ef69ccdc0ba137dc5a0055035b8c9bb4e16d284f2ee908b433692dd07973200`,42 driver `fa69d88afa16f363fdaf82194ff3b2445b49b4f7470f8ccec51d2fd588e070d7`,9 driver `20085ce019f5f741f3cf7505c4346f9cf8831412a50f867123144ce3a07bb813`다. 이작업은모델/기존산출물에쓰지않았다. 스냅샷manifest는정렬된각파일의 `[relativePath,sha256,size]` JSON(`separators=(',',':')`)을해시했다.

| 기존 산출물 폴더 | 파일수 / bytes | manifest SHA256 |
|---|---:|---|
| `outputs/evidence/economy-sensitivity-20261021` |13 / 1483178|`41f1fa91f13c157f858cd0c69ad2a019431e44448e4cc2812ad9477322ce95d0`|
| `outputs/evidence/economy-source-market-20261021` |14 / 450795|`c2e1b38607132bc26ae56af9fbd6cb14af50b27ca71dea8c1821ed5adc7c78df`|

개발릴리스에서는359의존성·실제배포설정·기존미정산권리·실DBmigration결과를별도확인해야한다. 이담당의통과증거는로컬privatePG의명시한시즌계약에한정된다. 사업/경제수용에서는실제유저가왜생산·구매·소모·전쟁·가챠를선택하는지,등록료후손익·재고접근·봇/다계정분포·반복보상총량·고가sink의실지출을측정해야한다. 코드개발완료·배포가능성과시장수요/전체경제건전성검증은서로다른판정이다.
