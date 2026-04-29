#!/usr/bin/env python3
"""
프로젝트 마스 캠페인 배경 이미지 생성기
각 위치의 분위기에 맞는 1280x720 배경 PNG를 생성한다.
"""

import os
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'campaign', 'backgrounds')
W, H = 1280, 720
random.seed(42)
np.random.seed(42)


# ── 유틸 ────────────────────────────────────────────────────────────────────

def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

def noise_layer(w, h, scale=1.0, seed=0):
    rng = np.random.RandomState(seed)
    raw = rng.rand(h, w).astype(np.float32)
    arr = (raw * 255 * scale).clip(0, 255).astype(np.uint8)
    return Image.fromarray(arr, 'L')

def gradient_bg(w, h, top, bottom):
    img = Image.new('RGB', (w, h))
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / (h - 1)
        draw.line([(0, y), (w, y)], fill=lerp_color(top, bottom, t))
    return img

def add_noise(img, amount=12, seed=0):
    n = noise_layer(img.width, img.height, amount / 255.0, seed=seed)
    n_rgb = Image.merge('RGB', [n, n, n])
    return Image.blend(img, n_rgb, 0.08)

def add_vignette(img, strength=0.55):
    w, h = img.size
    vg = Image.new('L', (w, h), 255)
    draw = ImageDraw.Draw(vg)
    cx, cy = w // 2, h // 2
    steps = 80
    for i in range(steps):
        t = i / steps
        alpha = int(255 * (1 - t * strength))
        rx = int(cx * (1 - t * 0.95))
        ry = int(cy * (1 - t * 0.95))
        draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=alpha)
    vg = vg.filter(ImageFilter.GaussianBlur(60))
    r, g, b = img.split()
    r = ImageEnhance.Brightness(r).enhance(1.0)
    result = Image.merge('RGB', [r, g, b])
    result.putalpha(vg)
    bg = Image.new('RGB', (w, h), (0, 0, 0))
    bg.paste(result, (0, 0), result)
    return bg

def add_scan_lines(img, spacing=4, alpha=0.04):
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for y in range(0, img.height, spacing):
        draw.line([(0, y), (img.width, y)], fill=(0, 0, 0, int(255 * alpha)))
    base = img.convert('RGBA')
    combined = Image.alpha_composite(base, overlay)
    return combined.convert('RGB')

def horizontal_bands(img, bands, alpha=0.15):
    """여러 색상 밴드를 수평으로 오버레이"""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    h = img.height
    bh = h // len(bands)
    for i, color in enumerate(bands):
        y0 = i * bh
        y1 = (i + 1) * bh
        draw.rectangle([0, y0, img.width, y1], fill=(*color, int(255 * alpha)))
    base = img.convert('RGBA')
    return Image.alpha_composite(base, overlay).convert('RGB')

def add_stars(img, count=200, bright=200, seed=7):
    rng = np.random.RandomState(seed)
    draw = ImageDraw.Draw(img)
    for _ in range(count):
        x = int(rng.rand() * img.width)
        y = int(rng.rand() * img.height * 0.6)  # 상단 60%
        b = int(rng.randint(bright - 40, bright + 40))
        r = int(rng.rand() * 2)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(b, b, b))
    return img

def add_dust_particles(img, count=500, seed=11):
    rng = np.random.RandomState(seed)
    draw = ImageDraw.Draw(img)
    for _ in range(count):
        x = int(rng.rand() * img.width)
        y = int(rng.rand() * img.height)
        a = int(rng.rand() * 30 + 5)
        draw.ellipse([x, y, x + 1, y + 1], fill=(180, 100, 60, a))
    return img

