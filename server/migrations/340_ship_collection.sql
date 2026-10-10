-- Permanent discovery survives loss and sale. Existing hulls/quality/market value are untouched.
CREATE TABLE IF NOT EXISTS ship_collection (
  wallet_address VARCHAR(42) NOT NULL,
  ship_type_code VARCHAR(24) NOT NULL REFERENCES ship_types(code),
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  qualities TEXT[] NOT NULL DEFAULT ARRAY['common']::TEXT[],
  PRIMARY KEY(wallet_address, ship_type_code),
  CHECK(wallet_address = LOWER(wallet_address))
);

INSERT INTO ship_collection(wallet_address,ship_type_code,discovered_at,qualities)
SELECT LOWER(source.wallet),source.code,MIN(source.acquired_at),ARRAY_AGG(DISTINCT source.quality)
FROM (
  SELECT s.owner_wallet AS wallet,s.ship_type_code AS code,COALESCE(s.built_at,NOW()) AS acquired_at,COALESCE(s.quality,'common') AS quality FROM ships s
  UNION ALL
  SELECT p.wallet,p.ship_type_code,p.created_at,COALESCE(p.quality,'common') FROM ship_crate_pulls p
) source JOIN users u ON LOWER(u.wallet_address)=LOWER(source.wallet)
WHERE NOT COALESCE(u.is_ai,false)
GROUP BY LOWER(source.wallet),source.code
ON CONFLICT(wallet_address,ship_type_code) DO UPDATE
SET discovered_at=LEAST(ship_collection.discovered_at,EXCLUDED.discovered_at),
    qualities=ARRAY(SELECT DISTINCT unnest(ship_collection.qualities || EXCLUDED.qualities));

CREATE OR REPLACE FUNCTION record_ship_collection() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_wallet IS NOT NULL AND EXISTS(SELECT 1 FROM users WHERE LOWER(wallet_address)=LOWER(NEW.owner_wallet) AND NOT COALESCE(is_ai,false)) THEN
    INSERT INTO ship_collection(wallet_address,ship_type_code,qualities)
    VALUES(LOWER(NEW.owner_wallet),NEW.ship_type_code,ARRAY[COALESCE(NEW.quality,'common')])
    ON CONFLICT(wallet_address,ship_type_code) DO UPDATE
    SET qualities=ARRAY(SELECT DISTINCT unnest(ship_collection.qualities || EXCLUDED.qualities));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_ship_collection ON ships;
CREATE TRIGGER trg_ship_collection AFTER INSERT OR UPDATE OF owner_wallet,ship_type_code,quality ON ships
FOR EACH ROW EXECUTE FUNCTION record_ship_collection();

-- New ordinary/rebuilt hulls have standard quality; existing NULL/paid qualities are untouched.
ALTER TABLE ships ALTER COLUMN quality SET DEFAULT 'common';

-- Each destroyed source can fund at most one completed replacement. Cancellation/refund permits a paid retry.
ALTER TABLE ship_build_jobs ADD COLUMN IF NOT EXISTS rebuild_source_ship_id BIGINT REFERENCES ships(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ship_rebuild_once ON ship_build_jobs(rebuild_source_ship_id)
WHERE rebuild_source_ship_id IS NOT NULL AND status IN ('building','completed');
INSERT INTO schema_migrations(filename) VALUES('340_ship_collection.sql') ON CONFLICT DO NOTHING;
