#!/usr/bin/env python3
"""
B-tight + B-narrow 결합: 3회+ 반복되는 (chapter, bg) 케이스마다 N개 variant 생성.

규칙:
  N <= 4: 1 variant (총 2장)
  N 5-7: 1 variant
  N 8-11: 2 variants
  N 12-15: 3 variants
  N 16-25: 4 variants
  N 26-30: 5 variants
  N 31-40: 7 variants

variant 파일명: `<chapter>_<base_bg>_v<N>.png` (e.g., `fsp_ch9_last_harvest_olympus_summit_station_v2.png`)

동시에 scene JSON 의 background 필드를 round-robin 으로 갱신해 variant 가 실제 사용되게 한다.
"""
import json, os, sys, time, math
from google import genai
from google.genai import types

PROJECT = 'gen-lang-client-0351298739'
LOCATION = 'us-central1'
ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT_DIR = os.path.join(ROOT, 'assets', 'campaign', 'backgrounds')
SCENES_DIR = os.path.join(ROOT, 'docs', 'campaign-story')
TARGETS = '/tmp/repeat_targets.json'

client = genai.Client(vertexai=True, project=PROJECT, location=LOCATION)

# 기존 scene-level prompts 재사용
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
import unittest.mock as _mock
import importlib.util as _il
_spec = _il.spec_from_file_location('m', os.path.join(ROOT, 'scripts', 'gen_scene_level_v2.py'))
_m = _il.module_from_spec(_spec)
with _mock.patch('google.genai.Client'):
    _spec.loader.exec_module(_m)
BASE_PROMPTS = _m.PROMPTS
STYLE = _m.STYLE

# Variant 별 angle/lighting 변주 hint
VARIANT_HINTS = [
    "WIDE ESTABLISHING SHOT — distant vantage showing full environment, panoramic framing",
    "INTIMATE CLOSE PERSPECTIVE — foreground details with characters in mid-action",
    "HIGH ANGLE LOOKING DOWN — sweeping bird's-eye style view of the space",
    "LOW ANGLE DRAMATIC LOOKING UP — towering perspective emphasizing scale",
    "SIDE PROFILE PERSPECTIVE — lateral view showing depth into the space",
    "DAWN VARIANT with first light bleeding through — softer pinks and ambers",
    "DEEP DUSK VARIANT with dying sunset light — long shadows and silhouettes",
    "MIDDLE OF SCENE WITH CROWDS — multiple background figures populating space",
]


def variants_count(n):
    if n <= 4: return 1
    if n <= 7: return 1
    if n <= 11: return 2
    if n <= 15: return 3
    if n <= 25: return 4
    if n <= 30: return 5
    return 7


def main():
    cases = json.load(open(TARGETS))
    total_variants = sum(variants_count(len(c['scenes'])) for c in cases)
    print(f'Cases: {len(cases)}, Total variants to generate: {total_variants}')
    print(f'Model: imagen-4.0-ultra-generate-001\n')

    completed = 0
    failed = []
    sizes = []
    json_updates = {}  # path -> [(scene_idx, new_bg_id), ...]

    case_idx = 0
    var_idx = 0
    for case in cases:
        case_idx += 1
        chap = case['chapter']
        base_bg = case['bg']
        scenes = case['scenes']
        n_var = variants_count(len(scenes))
        base_prompt = BASE_PROMPTS.get(base_bg)
        if not base_prompt:
            print(f'[case {case_idx}/{len(cases)}] {chap}::{base_bg} — NO PROMPT in scene_level dict, skip')
            continue

        # Generate N variants
        variant_ids = []
        for v in range(1, n_var + 1):
            var_idx += 1
            hint = VARIANT_HINTS[(v - 1) % len(VARIANT_HINTS)]
            variant_id = f'{chap}_{base_bg}_v{v + 1}'  # _v2 부터 (base 가 _v1 격)
            out = os.path.join(OUT_DIR, f'{variant_id}.png')
            prompt = f"{hint}. {base_prompt}"

            print(f'[var {var_idx}/{total_variants}] {variant_id}', flush=True)
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
                    wait = 30 if any(w in err.lower() for w in ['quota', 'rate']) else 5
                    print(f'  attempt {attempt+1}/3 fail: {err[:120]}; sleep {wait}s', flush=True)
                    time.sleep(wait)
            if ok:
                kb = os.path.getsize(out) // 1024
                sizes.append(kb)
                tag = '✓' if kb >= 1400 else '⚠'
                print(f'  {tag} {kb}KB', flush=True)
                completed += 1
                variant_ids.append(variant_id)
            else:
                failed.append(variant_id)
                print(f'  ✗ FAILED', flush=True)
            time.sleep(1.5)

        # Update JSON: round-robin assignment of [base, *variant_ids] across scenes
        if variant_ids:
            pool = [base_bg] + variant_ids
            json_path = os.path.join(SCENES_DIR, f'{chap}.json')
            updates = json_updates.setdefault(json_path, [])
            for i, sidx in enumerate(scenes):
                # 첫 씬은 base 유지, 나머지는 round-robin
                if i == 0: continue
                new_bg = pool[i % len(pool)]
                if new_bg != base_bg:
                    updates.append((sidx, new_bg))

        if case_idx % 5 == 0:
            avg = sum(sizes) / len(sizes) if sizes else 0
            print(f'  CASE PROGRESS {case_idx}/{len(cases)} variants={completed} avg={avg:.0f}KB', flush=True)

    # Apply JSON updates
    print(f'\nApplying JSON updates: {len(json_updates)} files')
    for path, updates in json_updates.items():
        try:
            data = json.load(open(path, encoding='utf-8'))
        except Exception as e:
            print(f'  ✗ {os.path.basename(path)}: {e}')
            continue
        for sidx, new_bg in updates:
            if sidx < len(data.get('scenes', [])):
                data['scenes'][sidx]['background'] = new_bg
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f'  ✓ {os.path.basename(path)}: {len(updates)} scene bg updated')

    avg = sum(sizes) / len(sizes) if sizes else 0
    print(f'\nFINAL: completed={completed}/{total_variants}, failed={len(failed)}, avg={avg:.0f}KB')


if __name__ == '__main__':
    main()
