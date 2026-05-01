#!/usr/bin/env python3
"""
STRICT 픽셀아트 일괄 재생성 — Octopath/Stardew/Owlboy 스타일.
- base scene-level (77장, 9:16 풀씬)
- line overlay closeup (107장, 1:1 디테일 컷)
모두 픽셀아트 통일, 사실풍 키워드 차단.
"""
import os, sys, time, json
from google import genai
from google.genai import types

PROJECT = 'gen-lang-client-0351298739'
LOCATION = 'us-central1'
ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT_DIR = os.path.join(ROOT, 'assets', 'campaign', 'backgrounds')
client = genai.Client(vertexai=True, project=PROJECT, location=LOCATION)

# ── STRICT 픽셀아트 STYLE (사실풍 차단) ──────────────────────────────────────
PIXEL_STYLE_BASE = (
    "STRICT 16-bit pixel art game CG, retro JRPG aesthetic in the style of "
    "Octopath Traveler HD-2D / Stardew Valley / Owlboy / Chrono Trigger SNES, "
    "chunky blocky pixels visible at 100% zoom, limited 32-color palette, "
    "hard pixel edges with NO anti-aliasing, NO smooth gradients, "
    "ABSOLUTELY NOT photorealistic, NOT cinematic 3D render, NOT matte painting, "
    "NOT realistic concept art, pixel art ONLY, game sprite art aesthetic, "
    "no text no logos no UI elements, no watermark"
)

PIXEL_STYLE_BG = "vertical 9:16 portrait composition for mobile screen, " + PIXEL_STYLE_BASE
PIXEL_STYLE_OVERLAY = "1:1 square close-up detail shot, single focused element centered, " + PIXEL_STYLE_BASE

# ── base scene-level prompts (77장) ─────────────────────────────────────────
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
import unittest.mock as _mock
import importlib.util as _il
_spec = _il.spec_from_file_location('m', os.path.join(ROOT, 'scripts', 'gen_scene_level_v2.py'))
_m = _il.module_from_spec(_spec)
with _mock.patch('google.genai.Client'):
    _spec.loader.exec_module(_m)
SCENE_BASE_PROMPTS = _m.PROMPTS  # 77 base prompts (cinematic style)

# 사실풍 STYLE 부분만 STRICT 픽셀로 교체
def make_scene_prompt(content):
    # content 에서 기존 STYLE 부분 잘라내고 PIXEL_STYLE_BG 로 치환
    if ', highly detailed cinematic' in content:
        content = content.split(', highly detailed cinematic')[0]
    elif ', cinematic concept' in content:
        content = content.split(', cinematic concept')[0]
    elif ', vertical 9:16' in content:
        content = content.split(', vertical 9:16')[0]
    return content + ', ' + PIXEL_STYLE_BG

# ── line overlay closeup prompts (107장) ────────────────────────────────────
# /tmp/overlay_scenes.json 의 KO 텍스트 + 캐릭터 + overlay slug 로 1:1 closeup 프롬프트 구성
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
_spec2 = _il.spec_from_file_location('mv2', os.path.join(ROOT, 'scripts', 'gen_scene_dedicated_v2.py'))
_mv2 = _il.module_from_spec(_spec2)
with _mock.patch('google.genai.Client'):
    _spec2.loader.exec_module(_mv2)
LINE_FULLSCENE_PROMPTS = _mv2.PROMPTS  # 107+ keys (full-scene compositions)

# closeup 변환: 풀씬 프롬프트에서 핵심 시각 요소만 추출하고 1:1 close-up 으로 재구성
def make_overlay_prompt(bg_id):
    base = LINE_FULLSCENE_PROMPTS.get(bg_id, '')
    if not base:
        return None
    # 첫 콤마-구분 절들 중 가장 임팩트있는 시각 키워드 부분만 사용
    # 단순화: 첫 1-2 sentences 만 추출
    head = base.split('.')[0]  # 첫 문장
    # 1:1 closeup 지시 + style
    return ('Single focused close-up detail shot — ' + head + '. '
            + 'Tight framing on the central object/gesture, dark background bokeh, '
            + 'square 1:1 composition, '
            + PIXEL_STYLE_OVERLAY)


