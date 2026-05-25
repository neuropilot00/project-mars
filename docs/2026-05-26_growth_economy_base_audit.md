# Occupy Mars — Growth / Economy / Base Audit (2026-05-26)

## 0. Source ledger
- **Tool-verified**
  - `server/db.js`: referral tier settings + trigger settings defaults
  - `server/routes/arena.js`: cantina referral currently fired on gross PP bet
  - `server/services/ship.js`: repair/shield settings parsed with `parseInt`, so decimal economy settings were truncated
  - `server/services/battleReport.js`: PvP recommendation = CPI-nearest opponent list only
  - `server/routes/onboardingRoutes.js` + `server/services/onboarding.js`: onboarding recommendation stage already has guild/sector/mission recommendation surfaces
  - `server/services/chain.js` + `server/services/signer.js`: Base/BNB/ETH deposit listeners, withdrawal signer, liquidity check already implemented
  - `docs/LAUNCH_ROADMAP_2026.md`: launch roadmap exists but many items are stale versus current implementation
  - `ECONOMY_BALANCE.md`: documented decimal fleet settings (`0.01`, `0.2`, `0.05`) and known economy issues
- **Agent synthesis / proposal**
  - Treat recommendation as **3-stage guided growth system** instead of a single widget:
    1. onboarding recommendation
    2. combat/economy recommendation
    3. DYNASTY referral recommendation

---

## 1. Triangle-squad audit summary

### A. Game loop / general user view
Current live loop is real and already broad:
- email auth → auto wallet/session
- onboarding API + campaign objective loop
- territory harvest / upgrades / resources
- fleet battle hub / reports / bounty / sector conflict view
- daily ops / weekly events

Largest product problems are **mismatch**, not absence:
- frontend onboarding and server onboarding disagree
- daily login mission contract looks fragile
- sector war-economy is visible but not yet the strongest long-term loop

### B. Economy / referral / recommendation view
Current recommendation surfaces are fragmented:
- onboarding: recommended guild / recommended sector / first mission
- battle hub: recommended opponents via CPI delta only
- DYNASTY: 3-tier referral tree exists, but trigger coverage and operator-safety were inconsistent

Concrete economy issues found:
1. `ship_repair_gp_per_hp`, `ship_repair_iron_per_10hp`, `shield_gp_per_unit` were parsed with `parseInt` in ship service.
   - documented decimal values were effectively ignored
   - repair/shield costs could drift far above intended design
2. cantina referral paid off **gross PP wager**, not house edge.
   - this is structurally bad for operator EV
3. referral trigger settings were missing for some already-wired code paths
   - `enhance`
   - `auction_buy`
   - `market_fee`
4. harvest referral minted extra value off a faucet-like source by default.
   - safe default should be OFF unless explicitly re-enabled

### C. Crypto / Base / launch readiness view
Already implemented:
- Base mainnet chain config in frontend + backend
- deposit listener / backfill / health checks
- withdrawal signer with nonce + deadline + liquidity check
- multi-chain shape (Base/BNB/ETH)

Still blocking true pre-open usage:
- production signer / RPC / deposit contract ops readiness is not verified in this audit
- user-facing crypto-first entry is weaker than email-first flow
- launch roadmap doc still mixes old pre-build tasks with already-implemented systems

---

## 2. What I changed in code now

### 2.1 Referral safety fix
Files:
- `server/routes/arena.js`
- `server/db.js`
- `server/migrations/221_referral_safety_and_decimal_economy.sql`

Changes:
- cantina referral now uses **house-edge base**, not gross wager
- added missing referral/admin settings defaults for:
  - `referral_market_fee_pct`
  - `referral_enhance_pct`
  - `referral_auction_buy_pct`
  - `marketplace_referral_commission_pct_of_fee`
- defaulted `referral_harvest_pct` to `0` for operator EV safety

### 2.2 Decimal economy bug fix
Files:
- `server/services/ship.js`
- `server/migrations/221_referral_safety_and_decimal_economy.sql`

