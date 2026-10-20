# Idle battle WebSocket result revocation — local fix

Date: 2026-10-21. Scope: local integration checkout only.

## Evidence and cause

The read-only reviewer artifact at `/Users/jongho/Documents/Codex/2026-10-20/task-2/integration/final-review/auth-idle-ws-integration-result.json` reports `idle_wallet_result_reception_gap_reproduced`: a real fixture recovery revoked the previous session, but its idle battle connection still received a wallet-targeted `cmd_result`. That integration used the earlier frozen source, not this patch.

Current source confirmed the cause: inbound `cmd` revalidated the TOTP token, while `_localBattleCommandResult` only compared the connection's stored wallet. Before the patch, the new guarded unit regression had 3 passing existing cases and 6 failing new cases, including local and simulated Redis idle delivery.

## Change

- `server/wsServer.js`: owner-scoped results now pass through `_sendBattleCommandResult`. Each matching TOTP recipient must have an open connection and a freshly validated session for the same wallet. Revocation, missing/changed wallet, or validation rejection closes it with `1008/session_expired` without sending the result. The final existing safe-send check also blocks connections closed during validation.
- `server/tests/totp-websocket.test.js`: extend the existing VM fixture and cover idle revocation, replacement/current/legacy owners, wrong-wallet/spectator filtering, simulated Redis fanout, validation failure, closed-during-validation behavior, BIGINT maximum and adjacent channel isolation, public frame/end reception, and existing command acknowledgements.

Result validation happens at the shared local recipient path, including Redis subscribers. Redis message format, battle ID handling, command routing/acknowledgements, and public spectator frame/end paths are unchanged.

## Validation

Run from `/Users/jongho/Documents/Codex/2026-10-10/oc/work/occupy-upgrade`:

```sh
env -i PATH=/usr/bin:/bin /Users/jongho/.local/bin/node --require ./server/tests/isolation-guard.cjs --test ./server/tests/totp-websocket.test.js ./server/tests/totp-boundary.test.js
```

Final result: **16 passed, 0 failed, 0 skipped**. The new regressions load actual `wsServer.js` in a VM with injected socket, session and Redis collaborators. The preload disables service clients, config/credential reads and network access; the environment is cleared.

## Limits

This verifies the patched local source with isolated collaborators. No server, DB, real Redis, browser, real TOTP recovery, network socket, production action, deployment or push was run. The previous independent integration result remains unmodified and does not certify the patched source. A fresh authorized integration would be required for that claim.

Idle sockets are revalidated on owner-scoped result delivery; this patch adds no periodic revocation polling or immediate global disconnection. Public live chat/feed and battle spectator updates retain their existing access contract. Each TOTP result recipient adds one session validation; actual performance and multi-instance behavior were not load-tested.
