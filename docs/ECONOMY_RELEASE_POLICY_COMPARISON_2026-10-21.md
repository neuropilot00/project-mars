# Release guard and hypothetical policy comparison

This offline comparison closes a version boundary: the earlier nine source-market runs preceded the newly implemented resource registration guard. They remain valid for that earlier authored contract, and are not current-guard results. Neither those artifacts, the earlier 42 runs, nor any of their three tools was edited or rerun.

## Executed scope

The new `server/tools/economy_release_policy_comparison.js` reads the frozen behavior driver and substitutes exactly two sites in memory: the market constructor and the mining GP calculation. Each substitution checks that its original needle occurs exactly once. The current pure `resourceListingSafety` function is extracted verbatim from the frozen current marketplace service, with its hash recorded. It uses the same native micro-floored sale fee for the guard under the explicit no-discount, 5% sale-fee condition. Marketplace settlement, expiry and whole-lot purchase reuse the earlier `SourceMarket` accounting implementation; this remains selected formula/accounting reuse, not a service/DB/API replay.

Seventeen full cases ran exactly once: current guard × mixed_medium/buyer_shortage/bots_matched_capital × seeds 20261021/20261022/20261023, then four synthetic candidates × mixed_medium/bots_matched_capital × seed20261021. Every case has 48 accounts, 112 days and six-hour decisions. Source-like fixed asks, whole-bundle immediate purchase, no persistent or prepaid bid, authored168-hour expiry, cap20 and original per-asset offer preference remain. Expiry is observed on six-hour decisions rather than the source's five-minute scheduler. Actual expiry and horizon-return counters are separate.

**Proposal uptake is zero in every executed case.** Rejected sellers keep their five-unit behavior and do not automatically accept a larger bundle. The production UI supports adjustment, but this run does not estimate human adoption. Positive-uptake full cases were not executed. This separates guard behavior from assumed seller adaptation.

The three reference profiles use authored 5 GP registration, dynamic count multipliers2/4, 5% sale fee, no job discount, no tariff or eligible referral uplines, and the assumed dividend schema20% pool allocation. Pool allocations are transfers/reserves, not true burns. The guard rejects best-case current sale receipts minus registration charge at zero or less before any mutation. NPC identity population stays fixed: one newly seeded NPC, 200GP and40each of five resource types; only three resource types are traded by this driver. There is no recurring seed issuance.

## Candidate definitions, not operational policy

All candidates apply the same registration guard and retain proposal uptake0. No game setting/default, entitlement or server source changes were made.

| Candidate | Sole intended change | Explicit assumption |
| --- | --- | --- |
| fee_one_percent_capped5 | Resource listing charge=min(5GP, floor(bundle gross×1% at6decimals)); count multiplier omitted for this candidate | User-authorized synthetic fee hypothesis, not calibrated or an approved live rate |
| mining_account_cap150 | Mining GP rolling24h ceiling150 per account, instead of authored1500 | Only new ship-mining GP changes; resources/login/missions/weekly rewards are unchanged |
| mining_controller_cap150 | Mining GP rolling24h ceiling150 aggregated by controller, while retaining individual1500 ceiling | A perfect stable controller identity is supplied by the synthetic driver; no real bot detection or identity capability is claimed |
| npc_funded_reprocurement | NPC may buy at most one existing whole resource listing per virtual day with actual available GP, leaving≥10GP; wallet+open-ask stock after purchase≤40 per resource; unit willingness≤the existing0.6/1/1.4 reference anchors | New hypothetical inventory service, not current NPC behavior. No minted stock or GP, no external reserve, no assured resale margin or replenishment guarantee |

The 150GP candidates were selected from the requested sensitivity range, not searched for an outcome. No100GP variant was run. NPC stock ceiling40 and reference prices reuse the model's source-anchored opening values; its daily decision frequency and10GP reserve are plainly synthetic service assumptions. Because buying/selling incurs fees, this service can consume its finite capital. Its acquisition is a funded transfer; any later retail sale uses the same listing and settlement rules. No automatic cash redemption rights are added to GP/PP. Existing hypothetical funded USDT custody remains a separate ledger.

## Observed slice

Current-guard runs across three seeds had net issuance (GP issuance excluding opening balances minus true GP burn) of:

| Profile | Net GP, 112days | Trades | Guard-rejected attempts |
| --- | ---: | ---: | ---: |
| mixed_medium | 387418.30–392831.10 | 67–104 | 6643–6829 |
| buyer_shortage | 388763.82–390958.73 | 48–58 | 7182–7435 |
| bots_matched_capital | 469933.38–480416.38 | 68–101 | 8973–9232 |

