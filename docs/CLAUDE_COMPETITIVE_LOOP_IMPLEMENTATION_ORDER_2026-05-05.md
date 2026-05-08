# Claude Implementation Order - Competitive Loop Improvements

> Date: 2026-05-05
> Status: Full execution order for combat feedback, territory meaning, retention, and PvP matchmaking
> Primary roadmap: `docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md`
> Related territory plan: `docs/TERRITORY_UTILITY_PLAN_2026-05-05.md`

## 0. Read Order

Claude must read these before editing code:

1. `CLAUDE.md`
2. `AUDIT_FINDINGS.md`
3. `CHANGELOG.md`
4. `docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md`
5. `docs/TERRITORY_UTILITY_PLAN_2026-05-05.md`
6. This file

This document is the execution order for the weakness-improvement plan:

- combat feedback system
- territory meaning and defense motivation
- daily retention loop
- PvP matchmaking and bounty loop

Do not reinterpret this as a new standalone mode. These features must attach to the existing BASE, Battle Hub, territory panel, fleet battle result modal, and existing APIs.

## 0.1 Source Of Truth

This document is not a brainstorm. Treat it as the implementation contract for the weakness-improvement plan.

When a requirement conflicts with older notes, follow this order:

1. Latest user request in the active thread
2. This implementation order
3. `docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md`
4. Existing code behavior
5. Older plan documents

If the codebase already has a working equivalent, extend it instead of rebuilding it. If the codebase has a partial or broken equivalent, repair and wire it into this contract.

## 0.2 Meaning Of Done

Do not mark a phase complete unless all of these are true:

- Real API data is wired to the UI.
- Empty states and missing legacy data do not cause internal error.
- Desktop and mobile layouts keep primary buttons visible.
- Existing game flows still work.
- `CLAUDE.md`, `AUDIT_FINDINGS.md`, and `CHANGELOG.md` are updated.
- The final report names exact files changed, endpoints touched, and verification performed.

"UI only", "server only", "rough mock", "temporary prototype", and "works on my wallet only" are not complete.

## 1. Product Goal

The goal is to make losses, land, daily return, and PvP all explain themselves.

Current weak points:

- Battle result does not teach the player why they won/lost.
- Territory can feel replaceable because identity/history/defense value is weak.
- After onboarding, the player does not always know what to do today.
- PvP asks the player to find opponents manually.

Final target:

```text
Fight
  -> receive battle report and improvement hints
  -> adjust fleet/formation/ship upgrades
  -> defend or target valuable territory
  -> return daily for harvest, construction, market, and conflict alerts
  -> find fair PvP targets through Battle Hub
```

## 2. Non-Negotiable Rules

- Keep all features inside existing flows.
- Do not create a detached new page if the feature belongs in an existing modal/panel.
- Do not break existing campaign, harvest, hijack, fleet, or shipyard flows.
- Do not add PvP systems that let strong players farm weak players without warning or matching.
- Do not block early campaign progression on rare RNG or PvP outcomes.
- Do not invent duplicate resource codes or duplicate battle tables if existing data can be reused.
- Every commit must update `CLAUDE.md`, `AUDIT_FINDINGS.md`, and `CHANGELOG.md`.
- Do not fake completion by adding static cards with no live data.
- Do not create a second version of a system that already exists.
- Do not silently swallow errors. Return safe JSON and log enough context to debug.
- Do not change database schemas without checking current migrations and production compatibility.

## 3. Priority Order

Implement in this order unless the user explicitly changes priority:

1. P1: Battle Result Report
2. P2: Daily OPS Board
3. P3: Territory Identity and Field Rating
4. P4: PvP Recommended Opponents
5. P5: Bounty Board
6. P6: Sector Conflict Map and Weekly Calendar

Reason:

- Battle report gives the fastest improvement to combat clarity.
- Daily OPS increases return behavior without requiring new economy tables first.
- Territory identity/field rating gives land emotional value and defense motivation.
- PvP recommendations need CPI and stable battle/fleet data.
- Bounty and sector conflict should come after fair target discovery exists.

## 3.1 Delivery Gates

Each priority has three gates:

1. **Recon Gate**: identify the current files, tables, routes, and UI entry points before editing.
2. **Implementation Gate**: backend, frontend, fallback, and docs are all changed together.
3. **Verification Gate**: run the relevant local checks and manually inspect the affected UI when possible.

