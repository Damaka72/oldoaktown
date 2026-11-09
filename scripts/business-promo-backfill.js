/**
 * Business Promo Backfill — Old Oak Town
 *
 * Gives every existing directory listing its own "day": one business per
 * weekday, each with a ready-to-review Instagram, Facebook and LinkedIn post.
 * New sign-ups are covered by scripts/business-spotlight-agent.js; this fills
 * the backlog.
 *
 * Trust rules (CLAUDE.md):
 *  - Posts are built from the listing's own fields only — name, address,
 *    description, website. No AI, no invented facts, no claims.
 *  - Output goes to data/review-queue/business-promos/ as pending_review.
 *    Nothing is published or scheduled by this script.
 *  - Independents only: see data/promo-exclusions.json. Paid listings are
 *    always included and go first.
 *
 * Usage:
 *   node scripts/business-promo-backfill.js                       # reads Supabase (SUPABASE_URL + SUPABASE_ANON_KEY)
 *   node scripts/business-promo-backfill.js --from listings.json  # offline, array of businesses rows
 *   node scripts/business-promo-backfill.js --start 2026-11-16    # first posting day (default: next Monday)
 *
 * Re-running is safe: businesses already in schedule.json keep their slot and
 * any edits; only new businesses are appended after the last booked day.
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../data/review-queue/business-promos');
const OUT_FILE = path.join(OUT_DIR, 'schedule.json');
const EXCLUSIONS_FILE = path.join(__dirname, '../data/promo-exclusions.json');
const DIRECTORY_URL = 'https://www.oldoaktown.co.uk/business-directory.html';
const POST_TIME = '12:00'; // London local time

// England & Wales bank holidays we must not post on (extend yearly).
const BANK_HOLIDAYS = new Set([
    '2026-12-25', '2026-12-28', '2027-01-01', '2027-03-26', '2027-03-29',
    '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28'
]);

const CATEGORY = {
    'food-drink':    { label: 'Food & Drink',            tag: '#WestLondonEats' },
    'retail':        { label: 'Retail & Shopping',       tag: '#ShopLocal' },
    'services':      { label: 'Professional Services',   tag: '#LocalServices' },
    'health':        { label: 'Health & Wellness',       tag: '#LocalHealth' },
    'property':      { label: 'Property',                tag: '#WestLondonProperty' },
    'construction':  { label: 'Construction & Trade',    tag: '#LocalTrades' },
    'technology':    { label: 'Technology & IT',         tag: '#LondonTech' },
    'education':     { label: 'Education & Training',    tag: '#LocalLearning' },
    'motor':         { label: 'Motor Services',          tag: '#LocalGarage' },
    'industrial':    { label: 'Industrial & Manufacturing', tag: '#ParkRoyal' },
    'entertainment': { label: 'Entertainment & Leisure', tag: '#WestLondonLife' },
    'other':         { label: 'Local Business',          tag: '#LocalBusiness' }
};

// Must match slugify() in business-directory.html so posts deep-link to the tile.
function slugify(name) {
    return String(name).toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function clean(s) {
    return String(s || '').replace(/^["“\s]+|["”\s]+$/g, '').replace(/\s+/g, ' ').trim();
}

// First whole sentences of the description, max ~200 chars. Never truncates mid-sentence.
function blurb(description) {
    const text = clean(description);
    if (!text) return '';
    const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [text];
    let out = '';
    for (const s of sentences) {
        if ((out + s).trim().length > 200 && out) break;
        out += s;
    }
    out = out.trim();
    if (out.length > 240) out = out.slice(0, 237).replace(/\s+\S*$/, '') + '…';
    return /[.!?…]$/.test(out) ? out : out + '.';
}

function placeLine(b) {
    const parts = [clean(b.address).replace(/,\s*GB\.?$/i, ''), clean(b.postcode)].filter(Boolean);
    return parts.join(', ');
}

function buildPosts(b) {
    const cat = CATEGORY[b.category] || CATEGORY.other;
    const about = blurb(b.description);
    const place = placeLine(b);
    const link = `${DIRECTORY_URL}#${slugify(b.business_name)}`;
    const site = b.website ? clean(b.website) : '';
    const intro = b.tier && b.tier !== 'free'
        ? `🌳 Featured local business: ${b.business_name}`
        : `🌳 Local business spotlight: ${b.business_name}`;

    const body = [about, place && `📍 ${place}`, b.opening_hours && `🕐 ${clean(b.opening_hours)}`]
        .filter(Boolean);

    const instagram = [
        intro, '', ...body, '',
        'Find them, and plenty more local businesses, in the Old Oak Town directory — link in bio.',
        '', `#OldOakCommon #OldOakTown #WestLondon #SupportLocal ${cat.tag}`
    ].join('\n');

    const facebook = [
        intro, '', ...body, '',
        `See the full listing in the Old Oak Town directory 👉 ${link}`,
        'Know a local business that should be listed? It\'s free to add.'
    ].join('\n');

    const linkedin = [
        `${b.business_name} is part of the Old Oak Common business community.`, '',
        ...body, '',
        `We\'re spotlighting the businesses listed in the Old Oak Town directory, one at a time, as the area grows around the new HS2 and Elizabeth line interchange. Full listing: ${link}`,
        '', `#OldOakCommon #WestLondon #LocalBusiness`
    ].join('\n');

    return {
        instagram: { text: instagram, image: null, imageNote: 'No logo/photo on file — use the branded directory tile or a real photo supplied by the owner.' },
        facebook:  { text: facebook,  image: null },
        linkedin:  { text: linkedin,  image: null }
    };
}

// ── Scheduling ────────────────────────────────────────────────────────────────

function iso(d) { return d.toISOString().slice(0, 10); }

function isPostingDay(d) {
    const dow = d.getUTCDay();
    return dow !== 0 && dow !== 6 && !BANK_HOLIDAYS.has(iso(d));
}

function nextPostingDay(d) {
    const n = new Date(d);
    do { n.setUTCDate(n.getUTCDate() + 1); } while (!isPostingDay(n));
    return n;
}

function nextMonday(from = new Date()) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
    do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() !== 1);
    return d;
}

// Paid first, then round-robin across categories so we never post ten
// restaurants in a row.
function orderForVariety(list) {
    const paid = list.filter(b => b.tier && b.tier !== 'free');
    const free = list.filter(b => !b.tier || b.tier === 'free');
    const buckets = {};
    free.forEach(b => { (buckets[b.category || 'other'] ||= []).push(b); });
    const keys = Object.keys(buckets).sort((a, b) => buckets[b].length - buckets[a].length);
    const mixed = [];
    while (keys.some(k => buckets[k].length)) {
        keys.forEach(k => { if (buckets[k].length) mixed.push(buckets[k].shift()); });
    }
    return [...paid, ...mixed];
}

// ── Data in ───────────────────────────────────────────────────────────────────

async function loadBusinesses(fromFile) {
    if (fromFile) return JSON.parse(fs.readFileSync(fromFile, 'utf8'));
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data, error } = await supabase
        .from('businesses')
        .select('id, business_name, category, tier, address, postcode, description, website, opening_hours, approved_at')
        .eq('status', 'approved');
    if (error) throw new Error(error.message);
    return data;
}

function arg(name) {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : null;
}

async function main() {
    const rules = JSON.parse(fs.readFileSync(EXCLUSIONS_FILE, 'utf8')).exclusions
        .map(e => ({ re: new RegExp(e.match, 'i'), reason: e.reason }));

    const all = await loadBusinesses(arg('from'));
    const existing = fs.existsSync(OUT_FILE) ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')) : null;
    const entries = existing ? existing.entries : [];
    const booked = new Set(entries.map(e => e.businessId));

    const skipped = [];
    const seenNames = new Set(entries.map(e => slugify(e.businessName)));
    const candidates = [];

    // Longest description first so, where a name is listed twice, the richer record wins.
    [...all].sort((a, b) => clean(b.description).length - clean(a.description).length).forEach(b => {
        const paid = b.tier && b.tier !== 'free';
        const slug = slugify(b.business_name);
        if (booked.has(b.id)) return;
        const rule = rules.find(r => r.re.test(b.business_name));
        if (rule && !paid) return skipped.push({ name: b.business_name, reason: rule.reason });
        if (seenNames.has(slug)) return skipped.push({ name: b.business_name, reason: 'duplicate listing (same name)' });
        seenNames.add(slug);
        candidates.push(b);
    });

    let day = entries.length
        ? nextPostingDay(new Date(entries[entries.length - 1].scheduledDate + 'T00:00:00Z'))
        : (arg('start') ? new Date(arg('start') + 'T00:00:00Z') : nextMonday());
    while (!isPostingDay(day)) day = nextPostingDay(day);

    orderForVariety(candidates).forEach(b => {
        entries.push({
            businessId: b.id,
            businessName: b.business_name,
            category: b.category,
            tier: b.tier || 'free',
            slug: slugify(b.business_name),
            scheduledDate: iso(day),
            scheduledTime: POST_TIME,
            timezone: 'Europe/London',
            status: 'pending_review',
            posts: buildPosts(b)
        });
        day = nextPostingDay(day);
    });

    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify({
        generatedAt: new Date().toISOString(),
        policy: 'independents only; paid first; one business per weekday; drafts only — nothing is published by this script',
        total: entries.length,
        entries,
        skipped: [...(existing?.skipped || []), ...skipped]
    }, null, 2));

    console.log(`✅ ${candidates.length} new draft(s) added — ${entries.length} in schedule, ${entries[0]?.scheduledDate} → ${entries[entries.length - 1]?.scheduledDate}`);
    console.log(`⏭️  ${skipped.length} skipped:`);
    skipped.forEach(s => console.log(`   - ${s.name} (${s.reason})`));
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
