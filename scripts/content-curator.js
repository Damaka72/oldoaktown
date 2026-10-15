/**
 * Content Curator Agent — Old Oak Town
 *
 * Runs after RSS aggregation. Scores review-queue articles by local
 * relevance, then uses Claude to add editorial context for the top picks.
 * Outputs a prioritised digest JSON for the admin review UI.
 *
 * Run: node scripts/content-curator.js
 * Schedule: Daily via GitHub Actions (30 min after rss-aggregation)
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const REVIEW_QUEUE_DIR = path.join(__dirname, '../data/review-queue');
const DIGEST_DIR = path.join(__dirname, '../data/curator-digest');

// Keyword scoring weights — higher = more locally relevant
const KEYWORD_SCORES = {
  'old oak': 5, 'old oak common': 5, 'park royal': 5, 'opdc': 5, 'hs2': 5,
  'elizabeth line': 3, 'acton': 3, 'willesden': 3, 'harlesden': 3,
  'regeneration': 3, 'planning application': 3, 'housing': 3,
  'construction': 1, 'transport': 1, 'community': 1, 'london': 1,
  'infrastructure': 1, 'station': 1, 'development': 1,
};

const SOURCE_PRIORITY_BOOST = { high: 5, medium: 2, low: 0 };

const NEWS_FILE = path.join(__dirname, '../data/news.json');
const CANDIDATE_WINDOW_DAYS = 21;  // only articles this fresh can be picked
const PRUNE_AFTER_DAYS = 60;       // older queue files are deleted (they live in git history)
const MIN_RELEVANCE = 5;           // keyword score floor: must clearly be about the area
const TOP_N = 6;                   // picks per run (publish-news publishes them all)

function relevanceScore(article) {
  const text = `${article.title} ${article.contentSnippet || ''} ${article.content || ''}`.toLowerCase();
  let score = 0;
  for (const [kw, weight] of Object.entries(KEYWORD_SCORES)) {
    if (text.includes(kw)) score += weight;
  }
  return score;
}

// Strong local anchors: the story must actually be about our area. "HS2" alone
// is not enough (most HS2 news is Midlands/national) and a bare "old oak" also
// matches "900-year-old oak tree", so both need extra context.
const LOCAL_ANCHOR = /(old oak (common|north|south|town|lane|road|and park royal)|park royal|opdc|north acton|willesden junction|harlesden|wormwood scrubs|elizabeth line|west london|ealing|brent council)/;
const LONDON_CONTEXT = /(london|euston|northolt|old oak|park royal|acton|west london)/;

function isLocalStory(article) {
  const text = `${article.title} ${article.contentSnippet || ''}`.toLowerCase();
  if (/oak tree|year-old oak/.test(text)) return false;
  if (LOCAL_ANCHOR.test(text)) return true;
  if (/\bold oak\b/.test(text)) return true;
  if (/\bhs2\b/.test(text) && LONDON_CONTEXT.test(text)) return true;
  return false;
}

function ageDays(article) {
  return (Date.now() - new Date(article.publishDate).getTime()) / 86400000;
}

// Relevance decides *whether* an article qualifies; recency decides the order.
function scoreArticle(article) {
  let score = relevanceScore(article);
  score += SOURCE_PRIORITY_BOOST[article.source?.priority] || 0;
  const age = ageDays(article);
  if (age < 1) score += 12;
  else if (age < 3) score += 9;
  else if (age < 7) score += 6;
  else if (age < 14) score += 3;
  return score;
}

// Google News serves the same story from several outlets as "Headline - Outlet".
function titleKey(title) {
  return String(title || '').toLowerCase().replace(/\s+-\s+[^-]+$/, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 8).join(' ');
}

function readPublishedIds() {
  try {
    const n = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8'));
    return new Set((n.articles || []).map(a => a.id));
  } catch { return new Set(); }
}

function pruneQueue(articles) {
  let removed = 0;
  for (const a of articles) {
    const d = ageDays(a);
    if (isNaN(d) || d > PRUNE_AFTER_DAYS) {
      try { fs.unlinkSync(path.join(REVIEW_QUEUE_DIR, a._filename)); removed++; } catch {}
    }
  }
  return removed;
}

function readReviewQueue() {
  if (!fs.existsSync(REVIEW_QUEUE_DIR)) return [];
  return fs.readdirSync(REVIEW_QUEUE_DIR)
    .filter(f => f.endsWith('.json'))
    .map(filename => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(REVIEW_QUEUE_DIR, filename), 'utf8'));
        return { ...data, _filename: filename };
      } catch { return null; }
    })
    .filter(Boolean);
}

async function generateEditorialContext(article) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    system: 'You are a concise editorial assistant for a hyperlocal community news site.',
    messages: [{
      role: 'user',
      content: `You edit Old Oak Town — hyperlocal news for Old Oak Common HS2 regeneration, West London (Local Plan targets: at least 19,850 homes and 36,350 jobs by 2038). Audience: young (39% 20–39), diverse local residents.

ARTICLE:
Title: ${article.title}
Source: ${article.source?.name}
Snippet: ${article.contentSnippet}

Write a 2–3 sentence editorial note (max 60 words) that: (1) explains why this matters to Old Oak residents, (2) suggests local context to add, (3) flags any fact-check priorities. Warm, direct tone.`
    }],
  });
  return response.content[0].text.trim();
}

async function main() {
  console.log('🎯 Content Curator Agent starting...');
  if (!fs.existsSync(DIGEST_DIR)) fs.mkdirSync(DIGEST_DIR, { recursive: true });

  const articles = readReviewQueue();
  console.log(`📥 ${articles.length} articles in review queue`);
  if (articles.length === 0) { console.log('✅ Nothing to curate.'); return; }

  const publishedIds = readPublishedIds();
  const seenTitles = new Set();

  const eligible = articles
    .filter(a => !isNaN(ageDays(a)) && ageDays(a) <= CANDIDATE_WINDOW_DAYS)
    .filter(a => !publishedIds.has(a.id))
    .filter(a => relevanceScore(a) >= MIN_RELEVANCE && isLocalStory(a));

  const scored = eligible
    .map(a => ({ ...a, _score: scoreArticle(a) }))
    .sort((a, b) => b._score - a._score)
    .filter(a => {                       // one article per story
      const k = titleKey(a.title);
      if (seenTitles.has(k)) return false;
      seenTitles.add(k);
      return true;
    });

  console.log(`Found ${eligible.length} fresh, relevant, unpublished candidates (<=${CANDIDATE_WINDOW_DAYS} days)`);

  const topPicks = scored.slice(0, TOP_N);
  const skipped = scored.slice(TOP_N);
  const pruned = pruneQueue(articles);
  if (pruned) console.log(`Pruned ${pruned} queue files older than ${PRUNE_AFTER_DAYS} days`);

  console.log(`\n⭐ Generating editorial context for top ${topPicks.length} articles...`);
  for (const article of topPicks) {
    try {
      console.log(`  💬 ${article.title.substring(0, 60)}...`);
      article._editorialNote = await generateEditorialContext(article);
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`  ⚠️  ${err.message}`);
      article._editorialNote = null;
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const digest = {
    date: today,
    generatedAt: new Date().toISOString(),
    stats: { totalInQueue: articles.length, candidates: eligible.length, topPicks: topPicks.length, skipped: skipped.length, pruned },
    topPicks: topPicks.map(({ _filename, _score, _editorialNote, ...a }) => ({
      ...a, curatorScore: _score, editorialNote: _editorialNote,
    })),
    skipped: skipped.map(({ _filename, _score, _editorialNote, ...a }) => ({
      id: a.id, title: a.title, source: a.source?.name, curatorScore: _score,
    })),
  };

  const digestPath = path.join(DIGEST_DIR, `${today}.json`);
  fs.writeFileSync(digestPath, JSON.stringify(digest, null, 2));
  console.log(`\n✅ Digest saved: ${digestPath}`);
  console.log('📋 Top picks:');
  topPicks.forEach((a, i) => console.log(`  ${i + 1}. [${a._score}pts] ${a.title.substring(0, 70)}`));
}

main().catch(err => { console.error('❌ Fatal error:', err); process.exit(1); });
