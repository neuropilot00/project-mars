-- ═══════════════════════════════════════════════════
-- 176: game_settings → settings 호환 뷰
-- ═══════════════════════════════════════════════════
-- 다수 서비스(contest, spells, rental, expedition, crafting,
-- luckyBox, tournaments, broadcasts, branding, admin.js의 일부)가
-- 존재하지 않는 game_settings 테이블을 SELECT/UPDATE 하고 있었음.
-- 결과: 해당 서비스들이 운영에서 silent 실패 (catch로 빈 배열 반환).
--
-- settings 테이블과 동일 구조의 자동 업데이트 가능 VIEW를 만들어
-- 기존 코드가 그대로 동작하도록 호환 레이어 추가.
--
-- 안전: settings 테이블은 그대로 유지, view만 추가. 기존 데이터 영향 없음.
-- 자동 업데이트 가능 view 조건 충족 (단일 테이블 SELECT, no aggregate, no DISTINCT).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'game_settings'
  ) THEN
    CREATE VIEW game_settings AS
      SELECT key, value, category, description, updated_at
      FROM settings;
  END IF;
END $$;
