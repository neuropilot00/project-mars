#!/usr/bin/env python3
"""
Occupy Mars — 누락된 배경 이미지 50개 Imagen 3 생성
대본 씬마다 고유한 배경을 제공하기 위해 모든 background ID를 채운다.
"""

import os
import sys
import time

from google import genai
from google.genai import types

PROJECT = 'gen-lang-client-0351298739'
LOCATION = 'us-central1'
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'campaign', 'backgrounds')

client = genai.Client(vertexai=True, project=PROJECT, location=LOCATION)

S = (
    "32-bit pixel art game background, semi-realistic pixel art concept art, "
    "retro RPG atmospheric scene, detailed pixel illustration, "
    "dark moody sci-fi aesthetic, Mars colony setting, cinematic game background"
)

MISSING = {
    # ── 우주선 / 도착 ─────────────────────────────────────────────────────────
    'kariope_cargo_bay': (
        "interior cargo bay of a worn interplanetary freight ship, "
        "massive metal shipping containers stacked floor to ceiling, "
        "dim industrial lighting, zero-g safety rails, "
        "diverse passengers sitting on their bags between cargo, "
        "arrival journey to Mars, nervous anticipation, " + S
    ),
    'kariope_observation_deck': (
        "small observation deck on a cargo ship approaching Mars, "
        "cracked reinforced porthole window revealing massive red planet filling the view, "
        "Mars growing larger with every moment, awe and dread, "
        "travelers pressed against the glass, the red planet arrival, " + S
    ),
    'cargo_ship_corridor': (
        "narrow corridor inside a battered interplanetary cargo ship, "
        "pipes and conduits running along low ceiling, "
        "warm emergency lighting, scuffed metal floor, "
        "faction travelers passing each other in tight quarters, " + S
    ),
    'cargo_ship_window_mars': (
        "porthole window view of Mars surface from low orbit, "
        "entire red planet below through scratched reinforced glass, "
        "Hellas basin and Olympus Mons visible from space, "
        "arrival and destination, wonder at alien world, " + S
    ),
    'deep_space_window': (
        "single reinforced window in a departing ship cabin looking back at Mars, "
        "red planet shrinking against the black of space, "
        "stars and the receding red dot of Mars, "
        "leaving behind everything that happened, departure and memory, " + S
    ),
    'deep_space_mars_approach': (
        "deep space view of Mars approaching, "
        "red planet with visible polar ice caps growing from distant dot to destination, "
        "stars and void of space, "
        "first glimpse of Mars for a newcomer, wonder and nervousness, " + S
    ),
    'mars_landing_approach': (
        "atmospheric entry approach to Mars surface from shuttle window, "
        "orange-red plasma trail visible, "
        "Hellas Planitia crater basin visible through heat shimmer, "
        "landing descent, turbulence, the real Mars coming into focus, " + S
    ),

    # ── 조선소 변형 ──────────────────────────────────────────────────────────
    'new_athens_shipyard_dawn': (
        "New Athens shipyard at Martian dawn, "
        "industrial docking gantries silhouetted against pink-orange sky, "
        "ships being readied for departure in early light, "
        "dockworkers beginning the day shift, hope of new arrivals, " + S
    ),
    'new_athens_shipyard_interior': (
        "inside New Athens shipyard pressurized terminal, "
        "arrival hall with airlock gates, "
        "diverse travelers with their luggage from across the solar system, "
        "announcement boards, customs checkpoint, "
        "first breath of Mars air recycled and thin, " + S
    ),
    'new_athens_shipyard_night': (
        "New Athens shipyard at night, "
        "dock lights reflecting off metal hulls of docked ships, "
        "quiet between shift changes, "
        "solitary figures on the docks, "
        "ships in darkness waiting for dawn departure, " + S
    ),

    # ── 헬라스 중심 도시 ─────────────────────────────────────────────────────
    'hellas_central_exterior': (
        "exterior of Hellas Central MCC-controlled city on Mars, "
        "corporate prefab towers and habitat domes under red sky, "
        "controlled and corporate atmosphere, "
        "workers moving between buildings in pressure suits, "
        "MCC insignia everywhere, efficient and cold, " + S
    ),
    'hellas_central_exterior_night': (
        "Hellas Central city at night, MCC corporate district, "
        "blue-white corporate lights illuminate ordered streets, "
        "surveillance cameras on every corner, "
        "workers hurrying home after curfew, "
        "control and surveillance, corporate nocturnal order, " + S
    ),
    'hellas_central_exterior_panorama': (
        "wide panoramic view of Hellas Central on Mars, "
        "full MCC corporate city spread across the basin floor, "
        "industrial zones, residential domes, processing facilities, "
        "the scale of corporate presence on Mars, "
        "impressive and oppressive simultaneously, " + S
    ),
    'hellas_central_underground': (
        "underground levels beneath Hellas Central, "
        "forgotten sub-basement maintenance corridors, "
        "water pipes and power conduits, dim emergency lighting, "
        "secret meeting place away from surveillance, "
        "dripping ceiling, distant machinery hum, " + S
    ),

    # ── 헬라스 외부 / 광야 ───────────────────────────────────────────────────
    'hellas_outer_plains': (
        "outer Hellas Planitia plains on Mars, "
        "vast flat red desert stretching to curved horizon, "
        "ancient impact basin floor, deepest point on Mars, "
        "isolation and geological scale, "
        "nothing but red dust and distant crater walls, " + S
    ),
    'hellas_outer_plains_sunset': (
        "outer Hellas plains at Martian sunset, "
        "sky turning deep purple and orange over endless red flat, "
        "long shadows from distant crater rim, "
        "atmospheric dust making sunset spectacular, "
        "beauty in desolation, " + S
    ),
    'hellas_various_night': (
        "various Hellas region locations at night montage, "
        "dark Martian terrain with settlement lights scattered, "
        "stars blazing over dark landscape, "
        "multiple points of light showing where people survive, "
        "vast darkness between human presences, " + S
    ),

    # ── 광산 ────────────────────────────────────────────────────────────────
    'hellas_mine_exterior': (
        "exterior of active Mars mine entrance, "
        "mine shaft opening in red hillside, ore conveyors, "
        "dust clouds from blasting, "
        "miners in pressure suits entering and exiting, "
        "industrial extraction operation, dangerous work, " + S
    ),
    'mine_exterior': (
        "abandoned Mars mine exterior, "
        "collapsed entrance partially blocked by rockfall, "
        "rusted equipment left behind, "
        "no-entry warning signs weathered and fallen, "
        "silence where machines once roared, " + S
    ),
    'mine_interior': (
        "inside an active Mars mine, "
        "tunnel with ore cart tracks, work lights every 10 meters, "
        "rock walls showing mineral veins, "
        "mining equipment and safety equipment, "
        "claustrophobic but familiar to the workers, " + S
    ),
    'mine_shaft': (
        "vertical mine shaft on Mars looking down, "
        "elevator cage descending into darkness, "
        "rock layers visible showing geological history, "
        "ancient and recent strata alternating, "
        "deep descent into Mars underground, " + S
    ),

    # ── 헬라스 마을 변형 ─────────────────────────────────────────────────────
    'hellas_mining_village_dawn': (
        "Mars mining colony village at dawn, "
        "pink morning light on habitat domes, "
        "first shift workers heading out, "
        "coffee steam visible from cracked window, "
        "quiet before the day's labor begins, " + S
    ),
    'hellas_mining_village_empty': (
        "Mars mining village completely empty and silent, "
        "after evacuation order, personal belongings left behind, "
        "doors open, lights still on inside, "
        "a community forced to abandon their home, "
        "eerie absence where life was, " + S
    ),
    'hellas_mining_village_panorama': (
        "wide panoramic view of Mars mining colony settlement, "
        "full village spread across flat terrain, "
        "habitat clusters with connecting pressurized walkways, "
        "community grown organically over 20 years, "
        "human scale against vast Mars landscape, " + S
    ),

    # ── 헬라스 노동구역 ──────────────────────────────────────────────────────
    'hellas_labor_district_night': (
        "MCC labor district at night, "
        "worker dormitory blocks and factory buildings, "
        "dim street lighting, "
        "tired workers returning from late shift, "
        "oppressive corporate-controlled living conditions, " + S
    ),
    'hellas_outer_relay_interior': (
        "interior of small isolated relay station, "
        "cramped communication equipment room, "
        "flickering screens showing static, "
        "tool marks from recent repair, "
        "oil stains indicating Cinder Grace was here recently, "
        "secret location, " + S
    ),

    # ── MCC ──────────────────────────────────────────────────────────────────
    'mcc_sector12_ruins': (
        "ruins of MCC Zone 12 in Hellas, "
        "collapsed habitat module from catastrophic failure, "
        "memorial chalk names on crumbling walls, "
        "11 dead from covered-up negligence, "
        "evidence of corporate crime, abandoned and ignored by MCC, " + S
    ),

    # ── 케플러 ───────────────────────────────────────────────────────────────
    'kepler_crater_dusk': (
        "Kepler crater on Mars at dusk, "
        "long shadows across crater floor as sun sets, "
        "warm orange-red light on ancient rock faces, "
        "scientific base lights coming on as dark approaches, "
        "30-year research station in evening quiet, " + S
    ),
    'kepler_crater_edge': (
        "standing on the rim of Kepler crater on Mars, "
        "looking down at crater floor far below, "
        "Ancient Metal deposit glinting in afternoon light, "
        "30 years of footprints on the crater edge, "
        "one scientist's domain for three decades, " + S
    ),
    'kepler_crater_edge_dusk': (
        "Kepler crater rim at dusk, "
        "silhouette of research equipment against dying light, "
        "crater interior falling into shadow below, "
        "last light of day on the mineral formations, "
        "solitary and beautiful, " + S
    ),

    # ── 샌드스톤 ─────────────────────────────────────────────────────────────
    'sandstone_junction_dusk': (
        "Sandstone Junction crossroads at dusk on Mars, "
        "long shadows at three-way desert intersection, "
        "orange-red sky fading to purple, "
        "footprints in sand leading in and out of frame, "
        "recent meeting here, dust settling from departure, " + S
    ),

    # ── 올림포스 변형 ─────────────────────────────────────────────────────────
    'olympus_exterior_dawn': (
        "Olympus Mons exterior at dawn, "
        "first light catching the volcanic caldera rim, "
        "summit station lights still on against brightening sky, "
        "most dramatic geological feature in the solar system, "
        "political neutrality at extreme altitude, " + S
    ),
    'olympus_exterior_sunset': (
        "Olympus Mons at sunset, "
        "entire caldera rim lit gold and red, "
        "thin atmosphere making colors blazing and unreal, "
        "summit station silhouette against spectacular sky, "
        "end of negotiations, decisions made, " + S
    ),
    'olympus_exterior_vast': (
        "vast panoramic view from Olympus Mons exterior, "
        "entire Mars visible below from caldera edge, "
        "MCC cities, FSP settlements, CV territories all visible as dots, "
        "perspective that makes all factions seem tiny, "
        "the fourth view beyond faction thinking, " + S
    ),
    'olympus_summit_exterior_view': (
        "looking through reinforced glass of Olympus summit station exterior, "
        "three faction representatives visible inside through window, "
        "observer's perspective from outside looking in, "
        "thin Martian atmosphere pressing on the glass, "
        "the fourth eye watching the three flags negotiate, " + S
    ),

    # ── FSP 변형 ─────────────────────────────────────────────────────────────
    'fsp_assembly_hall_evening': (
        "FSP assembly hall in the evening, "
        "community gathering winding down, "
        "warm lamp light, people in small groups talking, "
        "democratic debate ending for the day, "
        "community solidarity in the amber evening light, " + S
    ),
    'fsp_assembly_hall_official': (
        "FSP assembly hall during official session, "
        "all seats filled, flags and banners, "
        "speaker at the center podium, "
        "democratic process in action, "
        "serious formal gathering of free settlers, " + S
    ),
    'fsp_base_exterior': (
        "FSP base exterior on Mars surface, "
        "community members tending to exterior maintenance, "
        "solar panel array and water reclaim equipment, "
        "greenhouse dome visible, life support visible, "
        "self-sufficiency made real, " + S
    ),
    'fsp_base_night': (
        "FSP base at night, "
        "warm lights glowing in habitat windows, "
        "community members on night watch, "
        "stars blazing over the settlement, "
        "peace and quiet but always vigilant, " + S
    ),

    # ── CV / 에레보스 변형 ───────────────────────────────────────────────────
    'erebus_base_exterior': (
        "Crow Vanguard base exterior built into Erebus crater wall, "
        "fortress carved from volcanic rock, "
        "gun emplacements and sensor arrays, "
        "CV banner flying in thin wind, "
        "impregnable position earned through 30 years of battle, " + S
    ),
    'erebus_base_interior_night': (
        "Erebus CV base interior at night, "
        "emergency red lighting, skeleton crew on watch, "
        "weapons in racks along walls, "
        "mercenary barracks, quiet and deadly, "
        "night before a major operation, " + S
    ),
    'erebus_base_medical': (
        "CV base medical bay in Erebus crater, "
        "battered medical equipment, improvised but functional, "
        "battle wounds being treated, "
        "ore dust in lungs visible on monitor, "
        "Butcher's condition visible in cold medical light, " + S
    ),
    'erebus_canyon_sunset': (
        "Erebus crater canyon at sunset, "
        "volcanic rock walls glowing red-gold in dying light, "
        "CV base entrance visible as shadow in cliff face, "
        "beautiful and dangerous simultaneously, "
        "home of the mercenaries, " + S
    ),
    'erebus_crater_exterior': (
        "exterior of Erebus crater on Mars, "
        "ancient volcanic formation, wide caldera, "
        "CV territory markers on the crater rim, "
        "strategic defensible position, "
        "where the Crow Vanguard made their home, " + S
    ),
    'erebus_crater_panorama': (
        "panoramic view of Erebus crater from high above, "
        "complete crater visible with CV base settlement inside, "
        "volcanic geology and human fortification combined, "
        "30 years of building a stronghold, "
        "impressive scale of CV territory, " + S
    ),

    # ── 아르기레 변형 ─────────────────────────────────────────────────────────
    'argyre_canyon_depot': (
        "MCC supply depot inside Argyre canyon, "
        "storage containers and fuel cells in canyon overhang, "
        "corporate security equipment, "
        "CV raid target, supply chain chokepoint, "
        "canyon shadows hiding corporate logistics, " + S
    ),
    'argyre_plains_dusk': (
        "Argyre plains at dusk after battle, "
        "long shadows across scarred terrain, "
        "abandoned equipment from earlier confrontation, "
        "dust settling from the fight, "
        "aftermath and quiet, " + S
    ),
    'argyre_plains_night': (
        "Argyre plains at night, darkness and stars, "
        "distant lights of bases on horizon, "
        "no-man's land in full darkness, "
        "danger in every direction, "
        "tense night patrol atmosphere, " + S
    ),

    # ── 표면 / 자연 ──────────────────────────────────────────────────────────
    'mars_surface_dust_storm': (
        "Mars surface during dust storm, "
        "visibility near zero in swirling red and orange clouds, "
        "habitat structures barely visible through the storm, "
        "emergency lights flickering, "
        "nature reminding humans of their fragility on Mars, " + S
    ),
    'hellas_zone4_outside_dawn': (
        "outside Hellas Zone 4 mine at dawn, "
        "mine entrance visible, pink morning sky, "
        "four people emerging from underground after the night's revelation, "
        "Ancient Metal discovery, new day beginning, "
        "the truth surfacing with the sun, " + S
    ),
    'hellas_zone4_ruins_exit': (
        "exit from Hellas Zone 4 ruins back to surface, "
        "mine shaft exit framing sky above, "
        "observer climbing out of 30-year-old mine, "
        "red Martian light at top of shaft, "
        "emerging from history into present, " + S
    ),
}


