# Resource listing cost protection and legacy auction review

Local implementation, 2026-10-21. This document supersedes the earlier `MARKET_UX_QUOTE.md` statement that a negative GP resource registration is merely warned and allowed. No setting, migration, reward rate, listing fee, sale fee, expiry, or settlement pool percentage was changed by this patch.

## Resource behavior

`server/services/marketplace.js` shares `resourceListingSafety` between `quoteListing` and the locked, pre-charge `createListing` path. For GP resources it checks current bundle total minus the same micro-floored seller sale fee minus the current registration charge. A result of zero or less blocks registration before any write, including older/direct clients that omit quote fields. The free quote returns `resourceRegistration` with `blocked`, `status`, minimum positive-net bundle total, and an increased-quantity suggestion preserving the seller's unit price.

This uses actual fetched listing terms, count-based multipliers, seller discounts and sale fee settings. The authored 5 GP default in migration220 is preserved; missing-setting service fallback remains 2 GP. Migration082's authored dynamic multipliers 2/4 and missing-setting fallbacks 1.5/2 are unchanged. The computed minimum positive-net total respects the fetched minimum/maximum total-price bounds; changed bundles are always validated again by the server. PP proceeds remain separate from the GP registration charge; no exchange rate is assumed.

With 5 GP registration and a 5% sale fee, five iron for a total 3 GP leaves −2.15 GP before materials/tariff, so registration is blocked. At the same 0.6 GP unit price, nine iron for 5.4 GP leaves 0.13 GP. The first six-decimal total with positive remaining GP is 5.263158; 5.263157 leaves zero and is blocked. These are arithmetic examples under those settings, not recommended economic prices.

`assets/market-transport.js` shows the current quote and provides quantity and total-price fields in the cost review. Editing quantity preserves the current unit price; editing total changes that unit price. When a suggestion exceeds available inventory, its quantity button is disabled and the seller can adjust total or wait. Any edit requests a fresh quote and requires a separate confirmation before registration. All resource cost-edit inputs/buttons have 44px minimum height and 16px numeric input text. In-memory drafts are keyed by wallet and resource and survive cancellation, validation errors, fee changes and unsuccessful requests within the page session. Drafts clear only on successful registration. Stock reductions do not silently change a saved quantity: validation requires the seller to revise it.

The guard establishes positive proceeds **before tariff and material/production costs**, using settings at registration time. It cannot guarantee raw-material profit, buyer demand, sale completion, or future fees. Buyer-dependent tariffs remain a displayed range/unknown adjustment. A sale that later expires or is cancelled still has the existing nonrefundable registration fee; free previews and blocked registrations incur none. The existing 60-second quote/changed-fee checks, seller lock and GP funding check are preserved. This patch does not add a refund or economically tune the policy.

## Legacy auction UI

The server owner supplies `escrow_review_required` and `read_only` on each list/detail auction. The UI consumes these flags and also recognizes explicit zero escrow version for active auctions; completed/cancelled zero-version records remain history. Asset cards remain visible with an escrow-review notice and a disabled read-only control. Bid, buyout and cancel controls are absent for frozen records, and their functions refuse cached frozen records without a mutation request.

Each actionable entry also reads `/api/auctions/:id` immediately before presenting confirmation, supports both `{auction,bids}` and flat detail shapes, and fails closed if status cannot be read. Current version-one auctions retain their existing actions. These UI checks complement the server's write-time validation; the read itself cannot prevent a later state race. No asset release, guessed refund, deletion or restoration is performed by the UI.

## Validation

Command from the repository root:

```sh
node --require ./server/tests/isolation-guard.cjs --test tests/market-service.test.js tests/market-ui.test.js
node --check server/services/marketplace.js
node --check assets/market-transport.js
git diff --check -- server/services/marketplace.js assets/market-transport.js tests/market-service.test.js tests/market-ui.test.js
```

