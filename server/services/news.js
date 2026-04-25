'use strict';
// ⚠ STATUS: 🔴 PHANTOM TABLES — 이 서비스가 의존하는 테이블이 DB에 없음.
// 호출 시 silent 실패 (catch에서 'internal_error' 반환). 살리려면 마이그레이션
// 추가 또는 services + route + 스케줄러 등록 일괄 삭제 결정 필요.
// 자세한 내용: CLAUDE.md §13.A 참조.
/**
 * Planet News Service — Migration 106
 * Lightweight event-driven news feed for in-game activities.
 * All add* functions are fire-and-forget safe.
 */

const { pool, getSetting } = require('../db');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function isEnabled() {
  return (await getSetting('news_enabled').catch(() => 'true')) !== 'false';
}

function shortWallet(w) {
  if (!w) return 'unknown';
  return w.slice(0, 6) + '...' + w.slice(-4);
}

// ── Core insert ──────────────────────────────────────────────────────────────

/**
 * Add a news item. Safe to fire-and-forget.
 * @param {string} eventType
 * @param {string} headline
 * @param {object} opts  { wallet, wallet2, amount, meta }
 */
async function addNews(eventType, headline, opts = {}) {
  if (!(await isEnabled())) return;
  const { wallet, wallet2, amount, meta } = opts;
  await pool.query(
    `INSERT INTO planet_news (event_type, headline, wallet, wallet2, amount, meta)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      eventType,
      headline,
      wallet ? wallet.toLowerCase() : null,
      wallet2 ? wallet2.toLowerCase() : null,
      amount || null,
      meta ? JSON.stringify(meta) : null,
    ]
  );
}

// ── Convenience wrappers (resolve nicknames lazily) ──────────────────────────

async function getNick(wallet) {
  if (!wallet) return null;
  const r = await pool.query(`SELECT nickname FROM users WHERE wallet_address = $1`, [wallet.toLowerCase()]);
  return r.rows[0]?.nickname || shortWallet(wallet);
}

/**
 * Called from lottery service when a round is won.
 */
async function onLotteryWin(winner, prizeGp, roundNumber) {
  if (!(await isEnabled())) return;
  if ((await getSetting('news_lottery_enabled').catch(() => 'true')) === 'false') return;
  const nick = await getNick(winner);
  await addNews('lottery_win',
    `🎰 ${nick} won Round #${roundNumber} lottery — +${Math.round(prizeGp)} GP!`,
    { wallet: winner, amount: prizeGp, meta: { roundNumber } }
  );
}

/**
 * Called from battle service when a battle ends.
 */
async function onBattleWon(winnerWallet, loserWallet) {
  if (!(await isEnabled())) return;
  if ((await getSetting('news_battle_enabled').catch(() => 'true')) === 'false') return;
  const [winNick, loseNick] = await Promise.all([getNick(winnerWallet), getNick(loserWallet)]);
  await addNews('battle_won',
    `⚔️ ${winNick} defeated ${loseNick} in naval combat`,
    { wallet: winnerWallet, wallet2: loserWallet }
  );
}

/**
 * Called from marketplace when a big sale completes.
 */
async function onMarketSale(sellerWallet, buyerWallet, itemName, priceGp, currency) {
  if (!(await isEnabled())) return;
  const minGp = parseFloat(await getSetting('news_min_trade_gp').catch(() => '100')) || 100;
  if (currency === 'GP' && priceGp < minGp) return;
  const [sellNick, buyNick] = await Promise.all([getNick(sellerWallet), getNick(buyerWallet)]);
  await addNews('market_sale',
    `🛒 ${buyNick} bought "${itemName}" from ${sellNick} — ${Math.round(priceGp)} ${currency}`,
    { wallet: sellerWallet, wallet2: buyerWallet, amount: priceGp, meta: { itemName, currency } }
  );
}

/**
 * Called from achievements when epic/legendary achievement unlocks.
 */
async function onAchievementUnlock(wallet, achievementName, rarity) {
  if (!(await isEnabled())) return;
  if ((await getSetting('news_achievement_epic').catch(() => 'true')) === 'false') return;
  if (!['epic', 'legendary'].includes(rarity)) return;
  const nick = await getNick(wallet);
  const icon = rarity === 'legendary' ? '🌟' : '🏅';
  await addNews('achievement',
    `${icon} ${nick} unlocked ${rarity} achievement: "${achievementName}"`,
    { wallet, meta: { achievementName, rarity } }
  );
}

/**
 * Called from GP transfer on large transfers.
 */
async function onBigTransfer(fromWallet, toWallet, amount) {
  if (!(await isEnabled())) return;
  const minAmt = parseFloat(await getSetting('news_min_transfer_gp').catch(() => '500')) || 500;
  if (amount < minAmt) return;
  const [fromNick, toNick] = await Promise.all([getNick(fromWallet), getNick(toWallet)]);
  await addNews('big_trade',
    `💸 ${fromNick} sent ${Math.round(amount)} GP to ${toNick}`,
    { wallet: fromWallet, wallet2: toWallet, amount }
  );
}

/**
 * Called when a new territory is claimed.
 */
async function onTerritoryClaimed(wallet, sectorName) {
  if (!(await isEnabled())) return;
  const nick = await getNick(wallet);
  await addNews('territory_claimed',
    `🌍 ${nick} claimed a new territory${sectorName ? ' in ' + sectorName : ''}`,
    { wallet, meta: { sectorName } }
  );
}

// ── Queries ───────────────────────────────────────────────────────────────────

async function getNews({ limit = 30, offset = 0, eventType = null } = {}) {
  const maxItems = parseInt(await getSetting('news_max_items').catch(() => '50')) || 50;
  limit = Math.min(limit, maxItems);

  let where = '';
  const params = [limit, offset];
  if (eventType) {
    where = ' WHERE event_type = $3';
    params.push(eventType);
  }

  const res = await pool.query(
    `SELECT n.*,
            u1.nickname AS actor_nick,
            u2.nickname AS actor2_nick
       FROM planet_news n
       LEFT JOIN users u1 ON u1.wallet_address = n.wallet
       LEFT JOIN users u2 ON u2.wallet_address = n.wallet2
       ${where}
      ORDER BY n.created_at DESC
      LIMIT $1 OFFSET $2`,
    params
  );
  return res.rows;
}

/**
 * Delete old news (called by scheduler).
 */
async function cleanOldNews() {
  const days = parseInt(await getSetting('news_retention_days').catch(() => '30')) || 30;
  const result = await pool.query(
    `DELETE FROM planet_news WHERE created_at < NOW() - ($1 || ' days')::INTERVAL`,
    [days]
  );
  return result.rowCount;
}

module.exports = { addNews, onLotteryWin, onBattleWon, onMarketSale, onAchievementUnlock, onBigTransfer, onTerritoryClaimed, getNews, cleanOldNews };
