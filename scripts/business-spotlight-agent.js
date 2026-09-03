/**
 * Business Spotlight Agent — Old Oak Town
 *
 * Runs after a business listing is approved. Researches the business
 * (submitted fields + its own website, when it has one), drafts a warm
 * newsletter spotlight paragraph and a header-image prompt using Claude,
 * and saves the result to data/review-queue/business-spotlights/ for
 * human review. Per CLAUDE.md, HITL is non-negotiable — this script
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
const Anthropic = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

// Best-effort: pull a plain-text excerpt from the business's own website, if
// they gave one. No new dependency, no search API — just extra grounding
// for the draft when it's available. Never blocks the run if it fails.
async function researchWebsite(url) {
    if (!url) return null;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url.startsWith('http') ? url : `https://${url}`, { signal: controller.signal })
            .finally(() => clearTimeout(timeout));
        if (!res.ok) return null;
        const html = await res.text();
        const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return text.slice(0, 3000) || null;
    } catch (err) {
        console.warn(`Website research skipped (${url}):`, err.message);
        return null;
    }
}

async function draftSpotlight(business, websiteExcerpt) {
    const response = await client.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 1000,
        system: 'You write for Old Oak Town, a hyperlocal community newsletter covering the Old Oak Common regeneration project in West London. Tone: warm, community-focused, journalistic — trustworthy and local, not corporate. Respond with valid JSON only, no markdown.',
        messages: [{
            role: 'user',
            content: `Draft a "Business Spotlight" for our newsletter and directory.

BUSINESS (submitted details — treat as ground truth):
Name: ${business.business_name}
Category: ${business.category}
Description: ${business.description || 'Not provided'}
Address: ${business.address || 'Not provided'}, ${business.postcode || ''}
Phone: ${business.phone || 'Not provided'}
Website: ${business.website || 'Not provided'}

${websiteExcerpt ? `EXTRA CONTEXT from their own website (use only facts consistent with the submitted details above; do not invent services or claims not supported by either source):\n${websiteExcerpt}` : 'No website content available — use only the submitted details above.'}

Return JSON with this exact structure:
{
  "headline": "short, warm headline for the spotlight, e.g. 'Business Spotlight: ...'",
  "paragraph": "120-150 word newsletter paragraph in Old Oak Town's voice, ending with how readers can find/contact them",
  "social_caption": "one short caption (under 280 characters) suitable for Instagram/Facebook, tree emoji optional",
  "image_prompt": "detailed prompt for a header/spotlight image — scene, style, mood, matching a warm community-journalism aesthetic in deep forest green (#1C3A0E) and cream tones, no text in the image"
}`
        }],
    });

    try {
        return JSON.parse(response.content[0].text.trim());
    } catch {
        throw new Error(`Claude response was not valid JSON: ${response.content[0].text.slice(0, 200)}`);
    }
}

async function notifyAdmin(business, draft) {
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
<p><em>Image prompt:</em> ${draft.image_prompt}</p>
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

    const websiteExcerpt = await researchWebsite(business.website);
    console.log(websiteExcerpt ? '🔍 Pulled extra context from business website.' : '🔍 No website on file — drafting from submitted details only.');

    const draft = await draftSpotlight(business, websiteExcerpt);

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({
        businessId,
        businessName: business.business_name,
        draftedAt: new Date().toISOString(),
        status: 'pending_review',
        researchedWebsite: !!websiteExcerpt,
        ...draft,
    }, null, 2));
    console.log(`💾 Draft saved to ${outputPath}`);

    await notifyAdmin(business, draft);
    console.log('✅ Done.');
}

main().catch(err => { console.error('❌ Fatal error:', err); process.exit(1); });
