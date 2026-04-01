# PIXEL WAR — Gemini Asset Creation Brief
## GLOBAL GRID ADV — 1,000,000 PIXELS | Official Sprite Production Spec

**프로젝트:** PIXEL WAR (Web3 Pixel Territory Ad Platform)
**스타일:** High-quality pixel art (game-quality, matching the PWMA/GLOBAL GRID ADV reference sheets)
**배경:** All sprites must have **transparent background (PNG with alpha)**
**렌더링:** Pixel-perfect, nearest-neighbor. No anti-aliasing on pixel edges.
**참고:** 이미 제공된 에셋 시트(GUI, VFX, Unit, Racing 시트)와 완전히 동일한 퀄리티, 동일한 스타일로 제작

---

## 📁 SHEET 1 — MAP UNIT SPRITES (World Map Canvas Layer)

### 1-A. Naval Ships (L2 Sea Layer)
> **스타일 참고:** "Official Pure Interaction & Unit Asset Sheet" Section 5a 참고

| 파일명 | 크기 | 방향 | 설명 |
|--------|------|------|------|
| `ship_cargo_hauler_r.png` | 160×96px | 오른쪽 진행 | Blue/teal container cargo ship. Front mast with small sail. Cargo containers stacked on deck. White wake trail. 참고 시트의 "Cargo Hauler" |
| `ship_cargo_hauler_l.png` | 160×96px | 왼쪽 진행 | 위의 수평 반전 |
| `ship_capital_dreadnought_r.png` | 200×96px | 오른쪽 | Large dark military battleship. Multiple gun turrets. Superstructure/bridge. Dark grey-green hull with red waterline stripe. 참고 시트의 "Capital Dreadnought" |
| `ship_capital_dreadnought_l.png` | 200×96px | 왼쪽 | 위의 수평 반전 |
| `ship_merchant_galleon_r.png` | 128×128px | 오른쪽 | Classic wooden sailing galleon. Brown/oak hull. 2 masts with white/cream sails. Small cargo containers on deck (red/blue). 참고 시트의 "merchant Galleon" |
| `ship_merchant_galleon_l.png` | 128×128px | 왼쪽 | 위의 수평 반전 |

**공통 사항:** 각 함선 하단에 흰색 물결(wake) 포함. 측면 뷰(side view). 이소메트릭 아님.

---

### 1-B. Aircraft (L3 Air Layer)
> **스타일 참고:** "Official Pure Interaction & Unit Asset Sheet" Section 5c 참고

| 파일명 | 크기 | 방향 | 설명 |
|--------|------|------|------|
| `plane_racer_starfighter_r.png` | 120×60px | 오른쪽 | White/blue swept-wing fighter jet. Cockpit canopy in teal/cyan. Two engines at rear. 참고 시트의 "Racer Starfighter" |
| `plane_racer_starfighter_l.png` | 120×60px | 왼쪽 | 위의 수평 반전 |
| `plane_cargo_transport_r.png` | 160×72px | 오른쪽 | Large 4-engine cargo transport plane. Grey/white. Big fuselage. Military style. 참고 시트의 "Cargo Transport" |
| `plane_cargo_transport_l.png` | 160×72px | 왼쪽 | 위의 수평 반전 |

**공통 사항:** 후방에 흰색 contrail 꼬리 포함 (4~6 pixel 두께, 서서히 페이드).

---

### 1-C. Kaiju / Monster Sprites
> **스타일 참고:** "Official GUI Asset Sheet" 하단 카이주 아이콘 + 컨셉아트 참고

| 파일명 | 크기 | 설명 |
|--------|------|------|
| `kaiju_red_weed_crawler.png` | 160×128px | Red crab-like alien creature. Multiple legs/claws. Red tendrils/weed growth around body. On map surface. 참고: "Red Weed Crawler" (컨셉아트의 아프리카/중동 위치 몬스터) |
| `kaiju_kraken.png` | 160×160px | Large teal/green octopus. Round body with big yellow eyes. 8 tentacles spread outward. Emerging from ocean waves. 참고: "Kraken Terror" 스프라이트 |
| `kaiju_alien_walker.png` | 100×160px | Tripod war machine. 3 mechanical legs. Dome/saucer body on top. Dark metallic. Red heat-ray beam optional. 참고: "Alien Walker" 스프라이트 |
| `kaiju_ghidorah.png` | 180×160px | Golden 3-headed dragon. Large wings. Each head with horns. Flying pose. Gold/bronze color. 참고: "Ghidorah Awaken" (컨셉아트) |
| `kaiju_godzilla.png` | 120×200px | Classic Godzilla. Dark olive green. Upright bipedal. Spines on back. Atomic breath (blue beam) optional as separate `godzilla_breath.png`. 참고: "Godzilla" (도쿄 위치, 컨셉아트) |

