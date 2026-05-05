// server/routes/territoryIdentity.js
// ═══════════════════════════════════════════════════════════════
// 영토 정체성 시스템 라우트
//
// GET   /api/territory/:claimId/identity        — 영토 FR, 배지, 이력 조회
// PATCH /api/territory/:claimId/identity        — 닉네임/바이오 수정
// GET   /api/sectors/conflict-map               — 섹터별 갈등 현황
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { pool, getSetting } = require('../db');

function getWallet(req) {
  return (req.body?.wallet || req.headers['x-wallet'] || req.query.wallet || '').toLowerCase().trim();
}

// ── Field Rating 계산 헬퍼 ────────────────────────────────────
function calcFieldRating(claim, upgradeLevel = 0) {
  const claimedAt = claim.claimed_at ? new Date(claim.claimed_at) : new Date();
  const holdDays  = Math.max(0, Math.floor((Date.now() - claimedAt.getTime()) / 86400000));
  const hasArt    = claim.image_url ? 1 : 0;
  const defWins   = claim.defense_wins || 0;

  const fr = (holdDays * 2) + (defWins * 5) + (upgradeLevel * 3) + (hasArt * 10);
  return fr;
}

function frTier(fr) {
  if (fr >= 100) return { tier: 'legend',   label_en: 'Legend',   label_ko: '전설', icon: '🌟' };
  if (fr >= 60)  return { tier: 'fortress',  label_en: 'Fortress', label_ko: '요새', icon: '🛡' };
  if (fr >= 30)  return { tier: 'settler',   label_en: 'Settler',  label_ko: '정착민', icon: '🏠' };
  if (fr >= 10)  return { tier: 'pioneer',   label_en: 'Pioneer',  label_ko: '개척자', icon: '⛏' };
  return { tier: 'newcomer', label_en: 'Newcomer', label_ko: '신규', icon: '🌱' };
}

