-- Migration 166: Economic Balance Patch
-- 1 PP = $1 기준, SE Asia / USA / Japan / China / Korea 타겟
-- 수리/실드 비용 현실화, 채굴 보상 조정, PvP 보상 상향

-- ── 1. 수리 비용 재조정 (HP 규모별 현실화) ─────────────────────────────────
-- 기존 2 GP/HP → Titan(1M HP) 수리 = 2M GP → 불합리
-- 0.01 GP/HP: Frigate(5K) = 50 GP, Destroyer(14K) = 140 GP, Titan(1M) = 10K GP
UPDATE settings SET value = '0.01' WHERE key = 'ship_repair_gp_per_hp';
-- iron_ore 요구량: HP 10당 0.2개 → Frigate 5K = 100개, Titan 1M = 20K개
UPDATE settings SET value = '0.2' WHERE key = 'ship_repair_iron_per_10hp';

-- ── 2. 실드 비용 재조정 ─────────────────────────────────────────────────────
-- 기존 3 GP/unit → Frigate 실드 최대(2500) = 7500 GP (함선 제조비보다 비쌈)
-- 0.05 GP/unit: Frigate 2500 = 125 GP, Titan 500K = 25K GP (적절)
UPDATE settings SET value = '0.05' WHERE key = 'shield_gp_per_unit';
-- 실드 자연 감소 5%/h → 20h 후 다 사라짐: 3%로 완화 (하루 1/3 감소)
UPDATE settings SET value = '3' WHERE key = 'shield_decay_pct_per_hour';

-- ── 3. 채굴 보상 조정 ───────────────────────────────────────────────────────
-- PP 일일 상한: 0.5 PP/day 상한
-- 100픽셀 유저 = 0.1 PP/day (상한 미달), 500픽셀 = 0.5 PP/day (상한 도달)
-- 운영사 비용: 1000 유저 × 0.5 PP = $500/day → 광고수익+PP구매로 커버 가능
UPDATE settings SET value = '0.5' WHERE key = 'pp_daily_earn_cap_per_user';
-- Frontier 채굴 1배 (유지)
UPDATE settings SET value = '1.0' WHERE key = 'mining_bonus_frontier';
-- 유지비: 100픽셀 초과분 주당 1 PP (대형 홀더 PP 소각 강화 → 운영사 PP 수입)
UPDATE settings SET value = '1.0' WHERE key = 'maintenance_fee_rate';
-- iron_ore 드롭량 max 5 → 10개로 상향 (수리 재료 수급 원활화)
UPDATE settings SET value = '10' WHERE key = 'resource_drop_quantity_max';
-- 1 harvest 최대 드롭 종류 3 → 5
UPDATE settings SET value = '5' WHERE key = 'resource_max_drop_per_harvest';

-- ── 4. PvP 보상 상향 (전투 동기 부여) ─────────────────────────────────────
-- 승리 기본 보상 100 → 300 GP (함선 제조비 수준 환급 의미)
UPDATE settings SET value = '300' WHERE key = 'reward_base_gp_pvp';
-- 함선 격침당 10 → 30 GP
UPDATE settings SET value = '30' WHERE key = 'reward_per_ship_destroyed';
-- 위로 보상 20 → 50 GP
UPDATE settings SET value = '50' WHERE key = 'reward_loser_consolation';
-- Siege 승리 500 → 800 GP
UPDATE settings SET value = '800' WHERE key = 'reward_base_gp_siege';

-- ── 5. Frontier iron_ore 드롭률 상향 ───────────────────────────────────────
-- 0.30 → 0.50 (수리 재료 수급 용이)
UPDATE sector_resource_rates
SET base_rate = 0.50, miner_bonus = 0.08
WHERE sector_type = 'frontier' AND resource_code = 'iron_ore';

-- carbon_fiber, silicon_chip도 소폭 상향
UPDATE sector_resource_rates
SET base_rate = 0.30
WHERE sector_type = 'frontier' AND resource_code = 'carbon_fiber';
UPDATE sector_resource_rates
SET base_rate = 0.20
WHERE sector_type = 'frontier' AND resource_code = 'silicon_chip';

-- Mid 재료 드롭률 소폭 상향 (더 자주 채굴 필요성 부여)
UPDATE sector_resource_rates SET base_rate = 0.25 WHERE sector_type = 'mid' AND resource_code = 'titanium_alloy';
UPDATE sector_resource_rates SET base_rate = 0.20 WHERE sector_type = 'mid' AND resource_code = 'plasma_crystal';
UPDATE sector_resource_rates SET base_rate = 0.20 WHERE sector_type = 'mid' AND resource_code = 'nano_polymer';
