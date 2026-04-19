/**
 * SEO Gap Finder Agent — Old Oak Town
 *
 * Analyses published content against target keyword groups.
 * Identifies topics not covered recently, generates article briefs
 * with Claude, and emails a weekly content plan.
 *
 * Run: node scripts/seo-gap-finder.js
 * Schedule: Sundays at 8 AM UTC
 */

const Anthropic = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PUBLISHED_DIR = path.join(__dirname, '../data/published/news');
const REPORTS_DIR = path.join(__dirname, '../data/reports');

const KEYWORD_TARGETS = [
  { topic: 'HS2 construction progress',   keywords: ['hs2', 'construction', 'station', 'platform', 'tunnelling'], pillar: 1, targetDays: 14 },
  { topic: 'OPDC planning decisions',      keywords: ['opdc', 'planning', 'masterplan', 'application', 'consent'], pillar: 1, targetDays: 21 },
  { topic: 'Housing development updates',  keywords: ['housing', 'homes', 'residential', 'development', 'build'],  pillar: 1, targetDays: 21 },
  { topic: 'Transport & Elizabeth Line',   keywords: ['elizabeth line', 'transport', 'tfl', 'crossrail', 'westbourne park'], pillar: 1, targetDays: 30 },
  { topic: 'Old Oak community events',     keywords: ['event', 'community', 'consultation', 'meeting', 'forum'],  pillar: 2, targetDays: 14 },
  { topic: 'Local business spotlights',    keywords: ['business', 'local', 'restaurant', 'shop', 'cafe'],         pillar: 2, targetDays: 21 },
  { topic: 'Living in Old Oak guides',     keywords: ['guide', 'living', 'area', 'park royal', 'acton'],          pillar: 2, targetDays: 30 },
  { topic: 'HS2 delay & budget analysis',  keywords: ['delay', 'budget', 'overspend', '2039', 'timeline'],        pillar: 3, targetDays: 60 },
  { topic: 'Property & housing market',    keywords: ['property', 'price', 'market', 'rent', 'landlord'],         pillar: 2, targetDays: 30 },
  { topic: 'Jobs & employment',            keywords: ['jobs', 'employment', 'careers', 'opportunity', 'workforce'], pillar: 1, targetDays: 30 },
];

function getPublishedArticles() {
  if (!fs.existsSync(PUBLISHED_DIR)) return [];
  return fs.readdirSync(PUBLISHED_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => { try { return JSON.parse(fs.readFileSync(path.join(PUBLISHED_DIR, f), 'utf8')); } catch { return null; } })
    .filter(Boolean);
}

function findGaps(articles) {
  const now = Date.now();
  const gaps = [];
  for (const target of KEYWORD_TARGETS) {
    const matching = articles.filter(a => {
      const text = `${a.title} ${a.content || ''} ${(a.tags || []).join(' ')}`.toLowerCase();
      return target.keywords.some(kw => text.includes(kw));
    });
    if (matching.length === 0) {
      gaps.push({ ...target, lastCovered: null, daysSince: Infinity, urgent: true });
      continue;
    }
    const recent = matching.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate))[0];
    const daysSince = Math.floor((now - new Date(recent.publishDate).getTime()) / 86400000);
    if (daysSince > target.targetDays) {
      gaps.push({ ...target, lastCovered: recent.publishDate, daysSince, urgent: daysSince > target.targetDays * 2 });
    }
  }
  return gaps.sort((a, b) => b.daysSince - a.daysSince);
}

async function generateBriefs(gaps) {
  if (gaps.length === 0) return [];
  const gapList = gaps.slice(0, 5).map((g, i) =>
    `${i + 1}. "${g.topic}" (Pillar ${g.pillar}) — ${g.daysSince === Infinity ? 'Never covered' : `${g.daysSince} days since last article`}`
  ).join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: 'You are a sharp editorial director. Respond with valid JSON array only, no markdown.',
    messages: [{
      role: 'user',
      content: `You are editorial director of Old Oak Town — hyperlocal news for Old Oak Common regeneration, West London (25,500 homes, 65,000 jobs, HS2 super-hub). Audience: young (39% 20–39), diverse residents and property buyers.

Overdue topics:
${gapList}

For each, suggest a specific article. Return JSON array:
[{
  "topic": "exact topic name",
  "title": "SEO-friendly title under 65 chars",
  "angle": "unique local angle for Old Oak residents (1 sentence)",
  "outline": ["point 1", "point 2", "point 3"],
  "targetKeywords": ["kw1", "kw2", "kw3"],
  "estimatedWords": 800,
  "pillar": 1
}]

Reference real specifics: HS2, OPDC, the 25,500 homes, 65,000 jobs, Elizabeth line, Park Royal, Harlesden. No generic content.`
    }],
  });
  try { return JSON.parse(response.content[0].text.trim()); }
  catch { return []; }
}

