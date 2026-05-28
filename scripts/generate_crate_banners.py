from pathlib import Path
import math
import random

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BANNERS = ROOT / "assets" / "banners"
SHIPS = ROOT / "assets" / "ships" / "top"
W, H = 1024, 512


def font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Helvetica.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


FONT_TITLE = font(68, True)
FONT_BADGE = font(34, True)


def radial_mask(size, center, radius, softness=1.0):
    w, h = size
    cx, cy = center
    px = Image.new("L", size, 0)
    pix = px.load()
    soft = max(1.0, radius * softness)
    for y in range(h):
        for x in range(w):
            d = math.hypot((x - cx) / radius, (y - cy) / radius)
            v = int(max(0, 255 * (1 - d) / soft))
            pix[x, y] = min(255, v)
    return px.filter(ImageFilter.GaussianBlur(24))


def make_gradient(top, bottom):
    img = Image.new("RGB", (W, H))
    pix = img.load()
    for y in range(H):
        t = y / (H - 1)
        for x in range(W):
            pix[x, y] = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
    return img.convert("RGBA")


def add_noise(img, amount=26):
    rnd = random.Random(250528)
    noise = Image.new("L", img.size)
    npix = noise.load()
    for y in range(img.height):
        for x in range(img.width):
            npix[x, y] = rnd.randrange(256)
    noise = ImageEnhance.Contrast(noise).enhance(1.8)
    tint = Image.merge("RGBA", (noise, noise, noise, Image.new("L", img.size, amount)))
    return Image.alpha_composite(img, tint)


def add_stars(draw, count, palette, seed):
    rnd = random.Random(seed)
    for _ in range(count):
        x = rnd.randrange(W)
        y = rnd.randrange(int(H * 0.78))
        r = rnd.choice([1, 1, 1, 2])
        col = rnd.choice(palette)
        a = rnd.randrange(80, 210)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(*col, a))


def add_mars(img, center, radius, palette, seed):
    rnd = random.Random(seed)
    planet = Image.new("RGBA", (radius * 2, radius * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(planet, "RGBA")
    for y in range(radius * 2):
        for x in range(radius * 2):
            dx, dy = x - radius, y - radius
            dist = math.hypot(dx, dy)
            if dist <= radius:
                shade = 1 - dist / radius * 0.55
                light = max(0, (dx * -0.55 + dy * -0.20) / radius) * 0.38
                bands = math.sin((y + rnd.random() * 2) * 0.045) * 0.07
                base = palette[int((y / (radius * 2)) * (len(palette) - 1))]
                col = tuple(max(0, min(255, int(c * (shade + light + bands)))) for c in base)
                planet.putpixel((x, y), (*col, 255))
    haze = planet.filter(ImageFilter.GaussianBlur(18))
    haze = ImageEnhance.Brightness(haze).enhance(1.45)
    img.alpha_composite(haze, (center[0] - radius, center[1] - radius))
    img.alpha_composite(planet, (center[0] - radius, center[1] - radius))
    d = ImageDraw.Draw(img, "RGBA")
    d.arc((center[0] - radius - 22, center[1] - radius - 14, center[0] + radius + 22, center[1] + radius + 14), 194, 340, fill=(255, 188, 120, 70), width=5)


def nebula(img, colors, seed):
    rnd = random.Random(seed)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    for col in colors:
        mask = radial_mask(img.size, (rnd.randrange(120, 940), rnd.randrange(40, 400)), rnd.randrange(150, 360), 0.9)
        blob = Image.new("RGBA", img.size, (*col, rnd.randrange(70, 135)))
        layer = Image.composite(blob, layer, mask)
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(28)))


def load_ship(name):
    ship = Image.open(SHIPS / name).convert("RGBA")
    alpha = ship.getchannel("A").filter(ImageFilter.GaussianBlur(0.35))
    rgb = ImageEnhance.Contrast(ship.convert("RGB")).enhance(1.35)
    rgb = ImageEnhance.Sharpness(rgb).enhance(1.55)
    ship = rgb.convert("RGBA")
    ship.putalpha(alpha)
    return ship


def place_ship(canvas, name, center, scale, angle, glow, trail=True):
    ship = load_ship(name)
    size = int(320 * scale)
    ship = ship.resize((size, size), Image.Resampling.LANCZOS).rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    x = int(center[0] - ship.width / 2)
    y = int(center[1] - ship.height / 2)

    shadow = Image.new("RGBA", ship.size, (*glow, 0))
    shadow.putalpha(ship.getchannel("A").filter(ImageFilter.GaussianBlur(18)))
    canvas.alpha_composite(shadow, (x, y))

    if trail:
        tr = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(tr, "RGBA")
        for i in range(6):
            off = 28 + i * 22
            d.line((center[0] - off, center[1] + 8 + i, center[0] - off - 190, center[1] + 36 + i * 7), fill=(*glow, max(0, 95 - i * 12)), width=max(2, 10 - i))
        canvas.alpha_composite(tr.filter(ImageFilter.GaussianBlur(8)))

    canvas.alpha_composite(ship, (x, y))


def draw_title(img, text, color):
    return  # 배너에 텍스트 굽지 않음 — 가챠 카드가 현지화 이름을 오버레이하므로 중복+잘림 방지
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    x, y = 52, 362
    for blur, alpha in [(18, 170), (7, 230)]:
        glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow, "RGBA")
        gd.text((x, y), text, font=FONT_TITLE, fill=(*color, alpha))
        layer.alpha_composite(glow.filter(ImageFilter.GaussianBlur(blur)))
    d.text((x + 3, y + 4), text, font=FONT_TITLE, fill=(0, 0, 0, 190))
    d.text((x, y), text, font=FONT_TITLE, fill=(246, 250, 255, 255))
    img.alpha_composite(layer)


