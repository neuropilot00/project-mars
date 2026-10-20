# Battle viewer release fixes — 2026-10-21

This slice preserves the existing tactical HTML, ship art, theme, navigation and sandbox. It fixes source-backed blockers in real battle and recorded-result viewing. Server simulation/settlement, siege and economy have separate owners.

## Findings and fixes

1. **Invented shields in real combat.** `mkShip` previously assigned every visual hull a shield equal to 12–60% of catalogue HP. The real frame consumer never replaced that shield, so a server hull with no shield displayed a permanent full shield bar/bubble. Real battle visual hulls now start with zero shield; only `frame.ships[].shield_hp/shield_max` determine the display. Depletion flashes are visual only, and invalid/negative/excess values are bounded. Sandbox shielding is preserved.
2. **Fake placement and full counters before authority.** While waiting for its first frame, the real viewer previously rendered catalogue HP and local spawn positions. It now draws only the existing background and unknown counters (`—`, empty HP bars). The loop resumes normal drawing only after an actual server/recorded frame arrives; it does not move or fire local simulation entities.
3. **Resolved attack display.** The client consumes the agreed authoritative `frame.combat_events[]` contract: stable `id`, `type: shot_hit`, `source_side`, `source_ship_id`, `fire_type`, and exact `from/to` endpoints in engine space. It projects endpoints with the existing coordinate mapper and draws brief existing tracer/beam effects. It never picks a local target, performs hit detection, or applies damage. No events means no invented fire. The client accepts up to 128 events per frame, bounds remembered IDs at 512 and concurrent effects at 256, deduplicates repeat frames, and clears prior effects when seeking a recording backward.
4. **Ordinary recorded battles stalled.** The parent only forwarded completed objective timelines. Since real-mode local simulation is disabled and WS does not replay old frames on a new subscription, an ordinary completed battle/first sortie could remain at its initial visual state. Every terminal battle with an actual stored timeline now uses the same authoritative parent frame bridge. Live/pending battles do not become recorded results.
5. **Pending or failed loads looked like instant wins.** `openBattleViewer` could fall through after a missing timeline, reuse the previous battle's timeline, display instant-capture messaging and dereference a missing timeline. A new viewer clears prior battle/timeline state, checks that actual stored frames exist and returns on pending/error loading. A short recording does not assert automatic victory or territory capture.
6. **Ordinary real end waited for a removed local winner.** Every actual server/recorded `end` now reports `battle_final_done` after 1.8 seconds, using its actual winner. It no longer waits up to 25 seconds for an ordinary battle's disabled local simulation. Seeking a recording before a queued end suppresses that obsolete result notification.

The previous real battle data-load failure/demo-substitution protection remains intact. Prior 320/390 browser evidence was inspected rather than repeated as new work. Repair/rebuild and production/cargo CTAs already route to the existing fleet/front functions; no invented supply buff was added.

## Server contract

The server owner supplies bounded `combat_events` from actual damage application, using stable `${battle_id}:combat:${seq}` IDs, and includes `shield_hp/shield_max` on ship snapshots. The client requires neither event damage nor target HP to update its model; snapshots remain authoritative. Dropped VFX events affect visual density only. This document does not claim server implementation/real WS integration on the basis of a fixed client fixture.

## Local validation

```sh
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/usr/bin:/bin NODE_ENV=test node --require ./server/tests/isolation-guard.cjs --test server/tests/battle-release-truth.test.js server/tests/shared-battle-render.test.js server/tests/tactical-battle-loading.test.js
```

**41/41 passed, no failures or skips**, including actual shipped function execution for shield truth, projected/deduplicated visual-only events, bounded queues, pre-authority HUD/drawing, ordinary end delivery, pending/missing/error timeline handling, stale previous-state isolation, terminal ordinary replay and short-recording honesty. Existing coordinate and load-failure regressions pass. These tests use VM/DOM/dummy API adapters and block sockets, `.env`, database/mail/chain modules through the isolation guard; they are not full game/server/browser evidence.

Raw test output is new and stored at `outputs/evidence/release-20261021/battle-ui-prefreeze-tests.tap`; the earlier run `battle-ui-tests.tap` and all previous evidence remain unchanged. Tactical inline script, parent hub and visual fixture parse successfully; `git diff --check` passed.

For parent rendered verification, `server/tools/battle_release_ui_fixture.js` serves the original tactical HTML/CSS/art and fixed dummy API/frame data only. It delays frames two seconds, then uses the real replay bridge for five snapshots, shields and shot events. It binds localhost, rejects POST, blocks WS upgrades and uses a self-only CSP. It does not load game DB/auth/server/bootstrap or call an external service. It has not itself been counted as actual browser validation by this worker.

## Files

- `assets/tactical-lab-v11.html`
- `assets/battle-hub-modal.js`
- `server/tests/battle-release-truth.test.js`
- `server/tools/battle_release_ui_fixture.js`
- This document.

No new translation strings, generated assets, currency, rewards, migration, deployment, production access, `.env`, account/keys, commit or push was part of this worker's change. Parent owns browser acceptance and release; the server owner owns combat event emission and actual engine/WS verification.

Final pre-freeze review: the disabled target HP100% was a local catalogue-derived value, not an API HP field. Target picker, compact fleet readout, manual status and detailed fleet panel now show the existing Connecting placeholder until the first authoritative frame; charged skill shows —. The ATK/DEF composition count comes from real fleet-presets API ship counts and is preserved. New regression executes the actual command-deck and fleet-panel functions before a frame and passes. No new translated strings were added.
