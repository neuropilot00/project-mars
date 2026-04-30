#!/usr/bin/env python3
"""씬 디테일 오버레이 — Gemini Imagen 3 픽셀아트 생성기
gen_ai_assets.py 와 동일한 GCP Vertex AI 설정 사용.
aspect_ratio=1:1, 픽셀아트 컨셉 close-up 일러스트.
"""
import os, sys, time

from google import genai
from google.genai import types

PROJECT  = 'gen-lang-client-0351298739'
LOCATION = 'us-central1'
OUT_DIR  = os.path.join(os.path.dirname(__file__), '..', 'assets', 'campaign', 'overlays')

client = genai.Client(vertexai=True, project=PROJECT, location=LOCATION)

STYLE = (
    "pixel art close-up detail illustration, 32-bit retro RPG game art, "
    "dark background, dramatic single-subject focus, "
    "muted dark palette with one vivid accent color, "
    "moody Mars sci-fi atmosphere, square format, pixel shading"
)
NEG_HINT = "no text, no watermark, no photorealistic rendering, no 3D, no anime faces"

OVERLAYS = {
    # 신체 / 감정
    'hand_still': (
        "close-up of a weathered human hand resting completely motionless on dark industrial surface, "
        "veins visible, tense stillness, barely alive, " + STYLE
    ),
    'hand_reaches': (
        "close-up of a hand reaching toward something out of frame, "
        "desperate or careful reach, worn glove partially removed, " + STYLE
    ),
    'hand_fist': (
        "close-up of a tightly clenched fist, "
        "knuckles white, anger or determination, Mars colony dust on skin, " + STYLE
    ),
    'eye_closeup': (
        "extreme close-up of a single human eye, "
        "wide with realization, reflection of red Martian light in iris, " + STYLE
    ),
    'tear_drop': (
        "close-up of a single tear on a weathered cheek, "
        "dust-streaked face, grief held in, Mars colony survivor, " + STYLE
    ),
    'blood_drop': (
        "close-up of blood drops on industrial metal floor, "
        "dark red, fresh, cold clinical Mars lighting, aftermath of violence, " + STYLE
    ),
    'child_small': (
        "silhouette of a small child standing alone at a large Mars habitat window, "
        "tiny figure, small palm pressed flat against cold glass, "
        "red planet light from outside, " + STYLE
    ),
    # 문서 / 기록
    'sealed_file': (
        "close-up of a physical file stamped CLASSIFIED in red, "
        "MCC corporate seal on yellowed paper, "
        "30-year-old document Zone 12 case number visible, " + STYLE
    ),
    'zone12_record': (
        "close-up of a cracked data tablet showing Zone 12 accident records, "
        "partial names visible, date 22 years ago, "
        "screen cracked as if thrown against wall, " + STYLE
    ),
    'paper_burn': (
        "close-up of a corner of paper beginning to burn, "
        "orange flame eating printed text, evidence being destroyed, " + STYLE
    ),
    # 장비
    'oxygen_mask': (
        "close-up of an oxygen mask on the ground, "
        "cracked visor, emergency seal broken, "
        "someone took it off in a hurry or it failed them, " + STYLE
    ),
    'ore_sample': (
        "close-up of glowing blue-cyan ore held in a gloved hand, "
        "Ancient Metal bioluminescent mineral, priceless and dangerous, " + STYLE
    ),
    'comm_static': (
        "close-up of a communication device showing only static, "
        "signal lost, emergency frequency dead, the call that never came, " + STYLE
    ),
    'mine_sensor': (
        "close-up of a mine safety sensor blinking red, "
        "danger indicator, atmosphere warning, last warning before catastrophe, " + STYLE
    ),
    # 무기
    'bullet_casing': (
        "close-up of a spent bullet casing on Martian rock floor, "
        "still warm, catching industrial light, aftermath of a decision made, " + STYLE
    ),
    'knife_edge': (
        "close-up of a blade edge catching light, "
        "not drawn for threat but for use, Mars colony survival tool, " + STYLE
    ),
    # 환경
    'broken_glass': (
        "close-up of cracked pressurized glass, "
        "spiderweb fracture, thin atmosphere through the crack, "
        "one hit from catastrophic decompression, " + STYLE
    ),
    'door_locked': (
        "close-up of sealed door handle with red lock indicator, "
        "MCC corporate seal welded shut, rust and time, "
        "the door that should not be opened, " + STYLE
    ),
    'footprint_dust': (
        "close-up of a single boot print in red Mars dust, "
        "fresh print, someone was just here, only evidence remaining, " + STYLE
    ),
    'candle_flame': (
        "close-up of a single small flame flickering, "
        "memorial candle in colony habitat, "
        "names written on wall behind it blurred but visible, " + STYLE
    ),
    # 상징
    'cv_insignia': (
        "close-up of a Crow Vanguard insignia scratched into metal, "
        "rough irregular lines done with a blade not a stamp, "
        "30 years of militia identity, " + STYLE
    ),
    'mcc_badge_cracked': (
        "close-up of an MCC corporate ID badge cracked down the middle, "
        "face on the badge barely recognizable, loyalty broken, " + STYLE
    ),
    'three_flags': (
        "close-up of three small faction flags in a row — MCC blue, FSP green, CV red, "
        "standing in Mars dust, tiny scale vast implications, " + STYLE
    ),
    'map_marked': (
        "close-up of a tactical map with a single location circled in red, "
        "handwritten notes around the mark, the objective, " + STYLE
    ),
    'empty_chair': (
        "close-up of an empty chair at a table, "
        "dust settling on the seat, absence made visible, " + STYLE
    ),
    # 우주 / 화성
    'mars_horizon': (
        "close-up of Mars horizon at edge of a habitat viewport, "
        "red dust meeting thin sky, the planet that holds everything, indifferent, " + STYLE
    ),
    'stars_through_glass': (
        "close-up of stars through a scratched porthole, "
        "vastness of space in a small circle, Earth not visible, you can't go back, " + STYLE
    ),
    # 죽음 / 붕괴
    'death_still': (
        "close-up of an empty pressure suit helmet lying on Martian ground, "
        "visor cracked, dust settling inside, owner gone, "
        "the object that outlived its wearer, " + STYLE
    ),
    'fire_small': (
        "close-up of a small fire burning in a metal barrel inside Mars colony, "
        "orange flame reflecting off worn metal walls, warmth in cold darkness, " + STYLE
    ),
    'dust_storm': (
        "close-up view through a porthole of a Mars dust storm approaching, "
        "red-orange wall of dust filling frame, the planet asserting dominance, " + STYLE
    ),
    'silence_room': (
        "close-up of empty table with two chairs, one pushed back like someone just left, "
        "cold coffee cup still there, silence after a conversation that ended badly, " + STYLE
    ),
    'contract_sign': (
        "close-up of a contract document with signature line, "
        "pen resting at the line, MCC corporate letterhead, weight of commitment, " + STYLE
    ),
    'alone_window': (
        "close-up of a single figure silhouette at habitat window, "
        "just shoulders and head against Martian red sky, alone with the planet, " + STYLE
    ),
    'darkness_corridor': (
        "close-up of a corridor light flickering out, "
        "one light remaining in receding darkness, last light in a tunnel, " + STYLE
    ),
    'collapse_debris': (
        "close-up of collapsed mine tunnel debris, "
        "support beam broken, rocks fallen, "
        "someone was under this, weight of what happened, " + STYLE
    ),
}