// ── GET /api/territory/:claimId/identity ─────────────────────
router.get('/:claimId/identity', async (req, res) => {
  try {
    const claimId = parseInt(req.params.claimId);
    if (!claimId) return res.status(400).json({ error: 'INVALID_CLAIM_ID' });

    const { rows } = await pool.query(
      `SELECT c.id, c.owner, c.sector_code, c.pixel_count,
              c.image_url, c.nickname, c.bio,
              c.defense_wins, c.times_hijacked, c.battle_wins,
              c.field_rating, c.longest_hold_days,
              c.badge_pioneer, c.badge_settler, c.badge_veteran, c.badge_fortress,
              c.hold_bonus_pct, c.claimed_at,
              COALESCE(SUM(cu.level), 0) AS total_upgrade_level
       FROM claims c
       LEFT JOIN claim_upgrades cu ON cu.claim_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [claimId]
    );

    if (!rows[0]) return res.status(404).json({ error: 'CLAIM_NOT_FOUND' });
    const claim = rows[0];

    // FR 재계산 (실시간)
    const upgradeLevel = parseInt(claim.total_upgrade_level) || 0;
    const fr = calcFieldRating(claim, upgradeLevel);

    // DB에 저장된 값보다 실시간 계산이 더 최신
    const finalFR = Math.max(fr, claim.field_rating || 0);
    const tier = frTier(finalFR);

    // 배지 목록
    const badges = [];
    if (claim.badge_pioneer) badges.push({ id: 'pioneer', label_en: 'Pioneer',  label_ko: '7일 개척자', icon: '⛏' });
    if (claim.badge_settler) badges.push({ id: 'settler',  label_en: 'Settler',  label_ko: '30일 정착민', icon: '🏠' });
    if (claim.badge_veteran) badges.push({ id: 'veteran',  label_en: 'Veteran',  label_ko: '90일 베테랑', icon: '🎖' });
    if (claim.badge_fortress) badges.push({ id: 'fortress', label_en: 'Fortress', label_ko: '방어 요새', icon: '🛡' });

    // 보유 기간
    const claimedAt = claim.claimed_at ? new Date(claim.claimed_at) : null;
    const holdDays  = claimedAt ? Math.max(0, Math.floor((Date.now() - claimedAt.getTime()) / 86400000)) : 0;

    res.json({
      success: true,
      identity: {
        claim_id: claim.id,
        owner: claim.owner,
        sector_code: claim.sector_code,
        pixel_count: claim.pixel_count,
        has_art: !!claim.image_url,
        nickname: claim.nickname || null,
        bio: claim.bio || null,
        field_rating: finalFR,
        fr_tier: tier,
        hold_days: holdDays,
        defense_wins: claim.defense_wins || 0,
        times_hijacked: claim.times_hijacked || 0,
        battle_wins: claim.battle_wins || 0,
        total_upgrade_level: upgradeLevel,
        hold_bonus_pct: parseFloat(claim.hold_bonus_pct) || 0,
        badges,
        claimed_at: claim.claimed_at
      }
    });
  } catch (err) {
    console.error('[territoryIdentity] GET error:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ── PATCH /api/territory/:claimId/identity ────────────────────
router.patch('/:claimId/identity', async (req, res) => {
  try {
    const claimId = parseInt(req.params.claimId);
    const wallet  = getWallet(req);
    const { nickname, bio } = req.body || {};

    if (!claimId) return res.status(400).json({ error: 'INVALID_CLAIM_ID' });
    if (!wallet || wallet.length < 5) return res.status(400).json({ error: 'WALLET_REQUIRED' });

    // 소유자 확인
    const { rows: claimRows } = await pool.query(
      `SELECT owner FROM claims WHERE id = $1`, [claimId]
    );
    if (!claimRows[0]) return res.status(404).json({ error: 'CLAIM_NOT_FOUND' });
    if (claimRows[0].owner.toLowerCase() !== wallet) {
      return res.status(403).json({ error: 'NOT_OWNER' });
    }

    // 유효성 검사
    if (nickname !== undefined) {
      const n = String(nickname).trim();
      if (n.length > 40) return res.status(400).json({ error: 'NICKNAME_TOO_LONG', max: 40 });
    }
    if (bio !== undefined) {
      const b = String(bio).trim();
      if (b.length > 200) return res.status(400).json({ error: 'BIO_TOO_LONG', max: 200 });
    }

    const updates = {};
    if (nickname !== undefined) updates.nickname = String(nickname).trim() || null;
    if (bio      !== undefined) updates.bio      = String(bio).trim()      || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'NOTHING_TO_UPDATE' });
    }

    const setClause = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values    = [claimId, ...Object.values(updates)];

    await pool.query(`UPDATE claims SET ${setClause} WHERE id = $1`, values);

    res.json({ success: true, updated: updates });
  } catch (err) {
    console.error('[territoryIdentity] PATCH error:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ── GET /api/sectors/conflict-map ─────────────────────────────
// 섹터별 활성 전투/현상금 수 (지구본 오버레이용)
router.get('/conflict-map', async (req, res) => {
  try {
    // 섹터별 활성 전투 수
    let battles = [];
    try {
      const { rows } = await pool.query(
        `SELECT hb.target_claim_sector AS sector_code, COUNT(*) AS active_battles
         FROM hijack_battles hb
         WHERE hb.status IN ('active','pending')
         GROUP BY sector_code`
      );
      battles = rows;
    } catch (_) {}

    // 섹터별 현상금 수
    let bounties = [];
    try {
      const { rows } = await pool.query(
        `SELECT SUBSTRING(c.sector_code FROM 1 FOR 3) AS sector_code,
                COUNT(bl.id) AS active_bounties,
                SUM(bl.reward_gp) AS total_bounty_gp
         FROM bounty_listings bl
         JOIN claims c ON LOWER(c.owner) = bl.target_wallet
         WHERE bl.status = 'active' AND bl.expires_at > NOW()
         GROUP BY SUBSTRING(c.sector_code FROM 1 FOR 3)`
      );
      bounties = rows;
    } catch (_) {}

    // 섹터별 클레임 수
    const { rows: sectors } = await pool.query(
      `SELECT sector_code,
              COUNT(*) AS claim_count,
              COUNT(DISTINCT owner) AS owner_count
       FROM claims GROUP BY sector_code ORDER BY claim_count DESC`
    );

    // 병합
    const map = {};
    for (const s of sectors) {
      map[s.sector_code] = {
        sector_code: s.sector_code,
        claim_count: parseInt(s.claim_count),
        owner_count: parseInt(s.owner_count),
        active_battles: 0,
        active_bounties: 0,
        total_bounty_gp: 0,
        heat: 0
      };
    }
    for (const b of battles) {
      if (map[b.sector_code]) map[b.sector_code].active_battles = parseInt(b.active_battles);
    }
    for (const b of bounties) {
      if (map[b.sector_code]) {
        map[b.sector_code].active_bounties = parseInt(b.active_bounties);
        map[b.sector_code].total_bounty_gp = parseInt(b.total_bounty_gp);
      }
    }

    // heat score: 전투×10 + 현상금×3 + 클레임밀도
    for (const k in map) {
      const s = map[k];
      s.heat = Math.min(100, (s.active_battles * 10) + (s.active_bounties * 3) + Math.min(10, s.claim_count));
    }

    res.json({
      success: true,
      sectors: Object.values(map).filter(s => s.heat > 0 || s.claim_count > 0)
    });
  } catch (err) {
    console.error('[conflictMap] error:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;

// ── 내보내기: holdingRewards 스케줄러용 ─────────────────────
module.exports.updateFieldRatings = async function() {
  try {
    // 모든 클레임의 FR + 배지 업데이트
    const { rows: claims } = await pool.query(
      `SELECT c.id, c.owner, c.image_url, c.claimed_at,
              c.defense_wins, c.badge_pioneer, c.badge_settler, c.badge_veteran,
              COALESCE(SUM(cu.level), 0) AS total_upgrade_level
       FROM claims c
       LEFT JOIN claim_upgrades cu ON cu.claim_id = c.id
       GROUP BY c.id`
    );

    const hold7d  = parseFloat(await getSetting('hold_reward_7d_bonus_pct',  '5'))  || 5;
    const hold30d = parseFloat(await getSetting('hold_reward_30d_bonus_pct', '10')) || 10;
    const hold90d = parseFloat(await getSetting('hold_reward_90d_bonus_pct', '20')) || 20;

    for (const claim of claims) {
      const claimedAt = claim.claimed_at ? new Date(claim.claimed_at) : new Date();
      const holdDays  = Math.max(0, Math.floor((Date.now() - claimedAt.getTime()) / 86400000));
      const upgradeLevel = parseInt(claim.total_upgrade_level) || 0;
      const fr = calcFieldRating(claim, upgradeLevel);

      const badgePioneer  = holdDays >= 7;
      const badgeSettler  = holdDays >= 30;
      const badgeVeteran  = holdDays >= 90;
      const badgeFortress = (claim.defense_wins || 0) >= 5;

      let bonusPct = 0;
      if (holdDays >= 90) bonusPct = hold90d;
      else if (holdDays >= 30) bonusPct = hold30d;
      else if (holdDays >= 7)  bonusPct = hold7d;

      await pool.query(
        `UPDATE claims SET
           field_rating = $1,
           longest_hold_days = GREATEST(COALESCE(longest_hold_days, 0), $2),
           badge_pioneer  = $3,
           badge_settler  = $4,
           badge_veteran  = $5,
           badge_fortress = $6,
           hold_bonus_pct = $7
         WHERE id = $8`,
        [fr, holdDays, badgePioneer, badgeSettler, badgeVeteran, badgeFortress, bonusPct, claim.id]
      );
    }
    console.log(`[territoryIdentity] updateFieldRatings: ${claims.length}개 처리 완료`);
  } catch (err) {
    console.error('[territoryIdentity] updateFieldRatings error:', err.message);
  }
};
