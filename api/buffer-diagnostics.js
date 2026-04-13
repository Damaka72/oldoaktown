/**
 * Old Oak Town — Buffer Diagnostics
 * GET /api/buffer-diagnostics
 *
 * Returns the list of Buffer channels connected to this account.
 * Used by the Social Command Centre "Test Connection" button.
 *
 * Required env var: BUFFER_API_KEY
 */

const BUFFER_GRAPHQL = 'https://api.buffer.com/graphql';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'No Buffer API key — set BUFFER_API_KEY in env vars' });
  }

  const query = `{
    channels {
      id
      name
      service
      serviceId
      avatar
    }
  }`;

  try {
    const bufRes = await fetch(BUFFER_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query }),
    });

    const rawText = await bufRes.text();
    console.log(`Buffer diagnostics HTTP ${bufRes.status}:`, rawText.slice(0, 500));
    const data = JSON.parse(rawText);

    if (!bufRes.ok) {
      const detail = data?.message || data?.errors?.[0]?.message || rawText.slice(0, 200);
      return res.status(502).json({ error: 'Buffer API error', hint: `HTTP ${bufRes.status} — ${detail}` });
    }

    if (data?.errors?.length) {
      const msg = data.errors.map(e => e.message).join('; ');
      return res.status(502).json({ error: 'Buffer GraphQL error', hint: msg });
    }

    const channels = data?.data?.channels || [];
    return res.status(200).json({ channels });

  } catch (err) {
    console.error('Buffer diagnostics error:', err);
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
}
