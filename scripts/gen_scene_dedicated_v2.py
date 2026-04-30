#!/usr/bin/env python3
"""
Occupy Mars — 씬 대본 기반 전용 배경 (104개) 9:16 mobile-first

A안: 전 라인 hand-crafted 영문 프롬프트.
- 9:16 세로
- 캐릭터 / 사물 / 행동 명시
- KO 대사를 영문 visual elements 로 직접 변환
- 골드 스탠다드 hellas_central_exterior 수준 디테일 목표

run:
  python3 scripts/gen_scene_dedicated_v2.py            # all
  python3 scripts/gen_scene_dedicated_v2.py --test 5   # 처음 5개
  python3 scripts/gen_scene_dedicated_v2.py --filter cv_ch1   # 챕터 prefix 필터
  python3 scripts/gen_scene_dedicated_v2.py --dry-run
"""

import json
import os
import sys
import time

from google import genai
from google.genai import types

PROJECT = 'gen-lang-client-0351298739'
LOCATION = 'us-central1'
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'campaign', 'backgrounds')
INPUT_JSON = '/tmp/overlay_scenes.json'
MAPPING_OUT = '/tmp/scene_bg_mapping.json'

client = genai.Client(vertexai=True, project=PROJECT, location=LOCATION)

STYLE = (
    "MASTERPIECE detailed 32-bit pixel art game background, hand-painted matte painting style "
    "with EXTREME intricate dense pixel detail on every surface — every brick stained, "
    "every metal panel scratched, every rock weathered, every wire visible, "
    "complex multi-layered cinematic composition with deep foreground midground and far background, "
    "tightly packed environmental detail filling EVERY square pixel — "
    "scattered debris, drifting dust particles, atmospheric haze layers, "
    "graffiti and chalked names on walls, rust streaks, oil stains, hand prints, scuffed paint, exposed wiring and pipes, "
    "wear-and-tear realism rendered in pixel art, "
    "Simon Stalenhag concept art quality crossed with Studio Ghibli mood, "
    "vertical 9:16 portrait composition optimized for full-bleed mobile display, "
    "every vertical inch densely populated with story-relevant detail and texture, "
    "dark moody Mars sci-fi palette — deep crimson, amber, ash-grey, oxidized brass, "
    "rich tonal layering with multiple distinct lighting sources, dramatic chiaroscuro, volumetric atmospheric light shafts, "
    "background depth showing distant Mars vista or interior structures receding into shadow, "
    "EXTREMELY HIGH RESOLUTION pixel art with crisp edge detail, "
    "no text no logos no UI no watermark"
)

# ── 캐릭터 시각 디스크립션 (재사용 가능) ────────────────────────────────────
CHAR = {
    'butcher': "Butcher Vasquez (heavyset man late 40s, grizzled stubbled face, mining-grade prosthetic LEFT arm of weathered scarred steel built at age 17 and worn for 30 years, scarred dust-coat, Crow Vanguard mercenary leader)",
    'cinder': "Cinder Grace (lean woman 30s, tool belt with miners' flat-knife, intense quiet eyes, oil-stained jumpsuit)",
    'reza': "Reza (calm middle-aged man, weathered hands resting still on his knees, eyes closed in deliberation)",
    'aisha': "Aisha (black warrior woman 28, natural hair with tactical band, Crow Vanguard code tattoo on neck, memorial earring)",
    'lena': "Lena (FSP medic woman 30s, intricate forearm tattoo of names with dates of disappearance on her left arm)",
    'liang_wei': "Liang Wei (Chinese woman 55, weathered face from 30 years alone on Mars, round wire glasses, geology fieldwork coat, ancient ore sample in pocket)",
    'yuna': "Yuna (22yo Korean woman, short black hair, FSP colony worker uniform with red solidarity patch)",
    'chen': "Chen Weiss (late 50s Chinese-Mars MCC executive woman, perfect grey suit, holding a teacup she never sips, unsmiling closed face, parents were Mars miners)",
    'lifang': "Li Fang (MCC operations officer late 30s, clipboard discipline, hidden moral conscience behind professional mask)",
    'mikhail': "Mikhail (aging FSP elder man, weathered hands, FSP chair seat, calm authority)",
    'olu': "Olu Adeyemi (40s ship designer, writing by hand on paper at a corner desk, intense focus)",
    'hagar': "Hagar (75yo elder, last generation that remembers Earth as 'Gaia', deeply lined face, FSP elder insignia)",
    'kenji': "Kenji Tanaka (Japanese man 35, plain wire-frame glasses, deliberately nondescript appearance, watchful eyes)",
    'rev_hale': "Rev. Hale (religious leader figure, weathered preacher's coat, hands clasped)",
    'observer': "the Observer (mysterious neutral figure with no faction insignia, face half-obscured)",
    'crow': "the Crow (tactical dust-mask covering lower face, reflective visor goggles, Crow Vanguard combat gear)",
    'kara_vex': "Kara Vex (sharp-featured pirate captain, scarred jaw, dust-marked leather)",
    'miner_anon': "anonymous miner with full dust respirator mask, worn pressure suit with ore stains",
    'miner_elder': "elderly miner 65, deeply carved face, short grey ore-dust beard, old mining helmet",
}

# ── 라인별 hand-crafted prompts ──────────────────────────────────────────────
# Format: bg_id -> English prompt (chapter context + character + action + style)
# bg_id pattern: {chapter}_l{scene_idx:02d}_{line_idx:02d}_{overlay_slug}

