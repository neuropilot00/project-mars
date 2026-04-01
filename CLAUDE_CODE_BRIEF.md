# PIXEL WAR — Claude Code 개발 브리핑 v1.0
> 비즈니스 하네스 검수 완료 기준 | 2026-03-31

---

## 📌 프로젝트 한 줄 요약

**세계 지도 위 1,000,000 픽셀을 NFT로 소유하고, 광고 이미지를 올리며, 덮어쓰기 전쟁을 벌이는 Web3 게임형 광고 플랫폼.**
레트로 픽셀 게임 감성 (Press Start 2P 폰트, 도트 그래픽 UI, 캔버스 VFX) + 블록체인 소유권 + 게임 이벤트 (배/비행기/카이주/아레나) 가 결합된 복합 컨텐츠.

---

## 🗂️ 현재 파일 구조 (베이스라인)

```
/블록체인 유저참여용 프로젝트/
├── index.html          ← 메인 월드맵 (LIVE MAP) — 완성됨
├── app.html            ← 픽셀 클레임 페이지 — Sprint 1 완성됨
├── arena.html          ← 아레나 레이싱 — 미완성, Sprint 6 재작업 필요
├── GEMINI_ASSET_BRIEF.md
├── CLAUDE_CODE_BRIEF.md  ← 이 파일
└── assets/
    ├── sprites/
    │   ├── ship.png       (2760×1504 — 10 ships, 5×2 grid, 552×752 per cell)
    │   ├── plane.png      (2760×1504 — 10 craft, 5×2 grid, 552×752 per cell)
    │   └── monster.png    (1024×558  — 15 monsters, 5×3 grid, 204×186 per cell)
    ├── logo/
    │   ├── Gemini_Generated_Image_66cdls66cdls66cd.png  (2754×1536 — UI Sheet A)
    │   ├── Gemini_Generated_Image_4r4w994r4w994r4w.png
    │   └── Gemini_Generated_Image_decgy9decgy9decg.png
    ├── ui/
    │   └── Gemini_Generated_Image_xb7yahxb7yahxb7y.png  (2754×1536 — UI Sheet B)
    ├── racing/
    │   └── Gemini_Generated_Image_ltd8cmltd8cmltd8.png  (1377×768  — Racing Sheet)
    └── vfx/             (비어있음 — canvas로 직접 구현)

/uploads/ (read-only 참조용)
├── world-map-pixel-art_509477-166.avif           ← 메인 월드맵 배경 (사용 중)
├── world-map-pixel-art_509477-166-cc0f1de4.avif  ← 대체용
└── world-map-concept-background-with-country-names_763064-614.avif
```

---

## 🎮 디자인 원칙 (절대 변경 불가)

| 항목 | 스펙 |
|------|------|
| 폰트 | `'Press Start 2P', monospace` (Google Fonts CDN) |
| 배경색 | `#0A0C10` (최어두운 네이비블랙) |
| 타이틀바 | `height:26px`, `background:#0D0F18`, `border-bottom:2px solid #252A3E` |
| HUD 바 | `height:44px`, `background:#06080E`, `border-top:2px solid #1A2035`, bottom fixed |
| 강조색 | 금색 `#FFD700`, 청록 `#4AC8FF`, 녹 `#4CFF9A`, 오렌지 `#FF9020` |
| 이미지 렌더링 | `image-rendering: pixelated` 전체 적용 |
| 레이아웃 | 타이틀바(26px) + 플렉스 레이아웃 + HUD(44px) — `padding-top:26px`, `padding-bottom:44px` |

---

## 🖼️ 스프라이트 클리핑 좌표 (검증 완료)

### ship.png (2760×1504) — 5×2 grid, cell = 552×752
```javascript
const SHIP_CLIPS = {
  fishing:     {sx:   0, sy:   0, sw:552, sh:752},
  container:   {sx: 552, sy:   0, sw:552, sh:752},
  explorer:    {sx:1104, sy:   0, sw:552, sh:752},
  tugboat:     {sx:1656, sy:   0, sw:552, sh:752},
  dreadnought: {sx:2208, sy:   0, sw:552, sh:752},
  drilling:    {sx:   0, sy: 752, sw:552, sh:752},
  speedboat:   {sx: 552, sy: 752, sw:552, sh:752},
  survey:      {sx:1104, sy: 752, sw:552, sh:752},
  galleon:     {sx:1656, sy: 752, sw:552, sh:752},
  submarine:   {sx:2208, sy: 752, sw:552, sh:752},
};
```

