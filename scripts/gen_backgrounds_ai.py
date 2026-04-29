#!/usr/bin/env python3
"""
Occupy Mars 캠페인 배경 이미지 — Stability AI SD3 생성기
반사실적 픽셀아트 컨셉이미지 스타일 (32-bit RPG concept art)
"""

import os
import sys
import time
import requests

STABILITY_KEY = 'sk-PTUCPZoj9uysIUFu0spIL2IE3zq4pqv6axxQMBJRdFCudTMe'
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'campaign', 'backgrounds')

BASE_STYLE = (
    "pixel art, 32-bit retro RPG background, semi-realistic pixel art concept art, "
    "atmospheric isometric perspective, dark sci-fi aesthetic, detailed pixel illustration, "
    "game background art, cinematic composition, moody lighting"
)
NEG = (
    "photorealistic, 3D render, CGI, smooth gradients, blurry, out of focus, "
    "anime, cartoon, flat design, low quality, watermark, text, logo, "
    "people in foreground, characters"
)

BACKGROUNDS = {
    # ── 갱도 / 지하 ─────────────────────────────────────────────────────────
    'hellas_zone4_deep_tunnel': (
        "ancient alien ore vein glowing blue in deep mine tunnel on Mars, "
        "30-year-old abandoned mining shaft, crumbling rock walls with cyan mineral crystals, "
        "dim headlamp light, claustrophobic underground atmosphere, rust and rock, "
        + BASE_STYLE
    ),
    'mcc_archive_sublevel': (
        "underground corporate archive sublevel, rows of old file cabinets and server racks, "
        "flickering fluorescent lights casting harsh shadows, dark industrial basement, "
        "confidential documents, cold concrete walls, Mars colony administrative facility, "
        + BASE_STYLE
    ),
    'hellas_zone4_ruins': (
        "abandoned Mars mining ruins from 30 years ago, collapsed mine scaffolding, "
        "weathered industrial equipment half-buried in red Mars dust, "
        "desolate wasteland, crumbling ore processing facility, sunset light through broken windows, "
        + BASE_STYLE
    ),

    # ── MCC 실내 ─────────────────────────────────────────────────────────────
    'mcc_board_chamber': (
        "sealed corporate boardroom in space, circular polished table, "
        "seven empty executive chairs, blue holo-displays on walls, "
        "cold corporate blue lighting, pressurized oxygen chamber, "
        "power and secrecy, MCC megacorporation Mars headquarters, "
        + BASE_STYLE
    ),
    'mcc_executive_floor': (
        "MCC corporation executive floor on Mars, floor-to-ceiling reinforced windows, "
        "red Martian landscape outside, sleek minimalist cold blue interior, "
        "premium corporate lounge maintained at exactly 25 degrees, "
        "power and control, megacorporation aesthetic, "
        + BASE_STYLE
    ),

    # ── 헬라스 마을 ──────────────────────────────────────────────────────────
    'hellas_mining_village': (
        "Mars mining colony village in Hellas Planitia, makeshift habitat modules, "
        "red dust-covered settlement, warm lights in porthole windows, "
        "hardworking miners community, worn but lived-in atmosphere, "
        "industrial prefab buildings under crimson Mars sky, "
        + BASE_STYLE
    ),
    'hellas_mining_village_fire': (
        "Mars mining village at night, barrel fires burning in the colony square, "
        "orange firelight reflecting off dust-covered habitat walls, "
        "workers gathered around flames under starlit Martian sky, "
        "protest atmosphere, strike night, desperate warmth, "
        + BASE_STYLE
    ),
    'hellas_labor_district_night': (
        "Mars industrial labor district at night, factory silhouettes against dark sky, "
        "street lamps casting orange pools of light on dusty ground, "
        "workers quarter, oppressive industrial atmosphere, "
        "MCC corporate towers looming in distance, class divide visible, "
        + BASE_STYLE
    ),

    # ── 올림포스 ─────────────────────────────────────────────────────────────
    'olympus_exterior': (
        "exterior of Olympus Mons on Mars, tallest volcano in solar system, "
        "vast red Martian landscape stretching to horizon, thin atmosphere, "
        "distant stars visible through haze, enormous geological scale, "
        "isolation and power, crimson dust plains below, "
        + BASE_STYLE
    ),
    'olympus_summit_station': (
        "research station at summit of Olympus Mons, glass dome habitat above clouds, "
        "stars and space visible from highest point in solar system, "
        "three faction flags visible through reinforced glass, "
        "political neutrality at extreme altitude, magnificent and cold, "
        + BASE_STYLE
    ),

    # ── FSP ──────────────────────────────────────────────────────────────────
    'fsp_assembly_hall': (
        "FSP community assembly hall on Mars, warm wooden interior with large windows, "
        "circular seating arrangement for democratic decision-making, "
        "Mars landscape visible outside, warm community atmosphere, "
        "handmade decorations, lived-in communal space, freedom spirit, "
        + BASE_STYLE
    ),
    'fsp_base': (
        "FSP Free Settlement Project base on Mars, organic dome architecture, "
        "self-sufficient colony with solar panels and greenhouse modules, "
        "warm community lights, independence from corporate control, "
        "rugged but hopeful frontier settlement, desert survival, "
        + BASE_STYLE
    ),

    # ── CV / 에레보스 ─────────────────────────────────────────────────────────
    'erebus_throne_hall': (
        "Crow Vanguard fortress throne hall in Erebus crater, massive industrial chamber, "
        "flame torches on iron pillars, a weathered mining chair as throne, "
        "mercenary war trophies on walls, dark authoritarian atmosphere, "
        "30-year battle scars on everything, power carved through violence, "
        + BASE_STYLE
    ),
    'erebus_base_interior': (
        "Crow Vanguard military base interior, dark industrial corridors, "
        "combat equipment hanging on metal walls, emergency red lighting, "
        "mercenary aesthetic, weapons and tools, anti-corporate guerrilla base, "
        "bare metal and survival, Erebus crater underground facility, "
        + BASE_STYLE
    ),

    # ── 아르기레 ─────────────────────────────────────────────────────────────
    'argyre_canyon_night': (
        "Argyre canyon on Mars at night, deep red rock canyon walls towering above, "
        "starfield visible between canyon walls, darkness and danger, "
        "ambush territory, ancient geology lit only by starlight, "
        "guerrilla warfare atmosphere, vast scale and isolation, "
        + BASE_STYLE
    ),
    'argyre_plains': (
        "Argyre plains on Mars, vast flat battlefield extending to horizon, "
        "dust storm approaching in distance, orange-red sky, "
        "nowhere to hide, open confrontation territory, "
        "pre-battle tension, military staging ground, Crow Vanguard forces, "
        + BASE_STYLE
    ),

    # ── 샌드스톤 ─────────────────────────────────────────────────────────────
    'sandstone_junction': (
        "Sandstone Junction crossroads on Mars, three-way desert intersection, "
        "weathered signposts in red dust, footprints in sand converging from multiple directions, "
        "meeting point for factions, neutral territory, "
        "Mars desert crossroads, dust and secrecy, "
        + BASE_STYLE
    ),

    # ── 케플러 ───────────────────────────────────────────────────────────────
    'kepler_crater_dawn': (
        "Kepler crater on Mars at dawn, ancient impact crater rim silhouette, "
        "pink and orange dawn sky over crater floor, "
        "scientific research equipment visible on crater floor, "
        "lone researcher territory, 30 years of solitary study, "
        "Ancient Metal ore deposits glinting in dawn light, "
        + BASE_STYLE
    ),

    # ── 조선소 ───────────────────────────────────────────────────────────────
    'new_athens_shipyard': (
        "New Athens shipyard in Mars orbit, massive industrial space dock, "
        "cargo ships being loaded and unloaded, stars and Mars visible, "
        "working class dockworkers, union activity, "
        "arrival point of newcomers to Mars, hope and industrial grit, "
        + BASE_STYLE
    ),

    # ── 중계소 ───────────────────────────────────────────────────────────────
    'hellas_outer_relay': (
        "abandoned relay station in outer Hellas plains on Mars, "
        "small communication tower in red desert, "
        "oil stains and tool marks from recent maintenance, "
        "secret meeting point, isolated industrial outpost, "
        "harsh Mars environment, lone machinery in vast emptiness, "
        + BASE_STYLE
    ),
}

