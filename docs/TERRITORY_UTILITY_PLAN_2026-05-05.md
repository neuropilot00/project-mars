# OCCUPY MARS - Territory Utility Plan

> Date: 2026-05-05
> Status: P5 full planning complete, ready for full phased implementation
> Depends on: campaign objectives, shipyard materials, ship market, harvest transactions

## 1. Core Decision

Territory should be three things at once:

1. A personal canvas: the player owns land and uploads an image.
2. A production node: the land produces PP and ship materials.
3. A war/economy anchor: valuable land creates reasons to defend, hijack, trade, and form fleets.

Do not make territory a separate idle game. It must feed the existing campaign, shipyard, upgrade, market, and fleet loops.

## 2. Design Pillars

### 2.1 Own

The first emotional hook remains ownership.

- Claim territory.
- Name it.
- Upload image/art.
- See clear ownership state on Mars.
- Use it as the player's base of economic identity.

### 2.2 Produce

Every owned territory should produce:

- PP through the current harvest loop.
- Materials through a new territory resource roll.
- Better output when the land is larger, upgraded, or in a favorable sector.

### 2.3 Specialize

Territories should not all feel identical.

- Sector type affects production profile.
- Some sectors are stable PP farms.
- Some sectors are material-heavy.
- Some sectors are dangerous but high yield.
- Some sectors are defensive or trade-focused.

### 2.4 Fight

Valuable production must create conflict.

- High-yield land should become hijack targets.
- Shields and fleets become meaningful defenses.
- Sector control later creates group conflict.

### 2.5 Trade

Small players need something valuable to sell.

- A new player with a few good territories can harvest materials.
- Crafters and combat players buy those materials.
- Upgraded ships become end products in the market.

## 3. Full Target System

P5 is complete only when territory is the foundation under the ship economy and war economy.

Final player loop:

```text
Claim territory
  -> upload image / name / decorate
  -> harvest PP + materials
  -> upgrade territory production or defense
  -> craft / upgrade / repair ships
  -> sell surplus materials or upgraded ships
  -> defend valuable land with shields/fleets
  -> fight for sector influence
  -> unlock campaign objectives and narrative consequences
```

### 3.1 Final Feature Set

| Layer | Feature | Purpose |
|---|---|---|
| Territory identity | name, image, owner, sector, production role | make land feel personal |
| Production | PP yield, material drop, last harvest, next harvest | make land economically useful |
| Specialization | sector profiles, territory roles, upgrades | make each territory different |
| Defense | shield, fleet anchor, warning, defense score | make valuable land worth protecting |
| Market | materials, upgraded ships, territory value hints | let small and large players trade |
| Sector control | influence score, rankings, bonuses | create long-term war goals |
| Campaign | objectives and rewards tied to production/control | make territory part of story progression |
| Admin/balance | tunable rates, drop tables, sink ratios | prevent economy flood |

### 3.2 Full Completion Criteria

P5 is fully done when:

- A player can tell which territory is valuable and why.
- Owned territories produce PP and useful ship materials.
- Territory output visibly feeds ship crafting/upgrades/market.
- Upgrading a territory changes production/defense in a readable way.
- Sector type and sector control create strategic placement decisions.
- Campaign chapters can ask for territory production/control without relying on pure luck.
- Admin can tune drop rates, upgrade costs, sector bonuses, and economy pressure.

## 4. Phase 1 - Production Foundation

This is the first implementation phase, not the whole plan.

The first implementation should be conservative and low-risk.

### 4.1 Territory Production Summary

Add a visible production block to owned territory panels:

- PP yield estimate
- next harvest time
- sector type
- likely material drops
- current modifiers
- last harvest result

Example:

```text
Production
PP: 0.18 / harvest
Materials: Iron Dust common, Carbon Fiber common, Ice Crystal rare
Modifiers: Frontier +20% rare materials, image bonus active
Last harvest: +0.18 PP, Iron Dust x2
```

### 4.2 Material Drops on Harvest

Keep existing PP harvest intact. Add material drops on top.

Rules:

