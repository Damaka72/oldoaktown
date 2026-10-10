/**
 * Agent Data API — Old Oak Town
 *
 * Reads the latest output from all 5 agents and returns a
 * consolidated JSON payload for the admin dashboard.
 *
 * GET  /api/agent-data            → returns all agent data
 * POST /api/agent-data            → { action: 'notify' } sends a summary email
 *
 * Auth: requires ADMIN_PASSWORD in request body (POST) or
 *       Authorization: Bearer <ADMIN_PASSWORD> header (GET)
 */

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const DATA_DIR = path.join(process.cwd(), 'data');

// ── helpers ───────────────────────────────────────────────────────────────────

function latestFile(dir, pattern) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter(f => pattern ? pattern.test(f) : f.endsWith('.json'))
    .sort()
    .reverse();
  return files[0] ? path.join(dir, files[0]) : null;
}

function readJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

function readAllJson(dir, pattern) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => pattern ? pattern.test(f) : f.endsWith('.json'))
    .sort().reverse()
    .map(f => readJson(path.join(dir, f)))
    .filter(Boolean);
}

function checkAuth(req) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return true; // not configured — skip check in dev
  const authHeader = req.headers['authorization'] || '';
  const bearer = authHeader.replace('Bearer ', '');
  return bearer === password;
}

// ── data loaders ──────────────────────────────────────────────────────────────

function getCuratorData() {
  const file = latestFile(path.join(DATA_DIR, 'curator-digest'), /\.json$/);
  const data = readJson(file);
  return {
    lastRun: data?.generatedAt || null,
    date: data?.date || null,
    stats: data?.stats || null,
    topPicks: data?.topPicks || [],
    skipped: data?.skipped || [],
    status: data ? (data.stats?.topPicks > 0 ? 'ok' : 'empty') : 'never_run',
  };
}

function getNewsletterData() {
  const draftsDir = path.join(DATA_DIR, 'drafts');
  if (!fs.existsSync(draftsDir)) return { status: 'never_run', drafts: [] };
  const drafts = fs.readdirSync(draftsDir)
    .filter(f => /newsletter-.*\.html$/.test(f))
    .sort().reverse()
    .map(f => ({
      filename: f,
      date: f.replace('newsletter-', '').replace('.html', ''),
      size: fs.statSync(path.join(draftsDir, f)).size,
    }));
  return {
    status: drafts.length > 0 ? 'ok' : 'never_run',
    latestDate: drafts[0]?.date || null,
    drafts: drafts.slice(0, 5),
  };
}

function getBusinessReviewData() {
  const reviewDir = path.join(DATA_DIR, 'business-review');
  const cards = readAllJson(reviewDir, /review\.json$/);
  const byRecommendation = { approve: [], request_info: [], reject: [] };
  cards.forEach(c => {
    const key = c.aiRecommendation;
    if (byRecommendation[key]) byRecommendation[key].push(c);
  });
  return {
    status: cards.length > 0 ? 'ok' : 'never_run',
    total: cards.length,
    approve: byRecommendation.approve.length,
    requestInfo: byRecommendation.request_info.length,
    reject: byRecommendation.reject.length,
    cards: cards.slice(0, 20),
  };
}

function getSeoData() {
  const file = latestFile(path.join(DATA_DIR, 'reports'), /^seo-gap-.*\.json$/);
  const data = readJson(file);
  return {
    status: data ? (data.gaps?.length > 0 ? 'warning' : 'ok') : 'never_run',
    date: data?.date || null,
    totalPublished: data?.totalPublished || 0,
    gaps: data?.gaps || [],
    briefs: data?.briefs || [],
    topicsOnTrack: data?.topicsOnTrack || 0,
  };
}

function getHealthData() {
  const file = latestFile(path.join(DATA_DIR, 'reports'), /^health-.*\.json$/);
  const data = readJson(file);
  return {
    status: data
      ? (data.criticalDown?.length > 0 ? 'error' : data.warnings > 0 ? 'warning' : 'ok')
      : 'never_run',
    date: data?.date || null,
    siteUrl: data?.siteUrl || null,
    pagesOk: data?.pagesOk || 0,
    warnings: data?.warnings || 0,
    criticalDown: data?.criticalDown || [],
    pages: data?.pages || [],
    endpoints: data?.endpoints || [],
  };
}