# 캐릭터 초상화 프롬프트도 여기에 포함 (별도 폴더)
CHAR_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'campaign', 'characters')
CHAR_STYLE = (
    "pixel art character portrait, 32-bit RPG bust shot, semi-realistic pixel art, "
    "game concept art character illustration, dark sci-fi Mars setting, "
    "dramatic lighting, detailed pixel shading, head and shoulders view"
)
CHAR_NEG = (
    "photorealistic, 3D render, anime, cartoon, full body, background details, "
    "blurry, watermark, text, chibi, deformed"
)

CHARACTERS = {
    'liang_wei': (
        "Chinese female scientist in her 50s, weathered face from 30 years on Mars, "
        "round wire-frame glasses, practical researcher coat, "
        "intelligent determined eyes, geological sample badge, "
        "30 years of isolation and dedication visible in her face, "
        + CHAR_STYLE
    ),
    'yuna': (
        "young Korean woman age 22, short practical haircut, "
        "FSP colony worker uniform with red patch, "
        "born on Mars her entire life, fierce idealistic expression, "
        "father's grave is here so she will not leave, determined eyes, "
        + CHAR_STYLE
    ),
    'crow': (
        "mercenary fighter in their 30s, tactical breathing mask covering lower face, "
        "reflective tactical goggles, dark Crow Vanguard combat gear, "
        "canyon warrior aesthetic, dangerous and efficient, "
        "raised in Argyre canyons, shadow operative, "
        + CHAR_STYLE
    ),
    'aisha': (
        "Black female warrior age 28, natural hair with tactical band, "
        "Crow Vanguard insignia tattoo on neck, "
        "combat-worn jacket, earring from fallen comrade, "
        "fierce loyal expression, CV code of honor visible in bearing, "
        + CHAR_STYLE
    ),
    'hagar': (
        "elderly man age 75, last generation to remember Earth as Gaia, "
        "deeply weathered face, white stubble beard, "
        "FSP elder rank badge, old but piercing eyes full of memory, "
        "worn colony coat with 40 years of Mars patches, "
        + CHAR_STYLE
    ),
    'kenji': (
        "Japanese man age 35, thin wire-frame rectangular glasses, "
        "nondescript FSP worker uniform deliberately average looking, "
        "5 years no promotion — intelligence work, "
        "quiet watchful eyes that miss nothing, "
        "deliberately blending in but intelligence unmistakable, "
        + CHAR_STYLE
    ),
    'verk': (
        "non-binary navigator age 40, ear communications implant, "
        "Kariope cargo ship navigator uniform with rank patches, "
        "calm observant expression, seen every type of Mars traveler, "
        "practical and professional, space-worn competence, "
        + CHAR_STYLE
    ),
    'observer': (
        "mysterious figure with no faction allegiance, face partially obscured by shadow, "
        "neutral clothing with no insignia, "
        "eyes that observe without judgment, watching and recording everything, "
        "fourth perspective beyond three factions, cosmic watcher, "
        "glowing blue eyes in darkness, "
        + CHAR_STYLE
    ),
    'miner_anon': (
        "anonymous miner with full dust mask covering face, "
        "worn mining suit with ore stains, "
        "protective goggles reflecting light, "
        "identity deliberately hidden, whistleblower aesthetic, "
        "only their clenched gloved hands visible along with mask, "
        + CHAR_STYLE
    ),
    'miner_elder': (
        "elderly male miner age 65, face deeply lined from decades underground, "
        "short grey beard dusty with ore, old mining helmet pushed back, "
        "survivor of the Zone 4 strike 30 years ago, "
        "haunted experienced eyes, mining tools worn as jewelry almost, "
        + CHAR_STYLE
    ),
}


