# Payment & Backend Setup Guide

Complete guide to setting up Stripe payments and backend for Old Oak Town business submissions.

## Quick Start

1. **Set up Stripe** (5-10 minutes)
2. **Choose backend option** (Netlify or Self-hosted)
3. **Configure email** (optional but recommended)
4. **Test the flow**

---

## Part 1: Stripe Setup

### Step 1: Create Stripe Account

1. Go to [stripe.com](https://stripe.com) and create an account
2. Verify your email and complete account setup

### Step 2: Get API Keys

1. Go to [Dashboard > API Keys](https://dashboard.stripe.com/test/apikeys)
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)
   ⚠️ **NEVER share or commit your secret key!**

### Step 3: Create Products in Stripe

Create the following products in [Dashboard > Products](https://dashboard.stripe.com/test/products):

#### Featured Listing
- **Monthly**: £35/month (recurring)
  - Click "Add product"
  - Name: "Featured Listing - Monthly"
  - Price: £35.00 GBP
  - Billing: Recurring - Monthly
  - Copy the **Price ID** (starts with `price_`)

- **Annual**: £126/year (recurring or one-time)
  - Name: "Featured Listing - Annual"
  - Price: £126.00 GBP
  - Billing: Recurring - Yearly (or One-time)
  - Copy the **Price ID**

#### Premium Package
- **Monthly**: £75/month
- **Annual**: £270/year

#### Newsletter Sponsor
- **Monthly**: £150/month
- **Annual**: £540/year

### Step 4: Update stripe-config.js

Edit `/stripe-config.js` and replace:

```javascript
publishableKey: 'pk_test_YOUR_ACTUAL_KEY',

priceIds: {
    featured: {
        monthly: 'price_ACTUAL_ID_HERE',
        annual: 'price_ACTUAL_ID_HERE'
    },
    // ... repeat for premium and newsletter
}
```

---

## Part 2: Backend Setup

Choose ONE of the following options:

### Option A: Netlify (Recommended for Static Sites)

**Best for**: Easy deployment, no server management, generous free tier

#### Setup Steps:

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   - Copy `.env.example` to `.env`
   - Fill in your Stripe secret key and email settings

4. **Test Locally**
   ```bash
   npm run netlify
   ```
   Opens at http://localhost:8888

5. **Deploy to Netlify**
   ```bash
   netlify init
   netlify deploy --prod
   ```

6. **Set Environment Variables in Netlify**
   - Go to Netlify Dashboard > Site Settings > Environment Variables
   - Add all variables from your `.env` file
   - ⚠️ Don't use the `.env` file in production - set them in Netlify UI

#### What You Get:
- Serverless functions at `/.netlify/functions/business-submit`
- Automatic HTTPS
- CDN distribution
- Free SSL certificate

---

### Option B: Self-Hosted Express Server

**Best for**: Full control, existing server infrastructure

#### Setup Steps:

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Test Locally**
   ```bash
   npm run dev
   ```
   Opens at http://localhost:3000

4. **Production Deployment**
   ```bash
   npm start
   ```

5. **Update API Endpoint**
   In `payment-success.html`, update the fetch URL:
   ```javascript
   fetch('/api/business-submit', { ... })
   ```

#### What You Get:
- Full server control
- Easy to customize
- Can integrate with any database
- View submissions at `/api/submissions`

---

## Part 3: Email Configuration (Optional)

Sends confirmation emails to customers and notifications to admin.

### Using Gmail:

1. **Enable 2-Factor Authentication** on your Google account

2. **Create App Password**
   - Go to [Google Account > Security](https://myaccount.google.com/security)
   - Search for "App Passwords"
   - Generate password for "Mail"

3. **Update .env**
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-digit-app-password
   SMTP_FROM="Old Oak Town" <noreply@oldoaktown.co.uk>
   ADMIN_EMAIL=admin@oldoaktown.co.uk
   ```

### Using Other Email Providers:

**SendGrid** (Recommended for production):
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=YOUR_SENDGRID_API_KEY
```

**Mailgun**:
```
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=YOUR_MAILGUN_SMTP_PASSWORD
```

---

## Part 4: Database Options (Optional)

By default, submissions are saved to JSON files. For production, use a database:

### Option 1: Airtable (Easiest)

1. Create Airtable account
2. Create a base with these fields:
   - Business Name (text)
   - Email (email)
   - Phone (phone)
   - Package (single select)
   - Frequency (single select)
   - Description (long text)
   - Website (URL)
   - Status (single select: Pending, Paid, Live)
   - Submitted (date)
   - Stripe Session (text)

3. Get API key from [Airtable Account](https://airtable.com/account)
4. Update `.env`:
   ```
   AIRTABLE_API_KEY=your_key
   AIRTABLE_BASE_ID=your_base_id
   ```

5. Uncomment the Airtable code in `netlify/functions/business-submit.js`

### Option 2: Google Sheets

1. Create Google Sheet with columns matching Airtable above
2. Enable Google Sheets API
3. Create service account
4. Share sheet with service account email
5. Update `.env` with credentials
6. Uncomment Google Sheets code in backend

### Option 3: MongoDB/PostgreSQL

For high-volume sites, use a proper database.

---

## Testing the Complete Flow

### Test Mode (No Real Payments):

1. **Use Stripe Test Cards**:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - Any future expiry, any CVC

2. **Test Flow**:
   ```
   1. Go to business-submit.html
   2. Select a package
   3. Choose payment frequency
   4. Fill in form
   5. Use test card 4242 4242 4242 4242
   6. Complete payment
   7. Check submissions folder or database
   8. Check email (if configured)
   ```

3. **View Test Payments**:
   - Stripe Dashboard > Payments (toggle TEST mode)

### Go Live:

1. **Switch to Live Mode in Stripe**:
   - Get live API keys (pk_live_, sk_live_)
   - Create same products in live mode
   - Update `stripe-config.js` with live keys

2. **Update Environment**:
   - Set `NODE_ENV=production`
   - Use production SMTP credentials
   - Enable production database

3. **Final Checks**:
   - Test with small real payment
   - Verify emails send
   - Check submission saves
   - Test refund process

---

## Security Checklist

- [ ] Never commit `.env` file
- [ ] Use HTTPS in production
- [ ] Keep Stripe secret key secret
- [ ] Validate all form inputs
- [ ] Sanitize data before storing
- [ ] Use environment variables for sensitive data
- [ ] Enable Stripe webhook signatures
- [ ] Set up proper error logging
- [ ] Implement rate limiting
- [ ] Add CAPTCHA for free submissions

---

## Troubleshooting

### "Stripe not configured" message
- Check `stripe-config.js` has correct publishable key
- Check Price IDs start with `price_` not placeholder text

### Payment redirects but doesn't complete
- Check success URL is correct
- Check Stripe webhook (if using)
- Check browser console for errors

### Emails not sending
- Verify SMTP credentials
- Check spam folder
- Enable "less secure apps" or use app password
- Check email logs in server console

### Submissions not saving
- Check `submissions` folder exists and is writable
- Check database connection (if using)
- Check backend logs for errors
- Verify API endpoint is correct

---

## Support

- **Stripe Documentation**: https://stripe.com/docs
- **Netlify Documentation**: https://docs.netlify.com
- **Issue Tracking**: Create issue in repository

---

## Next Steps

After setup:
1. Test thoroughly in test mode
2. Create admin panel to manage submissions
3. Set up Stripe webhooks for automated processing
4. Implement automated listing publication
5. Add analytics tracking
6. Set up automated refunds process
7. Create customer dashboard

---

**Estimated Setup Time**: 30-60 minutes for complete setup
