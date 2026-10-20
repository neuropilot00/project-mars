# First play upgrade — 2026-10-21

## Plan and source findings

Keep the existing painted Mars, realistic ship art, bronze/gold styling and mobile navigation. Improve one playable sequence: first fleet battle → resource-node capture → production → cargo delivery → fleet repair. No new resource, reward amount, payment flow, migration or menu is required.

Two concrete findings defined the change:

- `assets/command-center.js` recommended **Check cargo arrival** throughout the cargo mission, even before production was collected or any cargo launched.
- `starterBattle` starts a real three-hull fleet battle, but a proposed opening formation would be erased by both scheduler prebattle AI defaults and the engine's numerical-advantage AI at tick zero. A selector alone would therefore make a cosmetic choice.

## Implemented behavior

The first available sortie now presents two existing engine tactics:

| Choice | Real formation | Real movement |
| --- | --- | --- |
| Breakthrough | wedge | advance |
| Flanking screen | screen | flank |

`POST /api/starter-ops/first_sortie/start` accepts optional `openingTactic: "breakthrough" | "flank"`. The service validates the allowlist before granting anything. Arbitrary formation/movement fields are not accepted as opening configuration. The internal factory persists the accepted choice in its trusted summary; retries/resume return the existing battle without changing its choice. Omitting the option preserves legacy behavior.

The engine only loads this choice for a trusted starter summary with a matching real human participant and an owned `starter_ops_v1` grant fleet. It applies the opening after scheduler defaults, then gives it 10 seconds before tactical AI resumes. Precomputed battles use 200 ms logical ticks. Live battles use their actual configured tick interval, so a 120 ms live tick does not shorten the opening to six seconds. No ordinary battle or existing choice-less starter battle receives this protection. Existing live player commands still use their normal server command path.

The command-center front objective now follows server evidence and depot/cargo state: **Collect production → Deliver to repair depot → Check cargo arrival**. It retains the real mission/action endpoints and does not invent evidence or completion. The first-sortie briefing explains the tactical movement and repair obligation; the mission introduction explains the existing once-only five iron-dust reward and why mined goods need delivery before repair. Six new strings include all seven languages inline through `tl(en,ko,ja,zh,id,vi,th)`.

## Validation performed after local-only resume

All commands below used a cleared environment. No `.env` was loaded, application server started, migration runner/bootstrap invoked, or original review/production database accessed.

```sh
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/usr/bin:/bin NODE_ENV=test RUN_SCHEDULERS=false node server/tools/starter_opening_isolated_regression.js
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/usr/bin:/bin NODE_ENV=test node server/tools/command_center_regression.js
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/usr/bin:/bin NODE_ENV=test node server/tools/connected_feature_ui_regression.js
```

**Passed:**

- Real PostgreSQL fixture at Unix socket `/tmp/mars-oc-20261021-socket`, port `55441`, user `mars_fixture`, dedicated database `first_play_fixture`, SSL disabled. A random schema is created and dropped by the test. It uses minimal empty tables and the repository's migration-090 ship catalogue, rather than copying any player data.
- Actual `ensureStarterFleet`, starter factory and combat engine. Both complete battle timelines retain their selected formation/movement through the first 10 logical seconds, produce different fleet positions, then resume AI and win the fixture battle.
- Factory resume with a different choice preserves the original battle and choice. Invalid input is rejected. Copied-owner summary, ordinary source, and legacy no-choice cases do not enable opening control. Actual ordinary and legacy timelines retain their tick-zero AI behavior.
- Actual live engine at 120 ms ticks retained the screen/flank opening for ten seconds and resumed AI afterward. The observed loop ran **10,633 ms / 87 ticks**, ending at its deliberate test timeout with a draw; this is timing evidence, not a full live battle win or settlement.
- Exactly three fixture-player grants/nine original hulls after start/resume. Test code never invokes the scheduler, battle settlement or reward issuance. A runtime socket guard rejects network connections outside the designated fixture Unix socket. Imported simulation/factory paths were inspected for external calls before execution.
- Shipped command-center event handlers select and send the opening, hide the selector on resume, preserve faction recovery and stale-session handling, and recommend the correct cargo substep from server state. Existing connected-feature UI regression also passes.
- `node --check` on touched JavaScript and `git diff --check` passed.

## Remaining verification and integration

`server/tools/localization_regression.js` currently fails its global SEA audit with **54 missing entries** while sibling auth/journey integration is ongoing. Parent integration owns regeneration of `assets/i18n-sea.js`; the six new first-play strings already carry inline translations. No generated translation file was edited here.

The older full `starter_operations_regression.js` was extended with HTTP invalid-choice and saved-timeline assertions before the local-only resume. It is intentionally **not rerun against its hardcoded former review database**. The current isolated fixture proves factory/simulation/control behavior; it does not claim a fresh all-five-mission settlement/economy run.

Rendered mobile browser geometry, the full sign-in → faction → battle → return journey, a complete live settled sortie, actual device install/offline behavior, public deployment and real-player retention remain separate acceptance checks. No commit, push, deployment, production operation or external service call is part of this change.

## Files owned by this slice

- `assets/command-center.js`
- `server/routes/starterOperations.js`
- `server/services/starterOperations.js`
- `server/services/starterBattle.js`
- `server/services/battleEngine.js`
- `server/tools/command_center_regression.js`
- `server/tools/starter_operations_regression.js`
- `server/tools/starter_opening_isolated_regression.js`
- This document.

## Parent integration update

SEA regeneration completed after the isolated gameplay run:2674/2674, missing/leaks/token mismatches0. Parent reran command-center/core/connected UI checks successfully. Broader gameplay limitations above remain.
