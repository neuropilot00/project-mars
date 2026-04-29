#!/usr/bin/env python3
"""
Occupy Mars — Gemini Imagen 3 에셋 생성기
반사실적 픽셀아트 컨셉이미지 (32-bit RPG concept art, Mars sci-fi)
GCP Application Default Credentials 사용
"""

import os
import sys
import time

from google import genai
from google.genai import types

PROJECT = 'gen-lang-client-0351298739'
LOCATION = 'us-central1'

OUT_BG = os.path.join(os.path.dirname(__file__), '..', 'assets', 'campaign', 'backgrounds')
OUT_CH = os.path.join(os.path.dirname(__file__), '..', 'assets', 'campaign', 'characters')

client = genai.Client(vertexai=True, project=PROJECT, location=LOCATION)

# ── 공통 스타일 프롬프트 ────────────────────────────────────────────────────

BG_STYLE = (
    "32-bit pixel art game background, semi-realistic pixel art concept art, "
    "retro RPG atmospheric scene, detailed pixel illustration, "
    "dark moody sci-fi aesthetic, cinematic game background, "
    "Mars colony setting, red planet atmosphere"
)

CH_STYLE = (
    "pixel art character portrait bust, 32-bit RPG character art, "
    "semi-realistic pixel art, head and shoulders composition, "
    "dramatic lighting, detailed pixel shading, "
    "dark Mars sci-fi setting, game concept art"
)

# ── 배경 이미지 프롬프트 ────────────────────────────────────────────────────

