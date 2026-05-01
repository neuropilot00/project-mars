#!/usr/bin/env python3
"""
77개 scene-level 배경 Imagen 4 Ultra 일괄 재생성 (cinematic 스타일 통일).
모든 챕터의 scene.background 가 가리키는 location-named 파일들.
"""

import os, sys, time
from google import genai
from google.genai import types

PROJECT = 'gen-lang-client-0351298739'
LOCATION = 'us-central1'
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'campaign', 'backgrounds')
client = genai.Client(vertexai=True, project=PROJECT, location=LOCATION)

STYLE = (
    "highly detailed cinematic concept art, hand-painted matte painting style, "
    "intricate dense detail with environmental storytelling, "
    "vertical 9:16 portrait composition for mobile, "
    "dark moody Mars sci-fi color palette with deep crimson amber and black, "
    "dramatic chiaroscuro lighting, atmospheric depth, "
    "Simon Stalenhag concept art mood, no text no logos no UI no watermark"
)

PROMPTS = {
  'argyre_canyon_depot': "Argyre canyon supply depot on Mars, weathered prefab containers stacked between sheer red rock walls, single overhead floodlight, scattered crates and pipes, Crow Vanguard staging area, " + STYLE,
  'argyre_canyon_night': "Argyre Planitia canyon on Mars at deep night, sheer red rock walls towering hundreds of meters, narrow starfield strip above, ambush territory, single distant fire glow, " + STYLE,
  'argyre_plains': "Argyre Planitia battlefield on Mars before combat, vast flat red basin extending to escarpment ridge, approaching dust storm darkening half sky, two opposing fleet silhouettes at distance, exposed featureless terrain, " + STYLE,
  'argyre_plains_dusk': "Argyre plains on Mars at deep dusk, blood-red horizon line between red dust and ink-violet sky, rusted hulk of wrecked cargo crawler half-buried, scattered weapon casings catching last light, aftermath silence, " + STYLE,
  'argyre_plains_night': "Argyre plains on Mars at deep night, twin Martian moons low on horizon, faint cooking fire glow, distant fleet silhouettes, ambient dust haze, " + STYLE,
  'cargo_ship_corridor': "narrow corridor inside battered interplanetary cargo freighter Kariope, pipes and conduits along low ceiling, warm emergency lighting, scuffed metal floor, faction travelers in tight quarters, " + STYLE,
  'cargo_ship_interior': "interior cockpit of Kariope cargo freighter en route to Mars, two pilot seats facing reinforced cockpit window framing red Mars, battered control consoles with green/amber CRT readouts, tangled cable runs, " + STYLE,
  'cargo_ship_window_mars': "porthole window view of Mars from low orbit aboard the Kariope, full red planet through scratched reinforced glass, Hellas basin and Olympus Mons visible, arrival wonder, " + STYLE,
  'deep_space_mars_approach': "interplanetary cargo ship approaching Mars seen from outside hull, Mars dominating frame as detailed red world with polar caps, Hellas basin, dust-storm bands, freighter silhouette in foreground, " + STYLE,
  'deep_space_window': "single reinforced porthole window in departing ship cabin looking back at Mars, red planet shrinking against black space, stars and receding red dot, departure and memory, " + STYLE,
  'erebus_base_exterior': "Crow Vanguard fortress in Erebus crater seen from outside, volcanic rock walls carved into bunker entrances, faction banners, smoke from interior fires, weather-beaten warrior camp, " + STYLE,
  'erebus_base_interior': "Crow Vanguard guerrilla base interior, dark industrial corridors, combat equipment hanging on bare metal walls, emergency red lighting, weapons and survival gear, volcanic rock walls, " + STYLE,
  'erebus_base_interior_night': "Crow Vanguard base interior at deep night, low torch fires illuminating sleeping warriors among gear, anti-corporate mercenary aesthetic, war trophies on walls, " + STYLE,
  'erebus_canyon_sunset': "Erebus crater canyon at sunset, volcanic rock walls bathed in red-amber light, narrow path winding down to base entrance, lone CV operative silhouette, " + STYLE,
  'erebus_crater_exterior': "Erebus crater exterior on Mars, massive volcanic depression with steep walls, CV base entrance carved into rock, smoke from barrel fires rising, weathered banner, " + STYLE,
  'erebus_crater_panorama': "wide panorama of Erebus crater on Mars at red dusk, full extent of volcanic depression visible, CV outposts dotting the rim, twin Martian moons rising, " + STYLE,
  'erebus_throne_hall': "Crow Vanguard fortress throne room in Erebus crater, massive industrial chamber carved from volcanic rock, iron pillars with burning flame torches, battered mining chair as throne, mercenary war trophies and faction banners, " + STYLE,
  'fsp_assembly_hall': "FSP Free Settlement community assembly hall, warm wooden interior with panoramic windows showing Mars landscape, circular democratic seating, hand-painted murals on walls, lived-in warmth, " + STYLE,
  'fsp_assembly_hall_evening': "FSP assembly hall at evening, warm amber lights through windows, eleven empty chairs in circle, dust-storm beginning outside, " + STYLE,
  'fsp_assembly_hall_official': "FSP Hellas Central Assembly Hall during official session, eleven chair voting circle filled with delegates, holographic motion panel above, scale-4 dust pounding tall windows, " + STYLE,
  'fsp_base': "FSP Free Settlement base on Mars surface, organic curved dome habitat architecture, solar panels and greenhouse modules, community garden with red soil, warm amber lights, " + STYLE,
  'fsp_base_exterior': "FSP base exterior at Martian dusk, curved dome habitats glowing warmly, distant mine lights below, FSP solidarity banner painted on wall, " + STYLE,
  'fsp_base_night': "FSP settlement base interior at night, single lamp lit on table, Lena's tattooed forearm visible, FSP red solidarity patches on coats, quiet vigil, " + STYLE,
  'gaia_ship_interior': "interior of FSP warship Gaia under construction, vast hangar bay with hull plates being welded, sparks falling, civilian volunteers laboring among machinery, the name GAIA painted on bulkhead, " + STYLE,
  'hellas_central_exterior': "exterior of Hellas Central MCC-controlled city on Mars, corporate prefab towers and habitat domes under blood-red sky, workers in pressure suits between buildings, MCC insignia everywhere, efficient and cold, " + STYLE,
  'hellas_central_exterior_night': "Hellas Central city at night, MCC corporate district, blue-white corporate lights illuminating ordered streets, surveillance cameras on every corner, workers hurrying home after curfew, " + STYLE,
  'hellas_central_exterior_panorama': "wide panoramic view of Hellas Central on Mars, full MCC corporate city spread across basin floor, industrial zones, residential domes, processing facilities, oppressive scale, " + STYLE,
  'hellas_exterior_road': "exterior road leading to Hellas Central, single lonely transport vehicle on red dust highway, distant city silhouette, evening sky, " + STYLE,
  'hellas_labor_district_night': "MCC-controlled labor district C-7 on Mars at night, factory and processing plant silhouettes against dark purple sky, dim street lamps casting orange circles on dusty ground, chalk names on alley walls, " + STYLE,
  'hellas_mine_exterior': "Mars mine entrance exterior, scaffolding around shaft head, ore-cart rails leading into darkness, MCC company logos, weathered workers in pressure suits, " + STYLE,
  'hellas_mining_outpost': "Mars mining outpost in Hellas, single processing tower among prefab worker barracks, red dust accumulated everywhere, MCC compound with high fence, " + STYLE,
  'hellas_mining_village': "Mars mining colony village in Hellas Planitia basin, prefab habitat modules with warm yellow porthole lights, red dust everywhere, improvised community square, hardworking miner settlement under deep crimson sky, " + STYLE,
  'hellas_mining_village_dawn': "Mars mining village at dawn, first light catching the prefab habitats, miners beginning shift in pressure suits, hopeful glow despite hardship, " + STYLE,
  'hellas_mining_village_empty': "Mars mining village abandoned, empty prefab habitats, broken windows, drifting red dust, faded chalk names on walls, ghost settlement, " + STYLE,
  'hellas_mining_village_fire': "Mars mining village at night during strike, barrel fires burning in colony square, orange firelight on pressurized habitat walls, workers gathered against cold darkness, protest and solidarity, " + STYLE,
  'hellas_mining_village_panorama': "panoramic view of full Hellas mining village across the basin floor, dozens of prefab habitats, central square fire, mine works at edge, deep red sky, " + STYLE,
  'hellas_mining_village_wall': "close on weathered concrete wall in Hellas mining village covered in CHALK NAMES of dead miners — KIM YONG-JIN at top, many names below in different handwriting, single candle at base, " + STYLE,
  'hellas_outer_plains': "vast empty Hellas outer plains on Mars, red dust extending to flat horizon, single distant communication relay tower, ambient dust haze, " + STYLE,
  'hellas_outer_plains_sunset': "Hellas outer plains at Martian sunset, sun sinking behind escarpment, blue-tinged dusk on horizon, lone figure walking the dust road, " + STYLE,
  'hellas_various_night': "wide vista of multiple Mars colony settlements seen from high ridge at night, dozens of pressurized habitat domes scattered across red dust plain, warm yellow porthole lights, two Martian moons, vast lonely scale, " + STYLE,
  'hellas_zone4_deep_tunnel': "deep abandoned mine tunnel on Mars, ancient alien ore veins glowing faint cyan in crumbling rock walls, 30-year-old mining shaft, claustrophobic darkness, rusty support beams, mineral crystals catching dim headlamp light, " + STYLE,
  'hellas_zone4_outside_dawn': "Hellas Zone 4 ruined mining facility exterior at dawn, weathered industrial wreckage half-buried in red dust, names scratched in remaining walls, memorial silence, " + STYLE,
  'hellas_zone4_ruins': "abandoned Zone 4 mining facility ruins on Mars, 30-year-old collapsed scaffolding and rusted ore processors, weathered industrial wreckage half-buried in red dust, names scratched in walls, " + STYLE,
  'hellas_zone4_ruins_exit': "exit corridor of Zone 4 ruins, blackened blast-damage walls, multiple handprints from those who fled the disaster, single sun-shaft from above, " + STYLE,
  'kariope_cargo_bay': "interior cargo bay of worn interplanetary freighter Kariope, massive metal shipping containers stacked floor to ceiling, dim industrial lighting, zero-g safety rails, diverse passengers sitting on bags between cargo, " + STYLE,
  'kariope_observation_deck': "small observation deck on the Kariope cargo ship approaching Mars, cracked reinforced porthole window revealing massive red planet filling view, Mars growing larger, travelers pressed against glass, " + STYLE,
  'kepler_crater': "Kepler crater on Mars, ancient impact crater with deep dark interior, scientific research equipment scattered on crater floor, ancient extraterrestrial mineral deposits glinting, " + STYLE,
  'kepler_crater_dawn': "Kepler crater on Mars at dawn, ancient impact crater rim silhouette against pink-orange sunrise, scientific equipment scattered, Liang Wei's worn outpost on rim, " + STYLE,
  'kepler_crater_dusk': "Kepler crater on Mars at dusk, deep crater interior fading into shadow, last light catching ancient ore deposits, single research outpost on rim, " + STYLE,
  'kepler_crater_edge': "Kepler crater rim edge, sheer drop to deep basin floor below, ancient ore samples on folding worktable, telescope pointed at horizon, " + STYLE,
  'kepler_crater_edge_dusk': "Kepler crater rim at dusk on Mars, ancient impact crater cliff edge backlit by red-violet evening sky, single weather-beaten research habitat clinging to rim, Liang Wei's solitary outpost, " + STYLE,
  'mars_docking_bay': "Mars surface docking bay, massive industrial gantries holding shuttles, pressure-locked terminals with arrival/departure boards, dust-filtered light through huge bay doors, " + STYLE,
  'mars_landing_approach': "atmospheric entry approach to Mars surface from shuttle window, orange-red plasma trail visible, Hellas Planitia crater basin through heat shimmer, landing descent turbulence, " + STYLE,
  'mars_sunset': "Martian sunset on red plains, dust-saturated atmosphere turning sun into pale-blue disk on horizon, long jagged rock silhouettes, deep crimson sky bleeding to violet, single tiny rover trail, " + STYLE,
  'mars_surface_dust_storm': "Mars surface during full dust storm, massive orange wall advancing across red plains, tiny pressure-suited figures battling wind, near-zero visibility, " + STYLE,
  'mcc_archive_sublevel': "underground MCC corporate archive sublevel 4, endless rows of filing cabinets and old server racks, flickering fluorescent tube lights, damp concrete floor, classified files covering decades of Mars operations, " + STYLE,
  'mcc_board_chamber': "MCC executive board chamber high above Hellas Central, circular obsidian conference table for seven directors, tall narrow armored windows overlooking Mars colony far below, private oxygen scrubbers behind chairs, cold absolute corporate power, " + STYLE,
  'mcc_briefing_room': "MCC corporate operations briefing chamber on Mars, long obsidian conference table lit by overhead holographic mission display showing red-sector fleet movements, high-back synthetic-leather chairs, dark brushed alloy walls, cold blue light, " + STYLE,
  'mcc_executive_floor': "MCC corporation executive penthouse floor on Mars, floor-to-ceiling armored windows revealing crimson Martian landscape and distant dust storms, minimalist cold corporate interior at exactly 25 degrees Celsius, sleek sterile luxury, " + STYLE,
  'mcc_sector12_ruins': "MCC Sector 12 ruined facility, blast damage and broken machinery, faded company signage, names scratched into walls in chalk and metal, ghost of corporate failure, " + STYLE,
  'mine_exterior': "Mars mine entrance exterior, large industrial shaft head with cargo elevators, ore conveyors reaching into darkness, MCC compound fence, evening shift workers leaving, " + STYLE,
  'mine_interior': "deep Mars mine interior, narrow tunnel with rusted support beams, exposed ore veins in rock walls, single hanging work-lamp, " + STYLE,
  'mine_shaft': "narrow Mars mine tunnel with rusted support beams holding crumbling rock above, single overhead emergency bulb, shadows stretching down passage, " + STYLE,
  'new_athens_shipyard': "New Athens shipyard in Mars low orbit, massive industrial space docking facility, cargo ships being loaded, stars and red Mars below, dockworkers and union activity, " + STYLE,
  'new_athens_shipyard_dawn': "New Athens shipyard at Martian dawn, industrial docking gantries silhouetted against pink-orange sky, ships being readied, dockworkers beginning day shift, " + STYLE,
  'new_athens_shipyard_interior': "inside New Athens shipyard pressurized terminal, arrival hall with airlock gates, diverse travelers with luggage, announcement boards, customs checkpoint, first breath of recycled Mars air, " + STYLE,
  'new_athens_shipyard_night': "New Athens shipyard at night, dock lights reflecting off metal hulls of docked ships, quiet between shift changes, solitary figures on docks, ships in darkness, " + STYLE,
  'olympus_exterior': "Olympus Mons exterior on Mars, the largest volcano in solar system filling frame, twenty-five kilometer escarpment cliffs along base, thin atmosphere allows starfield even in daylight, " + STYLE,
  'olympus_exterior_dawn': "Olympus Mons at dawn, vast volcanic dome silhouetted against rising sun, dawn light bleeding across cliff face, three faction flagpoles visible at summit, " + STYLE,
  'olympus_exterior_sunset': "Olympus Mons at sunset, vast volcanic dome silhouetted against burning orange-red sky, sun dipping behind largest volcano in solar system, thin clouds catching dying light, " + STYLE,
  'olympus_exterior_vast': "vast panorama of Olympus Mons exterior, the entire volcanic shield visible from orbit-low altitude, three flag-mounting holes carved at summit base, " + STYLE,
  'olympus_summit_exterior_view': "view from Olympus Mons summit looking down, full Mars panorama visible below, three faction flagpoles in foreground, summit station entrance, " + STYLE,
  'olympus_summit_station': "research and diplomatic station at Olympus Mons summit, reinforced glass dome habitat at highest point in solar system, space and stars visible above thin clouds, three faction flags barely visible through windows, " + STYLE,
  'olympus_summit_station_interior': "Olympus summit station interior conference chamber, long table at center, three faction flags hanging on walls, reinforced glass dome above showing starfield, ultimate diplomatic neutrality, " + STYLE,
  'sandstone_junction': "Sandstone Junction crossroads in Mars desert, three-way intersection of dusty red paths, weathered signposts, footprints in orange sand converging from multiple directions, neutral meeting point for all three factions, " + STYLE,
  'sandstone_junction_dusk': "Sandstone Junction at deep dusk, crossroads in red-violet light, fresh footprints scattering in three directions, single Zone 12 name carved on rock corner, wind-blown sand, " + STYLE,
  'space_battle_start': "opening salvo of fleet engagement in low Mars orbit, two opposing capital ships exchange railgun and missile fire, tracer streaks across foreground, Mars limb glowing red below, fighter wings peeling off, single hull breach venting atmosphere, " + STYLE,
}


