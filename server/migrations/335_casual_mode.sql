-- 335_casual_mode.sql
-- Web3 분리 — 캐주얼 모드. ON 이면 실자금 레일(USDT 입금/출금, PP↔USDT swap, PP→GP 변환)을 분리해
--   순수 클로즈드루프 GP 게임으로 제시한다. 모바일 캐주얼 유저의 지갑/크립토 진입장벽 제거.
--
--   계정 자체는 이미 signup 시 합성/커스터디 월렛(crypto.randomBytes)을 받으므로 외부 지갑 연결 없이 플레이 가능.
--   캐주얼 모드는 그 위에서 "실자금 레일 UI 숨김 + 해당 엔드포인트 차단"만 한다.
--
--   적용:
--     - 클라(main-game.js): /api/config.casualMode=true 면 body.casual-mode → .web3-rail 요소 숨김.
--     - 서버(redemptionRoutes /swap·/withdraw·/withdraw-all, exchangeRoutes /exchange/pp-to-gp): 403 CASUAL_MODE.
--
--   기본 false 라 이 마이그레이션만으로는 동작 불변(현행 Web3 풀노출). 캐주얼 런칭 시 admin 에서 true.
--   주의: 실 입금이 존재하는 환경에서 켜면 출금 UI/엔드포인트가 막히므로, 실자금 발생 전/별도 배포에서 사용 권장.

INSERT INTO settings (category, key, value, description) VALUES
  ('economy', 'casual_mode_enabled', 'false',
     'Web3 분리 캐주얼 모드: true=실자금 레일(입금/출금/swap/PP→GP) UI 숨김 + 엔드포인트 차단(클로즈드루프 GP만)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ROLLBACK SQL:
--   DELETE FROM settings WHERE key = 'casual_mode_enabled';
-- ============================================================

INSERT INTO schema_migrations (filename) VALUES ('335_casual_mode.sql') ON CONFLICT DO NOTHING;
