/**
 * Old Oak Town — PostEverywhere.ai Account Discovery
 * GET /api/get-pe-accounts
 *
 * Lists all connected social media accounts with their integer IDs.
 * Use this to look up the IDs you need to fill in api/pe-post.js.
 *
 * Required env var: POSTEVERYWHERE_API_KEY
 */

const PE_API_BASE = 'https://app.posteverywhere.ai/api/v1';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = req.headers['x-pe-key'] || process.env.POSTEVERYWHERE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'No PostEverywhere API key — set POSTEVERYWHERE_API_KEY in Vercel env vars' });
  }

  try {
    const accountsRes = await fetch(`${PE_API_BASE}/accounts`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    const data = await accountsRes.json();

    if (!accountsRes.ok) {
      return res.status(502).json({ error: 'PostEverywhere API error', details: data });
    }

    // Normalise to a simple array regardless of PE response envelope shape
    const accounts = Array.isArray(data) ? data : (data?.data ?? data?.accounts ?? []);

    const summary = accounts.map(a => ({
      id:       a.id,
      platform: a.platform ?? a.service ?? a.type ?? 'unknown',
      name:     a.name ?? a.username ?? a.handle ?? a.display_name ?? '—',
      status:   a.status ?? a.health ?? '—',
    }));

    return res.status(200).json({ accounts: summary });

  } catch (err) {
    console.error('get-pe-accounts error:', err);
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
}
