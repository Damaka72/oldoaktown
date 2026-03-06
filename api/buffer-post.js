/**
 * Old Oak Town — PostEverywhere.ai REST API Proxy
 * POST /api/buffer-post
 *
 * Routes each post to the correct PostEverywhere account by platform.
 *
 * Required env var: POSTEVERYWHERE_API_KEY
 *
 * Account IDs: integer IDs from your PostEverywhere connected accounts.
 * Run GET /api/get-pe-accounts to look them up, then fill in below.
 */

const PE_API_BASE = 'https://app.posteverywhere.ai/api/v1';

// Fill these in with the integer account IDs from your PostEverywhere dashboard.
// Hit GET /api/get-pe-accounts to list all connected accounts with their IDs.
const ACCOUNT_IDS = {
  facebook:  null,  // e.g. 12
  instagram: null,  // e.g. 34
  linkedin:  null,  // e.g. 56
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = req.headers['x-pe-key'] || process.env.POSTEVERYWHERE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'No PostEverywhere API key — set POSTEVERYWHERE_API_KEY in Vercel env vars or enter it in Settings' });
  }

  const { text, scheduledAt, platform, day, mediaUrl } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing required field: text' });

  const platformKey = (platform || '').toLowerCase();
  const accountId = ACCOUNT_IDS[platformKey];
  if (!accountId) {
    return res.status(400).json({
      error: `Unknown or unconfigured platform: "${platform}". Must be linkedin, instagram, or facebook, and the account ID must be set in api/buffer-post.js.`
    });
  }

  // Instagram requires at least one media item — skip if no URL was provided
  if (platformKey === 'instagram' && !mediaUrl) {
    return res.status(200).json({
      success: false,
      skipped: true,
      platform: platformKey,
      reason: 'Instagram posts require an image or video. Add a photo/video URL to the card and re-send.',
      day
    });
  }

  try {
    // If no scheduled time provided, default to 1 hour from now
    const dueAt = scheduledAt || new Date(Date.now() + 3600 * 1000).toISOString();

    // LinkedIn hard cap
    const LINKEDIN_CHAR_LIMIT = 1248;
    const postText = platformKey === 'linkedin' && text.length > LINKEDIN_CHAR_LIMIT
      ? text.slice(0, LINKEDIN_CHAR_LIMIT - 1) + '…'
      : text;

    const body = {
      content: postText,
      account_ids: [accountId],
      scheduled_at: dueAt,
      timezone: 'Europe/London',
    };

    if (mediaUrl) {
      body.media_url = mediaUrl;
    }

    const postRes = await fetch(`${PE_API_BASE}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const postData = await postRes.json();
    console.log(`PostEverywhere [${platformKey}] response:`, JSON.stringify(postData).slice(0, 300));

    if (!postRes.ok) {
      return res.status(502).json({ error: 'PostEverywhere API error', details: postData });
    }

    const postId = postData?.id;
    if (!postId) {
      return res.status(502).json({ error: 'PostEverywhere returned no post ID', details: postData });
    }

    console.log(`✓ ${platformKey} post scheduled: ${postId} | ${day}`);

    return res.status(200).json({
      success: true,
      postId,
      scheduledAt: dueAt,
      platform: platformKey,
      day
    });

  } catch (err) {
    console.error('PostEverywhere proxy error:', err);
    return res.status(500).json({ error: 'Internal proxy error', message: err.message });
  }
}
