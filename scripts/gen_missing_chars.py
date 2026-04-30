#!/usr/bin/env python3
"""신규 명명 캐릭터 + 제네릭 NPC 초상화 생성"""
import os, sys, time, requests

STABILITY_KEY = 'sk-PTUCPZoj9uysIUFu0spIL2IE3zq4pqv6axxQMBJRdFCudTMe'
CHAR_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'campaign', 'characters')

CHAR_STYLE = (
    "pixel art character portrait, 32-bit RPG character illustration, "
    "semi-realistic pixel art, dark sci-fi Mars setting, "
    "dramatic lighting from below and side, detailed pixel shading, "
    "bust shot head and shoulders, strong silhouette, "
    "vertical portrait format, game visual novel character art"
)
NEG = (
    "photorealistic, 3D render, anime, cartoon, full body, "
    "blurry, watermark, text, chibi, deformed"
)

MISSING = {
    # 명명 주요 캐릭터
    'hestia': (
        "woman in her 40s, FSP water reclamation engineer, "
        "practical work uniform, hair tied back tightly, "
        "eyes that calculate flow rates and human costs simultaneously, "
        "grease on her hands, engineer's calm in crisis, " + CHAR_STYLE
    ),
    'jin': (
        "Korean man age 30s, MCC technical analyst, "
        "neat glasses and pressed uniform, "
        "face that has read one too many cover-up reports, "
        "someone about to break protocol for the first time, " + CHAR_STYLE
    ),
    'marchetti': (
        "Italian man age 50s, MCC legal division, "
        "expensive pressure-suit tailored like a business jacket, "
        "silver hair, hands that have signed off on too many things, "
        "calculating eyes behind professional warmth, " + CHAR_STYLE
    ),
    'marco': (
        "Latino man age 28, CV raider crew, "
        "rough tactical jacket, CV insignia scratched not sewn, "
        "young and efficient, learning how to be dangerous, " + CHAR_STYLE
    ),
    'marko': (
        "Eastern European man age 45, Hellas mine supervisor, "
        "thick beard dusty from mine work, "
        "independent miner not aligned with any faction, "
        "suspicious of everyone, loyal to his crew, " + CHAR_STYLE
    ),
    'osei': (
        "Ghanaian man age 35, FSP community leader, "
        "dashiki worn under pressure suit vest, "
        "calm commanding presence, community voted him in three times, "
        "face that has mediated a hundred arguments, " + CHAR_STYLE
    ),
    'pak_seung_ho': (
        "Korean man age 55, MCC Zone 12 records officer, "
        "meticulous keeper of files that were supposed to stay sealed, "
        "bureaucrat's face hiding survivor guilt, "
        "the man who knows where the bodies are buried, literally, " + CHAR_STYLE
    ),
    'ramos': (
        "Filipina woman age 32, FSP medic-engineer hybrid, "
        "medical kit and repair tools competing for belt space, "
        "cheerful under pressure, practically unshakeable, "
        "the person the whole base calls when things break, " + CHAR_STYLE
    ),
    'renata_vieira': (
        "Brazilian woman age 40, Olimpus neutral zone administrator, "
        "crisp neutral-faction uniform, no insignia at all, "
        "face trained to show nothing but competence, "
        "keeper of the summit station's neutrality, " + CHAR_STYLE
    ),
    'rev_hale': (
        "reverend, man age 60s, non-denominational Mars chaplain, "
        "worn religious collar on pressure suit, "
        "face of someone who has presided over too many mine funerals, "
        "kind eyes that have seen the worst of human nature, " + CHAR_STYLE
    ),
    'reza': (
        "Iranian man age 38, FSP strategic coordinator, "
        "short trimmed beard, tactical jacket with FSP colors, "
        "eyes that run probability assessments constantly, "
        "the one who planned the routes nobody else could see, " + CHAR_STYLE
    ),
    'ryu': (
        "Japanese woman age 25, CV intelligence operative, "
        "neutral civilian clothes covering CV training, "
        "quiet analytical face, "
        "infiltration specialist, three years inside MCC before extraction, " + CHAR_STYLE
    ),
    'berk': (
        "Turkish man age 42, independent cargo hauler, "
        "worn hauler's jacket with multiple faction patches removed, "
        "neutral by necessity, everyone's friend and no one's ally, "
        "face that has survived five faction conflicts through pragmatism, " + CHAR_STYLE
    ),
    'thomas_alder': (
        "German man age 58, MCC board member, "
        "impeccable corporate suit, silver cufflinks, "
        "face of someone who has never set foot in a mine "
        "but has signed death warrants for miners, "
        "Zone 12 files are his responsibility, " + CHAR_STYLE
    ),
    'olu_adeyemi': (
        "Nigerian man age 48, FSP's chief spacecraft designer, "
        "engineering tablet always in hand, "
        "hair going grey at temples from decades of impossible calculations, "
        "built the ship with his own hands almost, "
        "Gaia is his life's work, " + CHAR_STYLE
    ),
    # 제네릭 NPC
    'mcc_guard': (
        "generic MCC corporate security guard, "
        "full uniform helmet with visor down, no visible face, "
        "standard-issue MCC black and blue body armor, "
        "faceless authority, " + CHAR_STYLE
    ),
    'cv_scout_1': (
        "CV scout, face covered by dust mask and tactical goggles, "
        "Crow Vanguard scout kit, scrappy improvised gear, "
        "lean and fast, desert warfare ready, " + CHAR_STYLE
    ),
    'cv_scout_2': (
        "second CV scout, slightly different build, same dust mask, "
        "CV colors on shoulder, battle-worn equipment, "
        "silent watching presence, " + CHAR_STYLE
    ),
    'bartender': (
        "Mars colony bar worker, gender neutral, "
        "worn apron over pressure suit liner, "
        "face that has heard every faction's complaints, "
        "knows everything, says nothing useful, " + CHAR_STYLE
    ),
    'worker': (
        "anonymous Mars worker, dust mask on, "
        "standard colony work suit, faction unclear, "
        "exhausted hands, someone who just wants to survive, " + CHAR_STYLE
    ),
    'stranger': (
        "cloaked figure, face in shadow, "
        "no faction markings, deliberately neutral clothing, "
        "could be from any side or none, "
        "the uncertain presence, " + CHAR_STYLE
    ),
    'pilgrim_assassin': (
        "figure in pilgrim-style worn cloak on Mars, "
        "weapon hidden, faith-motivated, "
        "eyes burning with conviction beneath hood, "
        "someone who believes they are doing God's work on Mars, " + CHAR_STYLE
    ),
}


