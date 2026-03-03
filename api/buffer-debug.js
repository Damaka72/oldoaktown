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

  // ?probe=facebook — tests metadata.facebook variants to confirm correct field names
  if (req.query.probe === 'facebook') {
    const FACEBOOK_CHANNEL_ID = '69a4431d3f3b94a12105386d';
    const dueAt = new Date(Date.now() + 3600 * 1000).toISOString();
    const base = `text: "probe-test", channelId: "${FACEBOOK_CHANNEL_ID}", schedulingType: automatic, mode: customScheduled, dueAt: "${dueAt}"`;
    const variants = [
      { label: 'metadata.facebook.type.post',    input: `${base}, metadata: { facebook: { type: post } }` },
      { label: 'metadata.facebook.type.POST',    input: `${base}, metadata: { facebook: { type: POST } }` },
      { label: 'metadata.facebook.postType.post',input: `${base}, metadata: { facebook: { postType: post } }` },
      { label: 'no-metadata',                    input: base },
    ];
    const results = [];
    for (const v of variants) {
      try {
        const r = await fetch(BUFFER_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ query: `mutation { createPost(input: { ${v.input} }) { __typename ... on PostActionSuccess { post { id } } ... on MutationError { message } } }` })
        });
        results.push({ label: v.label, status: r.status, body: await r.json() });
      } catch (err) {
        results.push({ label: v.label, error: err.message });
      }
      // stop after first success so we don't create real scheduled posts
      if (results.at(-1)?.body?.data?.createPost?.post?.id) break;
    }
    return res.status(200).json({ probe: 'facebook', results });
  }

  // ?probe=instagram — tests assets field variants to confirm correct media field names
  if (req.query.probe === 'instagram') {
    const INSTAGRAM_CHANNEL_ID = '69a43f953f3b94a121052f11';
    const dueAt = new Date(Date.now() + 3600 * 1000).toISOString();
    const testUrl = 'https://oldoaktown.co.uk/images/logo.png';
    const base = `text: "probe-test", channelId: "${INSTAGRAM_CHANNEL_ID}", schedulingType: automatic, mode: customScheduled, dueAt: "${dueAt}"`;
    const variants = [
      { label: 'assets.photo',  input: `${base}, assets: { photo: [{ url: "${testUrl}" }] }` },
      { label: 'assets.photos', input: `${base}, assets: { photos: [{ url: "${testUrl}" }] }` },
      { label: 'assets.image',  input: `${base}, assets: { image: [{ url: "${testUrl}" }] }` },
      { label: 'assets.images', input: `${base}, assets: { images: [{ url: "${testUrl}" }] }` },
    ];
    const results = [];
    for (const v of variants) {
      try {
        const r = await fetch(BUFFER_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ query: `mutation { createPost(input: { ${v.input} }) { __typename ... on PostActionSuccess { post { id } } ... on MutationError { message } } }` })
        });
        results.push({ label: v.label, status: r.status, body: await r.json() });
      } catch (err) {
        results.push({ label: v.label, error: err.message });
      }
      if (results.at(-1)?.body?.data?.createPost?.post?.id) break;
    }
    return res.status(200).json({ probe: 'instagram', results });
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

  // ?introspect=2 — CreatePostInput + PostInputMetaData + AssetsInput schemas
  if (req.query.introspect === '2') {
    const introspectType = async (name) => {
      const r = await fetch(BUFFER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          query: `query {
            __type(name: ${JSON.stringify(name)}) {
              name kind
              inputFields {
                name description
                type {
                  name kind
                  enumValues { name }
                  inputFields {
                    name description
                    type { name kind ofType { name kind enumValues { name } } }
                  }
                  ofType { name kind enumValues { name } }
                }
              }
              enumValues { name }
            }
          }`
        })
      });
      return r.json();
    };
    try {
      const [createPost, metaData, assetsInput] = await Promise.all([
        introspectType('CreatePostInput'),
        introspectType('PostInputMetaData'),
        introspectType('AssetsInput'),
      ]);
      return res.status(200).json({ createPost, metaData, assetsInput });
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

  const introspectType = async (name) => {
    const r = await fetch(BUFFER_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        query: `query {
          __type(name: ${JSON.stringify(name)}) {
            name kind
            inputFields {
              name description
              type {
                name kind
                enumValues { name }
                inputFields {
                  name description
                  type { name kind ofType { name kind enumValues { name } } }
                }
                ofType { name kind enumValues { name } }
              }
            }
            enumValues { name }
          }
        }`
      })
    });
    return r.json();
  };

  try {
    const [response, metaData, assetsInput] = await Promise.all([
      fetch(BUFFER_API, {
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
      }),
      introspectType('PostInputMetaData'),
      introspectType('AssetsInput'),
    ]);

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
      message: `Found ${channels.length} connected channel(s)`,
      schema: { metaData, assetsInput },
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
