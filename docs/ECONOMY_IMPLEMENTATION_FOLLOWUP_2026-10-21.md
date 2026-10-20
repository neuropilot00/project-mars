# Economy implementation follow-up — 2026-10-21

This local follow-up repairs source-backed conservation, escrow, amount-validation and transaction defects. It does not certify an entire deployed economy or choose new emission rates. All execution used fresh private dummy PostgreSQL clusters with cleared environments; no existing database, .env, mail, real account/wallet/funds, application bootstrap, deployment or push was used.

## Existing mechanics and source map

| Mechanic | Existing implementation and current boundary |
| --- | --- |
| Territory harvest | `server/routes/api.js`: global harvest, harvest-all and per-claim harvest share `user_mining.today_mined_pp` and use existing per-harvest/daily caps and territory/cooldown locks. Current payout is GP even where legacy variable names say PP. These complete territory handlers were inspected, not executed in this fixture. |
| Fleet mining | `services/shipMining.js` + `routes/shipMining.js`: owned available fleet reservation, wallet advisory lock, timed job, resource rolls, GP daily cap and hull wear. Actual launch/collection/duplicate receipt now exercised separately in the local action harness. |
| Check-in / missions / starter | `services/daily.js` uses conflict-safe daily login insertion and locks mission claims. `services/starterOperations.js` verifies real source evidence and row-locks once-only mission reward; each starter mission gives 5 iron dust to repair stock. Existing implementations, not newly invented rewards. No new all-missions playthrough here. |
| Resource / item crafting | `services/resourceCraft.js` consumes recipe minerals, queues timed resources, claims or refunds cancellation; `services/crafting.js` consumes resource or legacy item ingredients and GP, then rolls output or partial GP refund. Existing defaults and valid recipes are retained. |
| Ship build / repair / destruction | `services/ship.js` consumes GP/minerals, locks builds and repairs, checks availability; `battleEngine.js` / combat-policy code decide hull loss; `shipSalvage.js` records source-ship salvage claims and daily material budgets. A real extra hull was constructed in the action fixture. Full repair/destruction/salvage settlement was not rerun here. |
| Frontier logistics | `services/frontierIndustry.js`: 30-minute production batches (20 dust +4 plate), capped stock, mine→escort cargo→repair depot, server timestamps, warehouse/ownership locks, personal/guild stock separation and officer-only personal withdrawal. Production/transport source mapping is in `LOCAL_PLAY_LOOP_RESULT_2026-10-21.md`; no full frontier action chain is claimed here. |
| Marketplace | `services/marketplace.js`: seller lock, inventory escrow, listing fee, locked single purchase/cancel/expiry, fee/tariff/referral carve. Earlier actual PG regressions cover selected resource branches; this follow-up prevents a claim locked for auction being simultaneously listed here. |
| Two auction APIs | Both are mounted: `/api/auctions` → `auctionCombat.js`, and legacy `/api/auction/*` → `auction.js`, sharing `auctions`/`bids`. Both must preserve the same held assets/money even when calls cross endpoints. |
| Guild treasury | `guild.js` / `guildRoutes.js`: membership/role checks, treasury row locks, conditional debit, matching user credit and treasury ledger; harvest contributions/donation are existing transfers. This follow-up strengthens withdrawal amount/role locking and exercises competing withdrawals + concurrent demotion. Other war/defection/research settlements remain separate. |
| NPC supply | `services/npcEconomy.js` uses fallback `false` when configuration is missing, while migration329 seeds `npc_economy_enabled=true`; existing 10-unit resource bundles cost 6/10/14/28/36 GP. Its prior per-listing top-up to 200 GP /40 resources was repeatable issuance despite a bounded-seed comment. Parent integration owns the separate one-time seed-budget correction/migration354; this slice does not assert it ran. |
| Abuse controls | Existing endpoint rate limiters, owner/auth checks, per-wallet caps and row/advisory locks constrain requests. `washTradeDetect.js` deliberately observes shared IP/referrer/reciprocal pairs and flags accounts; it does **not** automatically block trades. Referral rewards have existing trigger/tier/daily-cap settings. These are not a proof that multiaccount farming or bot abuse is eliminated. |

Paths above are relative to `server/` unless a full prefix is shown. Existing source is not labelled unimplemented merely because this fixture did not execute it.

## Reproduced defects and corrected behavior

