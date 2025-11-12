# Backend Setup Guide - Old Oak Town

This guide explains how to set up the automated backend system for processing business listing payments and approvals.

## Overview

The backend automation system consists of:

1. **API Endpoints** (Vercel Serverless Functions)
   - `/api/save-submission` - Saves form data before payment
   - `/api/stripe-webhook` - Receives Stripe payment notifications
   - `/api/get-pending` - Admin dashboard for reviewing submissions
   - `/api/approve-listing` - Approves paid submissions

2. **Data Storage**
   - `/data/pending-listings.json` - Submissions awaiting payment or approval
   - `/data/approved-listings.json` - Approved live listings

3. **Workflow**
   ```
   User fills form → Save to backend → Redirect to Stripe
                                          ↓
   Stripe webhook ← User pays ← Stripe Payment Link
         ↓
   Update status to "paid"
         ↓
   Admin reviews at /api/get-pending
         ↓
   Click "Approve" → Published to directory
   ```

## Step 1: Configure Vercel Environment Variables

Go to your Vercel Dashboard:
1. Navigate to your project: https://vercel.com/dashboard
2. Click on your "oldoaktown" project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

### Required Variables:

```bash
# Stripe Secret Key (for API calls)
STRIPE_SECRET_KEY=sk_test_51SSKU2ACivaWK7rd...
# Get from: https://dashboard.stripe.com/test/apikeys

# Stripe Webhook Secret (for verifying webhooks)
STRIPE_WEBHOOK_SECRET=whsec_...
# You'll get this in Step 2 when creating the webhook

# Admin Password (for accessing admin dashboard)
ADMIN_PASSWORD=YourSecurePassword123
# Choose a strong password - this protects your admin page
```

**Important:** Make sure to add these for **ALL environments** (Production, Preview, Development)

## Step 2: Configure Stripe Webhook

### A. Create the Webhook Endpoint

1. Go to Stripe Dashboard: https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"**
3. Enter your webhook URL:
   ```
   https://oldoaktown.vercel.app/api/stripe-webhook
   ```
4. Select events to listen for:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`

5. Click **"Add endpoint"**

### B. Get the Webhook Signing Secret

1. After creating the webhook, click on it
2. Under "Signing secret", click **"Reveal"**
3. Copy the secret (starts with `whsec_`)
4. Add it to Vercel environment variables as `STRIPE_WEBHOOK_SECRET`

## Step 3: Configure Payment Link Return URLs

For each of your 6 Stripe Payment Links, you need to set the return URLs:

1. Go to: https://dashboard.stripe.com/test/payment-links
2. For **each Payment Link**, click the "⋮" menu → "Edit"
3. Scroll to **"After payment"** section
4. Configure:
   - **Success page:** `https://oldoaktown.vercel.app/payment-success.html`
   - **Cancel page:** `https://oldoaktown.vercel.app/payment-cancel.html`
5. Click **"Save"**

Repeat for all 6 links:
- Featured Monthly
- Featured Annual
- Premium Monthly
- Premium Annual
- Newsletter Monthly
- Newsletter Annual

## Step 4: Deploy to Vercel

The backend will automatically deploy when you push to your repository:

```bash
git add .
git commit -m "Add backend automation for business listings"
git push origin main
```

Vercel will detect the `/api` folder and automatically create serverless functions.

## Step 5: Test the System

### Test 1: Submission Flow

1. Go to: https://oldoaktown.vercel.app/business-submit.html
2. Fill out the form completely
3. Click "Proceed to Payment"
4. **Expected:** Button shows "Saving submission..." then "Redirecting to payment..."
5. You should be redirected to Stripe Payment Link

### Test 2: Admin Dashboard (Before Payment)

1. Go to: `https://oldoaktown.vercel.app/api/get-pending?password=YourPassword`
2. **Expected:** You should see your submission under "Awaiting Payment" section

### Test 3: Complete Test Payment

1. On Stripe Payment Link, use test card:
   - Card number: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/25)
   - CVC: Any 3 digits (e.g., 123)
   - Postal code: Any valid code
2. Complete payment
3. **Expected:** Redirected to payment-success.html with order details

### Test 4: Webhook Verification

1. Go to Stripe Dashboard → Webhooks
2. Click on your webhook endpoint
3. Check the "Events" tab
4. **Expected:** You should see a `checkout.session.completed` event with status 200 (success)

### Test 5: Admin Approval

1. Go back to: `https://oldoaktown.vercel.app/api/get-pending?password=YourPassword`
2. **Expected:** Submission moved to "Paid Submissions - Ready to Approve" section
3. Click **"✅ Approve & Publish"**
4. **Expected:** Alert says "Listing approved!" and page refreshes
5. Check `/data/approved-listings.json` - your business should be there

## Step 6: Verify Data Files

