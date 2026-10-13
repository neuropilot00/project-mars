# Image sizing release — v7.488

Original realistic art and painted main navigation remain intact. This patch changes display geometry and sprite loading, not game rules or asset artwork.

## Asset inventory

483 tracked raster files: 737,540,418 bytes, all decode/integrity checks pass. Includes originals, historical/source assets and three tracked tmp images; this is not a page download total. Inventory records dimensions, bytes, aspect ratios, alpha bounds, direct source references and theoretical DPR ceilings per file.

ItemArt maps148 codes to88 unique files, all present. Main classes:22 standard reveal images800×600;10 assembled portraits1024×1024;50 assembly parts1024×1024; item atlas4×1254×1254; battlefield atlas4×1254×1254. Campaign184 backgrounds and51 character files are inventoried. Source artwork is retained.

## Corrected display contracts

- Direct collectible art uses contain; standard reveal frames use4:3, assembly collection1:1. Square ship previews now show the complete4:3 source.
- All64 item-atlas cells are clipped before fitting into arbitrary rectangular slots. Standard cells313.5×313.5; cosmetics retain measured columns[0,314,628,942,1254] and rows[0,302,580,858,1196]. No neighbouring cell included.
- Assembly preview/result use contain in both mobile and desktop columns. Existing scroll and caption layout remains.
- Battlefield DOM thumbnails clip16 square cells with SVG, preserving each cell's proportions in landscape slots. Standalone images fit directly into the slot. Canvas sourceRect remains unchanged.
- Campaign detail cutins use stage-relative width; at844×390 the story stage is193.05px wide. The previous370px cutin exceeded it. Intentional full-screen cinematic backgrounds retain cover.
- Tactical sprite registry includes all32 actual ship types, fixing missing tempest and4alien sprites. Standard22 preload;10large assembled sprites load once when drawn, preserving ready/error fallback and trimming. Initial source-byte sum7,306,564→1,677,053. This does not measure cold-network transfer, frame rate or device heat.

## Verification

Commands: node server/tools/item_art_sizing_regression.js; battlefield_thumbnail_regression.js; tactical_sprite_registry_regression.js; objective_mastery_ui_regression.js; mobile_interaction_regression.js; connected_feature_ui_regression.js; core_navigation_ui_regression.js. All7PASS. node tools/sea-i18n.js check:2624/2624, English leak0, token mismatch0. Changed JS syntax and tactical inline script parse PASS.

Local Chrome actual game: shop390/320 (all12 cosmetics88×88), assembly collection390 (166×166), assembly preview320/390/844 (full original inside contain), campaign320/844, objective operation thumbnails390, tactical practice390 and main menu390. No horizontal document overflow in measured views; no browser error in tactical flow. No real currency spent.

A separate local gallery invokes actual ItemArt/BattlefieldArt renderers:148codes×4sizes at320/390/1024 =1776frames. All frames within viewport; all direct images complete with nonzero natural dimensions; no mismatched object-fit. Atlas and source-coordinate checks cover all64items/16battlefields. Ship/part/contact-sheet screenshots supplement geometry. Gallery is a QA artifact, not an additional game feature.

Gacha reveal/market and fusion result sizing are source-reviewed and share tested aspect/contain primitives; this run did not perform a new paid draw or successful fusion to trigger those receipt screens. Physical iOS/Android tests and200real players remain outside this evidence. Standard320px tactical sources are retained; no upscaled source is presented as new high-resolution art.

Detailed native inventory, browser measurements, screenshots and logs live in the review board's evidence/image-sizing-20261013 directory. Release verification must confirm the deployed commit and public asset hashes after push.
