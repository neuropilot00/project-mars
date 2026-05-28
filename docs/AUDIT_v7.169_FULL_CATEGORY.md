# OCCUPY MARS — Full Category UI↔Backend Audit (v7.169 / 2026-05-28)

> 7 페르소나 병렬 풀카테고리 정밀 감사. **각 항목은 1회만 다룬다 — 같은 결함 반복 금지**.
> 상태: 🔴 critical (즉시) · 🟡 medium · ✅ 정상.

## 카테고리 매트릭스

| # | 카테고리 | 검수자 | Critical | Medium | 처리 라운드 |
|---|---|---|---|---|---|
| A | 인증·계정·온보딩·커스터디 지갑 | Agent-A | 3 | 7 | v7.170 |
| B | 영토·지구본·픽셀·날씨·POI | Agent-B | 0 | 5 | v7.170 부분 |
| C | 전투 시각화·tactical-lab·hijack | Agent-C | 0 | 5 | v7.170 부분 |
| D | 캠페인·씬엔진·에디터·서사 | Agent-D | 3 | 2 | v7.170 |
| E | 아이템·강화·자원·인벤토리 | Agent-E | 1 | 2 | v7.170 |
| F | 모바일·반응형·i18n·접근성 | Agent-F | 3 | 4 | v7.170 |
| G | 비판검토(보안·dead 라우트·WS·CORS) | Agent-G | 5 | — | v7.170 부분 |

## 🔴 Critical 결함 일람 (v7.170 라운드 처리 결과)

> 🟢 = v7.170 처리 완료 / 🔴 = 차후 라운드 / ⚙ = 대규모 변경 별도 계획

| ID | 위치 | 결함 | 상태 | 조치 |
|---|---|---|---|---|
| **A-C1** | `index.html:21585,21608` | `API` 전역 미정의 → change-password / delete-account fetch URL `"undefined/auth/..."` 항상 실패 | 🟢 v7.170 | `/api/auth/...` 절대경로로 직접 호출 |
| **A-C2** | `auth.js:818-820`, `email.js:7-12` | SMTP 미설정 시 reset code **평문 응답 노출** (dev fallback) | 🟢 v7.170 | `NODE_ENV !== 'production'` 가드 + warn 로그 |
| **A-C3** | `auth.js:129~` | `email_verified` 없음 — 회원가입 즉시 JWT 발급(이메일 인증 0) | ⚙ 별도 라운드 | SMTP 시스템 도입 필요 |
| **D-Crit-1** | `index.html:28163-28176` | `renderCampaignReputation` 이 `[mcc/fsp/cv]` 3종만 순회 → **Pilgrim Arms 평판 안 보임** | 🟢 v7.170 | 4종 확장 + 보라 색상(`#c08bff`) 추가 |
| **D-Crit-2** | `index.html` 전체 | 활성 칭호 장착 UI **0건** (백엔드 완비) | 🔴 차후 | UI 모달 별도 라운드 |
| **D-Crit-3** | `campaign.js:1769-1773` | `reputation_history` UI/API 노출 0 | 🔴 차후 | 화면 별도 라운드 |
| **E-Crit** | `index.html:24210-24273` | `enhancementAdvanced` (recipe + protect/blessed scroll) UI 0 | 🔴 차후 | 큰 모달 변경 별도 라운드 |
| **F-Crit-1** | i18n 4언어 블록 | ZH-only 21·JA/ZH 6·KO 4 누락 | 🔴 차후 | 키 백필 별도 라운드 |
| **F-Crit-2** | 버튼 780개 중 aria 12개 | 이모지 버튼 스크린리더 무명 | 🔴 차후 | 핵심 버튼 aria 별도 |
| **G-Crit-1** | `_liveWS.onmessage` 2종만 처리 | `cmd_err/error/notification` 사일런트 무시 | 🟢 v7.170 | 핸들러 3종 추가 + 토스트/폴링 갱신 |
| **G-Crit-2** | `index.js` CORS `endsWith` | wildcard 우회 가능 | 🟢 v7.170 | 정규식 매칭(메타이스케이프 + `[a-z0-9-]+`) |
| **G-Crit-3** | `index.html:21121,21346` | JWT localStorage XSS 노출 | ⚙ 별도 라운드 | httpOnly cookie 전환 필요 |
| **G-Crit-4** | `/admin/api/*` | CSRF 토큰 없음 | ⚙ 별도 라운드 | CSRF 미들웨어 도입 |
| **G-Crit-5** | mount 다수 dead | 공격 표면 | 🔴 차후 | 라우트 정리 별도 |

## 🟡 Medium 결함 일람

