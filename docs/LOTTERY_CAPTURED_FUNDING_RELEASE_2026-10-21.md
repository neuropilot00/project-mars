# Lottery captured funding and retry repair — 2026-10-21

## Implemented

Migration `358_lottery_captured_house.sql` adds `lottery_rounds.house_gp` with
default zero and nullable `lottery_tickets.paid_gp`. It is forward-only: existing
unrecorded house cuts stay zero, existing tickets stay `paid_gp=NULL`, and no
historical value is reconstructed from ticket count or today's settings.
Pre-existing recorded `house_gp` values are preserved.

New purchases persist the actual six-decimal GP debit, its existing house-cut
split and prize allocation in the same transaction. Each ticket records its
share of the debit, preserving micro-GP rounding remainders. With the existing
10-GP price, ten tickets debit 100 GP, add 95 to the prize and record 5 captured
house GP. With the existing 30% lottery dividend setting, settlement allocates
1.5 GP from that 5; it does not issue another funding allowance. Price,
house-cut and dividend settings retain their existing interpretation.
The current-round response's display `ticket_price` uses the same current setting
as purchase charging; the original `ticket_price_gp` remains historical metadata.

Cancellation refunds newly recorded principal rather than multiplying tickets
by the round's original price: this also refunds correctly if a configured price
changes during an open round. Historical tickets without recorded principal
retain the pre-existing round-price fallback. Historical actual debits cannot be
proven by this migration. A cancelled round allocates no house dividend, and its
captured cut is excluded from the completed-house admin total.

The prior fix remains: positive captured-house dividends are awaited on the
same transaction client before COMMIT with `requireSchema:true`. Failed required
allocation rolls the prize, winning ticket, round completion and pool change
back together. Marketplace optional behavior and `dividends.js` were not changed
by this follow-up.

`drawRound` returns whether its close was committed. The scheduler counts only
committed closes (including successful cancellations); failed or duplicate
attempts count zero. A post-commit notification failure cannot cause a pretend
money rollback or false failure count.

Next-round creation runs separately from settlement. A creation failure leaves
the already committed payout intact and is retried on subsequent scheduler calls,
even if there are no expired rounds left. `createRound` uses a transaction
advisory lock and rechecks for an existing open round before allocating the next
number. Concurrent first-round/current-round/scheduler retries therefore reuse
one open round instead of creating duplicates.

## Validation

All execution used a clean environment, injected app dependencies and fresh
private PostgreSQL clusters with Unix sockets only. No app bootstrap, existing
database, external API, wallet, key, real chain or deployment was used. Each test
cluster was stopped and its newly created directory removed.

Evidence is in `outputs/evidence/release-20261021/lottery/` under the parent task
workspace (the existing lottery follow-up evidence remains unchanged).

* `source-tests.log`: lottery source tests plus existing marketplace dividend
  tests. They verify strict/optional compatibility, awaited allocation, failure
  rollback, preserved zero/disabled behavior, failed-close counting and actual
  purchase-funding arguments.
* `private-pg.log`: nine real PostgreSQL checks using actual production sources,
  actual migration 358 and minimal current-schema fixtures. It verifies historical
  zero/NULL preservation; new 100=95+5 funding followed by 95+1.5 settlement once;
  actual-principal cancellation across price changes; failed allocation counting
  zero with full rollback; concurrent retry; failed next-round creation followed
  by idempotent retry; concurrent first-round creation; absent funding-column
  purchase rollback; historical cancellation fallback; and fractional-principal
  conservation. The cleanup result is `privateClusterRemoved:true`.
* `atomicity-regression-pg.log`: the existing nine-group actual-PG compatibility
  suite passes against the new source. It also executes the captured prepatch
  source to reproduce its committed-prize/failed-allocation defect. The tool's
  scope note now points to the new release suite for counter/next-round coverage.
* `receipt.json`: source hashes, commands, results and boundary notes.

The new private-PG tool is `server/tools/lottery_release_private_pg.js`.

## Rollout boundary

Migration 358 must precede the updated purchase/cancellation code. A missing
capture column causes the transaction to roll back; it must not be bypassed.
All purchasing/drawing workers need the updated source so an old worker cannot
continue creating unrecorded purchases during a mixed-version rollout. Root
owns actual deployment and any operational migration sequence.

GP stays off-chain; this adds no cashout or token entitlement. Historical missing
funding evidence remains missing, not newly minted revenue. Legacy-price
fallback is preserved for unrecorded historical refunds and is not an assertion
that all historical charged prices are known. These local tests do not prove
production migration, deployed-worker version or real-user delivery.
