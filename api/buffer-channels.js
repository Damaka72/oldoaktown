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
      const orgData = await bufferQuery(apiKey, `{ ${orgField.name} { id } }`);
      organizationId = orgData?.data?.[orgField.name]?.id
        ?? orgData?.data?.[orgField.name]?.[0]?.id;
    }

    if (!organizationId) {
      return res.status(500).json({
        error: 'Could not resolve organizationId automatically. Pass ?orgId=YOUR_ORG_ID',
        queryFields: queryFields.map(f => f.name),
      });
    }

    // Step 4: introspect the channels field to understand its args
    const channelsFieldInfo = queryFields.find(f => f.name === 'channels');

    // Step 5: try fetching channels — first with organizationId, then without
    const withOrgId = await bufferQuery(apiKey, `
      {
        channels(input: { organizationId: "${organizationId}" }) {
          id
          name
          service
          serviceId
        }
      }
    `);

    const withoutFilter = await bufferQuery(apiKey, `
      {
        channels {
          id
          name
          service
          serviceId
        }
      }
    `);

    return res.status(200).json({
      organizationId,
      channelsFieldArgs: channelsFieldInfo?.args ?? null,
      withOrgId: withOrgId?.data?.channels ?? withOrgId,
      withoutFilter: withoutFilter?.data?.channels ?? withoutFilter,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