Changes:
- repair/shield settings now read with numeric parsing compatible with decimal values
- repair/shield GP costs are rounded with `Math.ceil`
- migration writes the documented intended defaults:
  - `ship_repair_gp_per_hp = 0.01`
  - `ship_repair_iron_per_10hp = 0.2`
  - `shield_gp_per_unit = 0.05`

---

## 3. 3-stage recommendation system revival plan

### Stage 1 — Onboarding recommendation
Target user: 일반 유저

Use existing onboarding surfaces, but unify them as one visible lane:
- job pick → recommended sector
- recommended guild
- first mission

Required next work:
- make frontend onboarding step model match server 5-step model
- add one compact “recommended next move” card fed by onboarding status

### Stage 2 — Battle / economy recommendation
Target user: mid-core general players

Current state:
- `getRecommendedOpponents()` only ranks by CPI distance

Upgrade path:
- score by CPI distance + recent activity + sector overlap + bounty/conﬂict relevance
- return recommendation reason tags:
  - `fair_match`
  - `active_recently`
  - `same_sector_pressure`
  - `bounty_target`
  - `campaign_relevant`

Operator-safe principle:
- recommendations should push players toward existing loops that create retention and sinks
- do **not** mint extra value just for clicking a recommendation

### Stage 3 — DYNASTY recommendation
Target user: crypto / growth / guild users

Goal:
- restore 3-tier referral as a deliberate growth system, not a hidden side-tab

Operator-safe earning sources by default:
- deposit inflow
- swap fee
- shop spend
- marketplace fee slice
- enhancement GP spend
- auction GP spend
- cantina house edge slice

Sources disabled by default:
- harvest mint

---

## 4. General user vs crypto user product direction

### General users
Needs:
- obvious next step
- protected first combat
- simple economy understanding
- return reasons every day

Recommended product work:
1. unify onboarding + campaign card
2. add AI/practice battle recommendation before true PvP
3. simplify territory → build → fight → bounty explanation
4. expose one recommended daily loop, not five disconnected menus

### Crypto users
Needs:
- visible wallet-first path
- transparent on-chain deposit/withdraw trust
- growth loop that feels like ownership/network effects, not just email game features

Recommended product work:
1. split auth entry into `email quick start` vs `wallet start`
2. surface Base as primary chain in landing/auth/product copy
3. elevate DYNASTY and guild territory warfare as crypto-native differentiators
4. show on-chain readiness status (deposit/withdraw live, liquidity available, current chain)

---

## 5. Base-chain real-use + open-beta roadmap

### Phase A — pre-open chain readiness
1. verify production env
   - `BASE_RPC_URL`
   - `BASE_DEPOSIT_ADDRESS`
   - `SIGNER_PRIVATE_KEY`
2. verify signer address / contract balance / listener health
3. perform real dry-run checklist
   - deposit detect
   - duplicate tx protection
   - withdrawal signature generation
   - liquidity failure path
4. publish operator runbook
   - refill liquidity
   - rotate signer
   - RPC failover
   - incident response

### Phase B — closed beta hardening
1. unify onboarding contracts
2. promote Stage 1 + Stage 2 recommendations
3. monitor economy dashboards
   - PP mint
   - PP sinks
   - GP sinks
   - referral payouts by trigger
   - withdraw requests vs liquidity
4. anti-abuse checks
   - fresh wallet farming
   - self-referral rings
   - deposit/withdraw churn abuse

### Phase C — open beta
1. Base public rollout as default chain
2. launch recommendation-led daily loop
3. launch visible DYNASTY growth lane
4. track go/no-go metrics
   - D1/D7 retention
   - first deposit conversion
   - first battle conversion
   - referral active-user quality
   - payout / liquidity stability

---

## 6. Resume point
Immediate next execution chunk after this audit:
1. verify new code changes with syntax + diff review
2. commit + push
3. then tackle onboarding contract unification and richer battle recommendation scoring in a separate surgical pass
