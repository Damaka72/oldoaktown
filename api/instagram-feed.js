// api/instagram-feed.js
// Returns the latest posts from the @oldoaktown Instagram account so the
// homepage "Latest from @oldoaktown" grid shows REAL posts instead of
// hardcoded placeholders.
//
// Uses the official Instagram API with Instagram Login (Business/Creator
// accounts). The old Instagram Basic Display API was shut down by Meta in
// December 2024, so this route targets graph.instagram.com/me/media with a
// long-lived access token.
//
// Required env var:
//   INSTAGRAM_ACCESS_TOKEN   Long-lived token (~60 day life — see refresh note)
//
// Setup (one time):
//   1. Create a Meta app at https://developers.facebook.com/apps
//   2. Add the "Instagram" product, connect the @oldoaktown Business account
//   3. Generate a long-lived user access token with the
//      instagram_business_basic scope
//   4. Set INSTAGRAM_ACCESS_TOKEN in Vercel/Netlify env vars
//
// Token refresh: long-lived tokens last ~60 days and can be refreshed before
// expiry by calling:
//   GET https://graph.instagram.com/refresh_access_token
//       ?grant_type=ig_refresh_token&access_token=CURRENT_TOKEN
// A scheduled GitHub Action (monthly) can automate this — ask if you want it.
//
// This endpoint NEVER hard-fails: if the token is missing or Instagram is
// unreachable it returns { success:false, posts:[] } with HTTP 200 so the
// frontend keeps its static fallback grid and the page never breaks.

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

// In-memory cache — shared across warm serverless invocations to stay well
// within Instagram's rate limits and keep the homepage fast.
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let cache = { at: 0, posts: null };

// Pick the best image URL for a post (handles image, video and carousel).
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

// Trim a caption down to a short, single-line overlay label.
function shortCaption(caption) {
  if (!caption) return '';
  const firstLine = caption.split('\n')[0].trim();
  const clean = firstLine.replace(/\s+/g, ' ');
  return clean.length > 90 ? clean.slice(0, 87).trimEnd() + '…' : clean;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limit = Math.min(parseInt(req.query?.limit, 10) || 6, 12);
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;

  // Not configured yet — tell the frontend to keep its fallback grid.
  if (!token) {
    return res.status(200).json({
      success: false,
      configured: false,
      posts: [],
      hint: 'Set INSTAGRAM_ACCESS_TOKEN in env vars to enable the live feed.',
    });
  }

  // Serve from cache when fresh.
  if (cache.posts && Date.now() - cache.at < CACHE_TTL_MS) {
    return res.status(200).json({
      success: true,
      cached: true,
      posts: cache.posts.slice(0, limit),
    });
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
      // Serve stale cache if we have it, otherwise an empty (graceful) list.
      if (cache.posts) {
        return res.status(200).json({ success: true, stale: true, posts: cache.posts.slice(0, limit) });
      }
      return res.status(200).json({ success: false, posts: [], error: detail });
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

    return res.status(200).json({ success: true, posts: posts.slice(0, limit) });
  } catch (err) {
    console.error('Instagram feed exception:', err);
    if (cache.posts) {
      return res.status(200).json({ success: true, stale: true, posts: cache.posts.slice(0, limit) });
    }
    return res.status(200).json({ success: false, posts: [], error: err.message });
  }
};
