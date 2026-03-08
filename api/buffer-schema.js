/**
 * Diagnostic — Buffer GraphQL schema introspection
 * GET /api/buffer-schema?type=CreatePostInput
 *
 * Returns the fields available on a Buffer input type so we can
 * verify correct field names and enum values without guessing.
 * Remove or protect this endpoint once debugging is complete.
 *
 * Required env var: BUFFER_API_KEY
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'BUFFER_API_KEY not set' });

  const typeName = req.query.type || 'CreatePostInput';

  const query = `
    {
      __type(name: "${typeName}") {
        name
        kind
        inputFields {
          name
          description
          type {
            name
            kind
            ofType { name kind ofType { name kind } }
          }
        }
        enumValues {
          name
          description
        }
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
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
