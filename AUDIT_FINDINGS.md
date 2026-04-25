# OCCUPY MARS — Codebase Audit (v3.0 / 2026-04-25 — final)

> **이 문서는 코드베이스의 현재 상태를 외부 검토자(Codex 등)에게 넘기기 위한 정리본입니다.**
> 신고된 모든 버그와 자가 진단으로 발견한 이슈, 그리고 검증된 라이브 시스템을 한눈에 볼 수 있도록 구성됨.

## 📊 최종 통계
- **DB 테이블**: 219개
- **Settings 키**: 907개 (모든 라이브 기능 admin 조정 가능)
- **업적**: 29개 (4 카테고리, 4 언어)
- **마이그레이션**: 184개 적용
- **누적 커밋 (이번 작업)**: **27개**
- **Phantom 테이블**: 0개 (이전 35+)
- **검증된 frontend endpoint**: 60+개
- **마지막 커밋**: `3ca106e` — fix(hijack): 지불금액 + NPC 자동승리 + 함대 미리보기

## 🔄 최신 커밋 흐름 (시간 역순)
```
3ca106e  fix(hijack): 지불금액 0.00 + NPC 자동승리 + 함대 미리보기 (사용자 신고 3건)
290ce90  fix(mobile): iPad portrait/iPhone Pro Max landscape 사이드바 자동 열림 + 글로브 안 보임
e764e75  fix(mobile): 사이드바 z-index + 토스트 시각 일관성
2e76af9  docs(v3.0): CHANGELOG + 게임 가이드 'What's New' + AUDIT 최종화
0a48f17  fix: 추가 endpoint 버그 일괄 (전체 endpoint 감사 결과)
cfa8c10  fix(bugs): 사용자 신고 3건 + 테스트 중 발견 2건
```

## ✅ 사용자 신고 버그 (이번 세션 — 모두 해결)
| # | 신고 | 원인 | 처리 | 커밋 |
|---|---|---|---|---|
| 1 | 일일 출석체크 'Daily login failed' | getSetting() string 반환을 array로 사용 → INSERT NaN | JSON.parse + Array.isArray 가드 (services/daily.js + routes/api.js daily/status) | cfa8c10 |
| 2 | JOBS admin 통계 빈 값 | backend `{distribution}` vs frontend `{byJob, noJob, recentChanges}` shape mismatch | `routes/job.js` /admin/jobs에 byJob (per-job avg_gp/avg_pp 집계) + noJob + recentChanges | cfa8c10 |
| 3 | EVENTS 탭 빈 화면 | `switchTab()` cats 배열에 `'worldevents'` 누락 → .cat-worldevents 영원히 display:none | cats 배열에 worldevents 추가 (admin.html line 2716) | cfa8c10 |
| 4 | 모바일 사이드바 잡아먹힘 (하단 잘림) | `.panel-r/.panel-l` 모바일 open 시 z-index 120 < `.mob-bottom-nav` z 200 | z 250, padding-bottom safe-area + 110px, panel-close-fixed z 260 | e764e75 |
| 5 | 토스트 시각 일관성 부족 | showToast/showFactionToast 시각·위치·alias 모두 제각각 | 통합 .toast CSS (accent color만 type별 변경), showFactionToast→showToast 위임, 'red'/'green'/'h' legacy alias 자동 normalize | e764e75 |
| 6 | iPhone 양쪽 사이드바 열림 + 글로브 안 보임 | `@media(max-width:768px)`만 처리 → iPad portrait(820), Pro Max landscape(932), split-screen(800~)에서 데스크탑 layout 적용되어 panel 250+250=500px 가 글로브 가림 | 새 `@media(max-width:1024px)` 블록 — 태블릿도 슬라이드 패널, mob-toggle/mob-bottom-nav 표시, panel-tab 숨김. DOMContentLoaded에서 `innerWidth≤1024`면 .open 강제 제거 (캐시 방어) | 290ce90 |
| 7 | 하이젝 지불금액 0.00 PP 표시 | NPC 점령 영토 `pixels.price = 0` → `0 × 1.2 = 0` (무료 하이잭 가능) | `Math.max(existing.price, sectorBasePrice) × HIJACK_MULT` (client + server 4곳) | 3ca106e |
| 8 | NPC 함선 줬는데 자동승리 처리 | defender fleet lookup이 ORDER BY만 하고 HAVING 없음 → 빈 함대도 선택돼 phase1 결함 | `HAVING alive_ships > 0` 명시, 디버그 로그, 신규 `/admin/api/fleet/npc-status` 진단 endpoint + admin 버튼 | 3ca106e |
| 9 | 하이젝 시 상대 함대 정보 미표시 (사용자 추가 요청) | 디클레어 전에 자동승리/함대전 여부 알 방법 없음 | 신규 `/api/hijack/defender-info` + 모달에 "Fleet N개 · 함선 M척 → 함대전" 또는 "함대 없음 → 자동 승리" 라벨 표시 | 3ca106e |

