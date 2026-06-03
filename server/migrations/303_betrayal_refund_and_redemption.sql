-- ============================================================
-- Migration 303: 변절 현상금 금고 환불 + 배신자 낙인 속죄(유료 제거)
--
-- 1) 변절 자동 현상금은 길드 금고에서 funding 됐으므로, 만료/취소 시 환불을
--    리더 개인 GP가 아니라 "금고"로 되돌려야 한다. bounty_listings.funded_from_guild_id
--    로 출처를 추적해 만료/취소 핸들러가 분기한다.
-- 2) 배신자 낙인(guild_betrayer)은 영구(removable=false) 유지. 단 본인이 GP를
--    소각(속죄 비용)하면 제거 가능 — 유료 평판 회복 = GP 싱크.
-- ============================================================

ALTER TABLE bounty_listings ADD COLUMN IF NOT EXISTS funded_from_guild_id BIGINT;

INSERT INTO settings (category, key, value, description)
  SELECT v.category, v.key, v.value::jsonb, v.description FROM (VALUES
    ('guild', 'guild_betrayer_redemption_gp', '5000', '배신자 낙인(guild_betrayer) 유료 제거 비용 GP(소각)')
  ) AS v(category, key, value, description)
  WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.key = v.key);

INSERT INTO schema_migrations (filename) VALUES ('303_betrayal_refund_and_redemption.sql') ON CONFLICT DO NOTHING;