Result: **39 passed, zero failed/skipped**. The isolation guard blocks application DB/env/network loading. Tests execute the actual service source with allowlisted dependencies and browser source in a VM, including the real shared confirmation dialog validation contract. They cover zero/negative GP, direct-client bypass attempts, funding denial without writes, current fee recomputation, dynamic settings/discounts, PP separation, same-unit-price suggestions, fresh-quote approval, draft isolation and stock validation, frozen list/action behavior, modern/flat details, failure to read status, historical records and normal current-auction actions. This is local source/runtime fixture evidence; it does not claim production DB concurrency or deployed browser validation.

Earlier 42-run behavior outputs, nine source-market comparison outputs, their manifests and all three simulation drivers were left byte-for-byte untouched. Their source snapshots predate this new safety behavior and must not be described as reruns of it. No full simulation was executed for this patch.

## Inline localization

All new resource-safety and auction-review copy is supplied directly to `tl(en,ko,ja,zh,id,vi,th)`. The generated `assets/i18n-sea.js` is untouched. English originals introduced by the patch:

- Enter an available whole quantity and a positive total price.
- Increase the bundle or total price, then review costs again.
- Quantity
- Bundle total
- Current fees require a bundle total above the zero-net boundary. This excludes material costs and does not guarantee a buyer.
- Use suggested quantity:
- Use fee-covering total:
- Suggested quantity exceeds your stock. Edit the total or wait until you have more resources.
- Changing quantity keeps the current unit price. Changes always need a fresh cost review before listing.
- This resource bundle cannot leave positive GP after sale and registration fees. Adjust it before paying any registration fee.
- Review adjusted costs
- Current fees leave no positive resource proceeds. Your draft is saved; adjust it and review again.
- Read-only: assets are preserved pending escrow review. Bidding, buyout and cancellation are unavailable.
- Auction status unavailable. Reopen the market and try again.
- Review required
- Read-only

## Local browser fixture

`node server/tests/market_release_ui_fixture.js` starts a loopback-only ephemeral HTTP server. Open its printed URL with `?view=market&lang=ko` or `?view=auction&lang=ko`; all seven supported language codes work. Enter quantity 5 and total price 3, review the blocked bundle, apply the nine-unit suggestion, review the new quote, and approve registration. The fixture serves the actual product JS/CSS/confirmation markup; quote/create execute the actual service source against an allowlisted in-memory dummy query adapter. `/requests` exposes dummy HTTP requests. It loads no app bootstrap, DB, .env, real authentication, accounts or external API, and writes no evidence directory. Successful simulated registration does not persist between requests. Frozen auction cards use public dummy assets.

HTTP smoke verification returned a blocked 3 GP registration (400), a nine-unit/5.4 GP suggestion, and a successful adjusted dummy registration (200), with two frozen auction cards available. The parent owns visual mobile inspection and deployment; this fixture is not the deployed game.

## Final parent browser verification

The parent completed actual browser inspection using the loopback fixture and product sources after the final style patch:

- At390px, quantity5/total3 was blocked; selecting9/5.4 opened a fresh quote, and a separate explicit confirmation sent the final registration request with quantity9.
- At320×568, review inputs had computed dark RGB(22,16,19),44px height and16px text. Suggestion buttons had copper-dark RGB(44,28,21), heights44.4/66.8px with long text wrapping. The reviewed content's right edge was291px and document scroll width320px, with no horizontal overflow.
- At320px, both read-only auction cards had disabled44px controls and no overflow.

The correction touched only inline styles for the two review inputs and two proposal buttons in `assets/market-transport.js`; it changed no quote, registration, guard or economic calculation. The narrow service/UI suite remained39/39 passed; `node --check` and `git diff --check` passed. Final market UI source SHA256: `8db7a212f9fa758b428f2e2f5c4f88847a221318eaed343d5b67bc6e5621ef70`.

This evidence verifies the local fixture/product-source slice. Production deployment and real-account/database validation remain the parent's separate work. The dedicated fixture process(session52118,port61187) was stopped after this inspection; no other server was stopped.