def generate_sd3(prompt, out_path):
    url = "https://api.stability.ai/v2beta/stable-image/generate/sd3"
    headers = {"Authorization": f"Bearer {STABILITY_KEY}", "Accept": "image/*"}
    data = {"prompt": prompt, "negative_prompt": NEG, "model": "sd3-medium",
            "output_format": "png", "aspect_ratio": "9:16"}
    for attempt in range(3):
        try:
            r = requests.post(url, headers=headers, files={"none": ""}, data=data, timeout=120)
            if r.status_code == 200:
                open(out_path, "wb").write(r.content)
                return True
            elif r.status_code == 429:
                wait = 30 * (attempt + 1)
                print(f"  rate limited → {wait}s 대기...", flush=True)
                time.sleep(wait)
            else:
                print(f"  API {r.status_code}: {r.text[:150]}", flush=True)
                if attempt < 2: time.sleep(10)
        except Exception as e:
            print(f"  error: {e}", flush=True)
            if attempt < 2: time.sleep(10)
    return False


def main():
    os.makedirs(CHAR_DIR, exist_ok=True)
    force = "--force" in sys.argv

    targets = {k: v for k, v in MISSING.items()
               if force or not os.path.exists(os.path.join(CHAR_DIR, f"{k}.png"))
               or os.path.getsize(os.path.join(CHAR_DIR, f"{k}.png")) < 80_000}

    print(f"총 {len(MISSING)}개 정의 → {len(targets)}개 생성 필요\n")
    done = fail = 0
    for i, (name, prompt) in enumerate(targets.items(), 1):
        out = os.path.join(CHAR_DIR, f"{name}.png")
        print(f"  [{i:2d}/{len(targets)}] → {name}...", end=" ", flush=True)
        if generate_sd3(prompt, out):
            sz = os.path.getsize(out)
            print(f"✓ ({sz//1024}KB)")
            done += 1
        else:
            print("✗")
            fail += 1
        time.sleep(2)

    print(f"\n완료: {done}성공 / {fail}실패")
    print(f"캐릭터 총 {len(os.listdir(CHAR_DIR))}개")


if __name__ == "__main__":
    main()
