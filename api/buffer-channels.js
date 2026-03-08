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

// Existing hardcoded IDs — check if they're still valid
const KNOWN_IDS = {
  linkedin:  '69a213f74be271803d75d07e',
  instagram: '69a43f953f3b94a121052f11',
  facebook:  '69a4431d3f3b94a12105386d',
};

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
    // Step 1: find valid fields on the Channel type
    const channelTypeData = await bufferQuery(apiKey, `
      { __type(name: "Channel") { fields { name } } }
    `);
    const channelFields = channelTypeData?.data?.__type?.fields?.map(f => f.name) ?? [];

    // Pick a safe subset of fields we know Buffer is likely to have
    const safeFields = ['id', 'name', 'service', 'serviceId'].filter(f =>
      channelFields.length === 0 || channelFields.includes(f)
    );
    const fieldStr = safeFields.join(' ');

    // Step 2: get organizationId via account query
    const accountData = await bufferQuery(apiKey, `{ account { id } }`);
    const organizationId = req.query.orgId ?? accountData?.data?.account?.id;

    // Step 3: channels list query with only safe fields
    let channels = null;
    let channelsError = null;
    if (organizationId) {
      const d = await bufferQuery(apiKey, `
        { channels(input: { organizationId: "${organizationId}" }) { ${fieldStr} } }
      `);
      channels = d?.data?.channels ?? null;
      channelsError = d?.errors ?? null;
    }

    // Step 4: look up each known channel ID individually via singular "channel" query
    const channelArgs = (channelTypeData?.data?.__schema ?? null); // unused; checking via schema
    const knownChannelResults = {};
    for (const [platform, id] of Object.entries(KNOWN_IDS)) {
      const d = await bufferQuery(apiKey, `{ channel(id: "${id}") { ${fieldStr} } }`);
      knownChannelResults[platform] = d?.data?.channel ?? { error: d?.errors?.[0]?.message ?? 'null response' };
    }

    // Step 5: try account.organizations path
    const orgData = await bufferQuery(apiKey, `
      { account { organizations { id name } } }
    `);
    const organizations = orgData?.data?.account?.organizations ?? null;

    return res.status(200).json({
      organizationId,
      channelTypeFields: channelFields,
      channels,
      channelsError,
      knownChannelResults,
      organizations,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
