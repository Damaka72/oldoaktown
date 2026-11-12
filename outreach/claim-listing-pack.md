# "Claim your listing" outreach pack

**Goal:** tell each listed independent business that they're in the directory, get their details corrected, collect a logo and photo, and (only if they want it) start the upgrade conversation.

**What's in `outreach/`**

| File | Use |
|---|---|
| `call-sheet.csv` | One row per business, grouped by postcode so you can plan a walking route. Blank columns to log every contact. Open in Excel or Google Sheets. |
| `leaflets.html` | One A5 leaflet per business, personalised with their listing and a QR code to their tile. Open in Chrome, Print, A5, margins "None", Background graphics on. Or save as PDF for a print shop. |
| `claim-listing-pack.md` | This guide: scripts, templates and the rules. |

Regenerate the first two any time with `node scripts/outreach-pack.js`.

---

## The rules (they protect the trust you're building)

1. **Be straight about how they got listed.** The listings were built from public information, not because the owner signed up. Say so.
2. **Free means free.** Never imply the listing is a paid ad or that they've been "selected", "shortlisted" or "awarded" anything.
3. **Removal is easy and prompt.** If anyone asks to come off, remove them within one working day and thank them. The leaflet promises this, so please honour it. It's also what makes the other 94 conversations easier.
4. **Don't promise results.** Don't quote visitor numbers or "reach" you can't back up. Say what they get (a listing, a social post) and no more.
5. **Upgrade is a second conversation.** Don't lead with price. Offer it once, after they've engaged.
6. **Only ask for what you'll use.** Logo, one or two photos they own, correct details. Nothing else.
7. **One follow-up, then stop.**

> **Marketing law check (UK):** unsolicited marketing *emails* to sole traders and ordinary partnerships need consent under PECR; limited companies and LLPs can be emailed with a clear opt-out. Before cold-*calling*, check numbers against the TPS/CTPS registers. Walking in with a leaflet avoids both, which is another reason to start there. The ICO's guidance on B2B marketing is a ten-minute read and worth it. This is a rule of thumb, not legal advice.

---

## 1. Walk-in (best for food, retail, services)

**Best times:** cafés and restaurants mid-morning (10–11:30) or mid-afternoon (2:30–4); shops and garages any quiet moment; avoid lunch rush and Friday late afternoon. Industrial units: weekday mornings, ask for reception.

**Take:** that business's leaflet, your phone (to show the live listing), a pen.

**Say:**

> "Hi, I'm [name] from Old Oak Town, a local news and community site for the Old Oak Common area. Quick one, no sales pitch: we've listed **[Business]** in our free local directory, and I wanted to check we've got it right. Could I leave this with you? It's got your listing on it and a QR code to see it online."

If they're interested, show them the tile on your phone, then ask:

- "Is the description and address right? Anything you'd change?"
- "Do you have a logo and a photo you're happy for us to use? You can email them to info@oldoaktown.co.uk."
- "We're also going to feature every listed business on our social media over the coming months. Is that all right with you?" *(note the answer in the sheet; if no, mark them "no social" and skip them in the schedule)*

**If they're busy:** "No problem, I'll leave this with you. Everything's on the leaflet." Leave it. Leave.

**If they ask "what's the catch?":** "There isn't one. The listing's free. We offer paid upgrades if you want to stand out, but there's no obligation and no one will chase you."

**If they want it removed:** "Of course, sorry for the trouble. I'll take it down today." Then do. Mark "Wants removing" in the sheet and remove them from the schedule.

---

## 2. Phone

*(Check the number against TPS/CTPS first.)*

> "Hello, could I speak to whoever looks after the business, please? … Hi, I'm [name] from Old Oak Town, a local news and community site for Old Oak Common. I'm calling because we've listed **[Business]** in our free local directory and I wanted to make sure the details are right. Have you got a minute?"

Then use the same three questions as the walk-in. If they're busy: "Could I send you the link by email and let you look when it suits?" and log the address *they* give you.

**Voicemail:**

