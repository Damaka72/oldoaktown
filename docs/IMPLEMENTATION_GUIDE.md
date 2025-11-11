# Technical Implementation Guide

## Overview
This guide provides step-by-step technical instructions for implementing the Old Oak Town strategic blueprint.

## Prerequisites

### Required Software
- Node.js 18+ or Python 3.9+
- Git
- Text editor
- Web hosting (Netlify, Vercel, or traditional hosting)

### Required Services
- Google Analytics account
- Google AdSense account
- Email service (for notifications)
- Payment processor (Stripe recommended)

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Static HTML)              │
│  - index.html (current landing page)                    │
│  - news.html (news aggregation display)                 │
│  - directory.html (business directory)                  │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────────────┐
│              Backend Services (Node.js/Python)          │
│  - RSS Aggregator (feeds → database)                    │
│  - Form Handler (submissions → review queue)            │
│  - Content Publisher (approved → live site)             │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────────────┐
│                   Data Storage                          │
│  - Content Database (JSON files or lightweight DB)     │
│  - Review Queue (pending content)                       │
│  - Published Content (live articles)                    │
└─────────────────────────────────────────────────────────┘
```

## Component 1: RSS Feed Aggregation System

### Step 1: Install Dependencies

```bash
npm init -y
npm install rss-parser node-fetch dayjs
```

### Step 2: Create RSS Aggregator Script

See `/scripts/rss-aggregator.js` for implementation.

**Key Features:**
- Fetches from multiple RSS sources
- Parses and normalizes content
- Stores in review queue
- Runs daily via cron job

**RSS Sources Configuration:**
```javascript
const RSS_SOURCES = [
  {
    name: 'HS2 Ltd',
    url: 'https://www.hs2.org.uk/feed/',
    category: 'hs2',
    priority: 'high'
  },
  {
    name: 'Construction Enquirer',
    url: 'https://www.constructionenquirer.com/feed/',
    category: 'construction',
    priority: 'medium'
  },
  {
    name: 'Old Oak Neighbourhood Forum',
    url: 'http://oldoakneighbourhoodforum.org/feed/',
    category: 'community',
    priority: 'high'
  }
  // Add more sources as needed
];
```

### Step 3: Set Up Automation

**Option A: Cron Job (Linux/Mac)**
```bash
# Edit crontab
crontab -e

# Add daily execution at 8 AM
0 8 * * * cd /path/to/oldoaktown && node scripts/rss-aggregator.js
```

**Option B: GitHub Actions (Recommended)**
```yaml
# .github/workflows/rss-aggregation.yml
name: RSS Aggregation
on:
  schedule:
    - cron: '0 8 * * *'  # Daily at 8 AM UTC
  workflow_dispatch:  # Manual trigger

jobs:
  aggregate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: node scripts/rss-aggregator.js
      - name: Commit changes
        run: |
          git config user.name "RSS Aggregator Bot"
          git config user.email "bot@oldoaktown.co.uk"
          git add data/review-queue/
          git commit -m "Update RSS feeds [automated]" || exit 0
          git push
```

## Component 2: Human-in-the-Loop Review System

### Review Dashboard (`admin/review.html`)

**Features:**
- Display pending articles from review queue
- Show source, date, content preview
- Approve/Edit/Reject buttons
- Bulk actions

**Workflow:**
1. Aggregator adds content to `/data/review-queue/`
2. Admin opens review dashboard
3. Reviews each item (fact-check, brand voice, quality)
4. Approves → moves to `/data/published/`
5. Rejects → moves to `/data/rejected/`
6. Static site generator rebuilds pages

### Authentication

**Simple approach (for single admin):**
```javascript
// Use HTTP Basic Auth or password-protected directory
// .htaccess file:
AuthType Basic
AuthName "Admin Area"
AuthUserFile /path/to/.htpasswd
Require valid-user
```

**Better approach (for growth):**
- Use Netlify Identity or Auth0
- JWT-based authentication
- Role-based access control

## Component 3: Self-Serve Advertising Platform

### Current Implementation Enhancement

The existing form in `index.html` needs backend integration.

**Step 1: Form Processing Backend**

```javascript
// api/submit-ad.js (Netlify/Vercel Function)
export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const data = JSON.parse(event.body);

  // Validate submission
  if (!data.businessName || !data.email || !data.listingType) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' })
    };
  }

  // Store submission
  const submission = {
    id: Date.now(),
    ...data,
    status: 'pending',
    submittedAt: new Date().toISOString()
  };

  // Save to review queue
  await saveToQueue(submission);

  // Send notification email
  await sendNotificationEmail(submission);

  // Generate Stripe payment link (if paid tier)
  if (data.listingType !== 'Free Listing (£0)') {
    const paymentLink = await createStripePaymentLink(submission);
    submission.paymentLink = paymentLink;
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: 'Submission received. Check your email for next steps.',
      paymentLink: submission.paymentLink
    })
  };
}
```

**Step 2: Email Notifications**

Use a service like:
- SendGrid
- Mailgun
- AWS SES
- Postmark

**Step 3: Payment Integration**

```javascript
// Stripe Payment Links
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PRICING = {
  'Featured Listing (£35/month)': 'price_xxxxxxxxxxxxx',
  'Premium Package (£75/month)': 'price_xxxxxxxxxxxxx',
  'Newsletter Sponsor (£150/month)': 'price_xxxxxxxxxxxxx'
};

