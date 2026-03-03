/**
 * Old Oak Town — Buffer Debug Endpoint
 * GET /api/buffer-debug
 *
 * Returns all connected channels and their IDs,
 * plus confirms the API key is working.
 * DELETE THIS FILE once channels are confirmed.
 */

const BUFFER_API = 'https://api.buffer.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'BUFFER_API_KEY not set in Vercel environment variables',
      fix: 'Go to Vercel → Settings → Environment Variables and add BUFFER_API_KEY'
    });
  }

  // ?probe=facebook — sends a minimal test mutation and returns the raw Buffer response
  // so we can see exactly what field names Buffer accepts / rejects
  if (req.query.probe === 'facebook') {
    const FACEBOOK_CHANNEL_ID = '69a4431d3f3b94a12105386d';
    const dueAt = new Date(Date.now() + 3600 * 1000).toISOString();
    const variants = [
      { label: 'no-type',            mutation: `createPost(input: { text: "test", channelId: "${FACEBOOK_CHANNEL_ID}", schedulingType: automatic, mode: customScheduled, dueAt: "${dueAt}" })` },
      { label: 'facebook.type.post', mutation: `createPost(input: { text: "test", channelId: "${FACEBOOK_CHANNEL_ID}", schedulingType: automatic, mode: customScheduled, dueAt: "${dueAt}", facebook: { type: post } })` },
      { label: 'facebook.type.POST', mutation: `createPost(input: { text: "test", channelId: "${FACEBOOK_CHANNEL_ID}", schedulingType: automatic, mode: customScheduled, dueAt: "${dueAt}", facebook: { type: POST } })` },
      { label: 'postType.post',      mutation: `createPost(input: { text: "test", channelId: "${FACEBOOK_CHANNEL_ID}", schedulingType: automatic, mode: customScheduled, dueAt: "${dueAt}", postType: post })` },
    ];
    const results = [];
    for (const v of variants) {
      try {
        const r = await fetch(BUFFER_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ query: `mutation { ${v.mutation} { ... on PostActionSuccess { post { id } } ... on MutationError { message } } }` })
        });
        results.push({ label: v.label, status: r.status, body: await r.json() });
      } catch (err) {
        results.push({ label: v.label, error: err.message });
      }
      // stop after first success so we don't queue junk posts
      if (results.at(-1)?.body?.data?.createPost?.post) break;
    }
    return res.status(200).json({ probe: 'facebook', results });
  }

  // ?type=TypeName — introspect any named type (e.g. PostInputMetaData, AssetsInput)
  if (req.query.type) {
    try {
      const r = await fetch(BUFFER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          query: `query {
            __type(name: ${JSON.stringify(req.query.type)}) {
              name kind
              inputFields {
                name description
                type {
                  name kind
                  enumValues { name }
                  inputFields {
                    name description
                    type { name kind ofType { name kind } }
                  }
                  ofType { name kind enumValues { name } }
                }
              }
              enumValues { name description }
            }
          }`
        })
      });
      return res.status(200).json(await r.json());
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ?introspect=2 — list every field name on CreatePostInput (flat, easy to read)
  if (req.query.introspect === '2') {
    try {
      const r = await fetch(BUFFER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          query: `query {
            __type(name: "CreatePostInput") {
              name
              inputFields {
                name
                description
                type {
                  name kind
                  ofType { name kind }
                }
              }
            }
          }`
        })
      });
      const d = await r.json();
      // Return just the field names + type names for easy scanning
      const fields = d?.data?.__type?.inputFields?.map(f => ({
        field: f.name,
        description: f.description,
        type: f.type.name || `${f.type.kind}(${f.type.ofType?.name})`
      }));
      return res.status(200).json({ inputFields: fields, raw: d });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ?introspect=1 — deep schema dump for CreatePostInput including nested types
  if (req.query.introspect === '1') {
    const deepTypeFragment = `
      name kind
      enumValues { name }
      inputFields {
        name
        type {
          name kind
          enumValues { name }
          inputFields {
            name
            type { name kind ofType { name kind enumValues { name } } }
          }
          ofType { name kind enumValues { name } }
        }
      }
      ofType {
        name kind
        enumValues { name }
        inputFields {
          name
          type { name kind ofType { name kind } }
        }
      }
    `;
    try {
      const r = await fetch(BUFFER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          query: `query {
            __type(name: "CreatePostInput") {
              name
              inputFields {
                name
                description
                type { ${deepTypeFragment} }
              }
            }
          }`
        })
      });
      const d = await r.json();
      return res.status(200).json(d);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  try {
    const response = await fetch(BUFFER_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: `
          query {
            account {
              id
              name
              email
              organizations {
                id
                name
                channels {
                  id
                  name
                  service
                  serviceId
                  avatar
                }
              }
            }
          }
        `
      })
    });

    const data = await response.json();

    if (data.errors) {
      return res.status(502).json({ 
        error: 'Buffer API error — likely invalid API key',
        details: data.errors 
      });
    }

    const account = data?.data?.account;
    const channels = account?.organizations?.flatMap(o => 
      (o.channels || []).map(c => ({
        id: c.id,
        name: c.name,
        service: c.service,
        org: o.name
      }))
    ) || [];

    return res.status(200).json({
      success: true,
      account: { id: account?.id, name: account?.name, email: account?.email },
      channels,
      message: `Found ${channels.length} connected channel(s)`
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