If a gate cannot be completed, stop that phase and document the blocker in `AUDIT_FINDINGS.md`. Do not move to the next priority while pretending the phase is complete.

## 3.2 Commit Packet Rules

Use small, reviewable commit packets:

| Packet | Scope |
|---|---|
| P1-A | battle report service + route + fallback JSON |
| P1-B | battle result modal/panel UI integration |
| P1-C | my-stats + replay highlights |
| P2-A | daily OPS API |
| P2-B | BASE Daily OPS UI |
| P3-A | territory identity schema + read API |
| P3-B | territory panel UI + nickname edit |
| P3-C | defense/hijack counters + Field Rating effects |
| P4-A | CPI calculator + endpoint |
| P4-B | Battle Hub recommended opponents UI |
| P5-A | bounty schema + listing API |
| P5-B | battle result bounty claim/refund hooks |
| P6-A | sector conflict API + overlay |
| P6-B | weekly calendar read-only UI |

Do not combine unrelated packets unless the user explicitly asks for a large merge.

## 4. P1 - Battle Result Report

### 4.1 Goal

After a battle, show a result report that teaches the player:

- what happened
- which side dealt more damage
- which ships survived/died
- which class performed well or poorly
- why the player likely lost
- what to try next

### 4.2 Server Scope

### 4.1.1 Recon Gate

Before editing P1, inspect and record:

- current battle result route/service files
- current battle viewer/result UI files
- current fleet battle tables and event table usage
- migration naming convention
- wallet normalization helpers
- any existing toast/error response helper

The final report must include the files inspected. If the exact table/route names differ from this document, use the real names from the repo and note the mapping.

Create a battle report helper.

Recommended file:

```text
server/services/battleReport.js
```

Do not make the UI guess report truth. The server should normalize and return the report.

Expected function:

```js
async function generateBattleReport(battleId, wallet) {
  return {
    battleId,
    perspective: "attacker" | "defender" | "spectator",
    result: "attacker_win" | "defender_win" | "draw",
    sides: {
      attacker: {
        wallet,
        fleetName,
        faction,
        shipsDeployed,
        shipsDestroyed,
        shipsSurvived,
        totalDamage,
        totalTaken
      },
      defender: {
        wallet,
        fleetName,
        faction,
        shipsDeployed,
        shipsDestroyed,
        shipsSurvived,
        totalDamage,
        totalTaken
      }
    },
    classPerformance: [
      {
        classKey: "frigate",
        deployed: 4,
        survived: 1,
        damage: 820,
        taken: 1300,
        tag: "low_survival" | "high_damage" | "core_contributor"
      }
    ],
    hints: [
      {
        type: "counter" | "formation" | "power" | "survival",
        severity: "info" | "warning" | "critical",
        messageKey: "ewar_countered_smalls",
        fallbackText: "Enemy EW frigates reduced small ship accuracy. Add tackle or EW counters before rematch."
      }
    ],
    highlights: [
      { type: "flagship_destroyed", tick: 42, label: "Flagship destroyed" },
      { type: "damage_spike", tick: 58, label: "Heavy damage exchange" },
      { type: "turnaround", tick: 71, label: "Momentum reversed" }
    ]
  };
}
```

### 4.3 Data Sources

Use existing data first:

- battle records
- fleet battle result rows
- `fleet_battle_events` if available
- ship snapshots/events if available
- fleet/faction/formation data

If exact damage per ship is unavailable:

- return approximate side-level values from existing battle state
- mark classPerformance as `estimated: true`
- never throw internal error because detailed event data is missing

### 4.4 Hint Rules

Implement deterministic hint rules before trying AI-like explanations.

Examples:

```js
if (atkEwarExposure > 0.4) hint("ewar_countered_smalls");
if (defSniperKillRate > 0.6) hint("sniper_punished_open_formation");
if (atkFormation === "wedge" && defHasBombShips) hint("wedge_vs_bomb_unfavorable");
if (atkDamage / Math.max(1, defDamage) < 0.7) hint("significant_power_gap");
if (smallShipSurvival < 0.25) hint("small_screen_collapsed");
if (flagshipDiedEarly) hint("flagship_exposed");
```

Limit visible hints to max 3, sorted by severity.

### 4.4.1 Required Hint Catalog

