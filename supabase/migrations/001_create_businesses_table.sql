-- supabase/migrations/001_create_businesses_table.sql
--
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- to create the table the application expects.

create table if not exists public.businesses (
    id                    uuid primary key default gen_random_uuid(),
    created_at            timestamptz not null default now(),

    -- Core listing details
    business_name         text not null,
    category              text,
    description           text,
    address               text,
    postcode              text,
    phone                 text,
    email                 text not null,
    website               text,

    -- Social media
    instagram             text,
    twitter               text,
    linkedin              text,

    -- Extra info (premium/newsletter tiers)
    opening_hours         text,
    special_offers        text,
    target_audience       text,

    -- Media
    logo_url              text,
    image_urls            text[],

    -- Subscription / billing
    tier                  text not null default 'free',
    billing_frequency     text,                            -- 'monthly' | 'annual'
    status                text not null default 'pending', -- 'pending' | 'pending_payment' | 'approved' | 'rejected'
    approved_at           timestamptz,

    -- Stripe
    stripe_customer_id    text,
    stripe_subscription_id text,
    stripe_payment_status  text,                           -- 'active' | 'cancelled' | 'payment_failed'

    -- Analytics
    view_count            integer not null default 0
);

-- ── Indexes ────────────────────────────────────────────────────────────────────

-- Directory page queries filter by status and sort by tier
create index if not exists businesses_status_idx  on public.businesses (status);
create index if not exists businesses_tier_idx    on public.businesses (tier);
create index if not exists businesses_category_idx on public.businesses (category);

-- Stripe webhook looks up by stripe_customer_id
create index if not exists businesses_stripe_customer_idx
    on public.businesses (stripe_customer_id);

-- ── Row-level security ─────────────────────────────────────────────────────────
--
-- Enable RLS so that:
--   • Public (anon key)  → read only approved listings
--   • Server (service key) → full access (bypasses RLS automatically)

alter table public.businesses enable row level security;

-- Anyone can read approved listings (used by /api/get-businesses)
create policy "Public can read approved listings"
    on public.businesses
    for select
    using (status = 'approved');

-- Service-role key bypasses RLS entirely, so no extra policies needed for
-- insert/update/delete — those operations are always done server-side.
