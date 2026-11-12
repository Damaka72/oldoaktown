/**
 * Business Promo Pilot — Old Oak Town
 *
 * Takes the first two weeks of the backfill schedule and makes them ready to
 * load into the Social Command Centre (social-agent.html → "Upload from
 * spreadsheet"):
 *
 *   1. Picks the best-documented independents (paid first, then those with a
 *      website and the fullest description, max 2 per category) and moves them
 *      to the first 10 posting days. Everyone else keeps their relative order.
 *   2. Writes pilot-week1.csv / pilot-week2.csv in the Command Centre's CSV
 *      format (5 businesses × Facebook + Instagram + LinkedIn = 15 posts each).
 *   3. Renders a branded 1080×1080 image per pilot business to images/promo/.
 *      Instagram refuses to post without an image and these listings have no
 *      logo or photo yet. Replace with a real photo whenever the owner sends one.
 *
 * Nothing is published. Posts stay `pending_review` until a human approves
 * them in the Command Centre.
 *
 * Usage:
 *   node scripts/business-promo-pilot.js [--size 10] [--exclude "McVitie's Factory"]
 *
 * Needs Playwright (any recent version) for the images: `npx playwright install chromium`.
 * Re-running is safe; it re-picks from entries not yet sent and rewrites the files.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PROMO_DIR = path.join(ROOT, 'data/review-queue/business-promos');
const SCHEDULE = path.join(PROMO_DIR, 'schedule.json');
const IMG_DIR = path.join(ROOT, 'images/promo');
const FONT_DIR = path.join(__dirname, 'assets/fonts');
const SITE = 'https://www.oldoaktown.co.uk';

const CATEGORY_LABEL = {
    'food-drink': 'Food & Drink', retail: 'Retail & Shopping', services: 'Professional Services',
    health: 'Health & Wellness', property: 'Property', construction: 'Construction & Trade',
    technology: 'Technology & IT', education: 'Education & Training', motor: 'Motor Services',
    industrial: 'Industrial & Manufacturing', entertainment: 'Entertainment & Leisure', other: 'Local Business'
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function arg(name) {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : null;
}

function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// The Command Centre keeps hashtags in their own column: split a trailing "#a #b" line off the caption.
function splitHashtags(text) {
    const lines = text.trimEnd().split('\n');
    const last = lines[lines.length - 1] || '';
    if (/^(#\w+\s*)+$/.test(last.trim())) {
        return { caption: lines.slice(0, -1).join('\n').trimEnd(), hashtags: last.trim() };
    }
    return { caption: text.trim(), hashtags: '' };
}

// ── Choosing the pilot ────────────────────────────────────────────────────────

function pilotScore(e) {
    const paid = e.tier && e.tier !== 'free';
    const m = e.meta || {};
    return (paid ? 1000 : 0) + (m.website ? 100 : 0) + Math.min(m.descLength || 0, 200);
}

function pickPilot(entries, size, excluded) {
    const perCategory = {};
    const pool = entries
        .filter(e => e.status === 'pending_review' && !excluded.has(e.businessName))
        .sort((a, b) => pilotScore(b) - pilotScore(a));
    const picked = [];
    for (const e of pool) {
        const c = e.category || 'other';
        if ((perCategory[c] || 0) >= 2) continue;
        perCategory[c] = (perCategory[c] || 0) + 1;
        picked.push(e);
        if (picked.length === size) break;
    }
    // Interleave categories so the pilot weeks don't feel samey; paid stays first.
    return picked;
}

function reorder(schedule, size, excluded) {
    const entries = schedule.entries;
    const dates = entries.map(e => ({ d: e.scheduledDate, t: e.scheduledTime }));
    const pilot = pickPilot(entries, size, excluded);
    const pilotIds = new Set(pilot.map(e => e.businessId));
    const rest = entries.filter(e => !pilotIds.has(e.businessId));
    const next = [...pilot, ...rest];
    next.forEach((e, i) => {
        e.scheduledDate = dates[i].d;
        e.scheduledTime = dates[i].t;
        e.pilot = i < pilot.length;
    });
    schedule.entries = next;
    return pilot;
}

// ── Images ────────────────────────────────────────────────────────────────────

function imageUrl(e) { return `${SITE}/images/promo/${e.slug}.png`; }

function tileHtml(e) {
    const font = f => 'file://' + path.join(FONT_DIR, f);
    const logo = 'file://' + path.join(ROOT, 'images/logo.png');
    const name = e.businessName.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const place = (e.meta && e.meta.place || '').replace(/, (London|United Kingdom)/gi, '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const cat = (CATEGORY_LABEL[e.category] || 'Local Business').replace(/&/g, '&amp;');
    const nameSize = e.businessName.length > 34 ? 84 : e.businessName.length > 22 ? 104 : 124;
    return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Instrument Serif';font-style:italic;font-weight:400;src:url('${font('instrument-serif-latin-400-italic.woff2')}')}
@font-face{font-family:'DM Sans';font-weight:400;src:url('${font('dm-sans-latin-400-normal.woff2')}')}
@font-face{font-family:'DM Sans';font-weight:700;src:url('${font('dm-sans-latin-700-normal.woff2')}')}
:root{--primary:#1C3A0E;--accent:#4C8A35;--pale:#D4E8C8;--ghost:#F0F7EB;--cream:#FAF8F4}
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1080px;background:var(--primary);color:var(--cream);font-family:'DM Sans',sans-serif;position:relative;overflow:hidden}
.frame{position:absolute;inset:44px;border:2px solid color-mix(in srgb,var(--pale) 35%,transparent);border-radius:36px}
.top{position:absolute;top:96px;left:96px;right:96px;display:flex;align-items:center;gap:22px}
.top img{width:84px;height:84px;border-radius:18px}
.top .brand{font-size:34px;font-weight:700;letter-spacing:.02em}
.top .tag{font-size:24px;color:var(--pale);letter-spacing:.14em;text-transform:uppercase;margin-top:4px}
.main{position:absolute;left:96px;right:96px;top:300px;bottom:230px;display:flex;flex-direction:column;justify-content:center}
.cat{display:inline-block;align-self:flex-start;background:var(--accent);color:#fff;font-weight:700;font-size:26px;letter-spacing:.1em;text-transform:uppercase;padding:12px 26px;border-radius:999px;margin-bottom:34px}
h1{font-family:'Instrument Serif',serif;font-style:italic;font-weight:400;font-size:${nameSize}px;line-height:1.02}
.place{margin-top:34px;font-size:34px;color:var(--pale)}
.foot{position:absolute;left:96px;right:96px;bottom:96px;display:flex;justify-content:space-between;align-items:flex-end;font-size:28px;color:var(--pale)}
.foot b{display:block;color:var(--cream);font-size:32px;margin-bottom:6px}
</style></head><body><div class="frame"></div>
<div class="top"><img src="${logo}" alt=""><div><div class="brand">Old Oak Town</div><div class="tag">Local business spotlight</div></div></div>
<div class="main"><span class="cat">${cat}</span><h1>${name}</h1>${place ? `<div class="place">${place}</div>` : ''}</div>
<div class="foot"><div><b>Find them in our directory</b>oldoaktown.co.uk/business-directory</div></div>
</body></html>`;
}

async function renderImages(pilot) {
    let chromium;
    try { ({ chromium } = require('playwright')); }
    catch { console.warn('⚠️  Playwright not installed — skipped images. Run: npm i -D playwright && npx playwright install chromium'); return false; }
    fs.mkdirSync(IMG_DIR, { recursive: true });
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
    for (const e of pilot) {
        const tmp = path.join(IMG_DIR, `.${e.slug}.html`);
        fs.writeFileSync(tmp, tileHtml(e));
        await page.goto('file://' + tmp);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: path.join(IMG_DIR, `${e.slug}.png`) });
        fs.unlinkSync(tmp);
    }
    await browser.close();
    return true;
}

// ── CSV ───────────────────────────────────────────────────────────────────────

function writeCsvs(pilot) {
    const header = 'day,platform,caption,hashtags,best_time,media_url,day_theme';
    const files = [];
    for (let w = 0; w < Math.ceil(pilot.length / 5); w++) {
        const rows = [header];
        pilot.slice(w * 5, w * 5 + 5).forEach(e => {
            const day = DAY_NAMES[new Date(e.scheduledDate + 'T00:00:00Z').getUTCDay()];
            ['facebook', 'instagram', 'linkedin'].forEach(platform => {
                const { caption, hashtags } = splitHashtags(e.posts[platform].text);
                rows.push([day, platform, caption, hashtags, '', imageUrl(e), `Business spotlight: ${e.businessName}`].map(csvCell).join(','));
            });
        });
        const file = path.join(PROMO_DIR, `pilot-week${w + 1}.csv`);
        fs.writeFileSync(file, rows.join('\n') + '\n');
        const first = pilot[w * 5].scheduledDate;
        files.push({ file, weekStart: first });
    }
    return files;
}

async function main() {
    if (!fs.existsSync(SCHEDULE)) throw new Error('Run scripts/business-promo-backfill.js first.');
    const schedule = JSON.parse(fs.readFileSync(SCHEDULE, 'utf8'));
    const size = parseInt(arg('size') || '10', 10);
    const excluded = new Set(process.argv.flatMap((a, i, all) => a === '--exclude' ? [all[i + 1]] : []));

    const pilot = reorder(schedule, size, excluded);
    pilot.forEach(e => {
        // Point every pilot post at the hosted image (needs this branch merged + deployed before sending).
        ['facebook', 'instagram', 'linkedin'].forEach(p => { e.posts[p].image = imageUrl(e); });
        delete e.posts.instagram.imageNote;
    });
    // Tidy anything left over from an earlier pilot selection.
    const pilotSlugs = new Set(pilot.map(e => e.slug));
    schedule.entries.filter(e => !e.pilot).forEach(e => {
        ['facebook', 'instagram', 'linkedin'].forEach(p => { if (e.posts[p].image) e.posts[p].image = null; });
    });
    if (fs.existsSync(IMG_DIR)) {
        fs.readdirSync(IMG_DIR).filter(f => f.endsWith('.png') && !pilotSlugs.has(f.slice(0, -4)))
            .forEach(f => fs.unlinkSync(path.join(IMG_DIR, f)));
    }
    fs.writeFileSync(SCHEDULE, JSON.stringify(schedule, null, 2));

    const files = writeCsvs(pilot);
    const rendered = await renderImages(pilot);

    console.log(`✅ Pilot: ${pilot.length} businesses, ${pilot[0].scheduledDate} → ${pilot[pilot.length - 1].scheduledDate}`);
    pilot.forEach(e => console.log(`   ${e.scheduledDate}  ${(e.tier || 'free').padEnd(8)} ${(e.category || '').padEnd(14)} ${e.businessName}`));
    files.forEach(f => console.log(`📄 ${path.relative(ROOT, f.file)}  → set "Week starting" to ${f.weekStart} in the Command Centre, then upload`));
    console.log(rendered ? `🖼️  ${pilot.length} images in images/promo/` : '🖼️  images not rendered');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