def main():
    targets = sorted(PROMPTS.keys())
    print(f'Total targets: {len(targets)}')
    print(f'Model: imagen-4.0-ultra-generate-001\n')
    completed = 0
    failed = []
    sizes = []
    for idx, bg_id in enumerate(targets, 1):
        out = os.path.join(OUT_DIR, f'{bg_id}.png')
        prompt = PROMPTS[bg_id]
        print(f'[{idx}/{len(targets)}] {bg_id}', flush=True)
        ok = False
        for attempt in range(3):
            try:
                r = client.models.generate_images(
                    model='imagen-4.0-ultra-generate-001',
                    prompt=prompt,
                    config=types.GenerateImagesConfig(
                        number_of_images=1, aspect_ratio='9:16',
                        safety_filter_level='block_only_high',
                        person_generation='allow_adult',
                    ),
                )
                if r.generated_images and r.generated_images[0].image and r.generated_images[0].image.image_bytes:
                    with open(out, 'wb') as f:
                        f.write(r.generated_images[0].image.image_bytes)
                    ok = True
                    break
            except Exception as e:
                err = str(e)
                wait = 30 if any(w in err.lower() for w in ['quota','rate']) else 5
                print(f'  attempt {attempt+1}/3 fail: {err[:120]}; sleep {wait}s', flush=True)
                time.sleep(wait)
        if ok:
            kb = os.path.getsize(out) // 1024
            sizes.append(kb)
            tag = '✓' if kb >= 1400 else '⚠'
            print(f'  {tag} {kb}KB', flush=True)
            completed += 1
        else:
            failed.append(bg_id)
            print(f'  ✗ FAILED', flush=True)
        if idx % 10 == 0:
            avg = sum(sizes)/len(sizes) if sizes else 0
            print(f'  PROGRESS {idx}/{len(targets)} avg={avg:.0f}KB completed={completed} failed={len(failed)}', flush=True)
        time.sleep(2)
    avg = sum(sizes)/len(sizes) if sizes else 0
    print(f'\nFINAL: completed={completed}/{len(targets)}  failed={len(failed)}  avg={avg:.0f}KB')
    if failed:
        print('Failed:', failed)


if __name__ == '__main__':
    main()
