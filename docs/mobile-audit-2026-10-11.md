# Mobile follow-up — 2026-10-11

The original realistic art, bronze theme, and painted five-button main navigation remain unchanged.

## Implemented

- Fleet command: let the scroll region shrink within short screens; wrap long fleet names and actions; enlarge mobile tactical controls to 44px.
- Fleet name dialog: remove the 300px minimum that exceeds the available card space at 320px.
- Assembly: account for top, bottom, and side safe-area insets when sizing the panel.
- Mobile map: retain a trailing texture upload instead of dropping the last preview or ownership update; keep full-quality priority and suspend scheduled work while hidden.
- Image editor: only consume gestures started on its canvas; reset dragging on touch cancellation and page hiding.
- Allow browser zoom. Defer the ten hidden Base banner images using native lazy loading and asynchronous decoding, preserving all artwork.
- Version changed client assets and service-worker cache as `mobile26`.

## Verified

Five focused suites passed: `mobile_interaction_regression`, `core_navigation_ui_regression`, `retention_ui_regression`, `loader_audio_regression`, and `map_systems_regression`. Changed JavaScript syntax and `git diff --check` passed. These are Node/VM checks, not physical-device evidence.

Before editing, the authenticated local fleet screen was rendered and inspected at the browser's measured 384 × 723 viewport. A requested 320 × 568 override did not take effect, so it is not counted as a 320px test. Subsequent browser connections timed out, including a clean tool reset. Post-change screenshots, shop/item/fusion scrolling, long-name rendering, landscape, keyboard, browser zoom, and real notch behavior remain unverified in this follow-up.

## Remaining acceptance checks

1. Render and scroll map/chat, Base, shop, inventory, fleet, workshop/fusion, campaign and battle at 320px, 390px and short landscape widths. Confirm bottom controls are reachable and original painted navigation remains intact.
2. Test input with the actual iOS/Android keyboard, notch insets and browser toolbar; verify magnification and foreground/background transitions.
3. Measure cold-cache transfer and GPU/frame timing on representative phones. Lazy image attributes do not prove a measured speedup; rendering beneath opaque command overlays remains a separate performance follow-up.

Deployment and HTTP/asset checks are recorded separately in the workspace mobile review report. Passing those does not complete the mobile acceptance checks above.
