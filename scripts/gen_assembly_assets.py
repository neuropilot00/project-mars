#!/usr/bin/env python3
"""
합체 유닛 아트 생성기 — GCP Vertex AI Imagen 3 (ADC 인증).
리얼리스틱 시네마틱 3D 렌더 스타일(도트/픽셀아트 금지), 기존 가챠 박스 배너 톤.
데이터 기반: UNITS 에 유닛을 추가하면 동일 파이프라인으로 생성.

사용:
  python3 scripts/gen_assembly_assets.py                       # 전체 유닛
  python3 scripts/gen_assembly_assets.py pilgrim_voltaris      # 특정 유닛만
  python3 scripts/gen_assembly_assets.py pilgrim_voltaris:voltaris_assault  # 특정 파츠만
"""

import os
import sys
import time

from google import genai

client = genai.Client(vertexai=True, project='gen-lang-client-0351298739', location='us-central1')
model = 'imagen-3.0-generate-001'
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# ── 공통 스타일 (리얼리스틱 — 도트 금지) ──
STYLE = (
    "highly detailed realistic 3D render, cinematic sci-fi concept art, photorealistic textures, "
    "dramatic volumetric lighting, intricate mechanical detail, Mars sci-fi setting, ultra detailed, "
    "octane render, artstation trending, NOT pixel art, NOT dotted, NOT 8-bit, NOT anime, NOT cartoon"
)
PILGRIM = "experimental sealed Pilgrim Arms war-mech design language, ominous alien-tech aesthetic"

# 5파츠 스킴 통일(재활용): scout/assault/artillery/shield/command
PART_ROLES = {
    'scout':     "recon core part - sensor arrays, sleek agile frame, antenna clusters",
    'assault':   "assault arm part - heavy fists, close-combat energy blades, thick armor",
    'artillery': "artillery arm part - massive shoulder cannons, long-range barrels, targeting optics",
    'shield':    "shield legs part - heavy armor plates, energy shield emitters, stabilizer legs",
    'command':   "command head part - cockpit dome, command antenna, glowing sensor visor",
}

# 외계 유전자 파츠 스킴
ALIEN_PART_ROLES = {
    'cortex':  "original alien organ, glowing crystalline core node, bioluminescent",
    'heart':   "original alien bio-core organ, pulsing energy veins, soft glow",
    'claw':    "original alien limb appendage, smooth coral-plated arm",
    'hide':    "original alien shell plate, crystalline armored carapace scales",
    'tendril': "original alien frond cluster, soft glowing filaments",
}

# 유닛 정의 — kind(robot/alien), prefix(파츠 코드 접두사), accent, theme
UNITS = {
    # ── 로봇 6종 (무기 특화 반영) ──
    'pilgrim_voltaris': dict(ship_code='pilgrim_voltaris', kind='robot', prefix='voltaris', accent='purple to magenta (#b388ff)',
        theme="colossal balanced super-mech with twin energy laser cannons, the original sealed Pilgrim weapon"),
    'pilgrim_ignis':    dict(ship_code='pilgrim_ignis', kind='robot', prefix='ignis', accent='molten red and orange',
        theme="aggressive missile-bombardment super-mech bristling with rocket pods, heat vents and ember glow"),
    'pilgrim_glacius':  dict(ship_code='pilgrim_glacius', kind='robot', prefix='glacius', accent='icy cyan and white',
        theme="heavily armored fortress super-mech with a massive shoulder railgun and frost-plated bulwark shields"),
    'pilgrim_umbra':    dict(ship_code='pilgrim_umbra', kind='robot', prefix='umbra', accent='dark teal and toxic green',
        theme="stealth electronic-warfare super-mech with disruptor emitter spines and cloaking panels"),
    'pilgrim_aurum':    dict(ship_code='pilgrim_aurum', kind='robot', prefix='aurum', accent='royal gold and deep black',
        theme="regal long-range sniper super-mech with an enormous gilded precision lance rifle, ornate commander armor"),
    'pilgrim_tempest':  dict(ship_code='pilgrim_tempest', kind='robot', prefix='tempest', accent='electric blue and white lightning',
        theme="sleek high-speed vanguard super-mech with rapid swarm autocannons and crackling lightning thrusters"),
    # ── 외계 대형생명체 4종 (공격 특화) ──
    'alien_devourer':   dict(ship_code='alien_devourer', kind='alien', prefix='devourer', accent='acid green and violet',
        theme="enormous manta-ray-shaped living creature-ship with wide membrane wings, rows of glowing acid pods along the body that spray wide energy bursts"),
    'alien_leviathan':  dict(ship_code='alien_leviathan', kind='alien', prefix='leviathan', accent='deep blue and bioluminescent teal',
        theme="colossal armored whale-shaped living creature-ship, thick crystalline carapace hull plating, slow and immensely tough"),
    'alien_hive':       dict(ship_code='alien_hive', kind='alien', prefix='hive', accent='amber orange and shell brown',
        theme="vast segmented coral-reef living creature-ship covered in glowing pods that release clouds of drifting swarm sparks"),
    'alien_voidmaw':    dict(ship_code='alien_voidmaw', kind='alien', prefix='voidmaw', accent='void black and luminous purple',
        theme="immense squid-shaped living creature-ship with a single huge glowing core eye that fires one concentrated energy lance"),
}