### plane.png (2760×1504) — 5×2 grid, cell = 552×752
```javascript
const PLANE_CLIPS = {
  starscout:    {sx:   0, sy:   0, sw:552, sh:752},
  cargo:        {sx: 552, sy:   0, sw:552, sh:752},
  frigate:      {sx:1104, sy:   0, sw:552, sh:752},
  diplomatic:   {sx:1656, sy:   0, sw:552, sh:752},
  capital:      {sx:2208, sy:   0, sw:552, sh:752},
  miner:        {sx:   0, sy: 752, sw:552, sh:752},
  racer:        {sx: 552, sy: 752, sw:552, sh:752},
  research:     {sx:1104, sy: 752, sw:552, sh:752},
  merchant:     {sx:1656, sy: 752, sw:552, sh:752},
  infiltrator:  {sx:2208, sy: 752, sw:552, sh:752},
};
```

### monster.png (1024×558) — 5×3 grid, cell = 204×186
```javascript
const MONSTER_CLIPS = {
  // Row 0
  atomic:       {sx:   0, sy:   0, sw:204, sh:186},
  tremor:       {sx: 204, sy:   0, sw:204, sh:186},
  kraken:       {sx: 408, sy:   0, sw:204, sh:186},
  tripodPyro:   {sx: 612, sy:   0, sw:204, sh:186},
  knifeyard:    {sx: 816, sy:   0, sw:204, sh:186},
  // Row 1
  arachno:      {sx:   0, sy: 186, sw:204, sh:186},
  magma:        {sx: 204, sy: 186, sw:204, sh:186},
  redweed:      {sx: 408, sy: 186, sw:204, sh:186},
  ghidorah:     {sx: 612, sy: 186, sw:204, sh:186},
  leatherback:  {sx: 816, sy: 186, sw:204, sh:186},
  // Row 2
  tripodA:      {sx:   0, sy: 372, sw:204, sh:186},
  tripodB:      {sx: 204, sy: 372, sw:204, sh:186},
  tripodC:      {sx: 408, sy: 372, sw:204, sh:186},
  tripodD:      {sx: 612, sy: 372, sw:204, sh:186},
  tripodE:      {sx: 816, sy: 372, sw:204, sh:186},
};
```

### racing/Gemini_Generated_Image_ltd8cmltd8cmltd8.png (1377×768)
```javascript
const RC = {
  gantry:       {sx: 728, sy:  50, sw:300, sh:230},
  crowd:        {sx: 890, sy: 310, sw:380, sh:160},
  flagCheck:    {sx:1200, sy: 490, sw: 80, sh:130},
  flagGreen:    {sx:1065, sy: 490, sw: 80, sh:130},
  billOverwrite:{sx: 730, sy: 490, sw:130, sh:100},
  billJackpot:  {sx: 880, sy: 490, sw:130, sh:100},
};
```

### Logo clip (UI Sheet A — 66cdls)
```javascript
const LOGO_CLIP = {sx:60, sy:300, sw:1240, sh:310};
// ⚠️ 이 좌표는 추정값. 브라우저에서 확인 후 미세조정 필요
```

---

## 🔧 공통 캔버스 유틸리티 (모든 페이지에 동일 적용)

```javascript
// 스프라이트 그리기 (좌우 반전 지원)
function drawSprite(key, clip, dx, dy, dw, dh, flipX=false) {
  const img = SHEETS[key]; if (!img) return;
  CTX.save();
  if (flipX) { CTX.scale(-1,1); CTX.translate(-dx*2-dw, 0); }
  CTX.drawImage(img, clip.sx, clip.sy, clip.sw, clip.sh, dx, dy, dw, dh);
  CTX.restore();
}

// 비율 유지 높이 계산 (항상 사용)
// dh = dw * (clip.sh / clip.sw)

// 라벨 그리기 (반투명 배경 박스)
function drawLabel(text, x, y) {
  CTX.save();
  CTX.font = '6px "Press Start 2P",monospace';
  const tw = CTX.measureText(text).width;
  CTX.fillStyle = 'rgba(0,0,0,0.7)';
  CTX.fillRect(x-tw/2-5, y-14, tw+10, 14);
  CTX.strokeStyle = 'rgba(80,140,200,0.5)'; CTX.lineWidth=1;
  CTX.strokeRect(x-tw/2-5, y-14, tw+10, 14);
  CTX.fillStyle = '#DDEEFF'; CTX.textAlign='center'; CTX.textBaseline='bottom';
  CTX.fillText(text, x, y);
  CTX.restore();
}

// 에셋 로딩 (Promise.all 패턴)
const SHEETS = {};
function loadImg(key, src) {
  return new Promise(res => {
    const img = new Image();
    img.onload  = () => { SHEETS[key]=img; res(img); };
    img.onerror = () => { console.warn('Missing:', src); res(null); };
    img.src = src;
  });
}
Promise.all([
  loadImg('ship',    './assets/sprites/ship.png'),
  loadImg('plane',   './assets/sprites/plane.png'),
  loadImg('monster', './assets/sprites/monster.png'),
  loadImg('logo',    './assets/logo/Gemini_Generated_Image_66cdls66cdls66cd.png'),
  loadImg('racing',  './assets/racing/Gemini_Generated_Image_ltd8cmltd8cmltd8.png'),
]).then(() => frame()); // 모든 에셋 로드 후에만 프레임 루프 시작
```

