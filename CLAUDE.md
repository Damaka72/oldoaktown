# Old Oak Town — Claude Context

## What this project is

**Old Oak Town** (`oldoaktown.co.uk`) is a hyperlocal news and community resource covering the Old Oak Common regeneration project in West London — one of Europe's largest urban regeneration schemes. The site tracks HS2 station development, new housing (25,500 homes), job creation (65,000 jobs), and community life.

**Strategic goal:** Build a trusted, long-term digital asset worth £100,000+ at exit (35–40× monthly profit). The HS2 timeline runs to 2039, so this is patient institution-building, not a quick flip.

---

## Brand identity

| Token | Value |
|---|---|
| Primary (header/hero) | `#1C3A0E` (deep forest green) |
| Accent (buttons/highlights) | `#4C8A35` (bright green) |
| Mid green | `#2F6020` |
| Pale green | `#D4E8C8` |
| Ghost green (bg) | `#F0F7EB` |
| Cream (page bg) | `#FAF8F4` |
| Ink (text) | `#0F1A0A` |
| Muted (labels) | `#6B7B5E` |
| Border | `#DDE8D4` |
| Amber (warnings) | `#D4860A` |
| Red (errors/reject) | `#C0392B` |

**Fonts:**
- Headings: `Instrument Serif` (italic for hero text)
- Body: `DM Sans`
- Monospace/code: `Geist Mono`

**Tone:** Warm, community-focused, journalistic. Trustworthy and local, not corporate. The tree emoji 🌳 is the site's signature icon.

---

## Tech stack

- **Frontend:** Static HTML/CSS/JS — single-file pages, no framework
- **Backend:** Node.js (server.js) + Netlify/Vercel serverless functions
- **Database:** Supabase (businesses, payments)
- **Payments:** Stripe
- **Hosting:** Vercel (primary) / Netlify
- **Automation:** GitHub Actions (daily RSS aggregation at 8 AM UTC)
- **Social scheduling:** Buffer (Facebook, Instagram, LinkedIn)
- **Analytics:** Google Analytics 4

---

## Project structure

```
oldoaktown/
├── index.html                  # Main site homepage
├── social-agent.html           # Social Command Centre (admin tool)
├── business-directory.html     # Business listings
├── business-submit.html        # Business submission form
├── admin/review.html           # Content review dashboard
├── api/                        # Serverless API routes
│   └── buffer-post.js          # Buffer scheduling endpoint
├── netlify/functions/          # Netlify serverless functions
├── scripts/rss-aggregator.js   # RSS feed fetcher
├── data/
│   ├── review-queue/           # Pending content (HITL)
│   ├── published/news/         # Live articles
│   └── archive/                # Historical data
├── supabase/                   # DB migrations and config
├── .claude/commands/           # Claude Code skills (slash commands)
│   └── social-agent.md         # /social-agent skill
├── CLAUDE.md                   # This file
├── STRATEGIC_BLUEPRINT.md      # Full business strategy
└── package.json
```

---

## Content strategy (Three Pillars)

| Pillar | % | Type | Method |
|---|---|---|---|
| Factual & Foundational | 70% | HS2 updates, OPDC news, planning | Automated RSS + HITL review |
| Hyperlocal Lifestyle | 20% | Community events, business spotlights | Semi-automated templates |
| Deep Dive Analysis | 10% | Investigations, expert analysis | Manual, original journalism |

**Key sources:** HS2 Ltd, OPDC, Old Oak Neighbourhood Forum, Construction Enquirer, local council feeds.

**HITL is non-negotiable** — all automated content goes through human review before publishing. Trust is the primary asset.

---

## Revenue model

| Stream | Target |
|---|---|
| Google AdSense | £100–300/month |
| Directory listings (£35–150/month each) | £500–1,500/month |
| Affiliate marketing | £200–500/month |
| Memberships (£5–25/month) | £250–500/month |
| Paid guest posts (£150–400 each) | £400–1,200/month |

**Exit target:** £50,000–160,000 at 35–40× monthly profit. Optimal exit: Year 3–5.

---

## Social Command Centre

The Social Command Centre (`social-agent.html`) is a **password-protected admin tool** for planning and scheduling weekly social media content. It is NOT a public-facing page.

### How it works

**4-step pipeline:**
1. **Research** — Simulated research pull from configured sources (HS2 news, community events, business updates, planning applications, transport)
2. **Draft** — AI-generated post drafts for each day × platform (15 posts/week: 5 days × FB + IG + LI)
3. **Approve** — Human review board. Edit, approve, or reject each post individually
4. **Schedule** — Approved posts sent to Buffer via `/api/buffer-post`

### Buffer API
- Endpoint: `POST /api/buffer-post`
- Payload: `{ platform, text, scheduledAt, mediaUrl, day }`
- Environment variables required:
  - `BUFFER_ACCESS_TOKEN`
  - `BUFFER_FB_PROFILE_ID`
  - `BUFFER_IG_PROFILE_ID`
  - `BUFFER_LI_PROFILE_ID`

### Tone options
- **Warm** — community-first, neighbourly
- **Bold** — strong takes, newsworthy hooks
- **Witty** — light-hearted, emoji-friendly
- **Expert** — data-led, authoritative

### Research toggles
- HS2 & construction updates
- Community events
- Business spotlights
- Planning applications
- Transport & infrastructure

---

## Reusing the Social Command Centre on other sites

Use the `/social-agent` skill (`.claude/commands/social-agent.md`) to scaffold a Social Command Centre for any other website. The skill will:

1. Read the target project's files to extract branding, colours, fonts, and content themes
2. Generate a tailored `social-agent.html` adapted to that site
3. Create the `/api/buffer-post` endpoint if it doesn't exist
4. Output a setup checklist for Buffer credentials and password configuration

**Invoke it with:** `/social-agent` in any project session.

---

## Development conventions

- Keep pages self-contained where possible (HTML/CSS/JS in one file for admin tools)
- Use CSS custom properties (`--var-name`) for all colours — never hardcode hex values in component styles
- No frontend frameworks — vanilla JS only
- API routes go in `api/` (Vercel) and `netlify/functions/` (Netlify) — keep both in sync
- Never commit secrets — use environment variables for all API keys
- The `data/review-queue/` directory is the HITL staging area — never auto-publish from it

---

## Key contacts / context

- **Site:** oldoaktown.co.uk
- **GitHub:** Damaka72/oldoaktown
- **Email:** info@oldoaktown.co.uk
- **Audience:** 39% aged 20–39, multicultural, multi-person households in West London
- **Competition:** Virtually none — first-mover in hyperlocal Old Oak Common coverage
