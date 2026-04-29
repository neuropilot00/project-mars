# Bug Reports — Claude Code Pickup Pipeline

This directory is the handoff point between **user bug reports** and
**Claude Code** (the local coding agent).

```
server/bug-reports/
├── inbox/      ← new reports land here as <id>_<category>.json
├── processed/  ← Claude Code moves reports here after attempting a fix
└── wontfix/    ← reports skipped (admin or Claude Code decision)
```

## Flow

1. **User submits** via the in-game 🐞 BUG button (next to the SECTORS
   button on the globe).
2. **Frontend** posts to `POST /api/bug-report` with title, body, category,
   wallet, URL, viewport, recent JS errors.
3. **Backend** (`server/services/bugReport.js`):
   - Inserts a row into the `bug_reports` table.
   - Mirrors the report to `inbox/<id>_<category>.json` (this directory).
   - Logs `[bugReport] new #<id>` to stdout.
4. **Claude Code** (you, when running locally):
   - Lists pending files: `node scripts/bug-report-watch.js list`
   - Picks the next one: `node scripts/bug-report-watch.js next`
   - Claims it (moves to `processed/<id>_<category>.json` and bumps
     `claude_attempts`): `node scripts/bug-report-watch.js claim <id>`
   - Investigates, edits code, runs tests.
   - On success: `node scripts/bug-report-watch.js resolve <id> --commit <sha>`
     (sets `status=fixed`, writes `claude_notes`).
   - On giving up: `node scripts/bug-report-watch.js skip <id> --reason "..."`
     (moves to `wontfix/`, sets `status=wontfix`).

## Hands-off auto-mode (optional)

Run a single Claude Code session in `/loop` mode:

```
/loop 5m node scripts/bug-report-watch.js next-and-fix
```

The `next-and-fix` subcommand returns the next inbox file as a JSON
prompt the loop can hand to Claude. If the file system has no pending
reports it exits 0 and the loop sleeps until next tick.

## Why disk + DB

- DB is the source of truth (admin panel queries it directly).
- Disk inbox lets a watcher (Claude Code, fswatch, GitHub Actions) react
  without DB polling and without keeping a long-lived connection.
- Files are durable across server restarts, so reports submitted while
  the dev machine is offline aren't lost — they're already on disk
  ready to be picked up next time Claude Code opens this repo.

## Privacy

- IPs are stored in DB but not in the on-disk JSON (the service strips
  `ip_address` only when it's null; otherwise it's included for triage —
  remove from `submitReport` if you'd rather keep IPs DB-only).
- Wallets are public addresses, fine to keep.
- The `recent_errors` blob is JS errors from the user's browser in the
  last few minutes; safe to commit.
