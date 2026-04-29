#!/usr/bin/env python3
"""
프로젝트 마스 — 없는 캐릭터 초상화 생성기
반신상 스타일의 실루엣 + 컬러 강조 초상화를 생성한다.
"""

import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'campaign', 'characters')
W, H = 400, 600


def lerp(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

def gradient_bg(w, h, top, bottom):
    img = Image.new('RGBA', (w, h))
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / (h - 1)
        draw.line([(0, y), (w, y)], fill=(*lerp(top, bottom, t), 255))
    return img

def add_vignette(img, strength=0.5):
    w, h = img.size
    vg = Image.new('L', (w, h), 255)
    d = ImageDraw.Draw(vg)
    for i in range(60):
        t = i / 60
        a = int(255 * (1 - t * strength))
        rx = int(w // 2 * (1 - t * 0.9))
        ry = int(h // 2 * (1 - t * 0.9))
        d.ellipse([w//2 - rx, h//2 - ry, w//2 + rx, h//2 + ry], fill=a)
    vg = vg.filter(ImageFilter.GaussianBlur(40))
    r, g, b, a = img.split()
    bg = Image.new('RGBA', (w, h), (0, 0, 0, 255))
    img_with_vg = Image.merge('RGBA', [r, g, b, vg])
    bg.paste(img_with_vg, (0, 0), img_with_vg)
    return bg

def draw_character_base(draw, w, h, skin, hair, cloth, cloth2=None,
                         head_y_ratio=0.28, body_width_ratio=0.55,
                         accessory_fn=None):
    """
    기본 캐릭터 형태를 그린다.
    - skin: 피부색 RGB
    - hair: 머리카락 RGB
    - cloth: 상의 RGB
    - cloth2: 하의 또는 레이어 RGB
    """
    cx = w // 2
    head_y = int(h * head_y_ratio)
    head_r = int(w * 0.18)
    body_w = int(w * body_width_ratio)

    # 몸 (어깨~하단)
    body_top = head_y + head_r - 10
    body_pts = [
        (cx - body_w // 2, h),
        (cx - body_w // 2, body_top + 30),
        (cx - body_w // 3, body_top),
        (cx + body_w // 3, body_top),
        (cx + body_w // 2, body_top + 30),
        (cx + body_w // 2, h),
    ]
    draw.polygon(body_pts, fill=cloth)
    if cloth2:
        waist = int(h * 0.62)
        draw.rectangle([cx - body_w // 2, waist, cx + body_w // 2, h], fill=cloth2)

    # 목
    neck_w = int(head_r * 0.45)
    draw.rectangle([cx - neck_w, head_y + head_r - 5, cx + neck_w, body_top + 5], fill=skin)

    # 머리 (원형)
    draw.ellipse([cx - head_r, head_y - head_r, cx + head_r, head_y + head_r], fill=skin)

    # 머리카락
    draw.arc([cx - head_r, head_y - head_r, cx + head_r, head_y + head_r],
             start=200, end=340, fill=hair, width=int(head_r * 0.3))
    # 앞머리
    draw.ellipse([cx - head_r + 4, head_y - head_r,
                  cx + head_r - 4, head_y - head_r + int(head_r * 0.5)], fill=hair)

    # 눈
    eye_y = head_y - int(head_r * 0.1)
    eye_dx = int(head_r * 0.38)
    eye_r = int(head_r * 0.13)
    draw.ellipse([cx - eye_dx - eye_r, eye_y - eye_r,
                  cx - eye_dx + eye_r, eye_y + eye_r], fill=(20, 20, 30))
    draw.ellipse([cx + eye_dx - eye_r, eye_y - eye_r,
                  cx + eye_dx + eye_r, eye_y + eye_r], fill=(20, 20, 30))
    # 눈빛
    draw.ellipse([cx - eye_dx - 2, eye_y - 3, cx - eye_dx + 2, eye_y + 1], fill=(255, 255, 255))
    draw.ellipse([cx + eye_dx - 2, eye_y - 3, cx + eye_dx + 2, eye_y + 1], fill=(255, 255, 255))

    # 입
    mouth_y = head_y + int(head_r * 0.45)
    draw.arc([cx - int(head_r * 0.22), mouth_y - 4,
              cx + int(head_r * 0.22), mouth_y + 4],
             start=10, end=170, fill=(skin[0]-30, skin[1]-40, skin[2]-30), width=2)

    if accessory_fn:
        accessory_fn(draw, cx, head_y, head_r, body_top, body_w)

    return head_y, head_r, body_top, body_w


def make_portrait(bg_top, bg_bottom, skin, hair, cloth, cloth2=None,
                  accent_color=None, accessory_fn=None,
                  head_y_ratio=0.28, body_width_ratio=0.55,
                  post_fn=None):
    img = gradient_bg(W, H, bg_top, bg_bottom)
    draw = ImageDraw.Draw(img)
    head_y, head_r, body_top, body_w = draw_character_base(
        draw, W, H, skin, hair, cloth, cloth2,
        head_y_ratio=head_y_ratio,
        body_width_ratio=body_width_ratio,
        accessory_fn=accessory_fn
    )
    if accent_color:
        # 컬러 글로우
        cx = W // 2
        for r in range(60, 10, -4):
            a = int(30 * r / 60)
            draw.ellipse([cx - r, head_y - r, cx + r, head_y + r],
                         outline=(*accent_color, a))
    if post_fn:
        post_fn(draw, W, H)
    img = add_vignette(img, 0.6)
    img = img.filter(ImageFilter.GaussianBlur(0.5))
    return img.convert('RGBA')


def save(img, name):
    path = os.path.join(OUT_DIR, name + '.png')
    img.save(path, 'PNG')
    print(f'  ✓ {name}.png')


# ── 캐릭터별 ────────────────────────────────────────────────────────────────

def make_liang_wei():
    """Liang Wei — 30년 케플러 과학자, 안경, 연구복"""
    def glasses(draw, cx, hy, hr, bt, bw):
        ey = hy - int(hr * 0.1)
        dx = int(hr * 0.38)
        gr = int(hr * 0.17)
        draw.ellipse([cx-dx-gr, ey-gr, cx-dx+gr, ey+gr], outline=(80, 80, 100), width=2)
        draw.ellipse([cx+dx-gr, ey-gr, cx+dx+gr, ey+gr], outline=(80, 80, 100), width=2)
        draw.line([cx-dx+gr, ey, cx+dx-gr, ey], fill=(80, 80, 100), width=1)
        # 코트 깃
        draw.polygon([(cx-40, bt), (cx-10, bt+50), (cx, bt+40)], fill=(45, 50, 60))
        draw.polygon([(cx+40, bt), (cx+10, bt+50), (cx, bt+40)], fill=(45, 50, 60))
    def post(draw, w, h):
        # 데이터패드
        draw.rectangle([w//2+60, h//2, w//2+120, h//2+80], fill=(30, 40, 55))
        draw.rectangle([w//2+65, h//2+5, w//2+115, h//2+75], fill=(40, 60, 90))
        for i in range(5):
            draw.line([w//2+68, h//2+15+i*10, w//2+112, h//2+15+i*10], fill=(80, 120, 180), width=1)
    return make_portrait(
        (15, 20, 35), (8, 12, 22),
        (210, 175, 145), (30, 25, 20),
        (55, 62, 75), (40, 45, 58),
        accent_color=(80, 140, 220),
        accessory_fn=glasses, post_fn=post
    )

def make_yuna():
    """Yuna Kim — 22세 FSP, 헬라스 출신, 단발"""
    def short_hair(draw, cx, hy, hr, bt, bw):
        # 단발
        draw.rectangle([cx-hr-5, hy-hr//2, cx+hr+5, hy+hr//3], fill=(20, 15, 10))
        # FSP 배지
        draw.ellipse([cx+30, bt+10, cx+55, bt+35], fill=(180, 50, 30))
        draw.ellipse([cx+33, bt+13, cx+52, bt+32], fill=(200, 70, 40))
    return make_portrait(
        (30, 15, 10), (60, 30, 12),
        (195, 155, 120), (22, 15, 10),
        (120, 55, 30), (80, 38, 18),
        accent_color=(200, 80, 40),
        accessory_fn=short_hair
    )

def make_crow():
    """Crow — CV 전투원, 마스크, 어두운 복장"""
    def mask_and_gear(draw, cx, hy, hr, bt, bw):
        # 하단 마스크
        my = hy + int(hr * 0.15)
        draw.rectangle([cx-int(hr*0.7), my, cx+int(hr*0.7), hy+hr-2], fill=(15, 12, 10))
        draw.rectangle([cx-int(hr*0.6), my+5, cx+int(hr*0.6), hy+hr-5], fill=(22, 18, 15))
        # 필터
        for i in range(3):
            draw.ellipse([cx-10+i*10, hy+hr-20, cx+2+i*10, hy+hr-10], fill=(30, 28, 25))
        # 장갑
        draw.rectangle([cx+bw//2-10, bt+80, cx+bw//2+20, bt+160], fill=(18, 14, 12))
    return make_portrait(
        (8, 5, 8), (18, 10, 8),
        (160, 130, 110), (8, 6, 5),
        (20, 18, 15), (15, 12, 10),
        accent_color=(200, 60, 40),
        accessory_fn=mask_and_gear
    )

def make_aisha():
    """Aisha — CV 전투원, 자연스러운 헤어, 강인한 인상"""
    def natural_hair(draw, cx, hy, hr, bt, bw):
        # 볼륨 있는 헤어
        for dx in range(-hr, hr+1, 8):
            r2 = int(hr * 0.35)
            draw.ellipse([cx+dx-r2, hy-hr-5, cx+dx+r2, hy-hr//2], fill=(12, 8, 5))
        # 귀걸이
        draw.line([cx+hr-5, hy+5, cx+hr, hy+25], fill=(180, 140, 60), width=2)
        draw.ellipse([cx+hr-4, hy+22, cx+hr+4, hy+30], fill=(180, 140, 60))
        # CV 문신 힌트 (목/어깨)
        draw.arc([cx+15, hy+hr-10, cx+45, hy+hr+20], start=0, end=180, fill=(80, 60, 120), width=2)
    return make_portrait(
        (12, 8, 10), (25, 14, 10),
        (130, 95, 70), (12, 8, 5),
        (35, 22, 15), (25, 15, 10),
        accent_color=(120, 80, 180),
        accessory_fn=natural_hair
    )

def make_hagar():
    """Hagar Volkov — FSP 노인, 지구를 기억하는 마지막 세대"""
    def elder_features(draw, cx, hy, hr, bt, bw):
        # 흰 수염/주름 표현
        for i in range(5):
            sx = cx - int(hr*0.4) + i * 14
            draw.line([sx, hy+int(hr*0.4), sx+3, hy+hr+8], fill=(200, 200, 195), width=1)
        # 주름
        for i in range(3):
            y0 = hy - int(hr*0.2) + i * 8
            draw.arc([cx-int(hr*0.6), y0-3, cx+int(hr*0.6), y0+3],
                     start=0, end=180, fill=(150, 120, 100), width=1)
        # FSP 낡은 코트
        draw.polygon([(cx-50, bt), (cx-20, bt+60), (cx, bt+50)], fill=(70, 50, 30))
        draw.polygon([(cx+50, bt), (cx+20, bt+60), (cx, bt+50)], fill=(65, 45, 28))
    return make_portrait(
        (25, 18, 12), (50, 30, 15),
        (185, 155, 130), (200, 200, 195),
        (75, 55, 32), (60, 42, 22),
        accent_color=(180, 150, 80),
        accessory_fn=elder_features,
        head_y_ratio=0.3
    )

def make_kenji():
    """Kenji Nakamura — FSP 정보 요원, 조용한 인상, 5년 무승진"""
    def intel_style(draw, cx, hy, hr, bt, bw):
        # 안경 (얇은 테)
        ey = hy - int(hr * 0.1)
        dx = int(hr * 0.38)
        gr = int(hr * 0.16)
        draw.rectangle([cx-dx-gr, ey-4, cx-dx+gr, ey+4], outline=(60, 60, 70), width=1)
        draw.rectangle([cx+dx-gr, ey-4, cx+dx+gr, ey+4], outline=(60, 60, 70), width=1)
        draw.line([cx-dx+gr, ey, cx+dx-gr, ey], fill=(60, 60, 70), width=1)
        # 칼라 있는 셔츠
        draw.polygon([(cx-25, bt), (cx-8, bt+40), (cx, bt+30)], fill=(50, 55, 65))
        draw.polygon([(cx+25, bt), (cx+8, bt+40), (cx, bt+30)], fill=(50, 55, 65))
    return make_portrait(
        (12, 14, 22), (6, 8, 16),
        (200, 168, 135), (15, 12, 8),
        (55, 58, 70), (40, 42, 55),
        accent_color=(100, 120, 180),
        accessory_fn=intel_style
    )

def make_verk():
    """Verk — 카리오페 항법사, 중성적 외모, 우주복 칼라"""
    def nav_style(draw, cx, hy, hr, bt, bw):
        # 우주복 넥라인
        draw.arc([cx-int(bw//2*0.8), bt-10, cx+int(bw//2*0.8), bt+30],
                 start=200, end=340, fill=(80, 90, 100), width=6)
        draw.arc([cx-int(bw//2*0.7), bt-5, cx+int(bw//2*0.7), bt+25],
                 start=200, end=340, fill=(120, 135, 150), width=3)
        # 귀에 이어피스
        draw.ellipse([cx+hr-8, hy-3, cx+hr+5, hy+8], fill=(60, 80, 100))
        # 항법 패치
        draw.rectangle([cx-bw//2+10, bt+20, cx-bw//2+45, bt+55], fill=(40, 55, 80))
        draw.ellipse([cx-bw//2+18, bt+28, cx-bw//2+37, bt+47], fill=(60, 100, 160))
    return make_portrait(
        (8, 10, 18), (15, 18, 30),
        (175, 155, 140), (45, 40, 35),
        (65, 78, 95), (55, 65, 80),
        accent_color=(60, 120, 200),
        accessory_fn=nav_style
    )

def make_observer():
    """Observer (Hidden Route) — 관찰자, 흐릿한 실루엣"""
    img = gradient_bg(W, H, (5, 3, 8), (12, 8, 15))
    draw = ImageDraw.Draw(img)
    cx = W // 2
    head_y = int(H * 0.28)
    head_r = int(W * 0.18)
    # 흐릿한 실루엣
    for alpha in [30, 20, 15, 10]:
        r_off = alpha // 5
        draw.ellipse([cx-head_r-r_off, head_y-head_r-r_off,
                      cx+head_r+r_off, head_y+head_r+r_off],
                     fill=(60, 50, 80))
    draw.ellipse([cx-head_r, head_y-head_r, cx+head_r, head_y+head_r], fill=(40, 35, 55))
    # 몸
    bw = int(W * 0.5)
    body_top = head_y + head_r - 10
    draw.polygon([
        (cx-bw//2, H), (cx-bw//2, body_top+30), (cx-bw//3, body_top),
        (cx+bw//3, body_top), (cx+bw//2, body_top+30), (cx+bw//2, H)
    ], fill=(30, 25, 40))
    # 눈 — 관찰하는 빛
    ey = head_y - int(head_r * 0.1)
    edx = int(head_r * 0.38)
    draw.ellipse([cx-edx-8, ey-8, cx-edx+8, ey+8], fill=(8, 100, 180))
    draw.ellipse([cx+edx-8, ey-8, cx+edx+8, ey+8], fill=(8, 100, 180))
    draw.ellipse([cx-edx-3, ey-3, cx-edx+3, ey+3], fill=(200, 240, 255))
    draw.ellipse([cx+edx-3, ey-3, cx+edx+3, ey+3], fill=(200, 240, 255))
    img = img.filter(ImageFilter.GaussianBlur(1.5))
    img = add_vignette(img, 0.7)
    return img.convert('RGBA')

def make_miner_anon():
    """익명 광부 — 마스크로 얼굴 가림, 광부 복"""
    def miner_mask(draw, cx, hy, hr, bt, bw):
        # 전체 마스크
        draw.rectangle([cx-int(hr*0.8), hy-int(hr*0.1), cx+int(hr*0.8), hy+hr], fill=(28, 22, 18))
        # 고글
        draw.ellipse([cx-int(hr*0.45)-5, hy-int(hr*0.3)-5, cx-int(hr*0.45)+20, hy-int(hr*0.3)+20],
                     fill=(15, 18, 22))
        draw.ellipse([cx+int(hr*0.45)-15, hy-int(hr*0.3)-5, cx+int(hr*0.45)+10, hy-int(hr*0.3)+20],
                     fill=(15, 18, 22))
        # 먼지 마스크 선
        draw.arc([cx-int(hr*0.5), hy+int(hr*0.2), cx+int(hr*0.5), hy+hr+5],
                 start=0, end=180, fill=(40, 35, 30), width=3)
        # 작업복 포켓
        draw.rectangle([cx-bw//2+10, bt+60, cx-bw//2+45, bt+100], fill=(30, 22, 14))
        draw.rectangle([cx-bw//2+15, bt+65, cx-bw//2+40, bt+95], fill=(35, 26, 16))
    return make_portrait(
        (15, 10, 8), (30, 18, 10),
        (150, 120, 95), (18, 14, 10),
        (40, 30, 20), (30, 22, 14),
        accent_color=(80, 60, 40),
        accessory_fn=miner_mask
    )

def make_miner_elder():
    """광부 노인 — 나이 든 광부, 경험이 얼굴에"""
    def elder_miner(draw, cx, hy, hr, bt, bw):
        # 헬멧 힌트
        draw.arc([cx-hr, hy-hr, cx+hr, hy-hr//3],
                 start=200, end=340, fill=(40, 35, 28), width=8)
        # 주름 강조
        for i in range(4):
            y0 = hy - int(hr*0.15) + i * 7
            draw.arc([cx-int(hr*0.55), y0-2, cx+int(hr*0.55), y0+2],
                     start=5, end=175, fill=(120, 95, 75), width=1)
        # 수염 (짧은)
        for i in range(8):
            sx = cx - int(hr*0.4) + i * 12
            draw.line([sx, hy+int(hr*0.45), sx+2, hy+int(hr*0.7)], fill=(80, 70, 60), width=1)
        # 작업복
        draw.polygon([(cx-45, bt), (cx-15, bt+50), (cx, bt+40)], fill=(35, 25, 15))
        draw.polygon([(cx+45, bt), (cx+15, bt+50), (cx, bt+40)], fill=(32, 22, 13))
    return make_portrait(
        (20, 14, 10), (40, 25, 12),
        (170, 138, 108), (75, 68, 55),
        (38, 28, 18), (28, 20, 12),
        accent_color=(100, 80, 50),
        accessory_fn=elder_miner,
        head_y_ratio=0.3
    )


# ── 실행 ──────────────────────────────────────────────────────────────────────

PORTRAITS = {
    'liang_wei': make_liang_wei,
    'yuna': make_yuna,
    'crow': make_crow,
    'aisha': make_aisha,
    'hagar': make_hagar,
    'kenji': make_kenji,
    'verk': make_verk,
    'observer': make_observer,
    'miner_anon': make_miner_anon,
    'miner_elder': make_miner_elder,
}

if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f'캐릭터 초상화 생성 → {OUT_DIR}')
    for name, fn in PORTRAITS.items():
        try:
            img = fn()
            save(img, name)
        except Exception as e:
            import traceback
            print(f'  ✗ {name}: {e}')
            traceback.print_exc()
    print(f'\n완료: {len(PORTRAITS)}개 생성됨')