---

## ⚡ VFX 파티클 클래스 (canvas 순수 구현 — 외부 파일 없음)

```javascript
class GoldFall {   // 영토 클레임 시 금 파티클 폭발
  constructor(x,y) { /* 50개 파티클, 금색 hsl(30~60,100%,55%) */ }
  update() { /* 중력 +0.25, life -0.018 */ }
  draw()   { /* fillRect per particle */ }
  dead()   { return this.life<=0; }
}
class WaterSplash { // 배 항적 (배 뒤에서 좌우로)
  constructor(x,y,dir=1) { /* 16 물방울 파티클 */ }
}
class SmokePuff {   // 비행체 연기 궤적
  constructor(x,y)  { /* 원형, r 증가, alpha 감소 */ }
}
class EnergyBurst { // 카이주 공격 링 (expandring)
  constructor(x,y,color) { /* 원형 스트로크, r +4/frame */ }
}

let vfxPool = [];
function spawnVFX(v) { vfxPool.push(v); }
function updateVFX() {
  vfxPool = vfxPool.filter(v => !v.dead());
  vfxPool.forEach(v => { v.update(); v.draw(); });
}
```

---

## 🗺️ PWMA HUD 바 — 정확한 8-세그먼트 구조

```
[ TOTAL CLAIMED ] [ TOTAL CLAIMED ] [ PP ] [ PP ] [ PP ] [ PP ] [ PP ] [ Odometer + DRAG & CLAIM COST ]
     usdt값            한도값         ×5개 포인트풀                         금색 USDT 오도미터
```

```html
<!-- HUD 정확한 구조 -->
<div class="hud"> <!-- height:44px, fixed bottom -->
  <div class="hud-seg">TOTAL CLAIMED / USDT값</div>
  <div class="hud-seg">TOTAL CLAIMED / 1,000,000 USDT</div>
  <div class="hud-seg">POINT POOL / PP값</div>
  <div class="hud-seg">POINT POOL / PP값</div>
  <div class="hud-seg">POINT POOL / PP값</div>
  <div class="hud-seg">POINT POOL / PP값</div>
  <div class="hud-seg">POINT POOL / PP값</div>
  <div class="hud-seg right"> <!-- 오른쪽 끝, border-left -->
    <div>Odometer</div>
    <hr>
    <div>DRAG & CLAIM COST</div>
    <div class="odo-val">0 USDT</div>
  </div>
</div>
```

---

## 📋 개발 우선순위 로드맵 (확정)

```
Phase 1 ← 지금 진행 중
  → 픽셀 맵 이미지 클레임 / 구매 / Overwrite 시스템
  → 관련 파일: app.html (Sprint 1 완성됨, Sprint 2 남음)

Phase 2 ← 다음
  → 배 & 비행기 경로 시스템 강화 (충돌, 영역 침범 반응)
  → 관련 파일: index.html 강화, app.html 엔티티 레이어

Phase 3 ← 그 다음
  → 카이주 & 외계인 재난 이벤트 (VRF 랜덤, 픽셀 피해)
  → 관련 파일: index.html + app.html 재난 시스템

Phase 4 ← 마지막
  → 아레나 레이싱 컨텐츠 (아래 컨셉아트 기준 전면 재설계)
  → 관련 파일: arena.html 전면 재작성
```

---

## 📄 Phase 1 완료 상태 (app.html Sprint 1)

### ✅ 구현 완료된 기능
- 월드맵 AVIF 배경 + canvas 오버레이
- 드래그 선택 (mousedown → mousemove → mouseup) 좌표 시스템
  - `GRID_SIZE = 1000` (1000×1000 논리 픽셀 그리드)
  - `canvasToGrid()` / `gridToCanvas()` 양방향 변환
  - `normalizeRect()` 드래그 방향 무관 정규화
