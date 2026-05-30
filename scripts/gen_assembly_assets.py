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

# 유닛 정의 — accent(색), theme(전체 컨셉)
UNITS = {
    'pilgrim_voltaris': dict(ship_code='pilgrim_voltaris', accent='purple to magenta (#b388ff)',
        theme="colossal balanced super-mech, the original sealed Pilgrim weapon"),
    'pilgrim_ignis':    dict(ship_code='pilgrim_ignis',    accent='molten red and orange',
        theme="aggressive assault super-mech wreathed in heat vents and ember glow"),
    'pilgrim_glacius':  dict(ship_code='pilgrim_glacius',  accent='icy cyan and white',
        theme="heavily armored fortress super-mech with frost-plated bulwark shields"),
    'pilgrim_umbra':    dict(ship_code='pilgrim_umbra',    accent='dark teal and toxic green',
        theme="stealth electronic-warfare super-mech with cloaking panels and emitter spines"),
    'pilgrim_aurum':    dict(ship_code='pilgrim_aurum',    accent='royal gold and deep black',
        theme="regal command titan super-mech, ornate gilded armor, commander unit"),
}


def assets_for(unit_code):
    u = UNITS[unit_code]
    short = unit_code.replace('pilgrim_', '')
    out = [(
        # 정면 히어로샷(역동적 포즈) — 합체 탭 카드/모달용
        f"assets/assembly/portrait/{u['ship_code']}.png",
        f"epic full-body hero shot of a massive humanoid super-mech robot in a dynamic dramatic action pose, "
        f"low heroic camera angle looking up, one arm raised with glowing weapon, energy charging, "
        f"cinematic rim lighting, dramatic atmosphere, character splash art key visual, full body in frame, "
        f"{u['theme']}, {u['accent']} color scheme, {PILGRIM}, {STYLE}",
    ), (
        # 진짜 탑다운 전투 스프라이트 — 전술랩 전투 렌더러용(다른 22척 함선 탑뷰와 같은 규격)
        f"assets/ships/top/{u['ship_code']}.png",
        f"strict top-down orthographic view looking straight down from directly overhead at a giant "
        f"humanoid combat mech robot lying flat, seen from above so only the tops of its head, shoulders, "
        f"arms and weapons are visible, nose/head pointing toward the top of the frame like a vertical "
        f"game unit sprite, centered, isolated on solid pure black background, "
        f"{u['theme']}, {u['accent']} color scheme, {PILGRIM}, {STYLE}",
    )]
    for role, desc in PART_ROLES.items():
        out.append((
            f"assets/assembly/parts/{short}_{role}.png",
            f"square inventory icon, close-up of a single mech {desc}, isolated on dark background, "
            f"{u['accent']} accent, shares design language of the {u['theme']}, {PILGRIM}, {STYLE}",
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
