// server/routes/dailyOps.js
// ═══════════════════════════════════════════════════════════════
// Daily OPS 미션 시스템 라우트
//
// GET  /api/daily-ops/:wallet          — 오늘 미션 목록 + 진행도
// POST /api/daily-ops/progress         — 미션 진행도 업데이트 (내부 호출용)
// POST /api/daily-ops/claim            — 완료 미션 보상 수령
// GET  /api/daily-ops/weekly-events    — 이번주 이벤트 캘린더
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool, getSetting } = require('../db');

// ✅ [v7.44] JWT 인증 미들웨어
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function getAuthWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}
function getWallet(req) {
  return (req.body?.wallet || req.headers['x-wallet'] || req.query.wallet || '').toLowerCase().trim();
}

// ── 오늘의 미션 타입 정의 (전체 목록 — 30종) ────────────────
const ALL_MISSION_TYPES = [
  // ─ 영토 (0~6) ─
  { type: 'harvest_pp',           label_ko: '영토 채굴 1회',            label_en: 'Harvest territory ×1',         target: 1,  default_gp: 50,  dest_ko: '내 영토 → 채굴',         dest_en: 'Territory → Harvest'   },
  { type: 'harvest_3',            label_ko: '영토 채굴 3회',             label_en: 'Harvest territory ×3',         target: 3,  default_gp: 120, dest_ko: '내 영토 → 채굴',         dest_en: 'Territory → Harvest'   },
  { type: 'harvest_5',            label_ko: '영토 채굴 5회',             label_en: 'Harvest territory ×5',         target: 5,  default_gp: 180, dest_ko: '내 영토 → 채굴',         dest_en: 'Territory → Harvest'   },
  { type: 'territory_art',        label_ko: '영토 이미지 등록',          label_en: 'Register territory art',       target: 1,  default_gp: 80,  dest_ko: '내 영토 → 이미지 등록',  dest_en: 'Territory → Art'       },
  { type: 'territory_upgrade',    label_ko: '영토 업그레이드 1회',       label_en: 'Upgrade territory ×1',         target: 1,  default_gp: 100, dest_ko: '내 영토 → 업그레이드',   dest_en: 'Territory → Upgrade'   },
  { type: 'territory_upgrade_3',  label_ko: '영토 업그레이드 3회',       label_en: 'Upgrade territory ×3',         target: 3,  default_gp: 220, dest_ko: '내 영토 → 업그레이드',   dest_en: 'Territory → Upgrade'   },
  { type: 'territory_claim',      label_ko: '영토 클레임 1회',           label_en: 'Claim territory ×1',           target: 1,  default_gp: 70,  dest_ko: '화성 지도 → 클레임',     dest_en: 'Mars Map → Claim'      },
  // ─ 전투 (7~13) ─
  { type: 'battle_participate',   label_ko: '전투 참여 1회',             label_en: 'Participate in battle ×1',     target: 1,  default_gp: 100, dest_ko: 'PvP 전투',               dest_en: 'PvP Battle'            },
  { type: 'battle_win',           label_ko: '전투 승리 1회',             label_en: 'Win a battle ×1',              target: 1,  default_gp: 150, dest_ko: 'PvP 전투',               dest_en: 'PvP Battle'            },
  { type: 'battle_participate_3', label_ko: '전투 3회 참여',             label_en: 'Participate in battle ×3',     target: 3,  default_gp: 250, dest_ko: 'PvP 전투',               dest_en: 'PvP Battle'            },
  { type: 'battle_win_3',         label_ko: '전투 3회 승리',             label_en: 'Win 3 battles',                target: 3,  default_gp: 350, dest_ko: 'PvP 전투',               dest_en: 'PvP Battle'            },
  { type: 'ai_battle',            label_ko: 'AI 연습전 참여 1회',        label_en: 'AI practice battle ×1',        target: 1,  default_gp: 60,  dest_ko: 'PvP → AI 연습전',        dest_en: 'PvP → AI Practice'     },
  { type: 'ai_battle_3',          label_ko: 'AI 연습전 3회',             label_en: 'AI practice battle ×3',        target: 3,  default_gp: 150, dest_ko: 'PvP → AI 연습전',        dest_en: 'PvP → AI Practice'     },
  { type: 'battle_forfeit',       label_ko: '전투 항복 1회 (전술 후퇴)', label_en: 'Tactical retreat ×1',          target: 1,  default_gp: 30,  dest_ko: 'PvP 전투',               dest_en: 'PvP Battle'            },
  // ─ 함대/함선 (14~20) ─
  { type: 'upgrade_ship',         label_ko: '함선 강화 1회',             label_en: 'Upgrade a ship ×1',            target: 1,  default_gp: 75,  dest_ko: '조선소',                 dest_en: 'Shipyard'              },
  { type: 'upgrade_ship_3',       label_ko: '함선 강화 3회',             label_en: 'Upgrade a ship ×3',            target: 3,  default_gp: 180, dest_ko: '조선소',                 dest_en: 'Shipyard'              },
  { type: 'upgrade_ship_5',       label_ko: '함선 강화 5회',             label_en: 'Upgrade a ship ×5',            target: 5,  default_gp: 280, dest_ko: '조선소',                 dest_en: 'Shipyard'              },
  { type: 'build_ship',           label_ko: '함선 건조 시작 1회',        label_en: 'Start ship build ×1',          target: 1,  default_gp: 90,  dest_ko: '조선소 → 건조',          dest_en: 'Shipyard → Build'      },
  { type: 'repair_ship',          label_ko: '함선 수리 1회',             label_en: 'Repair a ship ×1',             target: 1,  default_gp: 50,  dest_ko: '조선소 → 수리',          dest_en: 'Shipyard → Repair'     },
  { type: 'repair_ship_3',        label_ko: '함선 수리 3회',             label_en: 'Repair a ship ×3',             target: 3,  default_gp: 110, dest_ko: '조선소 → 수리',          dest_en: 'Shipyard → Repair'     },
  { type: 'fleet_formation',      label_ko: '함대 진형 변경 1회',        label_en: 'Change fleet formation ×1',    target: 1,  default_gp: 40,  dest_ko: '함대 지휘',              dest_en: 'Fleet Command'         },
  // ─ 경제 (21~26) ─
  { type: 'craft_resource',       label_ko: '재료 제작 1회',             label_en: 'Craft a resource ×1',          target: 1,  default_gp: 60,  dest_ko: '경제 → 재료 제작',       dest_en: 'Economy → Craft'       },
  { type: 'craft_resource_3',     label_ko: '재료 제작 3회',             label_en: 'Craft a resource ×3',          target: 3,  default_gp: 150, dest_ko: '경제 → 재료 제작',       dest_en: 'Economy → Craft'       },
  { type: 'craft_resource_5',     label_ko: '재료 제작 5회',             label_en: 'Craft a resource ×5',          target: 5,  default_gp: 230, dest_ko: '경제 → 재료 제작',       dest_en: 'Economy → Craft'       },
  { type: 'market_list',          label_ko: '마켓에 함선 등록 1회',      label_en: 'List ship on market ×1',       target: 1,  default_gp: 70,  dest_ko: '경제 → 마켓',            dest_en: 'Economy → Market'      },
  { type: 'market_buy',           label_ko: '마켓 함선 구매 1회',        label_en: 'Buy ship on market ×1',        target: 1,  default_gp: 90,  dest_ko: '경제 → 마켓',            dest_en: 'Economy → Market'      },
  { type: 'market_activity',      label_ko: '마켓 거래 3회',             label_en: 'Market transactions ×3',       target: 3,  default_gp: 200, dest_ko: '경제 → 마켓',            dest_en: 'Economy → Market'      },
  // ─ 캠페인/퀘스트 (27~29) ─
  { type: 'campaign_progress',    label_ko: '캠페인 챕터 진행 1회',      label_en: 'Progress campaign ×1',         target: 1,  default_gp: 80,  dest_ko: '임무 → 캠페인',          dest_en: 'Mission → Campaign'    },
  { type: 'campaign_complete',    label_ko: '캠페인 챕터 완료 1회',      label_en: 'Complete a campaign chapter',  target: 1,  default_gp: 200, dest_ko: '임무 → 캠페인',          dest_en: 'Mission → Campaign'    },
  { type: 'daily_login',          label_ko: '오늘 로그인 확인',          label_en: 'Daily login check-in',         target: 1,  default_gp: 30,  dest_ko: '자동 완료',              dest_en: 'Auto-complete'         },
];

