// Stripe Configuration for Old Oak Town Business Listings
// Replace these with your actual Stripe Price IDs after creating products in Stripe Dashboard

const STRIPE_CONFIG = {
    // REPLACE WITH YOUR STRIPE PUBLISHABLE KEY
    publishableKey: 'pk_test_YOUR_KEY_HERE', // Get from https://dashboard.stripe.com/test/apikeys

    // Price IDs for each package/frequency combination
    // Create these in Stripe Dashboard: https://dashboard.stripe.com/test/products
    priceIds: {
        featured: {
            monthly: 'price_featured_monthly',  // £35/month subscription
            annual: 'price_featured_annual'     // £126/year one-time or subscription
        },
        premium: {
            monthly: 'price_premium_monthly',   // £75/month subscription
            annual: 'price_premium_annual'      // £270/year one-time or subscription
        },
        newsletter: {
            monthly: 'price_newsletter_monthly', // £150/month subscription
            annual: 'price_newsletter_annual'    // £540/year one-time or subscription
        }
    },

    // URLs for redirect after payment
    successUrl: window.location.origin + '/payment-success.html',
    cancelUrl: window.location.origin + '/payment-cancel.html'
};

// Instructions to set up Stripe products:
/*
1. Go to https://dashboard.stripe.com/test/products
2. Click "Add product" for each package:

FEATURED LISTING:
- Name: "Featured Listing - Monthly"
- Price: £35.00 GBP
- Billing period: Monthly
- Copy the Price ID and paste above

- Name: "Featured Listing - Annual"
- Price: £126.00 GBP
- Billing period: Yearly (or one-time if you prefer)
- Copy the Price ID

PREMIUM PACKAGE:
- Name: "Premium Package - Monthly"
- Price: £75.00 GBP
- Billing period: Monthly

- Name: "Premium Package - Annual"
- Price: £270.00 GBP
- Billing period: Yearly

NEWSLETTER SPONSOR:
- Name: "Newsletter Sponsor - Monthly"
- Price: £150.00 GBP
- Billing period: Monthly

- Name: "Newsletter Sponsor - Annual"
- Price: £540.00 GBP
- Billing period: Yearly

3. For live/production mode, create the same products in live mode
   and update publishableKey to your live key (pk_live_...)
*/
