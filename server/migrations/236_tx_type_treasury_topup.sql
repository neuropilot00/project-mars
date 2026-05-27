-- Migration 236: transactions.type CHECK 에 'treasury_topup' 추가
-- ───────────────────────────────────────────────────────────────────────────
-- /api/admin/economy/treasury/topup 이 audit 용으로 type='treasury_topup' INSERT 하는데
-- 기존 CHECK 에 없어 INSERT 실패 → 같은 트랜잭션의 담보 적립까지 롤백되던 버그(UI 검수로 발견).
-- 타입 목록에 treasury_topup 추가.

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (
  (type)::text = ANY ((ARRAY[
    'deposit','claim','hijack','battle_failed','swap','withdraw','withdraw_all','mining',
    'rank_reward','referral','quest','shop_purchase','crash_bet','crash_win','mines_bet','mines_win',
    'coinflip_bet','coinflip_win','dice_bet','dice_win','hilo_bet','hilo_win','maintenance_fee',
    'instant_harvest','rename_fee','poi_hint','loot_priority','auto_renew','pp_to_gp_exchange',
    'war_game_continue','enhance_attempt','marketplace_sale','marketplace_fee','marketplace_listing_fee',
    'marketplace_bid_hold','marketplace_bid_refund','resource_sale','treasury_topup'
  ]::character varying[])::text[])
);

INSERT INTO schema_migrations (filename) VALUES ('236_tx_type_treasury_topup.sql') ON CONFLICT DO NOTHING;
