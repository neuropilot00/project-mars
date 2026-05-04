# OCCUPY MARS — Claude Work Order

> Date: 2026-05-05
> Owner: Claude/Codex handoff
> Source of truth: `CLAUDE.md` -> `AUDIT_FINDINGS.md` -> `CHANGELOG.md` -> `docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md`

## 0. Read This First

This file is the current execution order for remaining work. Do not treat older research/prototype files as the main plan.

Read in this order:

1. `CLAUDE.md`
2. `AUDIT_FINDINGS.md`
3. `CHANGELOG.md`
4. `docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md`
5. This file

Use `docs/FLEET_ASSAULT_STARFOX_RESEARCH.md` only as optional future reference. Starfox-style direct action combat is not the current priority.

## 1. Non-Negotiable Rules

- Every code commit must update `AUDIT_FINDINGS.md` and `CHANGELOG.md` in the same commit.
- If the change affects direction, campaign, fleet, economy, or territory loops, also update `docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md`.
- Keep changes scoped. Do not rewrite campaign chapters, replace all art, or redesign the whole UI unless the current task explicitly requires it.
- Prefer server truth for progression, rewards, inventory, ships, market listings, and battle state.
- Avoid client-only completion hacks. If a feature matters to progression, the server must validate it.
- After edits, run at minimum:
  - `node --check server/services/campaign.js` when campaign code changes.
  - Inline script syntax check for `index.html` when frontend code changes.
  - `git diff --check`.

## 2. Current Completed Baseline

These are already done and should not be rebuilt from scratch:

- Campaign objective UI, briefing objectives, `GO` action routing.
- Campaign server hard gate for DB-backed objectives.
- CH1 to CH3 early loop:
  - territory claim
  - territory image
  - territory harvest
  - ship ownership
  - fleet creation
  - fleet battle
  - ship upgrade
  - market listing
- Campaign reward inbox API/UI.
- `ship` and `ship_fleet` campaign rewards can issue real `ships`.
- Shipyard material visibility for crafting and upgrades.
- Probabilistic ship stat upgrades with material/GP requirements.
- Ship marketplace sale lock and sale sticker.
- Fleet Command modal stability, selected ship focus, Korean error messages.
- Campaign editor layout freshness fix using `updatedAt`.

## 3. Priority 1 — Campaign Progression Cleanup

Goal: campaign must behave like the main quest, not like a timer-only minigame.

### 3.1 Reward System Hardening

Check and complete reward types still handled as safe placeholders:

- `ship_blueprint`
- `ship_choice`
- `asset`
- `resource_stream`
- `contract`
- any `data_artifact`-style narrative reward

Required outcome:

- If the reward has no real permanent system yet, document that clearly in code/docs and keep safe claim behavior.
- If a lightweight real implementation is possible without scope explosion, implement it.
- Reward claim must never block campaign progression with an internal error.
- Reward inbox must show what was claimed and what effect it had.

Suggested first files:

- `server/services/campaign.js`
- `server/routes/api.js`
- `index.html`

### 3.2 CH4+ Objective Wiring

Review all current MCC/FSP/CV campaign presets after CH3.

Required outcome:

- Each playable chapter after CH3 should have at least one real DB-backed objective when feasible.
- Locked/future chapters can stay locked, but visible playable chapters must not auto-complete without meaningful player action.
- `progress`, `complete`, and UI status must agree.

Candidate objective types:

- `campaignRewardClaims`
- `shipUpgrades`
- `fleetShips`
- `marketListings`
- `completedFleetBattles`
- `territoryHarvests`
- future: sector control, production output, fleet power threshold

### 3.3 Completed Campaign Card Folding

Completed chapters should render compact consistently.

Required outcome:

- `completed`, `claimed`, and entries with `completedAt` all fold.
- The current active chapter remains expanded.
- Result button remains accessible on folded completed cards.

## 4. Priority 2 — Fleet Battle Production Stabilization

Goal: current vertical top-view fleet battle should feel readable, long-range, and dramatic. Do not switch to Starfox-style action yet.

