# Custody state-machine repair — 2026-10-21

This is a local source change and isolated regression result. It is not a
deployment, real-chain payment test, custody attestation, or authorization to
enable cashout. No account, key, wallet, fund, RPC endpoint, mail or production
database was accessed. The chain/asset rollout is a separate plan.

## Implemented behavior

`server/routes/redemptionRoutes.js` preserves the existing `/swap` and `/withdraw`
contracts and valid configured rates. GP/PP stay off-chain. No new redeemable PP,
cashout entitlement, token, chain adapter, NFT or contract was added.

* `/withdraw` locks the user, then a per-chain transaction advisory lock. It
  recovers an existing pending signature before checking cooldown/remaining
  available balance, so a lost HTTP response cannot make the committed signature
  inaccessible. An expired unresolved signature returns
  `withdrawal_pending_reconciliation`; it cannot be replaced/refunded from a
  local clock or a latest nonce. New signatures still use the contract nonce,
  never `users.withdrawal_nonce`. Fresh and reissued responses both include
  `pending:true` and authoritative `usdtBalance`; the UI can show a reservation
  without treating a signature response as a completed payout or debiting twice.
* The same per-chain lock covers liquidity observation/reservation and pending
  settlement/refund. Reservations from different wallets cannot both allocate
  the same observed liquidity. Existing pending rows, including unknown/expired
  local signatures, remain in the reserved-net sum until final reconciliation.
* `chain.js` settles only after a finalized-block nonce advanced. A refund needs
  the **same** nonce at a finalized block whose timestamp is **strictly greater**
  than the signature deadline. The contract accepts a signature exactly at its
  deadline. A lower/stale nonce, unavailable finality, RPC failure or timeout
  leaves the claim reserved. A latest event is only a hint, not settlement proof.
* Reconciliation uses user → chain advisory → pending → treasury lock order.
  Rechecking pending status under lock prevents duplicate refunds. The old
  pending-first/user-second deadlock and double client release were removed.
* Financial setting parse errors no longer silently become zero/unlimited or
  partially parsed numeric prefixes. Existing zero cooldown/fee settings work.
  Existing optional solvency/weekly-limit switches remain owner policy; this
  change does not activate those switches. Weekly limit observation/insertion
  is transaction-serialized even when the optional collateral guard is off.
* The USDT season reward dependency now fails closed on a missing treasury or
  pending-liability table (`42P01`) rather than minting a claim without evidence.
* Legacy `/withdraw-all` fails closed with HTTP 409 and an explicit instruction
  to use existing eligible-PP `/swap`, followed by wallet `/withdraw`. It previously
  signed a DB nonce with no pending reservation and deleted territory immediately;
  expiry could not safely restore those assets. No runtime frontend caller was
  found in `assets/` or `index.html`. Re-enabling combined withdrawal/reset needs
  its own staged, reversible settlement design and tests, not another immediate
  debit. Existing territory is preserved when this legacy route is called.

## Deposit finality and event identity

`signer.js` requires the provider's `finalized` block, reads the nonce at that
block number, and rechecks its canonical hash. Unsupported finality support
fails closed. This trusts that provider's finalized/canonical observations; it
does not implement independent consensus verification.

Deposit notifications trigger a scan only through the finalized head. A
five-minute health scan also backfills, so an initially unfinalized notification
can later credit without another notification. Each credit rechecks finalized
height and canonical event block hash. Migration
`357_deposit_finality_identity.sql` adds `(chain, tx_hash, log_index)` identity and
block hash. Inserting the identity with `ON CONFLICT DO NOTHING` precedes balances
inside the same transaction; restart/duplicate delivery cannot issue twice.
Separate logs in one transaction can credit independently.

Backfill restarts at the last processed block inclusively, handling multiple
logs in the same block, and stops at a query/processing gap instead of advancing
past missing money. The legacy initial scan still starts at the configured
recent-block window when no deposit history exists: a deployment-block/start
cursor and independently reconciled historical import remain release work.
Migration 357 is required before using the new processor. Without it, processing
throws before any credit. Old rows retain `log_index=-1` and unknown hash;
their transaction is conservatively treated as already credited. Historical
multiple-log receipts and old unfinalized credits need explicit reconciliation,
not automatic re-credit.

## Readable accounting snapshot

`treasury.lockRoom()` returns the following under the treasury transaction lock.
These are database accounting facts, not an on-chain custody measurement:

| Field | Meaning |
| --- | --- |
| `collateral` | Accounting collateral after pending net has already been deducted |
| `liability` | Available `users.usdt_balance` claims |
| `pendingNet` / `pendingPayoutClaims` | Token payout amounts reserved for pending signatures |
| `totalPayoutClaims` | Available USDT plus pending net payouts |
| `pendingGross` | Pending gross refundable claim, including provisional fee |
| `pendingFeeHold` | Pending gross minus pending net; refundable until execution is final |
| `customerClaims` | Available USDT plus pending gross |
| `trackedReserve` | Accounting collateral plus reserved pending net |
| `physicalReserve` | `null`: not measured by this database helper |
| `room` | Tracked reserve minus customer claims; holds provisional fees until final settlement |

Example: tracked reserve and customer claims both start at 200. A gross 100
withdrawal with a 5 fee leaves available claims 100, accounting collateral 105,
pending net 95 and pending gross 100. The snapshot reports total payout claims
195, total refundable customer claims 200, tracked reserve 200, fee hold 5 and
room 0. A pending timeout therefore creates no fee revenue or redemption room.
Final execution releases the 5 fee hold; final proven non-execution restores
100 available USDT and 95 accounting collateral exactly once.

GP earned in gameplay and ordinary purchased/noncash PP credits are distinct
from stablecoin redemption claims. An item purchase or player-to-player trade
does not itself add a new redeemable bucket. This patch preserves the existing
`redeemable_pp` policy rather than upgrading arbitrary trading proceeds to cash
rights. A future multi-asset ledger must identify asset, origin and entitlement
explicitly; a displayed token balance is not sufficient.

## Remaining release gates and known risks

* `contracts/MarsDeposit.sol:collectRevenue` lets the owner transfer any requested
  contract balance to treasury without checking off-chain customer liabilities.
  This contract was not changed or called. Reserve custody, operator authority,
  and withdrawable fee/revenue enforcement need a concrete deployment decision.
* The reconstructed ledger cannot prove actual contract reserves match claims.
  Reconcile finalized custody balances per existing asset/chain, known actual
  outflows and fees against the ledger before enabling funds. A request/timeout
  is not an actual reserve outflow. Token identities/decimals, configured chain
  IDs and deployed contract bytecode still need release verification.
* Existing legacy signatures/credits cannot be repaired by inventing facts.
  Audit old untracked `/withdraw-all` signatures and old credits against finalized
  receipts, then reconcile customer claims explicitly. No live data was read.
* This patch includes the narrow `season.js` missing-ledger exception repair.
  It does not constitute an audit of every USDT mint/transfer/admin path.
* Finality compatibility and downtime behavior for each current chain/RPC were
  not exercised. Unsupported `finalized` keeps claims locked until supported
  observation is restored; this is intentional, not delivery completion.
* Legacy USDT six-decimal application accounting/JavaScript number arithmetic
  remains. No USDC/USDG asset migration or Robinhood runtime was implemented.

## Local validation

Command (clean environment, injected collaborators, socket/client/env-file deny
guard):

```sh
env -i PATH=/Users/jongho/.local/bin:/opt/homebrew/bin:/usr/bin:/bin \
  node --require ./server/tests/isolation-guard.cjs \
  --test ./server/tests/custody-safety.test.js
```

21 source regressions passed: committed-response recovery, concurrent cross-user
liquidity reservations, claims snapshot, timeout/unknown lock, exact final expiry
boundary, stale nonce, parallel expiry/retry, duplicate final settlement/restart,
unfinalized event hold, duplicate deposit/restart/multiple logs, legacy replay
tombstone, legacy-route closure, malformed financial settings, valid zero
configuration, missing-ledger season reward and backfill cursor/gap behavior.
Signing uses an injected literal public fixture callback; no key
or real signer is initialized. Lock behavior here is a deterministic fixture,
not proof of provider behavior.

Actual PostgreSQL validation also passed with:

```sh
env -i PATH=/Users/jongho/.local/bin:/opt/homebrew/bin:/usr/bin:/bin \
  node server/tools/custody_private_pg_regression.js
```

The tool created a **new** PG16 cluster in its own `work/pg-c-*` directory,
disabled TCP listeners, allowed only that new cluster's Unix socket, created
minimal fixture tables and applied the real 316/357 migration SQL. It injected
that pool into the actual production source rather than loading `db.js` or any
bootstrap. Eight checks passed: migration application, concurrent cross-wallet
reservation/reissue/claims snapshot, concurrent refund/retry and timeout/deadline
hold, duplicate settlement/reload, finalized duplicate/multi-log deposit with
USDT/PP/redeemable balances, legacy combined-route closure, concurrent weekly
cap check+insertion, and missing pending table failure. The tool stopped its
server and removed only its newly created directory; `privateClusterRemoved`
was true. No existing PostgreSQL server/database was contacted. Chain behavior
and signatures remained public fixture callbacks. Migration execution on this
throwaway database is not an application/production migration.

All five changed service/route JS sources passed `node --check`.
