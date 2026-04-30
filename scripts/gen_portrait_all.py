#!/usr/bin/env python3
"""
Occupy Mars — 전체 이미지 9:16 세로 포맷 재생성
Stability AI SD3 사용 (aspect_ratio="9:16")
배경 78개(기존) + 50개(신규) + 캐릭터 전원 포함
"""

import os
import sys
import time
import requests

STABILITY_KEY = 'sk-PTUCPZoj9uysIUFu0spIL2IE3zq4pqv6axxQMBJRdFCudTMe'
OUT_DIR  = os.path.join(os.path.dirname(__file__), '..', 'assets', 'campaign', 'backgrounds')
CHAR_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'campaign', 'characters')

# ──────────────────────────────────────────────────────────────────────────────
# 공통 스타일
# ──────────────────────────────────────────────────────────────────────────────
BASE_STYLE = (
    "pixel art, 32-bit retro RPG background, semi-realistic pixel art concept art, "
    "atmospheric perspective, dark sci-fi aesthetic, detailed pixel illustration, "
    "game background art, cinematic composition, moody lighting, vertical portrait format"
)
NEG = (
    "photorealistic, 3D render, CGI, smooth gradients, blurry, out of focus, "
    "anime, cartoon, flat design, low quality, watermark, text, logo, "
    "people in foreground, characters"
)

S = (
    "32-bit pixel art game background, semi-realistic pixel art concept art, "
    "retro RPG atmospheric scene, detailed pixel illustration, "
    "dark moody sci-fi aesthetic, Mars colony setting, cinematic game background, "
    "vertical portrait format"
)

