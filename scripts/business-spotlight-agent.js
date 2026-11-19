/**
 * Business Spotlight Agent — Old Oak Town
 *
 * Runs after a business listing is approved. Researches the business
 * (submitted fields + candidate photos from its own website), builds a
 * newsletter spotlight paragraph and social caption from the listing's own
 * fields (no AI, no API cost), and saves the result to
 * data/review-queue/business-spotlights/ for human review. Per CLAUDE.md, HITL is non-negotiable — this script
 * never publishes anything on its own.
 *
 * Triggered by:
 *   - repository_dispatch "business-approved" (fired by api/approve.js
 *     right after a business is approved, if GITHUB_DISPATCH_TOKEN is set)
 *   - workflow_dispatch with a businessId input, for manual/backfill runs
 *
 * Run: BUSINESS_ID=<uuid> node scripts/business-spotlight-agent.js
 */

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Uses the anon key, not the service role key: this script only ever reads
// a business record (never writes), and the businesses table's RLS policy
// already permits public SELECT access, so the anon key is sufficient and
// keeps this workflow from needing the far more powerful service-role
// secret at all.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const OUTPUT_DIR = path.join(__dirname, '../data/review-queue/business-spotlights');

async function fetchBusiness(businessId) {
    const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();
    if (error || !data) throw new Error(`Business ${businessId} not found: ${error?.message || 'no row'}`);
    return data;
}

// Best-effort: pull a plain-text excerpt and candidate real photos from the
// business's own website, if they gave one. No new dependency, no search
// API — just extra grounding for the draft when it's available. Never
// blocks the run if it fails.
async function researchWebsite(url) {
    if (!url) return { text: null, images: [] };
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const target = url.startsWith('http') ? url : `https://${url}`;
        const res = await fetch(target, { signal: controller.signal })
            .finally(() => clearTimeout(timeout));
        if (!res.ok) return { text: null, images: [] };
        const html = await res.text();

        const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 3000) || null;

        return { text, images: extractImageUrls(html, target) };
    } catch (err) {
        console.warn(`Website research skipped (${url}):`, err.message);
        return { text: null, images: [] };
    }
}

// Pulls the og:image and the first few <img> src attributes, resolved to
// absolute URLs. These are surfaced as candidateImages for the human
// reviewer to consider using instead of (or alongside) an AI-generated
// image — a real photo of a real local business is usually better than a
// generated one when one's available.
function extractImageUrls(html, baseUrl) {
    const found = new Set();

    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogMatch) found.add(ogMatch[1]);

    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    let m;
    while ((m = imgRegex.exec(html)) && found.size < 15) {
        found.add(m[1]);
    }

    return [...found]
        .map(src => {
            try { return new URL(src, baseUrl).href; } catch { return null; }
        })
        .filter(Boolean)
        .filter(src => !/\.(svg|ico)(\?|$)/i.test(src))
        .slice(0, 8);
}

const DIRECTORY_URL = 'https://www.oldoaktown.co.uk/business-directory.html';

// Must match slugify() in business-directory.html so links open the listing.
function slugify(name) {
    return String(name).toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function clean(s) {
    return String(s || '').replace(/^["“\s]+|["”\s]+$/g, '').replace(/\s+/g, ' ').trim();
}

// First whole sentences of the owner's own description, max ~240 chars.
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

// No AI: the draft is built only from the listing's own submitted fields, so
// it costs nothing, cannot invent claims, and matches the curate-don't-write
// rule in CLAUDE.md. A human still reviews and edits before anything is used.
function draftSpotlight(business) {
    const name = business.business_name;
    const about = blurb(business.description);
    const place = [clean(business.address).replace(/,\s*GB\.?$/i, ''), clean(business.postcode)].filter(Boolean).join(', ');
    const link = `${DIRECTORY_URL}#${slugify(name)}`;
    const site = clean(business.website);

    const paragraph = [
        `${name} is one of the local businesses listed in the Old Oak Town directory.`,
        about,
        place && `You'll find them at ${place}.`,
        business.opening_hours && `Opening hours: ${clean(business.opening_hours)}.`,
        site && `More at ${site}.`,
        `See the full listing: ${link}`,
    ].filter(Boolean).join(' ');

    const social_caption = [
        `🌳 Local business spotlight: ${name}`,
        about,
        place && `📍 ${place}`,
        `Full listing: ${link}`,
    ].filter(Boolean).join('\n');

    return {
        headline: `Business Spotlight: ${name}`,
        paragraph,
        social_caption,
        imageNote: 'No AI imagery. Use a real photo from candidateImages (check the owner is happy), one supplied by the owner, or the branded typographic tile.',
    };
}

async function notifyAdmin(business, draft, candidateImages) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.ADMIN_EMAIL) return;
    const t = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await t.sendMail({
        from: `"Old Oak Town Bot" <${process.env.SMTP_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `📰 Spotlight draft ready: ${business.business_name}`,
        html: `<h2>📰 New business spotlight draft</h2>
<p><strong>Business:</strong> ${business.business_name}</p>
<h3>${draft.headline}</h3>
<p>${draft.paragraph}</p>
<p><em>Social caption:</em> ${draft.social_caption}</p>
<p><em>Image:</em> ${draft.imageNote}</p>
${candidateImages?.length ? `<p><em>Candidate real photos from their site:</em><br>${candidateImages.map(src => `<a href="${src}">${src}</a>`).join('<br>')}</p>` : ''}
<hr>
<p>Waiting in data/review-queue/business-spotlights/ for human review — nothing has been published.</p>`,
    });
}

async function main() {
    const businessId = process.env.BUSINESS_ID;
    if (!businessId) {
        console.error('❌ BUSINESS_ID env var is required');
        process.exit(1);
    }

    console.log(`📰 Business Spotlight Agent — researching ${businessId}...`);
    const business = await fetchBusiness(businessId);

    const outputPath = path.join(OUTPUT_DIR, `${businessId}.json`);
    if (fs.existsSync(outputPath)) {
        console.log('✅ Spotlight draft already exists — skipping.');
        return;
    }

    const research = await researchWebsite(business.website);
    console.log(research.text ? '🔍 Pulled extra context from business website.' : '🔍 No website on file — drafting from submitted details only.');
    if (research.images.length) console.log(`🖼️  Found ${research.images.length} candidate photo(s) on their site.`);

    const draft = draftSpotlight(business);

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({
        businessId,
        businessName: business.business_name,
        draftedAt: new Date().toISOString(),
        status: 'pending_review',
        researchedWebsite: !!research.text,
        candidateImages: research.images,
        ...draft,
    }, null, 2));
    console.log(`💾 Draft saved to ${outputPath}`);

    await notifyAdmin(business, draft, research.images);
    console.log('✅ Done.');
}

main().catch(err => { console.error('❌ Fatal error:', err); process.exit(1); });
