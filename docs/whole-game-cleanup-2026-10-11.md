# Whole-game cleanup — 2026-10-11

This release connects existing fleet, territory, production, cargo and repair systems through the original painted mobile navigation. It removes unsupported new activity/reward paths and repairs economic consistency. It does not establish commercial retention, a full player-run sovereignty economy or a completed real-battle campaign.

## Player-facing behavior

- Keep the realistic Mars scene and five original painted navigation images. Cantina opens the guild lounge. Base defaults to the next server-recorded starting operation and links production/cargo, objective battles, tactical practice and mining.
- Campaign remains an optional story screen. Existing rewards, achievements and legacy settlement access move to collapsed records sections. Reward notifications follow the records destination.
- Remove decorative satellite dots disconnected from actual server locations. Retain real regional satellite bonuses, fleet mining and capturable industrial nodes.
- Stop new global timed click-resource/rocket spawns and unsupported paid hint/priority sales. Existing unexpired claims remain available; expired or past-landing incoming events no longer advertise a perpetual zero-minute arrival.
- Weather descriptions match applied effects; bonuses are weighted by the affected territory and tier. Reading weather does not produce quest/season rewards.
- Daily assignments no longer create weather-view, POI or casino chores. Untouched retired tasks change to a supported one-action objective with their existing GP/XP preserved. Completed, claimed and progressed records remain unchanged.
- Stop new unsupported rental contracts; retain existing query/cancel/expiry handling. The UI no longer advertises an unimplemented mining benefit.

## Integrity fixes

- Disable client-supplied random quest progress, war minigame scores, no-battle automatic victories, new timer invasions and nonconsensual alliance team battle creation. Existing completed reward/settlement paths remain available.
- Fleet tournament creation requires admin authority and bounded integer prize values. Finalization validates an actual completed final and registered recipients; awards and completion commit atomically. Retired manual tournaments reject new creation/join and preserve eligible historic payouts/refunds. Repeated cancellation cannot refund twice; manual endpoints cannot settle fleet brackets.
- Cancelled/missing siege battles preserve defender rights. NPC arena selection excludes dedicated starter, objective and industrial defenders.
- Marketplace resource escrow expires/cancels with its refund in one transaction. Assembly rechecks cap after locking, rejects dead or occupied hulls, and preserves history for voluntary scrap. PP-to-GP cap checks occur after account locking.
- Boss rewards roll back together on failure and retry after defeat. Recipient locks prevent duplicate GP/XP/minerals/titles; participating fleets are reserved before dispatch.
- Daily assignment and progress share wallet and ordered row locks. Assignment configuration uses its existing transaction connection, including with a one-connection pool.
- Publish only explicit public client files and `/assets`; server/config/tools paths return 404. Service worker never caches API reads and purges old API cache entries. Authentication requests are scoped to the active token and ignore stale identity responses.
- Map startup failures expose retry/command-center access. Do not request nonexistent campaign voice files.

## Validation

Local-only disposable PostgreSQL database: `codex_occupy_review_upgrade_20261010`. Scheduler disabled for browser QA. Economic/race fixtures use isolated temporary schemas, independent sequences and copied constraints where stated by each tool. Production mutation tests were not run.

New regression commands (from repository root):

```sh
node server/tools/runtime_privacy_regression.js
node server/tools/loader_audio_regression.js
node server/tools/map_systems_regression.js
node server/tools/combat_integrity_regression.js
node server/tools/retention_integrity_regression.js
node server/tools/retention_ui_regression.js
node server/tools/core_navigation_ui_regression.js
# The following require DATABASE_URL pointing at the disposable local review database.
node server/tools/economy_integrity_regression.js
node server/tools/map_systems_pg_regression.js
node server/tools/daily_assignment_pg_regression.js
```

All ten passed. Changed/new JavaScript syntax checks and `git diff --check` passed. Existing objective operations/mastery, frontier industry/economy, ship parts, standard duel and registered battle-mode regressions passed in the same review environment. Runtime privacy was also independently rerun during review.

Browser evidence: 320×740, 390×844, 844×390 and 1280×800. Original art retained, no document horizontal overflow in inspected views, five mission tabs fit at 320px, core buttons are at least 44px tall, chat and bottom navigation have a gap. Verified campaign/records separation, legacy reward access, Cantina→guild and actual objective-operation navigation. New map no longer renders the stale rocket arrival or decorative SL labels; browser error log was empty after final reload. These viewport checks do not replace physical phone/keyboard/installation testing.

## Deployment and remaining product gates

GitHub `main` triggers the existing Railway service. No database migration or bulk balance/price rewrite is introduced. Capture exact commit/deployment ID, public asset hashes, source-path denial and DB/Redis readiness separately after push.

Still requires separate evidence: actual chapter-specific campaign battles and reward rebalance; observed multi-guild territory conflict; next-season pass/VIP/gacha issuance versus industrial sinks; historical expired escrow/rental promise reconciliation; physical iOS/Android and real-user retention; cash checkout, receipts/refunds and revenue. Existing synthetic 200-persona feedback is not 200 human players. No retroactive bulk reimbursement is performed without checking transaction records.
