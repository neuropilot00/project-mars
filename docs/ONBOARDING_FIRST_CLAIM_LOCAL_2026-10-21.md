# Onboarding schema and first-claim regression — 2026-10-21

This change restores the existing free first-claim contract, prevents duplicate use under concurrent requests and records its actual zero payment. It preserves reward amounts, prices and eligibility policy; the tutorial shield fallback now uses the existing seeded basic-shield code. Evidence below comes from fresh private PostgreSQL 16 databases and actual HTTP handlers; applying the migration and checking the shared full application remain separate integration steps.

## Observed failure and compatibility migration

The active `083_onboarding_tutorial.sql` creates twelve `user_onboarding` fields. The service also reads `job_selected`, `pp_rewarded`, `shield_given`, `gp_rewarded` and `title_given`; no active or archived migration defines those five fields. `getOnboardingStatus()` joins `jobs` on the missing `o.job_selected`, raising PostgreSQL `42703` before creating an onboarding row. The claim handler previously treated that eligibility lookup failure as non-critical and attempted normal payment. The separately computed offer could therefore advertise an eligible free 25-pixel claim while a PP0 request failed with required PP0.5.

`362_onboarding_service_compatibility.sql` adds only those missing fields, using the service's existing types and boolean defaults. It performs no historical UPDATE, assigns no job, changes no balance and does not infer past per-step payments from `current_step`. Existing field values and `reward_claimed` are preserved. Applying it twice preserves the same rows and metadata. Migration 083 and the existing migration runner/schema-migrations table are prerequisites. Migrations 360 and 361 are unchanged.

## Narrow service and claim fixes

| Source | Behavior restored or protected |
| --- | --- |
| `server/services/onboarding.js` | New-row status preserves the actual `onboarding_enabled` value rather than returning unconditional enabled=true. |
| Same | Existing `reward_claimed=true` is evidence that the final award was already paid; step 5 does not issue it again merely because migration 362 added `gp_rewarded=false`. Other historical per-step payments are not inferred. |
| Same | Completed/skipped and earlier-step returns explicitly roll back their open transaction before releasing the client. |
| `server/routes/api.js` | Get/create onboarding state finishes before taking the user lock, avoiding a separate connection's onboarding foreign-key check waiting on that lock. The user is then locked in the claim transaction **before** counting existing claims and deciding free eligibility/payment. Disjoint concurrent requests can consume the first-claim right once. |
| Same | After free eligibility is confirmed, `totalCost`, `claims.total_paid`, transaction fee, quest-pool fee argument and governance tax base are zero. A free response additionally carries `nominalCost`; normal paid response fields and pixel reference/hijack floor prices are unchanged. |
| Same | Optional strict boolean `expectedTutorialFree: true` requires verified current eligibility. Otherwise the request rolls back with HTTP409, `error` and `code` both `TUTORIAL_FREE_CLAIM_CHANGED`, before payment or claim creation. Existing callers that omit it or send false retain normal payment behavior. |

`governance.collectTax()` actually credits governance position GP, sector buff funds and the commander pool. The previous free path therefore issued real GP from nominal unpaid volume; this was not only a display error. The quest-pool function is currently a no-op; its call now also receives zero on free claims. No historical claims, transactions or balances are rewritten.

The client change is owned separately: snapshot the advertised free offer before optimistic grid mutation and send that boolean; on this 409, discard the stale offer and ask the player to recheck. This server fixture verifies the server contract, not the separate client rendering implementation.

## Verification

Run from the repository root with the installed local PostgreSQL 16 binaries and existing Node dependencies:

```sh
env -i PATH=/opt/homebrew/bin:/usr/bin:/bin NODE_ENV=test RUN_SCHEDULERS=false node server/tools/onboarding_schema_isolated_regression.js --baseline-source
env -i PATH=/opt/homebrew/bin:/usr/bin:/bin NODE_ENV=test RUN_SCHEDULERS=false node server/tools/onboarding_schema_isolated_regression.js --baseline-accounting
env -i PATH=/opt/homebrew/bin:/usr/bin:/bin NODE_ENV=test RUN_SCHEDULERS=false node server/tools/onboarding_schema_isolated_regression.js --baseline-shield
env -i PATH=/opt/homebrew/bin:/usr/bin:/bin NODE_ENV=test RUN_SCHEDULERS=false node server/tools/onboarding_schema_isolated_regression.js
```

Baseline mode pins the previous onboarding Git blob `691e1e0ec266657850e4ae1cfe64bb256a04772e`. It reproduced four groups: the 083/42703 offer-versus-claim failure, additive migration preservation, disabled onboarding incorrectly granting a free claim for a new row, and a legacy `reward_claimed=true` final retry issuing another 75GP plus an already-done return leaving a transaction open. Baseline mode does not pin the old claim route or claim a deterministic reproduction of its concurrency race.

