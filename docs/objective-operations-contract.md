# Registered objective PvE (review clone, 2026-10-10)

Three server factories create real battles with existing owned fleets and full catalog NPC hulls. No HP, paid quality, upgrades or ordinary PvP input is reduced. Each operation has 3–5 participating fleets and a 150-second objective deadline.

| Mode | Player fleets | Other fleets | Server win condition |
| --- | --- | --- | --- |
| Escort | 1–2 | Friendly convoy + two enemy fleets | Marked supply flagship survives its 120-second route. |
| Hold | 1–3 | Two enemy fleets | An owned live fleet center occupies the marked central circle for 90 cumulative seconds while no live enemy fleet center occupies it. Contested time pauses accumulation. |
| Flagship | 1–3 | Two enemy fleets | Destroy the marked command flagship within 150 seconds, even if its escorts survive. Six armed hulls are recommended. |

Player fleet elimination or retreat fails every mode. Convoy flagship loss fails escort. Deadline expiry fails an incomplete objective. The authoritative engine checks these conditions before ordinary annihilation outcomes, records progress in timeline frames and persists `objective_result` in the result summary.

NPC types use active catalog frigates: `cv_int` command/tackle, `cv_frg` armed escort and `fsp_logi` supply support. Primary flagship formation contains the command hull and two armed escorts; other enemy formations contain tackle and one escort. Convoy contains support and tackle. All retain catalog HP/ATK/DEF; common quality has no purchased bonuses. This composition, rather than an arbitrary stat multiplier, calibrates the encounter.

## Registration and API

Migration 345 adds a private NPC marker and `objective_operation_runs` with one active operation per wallet and an idempotent `(wallet, request_key)` unique key. The factory creates the registry, NPCs, battle and fleet occupation atomically. JWT wallet identity controls ownership; client flags, objective configurations and wallet query parameters cannot create a trusted operation.

- `GET /api/objective-ops`: localized catalog, real owned fleets, recent operation results and loss/reward policy.
- `POST /api/objective-ops/:mode/start`: `{fleetIds: [positive bigint ID strings], requestKey: UUID}`. Returns the actual `battleId`. Repeating the same request returns the same battle; changed inputs with the same key fail.
- `GET /api/objective-ops/runs/:battleId`: only the registered human owner can retrieve the run.

Selected fleets must be owned, available, outside combat/mining/cargo transport, and contain living repaired hulls. At most 30 player hulls participate. The loss protection and objective hooks require both the persisted registry and actual private NPC participants, not summary flags alone. Generic AI discovery/fight routes hide or reject these private NPCs. There is no existing route that joins arbitrary fleets to an existing event battle.

## Engine hook contract and pacing

`loadRegisteredObjective(db,battle)` returns verified configuration or null for ordinary battles. `initObjective(state,config)` sets initial positions; `beforeTick(state)` moves the convoy along its route after fleet movement and before ship positions; `evaluateObjective(state)` returns null or `{winner_side,progress}` after combat and retreat. Duplicate evaluation of the same tick cannot advance the clock. Progress exposes actual elapsed seconds, marked target/HP, route or zone control, completion and reason.

The existing combat cooldown uses 200 ms logical ticks. Objective operations use a separate 200 ms live tick selection so their actual pace, objective clock and existing cooldown agree. Ordinary live PvP retains its configured pace. The hook still measures `state.liveTickMs` when provided. Precomputed fallback contains the same objective progression in the saved timeline; its computation time is not gameplay duration.

Registered objectives have no permanent hull loss, a 15% safe-training HP floor, and ordinary repair costs afterward. Generic currency/resource/OPS rewards, salvage wreck generation and NPC respawn are skipped. Operation history is the completion record; repeating operations cannot mint economic assets.

## Validation

`DATABASE_URL=postgresql://jongho@localhost:5432/codex_occupy_review_upgrade_20261010 NODE_ENV=development node server/tools/objective_operations_regression.js`

Validates 120 ms hook pacing independently, uncontested/contested hold, convoy arrival/loss, exact flagship kill, duplicate-tick idempotence, wrong ownership and mining rejection, four concurrent starts creating one registered battle, full catalog NPC HP and zero bonuses, forged source rejection, real engine simulations and committed settlement for all three modes, no GP/reward/wreck issuance, and repeated settlement leaving the stored timestamp unchanged. A loopback HTTP server validates authentication, JWT identity, private result ownership and forged POST rejection.

`... node server/tools/objective_operations_regression.js --live`

Also runs all three real live engine loops concurrently at 200 ms, records actual wall time and authoritative progress, checks objective frames and settles the actual results. Fixture fleets contain six unmodified `mcc_frg` hulls. Timing is an observed fixture result, not a duration guarantee for stronger hulls, tactical skills or player commands.

Observed live results: hold battle 220, 90 objective seconds / 90.8 wall seconds; escort battle 221, 120 / 121.1 seconds; flagship battle 222, 105 / 105.9 seconds. All three succeeded and committed real results. Evidence is saved in the parent workspace at `outputs/evidence/objective-operations-validation.json`.

Frontend entry point is `openObjectiveOperations`; the parent mounts the router, scripts/styles and navigation. Browser acceptance remains separate from these source/DB/live-engine checks. Rollback SQL is under `server/rollback`, outside automatic migration discovery.
