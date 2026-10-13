-- Eight hours of storage at the same 30-minute rate; logistics doubles cargo capacity.
-- Settle completed pre-upgrade intervals under the OLD four-batch limit before
-- widening it. Overflow time must never be converted into retroactive material.
LOCK TABLE frontier_nodes IN ACCESS EXCLUSIVE MODE;
WITH elapsed AS MATERIALIZED (
 SELECT id,owner_key,production_at AS old_at,
        FLOOR(EXTRACT(EPOCH FROM(NOW()-production_at))/1800)::integer AS intervals
 FROM frontier_nodes
 WHERE node_type='resource' AND owner_key IS NOT NULL
   AND production_at<=NOW()-INTERVAL '30 minutes'
 FOR UPDATE
), advanced AS (
 UPDATE frontier_nodes n
 SET stored_batches=LEAST(4,n.stored_batches+e.intervals),
     production_at=e.old_at+e.intervals*INTERVAL '30 minutes'
 FROM elapsed e WHERE n.id=e.id
 RETURNING e.owner_key,e.old_at,n.production_at,e.intervals
), credits AS (
 SELECT a.owner_key,month,
   GREATEST(0,LEAST(a.intervals::bigint,
     CEIL(EXTRACT(EPOCH FROM(month+INTERVAL '1 month'-a.old_at))/1800)::bigint-1)
     -GREATEST(1,CEIL(EXTRACT(EPOCH FROM(month-a.old_at))/1800)::bigint)+1)::integer AS points
 FROM advanced a CROSS JOIN LATERAL generate_series(
   date_trunc('month',a.old_at),date_trunc('month',a.production_at),INTERVAL '1 month') month
 WHERE a.owner_key LIKE 'guild:%'
)
INSERT INTO frontier_season_score(owner_key,season,hold_points)
 SELECT owner_key,TO_CHAR(month,'YYYY-MM'),LEAST(4464,SUM(points)::integer)
 FROM credits WHERE points>0 GROUP BY owner_key,month
 ON CONFLICT(owner_key,season) DO UPDATE
 SET hold_points=LEAST(4464,frontier_season_score.hold_points+EXCLUDED.hold_points);

ALTER TABLE frontier_nodes DROP CONSTRAINT frontier_nodes_stored_batches_check;
ALTER TABLE frontier_nodes ADD CONSTRAINT frontier_nodes_stored_batches_check CHECK(stored_batches BETWEEN 0 AND 16);
ALTER TABLE frontier_production_events DROP CONSTRAINT frontier_production_events_batches_check;
ALTER TABLE frontier_production_events ADD CONSTRAINT frontier_production_events_batches_check CHECK(batches BETWEEN 1 AND 16);
ALTER TABLE frontier_cargo DROP CONSTRAINT frontier_cargo_amount_check;
ALTER TABLE frontier_cargo ADD CONSTRAINT frontier_cargo_amount_check CHECK(amount BETWEEN 1 AND 200);