// ── email notification ────────────────────────────────────────────────────────

async function sendNotificationEmail(payload) {
  const { curator, newsletter, businessReview, seo, health } = payload;

  const statusEmoji = { ok: '🟢', warning: '🟡', error: '🔴', never_run: '⚪', empty: '⚪' };
  const overallStatuses = [curator.status, newsletter.status, businessReview.status, seo.status, health.status];
  const hasError = overallStatuses.includes('error');
  const hasWarning = overallStatuses.includes('warning');
  const overallEmoji = hasError ? '🚨' : hasWarning ? '⚠️' : '✅';

  const rows = [
    { name: 'Content Curator', status: curator.status, detail: curator.stats ? `${curator.stats.topPicks} top picks from ${curator.stats.totalInQueue} articles` : 'No data' },
    { name: 'Newsletter Drafter', status: newsletter.status, detail: newsletter.latestDate ? `Latest draft: ${newsletter.latestDate}` : 'No drafts yet' },
    { name: 'Business Manager', status: businessReview.status, detail: `${businessReview.total} reviews — ${businessReview.approve} approve, ${businessReview.requestInfo} need info, ${businessReview.reject} reject` },
    { name: 'SEO Gap Finder', status: seo.status, detail: seo.date ? `${seo.gaps.length} gaps found, ${seo.topicsOnTrack} on track` : 'No data' },
    { name: 'Site Health', status: health.status, detail: health.date ? `${health.pagesOk}/${health.pages.length} pages OK, ${health.warnings} warnings` : 'No data' },
  ].map(r =>
    `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eee">${statusEmoji[r.status]} ${r.name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#6B7B5E">${r.detail}</td>
    </tr>`
  ).join('');

  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await t.sendMail({
    from: `"Old Oak Town Bot" <${process.env.SMTP_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `${overallEmoji} Old Oak Town — Agent Status Summary`,
    html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto">
<div style="background:#1C3A0E;color:white;padding:24px;border-radius:8px 8px 0 0">
  <h1 style="margin:0;font-size:20px">🌳 Old Oak Town — Agent Status</h1>
  <p style="color:#D4E8C8;margin:4px 0;font-size:14px">${new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</p>
</div>
<div style="background:white;padding:24px">
  <table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:#F0F7EB">
      <th style="padding:10px 12px;text-align:left;font-size:13px">Agent</th>
      <th style="padding:10px 12px;text-align:left;font-size:13px">Status</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${health.criticalDown?.length > 0 ? `<div style="margin-top:16px;padding:12px 16px;background:#f8d7da;border-radius:6px;color:#721c24"><strong>🚨 Critical:</strong> ${health.criticalDown.join(', ')} down</div>` : ''}
  ${seo.gaps?.filter(g => g.urgent).length > 0 ? `<div style="margin-top:12px;padding:12px 16px;background:#fff3cd;border-radius:6px;color:#856404"><strong>⚠️ Overdue:</strong> ${seo.gaps.filter(g => g.urgent).map(g => g.topic).join(', ')}</div>` : ''}
  <div style="margin-top:24px;text-align:center">
    <a href="${process.env.SITE_URL || 'https://www.oldoaktown.co.uk'}/admin/" style="background:#1C3A0E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Open Admin Dashboard →</a>
  </div>
</div>
</div>`,
  });
}

// ── handler ───────────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (!checkAuth(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    curator: getCuratorData(),
    newsletter: getNewsletterData(),
    businessReview: getBusinessReviewData(),
    seo: getSeoData(),
    health: getHealthData(),
  };

  if (req.method === 'POST') {
    let body = {};
    try {
      const raw = await new Promise(resolve => {
        let d = '';
        req.on('data', c => { d += c; });
        req.on('end', () => resolve(d));
      });
      body = JSON.parse(raw || '{}');
    } catch {}

    if (body.action === 'notify') {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.ADMIN_EMAIL) {
        res.status(400).json({ error: 'SMTP not configured' });
        return;
      }
      await sendNotificationEmail(payload);
      res.status(200).json({ ok: true, message: 'Notification sent' });
      return;
    }
  }

  res.status(200).json(payload);
};
