-- v5.53 Ship doctrine balance: faction identity + rock-paper-scissors combat.
-- Goal: composition and maneuver should beat raw price stacking.

-- MCC: precision rail doctrine. Strong into capitals/tanks, weaker when swarmed.
UPDATE ship_types SET
  description_ko = '고속 태클 · 전자전/로지 추격, 대형함 상대로는 보조 화력',
  base_hp = 2800, base_atk = 7, base_def = 3, base_speed = 2.55,
  fire_interval = 105, shots = 1
WHERE code = 'mcc_int';

UPDATE ship_types SET
  description_ko = '범용 DPS 프리깃 · 저렴한 주력 화력, 전자전/로지 처리 담당',
  base_hp = 6000, base_atk = 14, base_def = 7, base_speed = 1.80,
  fire_interval = 130, shots = 2
WHERE code = 'mcc_frg';

UPDATE ship_types SET
  description_ko = '전자전 프리깃 · 대형함/저격함 사격 주기를 흐트러뜨리는 지원함',
  base_hp = 4500, base_atk = 4, base_def = 6, base_speed = 1.72,
  fire_interval = 175, shots = 1
WHERE code = 'mcc_ewar';

UPDATE ship_types SET
  description_ko = '프리깃 사냥 특화 구축함 · 소형 함선 정리에 강함',
  base_hp = 13500, base_atk = 34, base_def = 14, base_speed = 1.22,
  fire_interval = 145, shots = 3
WHERE code = 'mcc_dst';

UPDATE ship_types SET
  description_ko = '중거리 레일건 순양함 · 균형형 주력, 탱커 상대로 안정적',
  base_hp = 28000, base_atk = 66, base_def = 36, base_speed = 0.82,
  fire_interval = 180, shots = 2
WHERE code = 'mcc_crs';

UPDATE ship_types SET
  role = 'sniper',
  description_ko = '장거리 저격 순양함 · 전함/타이탄과 탱커를 찢지만 태클에 취약',
  base_hp = 22500, base_atk = 118, base_def = 26, base_speed = 0.68,
  fire_interval = 315, shots = 1
WHERE code = 'mcc_snp';

UPDATE ship_types SET
  description_ko = '주력 포격 전함 · 대형 목표 처리와 화력 집중에 특화',
  base_hp = 165000, base_atk = 310, base_def = 185, base_speed = 0.30,
  fire_interval = 310, shots = 1
WHERE code = 'mcc_bs';

UPDATE ship_types SET
  description_ko = 'MCC 사령함 · 최고 정밀 포격, 보호막 없는 소형 러시에 약함',
  base_hp = 980000, base_atk = 735, base_def = 480, base_speed = 0.15,
  fire_interval = 455, shots = 1
WHERE code = 'mcc_titan';

-- FSP: attrition/repair doctrine. Wins long fights, loses if precision sniped.
UPDATE ship_types SET
  description_ko = '경량 드론 프리깃 · 지속 교전용, CV 소형 러시를 받아침',
  base_hp = 4300, base_atk = 9, base_def = 5, base_speed = 2.12,
  fire_interval = 118, shots = 2
WHERE code = 'fsp_int';

UPDATE ship_types SET
  description_ko = '로지 프리깃 · 소형 편대 유지력 증가, 직접 화력은 낮음',
  base_hp = 5200, base_atk = 3, base_def = 12, base_speed = 1.58,
  fire_interval = 150, shots = 1
WHERE code = 'fsp_logi';

UPDATE ship_types SET
  description_ko = '중장갑 구축함 · 태클/프리깃을 막는 전열, 저격과 폭격에 취약',
  base_hp = 25000, base_atk = 24, base_def = 38, base_speed = 0.92,
  fire_interval = 170, shots = 2
WHERE code = 'fsp_dst';

UPDATE ship_types SET
  description_ko = '드론 순양함 · 장기전 DPS, 대형함 보호선 뒤에서 강함',
  base_hp = 29000, base_atk = 54, base_def = 48, base_speed = 0.68,
  fire_interval = 205, shots = 1
WHERE code = 'fsp_crs';

UPDATE ship_types SET
  description_ko = '로지 순양함 · 장기전 핵심, 태클/저격에게 노출되면 위험',
  base_hp = 25000, base_atk = 6, base_def = 70, base_speed = 0.64,
  fire_interval = 135, shots = 1
WHERE code = 'fsp_logi_crs';

UPDATE ship_types SET
  description_ko = '초중장갑 전함 · CV 돌격을 버티는 탱커, MCC 저격에 약함',
  base_hp = 240000, base_atk = 210, base_def = 325, base_speed = 0.24,
  fire_interval = 350, shots = 2
WHERE code = 'fsp_bs';

UPDATE ship_types SET
  description_ko = 'FSP 요새 타이탄 · 최고 생존력, 장기전/방어전의 중심',
  base_hp = 1200000, base_atk = 530, base_def = 730, base_speed = 0.13,
  fire_interval = 500, shots = 1
WHERE code = 'fsp_titan';

-- CV: burst/raider doctrine. Punishes precision fleets, weak into prepared tanks.
UPDATE ship_types SET
  description_ko = '최속 태클 · MCC 저격/전자전을 물고 늘어지는 선봉',
  base_hp = 2400, base_atk = 12, base_def = 2, base_speed = 3.05,
  fire_interval = 88, shots = 2
WHERE code = 'cv_int';

UPDATE ship_types SET
  description_ko = '근접 고DPS 프리깃 · 지원함을 빠르게 끊지만 탱커에 약함',
  base_hp = 4800, base_atk = 20, base_def = 5, base_speed = 2.02,
  fire_interval = 112, shots = 3
WHERE code = 'cv_frg';

UPDATE ship_types SET
  role = 'bomb',
  description_ko = '은신 폭격기 · 전함/타이탄 킬러, 프리깃 스크린에 매우 취약',
  base_hp = 3200, base_atk = 185, base_def = 3, base_speed = 1.84,
  fire_interval = 620, shots = 1
WHERE code = 'cv_bomb';

UPDATE ship_types SET
  description_ko = '돌격 구축함 · 소형 교전 화력 최고, 오래 맞으면 녹음',
  base_hp = 10500, base_atk = 48, base_def = 11, base_speed = 1.38,
  fire_interval = 128, shots = 4
WHERE code = 'cv_dst';

UPDATE ship_types SET
  description_ko = '미사일 순양함 · 순간 화력과 기동, FSP 장갑선엔 효율 저하',
  base_hp = 23000, base_atk = 86, base_def = 32, base_speed = 0.86,
  fire_interval = 225, shots = 1
WHERE code = 'cv_crs';

UPDATE ship_types SET
  description_ko = '고화력 중거리 전함 · 폭딜형 주력, 방어형 장기전에 약함',
  base_hp = 145000, base_atk = 385, base_def = 155, base_speed = 0.38,
  fire_interval = 295, shots = 1
WHERE code = 'cv_bs';

UPDATE ship_types SET
  description_ko = 'CV 전격 타이탄 · 최고 공격력, FSP 탱커/로지 조합에 견제됨',
  base_hp = 1050000, base_atk = 840, base_def = 455, base_speed = 0.17,
  fire_interval = 455, shots = 1
WHERE code = 'cv_titan';