The new `server/tools/economy_safety_isolated_regression.js --baseline-head` executed the clean pre-fix HEAD service source with real dummy PostgreSQL. It reproduced three distinct defects:

- Modern resource listing never surrendered the seller's 10 units: a sale increased total resources **100→110**.
- Bid 10, outbid 20, then the winning bidder's buyout at 100 skipped the price difference and re-refunded a prior outbid row: total GP **3000→3085**, versus the correct **2995** after a 5 fee. This baseline used no referral payouts.
- Duplicate resource-job claim released its pooled connection with `BEGIN` still open; PostgreSQL reported **one idle-in-transaction connection**.

The patch keeps the existing services and tables and changes the relevant guards/transactions:

1. Modern auction creation validates finite positive prices, optional buyout, denomination, duration, resource quantities and listing type. It serializes active-listing checks on the seller row. Resource escrow conditionally deducts owned tradeable stock; item/ship ownership actually moves to `auction_escrow`; territory ownership and both market locks are checked under a row lock. Only fields for the chosen asset type are persisted.
2. Winning-bid refund marks the bid refunded. Modern finalization reads the current auction and currently held bid **inside the same row lock**. A winner using buyout pays the remaining amount; other held bidders are refunded once. Earlier nonwinning bid rows are never credited again. No-bid expiry and escrow return are one transaction. A changed/missing physical item escrow rolls back the buyer debit and seller payout.
3. Actual transfer checks item/ship escrow and claim ownership; territory pixels follow the buyer. Cancel/expiry returns each supported asset, including cross-API ship/currency cancellation, under the auction lock.
4. Legacy auctions validate negative/nonfinite buyout values, serialize seller-cap checks and use the auction's GP/PP denomination for held bids, refunds and proceeds. The existing GP listing fee stays GP. GP activity logs no longer record PP transfers as GP. Existing valid fee values remain; malformed negative/nonfinite fees fail closed. A captured buyout fee cannot exceed the sale principal.
5. Resource-job duplicate claim explicitly closes its transaction. Resource job quantity and recipe material totals must be positive safe integers. Cancellation refund must be finite 0–100%; an explicit 0 is honored. Item recipes likewise validate finite nonnegative GP cost, 0–100% success/refund rates and positive integer ingredients **before mutation**. No negative ingredient or refund-above-principal mint is permitted.
6. Guild withdrawal requires a positive safe integer. Its membership row is held with `FOR SHARE`, so a concurrent demotion/removal must resolve before the role decision; the treasury conditional debit remains unchanged.
7. Fleet-mining payout and information fallbacks now match the already-seeded migrations277/278 policy: **3 GP per capacity-hour, 1500 GP per rolling day** when configuration is absent, malformed or negative. Explicit valid configuration is retained, including owner-configured cap `0` meaning unlimited. The first action-fixture chain now explicitly sets its synthetic rate to5, preserving its former quantities without confusing them with production defaults.

## Escrow provenance and existing player assets

`server/migrations/355_auction_escrow_provenance.sql` adds `escrow_version SMALLINT NOT NULL DEFAULT 0`. Both corrected create paths set version1 only after actual transactional escrow. Existing rows are left version0; the migration does **not** debit, credit, cancel, refund or reassign any player asset.

Both auction service families now reject bid, buyout, cancellation and expiry/settlement for version0 with `ESCROW_REVIEW_REQUIRED` / `escrow_review_required`. The modern route exposes409. Original rows and held principal stay untouched for explicit reconciliation. An old resource row cannot mint by sale or cancellation; an old currency row cannot trigger an unproven principal refund. There is no guessed exception for legacy rows.

This is a documented fail-closed compatibility change: **before**, an old active auction could settle with unverifiable escrow; **after**, it remains readable but its mutating actions require review. Local fixtures prove this for old-resource rows with held bids and old currency rows. Applying migration355 to a real database and reconciling its historical pending auctions is an operational acceptance gate. Neither was authorized or performed here. Do not flip old rows to version1 merely to make an endpoint work.

## Auction referral conservation decision

The legacy service previously called `creditReferralCommission` after COMMIT on a fresh connection without BEGIN, passing full gross GP. The actual DB helper starts with SAVEPOINT and returns no rewards if there is no transaction; therefore this was an unsupported/no-op path in the present implementation, **not** the cause of the reproduced3085 GP total. Simply making that old gross-based call start paying could distribute more GP than the captured fee under enabled settings.

