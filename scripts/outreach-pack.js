/**
 * Outreach Pack — Old Oak Town
 *
 * Builds the "claim your listing" materials from the promo schedule
 * (data/review-queue/business-promos/schedule.json), i.e. independents only:
 *
 *   outreach/call-sheet.csv   one row per business in walking order (by postcode),
 *                             with blank columns to log contact, outcome, logo, etc.
 *   outreach/leaflets.html    one printable A5 leaflet per business, each with its
 *                             own QR code to that business's listing.
 *
 * Contains only public listing facts. No emails or phone numbers are read or
 * written. Re-run after the schedule changes; the outputs are generated.
 *
 * Usage:  node scripts/outreach-pack.js
 * Print:  open outreach/leaflets.html in Chrome → Print → A5, margins "None",
 *         "Background graphics" on. (Or save as PDF for a print shop.)
 */

const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const ROOT = path.join(__dirname, '..');
const SCHEDULE = path.join(ROOT, 'data/review-queue/business-promos/schedule.json');
const OUT_DIR = path.join(ROOT, 'outreach');
const SITE = 'https://www.oldoaktown.co.uk';
const CONTACT = 'info@oldoaktown.co.uk';

const CATEGORY_LABEL = {
    'food-drink': 'Food & Drink', retail: 'Retail & Shopping', services: 'Professional Services',
    health: 'Health & Wellness', property: 'Property', construction: 'Construction & Trade',
    technology: 'Technology & IT', education: 'Education & Training', motor: 'Motor Services',
    industrial: 'Industrial & Manufacturing', entertainment: 'Entertainment & Leisure', other: 'Local Business'
};

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const csvCell = v => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

// Postcode out of the stored "address, postcode" place line (outward + sector sorts streets together).
function postcodeOf(e) {
    const m = (e.meta && e.meta.place || '').match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)(?:\s*(\d[A-Z]{2}))?\s*$/i);
    return m ? { outward: m[1].toUpperCase(), full: (m[1] + (m[2] ? ' ' + m[2] : '')).toUpperCase() } : { outward: '~', full: '' };
}

function walkingOrder(entries) {
    return [...entries].sort((a, b) => {
        const pa = postcodeOf(a), pb = postcodeOf(b);
        return pa.full.localeCompare(pb.full) || a.businessName.localeCompare(b.businessName);
    });
}

const listingUrl = e => `${SITE}/business-directory.html#${e.slug}`;

function callSheet(entries) {
    const header = ['#', 'Business', 'Category', 'Address', 'Postcode', 'Website', 'Listing link', 'Tier', 'Social post date',
        'Contacted on', 'Method (walk-in/phone/email)', 'Spoke to', 'Outcome', 'Details correct?', 'Logo received', 'Photos received',
        'Wants removing', 'Upgrade interest', 'Follow-up date', 'Notes'];
    const rows = walkingOrder(entries).map((e, i) => {
        const pc = postcodeOf(e);
        const address = ((e.meta && e.meta.place) || '').replace(/,?\s*[A-Z]{1,2}\d{1,2}[A-Z]?(\s*\d[A-Z]{2})?\s*$/i, '').replace(/,\s*(London|United Kingdom)\b/gi, '');
        return [i + 1, e.businessName, CATEGORY_LABEL[e.category] || 'Local Business', address, pc.full, (e.meta && e.meta.website) || '',
            listingUrl(e), e.tier || 'free', e.scheduledDate, '', '', '', '', '', '', '', '', '', '', ''];
    });
    return [header, ...rows].map(r => r.map(csvCell).join(',')).join('\n') + '\n';
}

async function leafletHtml(e) {
    const qr = await QRCode.toString(listingUrl(e), { type: 'svg', margin: 0, color: { dark: '#1C3A0E', light: '#FFFFFF' } });
    const cat = CATEGORY_LABEL[e.category] || 'Local Business';
    const place = ((e.meta && e.meta.place) || '').replace(/,\s*(London|United Kingdom)\b/gi, '');
    const blurb = (e.meta && e.meta.blurb) || '';
    return `
<section class="leaflet">
  <header><img src="../images/logo.png" alt=""><div><b>Old Oak Town</b><span>Local news &amp; community · Old Oak Common</span></div></header>
  <h1>You&rsquo;re in the Old Oak Town directory.</h1>
  <p class="lede"><strong>${esc(e.businessName)}</strong> is listed, free of charge, so neighbours, workers and visitors around Old Oak Common can find you.</p>

  <div class="listing">
    <div class="label">How your listing looks today</div>
    <div class="cat">${esc(cat)}</div>
    <h2>${esc(e.businessName)}</h2>
    ${place ? `<div class="place">📍 ${esc(place)}</div>` : ''}
    ${blurb ? `<p>${esc(blurb)}</p>` : ''}
  </div>

  <ul class="asks">
    <li><b>Check it&rsquo;s right.</b> Tell us anything to change: hours, description, address.</li>
    <li><b>Send us your logo and a photo</b> and we&rsquo;ll add them to your tile.</li>
    <li><b>Want to stand out?</b> Featured is &pound;35 a month: a badge, priority placement, a link to your website and your opening hours. Totally optional.</li>
  </ul>

  <div class="bottom">
    <div class="qr">${qr}<span>Scan to see your listing</span></div>
    <div class="contact">
      <b>${esc(CONTACT)}</b>
      <span>Not for you? Email us and we&rsquo;ll take your listing down within one working day. No hard feelings.</span>
    </div>
  </div>
  <footer>Old Oak Town is an independent local news and community site for Old Oak Common, West London. oldoaktown.co.uk</footer>
</section>`;
}