def draw_badge(img, stars, color):
    d = ImageDraw.Draw(img, "RGBA")
    box = (756, 42, 966, 112)
    d.rounded_rectangle(box, radius=18, fill=(7, 11, 24, 188), outline=(*color, 210), width=2)
    d.rounded_rectangle((box[0] + 4, box[1] + 4, box[2] - 4, box[3] - 4), radius=14, outline=(*color, 74), width=1)
    text = "★" * stars
    bbox = d.textbbox((0, 0), text, font=FONT_BADGE)
    tx = box[0] + (box[2] - box[0] - (bbox[2] - bbox[0])) / 2
    ty = box[1] + (box[3] - box[1] - (bbox[3] - bbox[1])) / 2 - 2
    d.text((tx, ty), text, font=FONT_BADGE, fill=(*color, 255))


def cinematic_finish(img, color):
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle((0, 0, W, H), outline=(*color, 140), width=3)
    vignette = Image.new("L", img.size, 0)
    vp = vignette.load()
    for y in range(H):
        for x in range(W):
            dx = abs(x - W / 2) / (W / 2)
            dy = abs(y - H / 2) / (H / 2)
            vp[x, y] = int(min(220, max(0, (dx * dx + dy * dy - 0.34) * 210)))
    dark = Image.new("RGBA", img.size, (0, 0, 0, 210))
    img.alpha_composite(Image.composite(dark, Image.new("RGBA", img.size, (0, 0, 0, 0)), vignette))
    return add_noise(img, 18)


def standard():
    img = make_gradient((8, 18, 42), (3, 8, 18))
    d = ImageDraw.Draw(img, "RGBA")
    add_stars(d, 170, [(120, 175, 255), (205, 228, 255), (92, 120, 180)], 1)
    nebula(img, [(33, 82, 150), (18, 48, 104)], 2)
    add_mars(img, (790, 460), 185, [(95, 45, 34), (160, 82, 48), (204, 116, 66)], 3)
    for name, c, s, a in [("mcc_frg.png", (564, 220), 0.84, -19), ("cv_frg.png", (698, 260), 0.62, -15), ("mcc_dst.png", (438, 278), 0.52, -23)]:
        place_ship(img, name, c, s, a, (95, 150, 255))
    draw_badge(img, 1, (150, 186, 235))
    draw_title(img, "STANDARD CRATE", (100, 160, 255))
    return cinematic_finish(img, (87, 142, 220))


def premium():
    img = make_gradient((30, 10, 48), (8, 6, 26))
    d = ImageDraw.Draw(img, "RGBA")
    add_stars(d, 220, [(218, 140, 255), (255, 190, 238), (138, 120, 255)], 4)
    nebula(img, [(150, 56, 220), (236, 56, 164), (76, 90, 220)], 5)
    add_mars(img, (204, 446), 202, [(95, 37, 42), (170, 72, 63), (225, 104, 74)], 6)
    for name, c, s, a in [("fsp_bs.png", (594, 222), 1.04, -15), ("mcc_bs.png", (756, 282), 0.72, -11), ("fsp_crs.png", (406, 292), 0.68, -20), ("cv_crs.png", (282, 228), 0.48, -17)]:
        place_ship(img, name, c, s, a, (205, 88, 255))
    draw_badge(img, 3, (201, 126, 255))
    draw_title(img, "PREMIUM CRATE", (218, 72, 255))
    return cinematic_finish(img, (185, 72, 255))


def legendary():
    img = make_gradient((56, 19, 6), (9, 6, 14))
    d = ImageDraw.Draw(img, "RGBA")
    add_stars(d, 210, [(255, 211, 128), (255, 145, 70), (255, 238, 190)], 7)
    nebula(img, [(250, 132, 33), (255, 212, 82), (185, 58, 28)], 8)
    add_mars(img, (510, 482), 255, [(112, 38, 21), (210, 83, 34), (255, 151, 60)], 9)
    for x, y, a in [(114, 142, -13), (330, 104, -5), (732, 138, 12)]:
        d.line((x, y, x + 190, y + 55), fill=(255, 220, 110, 170), width=5)
        d.line((x, y, x + 190, y + 55), fill=(255, 108, 54, 80), width=14)
    place_ship(img, "cv_titan.png", (598, 222), 1.34, -10, (255, 189, 68), True)
    for name, c, s, a in [("mcc_bs.png", (304, 286), 0.66, -18), ("fsp_bs.png", (826, 298), 0.70, -4), ("cv_crs.png", (452, 152), 0.48, -16)]:
        place_ship(img, name, c, s, a, (255, 180, 70), True)
    draw_badge(img, 5, (255, 211, 88))
    draw_title(img, "LEGENDARY CRATE", (255, 196, 56))
    return cinematic_finish(img, (255, 178, 50))


def main():
    BANNERS.mkdir(parents=True, exist_ok=True)
    outputs = {
        "crate_standard.png": standard(),
        "crate_premium.png": premium(),
        "crate_legendary.png": legendary(),
    }
    for name, img in outputs.items():
        path = BANNERS / name
        img.convert("RGB").save(path, "PNG", optimize=True)
        print(path.relative_to(ROOT), path.stat().st_size)


if __name__ == "__main__":
    main()
