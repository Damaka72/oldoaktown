/**
 * Old Oak Town — Buffer GraphQL Proxy
 * POST /api/buffer-post
 *
 * Required env var: BUFFER_API_KEY
 */

const BUFFER_API = 'https://api.buffer.com';
const CHANNEL_ID = '69a213f74be271803d75d07e';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) {
    console.error('BUFFER_API_KEY environment variable is not set');
    return res.status(500).json({ error: 'BUFFER_API_KEY not configured in Vercel environment variables' });
  }

  const { text, scheduledAt, platform, day } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing required field: text' });

  try {
    // Step 1: Get organisation ID
    const orgRes = await fetch(BUFFER_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: `query { account { organizations { id name } } }`
      })
    });

    const orgData = await orgRes.json();
    console.log('Buffer org response status:', orgRes.status);
    console.log('Buffer org data:', JSON.stringify(orgData).slice(0, 300));

    if (!orgRes.ok) {
      return res.status(502).json({
        error: 'Buffer API returned non-200',
        status: orgRes.status,
        details: orgData
      });
    }

    if (orgData.errors) {
      return res.status(502).json({ error: 'Buffer auth/query error', details: orgData.errors });
    }

    const orgId = orgData?.data?.account?.organizations?.[0]?.id;
    if (!orgId) {
      return res.status(502).json({
        error: 'Could not retrieve Buffer organisation ID',
        received: orgData
      });
    }

    // Step 2: Create the post
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
        channelId: CHANNEL_ID,
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
    console.log('Buffer post response status:', postRes.status);
    console.log('Buffer post data:', JSON.stringify(postData).slice(0, 300));

    if (postData.errors) {
      return res.status(502).json({ error: 'Buffer mutation error', details: postData.errors });
    }

    const postErrors = postData?.data?.postCreate?.errors;
    if (postErrors?.length) {
      return res.status(502).json({ error: 'Buffer rejected post', details: postErrors });
    }

    const created = postData?.data?.postCreate?.post;
    console.log(`✓ Buffer post created: ${created?.id} | ${platform} | ${day}`);

    return res.status(200).json({
      success: true,
      postId: created?.id,
      status: created?.status,
      scheduledAt: created?.scheduledAt,
      platform,
      day
    });

  } catch (err) {
    console.error('Buffer proxy error:', err);
    return res.status(500).json({ error: 'Internal proxy error', message: err.message });
  }
}