def add_rock_texture(img, intensity=0.18, seed=3):
    w, h = img.size
    rng = np.random.RandomState(seed)
    n = rng.rand(h, w).astype(np.float32)
    # Smooth out
    n_img = Image.fromarray((n * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(3))
    n_arr = np.array(n_img).astype(np.float32) / 255.0
    base = np.array(img).astype(np.float32)
    base[:, :, 0] = (base[:, :, 0] * (1 + n_arr * intensity * 0.5)).clip(0, 255)
    base[:, :, 1] = (base[:, :, 1] * (1 - n_arr * intensity * 0.3)).clip(0, 255)
    base[:, :, 2] = (base[:, :, 2] * (1 - n_arr * intensity * 0.4)).clip(0, 255)
    return Image.fromarray(base.astype(np.uint8))

def save(img, name):
    path = os.path.join(OUT_DIR, name + '.png')
    img.save(path, 'PNG', optimize=True)
    print(f'  ✓ {name}.png')


# ── 장면 생성 함수들 ──────────────────────────────────────────────────────────

def make_underground_tunnel():
    """Zone 4 깊은 갱도 — 고대 광물, 어둠, 파란 반짝임"""
    img = gradient_bg(W, H, (8, 5, 18), (22, 14, 8))
    img = add_rock_texture(img, 0.35, seed=5)
    draw = ImageDraw.Draw(img)
    # 동굴 윤곽
    rng = np.random.RandomState(20)
    for i in range(6):
        x = int(rng.rand() * W)
        w2 = int(rng.rand() * 80 + 40)
        h2 = int(rng.rand() * 60 + 30)
        draw.ellipse([x - w2, -20, x + w2, h2], fill=(5, 3, 12))
    # 광물 빛
    for _ in range(8):
        x = int(rng.rand() * W)
        y = int(rng.rand() * H)
        r = int(rng.rand() * 20 + 5)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(40, 80, 180))
        draw.ellipse([x - r//2, y - r//2, x + r//2, y + r//2], fill=(80, 140, 255))
    img = img.filter(ImageFilter.GaussianBlur(1))
    img = add_vignette(img, 0.8)
    img = add_noise(img, 18, seed=9)
    return img

def make_mcc_board_chamber():
    """MCC 이사회 밀실 — 차가운 청색, 원형 테이블 실루엣"""
    img = gradient_bg(W, H, (10, 14, 28), (4, 6, 16))
    draw = ImageDraw.Draw(img)
    # 원형 테이블 실루엣
    cx, cy = W // 2, H - 60
    for r in range(320, 240, -8):
        alpha_r = int(20 * (320 - r) / 80)
        draw.ellipse([cx - r, cy - r // 3, cx + r, cy + r // 3],
                     outline=(60, 90, 160), width=1)
    # 창문 빛줄기
    for i in range(5):
        x = 100 + i * 280
        draw.rectangle([x - 15, 0, x + 15, H // 3], fill=(18, 25, 55))
        draw.line([(x, 0), (x, H // 3)], fill=(80, 110, 200), width=1)
    # 에임비언트 글로우
    for _ in range(3):
        x = int(np.random.rand() * W)
        r = 120
        for ri in range(r, 0, -8):
            a = int(12 * ri / r)
            draw.ellipse([x - ri, H//2 - ri//2, x + ri, H//2 + ri//2],
                         outline=(40, 60, 140, a))
    img = img.filter(ImageFilter.GaussianBlur(2))
    img = add_vignette(img, 0.65)
    img = add_scan_lines(img, 6, 0.03)
    img = add_noise(img, 10)
    return img

def make_mcc_executive_floor():
    """MCC 경영층 — 25도 라운지보다 더 차갑고 공식적"""
    img = gradient_bg(W, H, (12, 16, 30), (6, 9, 22))
    draw = ImageDraw.Draw(img)
    # 바닥 반사
    for y in range(H * 2 // 3, H):
        t = (y - H * 2 // 3) / (H // 3)
        c = lerp_color((8, 12, 28), (15, 22, 50), t)
        draw.line([(0, y), (W, y)], fill=c)
    # 수직 금속 패널
    for i in range(8):
        x = i * (W // 7)
        draw.line([(x, 0), (x, H)], fill=(25, 35, 70), width=2)
    # 로고 빛
    cx = W // 2
    for r in range(80, 20, -5):
        a = int(8 * (80 - r) / 60)
        draw.ellipse([cx - r, H//3 - r//2, cx + r, H//3 + r//2],
                     fill=(20, 40, 100))
    img = img.filter(ImageFilter.GaussianBlur(1))
    img = add_vignette(img, 0.6)
    img = add_scan_lines(img, 4, 0.04)
    return img

def make_mcc_archive_sublevel():
    """MCC 지하 아카이브 — 오래된 파일, 형광등 깜빡임"""
    img = gradient_bg(W, H, (15, 15, 18), (8, 8, 10))
    draw = ImageDraw.Draw(img)
    # 선반 실루엣
    for row in range(4):
        y = 80 + row * 130
        draw.rectangle([0, y, W, y + 8], fill=(5, 5, 8))
        # 파일 상자들
        rng2 = np.random.RandomState(row + 30)
        for _ in range(30):
            x = int(rng2.rand() * W)
            fw = int(rng2.rand() * 20 + 8)
            fh = int(rng2.rand() * 40 + 30)
            shade = int(rng2.rand() * 20 + 15)
            draw.rectangle([x, y - fh, x + fw, y], fill=(shade, shade - 3, shade - 8))
    # 형광등
    for i in range(5):
        x = 80 + i * 280
        draw.rectangle([x - 30, 0, x + 30, 8], fill=(180, 185, 160))
        draw.rectangle([x - 25, 0, x + 25, 4], fill=(220, 225, 200))
    img = img.filter(ImageFilter.GaussianBlur(0.5))
    img = add_vignette(img, 0.7)
    img = add_noise(img, 15, seed=12)
    return img

def make_hellas_mining_village():
    """헬라스 채굴 마을 — 마스 먼지, 간이 주거, 따뜻한 조명"""
    img = gradient_bg(W, H, (30, 15, 8), (80, 40, 20))
    draw = ImageDraw.Draw(img)
    # 지평선
    draw.rectangle([0, H * 3 // 5, W, H], fill=(55, 28, 12))
    # 건물 실루엣
    rng3 = np.random.RandomState(50)
    for i in range(12):
        x = int(rng3.rand() * W)
        bw = int(rng3.rand() * 60 + 30)
        bh = int(rng3.rand() * 80 + 40)
        draw.rectangle([x - bw // 2, H * 3 // 5 - bh, x + bw // 2, H * 3 // 5],
                       fill=(30, 15, 7))
        # 창문 빛
        if rng3.rand() > 0.4:
            wx = x - 8
            wy = H * 3 // 5 - bh + 15
            draw.rectangle([wx, wy, wx + 12, wy + 10], fill=(200, 140, 60))
    # 먼지 오버레이
    img = img.filter(ImageFilter.GaussianBlur(1.5))
    img = add_dust_particles(img.convert('RGBA'), 800, seed=15).convert('RGB')
    img = add_vignette(img, 0.55)
    img = add_noise(img, 20, seed=8)
    return img

def make_hellas_village_fire():
    """헬라스 마을 — 밤, 배럴 화톳불"""
    img = gradient_bg(W, H, (5, 3, 8), (15, 8, 4))
    draw = ImageDraw.Draw(img)
    # 배럴 불
    fires = [(200, H - 150), (650, H - 120), (1050, H - 160)]
    for fx, fy in fires:
        for r in range(80, 5, -4):
            t = r / 80
            c = lerp_color((255, 180, 0), (180, 40, 0), 1 - t)
            draw.ellipse([fx - r, fy - r, fx + r, fy + r // 2],
                         fill=(*c, int(120 * t)))
    # 건물 실루엣 (불빛에 반사)
    rng4 = np.random.RandomState(55)
    for i in range(10):
        x = int(rng4.rand() * W)
        bw = int(rng4.rand() * 50 + 25)
        bh = int(rng4.rand() * 70 + 35)
        y0 = H - 100
        draw.rectangle([x - bw // 2, y0 - bh, x + bw // 2, y0], fill=(8, 4, 2))
    img = img.convert('RGBA')
    for fx, fy in fires:
        glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        for r in range(200, 0, -10):
            a = int(25 * (200 - r) / 200)
            gd.ellipse([fx - r, fy - r // 2, fx + r, fy + r // 2],
                       fill=(255, 100, 0, a))
        img = Image.alpha_composite(img, glow)
    img = img.convert('RGB')
    img = add_stars(img, 300, 180)
    img = add_vignette(img, 0.7)
    return img

def make_hellas_labor_district_night():
    """헬라스 노동 구역 밤 — 산업 조명, 파업 분위기"""
    img = gradient_bg(W, H, (6, 4, 10), (18, 10, 6))
    draw = ImageDraw.Draw(img)
    # 공장 실루엣
    rng5 = np.random.RandomState(60)
    for i in range(8):
        x = int(rng5.rand() * W)
        bw = int(rng5.rand() * 80 + 50)
        bh = int(rng5.rand() * 120 + 80)
        draw.rectangle([x - bw // 2, H - bh, x + bw // 2, H], fill=(10, 6, 4))
        # 굴뚝
        cx2 = x + int(rng5.rand() * bw - bw // 2)
        draw.rectangle([cx2 - 6, H - bh - 50, cx2 + 6, H - bh], fill=(8, 5, 3))
    # 가로등
    for i in range(7):
        lx = 80 + i * 180
        draw.line([(lx, H - 200), (lx, H - 100)], fill=(40, 35, 30), width=3)
        draw.ellipse([lx - 15, H - 215, lx + 15, H - 200], fill=(180, 140, 80))
    img = img.filter(ImageFilter.GaussianBlur(1))
    img = add_vignette(img, 0.75)
    img = add_noise(img, 16)
    return img

def make_olympus_exterior():
    """올림포스 외부 — 태양계 최고봉, 박한 대기, 붉은 하늘"""
    img = gradient_bg(W, H, (15, 8, 18), (80, 35, 15))
    draw = ImageDraw.Draw(img)
    # 화성 대기 레이어
    for y in range(H // 3):
        t = y / (H // 3)
        c = lerp_color((20, 10, 30), (100, 50, 20), t)
        draw.line([(0, y), (W, y)], fill=c)
    # 올림포스 경사면
    draw.polygon([(0, H), (0, H * 2 // 3), (W // 3, H // 4),
                  (W * 2 // 3, H // 5), (W, H * 2 // 3), (W, H)],
                 fill=(40, 18, 8))
    # 별
    img = add_stars(img, 150, 160, seed=22)
    # 먼지 폭풍 힌트
    for y in range(H // 2, H * 2 // 3):
        t = (y - H // 2) / (H // 6)
        a = int(40 * t)
        draw.line([(0, y), (W, y)], fill=(100, 50, 20))
    img = img.filter(ImageFilter.GaussianBlur(2))
    img = add_vignette(img, 0.5)
    img = add_noise(img, 14)
    return img

def make_olympus_summit_station():
    """올림포스 정상 기지 — 우주와 화성 경계"""
    img = gradient_bg(W, H, (5, 3, 12), (60, 25, 12))
    draw = ImageDraw.Draw(img)
    # 우주 상단
    for y in range(H // 2):
        t = y / (H // 2)
        c = lerp_color((3, 2, 10), (40, 15, 8), t)
        draw.line([(0, y), (W, y)], fill=c)
    # 화성 표면 하단
    draw.polygon([(0, H), (0, H * 2 // 3), (W // 2, H // 2 + 20),
                  (W, H * 2 // 3), (W, H)], fill=(35, 14, 6))
    # 기지 돔 실루엣
    cx = W // 2
    draw.ellipse([cx - 180, H // 2 - 60, cx + 180, H // 2 + 40], fill=(12, 8, 20))
    draw.ellipse([cx - 160, H // 2 - 50, cx + 160, H // 2 + 30], fill=(18, 12, 28))
    # 별
    img = add_stars(img, 400, 190, seed=33)
    img = img.filter(ImageFilter.GaussianBlur(1.5))
    img = add_vignette(img, 0.6)
    return img

def make_fsp_assembly_hall():
    """FSP 의원회장 — 공동체, 따뜻함, 창문 있는 공간"""
    img = gradient_bg(W, H, (28, 18, 10), (50, 30, 15))
    draw = ImageDraw.Draw(img)
    # 나무 패널 느낌
    for i in range(12):
        x = i * (W // 11)
        shade = 30 + i % 3 * 5
        draw.line([(x, 0), (x, H)], fill=(shade, shade // 2, shade // 4), width=3)
    # 창문
    for i in range(4):
        wx = 80 + i * 340
        draw.rectangle([wx - 40, 20, wx + 40, H // 2], fill=(80, 55, 30))
        draw.rectangle([wx - 35, 25, wx + 35, H // 2 - 5], fill=(140, 100, 50))
        # 창밖 화성
        draw.rectangle([wx - 33, 27, wx + 33, H // 2 - 7], fill=(80, 38, 18))
    # 집회 좌석 실루엣
    rng6 = np.random.RandomState(70)
    for i in range(20):
        x = 100 + i * 55
        y = H - 80
        draw.rectangle([x - 15, y - 40, x + 15, y], fill=(20, 12, 6))
        # 머리
        draw.ellipse([x - 10, y - 55, x + 10, y - 35], fill=(22, 14, 8))
    img = img.filter(ImageFilter.GaussianBlur(1))
    img = add_vignette(img, 0.5)
    img = add_noise(img, 12)
    return img

def make_erebus_throne_hall():
    """에레보스 요새 홀 — CV 지도부, 공업 요새"""
    img = gradient_bg(W, H, (8, 5, 5), (20, 10, 8))
    draw = ImageDraw.Draw(img)
    # 금속 천장
    for y in range(80):
        t = y / 80
        c = lerp_color((15, 10, 8), (8, 5, 5), t)
        draw.line([(0, y), (W, y)], fill=c)
    # 수직 기둥
    for i in range(7):
        x = 80 + i * 200
        draw.rectangle([x - 15, 0, x + 15, H], fill=(12, 7, 6))
        draw.line([(x, 0), (x, H)], fill=(30, 18, 12), width=2)
    # 중앙 왕좌 실루엣
    cx = W // 2
    draw.polygon([(cx - 60, H), (cx - 60, H - 200), (cx - 20, H - 260),
                  (cx, H - 280), (cx + 20, H - 260), (cx + 60, H - 200), (cx + 60, H)],
                 fill=(6, 3, 2))
    # 화염 횃불
    for tx in [cx - 250, cx + 250]:
        for r in range(40, 5, -3):
            t2 = r / 40
            c2 = lerp_color((255, 140, 0), (180, 40, 0), 1 - t2)
            draw.ellipse([tx - r, H - 200 - r, tx + r, H - 200 + r // 3],
                         fill=c2)
    img = img.filter(ImageFilter.GaussianBlur(1.5))
    img = add_vignette(img, 0.7)
    img = add_noise(img, 14)
    return img

def make_argyre_canyon_night():
    """아르기레 협곡 밤 — 깊은 어둠, 별, 협곡 벽"""
    img = gradient_bg(W, H, (3, 2, 6), (10, 5, 8))
    draw = ImageDraw.Draw(img)
    # 협곡 벽 (양옆)
    rng7 = np.random.RandomState(80)
    # 왼쪽 벽
    pts_l = [(0, H)]
    for i in range(15):
        x = int(rng7.rand() * 200 + 20)
        y = int(rng7.rand() * (H - 100))
        pts_l.append((x, y))
    pts_l.sort(key=lambda p: p[1])
    pts_l.append((0, 0))
    draw.polygon(pts_l, fill=(8, 4, 3))
    # 오른쪽 벽
    pts_r = [(W, H)]
    for i in range(15):
        x = int(rng7.rand() * 200 + W - 220)
        y = int(rng7.rand() * (H - 100))
        pts_r.append((x, y))
    pts_r.sort(key=lambda p: p[1])
    pts_r.append((W, 0))
    draw.polygon(pts_r, fill=(6, 3, 2))
    img = add_stars(img, 500, 200, seed=44)
    img = img.filter(ImageFilter.GaussianBlur(1))
    img = add_vignette(img, 0.55)
    return img

def make_argyre_plains():
    """아르기레 평원 — 광활, 전투 전"""
    img = gradient_bg(W, H, (25, 12, 8), (70, 35, 18))
    draw = ImageDraw.Draw(img)
    # 지평선
    hz = H * 2 // 5
    draw.rectangle([0, hz, W, H], fill=(55, 25, 10))
    # 먼지 회오리
    rng8 = np.random.RandomState(90)
    for _ in range(5):
        x = int(rng8.rand() * W)
        for r in range(40, 5, -3):
            t3 = r / 40
            a = int(60 * t3)
            draw.ellipse([x - r, hz - r // 2, x + r, hz + r // 3],
                         fill=(120, 60, 25))
    # 원경 구조물
    for i in range(5):
        sx = 150 + i * 250
        sw = int(rng8.rand() * 30 + 15)
        sh = int(rng8.rand() * 50 + 30)
        draw.rectangle([sx - sw // 2, hz - sh, sx + sw // 2, hz], fill=(30, 14, 6))
    img = img.filter(ImageFilter.GaussianBlur(2))
    img = add_dust_particles(img.convert('RGBA'), 400).convert('RGB')
    img = add_vignette(img, 0.4)
    img = add_noise(img, 18)
    return img

def make_sandstone_junction():
    """샌드스톤 교차로 — 모래, 세 방향, 발자국"""
    img = gradient_bg(W, H, (55, 30, 12), (90, 50, 22))
    draw = ImageDraw.Draw(img)
    # 모래 바닥
    draw.rectangle([0, H * 2 // 3, W, H], fill=(75, 42, 18))
    # 길 세 방향
    cx2 = W // 2
    road_color = (65, 36, 15)
    # 직진
    draw.polygon([(cx2 - 30, H), (cx2 + 30, H), (cx2 + 15, H * 2 // 3),
                  (cx2 - 15, H * 2 // 3)], fill=road_color)
    # 좌측
    draw.polygon([(0, H * 3 // 4 - 20), (0, H * 3 // 4 + 20),
                  (cx2 - 15, H * 2 // 3 + 15), (cx2 - 15, H * 2 // 3 - 15)], fill=road_color)
    # 우측
    draw.polygon([(W, H * 3 // 4 - 20), (W, H * 3 // 4 + 20),
                  (cx2 + 15, H * 2 // 3 + 15), (cx2 + 15, H * 2 // 3 - 15)], fill=road_color)
    # 이정표
    draw.line([(cx2, H * 2 // 3 - 60), (cx2, H * 2 // 3)], fill=(40, 22, 10), width=4)
    draw.rectangle([cx2 - 25, H * 2 // 3 - 80, cx2 + 25, H * 2 // 3 - 60], fill=(35, 18, 8))
    img = img.filter(ImageFilter.GaussianBlur(1.5))
    img = add_vignette(img, 0.5)
    img = add_noise(img, 20)
    return img

def make_kepler_crater_dawn():
    """케플러 분화구 새벽 — 분홍빛 새벽하늘, 분화구 테두리"""
    img = gradient_bg(W, H, (15, 8, 20), (160, 80, 50))
    draw = ImageDraw.Draw(img)
    # 새벽 그라디언트
    for y in range(H * 2 // 5):
        t4 = y / (H * 2 // 5)
        c3 = lerp_color((15, 8, 20), (200, 100, 60), t4)
        draw.line([(0, y), (W, y)], fill=c3)
    # 분화구 테두리
    cx3 = W // 2
    draw.ellipse([cx3 - 400, H // 2 - 100, cx3 + 400, H // 2 + 100], fill=(30, 14, 6))
    draw.ellipse([cx3 - 390, H // 2 - 90, cx3 + 390, H // 2 + 90], fill=(20, 10, 4))
    # 태양 힌트
    for r2 in range(80, 10, -5):
        t5 = r2 / 80
        c4 = lerp_color((255, 180, 100), (200, 100, 50), 1 - t5)
        draw.ellipse([W - 120 - r2, -r2, W - 120 + r2, r2], fill=c4)
    img = img.filter(ImageFilter.GaussianBlur(2))
    img = add_vignette(img, 0.45)
    img = add_noise(img, 12)
    return img

def make_new_athens_shipyard():
    """뉴아테네 조선소 — 우주선, 도크, 별"""
    img = gradient_bg(W, H, (4, 3, 10), (12, 8, 20))
    draw = ImageDraw.Draw(img)
    img = add_stars(img, 600, 200, seed=55)
    # 도크 구조물
    rng9 = np.random.RandomState(100)
    for i in range(5):
        x = 120 + i * 240
        bw2 = int(rng9.rand() * 60 + 40)
        bh2 = int(rng9.rand() * 150 + 100)
        draw.rectangle([x - bw2 // 2, H - bh2, x + bw2 // 2, H], fill=(8, 6, 14))
        # 창
        for j in range(4):
            wy2 = H - bh2 + 20 + j * 25
            draw.rectangle([x - 8, wy2, x + 8, wy2 + 8], fill=(100, 140, 180))
    # 우주선 실루엣
    draw.polygon([(W // 2 - 80, H // 2 + 20), (W // 2 + 80, H // 2 + 20),
                  (W // 2 + 100, H // 2 + 60), (W // 2 + 40, H // 2 + 80),
                  (W // 2 - 40, H // 2 + 80), (W // 2 - 100, H // 2 + 60)],
                 fill=(12, 10, 20))
    img = add_vignette(img, 0.55)
    img = add_scan_lines(img)
    return img

def make_hellas_outer_relay():
    """헬라스 중계소 외부 — 작은 설비, 황무지"""
    img = gradient_bg(W, H, (40, 20, 10), (70, 35, 15))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, H * 3 // 5, W, H], fill=(50, 24, 10))
    # 중계소
    cx4 = W // 2
    draw.rectangle([cx4 - 60, H * 2 // 5, cx4 + 60, H * 3 // 5], fill=(25, 12, 6))
    draw.rectangle([cx4 - 55, H * 2 // 5 + 5, cx4 + 55, H * 3 // 5], fill=(30, 15, 8))
    # 안테나
    draw.line([(cx4, H * 2 // 5), (cx4, H // 4)], fill=(20, 10, 5), width=3)
    draw.line([(cx4 - 30, H // 4 + 30), (cx4 + 30, H // 4 - 10)], fill=(20, 10, 5), width=2)
    # 전선
    draw.line([(cx4 + 60, H * 2 // 5 + 30), (W, H * 2 // 5 + 40)], fill=(15, 8, 4), width=2)
    img = img.filter(ImageFilter.GaussianBlur(1.5))
    img = add_dust_particles(img.convert('RGBA'), 300).convert('RGB')
    img = add_vignette(img, 0.5)
    return img

def make_erebus_base_interior():
    """에레보스 CV 기지 내부 — 어둡고 산업적"""
    img = gradient_bg(W, H, (10, 6, 5), (22, 12, 8))
    draw = ImageDraw.Draw(img)
    # 금속 격자 천장
    for i in range(9):
        x2 = i * (W // 8)
        draw.line([(x2, 0), (x2, H // 3)], fill=(18, 10, 8), width=3)
    for j in range(5):
        y2 = j * (H // 12)
        draw.line([(0, y2), (W, y2)], fill=(18, 10, 8), width=2)
    # 장비 실루엣
    rng10 = np.random.RandomState(110)
    for i in range(6):
        ex = int(rng10.rand() * W)
        ew = int(rng10.rand() * 50 + 30)
        eh = int(rng10.rand() * 100 + 60)
        draw.rectangle([ex - ew // 2, H - eh, ex + ew // 2, H], fill=(8, 4, 3))
    img = img.filter(ImageFilter.GaussianBlur(1))
    img = add_vignette(img, 0.7)
    img = add_scan_lines(img, 5)
    img = add_noise(img, 16)
    return img

def make_fsp_base():
    """FSP 기지 — 자급자족 마을, 따뜻한 분위기"""
    img = gradient_bg(W, H, (35, 20, 10), (65, 35, 15))
    draw = ImageDraw.Draw(img)
    # 지평선
    hz2 = H * 3 // 5
    draw.rectangle([0, hz2, W, H], fill=(45, 22, 9))
    # 건물 (FSP 스타일 — 더 따뜻하고 유기적)
    rng11 = np.random.RandomState(120)
    for i in range(10):
        x3 = int(rng11.rand() * W)
        bw3 = int(rng11.rand() * 50 + 30)
        bh3 = int(rng11.rand() * 60 + 40)
        # 돔형 지붕
        draw.ellipse([x3 - bw3 // 2, hz2 - bh3 - 10, x3 + bw3 // 2, hz2 - bh3 + 20],
                     fill=(28, 14, 7))
        draw.rectangle([x3 - bw3 // 2, hz2 - bh3 + 10, x3 + bw3 // 2, hz2],
                       fill=(28, 14, 7))
        # 불빛
        if rng11.rand() > 0.5:
            draw.rectangle([x3 - 6, hz2 - bh3 + 20, x3 + 6, hz2 - bh3 + 28],
                           fill=(180, 130, 60))
    img = img.filter(ImageFilter.GaussianBlur(1.5))
    img = add_vignette(img, 0.45)
    img = add_noise(img, 14)
    return img

def make_zone4_ruins():
    """헬라스 4구역 폐광 — 30년 된 흔적, 부식된 구조물"""
    img = gradient_bg(W, H, (20, 12, 8), (45, 22, 10))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, H * 2 // 3, W, H], fill=(30, 14, 6))
    # 무너진 광산 구조물
    rng12 = np.random.RandomState(130)
    for i in range(8):
        x4 = int(rng12.rand() * W)
        # 쓰러진 빔
        angle = rng12.rand() * 60 - 30
        length = int(rng12.rand() * 100 + 60)
        import math
        x4b = x4 + int(length * math.cos(math.radians(angle)))
        y4 = int(H * 2 // 3 - rng12.rand() * 80)
        y4b = y4 + int(length * math.sin(math.radians(angle)))
        draw.line([(x4, y4), (x4b, y4b)], fill=(18, 9, 5), width=6)
    # 광산 입구
    cx5 = W // 2
    draw.ellipse([cx5 - 80, H * 2 // 3 - 60, cx5 + 80, H * 2 // 3 + 10], fill=(5, 3, 2))
    img = img.filter(ImageFilter.GaussianBlur(1))
    img = add_vignette(img, 0.65)
    img = add_dust_particles(img.convert('RGBA'), 300).convert('RGB')
    img = add_noise(img, 18)
    return img


# ── 생성 목록 ─────────────────────────────────────────────────────────────────

BACKGROUNDS = {
    'hellas_zone4_deep_tunnel': make_underground_tunnel,
    'mcc_board_chamber': make_mcc_board_chamber,
    'mcc_executive_floor': make_mcc_executive_floor,
    'mcc_archive_sublevel': make_mcc_archive_sublevel,
    'hellas_mining_village': make_hellas_mining_village,
    'hellas_mining_village_fire': make_hellas_village_fire,
    'hellas_labor_district_night': make_hellas_labor_district_night,
    'olympus_exterior': make_olympus_exterior,
    'olympus_summit_station': make_olympus_summit_station,
    'fsp_assembly_hall': make_fsp_assembly_hall,
    'erebus_throne_hall': make_erebus_throne_hall,
    'argyre_canyon_night': make_argyre_canyon_night,
    'argyre_plains': make_argyre_plains,
    'sandstone_junction': make_sandstone_junction,
    'kepler_crater_dawn': make_kepler_crater_dawn,
    'new_athens_shipyard': make_new_athens_shipyard,
    'hellas_outer_relay': make_hellas_outer_relay,
    'erebus_base_interior': make_erebus_base_interior,
    'fsp_base': make_fsp_base,
    'hellas_zone4_ruins': make_zone4_ruins,
}

if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f'배경 이미지 생성 → {OUT_DIR}')
    for name, fn in BACKGROUNDS.items():
        try:
            img = fn()
            save(img, name)
        except Exception as e:
            print(f'  ✗ {name}: {e}')
    print(f'\n완료: {len(BACKGROUNDS)}개 생성됨')
