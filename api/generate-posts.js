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
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { theme, context, tone, weekDate } = req.body;
  if (!theme) return res.status(400).json({ error: 'Missing theme' });

  const prompt = `You are the social media editor for Old Oak Town, a hyperlocal news platform covering the Old Oak Common regeneration in West London — a £1.7 billion development bringing HS2, Elizabeth Line, and Great Western Mainline together, with 9,000 new homes and 11,000 new jobs.

CAMPAIGN BRIEF:
Week commencing: ${weekDate || 'this week'}
Theme: ${theme}
Context: ${context || 'No extra context'}
Tone: ${tone}

Generate a complete weekly social media plan. Research current news about HS2 Old Oak Common, OPDC, and West London regeneration to make the posts genuinely topical and specific.

Return ONLY valid JSON in exactly this structure:
{
  "findings": [
    "Key research finding 1 relevant to the theme",
    "Key research finding 2",
    "Key research finding 3"
  ],
  "days": [
    {
      "day": "Monday",
      "date": "${weekDate}",
      "posts": [
        {
          "platform": "Facebook",
          "caption": "Full Facebook post caption here — community notice board style, warm and conversational, 2-3 paragraphs, ends with a question to spark comments",
          "hashtags": "#OldOakTown #WestLondon #OldOakCommon",
          "bestTime": "9:00am",
          "scheduledDate": "${weekDate}"
        },
        {
          "platform": "Instagram",
          "caption": "Instagram caption — visual storytelling style, punchy opening line, evocative description, 3-5 relevant emojis woven in naturally",
          "hashtags": "#OldOakTown #WestLondon #LondonRegeneration #HS2 #OldOakCommon #NorthActon #ParkRoyal",
          "bestTime": "12:00pm",
          "scheduledDate": "${weekDate}"
        },
        {
          "platform": "LinkedIn",
          "caption": "LinkedIn post — professional regeneration news angle, data-led where possible, insight-driven, no emojis, suitable for property/planning/infrastructure professionals",
          "hashtags": "#UrbanRegeneration #WestLondon #HS2 #PropertyDevelopment #OldOakCommon",
          "bestTime": "8:00am",
          "scheduledDate": "${weekDate}"
        }
      ]
    }
  ]
}

Generate all 5 days Monday–Friday. Make every caption genuinely specific to Old Oak Town and West London. Each platform must sound completely different.`;

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
        max_tokens: 4000,
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
    if (!match) return res.status(502).json({ error: 'Could not parse JSON from response', raw });

    const plan = JSON.parse(match[0]);
    return res.status(200).json(plan);

  } catch (err) {
    console.error('Generate posts proxy error:', err);
    return res.status(500).json({ error: 'Internal proxy error', message: err.message });
  }
}
