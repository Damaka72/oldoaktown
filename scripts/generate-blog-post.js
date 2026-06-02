/**
 * Generate Blog Post Draft — Old Oak Town
 *
 * 1. Searches Brave for recent Old Oak Common / HS2 / Old Oak Town news
 * 2. Picks the most relevant story
 * 3. Uses Claude to draft a full blog post
 * 4. Saves draft to Supabase blog_drafts table
 * 5. Emails admin with a preview
 *
 * Run: node scripts/generate-blog-post.js
 * Schedule: Every Wednesday at 08:00 UTC via GitHub Actions
 */

const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 80);
}

function weekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
}

async function searchLocalNews() {
  const queries = [
    'Old Oak Common regeneration 2025',
    'Old Oak Town HS2 development West London',
    'Old Oak Common community news',
    'Park Royal regeneration West London',
  ];
  const query = queries[Math.floor(Math.random() * queries.length)];
  console.log(`Searching Brave: "${query}"`);

  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&freshness=pw`,
    {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': process.env.BRAVE_API_KEY,
      },
    }
  );

  if (!res.ok) throw new Error(`Brave Search failed: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const results = (data.web?.results || []).slice(0, 5);
  if (results.length === 0) throw new Error('No search results from Brave');
  console.log(`Found ${results.length} results`);
  return { query, results };
}

async function generateDraft(query, searchResults) {
  const snippets = searchResults
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.description || ''}`)
    .join('\n\n');

  console.log('Asking Claude to draft blog post...');

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
    system: `You are the editor of Old Oak Town (oldoaktown.co.uk), a hyperlocal news site covering the Old Oak Common and Park Royal regeneration in West London. Write in a warm, authoritative community voice: informed but accessible. Your readers are local residents, business owners, and regeneration watchers.`,
    messages: [
      {
        role: 'user',
        content: `Based on these recent search results, write a blog post draft.

SEARCH QUERY: ${query}

SEARCH RESULTS:
${snippets}

Return a JSON object with EXACTLY these fields (no markdown, raw JSON only):
{
  "title": "compelling headline under 70 chars",
  "slug": "url-friendly-slug",
  "meta_description": "SEO meta under 155 chars",
  "category": "one of: News | Development | Community | Transport | Business | Planning",
  "tags": ["tag1", "tag2", "tag3"],
  "is_breaking": false,
  "body": "Full HTML body (600-900 words). Use <h2>, <p>, <ul>/<li>. No html/body wrapper. Engaging intro, 2-3 sections with subheadings, community angle, what this means for residents.",
  "image_prompt": "Detailed prompt for a header image (scene, style, mood)",
  "needs_voice": false,
  "editor_note": "One sentence: what to verify or watch out for",
  "source_url": "URL of the most relevant source"
}`,
      },
    ],
  });

  const raw = response.content[0].text.trim();
  let draft;
  try {
    draft = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]+\}/);
    if (!match) throw new Error(`Claude returned non-JSON: ${raw.substring(0, 200)}`);
    draft = JSON.parse(match[0]);
  }

  draft.slug = draft.slug || slugify(draft.title);
  return draft;
}

async function saveDraft(draft) {
  console.log('Saving draft to Supabase...');

  const { data, error } = await supabase
    .from('blog_drafts')
    .insert([
      {
        title: draft.title,
        slug: draft.slug,
        meta_description: draft.meta_description || null,
        category: draft.category || 'News',
        tags: draft.tags || [],
        is_breaking: draft.is_breaking || false,
        body: draft.body,
        image_prompt: draft.image_prompt || null,
        needs_voice: draft.needs_voice || false,
        editor_note: draft.editor_note || null,
        source_url: draft.source_url || null,
        status: 'draft',
        week_number: weekNumber(),
      },
    ])
    .select()
    .single();

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  console.log(`Draft saved — id: ${data.id}`);
  return data;
}

async function emailAdmin(draft, record) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.ADMIN_EMAIL) {
    console.log('Email skipped — SMTP env vars not set');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const siteUrl = (process.env.SITE_URL || 'https://www.oldoaktown.co.uk').replace(/\/$/, '');

  await transporter.sendMail({
    from: `"Old Oak Town Bot" <${process.env.SMTP_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `New Blog Draft: ${draft.title}`,
    html: `
      <h2>New Blog Post Draft — Week ${weekNumber()}</h2>
      <p><strong>Title:</strong> ${draft.title}</p>
      <p><strong>Category:</strong> ${draft.category} | <strong>Slug:</strong> ${draft.slug}</p>
      <p><strong>Meta:</strong> ${draft.meta_description}</p>
      <p><strong>Tags:</strong> ${(draft.tags || []).join(', ')}</p>
      <p><strong>Editor note:</strong> ${draft.editor_note || '—'}</p>
      <p><strong>Source:</strong> <a href="${draft.source_url}">${draft.source_url}</a></p>
      <hr>
      <h3>Body preview:</h3>
      <div style="background:#f9f9f9;padding:16px;border-radius:6px">
        ${draft.body.substring(0, 800)}...
      </div>
      <hr>
      <p><strong>Image prompt:</strong> ${draft.image_prompt || '—'}</p>
      <p><a href="${siteUrl}/admin/" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Review in Admin Dashboard</a></p>
      <p style="color:#888;font-size:12px">Draft ID: ${record.id}</p>
    `,
  });

  console.log(`Email sent to ${process.env.ADMIN_EMAIL}`);
}

async function main() {
  console.log('Old Oak Town — Blog Post Generator starting...');
  const { query, results } = await searchLocalNews();
  const draft = await generateDraft(query, results);
  console.log(`Draft title: "${draft.title}"`);
  const record = await saveDraft(draft);
  await emailAdmin(draft, record);
  console.log('Done.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