# ──────────────────────────────────────────────────────────────────────────────
# 기존 배경 (gen_backgrounds_ai.py)
# ──────────────────────────────────────────────────────────────────────────────
BACKGROUNDS_ORIGINAL = {
    'hellas_zone4_deep_tunnel': (
        "ancient alien ore vein glowing blue in deep mine tunnel on Mars, "
        "30-year-old abandoned mining shaft, crumbling rock walls with cyan mineral crystals, "
        "dim headlamp light, claustrophobic underground atmosphere, rust and rock, " + BASE_STYLE
    ),
    'mcc_archive_sublevel': (
        "underground corporate archive sublevel, rows of old file cabinets and server racks, "
        "flickering fluorescent lights casting harsh shadows, dark industrial basement, "
        "confidential documents, cold concrete walls, Mars colony administrative facility, " + BASE_STYLE
    ),
    'hellas_zone4_ruins': (
        "abandoned Mars mining ruins from 30 years ago, collapsed mine scaffolding, "
        "weathered industrial equipment half-buried in red Mars dust, "
        "desolate wasteland, crumbling ore processing facility, sunset light through broken windows, " + BASE_STYLE
    ),
    'mcc_board_chamber': (
        "sealed corporate boardroom in space, circular polished table, "
        "seven empty executive chairs, blue holo-displays on walls, "
        "cold corporate blue lighting, pressurized oxygen chamber, "
        "power and secrecy, MCC megacorporation Mars headquarters, " + BASE_STYLE
    ),
    'mcc_executive_floor': (
        "MCC corporation executive floor on Mars, floor-to-ceiling reinforced windows, "
        "red Martian landscape outside, sleek minimalist cold blue interior, "
        "premium corporate lounge maintained at exactly 25 degrees, "
        "power and control, megacorporation aesthetic, " + BASE_STYLE
    ),
    'hellas_mining_village': (
        "Mars mining colony village in Hellas Planitia, makeshift habitat modules, "
        "red dust-covered settlement, warm lights in porthole windows, "
        "hardworking miners community, worn but lived-in atmosphere, "
        "industrial prefab buildings under crimson Mars sky, " + BASE_STYLE
    ),
    'hellas_mining_village_fire': (
        "Mars mining village at night, barrel fires burning in the colony square, "
        "orange firelight reflecting off dust-covered habitat walls, "
        "workers gathered around flames under starlit Martian sky, "
        "protest atmosphere, strike night, desperate warmth, " + BASE_STYLE
    ),
    'hellas_labor_district_night': (
        "Mars industrial labor district at night, factory silhouettes against dark sky, "
        "street lamps casting orange pools of light on dusty ground, "
        "workers quarter, oppressive industrial atmosphere, "
        "MCC corporate towers looming in distance, class divide visible, " + BASE_STYLE
    ),
    'olympus_exterior': (
        "exterior of Olympus Mons on Mars, tallest volcano in solar system, "
        "vast red Martian landscape stretching to horizon, thin atmosphere, "
        "distant stars visible through haze, enormous geological scale, "
        "isolation and power, crimson dust plains below, " + BASE_STYLE
    ),
    'olympus_summit_station': (
        "research station at summit of Olympus Mons, glass dome habitat above clouds, "
        "stars and space visible from highest point in solar system, "
        "three faction flags visible through reinforced glass, "
        "political neutrality at extreme altitude, magnificent and cold, " + BASE_STYLE
    ),
    'fsp_assembly_hall': (
        "FSP community assembly hall on Mars, warm wooden interior with large windows, "
        "circular seating arrangement for democratic decision-making, "
        "Mars landscape visible outside, warm community atmosphere, "
        "handmade decorations, lived-in communal space, freedom spirit, " + BASE_STYLE
    ),
    'fsp_base': (
        "FSP Free Settlement Project base on Mars, organic dome architecture, "
        "self-sufficient colony with solar panels and greenhouse modules, "
        "warm community lights, independence from corporate control, "
        "rugged but hopeful frontier settlement, desert survival, " + BASE_STYLE
    ),
    'erebus_throne_hall': (
        "Crow Vanguard fortress throne hall in Erebus crater, massive industrial chamber, "
        "flame torches on iron pillars, a weathered mining chair as throne, "
        "mercenary war trophies on walls, dark authoritarian atmosphere, "
        "30-year battle scars on everything, power carved through violence, " + BASE_STYLE
    ),
    'erebus_base_interior': (
        "Crow Vanguard military base interior, dark industrial corridors, "
        "combat equipment hanging on metal walls, emergency red lighting, "
        "mercenary aesthetic, weapons and tools, anti-corporate guerrilla base, "
        "bare metal and survival, Erebus crater underground facility, " + BASE_STYLE
    ),
    'argyre_canyon_night': (
        "Argyre canyon on Mars at night, deep red rock canyon walls towering above, "
        "starfield visible between canyon walls, darkness and danger, "
        "ambush territory, ancient geology lit only by starlight, "
        "guerrilla warfare atmosphere, vast scale and isolation, " + BASE_STYLE
    ),
    'argyre_plains': (
        "Argyre plains on Mars, vast flat battlefield extending to horizon, "
        "dust storm approaching in distance, orange-red sky, "
        "nowhere to hide, open confrontation territory, "
        "pre-battle tension, military staging ground, Crow Vanguard forces, " + BASE_STYLE
    ),
    'sandstone_junction': (
        "Sandstone Junction crossroads on Mars, three-way desert intersection, "
        "weathered signposts in red dust, footprints in sand converging from multiple directions, "
        "meeting point for factions, neutral territory, "
        "Mars desert crossroads, dust and secrecy, " + BASE_STYLE
    ),
    'kepler_crater_dawn': (
        "Kepler crater on Mars at dawn, ancient impact crater rim silhouette, "
        "pink and orange dawn sky over crater floor, "
        "scientific research equipment visible on crater floor, "
        "lone researcher territory, 30 years of solitary study, "
        "Ancient Metal ore deposits glinting in dawn light, " + BASE_STYLE
    ),
    'new_athens_shipyard': (
        "New Athens shipyard in Mars orbit, massive industrial space dock, "
        "cargo ships being loaded and unloaded, stars and Mars visible, "
        "working class dockworkers, union activity, "
        "arrival point of newcomers to Mars, hope and industrial grit, " + BASE_STYLE
    ),
    'hellas_outer_relay': (
        "abandoned relay station in outer Hellas plains on Mars, "
        "small communication tower in red desert, "
        "oil stains and tool marks from recent maintenance, "
        "secret meeting point, isolated industrial outpost, "
        "harsh Mars environment, lone machinery in vast emptiness, " + BASE_STYLE
    ),
}

