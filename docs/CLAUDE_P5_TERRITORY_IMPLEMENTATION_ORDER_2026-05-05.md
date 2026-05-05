# Claude Implementation Order - P5 Territory Utility

> Date: 2026-05-05
> Primary full plan: `docs/TERRITORY_UTILITY_PLAN_2026-05-05.md`
> Existing roadmap: `docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md`

## 0. Read Order

1. `CLAUDE.md`
2. `AUDIT_FINDINGS.md`
3. `CHANGELOG.md`
4. `docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md`
5. `docs/TERRITORY_UTILITY_PLAN_2026-05-05.md`
6. This file

## 1. Immediate Goal

Implement the full P5 system in phases. Start with P5-1 because later phases depend on server-side production truth.

Do not skip ahead to sector control, guild dominance, territory roles, or a full war system before production preview and material harvest exist.

Important: this is an implementation order, not a reduced scope. The final target is the full territory economy described in `docs/TERRITORY_UTILITY_PLAN_2026-05-05.md`.

The first user-facing goal:

- A player opens owned territory.
- They can see what the territory produces.
- They can understand why that land matters for PP/material/ship economy.

The full end goal:

- Territory produces PP and materials.
- Territory upgrades and roles create specialization.
- Materials feed ship crafting, upgrades, repair, and market.
- Valuable land creates defense/hijack/fleet reasons.
- Sector control creates late-game strategic goals.

## 2. Sprint P5-1 - Production Preview Only

### 2.1 Server

Add a server-side helper for territory production preview.

Expected behavior:

- Accept wallet and claim id.
- Verify claim exists.
- Detect owner, pixel count, sector info, image/art state, adjacency bonus if available.
- Return a normalized production summary.
- Never throw internal errors for missing sector/image/resource data. Use safe fallback.

Suggested output shape:

```json
{
  "claimId": 123,
  "owned": true,
  "sector": {
    "code": "hellas_abyss",
    "type": "frontier",
    "name": "Hellas Abyss"
  },
  "production": {
    "score": 142,
    "ppEstimate": 0.18,
    "nextHarvestAt": "2026-05-05T00:00:00.000Z",
    "modifiers": [
      { "label": "Frontier rare material", "value": "+20%" },
      { "label": "Image active", "value": "+5%" }
    ]
  },
  "materials": [
    { "code": "iron_dust", "name": "Iron Dust", "rarity": "common", "chance": 0.45, "minQty": 1, "maxQty": 3 }
  ],
  "lastHarvest": {
    "pp": 0.18,
    "materials": []
  }
}
```

Add endpoint:

```text
GET /api/territory/:claimId/production?wallet=...
```

If an existing territory route is more appropriate, use it. Keep API naming consistent.

### 2.2 Frontend

Add compact production UI to owned territory detail panel.

Required display:

- Production score
- PP estimate or current harvest value
- likely material chips
- current modifiers
- last harvest result if available
- next harvest time if available

Do not overcrowd the Mars map. The production details belong inside the territory detail panel or a small expanded section.

### 2.3 Docs

Update:

- `CHANGELOG.md`
- `AUDIT_FINDINGS.md`
- `CLAUDE.md`
- `docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md` if implementation scope changes

## 3. Sprint P5-2 - Material Drops on Harvest

Start only after P5-1 is stable.

Expected behavior:

- Existing PP harvest remains unchanged.
- Material drops are added on top.
- Drops are logged.
- Response includes dropped materials.
- UI toast/result shows PP plus materials.
- Campaign can later count material harvests.

Do not block campaign on rare random drops without pity/guarantee.

## 4. Sprint P5-3 - Shipyard Connection

Start only after material drops are verified.

Expected behavior:

- Harvested material codes match shipyard requirement codes.
- Shipyard cards make it clear which required materials come from territory production.
- Resource market listing/selling remains compatible.

## 5. Sprint P5-4 - Territory Upgrades and Roles

Start only after P5-1 to P5-3 are stable.

Expected behavior:

- Add extractor/refinery/shield/relay/art upgrade tracks.
- Show owned/required costs.
- Upgrade effects change production preview and harvest result.
- Roles are optional specialization, not mandatory.
- Role tradeoffs must be visible before selection.

## 6. Sprint P5-5 - Sector Control

Start only after production and upgrade loops are stable.

Expected behavior:

- Compute control score by territory area, production power, defense/fleet presence, activity, and guild share if available.
- Show top owners/guilds per sector.
- Add small threshold bonuses at presence/stakeholder/dominant/governor tiers.
- Add decay/upkeep so control is not permanent.
- Add campaign objectives only for late-game routes.

## 7. Sprint P5-6 - Admin and Economy Tuning

Expected behavior:

- Admin can inspect material issuance/burn.
- Admin can tune production profiles.
- Admin can detect suspicious harvest frequency.
- Admin can see top producing claims and sectors.
- Economy warnings exist before material supply gets out of control.

## 8. Sprint P5-7 - Campaign and Season Integration

Start only after production, harvest, and upgrade data are stable.

Expected behavior:

- Early campaign objectives use deterministic territory actions, not rare RNG.
- Mid campaign objectives can require production score, owned materials, or upgrade levels.
- Late campaign objectives can reference sector presence/control.
- Season events can temporarily adjust territory production profiles through admin settings.
- Campaign reward text explains why territory production matters for fleet and market progress.

## 9. Hard Stops

Do not implement these before P5-1/P5-2 are working:

- Sector control score
- guild sector dominance
- territory role selection
- territory upgrade tracks
- production multipliers that affect the economy heavily
- new resource catalog duplicating existing resources

## 10. Verification Checklist

Before commit:

- Owned territory with image renders production summary.
- Owned territory without image renders production summary.
- Territory with missing/null sector does not crash.
- Non-owned territory does not leak private owner production details.
- `/api/territory/:claimId/production` returns stable JSON.
- Existing harvest still works.
- `git diff --check` passes.

If frontend changes touch `index.html`, run inline script syntax validation.
