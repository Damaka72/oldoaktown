/**
 * RSS Feed Aggregator for Old Oak Town
 *
 * This script aggregates news from multiple RSS sources related to
 * Old Oak Common development and stores them in a review queue for
 * human approval before publishing.
 *
 * Run: node scripts/rss-aggregator.js
 * Schedule: Daily via cron or GitHub Actions
 */

const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

// Initialize RSS parser
const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['content:encoded', 'contentEncoded'],
      ['description', 'description']
    ]
  }
});

// RSS Feed Sources Configuration
//
// Health notes (checked 2026-10-11):
//  - hs2.org.uk feed is frozen at 2024 and the Old Oak forum feed is empty; both
//    are kept in case they revive (the age gate below drops anything stale).
//  - london.gov.uk/opdc news.xml returns 404 and railwaypro.com blocks bots (403),
//    so both were removed. OPDC/HS2 news is picked up via Google News instead.
//  - Google News queries MUST carry a `when:Nd` window, otherwise Google returns
//    its ten "most relevant" results, which are mostly years old.
const gnews = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-GB&gl=GB&ceid=GB:en`;

const RSS_SOURCES = [
  {
    name: 'HS2 Ltd',
    url: 'https://www.hs2.org.uk/feed/',
    category: 'hs2',
    priority: 'high',
    tags: ['hs2', 'transport', 'infrastructure']
  },
  {
    name: 'Construction Enquirer',
    url: 'https://www.constructionenquirer.com/feed/',
    category: 'construction',
    priority: 'medium',
    tags: ['construction', 'development'],
    filter: ['old oak', 'hs2', 'park royal'] // Only include items with these keywords
  },
  {
    name: 'Old Oak Neighbourhood Forum',
    url: 'http://oldoakneighbourhoodforum.org/feed/',
    category: 'community',
    priority: 'high',
    tags: ['community', 'residents', 'local']
  },
  {
    name: 'Ian Visits',
    url: 'https://www.ianvisits.co.uk/feed/',
    category: 'transport',
    priority: 'medium',
    tags: ['london', 'transport', 'local'],
    filter: ['old oak', 'hs2', 'park royal', 'elizabeth line', 'acton', 'willesden', 'harlesden']
  },
  // Google News search feeds — no API key required
  {
    name: 'Google News — Old Oak Common',
    url: gnews('"Old Oak Common" OR "Park Royal" OR "Old Oak" London when:14d'),
    category: 'general',
    priority: 'high',
    tags: ['news', 'regeneration', 'community']
  },
  {
    name: 'Google News — HS2',
    url: gnews('HS2 "Old Oak" OR Euston when:14d'),
    category: 'hs2',
    priority: 'medium',
    tags: ['hs2', 'transport', 'infrastructure'],
    filter: ['old oak', 'hs2', 'euston', 'park royal']
  },
  {
    name: 'Google News — OPDC & Planning',
    url: gnews('OPDC OR "Old Oak and Park Royal Development Corporation" OR "Old Oak" planning application when:30d'),
    category: 'construction',
    priority: 'high',
    tags: ['planning', 'development', 'opdc']
  },
  {
    name: 'Google News — Housing',
    url: gnews('("Old Oak" OR "Park Royal" OR "North Acton" OR "Willesden Junction") (homes OR housing OR development OR regeneration) when:30d'),
    category: 'housing',
    priority: 'medium',
    tags: ['housing', 'development'],
    filter: ['old oak', 'park royal', 'north acton', 'willesden']
  },
  {
    name: 'Google News — Transport',
    url: gnews('"Elizabeth line" OR "Old Oak Common station" OR "Old Oak" rail when:30d'),
    category: 'transport',
    priority: 'medium',
    tags: ['transport', 'elizabeth line'],
    filter: ['old oak', 'park royal', 'elizabeth line']
  },
  {
    name: 'Google News — Jobs & Business',
    url: gnews('"Park Royal" OR "Old Oak" (jobs OR employment OR business OR industrial OR apprenticeships) when:30d'),
    category: 'employment',
    priority: 'medium',
    tags: ['jobs', 'business', 'employment'],
    filter: ['old oak', 'park royal']
  },
  {
    name: 'Google News — Local Community',
    url: gnews('("Old Oak" OR "Harlesden" OR "Wormwood Scrubs" OR "North Acton") community OR residents OR council when:14d'),
    category: 'community',
    priority: 'medium',
    tags: ['community', 'local'],
    filter: ['old oak', 'harlesden', 'wormwood scrubs', 'north acton']
  }
];

// Anything older than this never enters the queue. It also stops pruned items
// being re-ingested if a feed keeps serving them.
const MAX_ITEM_AGE_DAYS = 45;

// Data directories
const DATA_DIR = path.join(__dirname, '../data');
const REVIEW_QUEUE_DIR = path.join(DATA_DIR, 'review-queue');
const PUBLISHED_DIR = path.join(DATA_DIR, 'published/news');
const ARCHIVE_DIR = path.join(DATA_DIR, 'archive');

// Ensure directories exist
[DATA_DIR, REVIEW_QUEUE_DIR, PUBLISHED_DIR, ARCHIVE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Clean and normalize text content
 */
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract image URL from item
 */
function extractImageUrl(item) {
  // Try media:content first
  if (item.media && item.media.$) {
    return item.media.$.url;
  }

  // Try enclosure
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }

  // Try to find image in content
  const content = item.contentEncoded || item.content || item.description || '';
  const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
  if (imgMatch) {
    return imgMatch[1];
  }

  return null;
}

/**
 * Check if item matches source filters
 */
function matchesFilter(item, filter) {
  if (!filter || filter.length === 0) return true;

  const searchText = `${item.title} ${item.contentSnippet || ''} ${item.content || ''}`.toLowerCase();
  return filter.some(keyword => searchText.includes(keyword.toLowerCase()));
}

/**
 * Check if item already exists in review queue or published
 */
function isDuplicate(itemId) {
  const reviewQueueFiles = fs.existsSync(REVIEW_QUEUE_DIR)
    ? fs.readdirSync(REVIEW_QUEUE_DIR)
    : [];
  const publishedFiles = fs.existsSync(PUBLISHED_DIR)
    ? fs.readdirSync(PUBLISHED_DIR)
    : [];

  return [...reviewQueueFiles, ...publishedFiles].some(file => file.includes(itemId));
}

/**
 * Generate unique ID from URL or title
 */
function generateId(url, title) {
  const source = url || title;
  return source
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .substring(0, 50);
}

/**
 * Fetch and parse single RSS feed
 */
async function fetchFeed(source) {
  console.log(`📡 Fetching ${source.name}...`);

  try {
    const feed = await parser.parseURL(source.url);
    console.log(`✅ Found ${feed.items.length} items from ${source.name}`);

    const processedItems = [];

    for (const item of feed.items) {
      // Apply filter if exists
      if (!matchesFilter(item, source.filter)) {
        continue;
      }

      // Age gate: this is a news site, so skip stale items (and unparseable dates)
      const published = new Date(item.isoDate || item.pubDate || '');
      if (isNaN(published.getTime()) ||
          (Date.now() - published.getTime()) / 86400000 > MAX_ITEM_AGE_DAYS) {
        continue;
      }

      // Generate unique ID
      const itemId = generateId(item.link || item.guid, item.title);

      // Skip if duplicate
      if (isDuplicate(itemId)) {
        continue;
      }

      // Extract and clean content
      const content = item.contentEncoded || item.content || item.description || '';
      const contentSnippet = cleanText(content).substring(0, 300);

      // Build normalized item
      const processedItem = {
        id: itemId,
        title: cleanText(item.title),
        url: item.link || item.guid,
        content: cleanText(content),
        contentSnippet: contentSnippet,
        publishDate: item.pubDate || item.isoDate || new Date().toISOString(),
        author: item.creator || item.author || source.name,
        source: {
          name: source.name,
          url: source.url,
          category: source.category,
          priority: source.priority
        },
        tags: source.tags || [],
        imageUrl: extractImageUrl(item),
        metadata: {
          fetchedAt: new Date().toISOString(),
          status: 'pending_review'
        }
      };

      processedItems.push(processedItem);
    }

    return processedItems;

  } catch (error) {
    console.error(`❌ Error fetching ${source.name}:`, error.message);
    return [];
  }
}

/**
 * Save item to review queue
 */
function saveToReviewQueue(item) {
  const filename = `${item.id}-${Date.now()}.json`;
  const filepath = path.join(REVIEW_QUEUE_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(item, null, 2));
  console.log(`💾 Saved to review queue: ${filename}`);
}

/**
 * Generate daily summary report
 */
function generateSummaryReport(allItems) {
  const report = {
    date: new Date().toISOString(),
    totalItemsFetched: allItems.length,
    bySource: {},
    byCategory: {},
    byPriority: {},
    itemsInReviewQueue: fs.readdirSync(REVIEW_QUEUE_DIR).length
  };

  allItems.forEach(item => {
    // Count by source
    report.bySource[item.source.name] = (report.bySource[item.source.name] || 0) + 1;

    // Count by category
    report.byCategory[item.source.category] = (report.byCategory[item.source.category] || 0) + 1;

    // Count by priority
    report.byPriority[item.source.priority] = (report.byPriority[item.source.priority] || 0) + 1;
  });

  return report;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting RSS aggregation for Old Oak Town');
  console.log('⏰', new Date().toISOString());
  console.log('');

  const allItems = [];

  // Fetch all sources
  for (const source of RSS_SOURCES) {
    const items = await fetchFeed(source);
    allItems.push(...items);

    // Small delay between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('');
  console.log(`📊 Total new items found: ${allItems.length}`);

  // Save items to review queue
  if (allItems.length > 0) {
    console.log('');
    console.log('💾 Saving to review queue...');
    allItems.forEach(item => saveToReviewQueue(item));
  }

  // Generate and save summary report
  const report = generateSummaryReport(allItems);
  const reportPath = path.join(ARCHIVE_DIR, `aggregation-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('');
  console.log('📋 Summary Report:');
  console.log(JSON.stringify(report, null, 2));
  console.log('');
  console.log(`✅ Aggregation complete! ${allItems.length} new items added to review queue.`);
  console.log(`📝 Items pending review: ${report.itemsInReviewQueue}`);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main, fetchFeed };