BACKGROUNDS = {
    'hellas_zone4_deep_tunnel': (
        "deep abandoned mine tunnel on Mars, ancient alien ore veins glowing faint cyan blue "
        "in crumbling rock walls, 30-year-old mining shaft, claustrophobic darkness, "
        "rusty support beams barely holding, mineral crystals catching dim headlamp light, "
        "discovery of ancient extraterrestrial metal, " + BG_STYLE
    ),
    'mcc_board_chamber': (
        "sealed corporate boardroom floating above Mars, circular obsidian table, "
        "seven high-back chairs in cold blue holographic light, "
        "pressurized private oxygen supply, no windows, absolute secrecy, "
        "MCC megacorporation power chamber, cold authoritarian blue palette, " + BG_STYLE
    ),
    'mcc_executive_floor': (
        "MCC corporation executive penthouse floor on Mars, floor-to-ceiling armored windows "
        "revealing crimson Martian landscape and distant dust storms, "
        "minimalist cold corporate interior maintained at exactly 25 degrees Celsius, "
        "sleek sterile luxury, power and control aesthetic, " + BG_STYLE
    ),
    'mcc_archive_sublevel': (
        "underground MCC corporate archive sublevel 4, "
        "endless rows of filing cabinets and old server racks, "
        "flickering fluorescent tube lights, damp concrete floor, "
        "classified files covering decades of Mars operations, "
        "oppressive underground bureaucratic space, " + BG_STYLE
    ),
    'hellas_mining_village': (
        "Mars mining colony village in Hellas Planitia basin, "
        "prefab habitat modules with warm yellow lights in porthole windows, "
        "red dust covering every surface, improvised community square, "
        "hardworking miner settlement under deep crimson sky, "
        "20 years established in a supposed temporary location, " + BG_STYLE
    ),
    'hellas_mining_village_fire': (
        "Mars mining village at night during strike, "
        "barrel fires burning in the colony square, "
        "orange firelight reflecting off pressurized habitat walls, "
        "workers gathered against the cold darkness, "
        "protest and solidarity under the Martian stars, "
        "desperation and community warmth, " + BG_STYLE
    ),
    'hellas_labor_district_night': (
        "MCC-controlled labor district on Mars at night, "
        "factory and processing plant silhouettes against dark purple sky, "
        "dim street lamps casting orange circles on dusty ground, "
        "workers quarters, oppressive corporate industrial atmosphere, "
        "class divide made physical in architecture, " + BG_STYLE
    ),
    'olympus_exterior': (
        "exterior view of Olympus Mons caldera on Mars, "
        "tallest volcano in the solar system, vast scale overwhelming, "
        "thin reddish atmosphere and distant stars visible, "
        "crimson dust plains stretching to horizon far below, "
        "awe-inspiring geological formation, political neutral ground, " + BG_STYLE
    ),
    'olympus_summit_station': (
        "research and diplomatic station at Olympus Mons summit, "
        "reinforced glass dome habitat at highest point in solar system, "
        "space and stars visible above thin clouds, "
        "three faction flags barely visible through reinforced windows, "
        "ultimate political neutrality, breathtaking and cold, " + BG_STYLE
    ),
    'fsp_assembly_hall': (
        "FSP Free Settlement community assembly hall, "
        "warm wooden interior with large panoramic windows showing Mars landscape, "
        "circular democratic seating arrangement, hand-painted murals on walls, "
        "community crafted furniture, lived-in warmth, "
        "gathering place for free settlers, freedom and solidarity, " + BG_STYLE
    ),
    'fsp_base': (
        "FSP Free Settlement base on Mars surface, "
        "organic curved dome habitat architecture, solar panels and greenhouse modules, "
        "community garden with red soil patches, "
        "warm amber lights from windows, self-sufficient and independent, "
        "hope and determination in the Martian desert, " + BG_STYLE
    ),
    'erebus_throne_hall': (
        "Crow Vanguard fortress throne room in Erebus crater, "
        "massive industrial chamber carved from volcanic rock, "
        "iron pillars with burning flame torches, "
        "a battered mining chair serving as throne, "
        "mercenary war trophies and faction banners on walls, "
        "raw power earned through 30 years of survival, " + BG_STYLE
    ),
    'erebus_base_interior': (
        "Crow Vanguard guerrilla base interior, dark industrial corridors, "
        "combat equipment and tools hanging on bare metal walls, "
        "emergency red lighting, anti-corporate mercenary aesthetic, "
        "weapons and survival gear, underground fortress feel, "
        "Erebus crater volcanic rock walls, " + BG_STYLE
    ),
    'argyre_canyon_night': (
        "Argyre Planitia canyon on Mars at night, "
        "massive red rock canyon walls towering hundreds of meters above, "
        "narrow starfield visible between sheer cliff faces, "
        "darkness broken only by starlight, ambush territory, "
        "guerrilla warfare landscape, ancient geological drama, " + BG_STYLE
    ),
    'argyre_plains': (
        "Argyre plains on Mars before battle, "
        "vast flat red terrain stretching to distant horizon, "
        "approaching dust storm darkening the sky, "
        "nowhere to hide in this exposed confrontation ground, "
        "pre-battle military tension, Crow Vanguard staging area, " + BG_STYLE
    ),
    'sandstone_junction': (
        "Sandstone Junction crossroads in Mars desert, "
        "three-way intersection of dusty red paths, weathered signposts, "
        "footprints in orange sand converging from multiple directions, "
        "neutral meeting point for all three factions, "
        "secrets exchanged here, dust and shadows, " + BG_STYLE
    ),
    'kepler_crater_dawn': (
        "Kepler crater on Mars at dawn, "
        "ancient impact crater rim silhouette against pink-orange sunrise sky, "
        "scientific research equipment scattered on crater floor, "
        "30 years of solo research visible in worn equipment, "
        "ancient extraterrestrial mineral deposits glinting in first light, " + BG_STYLE
    ),
    'new_athens_shipyard': (
        "New Athens shipyard in Mars low orbit, "
        "massive industrial space docking facility, "
        "cargo ships being loaded with supplies, stars and red Mars below, "
        "arrival point for newcomers to Mars, "
        "working class dockworkers and union activity, hope and grit, " + BG_STYLE
    ),
    'hellas_outer_relay': (
        "isolated communication relay station on outer Hellas plains, "
        "small antenna tower in the vast red Mars desert, "
        "oil stains and recent tool marks on equipment, "
        "secret meeting point far from corporate surveillance, "
        "lone machinery standing against empty horizon, " + BG_STYLE
    ),
    'hellas_zone4_ruins': (
        "abandoned Zone 4 mining facility ruins on Mars, "
        "30-year-old collapsed scaffolding and rusted ore processors, "
        "weathered industrial wreckage half-buried in red dust, "
        "names scratched in the remaining walls, "
        "memorial to strike victims, desolate history made physical, " + BG_STYLE
    ),
}

# ── 캐릭터 초상화 프롬프트 ──────────────────────────────────────────────────

