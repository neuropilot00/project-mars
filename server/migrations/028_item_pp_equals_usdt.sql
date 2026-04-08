-- 1 PP = 1 USD: Set PP prices equal to USDT prices
UPDATE item_types SET price_pp = price_usdt WHERE price_pp != price_usdt;