ALIEN_STYLE = ("original colossal spaceborne bio-organism the size of a battleship, living creature-ship, "
               "drifting through space, NO arms, NO legs, NO humanoid body, NOT a person, NOT a monster standing up, "
               "streamlined organic hull like a living whale/manta/squid, glowing bioluminescent membranes and veins, "
               "crystalline carapace plating, completely original concept, NOT derivative of any movie")


def assets_for(unit_code):
    u = UNITS[unit_code]
    prefix = u['prefix']
    is_alien = u.get('kind') == 'alien'
    style_tail = (ALIEN_STYLE + ", " + STYLE) if is_alien else (PILGRIM + ", " + STYLE)
    subj = "gigantic living creature-ship bio-organism (battleship-sized, no limbs)" if is_alien else "massive humanoid super-mech robot"
    if is_alien:
        portrait_prompt = (
            f"epic key-art of a {subj} floating in deep space, dramatic three-quarter side angle showing its huge "
            f"streamlined organic hull, tiny fighter ships nearby for scale to show it is enormous, cinematic rim lighting, "
            f"glowing energy, {u['theme']}, {u['accent']} color scheme, {style_tail}")
        top_prompt = (
            f"strict top-down view from directly overhead of a {subj}, the whole creature-ship seen from above floating "
            f"in space, front/head pointing to the top of the frame like a vertical spaceship game sprite, symmetrical, "
            f"centered, isolated on solid pure black background, {u['theme']}, {u['accent']} color scheme, {style_tail}")
    else:
        portrait_prompt = (
            f"epic full-body hero shot of a {subj} in a dynamic dramatic menacing pose, "
            f"low heroic camera angle looking up, attacking stance, cinematic rim lighting, dramatic atmosphere, "
            f"character splash art key visual, full body in frame, {u['theme']}, {u['accent']} color scheme, {style_tail}")
        top_prompt = (
            f"strict top-down orthographic view looking straight down from directly overhead at a giant {subj} "
            f"seen from above, head/front pointing toward the top of the frame like a vertical game unit sprite, "
            f"centered, isolated on solid pure black background, {u['theme']}, {u['accent']} color scheme, {style_tail}")
    out = [
        (f"assets/assembly/portrait/{u['ship_code']}.png", portrait_prompt),
        (f"assets/ships/top/{u['ship_code']}.png", top_prompt),
    ]
    part_roles = ALIEN_PART_ROLES if is_alien else PART_ROLES
    for role, desc in part_roles.items():
        thing = desc if is_alien else f"mech {desc}"
        out.append((
            f"assets/assembly/parts/{prefix}_{role}.png",
            f"square inventory icon, close-up of a single {thing}, isolated on dark background, "
            f"{u['accent']} accent, shares design of the {u['theme']}, {style_tail}",
        ))
    return out


def generate(prompt, rel_path):
    abs_path = os.path.join(ROOT, rel_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    for attempt in range(4):
        try:
            resp = client.models.generate_images(model=model, prompt=prompt,
                config={'number_of_images': 1, 'aspect_ratio': '1:1'})
            img = resp.generated_images[0].image
            with open(abs_path, 'wb') as f:
                f.write(img.image_bytes)
            return os.path.getsize(abs_path)
        except Exception as e:
            print(f"   attempt {attempt+1}/4 fail: {str(e)[:90]}")
            time.sleep(20 * (attempt + 1))
    return 0


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    only_part = None
    if arg and ':' in arg:
        arg, only_part = arg.split(':', 1)
    units = [arg] if arg else list(UNITS.keys())
    results = []
    for uc in units:
        for rel, prompt in assets_for(uc):
            if only_part and only_part not in rel:
                continue
            print(f"-> {rel}")
            size = generate(prompt, rel)
            results.append((rel, 'ok' if size else 'FAIL', size))
            time.sleep(3)
    print("\n=== SUMMARY ===")
    for rel, st, sz in results:
        print(f"{rel} | {st} | {sz}")
    fails = [r for r, s, _ in results if s != 'ok']
    if fails:
        print("\nFAILED:", fails)


if __name__ == '__main__':
    main()
