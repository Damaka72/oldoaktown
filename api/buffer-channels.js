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

const BUFFER_GRAPHQL = 'https://api.buffer.com/graphql';

async function bufferQuery(apiKey, query) {
  const r = await fetch(BUFFER_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ query }),
  });
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'BUFFER_API_KEY not set' });

  try {
    // Step 1: get the organization ID from the authed user
    const meData = await bufferQuery(apiKey, `{ me { account { organizationId } } }`);
    const organizationId = meData?.data?.me?.account?.organizationId;
    if (!organizationId) {
      return res.status(500).json({ error: 'Could not resolve organizationId', meData });
    }

    // Step 2: list channels for that org
    const channelsData = await bufferQuery(apiKey, `
      {
        channels(input: { organizationId: "${organizationId}" }) {
          id
          name
          service
          serviceId
        }
      }
    `);

    return res.status(200).json({ organizationId, channels: channelsData?.data?.channels, raw: channelsData });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
