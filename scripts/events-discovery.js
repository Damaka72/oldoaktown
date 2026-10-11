/**
 * Events Discovery — Old Oak Town
 *
 * Finds upcoming local events and merges them into data/events.json, which
 * the site's events calendar reads. No AI is involved: events come from
 * structured data (schema.org JSON-LD) published by the event platform, and are
 * kept only if the venue's coordinates fall within RADIUS_KM of Old Oak Common.
 * Every event links back to its source page. Nothing is invented.
 *
 * Hand-entered events in events.json are never modified or removed.
 *
 * Run: node scripts/events-discovery.js
 * Schedule: Daily via GitHub Actions
 */

const fs = require('fs');
const path = require('path');

const EVENTS_FILE = path.join(__dirname, '../data/events.json');

// Old Oak Common station
const CENTRE = { lat: 51.5273, lon: -0.2437 };
const RADIUS_KM = 3.0;
const LOOKAHEAD_DAYS = 90;
const MAX_AUTO_EVENTS = 30;

const AREA_SLUGS = [
  'old-oak-common', 'park-royal', 'harlesden', 'acton',
  'willesden', 'wormwood-scrubs', 'north-acton', 'kensal-green',
];
const SEARCH_URLS = AREA_SLUGS.map(
  s => `https://www.eventbrite.co.uk/d/united-kingdom--london/${s}/`
);

function haversineKm(a, b) {
  const rad = d => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function categorise(text) {
  const t = text.toLowerCase();
  if (/(consultation|have your say|public meeting|planning|opdc|hs2|drop-in|drop in)/.test(t)) return 'consultation';
  if (/(network|business|enterprise|careers?|jobs?|workshop|training)/.test(t)) return 'networking';
  if (/(tour|walk|heritage|open house|site visit)/.test(t)) return 'tour';
  return 'community';
}

// Keep civic, cultural and community events; drop commercial classes, clinics
// and wellness sessions that are merely nearby.
const WANTED = /(consultation|have your say|public meeting|town hall|planning|opdc|hs2|regeneration|community|neighbourhood|resident|council|library|festival|carnival|market|fair\b|exhibition|gallery|talk\b|lecture|screening|film|tour|walk\b|heritage|history|open day|open house|volunteer|litter|clean-?up|garden|allotment|jobs? fair|careers|business (forum|network)|youth|concert|gig|live music|theatre|comedy)/i;
const UNWANTED = /(nail|beauty|massage|therapy|clinic|meditation|healing|hypno|yoga|pilates|course\b|class(es)?\b|lesson|tutorial|bootcamp|certification|exam\b|seminar for|webinar|networking breakfast|sales|mlm|crypto|forex|speed dating|singles|party|club night|rave|nightlife|sip & paint|paint night|dj set|18+)/i;

function isWantedEvent(title, description) {
  const text = `${title} ${description}`;
  return WANTED.test(text) && !UNWANTED.test(title);
}

// Third-party text is rendered with innerHTML by the calendar page, so strip markup.
const plain = v => String(v == null ? '' : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();

function normTitle(t) {
  return String(t).toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseJsonLdEvents(html) {
  const out = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  for (const m of html.matchAll(re)) {
    let data;
    try { data = JSON.parse(m[1]); } catch { continue; }
    for (const block of Array.isArray(data) ? data : [data]) {
      for (const el of block.itemListElement || []) {
        const item = el.item || el;
        if (item && item['@type'] === 'Event') out.push(item);
      }
    }
  }
  return out;
}

function toEvent(item) {
  const loc = item.location || {};
  const geo = loc.geo || {};
  const lat = parseFloat(geo.latitude);
  const lon = parseFloat(geo.longitude);
  if (isNaN(lat) || isNaN(lon)) return null;                  // online / unlocatable
  if (haversineKm(CENTRE, { lat, lon }) > RADIUS_KM) return null;

  const start = String(item.startDate || '');
  const date = start.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const timeOf = s => (/T(\d{2}:\d{2})/.exec(String(s || '')) || [])[1] || null;

  const addr = loc.address || {};
  const address = [addr.streetAddress, addr.addressLocality, addr.postalCode]
    .filter(Boolean).join(', ');
  const idMatch = /(\d{6,})\/?(?:\?.*)?$/.exec(item.url || '');
  const description = plain(item.description).slice(0, 220);
  if (!isWantedEvent(String(item.name || ''), description)) return null;

  return {
    id: `eb-${idMatch ? idMatch[1] : normTitle(item.name).replace(/ /g, '-') + '-' + date}`,
    title: plain(item.name),
    date,
    startTime: timeOf(item.startDate),
    endTime: timeOf(item.endDate),
    location: { name: plain(loc.name), address: plain(address) },
    description,
    category: categorise(`${item.name} ${description}`),
    registrationUrl: item.url || '',
    sourceUrl: item.url || '',
    status: 'upcoming',
    source: 'auto-eventbrite',
  };
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OldOakTownBot/1.0; +https://oldoaktown.co.uk)' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const existing = fs.existsSync(EVENTS_FILE)
    ? JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'))
    : { events: [] };
  const all = existing.events || [];

  const manual = all.filter(e => e.source !== 'auto-eventbrite');
  const previousAuto = all.filter(e => e.source === 'auto-eventbrite');

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + LOOKAHEAD_DAYS * 86400000).toISOString().slice(0, 10);

  const found = [];
  let pagesOk = 0;
  for (const url of SEARCH_URLS) {
    try {
      const html = await fetchPage(url);
      const items = parseJsonLdEvents(html);
      pagesOk++;
      console.log(`  ${url.split('/').slice(-2, -1)[0]}: ${items.length} listed`);
      for (const item of items) {
        const ev = toEvent(item);
        if (ev && ev.title && ev.date >= today && ev.date <= horizon) found.push(ev);
      }
    } catch (err) {
      console.error(`  Warning: ${url}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (pagesOk === 0) {
    console.error('No source pages could be read — leaving events.json untouched.');
    return;
  }

  // Dedupe against manual events and within the run (same title+date).
  const seen = new Set(manual.map(e => `${normTitle(e.title)}|${e.date}`));
  const fresh = [];
  for (const ev of found.sort((a, b) => a.date.localeCompare(b.date))) {
    const key = `${normTitle(ev.title)}|${ev.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(ev);
  }
  const auto = fresh.slice(0, MAX_AUTO_EVENTS);

  const merged = [...manual, ...auto].sort((a, b) => a.date.localeCompare(b.date));
  const before = previousAuto.map(e => e.id).sort().join();
  const after = auto.map(e => e.id).sort().join();
  if (before === after) { console.log('No change in discovered events.'); return; }

  fs.writeFileSync(EVENTS_FILE, JSON.stringify({ ...existing, events: merged }, null, 2) + '\n');
  console.log(`Events: ${manual.length} manual + ${auto.length} discovered (was ${previousAuto.length}).`);
  auto.slice(0, 8).forEach(e => console.log(`  + ${e.date} ${e.title}`));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
