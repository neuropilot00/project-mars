#!/usr/bin/env python3
"""씬 오버레이 이미지 생성 — 픽셀아트 스타일 (Stable Image Core + style_preset=pixel-art)"""
import os, sys, time, requests

STABILITY_KEY = 'sk-PTUCPZoj9uysIUFu0spIL2IE3zq4pqv6axxQMBJRdFCudTMe'
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'campaign', 'overlays')

# style_preset=pixel-art 가 렌더링 스타일을 담당하므로
# 프롬프트는 피사체·분위기·색에만 집중
STYLE = (
    "dark background, dramatic close-up, moody Mars sci-fi, "
    "single subject focus, muted colors with one vivid accent, square"
)
NEG = "photorealistic, 3D render, anime, text, watermark, busy background, multiple subjects, blur"

OVERLAYS = {
    # 신체 / 감정
    'hand_still': (
        "close-up of a weathered human hand resting completely motionless on a surface, "
        "tense stillness, veins visible, not gripping, barely alive, "
        "dark industrial Mars surface beneath it, " + STYLE
    ),
    'hand_reaches': (
        "close-up of a hand reaching toward something just out of frame, "
        "desperate or careful reach, worn glove partially removed, " + STYLE
    ),
    'hand_fist': (
        "close-up of a tightly clenched fist, "
        "knuckles white, anger or determination, Mars colony dust on the skin, " + STYLE
    ),
    'eye_closeup': (
        "extreme close-up of a single human eye, "
        "wide with realization or narrowed with resolve, "
        "reflection of red Martian light in the iris, " + STYLE
    ),
    'tear_drop': (
        "close-up of a single tear running down a weathered cheek, "
        "dust-streaked face, grief held in, Mars colony survivor, " + STYLE
    ),
    'blood_drop': (
        "close-up of blood drops on industrial metal flooring, "
        "dark red, fresh, small drops in a line, "
        "cold clinical Mars lighting, aftermath of violence, " + STYLE
    ),
    # 문서 / 기록
    'sealed_file': (
        "close-up of a physical file folder stamped CLASSIFIED in red, "
        "MCC corporate seal on yellowed paper, "
        "30-year-old document, Zone 12 case number visible, "
        "the thing that was never supposed to be found, " + STYLE
    ),
    'zone12_record': (
        "close-up of a cracked data tablet displaying Zone 12 accident records, "
        "partial text of names visible, date 22 years ago, "
        "screen cracked as if thrown against a wall, " + STYLE
    ),
    'paper_burn': (
        "close-up of a corner of paper beginning to burn, "
        "orange flame eating into printed text, "
        "evidence being destroyed, " + STYLE
    ),
    # 장비 / 도구
    'oxygen_mask': (
        "close-up of an oxygen mask lying on the ground, "
        "cracked visor, emergency seal broken, "
        "someone took it off in a hurry or it failed them, " + STYLE
    ),
    'ore_sample': (
        "close-up of a chunk of glowing blue-cyan ore held in a gloved hand, "
        "Ancient Metal sample, bioluminescent mineral from 30 years underground, "
        "priceless and dangerous, " + STYLE
    ),
    'comm_static': (
        "close-up of a communication device screen showing only static, "
        "signal lost, emergency frequency dead, "
        "the call that never came through, " + STYLE
    ),
    'mine_sensor': (
        "close-up of a mine safety sensor light blinking red, "
        "danger indicator, atmosphere warning, "
        "the last warning before catastrophe, " + STYLE
    ),
    # 무기 / 폭력
    'bullet_casing': (
        "close-up of a spent bullet casing on Martian rock floor, "
        "still warm, catching industrial light, "
        "aftermath of a decision made, " + STYLE
    ),
    'knife_edge': (
        "close-up of a blade edge catching light, "
        "not drawn for threat — drawn for use, "
        "Mars colony survival tool repurposed, " + STYLE
    ),
    # 환경
    'broken_glass': (
        "close-up of cracked pressurized glass, "
        "spiderweb fracture pattern, "
        "thin atmosphere visible through the crack, "
        "one more hit from catastrophic decompression, " + STYLE
    ),
    'door_locked': (
        "close-up of a sealed door handle with red lock indicator, "
        "MCC corporate seal welded shut, "
        "the door that should not be opened, "
        "rust and time around the seal, " + STYLE
    ),
    'footprint_dust': (
        "close-up of a single boot print in red Mars dust, "
        "fresh print, someone was just here, "
        "the only evidence remaining, " + STYLE
    ),
    'candle_flame': (
        "close-up of a single small flame flickering, "
        "memorial candle in a colony habitat, "
        "names written on the wall behind it blurred but visible, " + STYLE
    ),
    # 상징
    'cv_insignia': (
        "close-up of a Crow Vanguard insignia scratched into metal, "
        "rough irregular lines, done with a blade not a stamp, "
        "30 years of militia identity, not corporate, " + STYLE
    ),
    'mcc_badge_cracked': (
        "close-up of an MCC corporate ID badge, "
        "cracked down the middle, "
        "the face on the badge barely recognizable, "
        "loyalty broken or identity shed, " + STYLE
    ),
    'three_flags': (
        "close-up of three small faction flags in a row — MCC blue, FSP green, CV red, "
        "standing in Mars dust, "
        "tiny scale, vast implications, " + STYLE
    ),
    'map_marked': (
        "close-up of a tactical map with a single location circled in red, "
        "handwritten notes around the mark, "
        "the objective, the target, the place everything converges, " + STYLE
    ),
    'empty_chair': (
        "close-up of an empty chair at a table, "
        "the person who sat here is gone, "
        "dust settling on the seat, "
        "absence made visible, " + STYLE
    ),
    # 우주 / 화성
    'mars_horizon': (
        "close-up of Mars horizon at the edge of a habitat viewport, "
        "red dust meeting thin sky, "
        "the planet that holds everything, indifferent, " + STYLE
    ),
    'stars_through_glass': (
        "close-up of stars visible through a scratched porthole glass, "
        "the vastness of space compressed into a small circle, "
        "Earth not visible, "
        "you can't go back, " + STYLE
    ),
    # 추가 (2차)
    'death_still': (
        "close-up of a single empty pressure suit helmet lying on Martian ground, "
        "visor cracked, dust settling inside, owner gone, "
        "the object that outlived its wearer, " + STYLE
    ),
    'fire_small': (
        "close-up of a small fire burning in a metal barrel inside a Mars colony, "
        "orange flame reflecting off worn metal walls, "
        "warmth in cold industrial darkness, " + STYLE
    ),
    'dust_storm': (
        "close-up view through a scratched porthole of a Mars dust storm approaching, "
        "red-orange wall of dust filling the frame, "
        "the planet asserting dominance, " + STYLE
    ),
    'silence_room': (
        "close-up of an empty table with two chairs, one pushed back like someone just left, "
        "cold coffee cup still there, "
        "the silence after a conversation that ended badly, " + STYLE
    ),
    'contract_sign': (
        "close-up of a contract document with a signature line, "
        "pen resting at the line, not yet signed or just signed, "
        "MCC corporate letterhead, the weight of commitment, " + STYLE
    ),
    'alone_window': (
        "close-up of a single figure's silhouette at a habitat window, "
        "just shoulders and head visible against Martian red sky, "
        "alone with the planet, " + STYLE
    ),
    'darkness_corridor': (
        "close-up of a corridor light flickering out, "
        "one light remaining in receding darkness, "
        "power failure or deliberate, last light in a tunnel, " + STYLE
    ),
    'collapse_debris': (
        "close-up of collapsed mine tunnel debris, "
        "support beam broken, rocks fallen, "
        "someone was under this, the weight of what happened, " + STYLE
    ),
    'child_small': (
        "silhouette of a small child standing alone, "
        "tiny figure against a large Mars habitat window, "
        "red planet light from outside, "
        "small palm pressed flat against cold glass, " + STYLE
    ),
}