- Harvest always keeps the existing PP payout behavior.
- Material rolls are additional.
- Drop chance is based on sector profile, territory size, and optional modifiers.
- Result must be returned in `/api/harvest` response and shown in UI.

Initial material pool should reuse current shipyard resources:

| Resource | Role |
|---|---|
| `iron_dust` / iron-like resource | common hull material |
| `carbon_fiber` | common frame material |
| `silicon_chip` | electronics |
| `ice_crystal` | rare coolant/shield material |
| `nano_polymer` | advanced hull material |
| `plasma_crystal` | weapon/beam material |
| `titanium_alloy` or current equivalent | heavy ship material |
| `ancient_metal` | special rare material |
| `plasma_dust` | special high-tier material |

Use actual existing resource codes from DB/code. Do not invent parallel resources if equivalents already exist.

### 4.3 Sector Profiles

Use sector type first. Do not require full 24-sector control in MVP.

| Sector Type | Identity | Production |
|---|---|---|
| Core | expensive, defended, industrial | lower common output, better high-tier crafting modifiers later |
| Mid | stable economy | balanced PP/material production |
| Frontier | risky extraction | higher rare material chance, more hijack incentive |
| POI/Special | event-driven | special materials through POI/rocket/event systems |

MVP can infer sector type from existing `sector_code`, `sector_id`, `sectors`, or `sector_definitions` data.

### 4.4 Territory Production Score

Each owned claim gets a readable score:

```text
Production Power = base pixel count
  x sector profile multiplier
  x image/art bonus
  x adjacency bonus
  x weather/event modifiers
  x territory upgrade modifiers
```

Keep this as a server-side calculation. UI should display the result, not recalculate truth.

### 4.5 Campaign Hooks

Add campaign objective candidates after MVP is stable:

- `territory_material_harvests`: harvest any material from territory.
- `territory_rare_harvests`: harvest rare material from territory.
- `territory_production_power`: own territory with production score above threshold.
- `territory_sector_presence`: own land in a required sector type.
- `territory_defended`: survive hijack or keep shield/fleet defense active.

Do not block campaign on rare random drops until pity/guarantee exists.

## 5. Phase 2 - Territory Upgrades and Roles

### 5.1 Territory Upgrades

Add upgrades that improve production and defense.

Recommended upgrade tracks:

| Track | Effect | Sink |
|---|---|---|
| Extractor | material drop quantity/chance | GP + common materials |
| Refinery | converts common material into advanced material later | GP + silicon/nano |
| Shield Grid | hijack defense/shield duration | GP + plasma/ice |
| Relay Tower | sector visibility, warning, campaign objective support | GP + electronics |
| Art Beacon | image/brand visibility, small PP bonus | PP/GP |

Upgrade UI should show:

- current level
- next effect
- cost owned/required
- whether the territory is listed/locked/in conflict

### 5.2 Territory Roles

Each territory can optionally choose one role:

| Role | Bonus | Tradeoff |
|---|---|---|
| Mine | more material drops | lower defense |
| Farm | stable PP output | lower rare drops |
| Fortress | stronger defense | lower production |
| Market Post | better selling/listing perks later | weaker hijack recovery |
| Research Site | rare/special roll chance | higher upkeep |

MVP should not include roles. Add after production is stable.

### 5.3 Upgrade Cost Philosophy

Upgrade costs should create long-term sinks without making early players feel locked out.

| Upgrade Tier | Target Player | Cost Pattern |
|---|---|---|
| Lv 1-3 | early user | GP + common material |
| Lv 4-6 | active user | GP + common + uncommon |
| Lv 7-9 | invested user | GP + rare material |
| Lv 10+ | whale/guild/endgame | GP + rare + special + upkeep pressure |

Do not use only GP. Territory upgrades should consume the materials that territory produces.

### 5.4 Market Integration

Materials from territory should support:

- ship crafting
- ship upgrading
- market resource sales
- future repair/beam cannon ammunition economy

Market should eventually show:

- material origin sector
- 24h/7d price hint
- common crafting demand
- quick sell/list from inventory

## 6. Phase 3 - Sector Control and War Economy

Sector control is long-term and should come after territory production works.

### 6.1 Control Score

Sector control is not just land count.

