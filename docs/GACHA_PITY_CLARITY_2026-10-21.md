# Perfect-part gacha pity disclosure — 2026-10-21

Source findings: `server/services/assembly.js` `pullBox` chooses one random unowned part only while unowned parts remain, and resets the counter whenever a new part drops. It does not guarantee a completed unit. `assemble` separately checks all required parts, then the unit's assembly GP cost. `boxState` exposes the counter and pool size, not the player's missing-part count.

The existing card now explains that exact conditional one-part guarantee, the counter reset, and the separate all-parts-plus-assembly-GP requirement directly before the pull buttons. Both new strings have seven inline translations. No missing count or assembly price is invented. Existing artwork, pity numbers, pull buttons, total prices and policies are preserved. Only `assets/shipyard-modal.js` and `server/tests/gacha-pity-clarity.test.js` are changed by this slice; no server mechanics or generated translation file was edited.

Validation: the actual `_perfectGachaBoxHtml` renderer executes in an isolated VM for all seven languages, disclosure placement, unchanged prices/counts/banner, refreshed counter and existing disabled loading/login/error controls. **10/10 passed** with no skips. `node --check assets/shipyard-modal.js` and `git diff --check` passed. Command:

```sh
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/usr/bin:/bin NODE_ENV=test node --require ./server/tests/isolation-guard.cjs --test server/tests/gacha-pity-clarity.test.js
```

No browser, real gacha pull, DB, account, payment, deployment or external service was used. Parent owns final browser verification and generated SEA integration. Existing mobile-play QA evidence is unchanged.
