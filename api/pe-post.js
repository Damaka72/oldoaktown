/**
 * Old Oak Town — PostEverywhere.ai REST API Proxy
 * POST /api/pe-post
 *
 * Routes each post to the correct PostEverywhere account by platform.
 *
 * Required env var: POSTEVERYWHERE_API_KEY
 *
 * Account IDs are resolved automatically from your PostEverywhere connected
 * accounts. You can also pin specific IDs via env vars:
 *   POSTEVERYWHERE_INSTAGRAM_ACCOUNT_ID
 *   POSTEVERYWHERE_FACEBOOK_ACCOUNT_ID
 *   POSTEVERYWHERE_LINKEDIN_ACCOUNT_ID
 */

const PE_API_BASE = 'https://app.posteverywhere.ai/api/v1';

// Optional: pin account IDs via env vars to skip the auto-discovery fetch.
const PINNED_ACCOUNT_IDS = {
  facebook:  process.env.POSTEVERYWHERE_FACEBOOK_ACCOUNT_ID  ? Number(process.env.POSTEVERYWHERE_FACEBOOK_ACCOUNT_ID)  : null,
  instagram: process.env.POSTEVERYWHERE_INSTAGRAM_ACCOUNT_ID ? Number(process.env.POSTEVERYWHERE_INSTAGRAM_ACCOUNT_ID) : null,
  linkedin:  process.env.POSTEVERYWHERE_LINKEDIN_ACCOUNT_ID  ? Number(process.env.POSTEVERYWHERE_LINKEDIN_ACCOUNT_ID)  : null,
};

async function resolveAccountId(platformKey, apiKey) {
  if (PINNED_ACCOUNT_IDS[platformKey]) return PINNED_ACCOUNT_IDS[platformKey];

  // Auto-discover: fetch all connected accounts and match by platform name
  const accountsRes = await fetch(`${PE_API_BASE}/accounts`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!accountsRes.ok) return null;

  const data = await accountsRes.json();
  const accounts = Array.isArray(data) ? data : (data?.data ?? data?.accounts ?? []);

  // Log the full raw response on every call so we can inspect field names in Vercel logs
  console.log(`[PE] Raw accounts response:`, JSON.stringify(data).slice(0, 800));

  const match = accounts.find(a => {
    // Try every string value in the account object for a platform match
    const allValues = Object.values(a)
      .filter(v => typeof v === 'string')
      .map(v => v.toLowerCase());
    return allValues.some(v => v === platformKey || v.includes(platformKey) || platformKey.includes(v));
  });

  if (!match) {
    console.log(`[PE] No ${platformKey} account found. Full account objects:`,
      JSON.stringify(accounts).slice(0, 800)
    );
  } else {
    console.log(`[PE] Matched ${platformKey} → id=${match.id}`);
  }

  return match?.id ?? null;
}

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
  if (!['facebook', 'instagram', 'linkedin'].includes(platformKey)) {
    return res.status(400).json({ error: `Unknown platform: "${platform}". Must be linkedin, instagram, or facebook.` });
  }

  const accountId = await resolveAccountId(platformKey, apiKey);
  if (!accountId) {
    // Fetch account list again to include in the error for debugging
    let foundAccounts = [];
    try {
      const r = await fetch(`${PE_API_BASE}/accounts`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
      const d = await r.json();
      const accs = Array.isArray(d) ? d : (d?.data ?? d?.accounts ?? []);
      foundAccounts = accs.map(a => a.platform ?? a.service ?? a.type ?? a.network ?? a.provider ?? JSON.stringify(a)).slice(0, 10);
    } catch (_) {}
    return res.status(400).json({
      error: `No connected ${platform} account found in PostEverywhere.`,
      hint: `Accounts returned by PE API: ${foundAccounts.length ? foundAccounts.join(', ') : 'none (check API key)'}`,
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