---

## 📁 SHEET 2 — GAME LOGO & BRANDING

| 파일명 | 크기 | 설명 |
|--------|------|------|
| `logo_pixelwar.png` | 480×160px | **PIXEL WAR 공식 로고.** 참고 시트 "Section 2: Main Title Logo"와 동일하게. Gold/brown decorative frame. "PIXEL WAR" — PIXEL은 파란색 픽셀 폰트, WAR는 금색 큰 폰트. 하단 배너: "1.2x Overwrite Price Reset" in small pixel text. 배경 투명. |
| `logo_pixelwar_small.png` | 200×70px | 위 로고의 축소 버전 (네비게이션 바용) |
| `watermark_bypw.png` | 80×30px | "by PW" 오렌지/골드 픽셀 텍스트 워터마크 (우하단 표시용) |

---

## 📁 SHEET 3 — UI BUTTONS & CONTROLS
> **스타일 참고:** "Official UI & Interaction Asset Sheet" Section 3 참고

### 3-A. DRAG & CLAIM Button (Odometer Panel Style)

| 파일명 | 크기 | 상태 | 설명 |
|--------|------|------|------|
| `btn_drag_claim_static.png` | 120×48px | 기본 | Dark grey pixel button. "DRAG & CLAIM" upper text, "STATIC" lower. Beveled edges pixel style. |
| `btn_drag_claim_hover.png` | 120×48px | 호버 | Brighter. "DRAG & CLAIM" upper, "CLAIM ALL" lower in green. Gold border glow. |
| `btn_drag_claim_active.png` | 120×48px | 활성 | Grey/disabled. "DRAG & CLAIM" upper, "ACTIVE DISABLED" lower in muted green. |

### 3-B. Text Label Buttons

| 파일명 | 크기 | 설명 |
|--------|------|------|
| `btn_claim_all.png` | 96×28px | "CLAIM ALL" dark pixel button |
| `btn_reset_meter.png` | 112×28px | "RESET METER" dark pixel button |

### 3-C. Icon Buttons (24×24px each, all on transparent bg)

| 파일명 | 설명 |
|--------|------|
| `icon_settings.png` | Gear/cog icon |
| `icon_search.png` | Magnifying glass |
| `icon_user.png` | Player/user silhouette |
| `icon_bell.png` | Bell (inactive) |
| `icon_bell_active.png` | Bell (active, gold glow) |
| `icon_link.png` | Chain link / external link |
| `icon_x_close.png` | X close icon |
| `icon_check.png` | Green checkmark |
| `icon_warning.png` | Yellow warning triangle |
| `icon_power.png` | Power/connect icon |
| `icon_back.png` | Blue back/return arrow (pixel style, like Section 1c) |

### 3-D. Connect Wallet Button

| 파일명 | 크기 | 설명 |
|--------|------|------|
| `btn_connect_wallet.png` | 180×40px | Cyan/teal border. "CONNECT WALLET" pixel text. Dark background. Hover: brighter border + inner glow. 참고: Section 1a "CONNECT WALLET" button |
| `btn_connect_wallet_hover.png` | 180×40px | Hover state |

---

## 📁 SHEET 4 — CURRENCY & RESOURCE ICONS
> **스타일 참고:** "Official UI & Interaction Asset Sheet" Section 3 + "Official Pure Interaction Sheet" Section 5b New Icons