def generate_image_sd3(prompt, negative_prompt, output_path, width=1280, height=720,
                        model="sd3-medium", aspect=None):
    """Stability AI SD3 API로 이미지 생성"""
    url = "https://api.stability.ai/v2beta/stable-image/generate/sd3"
    headers = {
        "Authorization": f"Bearer {STABILITY_KEY}",
        "Accept": "image/*"
    }
    data = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "model": model,
        "output_format": "png",
        "width": width,
        "height": height,
    }
    if aspect:
        data.pop("width", None)
        data.pop("height", None)
        data["aspect_ratio"] = aspect

    for attempt in range(3):
        try:
            resp = requests.post(url, headers=headers, files={"none": ""}, data=data, timeout=120)
            if resp.status_code == 200:
                with open(output_path, "wb") as f:
                    f.write(resp.content)
                return True
            elif resp.status_code == 429:
                wait = 30 * (attempt + 1)
                print(f"    rate limited, wait {wait}s...")
                time.sleep(wait)
            else:
                print(f"    API error {resp.status_code}: {resp.text[:200]}")
                if attempt < 2:
                    time.sleep(10)
        except Exception as e:
            print(f"    exception: {e}")
            if attempt < 2:
                time.sleep(10)
    return False


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(CHAR_DIR, exist_ok=True)

    # 이미 있는 파일은 스킵 (--force 옵션으로 재생성)
    force = "--force" in sys.argv
    skip_chars = "--bg-only" in sys.argv
    skip_bg = "--char-only" in sys.argv

    total_bg = len(BACKGROUNDS)
    total_ch = len(CHARACTERS)
    print(f"배경 {total_bg}개 + 캐릭터 {total_ch}개 생성 (SD3 medium, ~{(total_bg+total_ch)*3.5:.0f} credits)")
    print(f"현재 잔액: 967.6 credits\n")

    # ── 배경 이미지 ────────────────────────────────────────────────────────
    if not skip_bg:
        print("=== 배경 이미지 생성 ===")
        done = 0
        for name, prompt in BACKGROUNDS.items():
            out_path = os.path.join(OUT_DIR, f"{name}.png")
            if os.path.exists(out_path) and not force:
                size = os.path.getsize(out_path)
                # 너무 작으면 (PIL 생성 = ~20KB) 재생성
                if size > 50_000:
                    print(f"  ✓ {name}.png (이미 존재, skip)")
                    done += 1
                    continue
            print(f"  → {name}...", end=" ", flush=True)
            ok = generate_image_sd3(prompt, NEG, out_path, width=1280, height=720)
            if ok:
                size = os.path.getsize(out_path)
                print(f"✓ ({size//1024}KB)")
                done += 1
            else:
                print("✗ 실패")
            time.sleep(2)  # rate limit 방지

        print(f"\n배경 완료: {done}/{total_bg}\n")

    # ── 캐릭터 초상화 ──────────────────────────────────────────────────────
    if not skip_chars:
        print("=== 캐릭터 초상화 생성 ===")
        done = 0
        for name, prompt in CHARACTERS.items():
            out_path = os.path.join(CHAR_DIR, f"{name}.png")
            if os.path.exists(out_path) and not force:
                size = os.path.getsize(out_path)
                if size > 50_000:
                    print(f"  ✓ {name}.png (이미 존재, skip)")
                    done += 1
                    continue
            print(f"  → {name}...", end=" ", flush=True)
            ok = generate_image_sd3(prompt, CHAR_NEG, out_path, width=512, height=768)
            if ok:
                size = os.path.getsize(out_path)
                print(f"✓ ({size//1024}KB)")
                done += 1
            else:
                print("✗ 실패")
            time.sleep(2)

        print(f"\n캐릭터 완료: {done}/{total_ch}")

    print("\n전체 완료.")


if __name__ == "__main__":
    main()
