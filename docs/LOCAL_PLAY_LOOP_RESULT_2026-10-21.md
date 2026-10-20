# Local action-loop follow-up — 2026-10-21

The existing HTTP/service paths now have fresh local evidence for **fleet mining → resource crafting → resource sale → additional ship construction**. A real recipe-read defect was reproduced and corrected. This is a selected action chain with dummy starting state, not a complete new-account or territory-to-endgame playthrough.

## Defect and surgical change

`server/services/crafting.js` already deducted `code` / `resource_code` ingredients from `user_resource_inventory` in `craftItem`, but both `getRecipes` and `getRecipe` read only `user_items` using `item_type_id`. A player could mine enough minerals and still receive `canCraft: false` from both recipe endpoints. `attemptCraft` in `assets/economy-inventory.js` blocks the request and shows “Missing ingredients” when that field is false; the button also looks unavailable.

Before the fix, a fresh actual mining receipt produced 10 iron ore, 10 silicon dust and 5 GP, with hull HP 100→98. Both actual recipe HTTP reads returned false, while the actual craft POST succeeded and charged 5 ore / 3 silicon / 50 GP. The reproduction used the new harness's `--expect-eligibility-bug` mode before changing the service.

The only backend change adds resource inventory lookup to those two read functions and selects the same resource-key precedence as `craftItem`. Legacy item ingredients and guest behavior remain covered. No recipe, balance, production rate, reward, route, migration or new gameplay system was added.

## Exact commands and runtime boundary

Run from `/Users/jongho/Documents/Codex/2026-10-10/oc/work/occupy-upgrade`:

```sh
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/opt/homebrew/bin:/usr/bin:/bin NODE_ENV=test RUN_SCHEDULERS=false node server/tools/local_play_loop_isolated_regression.js
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/usr/bin:/bin NODE_ENV=test node --require ./server/tests/isolation-guard.cjs --test ./server/tests/crafting-inventory.test.js
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/usr/bin:/bin node --check server/services/crafting.js
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/usr/bin:/bin node --check server/tools/local_play_loop_isolated_regression.js
git diff --check -- server/services/crafting.js server/tools/local_play_loop_isolated_regression.js server/tests/crafting-inventory.test.js docs/LOCAL_PLAY_LOOP_RESULT_2026-10-21.md
```

The harness verifies an empty parent environment allowlist and creates a **fresh private** `/tmp/oc-play-<random>/db` cluster with the installed PostgreSQL 16 binaries. Child PG commands receive only a fixed PATH and `LC_ALL=C`. PostgreSQL listens only on that cluster's private Unix socket (port number 55443 names its socket; TCP listening is disabled). HTTP also uses a private Unix socket. A runtime guard rejects every other socket, DNS/TLS/fetch, dotenv/mail/chain/Redis imports and credential-file reads. The repository's `db.js`, application `index.js`, migration runner and schedulers are never loaded.

The actual routers and services run unmodified for mining, resources, crafting, marketplace and ships. JWT verification, PostgreSQL transactions, row/advisory locks, inventories, GP balances, build jobs and hull insertion are real. Tables are a minimal dummy schema; no existing database/schema, user, inventory or production configuration is copied. Synthetic values are explicitly set for initial GP/fleet, crafting recipes and ship catalogue. Resource roll code is real, with a fixture rate of 1 and min/max quantity both 10. Success/failure recipes use 100%/0%. Only this dummy mining/build job's timestamps are advanced; no real hour/minute wait is claimed.

Injected neutral/no-op collaborators: job buffs, sector tariff, territory fee multiplier, XP, GP activity notifier, player notifications, season/daily/weekly progress, referral commission, achievements, dividends, wash-trade observer and news. Actual fleet GP log SQL still runs. These collaborators and absent DB triggers are not validated by this fixture.

## Actual runtime results

The final fresh-cluster run passed **9 groups** (exit 0):

| Boundary | Actual result |
| --- | --- |
| Mining launch | Missing JWT rejected; wrong owner cannot collect; early collect is `not_ready`; same fleet cannot launch twice |
| Concurrent mining collect | One 200, one `already_collected` 400; +5 GP, exactly 10 ore +10 silicon; one hull wears from 100 to 98 HP |
| Recipe availability | List/detail now true for sufficient code/resource_code resources; unauthenticated read false |
| Actual crafts | Resource craft spends 50 GP / 5 ore / 3 silicon and gives one output; legacy item craft consumes that output and gives its own result |
| Rollback | Missing second ingredient leaves GP, first ingredient, second ingredient and log count unchanged |
| Actual market trade | Three mined ore escrowed and bought once despite simultaneous duplicate purchase; seller ore 2, buyer ore 3; seller GP 962.5, buyer GP 990; 2 GP listing fee and 0.5 GP sale fee |
| Concurrent craft | Only five available ore: one success, one insufficient-material 400, one item, one 10 GP debit, one log |
| Failed craft roll | One ore consumed, 20 GP charged and 10 refunded, no output item |
| Actual ship construction | Remaining mined ore 1 + silicon 1 +25 GP consumed by `/api/ships/build`; wrong-owner completion 404, early completion 409; concurrent completion gives one new hull and one `already_completed`; two total hulls including the seeded starting hull; final GP 927.5, ore 0, silicon 6 |

Expected negative-path errors are printed by the existing route handlers. They are asserted 400/404/409 outcomes, not ignored failures. The isolated source/VM regression separately passes **4 tests** for resource eligibility, insufficient resources, legacy ingredients and public reads.

