/**
 * Site Health Monitor Agent — Old Oak Town
 *
 * Crawls key pages weekly, checks for GA4 presence, meta tags,
 * API endpoint health, and broken markup. Emails a health report.
 *
 * Run: node scripts/site-health-monitor.js
 * Schedule: Saturdays at 7 AM UTC
 */

const nodemailer = require('nodemailer');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '../data/reports');
const SITE_URL = (process.env.SITE_URL || 'https://www.oldoaktown.co.uk').replace(/\/$/, '');

const PAGES = [
  { path: '/',                       name: 'Homepage',          critical: true  },
  { path: '/business-directory.html', name: 'Business Directory', critical: true  },
  { path: '/business-submit.html',   name: 'Business Submit',   critical: true  },
  { path: '/payment-success.html',   name: 'Payment Success',   critical: false },
  { path: '/privacy.html',           name: 'Privacy Policy',    critical: false },
];

const ENDPOINTS = [
  { url: `${SITE_URL}/api/subscribe`,        name: 'Newsletter Subscribe'  },
  { url: `${SITE_URL}/api/submit-business`,  name: 'Business Submit API'   },
  { url: `${SITE_URL}/api/get-ticker-news`,  name: 'Ticker News API'       },
];

function fetchUrl(url, method = 'GET') {
  return new Promise(resolve => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method, timeout: 12000 }, res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body, ok: res.statusCode < 400 }));
    });
    req.on('error', err => resolve({ status: 0, body: '', ok: false, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '', ok: false, error: 'Timeout' }); });
    req.end();
  });
}

