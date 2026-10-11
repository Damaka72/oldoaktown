/**
 * Weekly Edition Builder — Old Oak Town
 *
 * Assembles "The Old Oak Weekly" from what is already published on the site:
 *   - news     from data/news.json         (last 10 days)
 *   - events   from data/events.json       (next 14 days)
 *   - videos   from data/videos-auto.json  (last 30 days)
 *
 * The Edition is the single source the newsletter (and, later, social posts)
 * are built from, so nothing is written from scratch and nothing is invented.
 * Claude is used only for a short intro and subject line, and is told to use
 * nothing but the supplied headlines; if the API is unavailable a plain
 * template is used instead.
 *
 * Outputs:
 *   data/editions/YYYY-MM-DD.json   structured edition
 *   data/editions/YYYY-MM-DD.html   email-ready newsletter (paste into Beehiiv)
 *   data/editions/latest.json       copy of the newest edition
 *
 * Run: node scripts/weekly-edition.js          (also emails it to ADMIN_EMAIL if SMTP is set)
 *      node scripts/weekly-edition.js --no-email
 * Schedule: Mondays via GitHub Actions (after the daily content jobs).
 */

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '../data');
const OUT_DIR = path.join(DATA, 'editions');
const SITE = process.env.SITE_URL || 'https://oldoaktown.co.uk';

const NEWS_DAYS = 10;
const EVENT_DAYS = 14;
const VIDEO_DAYS = 30;
const MAX_NEWS = 6;
const MAX_EVENTS = 6;
const MAX_VIDEOS = 2;

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isoDay = d => d.toISOString().slice(0, 10);
const niceDate = iso => new Date(iso + 'T12:00:00Z')
  .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function sourceLink(article) {
  const m = /href="([^"]+)"/.exec(article.body || '');
  return m ? m[1] : SITE;
}
function sourceName(article) {
  const m = /Source: <a [^>]*>([^<]+)<\/a>/.exec(article.body || '');
  return m ? m[1] : 'Old Oak Town';
}

function gather(now = new Date()) {
  const today = isoDay(now);
  const since = (days) => isoDay(new Date(now.getTime() - days * 86400000));
  const until = (days) => isoDay(new Date(now.getTime() + days * 86400000));

  const news = (readJson(path.join(DATA, 'news.json'), { articles: [] }).articles || [])
    .filter(a => a.date >= since(NEWS_DAYS) && a.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_NEWS)
    .map(a => ({
      title: a.title,
      excerpt: a.excerpt || '',
      category: a.category || 'News',
      date: a.date,
      source: sourceName(a),
      url: sourceLink(a),
    }));

  const events = (readJson(path.join(DATA, 'events.json'), { events: [] }).events || [])
    .filter(e => e.date >= today && e.date <= until(EVENT_DAYS))
    .sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')))
    .slice(0, MAX_EVENTS)
    .map(e => ({
      title: e.title,
      date: e.date,
      startTime: e.startTime || null,
      venue: (e.location && e.location.name) || '',
      address: (e.location && e.location.address) || '',
      category: e.category || 'community',
      url: e.registrationUrl || e.sourceUrl || SITE,
    }));

  const videos = (readJson(path.join(DATA, 'videos-auto.json'), { videos: [] }).videos || [])
    .filter(v => (v.published || '').slice(0, 10) >= since(VIDEO_DAYS))
    .slice(0, MAX_VIDEOS)
    .map(v => ({ title: v.title, channel: v.channel, url: v.url, published: v.published.slice(0, 10) }));

  return { today, news, events, videos };
}

async function writeIntro(items) {
  const fallback = {
    subject: `The Old Oak Weekly — ${items.news.length} stories, ${items.events.length} events`,
    intro: 'Here is what is happening around Old Oak Common and Park Royal this week: the latest news, upcoming events and videos worth watching.',
  };
  if (!process.env.ANTHROPIC_API_KEY || items.news.length === 0) return fallback;

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const headlines = items.news.map(n => `- ${n.title} (${n.source})`).join('\n');
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: 'You write the opening of a hyperlocal community newsletter for Old Oak Common and Park Royal, West London. Warm, plain, factual. Use ONLY the headlines supplied: never add facts, numbers, names, dates or claims that are not in them.',
      messages: [{
        role: 'user',
        content: `Headlines this week:\n${headlines}\n\nReturn JSON only: {"subject": "<max 60 chars>", "intro": "<2 sentences, max 45 words, no new facts>"}`,
      }],
    });
    const text = res.content[0].text;
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    if (parsed.subject && parsed.intro) {
      return { subject: String(parsed.subject).slice(0, 80), intro: String(parsed.intro).slice(0, 400) };
    }
  } catch (err) {
    console.error(`Intro generation failed, using template: ${err.message}`);
  }
  return fallback;
}