async function sendReport(report) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.ADMIN_EMAIL) return;
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const gapsHtml = report.gaps.map(g =>
    `<tr style="background:${g.urgent ? '#fff3cd' : 'white'}">
      <td style="padding:8px;border-bottom:1px solid #eee">${g.urgent ? '🔴' : '🟡'} ${g.topic}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">Pillar ${g.pillar}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${g.daysSince === Infinity ? 'Never' : `${g.daysSince}d ago`}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${g.targetDays}d target</td>
    </tr>`
  ).join('');

  const briefsHtml = report.briefs.map(b =>
    `<div style="border:1px solid #DDE8D4;border-radius:8px;padding:16px;margin:12px 0;background:#F0F7EB">
      <h3 style="margin:0 0 8px;color:#1C3A0E">${b.title}</h3>
      <p style="margin:0 0 8px;color:#6B7B5E"><em>${b.angle}</em></p>
      <ul>${b.outline.map(o => `<li>${o}</li>`).join('')}</ul>
      <p style="font-size:13px"><strong>Keywords:</strong> ${b.targetKeywords.join(', ')} · ~${b.estimatedWords}w · Pillar ${b.pillar}</p>
    </div>`
  ).join('');

  await t.sendMail({
    from: `"Old Oak Town Bot" <${process.env.SMTP_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `📊 SEO Gap Report — ${report.gaps.length} topic${report.gaps.length !== 1 ? 's' : ''} overdue`,
    html: `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto">
<div style="background:#1C3A0E;color:white;padding:24px;border-radius:8px 8px 0 0">
  <h1 style="margin:0;font-size:20px">🌳 Old Oak Town — SEO Gap Report</h1>
  <p style="color:#D4E8C8;margin:4px 0">${report.date}</p>
</div>
<div style="padding:24px;background:white">
  <h2>Content Gaps (${report.gaps.length} overdue)</h2>
  <table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:#F0F7EB">
      <th style="padding:8px;text-align:left">Topic</th>
      <th style="padding:8px">Pillar</th>
      <th style="padding:8px">Last Covered</th>
      <th style="padding:8px">Target</th>
    </tr></thead>
    <tbody>${gapsHtml}</tbody>
  </table>
  <h2 style="margin-top:32px">Article Briefs (write these this week)</h2>
  ${briefsHtml || '<p>No gaps this week — great work!</p>'}
  <p style="color:#6B7B5E;font-size:13px">
    Total published: ${report.totalPublished} · On track: ${report.topicsOnTrack}/${KEYWORD_TARGETS.length}
  </p>
</div></div>`,
  });
  console.log(`✉️  Report emailed to ${process.env.ADMIN_EMAIL}`);
}

async function main() {
  console.log('🔍 SEO Gap Finder starting...');
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const articles = getPublishedArticles();
  console.log(`📚 Analysing ${articles.length} published articles`);
  const gaps = findGaps(articles);
  console.log(`⚠️  ${gaps.length} content gap(s) found`);

  let briefs = [];
  if (gaps.length > 0) {
    console.log('💡 Generating briefs with Claude...');
    briefs = await generateBriefs(gaps);
  }

  const today = new Date().toISOString().split('T')[0];
  const report = {
    date: today,
    totalPublished: articles.length,
    gaps,
    briefs,
    topicsOnTrack: KEYWORD_TARGETS.length - gaps.length,
  };

  fs.writeFileSync(path.join(REPORTS_DIR, `seo-gap-${today}.json`), JSON.stringify(report, null, 2));

  const md = [
    `# SEO Gap Report — ${today}`, '',
    `**Published:** ${articles.length} · **On track:** ${report.topicsOnTrack}/${KEYWORD_TARGETS.length} · **Gaps:** ${gaps.length}`, '',
    '## Overdue Topics',
    ...gaps.map(g => `- **${g.topic}** (Pillar ${g.pillar}) — ${g.daysSince === Infinity ? 'Never covered' : `${g.daysSince}d`} ${g.urgent ? '🔴' : '🟡'}`), '',
    '## Article Briefs',
    ...briefs.flatMap(b => [
      `### ${b.title}`, `*${b.angle}*`,
      b.outline.map(o => `- ${o}`).join('\n'),
      `**Keywords:** ${b.targetKeywords.join(', ')} · ~${b.estimatedWords}w · Pillar ${b.pillar}`, '',
    ]),
  ].join('\n');
  fs.writeFileSync(path.join(REPORTS_DIR, `seo-gap-${today}.md`), md);

  await sendReport(report);
  console.log('\n✅ SEO Gap Finder complete');
}

main().catch(err => { console.error('❌ Fatal error:', err); process.exit(1); });