# ──────────────────────────────────────────────────────────────────────────────
# 신규 배경 (gen_missing_backgrounds.py + 씬 JSON에서 추출된 누락분)
# ──────────────────────────────────────────────────────────────────────────────
BACKGROUNDS_NEW = {
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
    'new_athens_shipyard_launch': (
        "New Athens shipyard launch moment, "
        "ship engines firing in docking bay, exhaust and light, "
        "emergency departure under pressure, "
        "dock crew scrambling, "
        "drama of last-minute escape or pursuit, " + S
    ),
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
    'hellas_mining_village_wall': (
        "crumbling wall of Mars mining village habitat, "
        "memorial names scratched into the metal surface, "
        "Zone 12 victims' names faded but legible, "
        "impromptu memorial on corrugated wall, "
        "grief made permanent in rust and metal, " + S
    ),
    'hellas_outer_relay_interior': (
        "interior of small isolated relay station, "
        "cramped communication equipment room, "
        "flickering screens showing static, "
        "tool marks from recent repair, "
        "oil stains indicating Cinder Grace was here recently, "
        "secret location, " + S
    ),
    'mcc_sector12_ruins': (
        "ruins of MCC Zone 12 in Hellas, "
        "collapsed habitat module from catastrophic failure, "
        "memorial chalk names on crumbling walls, "
        "11 dead from covered-up negligence, "
        "evidence of corporate crime, abandoned and ignored by MCC, " + S
    ),
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
    'sandstone_junction_dusk': (
        "Sandstone Junction crossroads at dusk on Mars, "
        "long shadows at three-way desert intersection, "
        "orange-red sky fading to purple, "
        "footprints in sand leading in and out of frame, "
        "recent meeting here, dust settling from departure, " + S
    ),
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
    'olympus_summit_station_interior': (
        "interior of Olympus summit station, "
        "circular conference chamber with glass walls above cloud line, "
        "three faction banners hung without bias, "
        "stars visible through ceiling dome, "
        "highest neutral ground in the solar system, " + S
    ),
    'olympus_summit_exterior_view': (
        "looking through reinforced glass of Olympus summit station exterior, "
        "three faction representatives visible inside through window, "
        "observer's perspective from outside looking in, "
        "thin Martian atmosphere pressing on the glass, "
        "the fourth eye watching the three flags negotiate, " + S
    ),
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
    'gaia_ship_interior': (
        "interior of the GAIA colony ship turned permanent Mars habitat, "
        "original Earth departure vessel now mothballed, "
        "cryo pods still visible behind glass, "
        "dusty corridors with 40-year-old Earth objects preserved, "
        "Hagar's memories walking through Earth's last ship, " + S
    ),
    'hellas_exterior_road': (
        "dusty road through outer Hellas Planitia, "
        "tire tracks in red Mars dust stretching to horizon, "
        "sparse habitat clusters visible in distance, "
        "lone traveler on a rover in the vast empty plain, "
        "journey between Mars settlements, " + S
    ),
}

# ──────────────────────────────────────────────────────────────────────────────
# 캐릭터 초상화 — 9:16 세로 전신(bust) 포맷
# ──────────────────────────────────────────────────────────────────────────────
CHAR_STYLE = (
    "pixel art character portrait, 32-bit RPG character illustration, "
    "semi-realistic pixel art, dark sci-fi Mars setting, "
    "dramatic lighting from below and side, detailed pixel shading, "
    "bust shot head and shoulders, strong silhouette, "
    "vertical portrait format, game visual novel character art"
)
CHAR_NEG = (
    "photorealistic, 3D render, anime, cartoon, full body, background details, "
    "blurry, watermark, text, chibi, deformed, landscape orientation"
)

