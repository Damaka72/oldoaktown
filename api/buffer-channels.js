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
  instagram: '69aca3e03f3b94a1212866bf',
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
    // Step 1: find valid fields on Channel type + args on channel/channels queries
    const [channelTypeData, schemaData] = await Promise.all([
      bufferQuery(apiKey, `{ __type(name: "Channel") { fields { name } } }`),
      bufferQuery(apiKey, `{ __schema { queryType { fields { name args { name } } } } }`),
    ]);
    const channelFields = channelTypeData?.data?.__type?.fields?.map(f => f.name) ?? [];

    // Pick a safe subset of fields we know Buffer is likely to have
    const safeFields = ['id', 'name', 'service', 'serviceId'].filter(f =>
      channelFields.length === 0 || channelFields.includes(f)
    );
    const fieldStr = safeFields.join(' ');

    // Step 2: get account.id AND real org IDs from account.organizations
    const accountData = await bufferQuery(apiKey, `
      { account { id organizations { id name } } }
    `);
    const account = accountData?.data?.account;
    const organizations = account?.organizations ?? [];
    // Prefer the org ID from organizations list; fall back to account.id
    const organizationId = req.query.orgId
      ?? organizations[0]?.id
      ?? account?.id;

    // Step 3: channels list query with only safe fields — try all org IDs
    const orgIdsToTry = req.query.orgId
      ? [req.query.orgId]
      : [...new Set([...organizations.map(o => o.id), account?.id].filter(Boolean))];

    const channelsByOrg = {};
    for (const orgId of orgIdsToTry) {
      const d = await bufferQuery(apiKey, `
        { channels(input: { organizationId: "${orgId}" }) { ${fieldStr} } }
      `);
      channelsByOrg[orgId] = { channels: d?.data?.channels ?? null, errors: d?.errors ?? null };
    }
    const channels = Object.values(channelsByOrg).flatMap(r => r.channels ?? []);

    // Step 4: introspect args on singular "channel" query, then look up known IDs
    const channelQueryField = (schemaData?.data?.__schema?.queryType?.fields ?? [])
      .find(f => f.name === 'channel');
    const channelIdArg = channelQueryField?.args?.[0]?.name ?? 'id';
    const knownChannelResults = {};
    for (const [platform, id] of Object.entries(KNOWN_IDS)) {
      const d = await bufferQuery(apiKey, `{ channel(${channelIdArg}: "${id}") { ${fieldStr} } }`);
      knownChannelResults[platform] = d?.data?.channel
        ?? { error: d?.errors?.[0]?.message ?? 'null response' };
    }

    return res.status(200).json({
      organizationId,
      organizations,
      channelTypeFields: channelFields,
      channelsByOrg,
      channels,
      knownChannelResults,
      note: channels.length === 0
        ? 'Still no channels. Instagram/Facebook may need to be reconnected at buffer.com → Channels.'
        : undefined,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
