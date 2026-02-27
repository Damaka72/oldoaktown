# Business Sign-Up & Upgrade Process Flow

## Where Does Submitted Data Go?

1. **Browser → `/api/submit-business`** — form data POSTed as JSON
2. **`/api/submit-business` → Supabase `businesses` table** — record inserted (falls back to local `data/pending-listings.json` if Supabase not configured)
3. **`/api/submit-business` → Admin email** — approval request sent (free tier only at this stage)
4. **Stripe → `/api/stripe-webhook`** — payment confirmation updates the Supabase record
5. **`/api/approve-business` or `/api/approve-listing` → Supabase** — status set to `approved`, email sent to business owner

---

## FREE LISTING FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│  USER fills out business-submit.html                            │
│  (name, category, email, description, address, phone, website)  │
│  selects tier = FREE                                            │
└────────────────────────────┬────────────────────────────────────┘
                             │ POST /api/submit-business
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  api/submit-business.js                                         │
│  • Validates required fields                                    │
│  • Sets status = "pending"                                      │
│  • Inserts record into Supabase businesses table                │
│  • Sends admin approval email (info@oldoaktown.co.uk)           │
│    ↳ Email contains: business details + Approve / Reject links  │
└──────────┬──────────────────────────────────────────────────────┘
           │ HTTP 200 { success: true }
           ▼
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER shows inline success message                           │
│  "Thanks for listing [Business Name].                           │
│   We'll review it and you'll receive an email                   │
│   within 2 business days."                                      │
└─────────────────────────────────────────────────────────────────┘

                  [Admin receives email]
                         │
           ┌─────────────┴──────────────┐
           │ APPROVE link clicked        │ REJECT link clicked
           ▼                             ▼
┌──────────────────────┐     ┌──────────────────────────┐
│ GET /api/approve-    │     │ GET /api/approve-         │
│ business?action=     │     │ business?action=          │
│ approve&token=XXX    │     │ reject&token=XXX          │
│                      │     │                           │
│ • status = "approved"│     │ • status = "rejected"     │
│ • approved_at = now  │     │                           │
│ • Email business:    │     │ • Email business:         │
│   "Your listing is   │     │   "We could not approve   │
│   live! 🎉"          │     │   your listing"           │
└──────────────────────┘     └──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Listing appears in business-directory.html                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## PAID LISTING FLOW (Featured / Premium / Newsletter)

```
┌─────────────────────────────────────────────────────────────────┐
│  USER fills out business-submit.html                            │
│  selects tier = FEATURED / PREMIUM / NEWSLETTER                 │
│  selects billing = MONTHLY / ANNUAL                             │
└────────────────────────────┬────────────────────────────────────┘
                             │ POST /api/submit-business
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  api/submit-business.js                                         │
│  • Validates required fields                                    │
│  • Sets status = "pending_payment"                              │
│  • Inserts record into Supabase businesses table                │
│  • NO email sent yet (payment not confirmed)                    │
└──────────┬──────────────────────────────────────────────────────┘
           │ HTTP 200 { success: true }
           ▼
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER saves to sessionStorage:                               │
│  { businessName, email, package, frequency }                    │
│  Sets flag: stripeRedirectPending = "true"                      │
│  Redirects to Stripe Payment Link                               │
│  ?prefilled_email=user@email.com                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┴───────────────┐
              │ PAYS                          │ CANCELS
              ▼                               ▼
┌─────────────────────────┐    ┌──────────────────────────────┐
│  Stripe checkout        │    │  User returns to form page   │
│  processes payment &    │    │  Script detects              │
│  creates subscription   │    │  stripeRedirectPending flag  │
│                         │    │  Redirects to               │
│  Redirects to:          │    │  payment-cancel.html         │
│  payment-success.html   │    │                              │
│  ?session_id=XXX        │    │  Options: Try Again /        │
└────────────┬────────────┘    │  Free Listing / Contact Us   │
             │                 └──────────────────────────────┘
             ▼
┌─────────────────────────────────────────────────────────────────┐
│  payment-success.html                                           │
│  • Reads session data from sessionStorage                       │
│  • Displays order summary (name, package, frequency, email)     │
│  • POST /api/submit-business again as redundancy backup         │
│  • Clears sessionStorage                                        │
└─────────────────────────────────────────────────────────────────┘

             ↕  (simultaneously, Stripe fires webhook)

┌─────────────────────────────────────────────────────────────────┐
│  Stripe fires: checkout.session.completed                       │
│  POST /api/stripe-webhook                                       │
│                                                                 │
│  api/stripe-webhook.js                                          │
│  • Verifies Stripe signature                                    │
│  • Finds Supabase record                                        │
│  • Updates:                                                     │
│      status               → "pending"   (awaits admin review)  │
│      stripe_customer_id   → cus_XXXX                           │
│      stripe_subscription_id → sub_XXXX                         │
│      stripe_payment_status → "active"                          │
│  • Sends admin approval email:                                  │
│    "💳 Payment Confirmed - [Business] - Needs Approval"        │
└──────────────────────────────────────────────────────────────────┘

                  [Admin receives email]
                         │
           ┌─────────────┴──────────────┐
           │ APPROVE                     │ REJECT
           ▼                             ▼
  (same as Free Tier approval flow above)
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Listing appears in business-directory.html with paid badge     │
└─────────────────────────────────────────────────────────────────┘
```

