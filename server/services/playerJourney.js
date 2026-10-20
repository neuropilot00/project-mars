'use strict';

// Read-only projection of existing records. No rewards, settings or onboarding writes.
// Keep the legacy core (step/completed) separate: BASE tab glow only knows steps 0..2.
const JOURNEY_SQL = `
  SELECT
    (EXISTS (SELECT 1 FROM claims WHERE LOWER(owner) = $1 AND deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM transactions WHERE LOWER(from_wallet) = $1 AND type = 'claim')) AS territory,
    -- pp_amount is the legacy mining-equivalent amount; current payouts use meta.currency='gp'.
    EXISTS (SELECT 1 FROM transactions
      WHERE LOWER(from_wallet) = $1 AND type = 'mining' AND pp_amount > 0) AS harvest,
    (EXISTS (SELECT 1 FROM ships WHERE LOWER(owner_wallet) = $1)
      OR EXISTS (SELECT 1 FROM ship_build_jobs
        WHERE LOWER(wallet_address) = $1 AND status = 'completed' AND completed_at IS NOT NULL)) AS ship,
    (EXISTS (
      SELECT 1 FROM marketplace_listings m
      JOIN users seller ON LOWER(seller.wallet_address) = LOWER(m.seller)
      JOIN users buyer ON LOWER(buyer.wallet_address) = LOWER(m.buyer)
      WHERE LOWER(m.seller) = $1 AND m.status = 'sold' AND m.sold_at IS NOT NULL AND m.price > 0
        AND LOWER(m.buyer) <> LOWER(m.seller)
        AND seller.is_ai IS FALSE AND buyer.is_ai IS FALSE
        AND LOWER(m.seller) NOT LIKE '0xnpc%' AND LOWER(m.buyer) NOT LIKE '0xnpc%'
    ) OR EXISTS (
      SELECT 1 FROM ship_market_sale_log m
      JOIN users seller ON LOWER(seller.wallet_address) = LOWER(m.seller_wallet)
      JOIN users buyer ON LOWER(buyer.wallet_address) = LOWER(m.buyer_wallet)
      WHERE LOWER(m.seller_wallet) = $1 AND m.price_gp > 0
        AND LOWER(m.buyer_wallet) <> LOWER(m.seller_wallet)
        AND seller.is_ai IS FALSE AND buyer.is_ai IS FALSE
        AND LOWER(m.seller_wallet) NOT LIKE '0xnpc%' AND LOWER(m.buyer_wallet) NOT LIKE '0xnpc%'
    )) AS human_sale,
    EXISTS (SELECT 1 FROM guild_treasury_ledger
      WHERE LOWER(wallet) = $1 AND kind IN ('harvest_contrib', 'donate') AND delta_gp > 0) AS guild_contribution
`;

function projectPlayerJourney(evidence) {
  const milestones = {
    territory: evidence.territory === true,
    harvest: evidence.harvest === true,
    ship: evidence.ship === true,
    humanSale: evidence.human_sale === true,
    guildContribution: evidence.guild_contribution === true
  };
  const core = [milestones.territory, milestones.harvest, milestones.ship];
  const missingCore = core.indexOf(false);
  const step = missingCore < 0 ? 3 : missingCore;
  const socialComplete = milestones.humanSale || milestones.guildContribution;
  const journeyStep = step < 3 ? step : (socialComplete ? 4 : 3);
  return {
    // Compatibility contract used by base-navigation.js and territory-ui.js.
    step,
    completed: step === 3,
    journey: {
      version: 1,
      step: journeyStep,
      completed: journeyStep === 4,
      totalSteps: 4,
      nextAction: ['territory', 'harvest', 'fleet', 'market_or_guild', null][journeyStep],
      milestones
    }
  };
}

async function getPlayerJourney(queryable, wallet) {
  const normalized = String(wallet || '').trim().toLowerCase();
  if (!normalized) throw new Error('WALLET_REQUIRED');
  const result = await queryable.query(JOURNEY_SQL, [normalized]);
  if (!result || !result.rows || !result.rows[0]) throw new Error('JOURNEY_UNAVAILABLE');
  return projectPlayerJourney(result.rows[0]);
}

module.exports = { getPlayerJourney, projectPlayerJourney, JOURNEY_SQL };
