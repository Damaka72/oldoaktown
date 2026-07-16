/**
 * News Publisher — Old Oak Town
 *
 * Closes the loop between the content curation pipeline and the live site.
 * Reads the latest curator digest (data/curator-digest/YYYY-MM-DD.json),
 * formats its top picks into the schema the homepage actually reads
 * (data/news.json), merges with what's already published, dedupes, and
 * caps the list so it doesn't grow forever.
 *
 * Run: node scripts/publish-news.js
 * Schedule: Daily via GitHub Actions, right after content-curator.js
 */

const fs = require('fs');
const path = require('path');

const DIGEST_DIR = path.join(__dirname, '../data/curator-digest');
const NEWS_FILE = path.join(__dirname, '../data/news.json');
const MAX_ARTICLES = 24;
const MAX_AGE_DAYS = 90; // curator scores by keyword relevance, not recency —
                          // without this, old explainer/reference articles
                          // (e.g. a 2019 HS2 design page) would get published
                          // as if they were today's news.

// Category → display label + fallback image, reused from the site's own
// existing fallback cards so newly published articles look consistent.
const CATEGORY_MAP = {
  hs2: { label: 'HS2 Updates', image: 'https://images.unsplash.com/photo-1580757468214-c73f7062a5cb?w=600&h=400&fit=crop' },
  transport: { label: 'Transport', image: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&h=400&fit=crop' },
  construction: { label: 'Planning & Development', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop' },
  housing: { label: 'Housing', image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=400&fit=crop' },
  community: { label: 'Community', image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=400&fit=crop' },
  employment: { label: 'Employment', image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&h=400&fit=crop' },
  default: { label: 'News', image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=400&fit=crop' },
};

function categorize(article) {
  const text = `${article.title} ${article.contentSnippet || ''}`.toLowerCase();
  const cat = (article.source && article.source.category) || '';
  if (CATEGORY_MAP[cat]) return CATEGORY_MAP[cat];
  if (text.includes('hs2')) return CATEGORY_MAP.hs2;
  if (text.includes('housing') || text.includes('affordable home')) return CATEGORY_MAP.housing;
  if (text.includes('job') || text.includes('employment')) return CATEGORY_MAP.employment;
  if (text.includes('transport') || text.includes('elizabeth line') || text.includes('bus')) return CATEGORY_MAP.transport;
  if (text.includes('planning') || text.includes('opdc') || text.includes('development')) return CATEGORY_MAP.construction;
  if (text.includes('community') || text.includes('resident')) return CATEGORY_MAP.community;
  return CATEGORY_MAP.default;
}

function toISODate(publishDate) {
  const d = publishDate ? new Date(publishDate) : new Date();
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  return d.toISOString().split('T')[0];
}

function latestDigestFile() {
  if (!fs.existsSync(DIGEST_DIR)) return null;
  const files = fs.readdirSync(DIGEST_DIR).filter(f => f.endsWith('.json')).sort();
  return files.length ? path.join(DIGEST_DIR, files[files.length - 1]) : null;
}

function formatArticle(pick) {
  const { label, image } = categorize(pick);
  const bodyText = (pick.content || pick.contentSnippet || pick.excerpt || '').trim();
  const sourceName = (pick.source && pick.source.name) || 'Old Oak Town';
  return {
    id: pick.id || `auto-${Date.now()}`,
    title: pick.title,
    excerpt: (pick.contentSnippet || bodyText).slice(0, 200).trim(),
    category: label,
    date: toISODate(pick.publishDate),
    image,
    imageAlt: pick.title,
    body: `<p>${bodyText}</p>` + (pick.url ? `<p><em>Source: <a href="${pick.url}" target="_blank" rel="noopener">${sourceName}</a></em></p>` : ''),
    author: 'Old Oak Town',
  };
}

function main() {
  const digestPath = latestDigestFile();
  if (!digestPath) { console.log('No curator digest found — nothing to publish.'); return; }

  const digest = JSON.parse(fs.readFileSync(digestPath, 'utf8'));
  const picks = digest.topPicks || [];
  if (!picks.length) { console.log('Digest has no top picks — nothing to publish.'); return; }

  const existing = fs.existsSync(NEWS_FILE)
    ? JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8'))
    : { articles: [] };

  const existingIds = new Set(existing.articles.map(a => a.id));
  const now = Date.now();
  const isRecent = (p) => {
    const d = new Date(p.publishDate);
    if (isNaN(d.getTime())) return false;
    return (now - d.getTime()) / 86400000 <= MAX_AGE_DAYS;
  };

  const stale = picks.filter(p => !existingIds.has(p.id) && !isRecent(p));
  const newArticles = picks
    .filter(p => !existingIds.has(p.id) && isRecent(p))
    .map(formatArticle);

  stale.forEach(p => console.log(`  (skipped, too old to be "news"): ${p.title}`));

  if (!newArticles.length) {
    console.log('No fresh, unpublished top picks today. Nothing new.');
    return;
  }

  const merged = [...newArticles, ...existing.articles]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, MAX_ARTICLES);

  const output = { articles: merged, total: merged.length, source: 'auto', lastPublished: new Date().toISOString() };
  fs.writeFileSync(NEWS_FILE, JSON.stringify(output, null, 2));
  console.log(`Published ${newArticles.length} new article(s). news.json now has ${merged.length} total.`);
  newArticles.forEach(a => console.log(`  + ${a.title}`));
}

main();