After testing, check that the data files are being created:

```bash
# Check pending submissions
cat data/pending-listings.json

# Check approved listings
cat data/approved-listings.json
```

## Accessing the Admin Dashboard

### URL Format:
```
https://oldoaktown.vercel.app/api/get-pending?password=YOUR_PASSWORD
```

Replace `YOUR_PASSWORD` with the password you set in `ADMIN_PASSWORD` environment variable.

### Dashboard Features:

- **Statistics:** Shows counts of awaiting payment, paid, and approved
- **Paid Submissions:** Highlighted in green, ready to approve
- **Approve Button:** Moves listing to approved and publishes it
- **View in Stripe:** Opens the payment details in Stripe Dashboard

### Workflow:

1. Customer completes payment
2. You receive notification (from Stripe email)
3. Open admin dashboard
4. Review the paid submission
5. Click "Approve & Publish"
6. Listing is live!

## Security Notes

### Password Protection

- ⚠️ **Change the default password** in `.env` and Vercel settings
- 🔒 Only share the admin URL + password with trusted team members
- 🔄 Rotate password periodically

### Webhook Security

- ✅ Webhook signature verification is enabled
- ✅ Only requests from Stripe will be accepted
- ⚠️ Never disable `STRIPE_WEBHOOK_SECRET` in production

### Data Privacy

- Customer data is stored in `/data/pending-listings.json`
- This file is **gitignored** by default to protect customer information
- Consider adding encryption for sensitive data if needed

## Troubleshooting

### Issue: "Failed to save submission"

**Check:**
1. Vercel deployment completed successfully
2. `/api/save-submission.js` exists in deployed version
3. Browser console for error details

### Issue: Webhook not receiving events

**Check:**
1. Webhook URL is correct: `https://oldoaktown.vercel.app/api/stripe-webhook`
2. `STRIPE_WEBHOOK_SECRET` is set correctly in Vercel
3. Stripe webhook shows 200 status (not 401 or 500)
4. Check Vercel Function Logs: Dashboard → Functions → stripe-webhook

### Issue: "Unauthorized" when accessing admin page

**Check:**
1. Password parameter is included in URL
2. Password matches `ADMIN_PASSWORD` in Vercel settings
3. Try accessing without cache (Ctrl+Shift+R or Cmd+Shift+R)

### Issue: Submission not showing as "paid" after payment

**Check:**
1. Email addresses match exactly (case-insensitive)
2. Webhook was triggered (check Stripe Dashboard)
3. Check Vercel logs for webhook errors
4. Verify `STRIPE_WEBHOOK_SECRET` is correct

## Optional: Newsletter Integration

To automatically add customers to your newsletter, uncomment and configure in `/api/stripe-webhook.js`:

### For Mailchimp:

```javascript
// Install: npm install @mailchimp/mailchimp_marketing
const mailchimp = require('@mailchimp/mailchimp_marketing');

mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: "us1" // Your server prefix
});

async function addToNewsletter(email, businessName) {
  await mailchimp.lists.addListMember(LIST_ID, {
    email_address: email,
    status: "subscribed",
    merge_fields: {
      FNAME: businessName
    }
  });
}
```

### For ConvertKit:

```javascript
async function addToNewsletter(email, businessName) {
  await fetch('https://api.convertkit.com/v3/forms/FORM_ID/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.CONVERTKIT_API_KEY,
      email: email,
      fields: { business_name: businessName }
    })
  });
}
```

Then uncomment the function call in the webhook handler.

## Monitoring

### View Logs:

1. Go to Vercel Dashboard
2. Click on your project
3. Go to **Deployments** → Click latest deployment
4. Click **Functions** tab
5. Click on a function (e.g., `stripe-webhook`) to see logs

### What to Monitor:

- ✅ Successful payment webhooks (200 status)
- ❌ Failed webhook verifications (401 errors)
- ❌ Missing submissions (404 when looking up by email)
- 📊 Number of pending vs approved listings

## Next Steps

Once everything is working:

1. **Switch to Live Mode:**
   - Update Payment Links to production mode
   - Update `STRIPE_SECRET_KEY` to `sk_live_...`
   - Update `STRIPE_WEBHOOK_SECRET` to production webhook secret

2. **Update business-directory.html:**
   - Modify to read from `/data/approved-listings.json`
   - Or create an API endpoint to serve approved listings

3. **Add Email Notifications:**
   - Configure SMTP in environment variables
   - Uncomment email sending in webhook handler

4. **Set up Newsletter Integration:**
   - Choose your newsletter service
   - Add API credentials
   - Enable automatic signup

## Support

If you encounter issues:

1. Check Vercel Function Logs
2. Check Stripe Webhook Events log
3. Check browser console for errors
4. Review this guide step-by-step

For further help, contact: info@oldoaktown.co.uk
