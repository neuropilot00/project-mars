Ship images for shipyard UI.

Naming convention (priority order — first match wins):
  1. {ship_code}.png         — most specific (e.g., cv_titan.png, mcc_int.png)
  2. {faction}_{size}.png    — fallback by class (e.g., cv_frigate.png)

Specs:
  - Recommended: 256x160 PNG, transparent background
  - Style: bold silhouette, faction accent color visible
  - Faction palettes:
      mcc → cyan/blue   (#5cbbff)
      fsp → green/teal  (#52e3a4)
      cv  → orange/red  (#ff9d3d)

Behavior:
  - If PNG missing, the inline SVG silhouette renders automatically (no broken image).
  - Files only need to be added when ready; no code change required.

Ship codes (22 total):
  MCC: mcc_int, mcc_frg, mcc_bomb, mcc_dst, mcc_crs, mcc_bs, mcc_titan
  FSP: fsp_int, fsp_frg, fsp_bomb, fsp_dst, fsp_crs, fsp_bs, fsp_titan
  CV : cv_int,  cv_frg,  cv_bomb,  cv_dst,  cv_crs,  cv_bs,  cv_titan
  + sector_npc variants (see ship_types table)