def generate(prompt, out_path, aspect='16:9'):
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
                with open(out_path, 'wb') as f:
                    f.write(response.generated_images[0].image.image_bytes)
                return True
        except Exception as e:
            err = str(e)
            if 'quota' in err.lower() or 'rate' in err.lower():
                wait = 30 * (attempt + 1)
                print(f"    rate limit → {wait}s 대기...", flush=True)
                time.sleep(wait)
            else:
                print(f"    오류: {err[:120]}", flush=True)
                if attempt < 2:
                    time.sleep(5)
    return False


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    force = '--force' in sys.argv

    # 실제 누락 목록만 생성
    targets = {}
    for name, prompt in MISSING.items():
        out = os.path.join(OUT_DIR, f'{name}.png')
        if force or not os.path.exists(out) or os.path.getsize(out) < 100_000:
            targets[name] = prompt

    print(f"총 {len(MISSING)}개 정의 → {len(targets)}개 생성 필요\n")
    if not targets:
        print("모두 존재함. --force로 재생성 가능.")
        return

    done, fail = 0, 0
    for i, (name, prompt) in enumerate(targets.items(), 1):
        out = os.path.join(OUT_DIR, f'{name}.png')
        print(f"  [{i}/{len(targets)}] {name}...", end=' ', flush=True)
        if generate(prompt, out):
            size = os.path.getsize(out)
            print(f"✓ ({size//1024}KB)")
            done += 1
        else:
            print("✗")
            fail += 1
        time.sleep(2)

    print(f"\n완료: {done}개 성공 / {fail}개 실패")
    print(f"배경 총계: {len(os.listdir(OUT_DIR))}개")


if __name__ == '__main__':
    main()
