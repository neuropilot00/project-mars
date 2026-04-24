-- Migration 169: 함선 트리거 함수 수정
-- check_player_ship_limit 에서 JSONB value 비교 시 타입 에러 수정
-- NULLIF(value,'') → value는 JSONB인데 ''(빈 문자열)를 JSONB로 캐스팅 불가 → invalid input syntax for type json
-- 수정: value #>> '{}' 사용 (JSONB → text 안전 추출)

-- ── 1. Titan 서버 한도 트리거 (재생성) ────────────────────────────

CREATE OR REPLACE FUNCTION check_titan_server_limit() RETURNS TRIGGER AS $$
DECLARE
  v_max_per_server INTEGER;
  v_current_count  INTEGER;
BEGIN
  SELECT max_per_server INTO v_max_per_server
  FROM ship_types WHERE code = NEW.ship_type_code;

  IF v_max_per_server IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM ships
    WHERE ship_type_code = NEW.ship_type_code AND is_alive = true;

    IF v_current_count >= v_max_per_server THEN
      RAISE EXCEPTION 'SHIP_SERVER_LIMIT_REACHED: % (max %)',
        NEW.ship_type_code, v_max_per_server;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ships_server_limit ON ships;
CREATE TRIGGER trg_ships_server_limit
  BEFORE INSERT ON ships
  FOR EACH ROW
  EXECUTE FUNCTION check_titan_server_limit();


-- ── 2. 유저 함선 수 체크 트리거 (재생성 — JSONB 버그 수정) ─────────

CREATE OR REPLACE FUNCTION check_player_ship_limit() RETURNS TRIGGER AS $$
DECLARE
  v_max_per_player INTEGER;
  v_current_count  INTEGER;
  v_total_count    INTEGER;
  v_global_max     INTEGER;
  v_raw_text       TEXT;
BEGIN
  -- 함선 타입별 유저 한도
  SELECT max_per_player INTO v_max_per_player
  FROM ship_types WHERE code = NEW.ship_type_code;

  IF v_max_per_player IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM ships
    WHERE owner_wallet = NEW.owner_wallet
      AND ship_type_code = NEW.ship_type_code
      AND is_alive = true;

    IF v_current_count >= v_max_per_player THEN
      RAISE EXCEPTION 'SHIP_PLAYER_TYPE_LIMIT: % (max % per player)',
        NEW.ship_type_code, v_max_per_player;
    END IF;
  END IF;

  -- 유저 전체 함선 한도 (JSONB value 안전 추출)
  SELECT value #>> '{}' INTO v_raw_text
  FROM settings WHERE category = 'fleet' AND key = 'max_ships_per_player'
  LIMIT 1;

  BEGIN
    v_global_max := COALESCE(NULLIF(TRIM(v_raw_text), ''), '200')::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    v_global_max := 200;
  END;

  IF v_global_max IS NULL OR v_global_max <= 0 THEN
    v_global_max := 200;
  END IF;

  SELECT COUNT(*) INTO v_total_count
  FROM ships WHERE owner_wallet = NEW.owner_wallet AND is_alive = true;

  IF v_total_count >= v_global_max THEN
    RAISE EXCEPTION 'SHIP_PLAYER_TOTAL_LIMIT: max % ships per player', v_global_max;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ships_player_limit ON ships;
CREATE TRIGGER trg_ships_player_limit
  BEFORE INSERT ON ships
  FOR EACH ROW
  EXECUTE FUNCTION check_player_ship_limit();


-- schema_migrations 등록
INSERT INTO schema_migrations (filename) VALUES ('169_fix_ship_triggers.sql') ON CONFLICT DO NOTHING;