CHARACTERS = {
    'liang_wei': (
        "Chinese female scientist aged 55, weathered wise face from 30 years alone on Mars, "
        "round wire-frame glasses, practical geology fieldwork coat, "
        "intelligent determined eyes that have seen the truth, "
        "ancient metal ore sample tucked in collar, " + CH_STYLE
    ),
    'yuna': (
        "young Korean woman aged 22, short practical black hair, "
        "FSP colony worker uniform with red solidarity patch, "
        "born on Mars her entire life, fierce idealistic expression, "
        "will never leave because her father is buried here, determined set jaw, " + CH_STYLE
    ),
    'crow': (
        "mercenary operative in their 30s, tactical dust mask covering lower face, "
        "reflective tactical visor goggles, dark worn Crow Vanguard combat gear, "
        "canyon-raised warrior, dangerous and efficient, shadow operative aesthetic, " + CH_STYLE
    ),
    'aisha': (
        "Black female warrior aged 28, natural hair with tactical band, "
        "Crow Vanguard code tattoo visible on neck, "
        "battle-worn jacket, memorial earring, "
        "fierce loyal expression, CV code of honor in her bearing, " + CH_STYLE
    ),
    'hagar': (
        "elderly man aged 75, last generation that remembers Earth as Gaia, "
        "deeply lined weathered face, white beard dusted with Mars red, "
        "FSP elder insignia, old haunted eyes full of irreplaceable memory, "
        "worn colony coat accumulated with 40 years of Mars patches, " + CH_STYLE
    ),
    'kenji': (
        "Japanese man aged 35, thin rectangular wire-frame glasses, "
        "deliberately nondescript FSP worker appearance blending in, "
        "5 years no promotion due to intelligence work, "
        "quiet watchful eyes that record everything, intelligence beneath plainness, " + CH_STYLE
    ),
    'verk': (
        "androgynous navigator aged 40, ear comm implant, "
        "Kariope cargo ship navigator uniform with worn rank patches, "
        "calm professional expression of someone who has seen everything, "
        "neutral competence, space-worn efficiency, " + CH_STYLE
    ),
    'observer': (
        "mysterious figure with no faction allegiance, face half-obscured by shadow, "
        "neutral clothing with zero insignia or markers, "
        "eyes that observe without judgment or bias, "
        "fourth perspective beyond three factions, "
        "faint blue glow in the eyes like recording everything, " + CH_STYLE
    ),
    'miner_anon': (
        "anonymous miner with full dust respirator mask covering entire face, "
        "worn mining pressure suit with ore stains and repair patches, "
        "protective visor goggles, identity completely hidden, "
        "whistleblower with evidence, hands showing tension, " + CH_STYLE
    ),
    'miner_elder': (
        "elderly male miner aged 65, face deeply carved by decades underground, "
        "short grey beard reddened with ore dust, old mining helmet pushed back, "
        "survivor of the Hellas Zone 4 strike 30 years ago, "
        "haunted eyes carrying the weight of dead comrades, " + CH_STYLE
    ),
}


def generate(prompt, out_path, aspect='16:9'):
    """Imagen 3으로 이미지 생성"""
    for attempt in range(3):
        try:
            response = client.models.generate_images(
                model='imagen-3.0-generate-001',
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio=aspect,
                    safety_filter_level='block_only_high',
                    person_generation='allow_adult',
                )
            )
            if response.generated_images:
                img_bytes = response.generated_images[0].image.image_bytes
                with open(out_path, 'wb') as f:
                    f.write(img_bytes)
                return True
            else:
                print(f"    응답 비어있음")
                return False
        except Exception as e:
            err = str(e)
            if 'quota' in err.lower() or 'rate' in err.lower():
                wait = 30 * (attempt + 1)
                print(f"    rate limit, {wait}s 대기...")
                time.sleep(wait)
            else:
                print(f"    오류: {err[:150]}")
                if attempt < 2:
                    time.sleep(5)
    return False


def main():
    os.makedirs(OUT_BG, exist_ok=True)
    os.makedirs(OUT_CH, exist_ok=True)

    force = '--force' in sys.argv
    only_bg = '--bg-only' in sys.argv
    only_ch = '--char-only' in sys.argv

    print(f"Gemini Imagen 3 에셋 생성")
    print(f"배경: {len(BACKGROUNDS)}개 | 캐릭터: {len(CHARACTERS)}개\n")

    # ── 배경 이미지 ────────────────────────────────────────────────────────
    if not only_ch:
        print("=== 배경 이미지 (16:9) ===")
        done = 0
        for name, prompt in BACKGROUNDS.items():
            out = os.path.join(OUT_BG, f'{name}.png')
            if os.path.exists(out) and not force:
                size = os.path.getsize(out)
                if size > 100_000:  # 100KB 이상 = 이미 AI 생성
                    print(f"  ✓ {name}.png (skip, {size//1024}KB)")
                    done += 1
                    continue
            print(f"  → {name}...", end=' ', flush=True)
            ok = generate(prompt, out, aspect='16:9')
            if ok:
                size = os.path.getsize(out)
                print(f"✓ ({size//1024}KB)")
                done += 1
            else:
                print("✗")
            time.sleep(3)
        print(f"\n배경 완료: {done}/{len(BACKGROUNDS)}\n")

    # ── 캐릭터 초상화 ──────────────────────────────────────────────────────
    if not only_bg:
        print("=== 캐릭터 초상화 (3:4) ===")
        done = 0
        for name, prompt in CHARACTERS.items():
            out = os.path.join(OUT_CH, f'{name}.png')
            if os.path.exists(out) and not force:
                size = os.path.getsize(out)
                if size > 100_000:
                    print(f"  ✓ {name}.png (skip, {size//1024}KB)")
                    done += 1
                    continue
            print(f"  → {name}...", end=' ', flush=True)
            ok = generate(prompt, out, aspect='3:4')
            if ok:
                size = os.path.getsize(out)
                print(f"✓ ({size//1024}KB)")
                done += 1
            else:
                print("✗")
            time.sleep(3)
        print(f"\n캐릭터 완료: {done}/{len(CHARACTERS)}")

    print("\n✓ 전체 완료")


if __name__ == '__main__':
    main()