```text
Control Score =
  territory area
  + production power
  + active defense/fleet presence
  + guild ownership share
  + recent successful defense
  - abandoned/inactive land penalty
```

### 6.2 Control Effects

Control should create visible benefits:

- production multiplier in sector
- reduced harvest cooldown
- lower shield/event cost
- sector title/banner
- campaign unlock/objective
- war declaration target

### 6.3 Conflict Rules

Avoid all-or-nothing control at first.

- Show top 3 owners/guilds per sector.
- Give small bonuses at 25%, 50%, 75% thresholds.
- Add decay so inactive owners lose influence.
- Do not let one whale permanently lock a sector without upkeep pressure.

### 6.4 Sector Influence States

| State | Threshold | Effect |
|---|---:|---|
| Presence | 10% control score | sector appears in owner influence list |
| Stakeholder | 25% | small production bonus, sector badge |
| Dominant | 50% | stronger production/defense bonus, public sector banner |
| Governor | 75% | highest bonus, campaign/chronicle event, target for rivals |

Bonuses should be useful but not unbeatable. Control must create conflict, not end it.

### 6.5 Decay and Upkeep

Control must decay when players stop playing.

- inactive claims lose influence contribution after configurable days
- shielded/defended/harvested claims retain more influence
- high control tiers require upkeep or recent activity
- hijack/defense events affect sector score

## 7. Full Sector and Resource Design

### 7.1 Sector Archetypes

Use existing sector names where available. If the DB has only coarse sector data, implement by sector type first and map names later.

| Archetype | Example Identity | Good For | Weakness |
|---|---|---|---|
| Industrial Core | forge/vault/citadel zones | upgrades, refining, defense | expensive, lower raw output |
| Trade Midline | station/crossing/fields zones | stable PP, market, logistics | average rare drops |
| War Frontier | abyss/scars/wastes zones | rare material, high yield | hijack risk |
| Research/POI | ruins/caves/anomalies | special materials, campaign hooks | inconsistent output |
| Safe Frontier | beginner-friendly zones | onboarding, stable common output | lower high-tier ceiling |

### 7.2 Resource Families

Use existing shipyard resource codes. Group them by gameplay role:

| Family | Example Codes | Main Use |
|---|---|---|
| Structural | iron-like, titanium-like, carbon-like | hulls, destroyers, battleships |
| Electronics | silicon-like, nano-like | EW, sniper, relay, targeting |
| Thermal/Shield | ice-like, plasma-like | shield, coolant, beam weapons |
| Ancient/Special | ancient metal, plasma dust, meteorite-like | titan, rare upgrades, event crafting |

### 7.3 Resource Distribution Target

| Sector Type | Common | Uncommon | Rare | Special | Identity |
|---|---:|---:|---:|---:|---|
| Core | medium | high | low | very low | refined industry |
| Mid | high | medium | low-medium | very low | stable economy |
| Frontier | medium | medium | high | low | risky extraction |
| POI/Event | low | medium | high | medium | special reward |

### 7.4 Claim Size Scaling

Large land should matter, but not break economy.

Recommended formula style:

```text
productionScore =
  baseFromPixels
  x sectorMultiplier
  x artMultiplier
  x adjacencyMultiplier
  x upgradeMultiplier
  x weatherMultiplier

baseFromPixels = 1 + log10(pixelCount + 1) * 0.55
```

Avoid linear output by pixel count.

## 8. Full Economy Connections

### 8.1 Shipyard

Territory materials should directly support:

- ship construction
- stat upgrades
- repair
- shield recovery
- later: beam cannon charge/ammunition or war consumables

### 8.2 Market

Market should eventually support:

- resource selling
- resource bulk listing
- filter by resource family
- price history
- "needed for ships" hint
- territory origin label for rare materials

Example listing card:

```text
Ice Crystal x12
Origin: Phlegra Deep / Frontier
Used For: shield upgrades, cruiser coolant
7d avg: 7.8 PP
```

### 8.3 Fleet War

Territory should matter to fleet war through:

- defending valuable claims
- sector control conflicts
- campaign battle objectives tied to territory control
- future forward base or deployment bonus

