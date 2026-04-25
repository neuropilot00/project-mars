-- ═══════════════════════════════════════════════════
-- 182: 잔여 settings 카테고리 시드 (No Hardcoding 완성)
-- ═══════════════════════════════════════════════════
-- Migration 181에서 13개 처리 후 남은 10개 카테고리.
-- 모두 동작 변화 0 (서비스 default와 동일 값) — admin 조정 가능 활성화.

BEGIN;

-- ── monuments ────────────────────────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('monuments', 'monument_enabled',         'true', '기념물 시스템 활성화'),
  ('monuments', 'monument_cost_base',       '150',  '기본 비용 GP'),
  ('monuments', 'monument_cost_per_pixel',  '0.5',  '픽셀당 추가 비용 GP'),
  ('monuments', 'monument_max_per_wallet',  '10',   '플레이어별 최대 보유 수'),
  ('monuments', 'monument_max_per_claim',   '1',    '클레임당 최대 수'),
  ('monuments', 'monument_preserve_cost',   '50',   '하이잭 후 보존 비용 GP'),
  ('monuments', 'monument_name_max_len',    '60',   '이름 최대 글자수'),
  ('monuments', 'monument_msg_max_len',     '200',  '메시지 최대 글자수')
ON CONFLICT (key) DO NOTHING;

-- ── spells (영토 주문 6종) ─────────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('spells', 'spell_enabled',           'true', '영토 주문 시스템 활성화'),
  ('spells', 'spell_flood_gp',          '50',   'Flood Hex GP 비용 (-30% 채굴)'),
  ('spells', 'spell_blaze_gp',          '75',   'Blaze Hex GP 비용 (-20% 방어)'),
  ('spells', 'spell_storm_gp',          '100',  'Storm Hex GP 비용 (랜덤 효과)'),
  ('spells', 'spell_shield_break_gp',   '120',  'Shield Break GP 비용 (-50% 실드)'),
  ('spells', 'spell_bless_gp',          '30',   'Bless GP 비용 (+20% 채굴)'),
  ('spells', 'spell_goldmine_gp',       '60',   'Gold Mine GP 비용 (+GP 확률)'),
  ('spells', 'spell_duration_h',        '2',    '주문 지속 시간 (시간)'),
  ('spells', 'spell_max_per_target',    '1',    '대상당 동시 주문 수'),
  ('spells', 'spell_self_cast_allowed', 'true', '자기 영토 시전 허용'),
  ('spells', 'spell_own_territory_hex', 'false','자기 영토에 hex 주문 허용')
ON CONFLICT (key) DO NOTHING;

-- ── shield (영토 실드 시간 옵션) ──────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('shield', 'shield_enabled',         'true',          '실드 시스템 활성화'),
  ('shield', 'shield_options',         '"6,12,24,48,72"','구매 가능 시간 옵션 (시간)'),
  ('shield', 'shield_max_per_wallet',  '5',             '플레이어별 동시 실드 수'),
  ('shield', 'shield_stack_allowed',   'false',         '같은 클레임 중첩 허용'),
  ('shield', 'shield_cost_6h',         '72',            '6시간 실드 비용 GP'),
  ('shield', 'shield_cost_12h',        '144',           '12시간 실드 비용 GP'),
  ('shield', 'shield_cost_24h',        '288',           '24시간 실드 비용 GP'),
  ('shield', 'shield_cost_48h',        '576',           '48시간 실드 비용 GP'),
  ('shield', 'shield_cost_72h',        '864',           '72시간 실드 비용 GP')
ON CONFLICT (key) DO NOTHING;

-- ── staking (GP 스테이킹) ─────────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('staking', 'staking_enabled',           'true',     'GP 스테이킹 활성화'),
  ('staking', 'staking_apy_pct',           '15.0',     '연 이율 % (기본)'),
  ('staking', 'staking_min_amount',        '100',      '최소 스테이크 GP'),
  ('staking', 'staking_max_amount',        '10000',    '최대 스테이크 GP'),
  ('staking', 'staking_lock_days_options', '"7,14,30"','잠금 기간 옵션 (일)'),
  ('staking', 'staking_30d_bonus_mult',    '1.5',      '30일 잠금 시 yield 배수'),
  ('staking', 'staking_14d_bonus_mult',    '1.2',      '14일 잠금 시 yield 배수'),
  ('staking', 'staking_max_active',        '5',        '플레이어별 동시 스테이크 수')