PROMPTS = {
  # ═══ CV CH10 from_flames (5) ═══
  'cv_ch10_from_flames_l00_00_fire_small': (
    "Erebus Crater throne hall on Mars at deep night, multiple oil-barrel fires burning along iron pillars, "
    f"{CHAR['butcher']} sits ALONE at a heavy mining-table in the center of the chamber, "
    "an old black-and-white photograph laid face-up on the table for the first time after 30 years in his coat pocket, "
    "his prosthetic left arm resting on the table edge, "
    "warm orange flame-light flickering across his stubbled face, deep shadows in the throne hall behind, "
    "a moment of solitary reckoning before passing the photograph on, "
    + STYLE),
  'cv_ch10_from_flames_l14_00_hand_still': (
    "Crow Vanguard throne hall, close low-angle on the mining-grade prosthetic LEFT arm of weathered scarred steel laid on a battered table, "
    f"{CHAR['butcher']} hands hovering above it, {CHAR['cinder']} just behind with tools, "
    "the prosthetic carries 30 years of dents and re-welds, this is the moment of succession — wordless, no document, "
    "single torch-flame illuminating exposed gears and oil-stained joints, "
    + STYLE),
  'cv_ch10_from_flames_l20_00_death_still': (
    "Erebus throne hall, "
    f"{CHAR['butcher']} extending an old folded photograph toward someone offscreen WITH HIS RIGHT HUMAN HAND (NOT the prosthetic), "
    "the photo shows blurred miners 30 years ago, the right hand calloused and steady, "
    "first time in 30 years this photo leaves the pocket and is offered to another, "
    "torchlight catches the worn paper edges, "
    + STYLE),
  'cv_ch10_from_flames_l32_04_zone12_record': (
    "Erebus crater exterior at red dusk, a small stone monument among scattered rocks, "
    "ELEVEN names of the Zone 12 dead carefully chiseled into a crude metal plate bolted to the rock, "
    "fresh-cut letters catching dust-storm horizon light, "
    "this is the first OFFICIAL marker for victims that MCC erased from records, "
    + STYLE),
  'cv_ch10_from_flames_l39_00_candle_flame': (
    "Erebus throne hall after the battle, single candle flame burning steadily in the foreground, "
    f"{CHAR['butcher']} placing the old photograph back into his coat pocket SLOWLY with both hands (right human hand and left prosthetic), "
    f"{CHAR['cinder']} working tools quietly in the background background, the Crow watching the door, "
    "the chapter's quiet endurance — fire, people, tools, enough, "
    + STYLE),

  # ═══ CV CH1 baptism (3) ═══
  'cv_ch1_baptism_l02_00_fire_small': (
    "Erebus Crater volcanic-rock interior, "
    f"{CHAR['butcher']} sitting close to a barrel-fire, FIRELIGHT FALLING ON HIS LEFT MINING-GRADE PROSTHETIC ARM "
    "(weathered exposed gears, hand-built at 17 after MCC denied accident compensation, 30 years old still working), "
    "his face half-shadowed, the same arm he's worn for three decades, "
    "warm orange flame illuminating dust-coat and prosthetic joints, "
    + STYLE),
  'cv_ch1_baptism_l29_00_mars_horizon': (
    "View from Erebus crater rim looking up at the night Martian sky, "
    "starfield piercing through the thin Martian atmosphere with unusual clarity, "
    "stars are sharp and bright but cold, no warmth in their light at this temperature, "
    "deep red-violet horizon glow at the bottom of frame, the rim's silhouette in shadow, "
    "lonely beauty of Mars seen from the warrior's position, "
    + STYLE),
  'cv_ch1_baptism_l41_00_candle_flame': (
    "CV throne hall lit by a single small candle flame at center, "
    f"{CHAR['aisha']} (with sister name 'Aisha' as memorial, eyes wet) and {CHAR['reza']} (calm) facing each other, "
    "Reza's eyes carrying unspoken meaning of one name still alive, "
    "candlelight throws long shadows along the rough volcanic walls, "
    "intimate moment of recognition between two CV members, "
    + STYLE),

  # ═══ CV CH2 raid (2) ═══
  'cv_ch2_raid_l26_00_dust_storm': (
    "Inside a category-4 Martian dust storm, total visibility zero, sound annihilated by wind, "
    "FIVE Crow Vanguard operatives moving in single line HOLDING EACH OTHER'S HANDS through the orange-red opacity, "
    "only the rough silhouettes visible, prosthetic arms and tactical gear barely defined, "
    "the storm fills the entire frame, dust eats every detail, "
    "the only way to survive together, "
    + STYLE),
  'cv_ch2_raid_l32_00_hand_fist': (
    "Argyre canyon floor at deep night, sheer red rock walls towering on both sides, narrow strip of starfield above, "
    f"{CHAR['butcher']} waiting alone, his left mining-grade prosthetic CLENCHED INTO A FIST receiving the after-action report, "
    "no words spoken, the prosthetic's slow movement is the only acknowledgement, "
    "long shadow cast by canyon walls, single distant cooking fire glow, "
    + STYLE),

  # ═══ CV CH3 mine_king (2) ═══
  'cv_ch3_mine_king_l19_00_hand_still': (
    "Crow Vanguard interior hold, "
    f"{CHAR['reza']} sitting with EYES CLOSED, hands UNBOUND resting motionless on his knees, NOT TREMBLING, "
    "thinking deeply for a long time, the way of someone deciding from strength, "
    "single warm wall-torch casts side-light across his composed face, "
    "shadows of CV pillars in the background, "
    + STYLE),
  'cv_ch3_mine_king_l48_00_fire_small': (
    "Erebus base interior at deep night, fire still burning low in the central pit, "
    f"{CHAR['cinder']} just finishing some quiet repair work in the corner with tools, "
    f"{CHAR['butcher']} sitting before the fire LOOKING DOWN AT HIS LEFT PROSTHETIC ARM (built at 17, 30 years old, still working), "
    "thoughtful introspection on weathered hands, fire reflecting on the prosthetic gears, "
    + STYLE),

  # ═══ CV CH4 cinder (3) ═══
  'cv_ch4_cinder_l10_02_collapse_debris': (
    "Mars mine shaft 3 years after a fatal tunnel collapse — wreckage of broken rock support beams and twisted ore conveyors, "
    f"{CHAR['cinder']} with flat expression standing in the foreground gesturing at the disaster, "
    "MCC erased this from records, the collapse remains physically real but officially deleted, "
    "harsh single overhead emergency-bulb light catching the debris, deep shadow elsewhere, "
    + STYLE),
  'cv_ch4_cinder_l17_00_sealed_file': (
    "Mine shaft side chamber, "
    f"{CHAR['cinder']} taking a SMALL FOLDED PAPER REPORT from her pocket, the paper has been folded MANY TIMES — "
    "soft creases multiplied by years of unfolding and refolding — "
    "ELEVEN names written on it, the most precious object she carries, "
    "her oil-stained fingers handle it like glass, "
    + STYLE),
  'cv_ch4_cinder_l27_00_candle_flame': (
    "Underground chamber, single candle flame burning steadily, "
    f"{CHAR['cinder']} reading aloud the eleven names from her folded paper, "
    "no explanation given, names alone suffice, the paper unfolded fully now, "
    "the candle wax already pooled, the eleven small flames of remembrance, "
    + STYLE),

  # ═══ CV CH5 kepler_king (3) ═══
  'cv_ch5_kepler_king_l21_00_hand_still': (
    "Kepler crater rim at red dusk on Mars, "
    f"{CHAR['butcher']} listening with his RIGHT HAND IN HIS COAT POCKET TOUCHING the hidden 30-year-old photograph "
    "(but not taking it out yet), tense moment of decision, "
    "miners visible in the distance silhouette below the rim, "
    "the hand inside the coat is the silent conflict, "
    + STYLE),
  'cv_ch5_kepler_king_l27_00_death_still': (
    "Kepler crater edge at deep dusk, miners striking their helmets in protest in the background, "
    f"{CHAR['butcher']} foreground center FINALLY TAKING THE 30-YEAR-OLD PHOTOGRAPH OUT for the FIRST TIME in 30 years, "
    "his hands tremble slightly, the weight of three decades of secrecy breaking, "
    "long crimson shadows across the basin, "
    + STYLE),
  'cv_ch5_kepler_king_l37_00_death_still': (
    "Kepler crater edge dusk, "
    f"{CHAR['butcher']} taking out the same photograph A SECOND TIME (twice in 30 years, both today), "
    "comparing miners in the photo to miners around him today, looking back and forth, "
    "different people, same reason, same place, "
    "violet horizon and the photo edge weathered to softness, "
    + STYLE),

  # ═══ CV CH6 thirty_years (4) ═══
  'cv_ch6_thirty_years_l01_00_death_still': (
    "Erebus throne hall, "
    f"{CHAR['butcher']} seated holding the old black-and-white photograph OUT OF HIS POCKET FOR THE FIRST TIME, "
    "the photo shows multiple miners 30 years ago, ONE OF THEM resembles a 17-year-old Butcher himself, "
    "this is the moment of acknowledged self-recognition, "
    "torchlight reveals decades of pocket-wear on the photo edges, "
    + STYLE),
  'cv_ch6_thirty_years_l07_02_sealed_file': (
    "Erebus throne hall close on the BACK of the photograph held in Butcher's hand, "
    "names written on the paper backside in faded pencil, "
    f"{CHAR['butcher']} speaking — names ARE everything, names made what CV is, "
    "amber torch-glow catching the worn paper grain, "
    + STYLE),
  'cv_ch6_thirty_years_l21_00_zone12_record': (
    "Erebus throne hall, "
    f"{CHAR['cinder']} laying additional Zone 12 records on the table beside Butcher's photograph, "
    "small documents of more recent deaths echoing the 30-year-old names, "
    "single chamber lantern, "
    + STYLE),
  'cv_ch6_thirty_years_l38_02_candle_flame': (
    "Erebus throne hall, candle flame between Butcher and an initiate, "
    f"{CHAR['butcher']} indicates an EMPTY SPACE on the back of the photograph where a NEW NAME will be written — passing the test, "
    "intimate transfer of trust, the candle highlights the empty paper space, "
    + STYLE),

  # ═══ CV CH7 last_war (3) ═══
  'cv_ch7_last_war_l00_00_death_still': (
    "Erebus base interior, "
    f"{CHAR['butcher']} COLLAPSED on the floor of his base, ALONE, his MINING-GRADE PROSTHETIC LEFT ARM DETACHED and lying separately on the ground beside him, "
    "the prosthetic he has worn for 30 years is OFF — first time anyone has seen him without it — "
    f"{CHAR['cinder']} just discovering the scene, deep concern on her face, "
    "harsh emergency lighting, the prosthetic on the ground catches metallic glints, "
    + STYLE),
  'cv_ch7_last_war_l23_00_death_still': (
    "Erebus throne hall during a tense negotiation, "
    f"{CHAR['butcher']} taking out the photograph DURING WORK for the FIRST TIME (broke his own rule), "
    "flipping it over to look at the names on the back — old 30-year names AND new Zone 12 names added recently, "
    "negotiation partners watching across the table, "
    + STYLE),
  'cv_ch7_last_war_l39_00_fire_small': (
    "Erebus base interior at deep night, multiple oil-barrel fires burning, "
    f"{CHAR['butcher']} sitting before a barrel-fire, photo IN HIS POCKET (not taken out), "
    f"{CHAR['cinder']} touching tools soundlessly in background, "
    "the way the base exists tonight: fire, people, tools — enough, "
    + STYLE),

  # ═══ CV CH8 red_parliament_cv (3) ═══
  'cv_ch8_red_parliament_cv_l03_00_hand_still': (
    "Argyre plains at dusk before battle, "
    f"{CHAR['butcher']} in his weathered coat, RIGHT HAND INSIDE COAT POCKET TOUCHING the photograph silently — "
    "his pre-battle ritual for 30 years, touching the names without speaking, "
    "this is preparation, deep red horizon stretching behind him, "
    + STYLE),
  'cv_ch8_red_parliament_cv_l15_00_death_still': (
    "Erebus throne hall during corporate confrontation, "
    f"{CHAR['butcher']} placing the photograph FACE-DOWN ON THE TABLE for the first time, "
    "BOTH HANDS bracing the table edge — left mining-prosthetic and right human hand together, "
    "names visible on the paper backside, "
    "single overhead lamp on the table, the rest in shadow, "
    + STYLE),
  'cv_ch8_red_parliament_cv_l37_02_death_still': (
    "Argyre plains at dusk after the showdown, "
    f"{CHAR['butcher']} standing over a body or kneeling figure, holding photograph as evidence, "
    "his decision visible — 'You are next', "
    "deep crimson sky and wind-blown dust, "
    + STYLE),

  # ═══ CV CH9 olympus (3) ═══
  'cv_ch9_olympus_l08_00_zone12_record': (
    "Olympus Mons summit station diplomatic chamber, "
    f"{CHAR['cinder']} laying out the old black-and-white photograph and Zone 12 records on the long table, "
    "next to the formal MCC-prepared agreement draft documents, "
    "the photograph and the corporate documents ON THE SAME TABLE — "
    "three faction flags visible behind the windows, "
    + STYLE),
  'cv_ch9_olympus_l42_02_contract_sign': (
    "Olympus summit station, close on a hand SIGNING a document with the explicit signature line "
    "'Zone 12 survivor' written instead of an official faction title, "
    "ink pen in calloused fingers, the document beside the old photograph, "
    "single overhead workstation light, "
    + STYLE),
  'cv_ch9_olympus_l47_00_zone12_record': (
    "Olympus Mons summit station after signing, ELEVEN ZONE 12 NAMES now appearing on the formal agreement document, "
    "three faction signatures around them — the names finally official, "
    f"{CHAR['cinder']} touching her tools soundlessly, the tool-sound is THE signature of this moment, "
    "vast Mars panorama through the dome window in the distance, "
    + STYLE),

  # ═══ FSP CH10 freedoms_price (3) ═══
  'fsp_ch10_freedoms_price_l17_05_candle_flame': (
    "Hellas mining village at dawn, "
    f"{CHAR['rev_hale']} looking at THE WALL of names — wall of small name plates and chalk markers, "
    "single candle in his hand reflecting on the wall surface, dawn light barely creeping in, "
    "weathered preacher's coat, hands clasped, "
    + STYLE),
  'fsp_ch10_freedoms_price_l24_05_death_still': (
    "New Athens shipyard interior, "
    f"{CHAR['olu']} speaking with subdued grief, his hand on a small inscribed name plate engraved 'Mariam' (his daughter's name from a stillbirth on Mars), "
    "deep amber pre-dawn light through the dock windows, "
    "single tear catching the light, "
    + STYLE),
  'fsp_ch10_freedoms_price_l36_03_mars_horizon': (
    "FSP shipyard launch view at dawn — the colossal warship 'Mariam' (renamed from Gaia) ASCENDING into the red Mars sky, "
    "bright engine plume painting amber on the dust, the name 'Mariam' barely visible on the hull, "
    "the ship CARRYING THAT NAME upward — the daughter who never lived now flying, "
    + STYLE),

  # ═══ FSP CH1 breakwater (2) ═══
  'fsp_ch1_breakwater_l24_00_death_still': (
    "Mine shaft after rescue, "
    f"{CHAR['lena']} kneeling in the foreground with a recovered miner Park Sung-jin (alive), "
    "she's looking at her LEFT FOREARM TATTOO of names with dates — and FINDS HIS NAME living before her, "
    "her tattoo's most recent inscription PARK SUNG-JIN highlighted by a portable medical lamp, "
    "deep relief on her face, the rescued man unconscious but breathing, "
    + STYLE),
  'fsp_ch1_breakwater_l30_00_candle_flame': (
    "Hellas mining village at dawn, single candle flame steady on a small bedside table, "
    f"{CHAR['lena']} sitting beside Park Sung-jin (lying down recovering), no words exchanged, "
    "her tattooed left forearm visible — the LIVING NAME present in flesh now, "
    "warm dawn light beginning to color the room, "
    + STYLE),

  # ═══ FSP CH2 ice_caravan (2) ═══
  'fsp_ch2_ice_caravan_l02_00_death_still': (
    "Mine shaft 7 on outer Hellas, MCC TERRITORY, recent tunnel collapse with unrecovered body partially visible, "
    "sealed-off MCC barrier tape, no notification ever sent to family, "
    "harsh emergency lighting on dust and broken support beams, "
    "this is how miners die on Mars: silence is the notice, "
    + STYLE),
  'fsp_ch2_ice_caravan_l27_00_candle_flame': (
    "FSP base at deep night, single candle on a small table, "
    f"{CHAR['lena']} alone looking at her LEFT FOREARM in candlelight, the tattoo of names visible, "
    "under SOME of the names there are DATES — the day each person disappeared — engraved into her skin, "
    "her finger traces one date slowly, "
    + STYLE),

  # ═══ FSP CH3 blood_mine (2) ═══
  'fsp_ch3_blood_mine_l02_00_candle_flame': (
    "Hellas mining village cemetery at dusk, mixed name markers — chalk-written, metal plates, old and new mixed together, "
    "single candle burning before one marker, "
    "no orders specify what to do with this cemetery, the names are simply there, "
    "deep red sky bleeding into violet, "
    + STYLE),
  'fsp_ch3_blood_mine_l10_00_death_still': (
    "Hellas mining village at night during fire-discussion, "
    f"{CHAR['yuna']} looking toward the cemetery in the dark, "
    "metal name plates GLINTING in the firelight from the village square fires, "
    "the names seem to be listening to the live debate happening, "
    "the question — protect a place of names or protect people who have names — "
    + STYLE),

  # ═══ FSP CH4 diplomacy (3) ═══
  'fsp_ch4_diplomacy_l09_00_zone12_record': (
    "Sandstone Junction crossroads at sunset, "
    f"{CHAR['cinder']} indicating the name 'Zone 12' carved on a small stone marker between paths, "
    "scattered footprints in the red sand, three-way meeting place, "
    "low long shadows, the name visible, "
    + STYLE),
  'fsp_ch4_diplomacy_l21_00_hand_fist': (
    "Sandstone Junction at deep dusk, "
    f"{CHAR['cinder']} taking a small flat MINING KNIFE from her tool belt, "
    "DRAWING IT ACROSS HER OWN LEFT PALM slowly without sound — fresh blood beading, "
    "the gesture of binding oath in CV tradition, palm blood on red sand, "
    + STYLE),
  'fsp_ch4_diplomacy_l43_00_zone12_record': (
    "Sandstone Junction crossroads with NO ONE THERE, sun low, sand turned deep red, "
    "FOOTPRINTS scattered in THREE DIFFERENT DIRECTIONS, the meeting just ended, "
    "a small Zone 12 name carved on the rock corner, "
    "promise hangs in the wind, MCC-FSP-CV alliance moment, "
    + STYLE),

  # ═══ FSP CH5 kepler_commons (3) ═══
  'fsp_ch5_kepler_commons_l04_02_ore_sample': (
    "Kepler crater research outpost interior, "
    f"{CHAR['liang_wei']} holding up a small piece of ANCIENT METAL ore sample (extraterrestrial origin, dark silvery glint), "
    "her face determined as she declares it belongs to Mars, not to MCC/FSP/CV, "
    "30 years of research in the room around her, "
    "warm work-light catching the alien metal, "
    + STYLE),
  'fsp_ch5_kepler_commons_l14_00_darkness_corridor': (
    "Mars settlement narrow corridor at night, "
    "MULTIPLE PEOPLE passing small data sticks HAND TO HAND in low light, "
    "the oldest method of spreading information on Mars — physical, person to person, NOT digital, "
    "single dim corridor lamp, anonymous figures in motion, "
    + STYLE),
  'fsp_ch5_kepler_commons_l37_00_mars_horizon': (
    "Kepler crater turning RED at sunset, the long deep impact basin filling with dying light, "
    f"{CHAR['liang_wei']} standing on the rim looking at the crater she watched alone for 30 years — "
    "today for the FIRST TIME with others, the moment 'alone became shared' — the declaration, "
    "Ancient Metal data documents tucked under her arm, "
    + STYLE),

  # ═══ FSP CH6 the_mole (2) ═══
  'fsp_ch6_the_mole_l11_00_sealed_file': (
    "Hellas Central exterior at night, hidden alley, "
    f"{CHAR['kenji']} handing a SMALL DATA STICK to someone offscreen, "
    "the package contains Liang Wei's backup AND 5 years of MCC internal communications — small but heavy, "
    "single recessed corridor LED catches both hands meeting, "
    + STYLE),
  'fsp_ch6_the_mole_l27_00_death_still': (
    "FSP base at night, "
    f"{CHAR['lena']} looking at her LEFT FOREARM tattoo of names — "
    "her finger pauses on PARK SUNG-JIN, Mine 7, three repair refusals — "
    "the painful suspicion that the FSP mole may have caused that death, "
    "single candle on table, the tattoo visible in shadow, "
    + STYLE),

  # ═══ FSP CH7 assembly (3) ═══
  'fsp_ch7_assembly_l21_00_dust_storm': (
    "FSP Hellas Central Assembly Hall during scale-4 dust storm, "
    "DUST POUNDING the tall reinforced windows from outside, lights flickering as power switches to emergency, "
    "circular democratic assembly seating in the foreground (eleven chairs), "
    "the windows STILL THERE despite the storm, "
    "low amber emergency lighting, "
    + STYLE),
  'fsp_ch7_assembly_l36_00_alone_window': (
    "FSP assembly hall, "
    f"{CHAR['mikhail']} ALONE standing before the tall reinforced window after assembly, "
    "the MINES VISIBLE through the dust outside — even in storm, the mines visible — "
    "that's why these specific windows were built, "
    "his weathered hand on the glass, "
    + STYLE),
  'fsp_ch7_assembly_l40_00_candle_flame': (
    "FSP assembly hall after the session, "
    f"{CHAR['mikhail']} alone with a single candle burning on his desk, "
    "still standing before the window watching the distant mine lights through the storm, "
    "names of mine workers gave this organization meaning, "
    "names outlast organization — that knowledge in his face, "
    + STYLE),

  # ═══ FSP CH8 water_war (3) ═══
  'fsp_ch8_water_war_l06_00_death_still': (
    "New Athens shipyard interior at night, "
    f"{CHAR['olu']} 40s ship designer in a quiet corner, WRITING BY HAND on physical paper "
    "(a rare act on Mars where digital is easier) — focused intensity, single desk lamp, "
    "shipyard machinery silhouetted in distance through observation glass, "
    + STYLE),
  'fsp_ch8_water_war_l35_00_mars_horizon': (
    "New Athens shipyard at dawn, FIRST LIGHT touching the side of the FSP warship 'GAIA' (ancient name for Earth), "
    f"{CHAR['hagar']} (last generation that remembers Earth) watching from the dock, "
    "the name carved into the hull catching dawn — names outlast those who remember, "
    "deep amber light spreading across the construction docks, "
    + STYLE),
  'fsp_ch8_water_war_l39_00_candle_flame': (
    "New Athens shipyard at dawn, single candle burning near the GAIA's hull as a benediction, "
    f"{CHAR['hagar']} standing with deep age-lined hands clasped, "
    "Olu's hand-written letter inside the ship — or maybe not — Mariam's name written on it, "
    "the name carried in the ship, "
    + STYLE),

  # ═══ FSP CH9 last_harvest (3) ═══
  'fsp_ch9_last_harvest_l08_05_death_still': (
    "Olympus Mons summit station diplomatic chamber, "
    f"{CHAR['rev_hale']} placing a list of names on the table in the foreground, "
    "speaking — these names come FIRST in any agreement, "
    "three faction flags in the background, the table surface pristine and the list small, "
    + STYLE),
  'fsp_ch9_last_harvest_l10_00_zone12_record': (
    "Olympus summit station, "
    f"{CHAR['cinder']} adding 'Zone 12' to the list — placing the old folded paper of eleven names beside Rev Hale's list, "
    "two lists of dead becoming one document, "
    "single chamber overhead light catches both papers, "
    + STYLE),
  'fsp_ch9_last_harvest_l49_06_contract_sign': (
    "Olympus summit station signing close-up, "
    "an additional signature line newly added — 'And Ramos. The assassin's signature too.' — "
    "ink pen completing the rare fourth signature on the agreement, "
    "the document held by trembling hands, "
    + STYLE),

  # ═══ HIDDEN CH1 observer (4) ═══
  'hidden_ch1_observer_l07_00_hand_still': (
    "Hellas Central exterior wall, close on a SMALL FAINT HANDPRINT — child-sized — stamped in red Mars dust on the corporate wall, "
    "the Observer's gloved hand reaching toward it but not touching, "
    "fine grain of red Mars sand in the print, "
    "the meaning unknown, but a small hand was here, "
    + STYLE),
  'hidden_ch1_observer_l14_00_candle_flame': (
    "Mine shaft exterior, single candle flame burning in front of an MCC official notice, "
    "BENEATH the bureaucratic legal text, several SMALL HANDWRITTEN NAMES (3, 4, 5) carefully written in chalk — "
    "MCC text large, names small but THERE, "
    "the names exist — that is what matters, "
    + STYLE),
  'hidden_ch1_observer_l21_00_collapse_debris': (
    "Burnt-black wall of an empty Hellas mining village house, "
    "MULTIPLE BLACKENED HANDPRINTS on the wall ALL POINTING TOWARD AN EXIT — "
    "people braced themselves on the wall as they fled the fire, "
    "soot, char, and one direction of escape, "
    "single beam of dust-light from outside, "
    + STYLE),
  'hidden_ch1_observer_l24_00_sealed_file': (
    "Hellas Zone 4 ruins at dusk, a SMALL UNOFFICIAL STONE GRAVE MARKER beside a faded MCC sign, "
    "names ENGRAVED into the stone but DELIBERATELY ERASED — scratched out either by hand or by time, "
    "the Observer's fingers tracing the empty grooves, "
    "weathered red dust accumulated in the cracks, "
    + STYLE),

  # ═══ HIDDEN CH2 traces (3) ═══
  'hidden_ch2_traces_l01_00_candle_flame': (
    "Empty miners' village at night, dim chalk light, "
    "wall covered in HANDWRITTEN NAMES IN CHALK — name 'KIM YONG-JIN' largest at top, "
    "many other names below in different handwriting, "
    "single candle flame at the wall base, "
    "they wrote MORE because they knew chalk was fragile, "
    + STYLE),
  'hidden_ch2_traces_l23_00_zone12_record': (
    "MCC Sector 12 ruins, close on a SMALL HANDWRITTEN NOTE pinned beneath an old photograph, "
    "note reads 'Zone 12. We were here.' — names and a date written above, "
    "weathered paper texture, "
    "single beam of dust-filtered light, "
    + STYLE),
  'hidden_ch2_traces_l28_00_death_still': (
    "Erebus base interior, "
    "an old black-and-white photograph laid CENTERED on a battered table, "
    "NO DUST on the photograph though dust covers everything else — "
    "this is looked at often, or wiped recently, "
    "single torch lighting it, "
    + STYLE),

  # ═══ HIDDEN CH3 fourth_flag (4) ═══
  'hidden_ch3_fourth_flag_l03_00_three_flags': (
    "Olympus Mons exterior vast vista, "
    "THREE EMPTY FLAG-MOUNTING HOLES IN A TRIANGLE in the rock, larger than the Sandstone ones, "
    "the EMPTY CENTER OF THE TRIANGLE significant, "
    "wind-blown dust drifting through the holes, "
    "stark midday Martian sky, "
    + STYLE),
  'hidden_ch3_fourth_flag_l05_00_death_still': (
    "Olympus exterior, the Observer LOOKING DOWN AT THE GROUND, finding OLD BLOODSTAINS, "
    "color slightly DARKER than Mars red — clearly blood that has been there a long time, "
    "the planet's red surface tries to hide blood but a careful eye sees the difference, "
    "someone died here, "
    + STYLE),
  'hidden_ch3_fourth_flag_l11_00_sealed_file': (
    "Olympus exterior at dawn, the Observer holding a TORN PIECE OF FLAG FABRIC found apart from the three holes, "
    "color INDETERMINATE — not red blue or green of the three factions, "
    "Mars dust has aged it, but it's clearly a FOURTH color, "
    "dawn light just beginning to reveal hue, "
    + STYLE),
  'hidden_ch3_fourth_flag_l28_00_mars_horizon': (
    "Olympus exterior at full dawn, the FOURTH FRAGMENT now revealed as WHITE under direct light, "
    "a white flag piece against the red Mars dust, "
    "horizon glow making the white seem almost luminous, "
    "the meaning of the white flag — Pilgrim Arms — still mysterious, "
    + STYLE),

  # ═══ HIDDEN CH4 thirty_years (3) ═══
  'hidden_ch4_thirty_years_l07_00_hand_still': (
    "Erebus crater wall exterior, sealed-up tunnel entrance with old mining markers, "
    f"{CHAR['butcher']} STANDING before the sealed wall, his RIGHT (HUMAN) HAND placed flat against it, "
    "NOT his prosthetic — only the human hand can touch what is here, "
    "30 years ago this tunnel was sealed, what was inside still inside, "
    "low canyon shadow, single sun-shaft hitting the wall, "
    + STYLE),
  'hidden_ch4_thirty_years_l18_00_candle_flame': (
    "Hellas Zone 4 ruins interior, single candle, "
    "a name scratched 30 YEARS AGO into the wall — 'KIM YONG-JIN' — same name the Observer has seen on chalk walls today, "
    "the same name in two times, two tools, same desperation, "
    "candle illuminates the deeper old gouges, "
    + STYLE),
  'hidden_ch4_thirty_years_l27_00_ore_sample': (
    "Hellas Zone 4 deep tunnel, "
    "the Observer's hand catching a piece of ANCIENT METAL ore (dark silvery-blue extraterrestrial color) on a glove, "
    "this is what the strikers died for 30 years ago — its different color is everything, "
    "single headlamp beam in deep darkness, "
    + STYLE),

  # ═══ MCC CH10 the_choice (4) ═══
  'mcc_ch10_the_choice_l13_01_death_still': (
    "MCC executive penthouse floor, "
    "an open formal report on a polished obsidian desk listing ELEVEN names of the Zone 12 dead, "
    f"{CHAR['chen']} in the background turning toward the camera — the moment of one person stepping forward, "
    "perfect 25-degree-Celsius lighting, the report held in white-gloved hand, "
    + STYLE),
  'mcc_ch10_the_choice_l26_01_sealed_file': (
    "MCC board chamber, "
    f"{CHAR['chen']} confronting Director Osei across the obsidian board table, "
    "a SEALED 2004 SAFETY DEFECT REPORT held up between them, "
    "the moment of public accusation, narrow board-chamber windows behind, "
    "cold blue holographic lighting, "
    + STYLE),
  'mcc_ch10_the_choice_l45_02_alone_window': (
    "MCC executive penthouse 25-degree lounge, "
    f"{CHAR['chen']} alone looking out the floor-to-ceiling armored window at distant red Mars, "
    "the TEACUP on the side table — STEAM RISING PERFECTLY STRAIGHT, the tea NEVER COOLING — "
    "25 degrees never changed in this room, "
    "minimalist sterile wealth, the room denying Mars, "
    + STYLE),
  'mcc_ch10_the_choice_l55_07_mars_horizon': (
    "Olympus Mons exterior at dawn, the entire Mars vista stretching to horizon, "
    "below visible the small MCC towers, the small mining village walls — the small things outlasting the corporate towers, "
    "those small things were Mars, outlasting the cup of tea, outlasting 25 degrees, "
    + STYLE),

  # ═══ MCC CH1 oxygen_rush (3) ═══
  'mcc_ch1_oxygen_rush_l13_02_death_still': (
    "MCC briefing room, "
    f"{CHAR['lifang']} explaining the oxygen casualty math, "
    "her finger on a holographic display showing ONE PERSON SUFFOCATING from oxygen deprivation, "
    "the human cost behind the abstract numbers, "
    "cold blue holographic light on her face, "
    + STYLE),
  'mcc_ch1_oxygen_rush_l23_00_dust_storm': (
    "Hellas Central exterior, NORTHERN SKY going DARK — not the usual Martian red — "
    "an INCOMING DUST STORM front blackening the horizon line, "
    "Mars storms come earlier than predicted, "
    "MCC city skyline in the foreground silhouetted against the approaching darkness, "
    + STYLE),
  'mcc_ch1_oxygen_rush_l37_00_alone_window': (
    "Hellas Central exterior at night, "
    f"{CHAR['lifang']} ALONE standing before a tall pressurized window on an upper floor, "
    "looking out at the NORTHERN sky where the storm passed, "
    "his thoughts unreadable, his back to camera, "
    "single overhead lamp, the city quiet behind glass, FIRST DAY ON MARS, "
    + STYLE),

  # ═══ MCC CH2 frozen_highway (3) ═══
  'mcc_ch2_frozen_highway_l20_02_death_still': (
    "Mars mine shaft, "
    f"{CHAR['miner_elder']} speaking of three dead miners in their 30s, ONE of them about to be married this month, "
    "weathered miner face, his hand on a small memorial photograph, "
    "single mine work-lamp lighting the chamber, "
    + STYLE),
  'mcc_ch2_frozen_highway_l27_00_sealed_file': (
    "Mine shaft, "
    f"{CHAR['lifang']} holding a CHECKLIST in his hand — 37 items, 36 ticked, ONE BLANK — Accident Record, "
    "the choice: nothing to record, or too much to record, "
    "single overhead bulb lights the paper sharply, "
    + STYLE),
  'mcc_ch2_frozen_highway_l34_00_mars_horizon': (
    "Hellas Central exterior, "
    f"{CHAR['lifang']} riding an exterior elevator UP from the mines, the surface light returning, "
    "BLOOD-COLORED light of Mars day, "
    "the mine and the dead miners and the elder — all left below — "
    "the report in hand, hand NOT TREMBLING, "
    + STYLE),

  # ═══ MCC CH3 boardroom (3) ═══
  'mcc_ch3_boardroom_l04_00_death_still': (
    "MCC executive floor, an old miners' family photograph on Chen's small private side table, "
    f"{CHAR['chen']} parents (Mars-born second generation miners, both died in the mines) visible in the framed picture, "
    "her hand reaching toward her teacup, the photograph rarely mentioned, "
    "warm side-light, the rest of the executive room sterile, "
    + STYLE),
  'mcc_ch3_boardroom_l10_02_sealed_file': (
    "MCC executive floor, "
    f"{CHAR['chen']} with the small miners' family photograph close by, declaring 'I joined MCC to FILL THAT', "
    "her sealed report of MCC failures laid open in front of her, "
    "intense stillness, "
    + STYLE),
  'mcc_ch3_boardroom_l34_00_alone_window': (
    "MCC executive floor at evening, "
    f"{CHAR['chen']} viewed from BEHIND, standing at the floor-to-ceiling window holding her teacup but NOT DRINKING, "
    "her shoulders carrying 22 years of MCC, miner parents, alone at age 12 — invisible weight, "
    "Mars red light through the window outlines her silhouette, "
    + STYLE),

  # ═══ MCC CH4 pirates_payroll (3) ═══
  'mcc_ch4_pirates_payroll_l17_00_ore_sample': (
    "Kepler crater dusk, "
    f"{CHAR['liang_wei']} examining a small ANCIENT METAL ore sample with TREMBLING HANDS — "
    "30 years of waiting compressed into this moment, "
    "her face hard to read but her hand-tremor reveals everything, "
    "warm sunset light catching the alien metal, "
    + STYLE),
  'mcc_ch4_pirates_payroll_l23_00_mars_horizon': (
    "Kepler crater edge dusk, the Mars sunset turning BLUE as the sun drops below horizon — "
    "rare phenomenon where Mars red sky becomes BLUE at sunset, brief moment, "
    "single tiny figure on the rim watching this for the first time, "
    "the brief blue-cool moment in a red world, "
    + STYLE),
  'mcc_ch4_pirates_payroll_l39_00_ore_sample': (
    "Kepler crater empty after the sunset, "
    "the deep dark crater interior visible, dark silvery glints of ANCIENT METAL deposits within the basin, "
    "30 years of waiting answered, the blue sunset over, "
    "ownership of this still unresolved — to whom does it belong, "
    + STYLE),

  # ═══ MCC CH5 kepler_dispute (2) ═══
  'mcc_ch5_kepler_dispute_l07_00_sealed_file': (
    "MCC archive sublevel under Hellas Central, "
    "an ENCRYPTED DATA CHIP placed on a hand — finger-size — containing 17 cases of Mars deaths since 2009, "
    "the offering hand TREMBLES but the eyes do not — long-resolved decision, "
    "flickering fluorescent tube light, "
    + STYLE),
  'mcc_ch5_kepler_dispute_l29_00_candle_flame': (
    "Hellas labor district alley at night, CHILDREN PLAYING in dust-masks, "
    "wall behind them covered in CHALK NAMES — KIM YONG-JIN at top with names of the dead miners written by these kids — "
    "single candle on a windowsill, the chalk names glowing white in the alley dark, "
    + STYLE),

  # ═══ MCC CH6 whistleblower (2) ═══
  'mcc_ch6_whistleblower_l08_00_candle_flame': (
    "Hellas labor district alley at night, "
    "C-7 BLOCK WALL covered in CHALK NAMES — Kim Yong-jin largest at top, many names below — "
    "ALL MCC mine deaths (NOT FSP), written by the alley's children, "
    "single small candle beside the wall, "
    "the chalk fragile but the names there, "
    + STYLE),
  'mcc_ch6_whistleblower_l35_00_candle_flame': (
    "C-7 alley before dawn, "
    "the CHALK NAMES on the wall, dawn wind beginning, "
    "candle still burning, "
    "names already remembered cannot be erased even by Mars wind — "
    "below the existing names, EMPTY SPACE for names yet to be written, "
    + STYLE),

  # ═══ MCC CH9 martian_night (4) ═══
  'mcc_ch9_martian_night_l08_02_zone12_record': (
    "Olympus Mons summit station, "
    f"{CHAR['chen']} placing a 22-year-locked dossier on the table — 'What I locked away for 22 years is on this table' — "
    "the document is HER OWN buried evidence, "
    "single overhead light over the conference table, "
    + STYLE),
  'mcc_ch9_martian_night_l27_00_zone12_record': (
    "Olympus summit station, "
    f"{CHAR['chen']} lifting her TEACUP and ACTUALLY DRINKING — small sip — first time in 22 years she drinks in this room, "
    "Zone 12 photograph (brought by Cinder) lying on the table beside her, "
    "the photograph is why today is different, "
    + STYLE),
  'mcc_ch9_martian_night_l35_00_contract_sign': (
    "Olympus summit station signing close-up, "
    f"{CHAR['chen']} signing as the LAST of three faction signatures, putting her teacup down BEFORE picking up the pen, "
    "her right hand supported by her left while signing — not her usual style — "
    "the agreement worth this gesture, "
    + STYLE),
  'mcc_ch9_martian_night_l37_00_mars_horizon': (
    "View from descending Olympus Mons road — entire Mars panorama visible below, "
    "Hellas city visible, then C-7 block visible, then the chalk names visible if seen close — "
    "small things grow back to large size as you descend the mountain, "
    "the lesson of perspective, "
    + STYLE),

  # ═══ PROLOGUE CV (3) ═══
  'prologue_cv_l12_00_mars_horizon': (
    "Hellas outer plains at sunset, "
    "the Mars sun setting BLUE rather than red — the rare blue Martian sunset — "
    "you (the player viewer) standing alone on the plain, your shadow long, "
    "mid-departure from the cargo ship, "
    "this is now your normal — adapted or changed, you cannot tell, "
    + STYLE),
  'prologue_cv_l24_00_fire_small': (
    "Erebus crater exterior, "
    f"{CHAR['butcher']} sitting before a barrel-fire LOOKING UP AT YOU — heavy frame, weathered face, "
    "his LEFT mining-grade prosthetic arm visible in firelight, "
    "long lingering eye contact across the fire, the test begins, "
    + STYLE),
  'prologue_cv_l34_00_fire_small': (
    "Erebus crater exterior at deep night, single barrel-fire that NEVER WENT OUT in 30 years, "
    "the fire is not warm but unbroken, "
    "you sitting close to it on your first night, "
    "the question — was this CHOICE or DISCOVERY — answered by the fact that here those are the same, "
    + STYLE),

  # ═══ PROLOGUE FSP (2) ═══
  'prologue_fsp_l05_00_candle_flame': (
    "Hellas labor district at night, "
    "wall covered in CHALK NAMES of dead miners with dates, single candle below them, "
    "you standing before the wall on your first FSP-side night, "
    "some names old, some new, chalk fragile but persistent, "
    + STYLE),
  'prologue_fsp_l34_00_candle_flame': (
    "Hellas mining village at dawn, "
    "WARM TEA in your hands for the first time, "
    f"{CHAR['mikhail']} pouring tea from a worn pot WITH BOTH HANDS, "
    "wall of names visible, lights from the mine, children laughing in distance, "
    "this village starting to feel like home, "
    + STYLE),

  # ═══ PROLOGUE MCC (2) ═══
  'prologue_mcc_l30_00_death_still': (
    "Hellas mining outpost interior, "
    "an open accident record showing THREE entries — Cause column BLANK on all three, only names — "
    "DEAD. DEAD. DEAD. — cause-less death possible on Mars when no one writes the cause, "
    "single overhead bulb on the documents, "
    + STYLE),
  'prologue_mcc_l40_00_sealed_file': (
    "Hellas Central exterior at evening, "
    "the city's full corporate towers spread before you — Mars waiting for you — "
    f"{CHAR['chen']} (silhouetted, distant in a high tower window with teacup) reading a report "
    "but not drinking, "
    + STYLE),

  # ═══ PROLOGUE SHARED (2) ═══
  'prologue_shared_l29_00_mars_horizon': (
    "Cargo ship Kariope observation deck, "
    "MARS GROWING LARGER on the porthole window — blood-red, twilight-like — "
    "the planet always looks like dusk because that is just Mars, "
    "diverse passengers' reflections in the glass, "
    + STYLE),
  'prologue_shared_l45_00_mars_horizon': (
    "First step on Mars surface, "
    "RED MARS DUST under your boot in foreground, "
    "Hellas Central looming MASSIVE in front of you under blood-red sky, "
    "wind rising, your gripping the bag tighter, "
    "the moment of arrival, "
    + STYLE),

  # ═══ 기존 저퀄 scene-level 배경 9:16 재생성 (13개) ═══
  'hellas_various_night': (
    "wide vista of MULTIPLE Mars colony settlements seen from a high ridge at deep night, "
    "dozens of pressurized habitat domes scattered across the red dust plain, "
    "warm yellow porthole lights dotting the darkness, "
    "starfield above with two small Martian moons visible, "
    "vast lonely scale of human presence on a hostile planet, "
    + STYLE),
  'mars_sunset': (
    "Martian sunset on the red plains, "
    "dust-saturated atmosphere turning the sun into a small pale-blue disk on the horizon, "
    "long jagged rock silhouettes raking across the foreground, "
    "deep crimson sky bleeding into violet at the zenith, "
    "single tiny rover trail leaving thin tracks across the dust, "
    "melancholy beauty of an alien sunset, "
    + STYLE),
  'argyre_plains': (
    "Argyre Planitia battlefield on Mars in the moments before combat, "
    "vast flat red basin floor extending to a distant escarpment ridge, "
    "approaching dust storm darkening half the sky to violent ochre, "
    "two opposing fleet silhouettes barely visible at extreme distance, "
    "tension before the trigger, "
    + STYLE),
  'argyre_plains_dusk': (
    "Argyre plains on Mars at deep dusk, "
    "blood-red horizon line cutting between red dust below and ink-violet sky above, "
    "rusted hulk of a wrecked cargo crawler half-buried in foreground sand, "
    "scattered weapon casings catching the last light, "
    + STYLE),
  'olympus_exterior': (
    "Olympus Mons exterior view from approaching shuttle, "
    "the largest volcano in the solar system filling the entire frame, "
    "twenty-five-kilometer escarpment cliffs along its base, "
    "thin Martian atmosphere allows starfield even in daylight, "
    "neutral diplomatic ground for all three Mars factions, "
    + STYLE),
  'olympus_exterior_sunset': (
    "Olympus Mons at sunset seen from the caldera rim, "
    "vast volcanic dome silhouetted against burning orange-red sky, "
    "sun dipping behind the curve of the largest volcano in the solar system, "
    "thin clouds of high-altitude dust catching the dying light, "
    + STYLE),
  'deep_space_mars_approach': (
    "interplanetary cargo ship approaching Mars seen from outside the hull, "
    "Mars dominating the upper portion of the frame as a detailed red world "
    "with visible polar caps, Hellas basin, and dust-storm bands, "
    "battered freighter silhouette in foreground with running lights, "
    "starfield and the small bright Sun in the distance, "
    + STYLE),
  'space_battle_start': (
    "opening salvo of a fleet engagement in low Mars orbit, "
    "two opposing capital ships exchange railgun and missile fire across the void, "
    "tracer streaks and missile contrails crisscrossing the foreground, "
    "Mars limb glowing red below, fighter wings peeling off in attack formations, "
    "single ship hull breach venting atmosphere into space, "
    + STYLE),
  'kepler_crater_edge_dusk': (
    "Kepler crater rim at dusk on Mars, "
    "ancient impact crater cliff edge backlit by red-violet evening sky, "
    "single weather-beaten research habitat clinging to the rim, "
    "Liang Wei's solitary outpost after thirty years of work, "
    "scattered ore samples on a folding worktable, telescope pointed at the horizon, "
    + STYLE),
  'mcc_briefing_room': (
    "MCC corporate operations briefing chamber on Mars, "
    "long obsidian conference table lit by overhead holographic mission display "
    "showing red-sector fleet movements, "
    "high-back synthetic-leather chairs, walls of dark brushed alloy, "
    "single tactical operations officer standing at the head of the table, "
    "cold blue light from holographic terminals, "
    + STYLE),
  'mcc_board_chamber': (
    "MCC executive board chamber high above Hellas Central, "
    "circular obsidian conference table for seven directors, "
    "tall narrow armored windows overlooking the entire Mars colony far below, "
    "private oxygen scrubbers visible behind each high-back chair, "
    "muted gold and deep navy palette, holographic financial projections in the air, "
    "cold absolute corporate power, "
    + STYLE),
  'mcc_25deg_lounge': (
    "MCC executive penthouse lounge climate-controlled to exactly twenty-five degrees Celsius, "
    "floor-to-ceiling armored windows revealing the crimson Mars landscape and a distant dust storm, "
    "single low-back leather armchair, polished metal side table, "
    "untouched cup of tea with steam rising perfectly straight, "
    "minimalist sterile wealth, every detail engineered to deny that this is Mars, "
    + STYLE),
  'cargo_ship_interior': (
    "interior cockpit of an interplanetary cargo freighter en route to Mars, "
    "two pilot seats facing a wide reinforced cockpit window framing red Mars on approach, "
    "battered control consoles glowing with green and amber CRT readouts, "
    "tangled cable runs across the ceiling, hand-stenciled crew labels on every panel, "
    "thermos bottle clipped to the dash, family photo taped near the throttle, "
    "lived-in working spacecraft cockpit, "
    + STYLE),

  # ═══ HIDDEN CH5 last_observation (3) ═══
  'hidden_ch5_last_observation_l23_00_zone12_record': (
    "Observer's archive vault deep on Mars, single dim chamber light, "
    "an open journal/codex spread on a stone table covered in handwritten records — "
    "names: KIM YONG-JIN, places: SANDSTONE JUNCTION / EREBUS CRATER / SECTOR 4, "
    "Butcher's hand sketched, white-flag fragment, ore samples, "
    "the COMPLETE OBSERVER'S RECORD compiled across years, "
    + STYLE),
  'hidden_ch5_last_observation_l32_00_candle_flame': (
    "Underground chamber, single steady candle flame, "
    "around it scattered name plates / chalk fragments / scratched-stone names — "
    "the ONLY thing that endures on Mars: NAMES, not flags, not factions — "
    "the chalk name, the scratched name, the gravestone name, "
    "names ARE Mars, "
    + STYLE),
  'hidden_ch5_last_observation_l44_00_mars_horizon': (
    "View from a high cliff edge — Mars panorama BELOW (red dust plains, distant settlements), "
    "blood-red sky ABOVE filling the upper third, "
    "the lone silhouette of the Observer standing BETWEEN earth and sky at frame center, "
    "they did not descend — they remain as keeper of the record, "
    "Mars was always there, before and after, red and eternal, "
    + STYLE),
}


