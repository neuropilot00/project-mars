#!/usr/bin/env python3
"""검은 배경(#000 근처) 컷아웃 — 테두리에서 flood-fill 로 '바깥쪽' 검은 영역만 투명화.
내부의 어두운 디테일(로봇 음영)은 보존한다. 가장자리는 부드럽게 페더링.

사용: python3 scripts/cutout_black_bg.py <png...>
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

# 배경 판정 임계치: 휘도(max채널) 이 이 값 이하이면 '검은 후보'
BG_LUMA = 42
# 페더링: 알파 경계를 부드럽게


def cutout(path):
    img = Image.open(path).convert('RGBA')
    arr = np.asarray(img).astype(np.float32)
    rgb = arr[:, :, :3]
    luma = rgb.max(axis=2)  # 가장 밝은 채널 기준(검은 배경=낮음)

    dark = luma <= BG_LUMA  # 검은 후보 마스크

    # 테두리에서 연결된 검은 영역만 배경으로 간주(내부 음영 보존)
    lbl, n = ndimage.label(dark)
    border_ids = set()
    border_ids.update(np.unique(lbl[0, :]))
    border_ids.update(np.unique(lbl[-1, :]))
    border_ids.update(np.unique(lbl[:, 0]))
    border_ids.update(np.unique(lbl[:, -1]))
    border_ids.discard(0)
    bg = np.isin(lbl, list(border_ids))

    # 알파: 배경=0, 그 외=원본. 경계 페더링(휘도 42~90 구간 부드럽게)
    alpha = np.where(bg, 0.0, 255.0).astype(np.float32)
    # 배경에 인접한 약한-검정 픽셀 부드럽게: bg 가장자리 1px 안쪽을 그라데이션
    soft = (~bg) & (luma < 90)
    grad = np.clip((luma - BG_LUMA) / (90 - BG_LUMA), 0, 1) * 255.0
    alpha = np.where(soft, np.minimum(alpha, grad), alpha)

    out = arr.copy()
    out[:, :, 3] = alpha
    Image.fromarray(out.astype(np.uint8), 'RGBA').save(path)
    kept = int((alpha > 10).sum())
    total = alpha.size
    return round(100 * kept / total, 1)


if __name__ == '__main__':
    for p in sys.argv[1:]:
        try:
            pct = cutout(p)
            print(f"OK {p} (opaque {pct}%)")
        except Exception as e:
            print(f"FAIL {p}: {e}")
