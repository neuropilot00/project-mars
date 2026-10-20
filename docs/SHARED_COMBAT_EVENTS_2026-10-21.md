# Authoritative shared combat follow-up — 2026-10-21

Scope: surgical changes in `server/services/battleEngine.js`, `siege.js`, `siegeFleetBridge.js`, and dedicated fixture tests. Existing dirty changes were preserved. No production config/DB, accounts, keys, real money, chain, mail, bootstrap, migration, push or deployment was used.

## Source-backed missing connections and corrections

1. `processCombat` and `_applySkill` already call `applyDamage` to apply actual shield/hull loss, but `captureFrame` previously sent only positions/HP and omitted real hits and shield state. Added bounded `combat_events` plus `ships[].shield_hp/shield_max` to the same authority frame. Stored replay uses the same events; live authority stamping remains confined to the broadcast copy. Timeout now flushes final authoritative state/hits even between regular snapshots.
2. The siege bridge previously passed `battleWinnerWallet` without checking battle status; `resolveSiege` trusted that hint instead of checking the persisted battle. Actual source fixture reproduced preparing/active → resolved, prematurely changing governance and publishing a chronicle. A fleet-combat siege without its assembled battle also incorrectly fell through to pixel-area settlement. New tests failed 3/3 before the correction (existing 16 passed). Bridge now accepts only `ended`, resolver re-reads its canonical stored battle inside the siege transaction, ignores stale winner hints, and waits when no battle has been assembled. Existing explicit operator `force` behavior and cancelled/missing battle defender retention remain unchanged. After: all 19 siege groups pass.

## Frame contract

`combat_events` contains only instant hits already applied by the engine; client projectile travel cannot cause another hit or delay gameplay damage.

```js
{
  id: `${battle_id}:combat:${seq}`, seq, tick, type: 'shot_hit',
  source_ship_id, source_fleet_id, source_side,
  target_ship_id, target_fleet_id, target_side,
  fire_type, from: { x, y }, to: { x, y },
  damage, hull_damage, shield_damage, target_hp, target_shield_hp, destroyed
}
```

IDs preserve existing raw DB IDs, including BIGINT strings. `seq` increases once per actual hit in that simulation. Coordinates use the existing 1000×440 engine field and one decimal place. `damage` is the existing computed damage, including possible overkill; `hull_damage` and `shield_damage` are actual clamped losses. Manual beam/missile/overdrive damage uses the actual skill name rather than its source hull's ordinary weapon. Existing EW/repair rules are unchanged; these support operations are not falsely represented as damaging hits.

The pending visual queue and each frame are bounded at 128. Oldest visual events beyond that bound are omitted and counted in `combat_events_dropped`; damage, destruction, statistics, commands and settlement still execute normally. Queue capture drains each event once. Persisted frames/resends keep their IDs; consumers deduplicate those IDs. This does not claim deterministic random outcomes across a new re-simulation.

## Current real loop and limits

| Step | Existing source behavior |
|---|---|
| Guild → siege | Membership determines side, owned eligible fleet commitment, side cap; membership/ownership rechecked when assembling one common battle. Existing `shared-war.test.js` verifies these injected-service boundaries. |
| Combat | Existing tactics/movement, normal attacks, server manual skills, real shield/hull loss. Frames now expose the corresponding actual hits. |
| Siege result → territory governance | `siege.resolveSiege` settles `sector_governance`, guild governance where enabled, and aggregate `siege_resolved` chronicle. This is governance, not automatic transfer of every claimed pixel. Existing `siege_governor_canonical_enabled` controls the further geo-governor/tax synchronization; no setting was enabled here. |
| Rebuild | Resolved participation receipt already returns `nextAction:'repair_and_rebuild'`; existing `ship.repairShip` / ship production are real separate out-of-battle actions. No free repair or new reward was added. |
| Production / cargo / contribution | These resource and treasury actions have their own existing effects. `getSiegeParticipation` explicitly returns `supplyAffectsSiege:false`; they are not an implicit siege damage/speed buff. No new battle supply consumption or buffs were invented. |

## Validation commands and observed evidence

Run from the worktree root with a cleared environment:

```sh
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/usr/bin:/bin NODE_ENV=test node --require ./server/tests/isolation-guard.cjs --test server/tests/battle-combat-events.test.js server/tests/shared-war.test.js
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/usr/bin:/bin NODE_ENV=test node server/tools/battle_combat_ws_regression.js
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/usr/bin:/bin NODE_ENV=test node server/tools/shared_battle_clients_regression.js
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/usr/bin:/bin NODE_ENV=test node --require ./server/tests/isolation-guard.cjs server/tools/combat_integrity_regression.js
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/usr/bin:/bin NODE_ENV=test node --require ./server/tests/isolation-guard.cjs server/tools/battle_result_commands_regression.js
```

- Guarded unit/source fixtures: **25/25 passed** (6 new combat event groups + 19 siege groups). Covers shield absorption, lethal overkill, stable large IDs, once-only queue drain, bounded omission accounting, actual firing cooldown, manual skill type, membership/ownership admission, completion guards, governance and chronicle/rebuild receipts without currency grants.
- New real engine + actual WS loopback fixture: **passed**, two dummy clients receive identical hit IDs/damage; all delivered hit damage sums to engine damage statistics; stored replay includes real hits without `realtime`. One observed run: 4 live frames / 28 hits, terminal tick 13; 27 replay frames / 251 hits. Counts/outcomes vary with the existing random combat and wall clock. It asserts final tick capture and stable serialized IDs, not a specific winner.
- Existing actual source client consumer + real engine/WS fixture: **passed**, two dummy clients, one reconnect, both owner commands applied, cross-owner command rejected, same authoritative positions/result, no local drift. One observed run: 22 frames / 208 hits / 208 actual client visual effects; effects have `visual:true`, `applied:true`, `dmg:0`, shield state matches the server, repeated event IDs do not produce duplicate effects. The fixture only stubs canvas rendering/color and DB/auth, not source frame synchronization or combat.
- Existing combat integrity fixture: **12/12 passed**. Existing battle result command regression: **passed**.
- Additional attempts with the isolation preload: `battle_policy_regression.js` passed its first 9 groups, then its pre-existing real `shipParts` import reached `db.js`/`pg` and was blocked; `registered_battle_mode_regression.js` was blocked by the same real DB import. These two full tool runs are **not passes**. No guard was disabled and no external service was reached.

No live PostgreSQL siege settlement, production traffic, large-player load, deployment or physical-device result is claimed by this slice. All service settlement tests here use explicit disposable in-memory transactional collaborators. WS tools bind only an ephemeral `127.0.0.1` server and close/terminate every server/client in `finally`; no persistent fixture DB or app server is created.