| ID | 위치 | 결함 | 우선순위 |
|---|---|---|---|
| A-M1 | `auth.js:538-701` | `/api/auth/link-wallet` 700줄 고아 — 외부 지갑 졸업 동선 0 | 후속 |
| A-M2 | `index.html:16449` | reveal-key 에러 메시지 ko-only | v7.170 |
| A-M3 | `auth.js:215-223` | 추천 자동 적용 — VPN 우회 가능 | 후속 |
| A-M4 | `auth.js:111` vs `index.html:21270` | 비밀번호 정책 클라/서버 불일치 (클라 6자/서버 8+복잡) | v7.170 |
| A-M5 | `index.html:21354` | `pw_rem_pass` Base64 평문 localStorage 저장 | 🟢 v7.170 — 저장 제거 + auto-login 비활성 + cleanup |
| A-M6 | `auth.js:155` | 닉네임 정규식 — 한글/일/중 닉네임 차단 | v7.170 |
| A-M7 | onboarding routes 분산 | 두 mount 충돌 가능 | 후속(문서화) |
| B-M1 | `bounty.js:11` + `territoryIdentity.js:7,171` | `/api/sectors/conflict-map` 중복 정의 | v7.170 |
| B-M2 | `index.html:33964` | POI 마커 렌더 경로 불명 | 후속(점검) |
| B-M3 | `territoryIdentity.js` | 영토 이미지 사전 검열 hook 0 | 후속(컴플라이언스) |
| B-M4 | `weather.js:77` | strategic 컬럼 silent disable | 운영 가이드 |
| B-M5 | overlays pointer-events | 모바일 globe 회귀 위험 | QA 항목 |
| C-M1 | `commanderActions.js:19` | beam_cannon/missile_barrage 서버 미연결 (CLAUDE.md v5.54 이미 알려짐) | 후속 |
| C-M2 | `battleEngine.js` | 환경 modifier 함대전 미적용 | 후속(큰 변경) |
| C-M3 | `hijack.js:229-235` | Phase 2 자동 시작 — 방어자 silent | 알림 push 추가 (v7.170) |
| C-M4 | `tactical-lab-v11.html` | 모바일 퍼포먼스 모드 JS 분기 약함 | 후속 |
| C-M5 | `tactical-lab-v11.html:2908-2911` | `cmd_ok/cmd_err` 콜아웃 아닌 로그만 | v7.170 |
| D-M1 | `index.html:29333+` | lockReason ko/en만 — ja/zh 폴백 없음 | 🟢 v7.170 — 8개 에러 키 모두 `tl()` 4언어 |
| D-M2 | `campaign.js:4377` | `getObjectiveState` race 가능 | 후속(현 영향 작음) |
| E-M1 | `resources.js:32` | 자원 인벤토리에 sector hint 표시 0 | v7.170 |
| E-M2 | `index.html:47761` | BS/Titan Capital 카드 강조 라벨 없음 | v7.170 |
| F-M1 | 6-7px 폰트 다수 | 모바일 가독성 미달 | 핵심 영역만 9~10px (v7.170) |
| F-M2 | `#bvTacticalFrame` 등 iframe | 모바일 safe-area 미보정 | 후속 |
| F-M3 | 터치 이벤트 16회만 | Fleet Command 진형 드래그 모바일 불가 추정 | 후속 |

## ✅ 정상 완전 연결 (간략)

- **인증/온보딩 core 흐름** — register/login/me/reveal-key/find-email/reset-password/update-profile/factions/referral/onboarding 모두 연결
- **영토 core** — claim·harvest·info·image·rename·hijack·sectors·governance·POI·weather·world events 모두 연결
- **전투 core** — WS 8x 스트리밍·HP 보정·격침 폭발·forfeit·battle report 풀스펙·hijack 2단계 자동 진행·무전 콜아웃
- **캠페인 core** — objective 라이브 상태·hard gate·objective→화면 라우팅·reward inbox·branch modifier·lore flag·tag 부여
- **함선/함대 core** — 22종 빌드·강화·수리·실드·해체·Fleet Command 6 액션·가챠 5종·각인 품질·cross-faction·마켓 6 액션·Battle Hub
- **마켓·옥션·미니게임·시즌** — marketplace 7/auction 4/lottery 4/season 8/캡슐·배너·스폰서·TDesc·브랜딩·비콘 6 GP 광고·컨테스트
- **머니플로** — Tier 1·Tier 2 차단 완료(v7.163~v7.166)

## 운영자에게 권고하는 별도 라운드 (v7.171+)

1. **이메일 인증 + 비밀번호 정책 일관화** — A-C3 + A-M4 + A-M6 같이
2. **JWT → httpOnly cookie 전환** — G-Crit-3 (큰 변경)
3. **어드민 CSRF 도입** — G-Crit-4
4. **활성 칭호 장착 모달 + reputation_history 화면** — D-Crit-2, D-Crit-3
5. **Dead 라우트 정리** — G-Crit-5 (1주 404 모드 후 mount 제거)
6. **CSP 헤더 + ServerSentEvents → WS 핸들러 보강** — G-Crit-1 보강
7. **Migration drift 자동 점검 스크립트** — 부팅 시 settings drift check
8. **link-wallet 외부 지갑 졸업 UI** — A-M1
9. **영토 이미지 검열 hook** — B-M3
10. **모바일 가독성 폰트 일제 상향 + iframe safe-area** — F 카테고리
