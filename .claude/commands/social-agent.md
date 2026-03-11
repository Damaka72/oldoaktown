# /social-agent — Social Command Centre Setup

**CRITICAL:** This skill produces an exact copy of the Old Oak Town `social-agent.html` with only site-specific substitutions. Do NOT redesign, rebuild, or generate from scratch. The goal is a pixel-perfect clone with different branding and research sources.

---

## Step 1 — Get the master template

Fetch the master template using WebFetch:

```
https://raw.githubusercontent.com/Damaka72/oldoaktown/main/social-agent.html
```

This is the single source of truth. Copy the entire file content into the new project's `social-agent.html`. All subsequent steps are find-and-replace operations on this file.

---

## Step 2 — Ask the user for site details

Ask the user for the following (check existing project files first — index.html, CLAUDE.md, README.md — before asking):

1. **Site name** (e.g. "Didiani Olue")
2. **Site slug** (short lowercase, no spaces — used for localStorage keys, e.g. `didiani`)
3. **Site icon letter or emoji** (replaces the "O" in the brand icon box)
4. **Primary colour** — dark header/hero colour (hex, replaces `#1C3A0E`)
5. **Accent colour** — buttons and highlights (hex, replaces `#4C8A35`)
6. **Mid colour** — hover states (hex, replaces `#2F6020`)
7. **Pale colour** — chips and light accents (hex, replaces `#D4E8C8`)
8. **Ghost colour** — input backgrounds (hex, replaces `#F0F7EB`)
9. **Border colour** (hex, replaces `#DDE8D4`)
10. **Muted colour** — labels and subtext (hex, replaces `#6B7B5E`)
11. **Ink colour** — body text (hex, replaces `#0F1A0A`)
12. **Google Fonts** — heading font and body font (or keep Instrument Serif / DM Sans if appropriate)
13. **Research sources** — up to 6 toggle rows (label + emoji). These replace the 4 existing toggle rows in the sidebar. Examples: `🍽 Restaurant news`, `🎭 Events & culture`, `🏘 Community updates`
14. **Weekly theme placeholder** — hint text in the theme input (replaces `HS2 update, new business spotlight…`)
15. **Idle state description** — one sentence shown before the user starts (replaces the Old Oak Town description)
16. **Pipeline log messages** — 4–5 log lines shown during research (replaces the HS2/OPDC-specific messages)

---

## Step 3 — Apply substitutions

Make **only** these changes to the copied file. Do not touch anything else.

### Title
```
Old Oak Town — Social Command Centre
→ [Site Name] — Social Command Centre
```

### Google Fonts URL (only if different fonts chosen)
Replace the `@import url(...)` line with the new Google Fonts import.

### CSS colour variables — rename and replace values
The CSS variable names use `--green-*` because Old Oak Town is a green-branded site. For other sites, rename the variables to neutral names (`--primary`, `--accent`, etc.) AND update all references throughout the file. Here is the full substitution map:

