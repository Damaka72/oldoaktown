/**
 * Old Oak Town — Buffer GraphQL Proxy
 * POST /api/buffer-post
 *
 * Receives a post payload from the Social Command Centre app
 * and forwards it to Buffer's GraphQL API server-side,
 * avoiding CORS restrictions in the browser.
 *
 * Required env var: BUFFER_API_KEY
 */

const BUFFER_API = 'https://api.buffer.com';
const CHANNEL_ID = '69a213f74be271803d75d07e';

export default async function handler(req, res) {
  // CORS headers so the HTML app can call this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) {
    console.error('BUFFER_API_KEY environment variable not set');
    return res.status(500).json({ error: 'Buffer API key not configured' });
  }

  const { text, scheduledAt, platform, day } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Missing required field: text' });
  }

  // Build the GraphQL mutation to create a post in Buffer
  // Uses createIdea first (drafts) since direct scheduling requires
  // knowing the organisation ID — we fetch that dynamically
  try {
    // Step 1: Get organisation ID
    const orgQuery = await fetch(BUFFER_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: `query { account { organizations { id name } } }`
      })
    });

    const orgData = await orgQuery.json();

    if (orgData.errors) {
      console.error('Buffer org query errors:', orgData.errors);
      return res.status(502).json({ error: 'Buffer API error', details: orgData.errors });
    }

    const orgId = orgData?.data?.account?.organizations?.[0]?.id;
    if (!orgId) {
      return res.status(502).json({ error: 'Could not retrieve Buffer organisation ID' });
    }

    // Step 2: Create the post
    // Schedule if scheduledAt provided, otherwise add to queue
    const schedulingType = scheduledAt ? 'SCHEDULED' : 'QUEUE';

    const mutation = `
      mutation CreatePost($input: PostCreateInput!) {
        postCreate(input: $input) {
          post {
            id
            text
            status
            scheduledAt
          }
          errors {
            message
            code
          }
        }
      }
    `;

    const variables = {
      input: {
        channelId: CHANNEL_ID,
        content: {
          text: text,
        },
        scheduling: scheduledAt
          ? { scheduledAt: scheduledAt, type: schedulingType }
          : { type: schedulingType }
      }
    };

    const postResponse = await fetch(BUFFER_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: mutation, variables })
    });

    const postData = await postResponse.json();

    if (postData.errors) {
      console.error('Buffer post mutation errors:', postData.errors);
      return res.status(502).json({ error: 'Buffer API mutation error', details: postData.errors });
    }

    const postErrors = postData?.data?.postCreate?.errors;
    if (postErrors && postErrors.length > 0) {
      console.error('Buffer postCreate errors:', postErrors);
      return res.status(502).json({ error: 'Buffer rejected the post', details: postErrors });
    }

    const createdPost = postData?.data?.postCreate?.post;

    console.log(`✓ Buffer post created: ${createdPost?.id} | ${platform} | ${day}`);

    return res.status(200).json({
      success: true,
      postId: createdPost?.id,
      status: createdPost?.status,
      scheduledAt: createdPost?.scheduledAt,
      platform,
      day
    });

  } catch (err) {
    console.error('Buffer proxy error:', err);
    return res.status(500).json({ error: 'Internal proxy error', message: err.message });
  }
}