ON CONFLICT (key) DO NOTHING;

-- ── expedition (원정 — 광물 채집 미션) ───────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('expedition', 'expedition_enabled',         'true',         '원정 시스템 활성화'),
  ('expedition', 'expedition_base_cost_gp',    '30',           '기본 GP 비용'),
  ('expedition', 'expedition_max_duration_h',  '24',           '최대 지속 시간 (시간)'),
  ('expedition', 'expedition_size_bonus_pct',  '2',            '크기당 보너스 % (참여 인원)'),
  ('expedition', 'expedition_nothing_pct',     '10',           '꽝 확률 %'),
  ('expedition', 'expedition_durations',       '"1,3,6,12,24"','선택 가능 시간 옵션')
ON CONFLICT (key) DO NOTHING;

-- ── raffle (래플 — 운영자 생성형 추첨) ───────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('raffle', 'raffle_enabled',           'true', '래플 시스템 활성화'),
  ('raffle', 'raffle_max_tickets_pp',    '100',  '인당 최대 티켓 수'),
  ('raffle', 'raffle_min_cost_gp',       '5',    '최소 티켓 가격 GP'),
  ('raffle', 'raffle_house_cut_pct',     '10',   '플랫폼 수수료 %'),
  ('raffle', 'raffle_auto_draw',         'true', '시간 만료 시 자동 추첨'),
  ('raffle', 'raffle_min_tickets_draw',  '1',    '최소 티켓 수 (미달 시 환불)')
ON CONFLICT (key) DO NOTHING;

-- ── broadcasts (전체 공지) ─────────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('broadcasts', 'broadcast_enabled',        'true', '전체 공지 활성화'),
  ('broadcasts', 'broadcast_min_gp',         '50',   '최소 비용 GP'),
  ('broadcasts', 'broadcast_cost_per_h_gp',  '25',   '시간당 추가 비용 GP'),
  ('broadcasts', 'broadcast_max_duration_h', '24',   '최대 지속 시간'),
  ('broadcasts', 'broadcast_max_length',     '120',  '메시지 최대 글자수'),
  ('broadcasts', 'broadcast_max_active',     '5',    '동시 진행 공지 수'),
  ('broadcasts', 'broadcast_cooldown_h',     '1',    '같은 플레이어 쿨다운')
ON CONFLICT (key) DO NOTHING;

-- ── contest (미술 콘테스트) ───────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('contest', 'contest_enabled',          'true', '미술 콘테스트 활성화'),
  ('contest', 'contest_admin_seed_gp',    '500',  '운영자 시드 GP (상금풀 초기값)'),
  ('contest', 'contest_entry_fee_gp',     '20',   '참가비 GP'),
  ('contest', 'contest_vote_fee_gp',      '5',    '투표비 GP'),
  ('contest', 'contest_max_entries',      '50',   '최대 참가자'),
  ('contest', 'contest_voting_hours',     '48',   '투표 기간 (시간)'),
  ('contest', 'contest_winner_pct',       '60',   '1위 상금 %'),
  ('contest', 'contest_runnerup_pct',     '25',   '2위 상금 %'),
  ('contest', 'contest_third_pct',        '10',   '3위 상금 %')
ON CONFLICT (key) DO NOTHING;

-- ── crafting (아이템 제작) ────────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('crafting', 'crafting_enabled',     'true', '제작 시스템 활성화'),
  ('crafting', 'crafting_max_per_day', '20',   '플레이어별 일일 제작 제한'),
  ('crafting', 'crafting_fail_refund_pct', '50', '실패 시 GP 환불 %')
ON CONFLICT (key) DO NOTHING;

-- ── achievements (업적 시스템) ────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('achievements', 'achievements_enabled',     'true', '업적 시스템 활성화'),
  ('achievements', 'achievement_reward_mult',  '1.0',  'GP/XP 보상 글로벌 배수'),
  ('achievements', 'achievement_check_on_event','true','게임 이벤트마다 자동 진행 체크')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('182_seed_remaining_settings.sql')
ON CONFLICT DO NOTHING;

COMMIT;
