/**
 * Old Oak Town — Buffer REST API Proxy
 * POST /api/buffer-post
 *
 * Routes each post to the correct Buffer channel by platform.
 * Channel IDs are read from environment variables:
 *   BUFFER_CHANNEL_FACEBOOK, BUFFER_CHANNEL_INSTAGRAM, BUFFER_CHANNEL_LINKEDIN,
 *   BUFFER_CHANNEL_TWITTER, BUFFER_CHANNEL_TIKTOK, BUFFER_CHANNEL_PINTEREST,
 *   BUFFER_CHANNEL_YOUTUBE
 *
 * Required env var: BUFFER_API_KEY
 */

const BUFFER_GRAPHQL = 'https://api.buffer.com/graphql';

// Channel IDs loaded from env vars per platform.
// Falls back to legacy hardcoded IDs for FB/IG/LI (oldoaktown defaults).
function getChannelId(platformKey) {
  const envKey = `BUFFER_CHANNEL_${platformKey.toUpperCase()}`;
  if (process.env[envKey]) return process.env[envKey];
  // Legacy fallback for oldoaktown original channels
  const legacy = {
    linkedin:  '69a213f74be271803d75d07e',
    instagram: '69aca3e03f3b94a1212866bf',
    facebook:  '69a4431d3f3b94a12105386d',
  };
  return legacy[platformKey] || null;
}

// Platforms that require at least one media item
const REQUIRES_MEDIA = new Set(['instagram', 'tiktok', 'pinterest', 'youtube']);

// Per-platform character limits (Buffer enforces some server-side too)
const CHAR_LIMITS = {
  twitter:   280,
  linkedin:  1248,
  instagram: 2200,
  facebook:  63206,
  tiktok:    2200,
  pinterest: 500,
  youtube:   5000,
};

// Platform-specific metadata for Buffer's GraphQL API
function buildMetadata(platformKey) {
  switch (platformKey) {
    case 'facebook':  return { facebook:  { type: 'post' } };
    case 'instagram': return { instagram: { type: 'post', shouldShareToFeed: true } };
    case 'tiktok':    return { tiktok:    { privacy: 'PUBLIC_TO_EVERYONE' } };
    default:          return undefined;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = req.headers['x-buffer-key'] || process.env.BUFFER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'No Buffer API key — set BUFFER_API_KEY in env vars' });
  }

  const { text, scheduledAt, platform, day, mediaUrl } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing required field: text' });

  const platformKey = (platform || '').toLowerCase();
  const channelId = getChannelId(platformKey);
  if (!channelId) {
    return res.status(400).json({
      error: `Unknown platform: "${platform}". Set BUFFER_CHANNEL_${(platform || '').toUpperCase()} in env vars.`
    });
  }

  // Platforms that require media — skip gracefully if no URL provided
  if (REQUIRES_MEDIA.has(platformKey) && !mediaUrl) {
    return res.status(200).json({
      success: false,
      skipped: true,
      platform: platformKey,
      reason: `${platform} posts require an image or video. Add a media URL to the card and re-send.`,
      day
    });
  }

  try {
    const dueAt = scheduledAt || new Date(Date.now() + 3600 * 1000).toISOString();

    // Enforce character limits
    const limit = CHAR_LIMITS[platformKey];
    const postText = limit && text.length > limit
      ? text.slice(0, limit - 1) + '…'
      : text;

    const mutation = `
      mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          ... on PostActionSuccess {
            post { id }
          }
          ... on MutationError {
            message
          }
        }
      }
    `;

    const metadata = buildMetadata(platformKey);

    const variables = {
      input: {
        channelId,
        text: postText,
        schedulingType: 'scheduled',
        dueAt,
        ...(metadata && { metadata }),
        ...(mediaUrl && { assets: { images: [{ url: mediaUrl }] } }),
      }
    };

    const postRes = await fetch(BUFFER_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: mutation, variables })
    });

    const postData = await postRes.json();
    console.log(`Buffer [${platformKey}] response:`, JSON.stringify(postData).slice(0, 300));

    if (!postRes.ok) {
      const detail = postData?.message || postData?.errors?.[0]?.message || JSON.stringify(postData).slice(0, 200);
      return res.status(502).json({ error: `Buffer API error (HTTP ${postRes.status}): ${detail}`, details: postData });
    }

    // GraphQL errors land in the errors array even on HTTP 200
    if (postData?.errors?.length) {
      const msg = postData.errors.map(e => e.message).join('; ');
      return res.status(502).json({ error: `Buffer GraphQL error: ${msg}`, details: postData.errors });
    }

    const result = postData?.data?.createPost;
    if (result?.message) {
      return res.status(502).json({ error: `Buffer rejected post: ${result.message}`, hint: result.message, details: result });
    }

    const postId = result?.post?.id;
    if (!postId) {
      return res.status(502).json({ error: 'Buffer returned no post ID', details: postData });
    }

    console.log(`✓ ${platformKey} post queued: ${postId} | ${day}`);

    return res.status(200).json({
      success: true,
      postId,
      scheduledAt: dueAt,
      platform: platformKey,
      day
    });

  } catch (err) {
    console.error('Buffer proxy error:', err);
    return res.status(500).json({ error: 'Internal proxy error', message: err.message });
  }
}
