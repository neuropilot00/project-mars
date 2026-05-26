-- Occupy Mars
-- Backfill onboarding first-claim linkage for existing real users.
--
-- What it does:
-- 1) fills user_onboarding.tutorial_claim_id from each wallet's earliest real claim
-- 2) advances current_step 2 -> 3 when the first-claim step was structurally missed
-- 3) grants the missing onboarding PP reward once for users who already reached step >= 2
--
-- Safe to re-run:
-- - tutorial_claim_id is only filled when null
-- - PP reward only applies when pp_rewarded is false

BEGIN;

-- 1) Backfill earliest real claim id
WITH first_claim AS (
  SELECT DISTINCT ON (LOWER(c.owner))
         LOWER(c.owner) AS wallet,
         c.id           AS claim_id
    FROM claims c
   WHERE c.owner NOT LIKE '0xnpc\_%' ESCAPE '\'
   ORDER BY LOWER(c.owner), c.claimed_at ASC, c.id ASC
)
UPDATE user_onboarding uo
   SET tutorial_claim_id = fc.claim_id,
       updated_at = NOW()
  FROM first_claim fc
 WHERE LOWER(uo.wallet_address) = fc.wallet
   AND uo.tutorial_claim_id IS NULL;

-- 2) Advance stalled step-2 users to step 3 once they already own a claim
WITH first_claim AS (
  SELECT DISTINCT ON (LOWER(c.owner))
         LOWER(c.owner) AS wallet
    FROM claims c
   WHERE c.owner NOT LIKE '0xnpc\_%' ESCAPE '\'
   ORDER BY LOWER(c.owner), c.claimed_at ASC, c.id ASC
)
UPDATE user_onboarding uo
   SET current_step = 3,
       updated_at = NOW()
  FROM first_claim fc
 WHERE LOWER(uo.wallet_address) = fc.wallet
   AND uo.current_step = 2;

-- 3) Grant missing onboarding PP reward once for users who already reached step >= 2
WITH pp_reward AS (
  SELECT COALESCE(
           NULLIF(REPLACE(value::text, '"', ''), '')::numeric,
           0.5::numeric
         ) AS amount
  FROM settings
  WHERE key = 'onboarding_pp_reward'
  LIMIT 1
), reward_targets AS (
  SELECT uo.wallet_address
    FROM user_onboarding uo
   WHERE COALESCE(uo.pp_rewarded, false) = false
     AND COALESCE(uo.current_step, 0) >= 2
     AND EXISTS (
       SELECT 1
         FROM claims c
        WHERE LOWER(c.owner) = LOWER(uo.wallet_address)
          AND c.owner NOT LIKE '0xnpc\_%' ESCAPE '\'
     )
)
UPDATE users u
   SET pp_balance = COALESCE(u.pp_balance, 0) + (SELECT COALESCE(MAX(amount), 0.5) FROM pp_reward)
 WHERE LOWER(u.wallet_address) IN (
   SELECT LOWER(wallet_address) FROM reward_targets
 );

WITH reward_targets AS (
  SELECT uo.wallet_address
    FROM user_onboarding uo
   WHERE COALESCE(uo.pp_rewarded, false) = false
     AND COALESCE(uo.current_step, 0) >= 2
     AND EXISTS (
       SELECT 1
         FROM claims c
        WHERE LOWER(c.owner) = LOWER(uo.wallet_address)
          AND c.owner NOT LIKE '0xnpc\_%' ESCAPE '\'
     )
)
UPDATE user_onboarding uo
   SET pp_rewarded = true,
       updated_at = NOW()
 WHERE LOWER(uo.wallet_address) IN (
   SELECT LOWER(wallet_address) FROM reward_targets
 );

COMMIT;

-- Suggested verification after run:
-- select wallet_address, current_step, tutorial_claim_id, pp_rewarded
-- from user_onboarding
-- where lower(wallet_address) in (
--   select distinct lower(owner) from claims where owner not like '0xnpc\_%' escape '\'
-- )
-- order by wallet_address;
