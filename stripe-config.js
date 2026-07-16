// Stripe Configuration for Old Oak Town Business Listings
// Using Stripe Payment Links for simplified checkout

const STRIPE_CONFIG = {
    // Payment Link URLs for each package/frequency combination
    // These are pre-built Stripe-hosted checkout pages that handle subscriptions
    paymentLinks: {
        featured: {
            monthly: 'https://buy.stripe.com/14AaEX4RebMs6b69M20Jq00',  // £35/month subscription
            annual: 'https://buy.stripe.com/7sYdR9fvSeYE1UQ1fw0Jq01'     // £126/year subscription
        },
        premium: {
            monthly: 'https://buy.stripe.com/eVq5kD83qaIoarm3nE0Jq02',   // £75/month subscription
            annual: 'https://buy.stripe.com/8x228r4Re17O572f6m0Jq03'     // £270/year subscription
        },
        newsletter: {
            monthly: 'https://buy.stripe.com/bJe14ndnKbMs1UQ3nE0Jq04', // £150/month subscription
            annual: 'https://buy.stripe.com/8x228r4RecQw2YU4rI0Jq05'    // £540/year subscription
        }
    }
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