Do not make fleet battle require territory for basic play. Territory should add strategic depth, not block combat.

## 9. Campaign Integration - Full Plan

Campaign should introduce P5 in layers.

| Campaign Stage | Territory Lesson |
|---|---|
| Prologue/CH1 | claim land, upload image, harvest PP |
| Early CH2-CH3 | harvest material, craft/upgrade ship |
| Mid CH4-CH6 | specialize territory, use production to support fleet |
| Late CH7-CH10 | defend valuable territory, participate in sector influence |
| FSP/CV routes | alternate sector/resource philosophies |

Objective candidates:

| Objective | Use When |
|---|---|
| `territory_material_harvests` | after material harvest exists |
| `territory_common_material_qty` | reliable crafting tutorial |
| `territory_production_score` | teaches territory value |
| `territory_upgrade_level` | teaches upgrade sink |
| `territory_role_assigned` | teaches specialization |
| `sector_presence` | teaches sector map |
| `sector_control_score` | late-game only |
| `territory_defense_success` | late-game/war route |

Do not gate early campaign on rare drops or PvP outcomes.

## 10. UX Full Plan

### 10.1 Territory Detail Panel

Final panel sections:

1. Owner/status
2. Image/art preview
3. Production summary
4. Harvest button/result
5. Upgrade/role section
6. Defense section
7. Market/transfer status
8. Sector influence

Keep mobile compact. Use collapsible sections.

### 10.2 My Land Page

Needed filters/sorts:

- highest production
- ready to harvest
- rare material chance
- under threat
- sector
- role
- shield status

### 10.3 Map Overlay

Optional overlays:

- ownership
- production heat
- sector control
- conflict/risk
- harvest-ready

Default map should stay clean and playable.

### 10.4 Harvest Result

Harvest should feel rewarding:

```text
Harvest Complete
+0.18 PP
Iron Dust x3
Carbon Fiber x1
Rare roll missed: Ice Crystal 8%
```

Show misses only in detailed view, not as spam.

## 11. Admin and Tuning Plan

Admin needs controls before this affects economy heavily.

Required admin settings:

- material drop enabled
- sector profile rates
- claim size multiplier cap
- rare drop cap
- harvest cooldown
- upgrade cost multiplier
- sector control decay
- max sector bonus

Admin audit views:

- materials issued per day
- materials burned per day
- top producing claims
- top producing sectors
- market prices by resource
- suspicious harvest frequency

## 12. Risk Controls

### 12.1 Economy Flood

Risk: material drops flood shipyard/market.

Controls:

- conservative starting rates
- daily issuance dashboard
- material sinks through upgrades/repair
- logarithmic claim size scaling

### 12.2 Whale Domination

Risk: large landowners dominate sectors permanently.

Controls:

- influence decay
- upkeep pressure
- threshold bonuses instead of winner-take-all
- defensive but not invincible shields

### 12.3 Campaign RNG Frustration

Risk: user cannot progress because rare material did not drop.

Controls:

- early objectives use common materials or production score
- pity counters for rare objectives
- rare objectives optional or late-game

### 12.4 UI Overload

Risk: territory panel becomes unreadable.

Controls:

- compact default
- detail expanders
- mobile-first card layout
- map overlays off by default

## 13. Data Model Proposal

Use existing tables where possible.

### 13.1 New or Confirmed Tables

```sql
territory_production_profiles
- id
- sector_type
- resource_code
- base_rate
- min_qty
- max_qty
- rarity
- active

territory_harvest_drops
- id
- claim_id
- wallet
- resource_code
- quantity
- harvest_tx_id
- created_at

territory_upgrades
- id
- claim_id
- upgrade_key
- level
- updated_at

territory_roles
- claim_id
- role_key
- assigned_at

sector_control_snapshots
- id
- sector_code
- wallet
- guild_id
- control_score
- control_pct
- rank
- snapshot_at

territory_production_events
- id
- claim_id
- wallet
- event_type
- payload_json
- created_at
```

Only add `territory_roles` in Phase 2.

### 13.2 Existing Tables to Reuse

