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

  // First introspect ChannelsInput to discover required fields
  const introspectQuery = `
    {
      __type(name: "ChannelsInput") {
        inputFields {
          name
          type { name kind ofType { name kind } }
        }
      }
    }
  `;

  let channelsInput = '{}';
  try {
    const introRes = await fetch('https://api.buffer.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ query: introspectQuery }),
    });
    const introData = await introRes.json();
    const fields = introData?.data?.__type?.inputFields || [];
    // Build an input object with only optional fields omitted; pass empty string for strings
    // Most likely it needs organizationId — check req.query for it
    const orgId = req.query.organizationId;
    if (orgId) {
      channelsInput = `{ organizationId: "${orgId}" }`;
    }
    // Return introspection data too so the caller knows what to pass
    if (fields.length && !orgId) {
      return res.status(200).json({
        hint: 'ChannelsInput requires these fields. Pass ?organizationId=YOUR_ORG_ID to list channels.',
        fields,
      });
    }
  } catch (_) { /* ignore, try with empty input anyway */ }

  const query = `
    {
      channels(input: ${channelsInput}) {
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
