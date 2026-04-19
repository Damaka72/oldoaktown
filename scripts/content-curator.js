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

function scoreArticle(article) {
  const text = `${article.title} ${article.contentSnippet || ''} ${article.content || ''}`.toLowerCase();
  let score = 0;
  for (const [kw, weight] of Object.entries(KEYWORD_SCORES)) {
    if (text.includes(kw)) score += weight;
  }
  score += SOURCE_PRIORITY_BOOST[article.source?.priority] || 0;
  const ageHours = (Date.now() - new Date(article.publishDate).getTime()) / 3600000;
  if (ageHours < 24) score += 3;
  else if (ageHours < 48) score += 1;
  return score;
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
      content: `You edit Old Oak Town — hyperlocal news for Old Oak Common HS2 regeneration, West London (25,500 homes, 65,000 jobs). Audience: young (39% 20–39), diverse local residents.

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

  const scored = articles
    .map(a => ({ ...a, _score: scoreArticle(a) }))
    .sort((a, b) => b._score - a._score);

  const topPicks = scored.slice(0, 5);
  const skipped = scored.slice(5);

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
    stats: { totalInQueue: articles.length, topPicks: topPicks.length, skipped: skipped.length },
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