def generate_core(prompt, out_path):
    """Stable Image Core + style_preset=pixel-art — 진짜 픽셀아트 출력"""
    url = "https://api.stability.ai/v2beta/stable-image/generate/core"
    headers = {"Authorization": f"Bearer {STABILITY_KEY}", "Accept": "image/*"}
    data = {
        "prompt": prompt,
        "negative_prompt": NEG,
        "style_preset": "pixel-art",
        "output_format": "png",
        "aspect_ratio": "1:1",
    }
    for attempt in range(3):
        try:
            r = requests.post(url, headers=headers, files={"none": ""}, data=data, timeout=120)
            if r.status_code == 200:
                open(out_path, "wb").write(r.content)
                return True
            elif r.status_code == 429:
                t = 30 * (attempt + 1)
                print(f"  rate limit → {t}s...", flush=True)
                time.sleep(t)
            else:
                print(f"  {r.status_code}: {r.text[:120]}", flush=True)
                if attempt < 2: time.sleep(10)
        except Exception as e:
            print(f"  err: {e}", flush=True)
            if attempt < 2: time.sleep(10)
    return False


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    force = "--force" in sys.argv
    targets = {k: v for k, v in OVERLAYS.items()
               if force or not os.path.exists(os.path.join(OUT_DIR, f"{k}.png"))
               or os.path.getsize(os.path.join(OUT_DIR, f"{k}.png")) < 50_000}

    print(f"오버레이 {len(OVERLAYS)}개 정의 → {len(targets)}개 생성\n")
    done = fail = 0
    for i, (name, prompt) in enumerate(targets.items(), 1):
        out = os.path.join(OUT_DIR, f"{name}.png")
        print(f"  [{i:2d}/{len(targets)}] → {name}...", end=" ", flush=True)
        if generate_core(prompt, out):
            print(f"✓ ({os.path.getsize(out)//1024}KB)")
            done += 1
        else:
            print("✗")
            fail += 1
        time.sleep(2)

    print(f"\n완료: {done}성공 / {fail}실패 | 총 {len(os.listdir(OUT_DIR))}개")

if __name__ == "__main__":
    main()