// 요일별 미션 조합 (하루 4개: 영토1 + 전투1 + 함선/경제1 + 캠페인/로그인1)
function getTodayMissions(date) {
  const dow = date.getUTCDay(); // 0=Sun ... 6=Sat
  const combos = {
    0: [0,  7, 14, 29],   // Sun:  채굴, 전투참여, 함선강화, 로그인
    1: [0,  8, 21, 27],   // Mon:  채굴, 전투승리, 재료제작, 캠페인
    2: [3,  7, 17, 29],   // Tue:  이미지등록, 전투참여, 함선건조, 로그인
    3: [1,  9, 22, 27],   // Wed:  채굴3, 전투3회, 재료3, 캠페인
    4: [0, 11, 14, 29],   // Thu:  채굴, AI연습전3, 함선강화, 로그인
    5: [4,  8, 24, 28],   // Fri:  업그레이드, 전투승리, 마켓등록, 캠페인완료
    6: [2, 10, 15, 27],   // Sat:  채굴5, AI연습전, 강화3, 캠페인
  };
  // 인덱스 범위 보정 (없는 인덱스는 0번으로 대체)
  const len = ALL_MISSION_TYPES.length;
  return (combos[dow] || combos[0]).map(i => ALL_MISSION_TYPES[Math.min(i, len - 1)]);
}