Use stable `messageKey` values so frontend text can be translated or changed later.

| messageKey | Trigger | Player-facing meaning | Suggested action |
|---|---|---|---|
| `ewar_countered_smalls` | enemy EW exposure over threshold | small ships were suppressed | add tackle/EW counter or remove enemy EW first |
| `sniper_punished_open_formation` | sniper kill share high | open formation was punished | try screen/pincer or close distance faster |
| `wedge_vs_bomb_unfavorable` | wedge into bomb ships | dense push ate area damage | split formation or remove bombers first |
| `significant_power_gap` | damage ratio below threshold | raw power gap was large | upgrade ships or choose closer CPI opponent |
| `small_screen_collapsed` | small survival very low | frontline collapsed early | add defense/logi or avoid unsupported rush |
| `flagship_exposed` | flagship dies early | command ship was overexposed | set screen/guard or choose safer flagship |
| `low_damage_output` | total damage low despite survival | fleet lived but failed to kill | add DPS ships or change target priority |
| `slow_engagement_loss` | fast ships die before impact | engagement range/timing poor | use advance/retreat timing or faster formation |

If a precise trigger cannot be computed from existing data, skip that hint instead of guessing.

### 4.5 API

Add:

```text
GET /api/battles/:battleId/report?wallet=...
GET /api/battles/my-stats/:wallet
```

`my-stats` returns:

```json
{
  "total": 47,
  "wins": 28,
  "losses": 19,
  "winRate": 0.596,
  "favoriteFormation": "wedge",
  "bestShipClass": "cruiser",
  "nemesisFaction": "FSP",
  "streak": { "type": "win", "count": 3 }
}
```

### 4.6 Frontend

Add the report inside the existing battle result modal or battle viewer result panel.

Do not replace the current result. Add a structured report under it:

- side-by-side attacker/defender stats
- class performance rows
- "패인 분석" hints
- "추천 개선" suggestions
- "리플레이 하이라이트" buttons if event ticks exist

For mobile:

- stack attacker/defender cards vertically
- keep text short
- use collapsible class performance

### 4.7 Verification

- Battle with full events shows highlights.
- Battle without events still shows summary and no internal error.
- Attacker perspective marks "나" correctly.
- Defender perspective marks "나" correctly.
- Unknown wallet can view public summary only.
- `GET /api/battles/:battleId/report` returns stable JSON.

### 4.8 P1 Acceptance Gate

P1 is accepted only when:

- A completed battle can show result, side stats, class performance, and up to 3 hints.
- A battle with no `fleet_battle_events` still shows a useful report without internal error.
- The result panel does not regress the current victory/defeat display.
- Mobile can read the report without horizontal scrolling.
- The user can understand at least one concrete improvement from the report.

## 5. P2 - Daily OPS Board

### 5.1 Goal

BASE should tell the player what matters today.

The board should answer:

- what can I collect now?
- what should I improve?
- what is urgent?
- what weekly reward am I moving toward?

### 5.2 API

### 5.1.1 Recon Gate

Before editing P2, inspect and record:

- BASE tab/root render function
- current daily mission/free mission code
- territory harvest endpoint
- build queue endpoint
- market listing endpoint
- campaign progress endpoint
- notification/feed endpoint

Daily OPS must aggregate existing data. It must not invent an unrelated mission system.

Add:

```text
GET /api/daily-ops/:wallet
```

Expected response:

```json
{
  "resetAt": "2026-05-06T00:00:00.000Z",
  "items": [
    {
      "id": "territory_harvest",
      "type": "harvest",
      "status": "ready",
      "priority": "normal",
      "title": "영토 수확",
      "subtitle": "+450 PP 예상",
      "action": { "tab": "my-land", "target": "harvest" }
    },
    {
      "id": "sector_warning_arcadia",
      "type": "conflict",
      "status": "urgent",
      "priority": "urgent",
      "title": "Arcadia 섹터 공성전 진행 중",
      "subtitle": "23시간 남음",
      "action": { "tab": "battle", "target": "sector_arcadia" }
    }
  ],
  "weekly": {
    "completed": 3,
    "required": 5,
    "rewardLabel": "Titan-class build permit"
  }
}
```

### 5.3 Item Sources

Daily OPS should aggregate from existing systems:

- territory harvest ready
- ship build queue complete
- ship upgrade suggestion
- market listing status
- campaign next objective
- active battle or hijack warning
- fleet repair/rebuild need

Start with safe read-only suggestions. Do not add new rewards until the board is stable.

### 5.4 Frontend

BASE first screen should include a compact Daily OPS Board.

Required behavior:

- show urgent items first
- each item has one clear action button
- completed items collapse
- weekly progress visible but not huge
- mobile layout remains compact

Do not create a massive dashboard that hides the game. The board should be helpful, not a wall.

### 5.5 P2 Acceptance Gate

P2 is accepted only when:

- BASE shows a compact board with ready/urgent/completed states.
- Each action routes to an existing tab/panel without breaking navigation.
- Empty accounts get useful first-step suggestions.
- Existing daily/free mission UI is not duplicated confusingly.
- Mobile first screen is not blocked by a giant board.

## 6. P3 - Territory Identity and Field Rating

### 6.1 Goal

Make land feel personal and painful to lose.

Territory should have:

- nickname
- hold duration
- defense wins
- hijack history
- badges
- Field Rating

### 6.2 DB Changes

### 6.1.1 Recon Gate

Before editing P3, inspect and record:

- `claims` schema and migrations
- territory panel ownership logic
- hijack completion ownership-transfer logic
- PP production calculation
- image/art registration logic
- notification table usage

Do not add new columns that duplicate existing ownership history or upgrade state.

Add migration only after inspecting existing `claims` schema.

Recommended columns:

```sql
ALTER TABLE claims ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS defense_wins INTEGER DEFAULT 0;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS times_hijacked INTEGER DEFAULT 0;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS first_claimed_at TIMESTAMPTZ;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS last_defended_at TIMESTAMPTZ;
```

If ownership history already exists elsewhere, reuse it instead of duplicating.

### 6.3 Field Rating

Compute server-side:

```text
FR = holdDays * 2
  + defenseWins * 5
  + totalUpgradeLevel * 3
  + hasImageBonus
```

Rating tiers:

| Tier | Range | Label | PP Bonus | Hijack Cost Weight |
|---|---:|---|---:|---:|
| 1 | 0-19 | 미개척지 | 0% | x1.0 |
| 2 | 20-49 | 전초기지 | 5% | x1.1 |
| 3 | 50-99 | 거점 | 12% | x1.25 |
| 4 | 100+ | 요새 | 20% | x1.5 |

Do not apply all bonuses blindly on first commit. Start by showing rating, then connect economic effects after validation.

### 6.4 Territory Panel UI

Add:

- nickname and edit button
- field rating badge
- hold duration
- defense wins
- hijack count
- badges

Nickname edit:

- owner only
- safe length limit
- sanitize output
- no page refresh

### 6.5 Hijack Integration

After rating display is stable:

- defense win increments when defender keeps territory
- times hijacked increments when ownership changes through hijack
- Field Rating can adjust hijack GP requirement
- warning text must show why cost is higher

### 6.6 P3 Acceptance Gate

P3 is accepted only when:

- Owned and non-owned territory panels both render correctly.
- Owner can edit nickname and see it persist after refresh.
- Field Rating is computed server-side or by a shared helper, not copy-pasted UI math.
- Hijack cost text explains any rating multiplier.
- Existing hijack transfer still changes owner correctly.
- Rating effects can be feature-flagged or disabled if production data looks risky.

## 7. P4 - PvP Recommended Opponents

### 7.1 Goal

Battle Hub should help the player find fair fights.

### 7.2 Combat Power Index

### 7.1.1 Recon Gate

Before editing P4, inspect and record:

- fleet ownership tables
- ship instance/blueprint tables
- upgrade stat tables
- battle active/in-progress flags
- user activity/last-active source
- Battle Hub UI tab structure

Recommended opponents must use real fleet data and exclude invalid targets.

Compute CPI server-side.

Recommended formula:

```text
CPI = sum(shipStatScore)
  x formationModifier
  x upgradeModifier
  x readinessModifier
```

Ship score should include:

- HP
- ATK
- DEF
- speed
- role weight
- tier/size weight
- upgrade bonus

CPI is a guide, not absolute truth.

### 7.3 API

Add:

```text
GET /api/battlehub/recommended-opponents?wallet=...
```

Return:

