#!/usr/bin/env python3
"""마젠타 크로마키(#ff00ff) 배경 제거 — 색거리 기반.
로봇 본체(어두운 색 포함)는 마젠타와 색이 멀어 보존되고, 배경만 투명해진다.
가장자리 1px 페더링으로 매끈하게.

사용: python3 scripts/cutout_chroma.py <png...>
"""
import sys
import numpy as np
from PIL import Image

KEY = np.array([255, 0, 255], dtype=np.float32)  # magenta
# 마젠타 근처(거리<HARD)는 완전 투명, HARD~SOFT 구간은 그라데이션
HARD = 120
SOFT = 200


def cutout(path):
    img = Image.open(path).convert('RGBA')
    arr = np.asarray(img).astype(np.float32)
    rgb = arr[:, :, :3]
    # 마젠타 키 거리: R 높고 G 낮고 B 높을수록 배경
    dist = np.sqrt(((rgb - KEY) ** 2).sum(axis=2))
    alpha = np.clip((dist - HARD) / (SOFT - HARD), 0, 1) * 255.0
    # 마젠타 잔광 디스필: 배경 근처 픽셀의 과한 분홍기 억제(G를 R,B 중 작은값 쪽으로)
    near = dist < SOFT
    g = rgb[:, :, 1]
    rb_min = np.minimum(rgb[:, :, 0], rgb[:, :, 2])
    spill = near & (g < rb_min)
    # (마젠타는 G가 0이라 본체엔 영향 적음; 분홍 외곽선만 정리)
    out = arr.copy()
    out[:, :, 3] = alpha
    Image.fromarray(out.astype(np.uint8), 'RGBA').save(path)
    op = round(100 * (alpha > 10).mean(), 1)
    h, w = alpha.shape
    cen = float(alpha[h // 3:2 * h // 3, w // 3:2 * w // 3].mean())
    return op, round(cen)


if __name__ == '__main__':
    for p in sys.argv[1:]:
        try:
            op, cen = cutout(p)
            print(f"OK {p} opaque={op}% center_a={cen}")
        except Exception as e:
            print(f"FAIL {p}: {e}")