> "Hi, it's [name] from Old Oak Town, the local news and community site for Old Oak Common. We've listed [Business] in our free local directory and I wanted to check the details are right. You can see your listing at oldoaktown.co.uk/business-directory.html or email info@oldoaktown.co.uk. If you'd rather not be listed, just let us know and we'll take it down. Thanks very much."

---

## 3. Email

Use only an address the business publishes itself (their website or Google listing). Don't buy lists. Limited companies: fine. Sole traders / partnerships: see the PECR note above, so prefer a visit or call.

**Subject:** Your business is listed in the Old Oak Town directory. Is the information right?

> Hello [Name / team],
>
> I'm [your name] from Old Oak Town (oldoaktown.co.uk), an independent local news and community site for the Old Oak Common area.
>
> We've added **[Business]** to our free local business directory, using publicly available information. You can see your listing here:
> [listing link]
>
> Three quick things:
> 1. **Is everything right?** If you'd like anything changed (hours, description, address), just reply.
> 2. **Logo and photo.** If you send us your logo and a photo you're happy for us to use, we'll add them to your listing.
> 3. **Social media.** Over the coming months we're featuring every listed business on our social channels. Let me know if you'd rather not be included.
>
> It's free, with no obligation. If you'd prefer not to be listed at all, reply "remove" and we'll take it down within one working day.
>
> Thanks,
> [Name]
> Old Oak Town · info@oldoaktown.co.uk

**One follow-up, a week later** (if no reply):

> Hello again, just a quick follow-up on the note below about your free listing on Old Oak Town. No need to reply if you're happy with it as it is, and I won't keep chasing. If you'd like anything changed, or want it removed, just let me know. Thanks, [Name]

---

## 4. When they say yes: what to do

| They send | You do |
|---|---|
| Corrections | Update the row in Supabase (`businesses` table); the directory page reads from it immediately. The drafted social posts don't update by themselves, so fix the wording in the Command Centre when you approve their post (or edit `schedule.json`). |
| Logo | Upload somewhere public and paste the URL into `logo_url` for that row. It appears on their tile immediately. Square or wide PNG, at least 400px. |
| Photo | Same: `image_urls` (array). Only use photos they own or have given permission to use. Then replace the generated image in their social post with it. |
| "No social" | Remove them from `schedule.json` (or set `status` to `skipped`). |
| "Remove" | Set the listing's `status` to `rejected` so it leaves the directory, remove from `schedule.json`, reply to confirm. |

> **Gap to be aware of:** there's no self-serve "claim this listing" form yet. `business-submit.html` creates a *new* listing, so sending an existing business there would create a duplicate. For now claims and corrections go by email. A proper claim flow is a sensible next build.

---

## 5. The upgrade conversation (second contact, only if they're engaged)

From `business-submit.html`:

| Plan | Price | What it adds |
|---|---|---|
| **Free** | £0 | Name, contact details, category, description |
| **Featured** | £35 / month | Featured badge and priority placement, website link, opening hours |
| **Premium** | £75 / month | Everything in Featured, plus social media links, a special-offer section, monthly newsletter mention |
| **Newsletter Sponsor** | £150 / month | Everything in Premium, plus a full newsletter ad each issue, top-of-directory placement, a dedicated feature article |

Annual billing is available (£126 / £270 / £540 for the first three).

**How to talk about it:**

> "If you ever want to stand out, there's a Featured option: it puts you at the top of the page with a badge, links to your website and shows your opening hours. £35 a month, no contract pressure. But the free listing stays free either way."

Don't promise traffic. If they ask "how many people see it?", the honest answer is the current visitor numbers from your analytics, or "I'd rather not quote a number I can't stand behind. Here's the live page."

---

## 6. Pilot businesses: tell them their date

The first ten spotlight posts go out 16–27 November. If you speak to one of these, tell them the date; it's a nice moment: *"You're our feature on Tuesday 17th."* Check `data/review-queue/business-promos/schedule.json` (entries with `"pilot": true`).

---

## Tracking

Use `call-sheet.csv`. After two weeks, tally: contacted, replied, corrections, logos received, removal requests, upgrade interest. If fewer than one in ten engage, change the approach before doing the rest. If any ask for removal, treat that as the most useful feedback you'll get.
