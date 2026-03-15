# /social-agent — Social Command Centre Setup

Generates a pixel-perfect clone of the oldoaktown Social Command Centre for any site. Uses a config-driven generator script — no manual HTML editing required.

---

## How it works

A Node.js script (`scripts/generate-social-agent.js`) reads the master `social-agent.html` template and applies site-specific substitutions from a JSON config file. The output is a complete, self-contained `social-agent.html` ready to deploy.

**The script handles:**
- Brand colours (renames CSS variables + replaces all values)
- Site name, icon letter, page title
- Google Fonts swap
- Research source toggles (any number, with emoji labels)
- localStorage keys (isolated per site)
- Admin password hash
- Pipeline log messages
- Weekly theme placeholder text

**Nothing else changes** — layout, pipeline logic, approval board, Buffer integration, session persistence, and stats are identical to oldoaktown.

---

## Step 1 — Create a config file

Copy `scripts/sites/example.json` to `scripts/sites/[siteSlug].json` and fill it in.

Ask the user for:

| Field | Description | Example |
|---|---|---|
| `siteName` | Full site name | `"Didiani Olue"` |
| `siteSlug` | Short lowercase identifier (no spaces) | `"didiani"` |
| `iconLetter` | Single letter or emoji for brand icon box | `"D"` |
| `colors.primary` | Dark header/hero colour | `"#2C1A4E"` |
| `colors.primaryMid` | Mid tone (hover states) | `"#4A2D7A"` |
| `colors.accent` | Buttons and highlights | `"#8B5CF6"` |
| `colors.accentPale` | Chips and light accents | `"#E9D5FF"` |
| `colors.ghost` | Input/card backgrounds | `"#F5F0FF"` |
| `colors.border` | Border lines | `"#DDD6FE"` |
| `colors.muted` | Labels, subtext | `"#6B7280"` |
| `colors.ink` | Body text | `"#1F1235"` |
| `colors.cream` | Page background | `"#FDFBFF"` |
| `researchSources` | Array of toggle rows (see below) | — |
| `themePlaceholder` | Hint text for the weekly theme input | `"Restaurant opening, event…"` |
| `idleDescription` | Text shown before the user starts | One sentence |
| `pipelineLogs` | 4–5 log lines during research phase | Array of strings |
| `passwordHash` | SHA-256 of admin password (optional, set later) | `""` |

Check `index.html`, `CLAUDE.md`, and `README.md` in the target project for colours and branding before asking.

### Research sources format

```json
"researchSources": [
  { "emoji": "🍽", "label": "Restaurant & food news", "defaultOn": true  },
  { "emoji": "🎭", "label": "Events & culture",        "defaultOn": true  },
  { "emoji": "🏘",  "label": "Community updates",       "defaultOn": true  },
  { "emoji": "💼", "label": "Business spotlights",     "defaultOn": false },
  { "emoji": "🎵", "label": "Music & arts",             "defaultOn": false }
]
```

Up to 6 sources. `defaultOn: true` means the toggle starts enabled.

---

## Step 2 — Run the generator

From the oldoaktown project root:

```bash
node scripts/generate-social-agent.js \
  --config scripts/sites/[siteSlug].json \
  --output ../[target-project]/social-agent.html
```

Or to generate in the current directory first and review:

```bash
node scripts/generate-social-agent.js --config scripts/sites/[siteSlug].json
# outputs social-agent.html in the current directory
```

Run this command now and show the user the output. Fix any errors before continuing.

---

## Step 3 — Check `/api/buffer-post` in the target project

If the target project already has `api/buffer-post.js` or `netlify/functions/buffer-post.js`, skip this step.

Otherwise create `api/buffer-post.js` in the target project:

```javascript
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { platform, text, scheduledAt, mediaUrl } = req.body;

  const profileMap = {
    facebook:  process.env.BUFFER_FB_PROFILE_ID,
    instagram: process.env.BUFFER_IG_PROFILE_ID,
    linkedin:  process.env.BUFFER_LI_PROFILE_ID,
  };

  const profile_id = profileMap[platform];
  if (!profile_id) return res.status(400).json({ error: `Unknown platform: ${platform}` });

  if (platform === 'instagram' && !mediaUrl) {
    return res.status(200).json({ skipped: true, reason: 'Instagram requires an image URL' });
  }

  const params = new URLSearchParams();
  params.append('access_token', process.env.BUFFER_ACCESS_TOKEN);
  params.append('profile_ids[]', profile_id);
  params.append('text', text);
  if (scheduledAt) { params.append('scheduled_at', scheduledAt); params.append('now', 'false'); }
  else { params.append('now', 'true'); }
  if (mediaUrl) params.append('media[photo]', mediaUrl);

  const r = await fetch('https://api.bufferapp.com/1/updates/create.json', { method: 'POST', body: params });
  const data = await r.json();
  if (!r.ok || !data.success) return res.status(502).json({ error: data.message || 'Buffer API error' });
  return res.status(200).json({ postId: data.updates?.[0]?.id || 'ok' });
}
```

Also check if the target project has `api/generate-posts.js` — this powers the "Research & Draft" button. If it doesn't exist, note this in the checklist as a required step.

---

## Step 4 — Output the setup checklist

```
## Setup Checklist — [Site Name] Social Command Centre

### Done ✓
- social-agent.html generated and placed in project root
- api/buffer-post.js created (or confirmed present)

### Still needed

**1. Set your admin password**
Generate a SHA-256 hash of your chosen password:
  https://emn178.github.io/online-tools/sha256.html
Then add it to scripts/sites/[siteSlug].json → "passwordHash"
and re-run the generator, OR edit social-agent.html directly.

**2. Buffer credentials**
Add to your environment variables (Vercel / Netlify / .env):
  BUFFER_ACCESS_TOKEN=your_token
  BUFFER_FB_PROFILE_ID=your_fb_id
  BUFFER_IG_PROFILE_ID=your_ig_id
  BUFFER_LI_PROFILE_ID=your_li_id

Find profile IDs: https://buffer.com/developers/api

**3. AI post generation**
The "Research & Draft" button calls POST /api/generate-posts.
Copy api/generate-posts.js from oldoaktown (or create a new one).

**4. Deploy**
Commit and deploy. Visit /social-agent.html to test.
```

---

## Re-generating after config changes

If the user wants to update colours, sources, or any config after initial setup:

1. Edit `scripts/sites/[siteSlug].json`
2. Re-run `node scripts/generate-social-agent.js --config scripts/sites/[siteSlug].json --output <path>`
3. The file is replaced — no manual editing needed

This makes the config file the single source of truth for each site's Social Command Centre.