- 실시간 HUD 오도미터 업데이트 (선택 중 USDT 비용 표시)
- 선택 영역 시각화 (애니메이션 대시 점선 + 코너 핸들 + 크기 라벨)
- 이미지 업로드 모달 (파일 선택 + URL 입력)
  - `FileReader` → `createImageBitmap()` → 캔버스에 프리뷰 표시
  - 업로드된 이미지가 선택 영역에 오버레이 렌더링
- 클레임 확인 → `claims[]` 배열에 저장 → 캔버스에 즉시 렌더링
- 1.2× Overwrite 가격 메커니즘 (`rectsOverlap()`)
- 데모 클레임 10개 사전 배치 (5개 팩션)
- GoldFall VFX (클레임 성공 시 폭발)
- 이동 엔티티 (ships × 5, planes × 3, kaiju × 5)
- WaterSplash / SmokePuff / EnergyBurst VFX 클래스
- 사이드바 (Recent Claims, Global Stats, Factions, Active Threats)
- 토스트 알림 시스템

### ⚠️ Sprint 2에서 추가 필요한 기능
1. **소유된 픽셀 경계선 강화** — 소유자 이미지가 있는 셀은 가는 흰 테두리, 없으면 팩션색 테두리
2. **픽셀 호버 정보** — 이미 클레임된 픽셀에 마우스 오버 시 소유자 툴팁 (owner, price, timestamp)
3. **미니맵** — 사이드바에 1000×1000 그리드 전체 현황 미니맵 (각 팩션 색 도트)
4. **선택 취소** — ESC 키 또는 우클릭으로 선택 취소

---

## 🏁 Phase 4: arena.html 전면 재설계 스펙

> ⚠️ 현재 arena.html은 레이싱 트랙 중심. 아래 컨셉아트(SEA RACING ARENA [PROJECT v8.6] CONCEPT C) 기준으로 전면 재작성 필요.

### 컨셉아트에서 확인된 레이아웃 구조

```
┌─────────────────────────────────────────────────────────────────┐
│  PIXEL WAR                           1.2x Overwrite Price Reset │
│  SEA RACING ARENA [PROJECT v8.6] | CONCEPT C                    │
├─────────────────┬───────────────────────────────────────────────┤
│ KAIJU ALERTS    │                                                │
│                 │           BETTING TABLE                        │
│ ┌─────────────┐ │  BOAT# | NAME/COLOR | BET ODDS | PAST PERF |  │
│ │ KRAKEN      │ │  CURRENT POOL | POOL SHARE                    │
│ │ HP: ██████  │ │                                                │
│ ├─────────────┤ │  (5 entrants × 6 columns)                     │
│ │ TRIPOD      │ │                                                │
│ │ HP: ████    │ │                                                │
│ ├─────────────┤ │                                                │
│ │ GODZILLA    │ │                                                │
│ │ HP: ██      │ │                                                │
│ └─────────────┘ │                                                │
├─────────────────┼───────────────────────────────────────────────┤
│ LIVE BUOY COURSE│  LIVE BUOY COURSE FEED    BETTING & WALLET    │
│ (미니맵)         │  (메인 레이스 캔버스)      CONTROL PANEL        │
│  ○──○──○──○──○  │                            [BET AMOUNT INPUT]  │
│    ↑ 현재 위치  │  배들이 부표 사이를         [CONFIRM BET BTN]   │
└─────────────────┴──────────────┬──────────────┴─────────────────┘
                                  │ HUD BAR (공통)
```

### 베팅 테이블 컬럼 상세
```
BOAT # | NAME / COLOR | BET ODDS | PAST PERF | CURRENT POOL | POOL SHARE
  1    | ⛵ Galleon  |  3.2×    |  ██████   |  1,240 USDT  |  38.2%
  2    | 🚢 Container|  2.1×    |  ████     |    890 USDT  |  27.4%
  3    | ⚓ Survey   |  5.6×    |  ██       |    420 USDT  |  12.9%
  4    | 🛥 Speedboat|  7.8×    |  █        |    310 USDT  |   9.5%
  5    | ⚔ Dreadnought| 1.8×   |  ████████ |    386 USDT  |  11.8%
```