```json
{
  "myCpi": 1480,
  "opponents": [
    {
      "fleetId": 123,
      "fleetName": "FSP_Rook_1함대",
      "wallet": "0x...",
      "faction": "FSP",
      "cpi": 1320,
      "cpiDeltaPct": -0.108,
      "onlineState": "online",
      "lastActiveAt": "2026-05-05T08:00:00.000Z",
      "sectorCode": "arcadia",
      "canChallenge": true
    }
  ]
}
```

### 7.4 Battle Hub UI

Add tabs:

- 추천 상대
- 현상금
- 섹터 분쟁

Implement only 추천 상대 first.

Recommended opponent card:

- fleet name
- faction
- CPI
- relative difficulty
- sector/activity
- challenge button

Do not show dead/sold/in-battle fleets as valid targets.

### 7.5 P4 Acceptance Gate

P4 is accepted only when:

- Player sees a list of opponents within a configurable CPI range.
- Current player and already-busy fleets are excluded.
- Difficulty label is understandable without being absolute.
- Challenge button uses the existing battle declaration flow or clearly opens it.
- Empty list explains how to become eligible.

## 8. P5 - Bounty Board

### 8.1 Goal

Give players a way to create revenge and faction conflict.

### 8.2 DB

### 8.1.1 Recon Gate

Before editing P5, inspect and record:

- GP balance/debit/credit service
- battle completion hook
- current wallet/user identity handling
- existing market listing transaction patterns
- notification creation helper

Bounty GP must be locked atomically. Do not create a bounty if GP debit fails.

```sql
CREATE TABLE IF NOT EXISTS bounty_listings (
  id SERIAL PRIMARY KEY,
  poster_wallet TEXT NOT NULL,
  target_wallet TEXT NOT NULL,
  gp_amount NUMERIC NOT NULL,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Use the same numeric type used by existing GP balances.

### 8.3 Rules

- minimum bounty amount
- poster cannot claim their own bounty
- target wallet must exist or have game activity
- active bounty locks posted GP
- winner claims bounty after defeating target fleet
- expired bounty refunds poster if not claimed

### 8.4 API

```text
GET /api/bounties
POST /api/bounties
POST /api/bounties/:id/cancel
```

Battle result hook:

```text
checkAndClaimBounty(battleId, winnerWallet, loserWallet)
```

### 8.5 P5 Acceptance Gate

P5 is accepted only when:

- Poster GP is locked at bounty creation.
- Poster can cancel active unclaimed bounty and receive refund.
- Winner receives bounty only after a valid battle win against target.
- Poster cannot claim their own bounty.
- Expired bounty is not claimable.
- Bounty UI shows active/claimed/expired clearly.

## 9. P6 - Sector Conflict Map and Weekly Calendar

### 9.1 Sector Conflict Map

### 9.0 Recon Gate

Before editing P6, inspect and record:

- Mars map overlay rendering code
- sector/region data model
- hijack declaration data
- recent battle query
- notification/watch preference model if any

Start with read-only visualization. Do not add real economic multipliers until admin tuning exists.

Use existing Mars map overlays if possible.

Conflict states:

- active siege
- hijack declared
- battle in last 24h
- quiet

API:

```text
GET /api/sectors/conflicts
POST /api/sectors/:sectorCode/watch
```

### 9.2 Weekly Calendar

Add predictable game rhythm:

| Day | Event |
|---|---|
| Mon | sector governor/result |
| Tue | trade fee bonus |
| Wed | fleet battle point bonus |
| Thu | mineral drop bonus |
| Fri | campaign chapter/event highlight |
| Sat | siege season end/ranking |
| Sun | weekly reward/reset |

Start as read-only UI and text. Do not add real multipliers before admin tuning exists.

### 9.3 P6 Acceptance Gate

P6 is accepted only when:

- Conflict map shows at least quiet/recent battle/hijack/active conflict states.
- Clicking a sector opens existing relevant battle/territory context.
- Weekly calendar is visible but not intrusive.
- Event text is data-driven enough to update without code changes later.

## 10. Implementation Safety

### 10.1 Feature Flags

Use server or frontend-safe flags where appropriate:

- `battle_reports_enabled`
- `daily_ops_enabled`
- `field_rating_enabled`
- `battlehub_recommendations_enabled`
- `bounty_board_enabled`

If no feature flag system exists, use safe constants and keep code paths isolated.

### 10.2 Backward Compatibility

Every new endpoint must:

- return valid JSON when tables are empty
- tolerate missing optional columns during deploy windows
- not crash if battle event data is incomplete
- use wallet normalization consistent with the existing codebase
- avoid deploy-time crashes when new migrations are not yet present
- prefer `IF NOT EXISTS` migrations where safe
- keep old response fields if any existing frontend consumes them

### 10.3 UI Quality

- Mobile first.
- No huge instructional text blocks inside the app.
- Use compact cards, chips, bars, and collapsible sections.
- Buttons must keep existing visual language.
- Do not make BASE or Battle Hub feel like a spreadsheet.

### 10.4 API Error Contract

Follow the existing API response style in the repo. If there is no clear style, use:

```json
{
  "success": false,
  "error": "short_machine_code",
  "message": "Human-readable explanation"
}
```

For read-only endpoints, prefer degraded useful data over hard failure. Example: battle report should return a summary even if highlights are unavailable.

### 10.5 Database Migration Contract

Before adding migrations:

- inspect the existing migration folder and naming style
- use the same timestamp/version convention
- make migrations idempotent where possible
- do not drop or rewrite production data
- include rollback notes in the final report if the project has no rollback files

If a table/column already exists with a different name, reuse it and document the mapping.

## 11. Verification Checklist

Before every commit:

- `git diff --check`
- Existing campaign panel still opens.
- Existing Battle Hub still opens.
- Existing territory panel still opens for owned and non-owned land.
- Existing fleet battle result still renders even without new report data.
- Empty DB states do not create internal error.
- Mobile width does not hide primary buttons.

If `index.html` changes, run inline script syntax validation.

## 12. QA Matrix

For every phase, verify these scenarios:

| Scenario | Required Result |
|---|---|
| new wallet / no data | no internal error; helpful empty state |
| active player / normal data | primary feature works with real data |
| legacy rows missing new details | fallback renders instead of crashing |
| mobile width | no hidden primary button or horizontal scroll |
| desktop width | no giant dead space or unreadable text |
| slow network/API failure | loading/error state is visible |
| wallet case mismatch | ownership/perspective remains correct |

## 13. Required Claude Final Report Format

Claude must end each implementation phase with this exact structure:

```text
완료:
- ...