const CSS = `
@page { size: A5; margin: 0; }
:root { --primary:#1C3A0E; --accent:#4C8A35; --mid:#2F6020; --pale:#D4E8C8; --ghost:#F0F7EB; --cream:#FAF8F4; --ink:#0F1A0A; --muted:#6B7B5E; --border:#DDE8D4; }
* { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body { font-family:'DM Sans',Arial,sans-serif; color:var(--ink); background:#888; }
.leaflet { width:148mm; height:210mm; margin:0 auto 6mm; background:var(--cream); padding:11mm 11mm 9mm; display:flex; flex-direction:column; page-break-after:always; break-after:page; overflow:hidden; }
@media print { body { background:none; } .leaflet { margin:0; } }
header { display:flex; align-items:center; gap:3.5mm; margin:-11mm -11mm 6mm; padding:6mm 11mm; background:var(--primary); color:var(--cream); }
header img { width:11mm; height:11mm; border-radius:2.5mm; }
header b { display:block; font-size:12pt; }
header span { font-size:7.5pt; color:var(--pale); letter-spacing:.04em; }
h1 { font-family:'Instrument Serif',Georgia,serif; font-style:italic; font-weight:400; font-size:25pt; line-height:1.05; color:var(--primary); margin-bottom:3mm; }
.lede { font-size:10.5pt; line-height:1.45; margin-bottom:5mm; }
.listing { background:#fff; border:.3mm solid var(--border); border-left:1.6mm solid var(--accent); border-radius:2.5mm; padding:4mm 4.5mm; margin-bottom:5mm; }
.label { font-size:6.5pt; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin-bottom:2mm; font-weight:700; }
.cat { font-size:6.5pt; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--accent); }
.listing h2 { font-family:'Instrument Serif',Georgia,serif; font-weight:400; font-size:16pt; line-height:1.15; color:var(--primary); margin:.5mm 0 1.2mm; }
.place { font-size:8.5pt; color:var(--muted); margin-bottom:1.5mm; }
.listing p { font-size:9pt; line-height:1.4; }
.asks { list-style:none; display:grid; gap:2.6mm; font-size:9.5pt; line-height:1.4; margin-bottom:auto; }
.asks li { padding-left:5.5mm; position:relative; }
.asks li::before { content:'✓'; position:absolute; left:0; color:var(--accent); font-weight:700; }
.bottom { display:flex; gap:5mm; align-items:center; margin-top:5mm; padding-top:4mm; border-top:.3mm solid var(--border); }
.qr { width:28mm; flex:none; text-align:center; }
.qr svg { width:28mm; height:28mm; display:block; padding:1.5mm; background:#fff; border:.3mm solid var(--border); border-radius:2mm; }
.qr span { display:block; font-size:6.5pt; color:var(--muted); margin-top:1mm; }
.contact b { display:block; font-size:11pt; color:var(--primary); margin-bottom:1.5mm; }
.contact span { font-size:8.5pt; line-height:1.4; color:var(--ink); }
footer { margin-top:4mm; font-size:6.5pt; color:var(--muted); text-align:center; }
`;

async function main() {
    if (!fs.existsSync(SCHEDULE)) throw new Error('Run scripts/business-promo-backfill.js first.');
    const entries = JSON.parse(fs.readFileSync(SCHEDULE, 'utf8')).entries;
    fs.mkdirSync(OUT_DIR, { recursive: true });

    fs.writeFileSync(path.join(OUT_DIR, 'call-sheet.csv'), callSheet(entries));

    const pages = [];
    for (const e of walkingOrder(entries)) pages.push(await leafletHtml(e));
    fs.writeFileSync(path.join(OUT_DIR, 'leaflets.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Old Oak Town — listing leaflets</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Instrument+Serif:ital@1&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>${pages.join('\n')}</body></html>`);

    console.log(`✅ ${entries.length} leaflets + call sheet written to outreach/ (walking order by postcode)`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