The repaired call runs within the sale transaction, uses the **captured fee** as its base and the **actual sale currency**, and retains all configured trigger/tier percentages and their existing caps. This makes seller proceeds + referral rewards ≤ buyer payment. Existing `referral_auction_buy_pct=0` default remains0. No new rate, reward, token or cash-out path was introduced. Modern auction behavior does not gain a new referral reward feature.

The fixture executes the actual extracted `getReferralChain` and `creditReferralCommission` functions from `db.js` with real SQL and no module bootstrap. At a deliberately extreme100% trigger /100% first-tier configuration, a100-GP/PP buyout pays referral5 from captured fee5, not100; a20-GP natural winning bid pays1 once. Duplicate sale/settlement does not repeat rewards. Other referral source flows were not changed or certified.

## Exact validation

Run from `/Users/jongho/Documents/Codex/2026-10-10/oc/work/occupy-upgrade`:

```sh
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/opt/homebrew/bin:/usr/bin:/bin NODE_ENV=test RUN_SCHEDULERS=false node server/tools/economy_safety_isolated_regression.js --baseline-head
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/opt/homebrew/bin:/usr/bin:/bin NODE_ENV=test RUN_SCHEDULERS=false node server/tools/economy_safety_isolated_regression.js
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/opt/homebrew/bin:/usr/bin:/bin NODE_ENV=test RUN_SCHEDULERS=false node server/tools/local_play_loop_isolated_regression.js
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/usr/bin:/bin NODE_ENV=test node --require ./server/tests/isolation-guard.cjs --test ./server/tests/economy-safety.test.js ./server/tests/crafting-inventory.test.js ./tests/market-service.test.js
```

- Baseline: **3 defects reproduced** against HEAD source before the corrections. HEAD changes in the future would invalidate that historical reference, so do not treat this option as a permanent current-success test.
- Corrected safety fixture: **17 groups passed** with actual PG/service SQL. Covers provenance0 freeze; invalid input/ownership; resource and item/claim/ship escrow; actual ownership/pixel transfers; stale-escrow rollback; winning-bid buyout difference; duplicate refunds; cross-service races; no-bid expiry; latest-bid natural settlement; legacy PP; negative buyout; active-cap race; pooled transaction closure; malformed refund; concurrent treasury withdrawal/demotion; actual fee-bound referral credit.
- Action fixture: **10 groups passed**. The original mining→craft→trade→ship chain remains; the extra group tests missing config information3/1500, cap1499+1, invalid negative/malformed settings and explicit cap0.
- Narrow isolated unit/VM run: **20/20 passed** (four new safety tests, four existing crafting-inventory tests, twelve existing market-service tests). Source syntax and `git diff --check` are also checked. Parent integration owns the final full unit-suite run.

Every safety run creates its own fresh private `/tmp/oc-econ-<random>/db` PostgreSQL16 cluster, Unix socket55444 and fixed public dummy credentials. TCP/listeners/DNS/TLS/fetch/production dependency imports/credential reads are denied. The action fixture independently uses `/tmp/oc-play-<random>` Unix PG55443 and private HTTP. Neither reuses a review/production DB or loads .env/index/migration runner/schedulers. Only migration355 itself is read and executed against the new dummy schema in the safety fixture.

The safety fixture's ordinary job/title/season/daily/notification/wash-trade collaborators are neutral/no-op injections. Its final referral group runs real extracted DB helper functions and actual referral SQL. Users, catalogues, bids and initial assets are synthetic; it is a service/transaction test, not browser, Redis/replica, load, real multihuman economy or all-app acceptance.

Latest safety cluster `/tmp/oc-econ-tO5bBf` was stopped and removed, and each normal run closes pools before `pg_ctl stop`. The latest action-cluster cleanup is recorded in tool output. No own PG/socket remains after cleanup. The guard deliberately leaves cleanup in `finally` rather than killing unrelated processes.

## Remaining decisions and honest limits

No complete new-account territory→harvest→all-five-missions→long-term economy run, all campaign/guild war/defection/governance/bounty settlement, all market asset branches, real bot/multiaccount attack, full PostgreSQL production schema triggers, Redis/replica race or deployment has been certified. These existing implementations are not declared missing.

The two existing auction endpoints still have different bid increment and small-fee conventions; this patch preserves their valid rates while enforcing conservation across both paths. Product consolidation of those public contracts is a separate before/after policy decision, not a reason to silently change player prices here. Wash-trade automatic blocking, a universal per-person mint cap and new anti-sybil identity checks would also require explicit product policy; none were invented. Configured unlimited mining cap0 remains observable policy rather than being silently overridden.

