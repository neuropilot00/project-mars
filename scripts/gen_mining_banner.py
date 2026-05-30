#!/usr/bin/env python3
"""Generate the Ship Mining banner with Vertex Imagen 3."""

import os
import sys
from io import BytesIO

from google import genai
from google.genai import types
from PIL import Image


PROJECT = 'gen-lang-client-0351298739'
LOCATION = 'us-central1'
MODEL = 'imagen-3.0-generate-001'
OUT_PATH = os.path.join(
    os.path.dirname(__file__), '..', 'assets', 'base', 'mining.png'
)
TARGET_SIZE = (1600, 680)

BG_STYLE = (
    "32-bit pixel art game background, semi-realistic pixel art concept art, "
    "retro RPG, dark moody sci-fi, Mars colony, red planet"
)

PROMPT = (
    "a fleet of sci-fi mining ships and mining drones hovering over a glowing "
    "Martian mineral ore field, extracting crystals and minerals, industrial "
    "space-mining operation, asteroid-like ore deposits, cinematic wide shot, "
    "dramatic lighting. NO text, logos, watermarks, or human characters in "
    "foreground, "
    + BG_STYLE
)


def center_crop_resize(image, target_size):
    target_w, target_h = target_size
    target_ratio = target_w / target_h
    src_w, src_h = image.size
    src_ratio = src_w / src_h

    if src_ratio > target_ratio:
        crop_w = int(src_h * target_ratio)
        left = (src_w - crop_w) // 2
        box = (left, 0, left + crop_w, src_h)
    else:
        crop_h = int(src_w / target_ratio)
        top = (src_h - crop_h) // 2
        box = (0, top, src_w, top + crop_h)

    return image.crop(box).resize(target_size, Image.Resampling.LANCZOS)


def main():
    adc_path = os.path.expanduser(
        '~/.config/gcloud/application_default_credentials.json'
    )
    if not os.path.exists(adc_path):
        print(f"Missing GCP Application Default Credentials: {adc_path}")
        return 1

    try:
        client = genai.Client(
            vertexai=True, project=PROJECT, location=LOCATION
        )
        response = client.models.generate_images(
            model=MODEL,
            prompt=PROMPT,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio='16:9',
                safety_filter_level='block_only_high',
                person_generation='allow_adult',
            ),
        )
    except Exception as exc:
        print(f"Vertex Imagen generation failed: {exc}")
        return 1

    if not response.generated_images:
        print("Vertex Imagen generation failed: no generated images returned")
        return 1

    img_bytes = response.generated_images[0].image.image_bytes
    image = Image.open(BytesIO(img_bytes)).convert('RGBA')
    banner = center_crop_resize(image, TARGET_SIZE)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    banner.save(OUT_PATH)
    print(os.path.abspath(OUT_PATH))
    print(banner.size)
    return 0


if __name__ == '__main__':
    sys.exit(main())