def generate(prompt, out_path):
    """Imagen 3으로 1:1 픽셀아트 오버레이 생성"""
    full_prompt = prompt + " " + NEG_HINT
    for attempt in range(3):
        try:
            response = client.models.generate_images(
                model='imagen-3.0-generate-001',
                prompt=full_prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio='1:1',
                    safety_filter_level='block_only_high',
                    person_generation='allow_adult',
                )
            )
            if response.generated_images:
                with open(out_path, 'wb') as f:
                    f.write(response.generated_images[0].image.image_bytes)
                return True
            else:
                print(f"    응답 비어있음", flush=True)
                return False
        except Exception as e:
            err = str(e)
            if 'quota' in err.lower() or 'rate' in err.lower():
                wait = 30 * (attempt + 1)
                print(f"    rate limit → {wait}s...", flush=True)
                time.sleep(wait)
            else:
                print(f"    오류: {err[:150]}", flush=True)
                if attempt < 2:
                    time.sleep(5)
    return False


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    force = '--force' in sys.argv

    targets = {
        k: v for k, v in OVERLAYS.items()
        if force
        or not os.path.exists(os.path.join(OUT_DIR, f'{k}.png'))
        or os.path.getsize(os.path.join(OUT_DIR, f'{k}.png')) < 50_000
    }

    print(f"Imagen 3 픽셀아트 오버레이 생성")
    print(f"전체 {len(OVERLAYS)}개 정의 → {len(targets)}개 생성\n")

    done = fail = 0
    for i, (name, prompt) in enumerate(targets.items(), 1):
        out = os.path.join(OUT_DIR, f'{name}.png')
        print(f"  [{i:2d}/{len(targets)}] {name}...", end=' ', flush=True)
        if generate(prompt, out):
            print(f"✓ ({os.path.getsize(out)//1024}KB)")
            done += 1
        else:
            print("✗")
            fail += 1
        time.sleep(2)

    print(f"\n완료: {done}성공 / {fail}실패 | 총 {len(os.listdir(OUT_DIR))}개")


if __name__ == '__main__':
    main()
