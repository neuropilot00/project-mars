#!/usr/bin/env python3
"""
docs/campaign-story/*.json 의 모든 line.overlay 를 line.background 로 변환한다.

전: { "text": {...}, "overlay": "fire_small" }
후: { "text": {...}, "background": "cv_ch10_from_flames_l00_00_fire_small" }

런타임 동작 변경:
- index.html 이 line.background 가 있으면 해당 라인이 표시되는 동안 scene.background 대신
  /assets/campaign/backgrounds/{line.background}.png 를 풀스크린 배경으로 깐다.
- 작은 floating overlay 닫음. 씬 전체 배경 swap 으로 대체.
"""

import json
import os
import sys
import glob

ROOT = os.path.join(os.path.dirname(__file__), '..')
SCENES_DIR = os.path.join(ROOT, 'docs', 'campaign-story')


def update_file(path):
    raw = open(path, encoding='utf-8').read()
    try:
        data = json.loads(raw)
    except Exception as e:
        print(f'  ✗ {os.path.basename(path)}: JSON parse error — {e}')
        return False, 0
    chapter = os.path.basename(path).replace('.json', '')
    # campaign id 매핑: prologue_*.json 은 campaign.js 의 *_prologue 로 다름
    chapter_to_qid = {
        'prologue_mcc': 'mcc_prologue',
        'prologue_fsp': 'fsp_prologue',
        'prologue_cv': 'cv_prologue',
        'prologue_shared': 'prologue_shared',  # shared 는 그대로 둔다 (3 prologue 가 같이 사용)
    }
    qid_prefix = chapter_to_qid.get(chapter, chapter)
    changed = 0
    scenes = data.get('scenes', [])
    for si, scene in enumerate(scenes):
        for li, line in enumerate(scene.get('lines', [])):
            if 'overlay' in line:
                old = line.pop('overlay')
                # bg_id 형식 = <chapter>_l<si>_<li>_<overlay>
                new_bg = f'{qid_prefix}_l{si:02d}_{li:02d}_{old}'
                line['background'] = new_bg
                changed += 1
    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f'  ✓ {os.path.basename(path)}: {changed}개 변환')
    else:
        print(f'  - {os.path.basename(path)}: (변경 없음)')
    return True, changed


def main():
    dry = '--dry-run' in sys.argv
    if dry:
        print('(DRY RUN)')
    files = sorted(glob.glob(os.path.join(SCENES_DIR, '*.json')))
    total = 0
    for f in files:
        if dry:
            try:
                data = json.load(open(f, encoding='utf-8'))
            except Exception as e:
                print(f'  ✗ {os.path.basename(f)}: {e}')
                continue
            count = sum(1 for s in data.get('scenes', []) for ln in s.get('lines', []) if 'overlay' in ln)
            print(f'  {os.path.basename(f)}: {count}')
            total += count
            continue
        ok, n = update_file(f)
        if ok:
            total += n
    print(f'\n총 변환: {total}')


if __name__ == '__main__':
    main()