### 4.1 Tactical Lab Sync

Keep these synchronized:

- `assets/tactical-lab-v11.html`
- `assets/fleet-assault-demo.html`

Required outcome:

- Production battle view uses the same visual engine quality as the tested demo.
- Demo remains useful for isolated testing.

### 4.2 Battle Readability

Required outcome:

- Ships stay onscreen.
- Ships face their current target.
- Large ships move, but slower than small ships.
- Fleets do not collapse into close melee.
- 1v1 or small battles start closer and zoom in more.
- Large battles start farther and auto zoom out.
- Beams/missiles stay visible for about 2 to 3 seconds.
- Radio callouts do not overlap command buttons.
- Mars background is visible but not too dark.

### 4.3 Command Effects

Required outcome:

- Focus fire and EMP visibly do something.
- Titan/battleship-grade beam cannon should be readable as a major action, preferably charged/manual in a later pass.
- Movement buttons must match vertical battle direction:
  - advance = up
  - retreat = down
  - flank/reposition should read naturally in the vertical layout.

## 5. Priority 3 — Fleet Command UX

Goal: fleet command should make ship composition fun and understandable.

Required outcome:

- Fleet Command preview uses vertical formation logic.
- Wedge/spearhead should visibly be a wedge, not a loose diagonal.
- Composition counts must match the actual selected fleet.
- Clicking a ship clearly shows which ship is selected.
- Flagship assignment errors must show the exact reason.
- Formation and movement changes must update preview without closing the modal.
- Old SVG ship remnants must be removed from Fleet Command/ship cards where PNG assets are available.

Suggested first files:

- `index.html`
- `server/services/fleet.js`
- `server/routes/fleets.js`

## 6. Priority 4 — Ship Economy UX

Goal: ships should feel like valuable assets players can craft, upgrade, use, and sell.

### 6.1 Crafting and Upgrade Requirements

Required outcome:

- Crafting cards and crafting modal show `owned / required` for GP and all materials.
- Upgrade modal shows:
  - success chance
  - GP owned/required
  - material owned/required
  - which requirements are enough or missing
- Available materials should look active, missing materials inactive.
- The action button is disabled only when execution is impossible.

### 6.2 Upgraded Ship Market Value

Required outcome:

- Market/listing UI should surface upgraded stats as value.
- Selling/listed ships should show a clear `판매중` sticker.
- Listed ships must remain blocked from upgrade, dismantle, and fleet/battle use.

Later but important:

- Market filters/sort by faction, size, role, upgraded power, price.
- Suggested price or value score for upgraded ships.

## 7. Priority 5 — Territory Utility

Goal: territory should feed the material economy and campaign, not just ownership display.

Near-term:

- Make territory production/material relevance visible.
- Connect campaign objective candidates to production where safe.
- Keep own/enemy/neutral territory identification clean and readable.

Later:

- Sector control.
- Production multipliers.
- Resource flow into ship crafting.

## 8. QA Checklist

Before committing each meaningful batch:

- Campaign:
  - start active chapter
  - complete objective
  - verify server blocks incomplete objective
  - claim reward
  - confirm completed card folds
- Shipyard:
  - material enough
  - material missing
  - upgrade success/fail UI
  - listed ship blocked
- Fleet Command:
  - open modal
  - select ship
  - set flagship
  - change formation
  - change movement
  - verify modal stays open
- Battle:
  - small battle
  - larger battle
  - focus fire
  - EMP
  - speed toggle
- Browser:
  - desktop
  - mobile width around 390px
  - no critical console errors

## 9. Suggested Commit Batches

Use small commits in this order:

1. `fix(campaign): harden remaining rewards and chapter gates`
2. `fix(fleet): stabilize vertical command preview`
3. `feat(battle): polish vertical fleet battle readability`
4. `feat(economy): improve upgraded ship market value`
5. `docs: update audit and implementation plan`

Each commit must include matching `AUDIT_FINDINGS.md` and `CHANGELOG.md` updates.

