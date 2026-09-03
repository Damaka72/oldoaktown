-- supabase/migrations/005_restrict_public_read_to_approved.sql
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- Reverts the "Anyone can read all listings" policy added in
-- 002_admin_dashboard_rls.sql. That migration was written because
-- admin/dashboard.html queried Supabase directly with the public anon key
-- and needed to see pending/rejected submissions too — but it also meant
-- ANYONE with the anon key (hardcoded in that page's public HTML source)
-- could read every business's PII (email, phone, address) for every
-- pending and rejected submission, with no authentication at all. The
-- dashboard's password check was client-side only and never actually
-- gated this data.
--
-- admin/dashboard.html has been updated to fetch all listings through
-- POST /api/approve-listing { action: "list", password } instead, which
-- checks ADMIN_PASSWORD server-side and reads with the service-role key
-- (which bypasses RLS entirely). So the anon key no longer needs — and
-- should not have — read access to non-approved rows.

drop policy if exists "Anyone can read all listings" on public.businesses;

create policy "Public can read approved listings"
    on public.businesses
    for select
    using (status = 'approved');
