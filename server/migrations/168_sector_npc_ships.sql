-- Migration 168: 섹터 NPC 유저 생성 + 함대/함선 지급
-- 행성에 영토를 보유한 0xnpc_* 계정들을 users 테이블에 등록하고
-- 랜덤 파벌 + 해당 파벌 최저가 프리깃 1척 지급

-- Step 1: sector NPC 유저 생성 (없는 것만)
DO $$
DECLARE
  factions TEXT[] := ARRAY['mcc','fsp','cv'];
  npc_wallets TEXT[] := ARRAY[
    '0xnpc_gale_crater',
    '0xnpc_elysium_mons',
    '0xnpc_olympus_mons',
    '0xnpc_tharsis_ridge',
    '0xnpc_valles_marineris',
    '0xnpc_syrtis_major',
    '0xnpc_amazonis_flats',
    '0xnpc_utopia_basin',
    '0xnpc_argyre_crater',
    '0xnpc_solis_planum',
    '0xnpc_noachis_terra',
    '0xnpc_isidis_plains',
    '0xnpc_hellas_basin',
    '0xnpc_chryse_landing',
    '0xnpc_arcadia_plains',
    '0xnpc_cimmeria_ridge',
    '0xnpc_jezero_delta',
    '0xnpc_tyrrhena_mesa',
    '0xnpc_acidalia_sea',
    '0xnpc_arabia_terra'
  ];
  w TEXT;
  fc TEXT;
  fleet_id BIGINT;
  ship_code TEXT;
  ship_hp INT;
BEGIN
  FOREACH w IN ARRAY npc_wallets LOOP
    -- 랜덤 파벌 선택
    fc := factions[1 + floor(random() * 3)::int];

    -- 유저 등록 (없는 경우만)
    INSERT INTO users (
      wallet_address, email, password_hash, nickname,
      is_ai, ai_difficulty,
      faction_code, faction_chosen_at,
      gp_balance, pp_balance, usdt_balance
    ) VALUES (
      w,
      w || '@npc.mars',
      '$npc$',
      replace(replace(w, '0xnpc_', ''), '_', ' '),
      true,
      'easy',
      fc,
      NOW(),
      50000, 0, 0
    )
    ON CONFLICT (wallet_address) DO UPDATE
      SET faction_code = EXCLUDED.faction_code;

    -- 함선이 이미 있으면 건너뜀
    IF EXISTS (
      SELECT 1 FROM ships s
      JOIN fleets f ON f.id = s.fleet_id
      WHERE f.owner_wallet = w AND s.is_alive = true
    ) THEN
      CONTINUE;
    END IF;

    -- 함대 생성 or 기존 조회
    SELECT id INTO fleet_id FROM fleets WHERE owner_wallet = w AND is_npc = false LIMIT 1;
    IF fleet_id IS NULL THEN
      INSERT INTO fleets (owner_wallet, name, is_npc)
      VALUES (w, replace(replace(w, '0xnpc_', ''), '_', ' ') || ' Fleet', false)
      RETURNING id INTO fleet_id;
    END IF;

    -- 해당 파벌 최저가 프리깃 조회
    SELECT code, base_hp INTO ship_code, ship_hp
    FROM ship_types
    WHERE faction_code = fc
      AND size_class = 'frigate'
      AND is_active = true
    ORDER BY build_gp_cost ASC
    LIMIT 1;

    IF ship_code IS NOT NULL THEN
      INSERT INTO ships (
        fleet_id, ship_type_code, owner_wallet,
        current_hp, max_hp, is_flagship, is_alive, built_at
      ) VALUES (
        fleet_id, ship_code, w,
        ship_hp, ship_hp, true, true, NOW()
      );
    END IF;
  END LOOP;
END $$;

-- schema_migrations 등록
INSERT INTO schema_migrations (filename) VALUES ('168_sector_npc_ships.sql') ON CONFLICT DO NOTHING;
