-- Ordinary hull fittings are separate from quality and permanent stat upgrades.
CREATE TABLE IF NOT EXISTS ship_part_cards (
 id BIGSERIAL PRIMARY KEY,
 wallet_address VARCHAR(42) NOT NULL CHECK(wallet_address=LOWER(wallet_address)),
 part_code VARCHAR(32) NOT NULL CHECK(part_code IN ('rail_amp','burst_lens','reactive_plate','layered_plate','ion_drive','vector_drive')),
 slot VARCHAR(12) NOT NULL CHECK(slot IN ('weapon','armor','engine')),
 level SMALLINT NOT NULL DEFAULT 0 CHECK(level BETWEEN 0 AND 3),
 ship_id BIGINT REFERENCES ships(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK((part_code IN ('rail_amp','burst_lens') AND slot='weapon') OR
       (part_code IN ('reactive_plate','layered_plate') AND slot='armor') OR
       (part_code IN ('ion_drive','vector_drive') AND slot='engine'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ship_part_slot ON ship_part_cards(ship_id,slot) WHERE ship_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ship_part_wallet ON ship_part_cards(wallet_address);
CREATE TABLE IF NOT EXISTS ship_part_events (
 id BIGSERIAL PRIMARY KEY, wallet_address VARCHAR(42) NOT NULL,
 part_id BIGINT, ship_id BIGINT, action VARCHAR(16) NOT NULL,
 detail JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- A fitting travels with a traded hull and is lost with a destroyed/scrapped hull.
CREATE OR REPLACE FUNCTION sync_ship_part_owner() RETURNS TRIGGER AS $$
BEGIN
 IF NOT NEW.is_alive THEN
   INSERT INTO ship_part_events(wallet_address,part_id,ship_id,action,detail)
   SELECT wallet_address,id,NEW.id,'lost',jsonb_build_object('part_code',part_code,'level',level) FROM ship_part_cards WHERE ship_id=NEW.id;
   DELETE FROM ship_part_cards WHERE ship_id=NEW.id;
 ELSIF NEW.owner_wallet IS DISTINCT FROM OLD.owner_wallet THEN
   UPDATE ship_part_cards SET wallet_address=LOWER(NEW.owner_wallet) WHERE ship_id=NEW.id;
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_ship_part_owner ON ships;
CREATE TRIGGER trg_ship_part_owner AFTER UPDATE OF owner_wallet,is_alive ON ships FOR EACH ROW EXECUTE FUNCTION sync_ship_part_owner();
INSERT INTO schema_migrations(filename) VALUES('344_ship_parts.sql') ON CONFLICT DO NOTHING;
