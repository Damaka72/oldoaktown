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

import { readFileSync } from 'fs';
import { join } from 'path';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { theme, context, tone, weekDate, previousThemes, useWebSearch, objectivePrompt } = req.body;
  if (!theme) return res.status(400).json({ error: 'Missing theme' });

  // Load latest news headlines from the daily-updated ticker cache
  let newsSnippet = '';
  try {
    const ticker = JSON.parse(readFileSync(join(process.cwd(), 'data/ticker-news.json'), 'utf8'));
    if (ticker.items?.length) {
      const headlines = ticker.items.slice(0, 8)
        .map(i => {
          const date = i.publishDate ? new Date(i.publishDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
          const snippet = i.contentSnippet ? ` — "${i.contentSnippet}"` : '';
          return `- ${i.title} (${i.source}${date ? ', ' + date : ''})${snippet}`;
        })
        .join('\n');
      newsSnippet = `\nCURRENT NEWS HEADLINES (only reference facts from these — see accuracy rule below):\n${headlines}\n`;
    }
  } catch (_) {}

  // Load recently published site articles (avoid re-covering same stories)
  let publishedSnippet = '';
  try {
    const news = JSON.parse(readFileSync(join(process.cwd(), 'data/news.json'), 'utf8'));
    if (news.articles?.length) {
      const recent = news.articles.slice(0, 4)
        .map(a => `- ${a.title} (${a.category}, ${a.date})`)
        .join('\n');
      publishedSnippet = `\nRECENTLY PUBLISHED ON SITE (find fresh angles — don't simply repeat these):\n${recent}\n`;
    }
  } catch (_) {}

  // Optional Brave Search for live web results (requires BRAVE_SEARCH_API_KEY env var)
  let webSearchSnippet = '';
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  if (braveKey && useWebSearch !== false) {
    try {
      const month = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const q = encodeURIComponent(`Old Oak Common HS2 Park Royal ${month}`);
      const braveRes = await fetch(
        `https://api.search.brave.com/res/v1/news/search?q=${q}&count=6&country=gb&search_lang=en&freshness=pw`,
        { headers: { 'Accept': 'application/json', 'X-Subscription-Token': braveKey } }
      );
      if (braveRes.ok) {
        const braveData = await braveRes.json();
        const hits = (braveData.results || []).slice(0, 6);
        if (hits.length) {
          const lines = hits.map(r => `- ${r.title} (${r.meta_url?.netloc || new URL(r.url).hostname})`).join('\n');
          webSearchSnippet = `\nLIVE WEB NEWS — ${month}:\n${lines}\n`;
        }
      }
    } catch (_) {}
  }

  // Build a "previously covered" note if history was passed in
  const previousNote = previousThemes?.length
    ? `\nPREVIOUSLY COVERED THEMES (avoid repeating these angles — find fresh perspectives):\n${previousThemes.slice(0, 6).map(t => `- ${t}`).join('\n')}\n`
    : '';

  const objectiveBlock = objectivePrompt ? `\n${objectivePrompt}\n` : '';

  const prompt = `You are the social media editor for Old Oak Town, a hyperlocal news platform covering the Old Oak Common regeneration in West London — a £1.7 billion project bringing HS2, the Elizabeth Line, and Great Western Mainline together, with 25,000 new homes and 65,000 new jobs planned. Audience: 39% aged 20–39, diverse, community-minded West Londoners across North Acton, Harlesden, and Park Royal.

RULES — CRITICAL — READ BEFORE WRITING ANYTHING:
1. Only write about real, verifiable businesses, people, events, or developments. Never invent company names, founders, addresses, employee counts, contracts, or quotes. If the provided news headlines do not support a specific claim, write with general community-focused framing instead — it is far better to be thematic and accurate than to invent details.
2. If you are not certain a fact is true, do not include it. Omit rather than invent.
3. Do not fabricate stories that sound plausible. A compelling fiction is worse than a shorter truth.
4. If the theme or context mentions a specific business you do not recognise from the verified facts below, write around the area and regeneration story instead — do not guess or infer details about it.
5. Use UK English spelling and grammar throughout.

VERIFIED AREA FACTS — use these confidently; do not extrapolate beyond them:
- Old Oak Common and Park Royal is London's largest regeneration project
- Old Oak Common Station (projected opening 2029–2033) will be the UK's largest newly built station, with up to 14 platforms
- The main station construction contractor is the Balfour Beatty VINCI SYSTRA (BBVS) joint venture
- OPDC (Old Oak and Park Royal Development Corporation) is the planning authority, established by the Mayor of London in 2015
- The development is projected to create 65,000 new jobs and 25,000 new homes over 20+ years
- Park Royal is London's largest industrial estate — home to 1,700+ businesses employing 43,000+ people
- The area spans three London boroughs: Ealing, Brent, and Hammersmith & Fulham
- Notable verified area businesses include: McVitie's (baking at Park Royal since 1902), Preedy Glass (since 1913), Maroush Park Royal (Lebanese restaurant), Dina Foods (Mediterranean food producer since 1992)
- Park Royal has a significant Lebanese community with a vibrant food scene, established since the 1970s
- The Elizabeth line (Crossrail) already serves the area at Acton Main Line and Ealing Broadway
${objectiveBlock}
CAMPAIGN BRIEF:
Week commencing: ${weekDate || 'this week'}
Theme: ${theme}
Additional context: ${context || 'None'}
Tone: ${tone}
${newsSnippet}${webSearchSnippet}${publishedSnippet}${previousNote}
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
    "Finding grounded in the provided news headlines above — include the source name. Write 'No specific current news this week' if the headlines do not cover this theme.",
    "Second finding from the provided headlines, or 'No specific current news this week'",
    "Third finding from the provided headlines, or 'No specific current news this week'"
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