Changed/new files for this follow-up: `server/services/auction.js`, `auctionCombat.js`, `marketplace.js`, `resourceCraft.js`, `crafting.js`, `guild.js`, `shipMining.js`; `server/routes/auctionRoutes.js`; `server/migrations/355_auction_escrow_provenance.sql`; `server/tools/economy_safety_isolated_regression.js`; the existing `server/tools/local_play_loop_isolated_regression.js`; `server/tests/economy-safety.test.js`; this document. Independent review reference files, original Desktop checkout, auth/WS and parent-owned wallet/on-chain/UI files were not edited.

## Final P1 follow-up: transactional marketplace dividend allocation

The independent review identified a concrete atomicity defect: `marketplace.buyListing(client)` used `dividends.addToPool(fee, 'marketplace')` fire-and-forget before its route committed, and that helper ignored its documented transaction-client argument. A later sale rollback could leave an unfunded dividend pool in a separate connection.

`services/dividends.js` now accepts the supplied client and a remaining-fee allocation budget. Its settings read and pool upsert use that client, and the marketplace awaits completion before returning to the committing route. The existing nominal marketplace percentage/default20 is preserved; explicit0 is honored; malformed, negative or above100 percentages are rejected. The allocation is the smaller of the nominal request and the captured fee left after **actual returned referral credits**. This preserves the intended allocation when funded and prevents referral plus dividend from exceeding the fee. No fee, price, token or historical balance was migrated.

A savepoint isolates only optional missing dividend-table/column schema (`42P01` / `42703`). It rolls back and releases the savepoint, records a skipped allocation and returns0. Other allocation errors propagate so the caller can roll back the sale. No pool is minted when optional storage is unavailable, and the transaction remains usable. The old sticky optional UI availability flag is not used to guess that a later transactional allocation succeeded.

The actual private-PG safety fixture now passes **22 groups** (the earlier17 plus five P1 groups), using real marketplace/dividend sources and the real extracted referral helper:

- Forced external sale rollback: an independent connection sees pool0 before commit; rollback leaves pool0, referral rows0, the listing active and all sale GP unchanged.
- Committed200-GP sale / captured fee10: actual referral2.5 and nominal default20% dividend2 commit once. A duplicate buy does not add another dividend or referral.
- Actual referral8.5 of fee10: nominal dividend2 is bounded to1.5; total allocations equal10.
- Explicit dividend0 produces no pool write; `-1`, `101`, `NaN` and blank configuration reject without a write.
- Dropping only the fixture's optional pool table: allocation savepoint is restored; `SELECT 1` and the actual sale/2.5 referral commit normally, with no dividend pool minted.

Latest22-group run exited0 and removed its own `/tmp/oc-econ-jVFFl4` cluster. The command is unchanged:

```sh
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/opt/homebrew/bin:/usr/bin:/bin NODE_ENV=test RUN_SCHEDULERS=false node server/tools/economy_safety_isolated_regression.js
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/usr/bin:/bin NODE_ENV=test node --require ./server/tests/isolation-guard.cjs --test ./server/tests/market-dividend-safety.test.js ./server/tests/economy-safety.test.js ./tests/market-service.test.js
```

The latest narrow unit/source run passed **21/21**, including five new dividend/ship tests. `ship.js` failure/cancellation/scrap refund percentage checks now accept valid0 and reject null/blank, malformed numeric prefixes, nonfinite, negative or above100 values before refund writes. Existing defaults100/50/40 remain, and no historical ship-cost basis or cost migration was added. Scrap continues to use its existing current catalogue basis; historical-cost reconciliation remains a separate policy/release boundary.

Lottery still calls the dividend helper without supplying a caller transaction client. This change does **not** certify or repair atomicity between lottery settlement and its pool allocation; `lottery.js` was not edited or exercised. Weekly staking distribution and concurrent pool payout are likewise outside the selected marketplace allocation regression. These existing boundaries must not be represented as newly verified by the22 tests.

Additional affected files for this P1: `server/services/dividends.js`, `server/services/ship.js`, `server/services/marketplace.js`, `server/tools/economy_safety_isolated_regression.js`, `server/tests/market-dividend-safety.test.js` and this document. Parent integration owns refreshing the full source manifest, economic model source hashes and final aggregate test evidence.
