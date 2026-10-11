/**
 * Video Discovery — Old Oak Town
 *
 * Finds new, relevant videos from trusted YouTube channels using their public
 * Atom feeds (no API key) and writes them to data/videos-auto.json. The
 * /api/videos endpoint merges that file with the hand-curated Supabase list.
 * We only embed and link to the original video — nothing is re-hosted.
 *
 * Run: node scripts/video-discovery.js
 * Schedule: Daily via GitHub Actions
 */

const fs = require('fs');
const path = require('path');

const OUT_FILE = path.join(__dirname, '../data/videos-auto.json');
const MAX_AGE_DAYS = 120;
const MAX_VIDEOS = 12;

// Add channels here. `mustMention` keeps only videos about our area.
const CHANNELS = [
  {
    name: 'HS2 Ltd',
    channelId: 'UCssLfNvVfiBx2D1S0jfnI6A',
    tags: 'HS2, Construction',
    mustMention: ['old oak', 'park royal', 'west london', 'euston', 'northolt', 'london tunnel',
                  'ruislip', 'acton', 'atlas road'],
  },
  {
    name: 'Transport for London',
    channelId: 'UCnJTG6F5aVLUyoje6Q-TGlg',
    tags: 'Transport, TfL',
    mustMention: ['old oak', 'park royal', 'hs2'],
  },
  {
    name: 'Mayor of London',
    channelId: 'UC8O5Q4cvxnBoNL7L_YYO3mw',
    tags: 'Regeneration, London',
    mustMention: ['old oak', 'park royal', 'opdc'],
  },
];

const decode = s => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
const pick = (xml, re) => { const m = re.exec(xml); return m ? decode(m[1]).replace(/[<>]/g, '').trim() : ''; };

function parseFeed(xml, channel) {
  const out = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const id = pick(e, /<yt:videoId>([^<]+)<\/yt:videoId>/);
    const title = pick(e, /<title>([\s\S]*?)<\/title>/);
    const published = pick(e, /<published>([^<]+)<\/published>/);
    const description = pick(e, /<media:description>([\s\S]*?)<\/media:description>/);
    if (!id || !title || !published) continue;
    out.push({
      id,
      title,
      description: description.replace(/\s+/g, ' ').slice(0, 220),
      url: `https://www.youtube.com/watch?v=${id}`,
      embed_url: `https://www.youtube.com/embed/${id}`,
      platform: 'youtube',
      tags: channel.tags,
      channel: channel.name,
      published,
      auto: true,
    });
  }
  return out;
}

async function main() {
  const previous = fs.existsSync(OUT_FILE)
    ? (JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')).videos || [])
    : [];
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;

  const found = [];
  let feedsOk = 0;
  for (const ch of CHANNELS) {
    try {
      const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channelId}`, {
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      feedsOk++;
      const vids = parseFeed(await res.text(), ch).filter(v => {
        if (new Date(v.published).getTime() < cutoff) return false;
        if (/#shorts/i.test(v.title)) return false;
        const hay = `${v.title} ${v.description}`.toLowerCase();
        return ch.mustMention.some(k => hay.includes(k));
      });
      console.log(`  ${ch.name}: ${vids.length} relevant`);
      found.push(...vids);
    } catch (err) {
      console.error(`  Warning: ${ch.name}: ${err.message}`);
    }
  }

  if (feedsOk === 0) { console.error('No feeds reachable — leaving file untouched.'); return; }

  const byId = new Map();
  [...found, ...previous].forEach(v => { if (!byId.has(v.id)) byId.set(v.id, v); });
  const videos = [...byId.values()]
    .filter(v => new Date(v.published).getTime() >= cutoff)
    .sort((a, b) => new Date(b.published) - new Date(a.published))
    .slice(0, MAX_VIDEOS);

  const same = JSON.stringify(videos.map(v => v.id)) === JSON.stringify(previous.map(v => v.id));
  if (same) { console.log('No change in discovered videos.'); return; }

  fs.writeFileSync(OUT_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), videos }, null, 2) + '\n');
  console.log(`Videos: ${videos.length} stored.`);
  videos.slice(0, 5).forEach(v => console.log(`  + ${v.published.slice(0, 10)} ${v.title}`));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
