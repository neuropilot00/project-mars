-- Migration 167: player_notifications table + settings
-- 종 아이콘 알림 패널에 실제 알림 저장

CREATE TABLE IF NOT EXISTS player_notifications (
  id           SERIAL PRIMARY KEY,
  wallet       VARCHAR(42) NOT NULL,
  type         VARCHAR(30) NOT NULL,
  message      TEXT NOT NULL,
  metadata     JSONB DEFAULT '{}',
  read         BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pnotif_wallet  ON player_notifications(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pnotif_unread  ON player_notifications(wallet, read) WHERE read = false;

-- Settings
INSERT INTO settings (category, key, value, description) VALUES
  ('notifications', 'notifications_enabled',      'true', '알림 시스템 활성화'),
  ('notifications', 'notifications_max_per_user', '50',   '유저당 최대 보관 알림 수'),
  ('notifications', 'notifications_ttl_days',     '14',   '알림 보관 기간(일)')
ON CONFLICT (key) DO NOTHING;