| Old variable | New variable | Old value | New value |
|---|---|---|---|
| `--green-deep` | `--primary` | `#1C3A0E` | [user's primary colour] |
| `--green-mid` | `--primary-mid` | `#2F6020` | [user's mid colour] |
| `--green-bright` | `--accent` | `#4C8A35` | [user's accent colour] |
| `--green-pale` | `--accent-pale` | `#D4E8C8` | [user's pale colour] |
| `--green-ghost` | `--ghost` | `#F0F7EB` | [user's ghost colour] |
| `--border` | `--border` | `#DDE8D4` | [user's border colour] |
| `--muted` | `--muted` | `#6B7B5E` | [user's muted colour] |
| `--ink` | `--ink` | `#0F1A0A` | [user's ink colour] |
| `--cream` | `--cream` | `#FAF8F4` | derive from ghost (slightly warmer) |

**After renaming variables in `:root {}`, do a global find-and-replace to update every `var(--green-deep)`, `var(--green-mid)`, `var(--green-bright)`, `var(--green-pale)`, `var(--green-ghost)` reference throughout the entire file.**

### Brand icon
```html
<div class="brand-icon">O</div>
→ <div class="brand-icon">[icon letter or emoji]</div>
```

### Brand name and subtitle
```html
<div class="brand-name">Old Oak Town</div>
<div class="brand-sub">Social Command Centre</div>
→ <div class="brand-name">[Site Name]</div>
<div class="brand-sub">Social Command Centre</div>
```

### Login screen heading and logo
```html
<img src="images/logo.png" alt="Old Oak Town" ...>
<h1 style="color:#1C3A0E; ...">Admin Access</h1>
```
Replace the logo img with the site's logo path (or remove it if unknown), update the inline colour to the primary hex, update alt text.

### localStorage keys
```javascript
const SESSION_KEY  = 'oot_drafts_v2';
→ const SESSION_KEY  = '[slug]_drafts_v2';

const HISTORY_KEY = 'oot_post_history';
→ const HISTORY_KEY = '[slug]_post_history';
```

### Admin password hash
```javascript
const ADMIN_PASSWORD_HASH = '924325fbd85f063f2439544a4bd4cbe61433c2c83eb3e5a7ead42b984b7a2223';
→ const ADMIN_PASSWORD_HASH = 'REPLACE_WITH_SHA256_OF_YOUR_PASSWORD';
```

### Research source toggles
Replace the entire `<div class="research-toggles">` block with the new sources. Each toggle follows this pattern — keep `on` class on sources that should default to enabled:
```html
<div class="toggle-row">
  <span>[emoji] [Label]</span>
  <button class="toggle on" onclick="this.classList.toggle('on')"></button>
</div>
```

### Weekly theme placeholder
```
placeholder="HS2 update, new business spotlight…"
→ placeholder="[site-specific placeholder]"
```

### Idle state description
```html
<p>Enter your weekly theme, toggle your research sources, then hit Research &amp; Draft. Approved posts go directly to Buffer via the Old Oak Town API.</p>
→ <p>Enter your weekly theme, toggle your research sources, then hit Research &amp; Draft. Approved posts go directly to Buffer via the [Site Name] API.</p>
```

### Research pipeline log messages
Replace the `addLog` lines inside `runPipeline()` with site-specific messages:
```javascript
addLog(log, '> Initialising Old Oak Town research pipeline…', 0);
addLog(log, '> Searching: HS2 Old Oak Common latest news…', 600, 'info');
addLog(log, '> Fetching: oldoaktown.co.uk content…', 1100, 'info');
addLog(log, '> Searching: West London regeneration community news…', 1600, 'info');
addLog(log, '> Searching: OPDC planning updates Park Royal…', 2000, 'info');
```
→ Replace with 4–5 lines matching the site's research sources and URL.

---

## Step 4 — Check `/api/buffer-post` exists

If the target project already has `api/buffer-post.js` or `netlify/functions/buffer-post.js`, skip this step.

Otherwise create `api/buffer-post.js`:

```javascript
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { platform, text, scheduledAt, mediaUrl, day } = req.body;

  const profileMap = {
    facebook:  process.env.BUFFER_FB_PROFILE_ID,
    instagram: process.env.BUFFER_IG_PROFILE_ID,
    linkedin:  process.env.BUFFER_LI_PROFILE_ID,
  };

  const profile_ids = profileMap[platform];
  if (!profile_ids) return res.status(400).json({ error: `Unknown platform: ${platform}` });

  // Instagram requires media
  if (platform === 'instagram' && !mediaUrl) {
    return res.status(200).json({ skipped: true, reason: 'Instagram requires an image URL' });
  }

  const params = new URLSearchParams();
  params.append('access_token', process.env.BUFFER_ACCESS_TOKEN);
  params.append('profile_ids[]', profile_ids);
  params.append('text', text);
  if (scheduledAt) {
    params.append('scheduled_at', scheduledAt);
    params.append('now', 'false');
  } else {
    params.append('now', 'true');
  }
  if (mediaUrl) params.append('media[photo]', mediaUrl);

  const response = await fetch('https://api.bufferapp.com/1/updates/create.json', {
    method: 'POST',
    body: params,
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    return res.status(502).json({ error: data.message || 'Buffer API error', hint: 'Check BUFFER_ACCESS_TOKEN and profile IDs' });
  }

  return res.status(200).json({ postId: data.updates?.[0]?.id || 'ok' });
}
```

---

## Step 5 — Output a setup checklist

After creating the files, give the user this checklist:

```
## Setup Checklist — [Site Name] Social Command Centre

### 1. Set your admin password
Replace REPLACE_WITH_SHA256_OF_YOUR_PASSWORD in social-agent.html with the
SHA-256 hash of your chosen password.
Generate it at: https://emn178.github.io/online-tools/sha256.html

### 2. Connect Buffer
Add to your environment variables (.env / Vercel / Netlify settings):
  BUFFER_ACCESS_TOKEN=your_token_here
  BUFFER_FB_PROFILE_ID=your_fb_profile_id
  BUFFER_IG_PROFILE_ID=your_ig_profile_id
  BUFFER_LI_PROFILE_ID=your_li_profile_id

Find your Buffer profile IDs at: https://buffer.com/developers/api

### 3. Add your AI post generation endpoint
The "Research & Draft" button calls POST /api/generate-posts.
You need to create api/generate-posts.js (or copy from oldoaktown).

### 4. Deploy and test
Visit /social-agent.html — it's password-protected.
```

---

## What does NOT change

Leave these completely untouched:
- All CSS layout, spacing, component structure
- The 4-phase pipeline logic (Research → Draft → Approve → Buffer)
- The approval board rendering (`renderApprovalBoard`, `renderActions`, etc.)
- Session persistence logic
- Buffer sending logic (`sendToSocial`, `postOneToSocial`, etc.)
- Stats bar, filter buttons, toast system
- The pipeline steps in the header (1 Research → 2 Draft → 3 Review → 4 Buffer → 5 Live)
- The `callClaude` / `runPipeline` / `flattenPosts` functions (only log messages change)
- Platform colours: `--fb`, `--ig`, `--li`, `--make`, `--amber`, `--red` (keep as-is)
