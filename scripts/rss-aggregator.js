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
    name: 'Railway PRO',
    url: 'https://www.railwaypro.com/feed/',
    category: 'transport',
    priority: 'medium',
    tags: ['transport', 'railway', 'infrastructure'],
    filter: ['old oak', 'hs2', 'elizabeth line']
  },
  {
    name: 'OPDC Planning',
    url: 'https://www.london.gov.uk/opdc/feeds/news.xml',
    category: 'planning',
    priority: 'high',
    tags: ['planning', 'development', 'opdc']
  }
];

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
