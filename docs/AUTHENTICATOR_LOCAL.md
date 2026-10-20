# Username + authenticator: disabled local implementation

Local source implementation; the operating environment is unchanged.
This is a new account method, not enrollment/migration of existing email accounts.
Existing email/password login stays available. Territories/ships remain database
assets; signup does not create a real wallet key or issue PP.

## Contract

- `GET /api/auth/totp/config` reports availability. All mutations fail closed
  unless `TOTP_AUTH_ENABLED=true`, a canonical base64 32-byte
  `TOTP_ENCRYPTION_KEY` and existing `JWT_SECRET` are present. The public config also checks all required TOTP database columns and reports `schemaReady`; missing or partial schema keeps `enabled=false`. No values have been
  generated, set or read from an operating `.env`.
- `POST /enroll/start`: lowercase username, 4–24 ASCII letters/digits/underscores,
  and explicit terms acceptance. Five-minute pending state does not reserve the
  username or create a user. Only final atomic identity insertion claims it.
- `POST /enroll/verify`: first valid authenticator code proves possession. Return
  ten recovery codes once; persist only their hashes and a confirmation hash.
- `POST /enroll/activate`: re-enter a saved recovery code to acknowledge backup.
  Consume that code, create the account (nine backups remain), apply existing
  administrator signup GP/mineral settings and issue a normal game session.
  Mineral default remains 6 iron / 6 carbon / 3 silicon. Configured signup bonus
  is converted to GP by the existing rate helper; no PP is issued. Transactional
  signup benefits are not repeated by replay, recovery or duplicate activation.
  An invalid configured resource code or unavailable seed/schema aborts the new
  signup transaction; legacy email signup may instead continue without minerals.
- `POST /login`: username and unused current TOTP code. SHA-1, 30 seconds,
  six digits, narrow ±1 counter window, atomically consumed counter.
- `POST /recover`: username and one unused 128-bit recovery code. Consume the
  code, clear the old seed, increment session version and return replacement
  enrollment. **No JWT at this step.** Verify/activate the new authenticator and
  new backups before access resumes. A second valid recovery can restart after
  losing an expired attempt; the first consumed backup cannot be reused.

Requests use JSON POST, exact same Origin, HTTPS (loopback HTTP only for fixtures),
no-store responses and generic account errors. AES-256-GCM encrypts seeds with
identity/enrollment-bound AAD. QR generation uses pinned local code; setup keys,
tickets and raw recovery codes remain transient DOM/memory, apart from explicit
user-initiated backup download. A completed session uses existing `pw_token`
storage. Expiry, page exit and completion clear sensitive enrollment fields.

`353_totp_auth.sql` adds separate tables. It has been executed twice only in the disposable `totp_fixture` schema for local integration checks; production migration/bootstrap has not run. Transactions
lock identity/enrollment rows and guard state/counters. Deleted/inactive users
cannot sign in or recover. A global HTTP boundary checks new session versions
before legacy routes, including body-token/raw-header paths. Wallet linking is
blocked for these sessions because the legacy link response would downgrade the
versioned JWT. WebSocket reconnect and privileged battle commands also recheck.
Legacy token behavior remains on its existing path without new DB checks.

## Abuse controls and limitations

Per-account login guessing has a persistent five-failure budget for a fixed
24-hour window beginning at the first failure; success or an IP change does not
reset it. A 15-minute lock also applies. Correct high-entropy recovery remains
available during that lock. Short-lived bounded in-memory IP quotas supplement
the account budget; they are not distributed across replicas. Pending enrollment
has its own five-failure cap and expiry.

This is single-factor authenticator login, **not MFA or phishing resistance**.
A person knowing a public username can exhaust its guessing budget and deny code
login until expiry; backup recovery remains the escape path. Losing both the
authenticator and all backups has no new email/support recovery. Rate-limit
policy, global quotas, account abuse, secure encryption-key storage/rotation and
backup retention need operating decisions before activation. Rotating the key
without re-encrypting stored seeds would prevent decryption.

The UI supports English/Korean, with Japanese/Chinese partial translations and
English fallback. Chrome fixtures covered desktop and a 390px viewport; real
phone/browser coverage and accessibility validation remain incomplete.
Ten-second mutation timeout does not prove a failed server action;
there is no automatic replay. An activation response lost after commit requires
sign-in with a fresh authenticator code. A lost recovery response consumes that
backup and requires another unused recovery code.

## Evidence

Integrated on the evolved local `6819e74` worktree on 2026-10-21, using
file-by-file three-way comparison with Desktop `6c10b5d`. The prior email OTP
experiment was archived outside the active source; existing password routes
and current WS command/BigInt/Redis behavior were retained.

The integrated auth-only guarded suite passed 39 tests. Actual PostgreSQL,
Express HTTP and WebSocket over private Unix sockets passed 16 scenarios,
including real lock races, migration353 twice, missing/partial schema, replay,
recovery, revoked sessions through current frontier/objective/starter route
parsers and legacy `/auth/me`. Actual legacy email/password PG/HTTP regression
passed 12 scenarios; existing WS battle-channel regression passed 5 checks.
These are disposable public fixtures. Gameplay services behind privileged route
checks and WS command dispatch are injected in the auth fixture, not a complete
gameplay validation. No real account, phone authenticator, production environment,
external mail, wallet, chain, deployment or full production migration was used.

See [local integration results](TOTP_INTEGRATION_RESULT_2026-10-21.md) for exact
commands, fixture boundaries, source hashes and remaining release gates.