- **BET ODDS** = `(totalPool × 0.95) / shipPool` — 실시간 갱신
- **PAST PERF** = 픽셀 도트 바 (최근 10경기 승리 기록)
- **CURRENT POOL** = 해당 배에 베팅된 USDT 총액
- **POOL SHARE** = 전체 풀 대비 퍼센트

### Kaiju Alerts 패널 (좌측)
```javascript
// 3개 카이주 카드 — 각 카드:
{
  name: 'KRAKEN DETECTED',
  hp: 85,          // 현재 HP (0~100)
  maxHp: 100,
  status: 'ACTIVE', // ACTIVE / RETREATING / DEFEATED
  sprite: MONSTER_CLIPS.kraken,  // 스프라이트 미니 캔버스
  threat: 'HIGH',   // HIGH / MED / LOW
}
// HP 바는 위협도에 따라 색상: HIGH=#FF4040, MED=#FFA040, LOW=#40FF80
// 카이주가 아레나 코스에 이벤트 영향: ex. KRAKEN → 특정 구간 속도 감소
```

### Live Buoy Course (하단 좌측 미니맵)
```javascript
// 타원형 코스 — 5개 부표 (BUOY #1~5)
// 각 배의 현재 위치를 색상 도트로 표시
// 코스 세그먼트별 위험 구간 표시 (카이주 영향권)
const COURSE_BUOYS = [
  {x:0.15, y:0.5},  // Buoy 1 — Start/Finish
  {x:0.35, y:0.2},  // Buoy 2
  {x:0.65, y:0.2},  // Buoy 3
  {x:0.85, y:0.5},  // Buoy 4
  {x:0.5,  y:0.8},  // Buoy 5
];
```

### Live Buoy Course Feed (하단 중앙 — 메인 레이스 캔버스)
- racing sheet에서 sea track tiles 클리핑하여 배경
- 배들이 코스를 따라 실제로 이동하는 애니메이션
- 카이주 등장 시 monster 스프라이트 오버레이 + EnergyBurst VFX
- 선두/후위 판정 실시간 표시

### Betting & Wallet Control (하단 우측)
```
[WALLET: 0xA1B2...] [BALANCE: 1,240 USDT]
────────────────────────────────
SELECT BOAT:  [1] [2] [3] [4] [5]
BET AMOUNT:   [____] USDT  [MAX]
              [____] PP    [MAX]
────────────────────────────────
YOUR BET:     BOAT #2 — 500 USDT
POTENTIAL WIN: 1,050 USDT (2.1×)
────────────────────────────────
[▶ CONFIRM BET]  [✕ CANCEL]
────────────────────────────────
RACE STATUS: BETTING OPEN (2:34)
```

### VRF 랜덤 이벤트 (레이스 중 발생)
```javascript
const VRF_EVENTS = [
  {id:'jetstream',  prob:0.15, name:'JET STREAM',   effect: 'leader speed +20%'},
  {id:'bermuda',    prob:0.10, name:'BERMUDA ZONE',  effect: 'random boat teleport'},
  {id:'kraken',     prob:0.10, name:'KRAKEN ATTACK', effect: 'last place speed -30%'},
  {id:'enginefail', prob:0.05, name:'ENGINE FAIL',   effect: 'random boat stall 3s'},
  {id:'tailwind',   prob:0.08, name:'TAILWIND',      effect: 'all speed +10%'},
];
// 매 200프레임마다 VRF 판정
// 이벤트 발생 시: event log 패널에 추가 + 캔버스 이벤트 VFX + showEvt() 토스트
```

---

## 🔐 Security Auditor 사전 체크리스트 (프론트엔드 단계)

현재 프론트엔드 프로토타입 단계이므로 스마트 컨트랙트 미포함.
**향후 Sprint 3 (지갑 연동) 때 반드시 적용할 항목들:**

- [ ] `ethers.js v6` 사용 (v5 아님 — BigInt 처리 방식 다름)
- [ ] 트랜잭션 서명 전 금액 재확인 모달 (이중 확인)
- [ ] 이미지 IPFS 업로드 전 파일 크기 제한 (최대 5MB)
- [ ] CORS 정책: URL 이미지 로드 시 crossOrigin='anonymous' 처리
- [ ] XSS 방지: innerHTML에 사용자 입력값 직접 삽입 금지 (textContent 사용)
- [ ] 지갑 연결 해제 시 UI 상태 초기화
- [ ] 체인 ID 검증 (Base Mainnet = 8453, BNB = 56)

---

## ⚖️ Compliance 사전 체크리스트

