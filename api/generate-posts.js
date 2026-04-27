// api/generate-posts.js
// Improved version: multiple targeted searches + article body extraction

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    theme,
    context,
    tone,
    weekDate,
    previousThemes = [],
    useWebSearch = true,
    objectivePrompt = ''
  } = req.body;

  if (!theme) return res.status(400).json({ error: 'theme is required' });

  // ── 1. Run targeted Brave searches ───────────────────────────────────────
  let searchContext = '';

  if (useWebSearch && process.env.BRAVE_SEARCH_API_KEY) {
    // Run 4 targeted queries in parallel, focused on what actually matters
    const queries = [
      `Old Oak Common OR "Park Royal" OR OPDC OR Harlesden news ${new Date().getFullYear()}`,
      `HS2 "Old Oak" OR "Euston" update ${new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })}`,
      `"Old Oak" OR "Park Royal" West London planning development`,
      theme.length > 5 ? `"Old Oak" OR "Park Royal" ${theme}` : null,
    ].filter(Boolean);

    const searchResults = await Promise.allSettled(
      queries.map(q => braveSearch(q, process.env.BRAVE_SEARCH_API_KEY))
    );

    // Collect all unique results
    const allResults = [];
    const seenUrls = new Set();
    for (const r of searchResults) {
      if (r.status === 'fulfilled' && r.value?.web?.results) {
        for (const item of r.value.web.results.slice(0, 4)) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            allResults.push(item);
          }
        }
      }
    }

    // ── 2. Fetch article bodies for the top results ───────────────────────
    const enriched = await Promise.allSettled(
      allResults.slice(0, 8).map(item => fetchArticleBody(item))
    );

    const articles = enriched
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    if (articles.length > 0) {
      searchContext = `
## LIVE WEB RESEARCH (fetched today — use this as your primary source)

${articles.map((a, i) => `### Source ${i + 1}: ${a.title}
URL: ${a.url}
Date: ${a.date || 'recent'}
Summary: ${a.description}
${a.body ? `Full content:\n${a.body}` : ''}
`).join('\n---\n')}

INSTRUCTIONS FOR USING THIS RESEARCH:
- Base your posts on SPECIFIC facts, quotes, figures, and developments found above
- Reference actual dates, named officials, specific locations where possible
- Do NOT invent facts not present in the research
- If an article mentions a planning application reference, include it
- If a business is named, name it in the post
- Prefer recent content (check dates) over older items
`;
    }
  }

  // ── 3. Build the Claude prompt ────────────────────────────────────────────
  const previousThemesNote = previousThemes.length > 0
    ? `\nAVOID repeating these recent themes: ${previousThemes.slice(0, 8).join(', ')}`
    : '';

  const systemPrompt = `You are the social media editor for Old Oak Town (oldoaktown.co.uk), the authoritative hyperlocal news and community platform covering the Old Oak Common regeneration area in West London — spanning Old Oak, Park Royal, North Acton, Harlesden, and Wormwood Scrubs.

Your mission: produce social media posts that make Old Oak Town the indispensable, go-to source for anyone who lives, works, or invests in this area. Generic posts kill trust. Specific, factual, locally-grounded posts build it.

BRAND VOICE:
- Tone: ${tone}
- Always West London-specific — never vague London references
- Old Oak Town is an informed community insider, not a corporate broadcaster
- Use specific names, places, planning refs, and dates where the research provides them
- Never fabricate facts — if you don't have a specific detail, write around it honestly

PLATFORM RULES:
Facebook (max 63,000 chars):
- 150–280 words. Conversational, story-led. End with a local question to drive comments.
- Best for "Did you know?" hooks, local history angles, community updates.

Instagram (max 2,200 chars):  
- 80–150 words. Strong first line (no "..." cuts). Emoji-enhanced, punchy.
- Caption MUST be self-contained — assume they won't click the link.
- 5–8 relevant hashtags at the end: always include #OldOak #WestLondon #OldOakCommon plus 2–3 specific ones.

LinkedIn (max 1,248 chars):
- 100–200 words. Professional tone. Frame for property professionals, investors, urban planners.
- Lead with the development angle — jobs, investment, infrastructure, timeline.
- 3–5 hashtags: #UrbanRegeneration #WestLondon #OldOak plus specific ones.

CONTENT REQUIREMENTS:
- Each day must have a distinct angle — not variations of the same point
- Tuesday and Thursday should ideally spotlight a real named local business if the research supports it
- Friday should have a "week wrap" or "looking ahead" feel
- If the research mentions specific planning applications, HS2 milestones, OPDC decisions, or named businesses — USE THEM. These are gold.
- The "Business Spotlight" format: name the business, what they do, where they are, why they matter to Old Oak

${objectivePrompt}

RESPONSE FORMAT — return ONLY valid JSON, no preamble, no markdown fences:
{
  "findings": ["key fact or story 1", "key fact or story 2", "key fact or story 3", "key fact or story 4", "key fact or story 5"],
  "days": [
    {
      "day": "Monday",
      "theme": "Day theme in 4-6 words",
      "posts": [
        {
          "platform": "facebook",
          "caption": "Full post text",
          "hashtags": "#Tag1 #Tag2 #Tag3",
          "bestTime": "9:00am"
        },
        { "platform": "instagram", ... },
        { "platform": "linkedin", ... }
      ]
    },
    ... (Tuesday through Friday)
  ]
}`;

  const userPrompt = `Generate a full week of social media posts for Old Oak Town.

WEEK COMMENCING: ${weekDate}
WEEKLY THEME: ${theme}
SPECIFIC CONTEXT FROM YOU: ${context || 'None provided — rely on web research above'}
${previousThemesNote}

${searchContext || '⚠️ Web research unavailable — use your knowledge of Old Oak Common and West London regeneration, but be honest about uncertainty and avoid fabricating specific dates or figures.'}

Generate posts for Monday, Tuesday, Wednesday, Thursday, and Friday.
Each day: 3 posts (facebook, instagram, linkedin).
Return ONLY the JSON object.`;

  // ── 4. Call Claude API ────────────────────────────────────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}));
      return res.status(500).json({ error: err.error?.message || `Claude API error ${claudeRes.status}` });
    }

    const claudeData = await claudeRes.json();
    const raw = claudeData.content?.[0]?.text || '';

    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

    let plan;
    try {
      plan = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON parse failed:', cleaned.slice(0, 500));
      return res.status(500).json({ error: 'Failed to parse Claude response as JSON', raw: cleaned.slice(0, 500) });
    }

    return res.status(200).json(plan);

  } catch (err) {
    console.error('generate-posts error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function braveSearch(query, apiKey) {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=6&freshness=pm&text_decorations=0`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
  });
  if (!res.ok) throw new Error(`Brave search failed: ${res.status}`);
  return res.json();
}

async function fetchArticleBody(item) {
  const { url, title, description, page_age } = item;

  // Skip Google News redirect URLs, PDFs, and social media
  if (url.includes('news.google.com') || url.endsWith('.pdf') ||
      url.includes('twitter.com') || url.includes('facebook.com') ||
      url.includes('instagram.com') || url.includes('linkedin.com')) {
    return { url, title, description, date: page_age, body: null };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OldOakTownBot/1.0)',
        'Accept': 'text/html',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return { url, title, description, date: page_age, body: null };

    const html = await res.text();

    // Extract readable text — strip tags, collapse whitespace, trim to 800 chars
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 1200); // ~200 words per article — enough context, not too much token spend

    return { url, title, description, date: page_age, body };
  } catch {
    // Timeout or fetch error — return just the metadata
    return { url, title, description, date: page_age, body: null };
  }
}