async function createStripePaymentLink(submission) {
  const priceId = PRICING[submission.listingType];

  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{
      price: priceId,
      quantity: 1,
    }],
    metadata: {
      submissionId: submission.id,
      businessName: submission.businessName
    }
  });

  return paymentLink.url;
}
```

## Component 4: Content Management

### Static Site Generator Approach (Recommended)

**Why Static?**
- Fast, secure, cheap hosting
- Easy to version control
- Works well with automated workflows
- No database to maintain

**Tools:**
- Eleventy (11ty) - JavaScript, flexible
- Hugo - Fast, Go-based
- Jekyll - Ruby, GitHub Pages native

**Example with Eleventy:**

```bash
npm install -D @11ty/eleventy
```

**Directory Structure:**
```
/src/
  /_includes/       # Templates
  /_data/          # Global data (RSS feeds, directories)
  /news/           # News articles
  /directory/      # Business listings
  /events/         # Event pages
  index.html       # Homepage

/data/
  /review-queue/   # Pending content
  /published/      # Approved content
  /rejected/       # Rejected content

/scripts/
  rss-aggregator.js
  publish.js

/admin/
  review.html      # Admin dashboard
```

### Dynamic Content Display

**News Page Generation:**
```javascript
// src/_data/newsArticles.js
const fs = require('fs');
const path = require('path');