Final integration-run cleanup removed `/tmp/oc-play-RcWcaT` after `pg_ctl stop`, HTTP close and pool close. No private PostgreSQL/HTTP process or socket remains. The JSON printed by the harness contains SHA256 hashes of each executed service/router and its fixture path.

During fixture development, the first PG starts failed on an empty `listen_addresses` option and macOS locale initialization; both were corrected in the harness (`postgresql.conf` with TCP disabled; child `LC_ALL=C`). A mismatched injected news stub caused one fixture process to exit after market HTTP response; its own private cluster `/tmp/oc-play-m4pJjI` was explicitly stopped and removed before retry. These were harness setup/stub errors, not declared game defects. The final harness succeeded including cleanup.

## Source mapping: existing tactics and production/transport

- First sortie `breakthrough` means real `wedge` formation + `advance` movement; `flank` means real `screen` + `flank`. The trusted starter summary and grant ownership gate protect the first ten logical seconds before tactical AI resumes. A resumed battle keeps its original choice. This follow-up reads the implementation and prior dedicated fixture report; it does **not** add a new tactics/battle runtime result. See `first-play-upgrade-2026-10-21.md` and `starter_opening_isolated_regression.js` for the distinct existing evidence.
- In command-center `yieldNextAction`, active escort cargo takes precedence, then missing production evidence recommends **Collect production**, then available mine iron stock recommends **Deliver to repair depot**. Collection calls `frontierIndustry.collectProduction` (or the starter mission wrapper); actual batches generate 20 iron dust +4 hull plate per batch in the mine depot and a production event.
- Cargo calls `frontierIndustry.startCargo`: deducts mine stock, reserves the escort fleet and records a server arrival timestamp. Eligible starter delivery is one minute; normal delivery is ten minutes, or nine with logistics control. Arrival check/refresh settles eligible cargo once into repair stock and objective progress. **Stock withdrawal** then moves repair stock into personal resource inventory; mine withdrawal is rejected with `CARGO_DELIVERY_REQUIRED`.
- Frontier iron dust/hull plate and ship-mining iron ore/silicon dust are different resource codes. The chain executed here uses ship-mining resources. It does not claim that clicking the frontier production CTA directly fills the war-item recipe's ore requirement.

## Explicit remaining scope

Legacy `/api/claim` and `/api/harvest` were inspected but not mounted: their large shared route imports and payments/governance/referral policy dependencies would require a much broader fixture. There was no territory claim or territory harvest action, starter grant action, frontier capture/cargo/repair action, guild action, sign-up/faction flow, battle settlement, entire app/browser boot, device/PWA check, production DB/HTTP/mail/wallet/funds operation, push or deployment. `playerJourney` was inspected as a read-only evidence projection; no synthetic journey ledger insertion is presented as gameplay.

The starting fleet and user are dummy seeds; **the additional ship** is an actual service-created hull. The final quantities prove this bounded dummy economy chain, not commercial balance, every asset branch, production triggers, live multi-user deployment or player enjoyment.

## Final existing-crafting UI follow-up

`assets/economy-inventory.js` now includes the actual `gpRefunded` amount after the existing translated refund label, e.g. `GP 부분 환급: 12.5 GP`. The old ternary/OR precedence omitted the amount. A confirmed success or failed roll invokes `loadCraftingView(true)` so affordability is read immediately after materials are consumed, and calls the existing `refreshBalance` server-refresh alias (with `updateBalanceDisplays` as its unavailable-alias fallback).

Only that post-craft recipe refresh requests `minGap: 0`. `_economyReadFetch` distinguishes explicit zero from omitted/null (which retain the original 10000 ms default); normal crafting navigation retains 15000 ms. The actual `_guardedJsonFetch` implementation still governs pending requests and 429/key/shared-endpoint backoff, including across category filters. Cancellation, server rejection and transport errors do not request a confirmed-outcome refresh. Existing translations are reused; no new translation keys or strings require SEA generation for this slice.

Seven source/VM tests in `tests/crafting-ui.test.js` pass using the actual economy helpers, craft handlers and core request guard with injected DOM/fetch/balance collaborators. They verify immediate updated `canCraft`, translated/fallback actual refund amounts, zero refund, balance-refresh/fallback selection, cancellation/error recovery, unchanged default minGap, no duplicate inFlight read and a full 120000 ms simulated 429 backoff through its exact boundary. The combined run with the existing loading-error regressions passed **27/27**, and JavaScript syntax / diff checks passed. These are source/guard tests, not rendered-browser or real-wallet evidence. The PG 9-group result above predates this UI-only patch and was not rerun; backend sources are unchanged by the UI follow-up.

```sh
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/usr/bin:/bin NODE_ENV=test node --require ./server/tests/isolation-guard.cjs --test ./tests/crafting-ui.test.js ./tests/loading-errors-ui.test.js
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/usr/bin:/bin node --check assets/economy-inventory.js
git diff --check -- assets/economy-inventory.js tests/crafting-ui.test.js docs/LOCAL_PLAY_LOOP_RESULT_2026-10-21.md
```

Changed files in this slice: `server/services/crafting.js`, `server/tools/local_play_loop_isolated_regression.js`, `server/tests/crafting-inventory.test.js`, `assets/economy-inventory.js`, `tests/crafting-ui.test.js` and this document. Existing dirty changes and independent review references are preserved.
