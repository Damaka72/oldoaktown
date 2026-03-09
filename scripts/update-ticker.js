/**
 * News Ticker Updater for Old Oak Town
 *
 * Fetches the latest headlines from high-priority RSS sources and updates
 * data/ticker-news.json which is served to the homepage ticker.
 *
 * Run: node scripts/update-ticker.js
 * Schedule: Daily via GitHub Actions (see .github/workflows/daily-ticker-update.yml)
 */

const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser({ timeout: 10000 }); // 10s per feed, prevents hanging

const TICKER_FILE = path.join(__dirname, '../data/ticker-news.json');
const MAX_ITEMS = 10;

// High-priority sources for the ticker (headlines only, no approval needed)
const TICKER_SOURCES = [
  {
    name: 'HS2 Ltd',
    url: 'https://www.hs2.org.uk/feed/',
    category: 'hs2'
  },
  {
    name: 'Old Oak Neighbourhood Forum',
    url: 'http://oldoakneighbourhoodforum.org/feed/',
    category: 'community'
  },
  {
    name: 'OPDC Planning',
    url: 'https://www.london.gov.uk/opdc/feeds/news.xml',
    category: 'planning'
  },
  {
    name: 'Construction Enquirer',
    url: 'https://www.constructionenquirer.com/feed/',
    category: 'construction',
    filter: ['old oak', 'hs2', 'park royal', 'opdc']
  },
  {
    name: 'Railway PRO',
    url: 'https://www.railwaypro.com/feed/',
    category: 'transport',
    filter: ['old oak', 'hs2', 'elizabeth line']
  }
];

function matchesFilter(title, content, filter) {
  if (!filter || filter.length === 0) return true;
  const text = `${title} ${content}`.toLowerCase();
  return filter.some(kw => text.includes(kw.toLowerCase()));
}

function cleanTitle(title) {
  if (!title) return '';
  return title
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchHeadlines(source) {
  console.log(`Fetching ${source.name}...`);
  try {
    const feed = await parser.parseURL(source.url);
    const items = [];

    for (const item of feed.items) {
      const title = cleanTitle(item.title);
      if (!title) continue;
      if (!matchesFilter(title, item.contentSnippet || '', source.filter)) continue;

      items.push({
        title,
        url: item.link || item.guid || null,
        source: source.name,
        category: source.category,
        publishDate: item.pubDate || item.isoDate || new Date().toISOString()
      });
    }

    console.log(`  Found ${items.length} matching headlines`);
    return items;
  } catch (err) {
    console.warn(`  Warning: could not fetch ${source.name}: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('Updating news ticker...');
  console.log(new Date().toISOString());

  const allHeadlines = [];

  for (const source of TICKER_SOURCES) {
    const headlines = await fetchHeadlines(source);
    allHeadlines.push(...headlines);
    // Be respectful — small delay between requests
    await new Promise(r => setTimeout(r, 800));
  }

  if (allHeadlines.length === 0) {
    console.log('No headlines fetched — keeping existing ticker data.');
    process.exit(0);
  }

  // Sort by date (newest first) and take up to MAX_ITEMS
  allHeadlines.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
  const tickerItems = allHeadlines.slice(0, MAX_ITEMS);

  const output = {
    updatedAt: new Date().toISOString(),
    items: tickerItems
  };

  // Ensure data directory exists
  const dataDir = path.dirname(TICKER_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(TICKER_FILE, JSON.stringify(output, null, 2));

  console.log(`Ticker updated with ${tickerItems.length} headlines.`);
  tickerItems.forEach((item, i) => console.log(`  ${i + 1}. ${item.title}`));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