module.exports = function() {
  const publishedDir = path.join(__dirname, '../../data/published/news');
  const files = fs.readdirSync(publishedDir);

  return files
    .map(file => {
      const content = fs.readFileSync(path.join(publishedDir, file), 'utf-8');
      return JSON.parse(content);
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 50); // Latest 50 articles
};
```

## Component 5: Analytics & Tracking

### Google Analytics 4 Setup

```html
<!-- Add to <head> of all pages -->
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

**Key Events to Track:**
- Page views (automatic)
- Newsletter signups
- Ad form submissions
- External link clicks (affiliates)
- Download/PDF views

### Custom Event Tracking

```javascript
// Track newsletter signup
document.querySelector('.newsletter-form').addEventListener('submit', function(e) {
  gtag('event', 'newsletter_signup', {
    'event_category': 'engagement',
    'event_label': 'footer_form'
  });
});

// Track ad submission
document.querySelector('#businessForm').addEventListener('submit', function(e) {
  gtag('event', 'ad_submission', {
    'event_category': 'monetization',
    'event_label': document.querySelector('select[name="listingType"]').value
  });
});
```

## Component 6: Google AdSense Integration

### Setup Steps

1. **Apply for AdSense:**
   - Go to google.com/adsense
   - Submit site for review
   - Add verification code to site
   - Wait for approval (1-2 weeks)

2. **Create Ad Units:**
   - Header banner (728x90 or 970x250)
   - Sidebar (300x250 or 300x600)
   - In-feed ads (responsive)
   - Article end ads (responsive)

3. **Implement Ad Code:**

```html
<!-- Header Ad -->
<div class="ad-container" style="text-align: center; margin: 20px 0;">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
       crossorigin="anonymous"></script>
  <ins class="adsbygoogle"
       style="display:inline-block;width:728px;height:90px"
       data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
       data-ad-slot="XXXXXXXXXX"></ins>
  <script>
       (adsbygoogle = window.adsbygoogle || []).push({});
  </script>
</div>
```

**Best Practices:**
- Place ads above the fold for visibility
- Use responsive ad units for mobile
- Don't overload pages (max 3-4 ads)
- Monitor earnings and adjust placement
- Comply with AdSense policies

## Component 7: Newsletter System

### Recommended Tools

**Option A: Self-Hosted (Free)**
- Listmonk (open source, self-hosted)
- Setup: Docker container + PostgreSQL

**Option B: Third-Party (Paid)**
- Mailchimp (easiest, free up to 500 subscribers)
- Buttondown (clean, simple, affordable)
- ConvertKit (creator-focused)
- Substack (if you want native monetization)

### Integration with Site

```html
<!-- Update newsletter form in footer -->
<form action="https://yourlist.com/subscribe" method="POST" class="newsletter-form">
  <input type="email" name="email" placeholder="Your email" required>
  <input type="hidden" name="list" value="oldoaktown-weekly">
  <button type="submit" class="btn">Subscribe</button>
</form>
```

### Newsletter Content Strategy

**Weekly Newsletter Format:**
```
Subject: Old Oak Weekly: [Main Headline]

👋 Hi [Name],

This week in Old Oak:

🏗️ DEVELOPMENT UPDATE
[HS2/OPDC news with link]

🏘️ COMMUNITY HIGHLIGHT
[Local business or event spotlight]

📅 UPCOMING EVENTS
- [Event 1]
- [Event 2]

📰 TOP STORIES
1. [Article 1]
2. [Article 2]
3. [Article 3]

---

💼 FEATURED LISTING
[Paid advertiser spotlight]

---

[Footer with unsubscribe]
```

## Deployment

### Recommended Hosting Setup

**Option A: Netlify (Recommended for Static)**
1. Connect GitHub repo
2. Build command: `npm run build` (if using 11ty)
3. Publish directory: `_site`
4. Custom domain: oldoaktown.co.uk
5. Enable automatic deploys on push

**Option B: Vercel**
- Similar to Netlify
- Excellent for Next.js if you expand

**Option C: GitHub Pages**
- Free hosting
- Works with Jekyll natively
- Custom domain support

### Continuous Deployment Workflow

```
1. RSS Aggregator runs (GitHub Actions)
   ↓
2. New content added to review queue
   ↓
3. Admin reviews and approves content
   ↓
4. Commit to GitHub
   ↓
5. Netlify auto-deploys
   ↓
6. Live site updated
```

## Security Checklist

- [ ] HTTPS enabled (via hosting provider)
- [ ] Admin area password protected
- [ ] Environment variables for API keys
- [ ] Form validation (client + server side)
- [ ] Rate limiting on submission endpoints
- [ ] Regular dependency updates
- [ ] Backup strategy in place
- [ ] GDPR-compliant cookie notice
- [ ] Privacy policy published
- [ ] Terms of service published

## Performance Optimization

### Critical Actions
- [ ] Minify CSS/JS
- [ ] Optimize images (WebP format, lazy loading)
- [ ] Enable caching headers
- [ ] Use CDN for static assets
- [ ] Implement critical CSS
- [ ] Remove unused CSS/JS
- [ ] Compress responses (gzip/brotli)

### Target Metrics
- Lighthouse score: 90+
- Page load time: <2 seconds
- Time to Interactive: <3 seconds
- First Contentful Paint: <1 second

## Maintenance Schedule

### Daily (Automated)
- RSS feed aggregation
- Backup of data files

### Daily (Manual - 15-30 min)
- Review and publish pending content
- Respond to ad submissions
- Monitor analytics

### Weekly
- Newsletter compilation and send
- Social media posts
- Engagement with community

### Monthly
- Deep dive article publication
- Revenue and traffic analysis
- Ad placement optimization
- Backlink acquisition efforts

### Quarterly
- Strategic review
- Content audit
- SEO analysis
- Competitive analysis
- Feature roadmap update

## Next Steps

1. **Week 1:** Set up RSS aggregation and review workflow
2. **Week 2:** Implement ad submission form backend
3. **Week 3:** Configure analytics and AdSense
4. **Week 4:** Launch newsletter and begin promotion
5. **Month 2+:** Focus on content creation and community building

## Support Resources

- **Technical Documentation:** This guide + code comments
- **Strategic Planning:** `/STRATEGIC_BLUEPRINT.md`
- **Community:** Old Oak Town forum (coming soon)
- **Updates:** See changelog in repository

---

**Questions or Issues?** Create an issue in the GitHub repository or contact the development team.
