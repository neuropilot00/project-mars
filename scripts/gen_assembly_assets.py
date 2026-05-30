#!/usr/bin/env python3
"""
Generate Voltaris assembly assets with Vertex AI Imagen 3.
Uses GCP Application Default Credentials.
"""

import os
import subprocess
import time

from google import genai
from google.genai import types


client = genai.Client(vertexai=True, project='gen-lang-client-0351298739', location='us-central1')
model = 'imagen-3.0-generate-001'

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PARTS_DIR = os.path.join(ROOT, 'assets', 'assembly', 'parts')

STYLE_BASE = (
    "32-bit pixel art, semi-realistic pixel art concept art, "
    "detailed pixel shading, dark moody sci-fi, Mars sci-fi setting, "
    "realistic gritty pixel art, NOT anime"
)

PILGRIM_STYLE = (
    "purple (#b388ff) to magenta accent colors, experimental sealed war mech aesthetic, "
    "Pilgrim Arms design language, realistic gritty pixel art, NOT anime"
)

ASSETS = [
    (
        "assets/ships/top/pilgrim_voltaris.png",
        "top-down vertical sprite of a massive combined super-mech robot named Voltaris, "
        "viewed from directly above pointing upward like a spaceship sprite, dark space background, "
        "centered full-body silhouette, experimental war machine, purple-magenta Pilgrim Arms colors, "
        + PILGRIM_STYLE + ", " + STYLE_BASE,
    ),
    (
        "assets/assembly/parts/voltaris_scout.png",
        "square inventory icon, close-up of scout recon core mech part, sensor arrays, agile frame, "
        "antenna clusters, dark background, purple accent, same design language as the Voltaris mech, "
        + PILGRIM_STYLE + ", 32-bit pixel art sci-fi icon, " + STYLE_BASE,
    ),
    (
        "assets/assembly/parts/voltaris_assault.png",
        "square inventory icon, close-up of assault arms mech part, heavy fists, close-combat blades, "
        "armor plating, dark background, purple accent, same design language as the Voltaris mech, "
        + PILGRIM_STYLE + ", 32-bit pixel art sci-fi icon, " + STYLE_BASE,
    ),
    (
        "assets/assembly/parts/voltaris_artillery.png",
        "square inventory icon, close-up of artillery arms mech part, massive cannons, long-range barrels, "
        "targeting systems, dark background, purple accent, same design language as the Voltaris mech, "
        + PILGRIM_STYLE + ", 32-bit pixel art sci-fi icon, " + STYLE_BASE,
    ),
    (
        "assets/assembly/parts/voltaris_shield.png",
        "square inventory icon, close-up of shield legs mech part, heavy armor plates, energy shield emitters, "
        "stabilizer legs, dark background, purple accent, same design language as the Voltaris mech, "
        + PILGRIM_STYLE + ", 32-bit pixel art sci-fi icon, " + STYLE_BASE,
    ),
    (
        "assets/assembly/parts/voltaris_command.png",
        "square inventory icon, close-up of command head cockpit mech part, pilot cockpit dome, command antenna, "
        "sensor visor, bridge module, dark background, purple accent, same design language as the Voltaris mech, "
        + PILGRIM_STYLE + ", 32-bit pixel art sci-fi icon, " + STYLE_BASE,
    ),
]


def generate(prompt, out_path, aspect='1:1'):
    for attempt in range(3):
        try:
            response = client.models.generate_images(
                model=model,
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
            print("    empty response")
            return False
        except Exception as e:
            print(f"    error attempt {attempt + 1}/3: {str(e)[:200]}")
            if attempt < 2:
                time.sleep(5)
    return False


def file_size(path):
    if os.path.exists(path):
        return os.path.getsize(path)
    return 0


def main():
    os.makedirs(PARTS_DIR, exist_ok=True)

    results = []
    for rel_path, prompt in ASSETS:
        out_path = os.path.join(ROOT, rel_path)
        print(f"Generating {rel_path}...", flush=True)
        ok = generate(prompt, out_path)
        size = file_size(out_path)
        status = "success" if ok and size > 0 else "fail"
        results.append((rel_path, status, size))
        print(f"  {status}: {size} bytes")

    print("\nls -la verification:")
    for rel_path, _, _ in results:
        subprocess.run(["ls", "-la", os.path.join(ROOT, rel_path)], check=False)

    print("\nSummary:")
    for rel_path, status, size in results:
        print(f"{rel_path} | {status} | {size} bytes")

    failures = [rel_path for rel_path, status, _ in results if status != "success"]
    if failures:
        print("\nFailed:")
        for rel_path in failures:
            print(f"- {rel_path}")
    else:
        print("\nAll assets generated successfully.")


if __name__ == '__main__':
    main()