// ── 미션 초기화 (없으면 생성) ────────────────────────────────
async function ensureDailyMissions(wallet) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const missions = getTodayMissions(new Date());

  for (const m of missions) {
    const gp = parseInt(await getSetting(m.reward_key, String(m.default_gp))) || m.default_gp;
    await pool.query(
      `INSERT INTO daily_ops (wallet_address, ops_date, mission_type, target_count, reward_gp)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (wallet_address, ops_date, mission_type) DO NOTHING`,
      [wallet, today, m.type, m.target, gp]
    );
  }
}

// ── GET /api/daily-ops/weekly-events ─────────────────────────
// NOTE: Must be registered BEFORE /:wallet to prevent shadow match
router.get('/weekly-events', async (req, res) => {
  try {
    const week = [
      { day: 0, name: 'SUN', label_en: 'No Event',          label_ko: '이벤트 없음',      icon: '—', type: null, multiplier: 1 },
      { day: 1, name: 'MON', label_en: 'Mining Bonus +50%', label_ko: '채굴 보너스 +50%', icon: '⛏', type: 'mining_bonus',    multiplier: 1.5 },
      { day: 2, name: 'TUE', label_en: 'No Event',          label_ko: '이벤트 없음',      icon: '—', type: null, multiplier: 1 },
      { day: 3, name: 'WED', label_en: 'Battle GP +30%',    label_ko: '전투 GP +30%',     icon: '⚔', type: 'battle_gp_boost',  multiplier: 1.3 },
      { day: 4, name: 'THU', label_en: 'No Event',          label_ko: '이벤트 없음',      icon: '—', type: null, multiplier: 1 },
      { day: 5, name: 'FRI', label_en: 'Upgrade -20%',      label_ko: '강화 비용 -20%',   icon: '🔧', type: 'upgrade_discount', multiplier: 0.8 },
      { day: 6, name: 'SAT', label_en: 'Double Bounty',     label_ko: '현상금 2배',       icon: '💰', type: 'double_bounty',    multiplier: 2.0 },
    ];
    const todayDow = new Date().getDay();
    res.json({ success: true, week, today_dow: todayDow });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ── GET /api/daily-ops/:wallet ────────────────────────────────
router.get('/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase().trim();
    if (!wallet || wallet.length < 5) return res.status(400).json({ error: 'INVALID_WALLET' });

    const enabled = await getSetting('enabled', 'true'); // daily_ops.enabled
    // (category match는 getSetting이 key 기반이므로 'daily_ops.enabled' 아니라 직접 key)

    const today = new Date().toISOString().slice(0, 10);

    // 미션이 없으면 생성
    await ensureDailyMissions(wallet);

    // 오늘의 4개 미션 타입만 표시 (과거에 삽입된 9개 레거시 행 제외)
    const missionDefs = getTodayMissions(new Date());
    const validTypes = missionDefs.map(m => m.type);

    const { rows } = await pool.query(
      `SELECT id, ops_date, mission_type, target_count, current_count,
              reward_gp, completed, completed_at, reward_claimed, claimed_at
       FROM daily_ops WHERE wallet_address = $1 AND ops_date = $2
         AND mission_type = ANY($3)
       ORDER BY mission_type`,
      [wallet, today, validTypes]
    );

    const missions = rows.map(r => {
      const def = missionDefs.find(m => m.type === r.mission_type) || {};
      return {
        id: r.id,
        type: r.mission_type,
        label_en: def.label_en || r.mission_type,
        label_ko: def.label_ko || r.mission_type,
        dest_ko: def.dest_ko || '',
        dest_en: def.dest_en || '',
        target: r.target_count,
        current: r.current_count,
        progress_pct: Math.min(100, Math.round((r.current_count / r.target_count) * 100)),
        reward_gp: r.reward_gp,
        completed: r.completed,
        completed_at: r.completed_at,
        reward_claimed: r.reward_claimed,
        claimed_at: r.claimed_at
      };
    });

    const totalReward = missions.reduce((s, m) => s + m.reward_gp, 0);
    const claimedReward = missions.filter(m => m.reward_claimed).reduce((s, m) => s + m.reward_gp, 0);

    // 오늘의 이벤트
    const weeklyEvent = getTodayWeeklyEvent();

    // 주간 완료 일수 (UTC 월요일 기준)
    let weeklyDone = 0;
    try {
      const { rows: weekRows } = await pool.query(
        `SELECT COUNT(DISTINCT ops_date)::int AS cnt FROM daily_ops
         WHERE wallet_address = $1
           AND ops_date >= date_trunc('week', CURRENT_DATE AT TIME ZONE 'UTC')::date
           AND reward_claimed = TRUE`,
        [wallet]
      );
      weeklyDone = weekRows[0]?.cnt || 0;
    } catch (_) {}

    // 주간 보상 레이블
    let weeklyRewardLabel = '';
    try { weeklyRewardLabel = await getSetting('weekly_ops_reward_label', '주간 OPS 보상 팩'); } catch (_) {}

    // 긴급 이벤트: 활성 공성전 중 내 영토 섹터
    let urgentEvents = [];
    try {
      const { rows: siegeRows } = await pool.query(
        `SELECT sb.sector_code,
           GREATEST(0, EXTRACT(EPOCH FROM (sb.updated_at + INTERVAL '24 hours' - NOW()))::int) AS time_remaining_sec
         FROM siege_battles sb
         JOIN claims c ON LOWER(c.sector_code) = LOWER(sb.sector_code) AND LOWER(c.owner) = $1
         WHERE sb.status = 'active'
         LIMIT 2`,
        [wallet]
      );
      urgentEvents = siegeRows.map(r => ({
        label_ko: r.sector_code + ' 섹터 공성전 진행 중!',
        label_en: r.sector_code + ' Sector siege active!',
        time_remaining_sec: r.time_remaining_sec,
        action: "openSiege && openSiege('" + r.sector_code + "')"
      }));
    } catch (_) {}

    // 예상 PP: 실제 mining_base_rate + 섹터 보너스 기반 계산
    let expectedPP = 0;
    try {
      const baseRate  = parseFloat(await getSetting('mining_base_rate', '0.001')) || 0.001;
      const bonusCore = parseFloat(await getSetting('mining_bonus_core', '1.5'))  || 1.5;
      const bonusMid  = parseFloat(await getSetting('mining_bonus_mid',  '1.2'))  || 1.2;
      const bonusFrt  = parseFloat(await getSetting('mining_bonus_frontier', '1.0')) || 1.0;
      const { rows: claimRows } = await pool.query(
        `SELECT (c.width * c.height) AS pixels,
                COALESCE(s.sector_type, 'frontier') AS sector_type
         FROM claims c
         LEFT JOIN sectors s ON LOWER(s.code) = LOWER(c.sector_code)
         WHERE LOWER(c.owner) = $1 AND (c.deleted_at IS NULL OR c.deleted_at > NOW())`,
        [wallet]
      );
      expectedPP = claimRows.reduce((sum, row) => {
        const bonus = row.sector_type === 'core' ? bonusCore :
                      row.sector_type === 'mid'  ? bonusMid  : bonusFrt;
        return sum + (row.pixels * baseRate * bonus);
      }, 0);
      expectedPP = Math.round(expectedPP * 10) / 10; // 소수점 1자리
    } catch (_) {}

    res.json({
      success: true,
      date: today,
      missions,
      summary: {
        total: missions.length,
        completed: missions.filter(m => m.completed).length,
        claimed: missions.filter(m => m.reward_claimed).length,
        total_reward_gp: totalReward,
        claimed_gp: claimedReward,
        available_gp: missions.filter(m => m.completed && !m.reward_claimed).reduce((s, m) => s + m.reward_gp, 0)
      },
      weekly_event: weeklyEvent,
      weekly_done: weeklyDone,
      weekly_total: 7,
      weekly_reward_label: weeklyRewardLabel,
      urgent_events: urgentEvents,
      expected_pp: expectedPP
    });
  } catch (err) {
    console.error('[dailyOps] GET error:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ── POST /api/daily-ops/progress (내부 호출) ──────────────────
// 각 행동(채굴/전투/강화/제작)이 완료될 때 서버 내부에서 호출
// [v7.61] requireAdmin 추가 — 외부 클라이언트가 직접 호출해 GP 미션 조작하는 경로 차단
router.post('/progress', (req, res, next) => {
  const s = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  if (!s || s !== process.env.ADMIN_SECRET) return res.status(403).json({ error: 'FORBIDDEN' });
  next();
}, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    const { mission_type } = req.body || {};
    if (!wallet || wallet.length < 5) return res.status(400).json({ error: 'INVALID_WALLET' });
    if (!mission_type) return res.status(400).json({ error: 'MISSION_TYPE_REQUIRED' });

    await ensureDailyMissions(wallet);

    const today = new Date().toISOString().slice(0, 10);

    const { rows } = await pool.query(
      `UPDATE daily_ops
       SET current_count = LEAST(target_count, current_count + 1),
           completed = CASE WHEN LEAST(target_count, current_count + 1) >= target_count THEN TRUE ELSE completed END,
           completed_at = CASE WHEN LEAST(target_count, current_count + 1) >= target_count AND completed = FALSE THEN NOW() ELSE completed_at END
       WHERE wallet_address = $1 AND ops_date = $2 AND mission_type = $3 AND completed = FALSE
       RETURNING id, mission_type, current_count, target_count, completed, reward_gp`,
      [wallet, today, mission_type]
    );

    const updated = rows[0];
    if (!updated) return res.json({ success: true, updated: false, reason: 'already_completed_or_not_found' });

    res.json({
      success: true,
      updated: true,
      mission: {
        type: updated.mission_type,
        current: updated.current_count,
        target: updated.target_count,
        completed: updated.completed,
        reward_gp: updated.reward_gp
      }
    });
  } catch (err) {
    console.error('[dailyOps] progress error:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ── POST /api/daily-ops/claim ─────────────────────────────────
router.post('/claim', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    const { mission_id } = req.body || {};
    if (!wallet || wallet.length < 5) return res.status(400).json({ error: 'INVALID_WALLET' });

    const today = new Date().toISOString().slice(0, 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 특정 미션 또는 전체 완료 미션 수령
      let query, params;
      if (mission_id) {
        query = `SELECT id, reward_gp FROM daily_ops
                 WHERE id = $1 AND wallet_address = $2 AND ops_date = $3
                   AND completed = TRUE AND reward_claimed = FALSE
                 FOR UPDATE`;
        params = [mission_id, wallet, today];
      } else {
        query = `SELECT id, reward_gp FROM daily_ops
                 WHERE wallet_address = $1 AND ops_date = $2
                   AND completed = TRUE AND reward_claimed = FALSE
                 FOR UPDATE`;
        params = [wallet, today];
      }

      const { rows: claimable } = await client.query(query, params);
      if (claimable.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'NO_CLAIMABLE_MISSIONS' });
      }

      const totalGP = claimable.reduce((s, r) => s + r.reward_gp, 0);
      const ids = claimable.map(r => r.id);

      // 미션 수령 처리
      await client.query(
        `UPDATE daily_ops SET reward_claimed = TRUE, claimed_at = NOW()
         WHERE id = ANY($1)`,
        [ids]
      );

      // GP 지급
      await client.query(
        `UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = $2`,
        [totalGP, wallet]
      );

      await client.query('COMMIT');

      // GP 활동 로그 (fire-and-forget)
      try {
        const { logGPActivity } = require('../db');
        logGPActivity(wallet, totalGP, 'daily_ops_reward', `Daily OPS 보상 ${ids.length}개 수령`).catch(() => {});
      } catch (_) {}

      res.json({ success: true, claimed_count: ids.length, total_gp: totalGP });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[dailyOps] claim error:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ── 주간 이벤트 헬퍼 ─────────────────────────────────────────
function getTodayWeeklyEvent() {
  const dow = new Date().getUTCDay();
  const events = {
    1: { type: 'mining_bonus',    multiplier: 1.5, label_en: 'Mining Bonus +50%', label_ko: '채굴 보너스 +50%', icon: '⛏' },
    3: { type: 'battle_gp_boost', multiplier: 1.3, label_en: 'Battle GP +30%',    label_ko: '전투 GP +30%',    icon: '⚔' },
    5: { type: 'upgrade_discount',multiplier: 0.8, label_en: 'Upgrade Cost -20%', label_ko: '강화 비용 -20%',  icon: '🔧' },
    6: { type: 'double_bounty',   multiplier: 2.0, label_en: 'Double Bounty',     label_ko: '현상금 2배',      icon: '💰' },
  };
  return events[dow] || null;
}

module.exports = router;
module.exports.notifyMissionProgress = async function(wallet, missionType) {
  if (!wallet || !missionType) return;
  try {
    await pool.query(
      `UPDATE daily_ops
       SET current_count = LEAST(target_count, current_count + 1),
           completed = CASE WHEN LEAST(target_count, current_count + 1) >= target_count THEN TRUE ELSE completed END,
           completed_at = CASE WHEN LEAST(target_count, current_count + 1) >= target_count AND completed = FALSE THEN NOW() ELSE completed_at END
       WHERE wallet_address = $1 AND ops_date = CURRENT_DATE AND mission_type = $2 AND completed = FALSE`,
      [wallet.toLowerCase(), missionType]
    );
  } catch (_) {}
};
