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
    // Step 1: introspect root Query fields to find the org/account query
    const schemaData = await bufferQuery(apiKey, `
      {
        __schema {
          queryType {
            fields {
              name
              args { name type { name kind ofType { name kind } } }
            }
          }
        }
      }
    `);
    const queryFields = schemaData?.data?.__schema?.queryType?.fields || [];

    // Step 2: look for an organization or account field
    const orgField = queryFields.find(f =>
      ['organization', 'organizations', 'account', 'viewer', 'currentUser', 'user'].includes(f.name)
    );

    if (!orgField) {
      return res.status(200).json({
        hint: 'Could not find org field — pick one from the list below and pass ?orgId=YOUR_ORG_ID',
        queryFields: queryFields.map(f => f.name),
      });
    }

    // Step 3: fetch organizationId via whichever field exists
    let organizationId = req.query.orgId;
    if (!organizationId) {
      // Also fetch channelCount to compare against channels list result
      const orgData = await bufferQuery(apiKey, `{ ${orgField.name} { id channelCount } }`);
      const orgObj = orgData?.data?.[orgField.name];
      organizationId = orgObj?.id ?? orgObj?.[0]?.id;
      var channelCount = orgObj?.channelCount ?? orgObj?.[0]?.channelCount ?? null;
    }

    if (!organizationId) {
      return res.status(500).json({
        error: 'Could not resolve organizationId automatically. Pass ?orgId=YOUR_ORG_ID',
        queryFields: queryFields.map(f => f.name),
      });
    }

    // Step 4: introspect ChannelsInput.filter to find disconnected/hidden channel options
    const filterTypeData = await bufferQuery(apiKey, `
      {
        __type(name: "ChannelsInput") {
          inputFields {
            name
            type { name kind ofType { name kind } }
          }
        }
      }
    `);
    const channelsInputFields = filterTypeData?.data?.__type?.inputFields ?? [];
    const filterField = channelsInputFields.find(f => f.name === 'filter');
    let filterTypeName = filterField?.type?.name ?? filterField?.type?.ofType?.name ?? null;

    // Introspect the filter type to find all available filter options
    let filterOptions = null;
    if (filterTypeName) {
      const filterTypeDetail = await bufferQuery(apiKey, `
        {
          __type(name: "${filterTypeName}") {
            inputFields { name type { name kind } }
          }
        }
      `);
      filterOptions = filterTypeDetail?.data?.__type?.inputFields?.map(f => f.name) ?? null;
    }

    // Step 5: list channels — try plain query first
    const channelsData = await bufferQuery(apiKey, `
      {
        channels(input: { organizationId: "${organizationId}" }) {
          id name service serviceId serviceUsername isDisconnected
        }
      }
    `);
    const channels = channelsData?.data?.channels ?? [];

    // Step 6: if empty, try with includeDisconnected or paused filter variants
    let channelsWithDisconnected = null;
    if (channels.length === 0 && filterOptions?.includes('includeDisconnected')) {
      const dcData = await bufferQuery(apiKey, `
        {
          channels(input: { organizationId: "${organizationId}", filter: { includeDisconnected: true } }) {
            id name service serviceId serviceUsername isDisconnected
          }
        }
      `);
      channelsWithDisconnected = dcData?.data?.channels ?? dcData;
    }

    const allChannels = channelsWithDisconnected ?? channels;
    const note = allChannels.length === 0
      ? 'No channels found even with disconnected filter. The Instagram/Facebook accounts may need to be re-connected at buffer.com under Channels. Once reconnected, call this endpoint again to get the updated IDs to put in buffer-post.js.'
      : undefined;

    return res.status(200).json({
      organizationId,
      channelCount,
      channels,
      filterTypeName,
      filterOptions,
      channelsWithDisconnected,
      note,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