CHARACTERS = {
    'chen_weiss': (
        "Chinese woman age 34, sharp intelligent face weathered by 22 years in MCC, "
        "short practical black hair with grey streak from stress, "
        "MCC senior operations coat with hidden CV insignia underneath, "
        "eyes that have seen too much and forgiven nothing, "
        "mother's legacy visible in her bearing, dual loyalties in her expression, " + CHAR_STYLE
    ),
    'butcher': (
        "grizzled man age 55, mine-scarred face like weathered red rock, "
        "Crow Vanguard military coat open at chest, CV insignia burned-in not sewn, "
        "17-year-old saved from a mine — now commands them, "
        "hands that built a militia from nothing, "
        "haunted eyes that calculate everything including human cost, " + CHAR_STYLE
    ),
    'cinder_grace': (
        "Black woman age 38, engineer's precision in every gesture, "
        "worn safety goggles pushed up on forehead, "
        "Zone 12 survivor's hollow look around the eyes, "
        "MCC coveralls cut down and repurposed, tools hanging from belt, "
        "someone who decided to burn it all down after watching 11 people die, " + CHAR_STYLE
    ),
    'mikhail': (
        "Russian man age 29, precise neat appearance even in FSP roughness, "
        "small round glasses, FSP coordinator badge, "
        "face of someone processing everything twice before speaking, "
        "new to Mars but adapts with frightening efficiency, "
        "intelligence work written in his too-careful eyes, " + CHAR_STYLE
    ),
    'liang_wei': (
        "Chinese female scientist in her 50s, weathered face from 30 years on Mars, "
        "round wire-frame glasses, practical researcher coat, "
        "intelligent determined eyes, geological sample badge, "
        "30 years of isolation and dedication visible in her face, " + CHAR_STYLE
    ),
    'yuna': (
        "young Korean woman age 22, short practical haircut, "
        "FSP colony worker uniform with red patch, "
        "born on Mars her entire life, fierce idealistic expression, "
        "father's grave is here so she will not leave, determined eyes, " + CHAR_STYLE
    ),
    'crow': (
        "mercenary fighter in their 30s, tactical breathing mask covering lower face, "
        "reflective tactical goggles, dark Crow Vanguard combat gear, "
        "canyon warrior aesthetic, dangerous and efficient, "
        "raised in Argyre canyons, shadow operative, " + CHAR_STYLE
    ),
    'aisha': (
        "Black female warrior age 28, natural hair with tactical band, "
        "Crow Vanguard insignia tattoo on neck, "
        "combat-worn jacket, earring from fallen comrade, "
        "fierce loyal expression, CV code of honor visible in bearing, " + CHAR_STYLE
    ),
    'hagar': (
        "elderly man age 75, last generation to remember Earth as Gaia, "
        "deeply weathered face, white stubble beard, "
        "FSP elder rank badge, old but piercing eyes full of memory, "
        "worn colony coat with 40 years of Mars patches, " + CHAR_STYLE
    ),
    'kenji': (
        "Japanese man age 35, thin wire-frame rectangular glasses, "
        "nondescript FSP worker uniform deliberately average looking, "
        "5 years no promotion — intelligence work, "
        "quiet watchful eyes that miss nothing, "
        "deliberately blending in but intelligence unmistakable, " + CHAR_STYLE
    ),
    'verk': (
        "non-binary navigator age 40, ear communications implant, "
        "Kariope cargo ship navigator uniform with rank patches, "
        "calm observant expression, seen every type of Mars traveler, "
        "practical and professional, space-worn competence, " + CHAR_STYLE
    ),
    'observer': (
        "mysterious figure with no faction allegiance, face partially obscured by shadow, "
        "neutral clothing with no insignia, "
        "eyes that observe without judgment, watching and recording everything, "
        "fourth perspective beyond three factions, cosmic watcher, "
        "glowing blue eyes in darkness, " + CHAR_STYLE
    ),
    'miner_anon': (
        "anonymous miner with full dust mask covering face, "
        "worn mining suit with ore stains, "
        "protective goggles reflecting light, "
        "identity deliberately hidden, whistleblower aesthetic, "
        "only their clenched gloved hands visible along with mask, " + CHAR_STYLE
    ),
    'miner_elder': (
        "elderly male miner age 65, face deeply lined from decades underground, "
        "short grey beard dusty with ore, old mining helmet pushed back, "
        "survivor of the Zone 4 strike 30 years ago, "
        "haunted experienced eyes, mining tools worn as jewelry almost, " + CHAR_STYLE
    ),
    'li_fang': (
        "Chinese woman age 45, MCC department head, "
        "immaculate corporate suit with ID badge, "
        "reading glasses, perfectly composed professional expression, "
        "someone who believes in order because she watched chaos kill people, "
        "corporate idealist now questioning everything, " + CHAR_STYLE
    ),
    'director_vale': (
        "MCC Director, imposing presence, "
        "age 60, silver hair precisely cut, "
        "high-collar executive coat with seven-star MCC insignia, "
        "face of someone who has made decisions that ended thousands of lives "
        "and considers that the cost of civilization, " + CHAR_STYLE
    ),
    'sera': (
        "young woman age 24, FSP medic, "
        "practical medical kit worn across chest, "
        "kind exhausted eyes, blood on her jacket that isn't hers, "
        "healer in a war zone, determined pacifist, "
        "hope written in every careful gesture, " + CHAR_STYLE
    ),
    'phoenix': (
        "CV warrior, gender ambiguous, age 30s, "
        "half-face tactical mask, one visible eye intense and calculating, "
        "CV scout gear, move like shadows, "
        "Butcher's most trusted operative after Aisha, "
        "fewer words than action, " + CHAR_STYLE
    ),
    'zhang': (
        "MCC internal security officer, age 40, "
        "regulation MCC uniform, ID scanner always at ready, "
        "tired face of someone enforcing rules they once believed in, "
        "Chen's contact inside MCC — or MCC's contact inside Chen, "
        "ambiguous loyalty, " + CHAR_STYLE
    ),
    'narrator': (
        "abstract cosmic presence, no clear face, "
        "silhouette that shifts like a heat mirage over red Mars dust, "
        "neither human nor alien, the planet's memory given form, "
        "observer of all three factions across 30 years, "
        "glowing horizon light, " + CHAR_STYLE
    ),
    'prologue_voice': (
        "a voice without a face, Mars itself speaking, "
        "abstract landscape horizon, red dust and thin blue light, "
        "the question of who belongs and who decides, "
        "player's first perception of Mars, "
        "threshold between Earth and the red planet, " + CHAR_STYLE
    ),
}

