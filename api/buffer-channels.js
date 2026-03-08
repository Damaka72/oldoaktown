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
    // Step 1: introspect Account type fields so we know what we can query
    const accountTypeData = await bufferQuery(apiKey, `
      { __type(name: "Account") { fields { name } } }
    `);
    const accountFields = accountTypeData?.data?.__type?.fields?.map(f => f.name) ?? [];

    // Step 2: build account query — always request id, add channels if available
    const accountSubfields = ['id', accountFields.includes('channels') && 'channels { id name service serviceId serviceUsername isDisconnected }']
      .filter(Boolean).join(' ');
    const accountData = await bufferQuery(apiKey, `{ account { ${accountSubfields} } }`);
    const account = accountData?.data?.account;
    const organizationId = req.query.orgId ?? account?.id ?? null;
    const accountChannels = account?.channels ?? null;

    // Step 3: try top-level channels query — first without input, then with orgId
    const channelsNoInput = await bufferQuery(apiKey, `
      { channels { id name service serviceId serviceUsername isDisconnected } }
    `);
    const channelsDirect = channelsNoInput?.data?.channels ?? null;

    let channelsWithOrg = null;
    if (organizationId) {
      const d = await bufferQuery(apiKey, `
        { channels(input: { organizationId: "${organizationId}" }) { id name service serviceId serviceUsername isDisconnected } }
      `);
      channelsWithOrg = d?.data?.channels ?? null;
    }

    // Collect all found channels from any source
    const allChannels = [
      ...(Array.isArray(channelsDirect) ? channelsDirect : []),
      ...(Array.isArray(channelsWithOrg) ? channelsWithOrg : []),
      ...(Array.isArray(accountChannels) ? accountChannels : []),
    ];
    // Deduplicate by id
    const seen = new Set();
    const channels = allChannels.filter(c => c?.id && !seen.has(c.id) && seen.add(c.id));

    return res.status(200).json({
      organizationId,
      accountFields,
      channels,
      sources: { channelsDirect, channelsWithOrg, accountChannels },
      note: channels.length === 0
        ? 'No channels found via any query path. Instagram/Facebook may need to be reconnected at buffer.com → Channels, or the API key may lack channel read permission.'
        : undefined,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
