// Stripe Configuration for Old Oak Town Business Listings
// Replace these with your actual Stripe Price IDs after creating products in Stripe Dashboard

const STRIPE_CONFIG = {
    // Stripe Publishable Key (Test Mode)
    publishableKey: 'pk_test_51SSKU2ACivaWK7rd4GweHtrVYLG3hb4j9mSbMUn63dJGrW5qZ4F2UXwgO0mXLEaCOnK0yeHo3W10TBRxmenmSfWi00o75BTXd9',

    // Price IDs for each package/frequency combination
    // Create these in Stripe Dashboard: https://dashboard.stripe.com/test/products
    priceIds: {
        featured: {
            monthly: 'price_1SSKXXACivaWK7rdlClSn2TY',  // £35/month subscription
            annual: 'price_1SSKaiACivaWK7rdbseMMAUd'     // £126/year subscription
        },
        premium: {
            monthly: 'price_1SSKdXACivaWK7rdhuJ8eRpL',   // £75/month subscription
            annual: 'price_1SSKeCACivaWK7rdMpujbIQp'     // £270/year subscription
        },
        newsletter: {
            monthly: 'price_1SSKemACivaWK7rd4eVi2Nrf', // £150/month subscription
            annual: 'price_1SSKfJACivaWK7rdYn2UFfNm'    // £540/year subscription
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
