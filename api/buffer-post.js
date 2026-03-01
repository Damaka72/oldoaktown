/**
 * Old Oak Town — Buffer GraphQL Proxy
 * POST /api/buffer-post
 *
 * Routes each post to the correct Buffer channel by platform.
 * Required env var: BUFFER_API_KEY
 */

const BUFFER_API = 'https://api.buffer.com/graphql';

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

  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'BUFFER_API_KEY not configured in Vercel environment variables' });
  }

  const { text, scheduledAt, platform, day } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing required field: text' });

  const platformKey = (platform || '').toLowerCase();
  const channelId = CHANNEL_IDS[platformKey];
  if (!channelId) {
    return res.status(400).json({ 
      error: `Unknown platform: "${platform}". Must be linkedin, instagram, or facebook.` 
    });
  }

  try {
    const mutation = `
      mutation CreatePost($input: PostCreateInput!) {
        postCreate(input: $input) {
          post { id text status scheduledAt }
          errors { message code }
        }
      }
    `;

    const variables = {
      input: {
        channelId,
        content: { text },
        scheduling: scheduledAt
          ? { scheduledAt, type: 'SCHEDULED' }
          : { type: 'QUEUE' }
      }
    };

    const postRes = await fetch(BUFFER_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: mutation, variables })
    });

    const postData = await postRes.json();
    console.log(`Buffer [${platformKey}] response:`, JSON.stringify(postData).slice(0, 300));

    if (postData.errors) {
      return res.status(502).json({ error: 'Buffer mutation error', details: postData.errors });
    }

    const postErrors = postData?.data?.postCreate?.errors;
    if (postErrors?.length) {
      return res.status(502).json({ error: 'Buffer rejected post', details: postErrors });
    }

    const created = postData?.data?.postCreate?.post;
    console.log(`✓ ${platformKey} post queued: ${created?.id} | ${day}`);

    return res.status(200).json({
      success: true,
      postId: created?.id,
      status: created?.status,
      scheduledAt: created?.scheduledAt,
      platform: platformKey,
      day
    });

  } catch (err) {
    console.error('Buffer proxy error:', err);
    return res.status(500).json({ error: 'Internal proxy error', message: err.message });
  }
}
