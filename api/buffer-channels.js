/**
 * Diagnostic — List all Buffer channels with their IDs
 * GET /api/buffer-channels
 *
 * Use this to look up the correct channel IDs when a channel is
 * re-authorized in Buffer and gets a new ID.
 * Remove or protect this endpoint once you've captured the IDs.
 *
 * Required env var: BUFFER_API_KEY
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'BUFFER_API_KEY not set' });

  const query = `
    {
      channels {
        id
        name
        service
        serviceId
      }
    }
  `;

  try {
    const r = await fetch('https://api.buffer.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query }),
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