Accounting baseline mode pins the previous claim-route blob `ece190793a2b0422880efd7721295581bdd16620`. Actual HTTP requests reproduced a free claim recording nominal paid volume0.5, transaction fee0.5, quest-pool fee argument0.5 and actual governance GP0.01. The paid comparator retained cost0.5/fee0.5/tax0.01. Shield baseline mode pins the older onboarding blob: missing `basic_shield` returned success and an item reward, set `shield_given=true`, and left inventory empty. Both baseline fixtures cleaned up.

The current-source run passed twelve groups using real PostgreSQL transactions, actual claim/onboarding/status HTTP handlers and the actual `ensureUser()` implementation extracted from `server/db.js` without bootstrapping the app:

1. Reproduce the old-schema eligible 25-pixel offer and PP0 claim failure requiring PP0.5.
2. Add exactly the five fields; preserve all old onboarding fields and balances.
3. Honor disabled onboarding for a user with no existing row.
4. Prevent the legacy final-award retry and close already-done transactions.
5. Allow the PP0 first 25-pixel claim free; reject the next PP0 claim, then charge the original PP0.5 when funded.
6. Reject skipped/completed/already-owned/oversize/free-disabled requests as free claims.
7. At existing tutorial step 2, synchronize claim ID/current step and grant the existing 5GP equivalent once; close the earlier-step repeat transaction.
8. Pay the existing 75GP final reward once under concurrent final completion; repeat migration preserves metadata.
9. For concurrent new-row disjoint 25-pixel claims, a normal caller gets one free and one paid claim (PP1 → PP0.5). Two expected-free callers get one HTTP200 and one HTTP409, one claim and PP1 unchanged; no deadlock.
10. Funded stale, disabled, oversize and unavailable-eligibility expected-free requests return HTTP409 with balances, claims and transactions unchanged. No fixture connection remains idle in transaction.
11. The free claim records cost/paid volume/transaction fee/quest-pool fee argument/tax all exactly0 and keeps each pixel reference price0.02. The existing paid0.5 comparator keeps its transaction fee and actual governance GP0.01; the real unmodified `collectTax()` executes against fixture tables. Quest-pool calls are observed while executing its existing no-op.
12. An explicit unknown `basic_shield` setting returns503 `ONBOARDING_ITEM_UNAVAILABLE` without consuming current step, reward flag or inventory. With no override, the existing seeded `shield_basic` is granted quantity1 exactly once under concurrent step completion.

The shield source contract is migration027 (`shield_basic`, display name Energy Shield,12-hour protection) and049 (same item code); `energy_shield` is not its seeded code. `onboarding_free_item_type` is not seeded by083, so the service fallback applies when absent. Explicit operator values are not mapped or overwritten. Missing item types and item INSERT failures now propagate through the same transaction rather than reporting a nonexistent reward; `onboardingRoutes.js` maps the known unavailable-item error to503. This changes neither shield duration/quantity nor already-consumed historical flags. The working title path is unchanged.

Reward values in this fixture select the existing authored 220/224 profile (onboarding PP equivalent0.5 and final75GP); production settings are not read or changed. The fixture isolates unrelated domain collaborators and supplies a minimal schema, so it does not replace a full migration-runner/application regression. Both runs clean up their own temporary PostgreSQL cluster and HTTP socket. No existing application/database, real account, environment file, network service, scheduler, key or chain is used.

## Verified source hashes (SHA-256)

| File | Hash |
| --- | --- |
| `server/migrations/362_onboarding_service_compatibility.sql` | `e31685c56c6b3b4a67d47149c8973f8431519cec93276ec8b18b473cd4306e55` |
| `server/services/onboarding.js` | `ca320e2a935da47a77bcff1e4fddff1e40985c801cb6d86104d3ab96ac4e1b05` |
| `server/routes/onboardingRoutes.js` | `adf73c3139d9c4cc3f8e581913a5015f13f2d6c6f0a82bb034d47f5d7108988b` |
| `server/routes/api.js` | `04a483576f613fea90941bc04fbb429924c8567e26abd247efb1dc2dd7e4639d` |
| `server/tools/onboarding_schema_isolated_regression.js` | `1c598770f45d2f2a49166c3fe0a73108d8fdda93fce4716c1b92fa1b30714b8e` |

The API hash identifies the claim/accounting fixture run; another agent separately owns the later harvest-all handler in the same file, so integration should record its final combined hash.

These results establish this local onboarding/claim slice. They are not evidence of deployment, production migration execution, overall economic soundness, user demand or market validation. Existing economy-model artifacts and the cumulative model CPU budget were not changed or rerun.
