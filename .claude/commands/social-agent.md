# Social Command Centre — Setup Skill

You are setting up a **Social Command Centre** for a website. This is a self-contained, single-file HTML dashboard that lets the site owner research, draft, approve, and schedule social media posts to **Facebook**, **Instagram**, and **LinkedIn** via **Buffer**.

## What you must do

### Step 1 — Read the project
Before generating anything, read the following to understand the site's identity:
- `README.md` or `index.html` — for the site name, tagline, and description
- Any existing CSS or design tokens — for brand colours, fonts, and visual style
- `CLAUDE.md` (if present) — for strategic context and tone guidance
- Any existing `social-agent.html` — to understand what's already built

### Step 2 — Gather these details (ask the user if not found in files)
- **Site name** (e.g. "Old Oak Town")
- **Site tagline / one-liner**
- **Primary brand colour** (dark hero colour for the header)
- **Secondary / accent colour** (used for buttons and highlights)
- **Pale / ghost colour** (used for backgrounds and chips)
- **Google Fonts** — serif font for headings, sans-serif for body (match existing or choose appropriate)
- **Tone options** — 4 tone labels appropriate to the site's voice (e.g. Warm / Bold / Witty / Expert)
- **Research sources** — what sources should the social agent monitor when drafting posts? (e.g. "Latest news", "Community events", "Business updates")
- **Content themes** — what topics does this site cover?
- **Buffer API endpoint** — confirm the site already has `/api/buffer-post` or will need one created

### Step 3 — Generate `social-agent.html`

Create a complete, self-contained `social-agent.html` file with the following features:

#### Auth gate
- Password protected with a SHA-256 hash check (client-side, sessionStorage)
- Styled login screen using the site's brand colours
- Default password hash can be a placeholder — tell the user to replace it

#### Header
- Sticky header with site brand icon + name + tagline
- Pipeline progress indicator: `Research → Draft → Approve → Schedule`
- Status indicator showing Buffer connection

#### Sidebar (left panel, ~290px)
- **Week date picker** (defaults to next Monday)
- **Weekly theme** text input
- **Extra context** textarea
- **Tone selector** — 4 buttons in a 2×2 grid (site-appropriate labels)
- **Research sources** toggle switches (site-specific sources)
- **"Research & Draft"** primary action button

#### Main content area (right panel)

**Phase 1–2: Research & Draft**
- Terminal-style animated log showing research steps
- Research findings displayed as chips

**Phase 3: Approve**
- Stats bar: Total / Approved / Rejected / Pending
- Filter buttons: All / Pending / Approved / Rejected + Approve All
- Post cards — one per day per platform:
  - Platform tabs: Facebook / Instagram / LinkedIn
  - Editable post text (textarea)
  - Scheduled time input
  - Image URL input
  - Approve / Reject buttons with visual state
  - Character counter appropriate to each platform (FB: 63,206 / IG: 2,200 / LI: 3,000)

**Phase 4: Schedule**
- Animated sending log
- Result grid showing success/skip/fail per post
- "Plan Another Week" restart button

#### Session persistence
- Save drafts to `localStorage` with the key `[site-slug]_drafts_v2`
- Show "Saved session" banner on reload with Resume / Discard options

#### Buffer API integration
- POST to `/api/buffer-post` with `{ platform, text, scheduledAt, mediaUrl, day }`
- Handle success, skip (platform not connected), and error states
- Show per-post result cards with platform, status, and Buffer post ID

#### Simulated AI drafting
- `runResearch()` function that simulates multi-step research with timed log entries
- `generateDrafts()` function that produces realistic sample posts for each day/platform
- Posts should reflect the site's content themes, tone, and current week theme
- 5 days × 3 platforms = 15 posts per session

#### Visual design requirements
- Match the site's exact brand colours using CSS custom properties
- Use the same Google Fonts as the site
- Green-terminal aesthetic for the research log (`#A3E635` text on dark background)
- Platform brand colours: FB `#1877F2` / IG `#C13584` / LI `#0A66C2`
- Responsive sidebar + main layout with sticky header
- Toast notifications for actions

### Step 4 — Create the Buffer API endpoint (if it doesn't exist)

If the site doesn't already have `/api/buffer-post`, create it. The platform/language depends on the site's stack:

**For Netlify Functions** — create `netlify/functions/buffer-post.js`:
```javascript
// Accepts: { platform, text, scheduledAt, mediaUrl, day }
// Maps platform to Buffer profile ID from env vars
// POSTs to https://api.bufferapp.com/1/updates/create.json
// Returns: { postId } or { skipped: true, reason } or error
```

**For Vercel** — create `api/buffer-post.js` (same logic)

**For Node/Express** — add a route to `server.js`

Require these environment variables:
- `BUFFER_ACCESS_TOKEN`
- `BUFFER_FB_PROFILE_ID`
- `BUFFER_IG_PROFILE_ID`
- `BUFFER_LI_PROFILE_ID`

### Step 5 — Tell the user what to do next

After generating the files, output a clear checklist:

```
## Setup Checklist

### 1. Set your admin password
In social-agent.html, replace ADMIN_PASSWORD_HASH with the SHA-256 of your chosen password.
Generate it at: https://emn178.github.io/online-tools/sha256.html

### 2. Connect Buffer
Add these to your environment variables (.env / Netlify / Vercel settings):
  BUFFER_ACCESS_TOKEN=your_token_here
  BUFFER_FB_PROFILE_ID=your_fb_profile_id
  BUFFER_IG_PROFILE_ID=your_ig_profile_id
  BUFFER_LI_PROFILE_ID=your_li_profile_id

Find your Buffer profile IDs at: https://buffer.com/developers/api

### 3. Deploy
Commit and deploy. The social-agent.html file is at [path].

### 4. Access
Visit [site-url]/social-agent.html — it's password-protected.
```

## Key principles

- **Self-contained** — one HTML file, no external dependencies beyond Google Fonts and the Buffer API
- **Brand-faithful** — colours, fonts, and tone must match the site exactly
- **Content-aware** — simulated drafts should feel real for that site's niche
- **Buffer-first** — always use Buffer, never direct platform APIs
- **HITL** — the approval step is mandatory, never auto-schedule without human review