| 파일명 | 크기 | 설명 |
|--------|------|------|
| `coin_usdt_clean.png` | 48×48px | Green ₮ USDT token. Round coin. Green circle. White ₮ symbol. 참고 시트의 "Clean" 상태 |
| `coin_usdt_hover.png` | 48×48px | Slightly brighter/glowing |
| `coin_usdt_active.png` | 48×48px | Active state (pressed) |
| `coin_usdt_disabled.png` | 48×48px | Greyed out |
| `coin_pp_clean.png` | 48×48px | Purple PP COIN. Round. "PP" text. Purple circle. 참고 시트의 "PP 코인" |
| `coin_pp_hover.png` | 48×48px | Hover state |
| `coin_pp_active.png` | 48×48px | Active state |
| `coin_pp_disabled.png` | 48×48px | Disabled |
| `coin_bitcoin.png` | 40×40px | Orange Bitcoin coin (픽셀 스타일) |
| `coin_pepe.png` | 40×40px | Green Pepe frog coin |
| `resource_energy_cell.png` | 40×48px | Green battery/energy cell. 참고: "ENERGY CELL" 아이콘 |
| `resource_metal.png` | 40×40px | Metal resource icon |
| `resource_credits.png` | 40×40px | Credits resource icon |

---

## 📁 SHEET 5 — BLOCKCHAIN NETWORK ICONS

| 파일명 | 크기 | 설명 |
|--------|------|------|
| `chain_base_connected.png` | 80×100px | Blue circle with lowercase 'b'. "BASE CHAIN" text below. "● CONNECTED" green dot. 참고: Section 5a |
| `chain_bnb_connected.png` | 80×100px | Gold hexagon with BNB diamond logo. "BNB CHAIN" text. "● CONNECTED" green dot. 참고: Section 5b |

---

## 📁 SHEET 6 — VFX ANIMATION FRAMES
> **포맷:** 각 애니메이션을 가로 스프라이트 스트립으로 제작 (horizontal sprite strip)
> **참고:** "Official Pure VFX Asset Sheet Vol.1" 각 섹션 동일 스타일

### 6-A. Pixel-Fall & Overwrite Effects

| 파일명 | 크기 | 프레임 수 | 설명 |
|--------|------|-----------|------|
| `vfx_gold_overwrite.png` | 768×128px | 6프레임 (각 128×128) | Gold pixel waterfall falling effect. Shimmering gold coins/pixels falling from top. 참고 Section 1a |
| `vfx_gold_landing.png` | 256×64px | 4프레임 (각 64×64) | Gold landing splash burst. 참고 Section 1a "landing" |
| `vfx_neon_blue_capture.png` | 512×160px | 4프레임 (각 128×160) | Neon blue vortex spiral + waterfall. 참고 Section 1b |

### 6-B. Energy Bursts

| 파일명 | 크기 | 프레임 수 | 설명 |
|--------|------|-----------|------|
| `vfx_energy_burst.png` | 576×96px | 6프레임 (각 96×96) | White star → blue explosion → purple nebula cloud sequence. 참고 Section 2a |
| `vfx_solar_flare.png` | 864×96px | 9프레임 (각 96×96) | Orange/gold solar flare burst expanding and fading. 참고 Section 2d |
| `vfx_shield_ripple.png` | 384×96px | 4프레임 (각 96×96) | Cyan shield dome ripple wave. 참고 Section 1b "Shield Ripple" |
| `vfx_beam_impact.png` | 384×96px | 4프레임 (각 96×96) | Cyan beam hitting surface. 참고 Section 1c / 2c |

### 6-C. Environment Effects

| 파일명 | 크기 | 프레임 수 | 설명 |
|--------|------|-----------|------|
| `vfx_water_splash.png` | 480×80px | 6프레임 (각 80×80) | Blue water splash/wake for boats. Different intensities. 참고 Section 3b |
| `vfx_smoke_trail.png` | 480×80px | 6프레임 (각 80×80) | White/grey smoke cloud puffs for planes. 참고 Section 3c |
| `vfx_red_weed_grow.png` | 768×96px | 8프레임 (각 96×96) | Red alien weed/plant growing animation. 참고 Section 3a |

---

## 📁 SHEET 7 — RACING ARENA ASSETS
> **참고:** "Official Pure Pixel War Racing (Sea & Air) Asset Sheet" Section 8 & 9

### 7-A. Track Tiles (128×128px each, isometric-style top-down)