function renderHtml(edition) {
  const { subject, intro, news, events, videos, date } = edition;
  const h2 = t => `<h2 style="font-family:Georgia,serif;font-weight:normal;font-size:22px;color:#1C3A0E;margin:32px 0 12px;border-bottom:2px solid #D4E8C8;padding-bottom:6px">${t}</h2>`;
  const link = (u, t) => `<a href="${esc(u)}" style="color:#2F6020;text-decoration:underline">${t}</a>`;

  const newsHtml = news.length
    ? news.map(n => `
      <div style="margin:0 0 18px">
        <div style="font-size:12px;color:#6B7B5E;text-transform:uppercase;letter-spacing:.04em">${esc(n.category)} · ${esc(niceDate(n.date))}</div>
        <div style="font-size:17px;font-weight:bold;margin:2px 0 4px">${link(n.url, esc(n.title))}</div>
        ${n.excerpt ? `<div style="font-size:15px;color:#0F1A0A">${esc(n.excerpt)}</div>` : ''}
        <div style="font-size:12px;color:#6B7B5E;margin-top:4px">via ${esc(n.source)}</div>
      </div>`).join('')
    : '<p style="color:#6B7B5E">A quiet week for news. We will be back with more soon.</p>';

  const eventsHtml = events.length
    ? events.map(e => `
      <div style="margin:0 0 14px">
        <div style="font-size:12px;color:#6B7B5E">${esc(niceDate(e.date))}${e.startTime ? ' · ' + esc(e.startTime) : ''}</div>
        <div style="font-size:16px;font-weight:bold">${link(e.url, esc(e.title))}</div>
        <div style="font-size:14px;color:#0F1A0A">${esc([e.venue, e.address].filter(Boolean).join(' — '))}</div>
      </div>`).join('')
    : '<p style="color:#6B7B5E">No events listed for the next two weeks. Know of one? Reply and tell us.</p>';

  const videosHtml = videos.length
    ? videos.map(v => `<p style="margin:0 0 10px">▶ ${link(v.url, esc(v.title))} <span style="color:#6B7B5E;font-size:13px">— ${esc(v.channel)}</span></p>`).join('')
    : '';

  return `<!doctype html>
<html><body style="margin:0;background:#FAF8F4;font-family:'DM Sans',Arial,sans-serif;color:#0F1A0A">
<div style="max-width:620px;margin:0 auto;background:#ffffff">
  <div style="background:#1C3A0E;color:#ffffff;padding:24px 28px">
    <div style="font-family:Georgia,serif;font-style:italic;font-size:28px">The Old Oak Weekly</div>
    <div style="font-size:13px;color:#D4E8C8;margin-top:4px">Old Oak Common &amp; Park Royal · ${esc(niceDate(date))}</div>
  </div>
  <div style="padding:24px 28px">
    <p style="font-size:16px;line-height:1.5;margin:0">${esc(intro)}</p>
    ${h2('The week in news')}${newsHtml}
    ${h2('What’s on')}${eventsHtml}
    ${videos.length ? h2('Worth watching') + videosHtml : ''}
    <p style="margin:32px 0 0;font-size:14px">${link(SITE, 'See everything on oldoaktown.co.uk')}</p>
  </div>
  <div style="background:#F0F7EB;padding:16px 28px;font-size:12px;color:#6B7B5E">
    Old Oak Town curates local news, events and video from public sources and links back to the original publisher. Subject: ${esc(subject)}
  </div>
</div>
</body></html>`;
}

async function emailAdmin(edition, html) {
  const { SMTP_USER, SMTP_PASS, ADMIN_EMAIL } = process.env;
  if (!SMTP_USER || !SMTP_PASS || !ADMIN_EMAIL) {
    console.log('SMTP not configured — skipping email.');
    return;
  }
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  const banner = `<div style="background:#FFF4DC;border:1px solid #D4860A;padding:12px 16px;margin:0 0 16px;font-family:Arial,sans-serif;font-size:14px">
    <b>Ready to send.</b> Built automatically from this week's published news, events and videos.
    To send: open Beehiiv &rarr; New post &rarr; paste this email body (or use the attached HTML) &rarr; Send.
    Subject: <b>${esc(edition.subject)}</b></div>`;
  await transporter.sendMail({
    from: `"Old Oak Town Content System" <${SMTP_USER}>`,
    to: ADMIN_EMAIL,
    subject: `[READY TO SEND] ${edition.subject}`,
    html: banner + html,
    attachments: [{ filename: `old-oak-weekly-${edition.date}.html`, content: html, contentType: 'text/html' }],
  });
  console.log(`Edition emailed to ${ADMIN_EMAIL}`);
}

async function main() {
  const noEmail = process.argv.includes('--no-email');
  const items = gather();
  console.log(`Gathered: ${items.news.length} news, ${items.events.length} events, ${items.videos.length} videos`);

  if (items.news.length + items.events.length + items.videos.length === 0) {
    console.log('Nothing new to include this week — no edition built.');
    return;
  }

  const { subject, intro } = await writeIntro(items);
  const edition = {
    date: items.today,
    generatedAt: new Date().toISOString(),
    subject,
    intro,
    news: items.news,
    events: items.events,
    videos: items.videos,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const html = renderHtml(edition);
  fs.writeFileSync(path.join(OUT_DIR, `${edition.date}.json`), JSON.stringify(edition, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT_DIR, `${edition.date}.html`), html);
  fs.writeFileSync(path.join(OUT_DIR, 'latest.json'), JSON.stringify(edition, null, 2) + '\n');
  console.log(`Edition saved: data/editions/${edition.date}.{json,html}`);
  console.log(`Subject: ${subject}`);

  if (!noEmail) await emailAdmin(edition, html);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
