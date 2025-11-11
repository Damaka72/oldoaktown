# Next Steps: Getting Old Oak Town Live

## Immediate Actions (Week 1)

### 1. Set Up Essential Services

#### Google Analytics 4
1. Go to [analytics.google.com](https://analytics.google.com)
2. Create new property for oldoaktown.co.uk
3. Get your Measurement ID (format: G-XXXXXXXXXX)
4. Edit `index.html` lines 10-16, uncomment and replace G-XXXXXXXXXX
5. Verify tracking is working

#### Google AdSense
1. Apply at [google.com/adsense](https://www.google.com/adsense)
2. Add your site and verify ownership
3. Wait for approval (typically 1-2 weeks)
4. Once approved, get your Publisher ID (format: ca-pub-XXXXXXXXXXXXXXXX)
5. Edit `index.html` lines 19-20, uncomment and replace ca-pub-XXXXXXXXXXXXXXXX
6. Create ad units in AdSense dashboard
7. Add ad code to index.html (see docs/IMPLEMENTATION_GUIDE.md)

#### Email Service for Forms
**Option A: Free Email Forwarding**
1. Use CloudFlare email routing (free)
2. Set up info@oldoaktown.co.uk → your personal email
3. Configure form submissions to send to this address

**Option B: Email Marketing Platform (Recommended)**
1. Sign up for Mailchimp (free up to 500 subscribers)
2. Create audience list "Old Oak Town Newsletter"
3. Get signup form embed code
4. Replace newsletter form action in index.html

### 2. Install Dependencies and Test RSS Aggregator

```bash
# Navigate to project
cd /path/to/oldoaktown

# Install dependencies
npm install

# Test RSS aggregation
npm run fetch-feeds

# Check results
ls -la data/review-queue/
```

**Expected Result:** New JSON files in `data/review-queue/` with aggregated news articles

### 3. Deploy to Hosting

#### Recommended: Netlify (Easiest)

1. **Sign up** at [netlify.com](https://www.netlify.com)

2. **Connect Repository:**
   - "Add new site" → "Import an existing project"
   - Connect to GitHub
   - Select oldoaktown repository
   - Branch: `claude/oldoaktown-strategic-blueprint-011CV24Mjh7UEHbHdVE9V6Ec`

3. **Build Settings:**
   - Build command: (leave empty for static site)
   - Publish directory: `/` (root)
   - Deploy!

4. **Custom Domain:**
   - Domain settings → Add custom domain
   - Enter: oldoaktown.co.uk
   - Follow DNS configuration instructions
   - Enable HTTPS (automatic via Netlify)

5. **Verify:**
   - Visit your-site.netlify.app
   - Should see your landing page
   - Test all forms and links

#### Alternative: GitHub Pages

```bash
# In your repository settings:
# Settings → Pages → Source: Deploy from branch
# Branch: claude/oldoaktown-strategic-blueprint-011CV24Mjh7UEHbHdVE9V6Ec
# Folder: / (root)
# Custom domain: oldoaktown.co.uk
```

### 4. Configure GitHub Actions

The workflow is already set up (`.github/workflows/rss-aggregation.yml`)

**To enable:**
1. Go to repository Settings → Actions → General
2. Set "Workflow permissions" to "Read and write permissions"
3. Save
4. Go to Actions tab
5. Enable workflows
6. Run "Daily RSS Aggregation" manually to test

**Expected Result:** New articles appear in `data/review-queue/` daily at 8 AM UTC

### 5. Protect Admin Dashboard

The admin review dashboard (`admin/review.html`) should be password-protected.

#### Netlify Method:
Create `admin/_redirects` file:
```
/admin/*  200!  Role=admin
```

Then in Netlify dashboard:
- Site settings → Identity → Enable Identity
- Set up password protection for `/admin/*` path

#### .htaccess Method (traditional hosting):
Create `admin/.htaccess`:
```apache
AuthType Basic
AuthName "Admin Area"
AuthUserFile /full/path/to/.htpasswd
Require valid-user
```

Generate password:
```bash
htpasswd -c .htpasswd admin
```

---

## Week 2-4: Content and Growth

### Week 2: First Content Push

1. **Review Aggregated Content:**
   - Open `admin/review.html`
   - Review articles in queue
   - Fact-check and approve 5-10 articles

2. **Write First Deep Dive (Pillar 3):**
   - Topic suggestion: "Why is HS2 Old Oak Delayed? A Timeline Analysis"
   - Target: 2,000-3,000 words
   - Include sources, data, expert quotes
   - See `docs/CONTENT_STRATEGY.md` for format

3. **Create First "Living in Old Oak" Guide (Pillar 2):**
   - Topic: "The Complete Guide to Old Oak Common: Living, Working, and Getting Around"
   - Sections: Transport, Housing, Food, Community, Services
   - Include photos and maps
   - Target: 1,500 words

4. **Launch Social Media:**
   - Create Twitter/X account: @OldOakTown
   - Create Facebook page: Old Oak Town
   - Post 2-3 times per day
   - Share news articles with commentary
   - Engage with local community groups

### Week 3: Outreach and Backlinks

1. **Contact Local Businesses:**
   - Identify 20 businesses in Old Oak/Park Royal area
   - Email offering free directory listing
   - Schedule 5 business spotlights for coming weeks

2. **Community Engagement:**
   - Join Old Oak Neighbourhood Forum online
   - Comment on relevant discussions (with value, not spam)
   - Share your content where appropriate
   - Introduce the site to community leaders

3. **Media Outreach:**
   - Email local journalists (Ealing Times, etc.)
   - Offer to be expert source on Old Oak development
   - Share unique data or insights
   - Request backlink to your site

4. **Local Directory Submissions:**
   - Submit to Google My Business
   - List on Yelp, Yell, Thomson Local
   - Add to local business directories
   - Submit to UK news aggregators

### Week 4: Newsletter Launch

1. **Set up Mailchimp (or alternative):**
   - Import any email signups from site
   - Create newsletter template
   - Schedule first send

2. **First Newsletter Content:**
   ```
   Subject: Introducing Old Oak Town: Your New Community Resource

   - Welcome message
   - Site overview
   - Top 3 recent news stories
   - Featured business
   - Upcoming events
   - Invitation to contribute
   ```

3. **Promotion:**
   - Announce on social media
   - Add newsletter signup to all pages
   - Offer incentive (e.g., "Subscribe for weekly exclusive insights")
   - Email local community groups about the launch

---

## Month 2-3: Monetization

### Week 5-6: First Revenue

1. **Direct Advertising Outreach:**
   - Contact 10 local businesses from your directory
   - Offer special launch rate: £25/month for first 3 months
   - Target: 3-5 paid listings
   - Expected revenue: £75-125/month

2. **Affiliate Partnerships:**
   - Sign up for Rightmove/Zoopla affiliate programs
   - Add property search widget to site
   - Sign up for Amazon Associates (local guides with product recommendations)
   - Add affiliate disclosure to footer

3. **Optimize AdSense:**
   - Review first month's data
   - Test different ad placements
   - Add in-article ads to high-traffic pages
   - Target: £100-200/month

### Week 7-8: Content Scale

1. **Publish 20+ Articles:**
   - 15 Pillar 1 (factual updates)
   - 5 Pillar 2 (community/lifestyle)
   - 1 Pillar 3 (deep dive)

2. **Build Content Calendar:**
   - Plan next 3 months of content
   - Assign topics and deadlines
   - Set up content tracking system

3. **SEO Optimization:**
   - Keyword research for "Old Oak Common" + long-tail keywords
   - Optimize existing articles (titles, meta descriptions, headings)
   - Internal linking strategy
   - Build sitemap.xml and submit to Google

### Week 9-12: Community Building

1. **Events and Presence:**
   - Attend Old Oak Community Forum meeting
   - Network with residents and businesses
   - Consider sponsoring small local event (£50-100)
   - Take photos for content

2. **User-Generated Content:**
   - Invite community submissions
   - Feature resident stories
   - Create "Your Old Oak" section
   - Build engagement and loyalty

3. **Analytics Review:**
   - Monthly traffic report
   - Revenue by source
   - Top-performing content
   - Adjust strategy based on data

---

## Month 4-6: Growth and Scale

### Key Milestones

- [ ] 100+ published articles
- [ ] 1,000+ monthly visitors
- [ ] 200+ newsletter subscribers
- [ ] £500+/month revenue
- [ ] 10+ high-quality backlinks
- [ ] 5+ paid directory listings

### Priorities

1. **Content Expansion:**
   - Consider video content (construction time-lapses, interviews)
   - Start podcast or audio updates (5-10 min weekly)
   - Expand to Instagram for visual content

2. **Premium Features:**
   - Launch membership tier (£5/month ad-free + exclusive content)
   - Create monthly "Old Oak Insights" report (£25/month for businesses)
   - Offer paid guest posts (£150-250)

3. **Community Partnerships:**
   - Partner with Old Oak Neighbourhood Forum
   - Collaborate with OPDC on content
   - Work with local schools or community centers
   - Build advisory board of community leaders

4. **Technical Improvements:**
   - Consider upgrading to proper CMS (WordPress, etc.) if needed
   - Implement comment system (Disqus or similar)
   - Add events calendar functionality
   - Build interactive development map

---

## Month 7-12: Toward Sustainability

### Revenue Target: £1,000-1,500/month

**Breakdown:**
- AdSense: £200-300
- Directory listings (10 x £50 avg): £500
- Affiliates: £150-200
- Memberships (20 x £10 avg): £200
- Guest posts (2 x £200): £400

### Content Target: 200+ total articles

**Mix:**
- 140 Pillar 1 (factual updates)
- 40 Pillar 2 (community/lifestyle)
- 20 Pillar 3 (deep dives)

### Audience Target:
- 5,000 monthly visitors
- 500 newsletter subscribers
- 2,000 social media followers
- 50+ backlinks

### Preparation for Year 2:

1. **Document Everything:**
   - Operating procedures
   - Content workflows
   - Revenue sources
   - Key contacts

2. **Automate More:**
   - Consider hiring VA for content review (£200-400/month)
   - Automate social media posting
   - Set up automated reporting

3. **Strategic Planning:**
   - Review Year 1 performance
   - Set Year 2 goals
   - Consider marketplace features
   - Plan for potential exit in Year 3-5

---

## Emergency Contacts and Resources

### Technical Support
- **Netlify Support:** [support.netlify.com](https://support.netlify.com)
- **GitHub Support:** [support.github.com](https://support.github.com)
- **Node.js Issues:** Check `/scripts/rss-aggregator.js` comments

### Strategic Questions
- Review `/STRATEGIC_BLUEPRINT.md`
- Review `/docs/CONTENT_STRATEGY.md`
- Review `/docs/IMPLEMENTATION_GUIDE.md`

### Community Resources
- Old Oak Neighbourhood Forum: [oldoakneighbourhoodforum.org](http://oldoakneighbourhoodforum.org)
- OPDC: [london.gov.uk/opdc](https://www.london.gov.uk/programmes-strategies/planning/planning-applications-and-decisions/opdc)
- HS2: [hs2.org.uk](https://www.hs2.org.uk)

---

## Success Checklist

### Week 1
- [ ] Google Analytics installed and tracking
- [ ] Site deployed to live hosting
- [ ] Custom domain configured
- [ ] RSS aggregation tested and working
- [ ] Admin dashboard password protected

### Month 1
- [ ] 20+ articles published
- [ ] Newsletter launched with 50+ subscribers
- [ ] Social media accounts active
- [ ] 3+ paid directory listings
- [ ] 500+ monthly visitors

### Month 3
- [ ] 60+ articles published
- [ ] First deep dive investigation published
- [ ] 150+ newsletter subscribers
- [ ] £500+/month revenue
- [ ] 5+ quality backlinks

### Month 6
- [ ] 120+ articles published
- [ ] 300+ newsletter subscribers
- [ ] £1,000+/month revenue
- [ ] 2,000+ monthly visitors
- [ ] 10+ quality backlinks

### Month 12
- [ ] 200+ articles published
- [ ] 500+ newsletter subscribers
- [ ] £1,500+/month profit
- [ ] 5,000+ monthly visitors
- [ ] Recognized as local authority on Old Oak development

---

**Remember:** This is a long-term project (2025-2039). Success comes from patient, consistent execution over years, not months. Focus on building trust, authority, and community relationships.

**Questions?** Review the documentation or adjust the strategy as you learn what works for your specific community and circumstances.

Good luck! 🌳
