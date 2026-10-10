# Occupy Mars art direction

New game artwork must match the existing realistic science-fiction campaign and ship art: physically lit metal hulls, detailed Mars geology, restrained engine light. Do not introduce pixel art, cartoon planets, decorative Saturn-like rings, or a separate visual language for the app icon.

The first candidate pixel icon was rejected by the user and is not referenced or shipped. Existing 32 ship designs and cinematic recruit cards are reused; this change does not claim 32 newly generated cards or replacement of every legacy battlefield.

## Installed assets

- `assets/pwa/occupy-mars-icon-realistic.png`: manifest and Apple touch icon. Actual output size 1254 × 1254, opaque.
- `assets/textures/battlefields/mars_garrison_realistic.png`: garrison background in the battle viewer and tactical lab. Original garrison background remains as source history.

Generated with the built-in image_gen tool. Project copies are self-contained; generation originals remain in Codex generated_images. Requested 1024 × 1024 was produced at 1254 × 1254, and the manifest declares the actual dimensions.

## Icon prompt

Use case: style-transfer. Replace the first image, the current unsuitable pixel-art PWA game app icon, with a photorealistic cinematic hard-science-fiction icon matching this game's established art direction. Image 2 is the approved game style reference: realistic rust-red Mars with natural geological detail, black space, physically lit industrial metal spaceship. Image 3 is the approved existing ship silhouette/material reference. A single square installable mobile-game icon, full bleed; realistically rendered Mars fills most of the frame, one recognizable dark-metal combat frigate in the foreground, restrained cool blue engines and natural warm sunlight. Readable at small size. Remove pixel art, cartoon dome colony, exaggerated stars, Saturn-like and decorative orbital rings. No cartoon, voxel, low-poly, graphic illustration, text, logo, border or watermark. Opaque black-space background.

References: former icon (rejected), `assets/campaign/backgrounds/deep_space_mars_approach.png`, `assets/ships/mcc_frg.png`.

## Garrison prompt

Use case: style-transfer. Edit the old abstract overhead garrison battlefield, replacing schematic/checkerboard materials with photorealistic physically lit Mars surface terrain. Use the realistic campaign Mars geology and serious cinematic SF materials reference. Single square top-down orthographic battlefield, camera vertically above. Preserve broad arrangement: rust-red cratered terrain, industrial garrison roofs and access roads across middle/right, larger open areas top-left and bottom-left for flying combat overlays. Plausible gunmetal roofs, dusty roads, worn rocky craters, low-relief shadows; subdued medium-dark red-brown, readable and not visually noisy. No units, ships, text, UI, gridlines, abstract/teal circles, checkerboard, cartoon, pixel art, isometric camera, horizon or atmospheric perspective.

References: `assets/textures/battlefields/mars_garrison_topdown.png`, `assets/campaign/backgrounds/deep_space_mars_approach.png`.
