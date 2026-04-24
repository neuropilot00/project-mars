-- Migration 174: mars_weather 전략 예보 컬럼 보강
-- weather.js의 activateForecasts/createForecast가 status, forecast_at, is_strategic,
-- title_ko, description_ko, chronicle_posted 컬럼을 사용하지만
-- 037_mars_weather.sql 원본 스키마엔 없음 → 운영 DB에서 column does not exist 발생.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='mars_weather' AND column_name='status') THEN
    ALTER TABLE mars_weather ADD COLUMN status VARCHAR(20) DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='mars_weather' AND column_name='forecast_at') THEN
    ALTER TABLE mars_weather ADD COLUMN forecast_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='mars_weather' AND column_name='is_strategic') THEN
    ALTER TABLE mars_weather ADD COLUMN is_strategic BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='mars_weather' AND column_name='title_ko') THEN
    ALTER TABLE mars_weather ADD COLUMN title_ko VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='mars_weather' AND column_name='description_ko') THEN
    ALTER TABLE mars_weather ADD COLUMN description_ko TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='mars_weather' AND column_name='chronicle_posted') THEN
    ALTER TABLE mars_weather ADD COLUMN chronicle_posted BOOLEAN DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mars_weather_forecast
  ON mars_weather(forecast_at) WHERE status = 'forecast';
CREATE INDEX IF NOT EXISTS idx_mars_weather_status
  ON mars_weather(status, starts_at);
CREATE INDEX IF NOT EXISTS idx_mars_weather_strategic
  ON mars_weather(is_strategic) WHERE is_strategic = true;

INSERT INTO settings (category, key, value, description) VALUES
  ('weather', 'weather_strategic_enabled', 'true', '전략적 날씨 예보 시스템 활성화'),
  ('weather', 'weather_random_enabled',    'false', '랜덤 날씨 생성 (전략 모드에선 비활성)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('174_weather_strategic_columns.sql')
ON CONFLICT DO NOTHING;