---

## SUBSCRIPTION CANCELLATION FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│  Customer cancels subscription in Stripe billing portal         │
└────────────────────────────┬────────────────────────────────────┘
                             │ Stripe fires: customer.subscription.deleted
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  api/stripe-webhook.js                                          │
│  • Finds business by stripe_subscription_id                     │
│  • Updates:                                                     │
│      tier                    → "free"                           │
│      stripe_payment_status   → "cancelled"                      │
│      stripe_subscription_id  → null                             │
│  • Sends cancellation email to business owner:                  │
│    "Your subscription has been cancelled.                       │
│     Your listing will remain as a free listing."                │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Listing remains in directory at free tier                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## PAYMENT FAILURE FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│  Recurring subscription charge fails (card expired, etc.)       │
└────────────────────────────┬────────────────────────────────────┘
                             │ Stripe fires: invoice.payment_failed
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  api/stripe-webhook.js                                          │
│  • Finds business by stripe_subscription_id                     │
│  • Updates: stripe_payment_status → "payment_failed"            │
│  • No automatic email — manual admin follow-up required         │
└─────────────────────────────────────────────────────────────────┘
```

---

## ADMIN DASHBOARD FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│  Admin visits /admin/dashboard.html                             │
│  Enters admin password                                          │
└────────────────────────────┬────────────────────────────────────┘
                             │ GET /api/get-pending?password=XXX
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase: SELECT all businesses ORDER BY created_at DESC       │
│                                                                 │
│  Dashboard displays 3 sections:                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. NEEDS APPROVAL  (status = "pending")                  │  │
│  │    Free:  "📋 Free — Needs Approval"                     │  │
│  │    Paid:  "💳 Paid — Needs Approval"                     │  │
│  │    [✅ Approve & Publish] button → POST /api/approve-    │  │
│  │                                    listing               │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ 2. AWAITING PAYMENT  (status = "pending_payment")        │  │
│  │    "⏳ Awaiting Payment"  — no action buttons            │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ 3. APPROVED  (status = "approved")                       │  │
│  │    "✅ Approved"  — reference only                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## DATA STORAGE SUMMARY

| Field                   | Free | Featured | Premium | Newsletter |
|-------------------------|------|----------|---------|------------|
| business_name           | ✓    | ✓        | ✓       | ✓          |
| category                | ✓    | ✓        | ✓       | ✓          |
| email                   | ✓    | ✓        | ✓       | ✓          |
| phone                   | ✓    | ✓        | ✓       | ✓          |
| address / postcode      | ✓    | ✓        | ✓       | ✓          |
| description             | ✓    | ✓        | ✓       | ✓          |
| website                 | ✓    | ✓        | ✓       | ✓          |
| instagram / twitter / linkedin |  |          | ✓       | ✓          |
| opening_hours           |      |          | ✓       | ✓          |
| special_offers          |      |          | ✓       | ✓          |
| target_audience         |      |          | ✓       | ✓          |
| stripe_customer_id      |      | ✓        | ✓       | ✓          |
| stripe_subscription_id  |      | ✓        | ✓       | ✓          |
| stripe_payment_status   |      | ✓        | ✓       | ✓          |
| billing_frequency       |      | ✓        | ✓       | ✓          |

---

## EMAIL NOTIFICATIONS SUMMARY

| Trigger                          | Recipient      | Subject                                          |
|----------------------------------|----------------|--------------------------------------------------|
| Free listing submitted           | Admin          | New Free Listing Submission: [Business]          |
| Paid listing payment confirmed   | Admin          | 💳 Payment Confirmed - [Business] - Needs Approval |
| Listing approved                 | Business owner | Your Old Oak Town listing is live! 🎉            |
| Listing rejected                 | Business owner | Old Oak Town listing update - [Business]         |
| Subscription cancelled           | Business owner | Your Old Oak Town subscription has been cancelled |
