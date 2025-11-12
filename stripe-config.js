// Stripe Configuration for Old Oak Town Business Listings
// Using Stripe Payment Links for simplified checkout

const STRIPE_CONFIG = {
    // Payment Link URLs for each package/frequency combination
    // These are pre-built Stripe-hosted checkout pages that handle subscriptions
    paymentLinks: {
        featured: {
            monthly: 'https://buy.stripe.com/3cI14p4Gz51GeGWgEUes000',  // £35/month subscription
            annual: 'https://buy.stripe.com/28E9AV6OHcu8cyOcoEes002'     // £126/year subscription
        },
        premium: {
            monthly: 'https://buy.stripe.com/8x23cx8WP51G6aq74kes003',   // £75/month subscription
            annual: 'https://buy.stripe.com/7sYfZj0qjdycbuK4Wces004'     // £270/year subscription
        },
        newsletter: {
            monthly: 'https://buy.stripe.com/cNi3cx4Gz0Lq7eufAQes005', // £150/month subscription
            annual: 'https://buy.stripe.com/7sYfZjeh9dyc56mcoEes006'    // £540/year subscription
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
