# Collection and salvage contract (review clone, 2026-10-10)

Existing prices, crate class weights, quality bonus ranges, upgraded hulls and tradeable duplicate instances remain intact. The first `recruit_crate` result is guaranteed to match the selected faction; the starter operations system owns the separate three-role tutorial fleet.

## Pre-draw disclosure

`GET /api/ships/crates` retains `odds` as base class percentages and adds `disclosure`:

- `base_class_odds`, `effective_class_odds`: current pity conditioning and faction-specific Titan-to-battleship cap substitution.
- `quality_odds`, `quality_bonus_ranges`, `quality_variance`: independent quality roll, per-stat range × 0.7–1.3 followed by rounding.
- `outcomes`: requested class, resulting class, faction, exact ship type, percentage, usability, substitution and known unavailable result.
- `personalized`, `first_recruit_own_faction`, `cross_faction_pct`, `usable_pct`, `unavailable_pct`, `pity_active`, `cap_snapshot`, `snapshot_at`.

The same builder selects the actual draw outcome. A fresh disclosure is fetched for the confirmation UI. Failed quota/ownership/type checks roll back GP and ship creation. Anonymous responses explicitly contain base odds and require faction selection for personalized odds. The disclosure is a snapshot; the cap is rechecked at opening.

## Permanent discovery and paid reconstruction

Migration 340 backfills existing ships and crate pull history into `(lowercase wallet, ship type)` discoveries. Insert/ownership/quality triggers preserve discoveries through loss and sale, and augment observed quality grades. No existing instance or bonus is converted or deleted. New ordinary hulls default to `common`; historical rows are unchanged.

`GET /api/ships/collection` includes recorded grades, living hull count and eligible lost hulls. `GET /api/ships/collection/:shipId/rebuild-quote` exposes the actual type recipe and GP cost, current resource inventory, locks, duration, `quality: common` and `bonus_preserved: false`. `POST .../rebuild` validates and deducts in one transaction, then creates an ordinary build job. The existing completion/refund/cancellation path produces the hull.

Only an owned, actually destroyed, not-scrapped hull of the current faction with a permanent discovery can be reconstructed. The normal type/rank/server/player/total limits apply. Nonpositive or malformed recipes/costs and assembled zero-cost hulls are ineligible. Non-bomber frigates finish in at most 300 seconds; other types retain their normal duration. A source hull supports at most one active/completed replacement job. Cancellation or refund permits another paid attempt. Quality rolls, stat upgrades and shields are not duplicated; the original historical instance remains unchanged.

## Bounded wreck issuance

Migration 343 adds a daily ledger and a claim ledger unique by both wreck and lost source hull. A killer user lock serializes claims of different wrecks. Only a verified opposing human participant in a settled battle can claim resources from a currently dead source owned by the recorded victim. AI participants, AI/practice/campaign/ranked/starter context, same-wallet losses, active/restored/scrapped/missing sources and duplicate source claims are rejected while killmail history remains.

Original free starter hull IDs recorded in `starter_fleet_grant_ships` never issue salvage, including ordinary PvP losses and later ownership transfers. Both prequote and claim return `STARTER_HULL_SALVAGE_FORBIDDEN`; the killmail remains and no daily budget or inventory changes. This complements the separate one-time starter rescue rule without permitting free material farming.

Daily hard resource maxima (Asia/Seoul DB day): iron_dust 240, hull_plate 80, alloy_frame 40, plasma_coil 18, rare_metal 12. No GP/PP is paid by salvage. Resource maps are whitelisted; no fallback manufacturing from display value occurs. If the full recorded recovery exceeds any remaining daily allowance, the request returns `SALVAGE_DAILY_LIMIT` with the budget and requested vector. Nothing is issued and the wreck remains unclaimed. `GET /api/killboard/salvage-policy` and `GET /api/killboard/:id/salvage-quote` disclose the limits before confirmation.

## Competitive quality budget proposal (not activated)

Source: `shipCrate.rollBonusStats` allows legendary bonuses per stat from 35% to 110.5% of base, with 67.5% expected before integer rounding. The expected additive stat bonus is about 2.03% for recruit versus 18.4% for legendary crates under current grade weights. `battleEngine.initShip` adds these stored bonuses directly to ATK/DEF/HP/speed. This establishes an actual combat input difference, not an observed win-rate claim.

Use a separate **standard fleet league** factory and persisted match registration, rather than changing ordinary PvP or owned assets. Suggested first match contract: three canonical role slots selected by tactic, identical per-slot stat budget across factions, full simulated HP, zero simulated engraving/upgrades/shields, and an explicit `standard_v1` ruleset. Formation, movement, target selection and role composition remain player choices. Fleet creation validates that players own the relevant role discovery; simulation clones the input. Applying match results must skip physical HP, destruction, wreck issuance, resource/GP rewards and normal OPS kill rewards; only a dedicated league rating/result ledger can advance once. Client-submitted `battle_summary` must not authorize this mode.

Acceptance: same role selection yields equal stat budgets across accounts with common/legendary assets; stored hull attributes remain byte-for-byte unchanged; ordinary PvP uses its existing inputs; duplicate/end/replay issues league rating once and no economic assets; match consent exposes the ruleset and loss policy. A distinct endpoint, server registration and result path are required before enabling it. No blanket quality nerf has been applied.

## Verification

`DATABASE_URL=postgresql://jongho@localhost:5432/codex_occupy_review_upgrade_20261010 NODE_ENV=development node server/tools/ship_collection_regression.js`

PASS exact class/quality/cross/pity/Titan substitution; first own-faction recruit; 5 concurrent free calls produce one hull; collection survives sale/death; forged source is rejected; insufficient resources roll back; 4 concurrent rebuilds deduct once; 2 completions produce one common hull; paid quality/bonuses/upgrades remain; scrapped sources are rejected.

`... node server/tools/ship_salvage_regression.js`

PASS source eligibility; 4 same-wreck claims issue once; AI/practice/starter/self/alive/unsettled/duplicate source rejection; 6 distinct claims cannot exceed daily issuance; unclaimed wrecks stay unclaimed at cap; actual loopback HTTP routes enforce JWT identity, authenticated collection, paid crate disclosure and 429 budget response.

Migrations 340 and 343 were reapplied successfully in the review clone. Manual rollback SQL resides in `server/rollback`, outside automatic migration discovery. Browser/mobile acceptance is owned by the parent task. Existing `db.js` timezone initialization produces a pg concurrent-query deprecation warning during tests; it did not fail these assertions.