These are conditional outputs of this activity/cost slice, not whole-game inflation forecasts or currency valuation. Opening capital is excluded from issuance flows. `issuanceSourcesGP` separates qualified rewards and mining from finite NPC seed. Failed/repeated registration attempts are opportunities, not unique sellers or fees actually collected.

For seed20261021, current-reference mixed/bot net GP was389724.01/480416.38; their iron volume was40/40. The1% candidate yielded378421.44/469574.86 net GP and2060/1840 iron units traded. A lower listing charge permits small orders and can also enable downstream consumption/activity; these figures do not isolate a demand elasticity or prove economic equilibrium. The per-account150 ceiling reduced mixed/bot GP mining by6996/6642 in these paths, yet bot GP share rose from31.63% to32.09% because it also constrains active human fleets. The controller150 candidate withheld75858GP of mining from the bot-profile path and ended at20.01% bot GP share, conditional on perfect grouping. It cannot justify real-world identity enforcement.

NPC reprocurement completed20/10 funded acquisitions costing124.089/60.949GP in mixed/bot paths. Iron volume stayed40 in both. Under unchanged five-unit offers and uptake0, the guard continues to refuse low-price iron registrations; NPC purchases cannot buy listings that never exist. No additional seed was created by the procurement code. These conditions help distinguish a listing-size/fee constraint from a proposal to add liquidity.

Common monetary, inventory, iron trade and concentration metrics are joined to the old nine runs in `comparison.csv`. Candidate comparisons join to the **new current_guard** run of the same profile and seed. Each daily row adds `policy`; summary JSON retains `runs[{summary,roles,issuanceSourcesGP,...}]` without duplicated daily arrays. Old dual-side order completion/expiry percentages are not comparable to single listing outcomes. Same seeds can consume shared RNG differently after state branches; these are descriptive conditional comparisons, not paired causal estimates or confidence intervals. Display-only GP metric sums may have floating point tails; the underlying posting units and invariants are integer.

## Verification and resources

```sh
node --require ./server/tests/isolation-guard.cjs --test server/tests/economy-release-policy-comparison.test.js
node --max-old-space-size=768 server/tools/economy_release_policy_comparison.js --out ../../outputs/evidence/release-20261021/economy-policy
```

The output directory must be new; the tool refuses overwriting one. Do not rerun the full batch into the frozen result directory.

Six narrow tests passed: current guard/boundary/no-mutation, all-candidate guard, source quantity suggestion without adoption, fee amount, account/controller rolling cap, NPC funding/reserve/stock/no-issuer legs, whole-bundle/expiry semantics, exact injection sites and compact accounting. Seventeen full runs had zero conservation, role-PnL, custody, listing-outcome and purchase-outcome errors. Two compact2day/6account replays matched daily CSV hash `001c2e22db961f6b5bdf8007d37f181011bfdfa13cc54c850082845db7ff3fa0`.

Actual full-batch process CPU7.978381s, wall5.463631s, peak observed heap87713368bytes, maximum RSS204619776bytes. Hard limits were12CPU seconds/25wall seconds/768MiB heap/20MiB artifacts. Known cumulative model CPU rose from77.770228s to85.748609s; this cumulative model-run accounting does not include general editing or test-runner overhead. Reference nine were saved first at4.275495CPU seconds. Data/progress artifacts before the final receipt total675862bytes. Resource checks ran at each model step and between runs; failure handling would retain completed summaries and partial receipts. No partial failure occurred.

The receipt inventories and checks all prior42/nine artifact hashes plus three original tool hashes before/after. They were unchanged. `run-progress.json` preserves per-case completion, and `reference-summary.json` preserves the first nine before candidates. No full event logs, network calls, database/config/credential access, external packages, accounts, wallets, chain, deploy or application-source mutation occurred in this model task.

## Coverage and code defects

The limitations and source precedence in `ECONOMY_SENSITIVITY_POLICY_SOURCES_2026-10-21.md` still apply. This driver does not model the whole source reward/sink surface, faction/rank differences, all ship classes and supply chains, persistent player demand, referral trees, treasury payout scheduling, season payout rights, or actual redemption eligibility. High-cost sink adoption remains the earlier driver's bounded behavior assumptions. Bot accounts retain matched opening capital/fleet and only their specified activity/consumption differences; controller identity is an assumption.

The separate duplicate season-payout entitlement defect and migration359 (`359_season_reward_finalizations.sql`) belong to the parent's source/PG regression work. No season payout flow is replayed here. A proven code defect and its local fix must not be replaced by an economic scenario inference, and these simulations do not prove that fix or its deployment. Candidate simulations likewise do not alter or approve player reward rights.