function auditPage(html) {
  return [
    {
      check: 'Google Analytics 4',
      pass: /G-[A-Z0-9]+/.test(html) && (html.includes('gtag') || html.includes('googletagmanager')),
      severity: 'warning',
      fix: 'Add GA4 tracking code (see NEXT_STEPS.md)',
    },
    {
      check: 'Meta description',
      pass: /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i.test(html),
      severity: 'warning',
      fix: 'Add <meta name="description"> with 20+ chars',
    },
    {
      check: 'Open Graph tags',
      pass: html.includes('og:title'),
      severity: 'warning',
      fix: 'Add og:title, og:description, og:image tags',
    },
    {
      check: 'Canonical URL',
      pass: html.includes('rel="canonical"'),
      severity: 'info',
      fix: 'Add <link rel="canonical" href="..."> tag',
    },
    {
      check: 'No empty img src',
      pass: !/src=["']["']/.test(html),
      severity: 'error',
      fix: 'Fix empty src="" attributes on <img> tags',
    },
    {
      check: 'Viewport meta',
      pass: html.includes('viewport'),
      severity: 'warning',
      fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
    },
  ];
}

async function checkPages() {
  const results = [];
  for (const page of PAGES) {
    const url = `${SITE_URL}${page.path}`;
    console.log(`  📄 ${page.name}...`);
    const res = await fetchUrl(url);
    const checks = res.ok ? auditPage(res.body) : [];
    const failed = checks.filter(c => !c.pass);
    const status = !res.ok ? 'down'
      : failed.some(c => c.severity === 'error') ? 'error'
      : failed.some(c => c.severity === 'warning') ? 'warning'
      : 'ok';
    results.push({ name: page.name, url, critical: page.critical, httpStatus: res.status, status, checks, failedChecks: failed });
    await new Promise(r => setTimeout(r, 600));
  }
  return results;
}

async function checkEndpoints() {
  const results = [];
  for (const ep of ENDPOINTS) {
    console.log(`  📡 ${ep.name}...`);
    const res = await fetchUrl(ep.url, 'OPTIONS');
    // 405 = endpoint exists but OPTIONS not allowed — still up
    const ok = res.ok || res.status === 405;
    results.push({ name: ep.name, url: ep.url, status: ok ? 'ok' : 'down', httpStatus: res.status, error: res.error });
    await new Promise(r => setTimeout(r, 600));
  }
  return results;
}

async function sendReport(report) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.ADMIN_EMAIL) return;
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const si = { ok: '🟢', warning: '🟡', error: '🔴', down: '🔴' };
  const overall = report.criticalDown.length > 0 ? '🚨' : report.warnings > 0 ? '⚠️' : '✅';

  const pagesHtml = report.pages.map(p =>
    `<div style="border:1px solid #ddd;border-radius:6px;padding:12px;margin:8px 0;background:${p.status === 'ok' ? '#f0f7eb' : p.status === 'warning' ? '#fff3cd' : '#f8d7da'}">
      <strong>${si[p.status]} ${p.name}</strong>
      <span style="color:#666;font-size:13px"> — HTTP ${p.httpStatus}</span>
      ${p.failedChecks.length ? `<ul style="margin:6px 0 0;font-size:13px">${p.failedChecks.map(c => `<li>${c.check}: ${c.fix}</li>`).join('')}</ul>` : ''}
    </div>`
  ).join('');

  const epHtml = report.endpoints.map(e =>
    `<div style="padding:8px;border-bottom:1px solid #eee">
      ${si[e.status]} <strong>${e.name}</strong>
      <span style="color:#666;font-size:13px"> ${e.url}</span>
      ${e.error ? `<span style="color:#dc3545;font-size:13px"> — ${e.error}</span>` : ''}
    </div>`
  ).join('');

  await t.sendMail({
    from: `"Old Oak Town Bot" <${process.env.SMTP_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `${overall} Site Health — ${report.date} — ${report.criticalDown.length > 0 ? 'CRITICAL ISSUES' : `${report.warnings} warning(s)`}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto">
<div style="background:#1C3A0E;color:white;padding:24px;border-radius:8px 8px 0 0">
  <h1 style="margin:0;font-size:20px">🌳 Old Oak Town — Site Health</h1>
  <p style="color:#D4E8C8;margin:4px 0">${report.date}</p>
</div>
<div style="padding:24px;background:white">
  <div style="display:flex;gap:12px;margin-bottom:24px">
    <div style="flex:1;text-align:center;padding:16px;background:#f0f7eb;border-radius:8px">
      <div style="font-size:28px;font-weight:bold;color:#1C3A0E">${report.pagesOk}/${report.pages.length}</div>
      <div style="color:#6B7B5E">Pages OK</div>
    </div>
    <div style="flex:1;text-align:center;padding:16px;background:${report.warnings > 0 ? '#fff3cd' : '#f0f7eb'};border-radius:8px">
      <div style="font-size:28px;font-weight:bold;color:#D4860A">${report.warnings}</div>
      <div style="color:#6B7B5E">Warnings</div>
    </div>
    <div style="flex:1;text-align:center;padding:16px;background:${report.criticalDown.length > 0 ? '#f8d7da' : '#f0f7eb'};border-radius:8px">
      <div style="font-size:28px;font-weight:bold;color:#C0392B">${report.criticalDown.length}</div>
      <div style="color:#6B7B5E">Critical Down</div>
    </div>
  </div>
  <h2>Pages</h2>${pagesHtml}
  <h2>API Endpoints</h2>${epHtml}
</div></div>`,
  });
  console.log(`✉️  Health report emailed to ${process.env.ADMIN_EMAIL}`);
}

async function main() {
  console.log(`🏥 Site Health Monitor starting... (${SITE_URL})\n`);
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  console.log('📄 Checking pages...');
  const pages = await checkPages();
  console.log('\n📡 Checking endpoints...');
  const endpoints = await checkEndpoints();

  const warnings = pages.reduce((s, p) => s + p.failedChecks.filter(c => c.severity === 'warning').length, 0);
  const criticalDown = pages.filter(p => p.critical && (p.status === 'down' || p.status === 'error'));
  const pagesOk = pages.filter(p => p.status === 'ok').length;

  const today = new Date().toISOString().split('T')[0];
  const report = { date: today, siteUrl: SITE_URL, pages, endpoints, pagesOk, warnings, criticalDown: criticalDown.map(p => p.name) };

  fs.writeFileSync(path.join(REPORTS_DIR, `health-${today}.json`), JSON.stringify(report, null, 2));

  const summary = criticalDown.length > 0
    ? `🚨 CRITICAL: ${criticalDown.map(p => p.name).join(', ')} down`
    : warnings > 0 ? `⚠️  ${warnings} warning(s) across ${pages.length} pages` : '✅ All clear';

  console.log(`\n${summary}`);
  pages.forEach(p => {
    const icon = { ok: '🟢', warning: '🟡', error: '🔴', down: '🔴' }[p.status];
    console.log(`  ${icon} ${p.name} (HTTP ${p.httpStatus})`);
    p.failedChecks.forEach(c => console.log(`      ↳ ${c.check}: ${c.fix}`));
  });

  await sendReport(report);
  console.log(`\n💾 Report: data/reports/health-${today}.json`);
}

main().catch(err => { console.error('❌ Fatal error:', err); process.exit(1); });
