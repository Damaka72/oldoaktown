-- supabase/migrations/002_admin_dashboard_rls.sql
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- The original policy only lets the anon key read approved listings.
-- The admin dashboard queries Supabase directly with the anon key and needs
-- to see ALL listings (pending, rejected, etc.).
--
-- This migration replaces the restrictive select policy with one that allows
-- the anon key to read all rows. Approve/reject/update operations still go
-- through the server-side API which uses the service key, so there is no
-- risk of unauthorised writes.

-- Drop the old restrictive policy
drop policy if exists "Public can read approved listings" on public.businesses;

-- Allow anyone to read all listings (needed for admin dashboard + directory)
-- Write operations (insert/update/delete) still require the service key
create policy "Anyone can read all listings"
    on public.businesses
    for select
    using (true);