변경 파일:
- path: what changed

API/DB:
- endpoint/table/migration summary

검증:
- command or manual check

남은 리스크:
- none / specific risk

다음 추천:
- next packet only
```

Do not answer only "done" or "fixed". The user needs enough detail to know what was actually changed.

## 14. Commit Rule

Every implementation commit must update:

- `CLAUDE.md`
- `AUDIT_FINDINGS.md`
- `CHANGELOG.md`

For feature work, include:

- what changed
- what endpoint/UI was added
- what was verified
- what remains

## 15. What Not To Do

- Do not build all six systems in one giant commit.
- Do not add fake UI that is not wired to real API data.
- Do not create new isolated prototype HTML for production features.
- Do not hardcode one test wallet.
- Do not ignore mobile.
- Do not make the report insult the player. It should explain and guide.
- Do not make daily OPS mandatory chores that punish absence too harshly.
- Do not say "P5 is later" after this document. P5 is planned here; implement it when its priority arrives.
- Do not use the old prototype HTML files as production implementation.
- Do not leave docs stale after changing behavior.

## 16. First Task For Claude

Start with P1 only:

1. Inspect current battle result, battle events, and fleet battle tables/services.
2. Create `server/services/battleReport.js`.
3. Add `GET /api/battles/:battleId/report?wallet=...`.
4. Add battle result report UI to the existing result modal/panel.
5. Add safe fallback for battles without event data.
6. Update docs.
7. Verify with at least one real or seeded battle id if possible.

Do not start Daily OPS, Field Rating, CPI, bounty, or calendar until P1 is working and documented.

### 16.1 Exact First Commit Scope

The first commit should be P1-A only unless the route and service are already complete.

P1-A deliverables:

- `server/services/battleReport.js`
- route/controller registration for `GET /api/battles/:battleId/report`
- safe fallback report for battles with partial data
- route smoke test or manual curl result
- docs updates

P1-A must not include:

- Daily OPS
- bounty
- territory schema changes
- Battle Hub recommendation UI
- large visual redesign

After P1-A, continue with P1-B UI integration.
