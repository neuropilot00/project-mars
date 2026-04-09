-- Loading screen lore entries (editable via admin)
CREATE TABLE IF NOT EXISTS loading_lore (
  id SERIAL PRIMARY KEY,
  year VARCHAR(10) NOT NULL DEFAULT 'TIP',
  text_en TEXT NOT NULL,
  text_ko TEXT,
  text_ja TEXT,
  text_zh TEXT,
  category VARCHAR(30) DEFAULT 'timeline',
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Star Wars crawl story (editable via admin)
CREATE TABLE IF NOT EXISTS lore_crawl (
  id SERIAL PRIMARY KEY,
  lang VARCHAR(5) NOT NULL DEFAULT 'en',
  era_text TEXT,
  title_text TEXT DEFAULT 'OCCUPY MARS',
  body_html TEXT,
  tagline TEXT,
  close_text TEXT DEFAULT 'ENTER MARS',
  active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lang)
);

-- Seed default loading lore
INSERT INTO loading_lore (year, text_en, text_ko, category, sort_order) VALUES
('2089','The Great Collapse begins. Global temperatures hit +4.2°C. Coastal megacities flood within months.','대붕괴 시작. 지구 온도 +4.2°C. 해안 거대도시들이 수개월 내 침수.','earth_fall',1),
('2091','The Pacific Exodus — 800 million climate refugees flee inland. Resource wars ignite across three continents.','태평양 대탈출 — 8억 기후 난민 내륙으로. 3개 대륙에서 자원 전쟁 발발.','earth_fall',2),
('2094','United Nations dissolves. The last democratic government falls in Oslo. Corporate states rise.','유엔 해체. 오슬로에서 마지막 민주정부 붕괴. 기업 국가 부상.','earth_fall',3),
('2097','Project GAIA fails. Earth''s last geoengineering attempt backfires — the Amazon burns for 9 months.','프로젝트 가이아 실패. 지구 최후의 기후공학 시도 역효과 — 아마존 9개월간 화재.','earth_fall',4),
('2101','The Oxygen Crisis. Atmospheric O₂ drops below 19%. Outdoor masks required in 40% of the world.','산소 위기. 대기 O₂ 19% 이하로. 세계 40% 지역에서 야외 마스크 필수.','earth_fall',5),
('2103','Dr. Elena Vasquez proposes the ARES Initiative — humanity''s last hope.','엘레나 바스케즈 박사가 아레스 이니셔티브 제안 — 인류의 마지막 희망.','mars_init',6),
('2107','ARES-1 launches from Baikonur with 2,400 colonists. The largest spacecraft ever built.','ARES-1, 바이코누르에서 2,400명의 식민자와 함께 발사. 역사상 최대 우주선.','mars_init',7),
('2108','ARES-2 and ARES-3 depart. Total colonist count: 7,200 souls heading into the void.','ARES-2, ARES-3 출발. 총 식민자 7,200명이 우주의 공허 속으로.','mars_init',8),
('2110','ARES-1 makes landfall at Olympus Mons Basin. First words: "The soil is red. The sky is home."','ARES-1 올림푸스 몬스 분지 착륙. 첫 마디: "흙은 붉고, 하늘은 고향이다."','mars_init',9),
('2111','Colony One established. 847 colonists survive the first Martian winter.','콜로니 원 설립. 847명의 식민자가 첫 화성 겨울을 버텨냄.','mars_init',10),
('2118','The Mineral Rush. Rare Martianium deposits discovered beneath Valles Marineris.','광물 러시. 발레스 마리네리스 아래 희귀 마르시아늄 매장지 발견.','colony_wars',11),
('2122','First Sector War. Commander Yuki Tanaka seizes Hellas Basin by force. The age of Governors begins.','제1차 섹터 전쟁. 타나카 유키 사령관 헬라스 분지 무력 장악. 총독의 시대 시작.','colony_wars',12),
('2125','The Hijack Protocol is invented. Raiders develop tech to steal territory claims remotely.','하이잭 프로토콜 발명. 약탈자들이 원격 영토 탈취 기술 개발.','colony_wars',13),
('2129','The Starlink Network goes rogue. Satellites broadcast mineral locations to anyone who listens.','스타링크 네트워크 이탈. 위성들이 광물 위치를 무차별 송신 시작.','colony_wars',14),
('2131','The Cantina opens in Sector 7. A lawless trading post where warriors gamble territory for glory.','섹터 7에 칸티나 개장. 전사들이 영토를 걸고 도박하는 무법 거래소.','colony_wars',15),
('2134','SpaceX Starship "Erebus" suffers RUD over Elysium — scattered debris becomes the first supply loot event.','스페이스X 스타쉽 "에레부스" 엘리시움 상공 RUD — 파편이 최초 보급 루트 이벤트로.','present',16),
('2138','Earth goes silent. The last transmission from Houston: "You''re on your own now. Make it count."','지구 침묵. 휴스턴의 마지막 전송: "이제 너희뿐이다. 의미있게 살아라."','present',17),
('2141','The Governor''s Accord — sector leaders agree to tax-based governance. Peace lasts exactly 47 days.','총독 협약 — 섹터 지도자들이 세금 기반 거버넌스에 합의. 평화는 딱 47일간.','present',18),
('2149','A massive sandstorm buries Colony Three for two weeks. When it clears, the colony has been hijacked.','거대 모래폭풍이 콜로니 3을 2주간 뒤덮음. 걷히고 보니 콜로니가 하이잭당함.','present',19),
('2152','Planet Points (PP) become the universal currency. The old Earth dollar is worthless.','플래닛 포인트(PP)가 범용 화폐로. 옛 지구 달러는 무가치.','present',20),
('2155','Ancient alien artifacts discovered near the north pole. Their purpose remains unknown.','북극 근처에서 고대 외계 유물 발견. 용도는 여전히 불명.','present',21),
('2157','Present day. You arrive on Mars. No welcome party. No instructions. Just red dust and opportunity.','현재. 당신이 화성에 도착. 환영단도 없고, 안내도 없다. 오직 붉은 먼지와 기회뿐.','present',22)
ON CONFLICT DO NOTHING;

-- Seed default crawl stories
INSERT INTO lore_crawl (lang, era_text, title_text, body_html, tagline, close_text) VALUES
('en', 'A LONG TIME FROM NOW, ON A PLANET NOT SO FAR AWAY...', 'OCCUPY MARS', '', 'YOUR TERRITORY. YOUR RULES. YOUR PLANET.', 'ENTER MARS'),
('ko', '머지않은 미래, 그리 멀지 않은 행성에서...', 'OCCUPY MARS', '', '너의 영토. 너의 규칙. 너의 행성.', '화성 진입'),
('ja', '遠くない未来、そう遠くない惑星で...', 'OCCUPY MARS', '', 'お前の領土。お前のルール。お前の惑星。', '火星へ突入'),
('zh', '不远的未来，在一颗不太遥远的星球上...', 'OCCUPY MARS', '', '你的领土。你的规则。你的星球。', '进入火星')
ON CONFLICT (lang) DO NOTHING;
