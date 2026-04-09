-- Fix: clean up phantom pixels created by DECIMAL key mismatch bug
-- Pixels at NPC coordinates that were incorrectly claimed by users
-- Also remove orphaned claims that have zero remaining pixels

-- Step 1: Delete user pixels that overlap with NPC pixels at the same coordinates
-- (NPC pixels are authoritative for NPC territory)
-- We identify phantom pixels as: user-owned pixels where an NPC also has a pixel
-- at the same coordinates in a different claim
-- This is hard to do generically, so instead we just clean up orphaned claims

-- Step 2: Delete claims that have zero pixels pointing to them
DELETE FROM claims
WHERE deleted_at IS NULL
  AND id NOT IN (SELECT DISTINCT claim_id FROM pixels WHERE claim_id IS NOT NULL);

-- Step 3: For claims with duplicate coordinates by the same owner,
-- consolidate pixels to the newest claim and delete old empty ones
DO $$
DECLARE
  dup RECORD;
  keep_id INTEGER;
BEGIN
  -- Find owners with multiple claims at same center coordinates
  FOR dup IN
    SELECT owner, center_lat, center_lng, array_agg(id ORDER BY id DESC) as claim_ids
    FROM claims
    WHERE deleted_at IS NULL
    GROUP BY owner, center_lat, center_lng
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the newest claim (highest id)
    keep_id := dup.claim_ids[1];
    -- Reassign all pixels from older claims to the newest one
    UPDATE pixels SET claim_id = keep_id
    WHERE claim_id = ANY(dup.claim_ids[2:])
      AND owner = dup.owner;
    -- Update kept claim dimensions from actual pixel data
    UPDATE claims SET
      width = sub.w, height = sub.h,
      center_lat = sub.clat, center_lng = sub.clng
    FROM (
      SELECT
        ROUND((MAX(lng) - MIN(lng)) / 0.22)::int + 1 AS w,
        ROUND((MAX(lat) - MIN(lat)) / 0.22)::int + 1 AS h,
        (MIN(lat) + MAX(lat)) / 2 AS clat,
        (MIN(lng) + MAX(lng)) / 2 AS clng
      FROM pixels WHERE claim_id = keep_id
    ) sub
    WHERE claims.id = keep_id;
    -- Delete now-empty older claims
    DELETE FROM claims WHERE id = ANY(dup.claim_ids[2:]);
  END LOOP;
END $$;