- `claims`
- `transactions`
- `resources` or current resource catalog
- user resource inventory table currently used by shipyard
- `sector_definitions` / `sectors`
- `territory_events`
- `territory_shields`
- `mars_weather`
- market listing tables

## 14. API Proposal

### 14.1 Phase 1 APIs

```text
GET /api/territory/:claimId/production
```

Returns:

- claim id
- owner
- sector
- production score
- PP estimate
- material drop table
- modifiers
- last harvest drops
- next harvest time

```text
POST /api/harvest
```

Extend existing response:

- existing PP result
- material drops
- updated inventory
- campaign objective progress hint when relevant

### 14.2 Phase 2+ APIs

```text
POST /api/territory/:claimId/upgrade
POST /api/territory/:claimId/role
GET /api/sectors/:sectorCode/control
GET /api/territory/production/summary?wallet=...
GET /api/admin/territory/economy
POST /admin/api/territory/production-profile
```

## 15. Balance Starting Point

MVP should be modest.

- Common materials: frequent but low quantity.
- Rare materials: visible but not mandatory for early campaign.
- Special materials: event/POI/frontier flavored.
- PP output remains current baseline.
- Material output should help shipyard but not flood it.

Suggested starting rates per harvest:

| Drop Tier | Chance | Quantity |
|---|---:|---:|
| Common | 40-70% | 1-5 |
| Uncommon | 15-30% | 1-3 |
| Rare | 3-10% | 1 |
| Special | 0.2-2% | 1 |

Scale by claim size carefully. Use logarithmic or stepped scaling so huge claims do not explode the economy.

Example:

```text
sizeBonus = 1 + min(1.5, log10(pixelCount + 1) * 0.25)
```

## 16. Anti-Exploit Rules

- Material drops must be server-side only.
- Harvest cooldown must be enforced server-side.
- Listed/sold/transferred territory must not duplicate pending harvest rewards.
- If hijack transfers land, pending production state belongs to current owner only.
- Do not let users harvest deleted/abandoned claims.
- Log all material drops.

## 17. Implementation Order

### Sprint P5-1: Production Visibility

1. Identify current resource inventory tables and resource codes.
2. Add server production preview helper.
3. Add territory panel production summary.
4. Add admin-safe settings defaults.
5. No material payout yet if risk is high.

### Sprint P5-2: Material Harvest

1. Add production profile data.
2. Add material roll to harvest.
3. Add harvest result UI.
4. Add campaign objective state for material harvest count.

### Sprint P5-3: Shipyard Connection

1. Confirm harvested materials match shipyard requirements.
2. Add market resource listing/selling if not already complete.
3. Add material origin/production hints.

### Sprint P5-4: Territory Upgrades

1. Add extractor/refinery/shield upgrade tracks.
2. Add upgrade modal.
3. Connect upgrade effects to production preview and harvest.

### Sprint P5-5: Territory Roles and Defense

1. Add territory role assignment.
2. Add role tradeoff preview.
3. Add defense score/shield/relay summary.
4. Connect valuable territory to hijack warning and fleet defense hooks.

### Sprint P5-6: Sector Control

1. Add sector control score view.
2. Add owner/guild ranking by sector.
3. Add small threshold bonuses.
4. Add campaign objectives for sector presence/control.

### Sprint P5-7: Admin, Economy Tuning, and Seasons

1. Add material issuance/burn dashboard.
2. Add sector profile editor.
3. Add suspicious harvest diagnostics.
4. Add economy sink/faucet warnings.
5. Add seasonal production modifiers after admin tuning exists.

## 18. Definition of Done

P5 Phase 1 is done when:

- A player can open a territory and understand what it produces.
- Harvest can show PP plus material results.
- Materials are useful in ship crafting/upgrading.
- Campaign can ask for a non-random material/production objective.
- No internal errors occur when the user has no sector, no image, or no resource drops.

P5 full system is done when:

- territory production, upgrades, roles, market material flow, and sector control all work together.
- players have a reason to own more than one territory.
- weaker players can sell materials into the economy.
- stronger players need materials to craft, upgrade, and wage war.
- sector ownership creates long-term strategic goals without making new players irrelevant.
