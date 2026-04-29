/**
 * server/routes/bugReport.js — 인게임 버그 리포트 엔드포인트
 * ═══════════════════════════════════════════════════════════════
 *
 * POST /api/bug-report
 *   Body (JSON):
 *     - description  {string}  버그 설명 (필수)
 *     - screenshot   {string?} base64 data URL (optional, png/jpeg)
 *     - context      {object?} 게임 상태 스냅샷 (URL hash, modal 등)
 *     - userAgent    {string?} 브라우저 정보
 *
 *   저장 위치: <project-root>/bug-reports/YYYYMMDD_HHmmss_NNN/
 *     - report.json   — 메타데이터 + 설명
 *     - screenshot.png — 스크린샷 (있는 경우)
 *
 * GET /api/bug-report/list
 *   인증 불필요. 저장된 리포트 목록 반환 (최신순).
 *
 * GET /api/bug-report/:id
 *   특정 리포트 report.json 반환.
 *
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');

// ── 저장 디렉토리 ──────────────────────────────────────────────
const BUG_REPORTS_DIR = path.join(__dirname, '..', '..', 'bug-reports');
if (!fs.existsSync(BUG_REPORTS_DIR)) {
  fs.mkdirSync(BUG_REPORTS_DIR, { recursive: true });
}

// ── 유틸: 중복 없는 디렉토리명 생성 ─────────────────────────────
function makeReportId() {
  const now   = new Date();
  const pad   = n => String(n).padStart(2, '0');
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '_',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');

  // 같은 초에 여러 개 올 경우 suffix 추가
  let id  = stamp;
  let dir = path.join(BUG_REPORTS_DIR, id);
  let n   = 1;
  while (fs.existsSync(dir)) {
    id  = `${stamp}_${String(n).padStart(3, '0')}`;
    dir = path.join(BUG_REPORTS_DIR, id);
    n++;
  }
  return { id, dir };
}

// ── POST /api/bug-report ────────────────────────────────────────
router.post('/bug-report', (req, res) => {
  try {
    const { description, screenshot, context, userAgent } = req.body || {};

    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'description is required' });
    }

    const { id, dir } = makeReportId();
    fs.mkdirSync(dir, { recursive: true });

    // report.json 저장
    const report = {
      id,
      timestamp:   new Date().toISOString(),
      description: description.trim(),
      hasScreenshot: !!screenshot,
      context:     context  || null,
      userAgent:   userAgent || req.headers['user-agent'] || null,
    };
    fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

    // 스크린샷 저장 (base64 data URL → PNG 파일)
    if (screenshot && typeof screenshot === 'string') {
      const match = screenshot.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
      if (match) {
        const ext  = match[1] === 'jpeg' ? 'jpg' : match[1];
        const data = Buffer.from(match[2], 'base64');
        fs.writeFileSync(path.join(dir, `screenshot.${ext}`), data);
        report.screenshotFile = `screenshot.${ext}`;
        // report.json 갱신 (screenshotFile 추가)
        fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ ...report }, null, 2), 'utf8');
      }
    }

    console.log(`[BugReport] 저장됨: ${id} — "${description.slice(0, 80)}"`);
    return res.json({ ok: true, id, dir: `bug-reports/${id}` });

  } catch (e) {
    console.error('[BugReport] 저장 실패:', e.message);
    return res.status(500).json({ error: 'save failed' });
  }
});

// ── GET /api/bug-report/list ────────────────────────────────────
router.get('/bug-report/list', (_req, res) => {
  try {
    if (!fs.existsSync(BUG_REPORTS_DIR)) return res.json([]);

    const dirs = fs.readdirSync(BUG_REPORTS_DIR)
      .filter(d => fs.statSync(path.join(BUG_REPORTS_DIR, d)).isDirectory())
      .sort()
      .reverse(); // 최신순

    const list = dirs.map(d => {
      try {
        const rp = path.join(BUG_REPORTS_DIR, d, 'report.json');
        const r  = JSON.parse(fs.readFileSync(rp, 'utf8'));
        return {
          id:          r.id,
          timestamp:   r.timestamp,
          description: r.description.slice(0, 120),
          hasScreenshot: r.hasScreenshot,
        };
      } catch { return null; }
    }).filter(Boolean);

    return res.json(list);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── GET /api/bug-report/:id ─────────────────────────────────────
router.get('/bug-report/:id', (req, res) => {
  try {
    const dir = path.join(BUG_REPORTS_DIR, req.params.id);
    if (!fs.existsSync(dir)) return res.status(404).json({ error: 'not found' });

    const report = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'));

    // 스크린샷이 있으면 base64로 포함
    if (report.screenshotFile) {
      const imgPath = path.join(dir, report.screenshotFile);
      if (fs.existsSync(imgPath)) {
        const ext    = report.screenshotFile.split('.').pop();
        const mime   = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        report.screenshotBase64 = `data:${mime};base64,${fs.readFileSync(imgPath).toString('base64')}`;
      }
    }

    return res.json(report);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