- [ ] 픽셀 소유권 = ERC-721 NFT (유틸리티 토큰으로 분류)
- [ ] POINT POOL(PP) = 플랫폼 내 유틸리티 포인트 (법정화폐 가치 없음 명시)
- [ ] USDT 결제 = 스테이블코인 결제 (환율 변동 없음)
- [ ] 아레나 베팅 = 한국 사행행위 규제 검토 필요 (실제 배포 전 법무 검토 권고)
- [ ] 이미지 업로드 = 저작권 침해 신고 시스템 필요 (Sprint 5 이후)
- [ ] KYC = MVP 단계 불필요, 규모 확대 시 추가

---

## 📁 파일별 현재 상태 & 다음 작업

### index.html
- **상태**: 완성 (레트로 UI, 스프라이트 엔티티, VFX, PWMA HUD)
- **다음 작업**: Phase 3에서 카이주 피해 시스템 추가 시 수정

### app.html
- **상태**: Sprint 1 완성 (드래그 클레임, 이미지 업로드, 소유권 표시)
- **다음 작업 (Sprint 2)**:
  1. 소유된 픽셀 호버 → 소유자 정보 툴팁
  2. ESC 키로 선택 취소
  3. 미니맵 (사이드바에 전체 현황)
  4. 클레임된 픽셀 개수 → HUD 실시간 반영

### arena.html
- **상태**: 이전 버전 (레이싱 트랙 중심, 컨셉아트와 다름)
- **다음 작업 (Sprint 6 — Phase 4)**:
  - 위 컨셉아트 기반 전면 재설계
  - 3-패널 레이아웃 (KAIJU ALERTS | BETTING TABLE | empty)
  - 2-패널 하단 (LIVE BUOY COURSE FEED | BETTING & WALLET CONTROL)
  - Pari-mutuel odds 실시간 계산
  - VRF 이벤트 시스템

---

## 🌐 월드맵 배경 이미지 참조

```html
<!-- 경로: HTML 위치 기준 상대 경로 -->
<img src="../uploads/world-map-pixel-art_509477-166.avif"
     class="world-map" id="worldMap"
     style="position:absolute;top:0;left:0;width:100%;height:100%;
            object-fit:cover;object-position:center top;
            image-rendering:pixelated;">
```

---

## 🔑 핵심 비즈니스 메커니즘 (코드에 정확히 반영)

### Overwrite Price Escalation
```
최초 클레임: area(px²) × 0.0001 USDT
Overwrite:   max(현재_소유자_지불가격 × 1.2, 기본가격)
→ 클레임이 반복될수록 해당 픽셀의 가치가 기하급수적으로 상승
→ 이것이 핵심 바이럴 루프: "내 광고판을 뺏기지 않으려면 더 비싸게 재클레임"
```

### Point Pool (PP) 분배 원리
```
픽셀 구매 금액의 일정 비율 → PP 풀에 적립
PP 홀더 → 풀 보상 비례 배분 (DeFi yield 개념)
PP는 아레나 베팅에도 사용 가능 (USDT/PP 이중 결제)
```

### 아레나 Pari-mutuel Odds
```javascript
// 매 프레임 실시간 계산
odds[i] = (totalPool × 0.95) / poolPerBoat[i]
// 예: totalPool=3,246, boat2Pool=890 → odds[2] = 3,246×0.95/890 = 3.46×
// 모든 배팅자 동시 베팅 → 오즈 실시간 변동 → 게임성 핵심
```

---

## ⚡ 즉시 실행 가능한 다음 명령

```
다음 Claude Code 세션에서 실행할 작업:

1. [app.html Sprint 2]
   - 클레임된 픽셀 호버 툴팁 (소유자, 가격, 시간)
   - ESC 취소
   - 사이드바 미니맵 추가

2. [arena.html Sprint 6 전면 재작성]
   - 위 컨셉아트 3+2 패널 레이아웃 구현
   - 베팅 테이블 (6컬럼)
   - Kaiju Alerts 카드 (HP바)
   - Live Buoy Course Feed 캔버스
   - Betting & Wallet Control 패널
   - VRF 이벤트 시스템

3. [index.html 검토]
   - 로고 클립 좌표 시각적 확인 후 미세조정
   - 월드맵 배경 로딩 오류 없는지 확인
```

---

*비즈니스 하네스 파이프라인 완료: ORCHESTRATOR → RESEARCHER → PLANNER → CRITIC → Sprint 1*
*다음: Sprint 2 + Security/Compliance 검토 → Sprint 3 (지갑 연동) → ... → Sprint 6 (아레나)*
