/**
 * Old Oak Town — Anthropic API Proxy
 * POST /api/generate-posts
 *
 * Receives the campaign brief from the Social Command Centre
 * and calls the Anthropic API server-side, keeping the API key
 * out of the browser.
 *
 * Required env var: ANTHROPIC_API_KEY
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { theme, context, tone, weekDate } = req.body;
  if (!theme) return res.status(400).json({ error: 'Missing theme' });

  const prompt = `You are the social media editor for Old Oak Town, a hyperlocal news platform covering the Old Oak Common regeneration in West London — a £1.7 billion project bringing HS2, the Elizabeth Line, and Great Western Mainline together, with 9,000 new homes and 11,000 new jobs planned. Audience: 39% aged 20–39, diverse, community-minded West Londoners across North Acton, Harlesden, and Park Royal.

CAMPAIGN BRIEF:
Week commencing: ${weekDate || 'this week'}
Theme: ${theme}
Additional context: ${context || 'None'}
Tone: ${tone}

PLATFORM WRITING RULES — follow these strictly, each platform must read completely differently:

FACEBOOK (community notice board):
- Length: 150–220 words in the caption body
- Style: Warm, conversational, like a trusted neighbour sharing news
- Structure: Open with a hook sentence, then 2–3 short paragraphs, close with a question to spark comments
- Voice: First-person plural ("We spotted...", "Have you noticed...")
- NO emojis in the caption body — emojis only allowed in hashtags if any
- End with a genuine question the community will want to answer

INSTAGRAM (visual storytelling):
- Length: 60–90 words maximum in the caption body
- Style: Punchy, visual, evocative — write as if describing a scene
- Structure: Strong single-line hook, then 2–3 short punchy lines, close with a call to action
- Voice: Second-person or present tense ("Watch this space", "The skyline is changing")
- Emojis: 3–5 woven naturally into the caption (not all at the end)
- Hashtags: 8–12 highly relevant tags

LINKEDIN (professional insight):
- Length: 180–250 words in the caption body
- Style: Authoritative, data-led, suitable for property developers, planners, investors, and urban professionals
- Structure: Strong insight or statistic as the opener, then analysis in 2–3 paragraphs, close with a forward-looking statement or question for professionals
- Voice: Third-person or neutral professional ("The Old Oak Common development represents...", "Data from OPDC suggests...")
- NO emojis anywhere
- Hashtags: 4–6 professional/industry tags only

Return ONLY valid JSON in exactly this structure (no markdown, no code fences):

{
  "findings": [
    "Specific current fact or news item about Old Oak/HS2/OPDC relevant to this theme",
    "Second relevant research finding",
    "Third relevant finding"
  ],
  "days": [
    {
      "day": "Monday",
      "posts": [
        {
          "platform": "facebook",
          "caption": "Full Facebook caption here — 150-220 words, warm and conversational, ends with a question",
          "hashtags": "#OldOakTown #WestLondon #NorthActon #Harlesden #ParkRoyal #OldOakCommon",
          "bestTime": "9:00am",
          "scheduledDate": "${weekDate}"
        },
        {
          "platform": "instagram",
          "caption": "Short punchy Instagram caption here — 60-90 words max, 3-5 emojis woven in, visual and vivid",
          "hashtags": "#OldOakTown #OldOakCommon #WestLondon #LondonLife #HS2 #NorthActon #Harlesden #ParkRoyal #LondonRegeneration #NewLondon",
          "bestTime": "12:00pm",
          "scheduledDate": "${weekDate}"
        },
        {
          "platform": "linkedin",
          "caption": "Professional LinkedIn post here — 180-250 words, data-led, authoritative, no emojis",
          "hashtags": "#UrbanRegeneration #OldOakCommon #LondonProperty #HS2 #Placemaking",
          "bestTime": "8:00am",
          "scheduledDate": "${weekDate}"
        }
      ]
    }
  ]
}

Generate all 5 days: Monday, Tuesday, Wednesday, Thursday, Friday. Each day should explore a different angle or sub-theme within the overall weekly theme. Each platform post must be genuinely distinct — not the same text reformatted.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Anthropic API error:', data.error);
      return res.status(502).json({ error: 'Anthropic API error', details: data.error });
    }

    let raw = '';
    for (const block of (data.content || [])) {
      if (block.type === 'text') raw += block.text;
    }

    if (!raw) return res.status(502).json({ error: 'Empty response from Anthropic' });

    const clean = raw.replace(/```json|```/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return res.status(502).json({ error: 'Could not parse JSON from response', raw: raw.slice(0, 500) });

    const plan = JSON.parse(match[0]);
    return res.status(200).json(plan);

  } catch (err) {
    console.error('Generate posts proxy error:', err);
    return res.status(500).json({ error: 'Internal proxy error', message: err.message });
  }
}
