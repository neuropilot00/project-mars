# OCCUPY MARS - Territory Utility Plan

> Date: 2026-05-05
> Status: P5 planning complete, ready for phased implementation
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

## 3. MVP Scope

The first implementation should be conservative and low-risk.

### 3.1 Territory Production Summary

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

### 3.2 Material Drops on Harvest

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

### 3.3 Sector Profiles

Use sector type first. Do not require full 24-sector control in MVP.

| Sector Type | Identity | Production |
|---|---|---|
| Core | expensive, defended, industrial | lower common output, better high-tier crafting modifiers later |
| Mid | stable economy | balanced PP/material production |
| Frontier | risky extraction | higher rare material chance, more hijack incentive |
| POI/Special | event-driven | special materials through POI/rocket/event systems |

MVP can infer sector type from existing `sector_code`, `sector_id`, `sectors`, or `sector_definitions` data.

### 3.4 Territory Production Score

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

### 3.5 Campaign Hooks

Add campaign objective candidates after MVP is stable:

- `territory_material_harvests`: harvest any material from territory.
- `territory_rare_harvests`: harvest rare material from territory.
- `territory_production_power`: own territory with production score above threshold.
- `territory_sector_presence`: own land in a required sector type.
- `territory_defended`: survive hijack or keep shield/fleet defense active.

Do not block campaign on rare random drops until pity/guarantee exists.

## 4. Phase 2 Scope

### 4.1 Territory Upgrades

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

### 4.2 Territory Roles

Each territory can optionally choose one role:

| Role | Bonus | Tradeoff |
|---|---|---|
| Mine | more material drops | lower defense |
| Farm | stable PP output | lower rare drops |
| Fortress | stronger defense | lower production |
| Market Post | better selling/listing perks later | weaker hijack recovery |
| Research Site | rare/special roll chance | higher upkeep |

MVP should not include roles. Add after production is stable.

### 4.3 Market Integration

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

## 5. Phase 3 Scope - Sector Control

Sector control is long-term and should come after territory production works.

### 5.1 Control Score

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

### 5.2 Control Effects

Control should create visible benefits:

- production multiplier in sector
- reduced harvest cooldown
- lower shield/event cost
- sector title/banner
- campaign unlock/objective
- war declaration target

### 5.3 Conflict Rules

Avoid all-or-nothing control at first.

- Show top 3 owners/guilds per sector.
- Give small bonuses at 25%, 50%, 75% thresholds.
- Add decay so inactive owners lose influence.
- Do not let one whale permanently lock a sector without upkeep pressure.

## 6. Data Model Proposal

Use existing tables where possible.

### 6.1 New or Confirmed Tables

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
```

Only add `territory_roles` in Phase 2.

### 6.2 Existing Tables to Reuse

- `claims`
- `transactions`
- `resources` or current resource catalog
- user resource inventory table currently used by shipyard
- `sector_definitions` / `sectors`
- `territory_events`
- `territory_shields`
- `mars_weather`
- market listing tables

## 7. API Proposal

### 7.1 MVP APIs

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

### 7.2 Phase 2 APIs

```text
POST /api/territory/:claimId/upgrade
POST /api/territory/:claimId/role
GET /api/sectors/:sectorCode/control
```

## 8. UI Proposal

### 8.1 Territory Panel

Add compact production UI:

- `생산` row in the territory detail panel
- material chips with owned/estimated drop
- `수확` result toast with PP and material icons
- `생산 상세` button for full breakdown

### 8.2 My Land List

Each land card should show:

- production score
- sector type
- next harvest
- last material drop
- shield/defense state

### 8.3 Map Overlay

Add optional simple filter:

- ownership
- production
- risk
- sector type

Do not make default map visually noisy.

## 9. Balance Starting Point

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

## 10. Anti-Exploit Rules

- Material drops must be server-side only.
- Harvest cooldown must be enforced server-side.
- Listed/sold/transferred territory must not duplicate pending harvest rewards.
- If hijack transfers land, pending production state belongs to current owner only.
- Do not let users harvest deleted/abandoned claims.
- Log all material drops.

## 11. Implementation Order

### Sprint P5-1: Production Visibility

1. Identify current resource inventory tables and resource codes.
2. Add server production preview helper.
3. Add territory panel production summary.
4. No material payout yet if risk is high.

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

### Sprint P5-5: Sector Control

1. Add sector control score view.
2. Add owner/guild ranking by sector.
3. Add small threshold bonuses.
4. Add campaign objectives for sector presence/control.

## 12. Definition of Done

P5 MVP is done when:

- A player can open a territory and understand what it produces.
- Harvest can show PP plus material results.
- Materials are useful in ship crafting/upgrading.
- Campaign can ask for a non-random material/production objective.
- No internal errors occur when the user has no sector, no image, or no resource drops.

