/**
 * Old Oak Town — Buffer Debug Endpoint
 * GET /api/buffer-debug
 *
 * Returns all connected channels and their IDs,
 * plus confirms the API key is working.
 * DELETE THIS FILE once channels are confirmed.
 */

const BUFFER_API = 'https://api.buffer.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'BUFFER_API_KEY not set in Vercel environment variables',
      fix: 'Go to Vercel → Settings → Environment Variables and add BUFFER_API_KEY'
    });
  }

  try {
    const response = await fetch(BUFFER_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: `
          query {
            account {
              id
              name
              email
              organizations {
                id
                name
                channels {
                  id
                  name
                  service
                  serviceId
                  avatar
                }
              }
            }
          }
        `
      })
    });

    const data = await response.json();

    if (data.errors) {
      return res.status(502).json({ 
        error: 'Buffer API error — likely invalid API key',
        details: data.errors 
      });
    }

    const account = data?.data?.account;
    const channels = account?.organizations?.flatMap(o => 
      (o.channels || []).map(c => ({
        id: c.id,
        name: c.name,
        service: c.service,
        org: o.name
      }))
    ) || [];

    return res.status(200).json({
      success: true,
      account: { id: account?.id, name: account?.name, email: account?.email },
      channels,
      message: `Found ${channels.length} connected channel(s)`
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
