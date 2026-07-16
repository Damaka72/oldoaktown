// netlify/functions/instagram-feed.js
// Netlify mirror of api/instagram-feed.js. Returns the latest @oldoaktown
// Instagram posts for the homepage grid. Uses the Netlify Functions handler
// signature (event) instead of Express (req / res).
//
// Required env var: INSTAGRAM_ACCESS_TOKEN (long-lived token from the
// Instagram API with Instagram Login). See api/instagram-feed.js for the
// full setup and token-refresh notes.
//
// Never hard-fails: missing token or an Instagram error returns
// { success:false, posts:[] } with HTTP 200 so the frontend keeps its
// static fallback grid.

const GRAPH_BASE = 'https://graph.instagram.com';
const FIELDS = [
  'id',
  'caption',
  'media_type',
  'media_url',
  'permalink',
  'thumbnail_url',
  'timestamp',
  'children{media_url,thumbnail_url,media_type}',
].join(',');

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let cache = { at: 0, posts: null };

function imageForPost(item) {
  if (item.media_type === 'VIDEO') {
    return item.thumbnail_url || item.media_url || null;
  }
  if (item.media_type === 'CAROUSEL_ALBUM') {
    const first = item.children && item.children.data && item.children.data[0];
    if (first) {
      return first.media_type === 'VIDEO'
        ? first.thumbnail_url || first.media_url || null
        : first.media_url || first.thumbnail_url || null;
    }
    return item.media_url || item.thumbnail_url || null;
  }
  return item.media_url || item.thumbnail_url || null;
}

function shortCaption(caption) {
  if (!caption) return '';
  const firstLine = caption.split('\n')[0].trim();
  const clean = firstLine.replace(/\s+/g, ' ');
  return clean.length > 90 ? clean.slice(0, 87).trimEnd() + '…' : clean;
}

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const limit = Math.min(parseInt(event.queryStringParameters?.limit, 10) || 6, 12);
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!token) {
    return json(200, {
      success: false,
      configured: false,
      posts: [],
      hint: 'Set INSTAGRAM_ACCESS_TOKEN in env vars to enable the live feed.',
    });
  }

  if (cache.posts && Date.now() - cache.at < CACHE_TTL_MS) {
    return json(200, { success: true, cached: true, posts: cache.posts.slice(0, limit) });
  }

  try {
    const url =
      `${GRAPH_BASE}/me/media?fields=${encodeURIComponent(FIELDS)}` +
      `&limit=${limit}&access_token=${encodeURIComponent(token)}`;

    const igRes = await fetch(url);
    const raw = await igRes.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }

    if (!igRes.ok || !data || data.error) {
      const detail = data?.error?.message || raw.slice(0, 200);
      console.error('Instagram feed error:', igRes.status, detail);
      if (cache.posts) return json(200, { success: true, stale: true, posts: cache.posts.slice(0, limit) });
      return json(200, { success: false, posts: [], error: detail });
    }

    const posts = (data.data || [])
      .map((item) => {
        const image = imageForPost(item);
        if (!image) return null;
        return {
          id: item.id,
          image,
          permalink: item.permalink,
          caption: shortCaption(item.caption),
          mediaType: item.media_type,
          timestamp: item.timestamp,
        };
      })
      .filter(Boolean);

    cache = { at: Date.now(), posts };

    return json(200, { success: true, posts: posts.slice(0, limit) });
  } catch (err) {
    console.error('Instagram feed exception:', err);
    if (cache.posts) return json(200, { success: true, stale: true, posts: cache.posts.slice(0, limit) });
    return json(200, { success: false, posts: [], error: err.message });
  }
};
