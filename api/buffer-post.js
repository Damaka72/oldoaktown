/**
 * Old Oak Town — Buffer REST API Proxy
 * POST /api/buffer-post
 *
 * Routes each post to the correct Buffer channel by platform.
 * Uses Buffer's REST API v1 — simple, documented, no GraphQL.
 *
 * Required env var: BUFFER_API_KEY
 */

const BUFFER_REST_API = 'https://api.buffer.com/1/updates/create.json';

const CHANNEL_IDS = {
  linkedin:  '69a213f74be271803d75d07e',
  instagram: '69a43f953f3b94a121052f11',
  facebook:  '69a4431d3f3b94a12105386d',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = req.headers['x-buffer-key'] || process.env.BUFFER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'No Buffer API key — set BUFFER_API_KEY in Vercel env vars or enter it in Settings' });
  }

  const { text, scheduledAt, platform, day, mediaUrl } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing required field: text' });

  const platformKey = (platform || '').toLowerCase();
  const channelId = CHANNEL_IDS[platformKey];
  if (!channelId) {
    return res.status(400).json({
      error: `Unknown platform: "${platform}". Must be linkedin, instagram, or facebook.`
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

    // Buffer REST v1 expects scheduled_at as a Unix timestamp (seconds)
    const scheduledAtUnix = Math.floor(new Date(dueAt).getTime() / 1000);

    const params = new URLSearchParams();
    params.append('profile_ids[]', channelId);
    params.append('text', postText);
    params.append('scheduled_at', scheduledAtUnix.toString());
    if (mediaUrl) {
      params.append('media[photo]', mediaUrl);
    }

    const postRes = await fetch(BUFFER_REST_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: params.toString()
    });

    const postData = await postRes.json();
    console.log(`Buffer [${platformKey}] response:`, JSON.stringify(postData).slice(0, 300));

    if (!postRes.ok) {
      return res.status(502).json({ error: 'Buffer API error', details: postData });
    }

    const created = postData?.updates?.[0];
    if (!created) {
      return res.status(502).json({ error: 'Buffer returned no update', details: postData });
    }

    console.log(`✓ ${platformKey} post queued: ${created.id} | ${day}`);

    return res.status(200).json({
      success: true,
      postId: created.id,
      scheduledAt: dueAt,
      platform: platformKey,
      day
    });

  } catch (err) {
    console.error('Buffer proxy error:', err);
    return res.status(500).json({ error: 'Internal proxy error', message: err.message });
  }
}