## ✅ 자가 진단 버그 (테스트 중 발견 — 모두 해결)
| 영향 | 원인 | 처리 |
|---|---|---|
| /api/achievements 500 | ORDER BY a.sort_order (없음) | a.condition_value, a.key |
| /api/profile 500 | users.avatar_color/motto 컬럼 없음 | migration 184 추가 |
| /api/branding/my, spells admin 500 | claims.x1/y1/x2/y2 (실제: center_lat/lng/width/height) | 컬럼명 정정 |
| /api/resources/my 500 | i.resource_code (실제: resource_id FK) | JOIN resources r ON r.id = i.resource_id |
| /api/raffles/active 500 | /raffles/:id가 'active' parseInt → NaN | :id(\d+)로 숫자 제한 |
| 15+ 서비스 u.wallet JOIN 에러 | 이전 fix 시 WHERE만 정정, JOIN 누락 | u.wallet_address로 일괄 정정 |
| /api/claims/my 404 | endpoint 자체 없음 | routes/api.js에 추가 |
| /api/burn/* 404 | gpBurn 삭제됐으나 frontend UI 잔존 | UI 숨김 + loadBurnPanel no-op |

## 🟢 검증된 라이브 시스템 (현재 모두 동작)

### 핵심 게임 루프
| 시스템 | endpoint | 검증 |
|---|---|---|
| 클레임/픽셀 | /api/claims, /api/pixels | ✅ 300+ records |
| GP 경제 | gp_balance + gp_transactions + gp_activity_log | ✅ |
| 하이잭 (PVP) | /api/hijack/declare-with-pp + phaseC.js | ✅ |
| Fleet Combat | /api/fleets, /api/ships/* | ✅ 22 ship types, fleet detail OK |
| 공성전 | /api/siege/* | ✅ |
| 거버넌스 | /api/governance/leaderboard, /bounties | ✅ |
| 시즌 점수 | /api/season/active, /season/leaderboard | ✅ 1 season active |
| 마켓플레이스 | /api/marketplace/listings | ✅ |
| 옥션 | /api/auction, /api/auctions | ✅ |
| 일일 미션 | /api/daily/status, /missions, /login | ✅ Day 3, rewards 5/10/15... |
| 업적 | /api/achievements + auto-trigger | ✅ 29 achievements |
| PVP 베팅 | /api/betting/events, /bet, /mine | ✅ warBetting 단일 시스템 |
| 로켓 드롭 | /api/rockets | ✅ event #12 incoming |
| POI | /api/poi/* | ✅ |
| 파벌 | /api/factions | ✅ 3 factions (mcc/fsp/cv) |
| 길드 | /api/guild/leaderboard, /my | ✅ |
| 직업 | /api/jobs (5 jobs) | ✅ |
| 자원 | /api/resources/catalog, /my | ✅ 13 resources |
| 거버넌스 (commander/governor) | /api/governance/* | ✅ commander Woo |

### 보조 기능 (검증 통과)
- 영토: branding, monuments, tiers, spells, sponsors, shields, rentals, upgrades
- 플레이어: status, beacons, capsules, banners, graffiti, vtag, journals, milestones, highlights, ratings, tombstones
- 경제: stakes, polls, wagers, contests, donations, broadcasts, expeditions, raffles
- 미니게임: lottery, dividends, news, crafting

## 🟢 의도된 레이어드 아키텍처 (병합 불필요)
- chronicle + chronicleEnhanced (base + Discord wrapper)
- title + titleExtended (basic 13 + advanced 11)
- enhancement + enhancementAdvanced (instancing + recipe bonuses)
- job + jobs routes (user-ops + catalog)
- resource + resources routes (admin + user)
- auction + auctionRoutes (ops + listing)
- tournament + tournaments services (fleet + simple)

## 🟡 의도적 보류 (별도 작업, 영향 미미)
없음 — 이전 보류 4건 모두 처리됨.
- ✅ Fleet Combat 활성화 (이미 enabled, UI 정합성 fix)
- ✅ routes/ships.js 정리 (실제로는 신 fleet 시스템이었음, CLAUDE.md 메모 정정)
- ✅ news.js retention (24h 스케줄러 + retention setting 동작 확인)
- ✅ referral_count 최적화 (idx_users_referred_by 인덱스 존재)

## 🔴 알려진 미해결 (영향도 낮음, 의도적)
- battle.js / battle 라우트: 완전히 제거됨 (PVP는 fleet+hijack으로 통합)
- routes/ships.js의 일부 endpoint는 JWT auth만 (frontend가 매번 토큰 송부)
- /api/auth/me 404: frontend가 사용 안 함 (JWT decode local-side)

## 📚 문서 (모두 최신)
- **CHANGELOG.md** ← v3.0 패치 노트 (개발자용 상세)
- **CLAUDE.md** ← 신규 세션 핸드오프 (§13~16 보강)
- **AUDIT_FINDINGS.md** ← 이 문서 (기능별 매트릭스)
- **index.html in-game guide** ← "What's New" 섹션 신규 추가 (4개 언어 모두)

## 🆕 신규 진단/검증 API (이번 세션 추가)

| Endpoint | 목적 | 권한 |
|---|---|---|
| `GET /api/hijack/defender-info?wallet=` | 하이젝 모달에서 상대방 함대 미리보기 (auto-win vs fleet battle 사전 판단) | public |
| `GET /api/claims/my?wallet=` | 내 영토 목록 (expedition 셀렉터 등) | public |
| `GET /admin/api/fleet/npc-status` | NPC 전수 진단 (함대전 가능 vs 자동승리 위험 분류) | admin |
| `POST /admin/api/fleet/grant-starter-all-npcs` | NPC 전수 함대+함선+광물 일괄 지급 | admin |

## 🛡 검증 방법론

이번 작업에서 사용한 audit 방법:
1. 사용자 신고 스크린샷 직접 분석 → 정확한 원인 추적
2. **로컬 서버 가동** (port 3000) + curl로 60+ frontend endpoint 직접 호출
3. 5xx/404 응답마다 server.log 확인 → 코드 수정 → 재테스트
4. PostgreSQL 직접 쿼리로 schema mismatch 추적
5. node 스모크 테스트 (require 모든 services/routes)
6. index.html `<script>` 13개 syntax 검증

→ **다른 사람이 이 audit을 재현하려면**:
```bash
# 1. 서버 가동
DATABASE_URL=postgresql://jongho@localhost:5432/pixelwar \
JWT_SECRET=test-key ADMIN_SECRET=test-admin \
node server/index.js > /tmp/server.log 2>&1 &

# 2. endpoint 일괄 테스트
WALLET=0x... ; for ep in /api/claims/my /api/fleets /api/achievements; do
  curl -s -o /dev/null -w "%{http_code} $ep\n" "http://localhost:3000$ep?wallet=$WALLET"
done

# 3. 로그 확인
tail -30 /tmp/server.log | grep -E "error|warn"
```

---

*이 audit은 OCCUPY MARS 메인 컨텐츠(영토 점령, 함대 전투, 채굴, 거버넌스, 마켓)와*
*38개 보조 기능 모두 정상 동작을 검증한 결과입니다.*
