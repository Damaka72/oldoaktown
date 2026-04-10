/**
 * Buffer diagnostics — merged from buffer-channels.js and buffer-schema.js
 * GET /api/buffer-debug           → list all Buffer channels with IDs
 * GET /api/buffer-debug?mode=schema&type=CreatePostInput → schema introspection
 *
 * Required env var: BUFFER_API_KEY
 */

const BUFFER_GRAPHQL = 'https://api.buffer.com/graphql';

// Known channel IDs — used for validation
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

  // ── Schema introspection mode ──────────────────────────────────
  if (req.query.mode === 'schema') {
    const typeName = req.query.type || 'CreatePostInput';
    const query = `{
      __type(name: "${typeName}") {
        name kind
        inputFields { name description type { name kind ofType { name kind ofType { name kind } } } }
        enumValues { name description }
      }
    }`;
    try {
      const r = await fetch(BUFFER_GRAPHQL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ query }),
      });
      return res.status(200).json(await r.json());
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Channels mode (default) ────────────────────────────────────
  try {
    const [channelTypeData, schemaData] = await Promise.all([
      bufferQuery(apiKey, `{ __type(name: "Channel") { fields { name } } }`),
      bufferQuery(apiKey, `{ __schema { queryType { fields { name args { name } } } } }`),
    ]);
    const channelFields = channelTypeData?.data?.__type?.fields?.map(f => f.name) ?? [];
    const safeFields = ['id', 'name', 'service', 'serviceId'].filter(f =>
      channelFields.length === 0 || channelFields.includes(f)
    );
    const fieldStr = safeFields.join(' ');

    const accountData = await bufferQuery(apiKey, `{ account { id organizations { id name } } }`);
    const account = accountData?.data?.account;
    const organizations = account?.organizations ?? [];

    const orgIdsToTry = req.query.orgId
      ? [req.query.orgId]
      : [...new Set([...organizations.map(o => o.id), account?.id].filter(Boolean))];

    const channelsByOrg = {};
    for (const orgId of orgIdsToTry) {
      const d = await bufferQuery(apiKey, `{ channels(input: { organizationId: "${orgId}" }) { ${fieldStr} } }`);
      channelsByOrg[orgId] = { channels: d?.data?.channels ?? null, errors: d?.errors ?? null };
    }
    const channels = Object.values(channelsByOrg).flatMap(r => r.channels ?? []);

    const channelQueryField = (schemaData?.data?.__schema?.queryType?.fields ?? []).find(f => f.name === 'channel');
    const channelIdArg = channelQueryField?.args?.[0]?.name ?? 'id';
    const knownChannelResults = {};
    for (const [platform, id] of Object.entries(KNOWN_IDS)) {
      const d = await bufferQuery(apiKey, `{ channel(${channelIdArg}: "${id}") { ${fieldStr} } }`);
      knownChannelResults[platform] = d?.data?.channel ?? { error: d?.errors?.[0]?.message ?? 'null response' };
    }

    return res.status(200).json({
      organizations,
      channelTypeFields: channelFields,
      channelsByOrg,
      channels,
      knownChannelResults,
      note: channels.length === 0
        ? 'No channels found. Instagram/Facebook may need reconnecting at buffer.com → Channels.'
        : undefined,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