def main():
    args = sys.argv[1:]
    test_count = None
    chapter_filter = None
    dry = '--dry-run' in args
    if '--test' in args:
        i = args.index('--test')
        test_count = int(args[i + 1]) if i + 1 < len(args) else 5
    if '--filter' in args:
        i = args.index('--filter')
        chapter_filter = args[i + 1] if i + 1 < len(args) else None

    entries = json.load(open(INPUT_JSON, encoding='utf-8'))

    # Build mapping entry_index -> bg_id with consistent slug
    def slug(o):
        return o.replace('_', '_')[:16] if isinstance(o, str) else 'overlay'

    pairs = []
    for e in entries:
        bg_id = f"{e['chapter']}_l{e['scene_idx']:02d}_{e['line_idx']:02d}_{e['overlay']}"
        pairs.append((bg_id, e))
    # standalone prompts (overlay_scenes.json 에 없는 scene-level 저퀄 재생성용)
    overlay_ids = {b for (b, _) in pairs}
    for bg_id in PROMPTS:
        if bg_id not in overlay_ids:
            pairs.append((bg_id, {'chapter': '_standalone', 'scene_idx': -1, 'line_idx': -1, 'text_ko': ''}))

    if chapter_filter:
        pairs = [(b, e) for (b, e) in pairs if e['chapter'] == chapter_filter or b.startswith(chapter_filter)]
    if test_count:
        pairs = pairs[:test_count]

    os.makedirs(OUT_DIR, exist_ok=True)
    print(f'대상: {len(pairs)} 라인')
    missing = [b for (b, _) in pairs if b not in PROMPTS]
    if missing:
        print(f'  ⚠ PROMPTS 미정 {len(missing)}개:')
        for m in missing[:5]:
            print(f'      {m}')
        if len(missing) > 5:
            print(f'      ... +{len(missing) - 5}')

    mapping = {}
    done = 0
    for idx, (bg_id, entry) in enumerate(pairs):
        prompt = PROMPTS.get(bg_id)
        if not prompt:
            print(f'[{idx + 1}/{len(pairs)}] {bg_id} -- NO PROMPT, skip')
            continue
        out = os.path.join(OUT_DIR, f'{bg_id}.png')
        print(f'[{idx + 1}/{len(pairs)}] {bg_id}')
        if dry:
            print(f'    {prompt[:200]}...')
            mapping[f"{entry['chapter']}|{entry['scene_idx']}|{entry['line_idx']}"] = bg_id
            continue
        # 엄격 모드(--strict): 모든 < 1.4MB 결과를 강화 프롬프트로 재시도.
        strict = '--strict' in args
        is_standalone = entry.get('chapter') == '_standalone'
        if strict:
            skip_size = 1_400_000  # 골드 스탠다드 임계값
        else:
            skip_size = 1_500_000 if is_standalone else 100_000
        if os.path.exists(out) and os.path.getsize(out) > skip_size and '--force' not in args:
            print(f'    skip ({os.path.getsize(out)//1024}KB ≥ {skip_size//1024}KB)')
            mapping[f"{entry['chapter']}|{entry['scene_idx']}|{entry['line_idx']}"] = bg_id
            done += 1
            continue
        # best-of-N: 한 호출로 N장 생성 후 가장 큰 파일 채택 (퀄리티 최대화)
        best_of = int(os.environ.get('BEST_OF', '2'))
        ok = False
        for attempt in range(3):
            try:
                r = client.models.generate_images(
                    model=os.environ.get('IMAGEN_MODEL', 'imagen-3.0-generate-001'),
                    prompt=prompt,
                    config=types.GenerateImagesConfig(
                        number_of_images=best_of,
                        aspect_ratio='9:16',
                        safety_filter_level='block_only_high',
                        person_generation='allow_adult',
                    ),
                )
                if r.generated_images:
                    # bytes 배열들 중 가장 긴(=가장 디테일한) 것 채택
                    candidates = [g.image.image_bytes for g in r.generated_images]
                    best = max(candidates, key=len)
                    with open(out, 'wb') as f:
                        f.write(best)
                    ok = True
                    break
            except Exception as e:
                err = str(e)
                if 'quota' in err.lower() or 'rate' in err.lower():
                    print(f'    rate limit, sleeping 30s')
                    time.sleep(30)
                else:
                    print(f'    err {err[:140]}')
                    time.sleep(3)
        if ok:
            kb = os.path.getsize(out) // 1024
            tag = '✓' if kb > 1400 else '⚠ small'
            print(f'    {tag} {kb}KB (best-of-{best_of})')
            mapping[f"{entry['chapter']}|{entry['scene_idx']}|{entry['line_idx']}"] = bg_id
            done += 1
        else:
            print('    ✗ failed')
        time.sleep(2)

    with open(MAPPING_OUT, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
    print(f'\n완료: {done}/{len(pairs)}, mapping → {MAPPING_OUT}')


if __name__ == '__main__':
    main()