| 파일명 | 설명 |
|--------|------|
| `track_sea_straight_h.png` | Horizontal sea track tile. Dark asphalt/road with yellow dashed center line. Blue ocean sides. White skid marks. |
| `track_sea_straight_v.png` | Vertical sea track tile |
| `track_sea_curve_tl.png` | Top-left curve tile |
| `track_sea_curve_tr.png` | Top-right curve |
| `track_sea_curve_bl.png` | Bottom-left curve |
| `track_sea_curve_br.png` | Bottom-right curve |
| `track_sea_cross.png` | Intersection/cross tile |
| `track_sea_tire_barrier.png` | Tire wall barrier decoration (stacked black tires) |

### 7-B. Air Track Tiles (128×128px, isometric perspective 3/4 view)

| 파일명 | 설명 |
|--------|------|
| `track_air_straight.png` | Elevated air runway straight section |
| `track_air_curve.png` | Elevated runway curve |
| `track_air_gate.png` | Portal arch gate with blue chevron arrow |

### 7-C. Racing Environment Elements

| 파일명 | 크기 | 설명 |
|--------|------|------|
| `track_start_finish_gantry.png` | 240×160px | "GO! / FINISH!" overhead gantry. Metal frame structure. Green LED scoreboard. 참고 Section 9a |
| `traffic_light_static.png` | 48×120px | Traffic light pole (grey, no lights) |
| `traffic_light_prestart.png` | 48×120px | Yellow blinking state |
| `traffic_light_red.png` | 48×120px | Red light (race starting soon) |
| `traffic_light_yellow.png` | 48×120px | Yellow light |
| `traffic_light_green.png` | 48×120px | Green light (GO!) |
| `crowd_spectators_small.png` | 320×80px | Strip of individual pixel spectators (8 characters) waving |
| `crowd_spectators_large.png` | 320×160px | Large crowd group packed together |
| `trackside_billboard_overwrite.png` | 128×80px | "OVERWRITE NOW" LED sign. Orange/red. |
| `trackside_billboard_gain.png` | 128×80px | "1.2x GAIN" LED sign. Green. |
| `trackside_billboard_jackpot.png` | 128×80px | "JACKPOT!" LED sign. Gold/rainbow flash. |
| `trackside_timing_tower.png` | 64×160px | Timing/camera tower |
| `flag_green.png` | 48×64px | Green racing flag (waving) |
| `flag_yellow.png` | 48×64px | Yellow caution flag |
| `flag_checkered.png` | 48×64px | Black & white checkered flag |

---

## 📁 SHEET 8 — HUD & PANEL ELEMENTS
> **참고:** "Official UI & Interaction Asset Sheet" Section 4 Background & Panel Elements

| 파일명 | 크기 | 설명 |
|--------|------|------|
| `hud_bar_bg.png` | 1px×44px (tileable) | Dark bottom HUD bar background texture. Very dark navy with subtle pixel noise. Tileable horizontally. |
| `hud_number_slot.png` | 80×32px | Dark recessed number display box. Dark inner, thin border. Like a 7-segment display slot. 참고 Section 4a "Number slots" |
| `hud_divider.png` | 2×32px | Vertical divider line between HUD cells |
| `hud_odometer_frame.png` | 140×40px | Odometer section frame. "Odometer" label. Dark box. |
| `panel_data_field.png` | 300×80px | Dark blue data field frame. Thin pixel border. 참고 Section 4 "q. DATA FIELD FRAME" |
| `panel_dialogue.png` | 400×120px | Ornate gold dialogue box frame. Decorative corners. 참고 Section 4 "r. DIALOGUE BOX FRAME" |

---

## 📁 SHEET 9 — SPECIAL CURSORS
> **참고:** "Official UI & Interaction Asset Sheet" Section 4 Special Cursors

| 파일명 | 크기 | 설명 |
|--------|------|------|
| `cursor_default.png` | 32×32px | Default pixel arrow cursor |
| `cursor_drag.png` | 32×32px | 4-direction drag cursor (+ arrows) |
| `cursor_hand.png` | 32×32px | Pointer hand cursor |
| `cursor_drag_claim.png` | 48×48px | DRAG & CLAIM mode: hand cursor + USDT coin badge |
| `cursor_odometer_reset.png` | 48×48px | Odometer reset: hand cursor + reset icon badge |
| `cursor_arena_betting.png` | 48×48px | Arena betting: arrow cursor + PP coin badge |
| `cursor_disabled.png` | 32×32px | Disabled/forbidden cursor |