def generate(prompt, out_path, aspect):
    for attempt in range(3):
        try:
            r = client.models.generate_images(
                model='imagen-4.0-ultra-generate-001',
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1, aspect_ratio=aspect,
                    safety_filter_level='block_only_high',
                    person_generation='allow_adult',
                ),
            )
            if r.generated_images and r.generated_images[0].image and r.generated_images[0].image.image_bytes:
                with open(out_path, 'wb') as f:
                    f.write(r.generated_images[0].image.image_bytes)
                return True
        except Exception as e:
            err = str(e)
            wait = 30 if any(w in err.lower() for w in ['quota','rate']) else 5
            print(f'  attempt {attempt+1}/3 fail: {err[:120]}; sleep {wait}s', flush=True)
            time.sleep(wait)
    return False


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'all'  # 'scene', 'overlay', 'all'

    # ── base scene-level (77) ──────────────────────────────────────────────
    if mode in ('all', 'scene'):
        scene_targets = sorted(SCENE_BASE_PROMPTS.keys())
        print(f'\n=== BASE SCENE-LEVEL (9:16) ===')
        print(f'Total: {len(scene_targets)}')
        completed = 0; sizes = []
        for idx, bg_id in enumerate(scene_targets, 1):
            out = os.path.join(OUT_DIR, f'{bg_id}.png')
            content = SCENE_BASE_PROMPTS[bg_id]
            prompt = make_scene_prompt(content)
            print(f'[scene {idx}/{len(scene_targets)}] {bg_id}', flush=True)
            ok = generate(prompt, out, '9:16')
            if ok:
                kb = os.path.getsize(out) // 1024
                sizes.append(kb)
                tag = '✓' if kb >= 1200 else '⚠'
                print(f'  {tag} {kb}KB', flush=True)
                completed += 1
            else:
                print('  ✗ FAILED', flush=True)
            if idx % 10 == 0:
                avg = sum(sizes)/len(sizes) if sizes else 0
                print(f'  PROGRESS {idx}/{len(scene_targets)} avg={avg:.0f}KB', flush=True)
            time.sleep(2)
        avg = sum(sizes)/len(sizes) if sizes else 0
        print(f'\nSCENE LEVEL DONE: {completed}/{len(scene_targets)}, avg={avg:.0f}KB\n')

    # ── line overlay closeup (1:1) ────────────────────────────────────────
    if mode in ('all', 'overlay'):
        # /tmp/overlay_scenes.json 의 ID 형식
        try:
            entries = json.load(open('/tmp/overlay_scenes.json'))
        except:
            print('overlay_scenes.json missing, skip overlay'); return
        # bg_id 패턴 (chapter 명 mapping 주의 — prologue 는 mcc_prologue 형식)
        chapter_to_qid = {
            'prologue_mcc': 'mcc_prologue',
            'prologue_fsp': 'fsp_prologue',
            'prologue_cv': 'cv_prologue',
            'prologue_shared': 'prologue_shared',
        }
        overlay_targets = []
        for e in entries:
            chap = e['chapter']
            qid = chapter_to_qid.get(chap, chap)
            bg_id = f"{qid}_l{e['scene_idx']:02d}_{e['line_idx']:02d}_{e['overlay']}"
            overlay_targets.append(bg_id)

        print(f'=== OVERLAY CLOSEUP (1:1) ===')
        print(f'Total: {len(overlay_targets)}')
        completed = 0; sizes = []
        for idx, bg_id in enumerate(overlay_targets, 1):
            out = os.path.join(OUT_DIR, f'{bg_id}.png')
            # source prompt: prefer mapped key in PROMPTS, else fall back to bg_id directly
            src_id = bg_id
            # bg_id 가 PROMPTS 에 없을 수 있음 (chapter prefix 차이) — 둘 다 시도
            if src_id not in LINE_FULLSCENE_PROMPTS:
                # try alternate form e.g., prologue_mcc_l40_00_sealed_file
                for chap_alt, qid in chapter_to_qid.items():
                    if bg_id.startswith(qid + '_'):
                        alt = chap_alt + bg_id[len(qid):]
                        if alt in LINE_FULLSCENE_PROMPTS:
                            src_id = alt
                            break
            prompt = make_overlay_prompt(src_id)
            if not prompt:
                print(f'[overlay {idx}/{len(overlay_targets)}] {bg_id} — NO PROMPT, skip')
                continue
            print(f'[overlay {idx}/{len(overlay_targets)}] {bg_id}', flush=True)
            ok = generate(prompt, out, '1:1')
            if ok:
                kb = os.path.getsize(out) // 1024
                sizes.append(kb)
                tag = '✓' if kb >= 800 else '⚠'
                print(f'  {tag} {kb}KB', flush=True)
                completed += 1
            else:
                print('  ✗ FAILED', flush=True)
            if idx % 10 == 0:
                avg = sum(sizes)/len(sizes) if sizes else 0
                print(f'  PROGRESS {idx}/{len(overlay_targets)} avg={avg:.0f}KB', flush=True)
            time.sleep(2)
        avg = sum(sizes)/len(sizes) if sizes else 0
        print(f'\nOVERLAY DONE: {completed}/{len(overlay_targets)}, avg={avg:.0f}KB')


if __name__ == '__main__':
    main()