ALL_BACKGROUNDS = {**BACKGROUNDS_ORIGINAL, **BACKGROUNDS_NEW}


def generate_sd3(prompt, negative_prompt, output_path, aspect="9:16", model="sd3-medium"):
    """Stability AI SD3 API — 9:16 세로 포맷"""
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
        "aspect_ratio": aspect,
    }
    for attempt in range(3):
        try:
            resp = requests.post(
                url, headers=headers,
                files={"none": ""},
                data=data, timeout=120
            )
            if resp.status_code == 200:
                with open(output_path, "wb") as f:
                    f.write(resp.content)
                return True
            elif resp.status_code == 429:
                wait = 30 * (attempt + 1)
                print(f"    rate limited → {wait}s 대기...", flush=True)
                time.sleep(wait)
            else:
                print(f"    API {resp.status_code}: {resp.text[:200]}", flush=True)
                if attempt < 2:
                    time.sleep(10)
        except Exception as e:
            print(f"    exception: {e}", flush=True)
            if attempt < 2:
                time.sleep(10)
    return False


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(CHAR_DIR, exist_ok=True)

    force      = "--force"     in sys.argv
    bg_only    = "--bg-only"   in sys.argv
    char_only  = "--char-only" in sys.argv
    new_only   = "--new-only"  in sys.argv   # 신규 배경만
    chars_new  = "--chars-new" in sys.argv   # 새 캐릭터만 (기존 파일 없는 것)

    total_bg   = len(ALL_BACKGROUNDS)
    total_ch   = len(CHARACTERS)
    # SD3 medium ≈ 3.5 credits/image
    est_credits = (total_bg + total_ch) * 3.5
    print(f"배경 {total_bg}개 + 캐릭터 {total_ch}개 = 총 {total_bg+total_ch}개")
    print(f"예상 크레딧: ~{est_credits:.0f} (SD3 medium 3.5cr/장)")
    print(f"모드: force={force}, bg_only={bg_only}, char_only={char_only}, new_only={new_only}\n")

    # ── 배경 ──────────────────────────────────────────────────────────────────
    if not char_only:
        target_bgs = BACKGROUNDS_NEW if new_only else ALL_BACKGROUNDS
        print(f"=== 배경 이미지 생성 ({len(target_bgs)}개) ===")
        done = fail = 0
        for i, (name, prompt) in enumerate(target_bgs.items(), 1):
            out = os.path.join(OUT_DIR, f"{name}.png")
            if os.path.exists(out) and not force:
                sz = os.path.getsize(out)
                if sz > 80_000:  # >80KB = 실제 이미지 (가로포맷도 건너뜀)
                    print(f"  [{i:3d}/{len(target_bgs)}] ✓ {name} (skip, {sz//1024}KB)")
                    done += 1
                    continue
            print(f"  [{i:3d}/{len(target_bgs)}] → {name}...", end=" ", flush=True)
            ok = generate_sd3(prompt, NEG, out)
            if ok:
                sz = os.path.getsize(out)
                print(f"✓ ({sz//1024}KB)")
                done += 1
            else:
                print("✗ 실패")
                fail += 1
            time.sleep(2)
        print(f"\n배경 완료: {done}성공 / {fail}실패\n")

    # ── 캐릭터 ────────────────────────────────────────────────────────────────
    if not bg_only:
        target_chars = {k: v for k, v in CHARACTERS.items()
                        if chars_new and not os.path.exists(os.path.join(CHAR_DIR, f"{k}.png"))
                        } if chars_new else CHARACTERS
        print(f"=== 캐릭터 초상화 생성 ({len(target_chars)}개) ===")
        done = fail = 0
        for i, (name, prompt) in enumerate(target_chars.items(), 1):
            out = os.path.join(CHAR_DIR, f"{name}.png")
            if os.path.exists(out) and not force:
                sz = os.path.getsize(out)
                if sz > 80_000:
                    print(f"  [{i:2d}/{len(target_chars)}] ✓ {name} (skip, {sz//1024}KB)")
                    done += 1
                    continue
            print(f"  [{i:2d}/{len(target_chars)}] → {name}...", end=" ", flush=True)
            ok = generate_sd3(prompt, CHAR_NEG, out)
            if ok:
                sz = os.path.getsize(out)
                print(f"✓ ({sz//1024}KB)")
                done += 1
            else:
                print("✗ 실패")
                fail += 1
            time.sleep(2)
        print(f"\n캐릭터 완료: {done}성공 / {fail}실패")

    print("\n전체 완료.")
    # 최종 집계
    bg_cnt  = len(os.listdir(OUT_DIR))
    ch_cnt  = len(os.listdir(CHAR_DIR))
    print(f"현재 파일 수 — 배경: {bg_cnt}개 / 캐릭터: {ch_cnt}개")


if __name__ == "__main__":
    main()