---

## 📁 SHEET 10 — PLAYER PROFILE UI (모바일 포함)
> **참고:** "Official UI Component Sheet" Section 2g Player Profile

| 파일명 | 크기 | 설명 |
|--------|------|------|
| `ui_player_profile_frame.png` | 200×80px | Player card frame. Gold circular portrait border. LV badge. HP/MP/XP bar frames. 참고 Section 2g |
| `ui_avatar_default.png` | 64×64px | Default pixel art character portrait (grey-haired character from reference) |
| `ui_bar_hp.png` | 100×10px | Red HP progress bar (full) |
| `ui_bar_mp.png` | 100×10px | Blue MP bar |
| `ui_bar_xp.png` | 100×10px | Yellow XP bar |

---

## 📁 SHEET 11 — MAP DECORATIONS

| 파일명 | 크기 | 설명 |
|--------|------|------|
| `map_city_pin.png` | 16×20px | Small city location pin/dot marker |
| `map_fire_explosion.png` | 64×64px | Pixel art fire/explosion effect (for Berlin-style attack markers) |
| `map_lightning_bolt.png` | 32×64px | Lightning bolt (for Ghidorah area) |

---

## 🎨 전체 스타일 가이드 (Gemini 제작 지침)

```
PIXEL ART SPEC:
- Style: High-quality pixel art (same quality as PWMA/Global Grid ADV reference sheets)
- Rendering: Pixel-perfect. No anti-aliasing. Sharp pixel edges.
- Background: Transparent PNG (alpha channel)
- Color depth: Full color (no palette restriction)
- Minimum unit: 2×2px blocks for fine detail areas
- Outline: Dark 1-2px outline on most sprites for map readability
- Shadow: Optional drop shadow (2px dark, 45° offset) on map units
- Resolution: As specified per file above

TONE & PALETTE:
- Ships: Rich nautical colors (deep navy hulls, rust-red waterlines, bright containers)
- Kaiju: Saturated, dramatic colors with dark outlines
- UI: Dark backgrounds (#0A0E1A), cyan/teal accents (#4AC8FF), gold (#FFD700)
- VFX: High contrast on dark bg, neon blues/golds/purples
- Racing: Dark track with yellow lines, bright neon trackside elements

NAMING: snake_case, all lowercase, no spaces
FORMAT: PNG with alpha transparency
OUTPUT: Individual files as listed above
```

---

## 📊 우선순위 (제작 순서)

**Phase 1 — 즉시 필요 (index.html, app.html 핵심)**
1. `logo_pixelwar.png` ← 가장 중요
2. `ship_merchant_galleon_r.png` + `_l.png`
3. `ship_cargo_hauler_r.png` + `_l.png`
4. `ship_capital_dreadnought_r.png` + `_l.png`
5. `plane_racer_starfighter_r.png` + `_l.png`
6. `kaiju_kraken.png`
7. `kaiju_red_weed_crawler.png`
8. `kaiju_alien_walker.png`
9. `coin_usdt_clean.png` + `coin_pp_clean.png`
10. `chain_base_connected.png` + `chain_bnb_connected.png`

**Phase 2 — HUD & UI**
11. `hud_number_slot.png`
12. `btn_drag_claim_static.png` + hover
13. `btn_connect_wallet.png`
14. All icon buttons (sheet 3-C)

**Phase 3 — VFX**
15. `vfx_gold_overwrite.png`
16. `vfx_water_splash.png`
17. `vfx_smoke_trail.png`

**Phase 4 — Arena**
18. Track tiles (all)
19. `track_start_finish_gantry.png`
20. Traffic lights, flags, crowds, billboards

---

## 📂 파일 배치 (저장 위치)
완성된 PNG 파일은 모두 아래 폴더에 저장:
```
/블록체인 유저참여용 프로젝트/assets/
  /sprites/        ← ships, planes, kaiju
  /ui/             ← buttons, icons, frames
  /vfx/            ← animation strips
  /racing/         ← track tiles, environment
  /hud/            ← HUD elements
  /logo/           ← PIXEL WAR logo variants
```

HTML 코드에서 참조 경로: `./assets/sprites/ship_cargo_hauler_r.png`

**총 파일 수: 약 120개**
**Phase 1 우선 제작: 20개**
