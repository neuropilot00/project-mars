# Story popup local repair — 2026-10-21

## Scope and result

Changes are confined to the lore functions in `assets/main-game.js`, lore styles in `assets/main.css`, and the isolated regression `server/tests/lore-ui.test.js`. The parent integration owns the title button/dialog markup in `index.html`. The existing era/title/body translations, server-provided crawl HTML, 120-star field, colored typography, intro/title animation and perspective crawl remain. No new art, dependencies, remote calls, server, production action or external account was used for this verification.

The finale now has the stable `.lore-finale` class. Open and close both remove any matching finale, including on repeated opens. Finale creation is idempotent. Completion follows the `animationend` event for `#loreCrawl` with animation name `loreCrawl`, rather than the prior 55-second timer truncating a 60-second crawl with an 8-second delay. Early skip detaches the completion listener. The finale keeps server story labels when available and creates its label nodes with `textContent`.

Opening saves focus, sets background sibling branches inert without changing pre-existing inert attributes, and focuses the visible skip button. Tab/Shift+Tab stay in the story; programmatic escaped focus returns inside. Escape is handled in document capture and stopped before the game's bubble handlers can close an underlying modal. Close removes only story listeners and the inert attributes it added, preserves previously inert backgrounds, and restores connected, non-inert opening focus.

The OS reduced-motion preference selects `.lore-static`, including preference changes while open. It disables story animations and shows the complete era/title/body as a scrollable reading view with a fixed exit; it never advances automatically to the finale. Mobile title/finale sizes and tracking scale with viewport width; text can wrap. Skip/enter controls have minimum 44px height and skip supports the bottom safe area. The animated perspective crawl's geometry and text are retained.

## Required integrated markup

- The existing `data-action="showLorePopup"` title becomes a native `button type="button"`, preserving `tb-title` and adding `lore-trigger`, `aria-haspopup="dialog"`, and `aria-controls="loreBg"`.
- `#loreBg` gets `role="dialog" aria-modal="true" aria-labelledby="loreBigTitle" tabindex="-1"`.
- `#loreStars` gets `aria-hidden="true"`.
- `#loreSkipBtn` gets `type="button"`.

## Verification actually executed

- `node --check assets/main-game.js` — passed with Node v22.22.3.
- `node --test server/tests/lore-ui.test.js` — 7 tests passed, 0 failed, 0 skipped.
- VM tests execute only the extracted production lore functions with an explicit DOM double. They cover 4 natural-end/close/reopen cycles; repeated-open cleanup and no listener accumulation; existing inert preservation; focus restore, Tab/Shift+Tab, escaped focus and Escape propagation; unrelated animation rejection; early-skip listener cleanup; initial/live reduced-motion selection, including after the finale; and server-label continuity. No timer functions or networking are provided to the VM.

These checks establish control flow with the DOM double. They do **not** establish real CSS completion/timing, title clipping, browser focus/inert behavior, assistive-technology behavior, OS motion emulation, physical-phone scrolling/touch targets, or full-game integration. Those require the parent's integrated browser checks. No production or external server/browser test was executed by this repair worker.

## Parent browser check hooks

Use the actual integrated local page. `showLorePopup()` opens; `closeLorePopup()` closes. Inspect `.lore-finale` count after close/reopen. The normal completion is the real CSS `loreCrawl` animation ending at approximately 68 seconds, which should create one finale and focus `.lore-enter`. For an accelerated wiring check only, dispatch `new AnimationEvent('animationend', {animationName:'loreCrawl', bubbles:true})` on `#loreCrawl`; do not count that as natural-timing evidence.

At 360×480 and 390×560, check initial title and finale bounds at the actual visible animation stages, skip/enter rectangles (at least 44px height), native title Enter/Space, repeated Tab/Shift+Tab, Escape, opening-focus restore, and preservation of a pre-existing inert background/underlying modal. With motion reduction selected before open, verify `.lore-static`, complete body scrolling and persistent exit; also toggle while open. Keep screen-reader and physical-phone validation distinct from desktop browser results.

## Parent integrated browser result — 2026-10-21

Actual Chrome at 360×480 executed the original 68-second CSS crawl through its natural finale, then close/reopen. The finale count returned to zero, the story body reappeared, focus returned to the title, and added inert attributes were removed. Enter/Space, Tab and Escape were checked on the integrated local fixture. No accelerated animation event was used for the natural-completion result. OS reduced-motion and physical-phone behavior remain unverified. Evidence: `outputs/evidence/totp-integration-20261021/story-finale-360.jpg` in the parent workspace.

## User-requested palette correction

After the user rejected the yellow finale, the lore-only palette was changed: title/highlights are ivory (`#F4EEE8`), story body uses the existing off-white `--tx`, era/chapter/tagline are muted cool neutral (`#A5AFBB`), and exits use a dark copper fill with one fine copper border. Keyboard focus remains a distinct 2px copper outline. The title's yellow glow was removed, and the existing button pulse now has only a faint 6px copper shadow. Optional crew-summary controls also use copper rather than global gold. No global theme variables, story text/art, layout, animation duration, or JS behavior changed in this palette correction.

The browser fixture's gold/Mars/button color overrides were removed so `/story.html` uses the current production stylesheet palette. It retains the local system-font stub. The endpoint currently needs no query parameters; use the active fixture loopback port followed by `/story.html` (a cache-busting query is optional).

Palette follow-up validation: `node --test server/tests/lore-ui.test.js` passed **10/10** (including the parent's later crew-chatter cases); `git diff --check -- assets/main.css server/tests/browser-fixture.cjs` passed. These are behavior/source checks; the parent performs the requested visual browser verification.


## 부모 최종 색상 검수 — 2026-10-21

실제 로컬 HTTP fixture에서 제품 CSS와 원래 스토리 JS를 사용해 360×480으로 열고, 68초 자연 종료 후 피날레를 확인했다. 제목 rgb(244,238,232), 문구 rgb(165,175,187), 구리색 1px 테두리·44px 진입 버튼, 문서 폭360/viewport360으로 가로 넘침 없음. 별/원래 스토리 보존. 키보드 초점 표시를 확인하고 진입 클릭 후 overlay 종료와 원래 타이틀 버튼 초점 복귀를 확인했다. 고정 로컬 텍스트·실제 CSS/UI 동작 검수이며 운영/실기기 플레이 증거와 구분한다.
